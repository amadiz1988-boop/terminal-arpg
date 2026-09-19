export const supplyHubs = Object.freeze({
  prontera: Object.freeze({
    id: 'prontera', name: '普隆德拉', npcMap: 'prontera', npcX: 151, npcY: 29,
    saveMap: 'prontera', saveX: 150, saveY: 33,
    storageNpc: 'prontera 151 29', shopNpc: 'prt_in 126 76',
  }),
  payon: Object.freeze({
    id: 'payon', name: '斐揚', npcMap: 'payon', npcX: 181, npcY: 104,
    saveMap: 'payon', saveX: 160, saveY: 58,
    storageNpc: 'payon 181 104', shopNpc: 'payon 159 96',
  }),
  morocc: Object.freeze({
    id: 'morocc', name: '夢羅克', npcMap: 'morocc', npcX: 156, npcY: 97,
    saveMap: 'morocc', saveX: 156, saveY: 46,
    storageNpc: 'morocc 156 97', shopNpc: 'morocc 146 103',
  }),
  geffen: Object.freeze({
    id: 'geffen', name: '吉芬', npcMap: 'geffen', npcX: 120, npcY: 62,
    saveMap: 'geffen', saveX: 119, saveY: 40,
    storageNpc: 'geffen 120 62', shopNpc: 'geffen_in 77 167',
  }),
  izlude: Object.freeze({
    id: 'izlude', name: '伊斯魯德島', npcMap: 'izlude', npcX: 128, npcY: 148,
    saveMap: 'izlude', saveX: 94, saveY: 103,
    storageNpc: 'izlude 128 148', shopNpc: 'izlude_in 57 110',
  }),
});

const mapIdPattern = /^[a-z0-9_]{1,31}$/;
const cityMaps = new Set(Object.values(supplyHubs).map((hub) => hub.saveMap));

export function buildPhysicalMapGraph(portalsText) {
  const graph = new Map();
  for (const rawLine of String(portalsText).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const tokens = line.split(/\s+/);
    if (
      tokens.length < 6 ||
      !mapIdPattern.test(tokens[0]) ||
      !mapIdPattern.test(tokens[3]) ||
      !tokens.slice(1, 3).every((value) => /^\d+$/.test(value)) ||
      !tokens.slice(4, 6).every((value) => /^\d+$/.test(value))
    )
      continue;
    // Paid Kafra links connect cities but do not make a field geographically
    // closer to every city. Physical city warps have no conversation tokens.
    if (cityMaps.has(tokens[0]) && cityMaps.has(tokens[3]) && tokens.length > 6)
      continue;
    if (!graph.has(tokens[0])) graph.set(tokens[0], new Set());
    graph.get(tokens[0]).add(tokens[3]);
  }
  return graph;
}

function mapDistance(graph, source, destination) {
  const queue = [[source, 0]];
  const visited = new Set([source]);
  for (let index = 0; index < queue.length; index++) {
    const [mapId, distance] = queue[index];
    if (mapId === destination) return distance;
    for (const next of graph.get(mapId) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function nearestSupplyHubForMap(mapId, graph, mapSummary = null) {
  const sourceCandidates = [mapId];
  const entranceMapId = mapSummary?.dungeon?.entranceMapId;
  if (entranceMapId && entranceMapId !== mapId) sourceCandidates.push(entranceMapId);
  const ranked = Object.values(supplyHubs)
    .map((hub) => ({
      hub,
      distance: Math.min(
        ...sourceCandidates.map((source) => mapDistance(graph, source, hub.saveMap)),
      ),
    }))
    .sort((left, right) => left.distance - right.distance);
  if (!Number.isFinite(ranked[0]?.distance))
    throw new Error(`找不到 ${mapId} 通往任一城市儲存點的 Renewal 路線`);
  return Object.freeze({ ...ranked[0].hub, mapDistance: ranked[0].distance });
}
