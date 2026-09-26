import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildWorldMapTeleportCatalog, parseBlockedWorldMapFlags,
  parseTownMapFlags } from '../../ops/ro-stack/persistent-agent/world-map-teleport-catalog.mjs';
import { loadWarpGraph } from '../../ops/ro-stack/persistent-agent/map-route.mjs';

function readMapCache(bytes) {
  const result = new Map();
  const count = bytes.readUInt16LE(4);
  let offset = 8;
  for (let index = 0; index < count; index += 1) {
    const name = bytes.subarray(offset, offset + 12).toString('ascii').replace(/\0.*$/, '');
    const width = bytes.readInt16LE(offset + 12);
    const height = bytes.readInt16LE(offset + 14);
    const length = bytes.readInt32LE(offset + 16);
    const start = offset + 20;
    assert.ok(length > 0 && start + length <= bytes.length);
    result.set(name, { width, height, compressed: bytes.subarray(start, start + length) });
    offset = start + length;
  }
  return result;
}

export async function loadWorldMapTestCatalog(root, native, {
  mapInfoPath = join(root, 'public/ro/data/map-info.json'),
  publicRoot = join(root, 'public'),
} = {}) {
  const mapInfo = JSON.parse(await readFile(mapInfoPath, 'utf8'));
  const mapCache = new Map();
  for (const relative of ['db/import/map_cache.dat', 'db/re/map_cache.dat', 'db/map_cache.dat'])
    for (const [name, map] of readMapCache(await readFile(join(native, relative))))
      if (!mapCache.has(name)) mapCache.set(name, map);
  const graph = await loadWarpGraph(native);
  const townFlagMaps = new Set([
    ...parseTownMapFlags(await readFile(join(native, 'npc/mapflag/town.txt'), 'utf8')),
    ...parseTownMapFlags(await readFile(join(native, 'npc/re/mapflag/town.txt'), 'utf8')),
  ]);
  const blockedFlagMaps = new Set((await Promise.all([
    'npc/mapflag/nowarpto.txt', 'npc/re/mapflag/nowarpto.txt',
    'npc/mapflag/restricted.txt', 'npc/re/mapflag/restricted.txt',
    'npc/mapflag/gvg.txt', 'npc/re/mapflag/gvg.txt',
    'npc/mapflag/battleground.txt',
  ].map(async (path) => [...parseBlockedWorldMapFlags(
    await readFile(join(native, path), 'utf8'))]))).flat());
  const mapNames = JSON.parse(await readFile(join(root,
    'public/ro/data/map-names.json'), 'utf8')).entries;
  const sourceIndex = JSON.parse(await readFile(join(root,
    'ops/ro-stack/persistent-agent/world-map-teleport-source.json'), 'utf8'));
  const catalog = await buildWorldMapTeleportCatalog({ mapInfo, mapCache, graph,
    publicRoot, townFlagMaps, blockedFlagMaps, mapNames, sourceIndex });
  return { mapInfo, catalog, sourceIndex, mapCache, graph, townFlagMaps,
    blockedFlagMaps, mapNames };
}
