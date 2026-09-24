import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { defaultCanonicalConfig, defaultConfigRow } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { loadCanonicalConfig } from '../ops/ro-stack/dashboard/config-storage.mjs';
import { resolveFarmExecutionProfile } from '../ops/ro-stack/dashboard/farm-execution-profile.mjs';

const source = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const buildStart = source.indexOf('async function buildCanonicalFarmRules(');
const buildEnd = source.indexOf('async function nativeSupplyServicePlan(', buildStart);
const queueStart = source.indexOf('async function queueOwnershipCommand(');
const queueEnd = source.indexOf('// P2I canonical job-commit transport.', queueStart);
assert.ok(buildStart >= 0 && buildEnd > buildStart && queueStart >= 0 && queueEnd > queueStart);
assert.match(source.slice(queueEnd), /return json\(response, 202, \{\s*command: await queueOwnershipCommand\(account, charId, body\)/);

const root = await mkdtemp(join(tmpdir(), 'hybrid-start-farm-'));
const account = { accountId: 2000139, characterId: 150095 };
const configPath = join(root, 'player_2000139', 'config', 'character_150095.json');
const body = { action: 'start_farm', expectedRevision: 41, targetMap: 'pay_fild07',
  lootEnabled: true, survivalEnabled: true, deathRecoveryEnabled: true };
let inserted;
let storedHash;
let queuedPayload;
class HttpError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}
const context = {
  instancesRoot: root, loadCanonicalConfig, resolveFarmExecutionProfile,
  nativeSupplyPolicyCommandEnabled: false,
  readCharacterSavePoint: async () => null, SUPPLY_TOWN_SERVICES: {},
  HttpError, ownershipActions: new Set(['start_farm']), rolloutGatedActions: new Set(['start_farm']),
  readPersistentAgentRollout: async () => ({ allowed: true }), recordRolloutEvent: async () => {},
  sql: async (query) => {
    if (query.startsWith('INSERT IGNORE')) {
      inserted = query;
      storedHash = query.match(/,'([0-9a-f]{64})',41,'QUEUED'/)?.[1];
      assert.ok(storedHash, 'queued command has a payload hash');
      return '';
    }
    if (query.startsWith('SELECT payload_hash')) return storedHash;
    throw new Error(`unexpected SQL: ${query.slice(0, 40)}`);
  },
  getOwnershipCommand: async (_account, _charId, commandId) => ({
    action: 'start_farm', expectedRevision: 41, commandId, commandStatus: 'QUEUED',
  }),
  createHash, randomUUID, commandIdPattern: /^[0-9a-f-]{36}$/,
  escapeSql: (value) => value,
};
const buildFarmRules = runInNewContext(`(${source.slice(buildStart, buildEnd)})`, context);
context.buildCanonicalFarmRules = async (...args) => {
  queuedPayload = await buildFarmRules(...args);
  return queuedPayload;
};
const queue = runInNewContext(`(${source.slice(queueStart, queueEnd)})`, context);

async function start(config, overrides = {}) {
  await mkdir(join(root, 'player_2000139', 'config'), { recursive: true });
  await writeFile(configPath, JSON.stringify(config));
  inserted = undefined;
  storedHash = undefined;
  queuedPayload = undefined;
  const commandId = randomUUID();
  const request = { ...body, ...overrides, commandId };
  const command = await queue(account, account.characterId, request);
  assert.ok(inserted, 'command row created');
  assert.equal(command.commandStatus, 'QUEUED');
  return queuedPayload;
}

async function rejects(config, overrides, status, reason) {
  await mkdir(join(root, 'player_2000139', 'config'), { recursive: true });
  await writeFile(configPath, JSON.stringify(config));
  inserted = undefined;
  await assert.rejects(queue(account, account.characterId, { ...body, ...overrides }),
    (error) => error.statusCode === status && error.message === reason);
  assert.equal(inserted, undefined, 'rejected command is not inserted');
}

try {
  const normal = defaultCanonicalConfig();
  const normalPayload = await start(normal);
  assert.equal(normalPayload.skillEnabled, false);
  assert.equal(normalPayload.skillId, 0);
  assert.equal(normalPayload.attackUseWeapon, true);
  const disabled = defaultConfigRow('attackSkill');
  disabled.skill = '5';
  disabled.disabled = true;
  normal.combat.skills.attackSlots = [disabled];
  const disabledPayload = await start(normal);
  assert.equal(disabledPayload.skillEnabled, false);
  assert.equal('attackSkillSlots' in disabledPayload, false);

  const skill = defaultConfigRow('attackSkill');
  skill.skill = '5';
  const cast = defaultCanonicalConfig();
  cast.combat.profile = 'SKILL_CAST';
  cast.combat.attack.useWeapon = false;
  cast.combat.skills.attackSlots = [skill];
  assert.equal((await start(cast)).skillEnabled, true);
  cast.combat.skills.attackSlots = [];
  await rejects(cast, {}, 422, 'invalid_transition');

  const hybrid = defaultCanonicalConfig();
  hybrid.combat.profile = 'HYBRID_DAMAGE';
  hybrid.combat.skills.attackSlots = [skill];
  const hybridPayload = await start(hybrid);
  assert.equal(hybridPayload.skillEnabled, true);
  assert.equal(hybridPayload.skillId, 5);
  assert.equal(hybridPayload.attackUseWeapon, true);
  assert.deepEqual(Object.keys(hybridPayload).sort(), [
    'targetMap', 'lootEnabled', 'skillEnabled', 'skillId', 'survivalEnabled',
    'deathRecoveryEnabled', 'combatProfile', 'attackMode', 'attackUseWeapon',
    'huntRelocationEnabled', 'attackSkillSlots',
  ].sort());
  await rejects(hybrid, { skillEnabled: false }, 409, 'PROFILE_HYBRID_REQUIRES_BOTH');
  assert.equal((await start(hybrid, { skillEnabled: true })).skillEnabled, true);
  hybrid.combat.skills.attackSlots = [];
  await rejects(hybrid, {}, 422, 'invalid_transition');
  hybrid.combat.skills.attackSlots = [skill];
  hybrid.combat.attack.useWeapon = false;
  await rejects(hybrid, {}, 409, 'PROFILE_HYBRID_REQUIRES_BOTH');

  await rm(join(root, 'player_2000139', 'config'), { recursive: true });
  const control = join(root, 'player_2000139', 'control');
  await mkdir(control, { recursive: true });
  await writeFile(join(control, 'config.txt'), [
    'attackAuto 2', 'attackUseWeapon 1', 'attackSkillSlot SM_BASH {', 'lvl 10', '}',
    'useSelf_item 501 {', 'hp < 50%', '}',
  ].join('\n'));
  await writeFile(join(control, 'items_control.txt'), [
    'all 0 1 0', '501 0 0 0', '601 30000 0 0', '602 30000 0 0',
    ...Array.from({ length: 1662 }, (_, index) => `${2000 + index} 0 0 1`),
  ].join('\n'));
  const before = await loadCanonicalConfig({ instancesRoot: root,
    accountId: account.accountId, characterId: account.characterId, persistMigration: false });
  assert.equal(before.source, 'migrated');
  assert.equal(before.config.combat.profile, 'HYBRID_DAMAGE');
  assert.equal(before.config.combat.skills.attackSlots[0].skill, '5');
  assert.equal(before.config.supply.itemRules.length, 4);
  assert.equal(before.migration.retained.blocks.find((row) => row.kind === 'attackSkillSlot').name, 'SM_BASH');
  inserted = undefined;
  queuedPayload = undefined;
  const command = await queue(account, account.characterId, body);
  const migratedPayload = queuedPayload;
  assert.equal(command.commandStatus, 'QUEUED');
  assert.ok(inserted, 'migrated fixture creates command');
  assert.equal(migratedPayload.skillEnabled, true);
  assert.equal(migratedPayload.skillId, 5);
  assert.equal(migratedPayload.combatProfile, 'HYBRID_DAMAGE');
  await assert.rejects(stat(configPath), { code: 'ENOENT' });

  const unknown = (await readFile(join(control, 'config.txt'), 'utf8'))
    .replace('SM_BASH', 'UNKNOWN_ATTACK_SKILL');
  await writeFile(join(control, 'config.txt'), unknown);
  const unresolved = await loadCanonicalConfig({ instancesRoot: root,
    accountId: account.accountId, characterId: account.characterId, persistMigration: false });
  assert.equal(unresolved.config.combat.skills.attackSlots[0].skill, 'UNKNOWN_ATTACK_SKILL');
  inserted = undefined;
  await assert.rejects(queue(account, account.characterId, body),
    (error) => error.statusCode === 409 && error.message === 'ATTACK_SKILL_ID_UNSUPPORTED');
  assert.equal(inserted, undefined);
  console.log('START_FARM_HYBRID_SKILL_DEFAULT_PASS cases=11 command=QUEUED http_source=202 config_write=0');
} finally {
  await rm(root, { recursive: true, force: true });
}
