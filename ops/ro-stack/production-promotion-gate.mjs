#!/usr/bin/env node
// Production promotion admission. All mutable state stays below ProductionRoot.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { receiptComplete } from './production-deployment-state.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const authorityFile = path.join(sourceRoot, 'docs/project-control/production-release-authority.json');
const sha = value => /^[0-9a-f]{40}$/i.test(String(value || ''));
const fileHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = code => { throw new Error(code); };
const run = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) fail(`GIT_FAILED:${args[0]}:${(result.stderr || '').trim()}`);
  return result.stdout.trim();
};
function reachable(root, remote, ref, commit) {
  if (!root || !remote || !ref || !sha(commit) || !/^https:\/\/github\.com\//.test(remote)) return false;
  if (run(root, 'remote', 'get-url', 'origin') !== remote) return false;
  const advertised = spawnSync('git', ['ls-remote', '--exit-code', 'origin', ref], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  const tip = advertised.status === 0 ? advertised.stdout.trim().split(/\s/)[0] : '';
  if (!sha(tip)) return false;
  const fetch = spawnSync('git', ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', ref], { cwd: root, windowsHide: true, timeout: 30000 });
  return fetch.status === 0 && spawnSync('git', ['merge-base', '--is-ancestor', commit, tip], { cwd: root, windowsHide: true }).status === 0;
}
const within = (root, relative) => {
  if (typeof relative !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(relative) ||
      relative.split('/').some(part => part === '.' || part === '..' || !part)) fail('INVALID_PATH');
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep)) fail('PATH_ESCAPES_ROOT');
  let cursor = path.resolve(root);
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('REPARSE_PATH_FORBIDDEN');
  }
  return full;
};

export function evaluatePromotion({ authority, state, candidate, currentHashes, lease, mode = 'precheck' }) {
  const errors = [];
  const reject = code => errors.push(code);
  if (authority.web?.repository !== candidate.repository ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(candidate.repository || '')) reject('CANONICAL_GITHUB_REMOTE_UNDEFINED');
  if (!authority.web?.release_ref || !candidate.ref || authority.web.release_ref !== candidate.ref) reject('CANONICAL_RELEASE_REF_UNDEFINED');
  if (!sha(candidate.sha) || candidate.head !== candidate.sha || !candidate.commitExists) reject('EXACT_GIT_SHA_REQUIRED');
  if (candidate.dirty) reject('CANDIDATE_WORKTREE_DIRTY');
  if (!candidate.pushed) reject('DEPLOY_SHA_NOT_ON_CANONICAL_GITHUB_REF');
  if (!candidate.nativePushed) reject('NATIVE_BASELINE_NOT_ON_CANONICAL_GITHUB_REF');
  if (!candidate.requiredFilesTracked) reject('UNTRACKED_REQUIRED_ASSET');
  if (!state || !sha(state.current_web_git_sha) || !sha(state.current_native_git_sha) ||
      !state.current_deploy_id || !state.last_deploy_receipt) reject('PRODUCTION_GIT_BASELINE_INVALID');
  if (state?.production_drift !== 'CLOSED') reject('PRODUCTION_DRIFT_OPEN');
  if (!currentHashes?.pass) reject('PRODUCTION_ARTIFACT_RECEIPT_MISMATCH');
  const accepted = state?.accepted_capabilities || [];
  const preserved = new Set(candidate.capabilities || []);
  const removed = new Set(candidate.intentionalRemovals || []);
  const decisions = new Set(candidate.committedDecisions || []);
  for (const capability of accepted) {
    if (!preserved.has(capability) && !(removed.has(capability) && decisions.has(capability))) {
      reject(`CANDIDATE_MISSING_CAPABILITY:${capability}`);
    }
  }
  if (mode === 'deploy' && (!lease || lease.owner_task_id !== candidate.owner ||
      lease.status !== 'ACTIVE' || lease.web_deploy_git_sha !== candidate.sha)) reject('DEPLOYMENT_LEASE_NOT_OWNED');
  if (lease && lease.status === 'ACTIVE' && lease.owner_task_id !== candidate.owner) reject('DEPLOYMENT_LEASE_HELD_BY_OTHER');
  return { eligible: errors.length === 0, errors,
    candidate_capabilities: [...preserved].sort(),
    production_accepted_capabilities_discovered: accepted.length,
    candidate_preserved: accepted.filter(id => preserved.has(id)).length,
    candidate_missing: accepted.filter(id => !preserved.has(id) && !(removed.has(id) && decisions.has(id))).length };
}

function facts(manifest, authority, state, owner, productionRoot) {
  const root = path.resolve(manifest.candidate_root);
  const commit = String(manifest.candidate_commit || '').toLowerCase();
  const remote = run(root, 'remote', 'get-url', 'origin');
  const head = run(root, 'rev-parse', 'HEAD');
  const status = run(root, 'status', '--porcelain=v1', '--untracked-files=all');
  const commitExists = sha(commit) && spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root, windowsHide: true }).status === 0;
  const required = [...(manifest.files || []).map(item => item.path), ...(manifest.required_assets || [])];
  let baselineFiles = new Map();
  if (state?.last_deploy_receipt) {
    const baselinePath = within(productionRoot, state.last_deploy_receipt);
    if (fs.existsSync(baselinePath)) baselineFiles = new Map((readJson(baselinePath).files || []).map(x => [x.path, String(x.sha256 || '').toUpperCase()]));
  }
  const manifestFiles = new Map((manifest.files || []).map(x => [x.path, String(x.candidate_sha256 || '').toUpperCase()]));
  let requiredFilesTracked = required.length > 0;
  for (const relative of required) {
    const local = within(root, relative);
    const tracked = spawnSync('git', ['ls-tree', '-r', '--name-only', commit, '--', relative], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (!fs.existsSync(local) || tracked.status !== 0 || tracked.stdout.trim() !== relative) requiredFilesTracked = false;
    if (fs.existsSync(local) && fileHash(local) !== String((manifest.files || []).find(x => x.path === relative)?.candidate_sha256 || '').toUpperCase() &&
        (manifest.files || []).some(x => x.path === relative)) requiredFilesTracked = false;
    if (fs.existsSync(local) && !manifestFiles.has(relative) && baselineFiles.get(relative) !== fileHash(local)) requiredFilesTracked = false;
  }
  const pushed = remote === authority.web?.repository && commitExists &&
    reachable(root, remote, authority.web.release_ref, commit);
  const nativePushed = reachable(authority.native?.source_root, authority.native?.github_repository,
    authority.native?.release_ref, state?.current_native_git_sha);
  const decisionsPath = 'docs/project-control/production-capability-decisions.json';
  const capabilityPath = 'docs/project-control/production-capabilities.json';
  const capabilityBlob = spawnSync('git', ['show', `${commit}:${capabilityPath}`], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (capabilityBlob.status !== 0) requiredFilesTracked = false;
  let capabilities = [];
  if (capabilityBlob.status === 0) {
    const registry = JSON.parse(capabilityBlob.stdout);
    capabilities = (registry.capabilities || []).filter(item => item.id && Array.isArray(item.source_paths) &&
      item.source_paths.length && item.source_paths.every(relative => {
        const local = within(root, relative);
        const tracked = spawnSync('git', ['ls-tree', '-r', '--name-only', commit, '--', relative], { cwd: root, encoding: 'utf8', windowsHide: true });
        return tracked.status === 0 && tracked.stdout.trim() === relative && fs.existsSync(local) &&
          (manifestFiles.get(relative) === fileHash(local) || baselineFiles.get(relative) === fileHash(local));
      })).map(item => item.id);
  }
  let committedDecisions = [];
  const decisionBlob = spawnSync('git', ['show', `${commit}:${decisionsPath}`], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (decisionBlob.status === 0) {
    const decisions = JSON.parse(decisionBlob.stdout);
    committedDecisions = (decisions.intentional_removals || []).filter(x =>
      ['INTENTIONALLY_REMOVED', 'SUPERSEDED'].includes(x.disposition) && x.decision).map(x => x.capability);
  }
  return { repository: remote, ref: authority.web?.release_ref, sha: commit, head,
    commitExists, dirty: !!status, pushed, nativePushed, requiredFilesTracked, owner,
    capabilities, intentionalRemovals: manifest.intentional_removals || [], committedDecisions };
}

function productionHashes(productionRoot, state) {
  if (!state?.last_deploy_receipt) return { pass: false };
  const receiptPath = within(productionRoot, state.last_deploy_receipt);
  if (!fs.existsSync(receiptPath)) return { pass: false };
  const receipt = readJson(receiptPath);
  if (receipt.web_git_sha !== state.current_web_git_sha || receipt.native_git_sha !== state.current_native_git_sha ||
      receipt.deploy_id !== state.current_deploy_id || !receiptComplete(receipt, productionRoot)) return { pass: false };
  return { pass: true, receipt };
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => value.startsWith('--') ? [value.slice(2), all[index + 1]] : null).filter(Boolean));
  const mode = args.mode || 'precheck';
  if (!['precheck', 'deploy'].includes(mode) || !args.manifest || !args['production-root'] || !args.owner) fail('GATE_ARGUMENTS_REQUIRED');
  const authority = readJson(authorityFile);
  const manifest = readJson(args.manifest);
  const productionRoot = path.resolve(args['production-root']);
  const statePath = path.join(productionRoot, '.local/ro-stack/production-deployment-state.json');
  const leasePath = path.join(productionRoot, '.local/ro-stack/production-deployment-lease/lease.json');
  const state = fs.existsSync(statePath) ? readJson(statePath) : null;
  const lease = fs.existsSync(leasePath) ? readJson(leasePath) : null;
  const result = evaluatePromotion({ authority, state, candidate: facts(manifest, authority, state, args.owner, productionRoot),
    currentHashes: productionHashes(productionRoot, state), lease, mode });
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.eligible) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stdout.write(JSON.stringify({ eligible: false, errors: [error.message] }) + '\n'); process.exitCode = 1; }
}
