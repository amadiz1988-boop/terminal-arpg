// Generic execution metadata adapter for the Stage 3 PA Journey contract.
//
// The adapter describes an edge; it does not execute it. Missing authoritative
// identity, command or destination data remains a hard execution seam.

import { CANONICAL_EDGE_TYPE as T } from './canonical-route-model.mjs';
import { KAFRA_CONTENT, resolveKafraDestination } from './kafra-content.mjs';
import { readAuthoritativeNamedVariable } from './canonical-route-requirement-context.mjs';

export const EXECUTION_METADATA_SCHEMA_VERSION = 1;

export const EXECUTION_METADATA_STATUS = Object.freeze({
  READY: 'READY',
  MISSING_EXECUTION_SEAM: 'MISSING_EXECUTION_SEAM',
  UNSUPPORTED: 'UNSUPPORTED',
});

const COMMAND_PATTERN = /^[a-z][a-z0-9_]{0,30}$/;
const MAP_PATTERN = /^[a-z0-9_@-]{1,32}$/i;

function text(value) {
  return String(value ?? '').trim();
}

function edgeType(edge) {
  return text(edge?.type).toUpperCase().replace(/[ -]+/g, '_');
}

function coordinate(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
}

function entryFor(edge, metadata) {
  return {
    map: text(metadata.entryMap ?? metadata.npcMap ?? edge?.from),
    ...(coordinate(metadata.x ?? metadata.entryX) !== null ? { x: coordinate(metadata.x ?? metadata.entryX) } : {}),
    ...(coordinate(metadata.y ?? metadata.entryY) !== null ? { y: coordinate(metadata.y ?? metadata.entryY) } : {}),
  };
}

function destinationFor(edge, metadata) {
  const map = text(metadata.expectedMap ?? metadata.destinationMap ?? metadata.destination ?? edge?.to);
  return {
    map,
    ...(coordinate(metadata.toX ?? metadata.destinationX) !== null ? { x: coordinate(metadata.toX ?? metadata.destinationX) } : {}),
    ...(coordinate(metadata.toY ?? metadata.destinationY) !== null ? { y: coordinate(metadata.toY ?? metadata.destinationY) } : {}),
  };
}

function retryContract(metadata = {}) {
  const maxAttempts = Number.isSafeInteger(Number(metadata.maxAttempts)) && Number(metadata.maxAttempts) > 0
    ? Math.min(Number(metadata.maxAttempts), 3)
    : 3;
  return {
    maxAttempts,
    onReject: 'OBSERVE_AUTHORITATIVE_FAILURE_THEN_CANONICAL_REPLAN',
    suppressSource: true,
    legacyFallback: false,
  };
}

function baseContract(edge, metadata, transportType, interactionMode) {
  const destination = destinationFor(edge, metadata);
  const expectedPosition = destination.x === undefined || destination.y === undefined
    ? null
    : { map: destination.map, x: destination.x, y: destination.y };
  return {
    schemaVersion: EXECUTION_METADATA_SCHEMA_VERSION,
    transportType,
    entry: entryFor(edge, metadata),
    npc: null,
    interactionMode,
    requirements: { ...(edge?.requirements ?? {}) },
    cost: {
      ...(Number.isFinite(Number(edge?.requirements?.zeny)) ? { zeny: Number(edge.requirements.zeny) } : {}),
      ...(edge?.requirements?.item ? { item: text(edge.requirements.item), itemCount: Number(edge.requirements.itemCount ?? 1) } : {}),
      ...(edge?.requirements?.ticket ? { ticket: true } : {}),
    },
    expectedDestination: destination,
    expectedResult: {
      currentMap: destination.map,
      ...(expectedPosition ? { position: expectedPosition } : {}),
      authority: 'rAthena',
    },
    retry: retryContract(metadata),
    source: edge?.source ?? null,
    authority: edge?.authority ?? 'rAthena',
  };
}

function missing(edge, reason, metadata = {}) {
  return {
    status: EXECUTION_METADATA_STATUS.MISSING_EXECUTION_SEAM,
    reason,
    edgeType: edgeType(edge),
    source: edge?.source ?? null,
    metadata: { ...metadata },
  };
}

function ready(contract) {
  return { status: EXECUTION_METADATA_STATUS.READY, metadata: Object.freeze(contract) };
}

function callerFor(edge, metadata) {
  const candidates = Array.isArray(metadata.callerCandidates) ? metadata.callerCandidates : [];
  return candidates.find((candidate) => text(candidate?.map) === text(edge?.from))
    ?? metadata.caller
    ?? null;
}

function dynamicDialogueReady(metadata, context) {
  if (!metadata.dynamicDialogue) return { status: true };
  const variables = Array.isArray(metadata.requiredNamedVariables) ? metadata.requiredNamedVariables : [];
  if (!context || !variables.length) return { status: false, reason: 'dynamic_dialogue_unresolved' };
  for (const variable of variables) {
    const result = readAuthoritativeNamedVariable(context, variable.scope, variable.key);
    if (result.status !== 'READY') return { status: false, reason: 'dynamic_dialogue_unresolved' };
  }
  return { status: true };
}

function kafraContract(edge, metadata) {
  const hubId = text(metadata.hubId ?? metadata.npcMap ?? edge?.from);
  const hub = KAFRA_CONTENT[hubId];
  const destination = resolveKafraDestination(hubId, text(metadata.destinationCity ?? edge?.to));
  const npcName = text(metadata.npcName ?? hub?.npcName);
  if (!hub || !npcName || destination.reason) {
    return missing(edge, destination.reason ?? 'kafra_authority_metadata_missing', { hubId, npcName });
  }
  const contract = baseContract(edge, {
    ...metadata,
    entryMap: metadata.entryMap ?? hub.npcMap,
    x: metadata.x ?? hub.npcX,
    y: metadata.y ?? hub.npcY,
    expectedMap: destination.map,
    toX: destination.x,
    toY: destination.y,
  }, T.KAFRA_TRANSPORT, 'DIALOGUE');
  contract.npc = {
    name: npcName,
    map: hub.npcMap,
    x: hub.npcX,
    y: hub.npcY,
    identitySource: metadata.npcName ? 'rAthena_METADATA' : hub.npcNameSource,
  };
  contract.dialogue = {
    saveMenuIndex: hub.saveMenuIndex,
    transportMenuIndex: hub.transportMenuIndex,
    cityMenuIndex: destination.menuIndex,
  };
  return ready(contract);
}

export function normalizeExecutionMetadata(edge, { extractedMetadata = null, context = null } = {}) {
  const metadata = { ...(edge?.metadata ?? {}), ...(extractedMetadata ?? {}) };
  const type = edgeType(edge);
  if (!MAP_PATTERN.test(text(edge?.from)) || !MAP_PATTERN.test(text(edge?.to))) {
    return missing(edge, 'map_identity_missing');
  }
  if (type === T.PORTAL || type === T.DUNGEON_TRANSITION) {
    return ready(baseContract(edge, metadata, type, 'WALK_PORTAL'));
  }
  if (type === T.KAFRA_TRANSPORT || text(metadata.transportType).toUpperCase() === 'KAFRA_TRANSPORT' || text(metadata.transport).toLowerCase() === 'kafra') {
    return kafraContract(edge, metadata);
  }
  if (type === T.NPC_TRANSPORT) {
    const caller = callerFor(edge, metadata);
    const npcName = text(metadata.npcName ?? caller?.npcName);
    const npcMap = text(metadata.npcMap ?? metadata.entryMap ?? caller?.map ?? edge.from);
    if (!npcName || !npcMap || text(metadata.interactionMode ?? 'DIALOGUE').toUpperCase() !== 'DIALOGUE') {
      return missing(edge, 'npc_identity_or_dialogue_metadata_missing', { npcName, npcMap });
    }
    const dynamic = dynamicDialogueReady(metadata, context);
    if (!dynamic.status) return missing(edge, dynamic.reason, { npcName, npcMap, functionName: metadata.functionName ?? null });
    const contract = baseContract(edge, metadata, T.NPC_TRANSPORT, 'DIALOGUE');
    contract.npc = {
      name: npcName,
      map: npcMap,
      ...(caller?.x !== undefined ? { x: caller.x } : {}),
      ...(caller?.y !== undefined ? { y: caller.y } : {}),
      ...(coordinate(metadata.x) !== null ? { x: coordinate(metadata.x) } : {}),
      ...(coordinate(metadata.y) !== null ? { y: coordinate(metadata.y) } : {}),
      identitySource: metadata.npcNameSource ?? 'rAthena_METADATA',
    };
    contract.dialogue = {
      ...(metadata.functionName ? { functionName: metadata.functionName } : {}),
      ...(metadata.callerIdentity ? { callerIdentity: metadata.callerIdentity } : {}),
      ...(metadata.dialogueBranch ? { branch: metadata.dialogueBranch } : {}),
      ...(metadata.dynamicDialogue ? { menuSelection: 'AUTHORITATIVE_RUNTIME_BRANCH' } : {}),
    };
    return ready(contract);
  }
  if (type === T.ITEM_WARP || type === T.BUTTERFLY_WING) {
    const itemId = Number(metadata.itemId);
    if (!Number.isSafeInteger(itemId)) return missing(edge, 'item_identity_missing');
    if (itemId === 601) return missing(edge, 'fly_wing_is_local_hunting_only');
    const contract = baseContract(edge, metadata, type, 'ITEM_USE');
    contract.item = { itemId, presenceRequired: true, quantityConsumed: false };
    contract.expectedResult = {
      currentMap: contract.expectedDestination.map,
      savePoint: metadata.saveMap ?? contract.expectedDestination.map,
    };
    return ready(contract);
  }
  if (type === T.COMMAND_TRANSFER || type === T.SCRIPTED_TRANSFER) {
    const command = text(metadata.serverCommand ?? metadata.command);
    if (!COMMAND_PATTERN.test(command)) return missing(edge, 'server_command_execution_seam');
    const contract = baseContract(edge, metadata, type, 'SERVER_COMMAND');
    contract.command = {
      name: command,
      ...(metadata.arguments !== undefined ? { arguments: String(metadata.arguments) } : {}),
      allowlistSource: metadata.allowlistSource ?? 'explicit_authoritative_metadata',
    };
    return ready(contract);
  }
  if (type === T.AIRSHIP) {
    const npcName = text(metadata.npcName);
    const command = text(metadata.serverCommand ?? metadata.command);
    if (!npcName && !COMMAND_PATTERN.test(command)) return missing(edge, 'airship_identity_or_command_missing');
    if (npcName) {
      const contract = baseContract(edge, metadata, type, 'DIALOGUE');
      contract.npc = { name: npcName, map: text(metadata.npcMap ?? edge.from), identitySource: metadata.npcNameSource ?? 'rAthena_METADATA' };
      return ready(contract);
    }
    const contract = baseContract(edge, metadata, type, 'SERVER_COMMAND');
    contract.command = { name: command, allowlistSource: metadata.allowlistSource ?? 'explicit_authoritative_metadata' };
    return ready(contract);
  }
  if (type === T.SAVE_MAP) {
    return ready({ ...baseContract(edge, metadata, type, 'SAVE_POINT_CONFIRMATION'), expectedResult: { savePoint: metadata.saveMap ?? edge.to } });
  }
  return missing(edge, 'unsupported_canonical_edge_type');
}

export function executionMetadataForEdge(edge, options = {}) {
  return normalizeExecutionMetadata(edge, options);
}

export function confirmAuthoritativeExecutionResult(contract, observation = {}) {
  if (!contract || typeof contract !== 'object') return { status: 'REJECTED', reason: 'contract_missing' };
  const expected = contract.expectedResult ?? {};
  const currentMap = text(observation.currentMap ?? observation.map);
  if (!currentMap || currentMap !== text(expected.currentMap)) return { status: 'REJECTED', reason: 'arrival_map_mismatch' };
  const expectedPosition = expected.position;
  if (expectedPosition) {
    const x = Number(observation.x);
    const y = Number(observation.y);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x !== expectedPosition.x || y !== expectedPosition.y)
      return { status: 'REJECTED', reason: 'arrival_position_mismatch' };
  }
  if (contract.interactionMode === 'DIALOGUE' && observation.interactionAccepted !== true)
    return { status: 'REJECTED', reason: 'npc_interaction_unconfirmed' };
  if (contract.cost?.zeny !== undefined && observation.zenyDelta !== undefined && Number(observation.zenyDelta) > -Number(contract.cost.zeny))
    return { status: 'REJECTED', reason: 'zeny_delta_unconfirmed' };
  return { status: 'CONFIRMED', authority: expected.authority ?? 'rAthena' };
}
