// Stage 1 offline canonical route model. It is deliberately independent from
// the active farm planner and has no runtime or production side effects.

export const CANONICAL_EDGE_TYPE = Object.freeze({
  PORTAL: 'PORTAL', NPC_TRANSPORT: 'NPC_TRANSPORT', COMMAND_TRANSFER: 'COMMAND_TRANSFER',
  SAVE_MAP: 'SAVE_MAP', ITEM_WARP: 'ITEM_WARP', AIRSHIP: 'AIRSHIP',
  SCRIPTED_TRANSFER: 'SCRIPTED_TRANSFER', KAFRA_TRANSPORT: 'KAFRA_TRANSPORT',
  BUTTERFLY_WING: 'BUTTERFLY_WING', DUNGEON_TRANSITION: 'DUNGEON_TRANSITION',
});

export const OPENKORE_ROUTE_WEIGHTS = Object.freeze({
  PORTAL: 20, NPC_TRANSPORT: 200, COMMAND_TRANSFER: 20, SAVE_MAP: 200,
  AIRSHIP: 200, ITEM_WARP: 80, ZENY: 0.1, TICKET: 100,
});

const EDGE_DEFAULTS = Object.freeze({
  PORTAL: 20, NPC_TRANSPORT: 200, COMMAND_TRANSFER: 20, SAVE_MAP: 200,
  ITEM_WARP: 80, AIRSHIP: 200, SCRIPTED_TRANSFER: 200,
  KAFRA_TRANSPORT: 200, BUTTERFLY_WING: 80, DUNGEON_TRANSITION: 20,
});

export function createCanonicalEdge(input) {
  const edge = { ...input, from: String(input.from), to: String(input.to), type: String(input.type) };
  if (!Object.values(CANONICAL_EDGE_TYPE).includes(edge.type)) throw new Error(`unknown edge type: ${edge.type}`);
  edge.cost = Number.isFinite(edge.cost) ? edge.cost : EDGE_DEFAULTS[edge.type] ?? 200;
  edge.requirements = Object.freeze({ ...(input.requirements ?? {}) });
  edge.oneWay = input.oneWay !== false;
  return Object.freeze(edge);
}

export function buildCanonicalGraph({ edges = [], mapMetadata = {} } = {}) {
  const nodes = new Set(Object.keys(mapMetadata));
  const adjacency = new Map();
  const canonicalEdges = edges.map(createCanonicalEdge);
  for (const e of canonicalEdges) { nodes.add(e.from); nodes.add(e.to); if (!adjacency.has(e.from)) adjacency.set(e.from, []); adjacency.get(e.from).push(e); }
  for (const list of adjacency.values()) list.sort((a, b) => a.to.localeCompare(b.to) || a.type.localeCompare(b.type));
  return { nodes, edges: canonicalEdges, adjacency, mapMetadata };
}

function requirementFailure(edge, context) {
  const r = edge.requirements ?? {};
  if (r.quest && !context.quests?.has?.(r.quest) && context.quests?.[r.quest] !== true) return 'QUEST_LOCKED';
  if (r.instance && !context.instances?.has?.(r.instance) && context.instances?.[r.instance] !== true) return 'INSTANCE_LOCKED';
  if (r.event && !context.events?.has?.(r.event) && context.events?.[r.event] !== true) return 'EVENT_LOCKED';
  if (r.scriptCondition && context.scriptConditions?.[r.scriptCondition] !== true) return 'SCRIPT_CONDITION_LOCKED';
  if (r.npcAvailable === false || (r.npc && context.npcs?.[r.npc] === false)) return 'NPC_UNAVAILABLE';
  if (r.savePoint && context.savePoint !== r.savePoint) return 'SAVEPOINT_REQUIRED';
  if (r.item && (context.items?.[r.item] ?? 0) < (r.itemCount ?? 1)) return 'ITEM_REQUIRED';
  if (r.zeny && (context.zeny ?? 0) < r.zeny) return 'ZENY_REQUIRED';
  return null;
}

export function solveCanonicalRoute(graph, source, target, options = {}) {
  const dist = new Map([[source, 0]]), prev = new Map(), queue = [{ node: source, cost: 0 }];
  const locked = new Map();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.node.localeCompare(b.node));
    const current = queue.shift();
    if (current.cost !== dist.get(current.node)) continue;
    if (current.node === target) {
      const edges = []; let at = target;
      while (prev.has(at)) { const p = prev.get(at); edges.unshift(p.edge); at = p.node; }
      return { status: 'FOUND', source, target, edges, totalCost: current.cost };
    }
    for (const edge of graph.adjacency.get(current.node) ?? []) {
      const failure = requirementFailure(edge, options);
      if (failure) { locked.set(failure, (locked.get(failure) ?? 0) + 1); continue; }
      const nextCost = current.cost + edge.cost + (edge.requirements?.zeny ?? 0) * OPENKORE_ROUTE_WEIGHTS.ZENY + (edge.requirements?.ticket ? OPENKORE_ROUTE_WEIGHTS.TICKET : 0);
      if (nextCost < (dist.get(edge.to) ?? Infinity)) { dist.set(edge.to, nextCost); prev.set(edge.to, { node: current.node, edge }); queue.push({ node: edge.to, cost: nextCost }); }
    }
  }
  const failureClass = locked.size ? [...locked.entries()].sort((a, b) => b[1] - a[1])[0][0] : 'UNREACHABLE';
  return { status: locked.size ? 'LOCKED_REQUIREMENT' : 'UNREACHABLE', source, target, edges: [], totalCost: Infinity, failureClass };
}

export function classifyMapId(mapId, metadata = {}, { knownTownMaps = new Set(), graphNode = true } = {}) {
  const id = String(mapId), m = metadata[id] ?? {};
  if (/^(test|unused|dummy|xmas|event)/i.test(id)) return 'UNUSED/TEST';
  if (/^(@|instance_|1@|2@)/i.test(id)) return 'INSTANCE';
  if (/^(job_|quest_|prt_monk|ama_)/i.test(id)) return 'QUEST_GATED';
  if (/^(e_|event_)/i.test(id)) return 'EVENT';
  if (/_in\d*$|_int\d*$|^int_/i.test(id)) return 'INTERIOR';
  if (knownTownMaps.has(id) || (/^[a-z]+$/.test(id) && !m.normalMonsterCount && !m.grindable)) return 'TOWN';
  if (m.dungeon || /(_dun\d*|^moc_pryd\d+|^pay_dun\d+|^prt_maze)/i.test(id)) return m.unlocked === false ? 'SCRIPT_GATED' : 'NORMAL_DUNGEON';
  if (m.normalMonsterCount > 0 || m.grindable) return 'NORMAL_FIELD';
  return 'UNKNOWN';
}

export function transformRathenaWarpEdges(warps = []) {
  return warps.map(w => createCanonicalEdge({ from: w.from ?? w.map, to: w.to ?? w.toMap, type: w.type ?? CANONICAL_EDGE_TYPE.PORTAL, cost: w.cost, requirements: w.requirements, source: 'rAthena' }));
}

export function transformServiceEdges(edges = [], type = CANONICAL_EDGE_TYPE.NPC_TRANSPORT) {
  return edges.map(e => createCanonicalEdge({ ...e, type: e.type ?? type, source: e.source ?? 'rAthena' }));
}
