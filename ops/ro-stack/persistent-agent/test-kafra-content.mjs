// CP-R2.2 Kafra content validation. Run: node test-kafra-content.mjs
import assert from 'node:assert/strict';
import { KAFRA_CONTENT, resolveKafraDestination, kafraContextForPlan }
  from './kafra-content.mjs';
import { planRelocation } from './relocation-policy.mjs';

let executed = 0; let failures = 0;
function check(id, fn) {
  executed++;
  try { fn(); console.log(`PASS ${id}`); }
  catch (error) { failures++; console.error(`FAIL ${id}: ${error.message}`); }
}

const hubIds = ['prontera', 'payon', 'morocc', 'geffen', 'izlude'];

check('case_01_five_hubs_resolve', () => {
  assert.deepEqual(Object.keys(KAFRA_CONTENT), hubIds);
  for (const id of hubIds) {
    const hub = KAFRA_CONTENT[id];
    assert.equal(hub.hubId, id);
    assert.ok(hub.npcMap && Number.isInteger(hub.npcX) && Number.isInteger(hub.npcY));
    assert.ok(hub.saveMap && Number.isInteger(hub.saveX) && Number.isInteger(hub.saveY));
  }
});

check('case_02_npc_identity_source_proven', () => {
  // kafras.txt `script Kafra Employee::<label>` -> exname == label (npc.cpp:npc_parsename).
  assert.equal(KAFRA_CONTENT.prontera.npcName, 'kaf_prontera2');
  assert.equal(KAFRA_CONTENT.payon.npcName, 'kaf_payon');
  assert.equal(KAFRA_CONTENT.morocc.npcName, 'kaf_morocc');
  assert.equal(KAFRA_CONTENT.geffen.npcName, 'kaf_geffen');
  // npc/re/kafras/kafras.txt duplicate name token (plain name -> exname == name).
  assert.equal(KAFRA_CONTENT.izlude.npcName, 'Kafra Employee#iz');
  for (const id of Object.keys(KAFRA_CONTENT)) {
    assert.ok(KAFRA_CONTENT[id].npcName);
    assert.ok(KAFRA_CONTENT[id].npcNameSource);
    assert.ok(KAFRA_CONTENT[id].npcQuery);
  }
});

check('case_03_save_point_exact', () => {
  assert.deepEqual([KAFRA_CONTENT.prontera.saveMap, KAFRA_CONTENT.prontera.saveX,
    KAFRA_CONTENT.prontera.saveY], ['prontera', 150, 33]);
  assert.deepEqual([KAFRA_CONTENT.payon.saveMap, KAFRA_CONTENT.payon.saveX,
    KAFRA_CONTENT.payon.saveY], ['payon', 160, 58]);
  assert.deepEqual([KAFRA_CONTENT.morocc.saveMap, KAFRA_CONTENT.morocc.saveX,
    KAFRA_CONTENT.morocc.saveY], ['morocc', 156, 46]);
  assert.deepEqual([KAFRA_CONTENT.geffen.saveMap, KAFRA_CONTENT.geffen.saveX,
    KAFRA_CONTENT.geffen.saveY], ['geffen', 119, 40]);
  assert.deepEqual([KAFRA_CONTENT.izlude.saveMap, KAFRA_CONTENT.izlude.saveX,
    KAFRA_CONTENT.izlude.saveY], ['izlude', 94, 103]);
});

check('case_04_teleport_menu_exact', () => {
  for (const id of hubIds) {
    assert.equal(KAFRA_CONTENT[id].saveMenuIndex, 1);
    assert.equal(KAFRA_CONTENT[id].transportMenuIndex, 3);
  }
});

check('case_05_destination_arrival_exact', () => {
  assert.deepEqual(resolveKafraDestination('morocc', 'payon'),
    { hubId: 'morocc', menuIndex: 2, map: 'payon', x: 161, y: 58 });
  assert.deepEqual(resolveKafraDestination('payon', 'morocc'),
    { hubId: 'payon', menuIndex: 3, map: 'morocc', x: 156, y: 46 });
  assert.deepEqual(resolveKafraDestination('izlude', 'payon'),
    { hubId: 'izlude', menuIndex: 2, map: 'payon', x: 161, y: 58 });
});

check('case_06_selected_farm_target_untouched', () => {
  const graph = new Map([
    ['moc_fild11', new Set(['moc_fild12'])], ['moc_fild12', new Set(['moc_fild11', 'morocc'])],
    ['morocc', new Set(['moc_fild12'])], ['payon', new Set(['pay_arche'])],
    ['pay_arche', new Set(['payon', 'pay_dun00'])], ['pay_dun00', new Set(['pay_arche'])],
  ]);
  const target = { targetMap: 'pay_dun00', mobId: 1076, source: 'selected' };
  const plan = planRelocation({ currentMap: 'moc_fild11', target, graph,
    inventory: { butterflyWing: true } });
  const before = JSON.stringify(target);
  const context = kafraContextForPlan(plan);
  assert.equal(JSON.stringify(target), before);
  assert.equal(plan.targetMap, 'pay_dun00');
  // Cross-region plan from moc_fild11 -> hub morocc -> destination city payon (menu 2).
  assert.equal(context.npcName, 'kaf_morocc');
  assert.equal(context.saveMenuIndex, 1);
  assert.equal(context.transportMenuIndex, 3);
  assert.equal(context.cityMenuIndex, 2);
});

check('case_07_unsupported_destination_fails_closed', () => {
  assert.equal(resolveKafraDestination('morocc', 'yuno').reason, 'service_destination_unavailable');
  assert.equal(resolveKafraDestination('prontera', 'nowhere').reason,
    'service_destination_unavailable');
  assert.equal(resolveKafraDestination('unknown_hub', 'payon').reason, 'hub_unreachable');
});

check('case_08_no_wildcard', () => {
  const text = JSON.stringify(KAFRA_CONTENT);
  assert.ok(!text.includes('"*"'));
  assert.ok(!/\*/.test(text));
});

check('case_09_no_service_transport', () => {
  assert.ok(!JSON.stringify(KAFRA_CONTENT).includes('service_transport'));
});

check('case_10_no_openkore', () => {
  assert.ok(!/openkore|\.cmd\b|\.result\b/i.test(JSON.stringify(KAFRA_CONTENT)));
  // Payment is never expressed by the Web content.
  assert.ok(!/zeny|7060|ticket/i.test(JSON.stringify(KAFRA_CONTENT)));
});

if (failures !== 0) {
  console.error(`CONTENT_TESTS ${executed - failures}/${executed}`);
  process.exit(1);
}
console.log(`CONTENT_TESTS ${executed}/${executed}`);
