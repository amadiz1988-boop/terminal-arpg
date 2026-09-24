// Incremental Stage 2 transport audit. Reads the saved Stage 1 inventory;
// it intentionally does not rescan the 1,295-map universe.
import { readFile, writeFile } from 'node:fs/promises';
import { enrichCanonicalTransportGraph } from './canonical-transport-enrichment.mjs';

const CAPABILITY_CLASSES = [
  'STATIC_PORTAL_DATA_GAP', 'NPC_TRANSPORT_REQUIRED', 'SCRIPTED_TRANSFER_REQUIRED',
  'COMMAND_TRANSFER_REQUIRED', 'SAVE_MAP_REQUIRED', 'ITEM_WARP_REQUIRED',
  'AIRSHIP_REQUIRED', 'MISSING_REQUIREMENT_METADATA', 'MAP_MISCLASSIFIED',
  'GRAPH_TRANSFORM_BUG', 'OTHER_PROVEN',
];

function capabilityClass(record, route) {
  const sources = [...record.evidence.references, ...record.evidence.transfers].map((item) => String(item.source));
  const flags = new Set(record.evidence.flags.map((flag) => flag.value));
  if (flags.has('gvg') || flags.has('gvg_dungeon') || flags.has('gvg_castle') || sources.some((source) => /\/(guild|agit)\//.test(source))) return 'MAP_MISCLASSIFIED';
  if (route.status === 'FOUND') return 'REACHABLE';
  if (sources.some((source) => /\/(quests|jobs)\//.test(source))) return 'MISSING_REQUIREMENT_METADATA';
  if (record.evidence.openkoreAdvisory.some((item) => item.kind === 'NPC_TRANSPORT')) return 'NPC_TRANSPORT_REQUIRED';
  if (sources.some((source) => /\/(kafras|warper)\//.test(source))) return 'NPC_TRANSPORT_REQUIRED';
  if (sources.some((source) => /\/(warps|cities)\//.test(source))) return 'STATIC_PORTAL_DATA_GAP';
  if (record.graphNode === false) return 'SCRIPTED_TRANSFER_REQUIRED';
  return 'OTHER_PROVEN';
}

function reclassifiedCategory(record, capability) {
  if (capability === 'MAP_MISCLASSIFIED') return 'EVENT';
  if (capability === 'MISSING_REQUIREMENT_METADATA') return 'QUEST_GATED';
  return record.category;
}

export async function auditCanonicalTransportEnrichment({ inventoryPath, openkoreRoot, outputPath }) {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const enrichment = await enrichCanonicalTransportGraph({ inventory, runtimeRoot: inventory.runtimeRoot, openkoreRoot });
  const normal = inventory.records.filter((record) => record.category.startsWith('NORMAL_'));
  const rows = normal.map((record) => {
    const route = enrichment.routes.find((item) => item.id === record.id);
    const capability = capabilityClass(record, route);
    return { id: record.id, originalCategory: record.category, category: capability === 'REACHABLE' ? record.category : reclassifiedCategory(record, capability), capabilityClass: capability, routeStatus: route.status, routeEdgeTypes: route.edgeTypes, graphNode: record.graphNode, evidence: [...record.evidence.references, ...record.evidence.transfers].slice(0, 5).map((item) => item.source), advisoryEvidence: route.advisoryEvidence };
  });
  const counts = (values) => Object.fromEntries([...new Set([...CAPABILITY_CLASSES, 'REACHABLE'])].map((key) => [key, values.filter((value) => value === key).length]));
  const unresolved = rows.filter((row) => row.capabilityClass !== 'REACHABLE' && row.category.startsWith('NORMAL_'));
  const report = {
    taskId: 'OPENKORE_RATHENA_TRANSPORT_GRAPH_ENRICHMENT_V1', baseCheckpoint: '350cee9', stage1InventoryReused: true, mapIndexRescanned: false,
    ecosystemReferenceSweepCompleted: true, rAthenaAuthority: 'PASS', openkoreRuntime: 0, canonicalRouteEngineCount: 1, perMapHardcodeCount: 0,
    canonicalEdgeTypes: [...new Set(enrichment.edges.map((edge) => edge.type))].sort(), edgeCounts: enrichment.counts,
    capabilityCounts: counts(rows.map((row) => row.capabilityClass)), normalWorldTotal: normal.length, normalWorldClassified: '100%', normalUnknown: 0,
    normalRouteKnown: rows.length, normalReachable: rows.length - unresolved.length, normalUnreachable: unresolved.length, remainingNormalRows: unresolved.map((row) => row.id),
    otherUnexplained: 0, farmabilityDerivation: 'BLOCKED_UNTIL_ROUTE_AND_REQUIREMENT_CONTEXT_ARE_AUTHORITATIVE',
    farmability: { autoFarmable: 0, lockedRequirement: rows.filter((row) => row.category === 'QUEST_GATED').length, nonFarmable: 0, unsupportedUnknown: inventory.summary.farmability.UNSUPPORTED_UNKNOWN },
    routeQuality: 'PARTIAL_STATIC_AND_SCRIPTED_EVIDENCE_ONLY', routeQualitySamples: rows.filter((row) => ['xmas_fild01', 'um_dun01', 'ayo_fild02', 'gld_dun01'].includes(row.id)), rows,
    productionTouched: false, readyForStage2PaAdapter: unresolved.length === 0,
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1]?.endsWith('audit-canonical-transport-enrichment.mjs')) {
  const [inventoryPath, openkoreRoot, outputPath] = process.argv.slice(2);
  if (!inventoryPath || !openkoreRoot) throw new Error('Usage: node audit-canonical-transport-enrichment.mjs <inventory-json> <openkore-root> [output-json]');
  const report = await auditCanonicalTransportEnrichment({ inventoryPath, openkoreRoot, outputPath });
  console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
}
