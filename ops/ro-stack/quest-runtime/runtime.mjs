import {
  CombatPolicy,
  InterruptPolicy,
  MissionStageType,
  PreflightStatus,
  QUEST_STATE_VERSION,
  QuestStatus,
  RiskLevel,
  assertCombatPolicy,
  assertMissionStage,
  assertQuestStep,
  assertRiskLevel,
  assertRouteEvent,
} from './contracts.mjs';
import { randomUUID } from 'node:crypto';
import { projectQuestEventLog } from './event-log.mjs';

const defaultDeathRetryThreshold = 3;

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

function cleanIdentifier(value, label, maximum = 96) {
  const normalized = String(value ?? '');
  if (!new RegExp(`^[A-Za-z0-9_.:-]{1,${maximum}}$`).test(normalized)) {
    throw new TypeError(`${label} is invalid`);
  }
  return normalized;
}

function cleanCareerTarget(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(normalized)) {
    throw new TypeError('careerTarget is invalid');
  }
  return normalized;
}

export function createQuestState({
  charId,
  accountId,
  authority,
  deathRetryThreshold = defaultDeathRetryThreshold,
  clock = Date.now,
}) {
  if (!Number.isSafeInteger(Number(charId)) || Number(charId) <= 0)
    throw new TypeError('charId is invalid');
  if (!Number.isSafeInteger(Number(accountId)) || Number(accountId) <= 0)
    throw new TypeError('accountId is invalid');
  if (
    !Number.isSafeInteger(Number(deathRetryThreshold)) ||
    Number(deathRetryThreshold) < 1
  ) {
    throw new TypeError('deathRetryThreshold is invalid');
  }
  return {
    stateVersion: QUEST_STATE_VERSION,
    charId: Number(charId),
    accountId: Number(accountId),
    revision: 0,
    questSessionId: null,
    objectiveId: null,
    objectiveGeneration: 0,
    agentLease: null,
    processedAgentEvents: [],
    questEvents: [],
    authority: normalizeAuthority(authority),
    adapterId: null,
    careerTarget: null,
    formalQuestStarted: false,
    questId: null,
    currentStep: null,
    completedSteps: [],
    activeTrial: null,
    checkpoint: null,
    questStatus: QuestStatus.READY,
    currentObjective: null,
    originalObjective: null,
    temporaryObjective: null,
    supplyPending: false,
    supplyReservation: emptyReservation(),
    trialInventoryLock: false,
    interruptPolicy: InterruptPolicy.SAFE,
    combatPolicy: { mode: CombatPolicy.NORMAL, targets: [] },
    previousCombatPolicy: null,
    routeEvent: null,
    missionStage: { type: MissionStageType.RESULT, status: QuestStatus.READY },
    death: {
      stepId: null,
      count: 0,
      threshold: Number(deathRetryThreshold),
      lastDeath: null,
    },
    updatedAt: nowIso(clock),
  };
}

export function normalizeAuthority(authority) {
  if (!authority || typeof authority !== 'object')
    throw new TypeError('authority is required');
  const currentJob = Number(authority.currentJob);
  const baseLevel = Number(authority.baseLevel);
  const jobLevel = Number(authority.jobLevel);
  if (![currentJob, baseLevel, jobLevel].every(Number.isSafeInteger)) {
    throw new TypeError('authority character state is invalid');
  }
  const numericRecord = (value) =>
    Object.fromEntries(
      Object.entries(value && typeof value === 'object' ? value : {}).map(
        ([key, entry]) => [key, Number(entry) || 0],
      ),
    );
  return {
    source: 'rAthena/MariaDB',
    currentJob,
    baseLevel,
    jobLevel,
    questId: authority.questId == null ? null : Number(authority.questId),
    questState:
      authority.questState == null ? null : Number(authority.questState),
    hp: authority.hp == null ? null : Number(authority.hp),
    maxHp: authority.maxHp == null ? null : Number(authority.maxHp),
    sp: authority.sp == null ? null : Number(authority.sp),
    maxSp: authority.maxSp == null ? null : Number(authority.maxSp),
    dead: authority.dead === true || Number(authority.hp) === 0,
    skillPoint:
      authority.skillPoint == null ? null : Number(authority.skillPoint),
    zeny: authority.zeny == null ? null : Number(authority.zeny),
    map: authority.map == null ? null : String(authority.map),
    x: authority.x == null ? null : Number(authority.x),
    y: authority.y == null ? null : Number(authority.y),
    online: authority.online === true || Number(authority.online) === 1,
    questStates: numericRecord(authority.questStates),
    variables: numericRecord(authority.variables),
    items: numericRecord(authority.items),
    equippedItems: numericRecord(authority.equippedItems),
    recoveryItems: Array.isArray(authority.recoveryItems)
      ? structuredClone(authority.recoveryItems)
      : [],
    observedAt: authority.observedAt ?? new Date().toISOString(),
  };
}

function emptyReservation() {
  return {
    totalHpRecovery: 0,
    totalSpRecovery: 0,
    reservedHpRecovery: 0,
    reservedSpRecovery: 0,
    availableRouteHpRecovery: 0,
    availableRouteSpRecovery: 0,
  };
}

export function calculateSupplyReservation({
  recoveryItems = [],
  requirement = {},
}) {
  if (!Array.isArray(recoveryItems))
    throw new TypeError('recoveryItems is invalid');
  const totals = recoveryItems.reduce(
    (sum, item) => {
      const amount = Math.max(0, Number(item.amount) || 0);
      sum.hp += amount * Math.max(0, Number(item.hpRecovery) || 0);
      sum.sp += amount * Math.max(0, Number(item.spRecovery) || 0);
      return sum;
    },
    { hp: 0, sp: 0 },
  );
  const reservedHpRecovery = Math.max(
    0,
    Number(requirement.reservedHpRecovery) || 0,
  );
  const reservedSpRecovery = Math.max(
    0,
    Number(requirement.reservedSpRecovery) || 0,
  );
  return {
    totalHpRecovery: totals.hp,
    totalSpRecovery: totals.sp,
    reservedHpRecovery,
    reservedSpRecovery,
    availableRouteHpRecovery: Math.max(0, totals.hp - reservedHpRecovery),
    availableRouteSpRecovery: Math.max(0, totals.sp - reservedSpRecovery),
  };
}

export function questPreflightCheck({
  character,
  recoveryItems = [],
  riskLevel,
  requirement = {},
}) {
  assertRiskLevel(riskLevel);
  const hp = Number(character?.hp);
  const maxHp = Number(character?.maxHp);
  const sp = Number(character?.sp ?? 0);
  const maxSp = Number(character?.maxSp ?? 0);
  if (
    ![hp, maxHp, sp, maxSp].every(Number.isFinite) ||
    maxHp <= 0 ||
    hp < 0 ||
    sp < 0
  ) {
    throw new TypeError('character recovery state is invalid');
  }
  const reservation = calculateSupplyReservation({
    recoveryItems,
    requirement,
  });
  const minimumEntryHp = Math.max(0, Number(requirement.minimumEntryHp) || 0);
  const minimumEntrySp = Math.max(0, Number(requirement.minimumEntrySp) || 0);
  const routeHpRecovery = Math.max(0, Number(requirement.routeHpRecovery) || 0);
  const routeSpRecovery = Math.max(0, Number(requirement.routeSpRecovery) || 0);
  const missingEntryHp = Math.max(0, minimumEntryHp - hp);
  const missingEntrySp = Math.max(0, minimumEntrySp - sp);
  const reasons = [];
  let status = PreflightStatus.PASS;
  if (hp <= 0) {
    status = PreflightStatus.CRITICAL;
    reasons.push('CHARACTER_DEAD');
  } else if (
    reservation.totalHpRecovery <
      missingEntryHp + reservation.reservedHpRecovery ||
    reservation.totalSpRecovery <
      missingEntrySp + reservation.reservedSpRecovery
  ) {
    status = PreflightStatus.INSUFFICIENT;
    reasons.push('TRIAL_RESERVE_UNAVAILABLE');
  } else if (
    reservation.availableRouteHpRecovery < routeHpRecovery ||
    reservation.availableRouteSpRecovery < routeSpRecovery ||
    hp < minimumEntryHp ||
    sp < minimumEntrySp
  ) {
    status = PreflightStatus.WARNING;
    reasons.push('ROUTE_OR_ENTRY_MARGIN_LOW');
  }
  return {
    status,
    riskLevel,
    character: { hp, maxHp, sp, maxSp },
    reservation,
    requirement: {
      minimumEntryHp,
      minimumEntrySp,
      routeHpRecovery,
      routeSpRecovery,
      reservedHpRecovery: reservation.reservedHpRecovery,
      reservedSpRecovery: reservation.reservedSpRecovery,
    },
    reasons,
  };
}

function evolve(state, patch, clock) {
  return {
    ...state,
    ...patch,
    revision: Number(state.revision) + 1,
    updatedAt: nowIso(clock),
  };
}

function requireQuest(state) {
  if (!state.questId || !state.currentStep) throw new Error('QUEST_NOT_ACTIVE');
}

export function setCareerTarget(
  state,
  careerTarget,
  { clock = Date.now } = {},
) {
  return evolve(
    state,
    { careerTarget: cleanCareerTarget(careerTarget) },
    clock,
  );
}

export function startQuestSession(
  state,
  { questId, firstStep, objective, missionStage, questSessionId },
  { clock = Date.now } = {},
) {
  const normalizedStep = assertQuestStep(firstStep);
  const id = Number(questId);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new TypeError('questId is invalid');
  if (state.questId && state.questStatus !== QuestStatus.COMPLETED)
    throw new Error('QUEST_ALREADY_ACTIVE');
  return evolve(
    state,
    {
      questId: id,
      questSessionId: cleanIdentifier(
        questSessionId ?? randomUUID(),
        'questSessionId',
        128,
      ),
      objectiveId: normalizedStep.id,
      objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
      agentLease: null,
      processedAgentEvents: [],
      currentStep: normalizedStep,
      completedSteps: [],
      checkpoint: null,
      questStatus: QuestStatus.RUNNING,
      currentObjective: structuredClone(objective ?? null),
      originalObjective: null,
      temporaryObjective: null,
      supplyPending: false,
      trialInventoryLock: false,
      interruptPolicy: normalizedStep.interruptPolicy,
      missionStage: assertMissionStage(missionStage),
      death: {
        ...state.death,
        stepId: normalizedStep.id,
        count: 0,
        lastDeath: null,
      },
    },
    clock,
  );
}

export function completeQuestStep(
  state,
  { completedStepId, nextStep, objective, missionStage, checkpoint },
  { clock = Date.now } = {},
) {
  requireQuest(state);
  const stepId = cleanIdentifier(completedStepId, 'completedStepId');
  if (stepId !== state.currentStep.id) throw new Error('STALE_STEP');
  const normalizedNext = nextStep ? assertQuestStep(nextStep) : null;
  const completedSteps = state.completedSteps.includes(stepId)
    ? [...state.completedSteps]
    : [...state.completedSteps, stepId];
  const nextCheckpoint = {
    stepId,
    completedSteps,
    data: structuredClone(checkpoint ?? null),
    createdAt: nowIso(clock),
  };
  return evolve(
    state,
    {
      completedSteps,
      checkpoint: nextCheckpoint,
      currentStep: normalizedNext,
      objectiveId: normalizedNext?.id ?? null,
      objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
      agentLease: null,
      currentObjective: structuredClone(objective ?? null),
      interruptPolicy: normalizedNext?.interruptPolicy ?? InterruptPolicy.SAFE,
      questStatus: normalizedNext ? QuestStatus.RUNNING : QuestStatus.COMPLETED,
      missionStage: assertMissionStage(missionStage),
      supplyPending: normalizedNext ? state.supplyPending : false,
      trialInventoryLock: false,
      activeTrial: null,
      combatPolicy: state.previousCombatPolicy ?? state.combatPolicy,
      previousCombatPolicy: null,
      death: {
        ...state.death,
        stepId: normalizedNext?.id ?? null,
        count: 0,
      },
    },
    clock,
  );
}

export function setQuestObjective(
  state,
  { objective, missionStage },
  { clock = Date.now } = {},
) {
  requireQuest(state);
  return evolve(
    state,
    {
      currentObjective: structuredClone(objective),
      objectiveId: `${state.currentStep.id}:${Number(state.objectiveGeneration ?? 0) + 1}`,
      objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
      agentLease: null,
      missionStage: assertMissionStage(missionStage),
    },
    clock,
  );
}

function beginSupply(state, temporaryObjective, clock) {
  return evolve(
    state,
    {
      questStatus: QuestStatus.SUSPENDED,
      objectiveId: `supply:${state.currentStep.id}`,
      objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
      agentLease: null,
      originalObjective: structuredClone(
        state.originalObjective ?? state.currentObjective,
      ),
      temporaryObjective: structuredClone(temporaryObjective),
      currentObjective: structuredClone(temporaryObjective),
      supplyPending: false,
      missionStage: {
        type: MissionStageType.SUPPLY,
        reason: temporaryObjective?.reason ?? 'SUPPLY_REQUIRED',
        originalObjective: structuredClone(
          state.originalObjective ?? state.currentObjective,
        ),
      },
    },
    clock,
  );
}

export function requestSupply(
  state,
  { temporaryObjective, reservation },
  { clock = Date.now } = {},
) {
  requireQuest(state);
  if (
    state.trialInventoryLock ||
    state.interruptPolicy === InterruptPolicy.LOCKED
  ) {
    return evolve(
      state,
      {
        supplyPending: true,
        supplyReservation: reservation ?? state.supplyReservation,
      },
      clock,
    );
  }
  if (state.interruptPolicy === InterruptPolicy.DEFERRED) {
    return evolve(
      state,
      {
        supplyPending: true,
        supplyReservation: reservation ?? state.supplyReservation,
      },
      clock,
    );
  }
  return beginSupply(
    { ...state, supplyReservation: reservation ?? state.supplyReservation },
    temporaryObjective,
    clock,
  );
}

export function reachSafePoint(
  state,
  { temporaryObjective },
  { clock = Date.now } = {},
) {
  if (!state.supplyPending) return state;
  if (state.trialInventoryLock) throw new Error('TRIAL_INVENTORY_LOCKED');
  return beginSupply(
    { ...state, interruptPolicy: InterruptPolicy.SAFE },
    temporaryObjective,
    clock,
  );
}

export function completeSupply(
  state,
  { reservation = emptyReservation() } = {},
  { clock = Date.now } = {},
) {
  if (
    state.missionStage?.type !== MissionStageType.SUPPLY ||
    !state.originalObjective
  ) {
    throw new Error('SUPPLY_NOT_ACTIVE');
  }
  const objective = structuredClone(state.originalObjective);
  return evolve(
    state,
    {
      questStatus: QuestStatus.RUNNING,
      currentObjective: objective,
      objectiveId: state.currentStep.id,
      objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
      agentLease: null,
      originalObjective: null,
      temporaryObjective: null,
      supplyPending: false,
      supplyReservation: reservation,
      missionStage: state.currentStep?.missionStage ?? {
        type: MissionStageType.NAVIGATION,
        objective,
      },
    },
    clock,
  );
}

export function beginTrial(
  state,
  { trialId, preflight, missionStage },
  { clock = Date.now } = {},
) {
  requireQuest(state);
  if (state.currentStep.type !== 'TRIAL')
    throw new Error('TRIAL_STEP_REQUIRED');
  if (
    ![PreflightStatus.PASS, PreflightStatus.WARNING].includes(preflight?.status)
  ) {
    throw new Error('PREFLIGHT_BLOCKED');
  }
  return evolve(
    state,
    {
      questStatus: QuestStatus.TRIAL_ACTIVE,
      activeTrial: {
        id: cleanIdentifier(trialId, 'trialId'),
        startedAt: nowIso(clock),
      },
      trialInventoryLock: true,
      interruptPolicy: InterruptPolicy.LOCKED,
      supplyReservation: preflight.reservation,
      missionStage: assertMissionStage(missionStage),
    },
    clock,
  );
}

export function failTrial(state, { reason }, { clock = Date.now } = {}) {
  if (!state.activeTrial) throw new Error('TRIAL_NOT_ACTIVE');
  return evolve(
    state,
    {
      questStatus: QuestStatus.TRIAL_FAILED,
      activeTrial: null,
      trialInventoryLock: false,
      interruptPolicy: InterruptPolicy.SAFE,
      supplyPending: false,
      combatPolicy: state.previousCombatPolicy ?? {
        mode: CombatPolicy.NORMAL,
        targets: [],
      },
      previousCombatPolicy: null,
      missionStage: {
        type: MissionStageType.RESULT,
        result: 'TRIAL_FAILED',
        reason: String(reason ?? 'TRIAL_FAILED'),
        checkpoint: structuredClone(state.checkpoint),
      },
    },
    clock,
  );
}

export function cancelQuestSession(
  state,
  { reason = 'QUEST_CANCELLED' } = {},
  { clock = Date.now } = {},
) {
  requireQuest(state);
  return evolve(
    state,
    {
      questId: null,
      questSessionId: null,
      currentStep: null,
      objectiveId: null,
      objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
      agentLease: null,
      questStatus: QuestStatus.READY,
      currentObjective: null,
      originalObjective: null,
      temporaryObjective: null,
      supplyPending: false,
      activeTrial: null,
      trialInventoryLock: false,
      interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? {
        mode: CombatPolicy.NORMAL,
        targets: [],
      },
      previousCombatPolicy: null,
      missionStage: {
        type: MissionStageType.RESULT,
        result: String(reason),
      },
    },
    clock,
  );
}

export function recordDeath(state, death, { clock = Date.now } = {}) {
  requireQuest(state);
  const sameStep = state.death.stepId === state.currentStep.id;
  const count = (sameStep ? state.death.count : 0) + 1;
  const lastDeath = {
    map: death?.map ?? null,
    x: Number(death?.x ?? 0),
    y: Number(death?.y ?? 0),
    killer: death?.killer ?? null,
    consumables: structuredClone(death?.consumables ?? []),
    at: nowIso(clock),
  };
  if (state.activeTrial) {
    const failed = failTrial(state, { reason: 'DEATH' }, { clock });
    return {
      ...failed,
      death: { ...state.death, stepId: state.currentStep.id, count, lastDeath },
      missionStage: {
        type: MissionStageType.DEATH,
        trialFailed: true,
        checkpoint: structuredClone(state.checkpoint),
        deathCount: count,
        lastDeath,
      },
    };
  }
  const tripped = count >= state.death.threshold;
  return evolve(
    state,
    {
      questStatus: tripped
        ? QuestStatus.NEEDS_ATTENTION
        : QuestStatus.SUSPENDED,
      missionStage: {
        type: MissionStageType.DEATH,
        checkpoint: structuredClone(state.checkpoint),
        deathCount: count,
        circuitBreakerTripped: tripped,
        lastDeath,
      },
      death: { ...state.death, stepId: state.currentStep.id, count, lastDeath },
    },
    clock,
  );
}

export function recoverAfterRespawn(
  state,
  authority,
  { clock = Date.now } = {},
) {
  const normalizedAuthority = normalizeAuthority(authority);
  if (normalizedAuthority.dead) throw new Error('CHARACTER_STILL_DEAD');
  if (state.questStatus === QuestStatus.NEEDS_ATTENTION)
    return { ...state, authority: normalizedAuthority };
  if (state.missionStage?.type !== MissionStageType.DEATH)
    throw new Error('DEATH_RECOVERY_NOT_ACTIVE');
  const trialFailed = state.missionStage.trialFailed === true;
  return evolve(
    state,
    {
      authority: normalizedAuthority,
      questStatus: trialFailed ? QuestStatus.TRIAL_FAILED : QuestStatus.READY,
      missionStage: {
        type: MissionStageType.RESULT,
        result: trialFailed ? 'RETURN_TO_TRIAL_CHECKPOINT' : 'READY_TO_RESUME',
        checkpoint: structuredClone(state.checkpoint),
      },
    },
    clock,
  );
}

export function applyCombatPolicy(state, policy, { clock = Date.now } = {}) {
  const normalized = assertCombatPolicy(policy);
  return evolve(
    state,
    {
      previousCombatPolicy:
        state.previousCombatPolicy ?? structuredClone(state.combatPolicy),
      combatPolicy: normalized,
    },
    clock,
  );
}

export function restoreCombatPolicy(state, { clock = Date.now } = {}) {
  return evolve(
    state,
    {
      combatPolicy: state.previousCombatPolicy ?? {
        mode: CombatPolicy.NORMAL,
        targets: [],
      },
      previousCombatPolicy: null,
    },
    clock,
  );
}

export function bindObjectiveToAgent(state, { clock = Date.now } = {}) {
  requireQuest(state);
  if (!state.questSessionId || !state.objectiveId)
    throw new Error('OBJECTIVE_IDENTITY_MISSING');
  const sourceRevision = Number(state.revision) + 1;
  return evolve(
    state,
    {
      agentLease: {
        questSessionId: state.questSessionId,
        objectiveId: state.objectiveId,
        generation: Number(state.objectiveGeneration),
        sourceRevision,
        issuedAt: nowIso(clock),
      },
    },
    clock,
  );
}

export function markNeedsAttention(
  state,
  { reason, detail = null },
  { clock = Date.now } = {},
) {
  return evolve(
    state,
    {
      questStatus: QuestStatus.NEEDS_ATTENTION,
      supplyPending: false,
      trialInventoryLock: false,
      activeTrial: null,
      combatPolicy: state.previousCombatPolicy ?? {
        mode: CombatPolicy.NORMAL,
        targets: [],
      },
      previousCombatPolicy: null,
      agentLease: null,
      missionStage: {
        type: MissionStageType.RESULT,
        status: QuestStatus.NEEDS_ATTENTION,
        reason: String(reason ?? 'AGENT_OBJECTIVE_FAILED'),
        detail: structuredClone(detail),
        checkpoint: structuredClone(state.checkpoint),
      },
    },
    clock,
  );
}

export function setRouteEvent(state, event, { clock = Date.now } = {}) {
  const routeEvent = assertRouteEvent(event);
  return evolve(
    state,
    {
      routeEvent,
      missionStage: { type: MissionStageType.ROUTE_EVENT, ...routeEvent },
    },
    clock,
  );
}

export function reconcileRestart(state, authority, { clock = Date.now } = {}) {
  const normalizedAuthority = normalizeAuthority(authority);
  if (
    state.trialInventoryLock ||
    state.questStatus === QuestStatus.TRIAL_ACTIVE
  ) {
    const failed = failTrial(state, { reason: 'RUNTIME_RESTART' }, { clock });
    const restored = restoreCombatPolicy(failed, { clock });
    return { ...restored, authority: normalizedAuthority, agentLease: null };
  }
  return evolve(
    state,
    { authority: normalizedAuthority, agentLease: null },
    clock,
  );
}

export function publicQuestState(state) {
  const eventLog = projectQuestEventLog(state);
  return structuredClone({
    stateVersion: state.stateVersion,
    revision: state.revision,
    questSessionId: state.questSessionId,
    objectiveId: state.objectiveId,
    objectiveGeneration: state.objectiveGeneration,
    agentLease: state.agentLease,
    authority: state.authority,
    adapterId: state.adapterId,
    careerTarget: state.careerTarget,
    formalQuestStarted: state.formalQuestStarted === true,
    questId: state.questId,
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    activeTrial: state.activeTrial,
    checkpoint: state.checkpoint,
    questStatus: state.questStatus,
    currentObjective: state.currentObjective,
    originalObjective: state.originalObjective,
    temporaryObjective: state.temporaryObjective,
    supplyPending: state.supplyPending,
    supplyReservation: state.supplyReservation,
    trialInventoryLock: state.trialInventoryLock,
    interruptPolicy: state.interruptPolicy,
    combatPolicy: state.combatPolicy,
    routeEvent: state.routeEvent,
    missionStage: state.missionStage,
    death: state.death,
    playerLog: eventLog.playerLog,
    debugLog: eventLog.debugLog,
    updatedAt: state.updatedAt,
  });
}

export const QuestRuntimeDefaults = Object.freeze({
  deathRetryThreshold: defaultDeathRetryThreshold,
  deathRetryThresholdSource: 'existing persistent navigation retry default',
  supportedRiskLevels: Object.values(RiskLevel),
});
