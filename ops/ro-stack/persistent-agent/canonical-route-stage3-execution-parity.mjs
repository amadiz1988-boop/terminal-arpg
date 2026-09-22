// Stage 3 shadow execution parity helpers.
// These functions describe the existing PA acknowledgement and arrival
// contract. They do not execute commands or solve a replacement route.

export const FAILURE_TO_REPLAN = Object.freeze({
  command_failure: 'COMMAND_FAILURE',
  arrival_timeout: 'ARRIVAL_TIMEOUT',
  portal_unavailable: 'PORTAL_UNAVAILABLE',
  npc_command_rejection: 'NPC_COMMAND_REJECTION',
});

function terminalMap(step) {
  if (step.kind === 'DIRECT_TO_TARGET') return step.route?.at(-1)?.map ?? null;
  return step.expectedMap ?? step.saveMap ?? step.targetMap ?? null;
}

export function executionContractForStep(step) {
  const destination = terminalMap(step);
  switch (step.kind) {
    case 'DIRECT_TO_TARGET':
      return { canonicalStep: step, adapterOutput: step.kind,
        paCommand: 'start_navigation', expectedAck: 'command CONFIRMED',
        arrivalSignal: `authoritative currentMap=${destination}`,
        completionSignal: 'advance after arrival confirmation' };
    case 'KAFRA_DIALOG_TRANSFER':
      return { canonicalStep: step, adapterOutput: step.kind,
        paCommand: ['talk_to_npc', 'dialog_next', 'dialog_select', 'dialog_next', 'dialog_select', 'dialog_close'],
        expectedAck: 'each command CONFIRMED and cursor sequence complete',
        arrivalSignal: `authoritative currentMap=${destination}`,
        completionSignal: 'advance after sequence and arrival confirmation' };
    case 'BUTTERFLY_WING':
      return { canonicalStep: step, adapterOutput: step.kind, paCommand: 'use_item',
        expectedAck: 'use_item CONFIRMED',
        arrivalSignal: `authoritative currentMap/savePoint=${destination}`,
        completionSignal: 'advance after authoritative arrival; quantity may remain unchanged' };
    case 'VERIFY_SAVEPOINT':
      return { canonicalStep: step, adapterOutput: step.kind, paCommand: [],
        expectedAck: 'observation available', arrivalSignal: `authoritative savePoint=${destination}`,
        completionSignal: 'advance after save-point confirmation' };
    case 'START_FARM':
      return { canonicalStep: step, adapterOutput: step.kind, paCommand: 'start_farm',
        expectedAck: 'command CONFIRMED', arrivalSignal: 'authoritative agentMode=AUTO_FARM',
        completionSignal: 'journey complete after AUTO_FARM confirmation' };
    case 'SERVER_COMMAND':
      return { canonicalStep: step, adapterOutput: step.kind, paCommand: 'run_server_command',
        expectedAck: 'command CONFIRMED', arrivalSignal: `authoritative transfer result=${destination}`,
        completionSignal: 'advance after authoritative result' };
    default:
      return { canonicalStep: step, adapterOutput: step.kind, paCommand: [],
        expectedAck: 'no supported execution seam', arrivalSignal: 'none',
        completionSignal: 'fail closed' };
  }
}

export function buildExecutionContractMatrix(plan) {
  return (plan?.steps ?? []).map(executionContractForStep);
}

export function butterflyJourneyResult({ itemPresent, expectedMap, observedMap, observedSavePoint,
  quantityBefore, quantityAfter }) {
  if (!itemPresent) return { status: 'BLOCKED', reason: 'item_required', replan: true };
  const arrived = observedMap === expectedMap || observedSavePoint === expectedMap;
  if (!arrived) return { status: 'WAITING', reason: 'arrival_pending', replan: false };
  return {
    status: 'SUCCESS',
    reason: null,
    quantityUnchanged: quantityBefore === quantityAfter,
    presenceBased: true,
    nonConsumable: true,
    replan: false,
  };
}

export function flyWingBoundary(plan) {
  const commands = Array.isArray(plan?.commands) ? plan.commands : [];
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  const leaked = commands.some((command) => Number(command?.payload?.itemId) === 601) ||
    steps.some((step) => step.kind === 'BUTTERFLY_WING' && Number(step.itemId) === 601);
  return { valid: !leaked, reason: leaked ? 'fly_wing_cross_map_route_forbidden' : null };
}

export function executionFailureReplan({ failure, currentMap, targetMap }) {
  const reason = FAILURE_TO_REPLAN[failure];
  if (!reason) return { status: 'UNKNOWN_FAILURE', replan: false, reason: 'unclassified_execution_failure' };
  return {
    status: 'REPLAN_REQUIRED',
    replan: true,
    reason,
    canonicalPlannerRequest: { source: currentMap ?? null, target: targetMap ?? null },
    routeSolverInvoked: false,
  };
}
