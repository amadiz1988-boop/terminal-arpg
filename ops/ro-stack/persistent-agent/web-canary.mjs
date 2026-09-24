// Web <-> SERVER_AGENT canary adapter (presentation-side only).
//
// The browser never decides which controller a character has. This module
// reads the authoritative ownership row (`persistent_agent_state`) plus the
// existing rollout allowlist gate and turns them into a render-only status
// object. It never mutates ownership, never writes SQL and never holds game
// rules; the rAthena Persistent Agent remains the only owner of transitions.
//
// Fixed W1 action set only. The browser may request these four intents; every
// other action name is rejected before it reaches the command queue.

export const OPENKORE_OWNER = 'OPENKORE';
export const SERVER_AGENT_OWNER = 'SERVER_AGENT';

export const W1_ACTION = Object.freeze({
  CLAIM_AGENT: 'claim_agent',
  START_FARM: 'start_farm',
  STOP_FARM: 'stop_farm',
  RELEASE_AGENT: 'release_agent',
});

// Exactly the fixed actions the canary Web UI is allowed to emit.
export const W1_ACTIONS = Object.freeze(Object.values(W1_ACTION));
const w1ActionSet = new Set(W1_ACTIONS);

export const FARM_MAP_SOURCE = Object.freeze({
  DEFAULT_POLICY: 'DEFAULT_POLICY',
  PLAYER_OVERRIDE: 'PLAYER_OVERRIDE',
});

const farmMapSourceSet = new Set(Object.values(FARM_MAP_SOURCE));

// Authoritative ownership states that still mean "SERVER_AGENT holds this
// character" from the Web's point of view.
const serverAgentOwnershipStates = new Set([
  'SERVER_AGENT',
  'QUARANTINED',
]);

// Mirrors the authoritative persistent_agent_state_stop_farm CAS modes. This
// read-only action gate is distinct from the Farm Statistics running flag.
const stoppableAgentModes = new Set([
  'AUTO_FARM', 'NAVIGATING', 'ROUTE_FAILED', 'NPC_INTERACTION', 'NPC_FAILED',
  'SERVICE_INTERACTION', 'SERVICE_FAILED', 'AUTO_QUEST', 'QUEST_FAILED',
]);

const mapIdPattern = /^[a-z0-9_]{1,31}$/;

// Live-status READ MODEL source. The Dashboard reads `persistent_agent_live_status`
// (written by the map-server Persistent Agent from authoritative rAthena state)
// and normalizes it here for presentation. Freshness is explicit: a missing
// row, a non-resident character, or an old `updated_at` is never rendered as a
// live value. The browser never writes this model.
export const LIVE_STATUS_SOURCE = 'rathena.persistent_agent.live_status';
export const LIVE_STATUS_MAX_AGE_MS = 15_000;

const livePhases = new Set([
  'AUTO_FARM',
  'RECOVERING',
  'RESPAWNING',
  'SUPPLY',
  'RETURN_TO_FARM',
  'NAVIGATING',
  'DEAD',
  'RELEASING',
  'IDLE',
]);

function parseTimestampMs(value) {
  if (value == null) return null;
  const text = String(value);
  const parsed = Date.parse(text.includes('T') ? text : text.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : null;
}

// `row` is a parsed `persistent_agent_live_status` row (or null/undefined when
// the char has no row). Returns a render-only view with explicit freshness.
export function createLiveStatusView(row, { now = Date.now(), maxAgeMs = LIVE_STATUS_MAX_AGE_MS } = {}) {
  if (!row) {
    return Object.freeze({
      available: false,
      fresh: false,
      stale: true,
      reason: 'live_status_unavailable',
      source: LIVE_STATUS_SOURCE,
    });
  }
  const resident = Boolean(row.resident);
  const updatedAtMs =
    Number.isFinite(Number(row.ageMs))
      ? now - Math.max(0, Number(row.ageMs))
      : parseTimestampMs(row.updatedAt);
  const ageMs = updatedAtMs === null ? null : Math.max(0, now - updatedAtMs);
  const fresh = resident && ageMs !== null && ageMs <= maxAgeMs;
  return {
    available: true,
    fresh,
    stale: !fresh,
    reason: fresh
      ? null
      : resident
        ? 'live_status_stale'
        : 'live_status_not_resident',
    source: LIVE_STATUS_SOURCE,
    resident,
    hp: toInteger(row.hp),
    maxHp: toInteger(row.maxHp),
    sp: toInteger(row.sp),
    maxSp: toInteger(row.maxSp),
    zeny: toInteger(row.zeny),
    map: row.map ? String(row.map) : null,
    x: toInteger(row.x),
    y: toInteger(row.y),
    phase: livePhases.has(String(row.runtimePhase))
      ? String(row.runtimePhase)
      : 'IDLE',
    supplyItemId: toInteger(row.supplyItemId),
    supplyItemAmount: toInteger(row.supplyItemAmount),
    revision: toInteger(row.revision),
    updatedAt: row.updatedAt ?? null,
    ageMs,
    // Presentation-only freshness metadata derived from the single authority
    // (LIVE_STATUS_MAX_AGE_MS). The browser uses it to distinguish LIVE / STALE
    // / OFFLINE without inventing a second freshness source.
    freshness: {
      ageMs,
      authoritativeAt: updatedAtMs,
      maxAgeMs,
    },
    statusIntervalMs: 1000,
  };
}

export function isW1Action(action) {
  return w1ActionSet.has(String(action ?? ''));
}

function toInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

// A read failure of the SERVER_AGENT state source must never be reported as
// OPENKORE ownership: an agent-owned character may simply be unreadable. The
// Web shows an explicit unavailable state instead of silently falling back.
export function createUnavailableControllerStatus(charId, reason) {
  return Object.freeze({
    available: false,
    charId: toInteger(charId),
    controlOwner: null,
    ownershipState: null,
    runtimeState: null,
    agentMode: null,
    agentEnabled: null,
    revision: 0,
    taskType: null,
    taskPhase: null,
    targetMap: null,
    canary: null,
    farmTarget: null,
    liveStatus: null,
    farmRunning: null,
    actions: Object.freeze({
      claim: false,
      startFarm: false,
      stopFarm: false,
      release: false,
    }),
    actionBlockers: Object.freeze({}),
    unavailableReason: String(reason ?? 'agent_status_unavailable'),
  });
}

// `stateRow` is a parsed `persistent_agent_state` row (or null when the
// character has no agent row yet). `rollout` is the existing rollout gate
// result. Both are read-only inputs.
export function createControllerStatus({
  charId,
  stateRow = null,
  rollout = null,
  farmTarget = null,
  liveStatus = null,
  farmRunning = null,
  unavailableReason = null,
}) {
  const canary = Boolean(rollout?.allowed);
  const owner = stateRow ? String(stateRow.controlOwner ?? '') : null;
  const ownershipState = stateRow
    ? String(stateRow.ownershipState ?? '')
    : null;
  const runtimeState = stateRow ? String(stateRow.runtimeState ?? '') : null;
  const agentMode = stateRow ? String(stateRow.agentMode ?? '') : null;
  const agentEnabled = stateRow ? Boolean(stateRow.agentEnabled) : false;
  const revision = stateRow ? toInteger(stateRow.revision) : 0;

  const isServerAgent =
    owner === SERVER_AGENT_OWNER &&
    serverAgentOwnershipStates.has(ownershipState ?? '');
  const commandOwner = isServerAgent && ownershipState === SERVER_AGENT_OWNER;
  const isLegacyOwner = owner === OPENKORE_OWNER;
  // A persisted AUTO_FARM mode is historical intent while the live read model
  // is non-resident. It must not make a quarantined character look actionable.
  // Missing live status stays fail-soft and preserves the existing read path;
  // an available non-resident snapshot is authoritative for this gate.
  const nonResidentSnapshot =
    liveStatus?.available === true && liveStatus.resident !== true;
  const farmActive =
    nonResidentSnapshot
      ? false
      : farmRunning === null
      ? Boolean(agentMode) && agentMode !== 'PERSISTENT_IDLE'
      : farmRunning === true;
  // Native persistent_agent_state_start_farm accepts only PERSISTENT_IDLE.
  // Farm statistics describe the farm session, not command eligibility: a
  // navigation, service or quest mode cannot start a second farm even when
  // farmRunning is false.
  const farmStartIdle = agentMode === 'PERSISTENT_IDLE';

  const blockers = {};
  let claim = false;
  let startFarm = false;
  let stopFarm = false;
  let release = false;

  if (canary && stateRow) {
    claim =
      owner === OPENKORE_OWNER &&
      ownershipState === OPENKORE_OWNER &&
      !agentEnabled;
    if (!claim && isLegacyOwner && ownershipState === OPENKORE_OWNER)
      blockers.claim = 'agent_already_enabled';

    startFarm =
      commandOwner && !nonResidentSnapshot && agentEnabled && farmStartIdle && !farmActive && Boolean(farmTarget);
    if (isServerAgent && ownershipState === 'QUARANTINED')
      blockers.startFarm = 'agent_quarantined';
    else if (isServerAgent && nonResidentSnapshot)
      blockers.startFarm = 'not_resident';
    else if (isServerAgent && agentEnabled && (!farmStartIdle || farmActive))
      blockers.startFarm = 'task_already_active';
    else if (isServerAgent && !farmTarget)
      blockers.startFarm = 'farm_target_unresolved';

    stopFarm = commandOwner && !nonResidentSnapshot && agentEnabled && stoppableAgentModes.has(agentMode);
    if (isServerAgent && ownershipState === 'QUARANTINED')
      blockers.stopFarm = 'agent_quarantined';
    else if (isServerAgent && nonResidentSnapshot)
      blockers.stopFarm = 'not_resident';
    else if (isServerAgent && !stoppableAgentModes.has(agentMode)) blockers.stopFarm = 'nothing_to_stop';

    release = isServerAgent;
    if (owner && !isServerAgent) blockers.release = 'agent_not_owner';
  } else if (!canary) {
    blockers.claim = 'rollout_not_allowlisted';
    blockers.startFarm = 'rollout_not_allowlisted';
    blockers.stopFarm = 'rollout_not_allowlisted';
    blockers.release = 'rollout_not_allowlisted';
  }

  // Authoritative controller label the browser must render verbatim.
  const controller = stateRow
    ? owner === SERVER_AGENT_OWNER
      ? SERVER_AGENT_OWNER
      : isLegacyOwner
        ? OPENKORE_OWNER
        : (owner || 'UNKNOWN')
    : OPENKORE_OWNER;

  return {
    available: true,
    charId: toInteger(charId),
    controller,
    controlOwner: owner,
    ownershipState,
    runtimeState,
    agentMode,
    agentEnabled,
    revision,
    taskType: stateRow ? (stateRow.taskType ?? null) : null,
    taskPhase: stateRow ? (stateRow.taskPhase ?? null) : null,
    targetMap: stateRow ? (stateRow.targetMap ?? null) : null,
    canary,
    rolloutReason: rollout?.reason ?? null,
    farmTarget: farmTarget ?? null,
    liveStatus: liveStatus ?? null,
    farmRunning: farmRunning === null ? null : farmActive,
    actions: { claim, startFarm, stopFarm, release },
    actionBlockers: blockers,
    unavailableReason,
  };
}

// Server-side resolution of the canary farm target. The browser never sends a
// map/mob for the SERVER_AGENT path; the target comes from persisted agent
// intent first, then from the dashboard-owned grind target config.
//
// MOB_SELECTION_REMOVED: the player farm target is map-only. Any legacy mobId
// in persisted state (`targetRules.mobId`) or grind config (`grindTarget.mobId`)
// is ignored, never a filter, and never used to reject or rewrite the map.
export function resolveFarmTarget({ stateRow = null, grindTarget = null } = {}) {
  const savedMap = String(grindTarget?.mapId ?? '');
  const savedSource = farmMapSourceSet.has(String(grindTarget?.source ?? ''))
    ? String(grindTarget.source)
    : null;
  // A manual choice is durable policy authority. This also protects the
  // browser target from a stale PA target_map during restart/reconnect resume.
  if (savedSource === FARM_MAP_SOURCE.PLAYER_OVERRIDE && mapIdPattern.test(savedMap))
    return { targetMap: savedMap, source: savedSource };
  if (grindTarget?.legacyUnclassified && mapIdPattern.test(savedMap))
    return { targetMap: savedMap, source: null, legacyUnclassified: true };
  const stateMap = String(stateRow?.targetMap ?? '');
  const stateActive = Boolean(stateRow?.agentMode) &&
    !['PERSISTENT_IDLE', 'INACTIVE'].includes(String(stateRow.agentMode));
  if (
    savedSource === FARM_MAP_SOURCE.DEFAULT_POLICY &&
    stateActive &&
    mapIdPattern.test(stateMap) &&
    stateMap !== savedMap
  )
    return { targetMap: stateMap, source: savedSource };
  const stateCandidate = mapIdPattern.test(stateMap)
    ? savedSource
      ? { targetMap: stateMap, source: savedSource }
      : { targetMap: stateMap }
    : null;
  const savedCandidate = mapIdPattern.test(savedMap)
    ? savedSource
      ? { targetMap: savedMap, source: savedSource }
      : { targetMap: savedMap }
    : null;
  const candidates = [
    ...(savedSource === FARM_MAP_SOURCE.DEFAULT_POLICY && mapIdPattern.test(savedMap)
      ? [{ targetMap: savedMap, source: savedSource }]
      : []),
    ...(stateCandidate ? [stateCandidate] : []),
    ...(savedCandidate ? [savedCandidate] : []),
  ];
  for (const candidate of candidates)
    if (mapIdPattern.test(candidate.targetMap)) return candidate;
  return null;
}

// Fixed, typed payload builders. Unknown actions are rejected here so the
// browser can never smuggle a raw command through the canary path.
export function buildW1CommandPayload(action, context = {}) {
  switch (action) {
    case W1_ACTION.CLAIM_AGENT:
      return {};
    case W1_ACTION.RELEASE_AGENT:
      return {};
    case W1_ACTION.STOP_FARM:
      return {};
    case W1_ACTION.START_FARM: {
      // MOB_SELECTION_REMOVED: the player selects a farm MAP only. No mobId is
      // resolved, generated or persisted by the Web; AUTO_FARM decides which
      // legal monster to attack.
      const targetMap = String(context.farmTarget?.targetMap ?? '');
      if (!mapIdPattern.test(targetMap))
        throw new Error('farm_target_unresolved');
      // Autonomous survival / death-recovery intent for a persistent agent.
      // The browser still only sends "start"; the server remains authoritative
      // and honors each flag only when its own capability config enables it.
      return {
        targetMap,
        lootEnabled: true,
        survivalEnabled: true,
        deathRecoveryEnabled: true,
      };
    }
    default:
      throw new Error('invalid_w1_action');
  }
}

// Which authoritative state change is expected after a W1 command, used by the
// acceptance harness and UI pending text only. Not a controller.
export function expectedTransition(action) {
  switch (action) {
    case W1_ACTION.CLAIM_AGENT:
      return { ownershipState: SERVER_AGENT_OWNER, agentMode: 'PERSISTENT_IDLE' };
    case W1_ACTION.START_FARM:
      return { ownershipState: SERVER_AGENT_OWNER, agentMode: 'AUTO_FARM' };
    case W1_ACTION.STOP_FARM:
      return { ownershipState: SERVER_AGENT_OWNER, agentMode: 'PERSISTENT_IDLE' };
    case W1_ACTION.RELEASE_AGENT:
      return { controlOwner: OPENKORE_OWNER, ownershipState: OPENKORE_OWNER };
    default:
      return null;
  }
}
