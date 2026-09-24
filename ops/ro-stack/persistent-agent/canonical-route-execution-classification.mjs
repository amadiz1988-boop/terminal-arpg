// Admission, not an executor or planner. Proof is supplied by trusted source
// bindings; the extractor must never manufacture a runtime-probe safety proof.
import { CANONICAL_EDGE_TYPE as T, createCanonicalEdge } from './canonical-route-model.mjs';
import { evaluateRequirement, normalizeRequirementPredicates, REQUIREMENT_STATUS } from './canonical-route-requirement-context.mjs';
import { normalizeExecutionMetadata } from './canonical-route-execution-metadata.mjs';

export const EXECUTION_CLASS = Object.freeze({
  KNOWN_EXECUTABLE: 'KNOWN_EXECUTABLE', SAFE_RUNTIME_PROBE: 'SAFE_RUNTIME_PROBE', UNKNOWN_UNSAFE: 'UNKNOWN_UNSAFE',
});
export const TYPED_FAILURE_CODES = Object.freeze([
  'PORTAL_MISSING', 'NPC_NOT_FOUND', 'NPC_NO_RESPONSE', 'DIALOGUE_REJECTED',
  'QUEST_LOCKED', 'ZENY_INSUFFICIENT', 'ITEM_MISSING', 'TRANSPORT_TIMEOUT',
  'ARRIVAL_MISMATCH', 'CAPABILITY_UNAVAILABLE', 'NO_ROUTE_AFTER_REPLAN', 'UNKNOWN_EXECUTION_FAILURE',
]);
const text = (value) => String(value ?? '').trim();
const point = (x, y) => Number.isSafeInteger(x) && x >= 0 && Number.isSafeInteger(y) && y >= 0;
const finiteBound = (value, max) => Number.isSafeInteger(value) && value > 0 && value <= max;

export function canonicalEdgeKey(edge) {
  // Keep topology identity even when execution metadata refines its type.
  return [edge?.from, edge?.to, edge?.metadata?.canonicalType ?? edge?.type, edge?.source ?? 'unknown'].map(text).join('|');
}
export function canonicalCapabilityKey(edge) {
  return text(edge?.metadata?.capabilityId) || [edge?.type, edge?.from, edge?.metadata?.npcName ?? edge?.source ?? 'unknown'].map(text).join('|');
}
export function bindExecutionEdge(edge, metadataBySource = new Map()) {
  const metadata = metadataBySource?.get?.(edge?.source);
  if (!metadata) return edge;
  const { requirements, edgeType, ...fields } = metadata;
  return createCanonicalEdge({
    ...edge, ...(edgeType ? { type: edgeType } : {}),
    ...(requirements && Object.keys(requirements).length ? { requirements } : {}),
    metadata: { ...(edge.metadata ?? {}), ...fields, canonicalType: edge.metadata?.canonicalType ?? edge.type },
  });
}

export function classifyExecutionFailure(reason) {
  const code = text(reason).toUpperCase();
  if (TYPED_FAILURE_CODES.includes(code)) return code;
  const aliases = {
    portal_unavailable: 'PORTAL_MISSING', portal_not_found: 'PORTAL_MISSING',
    npc_unavailable: 'NPC_NOT_FOUND', npc_identity_or_dialogue_metadata_missing: 'NPC_NOT_FOUND',
    npc_interaction_unconfirmed: 'NPC_NO_RESPONSE', npc_timeout: 'NPC_NO_RESPONSE',
    npc_command_rejection: 'DIALOGUE_REJECTED', dialogue_branch_rejected: 'DIALOGUE_REJECTED',
    quests_predicate_false: 'QUEST_LOCKED', quest_state_mismatch: 'QUEST_LOCKED',
    zeny_required: 'ZENY_INSUFFICIENT', item_required: 'ITEM_MISSING', ticket_required: 'ITEM_MISSING',
    arrival_timeout: 'TRANSPORT_TIMEOUT', transport_timeout: 'TRANSPORT_TIMEOUT',
    arrival_map_mismatch: 'ARRIVAL_MISMATCH', arrival_position_mismatch: 'ARRIVAL_MISMATCH',
    zeny_delta_unconfirmed: 'ARRIVAL_MISMATCH', source_temporarily_suppressed: 'CAPABILITY_UNAVAILABLE',
    capability_temporarily_suppressed: 'CAPABILITY_UNAVAILABLE',
  };
  return aliases[text(reason).toLowerCase()] ?? 'UNKNOWN_EXECUTION_FAILURE';
}
function requirementLeaves(requirements) {
  const { allOf, ...rest } = normalizeRequirementPredicates(requirements);
  return [rest, ...(Array.isArray(allOf) ? allOf.flatMap(requirementLeaves) : [])];
}

function probeProof(edge, execution) {
  const proof = edge.metadata?.runtimeProbe;
  const contract = execution?.metadata;
  if (!proof || proof.authority !== 'rAthena' || !text(proof.source)) return false;
  if (proof.noUnsafeSideEffects !== true || proof.rejectionBeforeEffects !== true || proof.failureObservable !== true) return false;
  if (!text(proof.executor) || !text(proof.interactionEvidence) || !finiteBound(proof.maxInteractionSteps, 32)) return false;
  if (!finiteBound(proof.timeoutMs, 60_000) || !finiteBound(proof.maxAttempts, 3) || !finiteBound(proof.suppressionTtlMs, 300_000)) return false;
  if (proof.canonicalReplan !== true || proof.suppressExactEdge !== true) return false;
  if (contract?.expectedResult?.currentMap !== edge.to || contract?.expectedResult?.authority !== 'rAthena') return false;
  if (contract.interactionMode === 'DIALOGUE') {
    return Boolean(contract.npc?.name && proof.dialogueCloseSupported === true && text(proof.selectorEvidence));
  }
  return contract?.interactionMode === 'SERVER_COMMAND' && proof.allowlistedCommand === contract.command?.name;
}

export function classifyExecutionEdge(edge, { context, metadataBySource = new Map(), suppressedSources = new Set(), suppressedCapabilities = new Set() } = {}) {
  const candidate = bindExecutionEdge(edge, metadataBySource);
  const type = candidate?.type;
  const metadata = candidate?.metadata ?? {};
  const evaluated = requirementLeaves(candidate?.requirements).map((part) => evaluateRequirement(part, context));
  // A known false condition wins even when an earlier sibling is unavailable.
  const requirement = evaluated.find((item) => item.status === REQUIREMENT_STATUS.LOCKED_REQUIREMENT && item.authority !== 'UNKNOWN')
    ?? evaluated.find((item) => item.status !== REQUIREMENT_STATUS.READY)
    ?? evaluateRequirement({}, context);
  const execution = normalizeExecutionMetadata(candidate, { context });
  const reject = (reason, status = 'MISSING_EXECUTION_SEAM', failureCode = 'CAPABILITY_UNAVAILABLE') => ({
    executionClass: EXECUTION_CLASS.UNKNOWN_UNSAFE, status, reason, failureCode,
    domain: requirement.domain, edge: candidate, requirement, execution,
  });
  if (!candidate) return reject('edge_identity_missing');
  if (suppressedSources.has(canonicalEdgeKey(candidate)) || (candidate.source && suppressedSources.has(candidate.source))) return reject('source_temporarily_suppressed', 'SUPPRESSED');
  if (suppressedCapabilities.has(canonicalCapabilityKey(candidate))) return reject('capability_temporarily_suppressed', 'SUPPRESSED');
  const proofReady = probeProof(candidate, execution);
  if (requirement.status !== REQUIREMENT_STATUS.READY) {
    // Known false is never a probe. Only unavailable/unproven runtime conditions
    // may be deferred to a source-proven, deny-before-effects interaction.
    const unknown = requirement.status === REQUIREMENT_STATUS.CONTEXT_UNAVAILABLE || requirement.authority === 'UNKNOWN';
    if (!unknown || !proofReady) return reject(requirement.reason, requirement.status,
      unknown ? 'CAPABILITY_UNAVAILABLE' : classifyExecutionFailure(requirement.reason));
  }
  if (candidate.authority !== 'rAthena' || !text(candidate.source)) return reject('transport_authority_missing');
  if (metadata.unsafe === true || metadata.destructive === true || metadata.dynamicDestination === true) return reject('unsafe_or_unbound_dynamic_transport');
  if (execution.status !== 'READY') return reject(execution.reason, execution.status);
  const contract = execution.metadata;
  // SAVE_MAP observes a setting; it is not a movement edge to that map.
  if (type === T.SAVE_MAP) return reject('save_point_is_not_arrival');
  if (contract.expectedDestination?.map !== candidate.to || contract.entry?.map !== candidate.from) return reject('transport_binding_mismatch');
  let known = false;
  if (type === T.PORTAL || type === T.DUNGEON_TRANSITION) {
    known = point(contract.entry.x, contract.entry.y) && point(contract.expectedDestination.x, contract.expectedDestination.y);
    if (type === T.DUNGEON_TRANSITION && !['warp', 'warp2'].includes(metadata.syntax)) known = false;
    if (!known) return reject('portal_coordinates_missing');
  } else if (type === T.KAFRA_TRANSPORT) {
    // KAFRA_CONTENT binds identity/selector; cost must still be source-proven.
    known = Boolean(contract.npc?.name && point(contract.npc.x, contract.npc.y)
      && finiteBound(contract.dialogue?.cityMenuIndex, 100)
      && Number.isFinite(candidate.requirements?.zeny) && candidate.requirements.zeny >= 0);
  } else if (type === T.ITEM_WARP || type === T.BUTTERFLY_WING) {
    // Do not infer generic item semantics or mapflag permission from an item ID.
    const proof = metadata.itemWarpProof;
    known = proof?.authority === 'rAthena' && Boolean(text(proof.source)) && proof.restrictionsAllowed === true
      && proof.freshness === 'FRESH' && proof.itemId === contract.item?.itemId && proof.expectedMap === candidate.to
      && context?.freshness?.domains?.items === 'FRESH' && Number(context.items?.[contract.item.itemId]) > 0
      && (contract.item.itemId !== 602 || (context?.freshness?.domains?.savePoint === 'FRESH' && context.savePoint === candidate.to));
  }
  if (known && requirement.status === REQUIREMENT_STATUS.READY) return {
    executionClass: EXECUTION_CLASS.KNOWN_EXECUTABLE, status: 'READY', reason: null, failureCode: null, edge: candidate, requirement, execution,
  };
  if (proofReady && [T.NPC_TRANSPORT, T.KAFRA_TRANSPORT, T.SCRIPTED_TRANSFER, T.COMMAND_TRANSFER, T.AIRSHIP].includes(type)) return {
    executionClass: EXECUTION_CLASS.SAFE_RUNTIME_PROBE, status: 'READY', reason: null, failureCode: null,
    requirementDeferred: requirement.status !== REQUIREMENT_STATUS.READY, edge: candidate, requirement, execution,
  };
  return reject('runtime_probe_safety_unproven');
}
