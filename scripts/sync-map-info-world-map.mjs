import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ??
  'C:/Users/Administrator/source/ghost-island-rathena';
const publicRoot = process.env.RO_MAP_INFO_PUBLIC_ROOT ?? join(root, 'public');
const indexPath = join(publicRoot, 'ro/data/map-info.json');
const index = JSON.parse(await readFile(indexPath, 'utf8'));
const { catalog } = await loadWorldMapTestCatalog(root, native,
  { mapInfoPath: indexPath, publicRoot });
const visibleMapIds = new Set(index.worldMap.regions.flatMap((region) => region.mapIds));
const nonPersistent = new Set(['INSTANCE', 'EVENT', 'TEST', 'UNUSED']);

for (const [mapId, summary] of Object.entries(index.maps)) {
  const row = catalog.get(mapId);
  if (!row) throw new Error(`MAP_INFO_CATALOG_ROW_MISSING ${mapId}`);
  const farm = row.farmSelectionAvailable === true;
  const townTeleport = row.townTeleportAvailable === true;
  summary.farmSelectionAvailable = farm;
  summary.townTeleportAvailable = townTeleport;
  summary.availableForAfk = farm;
  summary.unlocked = farm;
  summary.selectable = farm;
  summary.grindable = farm;
  summary.worldMapSelectable = visibleMapIds.has(mapId) &&
    !nonPersistent.has(summary.category) &&
    row.availabilityReason !== 'MAP_NOT_LOADED';
  summary.availabilityReason = farm || townTeleport ? null : row.availabilityReason;
  // The legacy release registry route class does not describe direct World Map
  // transport. Leave it unset until the canonical catalog supplies one.
  summary.routeClass = null;
}
for (const region of index.worldMap.regions) {
  const availableMapIds = region.mapIds.filter((mapId) =>
    index.maps[mapId]?.farmSelectionAvailable).sort((a, b) =>
    (index.maps[a]?.dungeon?.order ?? Number.MAX_SAFE_INTEGER) -
      (index.maps[b]?.dungeon?.order ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b));
  region.availableMapIds = availableMapIds;
  region.availableForAfk = availableMapIds.length > 0;
  region.unlocked = region.availableForAfk;
  region.selectable = region.availableForAfk;
  region.unlockCondition = region.availableForAfk ? null : '目前不符合掛機地圖條件';
}
// No consumer uses generatedAt as authority. A wall-clock value would make
// identical canonical inputs produce different bytes on each build.
index.generatedAt = null;
index.sourceMatrix = 'current-visible-world-map-roots + rAthena preflight catalog';
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`RO_MAP_INFO_WORLD_MAP_SYNC maps=${Object.keys(index.maps).length} ` +
  `farm=${Object.values(index.maps).filter((map) => map.farmSelectionAvailable).length}`);
