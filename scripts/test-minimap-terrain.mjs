import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const root = process.cwd();
const runtimeFields = resolve(root, '.local', 'ro-stack', 'openkore', 'fields');
const rathenaDb = resolve(root, '.local', 'ro-stack', 'rathena', 'db');
const publicMaps = resolve(root, 'public', 'ro', 'maps');

function validFld2(bytes) {
  if (bytes.length < 4) return false;
  const width = bytes.readUInt16LE(0);
  const height = bytes.readUInt16LE(2);
  return width > 0 && height > 0 && bytes.length === width * height + 4;
}

function mapCacheNames(bytes) {
  const names = [];
  if (bytes.length < 8) return names;
  const mapCount = bytes.readUInt16LE(4);
  let offset = 8;
  for (let index = 0; index < mapCount; index += 1) {
    assert.ok(
      offset + 20 <= bytes.length,
      'rAthena cache record is incomplete',
    );
    const name = bytes
      .subarray(offset, offset + 12)
      .toString('ascii')
      .replace(/\0.*$/, '');
    const compressedLength = bytes.readInt32LE(offset + 16);
    offset += 20 + compressedLength;
    assert.ok(
      offset <= bytes.length,
      `${name} rAthena cache data is incomplete`,
    );
    names.push(name);
  }
  return names;
}

async function loadField(mapName) {
  const response = await fetch(
    `${origin}/ro/maps/${encodeURIComponent(mapName)}.fld2.bin?v=2`,
    { cache: 'no-store' },
  );
  assert.equal(response.status, 200, `${mapName} terrain request failed`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(validFld2(bytes), `${mapName} terrain payload is invalid`);
  const width = bytes.readUInt16LE(0);
  const height = bytes.readUInt16LE(2);
  const walkable = bytes
    .subarray(4)
    .reduce((count, cell) => count + ((cell & 1) === 1 ? 1 : 0), 0);
  return {
    mapName,
    width,
    height,
    walkable,
    source: response.headers.get('x-ro-map-source') ?? 'public-asset',
    cacheControl: response.headers.get('cache-control'),
  };
}

const runtimeFileNames = (await readdir(runtimeFields)).filter((name) =>
  name.endsWith('.fld2.gz'),
);
const validRuntimeMaps = new Set();
const invalidRuntimeMaps = [];
for (const fileName of runtimeFileNames) {
  const mapName = fileName.slice(0, -'.fld2.gz'.length);
  try {
    if (validFld2(gunzipSync(await readFile(resolve(runtimeFields, fileName)))))
      validRuntimeMaps.add(mapName);
    else invalidRuntimeMaps.push(mapName);
  } catch {
    invalidRuntimeMaps.push(mapName);
  }
}

const publicMapNames = new Set(
  (await readdir(publicMaps))
    .filter((name) => name.endsWith('.fld2.bin'))
    .map((name) => name.slice(0, -'.fld2.bin'.length)),
);
const cacheMapNames = new Set();
for (const cachePath of [
  resolve(rathenaDb, 'import', 'map_cache.dat'),
  resolve(rathenaDb, 're', 'map_cache.dat'),
  resolve(rathenaDb, 'map_cache.dat'),
]) {
  for (const name of mapCacheNames(await readFile(cachePath)))
    cacheMapNames.add(name);
}

const serverMapNames = [...cacheMapNames].sort();
const maps = [];
for (let index = 0; index < serverMapNames.length; index += 32) {
  maps.push(
    ...(await Promise.all(
      serverMapNames.slice(index, index + 32).map(loadField),
    )),
  );
}

for (const field of maps) {
  const expectedSource = publicMapNames.has(field.mapName)
    ? 'public-asset'
    : validRuntimeMaps.has(field.mapName)
      ? 'openkore-runtime'
      : 'rathena-cache';
  assert.equal(
    field.source,
    expectedSource,
    `${field.mapName} did not use the expected terrain source`,
  );
}

const southGate = maps.find((field) => field.mapName === 'prt_fild08');
const payonDungeon = maps.find((field) => field.mapName === 'pay_dun00');
const instanceMap = maps.find((field) => field.mapName.includes('@'));
const cacheOnlyMap = maps.find((field) => field.source === 'rathena-cache');
assert.ok(southGate?.walkable > 0, 'prt_fild08 walkable terrain is missing');
assert.ok(payonDungeon?.walkable > 0, 'pay_dun00 walkable terrain is missing');
assert.ok(instanceMap, 'instance map coverage is missing');
assert.ok(cacheOnlyMap, 'rAthena cache fallback coverage is missing');
assert.equal(payonDungeon.source, 'openkore-runtime');
assert.match(payonDungeon.cacheControl ?? '', /max-age=3600/);

const unknown = await fetch(`${origin}/ro/maps/__missing_map__.fld2.bin`);
assert.equal(unknown.status, 404);

console.log(
  JSON.stringify(
    {
      result: 'MINIMAP_TERRAIN_PASS',
      checkedServerMaps: maps.length,
      openKoreFieldFiles: runtimeFileNames.length,
      invalidOpenKoreFieldFiles: invalidRuntimeMaps.length,
      invalidOpenKoreMaps: invalidRuntimeMaps.sort(),
      publicAssetMaps: maps.filter((field) => field.source === 'public-asset')
        .length,
      runtimeFallbackMaps: maps.filter(
        (field) => field.source === 'openkore-runtime',
      ).length,
      rathenaCacheFallbackMaps: maps.filter(
        (field) => field.source === 'rathena-cache',
      ).length,
      samples: [southGate, payonDungeon, instanceMap, cacheOnlyMap],
    },
    null,
    2,
  ),
);
