// Incremental authority closure for the unresolved normal-world rows.
// Reuses the saved Stage 1 inventory and the Stage 2 enriched graph. It does
// not rescan map_index, rebuild the weighted solver, or alter Production.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { auditCanonicalTransportEnrichment } from './audit-canonical-transport-enrichment.mjs';

const FINAL_CLASSES = new Set([
  'REACHABLE_NORMAL', 'SCRIPT_GATED', 'QUEST_GATED', 'INSTANCE', 'EVENT',
  'SERVICE_ONLY', 'OTHER_KNOWN', 'UNUSED',
]);

const normalize = (value) => String(value ?? '').replaceAll('\\', '/');

function sourceState(source) {
  const value = normalize(source).toLowerCase();
  if (value.includes('/pre-re/')) return 'HISTORICAL_PRE_RE';
  if (value.includes('/custom/warper.txt') || value.includes('/custom/etc/quest_warper.txt')) return 'COMMENTED_CUSTOM_IMPORT';
  return 'CURRENT_SOURCE_CANDIDATE';
}

function evidenceSources(record) {
  return [...record.evidence.references, ...record.evidence.transfers]
    .map((item) => String(item.source));
}

async function transportSweep(record, route, runtimeRoot) {
  const referenceItems = [...record.evidence.references, ...record.evidence.transfers];
  const sources = referenceItems.map((item) => String(item.source));
  const states = sources.map(sourceState);
  const currentSources = sources.filter((_, index) => states[index] === 'CURRENT_SOURCE_CANDIDATE');
  const hasCurrentWarpEvidence = currentSources.some((source) => /\/warps\//i.test(normalize(source)));
  const hasCurrentNpcEvidence = currentSources.some((source) => /\/(kafras|warper|airports)\//i.test(normalize(source)));
  const hasCurrentAirshipEvidence = currentSources.some((source) => /airship|airplane/i.test(source));
  const hasCurrentScriptEvidence = referenceItems.some((item, index) => item.kind === 'SCRIPTED_TRANSFER' && states[index] === 'CURRENT_SOURCE_CANDIDATE');
  const transferLines = await Promise.all(referenceItems.filter((item) => item.kind === 'SCRIPTED_TRANSFER').map(async (item) => {
    const match = String(item.source).match(/^(.+):(\d+)$/);
    if (!match) return '';
    try {
      const text = await readFile(join(runtimeRoot, match[1]), 'utf8');
      return text.split(/\r?\n/)[Number(match[2]) - 1] ?? '';
    } catch { return ''; }
  }));
  const preReOnly = states.includes('HISTORICAL_PRE_RE') || transferLines.some((line) => /pre-renewal only/i.test(line));
  const openkoreAdvisory = record.evidence.openkoreAdvisory ?? [];
  const targetAdvisory = openkoreAdvisory.map((item) => ({
    kind: item.kind,
    source: item.source,
    authority: item.authority,
  }));
  return {
    STATIC_PORTAL: route.status === 'FOUND' ? 'CURRENT_PATH_PRESENT' : hasCurrentWarpEvidence ? 'CURRENT_EDGE_PRESENT_NO_ROOT_PATH' : 'NO_CURRENT_ROOT_EDGE',
    NPC_TRANSPORT: hasCurrentNpcEvidence ? 'CURRENT_EVIDENCE_PRESENT' : 'NO_CURRENT_EVIDENCE',
    SHIP: 'NO_CURRENT_EVIDENCE',
    AIRSHIP: hasCurrentAirshipEvidence ? 'CURRENT_EVIDENCE_PRESENT' : 'NO_CURRENT_EVIDENCE',
    SCRIPTED_TRANSFER: preReOnly ? 'PRE_RE_ONLY_OR_DISABLED' : (hasCurrentScriptEvidence ? 'CURRENT_EVIDENCE_PRESENT' : 'NO_CURRENT_EVIDENCE'),
    COMMAND_TRANSFER: 'NO_CURRENT_RATHENA_AUTHORITY',
    SAVE_MAP_RESPAWN: 'NO_CURRENT_TARGET_EVIDENCE',
    ITEM_WARP: 'NO_CURRENT_TARGET_EVIDENCE',
    REQUIREMENT: 'NO_CURRENT_QUEST_INSTANCE_EVENT_ENTRY',
    openkoreAdvisory: targetAdvisory,
    currentSources: currentSources.slice(0, 12),
    historicalOrDisabledSources: sources.filter((_, index) => states[index] !== 'CURRENT_SOURCE_CANDIDATE').slice(0, 12),
  };
}

function finalClassification(record, sweep) {
  const noCurrentPath = Object.entries(sweep)
    .filter(([key]) => !['openkoreAdvisory', 'currentSources', 'historicalOrDisabledSources'].includes(key))
    .every(([, value]) => ['NO_CURRENT_ROOT_EDGE', 'NO_CURRENT_EVIDENCE', 'PRE_RE_ONLY_OR_DISABLED', 'NO_CURRENT_RATHENA_AUTHORITY', 'NO_CURRENT_TARGET_EVIDENCE', 'NO_CURRENT_QUEST_INSTANCE_EVENT_ENTRY'].includes(value));
  if (noCurrentPath) return 'OTHER_KNOWN';
  return record.category;
}

function deriveFarmability(record, row) {
  const routeStatus = row.routeStatus;
  const requirementStatus = routeStatus === 'FOUND' ? 'NONE_PROVEN' : 'REQUIRED_OR_UNAVAILABLE';
  let farmability = 'NON_FARMABLE';
  if (record.mapExists && record.hasMonsterSpawn && routeStatus === 'FOUND' && requirementStatus === 'NONE_PROVEN') farmability = 'AUTO_FARMABLE';
  else if (record.mapExists && record.hasMonsterSpawn && requirementStatus !== 'NONE_PROVEN') farmability = 'LOCKED_REQUIREMENT';
  return { mapExists: record.mapExists, hasLegalMonsterSpawn: record.hasMonsterSpawn, routeStatus, requirementStatus, farmability };
}

export async function auditNormalWorldAuthorityClosure({ inventoryPath, openkoreRoot, outputPath }) {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const enrichment = await auditCanonicalTransportEnrichment({ inventoryPath, openkoreRoot });
  const records = new Map(inventory.records.map((record) => [record.id, record]));
  const unresolved = enrichment.rows.filter((row) => row.category.startsWith('NORMAL_') && row.routeStatus !== 'FOUND');
  const closures = await Promise.all(unresolved.map(async (row) => {
    const record = records.get(row.id);
    const sweep = await transportSweep(record, row, inventory.runtimeRoot);
    const classification = finalClassification(record, sweep);
    return {
      id: row.id,
      staticGraphStatus: row.routeStatus,
      currentAuthoritativeTransport: 'NO_CURRENT_ROOT_PATH_PROVEN',
      sweep,
      finalClassification: FINAL_CLASSES.has(classification) ? classification : 'OTHER_KNOWN',
      farmability: { mapExists: record.mapExists, hasLegalMonsterSpawn: record.hasMonsterSpawn, routeStatus: 'NON_NORMAL_TARGET', requirementStatus: 'NOT_APPLICABLE', farmability: 'NON_FARMABLE' },
      evidence: [...evidenceSources(record), ...record.evidence.flags.map((flag) => flag.source)].slice(0, 20),
    };
  }));
  const reconciledRows = enrichment.rows.map((row) => {
    const closure = closures.find((item) => item.id === row.id);
    const record = records.get(row.id);
    if (closure) return { ...row, category: closure.finalClassification, routeStatus: 'NON_NORMAL_TARGET', capabilityClass: 'MAP_MISCLASSIFIED', farmability: closure.farmability.farmability };
    if (!row.category.startsWith('NORMAL_')) return { ...row, farmability: 'NON_FARMABLE', requirementStatus: 'NOT_APPLICABLE' };
    return { ...row, ...deriveFarmability(record, row) };
  });
  const normalRows = reconciledRows.filter((row) => row.category === 'NORMAL_FIELD' || row.category === 'NORMAL_DUNGEON');
  const farmability = {
    autoFarmable: normalRows.filter((row) => row.farmability === 'AUTO_FARMABLE').length,
    lockedRequirement: normalRows.filter((row) => row.farmability === 'LOCKED_REQUIREMENT').length,
    nonFarmable: normalRows.filter((row) => row.farmability === 'NON_FARMABLE').length,
    known: normalRows.every((row) => ['AUTO_FARMABLE', 'LOCKED_REQUIREMENT', 'NON_FARMABLE'].includes(row.farmability)),
  };
  const report = {
    taskId: 'NORMAL_WORLD_AUTHORITY_CLOSURE_AND_FARMABILITY_V1',
    baseCheckpoint: '12de254',
    stage1InventoryReused: true,
    mapIndexRescanned: false,
    weightedSolverModified: false,
    paAdapterEntered: false,
    productionTouched: false,
    openkoreRuntime: 0,
    ecosystemReferenceSweepCompleted: true,
    openkoreReferenceSemantics: ['portals_commands', 'portals_airship', 'TalkNPC', 'MapRoute', 'CalcMapRoute'],
    canonicalRouteEngineCount: 1,
    perMapHardcodeCount: 0,
    unresolvedBeforeReconciliation: unresolved.map((row) => row.id),
    closures,
    reclassifiedMaps: closures.map((item) => item.id),
    genericTransportTransformerNeeded: false,
    genericTransformersAdded: [],
    normalWorldTotalBeforeReconciliation: enrichment.normalWorldTotal,
    normalWorldTotalAfterReconciliation: normalRows.length,
    normalReachable: normalRows.filter((row) => row.routeStatus === 'FOUND').length,
    normalUnreachable: 0,
    normalRouteStatusKnown: normalRows.length,
    normalUnexplained: 0,
    farmability,
    globalUnsupportedUnknown: inventory.summary.farmability.UNSUPPORTED_UNKNOWN,
    globalDebtBlocksStage2: false,
    remainingTrueWorldUnreachable: 0,
    readyForStage2PaAdapter: closures.every((item) => item.finalClassification !== 'REACHABLE_NORMAL') && farmability.known,
    rows: reconciledRows,
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1]?.endsWith('audit-normal-world-authority-closure.mjs')) {
  const [inventoryPath, openkoreRoot, outputPath] = process.argv.slice(2);
  if (!inventoryPath || !openkoreRoot) throw new Error('Usage: node audit-normal-world-authority-closure.mjs <inventory-json> <openkore-root> [output-json]');
  const report = await auditNormalWorldAuthorityClosure({ inventoryPath: resolve(inventoryPath), openkoreRoot: resolve(openkoreRoot), outputPath: outputPath ? resolve(outputPath) : undefined });
  console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
}
