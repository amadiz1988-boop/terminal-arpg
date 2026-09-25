#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, legacyIdentity, pendingPath, FIRST_PROMOTION } from './legacy-production-baseline.mjs';
import { runtimeAdapter, NATIVE_STAGE_PHASE } from './deploy-native-candidate.mjs';
import { equalHash, git } from './native-promotion-contract.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const policy = Object.freeze({
  lease: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a', owner: 'F｜M1 最終整合',
  web: '8cdb13fb88be7199aae15b81e55a9a89a5ec78c5',
  native: '23c47bfee3a4a1dae21754fb7a4e3ed32d3f657a',
  oldNative: 'a4c736d865eeedca398aad97aeff1c1036f2dc39',
  failureHash: '7C618AB6E080E471C20163B5774E3DD01F67C26A7E8105FA2043E2214293685C',
  operationHash: '31088DD85B3A5EC240DF0FC078303641DCD62C900EDE6BC679619DC59185813C',
  rollbackHash: 'B967A29405B4BF7964DE2587439858D7B351BDC92314818022038094B6057701',
  configHash: 'CC4E1158991D54833D7E44A583DA8C7D7248A6AE205F87475F55BD81416E4B45',
  lowSpLogHash: '99737254C8E1E4889B48BA8AA6BDD58BDA2BEDD25FB7CA6ACF42D3FF65D44621',
  incidentHash: '95A81CC090FBFD5AF209ECA0FA9AB393E493B625189AAC57AB220716C8613A8C',
  instructionHash: 'A9C58F2867CDE31971D81D4F38F7B0A5A3BE96A33AACA4B8773C2F018C0D34E6'
});
const fail = code => { throw Error(code); };
const requireThat = (value, code) => { if (!value) fail(code); };
const rel = file => `.local/ro-stack/${file}`;
const writeNew = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function replaceJson(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  writeNew(temporary, value);
  fs.renameSync(temporary, file);
}
function files(root, leaseId) {
  const directory = boundedPath(root, '.local/ro-stack');
  return { directory,
    lock: boundedPath(root, rel('runtime-config-reconcile.lock')),
    archive: boundedPath(root, rel(`runtime-config-failed-finalized-${leaseId}`)),
    lockAuthority: boundedPath(root, rel('runtime-config-reconcile.lock/project-control-authorization.txt')),
    archiveAuthority: boundedPath(root, rel(`runtime-config-failed-finalized-${leaseId}/project-control-authorization.txt`)),
    receipt: boundedPath(root, rel(`runtime-config-failed-operation-finalization-${leaseId}.json`)),
    rollback: boundedPath(root, rel(`runtime-config-rollback-${leaseId}.psd1`)),
    config: boundedPath(root, 'ops/ro-stack/stack.config.psd1'),
    lease: boundedPath(root, rel('production-deployment-lease/lease.json')),
    state: boundedPath(root, rel('production-deployment-state.json')),
    pending: boundedPath(root, pendingPath),
    native: boundedPath(root, rel('native-promotion-receipt-23c47bfee3a4.json')),
    graceful: boundedPath(root, rel(`native-graceful-shutdown-live-${leaseId}-23c47bfee3a4.json`)),
    amendment: boundedPath(root, rel(`native-candidate-amendment-${leaseId}-23c47bfee3a4.json`)),
    lowSpLog: boundedPath(root, rel('logs/20260925-091816-map.out.log')),
    incident: boundedPath(root, rel('runtime-incidents/20260925T033640Z-e1b65f39eb9e4e04b7154d1e93649710/incident.json')) };
}
const reference = (root, file) => ({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: digest(file) });
function validateSnapshot(snapshot, native) {
  const expectedRoot = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack\\.local\\ro-stack\\rathena\\';
  requireThat(snapshot?.pass === true && snapshot.openkore_runtime_count === 0 &&
    snapshot.dashboard_pid > 0 && snapshot.database_pid > 0 &&
    ['login', 'char', 'map'].every(role => snapshot.counts?.[role] === 1 &&
      Number.isInteger(snapshot.pids?.[role]) && snapshot.pids[role] > 0 &&
      snapshot.processes?.[role]?.pid === snapshot.pids[role] &&
      snapshot.processes[role].executable_path?.toLowerCase() ===
        `${expectedRoot}${role}-server.exe`.toLowerCase()), 'CURRENT_RUNTIME_UNHEALTHY');
  const dump = snapshot.procdump_receipt, identity = snapshot.procdump_process_identity;
  requireThat(dump?.procdumpAttachStatus === 'ATTACHED' && dump.mapPid === snapshot.pids.map &&
    dump.procdumpAttachedPid === snapshot.pids.map && dump.procdumpProcessId > 0 &&
    equalHash(dump.mapBinarySha256, native.new_binary_sha256) &&
    identity?.PROCESS_IDENTITY_MATCH === 'YES' && identity.target_pid === snapshot.pids.map &&
    identity.procdump_pid === dump.procdumpProcessId && identity.procdump_target_pid === snapshot.pids.map &&
    snapshot.procdump_account === 'NT AUTHORITY\\SYSTEM', 'CURRENT_PROCDUMP_INVALID');
}
function validateInput({ root, leaseId, owner, snapshot, apiHealth, governanceSha, instruction,
  expected = policy }) {
  requireThat(leaseId === expected.lease && owner === expected.owner, 'LEASE_OWNER_MISMATCH');
  const f = files(root, leaseId);
  const archived = fs.existsSync(f.archive), locked = fs.existsSync(f.lock);
  const finalized = fs.existsSync(f.receipt);
  const history = archived ? f.archive : f.lock;
  requireThat((archived || locked) && !(archived && locked) && (!archived || finalized),
    'FAILED_OPERATION_LOCK_STATE_INVALID');
  const failure = path.join(history, 'failure.json'), operation = path.join(history, 'operation.json');
  requireThat(fs.existsSync(failure) && fs.existsSync(operation), 'ORIGINAL_FAILURE_MISSING');
  requireThat(equalHash(digest(failure), expected.failureHash) &&
    equalHash(digest(operation), expected.operationHash), 'ORIGINAL_FAILURE_MUTATED');
  const failed = readJson(failure), op = readJson(operation);
  requireThat(failed.classification === 'RUNTIME_CONFIG_RECONCILIATION_FAILED' &&
    failed.error === 'NATIVE_RUNTIME_STOP_FAILED' && failed.stop_attempted === true &&
    failed.config_reverted === false && op.phase === 'RESTART_IN_PROGRESS' &&
    op.native_git_sha === expected.oldNative && op.lease_id === leaseId && op.lease_owner === owner &&
    op.changed_keys?.length === 2 && op.changed_keys.every(x =>
      (x.key === 'PersistentAgentSpThresholdPercent' && x.old_value === 20 && x.new_value === 0) ||
      (x.key === 'PersistentAgentSpSafePercent' && x.old_value === 40 && x.new_value === 0)),
  'ORIGINAL_FAILURE_SEMANTICS_INVALID');
  requireThat(equalHash(digest(f.rollback), expected.rollbackHash) &&
    equalHash(digest(f.config), expected.configHash) &&
    failed.rollback_digest === expected.rollbackHash && failed.current_config_digest === expected.configHash,
  'CONFIG_RECOVERY_DIGEST_INVALID');
  const config = fs.readFileSync(f.config, 'utf8');
  requireThat(/^\s*PersistentAgentSpThresholdPercent\s*=\s*0\s*$/m.test(config) &&
    /^\s*PersistentAgentSpSafePercent\s*=\s*0\s*$/m.test(config), 'CONFIG_ZERO_VALUES_MISSING');
  const lease = readJson(f.lease), state = readJson(f.state), pending = readJson(f.pending);
  requireThat(lease.lease_id === leaseId && lease.owner_task_id === owner && lease.status === 'ACTIVE' &&
    lease.promotion_mode === FIRST_PROMOTION && lease.web_deploy_git_sha === expected.web &&
    lease.native_deploy_git_sha === expected.native &&
    lease.active_native_candidate?.native_git_sha === expected.native &&
    lease.active_native_candidate.deployed === true, 'LEASE_IDENTITY_CHANGED');
  requireThat(pending.lease_id === leaseId && pending.owner_task_id === owner &&
    pending.web_git_sha === expected.web && pending.native_git_sha === expected.native &&
    pending.native_stage === 'NATIVE_STAGE_COMPLETE' && pending.native_stage_reconciled === true,
  'PENDING_PROMOTION_CHANGED');
  requireThat(legacyIdentity(state) && state.production_drift === 'OPEN' &&
    state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT' &&
    state.first_promotion_phase === NATIVE_STAGE_PHASE, 'PROMOTION_STATE_CHANGED');
  const native = readJson(f.native), graceful = readJson(f.graceful), amendment = readJson(f.amendment);
  requireThat(native.lease_id === leaseId && native.owner_task_id === owner &&
    native.native_git_sha === expected.native &&
    pending.native_receipt_path === rel('native-promotion-receipt-23c47bfee3a4.json') &&
    equalHash(digest(f.native), pending.native_receipt_sha256) &&
    native.artifacts?.length === 3 && native.artifacts.every(a =>
      equalHash(digest(boundedPath(root, a.path)), a.sha256)) &&
    equalHash(native.new_binary_sha256, lease.active_native_candidate.binary_sha256),
  'CURRENT_NATIVE_IDENTITY_INVALID');
  requireThat(graceful.lease_id === leaseId && graceful.owner_task_id === owner &&
    graceful.native_git_sha === expected.native && graceful.NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE === 'PASS' &&
    graceful.forced_termination_used === false &&
    equalHash(digest(f.graceful), pending.native_graceful_shutdown_live?.sha256) &&
    amendment.classification === 'NATIVE_CANDIDATE_AMENDED' &&
    amendment.old_native_git_sha === expected.oldNative && amendment.new_native_git_sha === expected.native &&
    equalHash(digest(f.amendment), lease.native_candidate_amendments?.[0]?.audit_sha256),
  'NATIVE_RECOVERY_EVIDENCE_INVALID');
  requireThat(equalHash(digest(f.lowSpLog), expected.lowSpLogHash), 'LOW_SP_EVIDENCE_CHANGED');
  const lowSp = fs.readFileSync(f.lowSpLog, 'utf8');
  requireThat(/AUTO_FARM_STARTED[^\n]*sp_threshold=0 sp_safe=0/.test(lowSp) &&
    /SKILL_FALLBACK[^\n]*/.test(lowSp) &&
    /AUTO_FARM_HIT[^\n]*hp=(\d+)->(\d+)/.test(lowSp) &&
    [...lowSp.matchAll(/AUTO_FARM_HIT[^\n]*hp=(\d+)->(\d+)/g)].some(m => Number(m[1]) > Number(m[2])) &&
    !lowSp.includes('GLOBAL_RECOVERY_TRIGGERED'), 'LOW_SP_LIVE_EVIDENCE_INCOMPLETE');
  const authorityFile = fs.existsSync(f.archiveAuthority) ? f.archiveAuthority :
    fs.existsSync(f.lockAuthority) ? f.lockAuthority : instruction;
  requireThat(typeof authorityFile === 'string' && fs.existsSync(authorityFile) &&
    equalHash(digest(authorityFile), expected.instructionHash), 'PROJECT_CONTROL_AUTHORITY_CHANGED');
  requireThat(equalHash(digest(f.incident), expected.incidentHash), 'V13_RECOVERY_EVIDENCE_CHANGED');
  const incident = readJson(f.incident);
  requireThat(incident.rootCauseStatus === 'UNKNOWN' && incident.recoveryPerformed === true &&
    incident.recoveryResult === 'RUNTIME_PORTS_HEALTHY', 'V13_RECOVERY_EVIDENCE_INVALID');
  validateSnapshot(snapshot, native);
  requireThat(apiHealth?.status === 200 && apiHealth.ok === true, 'CURRENT_API_UNHEALTHY');
  requireThat(/^[a-f0-9]{40}$/i.test(governanceSha), 'GOVERNANCE_SHA_REQUIRED');
  return { f, lease, state, pending, native, incident, finalized, archived, failure, operation,
    instruction: authorityFile };
}

export function finalizeRecoveredRuntimeConfig(args) {
  const { root, leaseId, owner, governanceSha, snapshot, execute = false } = args;
  const x = validateInput(args), { f, lease, state, pending } = x;
  const receiptRelative = rel(`runtime-config-failed-operation-finalization-${leaseId}.json`);
  if (x.finalized) {
    const receipt = readJson(f.receipt);
    requireThat(receipt.classification === 'RECOVERED_FAILED_OPERATION' &&
      receipt.final_state === 'FINALIZED' && receipt.lease_id === leaseId &&
      receipt.owner_task_id === owner && receipt.governance_git_sha === governanceSha &&
      equalHash(receipt.original_failure?.sha256, digest(x.failure)) &&
      equalHash(receipt.original_operation?.sha256, digest(x.operation)) &&
      receipt.original_failure?.path === rel(`runtime-config-failed-finalized-${leaseId}/failure.json`) &&
      receipt.original_operation?.path === rel(`runtime-config-failed-finalized-${leaseId}/operation.json`) &&
      [state, pending].every(value =>
        (value.runtime_config_failed_operation_finalization === undefined ||
          value.runtime_config_failed_operation_finalization === receiptRelative) &&
        (value.runtime_config_failed_operation_finalization_sha256 === undefined ||
          equalHash(value.runtime_config_failed_operation_finalization_sha256, digest(f.receipt)))),
    'FINALIZATION_RECEIPT_CONFLICT');
    const complete = x.archived && [state, pending].every(value =>
      value.runtime_config_failed_operation_finalization === receiptRelative &&
      equalHash(value.runtime_config_failed_operation_finalization_sha256, digest(f.receipt)));
    if (complete) return { eligible: true, already_finalized: true, receipt_path: receiptRelative,
      receipt_sha256: digest(f.receipt) };
    if (!execute) return { eligible: true, action: 'DRY_RUN_RESUME', receipt_path: receiptRelative,
      failed_operation_blocks_promotion: true };
    if (!x.archived) fs.renameSync(f.lock, f.archive);
    const receiptHash = digest(f.receipt);
    if (pending.runtime_config_failed_operation_finalization !== receiptRelative)
      replaceJson(f.pending, { ...pending, runtime_config_failed_operation_finalization: receiptRelative,
        runtime_config_failed_operation_finalization_sha256: receiptHash });
    if (state.runtime_config_failed_operation_finalization !== receiptRelative)
      replaceJson(f.state, { ...state, runtime_config_failed_operation_finalization: receiptRelative,
        runtime_config_failed_operation_finalization_sha256: receiptHash });
    return { eligible: true, resumed_finalization: true, receipt_path: receiptRelative,
      receipt_sha256: receiptHash, failed_operation_blocks_promotion: false,
      active_runtime_config_operation: 'NONE' };
  }
  const receipt = { schema_version: 'runtime-config-failed-operation-finalization-v1',
    classification: 'RECOVERED_FAILED_OPERATION', original_state: 'FAILED',
    recovery_state: 'RECOVERED', final_state: 'FINALIZED', first_restart_result: 'FAILED',
    first_restart_failure: 'NATIVE_RUNTIME_STOP_FAILED', lease_id: leaseId, owner_task_id: owner,
    web_git_sha: policy.web, deployed_native_git_sha: policy.native,
    governance_git_sha: governanceSha, finalized_at: new Date().toISOString(),
    original_failure: { path: rel(`runtime-config-failed-finalized-${leaseId}/failure.json`),
      sha256: digest(x.failure) },
    original_operation: { path: rel(`runtime-config-failed-finalized-${leaseId}/operation.json`),
      sha256: digest(x.operation) },
    rollback_config: reference(root, f.rollback), effective_config: reference(root, f.config),
    project_control_recovery_authorization: { path: rel(`runtime-config-failed-finalized-${leaseId}/project-control-authorization.txt`),
      sha256: digest(x.instruction),
      evidence_kind: 'PROJECT_CONTROL_CONTINUATION_ATTESTATION' },
    low_sp_live: { ...reference(root, f.lowSpLog), sp_threshold_percent: 0, sp_safe_percent: 0,
      global_recovery_triggered: false, weapon_fallback: true, authoritative_hp_delta: true },
    native_deploy: reference(root, f.native), native_candidate_amendment: reference(root, f.amendment),
    native_graceful_cycle: reference(root, f.graceful), v13_runtime_recovery: reference(root, f.incident),
    v13_incident_root_cause: 'UNKNOWN', current_runtime: snapshot, current_api_health: args.apiHealth,
    active_lease_before: reference(root, f.lease), baseline_mode: state.baseline_mode,
    production_drift: state.production_drift, first_promotion_complete: false,
    failed_operation_blocks_promotion: false, active_runtime_config_operation: 'NONE' };
  if (!execute) return { eligible: true, action: 'DRY_RUN', receipt, failed_operation_blocks_promotion: true };
  const originalHashes = Object.fromEntries(['lease', 'state', 'pending'].map(key => [key, digest(f[key])]));
  requireThat(!fs.existsSync(f.archive) && !fs.existsSync(f.receipt), 'FINALIZATION_OUTPUT_EXISTS');
  requireThat(Object.entries(originalHashes).every(([key, hash]) => equalHash(digest(f[key]), hash)),
    'FINALIZATION_INPUT_CHANGED');
  if (!fs.existsSync(f.lockAuthority)) fs.copyFileSync(x.instruction, f.lockAuthority, fs.constants.COPYFILE_EXCL);
  requireThat(equalHash(digest(f.lockAuthority), digest(x.instruction)), 'PROJECT_CONTROL_AUTHORITY_CHANGED');
  writeNew(f.receipt, receipt);
  fs.renameSync(f.lock, f.archive);
  const receiptHash = digest(f.receipt);
  replaceJson(f.pending, { ...pending, runtime_config_failed_operation_finalization: receiptRelative,
    runtime_config_failed_operation_finalization_sha256: receiptHash });
  replaceJson(f.state, { ...state, runtime_config_failed_operation_finalization: receiptRelative,
    runtime_config_failed_operation_finalization_sha256: receiptHash });
  return { eligible: true, classification: receipt.classification, receipt_path: receiptRelative,
    receipt_sha256: receiptHash, failed_operation_blocks_promotion: false,
    active_runtime_config_operation: 'NONE' };
}

async function main() {
  const argv = process.argv.slice(2);
  const a = Object.fromEntries(argv.flatMap((value, i) => value.startsWith('--') ? [[value.slice(2), argv[i + 1]]] : []));
  const root = path.resolve(a['production-root'] || '');
  requireThat(root.toLowerCase() === 'c:\\users\\administrator\\ghost-island-production\\ro-stack', 'CANONICAL_ROOT_REQUIRED');
  requireThat(['dry-run', 'finalize'].includes(a.action) && a.lease && a.owner, 'ARGUMENTS_REQUIRED');
  requireThat(a.action !== 'finalize' || a.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
  const governanceSha = git(sourceRoot, 'rev-parse', 'HEAD');
  requireThat(git(sourceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
    git(sourceRoot, 'remote', 'get-url', 'origin') === 'https://github.com/amadiz1988-boop/terminal-arpg.git' &&
    git(sourceRoot, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0] === governanceSha,
  'GOVERNANCE_GITHUB_MAIN_REQUIRED');
  const snapshot = await runtimeAdapter(root, a.owner, a.lease)('snapshot');
  let apiHealth;
  try { const r = await fetch('http://127.0.0.1:8788/api/health', { signal: AbortSignal.timeout(10000) });
    apiHealth = { status: r.status, ok: (await r.json()).ok === true }; }
  catch { apiHealth = { status: 0, ok: false }; }
  console.log(JSON.stringify(finalizeRecoveredRuntimeConfig({ root, leaseId: a.lease, owner: a.owner,
    governanceSha, snapshot, apiHealth,
    instruction: a['project-control-evidence'] ? path.resolve(a['project-control-evidence']) : undefined,
    execute: a.action === 'finalize' }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
