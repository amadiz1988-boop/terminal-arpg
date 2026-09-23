// Player World Map policy projection. The native command repeats every mutable
// gameplay check against rAthena state; this module never authorizes a warp.
export const WORLD_MAP_FIELD_COOLDOWN_SECONDS = 60;
export const WORLD_MAP_TOWN_COOLDOWN_SECONDS = 30;
export const WORLD_MAP_FREE_FARM_LEVEL_MAX = 66;

const NORMAL_HABITATS = new Set(['NORMAL_FIELD', 'NORMAL_DUNGEON']);
const BLOCKED_CATEGORIES = new Set([
  'INSTANCE', 'EVENT', 'QUEST_GATED', 'SCRIPT_GATED', 'TEST', 'UNUSED',
]);
const BLOCKED_FLAGS = new Set(['nowarpto', 'restricted', 'gvg', 'battleground']);

export function eligibleNormalFarmMonsters(detail, inventory) {
  const hasActiveSpawnEvidence = Array.isArray(inventory?.evidence?.spawns);
  const active = new Set((inventory?.evidence?.spawns ?? [])
    .filter((spawn) => NORMAL_HABITATS.has(spawn.habitat) && spawn.count > 0)
    .map((spawn) => Number(spawn.mobId)));
  return (detail?.monsters ?? []).filter((monster) =>
    (!hasActiveSpawnEvidence || active.has(Number(monster.id))) && Number(monster.count) > 0 &&
    Number.isSafeInteger(Number(monster.level)) && Number(monster.level) > 0 &&
    monster.isBoss !== true && monster.isMvp !== true &&
    monster.isResource !== true &&
    (monster.sourceFiles ?? []).some((file) =>
      /^npc\/re\/mobs\/(?:fields|dungeons)\//.test(String(file))));
}

export function classifyFarmTeleport({ inventory, detail, landing, eligibleMonsters }) {
  if (!inventory?.mapExists || !inventory.configuredForLoad || !inventory.cacheSource)
    return { available: false, reason: 'MAP_NOT_LOADED' };
  if (BLOCKED_CATEGORIES.has(inventory.category) ||
      (inventory.evidence?.flags ?? []).some((flag) => BLOCKED_FLAGS.has(flag.value)))
    return { available: false, reason: 'MAP_ACCESS_RESTRICTED' };
  if (inventory.category === 'TOWN')
    return { available: false, reason: 'TOWN_NOT_FARMABLE' };
  const monsters = eligibleMonsters ?? eligibleNormalFarmMonsters(detail, inventory);
  if (monsters.length === 0)
    return { available: false, reason: 'NO_ELIGIBLE_NORMAL_FARM_MONSTER' };
  if (!landing || !Number.isSafeInteger(landing.x) || !Number.isSafeInteger(landing.y))
    return { available: false, reason: 'NO_SAFE_LANDING' };
  return {
    available: true,
    reason: 'SUPPORTED',
    minLevel: Math.min(...monsters.map((monster) => Number(monster.level))),
    normalMonsterCount: monsters.reduce((total, monster) => total + Number(monster.count), 0),
    landing,
  };
}

export function farmTeleportCost(baseLevel, minLevel) {
  if (!Number.isSafeInteger(baseLevel) || baseLevel < 1 ||
      !Number.isSafeInteger(minLevel) || minLevel < 1)
    throw new RangeError('INVALID_TELEPORT_LEVEL');
  return baseLevel <= WORLD_MAP_FREE_FARM_LEVEL_MAX ? 0 : minLevel * 10;
}

export function worldMapTeleportDecision({
  kind, currentMap, targetMap, baseLevel, minLevel, zeny,
  currentIsTown = false, availableAt = 0, nowSeconds,
}) {
  if (currentMap === targetMap)
    return { allowed: false, reason: 'ALREADY_ON_TARGET_MAP', cost: 0, cooldownRemaining: 0 };
  if (kind !== 'farm' && kind !== 'town')
    return { allowed: false, reason: 'INVALID_TELEPORT_KIND' };
  if (kind === 'farm' && (!Number.isSafeInteger(minLevel) || minLevel < 1))
    return { allowed: false, reason: 'FARM_MAP_NOT_ELIGIBLE' };
  if (kind === 'farm' && baseLevel < minLevel)
    return { allowed: false, reason: 'LEVEL_TOO_LOW', requiredLevel: minLevel };
  const fieldToTown = kind === 'town' && !currentIsTown;
  const remaining = fieldToTown ? 0 : Math.max(0, availableAt - nowSeconds);
  if (remaining > 0)
    return { allowed: false, reason: 'WORLD_MAP_TELEPORT_COOLDOWN', cooldownRemaining: remaining };
  const cost = kind === 'town' ? 0 : farmTeleportCost(baseLevel, minLevel);
  if (zeny < cost)
    return { allowed: false, reason: 'INSUFFICIENT_ZENY', cost, currentZeny: zeny };
  return { allowed: true, reason: 'AVAILABLE', cost, cooldownRemaining: 0,
    cooldownSeconds: fieldToTown ? 0 : kind === 'town'
      ? WORLD_MAP_TOWN_COOLDOWN_SECONDS : WORLD_MAP_FIELD_COOLDOWN_SECONDS };
}

export function chooseLandingAnchor(graph, targetMap) {
  const inbound = [...graph.values()].flat().filter((warp) =>
    warp.to === targetMap && warp.toX > 0 && warp.toY > 0);
  inbound.sort((a, b) => a.toX - b.toX || a.toY - b.toY ||
    String(a.map).localeCompare(String(b.map)));
  const first = inbound[0];
  return first ? { x: first.toX, y: first.toY, source: `rathena-warp:${first.map}:${first.name}` } : null;
}
