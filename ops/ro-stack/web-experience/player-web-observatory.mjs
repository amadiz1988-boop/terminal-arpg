const DOMAINS = Object.freeze([
  'ROUTE_NAVIGATION', 'HTTP_API', 'SSE', 'POLLING', 'MINIMAP',
  'COMBAT_PRESENTATION', 'INVENTORY', 'FARM_STATUS', 'QUEST_UI',
  'ASSET_LOADING', 'BROWSER_RENDER_HEALTH', 'CORE_WEB_VITALS',
  'JS_RUNTIME_ERRORS', 'MAIN_THREAD_UI_STALL',
]);
const SEVERITIES = Object.freeze(['NORMAL', 'ELEVATED', 'DEGRADED', 'SEVERE', 'RECOVERED']);
const MAX_CONTEXT_KEYS = 12;
const MAX_EVIDENCE = 32;
const REPORT_MAX_CHARS = 40_000;
const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_COOLDOWN_MS = 60_000;

export const METRIC_CATALOG = Object.freeze({
  ROUTE_NAVIGATION: ['route_transition_ms', 'route_usable_ms', 'route_complete_ms', 'lazy_resource_ms', 'route_failure'],
  HTTP_API: ['request_duration_ms', 'ttfb_ms', 'response_bytes', 'request_error', 'request_timeout'],
  SSE: ['event_gap_ms', 'delivery_delay_ms', 'reconnect_count', 'revision_lag'],
  POLLING: ['expected_interval_ms', 'actual_interval_ms', 'network_duration_ms', 'authoritative_data_age_ms', 'late_poll'],
  MINIMAP: ['snapshot_gap_ms', 'freshness_age_ms', 'render_position_lag_ms', 'correction_count', 'snapshot_gap_gt500_ms', 'snapshot_gap_gt1000_ms', 'snapshot_gap_gt2000_ms'],
  COMBAT_PRESENTATION: ['event_delivery_latency_ms', 'event_to_render_latency_ms'],
  INVENTORY: ['initial_load_ms', 'refresh_ms', 'staleness_ms', 'render_ms'],
  FARM_STATUS: ['projection_freshness_ms', 'delivery_delay_ms', 'ui_update_ms', 'stale_state'],
  QUEST_UI: ['load_ms', 'event_delivery_ms', 'render_ms', 'error'],
  ASSET_LOADING: ['resource_load_ms', 'resource_failure', 'decode_failure'],
  BROWSER_RENDER_HEALTH: ['frame_interval_ms', 'long_frame_count', 'frame_p50_ms', 'frame_p95_ms', 'frame_p99_ms', 'frame_max_ms'],
  CORE_WEB_VITALS: ['lcp_ms', 'inp_ms', 'cls', 'fcp_ms', 'ttfb_ms'],
  JS_RUNTIME_ERRORS: ['window_error', 'unhandled_rejection'],
  MAIN_THREAD_UI_STALL: ['long_task_ms', 'stall_gap_ms'],
});
export const EVENT_SCHEMA = Object.freeze({
  kind: 'WEB_OBSERVABILITY', required: ['timestamp', 'sessionId', 'route', 'domain', 'metric', 'value', 'unit', 'visibility'],
  forbidden: ['password', 'token', 'cookie', 'authorization', 'requestBody', 'responseBody'],
});
export const ANOMALY_SCHEMA = Object.freeze({
  type: 'WEB_EXPERIENCE_ANOMALY', required: ['anomalyId', 'startTime', 'active', 'route', 'domain', 'metric', 'observed', 'severity'],
});
export const REPORT_SCHEMA = 'WEB_EXPERIENCE_DIAGNOSTIC_REPORT_V1';

function finite(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }
function percentile(values, ratio) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] : null;
}
function median(values) { return percentile(values, 0.5); }
function stats(values) {
  const clean = values.filter(Number.isFinite);
  const p50 = percentile(clean, 0.5), p95 = percentile(clean, 0.95), p99 = percentile(clean, 0.99);
  const med = p50;
  const mad = median(clean.map((value) => Math.abs(value - med)));
  return { count: clean.length, p50, p95, p99, max: clean.length ? Math.max(...clean) : null, median: med, mad };
}
function safeId(value, fallback = 'unknown') {
  const text = String(value ?? fallback).slice(0, 128);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text) ? text : fallback;
}
function safeContext(context) {
  if (!context || typeof context !== 'object') return {};
  return Object.fromEntries(Object.entries(context).slice(0, MAX_CONTEXT_KEYS).map(([key, value]) => {
    const cleanKey = safeId(key, 'context');
    if (/(password|token|cookie|authorization|secret|credential|request.?body|response.?body)/i.test(cleanKey)) return [cleanKey, '[REDACTED]'];
    if (typeof value === 'string') {
      const cleanValue = value
        .replace(/([?&\s](?:password|token|cookie|authorization|secret|credential))=([^&\s]+)/gi, '$1=[REDACTED]')
        .replace(/https?:\/\/[^\s]+/gi, '[URL_REDACTED]');
      return [cleanKey, cleanValue.slice(0, 160)];
    }
    return [cleanKey, typeof value === 'number' || typeof value === 'boolean' ? value : '[REDACTED]'];
  }));
}
function severityFor(value, baseline, metric) {
  const n = finite(value);
  if (n === null) return 'NORMAL';
  if (metric === 'long_task_ms' && n >= 500) return n >= 2000 ? 'SEVERE' : 'DEGRADED';
  const absolute = n >= 2000 ? 'SEVERE' : n >= 1000 ? 'DEGRADED' : null;
  if (!baseline || baseline.count < 8) return absolute ?? (n > 0 ? 'ELEVATED' : 'NORMAL');
  const robustLimit = baseline.p50 + Math.max(6 * (baseline.mad || 1), baseline.p95 - baseline.p50);
  if (absolute === 'SEVERE' || n > robustLimit) return absolute ?? 'SEVERE';
  if (absolute === 'DEGRADED' || n > baseline.p95) return 'DEGRADED';
  if (n > baseline.p50) return 'ELEVATED';
  return 'NORMAL';
}
function anomalyReason(value, baseline, severity, metric) {
  if (metric === 'long_task_ms' && finite(value) >= 500) return 'ABSOLUTE_GUARD_500';
  if (finite(value) >= 2000) return 'ABSOLUTE_SEVERE';
  if (finite(value) >= 1000) return 'ABSOLUTE_GUARD';
  if (baseline?.count >= 8 && finite(value) > baseline.p50 + Math.max(6 * (baseline.mad || 1), baseline.p95 - baseline.p50)) return 'ROBUST_OUTLIER';
  if (baseline?.count >= 8 && finite(value) > baseline.p95) return 'TAIL_LATENCY';
  return severity === 'DEGRADED' ? 'SUSTAINED_DEGRADATION' : null;
}
function cleanEvent(raw, now) {
  if (!raw || raw.kind !== 'WEB_OBSERVABILITY') return { ok: false, error: 'INVALID_KIND' };
  const domain = String(raw.domain ?? '');
  const metric = String(raw.metric ?? '');
  const value = finite(raw.value);
  if (!DOMAINS.includes(domain) || !METRIC_CATALOG[domain]?.includes(metric)) return { ok: false, error: 'UNKNOWN_METRIC' };
  if (value === null || value < 0) return { ok: false, error: 'INVALID_VALUE' };
  return { ok: true, event: {
    kind: 'WEB_OBSERVABILITY', timestamp: finite(raw.timestamp) ?? now, sessionId: safeId(raw.sessionId), correlationId: safeId(raw.correlationId, 'none'), route: String(raw.route ?? '/').slice(0, 160), domain, metric, value, unit: safeId(raw.unit, 'ms'), visibility: ['visible', 'hidden'].includes(raw.visibility) ? raw.visibility : 'unknown', severity: SEVERITIES.includes(raw.severity) ? raw.severity : null, context: safeContext(raw.context),
  } };
}

export function createPlayerWebObservatory(options = {}) {
  const now = options.now ?? (() => Date.now());
  const windowMs = finite(options.windowMs) ?? DEFAULT_WINDOW_MS;
  const cooldownMs = finite(options.cooldownMs) ?? DEFAULT_COOLDOWN_MS;
  const sampleLimit = Math.max(32, Math.floor(Number(options.sampleLimit ?? 512)));
  const samples = new Map();
  const evidence = [];
  const anomalies = [];
  const active = new Map();
  const counters = { received: 0, accepted: 0, rejected: 0, dropped: 0, deduped: 0 };
  let sequence = 0;

  function keyOf(event) { return `${event.route}|${event.domain}|${event.metric}`; }
  function listFor(key) { if (!samples.has(key)) samples.set(key, []); return samples.get(key); }
  function baselineFor(key, at) { return stats(listFor(key).filter((entry) => entry.timestamp >= at - windowMs).map((entry) => entry.value)); }
  function closeAnomaly(key, at) {
    const current = active.get(key);
    if (!current) return null;
    current.endTime = at; current.active = false; current.recovery = 'RECOVERED'; current.severity = 'RECOVERED';
    active.delete(key); anomalies.push(current); return current;
  }
  function ingest(raw) {
    counters.received += 1;
    const normalized = cleanEvent(raw, now());
    if (!normalized.ok) { counters.rejected += 1; return normalized; }
    const event = normalized.event; counters.accepted += 1;
    const key = keyOf(event); const at = event.timestamp; const values = listFor(key);
    const baseline = baselineFor(key, at); const severity = severityFor(event.value, baseline, event.metric); const reason = anomalyReason(event.value, baseline, severity, event.metric);
    values.push(event); if (values.length > sampleLimit) { values.splice(0, values.length - sampleLimit); counters.dropped += 1; }
    evidence.push(event); if (evidence.length > MAX_EVIDENCE) evidence.splice(0, evidence.length - MAX_EVIDENCE);
    const current = active.get(key);
    if (reason) {
      if (current) { current.endTime = null; current.active = true; current.observed = Math.max(current.observed, event.value); if (severity === 'SEVERE') { current.severity = 'SEVERE'; current.peakSeverity = 'SEVERE'; } current.evidence.push(event); counters.deduped += 1; }
      else if (!anomalies.some((entry) => entry.key === key && at - Number(entry.endTime ?? entry.startTime) < cooldownMs)) {
        const anomaly = { anomalyId: `wa_${++sequence}`, key, startTime: at, endTime: null, active: true, route: event.route, domain: event.domain, metric: event.metric, observed: event.value, baselineP50: baseline.p50, baselineP95: baseline.p95, baselineP99: baseline.p99, baselineMax: baseline.max, severity, peakSeverity: severity, reason, session: event.sessionId, visibility: event.visibility, relatedHttp: event.domain === 'HTTP_API' ? [event.correlationId] : [], relatedSse: event.domain === 'SSE' ? [event.correlationId] : [], relatedJsError: event.domain === 'JS_RUNTIME_ERRORS' ? [event.correlationId] : [], relatedLongTask: event.domain === 'MAIN_THREAD_UI_STALL' ? [event.correlationId] : [], recovery: null, evidence: [event] };
        active.set(key, anomaly);
      }
    } else if (current) closeAnomaly(key, at);
    return { ok: true, event, severity, baseline, anomaly: active.get(key) ?? null };
  }
  function ingestBatch(events = []) { return events.slice(0, 64).map(ingest); }
  function metricSnapshot(at = now()) {
    return [...samples.entries()].map(([key, entries]) => { const recent = entries.filter((entry) => entry.timestamp >= at - windowMs); const metric = recent[0]; return { key, route: metric?.route ?? key.split('|')[0], domain: metric?.domain ?? key.split('|')[1], metric: metric?.metric ?? key.split('|')[2], ...stats(recent.map((entry) => entry.value)), lastSeen: recent.at(-1)?.timestamp ?? null, gt500: recent.filter((entry) => entry.value >= 500).length, gt1000: recent.filter((entry) => entry.value >= 1000).length, gt2000: recent.filter((entry) => entry.value >= 2000).length }; }).filter((entry) => entry.count);
  }
  function snapshot(options = {}) {
    const at = finite(options.nowMs) ?? now(); const recent = anomalies.filter((entry) => Number(entry.endTime ?? at) >= at - windowMs); const current = [...active.values()];
    return { schemaVersion: 'WEB_EXPERIENCE_OBSERVATORY_V1', generatedAt: at, windowMs, counters: { ...counters }, metrics: metricSnapshot(at), activeAnomalies: current, recentAnomalies: recent.slice(-64), evidence: evidence.filter((entry) => entry.timestamp >= at - windowMs).slice(-MAX_EVIDENCE), status: current.some((entry) => entry.severity === 'SEVERE') ? 'SEVERE' : current.length ? 'DEGRADED' : 'NORMAL', bounded: true };
  }
  return Object.freeze({ ingest, ingestBatch, snapshot, schemas: { METRIC_CATALOG, EVENT_SCHEMA, ANOMALY_SCHEMA }, status: () => ({ ...counters, active: active.size, bufferedMetrics: samples.size }) });
}

function value(value) { return value === null || value === undefined ? 'NOT_MEASURABLE' : String(value); }
export function buildObservatoryReport(snapshot, options = {}) {
  const anomalies = [...(snapshot.activeAnomalies ?? []), ...(snapshot.recentAnomalies ?? [])].filter((entry, index, all) => all.findIndex((candidate) => candidate.anomalyId === entry.anomalyId) === index).slice(0, 10);
  const counts = anomalies.reduce((out, entry) => { out[entry.severity] = (out[entry.severity] ?? 0) + 1; if (entry.peakSeverity === 'SEVERE' && entry.severity !== 'SEVERE') out.SEVERE = (out.SEVERE ?? 0) + 1; return out; }, {});
  const by = (domain, metric) => snapshot.metrics?.find((entry) => entry.domain === domain && (!metric || entry.metric === metric)) ?? {};
  const minimap = by('MINIMAP', 'snapshot_gap_ms'); const http = by('HTTP_API', 'request_duration_ms'); const sse = by('SSE', 'event_gap_ms'); const frame = by('BROWSER_RENDER_HEALTH', 'frame_interval_ms');
  const lines = ['WEB_EXPERIENCE_DIAGNOSTIC_REPORT_V1', `REPORT_TIME = ${new Date(snapshot.generatedAt).toISOString()}`, `TIME_WINDOW = ${snapshot.windowMs}ms`, `PRODUCTION = ${value(options.production ?? 'CURRENT')}`, `ACTIVE_SESSIONS = ${value(options.activeSessions)}`, '', `GLOBAL_STATUS = ${snapshot.status}`, '', 'ANOMALY SUMMARY', `TOTAL_ANOMALIES = ${anomalies.length}`, `SEVERE = ${counts.SEVERE ?? 0}`, `DEGRADED = ${counts.DEGRADED ?? 0}`, `RECOVERED = ${counts.RECOVERED ?? 0}`, '', 'TOP ANOMALIES'];
  for (const anomaly of anomalies) lines.push(`ANOMALY_ID = ${anomaly.anomalyId}`, `START = ${new Date(anomaly.startTime).toISOString()}`, `END = ${anomaly.endTime ? new Date(anomaly.endTime).toISOString() : 'ACTIVE'}`, `DURATION = ${anomaly.endTime ? anomaly.endTime - anomaly.startTime : 'ACTIVE'}`, `ROUTE = ${anomaly.route}`, `DOMAIN = ${anomaly.domain}`, `METRIC = ${anomaly.metric}`, `OBSERVED = ${value(anomaly.observed)}`, `BASELINE_P50 = ${value(anomaly.baselineP50)}`, `BASELINE_P95 = ${value(anomaly.baselineP95)}`, `BASELINE_P99 = ${value(anomaly.baselineP99)}`, `SEVERITY = ${anomaly.severity}`, `FIRST_SLOW_LAYER = ${anomaly.domain === 'MAIN_THREAD_UI_STALL' ? 'BROWSER_MAIN_THREAD' : anomaly.domain === 'HTTP_API' ? 'SERVER_OR_TRANSPORT' : 'UNKNOWN'}`, 'SERVER = NOT_MEASURABLE', 'TRANSPORT = NOT_MEASURABLE', 'BROWSER = NOT_MEASURABLE', 'UNKNOWN = NOT_MEASURABLE', `RELATED_ERRORS = ${value(anomaly.relatedJsError?.join(','))}`, `RECOVERY = ${value(anomaly.recovery)}`, '');
  lines.push('MINIMAP', `LIVE_P50 = ${value(minimap.p50)}`, `LIVE_P95 = ${value(minimap.p95)}`, `LIVE_P99 = ${value(minimap.p99)}`, `LIVE_MAX = ${value(minimap.max)}`, `GT_500MS = ${value(minimap.gt500)}`, `GT_1000MS = ${value(minimap.gt1000)}`, `GT_2000MS = ${value(minimap.gt2000)}`, 'POSITION_CORRECTIONS = NOT_MEASURABLE', 'MAP_SNAPS = NOT_MEASURABLE', '', 'HTTP', `REQUESTS = ${value(http.count)}`, `ERRORS = NOT_MEASURABLE`, `P50 = ${value(http.p50)}`, `P95 = ${value(http.p95)}`, `P99 = ${value(http.p99)}`, `MAX = ${value(http.max)}`, 'SLOWEST_ENDPOINTS = see bounded RAW EVIDENCE', '', 'SSE', `CONNECTIONS = NOT_MEASURABLE`, `RECONNECTS = NOT_MEASURABLE`, `P50_EVENT_GAP = ${value(sse.p50)}`, `P95_EVENT_GAP = ${value(sse.p95)}`, `P99_EVENT_GAP = ${value(sse.p99)}`, `MAX_EVENT_GAP = ${value(sse.max)}`, '', 'BROWSER', `FRAME_P50 = ${value(frame.p50)}`, `FRAME_P95 = ${value(frame.p95)}`, `FRAME_P99 = ${value(frame.p99)}`, `FRAME_MAX = ${value(frame.max)}`, 'LONG_TASKS = see MAIN_THREAD_UI_STALL', 'JS_ERRORS = see JS_RUNTIME_ERRORS', 'UNHANDLED_REJECTIONS = see JS_RUNTIME_ERRORS', 'LCP = NOT_MEASURABLE', 'INP = NOT_MEASURABLE', 'CLS = NOT_MEASURABLE', '', 'LIKELY BOTTLENECK', 'SERVER = NOT_MEASURABLE', 'TRANSPORT = NOT_MEASURABLE', 'BROWSER_MAIN_THREAD = NOT_MEASURABLE', 'RENDER = NOT_MEASURABLE', 'UNKNOWN = NOT_MEASURABLE', '', 'RAW EVIDENCE', ...(snapshot.evidence ?? []).slice(-MAX_EVIDENCE).map((entry) => JSON.stringify(entry)), 'END REPORT');
  return lines.join('\n').slice(0, REPORT_MAX_CHARS);
}
