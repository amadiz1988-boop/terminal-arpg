import assert from 'node:assert/strict';
import { ACTION_REGISTRY, actionKeyForScenario, validateActionRegistry } from './lib/player-scenario/action-registry.mjs';
import { classifyError, ERROR_TAXONOMY } from './lib/player-scenario/error-taxonomy.mjs';
import { analyzeTrace } from './lib/player-scenario/trace-analyzer.mjs';
import { traceScenarioResult } from './lib/player-scenario/trace-adapter.mjs';
import { appendTraceLayer, createTrace, LAYER_RESULT, sanitizeMetadata } from './lib/player-scenario/trace-schema.mjs';
import { BoundedTraceStore } from './lib/player-scenario/trace-store.mjs';

const registryCheck = validateActionRegistry();
assert.equal(registryCheck.ok, true, registryCheck.errors.join(','));
assert.equal(Object.keys(ACTION_REGISTRY).length, 11);
assert.equal(actionKeyForScenario('start-farm'), 'start_farm');
assert.equal(actionKeyForScenario('supply-return'), 'supply_return');
assert.equal(ACTION_REGISTRY.start_farm.zhTWLabel, '開始掛機');
assert.equal(ACTION_REGISTRY.inventory_load.zhTWLabel, '載入背包');
assert.equal(ACTION_REGISTRY.combat_log_load.zhTWLabel, '載入戰鬥紀錄');
assert.equal(ACTION_REGISTRY.supply_return.zhTWLabel, '補給返程');
const safeMetadata = sanitizeMetadata({ password: 'hidden', token: 'hidden', nested: { reason: 'ok' } });
assert.equal(Object.hasOwn(safeMetadata, 'password'), false);
assert.deepEqual(safeMetadata.nested, { reason: 'ok' });

assert.equal(classifyError('supply_route_unavailable').code, 'SUPPLY_ROUTE_UNAVAILABLE');
assert.equal(classifyError('command rejected').code, 'NATIVE_REJECTED');
assert.equal(classifyError('event_not_observed').layer, 'EVENT_LEDGER');
for (const code of [
  'AUTH_FAILED', 'OWNERSHIP_MISMATCH', 'INVALID_RUNTIME_STATE', 'SUPPLY_ROUTE_UNAVAILABLE',
  'RELOCATION_UNSUPPORTED', 'COMMAND_DISPATCH_FAILED', 'NATIVE_REJECTED',
  'STATE_TRANSITION_TIMEOUT', 'AUTHORITATIVE_POSITION_UNCHANGED', 'EVENT_NOT_OBSERVED',
  'RECONCILIATION_FAILED',
]) assert.ok(ERROR_TAXONOMY[code]);

const trace = createTrace({ traceId: 'trace-foundation-001', actionKey: 'start_farm', actionLabel: '開始掛機', charId: 150075 });
assert.equal(trace.traceId, 'trace-foundation-001');
appendTraceLayer(trace, { layer: 'API', stage: 'RESPONSE', result: LAYER_RESULT.PASS });
appendTraceLayer(trace, { layer: 'CONTROLLER', stage: 'VALIDATION', result: LAYER_RESULT.FAIL, transition: 'Controller -> Command', errorCode: 'SUPPLY_ROUTE_UNAVAILABLE' });
appendTraceLayer(trace, { layer: 'COMMAND_DISPATCH', stage: 'CREATE', result: LAYER_RESULT.NOT_RUN });
const analysis = analyzeTrace(trace);
assert.equal(analysis.firstBrokenTransition, 'Controller -> Command');
assert.equal(analysis.failLayer, 'CONTROLLER');
assert.equal(analysis.notRunAfterFailure, 1);

const timeoutTrace = createTrace({ traceId: 'trace-timeout-001', actionKey: 'combat_log_load' });
appendTraceLayer(timeoutTrace, { layer: 'EVENT_LEDGER', stage: 'OBSERVE', result: LAYER_RESULT.TIMEOUT, transition: 'Authoritative State -> Event Ledger', errorCode: 'STATE_TRANSITION_TIMEOUT' });
assert.equal(analyzeTrace(timeoutTrace).awaitedTransition, 'Authoritative State -> Event Ledger');

const http200StateFail = traceScenarioResult({
  scenario: 'start-farm', traceId: 'trace-http200-001', charId: 150094, result: 'FAIL', failReason: 'mode=STOPPED',
  api: { ok: true, httpStatus: 200 },
  controller: { ok: true },
  command: { ok: true },
  native: { ok: true },
  state: { ok: false, reason: 'mode=STOPPED' },
  events: { ok: true },
}, { dryRun: false });
assert.equal(http200StateFail.trace.layers.find((event) => event.layer === 'API').result, 'PASS');
assert.equal(http200StateFail.analysis.failLayer, 'PA_STATE');
assert.equal(http200StateFail.analysis.firstBrokenTransition, 'Native Result -> Authoritative State');

const startFixture = traceScenarioResult({
  scenario: 'start-farm', traceId: 'scenario-start-farm-fixture-150075', charId: 150075,
  result: 'FAIL', failReason: 'supply_route_unavailable',
  api: { ok: false, httpStatus: 409, reason: 'supply_route_unavailable' },
  controller: { ok: false, reason: 'supply_route_unavailable' },
  command: { ok: false, reason: 'command_not_created' },
  native: { ok: false, reason: 'command_not_created' },
  state: { ok: false, reason: 'controller_rejected' },
  events: { ok: false, reason: 'controller_rejected' },
}, { dryRun: false, charId: 150075 });
assert.equal(startFixture.analysis.result, 'FAIL');
assert.equal(startFixture.analysis.failLayer, 'CONTROLLER');
assert.equal(startFixture.analysis.failErrorCode, 'SUPPLY_ROUTE_UNAVAILABLE');
assert.equal(startFixture.analysis.firstBrokenTransition, 'Controller -> Command');
assert.ok(startFixture.trace.layers.some((event) => event.layer === 'NATIVE_RECEIVE' && event.result === 'NOT_RUN'));

let now = 0;
const store = new BoundedTraceStore({ maxTraces: 2, maxEventsPerTrace: 2, ttlMs: 100, errorRetentionMs: 300, now: () => now });
const stored = createTrace({ traceId: 'trace-store-001', actionKey: 'start_farm', charId: 150075, startedAt: new Date(0).toISOString() });
store.create(stored);
store.append(stored.traceId, { layer: 'API', stage: 'RESPONSE', result: 'PASS' });
store.append(stored.traceId, { layer: 'CONTROLLER', stage: 'VALIDATION', result: 'PASS' });
store.append(stored.traceId, { layer: 'COMMAND_DISPATCH', stage: 'CREATE', result: 'PASS' });
assert.equal(store.get(stored.traceId).layers.length, 2);
store.complete(stored.traceId, { result: 'FAIL', completedAt: new Date(0).toISOString() });
now = 200;
assert.ok(store.get(stored.traceId));
now = 400;
assert.equal(store.get(stored.traceId), null);

const one = createTrace({ traceId: 'trace-filter-1', actionKey: 'start_farm', charId: 150075, startedAt: new Date(now).toISOString() });
one.result = 'FAIL';
one.layers.push({ layer: 'CONTROLLER', errorCode: 'SUPPLY_ROUTE_UNAVAILABLE' });
store.create(one);
const two = createTrace({ traceId: 'trace-filter-2', actionKey: 'stop_farm', charId: 150094, startedAt: new Date(now).toISOString() });
two.result = 'PASS';
store.create(two);
assert.equal(store.listRecent({ actionKey: 'start_farm', result: 'FAIL', charId: 150075, layer: 'CONTROLLER', errorCode: 'SUPPLY_ROUTE_UNAVAILABLE' }).length, 1);

console.log('PLAYER_ACTION_TRACE_FOUNDATION_TEST_PASS checks=38');
