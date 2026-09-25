import { inflateSync } from 'node:zlib';

const mapIdPattern = /^[a-z0-9_]{1,31}$/;

export function parseKafraSavedPoints(sources) {
  const byMap = new Map();
  for (const { path, text } of sources) {
    for (const line of String(text).split(/\r?\n/)) {
      const match = line.match(/^\s*savepoint\s+"([a-z0-9_]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
      if (!match || !mapIdPattern.test(match[1])) continue;
      const map = match[1], x = Number(match[2]), y = Number(match[3]);
      const candidates = byMap.get(map) ?? [];
      if (!candidates.some((point) => point.x === x && point.y === y))
        candidates.push({ map, x, y, source: path });
      byMap.set(map, candidates);
    }
  }
  return byMap;
}

function passableTownCell(mapCache, map, x, y) {
  const cached = mapCache.get(map);
  if (!cached || x <= 0 || y <= 0 || x >= cached.width - 1 || y >= cached.height - 1)
    return false;
  try {
    const cells = inflateSync(cached.compressed);
    return cells.length === cached.width * cached.height &&
      [0, 3].includes(cells[y * cached.width + x]);
  } catch { return false; }
}

function playerSummary(summary, kind) {
  if (kind === 'town') return { id: summary.id, name: summary.name, category: 'TOWN' };
  return {
    id: summary.id, name: summary.name, category: summary.category,
    dungeon: summary.dungeon,
    levelRange: summary.levelRange, fullLevelRange: summary.fullLevelRange,
    normalMonsterCount: summary.normalMonsterCount,
    primaryMonsters: summary.primaryMonsters,
  };
}

// The complete catalog remains available to internal diagnostics. This view
// contains only destinations admitted for the normal Player World Map.
export function buildPlayerWorldMapProjection({ mapInfo, catalog, mapCache,
  townFlagMaps, sourceIndex, savedPointSources }) {
  const savedPoints = parseKafraSavedPoints(savedPointSources);
  const normalSpawns = new Set(sourceIndex.maps.filter((row) =>
    row.monsters?.length > 0 && !(row.blockedFlags?.length > 0))
    .map((row) => row.map));
  const positioned = new Set(mapInfo.worldMap.regions.flatMap((region) => region.mapIds));
  const rows = new Map(), unresolvedTowns = [];
  for (const map of positioned) {
    const summary = mapInfo.maps[map], row = catalog.get(map);
    if (!summary || !row) continue;
    if (townFlagMaps.has(map)) {
      if (row.kind !== 'town' || row.townTeleportAvailable !== true) {
        unresolvedTowns.push({ map, reason: 'TOWN_TRAVEL_UNAVAILABLE' });
        continue;
      }
      const legal = (savedPoints.get(map) ?? []).filter((point) =>
        passableTownCell(mapCache, map, point.x, point.y));
      const savedPoint = map === 'prontera'
        ? legal.find((point) => point.x === 116 && point.y === 73)
        : legal.length === 1 ? legal[0] : null;
      if (!savedPoint) {
        unresolvedTowns.push({ map, reason: legal.length > 1
          ? 'NAVIGATION_PATH_COST_UNAVAILABLE' : 'CANONICAL_SAVED_POINT_UNAVAILABLE' });
        continue;
      }
      rows.set(map, { ...row, kind: 'town', farmable: false,
        farmSelectionAvailable: false, townTeleportAvailable: true,
        landing: { x: savedPoint.x, y: savedPoint.y, source: savedPoint.source },
        savedPoint: { map, x: savedPoint.x, y: savedPoint.y } });
    } else if (row.kind === 'farm' && row.farmable === true &&
        row.farmSelectionAvailable === true && row.normalMonsterCount > 0 &&
        row.landing && summary.unlocked === true && normalSpawns.has(map)) {
      rows.set(map, row);
    }
  }
  const regions = mapInfo.worldMap.regions.flatMap((region) => {
    const mapIds = region.mapIds.filter((map) => rows.has(map));
    if (!mapIds.length) return [];
    const mapId = mapIds.includes(region.mapId) ? region.mapId : mapIds[0];
    return [{ regionId: region.regionId, mapId, mapIds,
      name: mapInfo.maps[mapId].name,
      labelKind: rows.get(mapId).kind === 'town' ? 'town' : region.labelKind,
      position: region.position,
      levelRange: rows.get(mapId).kind === 'farm'
        ? mapInfo.maps[mapId].levelRange : null }];
  });
  const maps = Object.fromEntries([...rows].map(([map, row]) =>
    [map, playerSummary(mapInfo.maps[map], row.kind)]));
  return {
    rows, unresolvedTowns,
    hiddenMapCount: positioned.size - rows.size,
    worldMap: { image: mapInfo.worldMap.image, width: mapInfo.worldMap.width,
      height: mapInfo.worldMap.height, regions, maps },
  };
}
