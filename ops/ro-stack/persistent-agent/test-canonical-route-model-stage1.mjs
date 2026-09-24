import assert from 'node:assert/strict';
import { buildCanonicalGraph, CANONICAL_EDGE_TYPE as T, createCanonicalEdge, OPENKORE_ROUTE_WEIGHTS, solveCanonicalRoute, classifyMapId, transformRathenaWarpEdges } from './canonical-route-model.mjs';

const edges = [
  { from: 'field', to: 'town', type: T.PORTAL },
  { from: 'town', to: 'field', type: T.PORTAL },
  { from: 'town', to: 'far-city', type: T.NPC_TRANSPORT, requirements: { zeny: 120 } },
  { from: 'town', to: 'saved', type: T.SAVE_MAP },
  { from: 'town', to: 'dungeon1', type: T.DUNGEON_TRANSITION },
  { from: 'dungeon1', to: 'dungeon2', type: T.PORTAL },
  { from: 'town', to: 'item-destination', type: T.ITEM_WARP, requirements: { item: 'butterfly', itemCount: 1 } },
  { from: 'far-city', to: 'airship-port', type: T.AIRSHIP, requirements: { ticket: true } },
  { from: 'airship-port', to: 'scripted', type: T.SCRIPTED_TRANSFER, requirements: { quest: 'airship' } },
  { from: 'one-way', to: 'town', type: T.COMMAND_TRANSFER },
  { from: 'locked', to: 'target', type: T.PORTAL, requirements: { quest: 'missing' } },
];
const graph = buildCanonicalGraph({ edges });
let result = solveCanonicalRoute(graph, 'field', 'far-city', { zeny: 200 });
assert.equal(result.status, 'FOUND'); assert.equal(result.edges.at(-1).type, T.NPC_TRANSPORT);
assert.equal(solveCanonicalRoute(graph, 'town', 'item-destination', { items: { butterfly: 1 } }).status, 'FOUND');
assert.equal(solveCanonicalRoute(graph, 'town', 'item-destination', {}).status, 'LOCKED_REQUIREMENT');
assert.equal(solveCanonicalRoute(graph, 'locked', 'target', {}).failureClass, 'QUEST_LOCKED');
assert.equal(solveCanonicalRoute(buildCanonicalGraph({ edges: [{ from: 'one-way', to: 'town', type: T.COMMAND_TRANSFER }] }), 'town', 'one-way', {}).status, 'UNREACHABLE');
assert.equal(solveCanonicalRoute(graph, 'dungeon1', 'dungeon2').edges[0].type, T.PORTAL);
assert.equal(OPENKORE_ROUTE_WEIGHTS.PORTAL, 20);
assert.equal(transformRathenaWarpEdges([{ from: 'a', to: 'b' }])[0].source, 'rAthena');
assert.equal(classifyMapId('pay_dun01', { pay_dun01: { normalMonsterCount: 5, dungeon: true, unlocked: true } }), 'NORMAL_DUNGEON');
assert.equal(classifyMapId('payon', { payon: { normalMonsterCount: 0, grindable: false } }, { knownTownMaps: new Set(['payon']) }), 'TOWN');
console.log('CANONICAL_ROUTE_MODEL_STAGE1: 9/9 PASS');
