#!/usr/bin/env node
// Rebind the same first-promotion lease only after a failed Web attempt restored every preimage.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { admission, readManifest, validateHeader } from './web-complete-manifest.mjs';
import { verifyNativeStage } from './native-promotion-contract.mjs';
import { FIRST_PROMOTION, legacyIdentity, pendingPath, readJson } from './legacy-production-baseline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '../..');
const canonicalProduction = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const requiredAddition = 'ops/ro-stack/persistent-agent/world-map-teleport-source.json';
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const fail = code => { throw Error(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const inside = (root, file) => {
  const resolved = path.resolve(file);
  if (!resolved.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep)) fail('AMENDMENT_PATH_OUTSIDE_PRODUCTION');
  let cursor = path.resolve(root);
  for (const segment of path.relative(cursor, resolved).split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('AMENDMENT_REPARSE_PATH');
  }
  return resolved;
};
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: sourceRoot, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) fail(`GOVERNANCE_GIT_FAILED:${args[0]}`);
  return result.stdout.trim();
};

export function validateAmendment({ lease, pending, state, oldManifest, newManifest, oldHash, failure, oldCount }) {
  if (!legacyIdentity(state) || state.production_drift !== 'OPEN' ||
      state.first_promotion_phase !== 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE') fail('NATIVE_STAGE_STATE_REQUIRED');
  if (lease?.status !== 'ACTIVE' || lease.promotion_mode !== FIRST_PROMOTION ||
      !lease.lease_id || !lease.owner_task_id || lease.admission_manifest_sha256 !== oldHash ||
      lease.manifest_digest !== oldManifest.manifest_digest) fail('LEASE_OLD_MANIFEST_MISMATCH');
  if (pending?.lease_id !== lease.lease_id || pending.owner_task_id !== lease.owner_task_id ||
      pending.web_git_sha !== lease.web_deploy_git_sha || pending.native_git_sha !== lease.native_deploy_git_sha ||
      !pending.native_receipt_sha256) fail('PENDING_NATIVE_STAGE_MISMATCH');
  for (const key of ['schema_version', 'candidate_id', 'canonical_repository', 'canonical_branch',
    'generated_at', 'removed_files', 'required_assets', 'intentional_removals',
    'web_git_sha', 'candidate_commit', 'candidate_root', 'production_root',
    'asset_release', 'asset_package_sha256', 'asset_manifest_sha256', 'private_asset_package_root',
    'promotion_mode', 'candidate_native_commit', 'native_candidate_manifest', 'first_promotion_evidence']) {
    if (!same(oldManifest[key], newManifest[key])) fail(`MANIFEST_IDENTITY_CHANGED:${key}`);
  }
  if (oldManifest.web_git_sha !== lease.web_deploy_git_sha ||
      oldManifest.candidate_native_commit !== lease.native_deploy_git_sha ||
      newManifest.web_git_sha !== lease.web_deploy_git_sha) fail('MANIFEST_LEASE_SHA_MISMATCH');
  const oldFiles = new Map(oldManifest.files.map(row => [row.path, row]));
  const newFiles = new Map(newManifest.files.map(row => [row.path, row]));
  if (newFiles.size !== oldFiles.size + 1 || !newFiles.has(requiredAddition) || oldFiles.has(requiredAddition) ||
      [...oldFiles].some(([name, row]) => !same(row, newFiles.get(name)))) fail('WEB_FILESET_CHANGE_EXCEEDS_MISSING_STARTUP_ASSET');
  if (failure?.mode !== 'DEPLOY' || failure.status !== 'FAILED' || failure.result !== 'FAIL_CLOSED' ||
      failure.failure_phase !== 'DASHBOARD_START' || failure.error !== 'DASHBOARD_SERVICE_start_FAILED:1' ||
      failure.manifest_sha256 !== oldHash || failure.candidate_commit !== lease.web_deploy_git_sha ||
      failure.automatic_rollback_result !== 'PREIMAGE_RESTORED' ||
      failure.final_preimage_validation?.pass !== true ||
      failure.final_preimage_validation.matched !== oldCount ||
      failure.final_preimage_validation.total !== oldCount) fail('FAILED_WEB_ROLLBACK_NOT_PROVEN');
  return { added_path: requiredAddition, old_file_count: oldFiles.size, new_file_count: newFiles.size };
}

export function planFailedWebAmendment({ root, owner, leaseId, oldFile, newFile, failureFile }) {
  root = path.resolve(root);
  const local = path.join(root, '.local/ro-stack');
  const leaseFile = path.join(local, 'production-deployment-lease/lease.json');
  const stateFile = path.join(local, 'production-deployment-state.json');
  const lease = readJson(leaseFile), state = readJson(stateFile);
  const pendingFile = path.join(root, pendingPath);
  const nativeReceiptFile = path.join(local, 'native-promotion-receipt.json');
  if (lease.owner_task_id !== owner || lease.lease_id !== leaseId) fail('LEASE_NOT_OWNED');
  if (path.resolve(lease.admission_manifest) !== path.resolve(oldFile)) fail('OLD_MANIFEST_PATH_MISMATCH');
  const oldHash = digest(oldFile), newHash = digest(newFile), oldManifest = readManifest(oldFile), newManifest = readManifest(newFile);
  validateHeader(oldManifest); validateHeader(newManifest);
  if (oldHash === newHash) fail('MANIFEST_UNCHANGED');
  const runRoot = path.dirname(inside(path.join(local, 'dashboard/deploy-receipts'), failureFile));
  if (!path.basename(failureFile).startsWith('failure-') || !path.basename(failureFile).endsWith('.json') ||
      !path.basename(runRoot).startsWith('manifest-') ||
      digest(path.join(runRoot, 'manifest.json')) !== oldHash ||
      fs.existsSync(path.join(runRoot, 'deploy-receipt.json'))) fail('FAILED_RUN_IDENTITY_INVALID');
  const failure = readJson(failureFile), pending = readJson(pendingFile);
  const change = validateAmendment({ lease, pending, state, oldManifest, newManifest, oldHash, failure, oldCount: oldManifest.file_count });
  if (!verifyNativeStage(root, state, lease, oldHash).nativeStage) fail('NATIVE_STAGE_RECONCILIATION_CHANGED');
  // The failed deployment's rollback claim is rechecked against every old manifest preimage.
  for (const row of oldManifest.files) {
    const target = path.resolve(root, row.path);
    if (!target.toLowerCase().startsWith(root.toLowerCase() + path.sep)) fail('PREIMAGE_PATH_ESCAPE');
    if (row.production_preimage === 'ABSENT' ? fs.existsSync(target) :
        !fs.existsSync(target) || digest(target) !== row.production_preimage_sha256) fail(`FAILED_WEB_PREIMAGE_CHANGED:${row.path}`);
  }
  admission(newFile, root);
  const newLease = { ...lease, admission_manifest: path.resolve(newFile), admission_manifest_sha256: newHash,
    manifest_digest: newManifest.manifest_digest,
    web_manifest_amendment: `.local/ro-stack/web-manifest-amendment-${leaseId}.json` };
  if (!verifyNativeStage(root, state, newLease, newHash).nativeStage) fail('AMENDED_NATIVE_STAGE_INVALID');
  return { leaseFile, stateFile, pendingFile, nativeReceiptFile,
    oldLeaseHash: digest(leaseFile), stateHash: digest(stateFile), pendingHash: digest(pendingFile),
    nativeReceiptHash: digest(nativeReceiptFile), newLease, change, oldHash, newHash,
    oldDigest: oldManifest.manifest_digest, newDigest: newManifest.manifest_digest,
    failureHash: digest(failureFile), failureFile, auditFile: path.join(local, `web-manifest-amendment-${leaseId}.json`) };
}

function main() {
  const argv = process.argv.slice(2);
  const args = Object.fromEntries(argv.flatMap((value, index) => value.startsWith('--') ? [[value.slice(2), argv[index + 1]]] : []));
  const root = path.resolve(args['production-root'] || '');
  if (!args['production-root'] || (args['test-mode'] === 'true' ?
      !root.startsWith(os.tmpdir() + path.sep) : root.toLowerCase() !== canonicalProduction.toLowerCase())) fail('PRODUCTION_ROOT_INVALID');
  if (!args.owner || !args.lease || !args['old-manifest'] || !args['new-manifest'] || !args['failure-receipt'] ||
      (args['dry-run'] !== 'true' && args.execute !== 'true') || (args['dry-run'] === 'true' && args.execute === 'true')) fail('AMENDMENT_ARGUMENTS_REQUIRED');
  const authority = readJson(path.resolve(sourceRoot, 'docs/project-control/production-release-authority.json'));
  if (git('status', '--porcelain=v1', '--untracked-files=all') ||
      git('remote', 'get-url', 'origin') !== authority.web.repository ||
      git('rev-parse', 'HEAD') !== git('ls-remote', 'origin', authority.web.release_ref).split(/\s/)[0]) fail('GOVERNANCE_MAIN_REQUIRED');
  const plan = planFailedWebAmendment({ root, owner: args.owner, leaseId: args.lease,
    oldFile: args['old-manifest'], newFile: args['new-manifest'], failureFile: args['failure-receipt'] });
  if (args['dry-run'] === 'true') {
    console.log(JSON.stringify({ eligible: true, dry_run: true, lease_id: args.lease,
      old_manifest_sha256: plan.oldHash, new_manifest_sha256: plan.newHash, ...plan.change }));
    return;
  }
  if (fs.existsSync(plan.auditFile) || digest(plan.leaseFile) !== plan.oldLeaseHash ||
      digest(plan.stateFile) !== plan.stateHash || digest(plan.pendingFile) !== plan.pendingHash ||
      digest(plan.nativeReceiptFile) !== plan.nativeReceiptHash ||
      digest(args['old-manifest']) !== plan.oldHash || digest(args['new-manifest']) !== plan.newHash ||
      digest(args['failure-receipt']) !== plan.failureHash) fail('AMENDMENT_CONCURRENT_CHANGE');
  const audit = { schema_version: 'first-promotion-web-manifest-amendment-v1', lease_id: args.lease,
    owner_task_id: args.owner, governance_git_sha: git('rev-parse', 'HEAD'),
    old_manifest_sha256: plan.oldHash, new_manifest_sha256: plan.newHash,
    old_manifest_digest: plan.oldDigest, new_manifest_digest: plan.newDigest,
    failure_receipt: path.relative(root, plan.failureFile).replaceAll('\\', '/'),
    failure_receipt_sha256: plan.failureHash, added_path: plan.change.added_path,
    old_file_count: plan.change.old_file_count, new_file_count: plan.change.new_file_count,
    recorded_at: new Date().toISOString() };
  const temporary = `${plan.leaseFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(plan.newLease, null, 2) + '\n', { flag: 'wx' });
  try {
    fs.writeFileSync(plan.auditFile, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
    if (digest(plan.leaseFile) !== plan.oldLeaseHash) fail('AMENDMENT_CONCURRENT_CHANGE');
    fs.renameSync(temporary, plan.leaseFile);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  console.log(JSON.stringify({ amended: true, lease_id: args.lease, audit_receipt: plan.auditFile,
    new_manifest_sha256: plan.newHash, ...plan.change }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.log(JSON.stringify({ eligible: false, error: error.message })); process.exitCode = 1; }
}
