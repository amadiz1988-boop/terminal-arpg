import assert from 'node:assert/strict';
import { inspectWorldTeleportContractDelta } from '../native-world-teleport-policy-contract.mjs';

const old = {
  contractKind: 'persistent_agent_command_contract',
  contractVersion: 1,
  commands: [
    { action: 'world_map_teleport', strictUnknownFields: true,
      payload: { required: { targetMap: 'string', kind: 'string',
        anchorX: 'integer', anchorY: 'integer' }, optional: {} } },
    { action: 'set_saved_town', payload: { required: { targetMap: 'string' }, optional: {} } },
  ],
};
const next = structuredClone(old);
next.commands[0].payload.optional.supplyPolicy = 'object';
assert.deepEqual(inspectWorldTeleportContractDelta(old, next), {
  action: 'world_map_teleport', addedOptionalField: 'supplyPolicy',
  fieldType: 'object', unrelatedChanges: 0, removedActions: 0,
});
assert.throws(() => inspectWorldTeleportContractDelta(old, old),
  /UNRELATED_CONTRACT_DELTA/);
const wrongType = structuredClone(next);
wrongType.commands[0].payload.optional.supplyPolicy = 'string';
assert.throws(() => inspectWorldTeleportContractDelta(old, wrongType),
  /UNRELATED_CONTRACT_DELTA/);
const widened = structuredClone(next);
widened.commands[0].payload.optional.adminTeleport = 'boolean';
assert.throws(() => inspectWorldTeleportContractDelta(old, widened),
  /UNRELATED_CONTRACT_DELTA/);
const removed = structuredClone(next);
removed.commands.pop();
assert.throws(() => inspectWorldTeleportContractDelta(old, removed),
  /CONTRACT_ROOT_OR_ACTION_COUNT_CHANGED/);
console.log('NATIVE_WORLD_TELEPORT_POLICY_CONTRACT_PASS cases=5');
