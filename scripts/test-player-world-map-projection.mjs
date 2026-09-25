import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildPlayerWorldMapProjection, parseKafraSavedPoints } from
  '../ops/ro-stack/persistent-agent/player-world-map-projection.mjs';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ??
  'C:/Users/Administrator/source/ghost-island-rathena';
const complete = await loadWorldMapTestCatalog(root, native);
const savedPointSources = await Promise.all([
  'npc/kafras/kafras.txt', 'npc/re/kafras/kafras.txt',
].map(async (path) => ({ path, text: await readFile(join(native, path), 'utf8') })));
const projection = buildPlayerWorldMapProjection({ ...complete, savedPointSources });
const positioned = new Set(complete.mapInfo.worldMap.regions.flatMap(
  (region) => region.mapIds));
const visible = new Set(projection.worldMap.regions.flatMap((region) => region.mapIds));
const sourceMaps = new Map(complete.sourceIndex.maps.map((row) => [row.map, row]));

assert.ok(projection.rows.size > 0);
assert.equal(visible.size, projection.rows.size);
assert.equal(projection.hiddenMapCount, positioned.size - visible.size);
assert.equal(Object.keys(projection.worldMap.maps).length, visible.size);
for (const [map, row] of projection.rows) {
  assert.ok(visible.has(map), map);
  assert.ok(positioned.has(map), map);
  if (row.kind === 'farm') {
    assert.equal(row.farmSelectionAvailable, true, map);
    assert.ok(row.normalMonsterCount > 0, map);
    assert.ok(sourceMaps.get(map)?.monsters?.length > 0, map);
    assert.equal(sourceMaps.get(map)?.blockedFlags?.length ?? 0, 0, map);
    assert.equal(complete.mapInfo.maps[map].unlocked, true, map);
  } else {
    assert.equal(row.kind, 'town', map);
    assert.equal(row.townTeleportAvailable, true, map);
    assert.deepEqual(row.landing && { x: row.landing.x, y: row.landing.y },
      { x: row.savedPoint.x, y: row.savedPoint.y }, map);
    assert.equal(projection.worldMap.maps[map].normalMonsterCount, undefined, map);
  }
}
assert.equal(projection.rows.get('prontera')?.kind, 'town');
assert.deepEqual(projection.rows.get('prontera')?.savedPoint,
  { map: 'prontera', x: 116, y: 73 });
assert.equal(projection.rows.get('comodo')?.kind, 'town');
for (const town of ['geffen', 'alberta', 'yuno', 'einbroch', 'morocc'])
  assert.equal(projection.rows.has(town), false, town);
assert.equal(projection.rows.get('mjolnir_07')?.kind, 'farm');
const unavailablePositioned = [...positioned].filter((map) =>
  !complete.catalog.get(map)?.farmSelectionAvailable &&
  !complete.catalog.get(map)?.townTeleportAvailable);
assert.ok(unavailablePositioned.length > 0);
for (const map of unavailablePositioned) assert.equal(visible.has(map), false, map);
assert.equal(complete.catalog.get('geffen')?.townTeleportAvailable, true);
assert.equal(complete.catalog.get('geffen')?.kind, 'town');
assert.equal(projection.unresolvedTowns.some((row) =>
  row.map === 'geffen' && row.reason === 'NAVIGATION_PATH_COST_UNAVAILABLE'), true);
const projectionJson = JSON.stringify(projection.worldMap);
for (const internal of ['NO_AUTHORIZED_NORMAL_SPAWN_EVIDENCE',
  'WORLD_MAP_DESTINATION_UNAVAILABLE', 'availabilityReason', 'unlockCondition',
  'bossMonsters', 'resourceMonsters'])
  assert.equal(projectionJson.includes(internal), false, internal);
assert.deepEqual(parseKafraSavedPoints([{ path: 'test', text:
  'savepoint "prontera",116,73,1,1;\nsavepoint "prontera",116,73,1,1;' }])
  .get('prontera'), [{ map: 'prontera', x: 116, y: 73, source: 'test' }]);
const noSpawns = buildPlayerWorldMapProjection({ ...complete,
  sourceIndex: { maps: [] }, savedPointSources });
assert.equal(noSpawns.rows.get('mjolnir_07'), undefined);
assert.equal(noSpawns.rows.get('prontera')?.kind, 'town');
const app = await readFile(join(root, 'ops/ro-stack/dashboard/app.js'), 'utf8');
const worldMapUi = app.slice(app.indexOf('function renderWorldMapNodes()'),
  app.indexOf('function syncMapInfoToLive('));
const townUi = app.slice(app.indexOf('function renderWorldMapTowns()'),
  app.indexOf('function syncDiscordUi('));
assert.match(worldMapUi, /farmMapAvailabilityData\?\.worldMap/);
assert.doesNotMatch(worldMapUi, /mapInfoData\?\.worldMap|selectLockedWorldMap|尚未開放|availabilityReason/);
assert.match(townUi, /`傳送至\$\{town\.name/);
assert.match(townUi, /town\.savedPoint\.x/);
assert.match(townUi, /save\.disabled = saved \|\| !physicallyHere/);
console.log(JSON.stringify({
  result: 'PASS', farmMaps: [...projection.rows.values()].filter((row) =>
    row.kind === 'farm').length,
  towns: [...projection.rows.values()].filter((row) => row.kind === 'town').length,
  hiddenMaps: projection.hiddenMapCount,
  unresolvedTowns: projection.unresolvedTowns.length,
}));
