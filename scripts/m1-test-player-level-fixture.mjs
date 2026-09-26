#!/usr/bin/env node
// One lease-bound, test-only prerequisite. No Player endpoint or gameplay rule changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { runtimeAdapter } from '../ops/ro-stack/deploy-native-candidate.mjs';
import { digest, readJson, pendingPath } from '../ops/ro-stack/legacy-production-baseline.mjs';
import { git, verifyNativeStage } from '../ops/ro-stack/native-promotion-contract.mjs';

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const OWNER = 'F｜M1 最終整合';
const LEASE = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a';
const CHAR = 150105, ACCOUNT = 2000163, LEVEL = 170;
// rAthena db/re/job_exp.yml: Novice caps at 99; Super_Novice_E caps at 200.
// mmo.hpp binds JOB_SUPER_NOVICE_E to 4190. Both remain ordinary group-0 jobs.
const CLASS = 4190;
const PREIMAGE = path.join(SOURCE, 'docs/project-control/m1-v15-test-player-level-preimage.json');
const EXPECTED_NATIVE = '2eae230904970c7368e1d1f8752bf4b1033cb2cd';
const fail = code => { throw Error(code); };
const ensure = (condition, code) => { if (!condition) fail(code); };
const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) =>
  arg.startsWith('--') ? [[arg.slice(2), all[i + 1]]] : []));
const action = args.action ?? 'preflight';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const levelFields = ['class', 'base_level', 'base_exp'];
const levelSnapshot = character => Object.fromEntries(levelFields.map(key => [key, character[key]]));

export function validateLevelFixtureIdentity({ character, login, flag, agent }, preimage,
  { matchHistoricalCharacter = true } = {}) {
  ensure(character?.char_id === CHAR && character.account_id === ACCOUNT &&
    login?.account_id === ACCOUNT && login.group_id === 0 &&
    flag?.account_id === ACCOUNT && flag.is_test === 1 &&
    agent?.agent_mode === 'PERSISTENT_IDLE' && agent.control_owner === 'SERVER_AGENT' &&
    agent.ownership_state === 'SERVER_AGENT' && !agent.target_map &&
    !agent.task_type && !agent.task_phase, 'TEST_PLAYER_IDENTITY_OR_IDLE_INVALID');
  ensure(preimage.accountId === ACCOUNT && preimage.charId === CHAR &&
    preimage.accountGroupId === 0 && preimage.isTest === 1 &&
    preimage.representativeEvidence.baseExpAfter > preimage.representativeEvidence.baseExpBefore &&
    preimage.representativeEvidence.jobExpAfter > preimage.representativeEvidence.jobExpBefore,
  'LEVEL_ACCELERATION_EVIDENCE_INVALID');
  ensure(character.class === 0 && Number.isInteger(character.base_level) &&
    character.base_level >= 1 && character.base_level <= 99 &&
    character.job_level >= 10, 'NOVICE_LEVEL_PRECONDITION_INVALID');
  if (matchHistoricalCharacter)
    for (const [key, value] of Object.entries(preimage.character))
      ensure(character[key] === value, `TEST_PLAYER_PREIMAGE_DRIFT_${key}`);
  return true;
}

export function levelFixtureUpdate(preimage) {
  ensure(preimage.character.class === 0 && preimage.character.base_level >= 1 &&
    preimage.character.base_level <= 99 && preimage.character.job_level >= 10,
  'NOVICE_PREIMAGE_REQUIRED');
  return { class: CLASS, base_level: LEVEL, base_exp: 0 };
}

export function rollbackLevelFixture(current, before) {
  ensure(current.class === CLASS && current.base_level === LEVEL,
    'LEVEL_FIXTURE_ROLLBACK_DRIFT');
  return { expected: levelSnapshot(current), values: levelSnapshot(before) };
}

export function fullHealthConfirmed(character) {
  return character?.charId === CHAR && character.liveFresh === true &&
    Number.isInteger(character.hp) && Number.isInteger(character.maxHp) &&
    Number.isInteger(character.sp) && Number.isInteger(character.maxSp) &&
    character.maxHp > 0 && character.maxSp > 0 &&
    character.hp === character.maxHp && character.sp === character.maxSp;
}

export async function prepareHealthyRuntime(credentialsPath) {
  ensure(process.env.RO_LOCAL_ADMIN_TOKEN, 'LOCAL_ADMIN_TOKEN_REQUIRED');
  const base = 'http://127.0.0.1:8788';
  const headers = { 'x-ro-local-admin-token': process.env.RO_LOCAL_ADMIN_TOKEN,
    accept: 'application/json' };
  const submitted = await fetch(base + '/api/admin/test-fixture/m1-acceptance', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ profile: 'M1_FLY_SUPPLY_V1' }),
    signal: AbortSignal.timeout(10000),
  });
  const queued = await submitted.json();
  ensure(submitted.status === 202 && queued.state === 'QUEUED' && queued.requestId,
    `HEALTH_FIXTURE_ADMISSION_FAILED_${submitted.status}`);
  let result = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const response = await fetch(`${base}/api/admin/test-fixture/m1-acceptance/${queued.requestId}`,
      { headers, signal: AbortSignal.timeout(10000) });
    ensure(response.status === 200, `HEALTH_FIXTURE_RESULT_HTTP_${response.status}`);
    result = await response.json();
    if (result.state !== 'QUEUED') break;
  }
  ensure(result?.state === 'CONFIRMED' && result.nativeEvent === 'PREREQUISITES_READY',
    `HEALTH_FIXTURE_NATIVE_${result?.reason ?? result?.state ?? 'TIMEOUT'}`);
  let live = null;
  for (let i = 0; i < 10; i++) {
    live = await playerState(credentialsPath);
    if (fullHealthConfirmed(live)) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  ensure(fullHealthConfirmed(live), 'HEALTH_FIXTURE_AUTHORITATIVE_READBACK_FAILED');
  return { requestId: queued.requestId, nativeEvent: result.nativeEvent,
    hp: live.hp, maxHp: live.maxHp, sp: live.sp, maxSp: live.maxSp };
}

async function database() {
  const secret = readJson(path.join(ROOT, '.local/ro-stack/secrets.json'));
  ensure(typeof secret.databasePassword === 'string' && secret.databasePassword.length > 0,
    'DATABASE_SECRET_UNAVAILABLE');
  return mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'rathena_local',
    password: secret.databasePassword, database: 'ragnarok', connectTimeout: 5000 });
}

async function identity(db) {
  const [[character]] = await db.execute(
    'SELECT char_id,account_id,`class`,base_level,job_level,base_exp,job_exp,str,agi,vit,`int`,dex,luk,status_point,skill_point,hp,max_hp,sp,max_sp,last_map,last_x,last_y,save_map,save_x,save_y,zeny FROM `char` WHERE char_id=? AND account_id=? LIMIT 1',
    [CHAR, ACCOUNT]);
  const [[login]] = await db.execute('SELECT account_id,group_id FROM login WHERE account_id=? LIMIT 1', [ACCOUNT]);
  const [[flag]] = await db.execute('SELECT account_id,is_test FROM web_account_flags WHERE account_id=? LIMIT 1', [ACCOUNT]);
  const [[agent]] = await db.execute('SELECT agent_mode,control_owner,ownership_state,target_map,task_type,task_phase FROM persistent_agent_state WHERE char_id=? LIMIT 1', [CHAR]);
  return { character, login, flag, agent };
}

async function changeLevel(db, expected, values) {
  await db.beginTransaction();
  try {
    const [[row]] = await db.execute('SELECT account_id,`class`,base_level,base_exp FROM `char` WHERE char_id=? FOR UPDATE', [CHAR]);
    ensure(row?.account_id === ACCOUNT && levelFields.every(key => row[key] === expected[key]),
      'LEVEL_FIXTURE_COMPARE_AND_SWAP_FAILED');
    const [result] = await db.execute('UPDATE `char` SET `class`=?,base_level=?,base_exp=? WHERE char_id=? AND account_id=? AND `class`=? AND base_level=? AND base_exp=?',
      [values.class, values.base_level, values.base_exp, CHAR, ACCOUNT,
        expected.class, expected.base_level, expected.base_exp]);
    ensure(result.affectedRows === 1, 'LEVEL_FIXTURE_UPDATE_FAILED');
    await db.commit();
  } catch (error) { await db.rollback(); throw error; }
}

let playerSessionCookie = null;
async function playerState(credentialsPath) {
  ensure(credentialsPath && fs.existsSync(credentialsPath), 'PLAYER_CREDENTIALS_REQUIRED');
  const base = 'http://127.0.0.1:8788';
  if (!playerSessionCookie) {
    const credentials = readJson(credentialsPath);
    const login = await fetch(base + '/api/account', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: credentials.username, password: credentials.password }) });
    playerSessionCookie = login.headers.get('set-cookie')?.split(';')[0] ?? null;
    ensure(login.status === 200 && playerSessionCookie, 'TEST_PLAYER_AUTH_FAILED');
  }
  const state = await fetch(base + '/api/state?view=full', { headers: { cookie: playerSessionCookie } });
  ensure(state.status === 200, 'TEST_PLAYER_READBACK_FAILED');
  return (await state.json()).character;
}

function governance() {
  ensure(git(SOURCE, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
    git(SOURCE, 'remote', 'get-url', 'origin') === 'https://github.com/amadiz1988-boop/terminal-arpg.git',
  'FIXTURE_GOVERNANCE_SOURCE_INVALID');
  const sha = git(SOURCE, 'rev-parse', 'HEAD');
  const remote = git(SOURCE, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
  git(SOURCE, 'merge-base', '--is-ancestor', sha, remote);
  const dir = path.join(ROOT, '.local/ro-stack');
  const lease = readJson(path.join(dir, 'production-deployment-lease/lease.json'));
  const pending = readJson(path.join(ROOT, pendingPath));
  const state = readJson(path.join(dir, 'production-deployment-state.json'));
  const authority = readJson(path.join(SOURCE,
    'docs/project-control/production-release-authority.json')).native;
  ensure(lease.lease_id === LEASE && lease.owner_task_id === OWNER && lease.status === 'ACTIVE' &&
    lease.native_deploy_git_sha === EXPECTED_NATIVE && authority.accepted_source_sha === EXPECTED_NATIVE &&
    lease.web_deploy_git_sha === '1346bd0561194da63de5132f9ea11ec820f703e7' &&
    state.production_drift === 'OPEN' && state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' &&
    verifyNativeStage(ROOT, state, lease, lease.admission_manifest_sha256).pass === true &&
    same(lease.native_command_contract_amendment, pending.native_command_contract_amendment),
  'FIXTURE_LEASE_OR_NATIVE_STAGE_INVALID');
  return { governanceSha: sha, lease };
}

async function main() {
  ensure(['preflight', 'prepare', 'health', 'restore'].includes(action), 'INVALID_FIXTURE_ACTION');
  const preimage = readJson(PREIMAGE), preimageSha256 = digest(PREIMAGE);
  const { governanceSha } = governance();
  const adapter = runtimeAdapter(ROOT, OWNER, LEASE);
  const runtime = await adapter('snapshot');
  ensure(runtime.pass && runtime.openkore_runtime_count === 0 &&
    runtime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES',
  'FIXTURE_RUNTIME_UNHEALTHY');
  const db = await database();
  try {
    const current = await identity(db);
    if (action === 'preflight') {
      validateLevelFixtureIdentity(current, preimage, { matchHistoricalCharacter: false });
      const live = await playerState(args.credentials);
      ensure(live?.charId === CHAR && live.liveFresh === true &&
        live.baseLevel === current.character.base_level && live.classId === 0,
      'FIXTURE_LIVE_PREIMAGE_INVALID');
      console.log(JSON.stringify({ eligible: true, testAcceleration: true,
        preimageSha256, charId: CHAR, accountId: ACCOUNT, groupId: 0, isTest: 1,
        beforeLevel: current.character.base_level, targetLevel: LEVEL, targetClass: CLASS,
        representativeBaseExpGain: preimage.representativeEvidence.baseExpAfter - preimage.representativeEvidence.baseExpBefore,
        runtimeHealthy: true, mutation: false }));
      return;
    }
    ensure(args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
    const priorEvidenceDir = path.join(ROOT, '.local/ro-stack/fixture-evidence',
      `m1-level-${CHAR}-${LEASE}`);
    const evidenceDir = path.join(ROOT, '.local/ro-stack/fixture-evidence',
      `m1-level-${CHAR}-${LEASE}-${EXPECTED_NATIVE.slice(0, 12)}`);
    if (action === 'health') {
      ensure(fs.existsSync(path.join(evidenceDir, 'prepared.json')) &&
        !fs.existsSync(path.join(evidenceDir, 'restored.json')),
      'HEALTH_FIXTURE_LEVEL_PRECONDITION_INVALID');
      ensure(current.login.group_id === 0 && current.flag.is_test === 1 &&
        current.agent.agent_mode === 'PERSISTENT_IDLE' && !current.agent.target_map &&
        !current.agent.task_type && !current.agent.task_phase &&
        current.character.class === CLASS && current.character.base_level === LEVEL,
      'HEALTH_FIXTURE_IDLE_PRECONDITION_INVALID');
      const before = await playerState(args.credentials);
      ensure(before?.charId === CHAR && before.liveFresh === true &&
        before.baseLevel === LEVEL && before.classId === CLASS,
      'HEALTH_FIXTURE_LIVE_PRECONDITION_INVALID');
      const healthy = await prepareHealthyRuntime(args.credentials);
      console.log(JSON.stringify({ testAcceleration: true, charId: CHAR,
        groupId: 0, isTest: 1, before: { hp: before.hp, maxHp: before.maxHp,
          sp: before.sp, maxSp: before.maxSp }, after: healthy }));
      return;
    }
    if (action === 'prepare') {
      ensure(!fs.existsSync(path.join(priorEvidenceDir, 'prepared.json')) ||
        fs.existsSync(path.join(priorEvidenceDir, 'restored.json')),
      'PRIOR_LEVEL_FIXTURE_NOT_RESTORED');
      validateLevelFixtureIdentity(current, preimage, { matchHistoricalCharacter: false });
      const beforeLive = await playerState(args.credentials);
      ensure(beforeLive?.charId === CHAR && beforeLive.liveFresh === true &&
        beforeLive.baseLevel === current.character.base_level && beforeLive.classId === 0,
      'FIXTURE_LIVE_PREIMAGE_INVALID');
      ensure(!fs.existsSync(evidenceDir), 'FIXTURE_ALREADY_PREPARED');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(path.join(evidenceDir, 'preimage.json'), JSON.stringify({
        preimage, preimageSha256, currentCharacter: current.character,
        governanceSha, beforeRuntime: runtime,
        capturedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
      let stopped = false, changed = false, offlinePreimage = null;
      try {
        await adapter('stop'); stopped = true;
        const offline = await identity(db);
        validateLevelFixtureIdentity(offline, preimage, { matchHistoricalCharacter: false });
        ensure(same(levelSnapshot(offline.character), levelSnapshot(current.character)),
          'TEST_PLAYER_LEVEL_PREIMAGE_DRIFT');
        offlinePreimage = offline;
        fs.writeFileSync(path.join(evidenceDir, 'offline-preimage.json'), JSON.stringify(offline, null, 2) + '\n', { flag: 'wx' });
        await changeLevel(db, offline.character,
          levelFixtureUpdate({ character: offline.character })); changed = true;
        await adapter('start'); stopped = false;
        let after = null, live = null;
        for (let i = 0; i < 30; i++) {
          after = await adapter('snapshot');
          if (after.pass && after.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES') {
            live = await playerState(args.credentials).catch(() => null);
            if (live?.liveFresh && live.baseLevel === LEVEL && live.classId === CLASS) break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        const post = await identity(db);
        ensure(after?.pass && live?.baseLevel === LEVEL && live.classId === CLASS &&
          post.login.group_id === 0 && post.flag.is_test === 1 &&
          post.character.base_level === LEVEL && post.character.class === CLASS &&
          after.dashboard_pid === runtime.dashboard_pid && after.database_pid === runtime.database_pid,
        'FIXTURE_AUTHORITATIVE_LEVEL_UNCONFIRMED');
        const healthy = await prepareHealthyRuntime(args.credentials);
        const receipt = { schemaVersion: 'm1-test-player-level-fixture-v1', accountId: ACCOUNT, charId: CHAR,
          testAcceleration: true, before: { level: offlinePreimage.character.base_level, class: offlinePreimage.character.class },
          after: { level: live.baseLevel, class: live.classId, source: live.liveSource },
          groupId: post.login.group_id, isTest: post.flag.is_test, preimageSha256,
          healthyPrecondition: healthy,
          runtimeBefore: runtime.pids, runtimeAfter: after.pids,
          governanceSha, preparedAt: new Date().toISOString() };
        fs.writeFileSync(path.join(evidenceDir, 'prepared.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ ...receipt, evidenceDir }));
      } catch (error) {
        let rollback = null;
        try {
          if (!stopped) { await adapter('stop'); stopped = true; }
          if (changed) {
            const rollbackCurrent = (await identity(db)).character;
            const rollback = rollbackLevelFixture(rollbackCurrent, offlinePreimage.character);
            await changeLevel(db, rollback.expected, rollback.values);
          }
          await adapter('start'); stopped = false;
          rollback = { preimageRestored: true, runtime: (await adapter('snapshot')).pass };
        } catch (failure) { rollback = { preimageRestored: false, error: failure.message }; }
        fs.writeFileSync(path.join(evidenceDir, 'failure.json'), JSON.stringify({
          reason: error.message, rollback, at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
        throw Error(`FIXTURE_PREPARE_FAILED:${error.message}:${rollback.preimageRestored ? 'ROLLED_BACK' : 'ROLLBACK_FAILED'}`);
      }
      return;
    }
    ensure(fs.existsSync(path.join(evidenceDir, 'prepared.json')) &&
      !fs.existsSync(path.join(evidenceDir, 'restored.json')), 'FIXTURE_RESTORE_RECORD_INVALID');
    const prepared = readJson(path.join(evidenceDir, 'prepared.json'));
    const offlinePreimage = readJson(path.join(evidenceDir, 'offline-preimage.json'));
    ensure(prepared.preimageSha256 === preimageSha256 &&
      current.login.group_id === 0 && current.flag.is_test === 1 &&
      current.agent.agent_mode === 'PERSISTENT_IDLE' && current.character.class === CLASS &&
      current.character.base_level === LEVEL, 'FIXTURE_RESTORE_PRECONDITION_INVALID');
    let restoreStopped = false;
    try {
      await adapter('stop'); restoreStopped = true;
      const offline = await identity(db);
      ensure(offline.character.class === CLASS && offline.character.base_level === LEVEL &&
        offline.login.group_id === 0 && offline.flag.is_test === 1, 'FIXTURE_RESTORE_DRIFT');
      const restore = rollbackLevelFixture(offline.character, offlinePreimage.character);
      await changeLevel(db, restore.expected, restore.values);
    } finally {
      if (restoreStopped) await adapter('start');
    }
    const restored = await playerState(args.credentials);
    ensure(restored.baseLevel === offlinePreimage.character.base_level &&
      restored.classId === offlinePreimage.character.class,
      'FIXTURE_RESTORE_READBACK_FAILED');
    fs.writeFileSync(path.join(evidenceDir, 'restored.json'), JSON.stringify({
      restoredAt: new Date().toISOString(), baseLevel: restored.baseLevel, classId: restored.classId,
      groupId: (await identity(db)).login.group_id, preimageSha256 }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ restored: true, baseLevel: restored.baseLevel, classId: restored.classId,
      evidenceDir }));
  } finally { await db.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
