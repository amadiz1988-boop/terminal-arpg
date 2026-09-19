export const QuestTaskStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ACTIVE: 'ACTIVE',
  READY_TO_REPORT: 'READY_TO_REPORT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PAUSED: 'PAUSED',
});

const edenCourseA = Object.freeze({
  taskId: 7113001,
  taskType: 'AUTO_QUEST',
  sequenceId: 'eden_course_a_v1',
  sequenceName: 'Eden Course A / Conquer the Desert',
  questIds: Object.freeze([7128, 7129, 7130, 7131, 7132]),
  mobs: Object.freeze([
    Object.freeze({ questId: 7129, mobId: 1009, mobName: 'Condor', required: 10 }),
    Object.freeze({ questId: 7130, mobId: 1107, mobName: 'Baby Desert Wolf', required: 10 }),
    Object.freeze({ questId: 7131, mobId: 1001, mobName: 'Scorpion', required: 5 }),
  ]),
  rewards: Object.freeze([
    Object.freeze({ type: 'ITEM', id: 5583, fallbackName: '伊甸園圓帽', quantity: 1 }),
    Object.freeze({ type: 'ITEM', id: 2560, fallbackName: '伊甸園斗篷', quantity: 1 }),
    Object.freeze({ type: 'ITEM', id: 2456, fallbackName: '伊甸園短靴 I', quantity: 1 }),
    Object.freeze({ type: 'ITEM', id: 15009, fallbackName: '伊甸園制服 I', quantity: 1 }),
  ]),
});

const failureMessages = Object.freeze({
  prerequisite_incomplete: '尚未完成任務前置條件。',
  already_completed: '任務已完成，無法重複執行或領取獎勵。',
  route_failed: '前往任務目的地失敗。',
  path_retry_exhausted: '尋路重試次數已用完。',
  npc_missing: '找不到指定任務 NPC。',
  npc_failed: 'NPC 對話未能完成。',
  target_unresolved: '找不到合法的任務怪物目標。',
  inventory_full: '道具欄空間不足。',
  overweight: '角色負重超過可執行任務的限制。',
  ownership_conflict: '角色目前由其他控制來源持有。',
  stale_revision: '任務狀態已更新，請重新整理。',
  reward_missing: '原生任務獎勵尚未完整取得。',
  unexpected_map: '角色目前所在地圖與任務步驟不一致。',
  timeout: '任務步驟等待逾時。',
  quarantined: '角色已進入安全隔離狀態，請由管理員處理。',
  rollout_disabled: 'Server Agent 尚未開放給測試帳號。',
  rollout_not_allowlisted: '此角色不在 Server Agent 測試名單內。',
  rollout_schema_unavailable: 'Server Agent 開放設定尚未就緒。',
  rollout_identity_invalid: '角色識別資料無效，無法啟動 Server Agent。',
  eden_course_a_disabled: '伊甸園 Course A 暫停開放。',
  emergency_disabled: 'Server Agent 已緊急停用，角色將安全返回待機狀態。',
  task_failed: '任務目前無法繼續，請稍後再試。',
});

const rawFailureCodes = Object.freeze({
  QUEST_PREREQUISITE_INCOMPLETE: 'prerequisite_incomplete',
  QUEST_ALREADY_COMPLETED: 'already_completed',
  QUEST_SEQUENCE_ALREADY_COMPLETED: 'already_completed',
  QUEST_SEQUENCE_ROUTE_FAILED: 'route_failed',
  ROUTE_FAILED: 'route_failed',
  PATH_RETRY_EXHAUSTED: 'path_retry_exhausted',
  QUEST_SEQUENCE_NPC_MISSING: 'npc_missing',
  NPC_MISSING: 'npc_missing',
  QUEST_SEQUENCE_DIALOG_STATE_MISMATCH: 'npc_failed',
  QUEST_SEQUENCE_TARGET_UNRESOLVED: 'target_unresolved',
  TARGET_UNRESOLVED: 'target_unresolved',
  INVENTORY_FULL: 'inventory_full',
  OVERWEIGHT: 'overweight',
  OWNERSHIP_CONFLICT: 'ownership_conflict',
  STALE_REVISION: 'stale_revision',
  QUEST_SEQUENCE_REWARD_MISSING: 'reward_missing',
  REWARD_MISSING: 'reward_missing',
  QUEST_SEQUENCE_COMBAT_MAP_MISMATCH: 'unexpected_map',
  QUEST_SEQUENCE_NPC_MAP_INVALID: 'unexpected_map',
  UNEXPECTED_MAP: 'unexpected_map',
  TIMEOUT: 'timeout',
  QUEST_TIMEOUT: 'timeout',
  QUARANTINED: 'quarantined',
  ROLLOUT_DISABLED: 'rollout_disabled',
  ROLLOUT_NOT_ALLOWLISTED: 'rollout_not_allowlisted',
  ROLLOUT_SCHEMA_UNAVAILABLE: 'rollout_schema_unavailable',
  ROLLOUT_IDENTITY_INVALID: 'rollout_identity_invalid',
  EDEN_COURSE_A_DISABLED: 'eden_course_a_disabled',
  EMERGENCY_DISABLED: 'emergency_disabled',
});

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function questRow(questStates, questId) {
  return questStates?.[questId] ?? questStates?.[String(questId)] ?? null;
}

function nativeQuestState(row) {
  if (!row) return 'ABSENT';
  return integer(row.state, 0) === 2 ? 'COMPLETE' : 'ACTIVE';
}

function sequenceStepIndex(taskPhase) {
  const match = String(taskPhase ?? '').match(/^(?:STEP|NAV)_(\d{3})$/);
  return match ? integer(match[1], 0) : null;
}

function sequenceContext(steps, index) {
  if (!Array.isArray(steps) || index === null || !steps[index])
    return { step: null, npcName: null, map: null };
  let npcName = null;
  let map = null;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    npcName ||= steps[cursor]?.npcName || null;
    map ||= steps[cursor]?.map || null;
    if (npcName && map) break;
  }
  return { step: steps[index], npcName, map };
}

function normalizeFailure(rawCode) {
  const raw = String(rawCode ?? '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  let code = rawFailureCodes[upper] ?? null;
  if (!code && /PATH.*RETRY.*EXHAUSTED/.test(upper)) code = 'path_retry_exhausted';
  else if (!code && /ROUTE/.test(upper)) code = 'route_failed';
  else if (!code && /NPC.*MISSING/.test(upper)) code = 'npc_missing';
  else if (!code && /NPC/.test(upper)) code = 'npc_failed';
  else if (!code && /TARGET/.test(upper)) code = 'target_unresolved';
  else if (!code && /INVENTORY.*FULL/.test(upper)) code = 'inventory_full';
  else if (!code && /OVERWEIGHT/.test(upper)) code = 'overweight';
  else if (!code && /OWNERSHIP|ACTIVE_OPENKORE|ACTIVE_CLIENT/.test(upper)) code = 'ownership_conflict';
  else if (!code && /STALE.*REVISION/.test(upper)) code = 'stale_revision';
  else if (!code && /REWARD/.test(upper)) code = 'reward_missing';
  else if (!code && /MAP/.test(upper)) code = 'unexpected_map';
  else if (!code && /TIMEOUT/.test(upper)) code = 'timeout';
  else if (!code && /QUARANTIN/.test(upper)) code = 'quarantined';
  else if (!code) code = 'task_failed';
  return { code, message: failureMessages[code] };
}

function phasePresentation({ step, npcName, map, mobObjectives, completed }) {
  if (completed)
    return {
      phase: 'COMPLETE',
      phaseLabel: '任務完成',
      currentAction: 'COMPLETE',
      currentActionLabel: '任務完成',
      targetNpc: null,
      targetMap: null,
    };
  const type = step?.type ?? 'AVAILABLE';
  if (type === 'GO_NPC')
    return {
      phase: type,
      phaseLabel: '前往 NPC',
      currentAction: 'NAVIGATE_NPC',
      currentActionLabel: `正在前往 ${step.npcName}`,
      targetNpc: step.npcName,
      targetMap: step.map,
    };
  if (type === 'GO_MAP')
    return {
      phase: type,
      phaseLabel: '前往任務地圖',
      currentAction: 'NAVIGATE_MAP',
      currentActionLabel: `正在前往 ${step.map}`,
      targetNpc: null,
      targetMap: step.map,
    };
  if (type === 'RETURN_NPC')
    return {
      phase: type,
      phaseLabel: '返回回報 NPC',
      currentAction: 'RETURN_NPC',
      currentActionLabel: '任務條件完成，正在返回 NPC',
      targetNpc: step.npcName,
      targetMap: step.map,
    };
  if (type === 'KILL_MONSTER') {
    const objective = mobObjectives.find((entry) => entry.mobId === integer(step.mobId));
    return {
      phase: type,
      phaseLabel: '討伐目標',
      currentAction: 'KILL_MONSTER',
      currentActionLabel: `正在擊殺 ${objective?.mobName ?? `怪物 ${step.mobId}`} ${objective?.current ?? 0} / ${objective?.required ?? integer(step.count)}`,
      targetNpc: null,
      targetMap: step.map,
    };
  }
  if (type === 'CONFIRM_REWARD')
    return {
      phase: type,
      phaseLabel: '確認原生獎勵',
      currentAction: 'CONFIRM_REWARD',
      currentActionLabel: '正在確認原生任務獎勵',
      targetNpc: npcName,
      targetMap: map,
    };
  if (type === 'TALK_NPC' || type.startsWith('DIALOG_'))
    return {
      phase: type,
      phaseLabel: 'NPC 對話',
      currentAction: 'TALK_NPC',
      currentActionLabel: `正在與 ${npcName ?? '任務 NPC'} 對話`,
      targetNpc: npcName,
      targetMap: map,
    };
  if (type === 'COMPLETE_QUEST')
    return {
      phase: type,
      phaseLabel: '回報任務',
      currentAction: 'REPORT_QUEST',
      currentActionLabel: '正在與 Instructor Boya 對話',
      targetNpc: 'Instructor Boya#para01',
      targetMap: 'moc_para01',
    };
  return {
    phase: type,
    phaseLabel: type === 'AVAILABLE' ? '尚未開始' : '同步原生任務狀態',
    currentAction: type,
    currentActionLabel: type === 'AVAILABLE' ? '尚未開始' : '正在同步原生任務狀態',
    targetNpc: npcName,
    targetMap: map,
  };
}

export function buildEdenCourseAQuestJournal({
  ownership = null,
  questStates = {},
  rewards = [],
  member = false,
  firstJobEligible = false,
  baseLevel = 0,
  openKoreJourney = null,
  localizedItemName = (_id, fallback) => fallback,
  observedAt = new Date().toISOString(),
} = {}) {
  const rows = edenCourseA.questIds
    .map((questId) => ({ questId, row: questRow(questStates, questId) }))
    .filter((entry) => entry.row);
  const current = rows.at(-1) ?? null;
  const currentIndex = current ? edenCourseA.questIds.indexOf(current.questId) : -1;
  const rewardAmounts = new Map(
    rewards.map((entry) => [integer(entry.itemId ?? entry.id), integer(entry.amount ?? entry.quantity)]),
  );
  const rewardSummary = edenCourseA.rewards.map((reward) => ({
    type: reward.type,
    id: reward.id,
    name: localizedItemName(reward.id, reward.fallbackName),
    quantity: reward.quantity,
    confirmed: (rewardAmounts.get(reward.id) ?? 0) >= reward.quantity,
  }));
  const rewardsConfirmed = rewardSummary.every((entry) => entry.confirmed);
  const nativeCompletion = nativeQuestState(questRow(questStates, 7132)) === 'COMPLETE';
  const completed = nativeCompletion && rewardsConfirmed;
  const mobObjectives = edenCourseA.mobs.map((objective) => {
    const row = questRow(questStates, objective.questId);
    const objectiveIndex = edenCourseA.questIds.indexOf(objective.questId);
    const authoritativeComplete = Boolean(
      completed ||
        currentIndex > objectiveIndex ||
        (row &&
          integer(row.counts?.[0] ?? row.count1) >= objective.required),
    );
    const currentCount = authoritativeComplete
      ? objective.required
      : Math.min(objective.required, Math.max(0, integer(row?.counts?.[0] ?? row?.count1)));
    return {
      mobId: objective.mobId,
      mobName: objective.mobName,
      current: currentCount,
      required: objective.required,
      completed: authoritativeComplete,
    };
  });
  const executor =
    ownership?.owner === 'SERVER_AGENT' ? 'SERVER_AGENT' : 'OPENKORE';
  const courseAJourney =
    openKoreJourney?.taskId === 'equipment12' ? openKoreJourney : null;
  const taskRules = ownership?.targetRules ?? null;
  const taskPhase = ownership?.taskPhase ?? null;
  const stepIndex = sequenceStepIndex(taskPhase);
  const sequence = sequenceContext(taskRules?.steps, stepIndex);
  let step = sequence.step;
  if (!step && courseAJourney?.active) {
    const openKoreSteps = {
      equipment_accept: { type: 'GO_NPC', npcName: 'Instructor Boya#para01', map: 'moc_para01' },
      equipment_route_field: { type: 'GO_MAP', map: 'moc_fild11' },
      equipment_dog: { type: 'TALK_NPC', npcName: 'Talking Dog#para03', map: 'moc_fild11' },
      equipment_hunt_condor: { type: 'KILL_MONSTER', mobId: 1009, count: 10, map: 'moc_fild11' },
      equipment_hunt_wolf: { type: 'KILL_MONSTER', mobId: 1107, count: 10, map: 'moc_fild11' },
      equipment_hunt_scorpion: { type: 'KILL_MONSTER', mobId: 1001, count: 5, map: 'moc_fild11' },
      equipment_report_boya: { type: 'RETURN_NPC', npcName: 'Instructor Boya#para01', map: 'moc_para01' },
      equipment_reward: { type: 'TALK_NPC', npcName: 'Administrator Michael', map: 'moc_para01' },
      equipment_complete: { type: 'CONFIRM_REWARD' },
    };
    step = openKoreSteps[courseAJourney.phase] ?? null;
  }
  const context = step === sequence.step
    ? sequence
    : { step, npcName: step?.npcName ?? null, map: step?.map ?? null };
  let presentation = phasePresentation({ ...context, mobObjectives, completed });
  const rawFailure = ownership?.ownershipState === 'QUARANTINED'
    ? 'QUARANTINED'
    : ownership?.lastErrorCode || courseAJourney?.error || null;
  let failure = normalizeFailure(rawFailure);
  const prerequisiteIncomplete = !member || !firstJobEligible || integer(baseLevel) < 12;
  if (!failure && prerequisiteIncomplete && !rows.length && !completed)
    failure = normalizeFailure('QUEST_PREREQUISITE_INCOMPLETE');
  const currentObjective = mobObjectives.find((entry) => !entry.completed);
  const readyToReport =
    !completed &&
    (nativeCompletion ||
      Boolean(current && edenCourseA.mobs.some((entry) => entry.questId === current.questId) && currentObjective === undefined));
  if (completed) failure = null;
  let taskStatus = QuestTaskStatus.AVAILABLE;
  if (completed) taskStatus = QuestTaskStatus.COMPLETED;
  else if (failure) taskStatus = QuestTaskStatus.FAILED;
  else if (readyToReport) taskStatus = QuestTaskStatus.READY_TO_REPORT;
  else if (ownership?.agentMode === 'AUTO_QUEST' || courseAJourney?.active)
    taskStatus = QuestTaskStatus.ACTIVE;
  else if (ownership?.taskType === 'QUEST' || ownership?.taskType === 'QUEST_SEQUENCE')
    taskStatus = QuestTaskStatus.PAUSED;
  if (readyToReport && presentation.currentAction === 'AVAILABLE')
    presentation = {
      ...presentation,
      phase: 'RETURN_NPC',
      phaseLabel: '可回報',
      currentAction: 'RETURN_NPC',
      currentActionLabel: nativeCompletion
        ? '任務已回報，正在領取原生獎勵'
        : '任務條件完成，正在返回 NPC',
    };
  return {
    taskId: integer(ownership?.taskId, edenCourseA.taskId),
    taskType: edenCourseA.taskType,
    sequenceId: taskRules?.sequenceId ?? edenCourseA.sequenceId,
    sequenceName: edenCourseA.sequenceName,
    currentQuestId: current?.questId ?? (nativeCompletion ? 7132 : null),
    currentQuestState: current ? nativeQuestState(current.row) : 'ABSENT',
    phase: presentation.phase,
    phaseLabel: presentation.phaseLabel,
    currentAction: presentation.currentAction,
    currentActionLabel: presentation.currentActionLabel,
    targetNpc: presentation.targetNpc,
    targetMap: presentation.targetMap ?? ownership?.targetMap ?? null,
    mobObjectives,
    collectObjectives: [],
    navigation: {
      status: ['GO_NPC', 'GO_MAP', 'RETURN_NPC'].includes(presentation.phase)
        ? 'ACTIVE'
        : failure && ['route_failed', 'path_retry_exhausted', 'unexpected_map'].includes(failure.code)
          ? 'FAILED'
          : 'IDLE',
      destination: presentation.targetNpc ?? presentation.targetMap ?? null,
      retryCount: integer(taskRules?._navigationRetryCount, 0),
    },
    npc: {
      status: presentation.phase === 'TALK_NPC' || presentation.phase.startsWith('DIALOG_')
        ? 'ACTIVE'
        : failure && ['npc_missing', 'npc_failed'].includes(failure.code)
          ? 'FAILED'
          : 'IDLE',
      npcName: presentation.targetNpc,
    },
    rewardSummary,
    taskStatus,
    failure,
    ownership: {
      owner: ownership?.owner ?? 'OPENKORE',
      agentMode: ownership?.agentMode ?? (courseAJourney?.active ? 'AUTO_QUEST' : 'PERSISTENT_IDLE'),
    },
    executor,
    updatedAt: ownership?.updatedAt ?? observedAt,
    revision: integer(ownership?.revision, 0),
  };
}

export function questJournalFailureMessage(code) {
  return failureMessages[code] ?? '任務目前無法繼續，請稍後再試。';
}
