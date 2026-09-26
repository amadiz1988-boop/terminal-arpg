import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  classifyFarmTeleport,
  eligibleNormalFarmMonsters,
  farmTeleportCost,
  worldMapTeleportDecision,
} from '../ops/ro-stack/persistent-agent/world-map-teleport-policy.mjs';
import { parseBlockedWorldMapFlags } from
  '../ops/ro-stack/persistent-agent/world-map-teleport-catalog.mjs';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ?? 'C:/Users/Administrator/source/ghost-island-rathena';
const normal = { id: 1, count: 2, level: 95, isBoss: false, isResource: false,
  sourceFiles: ['npc/re/mobs/fields/test.txt'] };
const resource = { ...normal, id: 2, level: 1, isResource: true };
const event = { ...normal, id: 3, level: 2, sourceFiles: ['npc/re/mobs/events/test.txt'] };
const loaded = { mapExists: true, configuredForLoad: true, cacheSource: 'rathena',
  category: 'NORMAL_FIELD', evidence: { spawns: [
    { mobId: 1, count: 2, declaration: 'monster', source: 'npc/re/mobs/verus.txt:1' },
    { mobId: 2, count: 1, declaration: 'monster', source: 'npc/re/mobs/verus.txt:2' },
  ] } };
const landing = { x: 10, y: 10 };
const decide = (overrides = {}) => worldMapTeleportDecision({ kind: 'farm',
  currentMap: 'prontera', targetMap: 'test', baseLevel: 95, minLevel: 95,
  zeny: 1000, currentIsTown: true, availableAt: 0, nowSeconds: 1000, ...overrides });

assert.equal(decide({ currentMap: 'test' }).reason, 'ALREADY_ON_TARGET_MAP');
assert.equal(decide({ currentMap: 'test', zeny: 0, availableAt: 999 }).cost, 0);
assert.equal(decide({ baseLevel: 94 }).reason, 'LEVEL_TOO_LOW');
assert.equal(decide({ baseLevel: 95 }).allowed, true);
assert.equal(farmTeleportCost(66, 20), 0);
assert.equal(farmTeleportCost(67, 95), 950);
assert.equal(farmTeleportCost(150, 20), 200);
assert.equal(decide({ availableAt: 1059 }).cooldownRemaining, 59);
assert.equal(decide({ availableAt: 1000 }).allowed, true);
assert.equal(decide({ availableAt: 1001 }).reason, 'WORLD_MAP_TELEPORT_COOLDOWN');
assert.equal(decide({ zeny: 949 }).reason, 'INSUFFICIENT_ZENY');
assert.equal(decide({ zeny: 949 }).currentZeny, 949);
assert.equal(decide({ kind: 'town', baseLevel: 1, zeny: 0 }).allowed, true);
assert.equal(decide({ kind: 'town', baseLevel: 1, zeny: 0 }).cost, 0);
assert.equal(decide({ kind: 'town', availableAt: 1059 }).cooldownRemaining, 59);
assert.equal(decide({ kind: 'town', availableAt: 1059, currentIsTown: false }).allowed, true);
assert.equal(decide({ kind: 'town', availableAt: 1059, currentIsTown: false }).cooldownSeconds, 0);
assert.equal(decide({ kind: 'town', currentIsTown: true }).cooldownSeconds, 30);
assert.equal(decide({ kind: 'farm', currentIsTown: true }).cooldownSeconds, 60);
assert.equal(decide({ kind: 'farm', currentIsTown: false }).cooldownSeconds, 60);
assert.equal(decide({ kind: 'town', currentMap: 'test' }).reason, 'ALREADY_ON_TARGET_MAP');
assert.deepEqual(eligibleNormalFarmMonsters({ monsters: [normal, resource, event] }, loaded), [normal]);
assert.equal(classifyFarmTeleport({ inventory: loaded,
  detail: { monsters: [normal, resource, event] }, landing }).minLevel, 95);
assert.equal(classifyFarmTeleport({ inventory: loaded,
  detail: { monsters: [resource] }, landing }).reason,
  'NO_ELIGIBLE_NORMAL_FARM_MONSTER');
assert.equal(classifyFarmTeleport({ inventory: { ...loaded, category: 'QUEST_GATED' },
  detail: { monsters: [normal] }, landing }).reason, 'SUPPORTED');
assert.equal(classifyFarmTeleport({ inventory: { ...loaded, category: 'INSTANCE' },
  detail: { monsters: [normal] }, landing }).reason, 'MAP_ACCESS_RESTRICTED');
assert.equal(classifyFarmTeleport({ inventory: { ...loaded, category: 'TOWN' },
  detail: { monsters: [normal] }, landing }).reason, 'TOWN_NOT_FARMABLE');
assert.equal(classifyFarmTeleport({ inventory: loaded,
  detail: { monsters: [normal] }, landing: null }).reason, 'SUPPORTED');
assert.equal(classifyFarmTeleport({ inventory: { ...loaded, evidence: { flags: [{ value: 'restricted' }],
  spawns: loaded.evidence.spawns } }, detail: { monsters: [normal] }, landing: null }).reason,
  'SUPPORTED');
assert.equal(classifyFarmTeleport({ inventory: { ...loaded, evidence: { flags: [{ value: 'nowarpto' }],
  spawns: loaded.evidence.spawns } }, detail: { monsters: [normal] }, landing }).reason,
  'MAP_ACCESS_RESTRICTED');
assert.deepEqual([...parseBlockedWorldMapFlags('niflheim mapflag restricted 7\nmag_dun03 mapflag nowarpto')],
  ['mag_dun03']);
assert.deepEqual(eligibleNormalFarmMonsters({ monsters: [normal, event] },
  { ...loaded, evidence: { spawns: [] } }), []);

const { mapInfo, catalog } = await loadWorldMapTestCatalog(root, native);
for (const mapId of ['ver_eju', 'ver_tunn', 'verus03', 'niflheim', 'tur_dun05'])
  assert.equal(catalog.get(mapId)?.farmSelectionAvailable, true, mapId);
for (const mapId of ['mag_dun03', 'lhz_dun03', 'ein_dun03']) {
  assert.equal(catalog.get(mapId)?.farmSelectionAvailable, false, mapId);
  assert.equal(catalog.get(mapId)?.availabilityReason, 'MAP_ACCESS_RESTRICTED', mapId);
}
assert.equal(catalog.get('tur_dun05')?.landing, null,
  'Native owns the server-selected cell for a map-level farm intent');
for (const mapId of ['mjolnir_07', 'pay_fild04', 'moc_pryd01']) {
  assert.equal(catalog.get(mapId)?.farmSelectionAvailable, true, mapId);
  assert.ok(catalog.get(mapId)?.landing?.x > 0, mapId);
}
assert.equal(catalog.get('mjolnir_07')?.minLevel, 55);
assert.equal(catalog.get('pay_fild04')?.minLevel, 1);
assert.equal(catalog.get('moc_pryd01')?.minLevel, 24);
assert.equal(catalog.get('prontera')?.kind, 'town');
assert.equal(catalog.get('prontera')?.farmSelectionAvailable, false);
assert.ok(catalog.get('moc_fild20')?.farmSelectionAvailable ||
  catalog.get('moc_fild20')?.availabilityReason !== 'ROUTE_UNREACHABLE');

const oldRegistry = JSON.parse(await readFile(join(root,
  'ops/ro-stack/persistent-agent/standard-farm-map-release-registry.json'), 'utf8'));
const beforeIds = new Set(oldRegistry.maps.filter((row) => row.farmSelectionAvailable)
  .map((row) => row.map));
const before = beforeIds.size;
const after = [...catalog.values()].filter((row) => row.farmSelectionAvailable).length;
const positionedMapIds = new Set(mapInfo.worldMap.regions.flatMap((region) => region.mapIds));
const positioned = [...catalog.values()].filter((row) =>
  row.farmSelectionAvailable && positionedMapIds.has(row.map)).length;
assert.equal(after, 281);
for (const mapId of ['lasa_fild01', 'lasa_fild02'])
  assert.equal(catalog.get(mapId)?.farmSelectionAvailable, true, mapId);
const towns = [...catalog.values()].filter((row) => row.townTeleportAvailable);
const added = [...catalog.values()].filter((row) => row.farmSelectionAvailable &&
  !beforeIds.has(row.map)).map((row) => row.map);
const removed = [...beforeIds].filter((map) => !catalog.get(map)?.farmSelectionAvailable);
const visibleRegions = mapInfo.worldMap.regions;
const visibleIds = new Set(visibleRegions.flatMap((region) => region.mapIds));
const labelCounts = { normal: 0, red: 0, town: 0 };
let visibleFloorUnclassified = 0;
for (const region of visibleRegions) {
  assert.ok(Object.hasOwn(labelCounts, region.labelKind), `${region.regionId}: label kind`);
  labelCounts[region.labelKind] += 1;
  assert.ok(region.mapIds.length > 0, `${region.regionId}: empty visible label`);
  for (const mapId of region.mapIds) {
    assert.ok(mapInfo.maps[mapId], `${region.regionId}: ${mapId} detail missing`);
    const row = catalog.get(mapId);
    if (!row || (!row.farmSelectionAvailable && !row.townTeleportAvailable &&
        !row.availabilityReason)) visibleFloorUnclassified += 1;
    assert.equal(mapInfo.maps[mapId].farmSelectionAvailable,
      row.farmSelectionAvailable === true, `${mapId}: map-info farm projection`);
    assert.equal(mapInfo.maps[mapId].townTeleportAvailable,
      row.townTeleportAvailable === true, `${mapId}: map-info town projection`);
  }
  assert.deepEqual(new Set(region.availableMapIds), new Set(region.mapIds.filter(
    (mapId) => catalog.get(mapId)?.farmSelectionAvailable === true)),
  `${region.regionId}: map-info region projection`);
}
assert.equal(visibleFloorUnclassified, 0);
assert.equal([...visibleIds].length, 360);
const visibleAudit = JSON.parse(await readFile(join(root,
  'docs/openkore-reference/world-map-visible-coverage.json'), 'utf8'));
assert.equal(visibleAudit.blockedByReason.QUEST_ACCESS_REVIEW_REQUIRED ?? 0, 0);
assert.equal(visibleAudit.counts.visibleLabelsTotal, visibleRegions.length);
assert.equal(visibleAudit.counts.visibleUniqueFloors, visibleIds.size);
assert.equal(visibleAudit.counts.visibleLabelUnclassified, 0);
assert.equal(visibleAudit.counts.visibleFloorUnclassified, 0);
for (const region of visibleAudit.regions)
  for (const floor of region.floors) {
    const row = catalog.get(floor.mapId);
    assert.equal(floor.farmMapAvailable, row.farmSelectionAvailable === true, floor.mapId);
    assert.equal(floor.teleportAvailable,
      row.farmSelectionAvailable === true || row.townTeleportAvailable === true, floor.mapId);
    assert.equal(floor.minFarmLevel, row.minLevel ?? null, floor.mapId);
    assert.equal(floor.reason, row.farmSelectionAvailable || row.townTeleportAvailable
      ? 'SUPPORTED' : row.availabilityReason, floor.mapId);
  }
const deferred = [...catalog.values()].filter((row) => row.kind === 'farm' &&
  !visibleIds.has(row.map));
assert.ok(deferred.every((row) =>
  row.availabilityReason === 'OUT_OF_CURRENT_WORLD_MAP_SCOPE'));
const baselineNewlyEnabled = [
  'abyss_01', 'abyss_02', 'beach_dun', 'cmd_fild02', 'cmd_fild03',
  'cmd_fild04', 'cmd_fild06', 'cmd_fild07', 'cmd_fild09', 'in_sphinx1',
  'in_sphinx3', 'in_sphinx4', 'in_sphinx5', 'iz_dun00', 'iz_dun01',
  'iz_dun02', 'iz_dun03', 'iz_dun04', 'lou_dun01', 'lou_dun02',
  'lou_dun03', 'moc_fild11', 'moc_pryd01', 'moc_pryd02', 'moc_pryd03',
  'moc_pryd04', 'moc_pryd05', 'moc_pryd06', 'nif_fild01', 'nif_fild02',
  'um_fild02', 'um_fild03', 'um_fild04', 'xmas_dun01', 'xmas_dun02',
];
const baselineEnabled = new Set([
  ...[...beforeIds].filter((mapId) => mapId !== 'thor_v03'),
  ...baselineNewlyEnabled,
]);
assert.equal(baselineEnabled.size, 170);
assert.deepEqual([...baselineEnabled].filter((mapId) =>
  !catalog.get(mapId)?.farmSelectionAvailable), []);
const reasons = Object.fromEntries([...catalog.values()]
  .filter((row) => row.kind === 'farm' && !row.farmSelectionAvailable)
  .reduce((counts, row) => counts.set(row.availabilityReason,
    (counts.get(row.availabilityReason) ?? 0) + 1), new Map()));
assert.ok(after >= before, `farm map regression: ${after} < ${before}`);
assert.deepEqual(removed, ['thor_v03']);
assert.equal(catalog.get('thor_v03')?.availabilityReason,
  'NO_ELIGIBLE_NORMAL_FARM_MONSTER');
assert.ok(towns.length >= 5);
assert.ok(positioned > before);
console.log(`WORLD_MAP_TELEPORT_SOURCE_PASS cases=40 before=${before} after=${after} positioned=${positioned} newly=${added.join(',')} removed=${removed.join(',')} towns=${towns.map((row) => row.map).join(',')} exclusions=${JSON.stringify(reasons)}`);
console.log(`WORLD_MAP_VISIBLE_COVERAGE_PASS labels=${visibleRegions.length} normal=${labelCounts.normal} red=${labelCounts.red} town=${labelCounts.town} groups=${visibleRegions.filter((region) => region.labelKind === 'red' && region.mapIds.length > 1).length} redFloors=${visibleRegions.filter((region) => region.labelKind === 'red').flatMap((region) => region.mapIds).length} classifiedFloors=${visibleIds.size} baselineEnabled=${baselineEnabled.size} newlyEnabled=${after - 170}`);
