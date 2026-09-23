const DEFAULT_BUDGETS = Object.freeze({
  IMMEDIATE: Object.freeze({ green: 200, yellow: 300, red: 300 }),
  INTERACTIVE: Object.freeze({ green: 500, yellow: 1000, red: 1000 }),
  NAVIGATION: Object.freeze({ green: 800, yellow: 1500, red: 1500 }),
  BACKGROUND: Object.freeze({ green: 2000, yellow: 5000, red: 5000 }),
});

const STATUS_RANK = Object.freeze({ RED: 1, YELLOW: 2, GREEN: 3, GRAY: 4 });
const IMMEDIACY_FACTOR = Object.freeze({
  IMMEDIATE: 1,
  INTERACTIVE: 0.75,
  NAVIGATION: 0.5,
  BACKGROUND: 0.25,
});
const DEVICE_CLASSES = new Set(["desktop", "mobile", "tablet", "other", "unknown"]);
const PROVENANCE_TYPES = new Set(["GIT_SHA", "FILE_HASH_BASED", "UNKNOWN"]);
const SOURCE_PATTERN = /^[A-Z0-9_:-]{1,64}$/;
const ANONYMOUS_KEY_PATTERN = /^(?:anon|session)_[A-Za-z0-9._:-]{1,95}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const FORBIDDEN_FIELDS = Object.freeze([
  "password",
  "sessionToken",
  "chatText",
  "npcDialog",
  "inputText",
  "inventoryItemDetail",
  "characterPrivateContent",
]);
const ROOT_CAUSE_HINTS = Object.freeze([
  "POLLING_AMPLIFICATION",
  "FULL_STATE_REFRESH_FOR_SMALL_ACTION",
  "UNRELATED_DOMAIN_PROJECTION",
  "FIXED_DELAY_REFRESH",
  "OPENKORE_TRANSPORT_BOUND",
  "UI_FEEDBACK_MISSING",
  "STALE_OPTIMISTIC_STATE",
  "STALE_PROJECTION",
  "RENDER_THROTTLE",
]);

export const FRESHNESS_STATES = Object.freeze([
  "NO_DATA",
  "STALE",
  "HEALTHY",
  "WARNING",
  "ERROR",
]);

// Freshness domains are the registry's canonical state domains. Each action
// category maps to exactly one domain; SYSTEM entry actions are not a state
// domain and are intentionally left unmapped.
export const FRESHNESS_DOMAIN_BY_CATEGORY = Object.freeze({
  MAP: "minimap",
  AUTOMATION: "automation",
  COMBAT: "combat",
  QUEST: "quest",
  INVENTORY: "inventory",
  CHARACTER: "supply_recovery",
});

// Authoritative staleness budget for the freshness authority. A metric whose
// most recent observation is older than this is STALE and must never be GREEN.
export const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

export function evaluateFreshness(metrics, status, options = {}) {
  const minSamples = options.minSamples ?? 3;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const count = metrics?.count ?? 0;
  const ageMs = Number.isFinite(metrics?.ageMs) ? metrics.ageMs : null;
  if (ageMs === null)
    return { state: "NO_DATA", ageMs, reason: "NO_OBSERVATION" };
  if (ageMs > staleAfterMs)
    return { state: "STALE", ageMs, reason: "OBSERVATION_OLDER_THAN_STALE_BUDGET" };
  if (count < minSamples)
    return { state: "NO_DATA", ageMs, reason: "INSUFFICIENT_SAMPLE" };
  if (status === "RED") return { state: "ERROR", ageMs, reason: "FRESH_RED" };
  if (status === "YELLOW") return { state: "WARNING", ageMs, reason: "FRESH_YELLOW" };
  if (status === "GREEN") return { state: "HEALTHY", ageMs, reason: "FRESH_GREEN" };
  return { state: "NO_DATA", ageMs, reason: "NO_DECISION" };
}

function clamp(value, lower = 0, upper = 1) {
  return Math.min(upper, Math.max(lower, value));
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value) {
  const number = finite(value);
  return number !== null && number >= 0 ? number : null;
}

function integer(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function parseTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoTimestamp(value) {
  return new Date(value).toISOString();
}

function nullableBoolean(value) {
  return value === true || value === false ? value : null;
}

function safeIdentifier(value, pattern = IDENTIFIER_PATTERN) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return pattern.test(candidate) ? candidate : null;
}

function percentile(values, percentileRank) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(percentileRank * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1];
}

class BoundedReservoir {
  constructor(limit = 64) {
    this.limit = Math.max(1, Math.floor(limit));
    this.valuesBuffer = [];
    this.nextIndex = 0;
  }

  add(value) {
    const number = nonNegative(value);
    if (number === null) return;
    if (this.valuesBuffer.length < this.limit) {
      this.valuesBuffer.push(number);
      return;
    }
    this.valuesBuffer[this.nextIndex] = number;
    this.nextIndex = (this.nextIndex + 1) % this.limit;
  }

  addMany(values) {
    if (!Array.isArray(values)) return;
    for (const value of values) this.add(value);
  }

  values() {
    return this.valuesBuffer.slice();
  }

  get size() {
    return this.valuesBuffer.length;
  }
}

function createMetricBucket(sampleLimit, distinctUserLimit) {
  return {
    count: 0,
    affectedUserEstimate: 0,
    affectedUsers: new Set(),
    distinctUserLimit,
    errorCount: 0,
    rejectCount: 0,
    timeoutCount: 0,
    staleCount: 0,
    staleOver500: 0,
    staleOver1000: 0,
    staleOver2000: 0,
    samples: {
      durationMs: new BoundedReservoir(sampleLimit),
      authorityDurationMs: new BoundedReservoir(sampleLimit),
      visibleDurationMs: new BoundedReservoir(sampleLimit),
      freshnessMs: new BoundedReservoir(sampleLimit),
    },
  };
}

function addUser(bucket, anonymousKey) {
  if (!anonymousKey || bucket.affectedUsers.size >= bucket.distinctUserLimit) return;
  bucket.affectedUsers.add(anonymousKey);
}

function addCounts(bucket, aggregate, event) {
  const sampleCount = aggregate?.sampleCount ?? 1;
  bucket.count += sampleCount;
  bucket.errorCount += aggregate?.errorCount ?? (event.error === true ? 1 : 0);
  bucket.rejectCount += aggregate?.rejectCount ?? (event.reject === true ? 1 : 0);
  bucket.timeoutCount += aggregate?.timeoutCount ?? (event.timeout === true ? 1 : 0);
  bucket.staleCount += aggregate?.staleCount ?? (event.stale === true ? 1 : 0);
  bucket.staleOver500 += aggregate?.staleOver500 ?? 0;
  bucket.staleOver1000 += aggregate?.staleOver1000 ?? 0;
  bucket.staleOver2000 += aggregate?.staleOver2000 ?? 0;
  if (aggregate?.affectedUserCount !== undefined) {
    bucket.affectedUserEstimate = Math.max(
      bucket.affectedUserEstimate,
      aggregate.affectedUserCount,
    );
  } else {
    addUser(bucket, event.anonymousKey);
    bucket.affectedUserEstimate = Math.max(
      bucket.affectedUserEstimate,
      bucket.affectedUsers.size,
    );
  }
}

function addSamples(bucket, aggregate, event) {
  const sources = aggregate
    ? {
        durationMs: aggregate.durationSamples,
        authorityDurationMs: aggregate.authorityDurationSamples,
        visibleDurationMs: aggregate.visibleDurationSamples,
        freshnessMs: aggregate.freshnessSamples,
      }
    : {
        durationMs: [event.durationMs],
        authorityDurationMs: [event.authorityDurationMs],
        visibleDurationMs: [event.visibleDurationMs],
        freshnessMs: [event.freshnessMs],
      };
  for (const [name, values] of Object.entries(sources)) {
    bucket.samples[name].addMany(values);
  }
  if (!aggregate && event.freshnessMs !== null) {
    if (event.freshnessMs > 500) bucket.staleOver500 += 1;
    if (event.freshnessMs > 1000) bucket.staleOver1000 += 1;
    if (event.freshnessMs > 2000) bucket.staleOver2000 += 1;
  }
}

function addMetric(bucket, event, options = {}) {
  const aggregate = event.aggregate;
  addCounts(bucket, aggregate, event);
  addSamples(bucket, aggregate, event);
}

function mergeMetricBuckets(target, source) {
  target.count += source.count;
  target.affectedUserEstimate = Math.max(
    target.affectedUserEstimate,
    source.affectedUserEstimate,
  );
  for (const key of source.affectedUsers) addUser(target, key);
  target.errorCount += source.errorCount;
  target.rejectCount += source.rejectCount;
  target.timeoutCount += source.timeoutCount;
  target.staleCount += source.staleCount;
  target.staleOver500 += source.staleOver500;
  target.staleOver1000 += source.staleOver1000;
  target.staleOver2000 += source.staleOver2000;
  for (const [name, reservoir] of Object.entries(source.samples)) {
    target.samples[name].addMany(reservoir.values());
  }
}

function rate(count, total) {
  return total > 0 ? count / total : null;
}

function summarizeMetricBucket(bucket) {
  const durationValues = bucket.samples.durationMs.values();
  const authorityValues = bucket.samples.authorityDurationMs.values();
  const visibleValues = bucket.samples.visibleDurationMs.values();
  const freshnessValues = bucket.samples.freshnessMs.values();
  const durations = {
    p50: percentile(durationValues, 0.5),
    p95: percentile(durationValues, 0.95),
    p99: percentile(durationValues, 0.99),
  };
  return {
    count: bucket.count,
    affectedUsers: Math.max(bucket.affectedUsers.size, bucket.affectedUserEstimate),
    p50: durations.p50,
    p95: durations.p95,
    p99: durations.p99,
    durationMs: durations,
    authorityDurationMs: {
      p50: percentile(authorityValues, 0.5),
      p95: percentile(authorityValues, 0.95),
      p99: percentile(authorityValues, 0.99),
    },
    visibleDurationMs: {
      p50: percentile(visibleValues, 0.5),
      p95: percentile(visibleValues, 0.95),
      p99: percentile(visibleValues, 0.99),
    },
    freshness: {
      p50: percentile(freshnessValues, 0.5),
      p95: percentile(freshnessValues, 0.95),
      p99: percentile(freshnessValues, 0.99),
    },
    errorRate: rate(bucket.errorCount, bucket.count),
    rejectRate: rate(bucket.rejectCount, bucket.count),
    timeoutRate: rate(bucket.timeoutCount, bucket.count),
    staleRate: rate(bucket.staleCount, bucket.count),
    staleOver500: bucket.staleOver500,
    staleOver1000: bucket.staleOver1000,
    staleOver2000: bucket.staleOver2000,
    sampleCounts: {
      durationMs: durationValues.length,
      authorityDurationMs: authorityValues.length,
      visibleDurationMs: visibleValues.length,
      freshnessMs: freshnessValues.length,
    },
  };
}

function normalizedAggregate(raw) {
  if (raw === undefined || raw === null) return null;
  const sampleCount = integer(raw.sampleCount);
  if (!sampleCount || sampleCount > 1000000) return null;
  const fields = [
    "affectedUserCount",
    "errorCount",
    "rejectCount",
    "timeoutCount",
    "staleCount",
    "staleOver500",
    "staleOver1000",
    "staleOver2000",
  ];
  const result = { sampleCount };
  for (const field of fields) {
    const value = integer(raw[field] ?? 0);
    if (value === null || value > sampleCount) return null;
    result[field] = value;
  }
  const sampleFields = [
    "durationSamples",
    "authorityDurationSamples",
    "visibleDurationSamples",
    "freshnessSamples",
  ];
  for (const field of sampleFields) {
    if (raw[field] === undefined) {
      result[field] = [];
      continue;
    }
    if (!Array.isArray(raw[field]) || raw[field].length > 64) return null;
    const values = raw[field].map(nonNegative);
    if (values.some((value) => value === null)) return null;
    result[field] = values;
  }
  return result;
}

function normalizeEvent(raw, actionIndex) {
  const timestampMs = parseTimestamp(raw.timestamp);
  const actionId = safeIdentifier(raw.actionId);
  const errors = [];
  if (!actionId || !actionIndex.has(actionId)) errors.push("UNKNOWN_ACTION");
  if (timestampMs === null) errors.push("INVALID_TIMESTAMP");
  const metadata = actionIndex.get(actionId);
  if (metadata && raw.category !== metadata.category) errors.push("CATEGORY_MISMATCH");
  const rawAnonymousKey =
    raw.anonymousKey === undefined ? raw.anonymousUserKey : raw.anonymousKey;
  const anonymousKey =
    rawAnonymousKey === null || rawAnonymousKey === undefined
      ? null
      : safeIdentifier(rawAnonymousKey, ANONYMOUS_KEY_PATTERN);
  if (rawAnonymousKey !== null && rawAnonymousKey !== undefined && !anonymousKey)
    errors.push("INVALID_ANONYMOUS_KEY");
  const deviceClass =
    raw.deviceClass === null || raw.deviceClass === undefined
      ? null
      : String(raw.deviceClass);
  if (deviceClass !== null && !DEVICE_CLASSES.has(deviceClass))
    errors.push("INVALID_DEVICE_CLASS");
  const deploymentId =
    raw.deploymentId === null || raw.deploymentId === undefined
      ? null
      : safeIdentifier(raw.deploymentId);
  if (raw.deploymentId !== null && raw.deploymentId !== undefined && !deploymentId)
    errors.push("INVALID_DEPLOYMENT_ID");
  const authoritySource =
    raw.authoritySource === null || raw.authoritySource === undefined
      ? null
      : safeIdentifier(String(raw.authoritySource), SOURCE_PATTERN);
  if (
    raw.authoritySource !== null &&
    raw.authoritySource !== undefined &&
    !authoritySource
  )
    errors.push("INVALID_AUTHORITY_SOURCE");
  if (
    raw.provenanceType !== null &&
    raw.provenanceType !== undefined &&
    !PROVENANCE_TYPES.has(String(raw.provenanceType))
  )
    errors.push("INVALID_PROVENANCE_TYPE");
  if (
    raw.provenanceValue !== null &&
    raw.provenanceValue !== undefined &&
    !safeIdentifier(raw.provenanceValue)
  )
    errors.push("INVALID_PROVENANCE_VALUE");
  for (const name of ["durationMs", "authorityDurationMs", "visibleDurationMs", "freshnessMs"]) {
    if (
      raw[name] !== null &&
      raw[name] !== undefined &&
      nonNegative(raw[name]) === null
    )
      errors.push("INVALID_" + name.toUpperCase());
  }
  for (const name of ["success", "error", "reject", "timeout", "stale"]) {
    if (
      raw[name] !== null &&
      raw[name] !== undefined &&
      nullableBoolean(raw[name]) === null
    )
      errors.push("INVALID_" + name.toUpperCase());
  }
  const aggregate = normalizedAggregate(raw.aggregate);
  if (raw.aggregate !== undefined && raw.aggregate !== null && !aggregate)
    errors.push("INVALID_AGGREGATE");
  if (errors.length) return { ok: false, errors, event: null };
  return {
    ok: true,
    errors: [],
    event: {
      actionId,
      category: metadata.category,
      timestamp: isoTimestamp(timestampMs),
      timestampMs,
      durationMs: nonNegative(raw.durationMs),
      authorityDurationMs: nonNegative(raw.authorityDurationMs),
      visibleDurationMs: nonNegative(raw.visibleDurationMs),
      freshnessMs: nonNegative(raw.freshnessMs),
      success: nullableBoolean(raw.success),
      error: nullableBoolean(raw.error),
      reject: nullableBoolean(raw.reject),
      timeout: nullableBoolean(raw.timeout),
      stale: nullableBoolean(raw.stale),
      anonymousKey,
      deviceClass,
      deploymentId,
      authoritySource,
      provenanceType:
        raw.provenanceType === null || raw.provenanceType === undefined
          ? null
          : PROVENANCE_TYPES.has(String(raw.provenanceType))
            ? String(raw.provenanceType)
            : null,
      provenanceValue:
        raw.provenanceValue === null || raw.provenanceValue === undefined
          ? null
          : safeIdentifier(raw.provenanceValue) ?? null,
      anonymousUserKey: anonymousKey,
      aggregate,
    },
  };
}

function createActionIndex(registry) {
  if (!registry || !Array.isArray(registry.actions)) {
    throw new TypeError("registry.actions is required");
  }
  const index = new Map();
  for (const action of registry.actions) {
    if (!action || typeof action.actionId !== "string")
      throw new TypeError("registry actionId is required");
    if (index.has(action.actionId)) throw new TypeError("duplicate actionId");
    index.set(action.actionId, Object.freeze({ ...action }));
  }
  return index;
}

export function validateTelemetryEvent(raw, registry) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, errors: ["EVENT_OBJECT_REQUIRED"], event: null };
  const forbidden = FORBIDDEN_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(raw, field),
  );
  if (forbidden.length)
    return { ok: false, errors: ["FORBIDDEN_PRIVATE_FIELD:" + forbidden.join(",")], event: null };
  return normalizeEvent(raw, createActionIndex(registry));
}

export function createTelemetrySampler(registry, options = {}) {
  const actionIndex = createActionIndex(registry);
  const highFreqWindowMs = options.highFreqWindowMs ?? 60000;
  const normalWindowMs = options.normalWindowMs ?? 5000;
  const maxPendingBuckets = options.maxPendingBuckets ?? 10000;
  const sampleLimit = options.sampleLimit ?? 32;
  const pending = new Map();
  let forcedRejects = 0;

  function policyFor(action) {
    const expected = String(action.expectedFrequency ?? "").toLowerCase();
    if (expected.includes("high") || expected.includes("delta cadence"))
      return "HIGH_FREQ";
    if (
      expected.includes("rare") ||
      expected.includes("session_start") ||
      expected.includes("critical")
    )
      return "CRITICAL";
    return "NORMAL";
  }

  function windowFor(policy) {
    return policy === "HIGH_FREQ" ? highFreqWindowMs : normalWindowMs;
  }

  function pendingKey(event, policy, bucketStart) {
    return [
      policy,
      event.actionId,
      event.anonymousKey ?? "UNKNOWN",
      event.deploymentId ?? "UNKNOWN",
      bucketStart,
    ].join("|");
  }

  function createPending(event, policy, bucketStart) {
    return {
      policy,
      actionId: event.actionId,
      category: event.category,
      bucketStart,
      firstEvent: event,
      count: 0,
      affectedUsers: new Set(),
      errorCount: 0,
      rejectCount: 0,
      timeoutCount: 0,
      staleCount: 0,
      staleOver500: 0,
      staleOver1000: 0,
      staleOver2000: 0,
      samples: {
        durationMs: new BoundedReservoir(sampleLimit),
        authorityDurationMs: new BoundedReservoir(sampleLimit),
        visibleDurationMs: new BoundedReservoir(sampleLimit),
        freshnessMs: new BoundedReservoir(sampleLimit),
      },
    };
  }

  function addPending(entry, event) {
    entry.count += 1;
    if (event.anonymousKey) entry.affectedUsers.add(event.anonymousKey);
    if (event.error === true) entry.errorCount += 1;
    if (event.reject === true) entry.rejectCount += 1;
    if (event.timeout === true) entry.timeoutCount += 1;
    if (event.stale === true) entry.staleCount += 1;
    if (event.freshnessMs !== null) {
      if (event.freshnessMs > 500) entry.staleOver500 += 1;
      if (event.freshnessMs > 1000) entry.staleOver1000 += 1;
      if (event.freshnessMs > 2000) entry.staleOver2000 += 1;
    }
    entry.samples.durationMs.add(event.durationMs);
    entry.samples.authorityDurationMs.add(event.authorityDurationMs);
    entry.samples.visibleDurationMs.add(event.visibleDurationMs);
    entry.samples.freshnessMs.add(event.freshnessMs);
  }

  function emitPending(entry) {
    const event = entry.firstEvent;
    return {
      actionId: entry.actionId,
      category: entry.category,
      timestamp: event.timestamp,
      durationMs: null,
      authorityDurationMs: null,
      visibleDurationMs: null,
      freshnessMs: null,
      success: null,
      error: null,
      reject: null,
      timeout: null,
      stale: null,
      anonymousKey: null,
      anonymousUserKey: null,
      deviceClass: event.deviceClass,
      deploymentId: event.deploymentId,
      provenanceType: event.provenanceType,
      provenanceValue: event.provenanceValue,
      authoritySource: event.authoritySource,
      aggregate: {
        sampleCount: entry.count,
        affectedUserCount: entry.affectedUsers.size,
        errorCount: entry.errorCount,
        rejectCount: entry.rejectCount,
        timeoutCount: entry.timeoutCount,
        staleCount: entry.staleCount,
        staleOver500: entry.staleOver500,
        staleOver1000: entry.staleOver1000,
        staleOver2000: entry.staleOver2000,
        durationSamples: entry.samples.durationMs.values(),
        authorityDurationSamples: entry.samples.authorityDurationMs.values(),
        visibleDurationSamples: entry.samples.visibleDurationMs.values(),
        freshnessSamples: entry.samples.freshnessMs.values(),
      },
    };
  }

  function flush(nowMs = Date.now(), force = false) {
    const emitted = [];
    const batchKeys = new Set();
    for (const [key, entry] of pending) {
      const windowMs = windowFor(entry.policy);
      if (!force && entry.bucketStart + windowMs > nowMs) continue;
      emitted.push(emitPending(entry));
      batchKeys.add(
        [entry.policy, entry.bucketStart, entry.firstEvent.anonymousKey ?? "UNKNOWN"].join("|"),
      );
      pending.delete(key);
    }
    return {
      events: emitted,
      batchesEmitted: batchKeys.size,
      pendingBuckets: pending.size,
      forcedRejects,
    };
  }

  return Object.freeze({
    record(raw) {
      const result = normalizeEvent(raw, actionIndex);
      if (!result.ok) return { accepted: false, emitted: [], errors: result.errors };
      const event = result.event;
      const policy = policyFor(actionIndex.get(event.actionId));
      if (policy === "CRITICAL") {
        return { accepted: true, policy, emitted: [event], errors: [] };
      }
      const windowMs = windowFor(policy);
      const bucketStart = Math.floor(event.timestampMs / windowMs) * windowMs;
      const key = pendingKey(event, policy, bucketStart);
      if (!pending.has(key) && pending.size >= maxPendingBuckets) {
        forcedRejects += 1;
        return { accepted: false, policy, emitted: [], errors: ["SAMPLER_CAP_REACHED"] };
      }
      const entry = pending.get(key) ?? createPending(event, policy, bucketStart);
      addPending(entry, event);
      pending.set(key, entry);
      return { accepted: true, policy, emitted: [], errors: [] };
    },
    flush,
    pendingBuckets() {
      return pending.size;
    },
    forcedRejects() {
      return forcedRejects;
    },
    policyFor(actionId) {
      const action = actionIndex.get(actionId);
      return action ? policyFor(action) : null;
    },
  });
}

export function createTelemetryAggregator(registry, options = {}) {
  const actionIndex = createActionIndex(registry);
  const bucketMs = options.bucketMs ?? 60000;
  const windows = Object.freeze({
    "1h": options.oneHourMs ?? 3600000,
    "24h": options.oneDayMs ?? 86400000,
  });
  const sampleLimit = options.sampleLimit ?? 256;
  const distinctUserLimit = options.distinctUserLimit ?? 10000;
  const maxDeploymentBuckets = options.maxDeploymentBuckets ?? 32;
  const bucketsByAction = new Map();
  const lastObservedByAction = new Map();
  let lastObservedAtMs = null;
  let accepted = 0;
  let rejected = 0;
  // Driven by ingested event time only. Seeding this from wall clock made
  // historical replay (and any past-dated fixture) get pruned on arrival.
  let lastNow = 0;

  function prune(nowMs) {
    const cutoff = nowMs - windows["24h"];
    for (const [actionId, buckets] of bucketsByAction) {
      for (const bucketStart of buckets.keys()) {
        if (bucketStart < cutoff) buckets.delete(bucketStart);
      }
      if (!buckets.size) bucketsByAction.delete(actionId);
    }
  }

  function ingest(raw) {
    const result = normalizeEvent(raw, actionIndex);
    if (!result.ok) {
      rejected += 1;
      return { accepted: false, errors: result.errors };
    }
    const event = result.event;
    lastNow = Math.max(lastNow, event.timestampMs);
    lastObservedAtMs =
      lastObservedAtMs === null
        ? event.timestampMs
        : Math.max(lastObservedAtMs, event.timestampMs);
    const previousObserved = lastObservedByAction.get(event.actionId) ?? null;
    if (previousObserved === null || event.timestampMs > previousObserved)
      lastObservedByAction.set(event.actionId, event.timestampMs);
    prune(lastNow);
    let buckets = bucketsByAction.get(event.actionId);
    if (!buckets) {
      buckets = new Map();
      bucketsByAction.set(event.actionId, buckets);
    }
    const bucketStart = Math.floor(event.timestampMs / bucketMs) * bucketMs;
    let bucket = buckets.get(bucketStart);
    if (!bucket) {
      bucket = {
        metric: createMetricBucket(sampleLimit, distinctUserLimit),
        deployments: new Map(),
      };
      buckets.set(bucketStart, bucket);
    }
    addMetric(bucket.metric, event);
    const deploymentId = event.deploymentId ?? "UNKNOWN";
    let deploymentMetric = bucket.deployments.get(deploymentId);
    if (!deploymentMetric) {
      if (bucket.deployments.size >= maxDeploymentBuckets) {
        deploymentMetric = bucket.deployments.get("OTHER");
        if (!deploymentMetric) {
          deploymentMetric = createMetricBucket(sampleLimit, distinctUserLimit);
          bucket.deployments.set("OTHER", deploymentMetric);
        }
      } else {
        deploymentMetric = createMetricBucket(sampleLimit, distinctUserLimit);
        bucket.deployments.set(deploymentId, deploymentMetric);
      }
    }
    addMetric(deploymentMetric, event);
    accepted += 1;
    return { accepted: true, event };
  }

  function ingestBatch(events) {
    const result = { accepted: 0, rejected: 0, errors: [] };
    for (const event of events) {
      const outcome = ingest(event);
      if (outcome.accepted) result.accepted += 1;
      else {
        result.rejected += 1;
        result.errors.push(...outcome.errors);
      }
    }
    return result;
  }

  function query(actionId, options = {}) {
    const action = actionIndex.get(actionId);
    if (!action) throw new Error("UNKNOWN_ACTION");
    const windowName = options.window ?? "1h";
    if (!(windowName in windows)) throw new Error("UNKNOWN_WINDOW");
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    prune(nowMs);
    const cutoff = nowMs - windows[windowName];
    const combined = createMetricBucket(sampleLimit, distinctUserLimit);
    const buckets = bucketsByAction.get(actionId) ?? new Map();
    for (const [bucketStart, bucket] of buckets) {
      if (bucketStart < cutoff || bucketStart > nowMs) continue;
      const metric = options.deploymentId
        ? bucket.deployments.get(options.deploymentId)
        : bucket.metric;
      if (metric) mergeMetricBuckets(combined, metric);
    }
    const summary = summarizeMetricBucket(combined);
    const observedAtMs = lastObservedByAction.get(actionId) ?? null;
    const ageNowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    summary.lastObservedAt =
      observedAtMs === null ? null : new Date(observedAtMs).toISOString();
    summary.ageMs =
      observedAtMs === null ? null : Math.max(0, ageNowMs - observedAtMs);
    return summary;
  }

  function listDeployments(actionId, options = {}) {
    const result = new Set();
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const cutoff = nowMs - (windows[options.window ?? "1h"] ?? windows["1h"]);
    const buckets = bucketsByAction.get(actionId) ?? new Map();
    for (const [bucketStart, bucket] of buckets) {
      if (bucketStart < cutoff || bucketStart > nowMs) continue;
      for (const deploymentId of bucket.deployments.keys()) result.add(deploymentId);
    }
    return [...result].sort();
  }

  return Object.freeze({
    ingest,
    ingestBatch,
    query,
    listDeployments,
    lastObservedAt() {
      return lastObservedAtMs === null
        ? null
        : new Date(lastObservedAtMs).toISOString();
    },
    lastObservedAtMs() {
      return lastObservedAtMs;
    },
    stateFreshnessDomains() {
      return Array.isArray(registry.stateFreshnessDomains)
        ? registry.stateFreshnessDomains.map((domain) => ({ ...domain }))
        : [];
    },
    stats() {
      return {
        accepted,
        rejected,
        actionCount: actionIndex.size,
        bucketCount: [...bucketsByAction.values()].reduce((total, buckets) => total + buckets.size, 0),
        lastObservedAt: lastObservedAtMs === null ? null : new Date(lastObservedAtMs).toISOString(),
      };
    },
    registry: actionIndex,
  });
}

function frequencyFactor(expectedFrequency) {
  const value = String(expectedFrequency ?? "").toLowerCase();
  if (value.includes("high")) return 1;
  if (value.includes("on_player_action")) return 0.75;
  if (value.includes("occasional")) return 0.5;
  if (value.includes("rare")) return 0.25;
  if (value.includes("background") || value.includes("low")) return 0.1;
  return 0.5;
}

export function computePainScore(metadata, metrics, options = {}) {
  if (!metrics || metrics.count < 1)
    return { score: null, dataStatus: "UNKNOWN", topContributors: [], components: {} };
  const budgets = options.budgets ?? DEFAULT_BUDGETS;
  const budget = budgets[metadata.immediacyClass] ?? DEFAULT_BUDGETS.INTERACTIVE;
  const p95 = metrics.durationMs?.p95 ?? metrics.p95;
  const budgetExceedRatio =
    p95 === null || p95 === undefined
      ? 0
      : clamp((p95 - budget.green) / Math.max(1, budget.green));
  const failureRate = Math.max(
    metrics.errorRate ?? 0,
    metrics.rejectRate ?? 0,
    metrics.timeoutRate ?? 0,
  );
  const staleRate = metrics.staleRate ?? 0;
  const activeUsers = options.activeUsers ?? metrics.affectedUsers;
  const affectedUserRate =
    activeUsers && activeUsers > 0 ? clamp(metrics.affectedUsers / activeUsers) : 0;
  const trend = options.trend ?? "UNKNOWN";
  const regressionFactor =
    trend === "REGRESSING" ? 1 : trend === "IMPROVING" ? 0 : 0.5;
  const components = {
    budgetExceedRatio,
    failureRate,
    staleRate,
    frequencyFactor: frequencyFactor(metadata.expectedFrequency),
    affectedUserRate,
    immediacyFactor: IMMEDIACY_FACTOR[metadata.immediacyClass] ?? 0.5,
    blockingSeverity: metadata.isPlayerBlocking ? 1 : 0,
    regressionFactor,
  };
  const points = {
    budgetExceedRatio: 25 * components.budgetExceedRatio,
    failureRate: 15 * components.failureRate,
    staleRate: 15 * components.staleRate,
    frequencyFactor: 10 * components.frequencyFactor,
    affectedUserRate: 10 * components.affectedUserRate,
    immediacyFactor: 10 * components.immediacyFactor,
    blockingSeverity: 5 * components.blockingSeverity,
    regressionFactor: 10 * components.regressionFactor,
  };
  const score = Math.round(
    clamp(Object.values(points).reduce((total, value) => total + value, 0), 0, 100),
  );
  const topContributors = Object.entries(points)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([key, value]) => ({ key, points: Number(value.toFixed(2)) }));
  return {
    score,
    dataStatus: p95 === null || p95 === undefined ? "PARTIAL" : "MEASURED",
    topContributors,
    components,
    points,
  };
}

export function evaluateTrafficLight(metadata, metrics, options = {}) {
  const minSamples = options.minSamples ?? 3;
  if (!metrics || metrics.count < minSamples)
    return { status: "GRAY", reason: "INSUFFICIENT_SAMPLE", calibration: "CALIBRATION_REQUIRED" };
  const p95 = metrics.durationMs?.p95 ?? metrics.p95;
  if (p95 === null || p95 === undefined)
    return { status: "GRAY", reason: "MISSING_DURATION", calibration: "CALIBRATION_REQUIRED" };
  const budget = (options.budgets ?? DEFAULT_BUDGETS)[metadata.immediacyClass] ?? DEFAULT_BUDGETS.INTERACTIVE;
  const failureRate = Math.max(metrics.errorRate ?? 0, metrics.rejectRate ?? 0, metrics.timeoutRate ?? 0);
  if (p95 > budget.red || failureRate > 0.01)
    return { status: "RED", reason: p95 > budget.red ? "P95_OVER_RED_BUDGET" : "FAILURE_RATE_CRITICAL", calibration: "CALIBRATION_REQUIRED" };
  if (p95 > budget.green || failureRate > 0.005)
    return { status: "YELLOW", reason: p95 > budget.green ? "P95_OVER_GREEN_BUDGET" : "FAILURE_RATE_WARNING", calibration: "CALIBRATION_REQUIRED" };
  return { status: "GREEN", reason: "WITHIN_DRAFT_BUDGET", calibration: "CALIBRATION_REQUIRED" };
}

export function compareTrend(current, previous, options = {}) {
  const currentP95 = current?.durationMs?.p95 ?? current?.p95;
  const previousP95 = previous?.durationMs?.p95 ?? previous?.p95;
  if (
    currentP95 === null ||
    currentP95 === undefined ||
    previousP95 === null ||
    previousP95 === undefined ||
    previousP95 === 0
  )
    return { trend: "UNKNOWN", deltaPercent: null };
  const deltaPercent = ((currentP95 - previousP95) / previousP95) * 100;
  const stableBand = options.stableBandPercent ?? 5;
  return {
    trend:
      Math.abs(deltaPercent) <= stableBand
        ? "STABLE"
        : deltaPercent < 0
          ? "IMPROVING"
          : "REGRESSING",
    deltaPercent: Number(deltaPercent.toFixed(2)),
  };
}

export function evaluateRootCauseHints(evidence = {}) {
  const hints = [];
  const add = (hint, whyTriggered) => hints.push({ hint, whyTriggered });
  if (Number(evidence.pollingCount) > Number(evidence.expectedPolls ?? 0))
    add("POLLING_AMPLIFICATION", "observed polling count exceeded the expected poll count");
  if (Number(evidence.fullStateRefreshCount) > 0)
    add("FULL_STATE_REFRESH_FOR_SMALL_ACTION", "a small action recorded one or more full-state refreshes");
  if (evidence.unrelatedDomainWork === true)
    add("UNRELATED_DOMAIN_PROJECTION", "projection work included a domain outside the action interest set");
  if (Number(evidence.fixedDelayMs) > 0)
    add("FIXED_DELAY_REFRESH", "a fixed refresh delay was recorded before the visible result");
  if (Number(evidence.openKoreTransportMs) > 0)
    add("OPENKORE_TRANSPORT_BOUND", "OpenKore transport duration was present in the measured chain");
  if (evidence.missingImmediateFeedback === true)
    add("UI_FEEDBACK_MISSING", "no immediate browser feedback mark was recorded");
  if (Number(evidence.optimisticStaleCount) > 0)
    add("STALE_OPTIMISTIC_STATE", "optimistic state was observed after the authoritative revision");
  if (Number(evidence.projectionStaleCount) > 0)
    add("STALE_PROJECTION", "projection freshness evidence exceeded the supplied threshold");
  if (Number(evidence.renderThrottleMs) > 0)
    add("RENDER_THROTTLE", "render throttle duration was recorded in the browser chain");
  return hints.filter((entry) => ROOT_CAUSE_HINTS.includes(entry.hint));
}

function decisionClass(metadata, status) {
  if (metadata.openKoreDependent === true || metadata.openKoreDependent === "mixed")
    return "DEFER_AFTER_OPENKORE_EXIT";
  if (status === "RED") return "NOW_FIXABLE";
  if (status === "YELLOW") return "LATER";
  if (status === "GREEN") return "NO_OPTIMIZATION_NEEDED";
  return "LATER";
}

function makeActionProjection(aggregator, metadata, options) {
  const metrics = aggregator.query(metadata.actionId, options);
  const trend = compareTrend(metrics, options.previousMetrics?.[metadata.actionId]);
  const pain = computePainScore(metadata, metrics, {
    ...options,
    trend: trend.trend,
  });
  const light = evaluateTrafficLight(metadata, metrics, options);
  const freshness = evaluateFreshness(metrics, light.status, options);
  // A metric with no observations, or only stale observations, must never be
  // reported as a healthy signal.
  const status =
    freshness.state === "NO_DATA" || freshness.state === "STALE"
      ? "GRAY"
      : light.status;
  const statusReason =
    status === light.status
      ? light.reason
      : freshness.state === "STALE"
        ? "STALE_DATA"
        : "NO_OBSERVATION";
  const hints = evaluateRootCauseHints(options.evidence?.[metadata.actionId] ?? {});
  return {
    actionId: metadata.actionId,
    category: metadata.category,
    displayName: metadata.displayName,
    status,
    statusReason,
    calibration: light.calibration,
    freshnessState: freshness.state,
    freshnessReason: freshness.reason,
    lastObservedAt: metrics.lastObservedAt ?? null,
    ageMs: metrics.ageMs ?? null,
    painScore: pain.score,
    topContributors: pain.topContributors,
    metrics,
    trend,
    rootCauseHints: hints,
    openKoreDependent: metadata.openKoreDependent,
    decisionClass: decisionClass(metadata, status),
  };
}

const FRESHNESS_RANK = Object.freeze({
  ERROR: 1,
  WARNING: 2,
  STALE: 3,
  NO_DATA: 4,
  HEALTHY: 5,
});

function worstFreshnessState(states) {
  return states.reduce(
    (current, state) =>
      (FRESHNESS_RANK[state] ?? FRESHNESS_RANK.NO_DATA) <
      (FRESHNESS_RANK[current] ?? FRESHNESS_RANK.NO_DATA)
        ? state
        : current,
    "HEALTHY",
  );
}

function makeFreshnessDomainProjection(members, domain) {
  if (!members.length)
    return {
      domain: domain.domain,
      displayName: domain.domain,
      revision: domain.revision ?? null,
      authority: domain.authority ?? [],
      status: "GRAY",
      freshnessState: "NO_DATA",
      lastObservedAt: null,
      ageMs: null,
      observationCount: 0,
      actionCount: 0,
      freshness: { p50: null, p95: null, p99: null },
      staleOver500: 0,
      staleOver1000: 0,
      staleOver2000: 0,
    };
  const observed = members.filter((action) => action.ageMs !== null);
  const lastObservedAt = observed
    .map((action) => action.lastObservedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const ageMs = observed.length
    ? Math.min(...observed.map((action) => action.ageMs))
    : null;
  const worstStatus = members.reduce(
    (current, member) =>
      STATUS_RANK[member.status] < STATUS_RANK[current.status] ? member : current,
    members[0],
  );
  const observedMembers = members.filter(
    (member) => member.metrics?.count > 0 || member.ageMs !== null,
  );
  const freshnessState = observedMembers.length
    ? worstFreshnessState(observedMembers.map((member) => member.freshnessState))
    : "NO_DATA";
  const freshnessValues = members
    .map((member) => member.metrics?.freshness ?? {})
    .filter((freshness) => Number.isFinite(freshness.p95));
  const finiteMax = (values) => {
    const finite = values.filter((value) => Number.isFinite(value));
    return finite.length ? Math.max(...finite) : null;
  };
  return {
    domain: domain.domain,
    displayName: domain.domain,
    revision: domain.revision ?? null,
    authority: domain.authority ?? [],
    status: worstStatus.status,
    freshnessState,
    lastObservedAt,
    ageMs,
    observationCount: members.reduce(
      (total, member) => total + (member.metrics?.count ?? 0),
      0,
    ),
    actionCount: members.length,
    freshness: {
      p50: finiteMax(freshnessValues.map((freshness) => freshness.p50)),
      p95: finiteMax(freshnessValues.map((freshness) => freshness.p95)),
      p99: finiteMax(freshnessValues.map((freshness) => freshness.p99)),
    },
    staleOver500: members.reduce(
      (total, member) => total + (member.metrics?.staleOver500 ?? 0),
      0,
    ),
    staleOver1000: members.reduce(
      (total, member) => total + (member.metrics?.staleOver1000 ?? 0),
      0,
    ),
    staleOver2000: members.reduce(
      (total, member) => total + (member.metrics?.staleOver2000 ?? 0),
      0,
    ),
  };
}

export function buildWebExperienceSummary(aggregator, options = {}) {
  const window = options.window ?? "1h";
  const actions = [...aggregator.registry.values()].map((metadata) =>
    makeActionProjection(aggregator, metadata, { ...options, window }),
  );
  actions.sort((left, right) => {
    const statusDelta = STATUS_RANK[left.status] - STATUS_RANK[right.status];
    if (statusDelta) return statusDelta;
    const painDelta = (right.painScore ?? -1) - (left.painScore ?? -1);
    if (painDelta) return painDelta;
    const usersDelta =
      right.metrics.affectedUsers - left.metrics.affectedUsers;
    if (usersDelta) return usersDelta;
    return (right.metrics.p95 ?? -1) - (left.metrics.p95 ?? -1);
  });
  const categories = [];
  for (const category of [...new Set(actions.map((action) => action.category))].sort()) {
    const members = actions.filter((action) => action.category === category);
    const worst = members.reduce(
      (current, member) =>
        STATUS_RANK[member.status] < STATUS_RANK[current.status] ? member : current,
      members[0],
    );
    const observed = members.filter((member) => member.ageMs !== null);
    categories.push({
      category,
      status: worst.status,
      freshnessState: worstFreshnessState(members.map((member) => member.freshnessState)),
      lastObservedAt:
        observed
          .map((member) => member.lastObservedAt)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      ageMs: observed.length
        ? Math.min(...observed.map((member) => member.ageMs))
        : null,
      painScore: members.reduce(
        (maximum, member) => Math.max(maximum, member.painScore ?? 0),
        0,
      ) || null,
      actionCount: members.length,
      p50: Math.max(...members.map((member) => member.metrics.p50 ?? 0)) || null,
      p95: Math.max(...members.map((member) => member.metrics.p95 ?? 0)) || null,
      p99: Math.max(...members.map((member) => member.metrics.p99 ?? 0)) || null,
      trend: members.some((member) => member.trend.trend === "REGRESSING")
        ? "REGRESSING"
        : members.some((member) => member.trend.trend === "IMPROVING")
          ? "IMPROVING"
          : members.every((member) => member.trend.trend === "UNKNOWN")
            ? "UNKNOWN"
            : "STABLE",
      aggregation: "worst-action",
    });
  }
  const overall = categories.reduce(
    (current, category) =>
      STATUS_RANK[category.status] < STATUS_RANK[current] ? category.status : current,
    "GRAY",
  );
  const domains = aggregator.stateFreshnessDomains();
  const freshnessDomains = domains.map((domain) =>
    makeFreshnessDomainProjection(
      actions.filter(
        (action) => FRESHNESS_DOMAIN_BY_CATEGORY[action.category] === domain.domain,
      ),
      domain,
    ),
  );
  const observedActions = actions.filter((action) => action.metrics.count > 0);
  const lastObservedAt =
    observedActions
      .map((action) => action.lastObservedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const overallFreshnessState = worstFreshnessState(
    actions.map((action) => action.freshnessState),
  );
  return {
    schemaVersion: "1.0.0",
    window,
    generatedAt: new Date(options.nowMs ?? Date.now()).toISOString(),
    overallStatus: overall,
    overallFreshnessState,
    lastObservedAt,
    freshness: {
      lastObservedAt,
      ageMs: observedActions.length
        ? Math.min(...observedActions.map((action) => action.ageMs))
        : null,
      state: overallFreshnessState,
      staleAfterMs: options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
    },
    totals: {
      actionCount: actions.length,
      observedCount: observedActions.reduce(
        (total, action) => total + action.metrics.count,
        0,
      ),
      affectedUsers: observedActions.reduce(
        (maximum, action) => Math.max(maximum, action.metrics.affectedUsers),
        0,
      ),
      dataStatus: actions.some((action) => action.status !== "GRAY")
        ? "MEASURED"
        : "UNKNOWN",
    },
    categories,
    freshnessDomains,
    actions,
    dataStatus: actions.some((action) => action.status !== "GRAY") ? "MEASURED" : "UNKNOWN",
  };
}

export function buildWebExperienceActionDetail(aggregator, actionId, options = {}) {
  const metadata = aggregator.registry.get(actionId);
  if (!metadata) throw new Error("UNKNOWN_ACTION");
  const current = makeActionProjection(aggregator, metadata, options);
  const deploymentComparison = aggregator
    .listDeployments(actionId, options)
    .map((deploymentId) => ({
      deploymentId,
      metrics: aggregator.query(actionId, { ...options, deploymentId }),
    }));
  return {
    schemaVersion: "1.0.0",
    metadata,
    current,
    freshness: current.metrics.freshness,
    trend: current.trend,
    deploymentComparison,
    rootCauseHints: current.rootCauseHints,
    openKoreDependency: metadata.openKoreDependent === "mixed"
      ? "MIXED"
      : metadata.openKoreDependent
        ? "OPENKORE_DEPENDENT"
        : "INDEPENDENT",
    decisionClass: current.decisionClass,
    evidence: options.evidence?.[actionId] ?? {},
  };
}

export const observatoryDefaults = Object.freeze({
  budgets: DEFAULT_BUDGETS,
  statuses: STATUS_RANK,
  freshnessStates: FRESHNESS_STATES,
  freshnessDomainByCategory: FRESHNESS_DOMAIN_BY_CATEGORY,
  defaultStaleAfterMs: DEFAULT_STALE_AFTER_MS,
  rootCauseHints: ROOT_CAUSE_HINTS,
  anonymousKeyPattern: ANONYMOUS_KEY_PATTERN.source,
  forbiddenFields: FORBIDDEN_FIELDS,
});
