#!/usr/bin/env node
// Production promotion admission. All mutable state stays below ProductionRoot.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FIRST_PROMOTION, legacyIdentity, verifyLegacyBaseline, firstPromotionEvidence, consumedPath, pendingPath, readJson } from './legacy-production-baseline.mjs';
import { inspectNativeCandidate, verifyNativeStage, stagedRuntimeConfigPin } from './native-promotion-contract.mjs';
import { admission, assertLeaseManifest, safeRelative, readManifest } from './web-complete-manifest.mjs';
import { receiptComplete } from './production-deployment-state.mjs';
import { assetReleaseErrors } from './private-asset-release-gate.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const authorityFile = path.join(sourceRoot, 'docs/project-control/production-release-authority.json');
const sha = value => /^[0-9a-f]{40}$/i.test(String(value || ''));
const fileHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const fail = code => { throw new Error(code); };
const run = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) fail(`GIT_FAILED:${args[0]}:${(result.stderr || '').trim()}`);
  return result.stdout.trim();
};
export function gitRefReachable(root, remote, ref, commit) {
  if (!root || !remote || !ref || !sha(commit)) return false;
  if (run(root, 'remote', 'get-url', 'origin') !== remote) return false;
  const advertised = spawnSync('git', ['ls-remote', '--exit-code', 'origin', ref], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  const tip = advertised.status === 0 ? advertised.stdout.trim().split(/\s/)[0] : '';
  if (!sha(tip)) return false;
  const fetch = spawnSync('git', ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', ref], { cwd: root, windowsHide: true, timeout: 30000 });
  return fetch.status === 0 && spawnSync('git', ['merge-base', '--is-ancestor', commit, tip], { cwd: root, windowsHide: true }).status === 0;
}
function reachable(root, remote, ref, commit) {
  if (!/^https:\/\/github\.com\//.test(remote || '')) return false;
  return gitRefReachable(root, remote, ref, commit);
}
// Governance definitions can advance without changing an approved gameplay SHA.
// All source-path checks below still run against the exact gameplay candidate.
export function capabilityRegistry(root, commit, governanceRoot, promotionMode) {
  const registryRoot=promotionMode===FIRST_PROMOTION ? governanceRoot : root;
  const registryCommit=promotionMode===FIRST_PROMOTION ? run(governanceRoot,'rev-parse','HEAD') : commit;
  return JSON.parse(run(registryRoot,'show',`${registryCommit}:docs/project-control/production-capabilities.json`));
}
const within = (root, relative) => {
  safeRelative(relative);
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep)) fail('PATH_ESCAPES_ROOT');
  let cursor = path.resolve(root);
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('REPARSE_PATH_FORBIDDEN');
  }
  return full;
};

export function evaluatePromotion({ authority, state, candidate, currentHashes, lease, mode = 'precheck', promotionMode = 'NORMAL' }) {
  const errors = [];
  const reject = code => errors.push(code);
  if (authority.web?.repository !== candidate.repository ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(candidate.repository || '')) reject('CANONICAL_GITHUB_REMOTE_UNDEFINED');
  if (!authority.web?.release_ref || !candidate.ref || authority.web.release_ref !== candidate.ref) reject('CANONICAL_RELEASE_REF_UNDEFINED');
  if (!sha(candidate.sha) || candidate.head !== candidate.sha || !candidate.commitExists) reject('EXACT_GIT_SHA_REQUIRED');
  if (candidate.dirty) reject('CANDIDATE_WORKTREE_DIRTY');
  if (!candidate.pushed) reject('DEPLOY_SHA_NOT_ON_CANONICAL_GITHUB_REF');
  if (!candidate.nativePushed) reject('NATIVE_BASELINE_NOT_ON_CANONICAL_GITHUB_REF');
  errors.push(...assetReleaseErrors(authority.assets, candidate.assetPackage));
  if (!candidate.fullManifestPass) reject('COMPLETE_MANIFEST_ADMISSION_REQUIRED');
  if (!candidate.requiredFilesTracked) reject('UNTRACKED_REQUIRED_ASSET');
  if (!['NORMAL', FIRST_PROMOTION].includes(promotionMode)) reject('PROMOTION_MODE_INVALID');
  if (promotionMode === FIRST_PROMOTION) {
    if (!legacyIdentity(state) || currentHashes?.consumed) reject('LEGACY_BOOTSTRAP_UNAVAILABLE');
    if (!currentHashes?.rollbackReady) reject('LEGACY_ROLLBACK_NOT_READY');
    if (!candidate.nativeCandidatePass) reject('NATIVE_CANDIDATE_PREFLIGHT_REQUIRED');
    if (mode === 'deploy' && !currentHashes?.nativeStage) reject('NATIVE_STAGE_RECEIPT_REQUIRED');
    if (!candidate.firstPromotionEvidencePass) reject('FIRST_PROMOTION_EVIDENCE_REQUIRED');
    if (mode === 'acquire' && lease) reject('FIRST_PROMOTION_REQUIRES_FREE_LEASE');
    if (mode === 'deploy' && lease?.promotion_mode !== FIRST_PROMOTION) reject('LEASE_MODE_MISMATCH');
    if (mode === 'deploy' && lease?.native_deploy_git_sha !== candidate.nativeSha) reject('LEASE_NATIVE_SHA_MISMATCH');
  } else if (!state || !sha(state.current_web_git_sha) || !sha(state.current_native_git_sha) ||
      !state.current_deploy_id || !state.last_deploy_receipt) reject('PRODUCTION_GIT_BASELINE_INVALID');
  if (state?.production_drift !== 'CLOSED' && !(promotionMode === FIRST_PROMOTION && currentHashes?.nativeStage === true)) reject('PRODUCTION_DRIFT_OPEN');
  if (!currentHashes?.pass) reject('PRODUCTION_ARTIFACT_RECEIPT_MISMATCH');
  const accepted = state?.accepted_capabilities || [];
  const preserved = new Set(candidate.capabilities || []);
  const removed = new Set(promotionMode === FIRST_PROMOTION ? [] : candidate.intentionalRemovals || []);
  const decisions = new Set(promotionMode === FIRST_PROMOTION ? [] : candidate.committedDecisions || []);
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

function facts(manifest, authority, state, owner, productionRoot, promotionMode, currentHashes, admitted, lease) {
  const root = path.resolve(manifest.candidate_root);
  const commit = String(manifest.candidate_commit || '').toLowerCase();
  const remote = run(root, 'remote', 'get-url', 'origin');
  const head = run(root, 'rev-parse', 'HEAD');
  const status = run(root, 'status', '--porcelain=v1', '--untracked-files=all');
  const commitExists = sha(commit) && spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root, windowsHide: true }).status === 0;
  const assetPackage = admitted.assetPackage;
  const manifestFiles = new Map((manifest.files || []).map(x => [x.path, String(x.candidate_sha256 || '').toUpperCase()]));
  let requiredFilesTracked = admitted.PRESTAGE_COMPLETE === true;
  const pushed = remote === authority.web?.repository && commitExists &&
    reachable(root, remote, authority.web.release_ref, commit);
  const nativeSha = promotionMode === FIRST_PROMOTION ? manifest.candidate_native_commit : state?.current_native_git_sha;
  const nativePushed = reachable(authority.native?.source_root, authority.native?.github_repository,
    authority.native?.release_ref, nativeSha);
  const decisionsPath = 'docs/project-control/production-capability-decisions.json';
  let registry=null;
  try { registry=capabilityRegistry(root,commit,sourceRoot,promotionMode); } catch { requiredFilesTracked=false; }
  let capabilities = [];
  if (registry) {
    capabilities = (registry.capabilities || []).filter(item => item.id && Array.isArray(item.source_paths) &&
      item.source_paths.length && item.source_paths.every(relative => {
        if (item.scope === 'NATIVE') {
          const check = spawnSync('git', ['cat-file', '-e', `${nativeSha}:${relative}`], { cwd: authority.native.source_root, windowsHide: true });
          return nativePushed && check.status === 0;
        }
        const local = within(root, relative);
        const tracked = spawnSync('git', ['ls-tree', '-r', '--name-only', commit, '--', relative], { cwd: root, encoding: 'utf8', windowsHide: true });
        return tracked.status === 0 && tracked.stdout.trim() === relative && fs.existsSync(local) &&
          manifestFiles.get(relative) === fileHash(local);
      })).map(item => item.id);
  }
  let committedDecisions = [];
  const decisionBlob = spawnSync('git', ['show', `${commit}:${decisionsPath}`], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (decisionBlob.status === 0) {
    const decisions = JSON.parse(decisionBlob.stdout);
    committedDecisions = (decisions.intentional_removals || []).filter(x =>
      ['INTENTIONALLY_REMOVED', 'SUPERSEDED'].includes(x.disposition) && x.decision).map(x => x.capability);
  }
  let firstPromotionEvidencePass = false;
  if (promotionMode === FIRST_PROMOTION && manifest.first_promotion_evidence?.path && /^[a-f0-9]{64}$/i.test(manifest.first_promotion_evidence.sha256 || '')) {
    const evidencePath = path.resolve(path.dirname(manifest._manifestPath), manifest.first_promotion_evidence.path);
    firstPromotionEvidencePass = fs.existsSync(evidencePath) && fileHash(evidencePath) === manifest.first_promotion_evidence.sha256.toUpperCase() &&
      firstPromotionEvidence(readJson(evidencePath), commit, nativeSha);
  }
  let nativeCandidatePass = false;
  if (promotionMode === FIRST_PROMOTION && manifest.native_candidate_manifest?.path) {
    const nativeFile = path.resolve(path.dirname(manifest._manifestPath), manifest.native_candidate_manifest.path);
    const admittedState = currentHashes?.nativeStage ? {...state, production_drift:'CLOSED'} : state;
    const inspected = inspectNativeCandidate({file:nativeFile,sha256:manifest.native_candidate_manifest.sha256,
      root:productionRoot,state:admittedState,authority:authority.native,webCapabilities:capabilities,webRoot:root,webSha:commit,
      stagedWebManifest:currentHashes?.nativeStage ? manifest : undefined,
      runtimeConfigPin:currentHashes?.nativeStage ? stagedRuntimeConfigPin(productionRoot,state,lease) : undefined});
    nativeCandidatePass = inspected.eligible && inspected.manifest.native_git_sha === nativeSha;
    if(nativeCandidatePass) for(const row of inspected.capability_rows) if(row.classification==='INTENTIONALLY_SUPERSEDED' && !capabilities.includes(row.id)) capabilities.push(row.id);
  }
  return { fullManifestPass: admitted.PRESTAGE_COMPLETE === true, nativeCandidatePass, repository: remote, ref: authority.web?.release_ref, sha: commit, head,
    commitExists, dirty: !!status, pushed, nativePushed, nativeSha, firstPromotionEvidencePass, assetPackage, requiredFilesTracked, owner,
    capabilities, intentionalRemovals: manifest.intentional_removals || [], committedDecisions };
}

function productionHashes(productionRoot, state, promotionMode, lease, manifestHash) {
  if (promotionMode === FIRST_PROMOTION && state?.production_drift === 'OPEN') return verifyNativeStage(productionRoot,state,lease,manifestHash);
  if (promotionMode === FIRST_PROMOTION) return { ...verifyLegacyBaseline(productionRoot, state), consumed: fs.existsSync(within(productionRoot, consumedPath)) };
  if (fs.existsSync(within(productionRoot, pendingPath))) return { pass: false };
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
  if (!['precheck', 'acquire', 'deploy'].includes(mode) || !args.manifest || !args['production-root'] || !args.owner) fail('GATE_ARGUMENTS_REQUIRED');
  const authority = readJson(authorityFile);
  const manifest = readManifest(args.manifest);
  const inputHash=fileHash(args.manifest);
  Object.defineProperty(manifest,'_manifestPath',{value:path.resolve(args.manifest)});
  const promotionMode = args['promotion-mode'] || manifest.promotion_mode || 'NORMAL';
  if(promotionMode===FIRST_PROMOTION){
    const governanceSha=run(sourceRoot,'rev-parse','HEAD');
    if(run(sourceRoot,'status','--porcelain=v1','--untracked-files=all') ||
      !reachable(sourceRoot,authority.web.repository,authority.web.release_ref,governanceSha)) fail('GOVERNANCE_CHECKOUT_NOT_CANONICAL');
  }
  const productionRoot = path.resolve(args['production-root']);
  const statePath = path.join(productionRoot, '.local/ro-stack/production-deployment-state.json');
  const leasePath = path.join(productionRoot, '.local/ro-stack/production-deployment-lease/lease.json');
  const state = fs.existsSync(statePath) ? readJson(statePath) : null;
  const lease = fs.existsSync(leasePath) ? readJson(leasePath) : fs.existsSync(path.dirname(leasePath)) ? { status: 'INVALID' } : null;
  if (lease?.status === 'ACTIVE') assertLeaseManifest(lease,fileHash(args.manifest),manifest);
  const admitted = admission(args.manifest,productionRoot);
  const currentHashes = productionHashes(productionRoot,state,promotionMode,lease,fileHash(args.manifest));
  const result = evaluatePromotion({ authority,state,candidate:facts(manifest,authority,state,args.owner,productionRoot,promotionMode,currentHashes,admitted,lease),
    currentHashes,lease,mode,promotionMode });
  if(fileHash(args.manifest)!==inputHash)fail('ADMISSION_MANIFEST_CHANGED');
  result.admission_manifest_sha256=inputHash;
  result.manifest_digest=manifest.manifest_digest;
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.eligible) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stdout.write(JSON.stringify({ eligible: false, errors: [error.message] }) + '\n'); process.exitCode = 1; }
}
