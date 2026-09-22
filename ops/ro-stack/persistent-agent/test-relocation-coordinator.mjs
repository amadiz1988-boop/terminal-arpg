import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRelocationProgress, nextRelocationAction, relocationStageNeedsCommand } from './relocation-executor.mjs';
import { existingCommandsForStep } from './relocation-command-surface.mjs';

// Execute the actual Dashboard coordinator with bounded in-memory dependencies.
// No server, database, browser or alternate runtime is started.
const source = readFileSync(new URL('../dashboard.mjs', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('async function reconcileRelocations()'),
  source.indexOf('// W4 server-side adapter:', source.indexOf('async function reconcileRelocations()')));
function fixture() {
  const state = { revision: 1, agentMode: 'PERSISTENT_IDLE', controlOwner: 'SERVER_AGENT' };
  const live = { fresh: true, map: 'prontera' };
  const ledger = new Map();
  const emitted = [];
  const pending = { deadline: Date.now() + 60_000, stage: 'RELOCATION',
    relocationProgress: createRelocationProgress(), commandIndexByStage: {},
    relocationPlan: { policy: 'MULTIMODAL', steps: [
      { kind: 'KAFRA_DIALOG_TRANSFER', npcMap: 'prontera' },
      { kind: 'VERIFY_SERVICE_ARRIVAL', expectedMap: 'payon' },
      { kind: 'DIRECT_TO_TARGET', route: [{ map: 'payon' }, { map: 'pay_dun00' }] },
      { kind: 'START_FARM', targetMap: 'pay_dun00' },
    ] }, kafraContext: { npcName: 'fixture', transportMenuIndex: 1, cityMenuIndex: 2 } };
  const pendingRelocations = new Map([[1, pending]]);
  let cleared = 0;
  let failQueue = false;
  const dependencies = {
    pendingRelocations, relocationAccount: () => ({ accountId: 1, characterId: 1 }),
    clearPersistedRelocation: async () => { cleared++; },
    readAgentStateRow: async () => state, readPersistentAgentLiveStatusView: async () => live,
    readCharacterSavePoint: async () => ({ map: 'prontera' }),
    readServerAgentDialog: async () => ({ active: false }), SERVER_AGENT_OWNER: 'SERVER_AGENT',
    getOwnershipCommand: async (_account, _char, id) => ledger.get(id),
    queueOwnershipCommand: async (_account, _char, command, payload) => {
      if (failQueue) throw new Error('bounded dispatch failure');
      const record = { ...command, payload, commandId: `fixture-${emitted.length}`, status: 'QUEUED' };
      emitted.push(record); ledger.set(record.commandId, record); return record;
    }, nextRelocationAction, relocationStageNeedsCommand, existingCommandsForStep,
    console: { warn() {} },
  };
  const poll = new Function(...Object.keys(dependencies), `${body}; return reconcileRelocations;`)(...Object.values(dependencies));
  return { poll, pending, state, live, emitted, pendingRelocations,
    cleared: () => cleared, failQueue: () => { failQueue = true; },
    ack: () => { emitted.at(-1).status = 'CONFIRMED'; state.revision++; } };
}

const f = fixture();
const expected = ['talk_to_npc', 'dialog_next', 'dialog_select', 'dialog_next', 'dialog_select', 'dialog_close'];
for (let cursor = 0; cursor < expected.length; cursor++) {
  await f.poll();
  assert.equal(f.emitted.length, cursor + 1);
  assert.equal(f.emitted.at(-1).action, expected[cursor]);
  assert.equal(f.pending.commandIndexByStage[0], cursor + 1);
  f.state.revision++; // unrelated state change is not a command ACK
  await f.poll(); await f.poll();
  assert.equal(f.emitted.length, cursor + 1);
  assert.equal(f.pending.relocationProgress.index, 0);
  f.ack();
}
await f.poll();
assert.equal(f.pending.relocationProgress.index, 0); // sequence ACK != arrival
f.live.map = 'payon';
await f.poll();
assert.equal(f.pending.relocationProgress.index, 1);
await f.poll(); // verification-only stage must not fail for empty command list
assert.equal(f.pending.relocationProgress.index, 2);
await f.poll();
assert.equal(f.emitted.at(-1).action, 'start_navigation');
f.ack(); f.live.map = 'pay_dun00';
f.state.agentMode = 'NAVIGATING';
await f.poll();
assert.equal(f.pending.relocationProgress.index, 2); // arrival alone cannot skip native closure
f.state.agentMode = 'PERSISTENT_IDLE';
await f.poll(); await f.poll();
assert.equal(f.emitted.at(-1).action, 'start_farm');
f.ack(); f.state.agentMode = 'AUTO_FARM';
await f.poll(); await f.poll();
assert.equal(f.pendingRelocations.size, 0);
assert.equal(f.cleared(), 1);
assert.deepEqual(f.emitted.map(c => c.action), [...expected, 'start_navigation', 'start_farm']);
console.log('PASS KAFRA_MULTI_COMMAND_CURSOR KAFRA_AUTHORITATIVE_ARRIVAL MULTIMODAL_STAGE_SEQUENCE');

const rejected = fixture();
await rejected.poll(); rejected.emitted[0].status = 'REJECTED';
await rejected.poll();
assert.equal(rejected.pendingRelocations.size, 0);
assert.equal(rejected.emitted.length, 1);
const retry = fixture(); retry.failQueue();
for (let i = 0; i < 9; i++) await retry.poll();
assert.equal(retry.pending.attempts, 7);
assert.equal(retry.pendingRelocations.size, 0);
assert.equal(retry.cleared(), 1);
console.log('PASS rejection_and_bounded_retry');
