import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { KAFRA_CONTENT } from './kafra-content.mjs';
import { chooseLandingAnchor, classifyFarmTeleport } from './world-map-teleport-policy.mjs';

export function parseTownMapFlags(text) {
  return new Set(String(text).split(/\r?\n/).map((line) =>
    line.trim().match(/^([a-z0-9_]+)\s+mapflag\s+town(?:\s|$)/)?.[1])
    .filter(Boolean));
}

export function parseBlockedWorldMapFlags(text) {
  return new Set(String(text).split(/\r?\n/).map((line) =>
    line.trim().match(/^([a-z0-9_]+)\s+mapflag\s+(?:nowarpto|restricted|gvg|battleground)(?:\s|$)/)?.[1])
    .filter(Boolean));
}

// Presentation/preflight catalog built from current rAthena script topology,
// active map detail and map cache. The Native command remains authoritative.
export async function buildWorldMapTeleportCatalog({
  mapInfo, mapCache, graph, publicRoot, townFlagMaps = new Set(),
  blockedFlagMaps = new Set(), mapNames = {}, sourceIndex = { maps: [] },
}) {
  const rows = new Map();
  const townEntries = new Map();
  for (const [hubId, hub] of Object.entries(KAFRA_CONTENT)) {
    townEntries.set(hubId, { x: hub.saveX, y: hub.saveY,
      source: `rathena-kafra-save:${hubId}` });
    for (const destination of Object.values(hub.destinations))
      if (!townEntries.has(destination.map))
        townEntries.set(destination.map, { x: destination.x, y: destination.y,
          source: `rathena-kafra-destination:${hubId}` });
  }
  const summaries = { ...(mapInfo.maps ?? {}) };
  const visibleMapIds = new Set((mapInfo.worldMap?.regions ?? [])
    .flatMap((region) => region.mapIds ?? []));
  const sourceRows = new Map(sourceIndex.maps.map((row) => [row.map, row]));
  for (const source of sourceIndex.maps)
    if (!summaries[source.map]) {
      const levels = source.monsters.map((monster) => monster.level);
      summaries[source.map] = { id: source.map, name: source.name,
        category: source.category, detail: null,
        combatMonsterCount: source.monsters.reduce((n, monster) => n + monster.count, 0),
        normalMonsterCount: source.monsters.reduce((n, monster) => n + monster.count, 0),
        totalMonsters: source.monsters.reduce((n, monster) => n + monster.count, 0),
        levelRange: levels.length ? { min: Math.min(...levels), max: Math.max(...levels) } : null,
        fullLevelRange: levels.length ? { min: Math.min(...levels), max: Math.max(...levels) } : null,
        primaryMonsters: source.monsters.slice(0, 8) };
    }
  for (const mapId of townEntries.keys())
    if (townFlagMaps.has(mapId) && !summaries[mapId])
      summaries[mapId] = { category: 'TOWN', name: mapNames[mapId] ?? mapId };
  for (const [mapId, summary] of Object.entries(summaries)) {
    if (!visibleMapIds.has(mapId)) {
      rows.set(mapId, { map: mapId, kind: 'farm', name: summary.name,
        farmable: false, farmSelectionAvailable: false,
        availabilityReason: 'OUT_OF_CURRENT_WORLD_MAP_SCOPE',
        minLevel: null, normalMonsterCount: 0, landing: null });
      continue;
    }
    const cached = mapCache.get(mapId);
    let cells = null;
    if (cached) {
      try {
        cells = inflateSync(cached.compressed);
        if (cells.length !== cached.width * cached.height) cells = null;
      } catch { /* Incomplete map cache fails this destination closed. */ }
    }
    const passable = (x, y) => cells && x > 0 && y > 0 &&
      x < cached.width - 1 && y < cached.height - 1 &&
      [0, 3].includes(cells[y * cached.width + x]);
    if (townFlagMaps.has(mapId)) {
      const town = townEntries.get(mapId);
      let landing = null;
      if (town && cells)
        for (let radius = 0; radius <= 8 && !landing; radius += 1)
          for (let dy = -radius; dy <= radius && !landing; dy += 1)
            for (let dx = -radius; dx <= radius; dx += 1)
              if (Math.max(Math.abs(dx), Math.abs(dy)) === radius &&
                  passable(town.x + dx, town.y + dy)) {
                landing = { x: town.x + dx, y: town.y + dy, source: town.source };
                break;
              }
      if (landing)
        rows.set(mapId, { map: mapId, kind: 'town', name: summary.name,
          farmable: false, farmSelectionAvailable: false,
          townTeleportAvailable: true, minLevel: null,
          landing });
      else
        rows.set(mapId, { map: mapId, kind: 'farm', name: summary.name,
          farmable: false, farmSelectionAvailable: false,
          availabilityReason: town ? 'NO_SAFE_LANDING' :
            'TOWN_NOT_SUPPORTED_FOR_WORLD_TELEPORT',
          minLevel: null, normalMonsterCount: 0, landing: null });
      continue;
    }
    const anchor = chooseLandingAnchor(graph, mapId);
    let landing = null;
    if (anchor && cells)
      for (let radius = 0; radius <= 8 && !landing; radius += 1)
        for (let dy = -radius; dy <= radius && !landing; dy += 1)
          for (let dx = -radius; dx <= radius; dx += 1)
            if (Math.max(Math.abs(dx), Math.abs(dy)) === radius &&
                passable(anchor.x + dx, anchor.y + dy)) {
              landing = { ...anchor, x: anchor.x + dx, y: anchor.y + dy };
              break;
            }
    let detail = null;
    if (summary.detail)
      try {
        detail = JSON.parse(await readFile(join(publicRoot,
          String(summary.detail).replace(/^\//, '')), 'utf8'));
      } catch { /* Missing active spawn detail fails this map closed. */ }
    const source = sourceRows.get(mapId);
    const classification = !source
      ? { available: false, reason: cached
        ? 'NO_AUTHORIZED_NORMAL_SPAWN_EVIDENCE' : 'MAP_NOT_LOADED' }
      : classifyFarmTeleport({
      inventory: { mapExists: true, configuredForLoad: Boolean(cached),
        cacheSource: cached ? 'rathena-map-cache' : null,
        category: source?.category ?? summary.category,
        evidence: { flags: blockedFlagMaps.has(mapId) ? [{ value: 'restricted' }] : [] } },
      detail, landing, eligibleMonsters: source?.monsters,
    });
    rows.set(mapId, { map: mapId, kind: 'farm', name: summary.name,
      farmable: classification.available,
      farmSelectionAvailable: classification.available,
      availabilityReason: classification.reason,
      minLevel: classification.minLevel ?? null,
      normalMonsterCount: classification.normalMonsterCount ?? 0,
      summary: summary.detail ? null : summary,
      landing: classification.landing ?? null });
  }
  return rows;
}
