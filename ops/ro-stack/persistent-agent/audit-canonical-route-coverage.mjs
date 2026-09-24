import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { classifyMapId } from './canonical-route-model.mjs';
import { loadWarpGraph } from './map-route.mjs';

const mapInfoPath = resolve(process.argv[2] ?? 'public/ro/data/map-info.json');
const mapInfo = JSON.parse(await readFile(mapInfoPath, 'utf8')).maps ?? {};
const runtimeRoot = process.argv[3];
const warpGraph = runtimeRoot ? await loadWarpGraph(resolve(runtimeRoot)) : new Map();
const knownTowns = new Set(['prontera', 'payon', 'geffen', 'morocc', 'izlude', 'aldebaran', 'comodo', 'yuno', 'hugel', 'lighthalzen', 'rachel', 'veins', 'umbala', 'amatsu', 'louyang', 'gonryun', 'ayothaya', 'einbroch', 'einbech', 'juno']);
const counts = Object.create(null);
for (const [id, metadata] of Object.entries(mapInfo)) { const category = classifyMapId(id, { [id]: metadata }, { knownTownMaps: knownTowns, graphNode: true }); counts[category] = (counts[category] ?? 0) + 1; }
const normalIds = Object.entries(mapInfo).filter(([id, m]) => ['NORMAL_FIELD', 'NORMAL_DUNGEON'].includes(classifyMapId(id, { [id]: m }, { knownTownMaps: knownTowns, graphNode: true }))).map(([id]) => id);
const graphNodes = new Set(warpGraph.keys());
const incoming = new Map(), outgoing = new Map();
for (const [from, list] of warpGraph) { outgoing.set(from, list.length); for (const e of list) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1); }
const reachable = new Set(['prontera']); const queue = ['prontera'];
while (queue.length) for (const e of warpGraph.get(queue.shift()) ?? []) if (!reachable.has(e.to)) { reachable.add(e.to); queue.push(e.to); }
const noNode = normalIds.filter(id => !graphNodes.has(id));
const noIn = normalIds.filter(id => graphNodes.has(id) && !incoming.has(id));
const noOut = normalIds.filter(id => graphNodes.has(id) && !outgoing.has(id));
const unreachable = normalIds.filter(id => !reachable.has(id));
const report = { source: mapInfoPath, runtimeRoot: runtimeRoot ? resolve(runtimeRoot) : null, mapCount: Object.keys(mapInfo).length, classificationCounts: counts, normalWorld: { total: normalIds.length, reachable: normalIds.length - unreachable.length, unreachable: unreachable.length, withNoGraphNode: noNode.length, withNoIncomingEdge: noIn.length, withNoOutgoingEdge: noOut.length }, failureClasses: { GRAPH_NOT_LOADED: runtimeRoot ? 0 : normalIds.length, NO_GRAPH_NODE: noNode.length, NO_INCOMING_EDGE: noIn.length, NO_OUTGOING_EDGE: noOut.length }, status: runtimeRoot ? 'COMPLETE_BOUNDED_CLASSIFICATION_AND_GRAPH_COVERAGE' : 'COMPLETE_BOUNDED_CLASSIFICATION', graphEdgesLoaded: [...warpGraph.values()].reduce((n, list) => n + list.length, 0), graphNodes: graphNodes.size };
console.log(JSON.stringify(report, null, 2));
