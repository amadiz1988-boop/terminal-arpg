import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sequencePath = path.join(root, 'ops/ro-stack/persistent-agent/quest-sequences/novice-onboarding.json');
const allowlistPath = path.join(root, 'ops/ro-stack/persistent-agent/quest-content/novice-onboarding.allowlists.json');
const routesPath = path.join(root, 'ops/ro-stack/persistent-agent/quest-content/novice-onboarding.routes.json');
const transfersPath = path.join(root, 'ops/ro-stack/persistent-agent/quest-content/novice-onboarding.transfers.json');
const nativePath = 'C:/Users/Administrator/source/ghost-island-rathena/src/map/persistent_agent.cpp';

const sequence = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const transfers = JSON.parse(fs.readFileSync(transfersPath, 'utf8'));
const native = fs.readFileSync(nativePath, 'utf8');
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push([name, true]);
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push([name, false]);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const env = allowlist.env;
const questSteps = new Set(['ACCEPT_QUEST', 'WAIT_QUEST_STATE', 'COMPLETE_QUEST', 'CONFIRM_REWARD']);
const navigationSteps = new Set(['GO_NPC', 'GO_MAP', 'RETURN_NPC']);
const routeById = new Map(routes.legs.map((leg) => [leg.id, leg]));

check('sequence_identity_ready', () => {
  assert.equal(sequence.schema, 'ro-quest-sequence/v1');
  assert.equal(sequence.sequenceId, 'novice_onboarding');
  assert.equal(sequence.taskId, 7100001);
  assert.equal(sequence.enabled, true);
  assert.equal(sequence.engineStatus, 'READY');
  assert.ok(sequence.steps.length > 0 && sequence.steps.length <= 128);
});

check('allowlist_identity_closed', () => {
  assert.deepEqual(env.PERSISTENT_AGENT_QUEST_TASKS, [7100001]);
  assert.ok(env.PERSISTENT_AGENT_QUEST_SEQUENCES.includes('novice_onboarding'));
  assert.equal(env.PERSISTENT_AGENT_FARM_MOBS.length, 0);
  for (const questId of [21001, 7471, 21008, 7472, 7473, 4269, 2293])
    assert.ok(env.PERSISTENT_AGENT_QUEST_IDS.includes(questId), `quest ${questId}`);
});

check('navigation_routes_have_native_contract', () => {
  for (const [index, step] of sequence.steps.entries()) {
    if (!navigationSteps.has(step.type)) continue;
    assert.ok(Array.isArray(step.route) && step.route.length > 0 && step.route.length <= 16, `step ${index}`);
    assert.ok(step.retryPolicy && step.retryPolicy.maxRetries >= 0, `retry ${index}`);
    assert.ok(step.retryPolicy.timeoutMs >= 1000, `timeout ${index}`);
    assert.equal(step.route.at(-1).portalTo ?? step.route.at(-1).map, step.map, `destination ${index}`);
    if (step.type === 'GO_MAP') {
      assert.equal(step.route.at(-1).map, step.map, `map ${index}`);
      assert.equal(step.route.at(-1).x, step.x, `x ${index}`);
      assert.equal(step.route.at(-1).y, step.y, `y ${index}`);
    }
  }
});

check('npc_and_map_allowlists_cover_payload', () => {
  for (const step of sequence.steps) {
    if (step.npcName) assert.ok(env.PERSISTENT_AGENT_NPCS.includes(step.npcName), step.npcName);
    if (step.map && step.type !== 'FARM_UNTIL')
      assert.ok([...env.PERSISTENT_AGENT_NPC_MAPS, ...env.PERSISTENT_AGENT_NAVIGATION_MAPS].includes(step.map), step.map);
    if (step.type === 'FARM_UNTIL') assert.ok(env.PERSISTENT_AGENT_FARM_MAPS.includes(step.map), step.map);
    if (step.questId) assert.ok(env.PERSISTENT_AGENT_QUEST_IDS.includes(step.questId), String(step.questId));
  }
});

check('expected_map_change_transfers_are_declared', () => {
  const expected = sequence.steps.filter((step) => step.expectedDestinationMap);
  assert.equal(expected.length, 4);
  assert.deepEqual(expected.map((step) => step.expectedDestinationMap), ['int_land', 'izlude', 'new_1-3', 'prt_fild08']);
  assert.equal(transfers.resolvedAdapter.name, 'EXPECTED_MAP_CHANGE_COMPLETION');
  assert.equal(transfers.summary.expectedMapChangeAdapterMissing, 0);
});

check('route_manifest_has_no_unresolved_required_leg', () => {
  for (const leg of routes.legs) {
    assert.equal(leg.classification, 'ROUTE_COMPILED', leg.id);
    assert.ok(Array.isArray(leg.route) && leg.route.length > 0, leg.id);
  }
  assert.equal(routeById.get('ship_exit').expectedDestinationMap, 'int_land');
  assert.equal(routeById.get('sail_izlude').expectedDestinationMap, 'izlude');
  assert.equal(routeById.get('academy_training_route').expectedDestinationMap, 'new_1-3');
});

check('farm_until_reuses_existing_auto_farm', () => {
  const farmSteps = sequence.steps.filter((step) => step.type === 'FARM_UNTIL');
  assert.equal(farmSteps.length, 1);
  assert.deepEqual(farmSteps[0].condition, { read: 'job_level', op: 'gte', value: 10 });
  assert.equal(sequence.integration.farm, 'existing_auto_farm');
  assert.match(native, /QuestSequenceStepType::FARM_UNTIL/);
  assert.match(native, /activate_farm_runtime\(runtime, farm\.dump\(\), false\)/);
  assert.match(native, /advance_quest_sequence\(runtime\)/);
});

check('dialog_checkpoints_are_resume_safe', () => {
  sequence.steps.forEach((step, index) => {
    if (step.type !== 'DIALOG_MENU_SELECT') return;
    const checkpoint = sequence.steps.slice(index + 1).find((candidate) => candidate.type !== 'DIALOG_NEXT');
    assert.ok(checkpoint && questSteps.has(checkpoint.type), `menu checkpoint ${index}`);
  });
  assert.match(native, /persistent_agent_state_load_quest_checkpoint/);
  assert.match(native, /quest_checkpoint_equal/);
  assert.match(native, /QuestSequenceStatus::COMPLETE/);
});

const failed = checks.filter(([, ok]) => !ok).length;
console.log(`novice-onboarding integration: ${checks.length - failed}/${checks.length} passed`);
if (failed > 0) process.exitCode = 1;
