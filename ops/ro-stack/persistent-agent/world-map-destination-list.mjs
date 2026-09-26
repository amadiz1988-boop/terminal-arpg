const farmHabitats = new Set(['NORMAL_FIELD', 'NORMAL_DUNGEON']);

export function weightedMonsterLevel(monsters) {
  let weightedLevels = 0, totalSpawns = 0;
  for (const monster of monsters ?? []) {
    const level = Number(monster.level), count = Number(monster.count);
    if (!Number.isFinite(level) || level <= 0 ||
        !Number.isSafeInteger(count) || count <= 0) continue;
    weightedLevels += level * count;
    totalSpawns += count;
  }
  return totalSpawns > 0 ? weightedLevels / totalSpawns : null;
}

export function surroundingOutdoorLevel(map, outdoorLevels, graph) {
  const visited = new Set([map]);
  let frontier = [map], depth = 0;
  while (frontier.length) {
    depth += 1;
    const next = [];
    for (const from of frontier)
      for (const edge of graph.get(from) ?? []) {
        const to = edge.to;
        if (visited.has(to)) continue;
        visited.add(to);
        next.push(to);
      }
    const levels = next.map((id) => outdoorLevels.get(id))
      .filter((level) => Number.isFinite(level));
    if (levels.length)
      return { level: levels.reduce((sum, level) => sum + level, 0) / levels.length,
        fallbackDepth: depth };
    frontier = next;
  }
  return { level: null, fallbackDepth: null };
}

function compareByLevel(left, right) {
  return (left.averageLevel ?? Infinity) - (right.averageLevel ?? Infinity) ||
    left.name.localeCompare(right.name, 'zh-Hant') || left.map.localeCompare(right.map);
}

export function buildWorldMapDestinationList({ farmRows, townRows, sourceIndex,
  graph = new Map() }) {
  const sourceByMap = new Map(sourceIndex.maps.map((row) => [row.map, row]));
  const wild = [], caves = [], outdoorLevels = new Map();
  for (const row of farmRows.values()) {
    const source = sourceByMap.get(row.map);
    if (!farmHabitats.has(source?.habitat))
      throw new Error(`Unclassified farm destination: ${row.map}`);
    const averageLevel = weightedMonsterLevel(source.monsters);
    if (averageLevel === null)
      throw new Error(`Missing ordinary spawn level: ${row.map}`);
    const item = { map: row.map, name: row.name, averageLevel };
    if (source.habitat === 'NORMAL_FIELD') {
      wild.push(item);
      if (!townRows.has(row.map)) outdoorLevels.set(row.map, averageLevel);
    } else caves.push(item);
  }
  const towns = [...townRows.values()].map((row) => {
    const surrounding = surroundingOutdoorLevel(row.map, outdoorLevels, graph);
    return { map: row.map, name: row.name, locationClass: row.locationClass,
      averageLevel: surrounding.level, fallbackDepth: surrounding.fallbackDepth };
  });
  wild.sort(compareByLevel);
  caves.sort(compareByLevel);
  towns.sort(compareByLevel);
  return { towns, wild, caves };
}
