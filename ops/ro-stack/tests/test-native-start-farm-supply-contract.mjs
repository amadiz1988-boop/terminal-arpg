import assert from 'node:assert/strict';
import { inspectStartFarmSupplyDelta } from '../native-start-farm-supply-contract.mjs';

const before = { contractKind: 'persistent_agent_command_contract', contractVersion: 1,
  commands: [
    { action: 'start_farm', strictUnknownFields: true,
      payload: { required: { targetMap: 'string' }, optional: { lootEnabled: 'boolean' } } },
    { action: 'world_map_teleport', strictUnknownFields: true,
      payload: { required: { targetMap: 'string' }, optional: { supplyPolicy: 'object' } } },
  ] };
const after = structuredClone(before);
after.commands[0].payload.optional.supplyPolicy = 'object';
assert.deepEqual(inspectStartFarmSupplyDelta(before, after), {
  action: 'start_farm', addedOptionalField: 'supplyPolicy',
  fieldType: 'object', unrelatedChanges: 0, removedActions: 0,
});
assert.throws(() => inspectStartFarmSupplyDelta(before, before), /UNRELATED_CONTRACT_DELTA/);
const wrongType = structuredClone(after);
wrongType.commands[0].payload.optional.supplyPolicy = 'string';
assert.throws(() => inspectStartFarmSupplyDelta(before, wrongType), /UNRELATED_CONTRACT_DELTA/);
const widened = structuredClone(after);
widened.commands[0].payload.optional.adminTeleport = 'boolean';
assert.throws(() => inspectStartFarmSupplyDelta(before, widened), /UNRELATED_CONTRACT_DELTA/);
const otherAction = structuredClone(after);
otherAction.commands[1].payload.optional.adminTeleport = 'boolean';
assert.throws(() => inspectStartFarmSupplyDelta(before, otherAction), /UNRELATED_CONTRACT_DELTA/);
const removed = structuredClone(after);
removed.commands.pop();
assert.throws(() => inspectStartFarmSupplyDelta(before, removed), /CONTRACT_ROOT_OR_ACTION_COUNT_CHANGED/);
console.log('NATIVE_START_FARM_SUPPLY_CONTRACT_PASS cases=6');
