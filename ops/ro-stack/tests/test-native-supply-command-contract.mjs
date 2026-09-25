import assert from 'node:assert/strict';
import { CONTRACT, inspectSupplyCommandDelta } from '../native-supply-command-contract.mjs';

const before = { contractKind: 'persistent_agent_command_contract', contractVersion: 1,
  commands: Array.from({ length: 47 }, (_, i) => ({ action: `existing_${i}` })) };
const after = structuredClone(before);
after.commands.push(
  { action: 'configure_supply_policy', category: 'supply', dispatcher: 'process_configure_supply_policy',
    enqueueAdmitted: true, payload: { required: { supplyPolicy: 'object' } } },
  { action: 'prepare_farm_switch', category: 'supply', dispatcher: 'process_prepare_farm_switch',
    enqueueAdmitted: true, payload: { required: { shopServiceRoute: { type: 'array' } } } },
  { action: 'resume_paid_farm_switch', category: 'supply', dispatcher: 'process_resume_paid_farm_switch',
    enqueueAdmitted: true, payload: { required: { targetMap: 'string' } } },
);
assert.deepEqual(inspectSupplyCommandDelta(before, after), {
  addedActions: [...CONTRACT.added], existingActionsChanged: 0, removedActions: 0,
});
assert.equal(CONTRACT.added.length, 3);
assert.throws(() => inspectSupplyCommandDelta(before, { ...after, commands: after.commands.slice(1) }),
  /CONTRACT_ROOT_OR_ACTION_COUNT_CHANGED/);
const changedOld = structuredClone(after);
changedOld.commands[0].unapproved = true;
assert.throws(() => inspectSupplyCommandDelta(before, changedOld), /UNRELATED_CONTRACT_DELTA/);
const notAdmitted = structuredClone(after);
notAdmitted.commands.find(row => row.action === 'configure_supply_policy').enqueueAdmitted = false;
assert.throws(() => inspectSupplyCommandDelta(before, notAdmitted), /SUPPLY_COMMAND_NOT_ADMITTED/);
const wrongShape = structuredClone(after);
wrongShape.commands.find(row => row.action === 'resume_paid_farm_switch').payload.required.targetMap = 'integer';
assert.throws(() => inspectSupplyCommandDelta(before, wrongShape), /SUPPLY_COMMAND_SHAPE_CHANGED/);
console.log('NATIVE_SUPPLY_COMMAND_CONTRACT_TESTS=6 PASS');
