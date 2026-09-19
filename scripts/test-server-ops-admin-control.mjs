import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CHARACTER_HEALTH_RANK,
  characterHealthRank,
  compareCharacterHealth,
} from '../ops/ro-stack/dashboard/admin/server-ops-sort.mjs';
import {
  AGENT_PHASE,
  FARM_DECISION,
  decideActivation,
  decideFarmStart,
  isServerAgentResident,
} from '../ops/ro-stack/admin-agent-control.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const serverOpsJs = await readFile(
  join(here, '..', 'ops', 'ro-stack', 'dashboard', 'admin', 'server-ops.js'),
  'utf8',
);
const dashboardMjs = await readFile(
  join(here, '..', 'ops', 'ro-stack', 'dashboard.mjs'),
  'utf8',
);

const tests = [];
async function test(name, callback) {
  try {
    await callback();
    tests.push({ name, status: 'PASS' });
  } catch (error) {
    tests.push({ name, status: 'FAIL', error: error.stack ?? String(error) });
  }
}

function sortByHealth(list, direction) {
  return [...list].sort((a, b) => compareCharacterHealth(a, b, direction));
}

const HEALTHY = { health: 'HEALTHY', charId: 3, name: 'c' };
const HEALTHY_2 = { health: 'HEALTHY', charId: 1, name: 'a' };
const DEGRADED = { health: 'DEGRADED', charId: 2, name: 'b' };
const DOWN = { health: 'DOWN', charId: 4, name: 'd' };
const OFFLINE = { health: 'OFFLINE', charId: 5, name: 'e' };
const UNKNOWN = { health: 'UNKNOWN', charId: 6, name: 'f' };

/* ---- HEALTH SORT ---- */

await test('character health rank is explicit and monotonic', () => {
  assert.equal(CHARACTER_HEALTH_RANK.HEALTHY, 0);
  assert.ok(CHARACTER_HEALTH_RANK.HEALTHY < CHARACTER_HEALTH_RANK.DEGRADED);
  assert.ok(CHARACTER_HEALTH_RANK.DEGRADED < CHARACTER_HEALTH_RANK.DOWN);
  assert.ok(CHARACTER_HEALTH_RANK.DOWN < CHARACTER_HEALTH_RANK.OFFLINE);
  assert.ok(CHARACTER_HEALTH_RANK.OFFLINE < CHARACTER_HEALTH_RANK.UNKNOWN);
  assert.equal(characterHealthRank('bogus'), CHARACTER_HEALTH_RANK.UNKNOWN);
});

await test('unknown/shuffled input sorts every HEALTHY row into one contiguous block', () => {
  const rows = [OFFLINE, HEALTHY, DEGRADED, HEALTHY_2, DOWN, UNKNOWN];
  const asc = sortByHealth(rows, 1);
  const keys = asc.map((row) => row.health);
  assert.deepEqual(keys, ['HEALTHY', 'HEALTHY', 'DEGRADED', 'DOWN', 'OFFLINE', 'UNKNOWN']);
  const healthyIndices = asc
    .map((row, index) => (row.health === 'HEALTHY' ? index : -1))
    .filter((index) => index >= 0);
  assert.deepEqual(healthyIndices, [0, 1]);
});

await test('reverse sort is the exact reverse rank order', () => {
  const rows = [OFFLINE, HEALTHY, DEGRADED, HEALTHY_2, DOWN, UNKNOWN];
  const desc = sortByHealth(rows, -1);
  assert.deepEqual(
    desc.map((row) => row.health),
    ['UNKNOWN', 'OFFLINE', 'DOWN', 'DEGRADED', 'HEALTHY', 'HEALTHY'],
  );
});

await test('same-health rows use char_id as a stable secondary sort', () => {
  const asc = sortByHealth([HEALTHY, HEALTHY_2], 1);
  assert.deepEqual(asc.map((row) => row.charId), [1, 3]);
  const desc = sortByHealth([HEALTHY, HEALTHY_2], -1);
  // Secondary key stays ascending even when the primary direction reverses.
  assert.deepEqual(desc.map((row) => row.charId), [1, 3]);
});

await test('offline and unknown rank after every other state', () => {
  const asc = sortByHealth([UNKNOWN, OFFLINE, DOWN, DEGRADED, HEALTHY], 1);
  assert.deepEqual(
    asc.map((row) => row.health),
    ['HEALTHY', 'DEGRADED', 'DOWN', 'OFFLINE', 'UNKNOWN'],
  );
});

await test('characters table ranks the rendered health key, not charSeverity', () => {
  assert.ok(serverOpsJs.includes("import { characterHealthRank, compareCharacterHealth }"));
  assert.ok(serverOpsJs.includes("if (k === 'health') return characterHealthRank(charHealthKey(c))"));
  assert.ok(serverOpsJs.includes('compareCharacterHealth(characterHealthRow(a), characterHealthRow(b), 1)'));
  assert.ok(!serverOpsJs.includes('function charSeverity('));
  assert.ok(!serverOpsJs.includes('charSeverity(c)'));
});

/* ---- ADMIN AUTONOMY ---- */

const residentRow = { controlOwner: 'SERVER_AGENT', ownershipState: 'SERVER_AGENT', agentEnabled: true };
const openKoreRow = { controlOwner: 'OPENKORE', ownershipState: 'OPENKORE', agentEnabled: false };

await test('online/live resident goes direct with no claim command', () => {
  assert.equal(isServerAgentResident(residentRow, { resident: true }), true);
  const decision = decideActivation({
    stateRow: residentRow,
    live: { resident: true },
    characterOnline: false,
  });
  assert.equal(decision.phase, AGENT_PHASE.RESIDENT);
  assert.equal(decision.blocker, null);
});

await test('offline non-resident queues the existing claim activation', () => {
  const decision = decideActivation({
    stateRow: openKoreRow,
    live: { resident: false },
    characterOnline: false,
  });
  assert.equal(decision.phase, AGENT_PHASE.CLAIM);
});

await test('activation fails closed when the character is online in-game', () => {
  const decision = decideActivation({
    stateRow: openKoreRow,
    live: { resident: false },
    characterOnline: true,
  });
  assert.equal(decision.phase, AGENT_PHASE.BLOCKED);
  assert.equal(decision.blocker, 'character_online');
});

await test('quarantined character is an explicit blocker', () => {
  const decision = decideActivation({
    stateRow: { controlOwner: 'SERVER_AGENT', ownershipState: 'QUARANTINED', agentEnabled: true },
    live: { resident: false },
  });
  assert.equal(decision.phase, AGENT_PHASE.BLOCKED);
  assert.equal(decision.blocker, 'agent_quarantined');
});

await test('in-flight claim waits instead of re-dispatching', () => {
  const decision = decideActivation({
    stateRow: { controlOwner: 'OPENKORE', ownershipState: 'CLAIMING_AGENT', agentEnabled: false },
    live: { resident: false },
  });
  assert.equal(decision.phase, AGENT_PHASE.WAIT);
});

await test('failed activation never starts farm', () => {
  const decision = decideFarmStart({
    resident: false,
    startFarmAllowed: false,
    startFarmBlocker: 'resident_not_confirmed',
    farmTarget: { targetMap: 'prt_fild08', mobId: 1002 },
  });
  assert.equal(decision.decision, FARM_DECISION.BLOCKED);
  assert.equal(decision.blocker, 'not_resident');
});

/* ---- ADMIN FARM ---- */

await test('resident character with a valid target starts farm', () => {
  const decision = decideFarmStart({
    resident: true,
    startFarmAllowed: true,
    startFarmBlocker: null,
    farmTarget: { targetMap: 'prt_fild08', mobId: 1002 },
  });
  assert.equal(decision.decision, FARM_DECISION.START);
});

await test('missing farm target is an explicit blocker, never a fallback', () => {
  const decision = decideFarmStart({
    resident: true,
    startFarmAllowed: false,
    startFarmBlocker: 'farm_target_unresolved',
    farmTarget: null,
  });
  assert.equal(decision.decision, FARM_DECISION.BLOCKED);
  assert.equal(decision.blocker, 'farm_target_unresolved');
});

await test('already farming is reported without re-dispatching', () => {
  const decision = decideFarmStart({
    resident: true,
    startFarmAllowed: false,
    startFarmBlocker: 'task_already_active',
    farmTarget: { targetMap: 'prt_fild08', mobId: 1002 },
  });
  assert.equal(decision.decision, FARM_DECISION.ALREADY_FARMING);
});

/* ---- ADMIN GLUE WIRING / GUARDRAILS ---- */

await test('admin routes reuse the existing activation + automation surfaces', () => {
  assert.ok(dashboardMjs.includes('\\/agent\\/(autonomy|farm)$'));
  assert.ok(dashboardMjs.includes('bootstrapServerAgentOwnership(account, identity.charId)'));
  assert.ok(dashboardMjs.includes('queueCanaryAutomation(activation.account, controller'));
});

await test('admin glue disables double dispatch with a per-character lock', () => {
  assert.ok(dashboardMjs.includes('adminAgentOperationLocks'));
  assert.ok(dashboardMjs.includes("'operation_in_progress'"));
  assert.ok(serverOpsJs.includes("'activating'") && serverOpsJs.includes("'starting'"));
  assert.ok(serverOpsJs.includes("status: 'confirmed'") && serverOpsJs.includes("status: 'failed'"));
});

await test('UI exposes both admin actions and disables them while running', () => {
  assert.ok(serverOpsJs.includes('data-agent-autonomy'));
  assert.ok(serverOpsJs.includes('data-agent-farm'));
  assert.ok(serverOpsJs.includes('啟動角色自主'));
  assert.ok(serverOpsJs.includes('啟動掛機'));
  assert.ok(serverOpsJs.includes('agentBusy ? \' disabled\' : \'\''));
});

await test('admin control creates no player web session and no OpenKore worker', () => {
  const start = dashboardMjs.indexOf('// --- ADMIN character agent controls');
  const end = dashboardMjs.indexOf('// C3-OPS-CONTROL-PLANE: the ONLY lifecycle control path.');
  assert.ok(start > 0 && end > start, 'admin agent helper region not found');
  const region = dashboardMjs.slice(start, end);
  assert.ok(!/sessionCache\.set|createSession|sessionAccount\(/.test(region));
  assert.ok(!/openkore-instance|startWorker\(|spawnOpenKore/i.test(region));
  assert.ok(region.includes('allowFarmTargetFallback: false'));
});

const failed = tests.filter((entry) => entry.status === 'FAIL');
console.log(
  JSON.stringify(
    {
      result: failed.length ? 'SERVER_OPS_ADMIN_TEST_FAIL' : 'SERVER_OPS_ADMIN_TEST_PASS',
      total: tests.length,
      failed: failed.length,
      tests,
    },
    null,
    2,
  ),
);
if (failed.length) process.exitCode = 1;
