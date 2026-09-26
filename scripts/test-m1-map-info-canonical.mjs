import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
mkdirSync(join(root, '.local'), { recursive: true });
const auditRoot = realpathSync(join(root, '.local'));
const outputs = [0, 1].map(() => mkdtempSync(join(auditRoot, 'm1-map-info-repro-')));

try {
  for (const output of outputs)
    execFileSync(process.execPath, ['scripts/build-ro-map-info.mjs'], {
      cwd: root,
      env: { ...process.env, RO_MAP_INFO_PUBLIC_ROOT: output },
      stdio: 'pipe',
      timeout: 30_000,
    });

  const dataRoots = outputs.map((output) => join(output, 'ro', 'data'));
  const files = ['map-info.json', ...readdirSync(join(dataRoots[0], 'map-info'))
    .filter((name) => name.endsWith('.json')).map((name) => join('map-info', name))];
  for (const file of files)
    assert.ok(readFileSync(join(dataRoots[0], file)).equals(
      readFileSync(join(dataRoots[1], file))), `nondeterministic output: ${file}`);
  const checkedInDataRoot = join(root, 'public', 'ro', 'data');
  for (const file of files)
    assert.ok(readFileSync(join(dataRoots[0], file)).equals(
      readFileSync(join(checkedInDataRoot, file))), `stale generated output: ${file}`);

  const index = JSON.parse(readFileSync(join(dataRoots[0], 'map-info.json'), 'utf8'));
  const visible = new Set(index.worldMap.regions.flatMap((region) => region.mapIds));
  assert.equal(index.generatedAt, null);
  assert.equal(index.worldMap.regions.length, 249);
  assert.equal(visible.size, 360);
  assert.equal(files.length, Object.keys(index.maps).length + 1);
  assert.equal(Object.values(index.maps).filter((map) => map.farmSelectionAvailable).length, 281);
  for (const [mapId, map] of Object.entries(index.maps)) {
    const farm = map.farmSelectionAvailable === true;
    assert.equal(map.availableForAfk, farm, mapId);
    assert.equal(map.unlocked, farm, mapId);
    assert.equal(map.selectable, farm, mapId);
    if (!visible.has(mapId)) {
      assert.equal(farm, false, mapId);
      assert.equal(map.worldMapSelectable, false, mapId);
      assert.equal(map.availabilityReason, 'OUT_OF_CURRENT_WORLD_MAP_SCOPE', mapId);
    }
    if (farm) {
      assert.equal(visible.has(mapId), true, mapId);
      assert.ok(map.normalMonsterCount > 0, mapId);
      assert.ok(map.fullLevelRange?.min > 0, mapId);
      assert.equal(map.availabilityReason, null, mapId);
    }
  }
  for (const region of index.worldMap.regions)
    assert.deepEqual(new Set(region.availableMapIds), new Set(region.mapIds.filter(
      (mapId) => index.maps[mapId]?.farmSelectionAvailable)), region.regionId);

  console.log(`M1_MAP_INFO_CANONICAL_PASS files=${files.length} roots=${index.worldMap.regions.length} ` +
    `visible=${visible.size} farm=${Object.values(index.maps).filter((map) => map.farmSelectionAvailable).length}`);
} finally {
  for (const output of outputs) {
    const target = realpathSync(output);
    if (!target.startsWith(`${auditRoot}${sep}`) ||
        !target.slice(auditRoot.length + 1).startsWith('m1-map-info-repro-'))
      throw new Error(`REFUSE_TEMP_CLEANUP ${target}`);
    rmSync(target, { recursive: true, force: false });
  }
}
