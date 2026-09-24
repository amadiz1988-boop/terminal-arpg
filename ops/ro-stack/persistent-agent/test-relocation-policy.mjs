// CP-R1 pure planner harness. Run: node test-relocation-policy.mjs
//
// Synthetic walking graph mirrors the last-good topology constraint: Morocc
// region is walking-connected internally but NOT walking-connected to the
// Payon/Prontera region (only Kafra crosses that gap). Map names here are test
// fixtures only; relocation-policy.mjs contains no map hardcode.
import assert from 'node:assert/strict';
import {
  planRelocation, selectFarmTarget, walkingRoute, relocationStateSequence,
  RELOCATION_POLICY, RELOCATION_STATE, RELOCATION_REASON, STEP,
  BUTTERFLY_WING_ITEM_ID, FLY_WING_ITEM_ID,
} from './relocation-policy.mjs';

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

const selected = { targetMap: 'pay_dun00', mobId: 1076 };
const canonical = { targetMap: 'prt_fild05', mobId: 1052 };

check('case_01_selected_target_overrides_fallback', () => {
  const resolved = selectFarmTarget({ persistedTaskTarget: null, selectedGrindTarget: selected,
    canonicalFallback: canonical });
  assert.equal(resolved.source, 'selected');
  assert.equal(resolved.targetMap, 'pay_dun00');
});

check('case_02_fallback_only_when_no_valid_selected', () => {
  const resolved = selectFarmTarget({ persistedTaskTarget: null,
    selectedGrindTarget: { targetMap: 'Bad Map!', mobId: 0 }, canonicalFallback: canonical });
  assert.equal(resolved.source, 'canonical_fallback');
  assert.equal(resolved.targetMap, 'prt_fild05');
  assert.equal(selectFarmTarget({}).reason, RELOCATION_REASON.FARM_TARGET_INVALID);
});

check('case_03_already_direct_reachable_is_direct', () => {
  const plan = planRelocation({ currentMap: 'pay_arche', target: { ...selected, source: 'selected' },
    graph });
  assert.equal(plan.policy, RELOCATION_POLICY.DIRECT);
  assert.deepEqual(plan.steps.map((s) => s.kind), [STEP.DIRECT_TO_TARGET, STEP.START_FARM]);
  assert.deepEqual(plan.steps[0].route, ['pay_arche', 'pay_dun00']);
});

check('case_04_cross_region_uses_hub_scoring', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: false } });
  assert.equal(plan.hubId, 'morocc'); // nearestSupplyHubForMap scoring
  assert.notEqual(plan.policy, RELOCATION_POLICY.UNREACHABLE);
});

check('case_05_moc_fild11_generic_policy_no_hardcode', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  assert.notEqual(plan.policy, RELOCATION_POLICY.UNREACHABLE);
  assert.equal(plan.hubId, 'morocc');
  assert.ok(plan.steps.some((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER));
});

check('case_06_savepoint_emits_kafra_save_dialogue', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { [String(BUTTERFLY_WING_ITEM_ID)]: 1 } });
  const save = plan.steps.find((s) => s.kind === STEP.KAFRA_SAVE);
  assert.ok(save);
  assert.equal(save.npcMap, 'morocc');
  assert.equal(save.saveMap, 'morocc');
});

check('case_07_butterfly_plan_uses_item_602', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { [String(BUTTERFLY_WING_ITEM_ID)]: 1 } });
  const butterfly = plan.steps.find((s) => s.kind === STEP.BUTTERFLY_WING);
  assert.ok(butterfly);
  assert.equal(butterfly.itemId, 602);
  assert.equal(plan.policy, RELOCATION_POLICY.RETURN_TO_SAVEPOINT_BUTTERFLY);
});

check('case_08_savepoint_verification_uses_authoritative_map', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  const verify = plan.steps.find((s) => s.kind === STEP.VERIFY_SAVEPOINT);
  assert.ok(verify);
  assert.equal(verify.expectedMap, 'morocc');
});

check('case_09_kafra_transfer_uses_dialogue_not_service_transport', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  const transfer = plan.steps.find((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER);
  assert.ok(transfer);
  assert.equal(transfer.policy, 'DIALOG');
  const actions = transfer.dialogue.map((d) => d.action);
  assert.ok(actions.includes('TALK_NPC'));
  assert.ok(actions.includes('DIALOG_MENU_SELECT'));
  assert.ok(!JSON.stringify(plan).includes('service_transport'));
});

check('case_10_target_city_selected_from_farm_target', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  const transfer = plan.steps.find((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER);
  assert.equal(transfer.destinationCity, 'payon'); // minimises remaining route to pay_dun00
});

check('case_11_post_service_walking_route_produced', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  const post = plan.steps.find((s) => s.kind === STEP.DIRECT_TO_TARGET &&
    s.route[0] === 'payon');
  assert.ok(post);
  assert.equal(post.route[post.route.length - 1], 'pay_dun00');
});

check('case_12_final_plan_ends_in_start_farm', () => {
  for (const inventory of [{ butterflyWing: true }, { butterflyWing: false }]) {
    const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
      graph, inventory });
    const last = plan.steps[plan.steps.length - 1];
    assert.equal(last.kind, STEP.START_FARM);
    assert.equal(last.targetMap, 'pay_dun00');
    assert.equal(last.mobId, 1076);
  }
});

check('case_13_duplicate_planning_preserves_selected_target', () => {
  const target = { ...selected, source: 'selected' };
  const before = JSON.stringify(target);
  const first = planRelocation({ currentMap: 'moc_fild11', target, graph, inventory: { butterflyWing: true } });
  const second = planRelocation({ currentMap: 'moc_fild11', target, graph, inventory: { butterflyWing: true } });
  assert.equal(JSON.stringify(target), before); // not mutated
  assert.equal(first.targetMap, 'pay_dun00');
  assert.equal(second.targetMap, first.targetMap);
  assert.equal(second.targetSource, first.targetSource);
});

check('case_14_fly_wing_601_untouched', () => {
  assert.equal(FLY_WING_ITEM_ID, 601);
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  assert.ok(!plan.steps.some((s) => s.itemId === 601));
  assert.ok(!JSON.stringify(plan).includes('hunt_relocation'));
});

check('case_15_no_db_teleport', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  const forbidden = /db_teleport|sql_?move|gm_?warp|teleport_map|setpos|warp_player/i;
  assert.ok(!forbidden.test(JSON.stringify(plan)));
  const kinds = new Set(plan.steps.map((s) => s.kind));
  for (const kind of kinds)
    assert.ok(Object.values(STEP).includes(kind));
});

check('case_16_no_openkore', () => {
  const plan = planRelocation({ currentMap: 'moc_fild11', target: { ...selected, source: 'selected' },
    graph, inventory: { butterflyWing: true } });
  assert.ok(!/openkore/i.test(JSON.stringify(plan)));
  const states = relocationStateSequence(plan);
  assert.equal(states[states.length - 1], RELOCATION_STATE.READY_TO_START_FARM);
  assert.ok(states.includes(RELOCATION_STATE.SERVICE_DIALOG));
});

if (failures !== 0) {
  console.error(`CP_R1_TESTS ${executed - failures}/${executed}`);
  process.exit(1);
}
console.log(`CP_R1_TESTS ${executed}/${executed}`);
