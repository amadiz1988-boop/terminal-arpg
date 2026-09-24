import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseFirstJobContent,
  firstJobRoute,
} from '../ops/ro-stack/quest-runtime/first-job-content.mjs';
import { coordinatorDeadlineMsForRouteSteps } from '../ops/ro-stack/persistent-agent/relocation-policy.mjs';
import { gateCombatSseForServerAgent } from '../ops/ro-stack/combat-sse.mjs';
import { CANARY_ACTIONS } from '../ops/ro-stack/web-experience/production-telemetry.mjs';

function readStartupJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../ops/ro-stack/${relativePath}`, import.meta.url), 'utf8'));
}

const firstJob = parseFirstJobContent(readStartupJson('persistent-agent/quest-content/first-job.json'));
assert.equal(firstJob.contentId, 'first_job_v1');
assert.equal(firstJobRoute(firstJob, 'swordman').map, firstJob.academy.map);

const edenCourseA = readStartupJson('persistent-agent/quest-sequences/eden-course-a.json');
assert.equal(edenCourseA.sequenceId, 'eden_course_a_v1');
assert.ok(Array.isArray(edenCourseA.steps) && edenCourseA.steps.length > 0);

const registry = readStartupJson('web-experience/action-registry.json');
assert.ok(Array.isArray(registry.actions) && registry.actions.length > 0);
const actionIds = new Set(registry.actions.map(({ actionId }) => actionId));
assert.equal(actionIds.size, registry.actions.length);
for (const action of CANARY_ACTIONS) assert.ok(actionIds.has(action), action);

assert.equal(coordinatorDeadlineMsForRouteSteps(1), 180_000);
assert.equal(coordinatorDeadlineMsForRouteSteps(6), 780_000);
assert.equal(coordinatorDeadlineMsForRouteSteps(16), 1_980_000);
assert.equal(coordinatorDeadlineMsForRouteSteps(100), 1_980_000);
const sseState = { enabled: true, eligible: true, transport: 'sse' };
assert.deepEqual(gateCombatSseForServerAgent(sseState, true), {
  ...sseState, eligible: false, transport: 'polling',
});
assert.equal(gateCombatSseForServerAgent(sseState, false), sseState);

const originalTrace = process.env.WEB_LATENCY_TRACE;
const originalDiagnostic = process.env.WEB_HOT_PATH_DIAGNOSTIC;
const originalToken = process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN;
try {
  process.env.WEB_LATENCY_TRACE = '1';
  process.env.WEB_HOT_PATH_DIAGNOSTIC = '1';
  process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN = '0123456789abcdef0123456789abcdef';
  const trace = await import(`../ops/ro-stack/web-latency-trace.mjs?candidate-completeness=${Date.now()}`);
  assert.equal(trace.webHotPathDiagnosticEnabled, true);
  function response() {
    return {
      headers: null,
      writeHead(_status, headers) { this.headers = headers; },
    };
  }
  const authorized = response();
  trace.runWithWebLatencyTrace({
    headers: { 'x-web-hot-path-diagnostic-token': process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN },
    socket: { remoteAddress: '127.0.0.1' }, url: '/api/admin/test', method: 'GET',
  }, authorized, () => {
    trace.recordWebDiagnosticQuery('admin_data');
    authorized.writeHead(200, {});
  });
  assert.match(authorized.headers['x-web-hot-path-query-counts'], /db_query_count_total=1/);
  assert.match(authorized.headers['x-web-hot-path-query-counts'], /admin_data_query_count=1/);

  const unauthorized = response();
  trace.runWithWebLatencyTrace({
    headers: { 'x-web-hot-path-diagnostic-token': process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN },
    socket: { remoteAddress: '192.0.2.1' }, url: '/api/admin/test', method: 'GET',
  }, unauthorized, () => {
    trace.recordWebDiagnosticQuery('admin_data');
    unauthorized.writeHead(200, {});
  });
  assert.equal(unauthorized.headers['x-web-hot-path-query-counts'], undefined);
} finally {
  if (originalTrace === undefined) delete process.env.WEB_LATENCY_TRACE;
  else process.env.WEB_LATENCY_TRACE = originalTrace;
  if (originalDiagnostic === undefined) delete process.env.WEB_HOT_PATH_DIAGNOSTIC;
  else process.env.WEB_HOT_PATH_DIAGNOSTIC = originalDiagnostic;
  if (originalToken === undefined) delete process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN;
  else process.env.WEB_HOT_PATH_DIAGNOSTIC_TOKEN = originalToken;
}

console.log('WEB_CANDIDATE_COMPLETENESS = PASS');
