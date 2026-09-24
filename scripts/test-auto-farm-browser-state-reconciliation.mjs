// Bounded contract regression for the Player Web AUTO_FARM state projection.
// Pure source/contract checks only: no browser, database, command, or runtime.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createControllerStatus,
} from '../ops/ro-stack/persistent-agent/web-canary.mjs';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dashboardSource = await readFile(
  join(root, 'ops', 'ro-stack', 'dashboard.mjs'),
  'utf8',
);
const webCanarySource = await readFile(
  join(root, 'ops', 'ro-stack', 'persistent-agent', 'web-canary.mjs'),
  'utf8',
);
const appSource = await readFile(
  join(root, 'ops', 'ro-stack', 'dashboard', 'app.js'),
  'utf8',
);

const stateRow = {
  agentEnabled: true,
  controlOwner: 'SERVER_AGENT',
  ownershipState: 'SERVER_AGENT',
  agentMode: 'PERSISTENT_IDLE',
  runtimeState: 'ACTIVE',
  revision: 38,
  taskType: null,
  taskPhase: null,
};
const rollout = { allowed: true, reason: null };
const farmTarget = { targetMap: 'mjolnir_07' };

const stopped = createControllerStatus({
  charId: 150094,
  stateRow,
  rollout,
  farmTarget,
  liveStatus: {
    available: true,
    fresh: true,
    reason: null,
    phase: 'PERSISTENT_IDLE',
    resident: true,
  },
  farmRunning: false,
});
assert.equal(stopped.farmRunning, false);
assert.equal(stopped.actions.startFarm, true);
assert.equal(stopped.actions.stopFarm, false);
assert.equal(stopped.actionBlockers.stopFarm, 'nothing_to_stop');

const running = createControllerStatus({
  charId: 150094,
  stateRow: { ...stateRow, agentMode: 'AUTO_FARM', taskType: 'farm', taskPhase: 'combat' },
  rollout,
  farmTarget,
  farmRunning: true,
});
assert.equal(running.farmRunning, true);
assert.equal(running.actions.startFarm, false);
assert.equal(running.actions.stopFarm, true);

// Quarantined, non-resident historical AUTO_FARM intent is never actionable.
const quarantined = createControllerStatus({
  charId: 150094,
  stateRow: { ...stateRow, ownershipState: 'QUARANTINED',
    runtimeState: 'QUARANTINED', agentMode: 'AUTO_FARM' },
  rollout,
  farmTarget,
  liveStatus: { available: true, fresh: false, resident: false,
    reason: 'live_status_not_resident' },
  farmRunning: false,
});
assert.equal(quarantined.actions.startFarm, false);
assert.equal(quarantined.actions.stopFarm, false);
assert.equal(quarantined.actionBlockers.startFarm, 'agent_quarantined');
assert.equal(quarantined.actionBlockers.stopFarm, 'agent_quarantined');

function renderFarmUi(authoritativeRunning) {
  return {
    statusLabel: authoritativeRunning ? '自動戰鬥中' : '已停止',
    startDisabled: authoritativeRunning,
    stopDisabled: !authoritativeRunning,
  };
}

const stoppedUi = renderFarmUi(false);
assert.deepEqual(stoppedUi, {
  statusLabel: '已停止',
  startDisabled: false,
  stopDisabled: true,
});
const runningUi = renderFarmUi(true);
assert.deepEqual(runningUi, {
  statusLabel: '自動戰鬥中',
  startDisabled: true,
  stopDisabled: false,
});

const acceptedStop = { ...runningUi, ...renderFarmUi(false) };
assert.equal(acceptedStop.statusLabel, '已停止');
assert.equal(acceptedStop.startDisabled, false);
assert.equal(acceptedStop.stopDisabled, true);

const rejectedStop = renderFarmUi(true);
assert.equal(rejectedStop.statusLabel, '自動戰鬥中');
assert.equal(rejectedStop.startDisabled, true);
assert.equal(rejectedStop.stopDisabled, false);

const staleLocalState = true;
const freshAuthoritativeState = false;
assert.notEqual(staleLocalState, freshAuthoritativeState);
assert.deepEqual(renderFarmUi(freshAuthoritativeState), stoppedUi);
assert.notEqual(stoppedUi.statusLabel, runningUi.statusLabel);

assert.match(dashboardSource, /readNativeFarmStats\(charId\)/);
assert.match(
  dashboardSource,
  /farmRunning: nativeFarm\.available \? nativeFarm\.active === true : null/,
);
assert.match(webCanarySource, /farmRunning === null/);
assert.match(webCanarySource, /farmRunning === true/);
assert.match(appSource, /if \(status\.farmRunning === false\) return '狀態：已停止';/);
assert.match(appSource, /state\.running\s*\?\s*'掛機中'\s*:\s*'已停止'/s);
assert.match(appSource, /status\.actions\?\.startFarm !== true/);
assert.match(appSource, /status\.actions\?\.stopFarm !== true/);
assert.equal(stoppedUi.statusLabel === '已停止' && runningUi.statusLabel === '自動戰鬥中', true);

console.log('AUTO_FARM_BROWSER_STATE_RECONCILIATION_PASS');
