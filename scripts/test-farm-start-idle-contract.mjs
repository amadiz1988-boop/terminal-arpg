import assert from 'node:assert/strict';
import { createControllerStatus, expectedTransition, W1_ACTION } from '../ops/ro-stack/persistent-agent/web-canary.mjs';

const status = (agentMode, farmRunning, overrides = {}) => createControllerStatus({
  charId: 150094,
  stateRow: {
    controlOwner: 'SERVER_AGENT',
    ownershipState: 'SERVER_AGENT',
    runtimeState: 'ACTIVE',
    agentEnabled: true,
    revision: 42,
    agentMode,
  },
  rollout: { allowed: true },
  farmTarget: { targetMap: 'moc_pryd01' },
  liveStatus: { available: true, resident: true },
  farmRunning,
  ...overrides,
});

assert.equal(status('PERSISTENT_IDLE', false).actions.startFarm, true);
assert.equal(status('PERSISTENT_IDLE', null).actions.startFarm, true);
assert.equal(status('PERSISTENT_IDLE', true).actions.startFarm, false);
assert.equal(status('AUTO_FARM', true).actions.stopFarm, true);
assert.deepEqual(expectedTransition(W1_ACTION.START_FARM), {
  ownershipState: 'SERVER_AGENT', agentMode: 'AUTO_FARM',
});
assert.deepEqual(expectedTransition(W1_ACTION.STOP_FARM), {
  ownershipState: 'SERVER_AGENT', agentMode: 'PERSISTENT_IDLE',
});
for (const mode of ['AUTO_FARM', 'NAVIGATING', 'NPC_INTERACTION', 'SERVICE_INTERACTION', 'AUTO_QUEST', 'ROUTE_FAILED']) {
  for (const running of [false, null, true]) {
    const view = status(mode, running);
    assert.equal(view.actions.startFarm, false, `${mode} farmRunning=${running}`);
    assert.equal(view.actionBlockers.startFarm, 'task_already_active', `${mode} farmRunning=${running}`);
  }
}
assert.equal(status('PERSISTENT_IDLE', false, { farmTarget: null }).actionBlockers.startFarm, 'farm_target_unresolved');
assert.equal(status('PERSISTENT_IDLE', false, { liveStatus: { available: true, resident: false } }).actionBlockers.startFarm, 'not_resident');
assert.equal(status('PERSISTENT_IDLE', false, { rollout: { allowed: false } }).actionBlockers.startFarm, 'rollout_not_allowlisted');

console.log('FARM_START_IDLE_CONTRACT_PASS checks=45');
