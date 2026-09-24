// Live STANDARD_FARM route binding. OpenKore-derived weights select among
// current rAthena portal edges; PA and rAthena still own movement and arrival.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseWarpConfPaths, buildRouteSteps } from './map-route.mjs';
import { parseStaticTransportScripts } from './canonical-transport-enrichment.mjs';
import { buildCanonicalGraph } from './canonical-route-model.mjs';
import { solveCapabilityAwareRoute } from './canonical-route-capability-filter.mjs';
import { createRouteRequirementContext } from './canonical-route-requirement-context.mjs';
import { adaptCanonicalRouteResult } from './canonical-route-pa-adapter.mjs';

export const STANDARD_FARM_ROUTE_ENGINE = 'OPENKORE_DERIVED_WEIGHTED_CANONICAL';
const ACTIVE_WARP_CONFS = ['npc/scripts_warps.conf', 'npc/re/scripts_warps.conf'];
const mapIdPattern = /^[a-z0-9_@-]{1,31}$/;

export function buildCanonicalStandardFarmGraph(scripts) {
  const edges = [];
  const digest = createHash('sha256');
  for (const { path, text } of scripts) {
    if (!/^npc\/[A-Za-z0-9_./-]+$/.test(path) || path.includes('..'))
      throw new Error('CANONICAL_WARP_SOURCE_INVALID');
    digest.update(path).update('\0').update(text).update('\0');
    edges.push(...parseStaticTransportScripts(text, path));
  }
  if (!edges.length) throw new Error('CANONICAL_WARP_GRAPH_EMPTY');
  return {
    graph: buildCanonicalGraph({ edges }),
    sourceDigest: digest.digest('hex').toUpperCase(),
    sourceFileCount: scripts.length,
    edgeCount: edges.length,
  };
}

export async function loadCanonicalStandardFarmGraph(runtimeRoot) {
  const paths = [];
  for (const conf of ACTIVE_WARP_CONFS)
    paths.push(...parseWarpConfPaths(await readFile(join(runtimeRoot, conf), 'utf8')));
  const scripts = [];
  for (const path of [...new Set(paths)]) {
    if (!/^npc\/[A-Za-z0-9_./-]+$/.test(path) || path.includes('..'))
      throw new Error('CANONICAL_WARP_SOURCE_INVALID');
    scripts.push({ path, text: await readFile(join(runtimeRoot, path), 'utf8') });
  }
  return buildCanonicalStandardFarmGraph(scripts);
}

function unavailable(reason) {
  return {
    mode: 'UNREACHABLE', policy: 'UNREACHABLE', reason,
    routeEngine: STANDARD_FARM_ROUTE_ENGINE, legacyFallbackInvocations: 0,
    steps: [], edgeTypes: [], edgeSources: [],
  };
}

export function planCanonicalStandardFarmMapChange(bundle, currentMap, targetMap) {
  if (!mapIdPattern.test(String(currentMap)) || !mapIdPattern.test(String(targetMap)))
    return unavailable('invalid_map');
  const result = solveCapabilityAwareRoute(bundle.graph, currentMap, targetMap, {
    context: createRouteRequirementContext({}), executionAdmission: true,
  });
  if (result.status !== 'FOUND') return unavailable('canonical_route_unavailable');
  const adapted = adaptCanonicalRouteResult(result, { startFarm: true, targetMap });
  if (adapted.missingExecutionSeams.length)
    return unavailable('canonical_execution_seam_unavailable');
  if (!result.edges.length) {
    return {
      mode: 'ALREADY_AT_DESTINATION', policy: 'DIRECT', reason: null,
      routeCost: 0, routeEngine: STANDARD_FARM_ROUTE_ENGINE,
      sourceDigest: bundle.sourceDigest, legacyFallbackInvocations: 0,
      edgeTypes: [], edgeSources: [], steps: adapted.steps,
    };
  }
  if (adapted.steps.length !== 2 || adapted.steps[0].kind !== 'DIRECT_TO_TARGET'
      || adapted.steps[1].kind !== 'START_FARM')
    return unavailable('canonical_route_unrepresentable');
  // Reuse the existing farm landing safety rule after the weighted solver has
  // selected the exact edges. This function does not select or re-plan a path.
  const safeRoute = buildRouteSteps(result.edges.map((edge) => ({
    map: edge.from, x: edge.metadata.x, y: edge.metadata.y,
    to: edge.to, toX: edge.metadata.toX, toY: edge.metadata.toY,
  })));
  const adaptedRoute = adapted.steps[0].route;
  if (!safeRoute || safeRoute.length !== adaptedRoute.length || safeRoute.length > 16
      || safeRoute.some((step, index) =>
        step.map !== adaptedRoute[index].map ||
        (step.portalTo ?? null) !== (adaptedRoute[index].portalTo ?? null)))
    return unavailable('canonical_route_unrepresentable');
  return {
    mode: 'DIRECT', policy: 'DIRECT', reason: null, targetMap,
    routeCost: result.totalCost, routeEngine: STANDARD_FARM_ROUTE_ENGINE,
    sourceDigest: bundle.sourceDigest, legacyFallbackInvocations: 0,
    edgeTypes: result.edges.map((edge) => edge.type),
    edgeSources: result.edges.map((edge) => edge.source),
    steps: [{ ...adapted.steps[0], route: safeRoute }, adapted.steps[1]],
  };
}
