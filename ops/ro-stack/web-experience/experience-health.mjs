// WEB_REAL_USER_EXPERIENCE_V1 · rolling real-user latency read model.
//
// This module EXTENDS the existing web-experience telemetry framework. It does
// NOT introduce a second telemetry transport or framework:
//   - events arrive through the existing `/api/web-experience/telemetry` ingest
//   - canary eligibility is owned by `production-telemetry.mjs`
//   - private-field policy mirrors `telemetry-aggregator.mjs`
//   - percentile / budget conventions mirror the observatory aggregator
//
// It adds the V1 capability the observatory did not have: per-action rolling
// 1m / 5m / 15m windows, a configurable HEALTHY/DEGRADED/SLOW/BAD health model
// and a layered diagnostic breakdown (browser->API RTT, server, state
// convergence, render, total perceived).

import thresholdsConfig from "./health-thresholds.json" with { type: "json" };
import { actionLabel, actionTrafficClass } from "./action-labels.mjs";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const TRACE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/;
const DEVICE_CLASSES = new Set(["desktop", "mobile", "tablet", "other", "unknown"]);

// Mirrors telemetry-aggregator.mjs FORBIDDEN_FIELDS. Kept as an explicit reject
// list so a banned key can never be persisted even if a caller sends it.
const FORBIDDEN_FIELDS = Object.freeze([
  "password",
  "sessionToken",
  "chatText",
  "npcDialog",
  "inputText",
  "inventoryItemDetail",
  "characterPrivateContent",
]);

export const EXPERIENCE_ACTIONS = Object.freeze(
  Array.isArray(thresholdsConfig.actions) ? [...thresholdsConfig.actions] : [],
);

export const EXPERIENCE_WINDOWS = Object.freeze({
  ...(thresholdsConfig.windows ?? { "1m": 60000, "5m": 300000, "15m": 900000 }),
});

export const DEFAULT_EXPERIENCE_WINDOW =
  EXPERIENCE_ACTIONS.length && thresholdsConfig.defaultWindow in EXPERIENCE_WINDOWS
    ? thresholdsConfig.defaultWindow
    : "5m";

// Diagnostic layers, ordered browser -> render.
export const DIAGNOSTIC_LAYERS = Object.freeze([
  "requestRttMs",
  "serverMs",
  "stateConvergenceMs",
  "renderMs",
  "playerPerceivedMs",
]);
export const EXPERIENCE_COMPONENTS = Object.freeze([
  "serverMs",
  "networkBrowserWaitMs",
  "frontendApplyMs",
]);

// Health ordering for "worst first" sorting. Lower is worse.
export const HEALTH_RANK = Object.freeze({
  BAD: 1,
  SLOW: 2,
  DEGRADED: 3,
  HEALTHY: 4,
  NO_DATA: 5,
});

const ACTION_SET = new Set(EXPERIENCE_ACTIONS);

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value) {
  const number = finite(value);
  return number !== null && number >= 0 ? number : null;
}

function clampNonNegative(value) {
  const number = nonNegative(value);
  return number === null ? null : Math.max(0, number);
}

function safeIdentifier(value, pattern = IDENTIFIER_PATTERN) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return pattern.test(candidate) ? candidate : null;
}

export function percentile(values, percentileRank) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(percentileRank * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1];
}

function average(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

// Normalizes the configurable thresholds so callers can pass a partial override
// (tests, future admin tuning) without mutating the canonical JSON.
export function normalizeThresholds(config = thresholdsConfig) {
  const profiles = {};
  for (const [name, profile] of Object.entries(config.profiles ?? {})) {
    const healthyMs = nonNegative(profile?.healthyMs);
    const degradedMs = nonNegative(profile?.degradedMs);
    const slowMs = nonNegative(profile?.slowMs);
    if (healthyMs === null || degradedMs === null || slowMs === null) continue;
    profiles[name] = Object.freeze({ healthyMs, degradedMs, slowMs });
  }
  if (!profiles.default)
    profiles.default = Object.freeze({ healthyMs: 500, degradedMs: 1000, slowMs: 2000 });
  return {
    windows: { ...EXPERIENCE_WINDOWS, ...(config.windows ?? {}) },
    defaultWindow:
      config.defaultWindow && config.defaultWindow in (config.windows ?? EXPERIENCE_WINDOWS)
        ? config.defaultWindow
        : DEFAULT_EXPERIENCE_WINDOW,
    profiles: Object.freeze(profiles),
    profileByAction: Object.freeze({ ...(config.profileByAction ?? {}) }),
  };
}

export function profileForAction(actionId, thresholds) {
  const name = thresholds.profileByAction[actionId] ?? "default";
  return thresholds.profiles[name] ?? thresholds.profiles.default;
}

// HEALTHY < healthyMs, DEGRADED < degradedMs, SLOW < slowMs, else BAD.
export function classifyHealth(valueMs, profile) {
  const value = nonNegative(valueMs);
  if (value === null) return "NO_DATA";
  const budget = profile ?? { healthyMs: 500, degradedMs: 1000, slowMs: 2000 };
  if (value < budget.healthyMs) return "HEALTHY";
  if (value < budget.degradedMs) return "DEGRADED";
  if (value < budget.slowMs) return "SLOW";
  return "BAD";
}

// Pure trace-metric derivation. Input times are milliseconds relative to the
// interaction start (startedAt = 0). Every field is optional; unavailable
// layers stay null so the read model never invents a number.
export function computeExperienceMetrics(input = {}) {
  const requestStartedAt = clampNonNegative(input.requestStartedAt);
  const responseAt = clampNonNegative(input.responseAt);
  const authoritativeStateAt = clampNonNegative(input.authoritativeStateAt);
  const visibleAt = clampNonNegative(input.visibleAt);
  const serverMs = clampNonNegative(input.serverMs);

  const requestRttMs =
    requestStartedAt !== null && responseAt !== null && responseAt >= requestStartedAt
      ? responseAt - requestStartedAt
      : null;
  const stateConvergenceMs =
    responseAt !== null && authoritativeStateAt !== null && authoritativeStateAt >= responseAt
      ? authoritativeStateAt - responseAt
      : null;
  const renderMs =
    authoritativeStateAt !== null && visibleAt !== null && visibleAt >= authoritativeStateAt
      ? visibleAt - authoritativeStateAt
      : null;
  const explicitPerceived = clampNonNegative(input.playerPerceivedMs);
  const playerPerceivedMs =
    explicitPerceived !== null
      ? explicitPerceived
      : visibleAt !== null
        ? visibleAt
        : clampNonNegative(input.durationMs);
  const freshnessMs = clampNonNegative(input.freshnessMs);
  const networkBrowserWaitMs =
    requestRttMs !== null && serverMs !== null
      ? Math.max(0, requestRttMs - serverMs)
      : null;
  const frontendApplyMs =
    responseAt !== null && visibleAt !== null && visibleAt >= responseAt
      ? visibleAt - responseAt
      : null;
  return {
    requestRttMs,
    fetchTotalMs: requestRttMs,
    serverMs,
    networkBrowserWaitMs,
    stateConvergenceMs,
    renderMs,
    frontendApplyMs,
    playerPerceivedMs,
    clientTotalMs: playerPerceivedMs,
    freshnessMs,
  };
}

function normalizedEvent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, errors: ["EVENT_OBJECT_REQUIRED"] };
  const forbidden = FORBIDDEN_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(raw, field),
  );
  if (forbidden.length)
    return { ok: false, errors: ["FORBIDDEN_PRIVATE_FIELD"] };
  const actionId = safeIdentifier(raw.actionId ?? raw.action);
  if (!actionId || !ACTION_SET.has(actionId))
    return { ok: false, errors: ["UNKNOWN_ACTION"] };
  const metrics = computeExperienceMetrics(raw);
  const success =
    raw.success === true ? true : raw.success === false ? false : null;
  const error = raw.error === true || success === false;
  const errorCode = safeIdentifier(raw.errorCode, ERROR_CODE_PATTERN);
  const traceId = safeIdentifier(raw.traceId, TRACE_ID_PATTERN);
  const deviceClass = DEVICE_CLASSES.has(raw.deviceClass) ? raw.deviceClass : "unknown";
  const at = nonNegative(raw.at) ?? nonNegative(raw.clientAt) ?? null;
  return {
    ok: true,
    errors: [],
    event: {
      actionId,
      at,
      traceId,
      deviceClass,
      success,
      error,
      errorCode: errorCode ?? (error ? "UNSPECIFIED" : null),
      stale: raw.stale === true,
      ...metrics,
    },
  };
}

function percentileBlock(values) {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    avg: average(values),
  };
}

function primaryBottleneck(samples) {
  if (samples.length < 3) return "SAMPLE_INSUFFICIENT";
  const values = Object.fromEntries(
    EXPERIENCE_COMPONENTS.map((component) => [
      component,
      percentileBlock(layerValues(samples, component)).p95,
    ]),
  );
  const candidates = Object.entries(values).filter(([, value]) => Number.isFinite(value));
  if (!candidates.length) return "SAMPLE_INSUFFICIENT";
  const [winner, value] = candidates.sort((left, right) => right[1] - left[1])[0];
  if (!(value > 0)) return "SAMPLE_INSUFFICIENT";
  return winner === "serverMs"
    ? "SERVER"
    : winner === "networkBrowserWaitMs"
      ? "NETWORK_BROWSER_WAIT"
      : "FRONTEND_APPLY";
}

function layerValues(samples, layer) {
  return samples
    .map((sample) => sample[layer])
    .filter((value) => Number.isFinite(value));
}

function dominantLayer(breakdown) {
  // The layer with the largest p95 owns the diagnosis. Null layers are ignored.
  const candidates = ["requestRttMs", "serverMs", "stateConvergenceMs", "renderMs"]
    .map((layer) => [layer, breakdown[layer]?.p95])
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return null;
  return candidates.sort((left, right) => right[1] - left[1])[0][0];
}

export function createExperienceHealth(options = {}) {
  const thresholds = normalizeThresholds(options.thresholds ?? thresholdsConfig);
  const now = options.now ?? (() => Date.now());
  const sampleLimit = Math.max(1, Math.floor(options.sampleLimit ?? 2000));
  const maxAgeMs =
    nonNegative(options.maxAgeMs) ??
    Math.max(...Object.values(thresholds.windows), 900000);
  const buckets = new Map();
  const counters = { received: 0, accepted: 0, rejected: 0, dropped: 0, pruned: 0 };

  function bucketFor(actionId) {
    let bucket = buckets.get(actionId);
    if (!bucket) {
      bucket = { samples: [], errorCount: 0, successCount: 0, staleCount: 0, lastSeenAt: null };
      buckets.set(actionId, bucket);
    }
    return bucket;
  }

  function prune(atMs) {
    const cutoff = atMs - maxAgeMs;
    for (const [actionId, bucket] of buckets) {
      const kept = bucket.samples.filter((sample) => sample.at >= cutoff);
      counters.pruned += bucket.samples.length - kept.length;
      bucket.samples = kept;
      if (!kept.length && bucket.lastSeenAt !== null && bucket.lastSeenAt < cutoff)
        buckets.delete(actionId);
    }
  }

  function ingest(raw) {
    try {
      counters.received += 1;
      const normalized = normalizedEvent(raw);
      if (!normalized.ok) {
        counters.rejected += 1;
        return { accepted: false, errors: normalized.errors };
      }
      const event = normalized.event;
      const at = event.at ?? now();
      const bucket = bucketFor(event.actionId);
      const sample = { ...event, at };
      bucket.samples.push(sample);
      if (bucket.samples.length > sampleLimit) {
        const overflow = bucket.samples.length - sampleLimit;
        bucket.samples.splice(0, overflow);
        counters.dropped += overflow;
      }
      if (event.error) bucket.errorCount += 1;
      if (event.success === true) bucket.successCount += 1;
      if (event.stale) bucket.staleCount += 1;
      bucket.lastSeenAt = bucket.lastSeenAt === null ? at : Math.max(bucket.lastSeenAt, at);
      prune(Math.max(at, now()));
      counters.accepted += 1;
      return { accepted: true, errors: [] };
    } catch {
      counters.rejected += 1;
      return { accepted: false, errors: ["INGEST_FAILED"] };
    }
  }

  function windowMs(windowName) {
    return thresholds.windows[windowName] ?? thresholds.windows[thresholds.defaultWindow];
  }

  function projection(actionId, windowName, atMs) {
    const cutoff = atMs - windowMs(windowName);
    const bucket = buckets.get(actionId);
    const samples = (bucket?.samples ?? []).filter((sample) => sample.at >= cutoff);
    const profile = profileForAction(actionId, thresholds);
    if (!samples.length) {
      return {
        actionId,
        technicalKey: actionId,
        displayName: actionLabel(actionId),
        trafficClass: actionTrafficClass(actionId),
        profile: thresholdName(actionId),
        thresholds: profile,
        status: "NO_DATA",
        sampleCount: 0,
        errorCount: 0,
        successCount: 0,
        successRate: null,
        errorRate: null,
        currentMs: null,
        p50: null,
        p95: null,
        p99: null,
        lastSeenAt: null,
        ageMs: bucket?.lastSeenAt != null ? Math.max(0, atMs - bucket.lastSeenAt) : null,
        breakdown: Object.fromEntries(DIAGNOSTIC_LAYERS.map((layer) => [layer, percentileBlock([])])),
        components: Object.fromEntries(EXPERIENCE_COMPONENTS.map((layer) => [layer, percentileBlock([])])),
        dominantLayer: null,
        primaryBottleneck: "SAMPLE_INSUFFICIENT",
        dataAge: null,
      };
    }
    const perceived = layerValues(samples, "playerPerceivedMs");
    const sortedByTime = [...samples].sort((left, right) => left.at - right.at);
    const currentMs = sortedByTime.length
      ? sortedByTime[sortedByTime.length - 1].playerPerceivedMs
      : null;
    const errorCount = samples.filter((sample) => sample.error).length;
    const successCount = samples.filter((sample) => sample.success === true).length;
    const lastSeenAt = bucket?.lastSeenAt ?? null;
    const breakdown = Object.fromEntries(
      DIAGNOSTIC_LAYERS.map((layer) => [layer, percentileBlock(layerValues(samples, layer))]),
    );
    const components = Object.fromEntries(
      EXPERIENCE_COMPONENTS.map((layer) => [layer, percentileBlock(layerValues(samples, layer))]),
    );
    const freshnessValues = samples
      .map((sample) => sample.freshnessMs)
      .filter((value) => Number.isFinite(value));
    return {
      actionId,
      technicalKey: actionId,
      displayName: actionLabel(actionId),
      trafficClass: actionTrafficClass(actionId),
      profile: thresholdName(actionId),
      thresholds: profile,
      status: classifyHealth(Number.isFinite(currentMs) ? currentMs : percentile(perceived, 0.95), profile),
      sampleCount: samples.length,
      errorCount,
      successCount,
      successRate:
        samples.length && successCount > 0
          ? successCount / samples.length
          : null,
      errorRate: samples.length ? errorCount / samples.length : null,
      currentMs: Number.isFinite(currentMs) ? currentMs : null,
      p50: percentile(perceived, 0.5),
      p95: percentile(perceived, 0.95),
      p99: percentile(perceived, 0.99),
      lastSeenAt: lastSeenAt === null ? null : new Date(lastSeenAt).toISOString(),
      ageMs: lastSeenAt === null ? null : Math.max(0, atMs - lastSeenAt),
      breakdown,
      components,
      dominantLayer: dominantLayer(breakdown),
      primaryBottleneck: primaryBottleneck(samples),
      dataAge: freshnessValues.length
        ? {
            p50: percentile(freshnessValues, 0.5),
            p95: percentile(freshnessValues, 0.95),
            max: Math.max(...freshnessValues),
          }
        : null,
    };
  }

  function thresholdName(actionId) {
    return thresholds.profileByAction[actionId] ?? "default";
  }

  function actionsFor(atMs, windowName) {
    return EXPERIENCE_ACTIONS.map((actionId) => projection(actionId, windowName, atMs)).sort(
      (left, right) => {
        const rank = (HEALTH_RANK[left.status] ?? HEALTH_RANK.NO_DATA) - (HEALTH_RANK[right.status] ?? HEALTH_RANK.NO_DATA);
        if (rank) return rank;
        return (right.p95 ?? -1) - (left.p95 ?? -1);
      },
    );
  }

  function snapshot(options = {}) {
    const windowName = options.window in thresholds.windows ? options.window : thresholds.defaultWindow;
    const atMs = nonNegative(options.nowMs) ?? now();
    const actions = actionsFor(atMs, windowName);
    const overall = actions.reduce(
      (worst, action) =>
        (HEALTH_RANK[action.status] ?? HEALTH_RANK.NO_DATA) < (HEALTH_RANK[worst] ?? HEALTH_RANK.NO_DATA)
          ? action.status
          : worst,
      "NO_DATA",
    );
    const observed = actions.filter((action) => action.sampleCount > 0);
    return {
      schemaVersion: "1.0.0",
      window: windowName,
      windowMs: windowMs(windowName),
      generatedAt: new Date(atMs).toISOString(),
      overallStatus: observed.length ? overall : "NO_DATA",
      actions,
      totals: {
        actionCount: actions.length,
        observedCount: observed.length,
        sampleCount: observed.reduce((total, action) => total + action.sampleCount, 0),
        errorCount: observed.reduce((total, action) => total + action.errorCount, 0),
      },
      thresholds: {
        profiles: thresholds.profiles,
        profileByAction: thresholds.profileByAction,
      },
      traffic: {
        foreground: observed.filter((action) => action.trafficClass === "FOREGROUND").reduce((total, action) => total + action.sampleCount, 0),
        background: observed.filter((action) => action.trafficClass === "BACKGROUND").reduce((total, action) => total + action.sampleCount, 0),
      },
    };
  }

  function actionDetail(actionId, options = {}) {
    if (!ACTION_SET.has(actionId)) throw new Error("UNKNOWN_ACTION");
    const windowName = options.window in thresholds.windows ? options.window : thresholds.defaultWindow;
    const atMs = nonNegative(options.nowMs) ?? now();
    const projection_ = projection(actionId, windowName, atMs);
    return {
      schemaVersion: "1.0.0",
      actionId,
      window: windowName,
      windowMs: windowMs(windowName),
      generatedAt: new Date(atMs).toISOString(),
      current: projection_,
      thresholds: projection_.thresholds,
      diagnostic: {
        layers: DIAGNOSTIC_LAYERS.map((layer) => ({
          layer,
          ...projection_.breakdown[layer],
        })),
        dominantLayer: projection_.dominantLayer,
      },
      dataAge: projection_.dataAge,
    };
  }

  return Object.freeze({
    actions: EXPERIENCE_ACTIONS,
    windows: thresholds.windows,
    thresholds,
    ingest,
    snapshot,
    actionDetail,
    prune,
    status() {
      const sampleCount = [...buckets.values()].reduce(
        (total, bucket) => total + bucket.samples.length,
        0,
      );
      return {
        dataSource: "LIVE_RUM",
        actionCount: EXPERIENCE_ACTIONS.length,
        observedActions: buckets.size,
        sampleCount,
        ...counters,
      };
    },
  });
}

export const experienceHealthInternals = Object.freeze({
  identifierPattern: IDENTIFIER_PATTERN.source,
  traceIdPattern: TRACE_ID_PATTERN.source,
  forbiddenFields: FORBIDDEN_FIELDS,
  deviceClasses: [...DEVICE_CLASSES],
});
