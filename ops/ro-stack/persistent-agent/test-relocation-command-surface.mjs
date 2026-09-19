// CP-R2.1 command-surface wiring tests. Run: node test-relocation-command-surface.mjs
import assert from 'node:assert/strict';
import { planRelocation, STEP } from './relocation-policy.mjs';
import { nextRelocationAction, createRelocationProgress, RELOCATION_ACTION }
  from './relocation-executor.mjs';
import { existingCommandsForStep, existingCommandsForPlan, EXISTING_ACTION }
  from './relocation-command-surface.mjs';

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
    graph.get(a).add(b); graph.get(b).add(a);
  }
  return graph;
}
const graph = buildGraph([
  ['moc_fild11', 'moc_fild12'], ['moc_fild12', 'morocc'],
  ['payon', 'pay_arche'], ['pay_arche', 'pay_dun00'],
]);
const target = { targetMap: 'pay_dun00', mobId: 1076, source: 'selected' };
const plan = planRelocation({ currentMap: 'moc_fild11', target, graph,
  inventory: { butterflyWing: true } });
const context = { kafra: { npcName: 'Kafra Employee#morocc', saveMenuIndex: 1,
  transportMenuIndex: 3, cityMenuIndex: 2 } };

const butterfly = plan.steps.find((s) => s.kind === STEP.BUTTERFLY_WING);
const save = plan.steps.find((s) => s.kind === STEP.KAFRA_SAVE);
const transfer = plan.steps.find((s) => s.kind === STEP.KAFRA_DIALOG_TRANSFER);

check('case_01_item_602_uses_existing_item_action', () => {
  const { commands } = existingCommandsForStep(butterfly, context);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].action, 'use_item');
  assert.equal(commands[0].action, EXISTING_ACTION.USE_ITEM);
  assert.equal(commands[0].payload.itemId, 602);
});

check('case_02_item_602_one_shot_while_pending', () => {
  const idx = plan.steps.indexOf(butterfly);
  const p = createRelocationProgress();
  p.index = idx;
  const first = nextRelocationAction(plan, p, {});
  const second = nextRelocationAction(plan, p, {});
  assert.equal(first.action, RELOCATION_ACTION.BUTTERFLY_WING);
  assert.equal(second.action, null);
  assert.equal(second.waitingForConfirmation, true);
  assert.equal(existingCommandsForStep(butterfly, context).commands.length, 1); // exactly one use_item
});

check('case_03_kafra_save_uses_existing_npc_dialog_actions', () => {
  const { commands } = existingCommandsForStep(save, context);
  assert.deepEqual(commands.map((c) => c.action), ['talk_to_npc', 'dialog_select', 'dialog_close']);
  assert.equal(commands[0].payload.targetMap, 'morocc');
});

check('case_04_save_confirmation_authoritative', () => {
  const idx = plan.steps.indexOf(save);
  const p = createRelocationProgress();
  p.index = idx;
  assert.equal(nextRelocationAction(plan, p, { savePoint: 'payon' }).action, RELOCATION_ACTION.KAFRA_SAVE_DIALOGUE);
  nextRelocationAction(plan, p, { savePoint: 'payon' }); // still unconfirmed
  assert.equal(p.index, idx);
  const done = nextRelocationAction(plan, p, { savePoint: 'morocc' });
  assert.equal(done.stageIndex, idx + 1);
});

check('case_05_city_transfer_uses_existing_npc_dialog_actions', () => {
  const { commands } = existingCommandsForStep(transfer, context);
  assert.deepEqual(commands.map((c) => c.action),
    ['talk_to_npc', 'dialog_next', 'dialog_select', 'dialog_next', 'dialog_select', 'dialog_close']);
  assert.equal(commands[0].payload.goal, 'transport');
});

check('case_06_ticket_zeny_not_mutated_by_web', () => {
  const { commands } = existingCommandsForPlan(plan, context);
  const text = JSON.stringify(commands);
  assert.ok(!/zeny|7060|ticket/i.test(text));
});

check('case_07_service_transport_never_emitted', () => {
  const { commands } = existingCommandsForPlan(plan, context);
  assert.ok(!JSON.stringify(commands).includes('service_transport'));
  assert.ok(!commands.some((c) => c.action === 'service_transport'));
});

check('case_08_duplicate_dialog_poll_safe', () => {
  const idx = plan.steps.indexOf(transfer);
  const p = createRelocationProgress();
  p.index = idx;
  const first = nextRelocationAction(plan, p, { currentMap: 'morocc' });
  const second = nextRelocationAction(plan, p, { currentMap: 'morocc' });
  assert.equal(first.action, RELOCATION_ACTION.KAFRA_TRANSFER_DIALOGUE);
  assert.equal(second.action, null);
  assert.equal(second.waitingForConfirmation, true);
});

check('case_09_selected_farm_target_unchanged', () => {
  const startFarm = plan.steps.find((s) => s.kind === STEP.START_FARM);
  const { commands } = existingCommandsForStep(startFarm, context);
  assert.equal(commands[0].action, 'start_farm');
  assert.equal(commands[0].payload.targetMap, 'pay_dun00');
  assert.equal(commands[0].payload.mobId, 1076);
});

check('case_10_post_service_route_resumes', () => {
  const post = plan.steps.find((s) => s.kind === STEP.DIRECT_TO_TARGET && s.route[0] === 'payon');
  const { commands } = existingCommandsForStep(post, context);
  assert.equal(commands[0].action, 'start_navigation');
  assert.equal(commands[0].payload.route[commands[0].payload.route.length - 1], 'pay_dun00');
});

check('case_11_start_farm_dispatched_once', () => {
  const idx = plan.steps.length - 1;
  const p = createRelocationProgress();
  p.index = idx;
  assert.equal(nextRelocationAction(plan, p, {}).action, RELOCATION_ACTION.START_FARM);
  assert.equal(nextRelocationAction(plan, p, {}).action, null);
  assert.equal(nextRelocationAction(plan, p, { agentMode: 'AUTO_FARM' }).done, true);
});

check('case_12_no_openkore_and_no_cmd_result', () => {
  const { commands } = existingCommandsForPlan(plan, context);
  const text = JSON.stringify(commands);
  assert.ok(!/openkore|\.cmd\b|\.result\b/i.test(text));
  assert.ok(commands.every((c) => typeof c.action === 'string' && c.action.length > 0));
});

if (failures !== 0) {
  console.error(`COMMAND_WIRING_TESTS ${executed - failures}/${executed}`);
  process.exit(1);
}
console.log(`COMMAND_WIRING_TESTS ${executed}/${executed}`);
