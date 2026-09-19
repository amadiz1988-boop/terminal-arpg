import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

const nativeRoot = process.env.RATHENA_SOURCE_ROOT;
const runtimeRoot = process.env.RATHENA_RUNTIME_ROOT;
assert.ok(nativeRoot, 'RATHENA_SOURCE_ROOT is required');
assert.ok(runtimeRoot, 'RATHENA_RUNTIME_ROOT is required');

const warpFile = `${nativeRoot}/npc/warps/fields/mtmjolnir.txt`;
const mapCacheFile = `${runtimeRoot}/db/map_cache.dat`;
const warpText = await readFile(warpFile, 'utf8');
const cache = await readFile(mapCacheFile);

function parseWarps(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('//'))
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields[1] === 'warp' && fields.length >= 4)
    .map((fields) => {
      const [map, x, y] = fields[0].split(',');
      const [xs, ys, to, toX, toY] = fields[3].split(',');
      return { map, x: Number(x), y: Number(y), xs: Number(xs), ys: Number(ys), to, toX: Number(toX), toY: Number(toY) };
    });
}

function parseMapCache(buffer, mapName) {
  const mapCount = buffer.readUInt16LE(4);
  let offset = 8;
  for (let index = 0; index < mapCount; index += 1) {
    const name = buffer.toString('ascii', offset, offset + 12).split('\0', 1)[0];
    const xs = buffer.readInt16LE(offset + 12);
    const ys = buffer.readInt16LE(offset + 14);
    const compressedLength = buffer.readInt32LE(offset + 16);
    const compressedStart = offset + 20;
    if (name === mapName) {
      return { xs, ys, cells: inflateSync(buffer.subarray(compressedStart, compressedStart + compressedLength)) };
    }
    offset = compressedStart + compressedLength;
  }
  throw new Error(`map cache entry not found: ${mapName}`);
}

const warps = parseWarps(warpText);
const inbound = warps.find(
  (warp) => warp.map === 'mjolnir_08' && warp.x === 29 && warp.y === 346 && warp.to === 'mjolnir_07',
);
assert.ok(inbound, 'canonical mjolnir_08 -> mjolnir_07 return warp is missing');
assert.deepEqual(
  { map: inbound.to, x: inbound.toX, y: inbound.toY },
  { map: 'mjolnir_07', x: 378, y: 362 },
  'return landing must use the safe terminal coordinate',
);

const targetWarps = warps.filter((warp) => warp.map === 'mjolnir_07');
const inTriggerArea = (warp, x, y) =>
  x >= warp.x - warp.xs && x <= warp.x + warp.xs &&
  y >= warp.y - warp.ys && y <= warp.y + warp.ys;
assert.equal(targetWarps.some((warp) => inTriggerArea(warp, inbound.toX, inbound.toY)), false);

const map = parseMapCache(cache, 'mjolnir_07');
const cell = (x, y) => map.cells[x + y * map.xs];
const passable = (x, y) => x >= 0 && y >= 0 && x < map.xs - 1 && y < map.ys - 1 && cell(x, y) !== 1 && cell(x, y) !== 5;
assert.equal(passable(inbound.toX, inbound.toY), true);
assert.equal(passable(379, 362), true);
assert.equal(targetWarps.some((warp) => inTriggerArea(warp, 379, 362)), false);
assert.equal(targetWarps.some((warp) => inTriggerArea(warp, inbound.toX, inbound.toY)), false);

const outbound = warps.find(
  (warp) => warp.map === 'mjolnir_07' && warp.x === 383 && warp.y === 362 && warp.to === 'mjolnir_08',
);
assert.ok(outbound, 'canonical mjolnir_07 -> mjolnir_08 topology is missing');
assert.deepEqual({ map: outbound.to, x: outbound.toX, y: outbound.toY }, { map: 'mjolnir_08', x: 32, y: 346 });

console.log('SUPPLY_RETURN_SAFE_ENDPOINT_PASS');
console.log(JSON.stringify({
  returnWarp: { from: 'mjolnir_08', to: 'mjolnir_07', x: inbound.toX, y: inbound.toY },
  outboundTopology: { from: 'mjolnir_07', to: outbound.to, x: outbound.toX, y: outbound.toY },
  map: { name: 'mjolnir_07', xs: map.xs, ys: map.ys },
  triggerSafe: true,
  terminalPassable: true,
}));
