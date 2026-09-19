import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  buildAdminFixtureNavigationRoute,
  navigationCommandIsPending,
  parseAdminFixtureNavigationInput,
} from '../ops/ro-stack/persistent-agent/admin-fixture-navigation.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dashboard = await readFile(join(here, '..', 'ops', 'ro-stack', 'dashboard.mjs'), 'utf8');
const tests = [];
function test(name, callback) {
  try {
    callback();
    tests.push({ name, status: 'PASS' });
  } catch (error) {
    tests.push({ name, status: 'FAIL', error: error.stack ?? String(error) });
  }
}

test('unauthenticated non-admin surface is rejected before producer', () => {
  const start = dashboard.indexOf('async function handleAdminFixtureNavigationRequest');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(region.includes("if (!isAdminSurfaceHost(request))"));
  assert.ok(region.includes("error: 'admin_auth_required'"));
});

test('invalid fixture navigation target syntax is rejected', () => {
  assert.deepEqual(parseAdminFixtureNavigationInput({ targetMap: 'Pay Arche', targetX: 1, targetY: 2 }), {
    ok: false,
    reason: 'invalid_transition',
  });
  assert.deepEqual(parseAdminFixtureNavigationInput({ targetMap: 'morocc', targetX: -1, targetY: 2 }), {
    ok: false,
    reason: 'invalid_transition',
  });
});

test('authorized target carries the native map and position fields', () => {
  assert.deepEqual(parseAdminFixtureNavigationInput({ targetMap: 'morocc', targetX: 156, targetY: 46 }), {
    ok: true,
    targetMap: 'morocc',
    targetX: 156,
    targetY: 46,
  });
  assert.deepEqual(buildAdminFixtureNavigationRoute({
    currentMap: 'morocc',
    targetMap: 'morocc',
    targetX: 156,
    targetY: 46,
    resolvedRoute: null,
  }), [{ map: 'morocc', x: 156, y: 46 }]);
});

test('cross-map route reuses the existing resolved navigation semantics', () => {
  const route = buildAdminFixtureNavigationRoute({
    currentMap: 'prontera',
    targetMap: 'morocc',
    targetX: 156,
    targetY: 46,
    resolvedRoute: [
      { map: 'prontera', x: 10, y: 10, portalTo: 'morocc' },
      { map: 'morocc', x: 20, y: 20 },
    ],
  });
  assert.deepEqual(route, [
    { map: 'prontera', x: 10, y: 10, portalTo: 'morocc' },
    { map: 'morocc', x: 156, y: 46 },
  ]);
});

test('pending and confirmed navigation statuses block competing movement', () => {
  assert.equal(navigationCommandIsPending('QUEUED'), true);
  assert.equal(navigationCommandIsPending('ACCEPTED'), true);
  assert.equal(navigationCommandIsPending('CONFIRMED'), true);
  assert.equal(navigationCommandIsPending('REJECTED'), false);
  assert.ok(dashboard.includes("pendingRelocations.has(id)"));
  assert.ok(dashboard.includes("navigationCommandIsPending(latestNavigation?.status)"));
});

test('producer emits the existing persistent_agent_command start_navigation contract', () => {
  const start = dashboard.indexOf('// PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(region.includes("action: 'start_navigation'"));
  assert.ok(region.includes('expectedRevision: Number(stateRow.revision)'));
  assert.ok(region.includes('{ route }'));
  assert.ok(region.includes('queueOwnershipCommand('));
});

test('producer requires existing rollout authorization and native resident ownership', () => {
  const start = dashboard.indexOf('// PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(region.includes('readPersistentAgentRollout('));
  assert.ok(region.includes('if (!rollout.allowed)'));
  assert.ok(region.includes("stateRow.controlOwner !== SERVER_AGENT_OWNER"));
  assert.ok(region.includes("stateRow.ownershipState !== SERVER_AGENT_OWNER"));
  assert.ok(region.includes('!live?.resident || !live.fresh'));
});

test('non-authorized fixture character fails closed without a permanent hardcoded list', () => {
  const start = dashboard.indexOf('// PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(region.includes("throw new HttpError(403, rollout.reason)"));
  assert.ok(!region.includes('150098') && !region.includes('150099'));
});

test('producer does not create Player sessions or dispatch Social intents', () => {
  const start = dashboard.indexOf('// PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(!region.includes('sessionAccount('));
  assert.ok(!region.includes('sessionCache.set'));
  assert.ok(!/social|SOCIAL|dispatchSocial|Social Director/.test(region));
});

test('producer contains no direct position or projection mutation', () => {
  const start = dashboard.indexOf('// PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(!/UPDATE [`']?char|INSERT INTO [`']?char|persistent_agent_live_|persistent_life_event/.test(region));
  assert.ok(region.includes('recordRolloutEvent('));
});

test('admin route exposes POST only and preserves per-character in-process lock', () => {
  const start = dashboard.indexOf('async function handleAdminFixtureNavigationRequest');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(region.includes("request.method !== 'POST'"));
  assert.ok(region.includes('adminAgentOperationLocks.has(requestedCharId)'));
  assert.ok(region.includes("adminAgentOperationLocks.set(requestedCharId, 'fixture_navigation')"));
  assert.ok(region.includes('adminAgentOperationLocks.delete(requestedCharId)'));
});

test('accepted and rejected requests reuse the existing rollout audit stream', () => {
  const start = dashboard.indexOf('async function handleAdminFixtureNavigationRequest');
  const end = dashboard.indexOf('async function handleDashboardRequest', start);
  const region = dashboard.slice(start, end);
  assert.ok(region.includes("ADMIN_FIXTURE_NAVIGATION_REJECTED"));
  assert.ok(region.includes('recordRolloutEvent(sql'));
  assert.ok(dashboard.includes("ADMIN_FIXTURE_NAVIGATION_QUEUED"));
});

test('route uses the canonical Admin fixture navigation path', () => {
  assert.ok(dashboard.includes('fixture-navigation'));
  assert.ok(dashboard.includes('runAdminFixtureNavigation('));
  assert.ok(dashboard.includes("eventType: 'ADMIN_FIXTURE_NAVIGATION_QUEUED'"));
});

const failed = tests.filter((entry) => entry.status === 'FAIL');
console.log(JSON.stringify({
  result: failed.length ? 'ADMIN_FIXTURE_NAVIGATION_TEST_FAIL' : 'ADMIN_FIXTURE_NAVIGATION_TEST_PASS',
  total: tests.length,
  failed: failed.length,
  tests,
}, null, 2));
if (failed.length) process.exitCode = 1;
