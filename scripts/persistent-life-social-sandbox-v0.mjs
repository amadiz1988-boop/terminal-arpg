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

export { SOCIAL_INTENTS };
