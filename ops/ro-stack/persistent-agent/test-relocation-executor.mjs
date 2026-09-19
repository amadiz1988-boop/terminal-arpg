// CP-R2 execution-harness. Run: node test-relocation-executor.mjs
import assert from 'node:assert/strict';
import { planRelocation, selectFarmTarget, RELOCATION_POLICY, STEP,
  BUTTERFLY_WING_ITEM_ID, FLY_WING_ITEM_ID } from './relocation-policy.mjs';
import { nextRelocationAction, createRelocationProgress, RELOCATION_ACTION,
  RELOCATION_ACTION as ACTION } from './relocation-executor.mjs';

let executed = 0; let failures = 0;
function check(id, fn) {
  executed++;
  try { fn(); console.log(`PASS ${id}`); }
  catch (error) { failures++; console.error(`FAIL ${id}: ${error.message}`); }
}

function buildGraph(edges) {
  const graph = new Map();
  for (const [a, b] of edges) {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b);
    graph.get(b).add(a);
  }
  return graph;
}
const graph = buildGraph([
  ['moc_fild11', 'moc_fild12'], ['moc_fild12', 'morocc'],
  ['payon', 'pay_arche'], ['pay_arche', 'pay_dun00'],
  ['prontera', 'prt_fild00'], ['prt_fild00', 'prt_fild05'],
]);
const selected = { targetMap: 'pay_dun00', mobId: 1076, source: 'selected' };
const canonical = { targetMap: 'prt_fild05', mobId: 1052 };
const directPlan = planRelocation({ currentMap: 'pay_arche', target: selected, graph });
const crossPlan = planRelocation({ currentMap: 'moc_fild11', target: selected, graph,
  inventory: { butterflyWing: true } });

check('case_01_direct_case_has_no_service_chain', () => {
  assert.equal(directPlan.policy, RELOCATION_POLICY.DIRECT);
  assert.ok(!directPlan.steps.some((s) => s.kind === STEP.KAFRA_SAVE ||
    s.kind === STEP.BUTTERFLY_WING || s.kind === STEP.KAFRA_DIALOG_TRANSFER));
  const p = createRelocationProgress();
  const r = nextRelocationAction(directPlan, p, {});
  assert.equal(r.action, RELOCATION_ACTION.CLAIM_AND_NAVIGATE);
});

check('case_02_player_selected_target_preserved', () => {
  assert.equal(crossPlan.targetMap, 'pay_dun00');
  assert.equal(crossPlan.targetSource, 'selected');
});

check('case_03_fallback_only_when_target_missing', () => {
  assert.equal(selectFarmTarget({ selectedGrindTarget: null, canonicalFallback: canonical }).source,
    'canonical_fallback');
  assert.equal(selectFarmTarget({ selectedGrindTarget: selected, canonicalFallback: canonical }).source,
    'selected');
});

check('case_04_moc_fild11_generic_cross_region_plan', () => {
  assert.equal(crossPlan.policy, RELOCATION_POLICY.RETURN_TO_SAVEPOINT_BUTTERFLY);
  assert.ok(crossPlan.steps.some((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER));
});

check('case_05_route_to_hub', () => {
  const hub = crossPlan.steps.find((s) => s.kind === STEP.DIRECT_TO_HUB);
  assert.deepEqual(hub.route, ['moc_fild11', 'moc_fild12', 'morocc']);
});

check('case_06_save_dialogue', () => {
  const idx = crossPlan.steps.findIndex((s) => s.kind === STEP.KAFRA_SAVE);
  const p = createRelocationProgress();
  p.index = idx;
  const r = nextRelocationAction(crossPlan, p, {});
  assert.equal(r.action, RELOCATION_ACTION.KAFRA_SAVE_DIALOGUE);
});

check('case_07_butterfly_602_one_shot', () => {
  const idx = crossPlan.steps.findIndex((s) => s.kind === STEP.BUTTERFLY_WING);
  assert.equal(crossPlan.steps[idx].itemId, 602);
  const p = createRelocationProgress();
  p.index = idx;
  const first = nextRelocationAction(crossPlan, p, {});
  const second = nextRelocationAction(crossPlan, p, {});
  assert.equal(first.action, RELOCATION_ACTION.BUTTERFLY_WING);
  assert.equal(second.action, null); // no duplicate while unconfirmed
  assert.equal(second.waitingForConfirmation, true);
});

check('case_08_savepoint_authoritative_verify', () => {
  const idx = crossPlan.steps.findIndex((s) => s.kind === STEP.VERIFY_SAVEPOINT);
  const p = createRelocationProgress();
  p.index = idx;
  const pending = nextRelocationAction(crossPlan, p, { savePoint: 'payon' });
  assert.equal(pending.action, null);           // not confirmed -> no advance
  assert.equal(p.index, idx);
  const confirmed = nextRelocationAction(crossPlan, p, { savePoint: 'morocc' });
  assert.equal(confirmed.stageIndex, idx + 1);
});

check('case_09_kafra_dialogue_sequence', () => {
  const transfer = crossPlan.steps.find((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER);
  const actions = transfer.dialogue.map((d) => d.action);
  assert.deepEqual(actions, ['TALK_NPC', 'DIALOG_NEXT', 'DIALOG_MENU_SELECT', 'DIALOG_NEXT',
    'DIALOG_MENU_SELECT']);
  assert.ok(!JSON.stringify(transfer).includes('service_transport'));
});

check('case_10_city_destination_from_target_region', () => {
  assert.equal(crossPlan.steps.find((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER).destinationCity,
    'payon');
});

check('case_11_authoritative_service_arrival', () => {
  const idx = crossPlan.steps.findIndex((s) => s.kind === STEP.VERIFY_SERVICE_ARRIVAL);
  const p = createRelocationProgress();
  p.index = idx;
  const pending = nextRelocationAction(crossPlan, p, { currentMap: 'morocc' });
  assert.equal(pending.action, null);
  const confirmed = nextRelocationAction(crossPlan, p, { currentMap: 'payon' });
  assert.equal(confirmed.stageIndex, idx + 1);
});

check('case_12_post_service_walking_route', () => {
  const post = crossPlan.steps.find((s) => s.kind === STEP.DIRECT_TO_TARGET && s.route[0] === 'payon');
  assert.ok(post);
  assert.equal(post.route[post.route.length - 1], 'pay_dun00');
});

check('case_13_final_start_farm_queued_once', () => {
  const idx = crossPlan.steps.length - 1;
  const p = createRelocationProgress();
  p.index = idx;
  const first = nextRelocationAction(crossPlan, p, {});
  const second = nextRelocationAction(crossPlan, p, {});
  assert.equal(first.action, RELOCATION_ACTION.START_FARM);
  assert.equal(second.action, null);
  const done = nextRelocationAction(crossPlan, p, { agentMode: 'AUTO_FARM' });
  assert.equal(done.done, true);
});

check('case_14_duplicate_poll_no_duplicate_actions', () => {
  const p = createRelocationProgress();
  const seen = [];
  // Unconfirmed fly-by: the same unconfirmed stage never emits twice.
  seen.push(nextRelocationAction(crossPlan, p, {}).action);           // DIRECT_TO_HUB
  seen.push(nextRelocationAction(crossPlan, p, {}).action);           // waiting
  assert.deepEqual(seen, [RELOCATION_ACTION.CLAIM_AND_NAVIGATE, null]);
  // Advance through hub and save; each confirmed stage emits exactly one action.
  nextRelocationAction(crossPlan, p, { currentMap: 'morocc' });
  const saveA = nextRelocationAction(crossPlan, p, {}).action;
  const saveB = nextRelocationAction(crossPlan, p, {}).action;
  assert.equal(saveA, RELOCATION_ACTION.KAFRA_SAVE_DIALOGUE);
  assert.equal(saveB, null);
});

check('case_15_failure_reason_exact', () => {
  const invalid = planRelocation({ currentMap: 'moc_fild11', target: { targetMap: 'Bad Map', mobId: 0 },
    graph });
  const p = createRelocationProgress();
  assert.equal(nextRelocationAction(invalid, p, {}).reason, 'farm_target_invalid');
  const byObs = nextRelocationAction(crossPlan, createRelocationProgress(),
    { failure: 'savepoint_verification_failed' });
  assert.equal(byObs.reason, 'savepoint_verification_failed');
  const kafra = nextRelocationAction(crossPlan, createRelocationProgress(),
    { failure: 'kafra_dialog_failed' });
  assert.equal(kafra.reason, 'kafra_dialog_failed');
});

check('case_16_fly_wing_601_untouched', () => {
  assert.equal(FLY_WING_ITEM_ID, 601);
  assert.ok(!crossPlan.steps.some((s) => s.itemId === 601));
});

check('case_17_no_service_transport', () => {
  assert.ok(!JSON.stringify(crossPlan).includes('service_transport'));
  assert.ok(!JSON.stringify(directPlan).includes('service_transport'));
});

check('case_18_no_db_teleport', () => {
  const forbidden = /db_teleport|sql_?move|gm_?warp|teleport_map|setpos/i;
  assert.ok(!forbidden.test(JSON.stringify(crossPlan)));
});

check('case_19_no_openkore', () => {
  assert.ok(!/openkore/i.test(JSON.stringify(crossPlan)));
});

check('case_20_no_autofarm_implementation_change', () => {
  // The executor only ever emits lifecycle/relocation actions; it contains no
  // combat/attack/monster handling and does not reimplement AUTO_FARM.
  const actions = Object.values(ACTION);
  assert.deepEqual(actions, ['claim_and_navigate', 'kafra_save_dialogue', 'close_dialogue',
    'butterfly_wing', 'kafra_transfer_dialogue', 'start_farm', 'wait', 'fail']);
  assert.ok(!JSON.stringify(crossPlan).match(/attack|monster|combat|killMonster/i));
});

if (failures !== 0) {
  console.error(`CP_R2_TESTS ${executed - failures}/${executed}`);
  process.exit(1);
}
console.log(`CP_R2_TESTS ${executed}/${executed}`);
