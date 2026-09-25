import { actionKeyForScenario, getActionDefinition } from './action-registry.mjs';
import { classifyError } from './error-taxonomy.mjs';
import { analyzeTrace, normalizeDownstreamResults } from './trace-analyzer.mjs';
import {
  appendTraceLayer,
  completeTrace,
  createTrace,
  LAYER_RESULT,
  TRACE_RESULT,
} from './trace-schema.mjs';

const CHECKPOINTS = [
  ['api', 'API', 'RESPONSE', 'HTTP -> Controller'],
  ['controller', 'CONTROLLER', 'VALIDATION', 'Controller -> Command'],
  ['command', 'COMMAND_DISPATCH', 'CREATE', 'Command -> Native Receive'],
  ['native', 'NATIVE_ACCEPT', 'ACK', 'Native Receive -> Native Result'],
  ['state', 'PA_STATE', 'CONVERGE', 'Native Result -> Authoritative State'],
  ['events', 'EVENT_LEDGER', 'OBSERVE', 'Authoritative State -> Event Ledger'],
];

function stateFrom(result, side) {
  return result?.observed?.[side] ?? null;
}

function resultForCheckpoint(checkpoint, failureSeen) {
  if (checkpoint?.status === 'EXPECTED_EXCLUSION') return LAYER_RESULT.NOT_RUN;
  if (failureSeen && !checkpoint?.ok) return LAYER_RESULT.NOT_RUN;
  if (checkpoint?.timedOut) return LAYER_RESULT.TIMEOUT;
  if (checkpoint?.ok === false) return LAYER_RESULT.FAIL;
  if (checkpoint?.ok === true) return LAYER_RESULT.PASS;
  return LAYER_RESULT.NOT_RUN;
}

function effectiveCheckpoint(key, checkpoint, result) {
  if (key === 'api' && checkpoint?.httpStatus === 409 &&
      String(result?.failReason ?? checkpoint?.reason ?? '').toLowerCase() === 'supply_route_unavailable') {
    // The request reached the Dashboard controller.  The HTTP error is the
    // controller's public rejection, so command creation remains the broken seam.
    return { ...checkpoint, ok: true, reason: null };
  }
  return checkpoint;
}

export function traceScenarioResult(result, options = {}) {
  const actionKey = actionKeyForScenario(result?.scenario);
  const definition = getActionDefinition(actionKey);
  const before = stateFrom(result, 'before');
  const after = stateFrom(result, 'after');
  const trace = createTrace({
    traceId: result?.traceId,
    actionKey,
    actionLabel: definition?.zhTWLabel ?? actionKey,
    charId: result?.charId ?? options.charId ?? null,
    accountId: options.supportSessionContext?.effectiveAccountId ?? null,
    actorAdminId: options.supportSessionContext?.actorAdminId ?? null,
    effectiveAccountId: options.supportSessionContext?.effectiveAccountId ?? null,
    supportSessionId: options.supportSessionContext?.supportSessionId ?? null,
    impersonation: Boolean(options.supportSessionContext),
    startedAt: options.startedAt ?? new Date(Date.now() - Number(result?.durationMs ?? 0)).toISOString(),
    currentMap: before?.map ?? result?.sourceMap ?? null,
    targetMap: result?.targetMap ?? result?.farmTarget ?? options.targetMap ?? null,
    tracePropagationGap: {
      present: true,
      reason: 'scenario header is observable; Dashboard command and Event Ledger correlation field is not persisted',
    },
  });
  appendTraceLayer(trace, {
    layer: 'BROWSER', stage: 'INVOCATION', result: LAYER_RESULT.PASS,
    transition: 'Browser -> Scenario Runner',
    metadata: { synthetic: true, dryRun: options.dryRun === true },
  });

  let failureSeen = false;
  for (const [key, layer, stage, transition] of CHECKPOINTS) {
    const checkpoint = effectiveCheckpoint(key, result?.[key], result);
    const layerResult = resultForCheckpoint(checkpoint, failureSeen);
    const rawReason = checkpoint?.reason ?? result?.failReason ?? null;
    const descriptor = rawReason ? classifyError(rawReason) : null;
    if (key === 'native') {
      appendTraceLayer(trace, {
        layer: 'NATIVE_RECEIVE',
        stage: 'RECEIVE',
        result: layerResult,
        transition: 'Command -> Native Receive',
        errorCode: layerResult === LAYER_RESULT.PASS || layerResult === LAYER_RESULT.NOT_RUN ? null : descriptor.code,
        reason: layerResult === LAYER_RESULT.PASS || layerResult === LAYER_RESULT.NOT_RUN ? null : rawReason,
        metadata: { status: checkpoint?.status ?? null, reasonCode: checkpoint?.reasonCode ?? null },
      });
    }
    appendTraceLayer(trace, {
      layer,
      stage,
      result: layerResult,
      transition,
      errorCode: layerResult === LAYER_RESULT.PASS || layerResult === LAYER_RESULT.NOT_RUN ? null : descriptor.code,
      reason: layerResult === LAYER_RESULT.PASS || layerResult === LAYER_RESULT.NOT_RUN ? null : rawReason,
      durationMs: checkpoint?.durationMs ?? null,
      metadata: {
        httpStatus: checkpoint?.httpStatus ?? null,
        status: checkpoint?.status ?? null,
        reasonCode: checkpoint?.reasonCode ?? null,
        observationOnly: checkpoint?.observationOnly ?? false,
      },
    });
    if ([LAYER_RESULT.FAIL, LAYER_RESULT.TIMEOUT, LAYER_RESULT.BLOCKED].includes(layerResult)) failureSeen = true;
  }
  trace.layers = normalizeDownstreamResults(trace.layers);
  const traceResult = result?.result === TRACE_RESULT.BLOCKED
    ? TRACE_RESULT.BLOCKED
    : result?.result === TRACE_RESULT.PASS
      ? TRACE_RESULT.PASS
      : TRACE_RESULT.FAIL;
  completeTrace(trace, {
    result: traceResult,
    currentMap: after?.map ?? trace.currentMap,
    targetMap: result?.targetMap ?? result?.farmTarget ?? trace.targetMap,
  });
  const analysis = analyzeTrace(trace);
  return { trace, analysis };
}
