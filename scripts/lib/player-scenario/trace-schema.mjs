import { randomUUID } from 'node:crypto';

export const TRACE_VERSION = 'PLAYER_ACTION_TRACE_V1';
export const TRACE_LAYERS = Object.freeze([
  'BROWSER', 'API', 'AUTH', 'OWNERSHIP', 'CONTROLLER', 'COMMAND_DISPATCH',
  'NATIVE_RECEIVE', 'NATIVE_ACCEPT', 'PA_STATE', 'RATHENA_AUTHORITY',
  'EVENT_LEDGER', 'RECONCILE',
]);
export const TRACE_RESULT = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', BLOCKED: 'BLOCKED' });
export const LAYER_RESULT = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', NOT_RUN: 'NOT_RUN', TIMEOUT: 'TIMEOUT', BLOCKED: 'BLOCKED' });

const FORBIDDEN_KEY = /password|token|secret|cookie|authorization|credential/i;

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function safeValue(value, depth = 0) {
  if (depth > 2 || value == null) return value == null ? null : '[BOUNDED]';
  if (typeof value === 'string' || typeof value === 'boolean') return value.slice ? value.slice(0, 256) : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 16).map((item) => safeValue(item, depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value).slice(0, 32)) {
      if (FORBIDDEN_KEY.test(key)) continue;
      output[key] = safeValue(child, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 128);
}

export function createTrace(input = {}) {
  const startedAt = input.startedAt ?? new Date().toISOString();
  return {
    schema: TRACE_VERSION,
    traceId: String(input.traceId ?? `trace-${randomUUID()}`),
    actionKey: input.actionKey == null ? null : String(input.actionKey),
    actionLabel: input.actionLabel == null ? null : String(input.actionLabel),
    charId: input.charId == null ? null : Number(input.charId),
    accountId: input.accountId == null ? null : Number(input.accountId),
    startedAt,
    completedAt: null,
    result: null,
    currentMap: input.currentMap == null ? null : String(input.currentMap),
    targetMap: input.targetMap == null ? null : String(input.targetMap),
    layers: [],
    tracePropagationGap: input.tracePropagationGap ?? null,
  };
}

export function appendTraceLayer(trace, input = {}) {
  if (!trace || !Array.isArray(trace.layers)) throw new TypeError('trace.layers must be an array');
  const layer = String(input.layer ?? 'RECONCILE');
  const result = Object.values(LAYER_RESULT).includes(input.result) ? input.result : (input.ok === false ? LAYER_RESULT.FAIL : LAYER_RESULT.PASS);
  const event = {
    layer: TRACE_LAYERS.includes(layer) ? layer : 'RECONCILE',
    stage: String(input.stage ?? 'OBSERVE'),
    timestamp: input.timestamp ?? new Date().toISOString(),
    result,
    durationMs: nonNegative(input.durationMs),
    errorCode: input.errorCode == null ? null : String(input.errorCode),
    reason: input.reason == null ? null : String(input.reason).slice(0, 256),
    transition: input.transition == null ? null : String(input.transition),
    metadata: safeValue(input.metadata ?? {}),
  };
  trace.layers.push(event);
  return event;
}

export function completeTrace(trace, input = {}) {
  trace.completedAt = input.completedAt ?? new Date().toISOString();
  trace.result = input.result ?? trace.result ?? TRACE_RESULT.BLOCKED;
  if (input.currentMap !== undefined) trace.currentMap = input.currentMap;
  if (input.targetMap !== undefined) trace.targetMap = input.targetMap;
  if (input.tracePropagationGap !== undefined) trace.tracePropagationGap = input.tracePropagationGap;
  return trace;
}

export function sanitizeMetadata(value) {
  return safeValue(value);
}
