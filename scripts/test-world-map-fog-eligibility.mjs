import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('ops/ro-stack/dashboard/app.js', 'utf8');
const css = fs.readFileSync('ops/ro-stack/dashboard/styles.css', 'utf8');
const mapInfo = JSON.parse(fs.readFileSync('public/ro/data/map-info.json', 'utf8'));
const registry = JSON.parse(
  fs.readFileSync(
    'ops/ro-stack/persistent-agent/standard-farm-map-release-registry.json',
    'utf8',
  ),
);

assert.match(app, /farmMapSelectionAvailable\(mapId, mapSummaries\[mapId\]\)/);
assert.match(app, /hitArea\.className = `world-map-region selectable \$\{selectable \? 'farmable' : 'inspection-only'\}`/);
assert.match(app, /hitArea\.dataset\.mapSelectable = 'true'/);
assert.match(app, /\$\('#worldMapCanvas'\)\.onclick = \(event\) =>/);
assert.match(app, /worldMapRegionsAtPoint\(event, regions\)/);
assert.match(app, /world-map-overlap-picker/);
assert.doesNotMatch(app, /PRODUCT RULE: every known map is visible and selectable/);
assert.match(css, /\.world-map-region\.fogged[\s\S]*filter: grayscale\(1\) brightness\(0\.42\)/);

const farmableIds = Object.entries(mapInfo.maps)
  .filter(([, summary]) => summary.farmSelectionAvailable === true)
  .map(([mapId]) => mapId);
// The historical release count is a regression baseline, not an M1 allowlist.
assert.ok(farmableIds.length > 136);
assert.equal(
  registry.maps.filter((row) => row.farmSelectionAvailable).length,
  136,
);
assert.ok(farmableIds.includes('mjolnir_07'));
assert.ok(farmableIds.includes('moc_fild01'));
assert.ok(farmableIds.includes('prt_fild07'));
assert.ok(farmableIds.includes('mjo_dun01'));
assert.ok(!farmableIds.includes('prontera'));
assert.ok(!farmableIds.includes('moc_fild20'));
assert.ok(farmableIds.includes('iz_dun02'));
assert.ok(mapInfo.worldMap.regions.some((region) => region.mapId === 'prontera'));
assert.equal(mapInfo.worldMap.regions.filter((region) => region.labelKind === 'red').length, 29);
assert.equal(mapInfo.worldMap.regions.flatMap((region) => region.mapIds)
  .every((mapId) => Boolean(mapInfo.maps[mapId])), true);

console.log('WORLD_MAP_INSPECTION_AND_FARM_ELIGIBILITY_PASS');
