#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { verifyWebReceipt, safeRelative, readManifest } from './web-complete-manifest.mjs';
import { nativeReceiptValid, isNativeReceiptPath, activeNativeReceiptPath, equalHash } from './native-promotion-contract.mjs';
import { gracefulShutdownLiveSatisfied } from './native-candidate-amendment.mjs';
import { FIRST_PROMOTION, legacyIdentity, verifyLegacyBaseline, transitionedState, consumedPath, pendingPath, readJson } from './legacy-production-baseline.mjs';

const sha = value => /^[0-9a-f]{40}$/i.test(String(value || ''));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const read = readJson;
const fail = code => { throw new Error(code); };
const safePath = (root, relative) => {
  safeRelative(relative);
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep)) fail('RECEIPT_PATH_ESCAPE');
  let cursor = path.resolve(root);
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('RECEIPT_REPARSE_PATH_FORBIDDEN');
  }
  return full;
};
const writeNew = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const writeAtomic = (file, value) => {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temporary, file);
};
function gitReachable(root, remote, ref, commit) {
  if (!root || !remote || !ref || !sha(commit) || !/^https:\/\/github\.com\//.test(remote)) return false;
  const options = { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000 };
  const url = spawnSync('git', ['remote', 'get-url', 'origin'], options);
  if (url.status !== 0 || url.stdout.trim() !== remote) return false;
  const advertised = spawnSync('git', ['ls-remote', '--exit-code', 'origin', ref], options);
  const tip = advertised.status === 0 ? advertised.stdout.trim().split(/\s/)[0] : '';
  if (!sha(tip) || spawnSync('git', ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', ref], options).status !== 0) return false;
  return spawnSync('git', ['merge-base', '--is-ancestor', commit, tip], options).status === 0;
}

export function receiptComplete(receipt, root) {
  if (!receipt || !/^[A-Za-z0-9_-]+$/.test(receipt.deploy_id || '') || !receipt.deployed_at || !receipt.owner_task_id ||
      !receipt.canonical_product_checkpoint || !sha(receipt.web_git_sha) || !sha(receipt.native_git_sha) ||
      !/^https:\/\/github\.com\//.test(receipt.github_remote || '') || !receipt.github_ref ||
      !receipt.web_build_manifest || !sha(receipt.canonical_product_checkpoint) ||
      !/^[0-9a-f]{64}$/i.test(receipt.native_build_sha256 || '') || !receipt.native_artifact_path ||
      !Array.isArray(receipt.runtime_pids) || receipt.runtime_pids.length !== 4 ||
      receipt.runtime_pids.some(pid => !Number.isInteger(pid) || pid <= 0) ||
      receipt.openkore_runtime_count !== 0 || receipt.live_acceptance_results?.pass !== true ||
      !receipt.rollback_artifact || !Array.isArray(receipt.files) || !receipt.files.length) return false;
  if (receipt.web_deployment_receipt || receipt.first_github_first_gates) {
    try { verifyWebReceipt(receipt,root); } catch { return false; }
  }
  if (receipt.first_github_first_gates || receipt.native_deployment_receipt) {
    try {
      const ref=receipt.native_deployment_receipt;
      if (!isNativeReceiptPath(ref?.path) || !equalHash(hash(safePath(root,ref.path)),ref.sha256)) return false;
      const native=read(safePath(root,ref.path));
      if (!nativeReceiptValid(native,{nativeSha:receipt.native_git_sha,binaryHash:receipt.native_build_sha256,leaseId:receipt.lease_id}) ||
          !native.artifacts.every(x=>equalHash(hash(safePath(root,x.path)),x.sha256))) return false;
    } catch { return false; }
  }
  const webManifest = safePath(root, receipt.web_build_manifest);
  if (!fs.existsSync(webManifest) || !/^[0-9a-f]{64}$/i.test(receipt.web_build_manifest_sha256 || '') ||
      hash(webManifest) !== receipt.web_build_manifest_sha256.toUpperCase()) return false;
  const built = read(webManifest);
  const builtFiles = new Map((built.files || []).map(x => [x.path, String(x.sha256 || '').toUpperCase()]));
  if (builtFiles.size !== receipt.files.length) return false;
  for (const entry of receipt.files) {
    if (builtFiles.get(entry.path) !== String(entry.sha256 || '').toUpperCase()) return false;
  }
  const nativeArtifact = safePath(root, receipt.native_artifact_path);
  if (!fs.existsSync(nativeArtifact) || hash(nativeArtifact) !== receipt.native_build_sha256.toUpperCase()) return false;
  for (const entry of receipt.files) {
    if (!/^[0-9a-f]{64}$/i.test(entry.sha256 || '')) return false;
    const target = safePath(root, entry.path);
    if (!fs.existsSync(target) || hash(target) !== entry.sha256.toUpperCase()) return false;
  }
  return true;
}

export function canCloseDrift(state, receipt, root) {
  return state?.production_drift === 'OPEN' && receiptComplete(receipt, root) &&
    receipt.hotfix_normalization?.source_reconstructed === true &&
    receipt.hotfix_normalization?.bounded_tests_pass === true &&
    receipt.hotfix_normalization?.github_promoted === true &&
    receipt.hotfix_normalization?.behavior_equivalent === true;
}

export function webAmendmentHistoryValid(root, lease, pending, receipt) {
  const expected = lease.web_candidate_amendments || [];
  if (!expected.length) return !pending.web_candidate_amendments?.length && !receipt.web_candidate_amendments?.length;
  if (JSON.stringify(expected) !== JSON.stringify(pending.web_candidate_amendments) ||
      JSON.stringify(expected) !== JSON.stringify(receipt.web_candidate_amendments)) return false;
  let previous = expected[0].old_web_git_sha;
  for (const item of expected) {
    try {
      if (item.old_web_git_sha !== previous || !sha(item.new_web_git_sha) ||
          !/^[a-f0-9]{64}$/i.test(item.audit_sha256 || '') ||
          !/^[a-f0-9]{64}$/i.test(item.previous_web_candidate_receipt_sha256 || '') ||
          !equalHash(hash(safePath(root,item.audit_receipt)),item.audit_sha256) ||
          !equalHash(hash(safePath(root,item.previous_web_candidate_receipt)),item.previous_web_candidate_receipt_sha256)) return false;
      const audit=read(safePath(root,item.audit_receipt));
      if (audit.lease_id !== lease.lease_id || audit.old_web_git_sha !== item.old_web_git_sha ||
          audit.new_web_git_sha !== item.new_web_git_sha) return false;
      previous=item.new_web_git_sha;
    } catch { return false; }
  }
  return previous === lease.web_deploy_git_sha && receipt.web_git_sha === previous;
}

export function commitAcceptedBaseline(root, state, lease, receipt) {
  const first = lease.promotion_mode === FIRST_PROMOTION;
  if (!lease.emergency && verifyWebReceipt(receipt,root,lease).deployed.predeploy_baseline!==state.current_deploy_id) fail('WEB_PREDEPLOY_BASELINE_MISMATCH');
  if (!receiptComplete(receipt, root) || receipt.owner_task_id !== lease.owner_task_id ||
      (!lease.emergency && (receipt.web_git_sha !== lease.web_deploy_git_sha || receipt.native_git_sha !== lease.native_deploy_git_sha)))
    fail('POSTDEPLOY_RECEIPT_INCOMPLETE');
  if (first && (!receipt.native_deployment_receipt || !receipt.lease_id || receipt.lease_id !== lease.lease_id ||
      !fs.existsSync(safePath(root, pendingPath)) ||
      receipt.native_deployment_receipt.path !== activeNativeReceiptPath(read(safePath(root, pendingPath))) ||
      !nativeReceiptValid(read(safePath(root,receipt.native_deployment_receipt.path)),{nativeSha:lease.native_deploy_git_sha,leaseId:lease.lease_id,manifestHash:lease.native_candidate_manifest_sha256}))) fail('NATIVE_POSTDEPLOY_RECEIPT_REQUIRED');
  // An amended Native candidate closes the shutdown race only with a real
  // graceful stop/restart cycle of the new binary; forced retirement of the
  // pre-fix runtime never satisfies it.
  if (first && !gracefulShutdownLiveSatisfied(root, lease, read(safePath(root, pendingPath)))) fail('NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE_REQUIRED');
  if (first && (!legacyIdentity(state) || state.production_drift !== 'OPEN' ||
      !fs.existsSync(safePath(root, pendingPath)) || fs.existsSync(safePath(root, consumedPath)))) fail('LEGACY_BOOTSTRAP_UNAVAILABLE');
  if (first) {
    const pending=read(safePath(root,pendingPath));
    if(pending.lease_id!==lease.lease_id || pending.owner_task_id!==lease.owner_task_id ||
      pending.native_git_sha!==lease.native_deploy_git_sha || pending.web_git_sha!==lease.web_deploy_git_sha ||
      !equalHash(pending.native_receipt_sha256,receipt.native_deployment_receipt.sha256)) fail('NATIVE_PENDING_RECEIPT_MISMATCH');
    if (!webAmendmentHistoryValid(root,lease,pending,receipt)) fail('WEB_CANDIDATE_AMENDMENT_HISTORY_MISMATCH');
  }
  if (first && (receipt.result !== 'PROMOTED' ||
      !['source_regression', 'native_build', 'asset_hash', 'rollback', 'single_owner', 'procdump', 'runtime_health', 'live_acceptance']
        .every(key => receipt.first_github_first_gates?.[key]?.pass === true && receipt.first_github_first_gates[key].evidence) ||
      !state.accepted_capabilities.every(id => receipt.accepted_capabilities?.includes(id)))) fail('FIRST_PROMOTION_FINAL_GATES_INCOMPLETE');
  const relative = `.local/ro-stack/deployment-receipts/${receipt.deploy_id}.json`;
  const finalReceipt = safePath(root, relative);
  fs.mkdirSync(path.dirname(finalReceipt), { recursive: true });
  writeNew(finalReceipt, receipt);
  if (first) writeNew(safePath(root, consumedPath), { deploy_id: receipt.deploy_id, web_git_sha: receipt.web_git_sha,
    native_git_sha: receipt.native_git_sha, consumed_at: new Date().toISOString() });
  const next = transitionedState(state, receipt, relative);
  writeAtomic(safePath(root, '.local/ro-stack/production-deployment-state.json'), next);
  if (first) fs.unlinkSync(safePath(root, pendingPath));
  return next;
}

function main() {
  const argv = process.argv.slice(2);
  const args = Object.fromEntries(argv.flatMap((x, i) => x.startsWith('--') ? [[x.slice(2), argv[i + 1]]] : []));
  const root = path.resolve(args['production-root'] || '');
  const canonical = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
  if (!args['production-root'] || (args['test-mode'] === 'true' ? !root.startsWith(os.tmpdir() + path.sep) : root.toLowerCase() !== canonical.toLowerCase())) fail('PRODUCTION_ROOT_INVALID');
  const directory = path.join(root, '.local/ro-stack');
  const stateFile = path.join(directory, 'production-deployment-state.json');
  const leaseDir = path.join(directory, 'production-deployment-lease');
  const leaseFile = path.join(leaseDir, 'lease.json');
  const state = fs.existsSync(stateFile) ? read(stateFile) : null;
  const action = args.action;
  if (!state || (!legacyIdentity(state) && (!sha(state.current_web_git_sha) || !sha(state.current_native_git_sha)))) fail('PRODUCTION_GIT_BASELINE_INVALID');
  const initialStateHash = hash(stateFile);
  if (action === 'open-drift') {
    if (!args.owner || !args.reason) fail('DRIFT_REASON_REQUIRED');
    writeAtomic(stateFile, { ...state, production_drift: 'OPEN', drift_reason: args.reason,
      drift_reported_by: args.owner, drift_reported_at: new Date().toISOString() });
    process.stdout.write(JSON.stringify({ production_drift: 'OPEN' }) + '\n');
    return;
  }
  if (action === 'acquire' || action === 'acquire-emergency') {
    if (!args.owner || !sha(args['web-sha']) || !sha(args['native-sha'])) fail('LEASE_ARGUMENTS_REQUIRED');
    let capabilities = [];
    if(args.manifest)readManifest(args.manifest);
    const admissionHash=args.manifest ? hash(args.manifest) : null;
    const promotionMode = args['promotion-mode'] || (args.manifest ? readManifest(args.manifest).promotion_mode : null) || 'NORMAL';
    if (promotionMode === FIRST_PROMOTION && action !== 'acquire') fail('LEGACY_EMERGENCY_FORBIDDEN');
    if (promotionMode !== FIRST_PROMOTION && (!sha(state.current_web_git_sha) || !sha(state.current_native_git_sha))) fail('PRODUCTION_GIT_BASELINE_INVALID');
    if (action === 'acquire') {
      if (state.production_drift !== 'CLOSED' || !args.manifest) fail('PRODUCTION_DRIFT_OPEN');
      const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), 'production-promotion-gate.mjs');
      const verification = spawnSync(process.execPath, [gate, '--mode', 'acquire', '--manifest', args.manifest,
        '--production-root', root, '--owner', args.owner, '--promotion-mode', promotionMode], { encoding: 'utf8', windowsHide: true });
      if (verification.status !== 0) fail(`PRODUCTION_PROMOTION_GATE_BLOCKED:${verification.stdout.trim()}`);
      const verified = JSON.parse(verification.stdout);
      if(hash(args.manifest)!==admissionHash) fail('ADMISSION_MANIFEST_CHANGED');
      capabilities = verified.candidate_capabilities;
      if (String(readManifest(args.manifest).candidate_commit).toLowerCase() !== args['web-sha'].toLowerCase() ||
          String(promotionMode === FIRST_PROMOTION ? readManifest(args.manifest).candidate_native_commit : state.current_native_git_sha).toLowerCase() !== args['native-sha'].toLowerCase()) fail('LEASE_SHA_MISMATCH');
    } else {
      if (state.production_drift !== 'OPEN' || !args.incident || !args['git-flow-unavailable-reason']) fail('EMERGENCY_EVIDENCE_REQUIRED');
      capabilities = state.accepted_capabilities || [];
    }
    const lease = { manifest_digest: args.manifest ? readManifest(args.manifest).manifest_digest : null, lease_id: randomUUID(), native_candidate_manifest_sha256: args.manifest ? readManifest(args.manifest).native_candidate_manifest?.sha256 : null, owner_task_id: args.owner, owner_window: args.window || '', acquired_at: new Date().toISOString(),
      target_scope: args.scope || '', web_deploy_git_sha: args['web-sha'], native_deploy_git_sha: args['native-sha'],
      candidate_capabilities: capabilities, status: 'ACTIVE', promotion_mode: promotionMode, admission_manifest: args.manifest || null, admission_manifest_sha256: args.manifest ? hash(args.manifest) : null, emergency: action === 'acquire-emergency',
      incident: action === 'acquire-emergency' ? args.incident : null,
      git_flow_unavailable_reason: action === 'acquire-emergency' ? args['git-flow-unavailable-reason'] : null };
    fs.mkdirSync(leaseDir); // Atomic claim. Existing owner is never displaced.
    try {
      if (hash(stateFile) !== initialStateHash) fail('BASELINE_CHANGED_DURING_ADMISSION');
      if(args.manifest && hash(args.manifest)!==admissionHash) fail('ADMISSION_MANIFEST_CHANGED');
      if (promotionMode === FIRST_PROMOTION) { const verified = verifyLegacyBaseline(root, state); if (!verified.pass || !verified.rollbackReady) fail('LEGACY_CHANGED_DURING_ADMISSION'); }
      writeNew(leaseFile, lease);
    } catch (error) { fs.rmdirSync(leaseDir); throw error; }
    process.stdout.write(JSON.stringify({ acquired: true, lease }) + '\n');
    return;
  }
  if (!fs.existsSync(leaseFile)) fail('DEPLOYMENT_LEASE_REQUIRED');
  const lease = read(leaseFile);
  if (lease.owner_task_id !== args.owner || lease.status !== 'ACTIVE') fail('DEPLOYMENT_LEASE_NOT_OWNED');
  const pendingFile = safePath(root, pendingPath);
  const first = lease.promotion_mode === FIRST_PROMOTION;
  if (action === 'begin-first-promotion') {
    if (!first || !legacyIdentity(state) || fs.existsSync(safePath(root, consumedPath))) fail('LEGACY_BOOTSTRAP_UNAVAILABLE');
    if (fs.existsSync(pendingFile)) {
      const pending = read(pendingFile);
      if (pending.lease_id !== lease.lease_id || pending.owner_task_id !== args.owner || pending.web_git_sha !== lease.web_deploy_git_sha || pending.native_git_sha !== lease.native_deploy_git_sha) fail('PENDING_PROMOTION_CONFLICT');
      if (state.production_drift !== 'OPEN') fail('PENDING_PROMOTION_STATE_INVALID');
    } else {
      const checked = verifyLegacyBaseline(root, state);
      if (!checked.pass || !checked.rollbackReady || state.production_drift !== 'CLOSED') fail('LEGACY_PREMUTATION_CHECK_FAILED');
      writeNew(pendingFile, { lease_id:lease.lease_id, owner_task_id: args.owner, web_git_sha: lease.web_deploy_git_sha,
        native_git_sha: lease.native_deploy_git_sha, started_at: new Date().toISOString() });
      writeAtomic(stateFile, { ...state, production_drift: 'OPEN', drift_reason: 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT' });
    }
    process.stdout.write(JSON.stringify({ promotion_started: true, production_drift: 'OPEN' }) + '\n');
    return;
  }
  if (action === 'release-failed') {
    if (!first || !legacyIdentity(state) || fs.existsSync(safePath(root, consumedPath))) fail('LEGACY_LEASE_RELEASE_FORBIDDEN');
    const checked = verifyLegacyBaseline(root, state);
    if (!checked.pass || !checked.rollbackReady) {
      writeAtomic(stateFile, { ...state, production_drift: 'OPEN', drift_reason: 'FAILED_FIRST_PROMOTION_REQUIRES_RECONCILIATION' });
      fail('LEGACY_ARTIFACTS_NOT_RESTORED');
    }
    const { first_promotion_phase: _releasedPhase, ...released } = state;
    writeAtomic(stateFile, { ...released, production_drift: 'CLOSED', drift_reason: null });
    if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
    fs.unlinkSync(leaseFile); fs.rmdirSync(leaseDir);
    process.stdout.write(JSON.stringify({ released: true, baseline_mode: state.baseline_mode, legacy_bootstrap_available: true }) + '\n');
    return;
  }
  if (action !== 'finalize' && action !== 'normalize-hotfix') fail('INVALID_STATE_ACTION');
  if ((action === 'normalize-hotfix') !== (lease.emergency === true)) fail('LEASE_MODE_MISMATCH');
  if (!args.receipt || !fs.existsSync(args.receipt)) {
    if (first && fs.existsSync(pendingFile)) writeAtomic(stateFile, { ...state, production_drift: 'OPEN', drift_reason: 'POSTDEPLOY_RECEIPT_MISSING' });
    fail('POSTDEPLOY_RECEIPT_REQUIRED');
  }
  const receipt = read(args.receipt);
  if (receipt.owner_task_id !== args.owner ||
      (!lease.emergency && receipt.web_git_sha !== lease.web_deploy_git_sha) ||
      (!lease.emergency && receipt.native_git_sha !== lease.native_deploy_git_sha) ||
      !receiptComplete(receipt, root)) fail('POSTDEPLOY_RECEIPT_INCOMPLETE');
  if (first) {
    if (!legacyIdentity(state) || fs.existsSync(safePath(root, consumedPath)) || !fs.existsSync(pendingFile)) fail('LEGACY_BOOTSTRAP_UNAVAILABLE');
    if (receipt.result !== 'PROMOTED' || !['source_regression', 'native_build', 'asset_hash', 'rollback', 'single_owner', 'procdump', 'runtime_health', 'live_acceptance'].every(key => receipt.first_github_first_gates?.[key]?.pass === true && receipt.first_github_first_gates[key].evidence)) fail('FIRST_PROMOTION_FINAL_GATES_INCOMPLETE');
    if (!(state.accepted_capabilities || []).every(id => (receipt.accepted_capabilities || []).includes(id))) fail('LEGACY_CAPABILITY_LOSS');
    const authority = read(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/project-control/production-release-authority.json'));
    if (!gitReachable(args['candidate-root'], authority.web.repository, authority.web.release_ref, receipt.web_git_sha) || !gitReachable(authority.native.source_root, authority.native.github_repository, authority.native.release_ref, receipt.native_git_sha)) fail('FIRST_PROMOTION_RECEIPT_NOT_GITHUB_REACHABLE');
  }
  if (lease.emergency) {
    const authority = read(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/project-control/production-release-authority.json'));
    const sourceOptions = { cwd: args['candidate-root'], encoding: 'utf8', windowsHide: true };
    const head = spawnSync('git', ['rev-parse', 'HEAD'], sourceOptions);
    const dirty = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], sourceOptions);
    if (head.status !== 0 || head.stdout.trim() !== receipt.web_git_sha ||
        dirty.status !== 0 || dirty.stdout.trim()) fail('HOTFIX_SOURCE_NOT_CLEAN_GIT_SHA');
    if (!gitReachable(args['candidate-root'], authority.web?.repository, authority.web?.release_ref, receipt.web_git_sha) ||
        !gitReachable(authority.native?.source_root, authority.native?.github_repository,
          authority.native?.release_ref, receipt.native_git_sha)) fail('HOTFIX_GITHUB_NORMALIZATION_INCOMPLETE');
  }
  if (JSON.stringify([...(receipt.accepted_capabilities || [])].sort()) !==
      JSON.stringify([...(lease.candidate_capabilities || [])].sort())) fail('RECEIPT_CAPABILITY_SET_MISMATCH');
  if (action === 'normalize-hotfix' ? !canCloseDrift(state, receipt, root) : first ? state.production_drift !== 'OPEN' : state.production_drift !== 'CLOSED') fail('PRODUCTION_DRIFT_OPEN');
  commitAcceptedBaseline(root, state, lease, receipt);
  fs.unlinkSync(leaseFile);
  fs.rmdirSync(leaseDir);
  process.stdout.write(JSON.stringify({ baseline_updated: true, deploy_id: receipt.deploy_id }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: error.message }) + '\n'); process.exitCode = 1; }
}
