export const QUEST_STATE_VERSION = 2;

export const QuestStatus = Object.freeze({
  RUNNING: 'RUNNING',
  SUSPENDED: 'SUSPENDED',
  READY: 'READY',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  TRIAL_ACTIVE: 'TRIAL_ACTIVE',
  TRIAL_FAILED: 'TRIAL_FAILED',
  COMPLETED: 'COMPLETED',
});

export const InterruptPolicy = Object.freeze({
  SAFE: 'SAFE',
  DEFERRED: 'DEFERRED',
  LOCKED: 'LOCKED',
});

export const RiskLevel = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  TRIAL: 'TRIAL',
});

export const PreflightStatus = Object.freeze({
  PASS: 'PASS',
  WARNING: 'WARNING',
  INSUFFICIENT: 'INSUFFICIENT',
  CRITICAL: 'CRITICAL',
});

export const CombatPolicy = Object.freeze({
  NORMAL: 'NORMAL',
  NO_ATTACK: 'NO_ATTACK',
  TARGET_WHITELIST: 'TARGET_WHITELIST',
  THREAT_AVOID: 'THREAT_AVOID',
});

export const MissionStageType = Object.freeze({
  NAVIGATION: 'NAVIGATION',
  DIALOG: 'DIALOG',
  CHOICE: 'CHOICE',
  QUIZ: 'QUIZ',
  TRIAL: 'TRIAL',
  ROUTE_EVENT: 'ROUTE_EVENT',
  DEATH: 'DEATH',
  SUPPLY: 'SUPPLY',
  RESULT: 'RESULT',
});

export const QuestStepType = Object.freeze({
  DIALOG: 'DIALOG',
  CHOICE: 'CHOICE',
  REQUIREMENT: 'REQUIREMENT',
  OBJECTIVE: 'OBJECTIVE',
  TRIAL: 'TRIAL',
  ROUTE_EVENT: 'ROUTE_EVENT',
  COMMIT: 'COMMIT',
});

export const CommitType = Object.freeze({
  JOB_CHANGE: 'JOB_CHANGE',
  CONSUME_ITEM: 'CONSUME_ITEM',
  GIVE_ITEM: 'GIVE_ITEM',
  SET_QUEST_VARIABLE: 'SET_QUEST_VARIABLE',
});

export const ObjectiveCompletionMode = Object.freeze({
  TRANSITION: 'TRANSITION',
  SERVER_AUTHORITY: 'SERVER_AUTHORITY',
});

function assertEnum(value, values, label) {
  if (!Object.values(values).includes(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

export function assertInterruptPolicy(value) {
  return assertEnum(value, InterruptPolicy, 'interruptPolicy');
}

export function assertRiskLevel(value) {
  return assertEnum(value, RiskLevel, 'riskLevel');
}

export function assertMissionStage(stage) {
  if (!stage || typeof stage !== 'object') {
    throw new TypeError('missionStage is required');
  }
  assertEnum(stage.type, MissionStageType, 'missionStage.type');
  return structuredClone(stage);
}

export function assertQuestStep(step) {
  if (
    !step ||
    typeof step !== 'object' ||
    !/^[A-Za-z0-9_.:-]{1,96}$/.test(step.id ?? '')
  ) {
    throw new TypeError('quest step id is invalid');
  }
  assertEnum(step.type, QuestStepType, 'questStep.type');
  assertInterruptPolicy(step.interruptPolicy);
  return structuredClone(step);
}

export function normalizeTargetWhitelist(targets = []) {
  if (!Array.isArray(targets) || targets.length > 128) {
    throw new TypeError('target whitelist is invalid');
  }
  const normalized = [...new Set(targets.map(Number))];
  if (
    normalized.some((target) => !Number.isSafeInteger(target) || target <= 0)
  ) {
    throw new TypeError('target whitelist contains an invalid target');
  }
  return normalized;
}

export function normalizeTargetNameWhitelist(names = []) {
  if (!Array.isArray(names) || names.length > 128) {
    throw new TypeError('target name whitelist is invalid');
  }
  const normalized = [...new Set(names.map((name) => String(name).trim()))];
  if (
    normalized.some(
      (name) => !name || name.length > 64 || /[\x00-\x1f\x7f]/.test(name),
    )
  ) {
    throw new TypeError('target name whitelist contains an invalid name');
  }
  return normalized;
}

export function assertCombatPolicy(policy) {
  if (!policy || typeof policy !== 'object') {
    throw new TypeError('combatPolicy is required');
  }
  assertEnum(policy.mode, CombatPolicy, 'combatPolicy.mode');
  const targets = normalizeTargetWhitelist(policy.targets ?? []);
  const names = normalizeTargetNameWhitelist(policy.names ?? []);
  if (
    policy.engageAllowedTargets != null &&
    typeof policy.engageAllowedTargets !== 'boolean'
  ) {
    throw new TypeError('combatPolicy.engageAllowedTargets must be boolean');
  }
  if (policy.avoidHostiles != null && typeof policy.avoidHostiles !== 'boolean') {
    throw new TypeError('combatPolicy.avoidHostiles must be boolean');
  }
  const avoidHostilesRange = Number(policy.avoidHostilesRange ?? 5);
  if (
    policy.avoidHostiles === true &&
    (!Number.isSafeInteger(avoidHostilesRange) || avoidHostilesRange < 2 || avoidHostilesRange > 12)
  ) {
    throw new TypeError('combatPolicy.avoidHostilesRange is invalid');
  }
  if (
    policy.mode === CombatPolicy.TARGET_WHITELIST &&
    targets.length === 0 &&
    names.length === 0
  ) {
    throw new TypeError('TARGET_WHITELIST requires targets');
  }
  if (
    ![CombatPolicy.TARGET_WHITELIST, CombatPolicy.THREAT_AVOID].includes(
      policy.mode,
    ) && (targets.length > 0 || names.length > 0)
  ) {
    throw new TypeError('targets require a target-filter policy');
  }
  return {
    mode: policy.mode,
    targets,
    names,
    ...(policy.mode === CombatPolicy.THREAT_AVOID
      ? { engageAllowedTargets: policy.engageAllowedTargets !== false }
      : {}),
    ...(policy.avoidHostiles === true
      ? { avoidHostiles: true, avoidHostilesRange }
      : {}),
  };
}

export function assertRouteEvent(event) {
  if (
    !event ||
    typeof event !== 'object' ||
    !/^[A-Za-z0-9_.:-]{1,96}$/.test(event.nodeId ?? '')
  ) {
    throw new TypeError('route event nodeId is invalid');
  }
  const choices = Array.isArray(event.availableChoices)
    ? event.availableChoices.map((choice) => String(choice))
    : [];
  if (
    choices.length > 32 ||
    choices.some((choice) => !/^[A-Za-z0-9_.:-]{1,96}$/.test(choice))
  ) {
    throw new TypeError('route event choices are invalid');
  }
  const selectedRoute =
    event.selectedRoute == null ? null : String(event.selectedRoute);
  if (selectedRoute && !choices.includes(selectedRoute)) {
    throw new TypeError('selected route is unavailable');
  }
  return {
    nodeId: event.nodeId,
    availableChoices: choices,
    selectedRoute,
    result: event.result ?? null,
    nextNode: event.nextNode ?? null,
    checkpoint: event.checkpoint ?? null,
    encounterTrigger: event.encounterTrigger ?? null,
    failed: event.failed === true,
    deadEnd: event.deadEnd === true,
    backtrack: event.backtrack === true,
  };
}
