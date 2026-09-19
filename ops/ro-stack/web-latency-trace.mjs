import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';

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
  };
  installResponseHeaders(response, trace);
  return traceStorage.run(trace, handler);
}

export const webLatencyTraceInternals = Object.freeze({
  interactionIdPattern,
  stageNames,
});
