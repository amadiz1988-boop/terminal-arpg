#!/usr/bin/env node
// Same-lease, two-key M1 service allowlist alignment. Preserve all other
// Production config, including the three already-enabled M1 feature flags.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, legacyIdentity } from './legacy-production-baseline.mjs';
import { equalHash, nativeReceiptValid } from './native-promotion-contract.mjs';
import { sourceVarianceKeys } from './reconcile-active-runtime-config.mjs';
import { runtimeAdapter } from './deploy-native-candidate.mjs';

export const POLICY = Object.freeze({
  lease: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a',
  owner: 'F｜M1 最終整合',
  nativeSha: 'fb4dcc735536228b3da76f809683a8d01e56b7dc',
  webSha: '8d2d4ca31ef430a12ea13f15ccf426472010c183',
  source: 'ops/ro-stack/stack.config.psd1',
  preimage: '32579CB03C85AC3CBD760A3078A56FBA758DA9CF77CA62D11CD8146AFF63EBA4',
  sourceImage: '42B406C3724E4B55FF7E03065A09007F4EAF6CF2E2F854A32CB3FF45F0756F95',
  keys: Object.freeze(['PersistentAgentServiceMapAllowlist', 'PersistentAgentServiceNpcAllowlist']),
  preservedOverrides: Object.freeze(['PersistentAgentM1SupplyEnabled',
    'WebM1AcceptanceFixtureEnabled', 'WebNativeSupplyPolicyEnabled']),
});
const canonicalProduction = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const need = (ok, code) => { if (!ok) throw Error(code); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const run = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  need(r.status === 0, 'GIT_PROVENANCE_FAILED:' + args[0]);
  return r.stdout.trim();
};
const atomicBytes = (file, bytes) => {
  const temp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, bytes, { flag: 'wx' });
  try { fs.renameSync(temp, file); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
};
const atomicJson = (file, value) => atomicBytes(file, JSON.stringify(value, null, 2) + '\n');

export function exactServiceAllowlistPatch(before, source, policy = POLICY) {
  const oldText = before.toString('utf8'), sourceText = source.toString('utf8');
  const variance = sourceVarianceKeys(before, source);
  need(JSON.stringify(variance) === JSON.stringify([...policy.keys, ...policy.preservedOverrides].sort()),
    'UNCLASSIFIED_CONFIG_VARIANCE');
  let next = oldText;
  const changes = [];
  for (const key of policy.keys) {
    const expression = new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)(@\\([^\\r\\n]*\\))$`, 'm');
    const oldMatch = oldText.match(expression), sourceMatch = sourceText.match(expression);
    need(oldMatch && sourceMatch && oldMatch[0] !== sourceMatch[0], 'ALLOWLIST_KEY_MISSING_OR_UNCHANGED:' + key);
    next = next.replace(expression, (_, prefix) => prefix + sourceMatch[2]);
    changes.push({ key, old_value: oldMatch[2], new_value: sourceMatch[2] });
  }
  let reverse = next;
  for (const { key, old_value } of changes) {
    const expression = new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)(@\\([^\\r\\n]*\\))$`, 'm');
    reverse = reverse.replace(expression, (_, prefix) => prefix + old_value);
  }
  need(reverse === oldText, 'ALLOWLIST_ROLLBACK_NOT_EXACT');
  const result = Buffer.from(next, 'utf8');
  need(sourceVarianceKeys(result, source).join(',') === policy.preservedOverrides.join(','),
    'NON_ALLOWLIST_SOURCE_VARIANCE_CHANGED');
  return { bytes: result, changes, unrelatedChanges: 0,
    preservedOverrides: policy.preservedOverrides };
}

async function preflight(rootPath) {
  const root = path.resolve(rootPath);
  need(root.toLowerCase() === canonicalProduction.toLowerCase(), 'PRODUCTION_ROOT_INVALID');
  const governance = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const head = run(governance, 'rev-parse', 'HEAD');
  need(run(governance, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
    run(governance, 'remote', 'get-url', 'origin') === 'https://github.com/amadiz1988-boop/terminal-arpg.git' &&
    run(governance, 'ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0] === head,
    'GOVERNANCE_GITHUB_MAIN_MISMATCH');
  const source = boundedPath(governance, POLICY.source);
  const blob = spawnSync('git', ['show', `${head}:${POLICY.source}`],
    { cwd: governance, encoding: 'buffer', windowsHide: true, timeout: 30000 });
  need(blob.status === 0 && fs.readFileSync(source).toString('utf8').replaceAll('\r\n', '\n') ===
    blob.stdout.toString('utf8').replaceAll('\r\n', '\n') &&
    equalHash(digest(source), POLICY.sourceImage), 'SOURCE_CONFIG_BLOB_CHANGED');
  const target = boundedPath(root, POLICY.source);
  need(equalHash(digest(target), POLICY.preimage), 'PRODUCTION_CONFIG_PREIMAGE_CHANGED');
  const patch = exactServiceAllowlistPatch(fs.readFileSync(target), fs.readFileSync(source));
  const local = boundedPath(root, '.local/ro-stack');
  const leaseFile = path.join(local, 'production-deployment-lease/lease.json');
  const pendingFile = path.join(local, 'first-github-first-promotion.pending.json');
  const stateFile = path.join(local, 'production-deployment-state.json');
  const lease = read(leaseFile), pending = read(pendingFile), state = read(stateFile);
  const receiptFile = boundedPath(root, pending.native_receipt_path || '');
  const nativeReceipt = read(receiptFile);
  need(lease.status === 'ACTIVE' && lease.lease_id === POLICY.lease &&
    lease.owner_task_id === POLICY.owner && lease.native_deploy_git_sha === POLICY.nativeSha &&
    lease.web_deploy_git_sha === POLICY.webSha && pending.lease_id === POLICY.lease &&
    pending.owner_task_id === POLICY.owner && pending.native_git_sha === POLICY.nativeSha &&
    pending.web_git_sha === POLICY.webSha && lease.active_native_candidate?.deployed === true &&
    pending.native_graceful_shutdown_live?.result === 'PASS' &&
    state.baseline_mode === 'LEGACY_PRE_GITHUB_FIRST' && state.production_drift === 'OPEN' &&
    state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' && legacyIdentity(state) &&
    !lease.native_service_allowlist_config && !pending.native_service_allowlist_config &&
    equalHash(digest(receiptFile), pending.native_receipt_sha256) &&
    nativeReceiptValid(nativeReceipt, { nativeSha: POLICY.nativeSha, leaseId: POLICY.lease,
      manifestHash: lease.native_candidate_manifest_sha256 }),
    'ACTIVE_FIRST_PROMOTION_LEASE_INVALID');
  const runtime = await runtimeAdapter(root, POLICY.owner, POLICY.lease)('snapshot');
  need(runtime.pass === true && runtime.openkore_runtime_count === 0 &&
    runtime.procdump_receipt?.mapPid === runtime.pids?.map &&
    runtime.procdump_receipt?.procdumpAttachStatus === 'ATTACHED', 'RUNTIME_HEALTH_INVALID');
  const artifactDir = path.join(local, `native-service-allowlist-config-${POLICY.lease}-${POLICY.nativeSha.slice(0, 12)}`);
  const lock = artifactDir + '.lock';
  need(!fs.existsSync(artifactDir) && !fs.existsSync(lock), 'CONFIG_ARTIFACT_ALREADY_EXISTS');
  return { root, head, target, patch, leaseFile, pendingFile, stateFile, lease, pending,
    artifactDir, lock, hashes: { target: digest(target), lease: digest(leaseFile),
      pending: digest(pendingFile), state: digest(stateFile) } };
}

async function deploy(root) {
  const p = await preflight(root);
  fs.mkdirSync(p.lock);
  const beforeLease = fs.readFileSync(p.leaseFile), beforePending = fs.readFileSync(p.pendingFile);
  const backup = path.join(p.lock, 'preimage.psd1');
  let replaced = false;
  try {
    fs.copyFileSync(p.target, backup, fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(backup), POLICY.preimage) &&
      equalHash(digest(p.target), p.hashes.target) &&
      equalHash(digest(p.leaseFile), p.hashes.lease) &&
      equalHash(digest(p.pendingFile), p.hashes.pending) &&
      equalHash(digest(p.stateFile), p.hashes.state), 'PREDEPLOY_INPUT_CHANGED');
    atomicBytes(p.target, p.patch.bytes);
    replaced = true;
    const imageSha = digest(p.target);
    need(equalHash(imageSha, createHash('sha256').update(p.patch.bytes).digest('hex')),
      'POSTDEPLOY_CONFIG_HASH_MISMATCH');
    const receiptFile = path.join(p.lock, 'receipt.json');
    const receipt = { schema_version: 'native-service-allowlist-config-v1',
      lease_id: POLICY.lease, owner_task_id: POLICY.owner, native_git_sha: POLICY.nativeSha,
      web_git_sha: POLICY.webSha, governance_git_sha: p.head,
      source_path: POLICY.source, destination_path: POLICY.source,
      preimage_sha256: POLICY.preimage, image_sha256: imageSha,
      source_sha256: POLICY.sourceImage, changes: p.patch.changes,
      preserved_overrides: p.patch.preservedOverrides, unrelated_changes: 0,
      rollback_model: 'RESTORE_EXACT_PREIMAGE', runtime_load: 'PENDING_RESTART',
      deployed_at: new Date().toISOString() };
    fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    const ref = { receipt: path.relative(p.root, path.join(p.artifactDir, 'receipt.json')).replaceAll('\\', '/'),
      sha256: digest(receiptFile) };
    atomicJson(p.pendingFile, { ...p.pending, native_service_allowlist_config: ref });
    atomicJson(p.leaseFile, { ...p.lease, native_service_allowlist_config: ref });
    fs.renameSync(p.lock, p.artifactDir);
    return { result: 'DEPLOYED_PENDING_RUNTIME_LOAD', receipt: ref.receipt,
      receipt_sha256: ref.sha256, image_sha256: imageSha,
      backup_sha256: digest(path.join(p.artifactDir, 'preimage.psd1')) };
  } catch (error) {
    if (replaced && fs.existsSync(backup)) atomicBytes(p.target, fs.readFileSync(backup));
    if (!equalHash(digest(p.leaseFile), p.hashes.lease)) atomicBytes(p.leaseFile, beforeLease);
    if (!equalHash(digest(p.pendingFile), p.hashes.pending)) atomicBytes(p.pendingFile, beforePending);
    fs.writeFileSync(path.join(p.lock, 'failure.json'), JSON.stringify({ error: error.message,
      preimage_restored: equalHash(digest(p.target), POLICY.preimage) }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, argv) =>
      value.startsWith('--') ? [[value.slice(2), argv[index + 1]]] : []));
    need(['dry-run', 'deploy'].includes(args.action) && args.prod, 'ARGUMENTS_REQUIRED');
    if (args.action === 'deploy') need(args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
    console.log(JSON.stringify(args.action === 'deploy' ? await deploy(args.prod) :
      { result: 'PREFLIGHT_PASS', ...(await preflight(args.prod)).patch,
        bytes: undefined, production_touched: false }));
  } catch (error) {
    console.error(JSON.stringify({ result: 'BLOCKED', error: error.message }));
    process.exitCode = 2;
  }
}
