// Admission and bounded failure policy for the existing PA Journey seam.
// No command dispatch, alternate planner, or gameplay authority is introduced.
import { buildCanonicalGraph, solveCanonicalRoute, OPENKORE_ROUTE_WEIGHTS } from './canonical-route-model.mjs';
import { solverOptionsFromContext, evaluateRequirement, normalizeRequirementPredicates } from './canonical-route-requirement-context.mjs';
import { confirmAuthoritativeExecutionResult } from './canonical-route-execution-metadata.mjs';
import { normalizeExecutionMetadata, EXECUTION_METADATA_STATUS } from './canonical-route-execution-metadata.mjs';
import {
  classifyExecutionEdge, classifyExecutionFailure, EXECUTION_CLASS,
  canonicalEdgeKey, canonicalCapabilityKey,
} from './canonical-route-execution-classification.mjs';

export const CAPABILITY_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE', LOCKED_REQUIREMENT: 'LOCKED_REQUIREMENT', CONTEXT_UNAVAILABLE: 'CONTEXT_UNAVAILABLE',
  MISSING_EXECUTION_SEAM: 'MISSING_EXECUTION_SEAM', SUPPRESSED: 'SUPPRESSED',
});
export const NAVIGATION_ROUTE_ENGINE_COUNT = 1;

export function inspectCanonicalEdgeCapability(edge, options = {}) {
  if (options.executionAdmission !== true) {
    const metadata = options.metadataBySource?.get?.(edge?.source);
    const candidate = metadata ? buildCanonicalGraph({ edges: [{ ...edge, ...(metadata.requirements ? { requirements: metadata.requirements } : {}), metadata: { ...(edge.metadata ?? {}), ...metadata } }] }).edges[0] : edge;
    const requirement = options.context ? (awaitableRequirement(candidate, options.context)) : { status: 'READY' };
    if (requirement.status === 'CONTEXT_UNAVAILABLE') return { status: CAPABILITY_STATUS.CONTEXT_UNAVAILABLE, reason: requirement.reason, domain: requirement.domain, edge: candidate };
    if (requirement.status === 'LOCKED_REQUIREMENT') return { status: CAPABILITY_STATUS.LOCKED_REQUIREMENT, reason: requirement.reason, domain: requirement.domain, edge: candidate };
    const execution = normalizeExecutionMetadata(candidate, { context: options.context });
    if (execution.status !== EXECUTION_METADATA_STATUS.READY) return { status: CAPABILITY_STATUS.MISSING_EXECUTION_SEAM, reason: execution.reason, edge: candidate, execution };
    return { status: CAPABILITY_STATUS.AVAILABLE, reason: null, edge: candidate, requirement, execution };
  }
  const inspection = classifyExecutionEdge(edge, options);
  return { ...inspection, status: inspection.executionClass === EXECUTION_CLASS.UNKNOWN_UNSAFE ? inspection.status : CAPABILITY_STATUS.AVAILABLE };
}

function awaitableRequirement(edge, context) {
  const result = evaluateRequirement(normalizeRequirementPredicates(edge.requirements ?? {}), context);
  return result;
}

export function filterCanonicalEdges(graph, options = {}) {
  const included = [], excluded = [];
  for (const edge of graph?.edges ?? []) {
    const inspection = inspectCanonicalEdgeCapability(edge, options);
    (inspection.status === CAPABILITY_STATUS.AVAILABLE ? included : excluded).push(inspection);
  }
  const filteredGraph = buildCanonicalGraph({ edges: included.map(({ edge }) => edge), mapMetadata: graph?.mapMetadata ?? {} });
  const counts = Object.fromEntries(Object.values(CAPABILITY_STATUS).map((status) => [status, 0]));
  for (const inspection of [...included, ...excluded]) counts[inspection.status]++;
  return { graph: filteredGraph, included, excluded, counts };
}

export function solveCapabilityAwareRoute(graph, source, target, options = {}) {
  const filtered = filterCanonicalEdges(graph, options);
  // A source-proven safe probe delegates an unavailable condition to rAthena.
  // Preserve canonical weights and restore full requirements on output.
  // This never manufactures entitlement in the caller's requirement context.
  const deferred = new Map(filtered.included.filter((entry) => entry.requirementDeferred)
    .map((entry) => [canonicalEdgeKey(entry.edge), entry.edge]));
  const solverGraph = deferred.size ? buildCanonicalGraph({
    mapMetadata: graph?.mapMetadata,
    edges: filtered.graph.edges.map((edge) => deferred.has(canonicalEdgeKey(edge)) ? {
      ...edge, requirements: {},
      cost: edge.cost + (edge.requirements?.zeny ?? 0) * OPENKORE_ROUTE_WEIGHTS.ZENY
        + (edge.requirements?.ticket ? OPENKORE_ROUTE_WEIGHTS.TICKET : 0),
    } : edge),
  }) : filtered.graph;
  const result = solveCanonicalRoute(solverGraph, source, target, solverOptionsFromContext(options.context));
  return { ...result, edges: result.edges.map((edge) => deferred.get(canonicalEdgeKey(edge)) ?? edge),
    capabilityFilter: filtered, solver: 'canonical-weighted-solver', legacyFallbackInvocations: 0 };
}

const bound = (value, fallback, max, min = 1) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;

export function createBoundedCanonicalReplan({
  maxAttempts = 3, maxTransientRetries = 2, retryDelayMs = 1000,
  suppressionTtlMs = 30_000, maxElapsedMs = 120_000, now = () => Date.now(), parentIntent = null,
} = {}) {
  const limit = bound(maxAttempts, 3, 3);
  const retryLimit = bound(maxTransientRetries, 2, 2, 0);
  const delay = bound(retryDelayMs, 1000, 30_000);
  const ttl = bound(suppressionTtlMs, 30_000, 300_000);
  const startedAt = now();
  if (!Number.isFinite(startedAt)) throw new TypeError('navigation clock must be finite');
  const deadline = startedAt + bound(maxElapsedMs, 120_000, 300_000);
  let intent = parentIntent == null ? null : structuredClone(parentIntent);
  const suppressedSources = new Set(), suppressedCapabilities = new Set(), suppressionLedger = new Map();
  const retryState = new Map(), handledActions = new Set();
  let attempts = 0, actionSequence = 0, active = null, interrupted = false, lastTime = startedAt;
  const time = () => {
    const value = now();
    if (!Number.isFinite(value) || value < lastTime) throw new TypeError('navigation clock must be monotonic');
    lastTime = value;
    return value;
  };
  const captureIntent = (value) => { if (intent === null && value != null) intent = structuredClone(value); };
  const result = (status, fields = {}) => ({ status, attempts, parentIntent: intent == null ? null : structuredClone(intent), legacyFallbackInvocations: 0, ...fields });
  const cleanupExpired = () => {
    const at = time();
    for (const [key, entry] of suppressionLedger) if (entry.suppressedUntil <= at) suppressionLedger.delete(key);
    suppressedSources.clear(); suppressedCapabilities.clear();
    for (const entry of suppressionLedger.values()) {
      if (entry.scope === 'CAPABILITY') suppressedCapabilities.add(entry.capability);
      else suppressedSources.add(entry.scope === 'SOURCE' ? entry.source : entry.edgeKey);
    }
  };
  const exhausted = () => time() >= deadline || attempts >= limit;
  const optionsWithSuppression = (options) => ({ ...options, suppressedSources, suppressedCapabilities });

  const beginAttempt = ({ edge, parentIntent: suppliedIntent, ...options } = {}) => {
    captureIntent(suppliedIntent);
    cleanupExpired();
    if (interrupted) return result('PA_INTERRUPTED');
    if (active) return result('ACTION_ACTIVE', { actionId: active.actionId });
    if (exhausted()) return result('BOUNDED_REPLAN_EXHAUSTED', { failureCode: 'TRANSPORT_TIMEOUT' });
    const retry = retryState.get(canonicalEdgeKey(edge));
    if (retry && time() < retry.nextRetryAt) return result('RETRY_WAIT', { nextRetryAt: retry.nextRetryAt });
    const inspection = classifyExecutionEdge(edge, optionsWithSuppression(options));
    if (inspection.executionClass === EXECUTION_CLASS.UNKNOWN_UNSAFE) return result('EDGE_BLOCKED', { inspection, failureCode: inspection.failureCode });
    active = { actionId: ++actionSequence, edge: inspection.edge, contract: inspection.execution.metadata, startedAt: time() };
    return result('EXECUTE_EDGE', { actionId: active.actionId, edge: active.edge, contract: active.contract, executionClass: inspection.executionClass });
  };

  const observeSuccess = ({ actionId, observation } = {}) => {
    if (interrupted) return result('PA_INTERRUPTED');
    if (!active || active.actionId !== actionId) return result('STALE_ACTION');
    if (time() >= deadline) return result('BOUNDED_REPLAN_EXHAUSTED', { failureCode: 'TRANSPORT_TIMEOUT' });
    if (observation?.authority !== 'rAthena' || observation?.freshness !== 'FRESH'
        || !Number.isFinite(observation?.observedAt) || observation.observedAt < active.startedAt || observation.observedAt > time()) {
      return result('ARRIVAL_REJECTED', { reason: 'authoritative_fresh_observation_required', failureCode: 'CAPABILITY_UNAVAILABLE' });
    }
    const confirmation = confirmAuthoritativeExecutionResult(active.contract, observation);
    if (confirmation.status !== 'CONFIRMED') return result('ARRIVAL_REJECTED', { reason: confirmation.reason, failureCode: classifyExecutionFailure(confirmation.reason) });
    handledActions.add(actionId); active = null;
    return result('EDGE_CONFIRMED', { confirmation });
  };

  const observeFailure = ({ edge, reason = 'execution_failure', transient = false, scope = 'EDGE', actionId,
    actionSettled = false, dialogueClosed = false, parentIntent: suppliedIntent } = {}) => {
    captureIntent(suppliedIntent);
    cleanupExpired();
    if (interrupted) return result('PA_INTERRUPTED');
    if (actionId !== undefined && handledActions.has(actionId)) return result('STALE_ACTION');
    if (active && (actionId !== active.actionId || actionSettled !== true)) return result('ACTION_ACTIVE', { actionId: active.actionId });
    if (!active && actionId !== undefined) return result('STALE_ACTION');
    if (active?.contract.interactionMode === 'DIALOGUE' && dialogueClosed !== true) return result('DIALOGUE_CLEANUP_REQUIRED');
    const failedEdge = active?.edge ?? edge;
    if (!failedEdge || !['EDGE', 'SOURCE', 'CAPABILITY'].includes(scope) || (scope === 'SOURCE' && !failedEdge.source)) return result('INVALID_FAILURE_SCOPE');
    const failureCode = classifyExecutionFailure(reason);
    const wasActive = Boolean(active);
    if (active) handledActions.add(active.actionId);
    active = null;
    if (exhausted()) return result('BOUNDED_REPLAN_EXHAUSTED', { failureCode, reason: 'bounded_count_or_deadline_reached' });
    const key = canonicalEdgeKey(failedEdge);
    const retry = retryState.get(key) ?? { retries: 0, failures: 0, nextRetryAt: 0 };
    if (transient && !wasActive) return result('SETTLED_ACTION_REQUIRED', { failureCode });
    retry.failures++;
    // Side-effectful retries need a source-proven idempotent/settled contract.
    const retrySafe = ['PORTAL', 'DUNGEON_TRANSITION'].includes(failedEdge.type)
      || failedEdge.metadata?.runtimeProbe?.retrySafeAfterSettled === true;
    if (transient && retrySafe && ['TRANSPORT_TIMEOUT', 'NPC_NO_RESPONSE'].includes(failureCode) && retry.retries < retryLimit) {
      retry.retries++; retry.nextRetryAt = time() + delay;
      retryState.set(key, retry);
      return result('RETRY_SCHEDULED', { failureCode, retries: retry.retries, nextRetryAt: retry.nextRetryAt, edgeKey: key });
    }
    attempts++;
    retryState.set(key, retry);
    const entry = {
      edgeKey: key, source: failedEdge.source ?? null, capability: canonicalCapabilityKey(failedEdge),
      failureReason: reason, failureCode, attempts: retry.failures, suppressedUntil: time() + ttl, scope,
    };
    const scopeKey = scope === 'CAPABILITY' ? entry.capability : scope === 'SOURCE' ? entry.source : key;
    suppressionLedger.set(scope + '|' + scopeKey, entry);
    cleanupExpired();
    return result('REPLAN_REQUIRED', { failureCode, reason, suppressedSource: key, suppression: { ...entry } });
  };

  const replan = ({ graph, source, target, context, metadataBySource = new Map(), executionAdmission = false, failure, parentIntent: suppliedIntent } = {}) => {
    captureIntent(suppliedIntent);
    const observation = observeFailure(failure);
    if (observation.status !== 'REPLAN_REQUIRED') return observation;
    const route = solveCapabilityAwareRoute(graph, source, target, { context, metadataBySource, executionAdmission, suppressedSources, suppressedCapabilities });
    return { ...observation, route, solver: 'canonical-weighted-solver',
      ...(route.status !== 'FOUND' ? { terminalFailure: { code: 'NO_ROUTE_AFTER_REPLAN', cause: observation.failureCode, source, target } } : {}) };
  };
  const interrupt = () => {
    interrupted = true;
    return result('PA_INTERRUPTED', { actionToSettle: active?.actionId ?? null });
  };
  const resume = ({ actionSettled = false, dialogueClosed = false } = {}) => {
    if (active && !actionSettled) return result('ACTION_ACTIVE', { actionId: active.actionId });
    if (active?.contract.interactionMode === 'DIALOGUE' && !dialogueClosed) return result('DIALOGUE_CLEANUP_REQUIRED');
    if (active) handledActions.add(active.actionId);
    active = null; interrupted = false;
    return exhausted() ? result('BOUNDED_REPLAN_EXHAUSTED', { failureCode: 'TRANSPORT_TIMEOUT' }) : result('PA_RESUMED');
  };
  return { beginAttempt, observeSuccess, observeFailure, replan, interrupt, resume, cleanupExpired,
    suppressedSources, suppressedCapabilities, suppressionLedger,
    get attempts() { return attempts; }, get deadline() { return deadline; }, get legacyFallbackInvocations() { return 0; } };
}

export function boundedCanonicalReplan(input = {}) {
  return createBoundedCanonicalReplan(input.options).replan(input);
}
