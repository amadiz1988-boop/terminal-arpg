#!/usr/bin/env node
// One lease-bound TEST_PLAYER setup. Gameplay still uses group-0 Player commands.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import yaml from 'js-yaml';
import { runtimeAdapter } from '../ops/ro-stack/deploy-native-candidate.mjs';
import { readJson } from '../ops/ro-stack/legacy-production-baseline.mjs';
import { git, verifyNativeStage } from '../ops/ro-stack/native-promotion-contract.mjs';
import { prepareHealthyRuntime } from './m1-test-player-level-fixture.mjs';

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NATIVE = 'C:\\Users\\Administrator\\source\\ghost-island-rathena';
const ROOT = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const OWNER = 'F｜M1 最終整合';
const LEASE = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a';
const NATIVE_SHA = '433a3323efb9eca5c4e0963b9528df6261a3cd76';
const WEB_SHA = '1346bd0561194da63de5132f9ea11ec820f703e7';
const CHAR = 150105, ACCOUNT = 2000163, LEVEL = 170, JOB = 4190;
const PROFILE = Object.freeze({ str: 80, agi: 90, vit: 90, int: 20, dex: 90, luk: 20 });
const ITEMS = Object.freeze([
  { id: 13438, aegis: 'Magical_Blade', slot: 'rightHand' },
  { id: 15185, aegis: 'Para_Team_Armor160', slot: 'armor' },
]);
const FIELDS = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'status_point'];
const EVIDENCE = path.join(ROOT, '.local/ro-stack/fixture-evidence',
  `m1-v15-combat-${CHAR}-${LEASE}-${NATIVE_SHA.slice(0, 12)}`);
const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) =>
  arg.startsWith('--') ? [[arg.slice(2), all[i + 1]]] : []));
const action = args.action ?? 'preflight';
const need = (condition, code) => { if (!condition) throw Error(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const snapshot = row => Object.fromEntries(FIELDS.map(key => [key, row[key]]));

export function statCost(value) {
  need(Number.isInteger(value) && value >= 1 && value <= 99, 'STAT_CAP_INVALID');
  let points = 0;
  for (let current = 1; current < value; current++)
    points += current < 100 ? 2 + Math.floor((current - 1) / 10)
      : 16 + 4 * Math.floor((current - 100) / 5);
  return points;
}

export function profileBudget(profile, total) {
  need(Number.isInteger(total) && total > 0, 'STAT_BUDGET_INVALID');
  const spent = Object.values(profile).reduce((sum, value) => sum + statCost(value), 0);
  need(spent <= total, 'STAT_BUDGET_EXCEEDED');
  return { total, spent, remaining: total - spent };
}

export function legalEquipRecord(item, expected) {
  const jobs = item?.Jobs;
  const jobAllowed = !jobs || jobs.SuperNovice === true ||
    (jobs.All === true && jobs.SuperNovice !== false);
  const classes = item?.Classes;
  const classAllowed = !classes || classes.All === true || classes.Normal === true;
  return item?.Id === expected.id && item.AegisName === expected.aegis &&
    ['Weapon', 'Armor'].includes(item.Type) && jobAllowed && classAllowed &&
    (item.EquipLevelMin ?? 0) <= LEVEL &&
    (!item.EquipLevelMax || item.EquipLevelMax >= LEVEL) &&
    item.Locations?.[expected.slot === 'rightHand' ? 'Right_Hand' : 'Armor'] === true &&
    !item.Flags?.Rental && !item.Flags?.GMOnly;
}

function sourceData() {
  need(git(NATIVE, 'rev-parse', 'HEAD') === NATIVE_SHA &&
    git(NATIVE, 'status', '--porcelain=v1', '--untracked-files=all') === '',
  'NATIVE_SOURCE_AUTHORITY_DRIFT');
  const statDb = yaml.load(fs.readFileSync(path.join(NATIVE, 'db/re/statpoint.yml'), 'utf8'));
  const total = statDb.Body.find(row => row.Level === LEVEL)?.Points;
  need(total === 3124, 'STATPOINT_SOURCE_DRIFT');
  const budget = profileBudget(PROFILE, total);
  const equipDb = yaml.load(fs.readFileSync(path.join(NATIVE, 'db/re/item_db_equip.yml'), 'utf8'),
    { json: true });
  const equipment = ITEMS.map(expected => {
    const item = equipDb.Body.find(row => row.Id === expected.id);
    need(legalEquipRecord(item, expected), `EQUIPMENT_SOURCE_INVALID_${expected.id}`);
    return { id: item.Id, aegis: item.AegisName, level: item.EquipLevelMin ?? 0,
      jobs: item.Jobs ?? { All: true }, locations: item.Locations,
      attack: item.Attack ?? 0, defense: item.Defense ?? 0 };
  });
  return { budget, equipment };
}

function governance() {
  need(git(SOURCE, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
    git(SOURCE, 'remote', 'get-url', 'origin') ===
      'https://github.com/amadiz1988-boop/terminal-arpg.git', 'FIXTURE_SOURCE_NOT_CLEAN');
  const sha = git(SOURCE, 'rev-parse', 'HEAD');
  const main = git(SOURCE, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
  need(sha === main, 'FIXTURE_GITHUB_MAIN_MISMATCH');
  const base = path.join(ROOT, '.local/ro-stack');
  const lease = readJson(path.join(base, 'production-deployment-lease/lease.json'));
  const state = readJson(path.join(base, 'production-deployment-state.json'));
  need(lease.lease_id === LEASE && lease.owner_task_id === OWNER && lease.status === 'ACTIVE' &&
    lease.native_deploy_git_sha === NATIVE_SHA && lease.web_deploy_git_sha === WEB_SHA &&
    state.production_drift === 'OPEN' &&
    state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' &&
    verifyNativeStage(ROOT, state, lease, lease.admission_manifest_sha256).pass === true,
  'FIXTURE_LEASE_OR_RUNTIME_BINDING_INVALID');
  return sha;
}

async function database() {
  const secret = readJson(path.join(ROOT, '.local/ro-stack/secrets.json'));
  need(typeof secret.databasePassword === 'string' && secret.databasePassword,
    'DATABASE_SECRET_UNAVAILABLE');
  return mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'rathena_local',
    password: secret.databasePassword, database: 'ragnarok', connectTimeout: 5000 });
}

async function readState(db) {
  const [[character]] = await db.execute(
    'SELECT char_id,account_id,`class`,base_level,job_level,str,agi,vit,`int`,dex,luk,status_point,hp,max_hp,sp,max_sp,last_map,save_map FROM `char` WHERE char_id=? AND account_id=? LIMIT 1',
    [CHAR, ACCOUNT]);
  const [[login]] = await db.execute('SELECT account_id,group_id FROM login WHERE account_id=?', [ACCOUNT]);
  const [[flag]] = await db.execute('SELECT account_id,is_test FROM web_account_flags WHERE account_id=?', [ACCOUNT]);
  const [[agent]] = await db.execute('SELECT agent_mode,control_owner,ownership_state,target_map,task_type,task_phase FROM persistent_agent_state WHERE char_id=?', [CHAR]);
  const [inventory] = await db.execute('SELECT * FROM inventory WHERE char_id=? ORDER BY id', [CHAR]);
  return { character, login, flag, agent, inventory };
}

function idleEligible(state) {
  return state.character?.char_id === CHAR && state.character.account_id === ACCOUNT &&
    state.character.class === JOB && state.character.base_level === LEVEL &&
    state.login?.group_id === 0 && state.flag?.is_test === 1 &&
    state.agent?.agent_mode === 'PERSISTENT_IDLE' &&
    state.agent.control_owner === 'SERVER_AGENT' &&
    state.agent.ownership_state === 'SERVER_AGENT' && !state.agent.target_map &&
    !state.agent.task_type && !state.agent.task_phase;
}

class Player {
  constructor(credentialsPath) { this.credentialsPath = credentialsPath; this.cookie = null; }
  async request(route, { method = 'GET', body } = {}) {
    const response = await fetch(`http://127.0.0.1:8788${route}`, {
      method, headers: { accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (response.headers.get('set-cookie'))
      this.cookie = response.headers.get('set-cookie').split(';')[0];
    need(response.ok, `PLAYER_HTTP_${response.status}_${data?.error ?? 'UNKNOWN'}`);
    return data;
  }
  async login() {
    need(this.credentialsPath && fs.existsSync(this.credentialsPath), 'PLAYER_CREDENTIALS_REQUIRED');
    const credentials = readJson(this.credentialsPath);
    await this.request('/api/account', { method: 'POST', body: {
      username: credentials.username, password: credentials.password } });
    need(this.cookie, 'PLAYER_SESSION_REQUIRED');
  }
  state() { return this.request('/api/state?view=full'); }
  async equip(itemId, action, expectedEquipped) {
    const before = await this.state();
    const item = before.inventory?.find(row => Number(row.itemId) === itemId);
    need(item && Number.isInteger(item.inventoryIndex), `ITEM_NOT_VISIBLE_${itemId}`);
    if (Boolean(item.equipped) === expectedEquipped) return { already: true };
    const submitted = await this.request('/api/item-action', { method: 'POST', body: {
      action, inventoryIndex: item.inventoryIndex,
      inventoryGeneration: item.inventoryGeneration } });
    const commandId = submitted.command?.commandId ?? submitted.commandId;
    need(commandId, `EQUIP_COMMAND_NOT_CREATED_${itemId}`);
    for (let i = 0; i < 30; i++) {
      await delay(500);
      const command = await this.request(`/api/ro/agents/${CHAR}/ownership/commands/${commandId}`);
      const status = command.command?.status ?? command.status;
      if (['REJECTED', 'FAILED', 'ERROR'].includes(status))
        throw Error(`EQUIP_NATIVE_${itemId}_${command.command?.reasonCode ?? status}`);
      const live = await this.state();
      const row = live.inventory?.find(entry => Number(entry.itemId) === itemId);
      if (status === 'CONFIRMED' && Boolean(row?.equipped) === expectedEquipped)
        return { commandId, status, equipped: expectedEquipped };
    }
    throw Error(`EQUIP_TIMEOUT_${itemId}`);
  }
}

async function stageOffline(db, offline) {
  const ids = [];
  await db.beginTransaction();
  try {
    const [[current]] = await db.execute(
      'SELECT `class`,base_level,str,agi,vit,`int`,dex,luk,status_point FROM `char` WHERE char_id=? AND account_id=? FOR UPDATE',
      [CHAR, ACCOUNT]);
    need(current.class === JOB && current.base_level === LEVEL &&
      same(snapshot(current), snapshot(offline.character)), 'COMBAT_FIXTURE_STAT_CAS_FAILED');
    for (const item of ITEMS) {
      const [inserted] = await db.execute(
        'INSERT INTO inventory (char_id,nameid,amount,equip,identify,refine) VALUES (?,?,1,0,1,0)',
        [CHAR, item.id]);
      ids.push({ id: inserted.insertId, nameid: item.id });
    }
    const budget = profileBudget(PROFILE, 3124);
    const [updated] = await db.execute(
      'UPDATE `char` SET str=?,agi=?,vit=?,`int`=?,dex=?,luk=?,status_point=? WHERE char_id=? AND account_id=? AND `class`=? AND base_level=? AND str=? AND agi=? AND vit=? AND `int`=? AND dex=? AND luk=? AND status_point=?',
      [PROFILE.str, PROFILE.agi, PROFILE.vit, PROFILE.int, PROFILE.dex, PROFILE.luk,
        budget.remaining, CHAR, ACCOUNT, JOB, LEVEL, ...FIELDS.map(key => offline.character[key])]);
    need(updated.affectedRows === 1, 'COMBAT_FIXTURE_STAT_UPDATE_FAILED');
    await db.commit();
    return ids;
  } catch (error) { await db.rollback(); throw error; }
}

async function restoreOffline(db, offline, staged, offlineEquipped = false) {
  await db.beginTransaction();
  try {
    const [[current]] = await db.execute(
      'SELECT `class`,base_level,str,agi,vit,`int`,dex,luk,status_point FROM `char` WHERE char_id=? AND account_id=? FOR UPDATE',
      [CHAR, ACCOUNT]);
    const expected = { ...PROFILE, status_point: profileBudget(PROFILE, 3124).remaining };
    need(current.class === JOB && current.base_level === LEVEL &&
      same(snapshot(current), snapshot(expected)), 'COMBAT_FIXTURE_RESTORE_STAT_DRIFT');
    for (const item of staged.ids) {
      const [[row]] = await db.execute('SELECT * FROM inventory WHERE id=? AND char_id=? FOR UPDATE',
        [item.id, CHAR]);
      const expectedMask = offlineEquipped ? (item.nameid === 13438 ? 2 : 16) : 0;
      need(row?.nameid === item.nameid && row.amount === 1 && row.equip === expectedMask &&
        row.refine === 0 && row.identify === 1 &&
        [row.card0, row.card1, row.card2, row.card3, row.enchantgrade].every(v => v === 0) &&
        ['option_id0', 'option_id1', 'option_id2', 'option_id3', 'option_id4']
          .every(key => row[key] === 0),
      `COMBAT_FIXTURE_ITEM_RESTORE_DRIFT_${item.id}`);
      const [deleted] = await db.execute('DELETE FROM inventory WHERE id=? AND char_id=? AND nameid=? AND equip=?',
        [item.id, CHAR, item.nameid, expectedMask]);
      need(deleted.affectedRows === 1, `COMBAT_FIXTURE_ITEM_RESTORE_FAILED_${item.id}`);
    }
    if (offlineEquipped) {
      for (const original of offline.inventory.filter(row => row.equip !== 0)) {
        const [[row]] = await db.execute('SELECT nameid,equip FROM inventory WHERE id=? AND char_id=? FOR UPDATE',
          [original.id, CHAR]);
        need(row?.nameid === original.nameid && row.equip === 0,
          `COMBAT_FIXTURE_ORIGINAL_EQUIP_DRIFT_${original.id}`);
        const [updated] = await db.execute('UPDATE inventory SET equip=? WHERE id=? AND char_id=? AND equip=0',
          [original.equip, original.id, CHAR]);
        need(updated.affectedRows === 1, `COMBAT_FIXTURE_ORIGINAL_EQUIP_RESTORE_FAILED_${original.id}`);
      }
    }
    const [updated] = await db.execute(
      'UPDATE `char` SET str=?,agi=?,vit=?,`int`=?,dex=?,luk=?,status_point=? WHERE char_id=? AND account_id=? AND `class`=? AND base_level=? AND str=? AND agi=? AND vit=? AND `int`=? AND dex=? AND luk=? AND status_point=?',
      [...FIELDS.map(key => offline.character[key]), CHAR, ACCOUNT, JOB, LEVEL,
        ...FIELDS.map(key => expected[key])]);
    need(updated.affectedRows === 1, 'COMBAT_FIXTURE_STAT_RESTORE_FAILED');
    await db.commit();
  } catch (error) { await db.rollback(); throw error; }
}

async function completeOnlinePreparation(player, adapter, beforeRuntime, canonical, sourceSha) {
  let afterRuntime;
  for (let i = 0; i < 20; i++) {
    afterRuntime = await adapter('snapshot');
    if (afterRuntime.pass &&
      afterRuntime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES') break;
    await delay(500);
  }
  need(afterRuntime?.pass &&
    afterRuntime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES',
  'COMBAT_FIXTURE_RUNTIME_RELOAD_FAILED');
  let loaded;
  for (let i = 0; i < 20; i++) {
    loaded = await player.state();
    if (FIELDS.slice(0, 6).every(key => loaded.character?.[key] === PROFILE[key]) &&
      loaded.character?.statusPoint === canonical.budget.remaining &&
      ITEMS.every(item => loaded.inventory?.some(row => Number(row.itemId) === item.id))) break;
    await delay(500);
  }
  need(FIELDS.slice(0, 6).every(key => loaded.character?.[key] === PROFILE[key]) &&
    loaded.character.statusPoint === canonical.budget.remaining &&
    ITEMS.every(item => loaded.inventory?.some(row => Number(row.itemId) === item.id)),
  'COMBAT_FIXTURE_AUTHORITATIVE_LOAD_FAILED');
  const equipped = [];
  for (const item of ITEMS) equipped.push({ id: item.id,
    ...await player.equip(item.id, 'equip', true) });
  const health = await prepareHealthyRuntime(args.credentials);
  const ready = await player.state();
  need(ITEMS.every(item => ready.equipment?.some(row =>
    Number(row.itemId) === item.id && row.slot === item.slot && row.refine === 0)) &&
    ready.character.hp === ready.character.maxHp &&
    ready.character.sp === ready.character.maxSp &&
    ready.questJournal?.ownership?.agentMode === 'PERSISTENT_IDLE',
  'COMBAT_FIXTURE_AUTHORITATIVE_EQUIP_FAILED');
  const receipt = { profile: PROFILE, budget: canonical.budget,
    equipment: canonical.equipment, equipped, health,
    groupId: 0, isTest: 1, sourceSha, nativeSha: NATIVE_SHA,
    runtimeBefore: beforeRuntime.pids, runtimeAfter: afterRuntime.pids,
    preparedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(EVIDENCE, 'prepared.json'),
    JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ prepared: true, evidenceDir: EVIDENCE,
    profile: PROFILE, budget: canonical.budget, equipment: canonical.equipment,
    hp: health.hp, maxHp: health.maxHp, sp: health.sp, maxSp: health.maxSp }));
}

async function main() {
  need(['preflight', 'prepare', 'resume', 'equip-offline', 'confirm-offline', 'restore'].includes(action),
    'INVALID_FIXTURE_ACTION');
  const sourceSha = governance();
  const canonical = sourceData();
  const adapter = runtimeAdapter(ROOT, OWNER, LEASE);
  const beforeRuntime = await adapter('snapshot');
  need(beforeRuntime.pass && beforeRuntime.openkore_runtime_count === 0 &&
    beforeRuntime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES',
  'FIXTURE_RUNTIME_UNHEALTHY');
  const db = await database();
  try {
    const current = await readState(db);
    need(idleEligible(current), 'COMBAT_FIXTURE_IDENTITY_OR_IDLE_INVALID');
    const player = new Player(args.credentials);
    await player.login();
    const live = await player.state();
    need(live.character?.charId === CHAR && live.character.liveFresh === true &&
      live.character.baseLevel === LEVEL && live.character.classId === JOB,
    'COMBAT_FIXTURE_PLAYER_PRECONDITION_INVALID');
    if (action === 'preflight') {
      need(FIELDS.slice(0, 6).every(key => current.character[key] === 1) &&
        current.character.status_point === 68 &&
        ITEMS.every(item => !current.inventory.some(row => row.nameid === item.id)) &&
        !fs.existsSync(EVIDENCE), 'COMBAT_FIXTURE_PREIMAGE_INVALID');
      console.log(JSON.stringify({ eligible: true, mutation: false, sourceSha,
        charId: CHAR, groupId: 0, isTest: 1, profile: PROFILE, ...canonical }));
      return;
    }
    need(args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
    if (action === 'resume') {
      need(fs.existsSync(path.join(EVIDENCE, 'staged.json')) &&
        fs.existsSync(path.join(EVIDENCE, 'failure.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'prepared.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'restored.json')), 'COMBAT_FIXTURE_RESUME_RECORD_INVALID');
      const staged = readJson(path.join(EVIDENCE, 'staged.json'));
      const offline = readJson(path.join(EVIDENCE, 'offline-preimage.json'));
      const failure = readJson(path.join(EVIDENCE, 'failure.json'));
      need(failure.reason === 'COMBAT_FIXTURE_RUNTIME_RELOAD_FAILED' &&
        staged.sourceSha === readJson(path.join(EVIDENCE, 'preimage.json')).sourceSha,
      'COMBAT_FIXTURE_RESUME_PROVENANCE_INVALID');
      const expected = { ...PROFILE, status_point: canonical.budget.remaining };
      need(same(snapshot(current.character), snapshot(expected)) &&
        staged.ids.length === ITEMS.length && staged.ids.every((entry, i) =>
          entry.nameid === ITEMS[i].id && current.inventory.some(row =>
            row.id === entry.id && row.nameid === entry.nameid && row.equip === 0 &&
            row.amount === 1 && row.refine === 0 && row.identify === 1)) &&
        offline.character.char_id === CHAR && idleEligible(offline),
      'COMBAT_FIXTURE_RESUME_STATE_DRIFT');
      await completeOnlinePreparation(player, adapter, beforeRuntime, canonical, sourceSha);
      return;
    }
    if (action === 'confirm-offline') {
      need(fs.existsSync(path.join(EVIDENCE, 'equipped-offline.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'prepared.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'restored.json')),
      'COMBAT_FIXTURE_OFFLINE_CONFIRM_RECORD_INVALID');
      const staged = readJson(path.join(EVIDENCE, 'staged.json'));
      const offline = readJson(path.join(EVIDENCE, 'offline-preimage.json'));
      const receipt = readJson(path.join(EVIDENCE, 'equipped-offline.json'));
      need(same(snapshot(current.character), snapshot({ ...PROFILE,
        status_point: canonical.budget.remaining })) &&
        staged.ids.length === 2 && staged.ids.every((entry, i) =>
          current.inventory.some(row => row.id === entry.id && row.nameid === entry.nameid &&
            row.equip === (i === 0 ? 2 : 16) && row.amount === 1 && row.refine === 0 &&
            row.identify === 1)) &&
        offline.inventory.filter(row => row.equip !== 0).every(original =>
          current.inventory.some(row => row.id === original.id && row.nameid === original.nameid &&
            row.equip === 0)) &&
        receipt.staged.length === 2 &&
        receipt.staged.every((row, i) => row.id === staged.ids[i].id &&
          row.nameid === staged.ids[i].nameid && row.equip === (i === 0 ? 2 : 16)),
      'COMBAT_FIXTURE_OFFLINE_CONFIRM_STATE_DRIFT');
      const inventoryEquipped = state => state.character?.liveFresh === true &&
        ITEMS.every((item, i) => state.inventory?.some(row =>
          Number(row.itemId) === item.id && row.equipped === true &&
          row.equipMask === (i === 0 ? 2 : 16) && row.refine === 0));
      need(inventoryEquipped(live), 'COMBAT_FIXTURE_OFFLINE_CONFIRM_NATIVE_MASK_MISSING');
      const health = await prepareHealthyRuntime(args.credentials);
      const ready = await player.state();
      need(inventoryEquipped(ready) &&
        ready.character.hp === ready.character.maxHp &&
        ready.character.sp === ready.character.maxSp &&
        ready.questJournal?.ownership?.agentMode === 'PERSISTENT_IDLE',
      'COMBAT_FIXTURE_OFFLINE_CONFIRM_HEALTH_FAILED');
      fs.writeFileSync(path.join(EVIDENCE, 'prepared.json'), JSON.stringify({
        method: 'TEST_ONLY_OFFLINE_EQUIP', profile: PROFILE, budget: canonical.budget,
        equipment: canonical.equipment, health, sourceSha, nativeSha: NATIVE_SHA,
        runtime: beforeRuntime.pids, maxHpAfter: ready.character.maxHp,
        maxSpAfter: ready.character.maxSp,
        webEquipmentProjectionGap: ready.equipment?.length === 0,
        preparedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
      console.log(JSON.stringify({ prepared: true, method: 'TEST_ONLY_OFFLINE_EQUIP',
        evidenceDir: EVIDENCE, hp: ready.character.hp, maxHp: ready.character.maxHp,
        sp: ready.character.sp, maxSp: ready.character.maxSp,
        webEquipmentProjectionGap: ready.equipment?.length === 0 }));
      return;
    }
    if (action === 'equip-offline') {
      need(fs.existsSync(path.join(EVIDENCE, 'staged.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'prepared.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'equipped-offline.json')) &&
        !fs.existsSync(path.join(EVIDENCE, 'restored.json')),
      'COMBAT_FIXTURE_OFFLINE_EQUIP_RECORD_INVALID');
      const staged = readJson(path.join(EVIDENCE, 'staged.json'));
      const offline = readJson(path.join(EVIDENCE, 'offline-preimage.json'));
      const original = offline.inventory.filter(row => row.equip !== 0);
      need(same(snapshot(current.character), snapshot({ ...PROFILE,
        status_point: canonical.budget.remaining })) &&
        staged.ids.length === 2 && staged.ids.every((entry, i) =>
          entry.nameid === ITEMS[i].id && current.inventory.some(row =>
            row.id === entry.id && row.nameid === entry.nameid && row.equip === 0 &&
            row.amount === 1 && row.refine === 0 && row.identify === 1)) &&
        original.length === 2 && original.some(row => row.nameid === 1201 && row.equip === 2) &&
        original.some(row => row.nameid === 2301 && row.equip === 16) &&
        original.every(row => current.inventory.some(value =>
          value.id === row.id && value.nameid === row.nameid && value.equip === row.equip)),
      'COMBAT_FIXTURE_OFFLINE_EQUIP_PRECONDITION_INVALID');
      let stopped = false;
      try {
        await adapter('stop'); stopped = true;
        await db.beginTransaction();
        try {
          for (const row of original) {
            const [changed] = await db.execute(
              'UPDATE inventory SET equip=0 WHERE id=? AND char_id=? AND nameid=? AND equip=?',
              [row.id, CHAR, row.nameid, row.equip]);
            need(changed.affectedRows === 1, `COMBAT_FIXTURE_ORIGINAL_UNEQUIP_FAILED_${row.id}`);
          }
          for (let i = 0; i < staged.ids.length; i++) {
            const row = staged.ids[i], mask = i === 0 ? 2 : 16;
            const [changed] = await db.execute(
              'UPDATE inventory SET equip=? WHERE id=? AND char_id=? AND nameid=? AND equip=0 AND amount=1 AND refine=0 AND identify=1',
              [mask, row.id, CHAR, row.nameid]);
            need(changed.affectedRows === 1, `COMBAT_FIXTURE_TEST_EQUIP_FAILED_${row.id}`);
          }
          await db.commit();
        } catch (error) { await db.rollback(); throw error; }
        fs.writeFileSync(path.join(EVIDENCE, 'equipped-offline.json'), JSON.stringify({
          sourceSha, original: original.map(row => ({ id: row.id, nameid: row.nameid, equip: row.equip })),
          staged: staged.ids.map((row, i) => ({ ...row, equip: i === 0 ? 2 : 16 })),
          at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
        await adapter('start'); stopped = false;
      } finally { if (stopped) await adapter('start'); }
      let afterRuntime;
      for (let i = 0; i < 20; i++) {
        afterRuntime = await adapter('snapshot');
        if (afterRuntime.pass &&
          afterRuntime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES') break;
        await delay(500);
      }
      need(afterRuntime?.pass &&
        afterRuntime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES',
      'COMBAT_FIXTURE_OFFLINE_EQUIP_RUNTIME_FAILED');
      let loaded;
      for (let i = 0; i < 20; i++) {
        loaded = await player.state();
        if (ITEMS.every((item, i) => loaded.inventory?.some(row =>
          Number(row.itemId) === item.id && row.equipped === true &&
          row.equipMask === (i === 0 ? 2 : 16) && row.refine === 0)) &&
          loaded.character?.maxHp > live.character.maxHp) break;
        await delay(500);
      }
      need(ITEMS.every((item, i) => loaded.inventory?.some(row =>
        Number(row.itemId) === item.id && row.equipped === true &&
        row.equipMask === (i === 0 ? 2 : 16) && row.refine === 0)) &&
        loaded.character?.maxHp > live.character.maxHp,
      'COMBAT_FIXTURE_OFFLINE_EQUIP_AUTHORITY_FAILED');
      const health = await prepareHealthyRuntime(args.credentials);
      const ready = await player.state();
      need(ready.character?.hp === ready.character?.maxHp &&
        ready.character?.sp === ready.character?.maxSp &&
        ready.questJournal?.ownership?.agentMode === 'PERSISTENT_IDLE',
      'COMBAT_FIXTURE_OFFLINE_EQUIP_HEALTH_FAILED');
      fs.writeFileSync(path.join(EVIDENCE, 'prepared.json'), JSON.stringify({
        method: 'TEST_ONLY_OFFLINE_EQUIP', profile: PROFILE, budget: canonical.budget,
        equipment: canonical.equipment, health, sourceSha, nativeSha: NATIVE_SHA,
        runtimeBefore: beforeRuntime.pids, runtimeAfter: afterRuntime.pids,
        maxHpBefore: live.character.maxHp, maxHpAfter: ready.character.maxHp,
        preparedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
      console.log(JSON.stringify({ prepared: true, method: 'TEST_ONLY_OFFLINE_EQUIP',
        evidenceDir: EVIDENCE, hp: ready.character.hp, maxHp: ready.character.maxHp,
        sp: ready.character.sp, maxSp: ready.character.maxSp }));
      return;
    }
    if (action === 'prepare') {
      need(FIELDS.slice(0, 6).every(key => current.character[key] === 1) &&
        current.character.status_point === 68 &&
        ITEMS.every(item => !current.inventory.some(row => row.nameid === item.id)) &&
        !fs.existsSync(EVIDENCE), 'COMBAT_FIXTURE_PREIMAGE_INVALID');
      fs.mkdirSync(EVIDENCE, { recursive: true });
      fs.writeFileSync(path.join(EVIDENCE, 'preimage.json'), JSON.stringify({
        sourceSha, nativeSha: NATIVE_SHA, leaseId: LEASE, current,
        runtime: beforeRuntime, capturedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
      let stopped = false;
      try {
        await adapter('stop'); stopped = true;
        const offline = await readState(db);
        need(idleEligible(offline) &&
          same(snapshot(offline.character), snapshot(current.character)) &&
          same(offline.inventory, current.inventory), 'COMBAT_FIXTURE_OFFLINE_PREIMAGE_DRIFT');
        fs.writeFileSync(path.join(EVIDENCE, 'offline-preimage.json'),
          JSON.stringify(offline, null, 2) + '\n', { flag: 'wx' });
        const ids = await stageOffline(db, offline);
        fs.writeFileSync(path.join(EVIDENCE, 'staged.json'), JSON.stringify({
          ids, profile: PROFILE, budget: canonical.budget, sourceSha,
          stagedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
        await adapter('start'); stopped = false;
        await completeOnlinePreparation(player, adapter, beforeRuntime, canonical, sourceSha);
      } catch (error) {
        if (stopped) await adapter('start');
        fs.writeFileSync(path.join(EVIDENCE, 'failure.json'), JSON.stringify({
          reason: error.message, at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
        throw error;
      }
      return;
    }
    need(fs.existsSync(path.join(EVIDENCE, 'staged.json')) &&
      !fs.existsSync(path.join(EVIDENCE, 'restored.json')), 'COMBAT_FIXTURE_RESTORE_RECORD_INVALID');
    const staged = readJson(path.join(EVIDENCE, 'staged.json'));
    const offline = readJson(path.join(EVIDENCE, 'offline-preimage.json'));
    const offlineEquipped = fs.existsSync(path.join(EVIDENCE, 'equipped-offline.json'));
    if (!offlineEquipped) {
      for (const item of ITEMS) await player.equip(item.id, 'unequip', false);
      for (const row of offline.inventory.filter(entry => entry.equip !== 0))
        await player.equip(row.nameid, 'equip', true);
    }
    let stopped = false;
    try {
      await adapter('stop'); stopped = true;
      await restoreOffline(db, offline, staged, offlineEquipped);
      await adapter('start'); stopped = false;
    } finally { if (stopped) await adapter('start'); }
    const restored = await readState(db);
    need(same(snapshot(restored.character), snapshot(offline.character)) &&
      staged.ids.every(item => !restored.inventory.some(row => row.id === item.id)) &&
      offline.inventory.filter(row => row.equip !== 0).every(row =>
        restored.inventory.some(value => value.id === row.id && value.equip === row.equip)),
    'COMBAT_FIXTURE_RESTORE_UNCONFIRMED');
    fs.writeFileSync(path.join(EVIDENCE, 'restored.json'), JSON.stringify({
      restoredAt: new Date().toISOString(), profileRemoved: true,
      itemsRemoved: staged.ids, sourceSha }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ restored: true, evidenceDir: EVIDENCE }));
  } finally { await db.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
