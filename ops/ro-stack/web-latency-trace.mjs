import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { randomUUID, timingSafeEqual } from 'node:crypto';

const interactionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/;
const stageNames = Object.freeze([
  'db',
  'projection',
  'bridge',
  'serialize',
]);

export const webLatencyTraceEnabled = /^(?:1|true|on)$/i.test(
  String(process.env.WEB_LATENCY_TRACE ?? '').trim(),
);
export const webHotPathDiagnosticEnabled = webLatencyTraceEnabled &&
  /^(?:1|true|on)$/i.test(String(process.env.WEB_HOT_PATH_DIAGNOSTIC ?? '').trim());

const traceStorage = new AsyncLocalStorage();

function safeInteractionId(value) {
  const candidate = String(value ?? '').trim();
  return interactionIdPattern.test(candidate) ? candidate : randomUUID();
}

function finiteDuration(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function metricValue(value) {
  return finiteDuration(value).toFixed(2);
}

export function currentWebLatencyTrace() {
  return traceStorage.getStore() ?? null;
}

export function recordWebDiagnosticQuery(category = 'player_required') {
  const counts = currentWebLatencyTrace()?.queryCounts;
  if (!counts) return;
  counts.db_query_count_total += 1;
  if (category === 'support_session_lookup') counts.support_session_query_count += 1;
  if (category === 'admin_data') counts.admin_data_query_count += 1;
  if (category === 'sync_monitoring_write') counts.sync_monitoring_write_count += 1;
}

function authorizedDiagnosticRequest(request) {
  if (!webHotPathDiagnosticEnabled) return false;
  const address = request.socket?.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
  const expected = String(process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN ?? '');
  const supplied = String(request.headers['x-web-hot-path-diagnostic-token'] ?? '');
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(expected) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(supplied) ||
      supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function withWebLatencyStage(stage, operation) {
  const trace = currentWebLatencyTrace();
  if (!trace || !stageNames.includes(stage)) return await operation();
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    trace.stages[stage] += performance.now() - startedAt;
    trace.counts[stage] += 1;
    if (stage === 'bridge') trace.openKoreDependent = true;
  }
}

export function addWebLatencyDuration(stage, durationMs) {
  const trace = currentWebLatencyTrace();
  if (!trace || !stageNames.includes(stage)) return;
  trace.stages[stage] += finiteDuration(durationMs);
  trace.counts[stage] += 1;
}

export function webLatencyServerTiming(trace, now = performance.now()) {
  const total = finiteDuration(now - trace.startedAt);
  const entries = [`app;dur=${metricValue(total)}`];
  for (const stage of stageNames) {
    const description =
      stage === 'bridge' && trace.openKoreDependent
        ? ';desc="OPENKORE_DEPENDENT"'
        : '';
    entries.push(
      `${stage};dur=${metricValue(trace.stages[stage])}${description}`,
    );
  }
  return entries.join(', ');
}

function headersWithTrace(headers, trace) {
  return {
    ...(headers ?? {}),
    'server-timing': webLatencyServerTiming(trace),
    'x-interaction-id': trace.interactionId,
    'x-web-latency-trace': 'on',
    ...(trace.queryCounts ? {
      'x-web-hot-path-query-counts': Object.entries(trace.queryCounts)
        .map(([name, value]) => `${name}=${value}`).join(';'),
    } : {}),
  };
}

function installResponseHeaders(response, trace) {
  const writeHead = response.writeHead.bind(response);
  response.writeHead = (statusCode, statusMessageOrHeaders, maybeHeaders) => {
    if (typeof statusMessageOrHeaders === 'string')
      return writeHead(
        statusCode,
        statusMessageOrHeaders,
        headersWithTrace(maybeHeaders, trace),
      );
    return writeHead(
      statusCode,
      headersWithTrace(statusMessageOrHeaders, trace),
    );
  };
}

export function runWithWebLatencyTrace(request, response, handler) {
  if (!webLatencyTraceEnabled) return handler();
  const trace = {
    interactionId: safeInteractionId(request.headers['x-interaction-id']),
    startedAt: performance.now(),
    endpoint: String(request.url ?? '/').split('?')[0],
    method: String(request.method ?? 'GET'),
    stages: Object.fromEntries(stageNames.map((stage) => [stage, 0])),
    counts: Object.fromEntries(stageNames.map((stage) => [stage, 0])),
    openKoreDependent: false,
    queryCounts: authorizedDiagnosticRequest(request) ? {
      db_query_count_total: 0,
      support_session_query_count: 0,
      admin_data_query_count: 0,
      sync_monitoring_write_count: 0,
    } : null,
  };
  installResponseHeaders(response, trace);
  return traceStorage.run(trace, handler);
}

export const webLatencyTraceInternals = Object.freeze({
  interactionIdPattern,
  stageNames,
});
