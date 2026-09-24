// Canonical route -> existing PA Journey command surface (shadow only).
//
// This module deliberately does not solve routes, inspect runtime state, enqueue
// commands, or mutate gameplay. It translates an already-resolved canonical
// route into the existing relocation step contract and, when requested, the
// existing command payloads. rAthena remains authoritative for every result.

import { CANONICAL_EDGE_TYPE } from './canonical-route-model.mjs';
import { existingCommandsForStep } from './relocation-command-surface.mjs';

export const ADAPTER_MODE = 'SHADOW_ONLY';

export const CANONICAL_PA_MAPPING = Object.freeze({
  PORTAL: 'start_navigation',
  NPC_TRANSPORT: 'talk_to_npc + dialogue cursor',
  COMMAND_TRANSFER: 'run_server_command (allowlisted metadata only)',
  SAVE_MAP: 'authoritative save-point confirmation',
  ITEM_WARP: 'use_item',
  AIRSHIP: 'existing NPC or server-command seam (metadata required)',
  SCRIPTED_TRANSFER: 'run_server_command (allowlisted metadata only)',
  KAFRA_TRANSPORT: 'talk_to_npc + dialogue cursor',
  BUTTERFLY_WING: 'use_item',
  DUNGEON_TRANSITION: 'start_navigation',
});

const PHYSICAL_TYPES = new Set([
  CANONICAL_EDGE_TYPE.PORTAL,
  CANONICAL_EDGE_TYPE.DUNGEON_TRANSITION,
]);

const ITEM_TYPES = new Set([
  CANONICAL_EDGE_TYPE.ITEM_WARP,
  CANONICAL_EDGE_TYPE.BUTTERFLY_WING,
]);

const KAFRA_TYPES = new Set([CANONICAL_EDGE_TYPE.KAFRA_TRANSPORT]);

const TYPE_ALIAS = Object.freeze({
  KAFRA: CANONICAL_EDGE_TYPE.KAFRA_TRANSPORT,
  KAFRA_SERVICE: CANONICAL_EDGE_TYPE.KAFRA_TRANSPORT,
  SAVEPOINT: CANONICAL_EDGE_TYPE.SAVE_MAP,
  BUTTERFLY: CANONICAL_EDGE_TYPE.BUTTERFLY_WING,
});

function edgeType(edge) {
  const raw = String(edge?.type ?? '').trim().toUpperCase().replace(/[ -]+/g, '_');
  return TYPE_ALIAS[raw] ?? raw;
}

function requirementReason(status) {
  if (status === 'LOCKED_REQUIREMENT') return 'requirement_locked';
  if (status === 'UNREACHABLE') return 'route_unavailable';
  return 'canonical_route_unavailable';
}

function point(edge, key, fallback = 0) {
  const value = edge?.metadata?.[key] ?? edge?.[key];
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function portalRoute(edges) {
  if (!edges.length) return [];
  const route = [];
  for (const edge of edges) {
    const from = String(edge.edge.from);
    const to = String(edge.edge.to);
    const previous = route.at(-1);
    if (!previous || previous.map !== from) {
      route.push({ map: from, x: point(edge.edge, 'x'), y: point(edge.edge, 'y'), portalTo: to });
    } else {
      previous.portalTo = to;
    }
  }
  const last = edges.at(-1).edge;
  route.push({ map: String(last.to), x: point(last, 'toX'), y: point(last, 'toY') });
  return route;
}

function commandStep(edge, index) {
  const type = edgeType(edge);
  const metadata = edge?.metadata ?? {};
  const base = {
    edgeIndex: index,
    edgeType: type,
    from: String(edge.from),
    to: String(edge.to),
    requirements: { ...(edge.requirements ?? {}) },
  };
  if (type === CANONICAL_EDGE_TYPE.NPC_TRANSPORT || KAFRA_TYPES.has(type)) {
    if (type !== CANONICAL_EDGE_TYPE.KAFRA_TRANSPORT &&
        metadata.transport !== 'kafra' && !metadata.npcName)
      return { missing: 'npc_transport_execution_seam', ...base };
    return {
      kind: 'KAFRA_DIALOG_TRANSFER',
      npcMap: metadata.npcMap ?? edge.from,
      destinationCity: metadata.destinationCity ?? edge.to,
      ...base,
    };
  }
  if (type === CANONICAL_EDGE_TYPE.SAVE_MAP) {
    return { kind: 'VERIFY_SAVEPOINT', expectedMap: metadata.saveMap ?? edge.to, ...base };
  }
  if (ITEM_TYPES.has(type)) {
    const itemId = Number.isSafeInteger(metadata.itemId) ? metadata.itemId : 602;
    if (itemId === 601)
      return { missing: 'fly_wing_is_local_hunting_only', ...base };
    return {
      kind: 'BUTTERFLY_WING',
      itemId,
      expectedMap: metadata.expectedMap ?? edge.to,
      saveMap: metadata.saveMap ?? edge.to,
      ...base,
    };
  }
  if (type === CANONICAL_EDGE_TYPE.COMMAND_TRANSFER ||
      type === CANONICAL_EDGE_TYPE.SCRIPTED_TRANSFER) {
    const command = metadata.serverCommand ?? metadata.command;
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(String(command ?? '')))
      return { missing: 'server_command_execution_seam', ...base };
    return {
      kind: 'SERVER_COMMAND',
      command: String(command),
      ...(metadata.arguments ? { arguments: String(metadata.arguments) } : {}),
      ...base,
    };
  }
  if (type === CANONICAL_EDGE_TYPE.AIRSHIP) {
    if (metadata.npcName || metadata.serverCommand) {
      const delegated = metadata.npcName
        ? { ...edge, type: CANONICAL_EDGE_TYPE.NPC_TRANSPORT }
        : { ...edge, type: CANONICAL_EDGE_TYPE.SCRIPTED_TRANSFER };
      return commandStep(delegated, index);
    }
    return { missing: 'airship_execution_seam', ...base };
  }
  return { missing: 'unknown_canonical_edge_type', ...base };
}

function appendPhysical(steps, edges) {
  if (!edges.length) return;
  steps.push({
    kind: 'DIRECT_TO_TARGET',
    route: portalRoute(edges),
    edgeIndices: edges.map((edge) => edge.index),
    edgeTypes: edges.map((edge) => edgeType(edge.edge)),
  });
}

function adaptFoundRoute(route) {
  const steps = [];
  const missingExecutionSeams = [];
  let physical = [];
  const flush = () => { appendPhysical(steps, physical); physical = []; };
  route.forEach((edge, index) => {
    const typed = { edge, index };
    if (PHYSICAL_TYPES.has(edgeType(edge))) {
      physical.push(typed);
      return;
    }
    flush();
    const step = commandStep(edge, index);
    if (step.missing) missingExecutionSeams.push(step);
    else steps.push(step);
  });
  flush();
  return { steps, missingExecutionSeams };
}

export function adaptCanonicalRouteResult(result, { startFarm = false, targetMap = null } = {}) {
  const status = String(result?.status ?? 'UNREACHABLE');
  if (status !== 'FOUND') {
    return {
      mode: ADAPTER_MODE,
      routeStatus: status,
      policy: 'UNREACHABLE',
      reason: requirementReason(status),
      failureClass: result?.failureClass ?? null,
      steps: [], commands: [], missingExecutionSeams: [], edgeOrder: [],
      zeroGameplayAuthority: true,
    };
  }
  const edges = Array.isArray(result.edges) ? result.edges : [];
  const adapted = adaptFoundRoute(edges);
  const finalMap = targetMap ?? result.target ?? edges.at(-1)?.to ?? result.source;
  if (startFarm && finalMap) adapted.steps.push({ kind: 'START_FARM', targetMap: String(finalMap) });
  return {
    mode: ADAPTER_MODE,
    routeStatus: status,
    policy: edges.length ? 'CANONICAL_ROUTE' : 'ALREADY_AT_DESTINATION',
    reason: null,
    steps: adapted.steps,
    commands: [],
    missingExecutionSeams: adapted.missingExecutionSeams,
    edgeOrder: edges.map((edge, index) => ({ index, from: edge.from, to: edge.to, type: edgeType(edge) })),
    zeroGameplayAuthority: true,
    targetMap: finalMap == null ? null : String(finalMap),
  };
}

export function compileCanonicalRouteShadow(result, options = {}) {
  const plan = adaptCanonicalRouteResult(result, options);
  if (plan.routeStatus !== 'FOUND' || plan.missingExecutionSeams.length) return plan;
  const commands = [];
  for (const step of plan.steps) {
    if (step.kind === 'SERVER_COMMAND') {
      commands.push({ action: 'run_server_command', payload: {
        command: step.command,
        ...(step.arguments ? { arguments: step.arguments } : {}),
      } });
      continue;
    }
    const expanded = existingCommandsForStep(step, options);
    if (expanded.missing) {
      plan.missingExecutionSeams.push({ missing: expanded.missing, step });
      continue;
    }
    commands.push(...expanded.commands);
  }
  return { ...plan, commands };
}

export function canonicalRouteMappingReport() {
  return {
    mapping: { ...CANONICAL_PA_MAPPING },
    missingExecutionSeams: [
      'NPC_TRANSPORT without Kafra or NPC content metadata',
      'AIRSHIP without NPC or allowlisted server-command metadata',
      'COMMAND_TRANSFER without allowlisted server-command metadata',
      'SCRIPTED_TRANSFER without allowlisted server-command metadata',
    ],
    routeEngineCount: 1,
    perMapHardcodeCount: 0,
    mode: ADAPTER_MODE,
  };
}
