import assert from 'node:assert/strict';

const SOCIAL_INTENTS = Object.freeze([
  'NONE',
  'ACKNOWLEDGE',
  'GREETING',
  'REPLY',
  'SHORT_CHAT',
  'WHISPER',
  'PARTY_INVITE',
  'PARTY_ACCEPT',
  'PARTY_DECLINE',
  'HELP',
]);

const OPERATIONAL_EVENT_TYPES = new Set([
  'NORMAL_HIT',
  'NORMAL_DAMAGE',
  'POTION_USED',
  'NORMAL_MOVEMENT',
  'ORDINARY_LOOT',
  'TARGET_SWITCH',
  'ROUTINE_SUPPLY',
]);

const SOCIAL_CANDIDATE_TYPES = new Set([
  'SOCIAL_CANDIDATE_ENTER',
  'SOCIAL_CANDIDATE_CONTINUED',
  'SOCIAL_CANDIDATE_LEAVE',
]);

const hash32 = (value) => {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const unit = (value) => (hash32(value) % 10000) / 10000;

function boundedTrait(seed, name, minimum = 0.15, maximum = 0.8) {
  return Number((minimum + unit(`${seed}:${name}`) * (maximum - minimum)).toFixed(4));
}

function hiddenGenesis(seed) {
  return Object.freeze({
    socialInitiative: boundedTrait(seed, 'socialInitiative', 0.12, 0.68),
    strangerOpenness: boundedTrait(seed, 'strangerOpenness', 0.18, 0.75),
    partyPreference: boundedTrait(seed, 'partyPreference', 0.12, 0.64),
    riskTolerance: boundedTrait(seed, 'riskTolerance', 0.2, 0.8),
    rejectionSensitivity: boundedTrait(seed, 'rejectionSensitivity', 0.16, 0.78),
    socialRewardSensitivity: boundedTrait(seed, 'socialRewardSensitivity', 0.2, 0.82),
  });
}

export function createSeededCharacters({ seed = 'social-sandbox-v0', count = 6, map = 'pay_dun00' } = {}) {
  assert(Number.isInteger(count) && count >= 2 && count <= 8, 'V0 population must contain 2-8 characters');
  return Array.from({ length: count }, (_, index) => {
    const genesisSeed = `${seed}:${index + 1}`;
    return {
      id: `sandbox-${index + 1}`,
      genesisSeed,
      macroMode: 'CONSTRAINED_LIFE',
      macroGoal: 'HUNT',
      map,
      hiddenGenesis: hiddenGenesis(genesisSeed),
      recognition: new Map(),
      lifeEvidence: [],
    };
  });
}

export function createSandbox(options = {}) {
  return {
    characters: createSeededCharacters(options),
    encounters: [],
    socialEvidence: [],
    lifeFacts: [],
    sequence: 0,
  };
}

function recognitionKey(actorId, otherId) {
  return `${actorId}->${otherId}`;
}

function recordRecognition(actor, other) {
  const key = recognitionKey(actor.id, other.id);
  const count = (actor.recognition.get(key) ?? 0) + 1;
  actor.recognition.set(key, count);
  return count;
}

function intentFor({ actor, other, encounterCount, sequence, helpNeeded = false }) {
  const traits = actor.hiddenGenesis;
  const roll = unit(`${actor.genesisSeed}:${other.id}:${sequence}`);
  const recognitionBonus = Math.min(0.18, Math.max(0, encounterCount - 1) * 0.04);
  const socialReadiness =
    traits.socialInitiative * 0.42 +
    traits.strangerOpenness * 0.22 +
    traits.socialRewardSensitivity * 0.16 +
    recognitionBonus -
    traits.rejectionSensitivity * 0.1;

  if (helpNeeded && traits.strangerOpenness + traits.riskTolerance > 1.05 && roll < 0.18)
    return 'HELP';
  if (roll > Math.min(0.88, 0.78 + socialReadiness * 0.12)) return 'NONE';
  if (roll < socialReadiness * 0.22) return encounterCount > 1 ? 'REPLY' : 'GREETING';
  if (encounterCount > 1 && roll < socialReadiness * 0.42) return 'SHORT_CHAT';
  if (encounterCount > 2 && traits.partyPreference > 0.42 && roll < socialReadiness * 0.55)
    return 'PARTY_INVITE';
  return 'NONE';
}

export function decideSocial({ actor, other, sequence, helpNeeded = false }) {
  assert(actor?.macroGoal === 'HUNT', 'V0 actor must remain on HUNT macro goal');
  assert(other?.macroGoal === 'HUNT', 'V0 encounter target must remain on HUNT macro goal');
  assert(actor.map === other.map, 'V0 encounters must share one legal hunting map');
  const encounterCount = actor.recognition.get(recognitionKey(actor.id, other.id)) ?? 0;
  const intent = intentFor({ actor, other, encounterCount: encounterCount + 1, sequence, helpNeeded });
  return {
    intent,
    parentGoal: 'HUNT',
    returnContract: {
      parentGoal: 'HUNT',
      duration: intent === 'NONE' ? 0 : 1,
      interruptible: true,
      returnCondition: intent === 'NONE' ? 'immediate' : 'interaction_complete',
      resumeTarget: 'HUNT',
    },
  };
}

export function encounter(sandbox, actor, other, options = {}) {
  assert(sandbox.characters.includes(actor) && sandbox.characters.includes(other), 'actors must belong to sandbox');
  const sequence = ++sandbox.sequence;
  const actorRecognition = recordRecognition(actor, other);
  const otherRecognition = recordRecognition(other, actor);
  const decision = decideSocial({ actor, other, sequence, helpNeeded: options.helpNeeded });
  const encounterFact = {
    type: 'ENCOUNTER',
    sequence,
    actorId: actor.id,
    targetId: other.id,
    map: actor.map,
    recognition: actorRecognition,
    reciprocalRecognition: otherRecognition,
  };
  sandbox.encounters.push(encounterFact);
  sandbox.socialEvidence.push(encounterFact);
  if (decision.intent !== 'NONE') {
    const socialFact = {
      type: decision.intent,
      sequence: ++sandbox.sequence,
      actorId: actor.id,
      targetId: other.id,
      map: actor.map,
      parentGoal: decision.parentGoal,
      returnTarget: decision.returnContract.resumeTarget,
    };
    sandbox.socialEvidence.push(socialFact);
    sandbox.lifeFacts.push({ ...socialFact, lifeRelevant: true });
  }
  return { ...decision, recognition: actorRecognition, encounterFact };
}

export function completeSocialInteraction(actor, decision) {
  assert.equal(decision.parentGoal, 'HUNT');
  assert.equal(decision.returnContract.resumeTarget, 'HUNT');
  assert.equal(actor.macroGoal, 'HUNT');
  return { status: 'COMPLETED', resume: 'HUNT' };
}

export function filterLifeRelevantFacts(events) {
  return events.filter((event) => !OPERATIONAL_EVENT_TYPES.has(event.type) && !SOCIAL_CANDIDATE_TYPES.has(event.type));
}

export function reconcileDaily({ dayStart, dayEnd, facts }) {
  const meaningfulFacts = filterLifeRelevantFacts(facts).map((fact) => ({
    type: fact.type,
    actorId: fact.actorId ?? null,
    targetId: fact.targetId ?? null,
    map: fact.map ?? null,
    sequence: fact.sequence ?? null,
  }));
  return {
    dayStart: { ...dayStart },
    dayEnd: { ...dayEnd },
    meaningfulFacts,
    ignoredOperationalCount: facts.length - meaningfulFacts.length,
    normalDay: meaningfulFacts.length === 0,
    diaryEligible: meaningfulFacts.length > 0,
  };
}

const SHADOW_CONTEXT_FIELDS = Object.freeze([
  'character_id',
  'x',
  'y',
  'map',
  'current_activity',
  'macro_goal',
  'hunt_active',
  'nearby_relevant_characters',
  'party_state',
  'recent_encounters',
  'recent_social_events',
  'updated_at',
  'revision',
]);

function shadowUnavailable(reason, details = {}) {
  return { ok: false, reason, context: null, ...details };
}

function asEventType(event) {
  const type = event?.type ?? event?.eventType ?? event?.event_type;
  return typeof type === 'string' ? type.toUpperCase() : null;
}

function normalizeRuntimeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events
    .map((event) => ({
      ...event,
      type: asEventType(event),
      actorId: event?.actorId ?? event?.actor_id ?? null,
      targetId: event?.targetId ?? event?.target_id ?? null,
      map: event?.map ?? event?.mapName ?? event?.map_name ?? null,
      sequence: event?.sequence ?? event?.revision ?? null,
    }))
    .filter((event) => event.type);
}

function runtimeSource(runtimePayload) {
  if (!runtimePayload || typeof runtimePayload !== 'object') return null;
  const source = runtimePayload.live && typeof runtimePayload.live === 'object'
    ? runtimePayload.live
    : runtimePayload;
  return { envelope: runtimePayload, source };
}

/**
 * Adapt the canonical live projection shape into the minimal, read-only
 * context consumed by shadow Social Director logic. This function never
 * dispatches commands and rejects ambiguous or stale input.
 */
export function createShadowWorldContext({
  runtimePayload,
  previousRevision = 0,
  now = Date.now(),
  maxAgeMs = 120000,
} = {}) {
  const resolved = runtimeSource(runtimePayload);
  if (!resolved) return shadowUnavailable('RUNTIME_PAYLOAD_MISSING');
  const { envelope, source } = resolved;
  const characterId = envelope.characterId ?? envelope.character_id ?? source.charId ?? source.char_id;
  const revision = Number(envelope.revision ?? source.revision);
  const updatedAt = envelope.updatedAt ?? envelope.updated_at ?? source.updatedAt ?? source.updated_at;
  const map = source.map ?? source.mapName ?? source.map_name;
  const observerX = source.x ?? source.playerX ?? source.player_x ?? envelope.x ?? envelope.playerX;
  const observerY = source.y ?? source.playerY ?? source.player_y ?? envelope.y ?? envelope.playerY;
  if (characterId === undefined || characterId === null) return shadowUnavailable('CHARACTER_ID_MISSING');
  if (!Number.isFinite(revision)) return shadowUnavailable('REVISION_MISSING');
  if (revision <= Number(previousRevision)) return shadowUnavailable('STALE_REVISION', { revision, previousRevision });
  if (typeof map !== 'string' || map.length === 0) return shadowUnavailable('MAP_MISSING', { revision });

  const parsedUpdatedAt = Date.parse(updatedAt ?? '');
  const ageMs = Number.isFinite(parsedUpdatedAt) ? Math.max(0, now - parsedUpdatedAt) : null;
  const fresh = source.fresh ?? envelope.fresh ?? (ageMs !== null && ageMs <= maxAgeMs);
  if (fresh !== true) return shadowUnavailable('LIVE_CONTEXT_STALE', { revision, ageMs });

  const macroGoal = source.macroGoal ?? source.macro_goal ?? envelope.macroGoal ?? 'HUNT';
  const players = Array.isArray(source.players) ? source.players : [];
  const nearbyRelevantCharacters = players
    .map((player) => ({
      character_id: player?.id ?? player?.charId ?? player?.char_id ?? null,
      name: player?.name ?? null,
      map: player?.map ?? map,
      x: player?.x ?? null,
      y: player?.y ?? null,
    }))
    .filter((player) => player.character_id !== null && String(player.character_id) !== String(characterId));
  const allEvents = normalizeRuntimeEvents(
    envelope.events ?? source.events ?? envelope.socialEvents ?? source.socialEvents,
  );
  const recentEncounters = normalizeRuntimeEvents(
    envelope.recentEncounters ?? source.recentEncounters ?? allEvents.filter((event) => event.type === 'ENCOUNTER'),
  );
  const recentSocialEvents = normalizeRuntimeEvents(
    envelope.recentSocialEvents ?? source.recentSocialEvents ?? allEvents.filter((event) => event.type !== 'ENCOUNTER'),
  );
  const currentActivity = source.currentActivity ?? source.current_activity ?? source.activity ?? source.runtimePhase ?? 'UNAVAILABLE';
  const inferredHuntActive = macroGoal === 'HUNT' && ['AUTO_FARM', 'HUNT', 'COMBAT'].includes(String(currentActivity).toUpperCase());
  const context = {
    character_id: characterId,
    x: Number.isFinite(Number(observerX)) ? Number(observerX) : null,
    y: Number.isFinite(Number(observerY)) ? Number(observerY) : null,
    map,
    current_activity: currentActivity,
    macro_goal: macroGoal,
    hunt_active: source.huntActive ?? source.hunt_active ?? inferredHuntActive,
    nearby_relevant_characters: nearbyRelevantCharacters,
    party_state: source.partyState ?? source.party_state ?? 'UNAVAILABLE',
    recent_encounters: recentEncounters,
    recent_social_events: recentSocialEvents,
    updated_at: updatedAt ?? null,
    revision,
  };
  return { ok: true, context, fields: SHADOW_CONTEXT_FIELDS };
}

function visibleEntityId(entity) {
  const id = entity?.character_id ?? entity?.characterId ?? entity?.char_id ?? entity?.id ?? entity?.entity_id;
  return id === undefined || id === null || id === '' ? null : String(id);
}

function visibleEntitySet(entities, selfId) {
  const self = selfId === undefined || selfId === null ? null : String(selfId);
  return new Set((Array.isArray(entities) ? entities : [])
    .map(visibleEntityId)
    .filter((id) => id !== null && id !== self));
}

function derivedPresenceFact({ type, characterId, counterpartId, map, revision, timestamp, projectionSource }) {
  return {
    type,
    classification: 'DERIVED_LIFE_FACT',
    character_id: characterId,
    counterpart_id: counterpartId,
    map,
    revision,
    timestamp,
    projection_source: projectionSource,
  };
}

export const SOCIAL_PROXIMITY_V1 = Object.freeze({
  enterRadius: 7,
  exitRadius: 9,
  stateNearby: 'NEARBY',
  stateOutside: 'OUTSIDE',
});

function projectionTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function playerEntity(entity, selfId, currentMap) {
  const kind = entity?.entity_kind ?? entity?.entityKind ?? entity?.kind;
  if (kind !== undefined && String(kind).toUpperCase() !== 'PLAYER') return null;
  const id = visibleEntityId(entity);
  if (id === null || id === String(selfId)) return null;
  const map = entity?.map ?? entity?.mapName ?? entity?.map_name ?? currentMap;
  const x = Number(entity?.x);
  const y = Number(entity?.y);
  if (typeof map !== 'string' || map.length === 0 || map !== currentMap) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { id, map, x, y, name: entity?.name ?? null };
}

function chebyshevDistance(x1, y1, x2, y2) {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function emptyProximityResult(reason, details = {}) {
  return {
    ok: false,
    reason,
    derivedLifeFacts: [],
    continuedPresence: [],
    presenceEnds: [],
    stateById: {},
    ...details,
  };
}

/**
 * Derive hysteretic Social Proximity V1 from the canonical PLAYER projection.
 * The function is observation-only: it emits derived life facts and shadow
 * inputs, never authoritative events or gameplay commands.
 */
export function deriveSocialProximityTransitions({
  characterId,
  observerX,
  observerY,
  previousVisibleSet = [],
  currentVisibleSet = [],
  previousStateById = {},
  previousMap,
  currentMap,
  previousRevision,
  currentRevision,
  previousUpdatedAt,
  currentUpdatedAt,
  now = Date.now(),
  maxAgeMs = 120000,
  timestamp = now,
  projectionSource = 'persistent_agent_live_entity',
} = {}) {
  if (characterId === undefined || characterId === null || characterId === '')
    return emptyProximityResult('CHARACTER_ID_MISSING');
  const x = Number(observerX);
  const y = Number(observerY);
  if (!Number.isFinite(x) || !Number.isFinite(y))
    return emptyProximityResult('OBSERVER_POSITION_MISSING');
  if (typeof currentMap !== 'string' || currentMap.length === 0)
    return emptyProximityResult('MAP_MISSING');
  const previous = Number(previousRevision);
  const current = Number(currentRevision);
  if (!Number.isFinite(previous) || !Number.isFinite(current))
    return emptyProximityResult('REVISION_MISSING');
  if (current <= previous)
    return emptyProximityResult('STALE_REVISION', { revision: current, previousRevision: previous });

  const currentAt = projectionTimestamp(currentUpdatedAt);
  if (currentAt === null)
    return emptyProximityResult('UPDATED_AT_MISSING', { revision: current });
  const previousAt = previousUpdatedAt === undefined ? null : projectionTimestamp(previousUpdatedAt);
  if (previousUpdatedAt !== undefined && previousAt === null)
    return emptyProximityResult('PREVIOUS_UPDATED_AT_MISSING', { revision: current });
  if (previousAt !== null && currentAt <= previousAt)
    return emptyProximityResult('STALE_PROJECTION', { revision: current, previousUpdatedAt: previousAt, currentUpdatedAt: currentAt });
  if (Number.isFinite(Number(maxAgeMs)) && Number(maxAgeMs) >= 0 && Number(now) - currentAt > Number(maxAgeMs))
    return emptyProximityResult('STALE_PROJECTION', { revision: current, ageMs: Number(now) - currentAt });
  if (previousMap !== undefined && previousMap !== currentMap)
    return { ...emptyProximityResult('MAP_CHANGED'), ok: true, stateById: {} };

  const priorEntities = new Map();
  for (const entity of Array.isArray(previousVisibleSet) ? previousVisibleSet : []) {
    const normalized = playerEntity(entity, characterId, previousMap ?? currentMap);
    if (normalized) priorEntities.set(normalized.id, normalized);
  }
  const currentEntities = new Map();
  for (const entity of Array.isArray(currentVisibleSet) ? currentVisibleSet : []) {
    const normalized = playerEntity(entity, characterId, currentMap);
    if (normalized) currentEntities.set(normalized.id, normalized);
  }

  const priorIds = new Set([
    ...priorEntities.keys(),
    ...Object.keys(previousStateById ?? {}),
  ]);
  const stateById = {};
  for (const id of priorIds) stateById[id] = SOCIAL_PROXIMITY_V1.stateOutside;
  const derivedLifeFacts = [];
  const continuedPresence = [];
  const presenceEnds = [];

  for (const [id, entity] of currentEntities) {
    const priorState = previousStateById?.[id] ?? (() => {
      const prior = priorEntities.get(id);
      if (!prior) return SOCIAL_PROXIMITY_V1.stateOutside;
      return chebyshevDistance(x, y, prior.x, prior.y) <= SOCIAL_PROXIMITY_V1.enterRadius
        ? SOCIAL_PROXIMITY_V1.stateNearby
        : SOCIAL_PROXIMITY_V1.stateOutside;
    })();
    const distance = chebyshevDistance(x, y, entity.x, entity.y);
    const nearby = priorState === SOCIAL_PROXIMITY_V1.stateNearby
      ? distance <= SOCIAL_PROXIMITY_V1.exitRadius
      : distance <= SOCIAL_PROXIMITY_V1.enterRadius;
    stateById[id] = nearby ? SOCIAL_PROXIMITY_V1.stateNearby : SOCIAL_PROXIMITY_V1.stateOutside;
    if (!nearby) continue;
    const fact = {
      classification: 'DERIVED_LIFE_FACT',
      character_id: characterId,
      counterpart_id: id,
      map: currentMap,
      x: entity.x,
      y: entity.y,
      distance,
      revision: current,
      updated_at: currentAt,
      timestamp,
      projection_source: projectionSource,
    };
    if (priorState === SOCIAL_PROXIMITY_V1.stateNearby) {
    continuedPresence.push({ ...fact, type: 'SOCIAL_CANDIDATE_CONTINUED', classification: 'SOCIAL_CANDIDATE' });
    } else {
      derivedLifeFacts.push({ ...fact, type: 'SOCIAL_CANDIDATE_ENTER', classification: 'SOCIAL_CANDIDATE' });
    }
  }

  for (const id of priorIds) {
    if (stateById[id] !== SOCIAL_PROXIMITY_V1.stateNearby && previousStateById?.[id] === SOCIAL_PROXIMITY_V1.stateNearby) {
      const entity = priorEntities.get(id);
      presenceEnds.push({
        type: 'SOCIAL_CANDIDATE_LEAVE',
        classification: 'SOCIAL_CANDIDATE',
        character_id: characterId,
        counterpart_id: id,
        map: previousMap ?? currentMap,
        x: entity?.x ?? null,
        y: entity?.y ?? null,
        revision: current,
        updated_at: currentAt,
        timestamp,
        projection_source: projectionSource,
      });
    }
  }
  return {
    ok: true,
    reason: 'SOCIAL_PROXIMITY_DIFF',
    derivedLifeFacts,
    continuedPresence,
    presenceEnds,
    stateById,
    revision: current,
    updatedAt: currentAt,
  };
}

/** Feed only candidate-enter facts into the existing Social Director shadow policy. */
export function deriveShadowSocialProximity({
  context,
  previousContext,
  previousStateById = {},
  currentVisibleSet,
  previousVisibleSet,
  timestamp = Date.now(),
} = {}) {
  if (!context) return { ok: false, reason: 'CONTEXT_MISSING', shadowIntents: [], shadowDispatches: [], socialCommandDispatch: 0 };
  const transition = deriveSocialProximityTransitions({
    characterId: context.character_id,
    observerX: context.x,
    observerY: context.y,
    previousVisibleSet: previousVisibleSet ?? previousContext?.nearby_relevant_characters ?? [],
    currentVisibleSet: currentVisibleSet ?? context.nearby_relevant_characters ?? [],
    previousStateById,
    previousMap: previousContext?.map,
    currentMap: context.map,
    previousRevision: previousContext?.revision ?? 0,
    currentRevision: context.revision,
    previousUpdatedAt: previousContext?.updated_at,
    currentUpdatedAt: context.updated_at,
    timestamp,
  });
  const shadowIntents = transition.derivedLifeFacts.map((fact) =>
    createShadowIntent({ context, encounterCharacterId: fact.counterpart_id, timestamp }),
  );
  return {
    ...transition,
    shadowIntents,
    shadowDispatches: shadowIntents.map((intent) => dispatchShadowIntent(intent)),
    socialCommandDispatch: 0,
  };
}

/**
 * Derive observation-only social candidate transitions from two canonical
 * projections. This does not simulate a world and never emits gameplay
 * commands or authoritative events.
 */
export function deriveShadowCandidateTransitions({
  characterId,
  previousVisibleSet = [],
  currentVisibleSet = [],
  previousMap,
  currentMap,
  previousRevision,
  currentRevision,
  timestamp = Date.now(),
  projectionSource = 'persistent_agent_live_entity',
} = {}) {
  const previous = Number(previousRevision);
  const current = Number(currentRevision);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) {
    return { ok: false, reason: 'REVISION_MISSING', derivedLifeFacts: [], continuedPresence: [], presenceEnds: [] };
  }
  if (current <= previous) {
    return { ok: false, reason: 'STALE_REVISION', derivedLifeFacts: [], continuedPresence: [], presenceEnds: [] };
  }
  if (typeof currentMap !== 'string' || currentMap.length === 0) {
    return { ok: false, reason: 'MAP_MISSING', derivedLifeFacts: [], continuedPresence: [], presenceEnds: [] };
  }
  if (previousMap !== undefined && previousMap !== currentMap) {
    return {
      ok: true,
      reason: 'MAP_CHANGED',
      derivedLifeFacts: [],
      continuedPresence: [],
      presenceEnds: [],
    };
  }

  const previousIds = visibleEntitySet(previousVisibleSet, characterId);
  const currentIds = visibleEntitySet(currentVisibleSet, characterId);
  const entered = [...currentIds].filter((id) => !previousIds.has(id)).sort();
  const continuedPresence = [...currentIds].filter((id) => previousIds.has(id)).sort();
  const left = [...previousIds].filter((id) => !currentIds.has(id)).sort();
  return {
    ok: true,
    reason: 'PRESENCE_DIFF',
    derivedLifeFacts: entered.map((counterpartId) => ({
      ...derivedPresenceFact({
        type: 'SOCIAL_CANDIDATE_ENTER',
        characterId,
        counterpartId,
        map: currentMap,
        revision: current,
        timestamp,
        projectionSource,
      }),
      classification: 'SOCIAL_CANDIDATE',
    })),
    continuedPresence: continuedPresence.map((counterpartId) => ({
      type: 'SOCIAL_CANDIDATE_CONTINUED',
      classification: 'SOCIAL_CANDIDATE',
      character_id: characterId,
      counterpart_id: counterpartId,
      map: currentMap,
      revision: current,
      timestamp,
      projection_source: projectionSource,
    })),
    presenceEnds: left.map((counterpartId) => ({
      ...derivedPresenceFact({
        type: 'SOCIAL_CANDIDATE_LEAVE',
        characterId,
        counterpartId,
        map: previousMap ?? currentMap,
        revision: current,
        timestamp,
        projectionSource,
      }),
      classification: 'SOCIAL_CANDIDATE',
    })),
  };
}

/** @deprecated Use deriveShadowCandidateTransitions for proximity semantics. */
export const deriveShadowEncounterTransitions = deriveShadowCandidateTransitions;

function shadowActorFromContext(context, actor) {
  if (actor) return actor;
  const id = String(context.character_id);
  return {
    id,
    genesisSeed: `shadow:${id}`,
    macroGoal: context.macro_goal,
    map: context.map,
    hiddenGenesis: hiddenGenesis(`shadow:${id}`),
    recognition: new Map(),
    lifeEvidence: [],
  };
}

/**
 * Produce a deterministic observation-only decision. The returned intent is
 * data for inspection; it has no transport or gameplay side effects.
 */
export function createShadowIntent({ context, actor, encounterCharacterId, timestamp = Date.now() } = {}) {
  if (!context || context.macro_goal !== 'HUNT') {
    return { mode: 'SHADOW', accepted: false, reason: 'PARENT_GOAL_UNAVAILABLE', intent: null };
  }
  if (encounterCharacterId === undefined || encounterCharacterId === null) {
    return { mode: 'SHADOW', accepted: false, reason: 'ENCOUNTER_CHARACTER_MISSING', intent: null };
  }
  const shadowActor = shadowActorFromContext(context, actor);
  const other = {
    id: String(encounterCharacterId),
    macroGoal: 'HUNT',
    map: context.map,
  };
  const previousEncounters = context.recent_encounters.filter((event) =>
    String(event.actorId) === String(shadowActor.id) && String(event.targetId) === String(other.id),
  ).length;
  shadowActor.recognition.set(recognitionKey(shadowActor.id, other.id), previousEncounters);
  const decision = decideSocial({
    actor: shadowActor,
    other,
    sequence: context.revision,
  });
  const reasonCodes = ['SHADOW_MODE', 'PARENT_GOAL_HUNT'];
  if (previousEncounters > 0) reasonCodes.push('REPEATED_ENCOUNTER');
  reasonCodes.push(decision.intent === 'NONE' ? 'NO_SOCIAL_INTENT' : 'SOCIAL_INTENT');
  const candidate = {
    type: 'SOCIAL_CANDIDATE_ENTER',
    classification: 'SOCIAL_CANDIDATE',
    character_id: context.character_id,
    counterpart_id: encounterCharacterId,
    map: context.map,
    revision: context.revision,
    timestamp,
  };
  return {
    mode: 'SHADOW',
    accepted: true,
    intent: {
      timestamp,
      character_id: context.character_id,
      context_revision: context.revision,
      encounter_character_id: encounterCharacterId,
      evidence_summary: {
        recognized_encounters: previousEncounters,
        proximity_observed: context.nearby_relevant_characters.some(
          (candidate) => String(candidate.character_id) === String(encounterCharacterId),
        ),
      },
      decision: decision.intent,
      reason_codes: reasonCodes,
      parent_macro_goal: 'HUNT',
      would_interrupt_hunt: decision.intent !== 'NONE',
      would_resume_hunt: true,
    },
    outcome: decision.intent === 'NONE' ? 'PASS_BY' : 'SOCIAL_ENCOUNTER',
    socialEncounter: promoteSocialCandidate({ candidate, decision: decision.intent }),
  };
}

/** Promote a transient candidate only after a meaningful Social Director intent. */
export function promoteSocialCandidate({ candidate, decision } = {}) {
  const intent = typeof decision === 'string' ? decision : decision?.intent;
  if (!candidate || candidate.type !== 'SOCIAL_CANDIDATE_ENTER') return null;
  if (!intent || intent === 'NONE' || intent === 'PASS_BY') return null;
  assert(SOCIAL_INTENTS.includes(intent), `unsupported Social Director intent: ${intent}`);
  return {
    ...candidate,
    type: 'SOCIAL_ENCOUNTER',
    classification: 'SOCIAL_ENCOUNTER',
    intent,
  };
}

/** Shadow mode is intentionally fail-closed and never invokes a dispatcher. */
export function dispatchShadowIntent(intent, dispatcher = null) {
  return {
    mode: 'SHADOW',
    dispatched: false,
    dispatch_attempted: false,
    reason: 'SHADOW_MODE',
    intent: intent ?? null,
    dispatcher_ignored: dispatcher !== null,
  };
}

export function reconcileDailyFromRuntime({ dayStart, dayEnd, runtimePayload } = {}) {
  const resolved = runtimeSource(runtimePayload);
  const events = resolved
    ? normalizeRuntimeEvents(resolved.envelope.events ?? resolved.source.events ?? resolved.envelope.socialEvents ?? resolved.source.socialEvents)
    : [];
  return reconcileDaily({ dayStart, dayEnd, facts: events });
}

export { SOCIAL_INTENTS };
