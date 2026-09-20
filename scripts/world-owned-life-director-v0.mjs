// LIFE｜WORLD_OWNED V0 — isolated deterministic PoC only.
//
// This reducer owns no rAthena truth and emits no runtime command. It models
// only the Life Director decision contract that a future Persistent Agent
// adapter may consume. Player Web is deliberately absent from the authority
// model.

export const CONTROL_AUTHORITY = 'WORLD_OWNED';
export const PLAYER_CONTROL_PATH = 'NONE';
export const POC_ONLY = true;

export const MacroGoal = Object.freeze({
  HUNT: 'HUNT',
  SUPPLY: 'SUPPLY',
  RECOVER: 'RECOVER',
  QUEST: 'QUEST',
  SOCIAL_BREAK: 'SOCIAL_BREAK',
  IDLE: 'IDLE',
});

export const InterruptType = Object.freeze({
  SUPPLY: 'SUPPLY',
  RECOVER: 'RECOVER',
});

export const DecisionReasonCode = Object.freeze({
  INITIAL_GOAL: 'INITIAL_GOAL',
  CONTINUITY_DEFAULT: 'CONTINUITY_DEFAULT',
  REEVALUATION_NOT_DUE: 'REEVALUATION_NOT_DUE',
  SUPPLY_REQUIRED: 'SUPPLY_REQUIRED',
  SUPPLY_COMPLETE: 'SUPPLY_COMPLETE',
  DANGER_DETECTED: 'DANGER_DETECTED',
  RECOVERY_COMPLETE: 'RECOVERY_COMPLETE',
  PLAYER_CONTROL_FORBIDDEN: 'PLAYER_CONTROL_FORBIDDEN',
});

const goals = new Set(Object.values(MacroGoal));
const interrupts = new Set(Object.values(InterruptType));

function clone(value) {
  return structuredClone(value);
}

function assertGoal(goal) {
  if (!goals.has(goal)) throw new TypeError(`INVALID_MACRO_GOAL:${goal}`);
}

function assertWorldOwned(state) {
  if (state?.CONTROL_AUTHORITY !== CONTROL_AUTHORITY)
    throw new Error('WORLD_OWNED_AUTHORITY_REQUIRED');
  if (state?.PLAYER_CONTROL_PATH !== PLAYER_CONTROL_PATH)
    throw new Error('PLAYER_CONTROL_PATH_FORBIDDEN');
}

function assertCharacterId(charId) {
  if (!Number.isSafeInteger(Number(charId)) || Number(charId) <= 0)
    throw new TypeError('charId must be a positive integer');
  return Number(charId);
}

function decisionCandidate(state) {
  return {
    action: 'CONTINUE_CURRENT_ACTIVITY',
    goal: state.CURRENT_MACRO_GOAL,
    reasonCodes: [DecisionReasonCode.CONTINUITY_DEFAULT],
  };
}

function appendDecision(state, {
  eventType,
  selectedAction,
  reasonCodes,
  cause = null,
  boundary = 'EVENT',
  mutated = true,
}) {
  const sequence = Number(state.DECISION_SEQUENCE) + 1;
  const decision = {
    sequence,
    eventType,
    authority: CONTROL_AUTHORITY,
    actor: 'SELF',
    playerControlPath: PLAYER_CONTROL_PATH,
    boundary,
    candidates: [decisionCandidate(state)],
    selectedAction,
    reasonCodes: [...reasonCodes],
    cause,
    mutated,
  };
  return {
    ...state,
    DECISION_SEQUENCE: sequence,
    DECISION_REASON_CODES: [...reasonCodes],
    LAST_DECISION: decision,
    EVENT_LEDGER: [
      ...state.EVENT_LEDGER,
      {
        sequence,
        eventType: 'LIFE_DIRECTOR_DECISION',
        source: 'WORLD_OWNED_LIFE_DIRECTOR_V0',
        authority: CONTROL_AUTHORITY,
        actor: 'SELF',
        decision,
      },
    ],
  };
}

function pushGoal(state, goal, reasonCode, eventType, cause) {
  assertGoal(goal);
  const parentGoal = state.CURRENT_MACRO_GOAL;
  const resumeTarget = parentGoal;
  const next = {
    ...state,
    CURRENT_MACRO_GOAL: goal,
    GOAL_STACK: [
      ...state.GOAL_STACK,
      { goal, parentGoal, enteredBy: reasonCode },
    ],
    INTERRUPT: {
      type: goal,
      status: 'ACTIVE',
      cause,
      parentGoal,
      resumeTarget,
    },
    RESUME_TARGET: resumeTarget,
  };
  return appendDecision(next, {
    eventType,
    selectedAction: `INTERRUPT_${goal}`,
    reasonCodes: [reasonCode],
    cause,
  });
}

function resumeParent(state, reasonCode, eventType) {
  if (!state.INTERRUPT || state.GOAL_STACK.length < 2)
    throw new Error('NO_ACTIVE_INTERRUPT');
  const parentGoal = state.INTERRUPT.resumeTarget;
  assertGoal(parentGoal);
  const next = {
    ...state,
    CURRENT_MACRO_GOAL: parentGoal,
    GOAL_STACK: state.GOAL_STACK.slice(0, -1),
    INTERRUPT: null,
    RESUME_TARGET: null,
  };
  return appendDecision(next, {
    eventType,
    selectedAction: `RESUME_${parentGoal}`,
    reasonCodes: [reasonCode],
    cause: state.INTERRUPT.cause,
  });
}

export function createWorldOwnedLifeState({ charId, initialGoal = MacroGoal.HUNT } = {}) {
  assertCharacterId(charId);
  assertGoal(initialGoal);
  const base = {
    version: 'WORLD_OWNED_LIFE_DIRECTOR_V0',
    charId: Number(charId),
    CONTROL_AUTHORITY,
    PLAYER_CONTROL_PATH,
    CURRENT_MACRO_GOAL: initialGoal,
    GOAL_STACK: [{ goal: initialGoal, parentGoal: null, enteredBy: DecisionReasonCode.INITIAL_GOAL }],
    INTERRUPT: null,
    RESUME_TARGET: null,
    DECISION_REASON_CODES: [DecisionReasonCode.INITIAL_GOAL],
    DECISION_SEQUENCE: 0,
    LAST_DECISION: null,
    EVENT_LEDGER: [],
  };
  return appendDecision(base, {
    eventType: 'INITIALIZE',
    selectedAction: `START_${initialGoal}`,
    reasonCodes: [DecisionReasonCode.INITIAL_GOAL],
    boundary: 'INITIALIZATION',
  });
}

export function applyLifeDirectorEvent(state, event = {}) {
  assertWorldOwned(state);
  if (event.actor === 'PLAYER' || String(event.type ?? '').startsWith('PLAYER_')) {
    const next = appendDecision(state, {
      eventType: 'PLAYER_CONTROL_REJECTED',
      selectedAction: 'REJECT',
      reasonCodes: [DecisionReasonCode.PLAYER_CONTROL_FORBIDDEN],
      cause: event.type ?? null,
      mutated: false,
    });
    return { state: next, decision: next.LAST_DECISION, accepted: false };
  }

  const type = String(event.type ?? '').toUpperCase();
  if (type === 'CONTINUE') {
    if (event.boundary !== true) {
      const decision = {
        sequence: state.DECISION_SEQUENCE,
        eventType: 'CONTINUE_SKIPPED',
        authority: CONTROL_AUTHORITY,
        actor: 'SELF',
        playerControlPath: PLAYER_CONTROL_PATH,
        candidates: [decisionCandidate(state)],
        selectedAction: 'NO_DECISION',
        reasonCodes: [DecisionReasonCode.REEVALUATION_NOT_DUE],
        cause: 'NO_DECISION_BOUNDARY',
        mutated: false,
      };
      return { state, decision, accepted: true };
    }
    const next = appendDecision(state, {
      eventType: 'CONTINUE_CURRENT_ACTIVITY',
      selectedAction: 'CONTINUE_CURRENT_ACTIVITY',
      reasonCodes: [DecisionReasonCode.CONTINUITY_DEFAULT],
      boundary: event.boundaryType ?? 'NATURAL_REEVALUATION',
      mutated: false,
    });
    return { state: next, decision: next.LAST_DECISION, accepted: true };
  }

  if (type === 'SUPPLY_REQUIRED') {
    if (state.CURRENT_MACRO_GOAL === MacroGoal.SUPPLY) return { state, decision: state.LAST_DECISION, accepted: true };
    const next = pushGoal(state, MacroGoal.SUPPLY, DecisionReasonCode.SUPPLY_REQUIRED, type, event.cause ?? 'SUPPLY_REQUIRED');
    return { state: next, decision: next.LAST_DECISION, accepted: true };
  }
  if (type === 'SUPPLY_COMPLETE') {
    if (state.CURRENT_MACRO_GOAL !== MacroGoal.SUPPLY) throw new Error('SUPPLY_NOT_ACTIVE');
    const next = resumeParent(state, DecisionReasonCode.SUPPLY_COMPLETE, type);
    return { state: next, decision: next.LAST_DECISION, accepted: true };
  }
  if (type === 'DANGER_DETECTED') {
    if (state.CURRENT_MACRO_GOAL === MacroGoal.RECOVER) return { state, decision: state.LAST_DECISION, accepted: true };
    const next = pushGoal(state, MacroGoal.RECOVER, DecisionReasonCode.DANGER_DETECTED, type, event.cause ?? 'DANGER_DETECTED');
    return { state: next, decision: next.LAST_DECISION, accepted: true };
  }
  if (type === 'RECOVER_COMPLETE') {
    if (state.CURRENT_MACRO_GOAL !== MacroGoal.RECOVER) throw new Error('RECOVERY_NOT_ACTIVE');
    const next = resumeParent(state, DecisionReasonCode.RECOVERY_COMPLETE, type);
    return { state: next, decision: next.LAST_DECISION, accepted: true };
  }
  throw new TypeError(`UNSUPPORTED_LIFE_DIRECTOR_EVENT:${type}`);
}

export function projectLifeDirectorState(state) {
  assertWorldOwned(state);
  return clone({
    CONTROL_AUTHORITY: state.CONTROL_AUTHORITY,
    PLAYER_CONTROL_PATH: state.PLAYER_CONTROL_PATH,
    CURRENT_MACRO_GOAL: state.CURRENT_MACRO_GOAL,
    GOAL_STACK: state.GOAL_STACK,
    INTERRUPT: state.INTERRUPT,
    RESUME_TARGET: state.RESUME_TARGET,
    DECISION_REASON_CODES: state.DECISION_REASON_CODES,
    DECISION_SEQUENCE: state.DECISION_SEQUENCE,
    EVENT_LEDGER: state.EVENT_LEDGER,
    POC_ONLY,
  });
}

export function assertInterruptShape(state) {
  assertWorldOwned(state);
  if (!state.INTERRUPT) return true;
  if (!interrupts.has(state.INTERRUPT.type)) throw new Error('INVALID_INTERRUPT_TYPE');
  if (state.INTERRUPT.status !== 'ACTIVE') throw new Error('INVALID_INTERRUPT_STATUS');
  if (state.RESUME_TARGET !== state.INTERRUPT.resumeTarget) throw new Error('RESUME_TARGET_MISMATCH');
  return true;
}
