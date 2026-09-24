// Pure decision helpers for the ADMIN character agent controls
// (啟動角色自主 / 啟動掛機).
//
// No SQL, no HTTP, no DOM: the caller supplies the authoritative read-model
// rows and receives an explicit decision. Keeping the transition rules here
// means the admin transport, the UI and the test harness all share ONE
// activation/farm decision instead of each re-deriving it.
//
// These helpers never create a Web session and never touch OpenKore; the
// existing SERVER_AGENT claim_agent / start_farm command surface remains the
// only executor.

export const AGENT_PHASE = Object.freeze({
  RESIDENT: 'resident',
  CLAIM: 'claim',
  WAIT: 'wait',
  BLOCKED: 'blocked',
});

export const FARM_DECISION = Object.freeze({
  START: 'start',
  ALREADY_FARMING: 'already_farming',
  BLOCKED: 'blocked',
});

// The character is already a live SERVER_AGENT resident: autonomy is active and
// no claim command is needed.
export function isServerAgentResident(stateRow, live) {
  return (
    Boolean(stateRow) &&
    String(stateRow.controlOwner ?? '') === 'SERVER_AGENT' &&
    String(stateRow.ownershipState ?? '') === 'SERVER_AGENT' &&
    Boolean(stateRow.agentEnabled) &&
    Boolean(live?.resident)
  );
}

// Decide what the autonomy action must do next:
//   resident → already autonomous, direct path
//   claim    → queue the existing claim_agent activation
//   wait     → a claim is already in flight / ownership already transferred
//   blocked  → explicit blocker, never proceed
export function decideActivation({ stateRow = null, live = null, characterOnline = false } = {}) {
  if (isServerAgentResident(stateRow, live))
    return { phase: AGENT_PHASE.RESIDENT, blocker: null };
  const owner = String(stateRow?.controlOwner ?? 'OPENKORE');
  const ownership = String(stateRow?.ownershipState ?? 'OPENKORE');
  if (ownership === 'QUARANTINED')
    return { phase: AGENT_PHASE.BLOCKED, blocker: 'agent_quarantined' };
  if (ownership === 'CLAIMING_AGENT' || owner === 'SERVER_AGENT')
    return { phase: AGENT_PHASE.WAIT, blocker: null };
  if (owner === 'OPENKORE' && ownership === 'OPENKORE') {
    // The native claim CAS requires char.online = 0. A real client logged in is
    // an explicit blocker, never something to force through.
    if (characterOnline)
      return { phase: AGENT_PHASE.BLOCKED, blocker: 'character_online' };
    return { phase: AGENT_PHASE.CLAIM, blocker: null };
  }
  return { phase: AGENT_PHASE.BLOCKED, blocker: 'agent_state_unsupported' };
}

// Decide the farm start once the character is confirmed resident. A missing
// farm target is an explicit blocker (no silent fallback); an already active
// task is reported as ALREADY_FARMING so the caller never re-dispatches.
export function decideFarmStart({
  resident = false,
  startFarmAllowed = false,
  startFarmBlocker = null,
  farmTarget = null,
} = {}) {
  if (!resident)
    return { decision: FARM_DECISION.BLOCKED, blocker: 'not_resident' };
  if (startFarmAllowed && farmTarget)
    return { decision: FARM_DECISION.START, blocker: null };
  if (startFarmBlocker === 'task_already_active')
    return { decision: FARM_DECISION.ALREADY_FARMING, blocker: 'task_already_active' };
  if (!farmTarget)
    return {
      decision: FARM_DECISION.BLOCKED,
      blocker: startFarmBlocker ?? 'farm_target_unresolved',
    };
  return {
    decision: FARM_DECISION.BLOCKED,
    blocker: startFarmBlocker ?? 'invalid_transition',
  };
}
