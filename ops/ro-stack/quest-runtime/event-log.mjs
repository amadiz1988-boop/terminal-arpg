const MAX_EVENTS = 96;
const DEFAULT_THROTTLE_MS = 15_000;

export const QuestSemanticEventType = Object.freeze({
  NAVIGATION_STARTED: 'NAVIGATION_STARTED',
  MAP_ENTERED: 'MAP_ENTERED',
  NAVIGATION_BLOCKED: 'NAVIGATION_BLOCKED',
  ROUTE_REPLANNED: 'ROUTE_REPLANNED',
  NPC_REACHED: 'NPC_REACHED',
  SUPPLY_INSUFFICIENT: 'SUPPLY_INSUFFICIENT',
  SUPPLY_DEFERRED: 'SUPPLY_DEFERRED',
  SUPPLY_LOCKED: 'SUPPLY_LOCKED',
  SUPPLY_STARTED: 'SUPPLY_STARTED',
  SUPPLY_COMPLETED: 'SUPPLY_COMPLETED',
  QUEST_RESUMED: 'QUEST_RESUMED',
  COMBAT_POLICY_ENABLED: 'COMBAT_POLICY_ENABLED',
  COMBAT_POLICY_RELEASED: 'COMBAT_POLICY_RELEASED',
  AVOID_HOSTILES_ENABLED: 'AVOID_HOSTILES_ENABLED',
  HOSTILE_THREAT_DETECTED: 'HOSTILE_THREAT_DETECTED',
  HOSTILE_AVOIDANCE_STARTED: 'HOSTILE_AVOIDANCE_STARTED',
  HOSTILE_SAFE_POSITION: 'HOSTILE_SAFE_POSITION',
  HOSTILE_DEFENSIVE_FALLBACK: 'HOSTILE_DEFENSIVE_FALLBACK',
  TRIAL_STARTED: 'TRIAL_STARTED',
  TRIAL_RULE_APPLIED: 'TRIAL_RULE_APPLIED',
  TRIAL_WAVE_STARTED: 'TRIAL_WAVE_STARTED',
  TRIAL_WAVE_COMPLETED: 'TRIAL_WAVE_COMPLETED',
  TRIAL_FAILED: 'TRIAL_FAILED',
  TRIAL_PASSED: 'TRIAL_PASSED',
  ROUTE_NODE_ENTERED: 'ROUTE_NODE_ENTERED',
  ROUTE_CHOICE_MADE: 'ROUTE_CHOICE_MADE',
  ROUTE_DEAD_END: 'ROUTE_DEAD_END',
  ROUTE_BACKTRACK: 'ROUTE_BACKTRACK',
  ROUTE_ENCOUNTER: 'ROUTE_ENCOUNTER',
  ROUTE_SHORTCUT_FOUND: 'ROUTE_SHORTCUT_FOUND',
  CHARACTER_DIED: 'CHARACTER_DIED',
  QUEST_PAUSED: 'QUEST_PAUSED',
  CHECKPOINT_PRESERVED: 'CHECKPOINT_PRESERVED',
  RESPAWN_STARTED: 'RESPAWN_STARTED',
  RECOVERY_STARTED: 'RECOVERY_STARTED',
  READY_TO_RESUME: 'READY_TO_RESUME',
  CIRCUIT_BREAKER_TRIPPED: 'CIRCUIT_BREAKER_TRIPPED',
  QUEST_ACCEPTED: 'QUEST_ACCEPTED',
  STEP_COMPLETED: 'STEP_COMPLETED',
  CHECKPOINT_CREATED: 'CHECKPOINT_CREATED',
  NEXT_OBJECTIVE: 'NEXT_OBJECTIVE',
  QUEST_COMPLETED: 'QUEST_COMPLETED',
  AGENT_RECONNECTED: 'AGENT_RECONNECTED',
  RUNTIME_STATE_RESTORED: 'RUNTIME_STATE_RESTORED',
  TRIAL_RESET_TO_CHECKPOINT: 'TRIAL_RESET_TO_CHECKPOINT',
  STALE_CALLBACK_IGNORED: 'STALE_CALLBACK_IGNORED',
});

function cleanPayload(payload) {
  return payload && typeof payload === 'object' ? structuredClone(payload) : {};
}

export function appendQuestSemanticEvent(
  state,
  type,
  payload = {},
  { clock = Date.now, dedupKey, throttleMs = DEFAULT_THROTTLE_MS } = {},
) {
  if (!Object.values(QuestSemanticEventType).includes(type)) {
    throw new TypeError('INVALID_QUEST_SEMANTIC_EVENT');
  }
  const at = new Date(clock()).toISOString();
  const key = String(dedupKey ?? `${type}:${payload?.scope ?? ''}`);
  const events = Array.isArray(state.questEvents) ? state.questEvents : [];
  const previous = [...events].reverse().find((event) => event.dedupKey === key);
  if (
    previous &&
    Math.abs(Date.parse(at) - Date.parse(previous.at)) < Number(throttleMs)
  ) {
    return state;
  }
  return {
    ...state,
    questEvents: [
      ...events,
      { type, payload: cleanPayload(payload), at, dedupKey: key },
    ].slice(-MAX_EVENTS),
  };
}

function appendMany(state, entries, options) {
  return entries.reduce(
    (next, entry) =>
      appendQuestSemanticEvent(next, entry.type, entry.payload, {
        ...options,
        dedupKey: entry.dedupKey,
        throttleMs: entry.throttleMs,
      }),
    state,
  );
}

function policyPayload(policy, stage) {
  return {
    policy: policy?.mode ?? 'NORMAL',
    avoidHostiles: policy?.avoidHostiles === true,
    stageTitle: stage?.title ?? null,
  };
}

export function recordQuestTransition(previous, next, options = {}) {
  const entries = [];
  const beforeStage = previous?.missionStage ?? {};
  const afterStage = next?.missionStage ?? {};
  const title = afterStage.title ?? beforeStage.title ?? null;
  if (!previous?.formalQuestStarted && next?.formalQuestStarted) {
    entries.push({ type: QuestSemanticEventType.QUEST_ACCEPTED, payload: { stageTitle: title } });
  }
  if (beforeStage.type !== 'NAVIGATION' && afterStage.type === 'NAVIGATION') {
    entries.push({ type: QuestSemanticEventType.NAVIGATION_STARTED, payload: { stageTitle: title, target: afterStage.target ?? afterStage.npc ?? null } });
  }
  if (beforeStage.type === 'NAVIGATION' && afterStage.type === 'DIALOG') {
    entries.push({ type: QuestSemanticEventType.NPC_REACHED, payload: { stageTitle: title, target: afterStage.npc ?? afterStage.title ?? null } });
  }
  if (!previous?.supplyPending && next?.supplyPending) {
    entries.push({
      type: next?.interruptPolicy === 'LOCKED' || next?.trialInventoryLock
        ? QuestSemanticEventType.SUPPLY_LOCKED
        : QuestSemanticEventType.SUPPLY_DEFERRED,
      payload: { stageTitle: title },
    });
  }
  if (beforeStage.type !== 'SUPPLY' && afterStage.type === 'SUPPLY') {
    entries.push({ type: QuestSemanticEventType.SUPPLY_STARTED, payload: { reason: afterStage.reason, stageTitle: title } });
  }
  if (beforeStage.type === 'SUPPLY' && afterStage.type !== 'SUPPLY') {
    entries.push(
      { type: QuestSemanticEventType.SUPPLY_COMPLETED, payload: { stageTitle: title } },
      { type: QuestSemanticEventType.QUEST_RESUMED, payload: { stageTitle: title } },
    );
  }
  const beforePolicy = previous?.combatPolicy ?? { mode: 'NORMAL' };
  const afterPolicy = next?.combatPolicy ?? { mode: 'NORMAL' };
  if (beforePolicy.mode !== afterPolicy.mode) {
    if (afterPolicy.mode === 'NORMAL') {
      entries.push({ type: QuestSemanticEventType.COMBAT_POLICY_RELEASED, payload: policyPayload(beforePolicy, afterStage) });
    } else {
      entries.push({ type: QuestSemanticEventType.COMBAT_POLICY_ENABLED, payload: policyPayload(afterPolicy, afterStage) });
    }
  }
  if (!beforePolicy.avoidHostiles && afterPolicy.avoidHostiles) {
    entries.push({ type: QuestSemanticEventType.AVOID_HOSTILES_ENABLED, payload: policyPayload(afterPolicy, afterStage) });
  }
  if (beforePolicy.avoidHostiles && !afterPolicy.avoidHostiles) {
    entries.push({ type: QuestSemanticEventType.COMBAT_POLICY_RELEASED, payload: { ...policyPayload(beforePolicy, afterStage), policy: 'AVOID_HOSTILES' } });
  }
  if (!previous?.activeTrial && next?.activeTrial) {
    entries.push(
      { type: QuestSemanticEventType.TRIAL_STARTED, payload: { trialId: next.activeTrial.id, stageTitle: title } },
      { type: QuestSemanticEventType.TRIAL_RULE_APPLIED, payload: { rule: afterStage.rule ?? next.activeTrial.id, stageTitle: title } },
    );
  }
  if (Number(afterStage.wave) > 0 && Number(afterStage.wave) !== Number(beforeStage.wave)) {
    if (Number(beforeStage.wave) > 0) entries.push({ type: QuestSemanticEventType.TRIAL_WAVE_COMPLETED, payload: { wave: Number(beforeStage.wave), stageTitle: title } });
    entries.push({ type: QuestSemanticEventType.TRIAL_WAVE_STARTED, payload: { wave: Number(afterStage.wave), stageTitle: title } });
  }
  if (previous?.activeTrial && !next?.activeTrial) {
    entries.push({
      type: next?.questStatus === 'TRIAL_FAILED' || afterStage.result === 'TRIAL_FAILED'
        ? QuestSemanticEventType.TRIAL_FAILED
        : QuestSemanticEventType.TRIAL_PASSED,
      payload: { reason: afterStage.reason, checkpoint: afterStage.checkpoint ?? next?.checkpoint, stageTitle: title },
    });
  }
  if (previous?.currentStep?.id && previous.currentStep.id !== next?.currentStep?.id) {
    entries.push({ type: QuestSemanticEventType.STEP_COMPLETED, payload: { stepId: previous.currentStep.id, stageTitle: title } });
  }
  if (next?.checkpoint?.createdAt && next.checkpoint.createdAt !== previous?.checkpoint?.createdAt) {
    entries.push({ type: QuestSemanticEventType.CHECKPOINT_CREATED, payload: { checkpoint: next.checkpoint, stageTitle: title } });
  }
  if (previous?.objectiveId !== next?.objectiveId && next?.currentObjective) {
    entries.push({ type: QuestSemanticEventType.NEXT_OBJECTIVE, payload: { objectiveType: next.currentObjective.type, stageTitle: title } });
  }
  if (previous?.questStatus !== 'COMPLETED' && next?.questStatus === 'COMPLETED') {
    entries.push({ type: QuestSemanticEventType.QUEST_COMPLETED, payload: { stageTitle: title } });
  }
  return appendMany(next, entries, options);
}

export function recordAgentSemanticEvent(previous, next, event, options = {}) {
  const payload = { ...(event?.payload ?? {}), stageTitle: next?.missionStage?.title ?? previous?.missionStage?.title ?? null };
  const mapping = {
    SUPPLY_PENDING: next?.trialInventoryLock || next?.interruptPolicy === 'LOCKED' ? QuestSemanticEventType.SUPPLY_LOCKED : QuestSemanticEventType.SUPPLY_DEFERRED,
    SUPPLY_ACTIVE: QuestSemanticEventType.SUPPLY_STARTED,
    SUPPLY_COMPLETE: QuestSemanticEventType.SUPPLY_COMPLETED,
    TRIAL_POLICY_APPLIED: QuestSemanticEventType.COMBAT_POLICY_ENABLED,
    TRIAL_POLICY_RELEASED: QuestSemanticEventType.COMBAT_POLICY_RELEASED,
    CHARACTER_DEAD: QuestSemanticEventType.CHARACTER_DIED,
    RESPAWNED: QuestSemanticEventType.RECOVERY_STARTED,
    READY_TO_RESUME: QuestSemanticEventType.READY_TO_RESUME,
    NAVIGATION_STARTED: QuestSemanticEventType.NAVIGATION_STARTED,
    MAP_ENTERED: QuestSemanticEventType.MAP_ENTERED,
    NAVIGATION_BLOCKED: QuestSemanticEventType.NAVIGATION_BLOCKED,
    ROUTE_REPLANNED: QuestSemanticEventType.ROUTE_REPLANNED,
    NPC_REACHED: QuestSemanticEventType.NPC_REACHED,
    HOSTILE_THREAT_DETECTED: QuestSemanticEventType.HOSTILE_THREAT_DETECTED,
    HOSTILE_AVOIDANCE_STARTED: QuestSemanticEventType.HOSTILE_AVOIDANCE_STARTED,
    HOSTILE_SAFE_POSITION: QuestSemanticEventType.HOSTILE_SAFE_POSITION,
    HOSTILE_DEFENSIVE_FALLBACK: QuestSemanticEventType.HOSTILE_DEFENSIVE_FALLBACK,
    ROUTE_NODE_ENTERED: QuestSemanticEventType.ROUTE_NODE_ENTERED,
    ROUTE_CHOICE_MADE: QuestSemanticEventType.ROUTE_CHOICE_MADE,
    ROUTE_DEAD_END: QuestSemanticEventType.ROUTE_DEAD_END,
    ROUTE_BACKTRACK: QuestSemanticEventType.ROUTE_BACKTRACK,
    ROUTE_ENCOUNTER: QuestSemanticEventType.ROUTE_ENCOUNTER,
    ROUTE_SHORTCUT_FOUND: QuestSemanticEventType.ROUTE_SHORTCUT_FOUND,
  };
  let recorded = recordQuestTransition(previous, next, options);
  const semanticType = mapping[event?.type];
  if (semanticType) {
    recorded = appendQuestSemanticEvent(recorded, semanticType, payload, {
      ...options,
      dedupKey: `${semanticType}:${payload.scope ?? payload.map ?? ''}`,
    });
  }
  if (event?.type === 'CHARACTER_DEAD') {
    recorded = appendMany(recorded, [
      { type: QuestSemanticEventType.QUEST_PAUSED, payload },
      { type: QuestSemanticEventType.CHECKPOINT_PRESERVED, payload: { ...payload, checkpoint: next?.checkpoint } },
      ...(next?.missionStage?.circuitBreakerTripped ? [{ type: QuestSemanticEventType.CIRCUIT_BREAKER_TRIPPED, payload }] : []),
    ], options);
  }
  return recorded;
}

function checkpointLabel(payload) {
  return payload?.checkpoint?.stepId ?? payload?.checkpoint?.data?.label ?? '目前任務節點';
}

export function formatPlayerQuestEvent(event) {
  const p = event?.payload ?? {};
  const policy = p.policy ?? p.mode;
  const messages = {
    NAVIGATION_STARTED: `開始前往${p.target ? `「${p.target}」` : '任務地點'}。`,
    MAP_ENTERED: `已進入${p.map ? `「${p.map}」` : '下一張地圖'}。`,
    NAVIGATION_BLOCKED: '前進路線受阻，正在檢查新的通行方式。',
    ROUTE_REPLANNED: '正在重新規劃路線。',
    NPC_REACHED: `已抵達${p.target ? `「${p.target}」` : '任務 NPC'}。`,
    SUPPLY_INSUFFICIENT: '目前補給不足，任務將先處理補給需求。',
    SUPPLY_DEFERRED: '補給不足，將在下一個安全節點前往補給。',
    SUPPLY_LOCKED: '試煉進行中，目前不能離場補給。補給需求已保留至試煉結束。',
    SUPPLY_STARTED: '正在前往補給。',
    SUPPLY_COMPLETED: '補給已完成。',
    QUEST_RESUMED: '已恢復原任務。',
    COMBAT_POLICY_ENABLED: policy === 'NO_ATTACK' ? '禁止擊殺規則已啟用。角色將停止攻擊。' : `任務戰鬥規則「${policy ?? '特殊策略'}」已啟用。`,
    COMBAT_POLICY_RELEASED: '任務戰鬥規則已結束，角色已恢復一般戰鬥與移動策略。',
    AVOID_HOSTILES_ENABLED: '角色將主動避開敵對怪物。',
    HOSTILE_THREAT_DETECTED: '偵測到敵對怪物接近，正在尋找低威脅移動路徑。',
    HOSTILE_AVOIDANCE_STARTED: '角色正在避開敵對怪物。',
    HOSTILE_SAFE_POSITION: '已重新定位至較安全區域。',
    HOSTILE_DEFENSIVE_FALLBACK: '附近無安全路徑，暫時採取防禦與補給行為。',
    TRIAL_STARTED: `${p.stageTitle ?? '任務試煉'}已開始。`,
    TRIAL_RULE_APPLIED: p.rule === 'NO_KILL' ? '本階段禁止擊殺任何怪物。' : `試煉規則已啟用${p.rule ? `：${p.rule}` : ''}。`,
    TRIAL_WAVE_STARTED: `第 ${p.wave} 波試煉開始。`,
    TRIAL_WAVE_COMPLETED: `第 ${p.wave} 波試煉完成。`,
    TRIAL_FAILED: `試煉未通過${p.reason ? `：${p.reason}` : ''}。`,
    TRIAL_PASSED: '試煉完成。',
    ROUTE_NODE_ENTERED: `已抵達路線節點${p.nodeLabel ? `「${p.nodeLabel}」` : ''}。`,
    ROUTE_CHOICE_MADE: `已選擇${p.choiceLabel ? `「${p.choiceLabel}」` : '下一條路線'}。`,
    ROUTE_DEAD_END: '前方是死路，角色將回到上一個有效節點。',
    ROUTE_BACKTRACK: '正在沿原路返回上一個有效節點。',
    ROUTE_ENCOUNTER: '路線上出現遭遇，任務策略已開始處理。',
    ROUTE_SHORTCUT_FOUND: '發現可通行的捷徑。',
    CHARACTER_DIED: '角色已死亡，任務暫時停止。',
    QUEST_PAUSED: '任務已暫停。',
    CHECKPOINT_PRESERVED: `已保留檢查點「${checkpointLabel(p)}」。`,
    RESPAWN_STARTED: '正在復活角色。',
    RECOVERY_STARTED: '角色已復活，正在恢復任務狀態。',
    READY_TO_RESUME: '恢復完成，準備繼續任務。',
    CIRCUIT_BREAKER_TRIPPED: '連續死亡次數已達保護上限，任務已停止並等待處理。',
    QUEST_ACCEPTED: `${p.stageTitle ?? '職業任務'}已接受。`,
    STEP_COMPLETED: '目前任務步驟已完成。',
    CHECKPOINT_CREATED: `已建立檢查點「${checkpointLabel(p)}」。`,
    NEXT_OBJECTIVE: `${p.stageTitle ? `下一步：${p.stageTitle}` : '已更新下一個任務目標'}。`,
    QUEST_COMPLETED: `${p.stageTitle ?? '任務'}已完成。`,
    AGENT_RECONNECTED: '執行器已重新連線。',
    RUNTIME_STATE_RESTORED: '任務狀態已恢復。',
    TRIAL_RESET_TO_CHECKPOINT: `試煉已回到檢查點「${checkpointLabel(p)}」，可重新開始目前階段。`,
    STALE_CALLBACK_IGNORED: '已忽略過期的任務回報，現有進度不受影響。',
  };
  return messages[event?.type] ?? '任務狀態已更新。';
}

export function formatDebugQuestEvent(event) {
  const payload = JSON.stringify(event?.payload ?? {});
  return `${event?.type ?? 'UNKNOWN'} ${payload}`;
}

export function projectQuestEventLog(state) {
  const events = Array.isArray(state?.questEvents) ? state.questEvents : [];
  return {
    playerLog: events.map((event) => ({ at: event.at, type: event.type, message: formatPlayerQuestEvent(event) })),
    debugLog: events.map((event) => ({ at: event.at, type: event.type, message: formatDebugQuestEvent(event) })),
  };
}
