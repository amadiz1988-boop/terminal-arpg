import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import {
  buildWebExperienceActionDetail,
  buildWebExperienceSummary,
  createTelemetryAggregator,
  createTelemetrySampler,
  validateTelemetryEvent,
} from "./telemetry-aggregator.mjs";

export const CANARY_ACTIONS = Object.freeze([
  "automation_start",
  "automation_stop",
  "minimap_marker_update",
  "quest_open",
  "inventory_open",
]);

const CANARY_ACTION_SET = new Set(CANARY_ACTIONS);
const TEST_ACCOUNT_PATTERN = /^(?:jobtest_|gate2_)/i;
const DEVICE_CLASSES = new Set(["desktop", "mobile", "tablet", "other", "unknown"]);
const DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_ROTATED_FILES = 2;
const DEFAULT_HOT_WINDOW_MS = 24 * 60 * 60 * 1000;

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function nullableBoolean(value) {
  return value === true || value === false ? value : null;
}

function safeIdentifier(value) {
  const candidate = String(value ?? "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(candidate)
    ? candidate
    : null;
}

function parseList(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function numericHash(value) {
  const digest = createHash("sha256").update(String(value)).digest();
  return digest.readUInt32BE(0) % 100;
}

function percentile(values, rank) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index];
}

export function deploymentIdentity({
  gitSha = process.env.GIT_SHA ?? process.env.RO_GIT_SHA,
  fileHashes = {},
} = {}) {
  const git = safeIdentifier(gitSha);
  if (git) {
    return {
      deploymentId: git,
      provenanceType: "GIT_SHA",
      provenanceValue: git,
    };
  }
  const seed = Object.entries(fileHashes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, hash]) => `${path}:${hash}`)
    .join("\n");
  const value = seed
    ? createHash("sha256").update(seed).digest("hex")
    : "UNKNOWN";
  return {
    deploymentId: value === "UNKNOWN" ? "UNKNOWN" : `web-${value.slice(0, 16)}`,
    provenanceType: value === "UNKNOWN" ? "UNKNOWN" : "FILE_HASH_BASED",
    provenanceValue: value,
  };
}

async function appendRollingLines({
  rollingFilePath,
  lines,
  maxFileBytes,
  maxRotatedFiles,
  hotWindowMs,
  now,
}) {
  if (!lines.length) return { bytes: 0, path: null };
  const directory = dirname(rollingFilePath);
  await mkdir(directory, { recursive: true });
  const extension = rollingFilePath.endsWith(".ndjson") ? ".ndjson" : ".log";
  const stem = basename(rollingFilePath).replace(/\.(?:ndjson|log)$/i, "");
  const currentPath = join(directory, `${stem}-${dayKey(now)}${extension}`);
  const payload = lines.map((line) => `${JSON.stringify(line)}\n`).join("");
  let currentSize = 0;
  try {
    currentSize = (await stat(currentPath)).size;
  } catch {}
  if (currentSize + Buffer.byteLength(payload) > maxFileBytes && currentSize > 0) {
    const rotated = `${currentPath}.1`;
    await rm(rotated, { force: true });
    await rename(currentPath, rotated);
  }
  await appendFile(currentPath, payload, "utf8");

  const entries = await readdir(directory, { withFileTypes: true });
  const prefix = `${stem}-`;
  const cutoff = now - hotWindowMs;
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => join(directory, entry.name));
  for (const path of candidates) {
    const match = basename(path).match(/^(?:.+-)(\d{4}-\d{2}-\d{2})\.(?:ndjson|log)(?:\.\d+)?$/);
    if (match) {
      const timestamp = Date.parse(`${match[1]}T00:00:00.000Z`);
      if (Number.isFinite(timestamp) && timestamp < cutoff)
        await rm(path, { force: true });
    }
  }
  const rotated = candidates
    .filter((path) => /\.\d+$/.test(path))
    .sort()
    .reverse();
  for (const path of rotated.slice(maxRotatedFiles)) await rm(path, { force: true });
  return { bytes: Buffer.byteLength(payload), path: currentPath };
}

function normalizedClientEvent(input, metadata, registry) {
  const actionId = safeIdentifier(input.actionId);
  if (!actionId || !CANARY_ACTION_SET.has(actionId))
    return { ok: false, errors: ["CANARY_ACTION_NOT_ALLOWED"] };
  const action = registry.actions.find((candidate) => candidate.actionId === actionId);
  if (!action) return { ok: false, errors: ["UNKNOWN_ACTION"] };
  const measurementErrors = ["durationMs", "authorityDurationMs", "visibleDurationMs", "freshnessMs"]
    .filter((name) => input[name] !== null && input[name] !== undefined && finiteNonNegative(input[name]) === null)
    .map((name) => "INVALID_" + name.toUpperCase());
  const flagErrors = ["success", "error", "reject", "timeout", "stale"]
    .filter((name) => input[name] !== null && input[name] !== undefined && nullableBoolean(input[name]) === null)
    .map((name) => "INVALID_" + name.toUpperCase());
  if (measurementErrors.length || flagErrors.length)
    return { ok: false, errors: [...measurementErrors, ...flagErrors] };
  if (input.deviceClass !== null && input.deviceClass !== undefined && !DEVICE_CLASSES.has(input.deviceClass))
    return { ok: false, errors: ["INVALID_DEVICE_CLASS"] };
  if (input.authoritySource !== null && input.authoritySource !== undefined && !safeIdentifier(input.authoritySource))
    return { ok: false, errors: ["INVALID_AUTHORITY_SOURCE"] };
  const timestamp = input.timestamp ?? new Date(metadata.nowMs ?? Date.now()).toISOString();
  const event = {
    actionId,
    category: action.category,
    timestamp,
    durationMs: finiteNonNegative(input.durationMs),
    authorityDurationMs: finiteNonNegative(input.authorityDurationMs),
    visibleDurationMs: finiteNonNegative(input.visibleDurationMs),
    freshnessMs: finiteNonNegative(input.freshnessMs),
    success: nullableBoolean(input.success),
    error: nullableBoolean(input.error),
    reject: nullableBoolean(input.reject),
    timeout: nullableBoolean(input.timeout),
    stale: nullableBoolean(input.stale),
    deviceClass: DEVICE_CLASSES.has(input.deviceClass) ? input.deviceClass : "unknown",
    authoritySource: safeIdentifier(input.authoritySource) ?? "WEB_ONLY",
    deploymentId: metadata.deploymentId,
    provenanceType: metadata.provenanceType,
    provenanceValue: metadata.provenanceValue,
    anonymousKey: metadata.anonymousKey,
  };
  const result = validateTelemetryEvent(event, registry);
  if (!result.ok) return result;
  return {
    ok: true,
    event: {
      ...result.event,
      provenanceType: metadata.provenanceType,
      provenanceValue: metadata.provenanceValue,
      anonymousUserKey: metadata.anonymousKey,
    },
    errors: [],
  };
}

export function createProductionTelemetry({
  registry,
  enabled = false,
  canaryAccountIds = [],
  canaryCharacterIds = [],
  canaryUsernames = [],
  allowTestAccounts = true,
  percentage = 0,
  anonymousSalt = process.env.WEB_EXPERIENCE_ANON_SALT ?? randomBytes(32).toString("hex"),
  rollingFilePath = join(process.cwd(), ".local", "ro-stack", "dashboard", "web-experience-telemetry.ndjson"),
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxRotatedFiles = DEFAULT_MAX_ROTATED_FILES,
  hotWindowMs = DEFAULT_HOT_WINDOW_MS,
  flushIntervalMs = 1000,
  now = () => Date.now(),
  deployment = deploymentIdentity(),
} = {}) {
  if (!registry || !Array.isArray(registry.actions))
    throw new TypeError("registry.actions is required");
  const accountAllowlist = new Set([...canaryAccountIds].map(String));
  const characterAllowlist = new Set([...canaryCharacterIds].map(String));
  const usernameAllowlist = new Set([...canaryUsernames].map(String));
  const canaryPercentage = Math.max(0, Math.min(100, Math.floor(Number(percentage) || 0)));
  const sampler = createTelemetrySampler(registry, {
    highFreqWindowMs: 1000,
    normalWindowMs: 1000,
    sampleLimit: 32,
    maxPendingBuckets: 10_000,
  });
  const aggregator = createTelemetryAggregator(registry, {
    sampleLimit: 256,
    oneDayMs: hotWindowMs,
  });
  const counters = {
    received: 0,
    accepted: 0,
    rejected: 0,
    dropped: 0,
    sinkErrors: 0,
    bytesWritten: 0,
    batchesFlushed: 0,
    telemetryDropped: 0,
  };
  const startedAtMs = now();
  const overheadSamples = [];
  let writeQueue = Promise.resolve();
  let closed = false;

  function observeOverhead(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    overheadSamples.push(durationMs);
    if (overheadSamples.length > 256) overheadSamples.splice(0, overheadSamples.length - 256);
  }

  function overheadSummary() {
    return {
      sampleCount: overheadSamples.length,
      p50: percentile(overheadSamples, 0.5),
      p95: percentile(overheadSamples, 0.95),
      p99: percentile(overheadSamples, 0.99),
    };
  }

  function storageBytesPerHour() {
    const elapsedMs = now() - startedAtMs;
    return elapsedMs > 0 ? (counters.bytesWritten * 3_600_000) / elapsedMs : null;
  }

  function markDropped(count = 1) {
    counters.dropped += count;
    counters.telemetryDropped += count;
  }

  function isEligible(identity = {}) {
    if (!enabled) return false;
    const accountId = String(identity.accountId ?? "");
    const characterId = String(identity.characterId ?? "");
    const username = String(identity.username ?? "");
    if (accountAllowlist.has(accountId) || characterAllowlist.has(characterId)) return true;
    if (usernameAllowlist.has(username)) return true;
    if (allowTestAccounts && TEST_ACCOUNT_PATTERN.test(username)) return true;
    return canaryPercentage > 0 && numericHash(accountId || username) < canaryPercentage;
  }

  function anonymousKey(identity = {}) {
    const stable = String(identity.accountId ?? identity.username ?? "unknown");
    return `anon_${createHmac("sha256", anonymousSalt).update(stable).digest("hex").slice(0, 32)}`;
  }

  function enqueue(lines) {
    if (!lines.length || closed) return;
    writeQueue = writeQueue
      .then(async () => {
        try {
          const result = await appendRollingLines({
            rollingFilePath,
            lines,
            maxFileBytes,
            maxRotatedFiles,
            hotWindowMs,
            now: now(),
          });
          counters.bytesWritten += result.bytes;
        } catch {
          markDropped(lines.length);
          counters.sinkErrors += 1;
        }
      })
      .catch(() => {
        markDropped(lines.length);
        counters.sinkErrors += 1;
      });
  }

  function ingestEmitted(events) {
    if (!events.length) return;
    const lines = [];
    for (const event of events) {
      const result = aggregator.ingest(event);
      if (!result.accepted) {
        markDropped();
        continue;
      }
      lines.push(event);
    }
    counters.batchesFlushed += events.length ? 1 : 0;
    enqueue(lines);
  }

  function flush(force = false) {
    const result = sampler.flush(now(), force);
    ingestEmitted(result.events);
    return result;
  }

  const timer = setInterval(() => flush(false), Math.max(100, Number(flushIntervalMs) || 1000));
  timer.unref?.();

  return Object.freeze({
    enabled: () => enabled,
    actions: CANARY_ACTIONS,
    isEligible,
    publicConfig(identity = {}) {
      return {
        enabled,
        eligible: isEligible(identity),
        actions: CANARY_ACTIONS,
        deploymentId: deployment.deploymentId,
        provenanceType: deployment.provenanceType,
        provenanceValue: deployment.provenanceValue,
      };
    },
    record(input, identity = {}) {
      const startedAt = performance.now();
      try {
        counters.received += 1;
        if (!isEligible(identity))
          return { accepted: false, dropped: false, reason: enabled ? "CANARY_NOT_ELIGIBLE" : "CANARY_DISABLED" };
        const eventMetadata = {
          ...deployment,
          anonymousKey: anonymousKey(identity),
          nowMs: now(),
        };
        const normalized = normalizedClientEvent(input, eventMetadata, registry);
        if (!normalized.ok) {
          counters.rejected += 1;
          return { accepted: false, dropped: false, errors: normalized.errors };
        }
        const sampled = sampler.record(normalized.event);
        if (!sampled.accepted) {
          counters.rejected += 1;
          markDropped();
          return { accepted: false, dropped: true, errors: sampled.errors };
        }
        counters.accepted += 1;
        ingestEmitted(sampled.emitted);
        return {
          accepted: true,
          policy: sampled.policy,
          emitted: sampled.emitted.length,
          errors: [],
        };
      } finally {
        observeOverhead(performance.now() - startedAt);
      }
    },
    flush,
    async close() {
      if (closed) return;
      clearInterval(timer);
      flush(true);
      closed = true;
      await writeQueue;
    },
    async snapshot(options = {}) {
      flush(true);
      const summary = buildWebExperienceSummary(aggregator, options);
      const categories = summary.categories.map((category) => {
        const members = summary.actions.filter(
          (action) => action.category === category.category,
        );
        return {
          ...category,
          redCount: members.filter((action) => action.status === "RED").length,
          yellowCount: members.filter((action) => action.status === "YELLOW").length,
          greenCount: members.filter((action) => action.status === "GREEN").length,
          grayCount: members.filter((action) => action.status === "GRAY").length,
          highestPainAction:
            members
              .slice()
              .sort((left, right) => (right.painScore ?? -1) - (left.painScore ?? -1))[0]
              ?.actionId ?? null,
          highestPain: Math.max(...members.map((action) => action.painScore ?? 0)) || null,
        };
      });
      return {
        dataSource: "LIVE_CANARY",
        canaryActions: CANARY_ACTIONS,
        deployment: {
          deploymentId: deployment.deploymentId,
          provenanceType: deployment.provenanceType,
          provenanceValue: deployment.provenanceValue,
        },
        telemetry: {
          ...counters,
          pendingBuckets: sampler.pendingBuckets(),
          samplerForcedRejects: sampler.forcedRejects(),
          overheadMs: overheadSummary(),
          storageBytesPerHour: storageBytesPerHour(),
          aggregator: aggregator.stats(),
        },
        ...summary,
        categories,
      };
    },
    async actionDetail(actionId, options = {}) {
      flush(true);
      const detail = buildWebExperienceActionDetail(aggregator, actionId, options);
      return {
        dataSource: "LIVE_CANARY",
        deployment: {
          deploymentId: deployment.deploymentId,
          provenanceType: deployment.provenanceType,
          provenanceValue: deployment.provenanceValue,
        },
        telemetry: {
          ...counters,
          pendingBuckets: sampler.pendingBuckets(),
          overheadMs: overheadSummary(),
          storageBytesPerHour: storageBytesPerHour(),
        },
        ...detail,
      };
    },
    status() {
      return {
        dataSource: "LIVE_CANARY",
        enabled,
        canaryActions: CANARY_ACTIONS,
        deployment,
        ...counters,
        pendingBuckets: sampler.pendingBuckets(),
        overheadMs: overheadSummary(),
        storageBytesPerHour: storageBytesPerHour(),
        rollingFilePath,
      };
    },
  });
}

export async function readTelemetryRollingFile(path, { maxBytes = 2 * 1024 * 1024 } = {}) {
  try {
    const content = await readFile(path, "utf8");
    return content.length > maxBytes ? content.slice(-maxBytes) : content;
  } catch {
    return "";
  }
}
