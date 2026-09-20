import assert from 'node:assert/strict';
import {
  SOCIAL_INTENTS,
  completeSocialInteraction,
  createShadowIntent,
  createShadowWorldContext,
  createSandbox,
  createSeededCharacters,
  deriveShadowSocialProximity,
  deriveShadowEncounterTransitions,
  deriveSocialProximityTransitions,
  dispatchShadowIntent,
  encounter,
  reconcileDaily,
  reconcileDailyFromRuntime,
} from './persistent-life-social-sandbox-v0.mjs';

const checks = [];
function check(label, fn) {
  try {
    fn();
    checks.push({ label, ok: true });
    console.log(`PASS  ${label}`);
  } catch (error) {
    checks.push({ label, ok: false, error });
    console.log(`FAIL  ${label}: ${error.message}`);
  }
}

check('six seeded characters are reproducible and bounded', () => {
  const first = createSeededCharacters({ seed: 'v0-seed', count: 6 });
  const second = createSeededCharacters({ seed: 'v0-seed', count: 6 });
  assert.deepEqual(
    first.map((character) => ({ id: character.id, genesisSeed: character.genesisSeed, hiddenGenesis: character.hiddenGenesis })),
    second.map((character) => ({ id: character.id, genesisSeed: character.genesisSeed, hiddenGenesis: character.hiddenGenesis })),
  );
  for (const character of first) {
    assert.equal(character.macroGoal, 'HUNT');
    assert.equal(character.map, 'pay_dun00');
    for (const value of Object.values(character.hiddenGenesis)) assert.ok(value >= 0 && value <= 1);
  }
});

const sandbox = createSandbox({ seed: 'v0-observation', count: 6, map: 'pay_dun00' });
const [a, b, c, d, e, f] = sandbox.characters;
const decisions = [];
for (let round = 0; round < 12; round += 1) {
  const actors = [a, b, c, d, e, f];
  for (let index = 0; index < actors.length; index += 1) {
    const actor = actors[index];
    const other = actors[(index + round + 1) % actors.length];
    decisions.push(encounter(sandbox, actor, other));
  }
}

check('most encounters remain no-social while a minority can interact', () => {
  const none = decisions.filter((decision) => decision.intent === 'NONE').length;
  const social = decisions.length - none;
  assert.ok(none > social, `${none} none vs ${social} social`);
  assert.ok(social > 0, 'expected at least one bounded social response');
  for (const decision of decisions) assert.ok(SOCIAL_INTENTS.includes(decision.intent));
});

check('repeated encounter accumulates recognition evidence', () => {
  assert.ok(a.recognition.get(`${a.id}->${b.id}`) >= 2);
  assert.ok(sandbox.socialEvidence.some((fact) => fact.type === 'ENCOUNTER' && fact.recognition >= 2));
});

check('social decisions carry bounded resume-to-hunt contracts', () => {
  for (const decision of decisions) {
    assert.equal(decision.parentGoal, 'HUNT');
    assert.equal(decision.returnContract.resumeTarget, 'HUNT');
    assert.ok(decision.returnContract.duration >= 0 && decision.returnContract.duration <= 1);
  }
  const socialDecision = decisions.find((decision) => decision.intent !== 'NONE');
  assert.ok(socialDecision);
  assert.deepEqual(completeSocialInteraction(a, socialDecision), { status: 'COMPLETED', resume: 'HUNT' });
});

check('daily reconciliation ignores ordinary combat noise and keeps life facts', () => {
  const summary = reconcileDaily({
    dayStart: { map: 'pay_dun00', macroGoal: 'HUNT' },
    dayEnd: { map: 'pay_dun00', macroGoal: 'HUNT' },
    facts: [
      { type: 'NORMAL_HIT', actorId: a.id },
      { type: 'POTION_USED', actorId: a.id },
      { type: 'GREETING', actorId: a.id, targetId: b.id, map: 'pay_dun00', sequence: 3 },
      { type: 'PARTY_INVITE', actorId: c.id, targetId: d.id, map: 'pay_dun00', sequence: 4 },
    ],
  });
  assert.equal(summary.ignoredOperationalCount, 2);
  assert.deepEqual(summary.meaningfulFacts.map((fact) => fact.type), ['GREETING', 'PARTY_INVITE']);
  assert.equal(summary.diaryEligible, true);
  assert.equal(summary.dayEnd.macroGoal, 'HUNT');
});

check('normal day is valid and does not invent drama', () => {
  const summary = reconcileDaily({
    dayStart: { map: 'pay_dun00', macroGoal: 'HUNT' },
    dayEnd: { map: 'pay_dun00', macroGoal: 'HUNT' },
    facts: [{ type: 'NORMAL_HIT' }, { type: 'NORMAL_MOVEMENT' }, { type: 'ORDINARY_LOOT' }],
  });
  assert.equal(summary.normalDay, true);
  assert.equal(summary.diaryEligible, false);
  assert.deepEqual(summary.meaningfulFacts, []);
});

check('player-facing output contains no hidden parameters', () => {
  const summary = reconcileDaily({ dayStart: { macroGoal: 'HUNT' }, dayEnd: { macroGoal: 'HUNT' }, facts: [] });
  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /socialInitiative|trust|utility|rejectionSensitivity|relationshipScore/i);
});

const realShapedPayload = {
  characterId: 1001,
  revision: 11,
  updatedAt: '2026-09-20T10:00:00.000Z',
  live: {
    charId: 1001,
    fresh: true,
    map: 'pay_dun00',
    x: 80,
    y: 92,
    runtimePhase: 'AUTO_FARM',
    resident: true,
    players: [{ id: 1002, name: 'Other', map: 'pay_dun00', x: 80, y: 92 }],
    partyState: 'NONE',
    recentEncounters: [{ eventType: 'ENCOUNTER', actorId: 1001, targetId: 1002, mapName: 'pay_dun00', sequence: 10 }],
    recentSocialEvents: [],
  },
  events: [
    { eventType: 'NORMAL_HIT', actorId: 1001, sequence: 9 },
    { eventType: 'ENCOUNTER', actorId: 1001, targetId: 1002, mapName: 'pay_dun00', sequence: 10 },
  ],
};

check('real-shaped canonical context adapter returns the minimal contract', () => {
  const result = createShadowWorldContext({ runtimePayload: realShapedPayload, now: Date.parse('2026-09-20T10:00:30.000Z') });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.context).sort(), [
    'character_id', 'current_activity', 'hunt_active', 'macro_goal', 'map', 'x', 'y',
    'nearby_relevant_characters', 'party_state', 'recent_encounters',
    'recent_social_events', 'revision', 'updated_at',
  ].sort());
  assert.equal(result.context.character_id, 1001);
  assert.equal(result.context.map, 'pay_dun00');
  assert.equal(result.context.x, 80);
  assert.equal(result.context.y, 92);
  assert.equal(result.context.current_activity, 'AUTO_FARM');
  assert.equal(result.context.hunt_active, true);
  assert.equal(result.context.nearby_relevant_characters[0].character_id, 1002);
  assert.equal(result.context.recent_encounters[0].type, 'ENCOUNTER');
});

check('stale context revision is rejected fail-closed', () => {
  const result = createShadowWorldContext({ runtimePayload: realShapedPayload, previousRevision: 11, now: Date.parse('2026-09-20T10:00:30.000Z') });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'STALE_REVISION');
});

check('missing runtime fields use a safe unavailable result', () => {
  const result = createShadowWorldContext({
    runtimePayload: { characterId: 1001, revision: 12, live: { fresh: true, players: [] } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'MAP_MISSING');
});

check('shadow mode remains fail-closed when no HUNT parent exists', () => {
  const result = createShadowIntent({
    context: { character_id: 1001, map: 'pay_dun00', macro_goal: 'UNAVAILABLE', recent_encounters: [], nearby_relevant_characters: [], revision: 12 },
    encounterCharacterId: 1002,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'PARENT_GOAL_UNAVAILABLE');
});

check('shadow dispatch proves zero command dispatch', () => {
  let calls = 0;
  const result = dispatchShadowIntent({ decision: 'GREETING' }, () => { calls += 1; });
  assert.equal(result.dispatched, false);
  assert.equal(result.dispatch_attempted, false);
  assert.equal(calls, 0);
});

check('shadow intent preserves HUNT parent and resume contract', () => {
  const context = createShadowWorldContext({ runtimePayload: realShapedPayload, now: Date.parse('2026-09-20T10:00:30.000Z') }).context;
  const result = createShadowIntent({ context, encounterCharacterId: 1002, timestamp: 1234 });
  assert.equal(result.accepted, true);
  assert.equal(result.intent.parent_macro_goal, 'HUNT');
  assert.equal(result.intent.would_resume_hunt, true);
  assert.equal(result.intent.context_revision, 11);
});

check('encounter produces a structured shadow decision', () => {
  const context = createShadowWorldContext({ runtimePayload: realShapedPayload, now: Date.parse('2026-09-20T10:00:30.000Z') }).context;
  const result = createShadowIntent({ context, encounterCharacterId: 1002 });
  assert.ok(SOCIAL_INTENTS.includes(result.intent.decision));
  assert.ok(result.intent.reason_codes.includes('SHADOW_MODE'));
  assert.equal(result.intent.evidence_summary.proximity_observed, true);
});

check('repeated encounter is represented without mutating the world', () => {
  const repeatedPayload = {
    ...realShapedPayload,
    revision: 12,
    live: {
      ...realShapedPayload.live,
      recentEncounters: [{ eventType: 'ENCOUNTER', actorId: 1001, targetId: 1002, sequence: 10 }],
    },
  };
  const context = createShadowWorldContext({ runtimePayload: repeatedPayload, previousRevision: 11, now: Date.parse('2026-09-20T10:00:30.000Z') }).context;
  const result = createShadowIntent({ context, encounterCharacterId: 1002 });
  assert.ok(result.intent.reason_codes.includes('REPEATED_ENCOUNTER'));
  assert.equal(context.recent_encounters.length, 1);
});

check('ordinary combat noise is filtered from real-shaped daily reconciliation', () => {
  const summary = reconcileDailyFromRuntime({
    dayStart: { map: 'pay_dun00', macroGoal: 'HUNT' },
    dayEnd: { map: 'pay_dun00', macroGoal: 'HUNT' },
    runtimePayload: {
      events: [
        { eventType: 'NORMAL_HIT', actorId: 1001 },
        { eventType: 'NORMAL_DAMAGE', actorId: 1001 },
        { eventType: 'POTION_USED', actorId: 1001 },
        { eventType: 'GREETING', actorId: 1001, targetId: 1002, sequence: 13 },
      ],
    },
  });
  assert.equal(summary.ignoredOperationalCount, 3);
  assert.deepEqual(summary.meaningfulFacts.map((fact) => fact.type), ['GREETING']);
});

check('daily reconciliation keeps structured life facts from a real-shaped context', () => {
  const summary = reconcileDailyFromRuntime({
    dayStart: { map: 'pay_dun00', macroGoal: 'HUNT' },
    dayEnd: { map: 'pay_dun00', macroGoal: 'HUNT' },
    runtimePayload: realShapedPayload,
  });
  assert.equal(summary.ignoredOperationalCount, 1);
  assert.deepEqual(summary.meaningfulFacts.map((fact) => fact.type), ['ENCOUNTER']);
  assert.equal(summary.diaryEligible, true);
  assert.equal(summary.dayEnd.macroGoal, 'HUNT');
});

function proximitySample({
  distance,
  revision,
  previousRevision = revision - 1,
  previousStateById = {},
  previousVisibleSet = [],
  map = 'pay_dun00',
  previousMap = map,
  previousUpdatedAt = `2026-09-20T10:00:${String(previousRevision).padStart(2, '0')}.000Z`,
} = {}) {
  const currentUpdatedAt = `2026-09-20T10:00:${String(revision).padStart(2, '0')}.000Z`;
  return deriveSocialProximityTransitions({
    characterId: 1001,
    observerX: 0,
    observerY: 0,
    previousVisibleSet,
    currentVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map, x: distance, y: 0, name: 'Other' }],
    previousStateById,
    previousMap,
    currentMap: map,
    previousRevision,
    currentRevision: revision,
    previousUpdatedAt,
    currentUpdatedAt,
    now: Date.parse(currentUpdatedAt) + 1000,
  });
}

check('social proximity enters exactly at distance 7', () => {
  const result = proximitySample({ distance: 7, revision: 1, previousRevision: 0, previousUpdatedAt: undefined });
  assert.equal(result.ok, true);
  assert.deepEqual(result.derivedLifeFacts.map((fact) => [fact.type, fact.distance]), [['ENCOUNTER', 7]]);
  assert.equal(result.stateById['1002'], 'NEARBY');
});

check('distance 8 while OUTSIDE does not enter', () => {
  const result = proximitySample({ distance: 8, revision: 1, previousRevision: 0, previousUpdatedAt: undefined });
  assert.deepEqual(result.derivedLifeFacts, []);
  assert.equal(result.stateById['1002'], 'OUTSIDE');
});

check('distance 8 while NEARBY remains nearby', () => {
  const result = proximitySample({
    distance: 8,
    revision: 2,
    previousStateById: { 1002: 'NEARBY' },
    previousVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 7, y: 0 }],
  });
  assert.deepEqual(result.derivedLifeFacts, []);
  assert.deepEqual(result.continuedPresence.map((fact) => fact.counterpart_id), ['1002']);
});

check('distance 9 while NEARBY remains nearby', () => {
  const result = proximitySample({
    distance: 9,
    revision: 2,
    previousStateById: { 1002: 'NEARBY' },
    previousVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 8, y: 0 }],
  });
  assert.deepEqual(result.derivedLifeFacts, []);
  assert.equal(result.stateById['1002'], 'NEARBY');
});

check('distance 10 while NEARBY leaves', () => {
  const result = proximitySample({
    distance: 10,
    revision: 2,
    previousStateById: { 1002: 'NEARBY' },
    previousVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 9, y: 0 }],
  });
  assert.deepEqual(result.presenceEnds.map((fact) => fact.type), ['ENCOUNTER_END']);
  assert.equal(result.stateById['1002'], 'OUTSIDE');
});

check('10 to 7 re-enters exactly once', () => {
  const outside = proximitySample({ distance: 10, revision: 2, previousStateById: { 1002: 'NEARBY' } });
  const returned = proximitySample({
    distance: 7,
    revision: 3,
    previousStateById: outside.stateById,
    previousVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 10, y: 0 }],
  });
  assert.deepEqual(returned.derivedLifeFacts.map((fact) => fact.type), ['ENCOUNTER']);
});

check('repeated distance 7 samples do not duplicate encounters', () => {
  const first = proximitySample({ distance: 7, revision: 1, previousRevision: 0, previousUpdatedAt: undefined });
  const second = proximitySample({
    distance: 7,
    revision: 2,
    previousStateById: first.stateById,
    previousVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 7, y: 0 }],
  });
  const third = proximitySample({
    distance: 7,
    revision: 3,
    previousStateById: second.stateById,
    previousVisibleSet: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 7, y: 0 }],
  });
  assert.equal(second.derivedLifeFacts.length, 0);
  assert.equal(third.derivedLifeFacts.length, 0);
});

check('different map resets social state without an encounter', () => {
  const result = proximitySample({
    distance: 7,
    revision: 2,
    previousMap: 'morocc',
    previousStateById: { 1002: 'NEARBY' },
  });
  assert.equal(result.reason, 'MAP_CHANGED');
  assert.deepEqual(result.derivedLifeFacts, []);
  assert.deepEqual(result.stateById, {});
});

check('self, non-player, and missing identity are ignored', () => {
  const result = deriveSocialProximityTransitions({
    characterId: 1001,
    observerX: 0,
    observerY: 0,
    currentMap: 'pay_dun00',
    previousRevision: 0,
    currentRevision: 1,
    currentUpdatedAt: '2026-09-20T10:00:01.000Z',
    now: Date.parse('2026-09-20T10:00:02.000Z'),
    currentVisibleSet: [
      { entity_kind: 'PLAYER', entity_id: 1001, map: 'pay_dun00', x: 1, y: 0 },
      { entity_kind: 'MONSTER', entity_id: 2001, map: 'pay_dun00', x: 1, y: 0 },
      { entity_kind: 'PLAYER', map: 'pay_dun00', x: 1, y: 0 },
    ],
  });
  assert.deepEqual(result.derivedLifeFacts, []);
});

check('stale revision and stale projection are rejected', () => {
  const staleRevision = proximitySample({ distance: 7, revision: 1, previousRevision: 1, previousUpdatedAt: undefined });
  assert.equal(staleRevision.reason, 'STALE_REVISION');
  const staleProjection = proximitySample({
    distance: 7,
    revision: 2,
    previousUpdatedAt: '2026-09-20T10:00:02.000Z',
  });
  assert.equal(staleProjection.reason, 'STALE_PROJECTION');
});

check('multiple nearby players maintain independent states', () => {
  const result = deriveSocialProximityTransitions({
    characterId: 1001,
    observerX: 0,
    observerY: 0,
    currentMap: 'pay_dun00',
    previousRevision: 0,
    currentRevision: 1,
    currentUpdatedAt: '2026-09-20T10:00:01.000Z',
    now: Date.parse('2026-09-20T10:00:02.000Z'),
    currentVisibleSet: [
      { entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 7, y: 0 },
      { entity_kind: 'PLAYER', entity_id: 1003, map: 'pay_dun00', x: 9, y: 0 },
    ],
  });
  assert.deepEqual(result.derivedLifeFacts.map((fact) => fact.counterpart_id), ['1002']);
  assert.equal(result.stateById['1002'], 'NEARBY');
  assert.equal(result.stateById['1003'], 'OUTSIDE');
});

check('headless shadow wiring emits no social command', () => {
  const context = {
    character_id: 1001,
    x: 0,
    y: 0,
    map: 'pay_dun00',
    macro_goal: 'HUNT',
    hunt_active: true,
    nearby_relevant_characters: [{ entity_kind: 'PLAYER', entity_id: 1002, map: 'pay_dun00', x: 7, y: 0 }],
    recent_encounters: [],
    recent_social_events: [],
    revision: 1,
    updated_at: '2026-09-20T10:00:01.000Z',
  };
  const result = deriveShadowSocialProximity({ context, previousRevision: 0 });
  assert.equal(result.socialCommandDispatch, 0);
  assert.equal(result.shadowDispatches[0].dispatched, false);
  assert.equal(result.shadowIntents[0].mode, 'SHADOW');
});

const presenceArgs = {
  characterId: 1001,
  previousMap: 'pay_dun00',
  currentMap: 'pay_dun00',
  previousRevision: 10,
  currentRevision: 11,
  timestamp: 1234,
};

check('empty to present derives exactly one encounter', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1002, x: 80, y: 92 }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.derivedLifeFacts.length, 1);
  assert.equal(result.derivedLifeFacts[0].type, 'ENCOUNTER');
  assert.equal(result.derivedLifeFacts[0].classification, 'DERIVED_LIFE_FACT');
  assert.equal(result.derivedLifeFacts[0].projection_source, 'persistent_agent_live_entity');
});

check('continuous presence does not duplicate an encounter', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousVisibleSet: [{ id: 1002 }],
    currentVisibleSet: [{ id: 1002 }],
  });
  assert.deepEqual(result.derivedLifeFacts, []);
  assert.deepEqual(result.continuedPresence.map((fact) => fact.counterpart_id), ['1002']);
});

check('present to absent derives a presence end', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousVisibleSet: [{ id: 1002 }],
    currentVisibleSet: [],
  });
  assert.deepEqual(result.presenceEnds.map((fact) => fact.type), ['ENCOUNTER_END']);
  assert.deepEqual(result.presenceEnds.map((fact) => fact.counterpart_id), ['1002']);
});

check('absence followed by return derives a new encounter', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousRevision: 12,
    currentRevision: 13,
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1002 }],
  });
  assert.equal(result.derivedLifeFacts.length, 1);
  assert.equal(result.derivedLifeFacts[0].counterpart_id, '1002');
});

check('two different characters enter independently', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1002 }, { id: 1003 }],
  });
  assert.deepEqual(result.derivedLifeFacts.map((fact) => fact.counterpart_id), ['1002', '1003']);
});

check('stale revision produces no false encounter', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    currentRevision: 10,
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1002 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'STALE_REVISION');
  assert.deepEqual(result.derivedLifeFacts, []);
});

check('map change produces no false encounter', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousMap: 'morocc',
    currentMap: 'pay_dun00',
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1002 }],
  });
  assert.equal(result.reason, 'MAP_CHANGED');
  assert.deepEqual(result.derivedLifeFacts, []);
});

check('self entity is excluded from social encounter derivation', () => {
  const result = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1001 }, { id: 1002 }],
  });
  assert.deepEqual(result.derivedLifeFacts.map((fact) => fact.counterpart_id), ['1002']);
});

check('derived encounter feeds Social Director shadow mode with default NONE', () => {
  const derived = deriveShadowEncounterTransitions({
    ...presenceArgs,
    previousVisibleSet: [],
    currentVisibleSet: [{ id: 1002 }],
  }).derivedLifeFacts[0];
  const context = {
    character_id: 1001,
    map: 'pay_dun00',
    macro_goal: 'HUNT',
    hunt_active: true,
    nearby_relevant_characters: [{ character_id: 1002 }],
    recent_encounters: [derived],
    revision: 11,
  };
  const shadow = createShadowIntent({
    context,
    actor: {
      id: '1001',
      macroGoal: 'HUNT',
      map: 'pay_dun00',
      hiddenGenesis: {
        socialInitiative: 0,
        strangerOpenness: 0,
        partyPreference: 0,
        riskTolerance: 0,
        rejectionSensitivity: 0,
        socialRewardSensitivity: 0,
      },
      recognition: new Map(),
    },
    encounterCharacterId: '1002',
  });
  assert.equal(shadow.mode, 'SHADOW');
  assert.equal(shadow.intent.decision, 'NONE');
});

check('derived encounter keeps the HUNT parent goal unchanged', () => {
  const context = {
    character_id: 1001,
    map: 'pay_dun00',
    macro_goal: 'HUNT',
    hunt_active: true,
    nearby_relevant_characters: [{ character_id: 1002 }],
    recent_encounters: [],
    revision: 11,
  };
  const shadow = createShadowIntent({ context, encounterCharacterId: '1002' });
  assert.equal(shadow.intent.parent_macro_goal, 'HUNT');
  assert.equal(shadow.intent.would_resume_hunt, true);
});

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} Persistent Life Social Sandbox V0 checks passed`);
if (failed.length) process.exitCode = 1;
