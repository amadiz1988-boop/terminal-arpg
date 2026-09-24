import assert from 'node:assert/strict';
import { buildWarpGraph, planFarmMapChange } from './map-route.mjs';

const maps = [
  ['prt_fild08', 'prontera'],
  ['morocc', 'moc_ruins'], ['moc_ruins', 'moc_pryd01'], ['moc_pryd01', 'moc_pryd02'],
  ['payon', 'pay_arche'], ['pay_arche', 'pay_dun00'], ['pay_dun00', 'pay_dun01'],
  ['prt_fild08', 'prt_fild07'], ['prt_fild07', 'prt_fild05'],
  ['prt_fild05', 'mjolnir_09'], ['mjolnir_09', 'mjolnir_08'], ['mjolnir_08', 'mjolnir_07'],
];
const graph = buildWarpGraph(maps.map(([map, to], index) => ({
  map, x: index + 1, y: index + 2, name: `test_${index}`, to,
  toX: index + 3, toY: index + 4, xs: 1, ys: 1,
})));

const plan = (targetMap, options = {}) => planFarmMapChange(
  graph, 'prt_fild08', targetMap, options,
);

const pyramid1 = plan('moc_pryd01', { savePoint: { map: 'prontera' }, inventory: { '602': 1 } });
assert.equal(pyramid1.mode, 'MULTIMODAL');
assert.deepEqual(pyramid1.steps.map((step) => step.kind), [
  'VERIFY_SAVEPOINT', 'BUTTERFLY_WING', 'KAFRA_DIALOG_TRANSFER',
  'VERIFY_SERVICE_ARRIVAL', 'DIRECT_TO_TARGET', 'START_FARM',
]);
assert.equal(pyramid1.steps.find((step) => step.kind === 'KAFRA_DIALOG_TRANSFER').destinationCity, 'morocc');
assert.equal(pyramid1.steps.find((step) => step.kind === 'BUTTERFLY_WING').itemId, 602);
assert.equal(pyramid1.edgeTypes.includes('KAFRA_TRANSPORT'), true);
assert.equal(pyramid1.edgeTypes.includes('DUNGEON_PORTAL'), true);

const pyramid2 = plan('moc_pryd02', { savePoint: { map: 'prontera' }, inventory: { '602': 1 } });
assert.equal(pyramid2.steps.at(-2).kind, 'DIRECT_TO_TARGET');
assert.deepEqual(pyramid2.steps.at(-2).route.map((step) => step.map), [
  'morocc', 'moc_ruins', 'moc_pryd01', 'moc_pryd02',
]);

const payon = plan('pay_dun01', { savePoint: { map: 'prontera' }, inventory: { '602': 1 } });
assert.equal(payon.mode, 'MULTIMODAL');
assert.equal(payon.steps.find((step) => step.kind === 'KAFRA_DIALOG_TRANSFER').destinationCity, 'payon');
assert.deepEqual(payon.steps.find((step) => step.kind === 'DIRECT_TO_TARGET').route.map((step) => step.map), [
  'payon', 'pay_arche', 'pay_dun00', 'pay_dun01',
]);

const mjolnir = plan('mjolnir_07', { savePoint: { map: 'prontera' }, inventory: { '602': 1 } });
assert.equal(mjolnir.mode, 'DIRECT');
assert.equal(mjolnir.routeCost, 5);

const sameMap = planFarmMapChange(graph, 'pay_dun01', 'pay_dun01');
assert.equal(sameMap.mode, 'ALREADY_AT_DESTINATION');
assert.deepEqual(sameMap.steps.map((step) => step.kind), ['START_FARM']);

const unreachable = plan('moc_pryd01', { savePoint: { map: 'prt_fild08' }, inventory: {} });
assert.equal(unreachable.mode, 'MULTIMODAL');
assert.equal(unreachable.edgeTypes.includes('BUTTERFLY_WING'), false);

console.log('PASS test-map-route-multimodal cases=6');
