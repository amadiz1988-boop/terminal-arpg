// SERVER_AGENT Web relocation execution state machine (PURE).
//
// CP-R2: drives a CP-R1 relocation plan one leg at a time. It is NOT another
// movement engine: it only decides which single existing action to emit next and
// whether that leg is confirmed by an authoritative observation. Every stage
// advances only after server/read-model confirmation. No setTimeout, no browser
// state, no DB teleport.
//
// Idempotency: an action is emitted at most once per stage until the matching
// authoritative confirmation arrives (no duplicate butterfly / Kafra dialogue /
// start_farm).

import { RELOCATION_STATE } from './relocation-policy.mjs';

export const RELOCATION_ACTION = Object.freeze({
  CLAIM_AND_NAVIGATE: 'claim_and_navigate',       // existing native navigation
  KAFRA_SAVE_DIALOGUE: 'kafra_save_dialogue',     // existing TALK_NPC + DIALOG_MENU_SELECT
  CLOSE_DIALOGUE: 'close_dialogue',
  BUTTERFLY_WING: 'butterfly_wing',               // existing native item-use (602)
  KAFRA_TRANSFER_DIALOGUE: 'kafra_transfer_dialogue',
  START_FARM: 'start_farm',                       // existing start_farm
  WAIT: 'wait',
  FAIL: 'fail',
});

const STEP_STAGE = Object.freeze({
  DIRECT_TO_HUB: RELOCATION_STATE.ROUTING_TO_HUB,
  KAFRA_SAVE: RELOCATION_STATE.SAVING,
  CLOSE_NPC: RELOCATION_STATE.CLOSING,
  VERIFY_SAVEPOINT: RELOCATION_STATE.VERIFYING_SAVEPOINT,
  BUTTERFLY_WING: RELOCATION_STATE.VERIFYING_SAVEPOINT,
  KAFRA_DIALOG_TRANSFER: RELOCATION_STATE.SERVICE_DIALOG,
  VERIFY_SERVICE_ARRIVAL: RELOCATION_STATE.VERIFYING_SERVICE_ARRIVAL,
  DIRECT_TO_TARGET: RELOCATION_STATE.DIRECT_TO_TARGET,
  START_FARM: RELOCATION_STATE.READY_TO_START_FARM,
});

export function createRelocationProgress() {
  return { index: 0, dispatched: {}, done: false, reason: null };
}

function actionForStep(step) {
  switch (step.kind) {
    case 'DIRECT_TO_HUB':
    case 'DIRECT_TO_TARGET':
      return RELOCATION_ACTION.CLAIM_AND_NAVIGATE;
    case 'KAFRA_SAVE':
      return RELOCATION_ACTION.KAFRA_SAVE_DIALOGUE;
    case 'CLOSE_NPC':
      return RELOCATION_ACTION.CLOSE_DIALOGUE;
    case 'BUTTERFLY_WING':
      return RELOCATION_ACTION.BUTTERFLY_WING;
    case 'KAFRA_DIALOG_TRANSFER':
      return RELOCATION_ACTION.KAFRA_TRANSFER_DIALOGUE;
    case 'START_FARM':
      return RELOCATION_ACTION.START_FARM;
    default:
      return RELOCATION_ACTION.WAIT;
  }
}

// Is the authoritative observation sufficient to confirm this step is done?
function stepConfirmed(step, plan, observation) {
  const currentMap = observation.currentMap ?? null;
  switch (step.kind) {
    case 'DIRECT_TO_HUB':
    case 'DIRECT_TO_TARGET': {
      const destination = step.route?.[step.route.length - 1];
      return currentMap != null && currentMap === destination;
    }
    case 'KAFRA_SAVE':
      return observation.savePoint === step.saveMap;
    case 'CLOSE_NPC':
      return observation.dialogClosed === true;
    case 'VERIFY_SAVEPOINT':
      return observation.savePoint === step.expectedMap;
    case 'BUTTERFLY_WING':
      return currentMap != null && currentMap === step.expectedMap;
    case 'KAFRA_DIALOG_TRANSFER': {
      const arrival = plan.steps.find((s) => s.kind === 'VERIFY_SERVICE_ARRIVAL');
      return arrival != null && currentMap === arrival.expectedMap;
    }
    case 'VERIFY_SERVICE_ARRIVAL':
      return currentMap === step.expectedMap;
    case 'START_FARM':
      return observation.agentMode === 'AUTO_FARM';
    default:
      return false;
  }
}

// Advance one stage. Returns { action, stageIndex, progress, done, reason }.
// `action` is non-null only when the caller must emit a new authoritative action;
// it is never re-emitted for the same stage until stepConfirmed() is observed.
export function nextRelocationAction(plan, progress, observation = {}) {
  if (!plan || plan.policy === 'UNREACHABLE')
    return { action: null, stageIndex: progress.index, progress, done: false,
      reason: plan?.reason ?? 'farm_target_invalid' };
  if (progress.done)
    return { action: null, stageIndex: progress.index, progress, done: true, reason: null };
  if (observation.failure)
    return { action: null, stageIndex: progress.index, progress, done: false,
      reason: observation.failure };

  const step = plan.steps[progress.index];
  if (!step)
    return { action: null, stageIndex: progress.index, progress, done: true, reason: null };

  const stage = STEP_STAGE[step.kind] ?? null;

  if (stepConfirmed(step, plan, observation)) {
    progress.index += 1;
    progress.dispatched[progress.index] = false;
    const complete = progress.index >= plan.steps.length;
    progress.done = complete;
    return { action: null, stageIndex: progress.index, stage, progress, done: complete, reason: null };
  }

  const action = actionForStep(step);
  if (action === RELOCATION_ACTION.WAIT || progress.dispatched[progress.index]) {
    // Verification-only steps (and already-dispatched actions) emit nothing until
    // the authoritative confirmation arrives - no duplicate side effects.
    return { action: null, stageIndex: progress.index, stage, progress, done: false, reason: null,
      waitingForConfirmation: true };
  }

  progress.dispatched[progress.index] = true;
  return { action, stageIndex: progress.index, stage, step, progress, done: false, reason: null };
}

export function relocationBlockedReason(plan) {
  return plan?.reason ?? null;
}
