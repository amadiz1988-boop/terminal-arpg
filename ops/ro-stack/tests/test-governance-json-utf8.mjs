// Governance JSON UTF-8 contract across Node and Windows PowerShell 5.1.
// Isolated temp fixtures only; never reads or writes the Production root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, digest, FIRST_PROMOTION, LEGACY_MODE, UNKNOWN_SHA, pendingPath } from '../legacy-production-baseline.mjs';
import { archiveFailedNativeOperation, failedOperationPrefix } from '../deploy-native-candidate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const probeFile = path.join(here, 'governance-json-ps51-probe.ps1');
const stateTool = path.join(here, '..', 'production-deployment-state.mjs');
const FAILED_OWNER = 'F\uFF5CM1 \u6700\u7D42\u6574\u5408'; // F｜M1 最終整合
assert.equal(FAILED_OWNER, 'F｜M1 最終整合');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-utf8-'));
let count = 0;
const test = async (name, fn) => { await fn(); console.log(`PASS ${++count} ${name}`); };
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const nodeWrite = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); return file; };
function ps51(caseName, options = {}) {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeFile, '-Case', caseName];
  for (const [key, value] of Object.entries(options)) args.push('-' + key, String(value));
  const r = spawnSync('powershell.exe', args, { windowsHide: true, timeout: 60000 });
  assert.equal(r.status, 0, r.stderr?.toString());
  const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(r.stdout));
  assert.equal(result.ps_major, 5, 'Windows PowerShell 5.1 required');
  return result;
}
function leaseRoot(owner, leaseId = 'lease-utf8') {
  const root = fs.mkdtempSync(path.join(tmp, 'lease-'));
  const dir = path.join(root, '.local', 'ro-stack');
  nodeWrite(path.join(dir, 'production-deployment-lease', 'lease.json'), { lease_id: leaseId, owner_task_id: owner,
    owner_window: owner, status: 'ACTIVE', promotion_mode: FIRST_PROMOTION, target_scope: 'Web + Native' });
  nodeWrite(path.join(dir, 'production-deployment-state.json'), { production_drift: 'OPEN', drift_reason: 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT' });
  nodeWrite(path.join(dir, 'first-github-first-promotion.pending.json'), { lease_id: leaseId, owner_task_id: owner });
  return dir;
}
const leaseCheck = (dir, owner, leaseId = 'lease-utf8') => ps51('lease', { RuntimeRoot: dir, Owner: owner, LeaseId: leaseId });
const nodeRejects = file => assert.throws(() => readJson(file));

try {
  for (const [n, owner] of [[1, 'F'], [2, FAILED_OWNER], [3, 'Worker 7 工作線 A'], [4, '配備担当｜배포 담당자']]) {
    await test(`${n} lease owner ${JSON.stringify(owner)} passes exactly in PowerShell 5.1`, () => {
      const r = leaseCheck(leaseRoot(owner), owner);
      assert.equal(r.ok, true, r.error); assert.equal(r.owner, owner);
    });
  }
  await test('5 canonical Node writer is UTF-8 without BOM and reads exactly', () => {
    const file = nodeWrite(path.join(tmp, 'nobom.json'), { owner_task_id: FAILED_OWNER });
    assert.notDeepEqual(fs.readFileSync(file).subarray(0, 3), bom);
    const r = ps51('read', { Path: file });
    assert.equal(r.ok, true, r.error); assert.equal(r.value.owner_task_id, FAILED_OWNER);
    assert.equal(readJson(file).owner_task_id, FAILED_OWNER);
  });
  await test('6 BOM form is rejected deterministically by both readers', () => {
    const file = path.join(tmp, 'bom.json');
    fs.writeFileSync(file, Buffer.concat([bom, Buffer.from(JSON.stringify({ owner_task_id: FAILED_OWNER }))]));
    for (let i = 0; i < 2; i++) { const r = ps51('read', { Path: file }); assert.equal(r.ok, false); assert.equal(r.error, 'GOVERNANCE_JSON_BOM_FORBIDDEN'); }
    nodeRejects(file);
  });
  await test('7 legacy Big5 encoded owner fails closed', () => {
    const file = path.join(tmp, 'big5.json');
    assert.equal(ps51('write-codepage', { Path: file, Owner: FAILED_OWNER, CodePage: 950 }).ok, true);
    const r = ps51('read', { Path: file }); assert.equal(r.ok, false); assert.equal(r.error, 'GOVERNANCE_JSON_UTF8_INVALID');
    nodeRejects(file);
  });
  await test('8 malformed UTF-8 fails closed', () => {
    const file = path.join(tmp, 'bad-utf8.json');
    fs.writeFileSync(file, Buffer.concat([Buffer.from('{"owner_task_id":"F'), Buffer.from([0xC3, 0x28]), Buffer.from('"}')]));
    const r = ps51('read', { Path: file }); assert.equal(r.ok, false); assert.equal(r.error, 'GOVERNANCE_JSON_UTF8_INVALID');
    nodeRejects(file);
  });
  await test('9 malformed JSON and missing file fail closed', () => {
    const file = path.join(tmp, 'bad.json'); fs.writeFileSync(file, '{"owner_task_id":');
    assert.equal(ps51('read', { Path: file }).error, 'GOVERNANCE_JSON_INVALID'); nodeRejects(file);
    assert.equal(ps51('read', { Path: path.join(tmp, 'missing.json') }).error, 'GOVERNANCE_JSON_MISSING');
  });
  await test('10 owner altered by one character is rejected', () => {
    const r = leaseCheck(leaseRoot(FAILED_OWNER), 'F｜M1 最終整理');
    assert.equal(r.ok, false); assert.equal(r.error, 'NATIVE_LEASE_NOT_OWNED');
  });
  await test('11 correct lease id with wrong Unicode owner is rejected', () => {
    const r = leaseCheck(leaseRoot(FAILED_OWNER), 'F|M1 最終整合');
    assert.equal(r.ok, false); assert.equal(r.error, 'NATIVE_LEASE_NOT_OWNED');
  });
  await test('12 correct owner with wrong lease id is rejected', () => {
    const r = leaseCheck(leaseRoot(FAILED_OWNER), FAILED_OWNER, 'lease-other');
    assert.equal(r.ok, false); assert.equal(r.error, 'NATIVE_LEASE_NOT_OWNED');
  });
  const legacyRoot = () => {
    const root = fs.mkdtempSync(path.join(tmp, 'state-'));
    const write = (file, value) => { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value)); return full; };
    write('ops/ro-stack/dashboard/app.js', 'legacy-web'); write('map.exe', 'legacy-map');
    const files = [{ path: 'ops/ro-stack/dashboard/app.js', sha256: digest(path.join(root, 'ops/ro-stack/dashboard/app.js')) }];
    const caps = ['skill-tree'];
    const state = { schema_version: 2, baseline_mode: LEGACY_MODE, historical_provenance: 'UNRESOLVED', current_deploy_id: 'LEGACY_BOOTSTRAP_0123456789abcdef',
      current_web_git_sha: UNKNOWN_SHA, current_native_git_sha: UNKNOWN_SHA, legacy_bootstrap_available: true, production_drift: 'CLOSED', accepted_capabilities: caps,
      current_web_artifact_manifest: '.local/ro-stack/legacy/web.json', accepted_capability_manifest: '.local/ro-stack/legacy/caps.json',
      native_binaries: [{ path: 'map.exe', sha256: digest(path.join(root, 'map.exe')) }],
      legacy_rollback: { root: '.local/ro-stack/legacy/rollback', web_manifest: '.local/ro-stack/legacy/rollback-web.json' } };
    state.current_web_manifest_sha256 = digest(write(state.current_web_artifact_manifest, { files }));
    state.accepted_capability_manifest_sha256 = digest(write(state.accepted_capability_manifest, { capabilities: caps.map(id => ({ id })) }));
    write(state.legacy_rollback.web_manifest, { files });
    write(state.legacy_rollback.root + '/ops/ro-stack/dashboard/app.js', 'legacy-web'); write(state.legacy_rollback.root + '/map.exe', 'legacy-map');
    write('.local/ro-stack/production-deployment-state.json', state);
    return root;
  };
  const stateCli = (root, owner, ...args) => spawnSync(process.execPath, [stateTool, '--production-root', root, '--test-mode', 'true', '--owner', owner, ...args], { encoding: 'utf8', windowsHide: true });
  await test('13 production-deployment-state Unicode round trip', () => {
    const root = legacyRoot();
    const r = stateCli(root, FAILED_OWNER, '--action', 'open-drift', '--reason', 'UTF-8 測試');
    assert.equal(r.status, 0, r.stdout);
    const file = path.join(root, '.local/ro-stack/production-deployment-state.json');
    assert.equal(readJson(file).drift_reported_by, FAILED_OWNER);
    const p = ps51('read', { Path: file }); assert.equal(p.ok, true, p.error);
    assert.equal(p.value.drift_reported_by, FAILED_OWNER); assert.equal(p.value.drift_reason, 'UTF-8 測試');
  });
  await test('14 Native candidate manifest read preserves Unicode and rejects BOM', () => {
    const value = { schema_version: 'native-candidate-v1', candidate_id: '候補｜후보-1', native_git_sha: 'a'.repeat(40) };
    const file = nodeWrite(path.join(tmp, 'native-candidate.json'), value);
    assert.deepEqual(readJson(file), value);
    fs.writeFileSync(path.join(tmp, 'native-candidate-bom.json'), Buffer.concat([bom, fs.readFileSync(file)]));
    nodeRejects(path.join(tmp, 'native-candidate-bom.json'));
  });
  await test('15 deploy receipt written by Write-Receipt round trips and never overwrites', () => {
    const file = path.join(tmp, 'deploy-receipt.json');
    const w = ps51('write-receipt', { Path: file, Owner: FAILED_OWNER, LeaseId: 'lease-utf8' }); assert.equal(w.ok, true, w.error);
    assert.notDeepEqual(fs.readFileSync(file).subarray(0, 3), bom);
    assert.equal(readJson(file).owner_task_id, FAILED_OWNER);
    assert.equal(ps51('read', { Path: file }).value.owner_task_id, FAILED_OWNER);
    assert.equal(ps51('write-receipt', { Path: file, Owner: 'other', LeaseId: 'x' }).ok, false);
    assert.equal(readJson(file).owner_task_id, FAILED_OWNER);
  });
  await test('16 release-failed transition with Unicode owner', () => {
    const root = legacyRoot(), lease = { lease_id: 'lease-utf8', owner_task_id: FAILED_OWNER, status: 'ACTIVE', promotion_mode: FIRST_PROMOTION };
    nodeWrite(path.join(root, '.local/ro-stack/production-deployment-lease/lease.json'), lease);
    const wrong = stateCli(root, 'F｜M1 最終整理', '--action', 'release-failed');
    assert.notEqual(wrong.status, 0); assert.match(wrong.stdout, /DEPLOYMENT_LEASE_NOT_OWNED/);
    assert.equal(stateCli(root, FAILED_OWNER, '--action', 'begin-first-promotion').status, 0);
    const r = stateCli(root, FAILED_OWNER, '--action', 'release-failed'); assert.equal(r.status, 0, r.stdout);
    const state = readJson(path.join(root, '.local/ro-stack/production-deployment-state.json'));
    assert.equal(state.production_drift, 'CLOSED'); assert.equal(state.drift_reason, null);
    assert.equal(fs.existsSync(path.join(root, '.local/ro-stack/production-deployment-lease')), false);
    assert.equal(fs.existsSync(path.join(root, pendingPath)), false);
  });
  const failedLeaseFixture = () => {
    const dir = leaseRoot(FAILED_OWNER, '00000000-0000-4000-8000-000000000001');
    const file = path.join(dir, 'production-deployment-lease', 'lease.json');
    nodeWrite(file, { ...readJson(file), owner_window: 'F｜M1 最終整合', target_scope: 'Web + Native 首次 GitHub-first 升級',
      web_deploy_git_sha: 'a'.repeat(40), native_deploy_git_sha: 'b'.repeat(40), acquired_at: '2026-09-24T13:40:00.000Z' });
    return { dir, file };
  };
  await test('17 Node-created failed-lease fixture passes the new PowerShell 5.1 reader', () => {
    const { dir } = failedLeaseFixture();
    const r = leaseCheck(dir, FAILED_OWNER, '00000000-0000-4000-8000-000000000001');
    assert.equal(r.ok, true, r.error); assert.equal(r.owner, FAILED_OWNER);
  });
  await test('18 PowerShell-created governance JSON and stdout decode exactly in Node', () => {
    const file = path.join(tmp, 'procdump-attachment-state.json');
    assert.equal(ps51('write-incident', { Path: file, Owner: FAILED_OWNER }).ok, true);
    assert.notDeepEqual(fs.readFileSync(file).subarray(0, 3), bom);
    assert.equal(readJson(file).note, FAILED_OWNER);
    assert.equal(ps51('echo', { Owner: FAILED_OWNER }).owner, FAILED_OWNER);
  });
  await test('19 failed-lease fixture reproduces the reader before this fix', () => {
    const { file } = failedLeaseFixture();
    const r = ps51('legacy-lease', { Path: file, Owner: FAILED_OWNER });
    // Implicit ANSI decoding either breaks JSON parsing or yields a different
    // owner string. Both are the pre-fix JSON/owner identity failure.
    const reproduced = r.ok ? r.owner_matches === false && r.owner !== FAILED_OWNER : /ConvertFrom-Json|Invalid object|expected/i.test(r.error || '');
    assert.equal(reproduced, true, JSON.stringify(r));
    console.log(`FAILED_LEASE_FIXTURE_BEFORE=FAIL_REPRODUCED ${r.ok ? 'OWNER_MISMATCH' : 'JSON_PARSE_FAILED'}`);
  });
  await test('20 ProcDump receipt reader is explicit UTF-8', () => {
    const file = path.join(tmp, 'incident-read.json'); nodeWrite(file, { procdumpAttachStatus: 'ATTACHED', note: FAILED_OWNER });
    const good = ps51('read-incident', { Path: file }); assert.equal(good.is_null, false); assert.equal(good.value.note, FAILED_OWNER);
    fs.writeFileSync(file, Buffer.concat([bom, Buffer.from('{"note":"x"}')]));
    assert.equal(ps51('read-incident', { Path: file }).is_null, true);
  });
  await test('21 lease owner comparison is ordinal and case sensitive', () => {
    const r = leaseCheck(leaseRoot('Worker-F'), 'worker-f');
    assert.equal(r.ok, false); assert.equal(r.error, 'NATIVE_LEASE_NOT_OWNED');
  });
  const archiveRoot = () => {
    const root = fs.mkdtempSync(path.join(tmp, 'archive-')), dir = path.join(root, '.local/ro-stack');
    fs.mkdirSync(path.join(dir, 'rathena'), { recursive: true }); fs.writeFileSync(path.join(dir, 'rathena/map-server.exe'), 'legacy-map');
    const sha = digest(path.join(dir, 'rathena/map-server.exe'));
    nodeWrite(path.join(dir, 'production-deployment-state.json'), { production_drift: 'CLOSED', drift_reason: null, current_native_binary_sha256: sha,
      native_binaries: [{ path: '.local/ro-stack/rathena/map-server.exe', sha256: sha }] });
    fs.mkdirSync(path.join(dir, 'native-deploy.lock/stage'), { recursive: true }); fs.writeFileSync(path.join(dir, 'native-deploy.lock/stage/map-server.exe'), 'candidate-map');
    return { root, dir };
  };
  await test('22 failed native operation record archives only after lease release and baseline check', () => {
    const blocked = [
      [x => nodeWrite(path.join(x.dir, 'production-deployment-lease/lease.json'), { owner_task_id: FAILED_OWNER }), /DEPLOYMENT_LEASE_ACTIVE/],
      [x => nodeWrite(path.join(x.dir, 'production-deployment-state.json'), { ...readJson(path.join(x.dir, 'production-deployment-state.json')), production_drift: 'OPEN' }), /PRODUCTION_DRIFT_OPEN/],
      [x => fs.writeFileSync(path.join(x.dir, 'rathena/map-server.exe'), 'partial'), /NATIVE_BASELINE_CHANGED/],
      [x => fs.writeFileSync(path.join(x.dir, 'rathena/map-server.exe.candidate-lease'), 'temp'), /NATIVE_REPLACEMENT_TEMPORARY_PRESENT/],
      [x => fs.writeFileSync(path.join(x.dir, 'native-deploy.lock/unexpected.txt'), 'x'), /UNEXPECTED_CONTENT/]];
    for (const [mutate, code] of blocked) {
      const x = archiveRoot(); mutate(x);
      assert.throws(() => archiveFailedNativeOperation({ root: x.root, owner: FAILED_OWNER }), code);
      assert.equal(fs.existsSync(path.join(x.dir, 'native-deploy.lock')), true);
    }
    const x = archiveRoot();
    const record = archiveFailedNativeOperation({ root: x.root, owner: FAILED_OWNER, governanceSha: 'c'.repeat(40) });
    assert.equal(record.classification, 'COMPLETED_FAILED_OPERATION_RECORD'); assert.equal(record.blocks_new_deploy, false);
    assert.equal(record.archived_by, FAILED_OWNER); assert.equal(record.staged_artifacts.length, 1);
    assert.equal(fs.existsSync(path.join(x.dir, 'native-deploy.lock')), false);
    const archived = fs.readdirSync(x.dir).filter(name => name.startsWith(failedOperationPrefix));
    assert.equal(archived.length, 1);
    assert.equal(fs.readFileSync(path.join(x.dir, archived[0], 'stage/map-server.exe'), 'utf8'), 'candidate-map');
    assert.equal(readJson(path.join(x.dir, archived[0], 'failed-operation-record.json')).archived_by, FAILED_OWNER);
    assert.throws(() => archiveFailedNativeOperation({ root: x.root, owner: FAILED_OWNER }), /NATIVE_OPERATION_RECORD_ABSENT/);
  });
  console.log(`UTF8_GOVERNANCE_TEST_COUNT=${count}`);
} finally {
  if (!fs.realpathSync(tmp).toLowerCase().startsWith(fs.realpathSync(os.tmpdir()).toLowerCase() + path.sep)) throw Error('UNSAFE_FIXTURE_CLEANUP');
  fs.rmSync(tmp, { recursive: true, force: true });
}
