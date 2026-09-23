import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRelocationProgress, nextRelocationAction, relocationStageNeedsCommand } from './relocation-executor.mjs';
import { existingCommandsForStep } from './relocation-command-surface.mjs';

// Execute the actual Dashboard coordinator with bounded in-memory dependencies.
// No server, database, browser or alternate runtime is started.
const source = readFileSync(new URL('../dashboard.mjs', import.meta.url), 'utf8');
const sameMapSelection = source.slice(
  source.indexOf("if (plan.mode === 'ALREADY_AT_DESTINATION')"),
  source.indexOf('const directStep = plan.steps.find', source.indexOf("if (plan.mode === 'ALREADY_AT_DESTINATION')")),
);
assert.match(sameMapSelection, /controller\.agentMode !== 'PERSISTENT_IDLE'/);
assert.match(sameMapSelection, /action: 'stop_farm'/);
assert.match(sameMapSelection, /stage: 'WAIT_START_FARM'/);
assert.match(source, /if \(pendingRelocations\.has\(charId\) \|\| relocationRequests\.has\(charId\)\)\s+throw new HttpError\(409, 'farm_relocation_in_progress'\)/);
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

const sameMap = fixture();
sameMap.pending.stage = 'WAIT_START_FARM';
sameMap.pending.targetMap = 'prontera';
sameMap.state.agentMode = 'AUTO_FARM';
await sameMap.poll();
assert.equal(sameMap.emitted.length, 0, 'old farm must stop before replacement start');
sameMap.state.agentMode = 'PERSISTENT_IDLE';
sameMap.live.map = 'payon';
await sameMap.poll();
assert.equal(sameMap.emitted.length, 0, 'same-map replacement requires authoritative location');
sameMap.live.map = 'prontera';
await sameMap.poll();
assert.equal(sameMap.emitted.at(-1).action, 'start_farm');
assert.equal(sameMap.emitted.at(-1).payload.targetMap, 'prontera');
assert.equal(sameMap.pending.stage, 'WAIT_FARM');
assert.equal(sameMap.cleared(), 0, 'durable intent remains until authoritative AUTO_FARM');
await sameMap.poll();
assert.equal(sameMap.pendingRelocations.size, 1, 'queueing alone is not farm confirmation');
sameMap.state.agentMode = 'AUTO_FARM';
await sameMap.poll();
assert.equal(sameMap.pendingRelocations.size, 0);
assert.equal(sameMap.cleared(), 1);
console.log('PASS same_map_replacement_waits_for_idle_location_and_farm');

const rejectedStart = fixture();
rejectedStart.pending.stage = 'WAIT_START_FARM';
rejectedStart.pending.targetMap = 'prontera';
await rejectedStart.poll();
rejectedStart.emitted.at(-1).status = 'REJECTED';
rejectedStart.emitted.at(-1).reasonCode = 'ROLLOUT_NOT_ALLOWED';
await rejectedStart.poll();
assert.equal(rejectedStart.pendingRelocations.size, 0);
assert.equal(rejectedStart.cleared(), 1);
console.log('PASS rejected_start_farm_exits_wait_farm');

// Exercise the actual map-selection body with bounded filesystem and command
// seams. An enqueue rejection must restore the previous map choice and clear
// the new recovery marker; successful enqueue must retain the new intent.
const selectionBody = source.slice(
  source.indexOf('async function queueServerAgentRelocationPrepared('),
  source.indexOf('// ---------------------------------------------------------------------------', source.indexOf('async function queueServerAgentRelocationPrepared(')),
);
function selectionFixture(rejectCommand) {
  const path = join('fixture-root', '1', 'grind-target.json');
  const oldTarget = { mapId: 'moc_pryd01', source: 'PLAYER_OVERRIDE' };
  const files = new Map([[path, JSON.stringify(oldTarget)]]);
  const pendingRelocations = new Map();
  const observationConfigCache = new Map();
  let marker = false;
  const dependencies = {
    FARM_MAP_SOURCE: { PLAYER_OVERRIDE: 'PLAYER_OVERRIDE' },
    HttpError: class HttpError extends Error {},
    instancesRoot: 'fixture-root', instanceId: () => '1', join,
    pendingRelocations, observationConfigCache,
    farmMapEligibility: () => ({ map: { name: 'Prontera' }, farmable: true, farmSelectionAvailable: true }),
    readServerAgentReadModel: async () => ({ inventory: [] }),
    readCharacterSavePoint: async () => ({ map: 'prontera' }),
    serverAgentWarpGraph: async () => ({}),
    planFarmMapChange: () => ({ mode: 'ALREADY_AT_DESTINATION', policy: 'DIRECT', reason: 'already_here' }),
    readGrindTarget: async () => oldTarget,
    readFile: async (target) => files.get(target),
    writeJsonAtomic: async (target, value) => { files.set(target, JSON.stringify(value)); },
    writeFile: async (target, value) => { files.set(target, value); },
    rename: async (from, to) => { files.set(to, files.get(from)); files.delete(from); },
    unlink: async (target) => { files.delete(target); },
    randomUUID: () => 'fixture-rollback',
    writePersistedRelocation: async () => { marker = true; },
    clearPersistedRelocation: async () => { marker = false; },
    queueOwnershipCommand: async () => {
      if (rejectCommand) throw new Error('bounded dispatch failure');
      return { commandId: 'fixture-stop', action: 'stop_farm' };
    },
    coordinatorDeadlineMsForRouteSteps: () => 60_000,
    console: { warn() {} },
  };
  const select = new Function(...Object.keys(dependencies),
    `${selectionBody}; return queueServerAgentRelocationPrepared;`)(...Object.values(dependencies));
  return {
    select: () => select({ accountId: 1, characterId: 1 }, {
      liveStatus: { fresh: true, map: 'prontera' }, agentMode: 'AUTO_FARM', revision: 7,
    }, 'prontera'),
    files, path, pendingRelocations, marker: () => marker,
  };
}
const acceptedSelection = selectionFixture(false);
const acceptedResult = await acceptedSelection.select();
assert.equal(acceptedResult.command.action, 'stop_farm');
assert.equal(acceptedSelection.pendingRelocations.get(1)?.stage, 'WAIT_START_FARM');
assert.equal(JSON.parse(acceptedSelection.files.get(acceptedSelection.path)).mapId, 'prontera');
assert.equal(acceptedSelection.marker(), true);
const rejectedSelection = selectionFixture(true);
await assert.rejects(rejectedSelection.select(), /bounded dispatch failure/);
assert.equal(JSON.parse(rejectedSelection.files.get(rejectedSelection.path)).mapId, 'moc_pryd01');
assert.equal(rejectedSelection.marker(), false);
assert.equal(rejectedSelection.pendingRelocations.size, 0);
console.log('PASS map_selection_dispatch_rollback_and_intent_preservation');
