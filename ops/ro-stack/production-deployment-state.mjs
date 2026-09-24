#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sha = value => /^[0-9a-f]{40}$/i.test(String(value || ''));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = code => { throw new Error(code); };
const safePath = (root, relative) => {
  if (typeof relative !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(relative) || relative.split('/').some(x => !x || x === '.' || x === '..')) fail('INVALID_RECEIPT_PATH');
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
  if (!state || !sha(state.current_web_git_sha) || !sha(state.current_native_git_sha)) fail('PRODUCTION_GIT_BASELINE_INVALID');
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
    if (action === 'acquire') {
      if (state.production_drift !== 'CLOSED' || !args.manifest) fail('PRODUCTION_DRIFT_OPEN');
      const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), 'production-promotion-gate.mjs');
      const verification = spawnSync(process.execPath, [gate, '--mode', 'precheck', '--manifest', args.manifest,
        '--production-root', root, '--owner', args.owner], { encoding: 'utf8', windowsHide: true });
      if (verification.status !== 0) fail(`PRODUCTION_PROMOTION_GATE_BLOCKED:${verification.stdout.trim()}`);
      const verified = JSON.parse(verification.stdout);
      capabilities = verified.candidate_capabilities;
      if (String(read(args.manifest).candidate_commit).toLowerCase() !== args['web-sha'].toLowerCase() ||
          state.current_native_git_sha.toLowerCase() !== args['native-sha'].toLowerCase()) fail('LEASE_SHA_MISMATCH');
    } else {
      if (state.production_drift !== 'OPEN' || !args.incident || !args['git-flow-unavailable-reason']) fail('EMERGENCY_EVIDENCE_REQUIRED');
      capabilities = state.accepted_capabilities || [];
    }
    const lease = { owner_task_id: args.owner, owner_window: args.window || '', acquired_at: new Date().toISOString(),
      target_scope: args.scope || '', web_deploy_git_sha: args['web-sha'], native_deploy_git_sha: args['native-sha'],
      candidate_capabilities: capabilities, status: 'ACTIVE', emergency: action === 'acquire-emergency',
      incident: action === 'acquire-emergency' ? args.incident : null,
      git_flow_unavailable_reason: action === 'acquire-emergency' ? args['git-flow-unavailable-reason'] : null };
    fs.mkdirSync(leaseDir); // Atomic claim. Existing owner is never displaced.
    try { writeNew(leaseFile, lease); } catch (error) { fs.rmdirSync(leaseDir); throw error; }
    process.stdout.write(JSON.stringify({ acquired: true, lease }) + '\n');
    return;
  }
  if (!fs.existsSync(leaseFile)) fail('DEPLOYMENT_LEASE_REQUIRED');
  const lease = read(leaseFile);
  if (lease.owner_task_id !== args.owner || lease.status !== 'ACTIVE') fail('DEPLOYMENT_LEASE_NOT_OWNED');
  if (action !== 'finalize' && action !== 'normalize-hotfix') fail('INVALID_STATE_ACTION');
  if ((action === 'normalize-hotfix') !== (lease.emergency === true)) fail('LEASE_MODE_MISMATCH');
  if (!args.receipt) fail('POSTDEPLOY_RECEIPT_REQUIRED');
  const receipt = read(args.receipt);
  if (receipt.owner_task_id !== args.owner ||
      (!lease.emergency && receipt.web_git_sha !== lease.web_deploy_git_sha) ||
      (!lease.emergency && receipt.native_git_sha !== lease.native_deploy_git_sha) ||
      !receiptComplete(receipt, root)) fail('POSTDEPLOY_RECEIPT_INCOMPLETE');
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
  if (action === 'normalize-hotfix' ? !canCloseDrift(state, receipt, root) : state.production_drift !== 'CLOSED') fail('PRODUCTION_DRIFT_OPEN');
  const receiptRelative = `./.local/ro-stack/deployment-receipts/${receipt.deploy_id}.json`;
  const finalReceipt = safePath(root, receiptRelative.slice(2));
  fs.mkdirSync(path.dirname(finalReceipt), { recursive: true });
  writeNew(finalReceipt, receipt);
  writeAtomic(stateFile, { current_deploy_id: receipt.deploy_id, current_web_git_sha: receipt.web_git_sha,
    current_native_git_sha: receipt.native_git_sha, last_deploy_receipt: receiptRelative.slice(2),
    production_drift: 'CLOSED', accepted_capabilities: receipt.accepted_capabilities || [] });
  fs.unlinkSync(leaseFile);
  fs.rmdirSync(leaseDir);
  process.stdout.write(JSON.stringify({ baseline_updated: true, deploy_id: receipt.deploy_id }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: error.message }) + '\n'); process.exitCode = 1; }
}
