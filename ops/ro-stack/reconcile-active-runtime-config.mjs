#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, legacyIdentity, pendingPath, FIRST_PROMOTION, windowsPowerShellEnv } from './legacy-production-baseline.mjs';
import { nativeReceiptPath, nativeReceiptValid, equalHash, git } from './native-promotion-contract.mjs';
import { runtimeAdapter, NATIVE_STAGE_PHASE } from './deploy-native-candidate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '../..');
const configRelative = 'ops/ro-stack/stack.config.psd1';
const expected = Object.freeze({
  lease_id: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a',
  owner: 'F｜M1 最終整合',
  native_sha: 'a4c736d865eeedca398aad97aeff1c1036f2dc39',
  web_sha: '8cdb13fb88be7199aae15b81e55a9a89a5ec78c5',
  old_config_sha256: 'B967A29405B4BF7964DE2587439858D7B351BDC92314818022038094B6057701',
  source_config_sha256: 'F05B4AB1C359D06ED80D3A9DCAFF099A9116BC2E955F6097786F4137A1150272',
  changes: Object.freeze({ PersistentAgentSpThresholdPercent: [20, 0], PersistentAgentSpSafePercent: [40, 0] }),
  // Existing source/Production variance is recorded and preserved, never copied into Production.
  out_of_scope_source_variance: Object.freeze(['PersistentAgentServiceNpcAllowlist', 'PersistentAgentServiceMapAllowlist',
    'PersistentAgentM1SupplyEnabled', 'WebNativeSupplyPolicyEnabled'])
});
export const m1Policy = Object.freeze({
  mode: 'M1_V15', operation_suffix: '-m1-v15',
  lease_id: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a', owner: 'F｜M1 最終整合',
  native_sha: '18523076a6034ca3731aefb73bf41993f4a0ef06',
  web_sha: 'f90287a35c454dcae38f7d91b14d8658856c9093',
  old_config_sha256: 'CC4E1158991D54833D7E44A583DA8C7D7248A6AE205F87475F55BD81416E4B45',
  source_config_sha256: '42B406C3724E4B55FF7E03065A09007F4EAF6CF2E2F854A32CB3FF45F0756F95',
  dashboard_launcher_sha256: 'DC63578870F8B3245AC1A3FC1DB9D38C2EF30FE7912FE212676EF80F5F7A34B3',
  changes: Object.freeze(['PersistentAgentM1SupplyEnabled', 'WebNativeSupplyPolicyEnabled', 'WebM1AcceptanceFixtureEnabled']),
  out_of_scope_source_variance: Object.freeze(['PersistentAgentServiceMapAllowlist', 'PersistentAgentServiceNpcAllowlist'])
});
const check = (ok, code) => { if (!ok) throw Error(code); };
const hashBytes = b => createHash('sha256').update(b).digest('hex').toUpperCase();
const writeNew = (file, data) => fs.writeFileSync(file, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const replaceJson = (file, value) => { const tmp = file + '.' + randomUUID() + '.tmp'; writeNew(tmp, value); fs.renameSync(tmp, file); };
const runtimeDir = root => boundedPath(root, '.local/ro-stack');
const filesFor = (root, policy = expected) => {
  const dir = runtimeDir(root);
  return { dir, lease: path.join(dir, 'production-deployment-lease/lease.json'), state: path.join(dir, 'production-deployment-state.json'),
    pending: boundedPath(root, pendingPath), native: boundedPath(root, nativeReceiptPath),
    config: boundedPath(root, configRelative), lock: path.join(dir, `runtime-config-reconcile${policy.operation_suffix || ''}.lock`),
    receipt: path.join(dir, `runtime-config-reconciliation-${policy.lease_id}${policy.operation_suffix || ''}.json`) };
};

export function exactM1ConfigPatch(oldBytes, sourceBytes, spec = m1Policy) {
  check(spec.mode === 'M1_V15' && equalHash(hashBytes(oldBytes), spec.old_config_sha256) &&
    equalHash(hashBytes(sourceBytes), spec.source_config_sha256), 'M1_CONFIG_DIGEST_CHANGED');
  const variance = sourceVarianceKeys(oldBytes, sourceBytes);
  check(JSON.stringify(variance) === JSON.stringify([...spec.changes, ...spec.out_of_scope_source_variance].sort()),
    'UNCLASSIFIED_SOURCE_CONFIG_VARIANCE');
  const oldText = new TextDecoder('utf-8', { fatal: true }).decode(oldBytes);
  const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes);
  for (const key of spec.changes) {
    check(!new RegExp(`^\\s*${key}\\s*=`, 'm').test(oldText), `M1_KEY_NOT_ABSENT:${key}`);
    check(new RegExp(`^\\s*${key}\\s*=\\s*\\$false\\s*$`, 'm').test(sourceText), `M1_SOURCE_DEFAULT_NOT_FALSE:${key}`);
  }
  check(oldText.endsWith('\n}\n') && !oldText.includes('\r'), 'M1_CONFIG_FORMAT_CHANGED');
  const inserted = spec.changes.map(key => `  ${key} = $true\n`).join('');
  const nextText = oldText.slice(0, -2) + inserted + '}\n';
  const bytes = Buffer.from(nextText, 'utf8');
  check(nextText.replace(inserted, '') === oldText, 'M1_ROLLBACK_REMOVE_INVALID');
  return { bytes, sha256: hashBytes(bytes), changes: spec.changes.map(key => ({key,old_value:'ABSENT',new_value:true,rollback:'REMOVE'})),
    unrelated_config_change_count:0, source_variance_keys:variance };
}

export function configValue(bytes, key) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const lines = text.match(new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)(\\d+)([ \\t]*(?:#.*)?)$`, 'gm')) || [];
  check(lines.length === 1, 'CONFIG_KEY_CARDINALITY_INVALID');
  return Number(lines[0].match(/=[ \t]*(\d+)/)[1]);
}

export function sourceVarianceKeys(oldBytes, sourceBytes) {
  const assignments = bytes => {
    const map = new Map();
    for (const line of new TextDecoder('utf-8', { fatal: true }).decode(bytes).split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z]\w*)\s*=\s*(.+?)\s*$/);
      if (!match) continue;
      check(!map.has(match[1]), 'DUPLICATE_CONFIG_ASSIGNMENT');
      map.set(match[1], match[2]);
    }
    return map;
  };
  const old = assignments(oldBytes), source = assignments(sourceBytes);
  return [...new Set([...old.keys(), ...source.keys()])].filter(key => old.get(key) !== source.get(key)).sort();
}

export function exactConfigPatch(oldBytes, sourceBytes, spec = expected) {
  check(equalHash(hashBytes(sourceBytes), spec.source_config_sha256), 'CANONICAL_CONFIG_DIGEST_CHANGED');
  check(equalHash(hashBytes(oldBytes), spec.old_config_sha256), 'CURRENT_CONFIG_DIGEST_CHANGED');
  const variance = sourceVarianceKeys(oldBytes, sourceBytes);
  check(JSON.stringify(variance) === JSON.stringify([...Object.keys(spec.changes), ...spec.out_of_scope_source_variance].sort()),
    'UNCLASSIFIED_SOURCE_CONFIG_VARIANCE');
  let next = new TextDecoder('utf-8', { fatal: true }).decode(oldBytes);
  const changes = [];
  for (const [key, [oldValue, newValue]] of Object.entries(spec.changes)) {
    check(configValue(oldBytes, key) === oldValue, 'EXPECTED_OLD_CONFIG_VALUE_MISMATCH');
    check(configValue(sourceBytes, key) === newValue, 'CANONICAL_CONFIG_VALUE_MISMATCH');
    const re = new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)${oldValue}([ \\t]*(?:#.*)?)$`, 'm');
    next = next.replace(re, (_, a, b) => `${a}${newValue}${b}`);
    changes.push({ key, old_value: oldValue, new_value: newValue });
  }
  const result = Buffer.from(next, 'utf8');
  check(changes.every(x => configValue(result, x.key) === x.new_value), 'CONFIG_PATCH_INCOMPLETE');
  // Reconstruct the original byte-for-byte. This catches any unapproved edit.
  let reverse = next;
  for (const { key, old_value, new_value } of changes) {
    reverse = reverse.replace(new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)${new_value}([ \\t]*(?:#.*)?)$`, 'm'),
      (_, a, b) => `${a}${old_value}${b}`);
  }
  check(Buffer.from(reverse, 'utf8').equals(oldBytes), 'UNRELATED_CONFIG_CHANGE');
  return { bytes: result, changes, sha256: hashBytes(result), unrelated_config_change_count: 0,
    source_variance_keys: variance };
}

export function validateAuthority({ lease, state, pending, native, leaseId, owner, nativeValid = nativeReceiptValid, policy = expected }) {
  check(leaseId === policy.lease_id && owner === policy.owner && lease?.lease_id === leaseId &&
    lease.owner_task_id === owner && lease.status === 'ACTIVE' && lease.promotion_mode === FIRST_PROMOTION,
  'ACTIVE_LEASE_IDENTITY_MISMATCH');
  check(lease.native_deploy_git_sha === policy.native_sha && pending?.native_git_sha === policy.native_sha &&
    native?.native_git_sha === policy.native_sha, 'NATIVE_SHA_CHANGED');
  check(lease.web_deploy_git_sha === policy.web_sha && pending.web_git_sha === policy.web_sha, 'WEB_SHA_CHANGED');
  check(legacyIdentity(state) && state.production_drift === 'OPEN' &&
    state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT' &&
    state.first_promotion_phase === NATIVE_STAGE_PHASE, 'FIRST_PROMOTION_NOT_STAGED');
  check(pending.lease_id === leaseId && pending.owner_task_id === owner &&
    pending.native_stage === 'NATIVE_STAGE_COMPLETE' && pending.native_stage_reconciled === true,
  'NATIVE_PENDING_STAGE_INVALID');
  check(nativeValid(native, { nativeSha: policy.native_sha, leaseId,
    manifestHash: lease.native_candidate_manifest_sha256 }) && native.owner_task_id === owner &&
    equalHash(pending.native_receipt_sha256, pending.native_receipt_actual_sha256), 'NATIVE_STAGE_RECEIPT_INVALID');
  return true;
}

function validateRuntime(snapshot, native, { oldPids, newRuntime = false } = {}) {
  check(snapshot?.pass === true && snapshot.openkore_runtime_count === 0 &&
    ['login', 'char', 'map'].every(n => snapshot.counts?.[n] === 1 && Number.isInteger(snapshot.pids?.[n]) && snapshot.pids[n] > 0),
  'SINGLE_RUNTIME_HEALTH_FAILED');
  check(snapshot.procdump_receipt?.mapPid === snapshot.pids.map &&
    snapshot.procdump_receipt.procdumpAttachStatus === 'ATTACHED' &&
    !!snapshot.procdump_receipt.runtimeGenerationId && snapshot.procdump_receipt.procdumpProcessId > 0 &&
    snapshot.procdump_account === 'NT AUTHORITY\\SYSTEM' &&
    snapshot.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES' &&
    equalHash(snapshot.procdump_receipt.mapBinarySha256, native.new_binary_sha256), 'PROCDUMP_RECEIPT_INVALID');
  if (oldPids) check(['login', 'char', 'map'].every(n =>
    newRuntime ? snapshot.pids[n] !== oldPids[n] : snapshot.pids[n] === oldPids[n]), 'RUNTIME_PID_IDENTITY_INVALID');
  return true;
}

function verifyBinaries(root, native) {
  check(native.artifacts?.length === 3 && native.artifacts.every(x => equalHash(digest(boundedPath(root, x.path)), x.sha256)),
  'NATIVE_BINARIES_CHANGED');
  return native.artifacts.map(x => ({ path: x.path, sha256: x.sha256 }));
}

function verifySourceAuthority(sourceGitSha, sourceBytes, { verifyGit = true, policy = expected } = {}) {
  check(equalHash(hashBytes(sourceBytes), policy.source_config_sha256), 'CANONICAL_CONFIG_DIGEST_CHANGED');
  if (verifyGit) {
    check(git(sourceRoot, 'rev-parse', 'HEAD') === sourceGitSha &&
      git(sourceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
      git(sourceRoot, 'remote', 'get-url', 'origin') === 'https://github.com/amadiz1988-boop/terminal-arpg.git',
    'GOVERNANCE_SOURCE_INVALID');
    git(sourceRoot, 'cat-file', '-e', `${sourceGitSha}:${configRelative}`);
    git(sourceRoot, 'diff', '--quiet', sourceGitSha, '--', configRelative);
    const tip = git(sourceRoot, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
    git(sourceRoot, 'merge-base', '--is-ancestor', sourceGitSha, tip);
  }
  return true;
}

export async function reconcileActiveRuntimeConfig({ root, leaseId, owner, sourceBytes, sourceGitSha,
  adapter, webAdapter, execute = false, verifyGit = true, nativeValid, policy = expected,
  beforeStop = () => {}, pollAttempts = 24, pollDelayMs = 2500 }) {
  const f = filesFor(root, policy);
  const rollback = path.join(f.dir, `runtime-config-rollback-${leaseId}${policy.operation_suffix || ''}.psd1`);
  const lease = readJson(f.lease), state = readJson(f.state), pending = readJson(f.pending), native = readJson(f.native);
  pending.native_receipt_actual_sha256 = digest(f.native);
  validateAuthority({ lease, state, pending, native, leaseId, owner, nativeValid, policy });
  verifySourceAuthority(sourceGitSha, sourceBytes, { verifyGit, policy });
  const already = fs.existsSync(f.receipt);
  if (already) {
    const receipt = readJson(f.receipt);
    check(receipt.classification === 'RUNTIME_CONFIG_RECONCILED' && receipt.lease_id === leaseId &&
      receipt.native_git_sha === policy.native_sha && equalHash(digest(f.config), receipt.new_config_digest) &&
      equalHash(pending.runtime_config_reconciliation_sha256, digest(f.receipt)) &&
      equalHash(state.runtime_config_reconciliation_sha256, digest(f.receipt)), 'RECONCILIATION_RECEIPT_CONFLICT');
    return { eligible: true, already_reconciled: true, receipt_path: path.relative(root, f.receipt) };
  }
  check(!fs.existsSync(f.lock), 'RECONCILIATION_OPERATION_IN_PROGRESS');
  const oldBytes = fs.readFileSync(f.config), plan = policy.mode === 'M1_V15'
    ? exactM1ConfigPatch(oldBytes, sourceBytes, policy) : exactConfigPatch(oldBytes, sourceBytes, policy);
  const artifacts = verifyBinaries(root, native);
  const before = await adapter('snapshot');
  validateRuntime(before, native, { oldPids: native.new_pids });
  const launcher = boundedPath(root, 'ops/ro-stack/ro-stack.ps1');
  const launcherBytes = fs.readFileSync(launcher);
  const launcherText = launcherBytes.toString('utf8');
  check(/\$config\s*=\s*Invoke-Expression\s*\(Get-Content\s*\(Join-Path\s+\$scriptRoot\s+'stack\.config\.psd1'\)\s*-Raw\)/.test(launcherText) &&
    /Start-Process\s+-FilePath\s+\$path/.test(launcherText) &&
    (policy.mode === 'M1_V15'
      ? /PERSISTENT_AGENT_M1_SUPPLY_ENABLED\s*=\s*if\s*\(\$config\.PersistentAgentM1SupplyEnabled\)/.test(launcherText)
      : /PERSISTENT_AGENT_SP_THRESHOLD_PCT\s*=\s*\[string\]\$config\.PersistentAgentSpThresholdPercent/.test(launcherText) &&
        /PERSISTENT_AGENT_SP_SAFE_PCT\s*=\s*\[string\]\$config\.PersistentAgentSpSafePercent/.test(launcherText)),
  'STARTUP_CONFIG_BINDING_UNVERIFIED');
  const dashboardLauncher = policy.mode === 'M1_V15' ? boundedPath(root, 'ops/ro-stack/dashboard-service.ps1') : null;
  if (dashboardLauncher) {
    const text = fs.readFileSync(dashboardLauncher, 'utf8');
    check(equalHash(digest(dashboardLauncher), policy.dashboard_launcher_sha256) &&
      /PA_NATIVE_SUPPLY_POLICY_ENABLED=if\(\$stackConfig\.WebNativeSupplyPolicyEnabled\)/.test(text) &&
      /RO_M1_ACCEPTANCE_FIXTURE_ENABLED=if\(\$stackConfig\.WebM1AcceptanceFixtureEnabled\)/.test(text),
    'DASHBOARD_CONFIG_BINDING_UNVERIFIED');
    check(typeof webAdapter === 'function', 'DASHBOARD_ADAPTER_REQUIRED');
  }
  const oldHashes = Object.fromEntries(['lease', 'state', 'pending', 'native'].map(k => [k, digest(f[k])]));
  const report = { eligible: true, action: execute ? 'APPLY' : 'DRY_RUN', lease_id: leaseId, lease_owner: owner,
    promotion_id: `${FIRST_PROMOTION}:${pending.started_at}`, native_git_sha: policy.native_sha,
    native_stage_receipt: nativeReceiptPath, native_stage_receipt_sha256: oldHashes.native,
    config_source_git_sha: sourceGitSha, config_source_path: configRelative,
    config_source_digest: hashBytes(sourceBytes), old_config_digest: hashBytes(oldBytes), new_config_digest: plan.sha256,
    changed_keys: plan.changes, unrelated_config_change_count: 0,
    source_variance_keys: plan.source_variance_keys,
    out_of_scope_source_variance_preserved: policy.out_of_scope_source_variance,
    restart_required: true, rollback_snapshot_available: fs.existsSync(rollback),
    rollback_snapshot_creatable: !fs.existsSync(rollback),
    current_runtime_pids: before.pids, current_procdump_receipt: before.procdump_receipt,
    current_procdump_process_identity: before.procdump_process_identity,
    current_procdump_account: before.procdump_account,
    launcher_sha256: hashBytes(launcherBytes), dashboard_launcher_sha256: dashboardLauncher ? digest(dashboardLauncher) : undefined,
    first_promotion_complete: false };
  if (!execute) return report;
  check(!fs.existsSync(rollback), 'ROLLBACK_SNAPSHOT_CONFLICT');
  fs.mkdirSync(f.lock);
  const operation = path.join(f.lock, 'operation.json');
  let stopAttempted = false;
  try {
    writeNew(rollback, oldBytes);
    writeNew(operation, { ...report, started_at: new Date().toISOString(),
      rollback_reference: path.relative(root, rollback).replaceAll('\\', '/'),
      rollback_digest: hashBytes(oldBytes), phase: 'PRE_RESTART' });
    check(Object.entries(oldHashes).every(([k, v]) => equalHash(digest(f[k]), v)) &&
      equalHash(digest(f.config), report.old_config_digest) && equalHash(digest(launcher), report.launcher_sha256),
    'PRE_APPLY_INPUT_CHANGED');
    replaceJson(path.join(f.lock, 'operation.json'), { ...readJson(operation), phase: 'CONFIG_PATCH' });
    const configTmp = f.config + '.' + randomUUID() + '.tmp';
    writeNew(configTmp, plan.bytes); fs.renameSync(configTmp, f.config);
    check(equalHash(digest(f.config), plan.sha256) && plan.changes.every(x =>
      policy.mode === 'M1_V15'
        ? new RegExp(`^\\s*${x.key}\\s*=\\s*\\$true\\s*$`, 'm').test(fs.readFileSync(f.config, 'utf8'))
        : configValue(fs.readFileSync(f.config), x.key) === x.new_value), 'APPLIED_CONFIG_INVALID');
    await beforeStop();
    stopAttempted = true;
    replaceJson(operation, { ...readJson(operation), phase: 'RESTART_IN_PROGRESS' });
    await adapter('stop');
    await adapter('start');
    let after;
    for (let i = 0; i < pollAttempts; i++) {
      after = await adapter('snapshot');
      if (after?.pass && after?.procdump_receipt?.procdumpAttachStatus === 'ATTACHED') break;
      await new Promise(resolve => setTimeout(resolve, pollDelayMs));
    }
    validateRuntime(after, native, { oldPids: before.pids, newRuntime: true });
    check(after.procdump_receipt.runtimeGenerationId !== before.procdump_receipt.runtimeGenerationId &&
      after.procdump_receipt.procdumpProcessId !== before.procdump_receipt.procdumpProcessId,
    'PROCDUMP_NOT_REATTACHED');
    check(before.dashboard_pid === after.dashboard_pid && before.database_pid === after.database_pid,
      'NON_NATIVE_RUNTIME_CHANGED');
    if (dashboardLauncher) {
      await webAdapter('stop');
      await webAdapter('start');
      const webAfter = await adapter('snapshot');
      validateRuntime(webAfter, native, { oldPids: after.pids });
      check(webAfter.dashboard_pid !== before.dashboard_pid && webAfter.database_pid === before.database_pid &&
        equalHash(digest(dashboardLauncher), report.dashboard_launcher_sha256), 'DASHBOARD_RESTART_NOT_ATTESTED');
      after = webAfter;
    }
    check(equalHash(digest(f.config), plan.sha256) && equalHash(digest(launcher), report.launcher_sha256),
      'STARTUP_CONFIG_CHANGED_DURING_RESTART');
    verifyBinaries(root, native);
    check(Object.entries(oldHashes).every(([k, v]) => equalHash(digest(f[k]), v)), 'PROMOTION_IDENTITY_CHANGED');
    const archive = path.join(f.dir, `runtime-config-reconciled-${leaseId}${policy.operation_suffix || ''}`);
    check(!fs.existsSync(archive), 'RECONCILIATION_ARCHIVE_EXISTS');
    const receiptRollback = path.relative(root, rollback).replaceAll('\\', '/');
    const receipt = { ...report, schema_version: 'runtime-config-reconciliation-v1', classification: 'RUNTIME_CONFIG_RECONCILED',
      native_binary_hashes: artifacts, old_runtime_pids: before.pids, new_runtime_pids: after.pids,
      runtime_health: after, startup_runtime_attestation: { method: policy.mode === 'M1_V15' ? 'PINNED_NATIVE_AND_WEB_LAUNCHERS_NEW_PROCESSES' : 'PINNED_LAUNCHER_CONFIG_AND_NEW_MAP_PROCESS',
        launcher_sha256: report.launcher_sha256, config_sha256: plan.sha256,
        map_pid: after.pids.map, map_started_at: after.processes?.map?.started_at,
        ...(policy.mode === 'M1_V15' ? {dashboard_pid: after.dashboard_pid,
          dashboard_launcher_sha256: report.dashboard_launcher_sha256,
          m1_supply_enabled: true, web_native_supply_policy_enabled: true,
          web_m1_acceptance_fixture_enabled: true} : {sp_threshold_percent: 0, sp_safe_percent: 0}) },
      old_procdump_reference: before.procdump_receipt, new_procdump_receipt: after.procdump_receipt,
      new_procdump_process_identity: after.procdump_process_identity,
      new_procdump_account: after.procdump_account, openkore_runtime_count: 0,
      reconciled_at: new Date().toISOString(), governance_tool_sha: sourceGitSha,
      rollback_reference: receiptRollback, rollback_digest: hashBytes(oldBytes),
      first_promotion_complete: false, baseline_mode: 'LEGACY_PRE_GITHUB_FIRST', production_drift: 'OPEN' };
    check(receipt.startup_runtime_attestation.map_started_at &&
      new Date(receipt.startup_runtime_attestation.map_started_at).getTime() >
      new Date(before.processes?.map?.started_at).getTime(), 'MAP_STARTUP_NOT_NEW');
    writeNew(f.receipt, receipt);
    const receiptHash = digest(f.receipt), receiptRel = path.relative(root, f.receipt).replaceAll('\\', '/');
    replaceJson(f.pending, { ...pending, native_receipt_actual_sha256: undefined,
      runtime_config_reconciliation: receiptRel, runtime_config_reconciliation_sha256: receiptHash });
    replaceJson(f.state, { ...state, runtime_config_reconciled: true,
      runtime_config_reconciliation: receiptRel, runtime_config_reconciliation_sha256: receiptHash });
    replaceJson(operation, { ...readJson(operation), phase: 'COMPLETE', receipt_sha256: receiptHash,
      rollback_reference: receiptRollback });
    fs.renameSync(f.lock, archive);
    return { eligible: true, classification: 'RUNTIME_CONFIG_RECONCILED', receipt_path: receiptRel,
      receipt_sha256: receiptHash, new_runtime_pids: after.pids, first_promotion_complete: false };
  } catch (error) {
    let reverted = false;
    if (!stopAttempted && fs.existsSync(rollback) && equalHash(digest(f.config), plan.sha256)) {
      const tmp = f.config + '.' + randomUUID() + '.tmp';
      writeNew(tmp, fs.readFileSync(rollback)); fs.renameSync(tmp, f.config);
      reverted = equalHash(digest(f.config), hashBytes(oldBytes));
    }
    const leaseNow = readJson(f.lease), stateNow = readJson(f.state);
    writeNew(path.join(f.lock, 'failure.json'), { classification: 'RUNTIME_CONFIG_RECONCILIATION_FAILED',
      error: error.message, failed_at: new Date().toISOString(), stop_attempted: stopAttempted,
      config_reverted: reverted, current_config_digest: digest(f.config), rollback_reference: path.relative(root, rollback).replaceAll('\\', '/'),
      rollback_digest: hashBytes(oldBytes), rollback_snapshot_available: fs.existsSync(rollback) &&
        equalHash(digest(rollback), hashBytes(oldBytes)), lease_held: leaseNow.lease_id === leaseId &&
        leaseNow.owner_task_id === owner && leaseNow.status === 'ACTIVE', lease_release_attempted: false,
      production_drift: stateNow.production_drift, first_promotion_complete: false,
      recovery: 'F validates the current single runtime, lease and config hash; restore the pinned rollback config through a controlled recovery decision, then use the existing adapter. Retain this journal.' });
    throw error;
  }
}

export function dashboardServiceAdapter(root, policy = m1Policy) {
  const launcher = boundedPath(root, 'ops/ro-stack/dashboard-service.ps1');
  return async action => {
    check(['stop', 'start'].includes(action) && equalHash(digest(launcher), policy.dashboard_launcher_sha256),
      'DASHBOARD_LAUNCHER_CHANGED');
    const logs = boundedPath(root, '.local/ro-stack/logs');
    fs.mkdirSync(logs, { recursive: true });
    const base = path.join(logs, `m1-config-dashboard-${action}-${randomUUID()}`);
    const out = fs.openSync(base + '.out.log', 'wx'), err = fs.openSync(base + '.err.log', 'wx');
    let result;
    try {
      result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-Action', action],
        { windowsHide:true, timeout:30000, env:windowsPowerShellEnv(), stdio:['ignore',out,err] });
    } finally { fs.closeSync(out); fs.closeSync(err); }
    check(result.status === 0 && !result.error, `DASHBOARD_${action.toUpperCase()}_FAILED`);
  };
}

async function main() {
  const argv = process.argv.slice(2), a = Object.fromEntries(argv.flatMap((x, i) => x.startsWith('--') ? [[x.slice(2), argv[i + 1]]] : []));
  const root = path.resolve(a['production-root'] || '');
  check(root.toLowerCase() === 'c:\\users\\administrator\\ghost-island-production\\ro-stack', 'CANONICAL_ROOT_REQUIRED');
  check(a.lease && a.owner && ['dry-run', 'apply'].includes(a.action), 'ARGUMENTS_REQUIRED');
  check(a.action !== 'apply' || a.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
  check(!a.profile || a.profile === 'M1_V15', 'PROFILE_NOT_ALLOWED');
  const policy = a.profile === 'M1_V15' ? m1Policy : expected;
  const sourceGitSha = git(sourceRoot, 'rev-parse', 'HEAD');
  const result = await reconcileActiveRuntimeConfig({ root, leaseId: a.lease, owner: a.owner,
    sourceBytes: fs.readFileSync(path.join(sourceRoot, configRelative)), sourceGitSha,
    adapter: runtimeAdapter(root, a.owner, a.lease),
    webAdapter: policy.mode === 'M1_V15' ? dashboardServiceAdapter(root, policy) : undefined,
    policy, execute: a.action === 'apply' });
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(JSON.stringify({ eligible: false, error: error.message })); process.exitCode = 1; });
