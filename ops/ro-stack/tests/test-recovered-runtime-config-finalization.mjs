import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { finalizeRecoveredRuntimeConfig } from '../finalize-recovered-runtime-config.mjs';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const leaseId = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a', owner = 'F｜M1 最終整合';
const nativeSha = '23c47bfee3a4a1dae21754fb7a4e3ed32d3f657a';
const oldNative = 'a4c736d865eeedca398aad97aeff1c1036f2dc39';
const webSha = '8cdb13fb88be7199aae15b81e55a9a89a5ec78c5';
const base = '.local/ro-stack/';
const paths = {
  failure: base + 'runtime-config-reconcile.lock/failure.json',
  operation: base + 'runtime-config-reconcile.lock/operation.json',
  rollback: base + `runtime-config-rollback-${leaseId}.psd1`,
  config: 'ops/ro-stack/stack.config.psd1',
  lease: base + 'production-deployment-lease/lease.json',
  state: base + 'production-deployment-state.json',
  pending: base + 'first-github-first-promotion.pending.json',
  native: base + 'native-promotion-receipt-23c47bfee3a4.json',
  graceful: base + `native-graceful-shutdown-live-${leaseId}-23c47bfee3a4.json`,
  amendment: base + `native-candidate-amendment-${leaseId}-23c47bfee3a4.json`,
  lowSpLog: base + 'logs/20260925-091816-map.out.log',
  incident: base + 'runtime-incidents/20260925T033640Z-e1b65f39eb9e4e04b7154d1e93649710/incident.json',
  instruction: 'project-control-instruction.txt'
};
function put(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}
function edit(root, key, change) {
  const file = path.join(root, paths[key]);
  const value = JSON.parse(fs.readFileSync(file)); change(value);
  fs.writeFileSync(file, JSON.stringify(value));
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'failed-runtime-config-finalize-'));
  const file = key => path.join(root, paths[key]);
  put(root, paths.failure, { classification: 'RUNTIME_CONFIG_RECONCILIATION_FAILED',
    error: 'NATIVE_RUNTIME_STOP_FAILED', stop_attempted: true, config_reverted: false,
    rollback_digest: '', current_config_digest: '' });
  put(root, paths.operation, { phase: 'RESTART_IN_PROGRESS', native_git_sha: oldNative,
    lease_id: leaseId, lease_owner: owner, changed_keys: [
      { key: 'PersistentAgentSpThresholdPercent', old_value: 20, new_value: 0 },
      { key: 'PersistentAgentSpSafePercent', old_value: 40, new_value: 0 }] });
  put(root, paths.rollback, 'PersistentAgentSpThresholdPercent = 20\nPersistentAgentSpSafePercent = 40\n');
  put(root, paths.config, 'PersistentAgentSpThresholdPercent = 0\nPersistentAgentSpSafePercent = 0\n');
  edit(root, 'failure', x => { x.rollback_digest = hash(file('rollback')); x.current_config_digest = hash(file('config')); });
  put(root, paths.instruction, 'Project Control authorized recovery and finalization.');
  put(root, paths.lowSpLog, 'AUTO_FARM_STARTED sp_threshold=0 sp_safe=0\nSKILL_FALLBACK weapon\nAUTO_FARM_HIT hp=506->165\n');
  put(root, paths.incident, { rootCauseStatus: 'UNKNOWN', recoveryPerformed: true,
    recoveryResult: 'RUNTIME_PORTS_HEALTHY' });
  const artifacts = ['login', 'char', 'map'].map(role => {
    const relative = `${base}rathena/${role}-server.exe`;
    const binary = put(root, relative, `binary-${role}`);
    return { path: relative, sha256: hash(binary) };
  });
  const native = { lease_id: leaseId, owner_task_id: owner, native_git_sha: nativeSha,
    new_binary_sha256: artifacts[2].sha256, artifacts };
  put(root, paths.native, native);
  const graceful = { lease_id: leaseId, owner_task_id: owner, native_git_sha: nativeSha,
    NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE: 'PASS', forced_termination_used: false };
  put(root, paths.graceful, graceful);
  put(root, paths.amendment, { classification: 'NATIVE_CANDIDATE_AMENDED',
    old_native_git_sha: oldNative, new_native_git_sha: nativeSha });
  put(root, paths.lease, { lease_id: leaseId, owner_task_id: owner, status: 'ACTIVE',
    promotion_mode: 'FIRST_GITHUB_FIRST_PROMOTION', web_deploy_git_sha: webSha,
    native_deploy_git_sha: nativeSha, active_native_candidate: {
      native_git_sha: nativeSha, deployed: true, binary_sha256: artifacts[2].sha256 },
    native_candidate_amendments: [{ audit_sha256: hash(file('amendment')) }] });
  put(root, paths.state, { schema_version: 2, baseline_mode: 'LEGACY_PRE_GITHUB_FIRST',
    historical_provenance: 'UNRESOLVED', current_deploy_id: 'LEGACY_BOOTSTRAP_37c2b3abf68f4f4c',
    current_web_git_sha: 'UNRESOLVED_LEGACY', current_native_git_sha: 'UNRESOLVED_LEGACY',
    legacy_bootstrap_available: true, production_drift: 'OPEN',
    drift_reason: 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT',
    first_promotion_phase: 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' });
  put(root, paths.pending, { lease_id: leaseId, owner_task_id: owner, web_git_sha: webSha,
    native_git_sha: nativeSha, native_stage: 'NATIVE_STAGE_COMPLETE', native_stage_reconciled: true,
    native_receipt_path: paths.native, native_receipt_sha256: hash(file('native')),
    native_graceful_shutdown_live: { sha256: hash(file('graceful')) } });
  const expected = { lease: leaseId, owner, web: webSha, native: nativeSha, oldNative,
    failureHash: hash(file('failure')), operationHash: hash(file('operation')),
    rollbackHash: hash(file('rollback')), configHash: hash(file('config')),
    lowSpLogHash: hash(file('lowSpLog')), incidentHash: hash(file('incident')),
    instructionHash: hash(file('instruction')) };
  const exeRoot = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack\\.local\\ro-stack\\rathena\\';
  const pids = { login: 10, char: 11, map: 12 };
  const snapshot = { pass: true, counts: { login: 1, char: 1, map: 1 }, pids,
    processes: Object.fromEntries(Object.entries(pids).map(([role, pid]) => [role,
      { pid, executable_path: exeRoot + role + '-server.exe' }])),
    openkore_runtime_count: 0, dashboard_pid: 20, database_pid: 21,
    procdump_receipt: { procdumpAttachStatus: 'ATTACHED', mapPid: 12, procdumpAttachedPid: 12,
      procdumpProcessId: 30, mapBinarySha256: artifacts[2].sha256 },
    procdump_process_identity: { PROCESS_IDENTITY_MATCH: 'YES', target_pid: 12,
      procdump_pid: 30, procdump_target_pid: 12 }, procdump_account: 'NT AUTHORITY\\SYSTEM' };
  const args = { root, leaseId, owner, governanceSha: 'a'.repeat(40), instruction: file('instruction'),
    expected, snapshot, apiHealth: { status: 200, ok: true } };
  return { root, file, args, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
let count = 0;
function test(name, action) {
  const x = fixture();
  try { action(x); console.log(`PASS ${++count} ${name}`); }
  finally { x.cleanup(); }
}
function blocked(name, mutate, code) {
  test(name, x => { mutate(x); assert.throws(() => finalizeRecoveredRuntimeConfig(x.args), new RegExp(code)); });
}
test('complete recovered evidence allows finalization dry run', x => {
  const result = finalizeRecoveredRuntimeConfig(x.args);
  assert.equal(result.eligible, true); assert.equal(result.action, 'DRY_RUN');
  assert.equal(result.receipt.classification, 'RECOVERED_FAILED_OPERATION');
  assert.equal(fs.existsSync(path.join(x.root, base + `runtime-config-failed-operation-finalization-${leaseId}.json`)), false);
});
blocked('unhealthy current Production blocks', x => { x.args.snapshot.pass = false; }, 'CURRENT_RUNTIME_UNHEALTHY');
blocked('wrong Native SHA blocks', x => edit(x.root, 'lease', v => { v.native_deploy_git_sha = oldNative; }), 'LEASE_IDENTITY_CHANGED');
blocked('invalid ProcDump blocks', x => { x.args.snapshot.procdump_process_identity.PROCESS_IDENTITY_MATCH = 'NO'; }, 'CURRENT_PROCDUMP_INVALID');
blocked('missing original failure blocks', x => fs.unlinkSync(x.file('failure')), 'ORIGINAL_FAILURE_MISSING');
blocked('mutated original failure blocks', x => fs.appendFileSync(x.file('failure'), ' '), 'ORIGINAL_FAILURE_MUTATED');
blocked('wrong lease blocks', x => { x.args.leaseId = 'wrong'; }, 'LEASE_OWNER_MISMATCH');
blocked('wrong Unicode owner blocks', x => { x.args.owner = 'F|M1 最終整合'; }, 'LEASE_OWNER_MISMATCH');
test('successful finalization preserves failure, creates receipt, clears lock and keeps lease and baseline', x => {
  const failureHash = hash(x.file('failure')), operationHash = hash(x.file('operation'));
  const result = finalizeRecoveredRuntimeConfig({ ...x.args, execute: true });
  const archive = path.join(x.root, base + `runtime-config-failed-finalized-${leaseId}`);
  const receipt = path.join(x.root, result.receipt_path);
  assert.equal(hash(path.join(archive, 'failure.json')), failureHash);
  assert.equal(hash(path.join(archive, 'operation.json')), operationHash);
  assert.equal(hash(path.join(archive, 'project-control-authorization.txt')), hash(x.file('instruction')));
  assert.equal(fs.existsSync(receipt), true);
  assert.equal(JSON.parse(fs.readFileSync(receipt)).first_restart_result, 'FAILED');
  assert.equal(fs.existsSync(path.dirname(x.file('failure'))), false);
  assert.equal(result.failed_operation_blocks_promotion, false);
  assert.equal(JSON.parse(fs.readFileSync(x.file('lease'))).status, 'ACTIVE');
  assert.equal(JSON.parse(fs.readFileSync(x.file('state'))).baseline_mode, 'LEGACY_PRE_GITHUB_FIRST');
  assert.equal(JSON.parse(fs.readFileSync(x.file('state'))).production_drift, 'OPEN');
  assert.equal(JSON.parse(fs.readFileSync(x.file('pending'))).runtime_config_failed_operation_finalization_sha256, hash(receipt));
  assert.equal(finalizeRecoveredRuntimeConfig(x.args).already_finalized, true);
});
blocked('invalid live low SP evidence blocks', x => fs.appendFileSync(x.file('lowSpLog'), 'GLOBAL_RECOVERY_TRIGGERED\n'), 'LOW_SP_EVIDENCE_CHANGED');
blocked('wrong recovery authorization blocks', x => fs.appendFileSync(x.file('instruction'), 'changed'), 'PROJECT_CONTROL_AUTHORITY_CHANGED');
blocked('unhealthy API blocks', x => { x.args.apiHealth.ok = false; }, 'CURRENT_API_UNHEALTHY');
blocked('missing graceful cycle blocks', x => fs.unlinkSync(x.file('graceful')), 'ENOENT');
blocked('changed rollback evidence blocks', x => fs.appendFileSync(x.file('rollback'), 'changed'), 'CONFIG_RECOVERY_DIGEST_INVALID');
test('interruption after receipt write resumes archival and metadata', x => {
  const first = finalizeRecoveredRuntimeConfig({ ...x.args, execute: true });
  const archive = path.join(x.root, base + `runtime-config-failed-finalized-${leaseId}`);
  fs.renameSync(archive, path.dirname(x.file('failure')));
  for (const key of ['state', 'pending']) edit(x.root, key, value => {
    delete value.runtime_config_failed_operation_finalization;
    delete value.runtime_config_failed_operation_finalization_sha256;
  });
  const resumed = finalizeRecoveredRuntimeConfig({ ...x.args, execute: true });
  assert.equal(resumed.resumed_finalization, true);
  assert.equal(resumed.receipt_sha256, first.receipt_sha256);
  assert.equal(fs.existsSync(archive), true);
});
test('interruption after archive resumes missing state pointer', x => {
  const first = finalizeRecoveredRuntimeConfig({ ...x.args, execute: true });
  edit(x.root, 'state', value => {
    delete value.runtime_config_failed_operation_finalization;
    delete value.runtime_config_failed_operation_finalization_sha256;
  });
  const resumed = finalizeRecoveredRuntimeConfig({ ...x.args, execute: true });
  assert.equal(resumed.resumed_finalization, true);
  assert.equal(resumed.receipt_sha256, first.receipt_sha256);
  assert.equal(finalizeRecoveredRuntimeConfig(x.args).already_finalized, true);
});
assert.equal(count, 16);
console.log(`RUNTIME_CONFIG_FINALIZATION_TESTS=PASS COUNT=${count}`);
