import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ??
  'C:/Users/Administrator/source/ghost-island-rathena';
const { mapInfo, catalog } = await loadWorldMapTestCatalog(root, native);
const regions = mapInfo.worldMap.regions.map((region) => {
  const floors = region.mapIds.map((mapId) => {
    const summary = mapInfo.maps[mapId];
    const row = catalog.get(mapId);
    if (!summary || !row || (!row.farmSelectionAvailable &&
        !row.townTeleportAvailable && !row.availabilityReason))
      throw new Error(`VISIBLE_FLOOR_UNCLASSIFIED ${region.regionId} ${mapId}`);
    return {
      mapId,
      displayName: summary.name,
      floorDisplayName: summary.dungeon?.floorLabel ?? summary.name,
      worldMapSelectable: true,
      farmMapAvailable: row.farmSelectionAvailable === true,
      teleportAvailable: row.farmSelectionAvailable === true ||
        row.townTeleportAvailable === true,
      reason: row.farmSelectionAvailable || row.townTeleportAvailable
        ? 'SUPPORTED' : row.availabilityReason,
      minFarmLevel: row.minLevel ?? null,
      eligibleMonsterCount: row.normalMonsterCount ?? 0,
      teleportSafeLanding: row.landing ?? null,
      paidCostZenyFromBaseLevel67: row.minLevel ? row.minLevel * 10 : null,
      mapDetail: summary.detail,
    };
  });
  return {
    regionId: region.regionId,
    displayLabel: region.name,
    labelKind: region.labelKind,
    entryMap: region.mapId,
    position: region.position,
    worldMapSelectable: true,
    farmMapAvailable: floors.some((floor) => floor.farmMapAvailable),
    teleportAvailable: floors.some((floor) => floor.teleportAvailable),
    floorCount: floors.length,
    floors,
  };
});
const uniqueFloors = new Map(regions.flatMap((region) => region.floors
  .map((floor) => [floor.mapId, floor])));
const counts = {
  visibleLabelsTotal: regions.length,
  normalLabels: regions.filter((row) => row.labelKind === 'normal').length,
  redLabels: regions.filter((row) => row.labelKind === 'red').length,
  townLabels: regions.filter((row) => row.labelKind === 'town').length,
  redDungeonGroups: regions.filter((row) => row.labelKind === 'red' && row.floorCount > 1).length,
  redDungeonFloors: regions.filter((row) => row.labelKind === 'red')
    .reduce((total, row) => total + row.floorCount, 0),
  visibleUniqueFloors: uniqueFloors.size,
  farmEnabledFloors: [...uniqueFloors.values()].filter((row) => row.farmMapAvailable).length,
  teleportEnabledFloors: [...uniqueFloors.values()].filter((row) => row.teleportAvailable).length,
  visibleLabelUnclassified: 0,
  visibleFloorUnclassified: 0,
};
const blockedByReason = Object.fromEntries([...uniqueFloors.values()]
  .filter((row) => !row.teleportAvailable)
  .reduce((result, row) => result.set(row.reason,
    (result.get(row.reason) ?? 0) + 1), new Map()));
const output = {
  schemaVersion: 1,
  source: ['authorized Gravity world map image + worldviewdata positions',
    'rAthena active spawn inventory + map cache + physical warp topology',
    'Ghost Island canonical World Map teleport preflight catalog'],
  authorityBoundary: 'preflight only; rAthena Native command decides actual admission',
  counts, blockedByReason, regions,
};
const target = join(root, 'docs/openkore-reference/world-map-visible-coverage.json');
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`WORLD_MAP_VISIBLE_COVERAGE_BUILT ${JSON.stringify(counts)} blocked=${JSON.stringify(blockedByReason)}`);
