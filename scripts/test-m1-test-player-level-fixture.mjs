import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateLevelFixtureIdentity, levelFixtureUpdate,
  rollbackLevelFixture, fullHealthConfirmed } from './m1-test-player-level-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preimage = JSON.parse(fs.readFileSync(path.join(root,
  'docs/project-control/m1-v15-test-player-level-preimage.json'), 'utf8'));
const current = () => ({
  character: { char_id: preimage.charId, account_id: preimage.accountId,
    ...structuredClone(preimage.character) },
  login: { account_id: preimage.accountId, group_id: 0 },
  flag: { account_id: preimage.accountId, is_test: 1 },
  agent: structuredClone(preimage.persistentAgent)
});

test('valid scoped idle test-player fixture and real EXP prerequisite', () => {
  assert.equal(validateLevelFixtureIdentity(current(), preimage), true);
  assert.deepEqual(levelFixtureUpdate(preimage), { class: 4190, base_level: 170, base_exp: 0 });
});

test('legal gameplay progress uses a fresh exact level preimage', () => {
  const advanced = current();
  advanced.character.base_level = 7;
  advanced.character.base_exp = 12;
  advanced.character.save_map = 'prt_fild05';
  assert.equal(validateLevelFixtureIdentity(advanced, preimage,
    { matchHistoricalCharacter: false }), true);
  assert.deepEqual(levelFixtureUpdate({ character: advanced.character }),
    { class: 4190, base_level: 170, base_exp: 0 });
  assert.throws(() => validateLevelFixtureIdentity(advanced, preimage));
  advanced.login.group_id = 99;
  assert.throws(() => validateLevelFixtureIdentity(advanced, preimage,
    { matchHistoricalCharacter: false }));
});

for (const [label, mutate] of [
  ['wrong character', value => { value.character.char_id = 150094; }],
  ['privileged group', value => { value.login.group_id = 99; }],
  ['non-test account', value => { value.flag.is_test = 0; }],
  ['active automation', value => { value.agent.agent_mode = 'AUTO_FARM'; }],
  ['character drift', value => { value.character.base_exp++; }]
]) test(`reject ${label}`, () => {
  const value = current(); mutate(value);
  assert.throws(() => validateLevelFixtureIdentity(value, preimage));
});

test('reject missing representative EXP gain', () => {
  const altered = structuredClone(preimage);
  altered.representativeEvidence.baseExpAfter = altered.representativeEvidence.baseExpBefore;
  assert.throws(() => validateLevelFixtureIdentity(current(), altered));
});

test('restore uses exact offline level preimage and current EXP compare-and-swap', () => {
  assert.deepEqual(rollbackLevelFixture(
    { class: 4190, base_level: 170, base_exp: 141 },
    { class: 0, base_level: 6, base_exp: 2664 }),
  { expected: { class: 4190, base_level: 170, base_exp: 141 },
    values: { class: 0, base_level: 6, base_exp: 2664 } });
  assert.throws(() => rollbackLevelFixture(
    { class: 4190, base_level: 169, base_exp: 0 }, preimage.character));
});

test('healthy prerequisite requires fresh authoritative full HP and SP', () => {
  const live = { charId: 150105, liveFresh: true,
    hp: 4982, maxHp: 4982, sp: 173, maxSp: 173 };
  assert.equal(fullHealthConfirmed(live), true);
  for (const change of [
    { charId: 150094 }, { liveFresh: false }, { hp: 4981 },
    { sp: 172 }, { maxHp: 0 }, { maxSp: 0 }, { hp: null },
  ]) assert.equal(fullHealthConfirmed({ ...live, ...change }), false);
});
