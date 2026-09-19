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
  return events.filter((event) => !OPERATIONAL_EVENT_TYPES.has(event.type));
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
  const context = {
    character_id: characterId,
    map,
    current_activity: source.currentActivity ?? source.current_activity ?? source.activity ?? source.runtimePhase ?? 'UNAVAILABLE',
    macro_goal: macroGoal,
    hunt_active: source.huntActive ?? source.hunt_active ?? macroGoal === 'HUNT',
    nearby_relevant_characters: nearbyRelevantCharacters,
    party_state: source.partyState ?? source.party_state ?? 'UNAVAILABLE',
    recent_encounters: recentEncounters,
    recent_social_events: recentSocialEvents,
    updated_at: updatedAt ?? null,
    revision,
  };
  return { ok: true, context, fields: SHADOW_CONTEXT_FIELDS };
}

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
