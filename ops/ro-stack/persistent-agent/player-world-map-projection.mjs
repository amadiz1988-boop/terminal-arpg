import { inflateSync } from 'node:zlib';
import { KAFRA_CONTENT } from './kafra-content.mjs';
import { buildWorldMapDestinationList } from './world-map-destination-list.mjs';

const mapIdPattern = /^[a-z0-9_]{1,31}$/;
const fieldSaveHubs = new Set(['cmd_fild07', 'prt_fild05']);
const nonFlagTowns = new Set(['morocc', 'moscovia']);

// Match the loaded-script extraction rules in Native's Kafra catalog generator.
export function parseKafraSavedPoints(sources) {
  const byMap = new Map();
  for (const { path, text } of sources) {
    const lines = String(text).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const declaration = lines[index].match(/^([a-z0-9_]+),\d+,\d+,\d+\s+script\s+(.+?)\t[^\t]+,\{\s*$/i);
      if (!declaration) continue;
      const start = index, body = [];
      while (++index < lines.length && !/^}\s*$/.test(lines[index])) body.push(lines[index]);
      if (index === lines.length) throw new Error(`Unclosed Kafra script: ${path}:${start + 1}`);
      const script = body.join('\n');
      const kafra = script.match(/callfunc\s+"F_Kafra"\s*,\s*(\d+)\s*,\s*(\d+)/);
      const directSave = /select\("Save(?::|"\))/.test(script);
      if (!kafra && !directSave) continue;
      if (kafra) {
        const welcome = Number(kafra[1]), menu = Number(kafra[2]);
        if (welcome === 2 || [2, 5, 6, 9].includes(menu)) continue;
        if (![0, 1, 3, 4, 7, 8, 10].includes(menu))
          throw new Error(`Unclassified Kafra menu: ${path}:${start + 1} (${menu})`);
      }
      for (const match of script.matchAll(/savepoint\s+"([a-z0-9_]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*1\s*,\s*1\s*;/g)) {
        const [, map, xText, yText] = match;
        if (!mapIdPattern.test(map) || map !== declaration[1])
          throw new Error(`Kafra save map differs from service map: ${path}:${start + 1}`);
        const point = { map, x: Number(xText), y: Number(yText),
          npc: declaration[2].split('::').at(-1), source: path,
          line: start + 1 + script.slice(0, match.index).split('\n').length };
        const candidates = byMap.get(map) ?? [];
        if (!candidates.some((row) => row.x === point.x && row.y === point.y))
          candidates.push(point);
        byMap.set(map, candidates);
      }
    }
  }
  for (const candidates of byMap.values())
    candidates.sort((a, b) => a.x - b.x || a.y - b.y);
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

export function buildPlayerWorldMapProjection({ mapInfo, catalog, mapCache,
  townFlagMaps, sourceIndex, savedPointSources, mapNames = {}, graph = new Map() }) {
  const savedPoints = parseKafraSavedPoints(savedPointSources);
  const normalSpawns = new Set(sourceIndex.maps.filter((row) =>
    row.monsters?.length > 0 && !(row.blockedFlags?.length > 0))
    .map((row) => row.map));
  const positioned = new Set(mapInfo.worldMap.regions.flatMap((region) => region.mapIds));
  const rows = new Map(), farmRows = new Map(), townRows = new Map();
  const unresolvedTowns = [];
  for (const map of positioned) {
    const summary = mapInfo.maps[map], row = catalog.get(map);
    if (!summary || !row) continue;
    if (row.kind === 'farm' && row.farmable === true &&
        row.farmSelectionAvailable === true && row.normalMonsterCount > 0 &&
        row.landing && summary.unlocked === true && normalSpawns.has(map)) {
      farmRows.set(map, row);
      rows.set(map, row);
    }
  }
  for (const [map, candidates] of savedPoints) {
    const legal = candidates.filter((point) => passableTownCell(mapCache, map, point.x, point.y));
    if (!legal.length) continue;
    const savedPoint = map === 'prontera'
      ? legal.find((point) => point.x === 116 && point.y === 73)
      : legal[0];
    if (!savedPoint) continue;
    const summary = mapInfo.maps[map] ?? { id: map, name: mapNames[map] ?? map };
    const locationClass = fieldSaveHubs.has(map) ? 'FIELD_SAVE_HUB'
      : townFlagMaps.has(map) || nonFlagTowns.has(map) ? 'ACTUAL_TOWN' : 'SERVICE_HUB';
    const row = { map, name: summary.name, kind: 'town', locationClass,
      kafraSaveService: true, farmable: false, farmSelectionAvailable: false,
      townTeleportAvailable: true, minLevel: null,
      landing: { x: savedPoint.x, y: savedPoint.y, source: savedPoint.source },
      savedPoint: { map, x: savedPoint.x, y: savedPoint.y },
      saveDestinations: legal.map(({ x, y }) => ({ x, y })) };
    townRows.set(map, row);
    if (!rows.has(map)) rows.set(map, row);
  }
  // Izlude's rAthena save command uses a conditional map expression, so it is
  // not part of Native's static Kafra catalog. Its existing MF_TOWN path stays.
  const izlude = KAFRA_CONTENT.izlude;
  const izludeCatalog = catalog.get('izlude');
  if (!townRows.has('izlude') && izludeCatalog?.townTeleportAvailable &&
      passableTownCell(mapCache, 'izlude', izlude.saveX, izlude.saveY)) {
    const row = { ...izludeCatalog, locationClass: 'ACTUAL_TOWN',
      landing: { x: izlude.saveX, y: izlude.saveY, source: 'rathena-kafra-save:izlude' },
      savedPoint: { map: 'izlude', x: izlude.saveX, y: izlude.saveY } };
    townRows.set('izlude', row);
    if (!rows.has('izlude')) rows.set('izlude', row);
  }
  for (const map of positioned)
    if (townFlagMaps.has(map) && !townRows.has(map))
      unresolvedTowns.push({ map, reason: 'NO_PERMANENT_KAFRA_SAVE_SERVICE' });
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
    [map, playerSummary(mapInfo.maps[map] ?? { id: map, name: row.name }, row.kind)]));
  const destinationList = buildWorldMapDestinationList({ farmRows, townRows,
    sourceIndex, graph });
  return {
    rows, farmRows, townRows, savedPoints, unresolvedTowns, destinationList,
    hiddenMapCount: positioned.size - [...rows.keys()].filter((map) => positioned.has(map)).length,
    worldMap: { image: mapInfo.worldMap.image, width: mapInfo.worldMap.width,
      height: mapInfo.worldMap.height, regions, maps },
  };
}
