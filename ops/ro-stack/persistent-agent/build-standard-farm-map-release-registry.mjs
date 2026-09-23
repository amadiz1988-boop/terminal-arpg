// Build the product availability projection from the authoritative inventory
// and the existing canonical route/capability pipeline. This is a generator;
// it does not modify the route engine, weighted solver, rAthena or Production.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { enrichCanonicalTransportGraph } from './canonical-transport-enrichment.mjs';
import { buildCanonicalGraph, solveCanonicalRoute } from './canonical-route-model.mjs';
import { extractRathenaTransportMetadata, metadataIndex } from './canonical-route-script-extractor.mjs';
import { createRouteRequirementContext } from './canonical-route-requirement-context.mjs';
import { classifyExecutionEdge, EXECUTION_CLASS } from './canonical-route-execution-classification.mjs';
import { SPECIAL_TRANSPORT_HOLD_MAPS, FARM_AVAILABILITY_REASON, FARM_ROUTE_CLASS } from './standard-farm-map-availability.mjs';

const EVENT_FLAGS = new Set(['gvg', 'gvg_castle', 'gvg_te', 'gvg_te_castle', 'gvg_dungeon', 'battleground', 'pvp']);
const NORMAL_HABITATS = new Set(['NORMAL_FIELD', 'NORMAL_DUNGEON']);
const ROUTE_OPTIONS = {
  scriptConditions: { QUEST_OR_JOB_SCRIPT: true, GUILD_OR_CASTLE_SCRIPT: true, RATHENA_INSTANCE_CONTEXT: true },
  instances: { RATHENA_INSTANCE_CONTEXT: true },
};

function hasNormalMonsterSpawn(record) {
  return (record.evidence?.spawns ?? []).some((spawn) => NORMAL_HABITATS.has(spawn.habitat));
}

function explicitNonFarmable(record) {
  if (record.category === 'INSTANCE') return true;
  return (record.evidence?.flags ?? []).some((flag) => EVENT_FLAGS.has(flag.value));
}

function routeTypes(route) {
  return [...new Set((route.edges ?? []).map((edge) => edge.type))];
}

function makeContext() {
  return createRouteRequirementContext({
    freshness: { overall: 'FRESH', domains: {
      quests: 'FRESH', instances: 'FRESH', events: 'FRESH', scriptConditions: 'FRESH',
      items: 'FRESH', zeny: 'FRESH', savePoint: 'FRESH', npcs: 'FRESH', position: 'FRESH',
      character: 'FRESH', namedVariables: 'FRESH',
    } },
    items: { 602: 1 }, zeny: 999999, savePoint: 'prontera',
    instances: { RATHENA_INSTANCE_CONTEXT: true },
    character: { classId: 2000, baseLevel: 200, jobLevel: 100, job: 2000 },
  });
}

export async function buildStandardFarmMapReleaseRegistry({ inventoryPath, openkoreRoot, outputPath }) {
  const inventory = JSON.parse(await readFile(resolve(inventoryPath), 'utf8'));
  const enriched = await enrichCanonicalTransportGraph({
    inventory,
    runtimeRoot: inventory.runtimeRoot,
    openkoreRoot: resolve(openkoreRoot),
  });
  const extracted = [];
  for (const item of inventory.sourceManifest.filter((entry) => entry.file.startsWith('npc/') && !entry.file.endsWith('.conf'))) {
    try { extracted.push(...extractRathenaTransportMetadata(await readFile(join(inventory.runtimeRoot, item.file), 'utf8'), item.file)); }
    catch { /* Missing optional source is unavailable evidence. */ }
  }
  const metadataBySource = metadataIndex(extracted);
  const context = makeContext();
  const edgeClasses = enriched.edges.map((edge) => classifyExecutionEdge(edge, { context, metadataBySource }));
  const standardGraph = buildCanonicalGraph({
    edges: enriched.edges.filter((_, index) => edgeClasses[index].executionClass === EXECUTION_CLASS.KNOWN_EXECUTABLE),
    mapMetadata: Object.fromEntries(inventory.records.map((record) => [record.id, { category: record.category }])),
  });
  const mapInfo = await (async () => {
    try { return JSON.parse(await readFile(resolve('public/ro/data/map-info.json'), 'utf8')).maps ?? {}; }
    catch { return {}; }
  })();
  const holdSet = new Set(SPECIAL_TRANSPORT_HOLD_MAPS);
  const maps = inventory.records.map((record) => {
    const legalMonsterMap = hasNormalMonsterSpawn(record) && !explicitNonFarmable(record);
    const fullRoute = legalMonsterMap ? solveCanonicalRoute(enriched.graph, 'prontera', record.id, ROUTE_OPTIONS) : null;
    const standardRoute = legalMonsterMap ? solveCanonicalRoute(standardGraph, 'prontera', record.id, ROUTE_OPTIONS) : null;
    const standardAvailable = standardRoute?.status === 'FOUND';
    const specialHold = holdSet.has(record.id);
    const routeClass = standardAvailable ? FARM_ROUTE_CLASS.STANDARD
      : specialHold ? FARM_ROUTE_CLASS.SPECIAL_TRANSPORT
        : fullRoute?.status === 'FOUND' ? FARM_ROUTE_CLASS.SPECIAL_TRANSPORT : FARM_ROUTE_CLASS.UNKNOWN;
    const availabilityReason = standardAvailable ? FARM_AVAILABILITY_REASON.STANDARD_ROUTE_READY
      : specialHold ? FARM_AVAILABILITY_REASON.SPECIAL_TRANSPORT_PENDING
        : legalMonsterMap ? (fullRoute?.status === 'FOUND' ? FARM_AVAILABILITY_REASON.ROUTE_OR_AUTHORITY_UNPROVEN : FARM_AVAILABILITY_REASON.ROUTE_OR_AUTHORITY_UNPROVEN)
          : FARM_AVAILABILITY_REASON.NON_FARMABLE_WORLD_CLASS;
    const farmSelectionAvailable = standardAvailable;
    const selectedRoute = standardAvailable ? standardRoute : fullRoute;
    return {
      map: record.id,
      displayName: mapInfo[record.id]?.name ?? record.id,
      farmable: legalMonsterMap,
      farmSelectionAvailable,
      availabilityReason,
      routeClass,
      transportRequirement: standardAvailable ? (routeTypes(selectedRoute).join('|') || 'NONE')
        : specialHold ? 'SPECIAL_TRANSPORT_PENDING' : legalMonsterMap ? 'UNRESOLVED' : 'NONE',
      researchStatus: standardAvailable ? 'PROVEN_STANDARD_EXECUTION'
        : specialHold ? 'SPECIAL_TRANSPORT_BACKLOG'
          : legalMonsterMap ? 'ROUTE_OR_AUTHORITY_UNPROVEN' : 'WORLD_CLASS_NON_FARMABLE',
      sourceCategory: record.category,
      monsterSpawnEvidence: record.evidence?.spawns?.filter((spawn) => NORMAL_HABITATS.has(spawn.habitat)).length ?? 0,
      standardRouteCost: standardAvailable ? standardRoute.totalCost : null,
      standardRouteEdgeCount: standardAvailable ? standardRoute.edges.length : 0,
    };
  });
  const summary = {
    totalWorldMaps: maps.length,
    totalLegalMonsterMaps: maps.filter((row) => row.farmable).length,
    standardFarmMapCount: maps.filter((row) => row.farmSelectionAvailable).length,
    specialTransportHoldCount: maps.filter((row) => row.availabilityReason === FARM_AVAILABILITY_REASON.SPECIAL_TRANSPORT_PENDING).length,
    nonFarmableCount: maps.filter((row) => !row.farmable).length,
    unsupportedUnknownCount: maps.filter((row) => row.farmable && !row.farmSelectionAvailable && row.availabilityReason !== FARM_AVAILABILITY_REASON.SPECIAL_TRANSPORT_PENDING).length,
  };
  const report = {
    taskId: 'NORMAL_WORLD_STANDARD_FARM_NAVIGATION_RELEASE_V1',
    source: 'docs/openkore-reference/world-map-inventory.json',
    baseCheckpoint: '16f34ec2c36465e3d86ce93cd892ed8e8d2532c4',
    routeEngineCount: 1,
    weightedSolverModified: false,
    productionTouched: false,
    openkoreRuntime: 0,
    openkoreReferenceCommit: '51de1ddfc4449ae5217f6886de702f87ca934030',
    summary,
    maps,
  };
  if (outputPath) await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1]?.endsWith('build-standard-farm-map-release-registry.mjs')) {
  const [inventoryPath, openkoreRoot, outputPath] = process.argv.slice(2);
  if (!inventoryPath || !openkoreRoot || !outputPath) throw new Error('Usage: node build-standard-farm-map-release-registry.mjs <inventory-json> <openkore-root> <output-json>');
  const report = await buildStandardFarmMapReleaseRegistry({ inventoryPath, openkoreRoot, outputPath });
  console.log(JSON.stringify(report.summary, null, 2));
}
