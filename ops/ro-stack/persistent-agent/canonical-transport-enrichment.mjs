// Offline transport enrichment for the Stage 1 canonical graph.
// This module consumes the already captured world inventory and active rAthena
// source manifest. It does not alter the weighted solver, PA, or Production.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CANONICAL_EDGE_TYPE, createCanonicalEdge, buildCanonicalGraph, solveCanonicalRoute } from './canonical-route-model.mjs';

export const TRANSPORT_EDGE_TYPES = Object.freeze({
  PORTAL: CANONICAL_EDGE_TYPE.PORTAL,
  NPC_TRANSPORT: CANONICAL_EDGE_TYPE.NPC_TRANSPORT,
  COMMAND_TRANSFER: CANONICAL_EDGE_TYPE.COMMAND_TRANSFER,
  SAVE_MAP: CANONICAL_EDGE_TYPE.SAVE_MAP,
  ITEM_WARP: CANONICAL_EDGE_TYPE.ITEM_WARP,
  AIRSHIP: CANONICAL_EDGE_TYPE.AIRSHIP,
  SCRIPTED_TRANSFER: CANONICAL_EDGE_TYPE.SCRIPTED_TRANSFER,
  KAFRA_TRANSPORT: CANONICAL_EDGE_TYPE.KAFRA_TRANSPORT,
  BUTTERFLY_WING: CANONICAL_EDGE_TYPE.BUTTERFLY_WING,
  DUNGEON_TRANSITION: CANONICAL_EDGE_TYPE.DUNGEON_TRANSITION,
});

const MAP_ID = '[\\w@-]+';
const STATIC_WARP = new RegExp(`^(${MAP_ID}),(\\d+),(\\d+),\\d+\\s+(warp2?)\\s+([^\\t\\s]+)\\s+(\\d+),(\\d+),(${MAP_ID}),(\\d+),(\\d+)`);
const SCRIPT_WARP = new RegExp(`\\bwarp\\s+"(${MAP_ID})"\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)`);
const DECLARATION = new RegExp(`^(${MAP_ID}),\\d+,\\d+,\\d+\\s+(?:script|warp2?)\\b`);

export function normalizeTransportType(type) {
  const value = String(type ?? '').trim().toUpperCase().replace(/[ -]+/g, '_');
  if (value === 'KAFRA' || value === 'KAFRA_SERVICE' || value === 'KAFRA_TRANSPORT') return CANONICAL_EDGE_TYPE.NPC_TRANSPORT;
  if (value === 'BUTTERFLY' || value === 'BUTTERFLY_WING' || value === 'SAVEPOINT') return value === 'SAVEPOINT' ? CANONICAL_EDGE_TYPE.SAVE_MAP : CANONICAL_EDGE_TYPE.ITEM_WARP;
  if (value === 'DUNGEON' || value === 'DUNGEON_TRANSITION') return CANONICAL_EDGE_TYPE.DUNGEON_TRANSITION;
  if (value === 'NPC' || value === 'NPC_TRANSPORT') return CANONICAL_EDGE_TYPE.NPC_TRANSPORT;
  if (value === 'COMMAND' || value === 'COMMAND_TRANSFER') return CANONICAL_EDGE_TYPE.COMMAND_TRANSFER;
  if (value === 'SCRIPT' || value === 'SCRIPTED' || value === 'SCRIPTED_TRANSFER') return CANONICAL_EDGE_TYPE.SCRIPTED_TRANSFER;
  if (value === 'AIRSHIP' || value === 'AIRPLANE') return CANONICAL_EDGE_TYPE.AIRSHIP;
  if (value === 'ITEM' || value === 'ITEM_WARP') return CANONICAL_EDGE_TYPE.ITEM_WARP;
  if (value === 'PORTAL' || value === 'WARP' || value === 'WARP2') return CANONICAL_EDGE_TYPE.PORTAL;
  if (value === 'SAVE_MAP' || value === 'SAVE') return CANONICAL_EDGE_TYPE.SAVE_MAP;
  return null;
}

function edge(input) {
  const type = normalizeTransportType(input.type) ?? input.type;
  return createCanonicalEdge({ ...input, type, authority: input.authority ?? 'rAthena' });
}

export function parseStaticTransportScripts(text, source = 'rAthena:active-warp-scripts') {
  const edges = [];
  for (const [index, raw] of String(text).split(/\r?\n/).entries()) {
    const line = raw.trim();
    const match = line.match(STATIC_WARP);
    if (!match) continue;
    edges.push(edge({ from: match[1], to: match[8], type: CANONICAL_EDGE_TYPE.PORTAL,
      source: `${source}:${index + 1}`, requirements: {}, metadata: { x: Number(match[2]), y: Number(match[3]), toX: Number(match[9]), toY: Number(match[10]), syntax: match[4] } }));
  }
  return edges;
}

function scriptType(path) {
  const p = String(path).replaceAll('\\', '/').toLowerCase();
  if (p.includes('/airship') || p.includes('/airplane')) return CANONICAL_EDGE_TYPE.AIRSHIP;
  if (p.includes('/kafras/') || p.includes('/warper')) return CANONICAL_EDGE_TYPE.NPC_TRANSPORT;
  if (p.includes('/warps/')) return CANONICAL_EDGE_TYPE.SCRIPTED_TRANSFER;
  return CANONICAL_EDGE_TYPE.SCRIPTED_TRANSFER;
}

function scriptRequirements(path) {
  const p = String(path).replaceAll('\\', '/').toLowerCase();
  if (p.includes('/quests/') || p.includes('/jobs/')) return { scriptCondition: 'QUEST_OR_JOB_SCRIPT' };
  if (p.includes('/guild/')) return { scriptCondition: 'GUILD_OR_CASTLE_SCRIPT' };
  if (p.includes('/instances/')) return { instance: 'RATHENA_INSTANCE_CONTEXT' };
  return {};
}

export function parseScriptTransportEdges(text, source = 'rAthena:active-scripts') {
  const edges = [];
  let currentMap = null;
  for (const [index, raw] of String(text).split(/\r?\n/).entries()) {
    const declaration = raw.trim().match(DECLARATION);
    if (declaration) currentMap = declaration[1];
    const match = raw.match(SCRIPT_WARP);
    if (!match || !currentMap || currentMap === match[1]) continue;
    edges.push(edge({ from: currentMap, to: match[1], type: scriptType(source), source: `${source}:${index + 1}`, requirements: scriptRequirements(source), metadata: { x: Number(match[2]), y: Number(match[3]), syntax: 'script warp' } }));
  }
  return edges;
}

function parseOpenKoreLine(line, source, index) {
  const m = line.trim().match(new RegExp(`^(${MAP_ID})\\s+\\d+\\s+\\d+\\s+(${MAP_ID})\\s+\\d+\\s+\\d+(.*)$`));
  if (!m) return null;
  const tail = m[3].trim();
  const kind = tail ? (tail.includes('airship') ? CANONICAL_EDGE_TYPE.AIRSHIP : CANONICAL_EDGE_TYPE.NPC_TRANSPORT) : CANONICAL_EDGE_TYPE.PORTAL;
  return Object.freeze({ from: m[1], to: m[2], type: kind, source: `OpenKore:${source}:${index + 1}`, authority: 'ADVISORY_ONLY', requirements: {} });
}

export function parseOpenKoreTransportTables(text, source = 'tables/portals.txt') {
  return String(text).split(/\r?\n/).map((line, index) => parseOpenKoreLine(line, source, index)).filter(Boolean);
}

function mergeUnique(edges) {
  const seen = new Set();
  return edges.filter((value) => {
    const key = [value.from, value.to, value.type, value.source].join('|');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export async function enrichCanonicalTransportGraph({ inventory, runtimeRoot, openkoreRoot }) {
  const staticEdges = [];
  const scriptEdges = [];
  const files = inventory.sourceManifest.filter((item) => item.file.startsWith('npc/') && !item.file.endsWith('.conf'));
  for (const item of files) {
    let text;
    try { text = await readFile(join(runtimeRoot, item.file), 'utf8'); } catch { continue; }
    if (item.file.includes('/warps/')) staticEdges.push(...parseStaticTransportScripts(text, item.file));
    scriptEdges.push(...parseScriptTransportEdges(text, item.file));
  }
  const advisory = [];
  for (const table of ['tables/portals.txt', 'tables/portals_commands.txt', 'tables/portals_spawns.txt', 'tables/portals_airship.txt']) {
    try { advisory.push(...parseOpenKoreTransportTables(await readFile(join(openkoreRoot, table), 'utf8'), table)); } catch { /* optional table */ }
  }
  const edges = mergeUnique([...staticEdges, ...scriptEdges]);
  const metadata = Object.fromEntries(inventory.records.map((record) => [record.id, { category: record.category, farmability: record.farmability }]));
  const graph = buildCanonicalGraph({ edges, mapMetadata: metadata });
  const normal = inventory.records.filter((record) => record.category.startsWith('NORMAL_'));
  const routes = normal.map((record) => {
    // The recheck asks whether the topology is represented. Script and guild
    // requirements remain evidence on the edge and are reported separately;
    // they are not silently treated as an unconditional player entitlement.
    const result = solveCanonicalRoute(graph, 'prontera', record.id, { scriptConditions: {
      QUEST_OR_JOB_SCRIPT: true,
      GUILD_OR_CASTLE_SCRIPT: true,
      RATHENA_INSTANCE_CONTEXT: true,
    }, instances: { RATHENA_INSTANCE_CONTEXT: true } });
    const advisoryEvidence = advisory.filter((candidate) => candidate.to === record.id || candidate.from === record.id);
    return { id: record.id, status: result.status, failureClass: result.failureClass ?? null, edgeTypes: result.edges.map((item) => item.type), edgeCount: result.edges.length, advisoryEvidence: advisoryEvidence.length };
  });
  return { graph, edges, advisory, routes, counts: { staticPortal: staticEdges.length, scripted: scriptEdges.length, advisory: advisory.length, canonical: edges.length } };
}

export function classifyNormalRouteEvidence(record, route) {
  if (route.status === 'FOUND') return { id: record.id, classification: 'REACHABLE', reason: 'CANONICAL_ENRICHED_ROUTE' };
  const flags = new Set(record.evidence.flags.map((flag) => flag.value));
  const sources = [...record.evidence.references, ...record.evidence.transfers].map((item) => String(item.source));
  if (flags.has('gvg') || flags.has('gvg_dungeon') || flags.has('gvg_castle')) return { id: record.id, classification: 'MAP_MISCLASSIFIED', reason: 'GUILD_CASTLE_EVENT_CONTEXT', evidence: sources.slice(0, 3) };
  if (sources.some((source) => /\/quests\//.test(source))) return { id: record.id, classification: 'MISSING_REQUIREMENT_METADATA', reason: 'QUEST_SCRIPT_TRANSFER', evidence: sources.slice(0, 3) };
  if (sources.some((source) => /\/guild\//.test(source))) return { id: record.id, classification: 'MISSING_REQUIREMENT_METADATA', reason: 'GUILD_SCRIPT_TRANSFER', evidence: sources.slice(0, 3) };
  if (sources.some((source) => /\/warps\//.test(source))) return { id: record.id, classification: 'STATIC_PORTAL_DATA_GAP', reason: 'ACTIVE_WARP_SOURCE_NOT_IN_STAGE1_GRAPH', evidence: sources.slice(0, 3) };
  if (record.graphNode === false) return { id: record.id, classification: 'STATIC_PORTAL_DATA_GAP', reason: 'NODELESS_ACTIVE_MAP_EVIDENCE', evidence: sources.slice(0, 3) };
  return { id: record.id, classification: 'OTHER_PROVEN', reason: 'AUTHORITATIVE_EVIDENCE_REQUIRES_DYNAMIC_CONTEXT', evidence: sources.slice(0, 3) };
}
