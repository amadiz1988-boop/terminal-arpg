import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendTraceLayer, createTrace, LAYER_RESULT, sanitizeMetadata } from './lib/player-scenario/trace-schema.mjs';
import { analyzeTrace } from './lib/player-scenario/trace-analyzer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referencePath = path.join(root, 'docs', 'rathena-reference', 'debugging.md');
const indexPath = path.join(root, 'docs', 'rathena-reference', 'reference-index.yml');
const nativePath = path.join(root, '..', '..', '..', '..', 'source', 'ghost-island-rathena', 'src', 'common', 'gi_trace.hpp');

const reference = fs.readFileSync(referencePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const native = fs.readFileSync(nativePath, 'utf8');

for (const required of [
  'Debug escalation ladder', 'Structured probe contract', 'Handler-level procedure',
  'Packet debugging procedure', 'Raw packet capture policy', 'Crash debug playbook',
  'GUI-free debug contract', 'FIRST_BROKEN_TRANSITION', 'TRACE_PROPAGATION_GAP = PRESENT',
  'READY_FOR_RUNTIME_TRACE_INTEGRATION = YES',
]) assert.match(reference, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

for (const required of [
  "topic: '35 DEBUGGING / STRUCTURED PROBES'", 'ShowDebug', 'clif_parse',
  'docs/rathena-reference/debugging.md', 'native_head: 1ffd06a07f8d997cf500334f92ccc7df6db354f7',
]) assert.match(index, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

for (const required of [
  'traceId', 'actionKey', 'charId', 'layer', 'stage', 'timestamp', 'result',
  'errorCode', 'paModeBefore', 'paModeAfter', 'targetId', 'itemId', 'metadata',
  'GI_TRACE_ALL', 'DEFAULT_EVENT_CAP', 'metadata_is_secret', 'REDACTED',
]) assert.match(native, new RegExp(required));

for (const layer of [
  'NATIVE_RECEIVE', 'NATIVE_ACCEPT', 'PA_STATE', 'RATHENA_HANDLER',
  'RATHENA_AUTHORITY', 'PACKET_BOUNDARY', 'EVENT_LEDGER',
]) assert.match(reference, new RegExp(layer));

const safe = sanitizeMetadata({ password: 'hidden', token: 'hidden', nested: { reason: 'ok' } });
assert.equal(Object.hasOwn(safe, 'password'), false);
assert.deepEqual(safe.nested, { reason: 'ok' });

const trace = createTrace({ traceId: 'debug-reference-001', actionKey: 'start_farm', charId: 150075 });
assert.equal(trace.traceId, 'debug-reference-001');
assert.equal(trace.actionKey, 'start_farm');
assert.equal(trace.charId, 150075);
appendTraceLayer(trace, { layer: 'NATIVE_RECEIVE', stage: 'RECEIVE', result: LAYER_RESULT.PASS });
appendTraceLayer(trace, { layer: 'NATIVE_ACCEPT', stage: 'ACCEPT', result: LAYER_RESULT.PASS });
appendTraceLayer(trace, {
  layer: 'PA_STATE', stage: 'TRANSITION', result: LAYER_RESULT.FAIL,
  transition: 'Native Accept -> PA State', errorCode: 'PA_STATE_REJECTED',
});
const analysis = analyzeTrace(trace);
assert.equal(analysis.failLayer, 'PA_STATE');
assert.equal(analysis.firstBrokenTransition, 'Native Accept -> PA State');

const packetNotReached = createTrace({ traceId: 'debug-reference-packet-001', actionKey: 'use_fly_wing', charId: 150075 });
appendTraceLayer(packetNotReached, { layer: 'NATIVE_RECEIVE', stage: 'RECEIVE', result: LAYER_RESULT.PASS });
appendTraceLayer(packetNotReached, {
  layer: 'RATHENA_AUTHORITY', stage: 'HANDLER_DISPATCH', result: LAYER_RESULT.BLOCKED,
  transition: 'Native Accept -> rAthena Handler', errorCode: 'HANDLER_NOT_REACHED',
});
assert.equal(analyzeTrace(packetNotReached).failLayer, 'RATHENA_AUTHORITY');

console.log('RATHENA_DEBUG_REFERENCE_TEST_PASS checks=37');
