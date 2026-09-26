import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildPlayerWorldMapProjection, parseKafraSavedPoints } from
  '../ops/ro-stack/persistent-agent/player-world-map-projection.mjs';
import { buildWorldMapDestinationList, surroundingOutdoorLevel, weightedMonsterLevel } from
  '../ops/ro-stack/persistent-agent/world-map-destination-list.mjs';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ??
  'C:/Users/Administrator/source/ghost-island-rathena';
const complete = await loadWorldMapTestCatalog(root, native);
const savedPointSources = await Promise.all([
  'npc/kafras/kafras.txt', 'npc/re/kafras/kafras.txt',
].map(async (path) => ({ path, text: await readFile(join(native, path), 'utf8') })));
const projection = buildPlayerWorldMapProjection({ ...complete, savedPointSources });
const nativeHeader = await readFile(join(native,
  'src/map/persistent_agent_kafra_save_catalog.hpp'), 'utf8');
const nativeDestinations = [...nativeHeader.matchAll(
  /\{ "([a-z0-9_]+)", (\d+), (\d+), "([^"]+)" \}/g,
)].map((row) => `${row[1]}:${row[2]}:${row[3]}:${row[4]}`).sort();
const webDestinations = [...projection.savedPoints.values()].flat()
  .map((row) => `${row.map}:${row.x}:${row.y}:${row.npc}`).sort();
assert.deepEqual(webDestinations, nativeDestinations);
assert.equal(projection.savedPoints.size, 26);
assert.equal(webDestinations.length, 39);
assert.equal(projection.townRows.size, 27); // 26 Native-authored + Izlude MF_TOWN.
assert.equal(projection.farmRows.size, 274);
assert.equal(projection.destinationList.towns.length, 27);
assert.equal(projection.destinationList.wild.length, 125);
assert.equal(projection.destinationList.caves.length, 149);
assert.deepEqual(projection.destinationList.towns.filter((row) =>
  row.averageLevel === null).map((row) => row.map), ['harboro1', 'moscovia']);
for (const rows of Object.values(projection.destinationList))
  for (let index = 1; index < rows.length; index += 1)
    assert.ok((rows[index - 1].averageLevel ?? Infinity) <=
      (rows[index].averageLevel ?? Infinity), rows[index].map);
assert.equal(weightedMonsterLevel([{ level: 10, count: 1 },
  { level: 20, count: 3 }]), 17.5);
const directTownGraph = new Map([
  ['town', [{ to: 'field_a' }, { to: 'field_b' }]],
]);
assert.deepEqual(surroundingOutdoorLevel('town', new Map([['field_a', 10],
  ['field_b', 20]]), directTownGraph),
  { level: 15, fallbackDepth: 1 });
const fallbackTownGraph = new Map([
  ['town', [{ to: 'interior' }]], ['interior', [{ to: 'field' }]],
]);
assert.deepEqual(surroundingOutdoorLevel('town', new Map([['field', 30]]),
  fallbackTownGraph),
  { level: 30, fallbackDepth: 2 });
assert.deepEqual(surroundingOutdoorLevel('town', new Map(), new Map()),
  { level: null, fallbackDepth: null });
assert.throws(() => buildWorldMapDestinationList({
  farmRows: new Map([['unknown', { map: 'unknown', name: 'unknown' }]]),
  townRows: new Map(), sourceIndex: { maps: [] },
}), /Unclassified farm destination/);
assert.equal(projection.unresolvedTowns.length, 10);
const positioned = new Set(complete.mapInfo.worldMap.regions.flatMap(
  (region) => region.mapIds));
const visible = new Set(projection.worldMap.regions.flatMap((region) => region.mapIds));
assert.equal(projection.hiddenMapCount, positioned.size - visible.size);
for (const [map, row] of projection.farmRows) {
  assert.equal(row.farmSelectionAvailable, true, map);
  assert.ok(row.normalMonsterCount > 0, map);
  assert.ok(positioned.has(map), map);
  assert.ok(complete.sourceIndex.maps.find((entry) => entry.map === map)?.monsters?.length > 0);
  assert.equal(complete.mapInfo.maps[map].unlocked, true, map);
}
for (const [map, row] of projection.townRows) {
  assert.equal(row.townTeleportAvailable, true, map);
  assert.ok(row.savedPoint && row.landing, map);
  assert.deepEqual({ x: row.landing.x, y: row.landing.y },
    { x: row.savedPoint.x, y: row.savedPoint.y }, map);
  if (projection.savedPoints.has(map)) {
    assert.equal(row.saveDestinations.length, projection.savedPoints.get(map).length, map);
    assert.ok(projection.savedPoints.get(map).some((point) =>
      point.x === row.savedPoint.x && point.y === row.savedPoint.y), map);
  }
  if (projection.farmRows.has(map))
    assert.ok(projection.worldMap.maps[map].normalMonsterCount > 0, map);
  else
    assert.equal(projection.worldMap.maps[map].normalMonsterCount, undefined, map);
}
assert.deepEqual(projection.townRows.get('prontera')?.savedPoint,
  { map: 'prontera', x: 116, y: 73 });
assert.deepEqual(projection.townRows.get('morocc')?.savedPoint,
  { map: 'morocc', x: 156, y: 46 });
assert.equal(projection.townRows.get('morocc')?.locationClass, 'ACTUAL_TOWN');
for (const map of ['prt_fild05', 'cmd_fild07'])
  assert.equal(projection.townRows.get(map)?.locationClass, 'FIELD_SAVE_HUB');
for (const map of ['prt_fild05', 'cmd_fild07', 'glast_01']) {
  assert.ok(projection.farmRows.has(map), map);
  assert.ok(projection.townRows.has(map), map);
}
for (const map of ['aldeba_in', 'harboro1', 'lhz_in02']) {
  assert.ok(!positioned.has(map), map);
  assert.ok(projection.townRows.has(map), map);
  assert.equal(projection.townRows.get(map).name, complete.mapNames[map]);
}
for (const map of projection.savedPoints.keys())
  assert.ok(projection.townRows.has(map), map);
const previousUnresolved = [
  'hugel', 'yuno', 'gonryun', 'eclage', 'einbroch', 'einbech', 'brasilis',
  'amatsu', 'rachel', 'lighthalzen', 'lasagna', 'mora', 'veins', 'geffen',
  'dicastes01', 'malangdo', 'umbala', 'louyang', 'pay_arche', 'dewata',
  'ayothaya', 'payon', 'moc_ruins', 'malaya', 'alberta',
];
assert.equal(previousUnresolved.length, 25);
assert.equal(previousUnresolved.filter((map) => projection.townRows.has(map)).length, 15);
assert.equal(previousUnresolved.filter((map) => !projection.townRows.has(map)).length, 10);
assert.equal(projection.unresolvedTowns.some((row) =>
  ['CANONICAL_SAVED_POINT_UNAVAILABLE', 'NAVIGATION_PATH_COST_UNAVAILABLE']
    .includes(row.reason)), false);
const noSpawns = buildPlayerWorldMapProjection({ ...complete,
  sourceIndex: { maps: [] }, savedPointSources });
assert.equal(noSpawns.farmRows.size, 0);
assert.equal(noSpawns.townRows.size, 27);
const rejectedService = parseKafraSavedPoints([{ path: 'test', text:
  'xmas,1,1,0\tscript\tStorage\t1,{\n\tcallfunc "F_Kafra",0,6;\n\tsavepoint "xmas",10,10,1,1;\n}' }]);
assert.equal(rejectedService.size, 0);
const app = await readFile(join(root, 'ops/ro-stack/dashboard/app.js'), 'utf8');
const html = await readFile(join(root, 'ops/ro-stack/dashboard/index.html'), 'utf8');
assert.match(app, /town\.buttonState !== 'AVAILABLE'/);
assert.match(app, /selectTownWorldMap\(row\.map\)/);
assert.match(app, /renderWorldMapDestinationList\(\)/);
assert.doesNotMatch(app, /world-map-town-label|worldMapTownLabels/);
assert.doesNotMatch(html, /id="worldMapTownLabels"|id="worldMapTowns"/);
assert.match(html, /id="worldMapNotice"/);
assert.match(html, /id="worldMapSaveCurrentTown"/);
assert.match(html, /id="worldMapDetail"[^>]*role="dialog"/);
assert.doesNotMatch(app, /儲存點：\$\{town\.savedPoint/);
assert.doesNotMatch(app, /平均 Lv\. \$\{\(Math\.round\(row\.averageLevel/);
assert.match(app, /showWorldMapNotice\(farmTargetBlockedMessage\(error\.message\)\)/);
assert.match(app, /api\('\/api\/world-map-teleport'/);
assert.match(app, /api\('\/api\/saved-town'/);
const dashboard = await readFile(join(root, 'ops/ro-stack/dashboard.mjs'), 'utf8');
assert.match(dashboard, /playerWorldMapProjection\.townRows\.get\(mapId\)/);
assert.match(dashboard, /playerWorldMapProjection\.farmRows\.get\(mapId\)/);
assert.match(dashboard, /saveX: town\.savedPoint\.x, saveY: town\.savedPoint\.y/);
console.log(JSON.stringify({ result: 'PASS', nativeKafraMaps: 26,
  nativeSaveDestinations: 39, playerFarmMaps: projection.farmRows.size,
  playerTownNodes: projection.townRows.size, wildMaps: 125, caveMaps: 149,
  dualRoleMaps: 3,
  previousUnresolvedResolved: 15, previousUnresolvedStillClosed: 10 }));
