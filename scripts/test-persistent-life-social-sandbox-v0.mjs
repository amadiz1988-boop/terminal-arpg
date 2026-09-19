import assert from 'node:assert/strict';
import {
  SOCIAL_INTENTS,
  completeSocialInteraction,
  createSandbox,
  createSeededCharacters,
  encounter,
  reconcileDaily,
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

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} Persistent Life Social Sandbox V0 checks passed`);
if (failed.length) process.exitCode = 1;
