import { LAYER_RESULT, TRACE_RESULT } from './trace-schema.mjs';

export function analyzeTrace(trace) {
  const layers = Array.isArray(trace?.layers) ? trace.layers : [];
  let firstBroken = null;
  let firstFailureIndex = -1;
  for (let index = 0; index < layers.length; index += 1) {
    const event = layers[index];
    if ([LAYER_RESULT.FAIL, LAYER_RESULT.TIMEOUT, LAYER_RESULT.BLOCKED].includes(event.result)) {
      firstBroken = event.transition ?? `${event.layer} -> ${event.stage}`;
      firstFailureIndex = index;
      break;
    }
  }
  const failed = firstBroken != null;
  const result = trace?.result ?? (failed ? TRACE_RESULT.FAIL : TRACE_RESULT.BLOCKED);
  return {
    result,
    firstBrokenTransition: firstBroken,
    failLayer: firstFailureIndex >= 0 ? layers[firstFailureIndex].layer : null,
    failStage: firstFailureIndex >= 0 ? layers[firstFailureIndex].stage : null,
    failErrorCode: firstFailureIndex >= 0 ? layers[firstFailureIndex].errorCode : null,
    awaitedTransition: layers.find((event) => event.result === LAYER_RESULT.TIMEOUT)?.transition ?? null,
    notRunAfterFailure: firstFailureIndex >= 0
      ? layers.slice(firstFailureIndex + 1).filter((event) => event.result === LAYER_RESULT.NOT_RUN).length
      : 0,
  };
}

export function normalizeDownstreamResults(layers = []) {
  let failed = false;
  return layers.map((event) => {
    if (failed && event.result === LAYER_RESULT.FAIL) return { ...event, result: LAYER_RESULT.NOT_RUN };
    if ([LAYER_RESULT.FAIL, LAYER_RESULT.TIMEOUT, LAYER_RESULT.BLOCKED].includes(event.result)) failed = true;
    return event;
  });
}
