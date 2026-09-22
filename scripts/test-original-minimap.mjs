import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({ globalThis: {} });
vm.runInContext(
  await readFile('ops/ro-stack/dashboard/original-minimap.js', 'utf8'),
  context,
);
const minimap = context.globalThis.roOriginalMinimap;
const manifest = JSON.parse(
  await readFile('public/ro/client/minimaps/manifest.json', 'utf8'),
);
const plain = (value) => JSON.parse(JSON.stringify(value));
const dashboardSource = await readFile('ops/ro-stack/dashboard/app.js', 'utf8');
const dashboardDocument = await readFile('ops/ro-stack/dashboard/index.html', 'utf8');
const minimapFiles = await readdir('public/ro/client/minimaps');

assert.equal(manifest.coverage.standardFarmRelease.count, 136);
assert.equal(manifest.coverage.specialTransportHold.count, 24);
assert.equal(minimapFiles.filter((file) => file.endsWith('.png')).length, 158);
assert.match(dashboardDocument, /original-minimap\.js\?v=ro-original-minimap-v1/);
assert.match(dashboardSource, /background\.image/);
assert.match(dashboardSource, /worldMapCoordinate/);
assert.match(dashboardSource, /live\.portals/);
assert.match(dashboardSource, /live\.npcs/);
assert.match(dashboardSource, /Array\.isArray\(live\.route\)/);
assert.match(dashboardSource, /RO_MINIMAP_DEBUG/);
for (const map of ['prt_fild05', 'prt_fild08', 'pay_dun00', 'prontera']) {
  const entry = manifest.entries.find((candidate) => candidate.map === map);
  assert.ok(entry, `${map} manifest entry missing`);
  assert.equal(entry.availability, 'AVAILABLE', `${map} original minimap missing`);
  assert.equal(entry.sourceFormat, 'BMP');
  assert.match(entry.sourceHash, /^[a-f0-9]{64}$/);
  assert.match(entry.outputHash, /^[a-f0-9]{64}$/);
  assert.ok(entry.width > 0 && entry.height > 0);
}

const square = minimap.fitRect(720, 420, 512, 512);
assert.deepEqual(plain(square), { x: 150, y: 0, width: 420, height: 420 });
const map = { width: 300, height: 200 };
assert.deepEqual(plain(minimap.worldMapCoordinate({ x: 0, y: 200 }, map, square)), {
  x: 150,
  y: 0,
});
assert.deepEqual(plain(minimap.worldMapCoordinate({ x: 300, y: 0 }, map, square)), {
  x: 570,
  y: 420,
});
assert.deepEqual(plain(minimap.worldMapCoordinate({ x: 150, y: 100 }, map, square)), {
  x: 360,
  y: 210,
});

const zoomed = minimap.viewportRect(
  square,
  map,
  { x: 150, y: 100 },
  2,
  { width: 720, height: 420 },
);
assert.deepEqual(plain(zoomed), { x: -60, y: -210, width: 840, height: 840 });
const zoomedCenter = minimap.worldMapCoordinate(
  { x: 150, y: 100 },
  map,
  zoomed,
);
assert.deepEqual(plain(zoomedCenter), { x: 360, y: 210 });

class ReadyImage {
  set src(value) {
    this._src = value;
    this.naturalWidth = 512;
    this.naturalHeight = 512;
    queueMicrotask(() => this.onload());
  }
}
const fetchImpl = async () => ({ ok: true, json: async () => manifest });
const manager = minimap.createManager({ fetchImpl, ImageClass: ReadyImage });
await manager.load('prt_fild08');
assert.equal(manager.state('prt_fild08').mode, 'RO_ORIGINAL');
await manager.load('__missing__');
assert.equal(manager.state('__missing__').mode, 'COLLISION_MAP');
assert.equal(
  manager.state('__missing__').reason,
  minimap.FALLBACK_REASONS.MISSING,
);
manager.setMode('collision');
assert.equal(manager.state('prt_fild08').reason, 'DEBUG_COLLISION_MODE');
assert.equal(manager.setZoom(99), 8);
assert.equal(manager.setZoom(0), 1);

console.log(
  JSON.stringify(
    {
      result: 'RO_ORIGINAL_MINIMAP_TEST_PASS',
      standardCoverage: manifest.coverage.standardFarmRelease,
      specialTransportCoverage: manifest.coverage.specialTransportHold,
      coordinateCases: 4,
      fallbackCases: 2,
    },
    null,
    2,
  ),
);
