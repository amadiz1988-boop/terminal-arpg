import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { evaluatePromotion, gitRefReachable } from '../production-promotion-gate.mjs';
import { receiptComplete, canCloseDrift } from '../production-deployment-state.mjs';

const web = 'a'.repeat(40);
const native = 'b'.repeat(40);
const repo = 'https://github.com/example/terminal-arpg.git';
const assets = { repository: 'amadiz1988-boop/ghost-island-assets', immutable_required: true, release_id: 12, release_tag: 'fixture-v1', package_id: 'fixture', package_version: '1.1.0', asset_count: 1, package_sha256: '1'.repeat(64), manifest_sha256: '2'.repeat(64), archive: { sha256: '3'.repeat(64) } };
const assetPackage = { ...assets, available: true, private: true, immutable: true, valid: true, archive_sha256: assets.archive.sha256 };
const authority = { assets, web: { repository: repo, release_ref: 'refs/heads/main' } };
const state = { current_deploy_id: 'old', current_web_git_sha: web, current_native_git_sha: native,
  last_deploy_receipt: 'receipt.json', production_drift: 'CLOSED', accepted_capabilities: ['skill-tree'] };
const candidate = { repository: repo, ref: 'refs/heads/main', sha: web, head: web, commitExists: true,
  assetPackage, dirty: false, pushed: true, nativePushed: true, fullManifestPass: true, requiredFilesTracked: true, owner: 'GOV',
  capabilities: ['skill-tree'], intentionalRemovals: [], committedDecisions: [] };
const lease = { owner_task_id: 'GOV', status: 'ACTIVE', web_deploy_git_sha: web };
const check = (changes = {}, mode = 'precheck') => evaluatePromotion({ authority, state, candidate,
  currentHashes: { pass: true }, lease, mode, ...changes });
const blocked = (result, code) => assert.ok(result.errors.some(x => x.startsWith(code)), JSON.stringify(result));
let count = 0;
const test = (name, fn) => { fn(); count++; process.stdout.write(`PASS ${count} ${name}\n`); };

test('clean pushed canonical SHA eligible', () => assert.equal(check().eligible, true));
for (const [name, patch, code] of [
  ['missing package', { available: false }, 'PRIVATE_ASSET_PACKAGE_UNAVAILABLE'],
  ['public repository', { private: false }, 'PRIVATE_ASSET_RELEASE_NOT_IMMUTABLE'],
  ['mutable release', { immutable: false }, 'PRIVATE_ASSET_RELEASE_NOT_IMMUTABLE'],
  ['wrong manifest hash', { manifest_sha256: '0'.repeat(64) }, 'PRIVATE_ASSET_HASH_OR_IDENTITY_MISMATCH'],
  ['wrong archive hash', { archive_sha256: '0'.repeat(64) }, 'PRIVATE_ASSET_HASH_OR_IDENTITY_MISMATCH'],
  ['wrong package content', { valid: false }, 'PRIVATE_ASSET_HASH_OR_IDENTITY_MISMATCH'],
  ['wrong release identity', { release_id: 13 }, 'PRIVATE_ASSET_HASH_OR_IDENTITY_MISMATCH'],
]) test(name + ' blocks promotion', () => blocked(check({ candidate: { ...candidate, assetPackage: { ...assetPackage, ...patch } } }), code));
test('undefined asset authority fails closed', () => blocked(check({ authority: { ...authority, assets: null } }), 'PRIVATE_ASSET_AUTHORITY_UNDEFINED'));
test('dirty worktree blocked', () => blocked(check({ candidate: { ...candidate, dirty: true } }), 'CANDIDATE_WORKTREE_DIRTY'));
test('untracked required asset blocked', () => blocked(check({ candidate: { ...candidate, requiredFilesTracked: false } }), 'UNTRACKED_REQUIRED_ASSET'));
test('local only SHA blocked', () => blocked(check({ candidate: { ...candidate, pushed: false } }), 'DEPLOY_SHA_NOT_ON_CANONICAL_GITHUB_REF'));
test('pushed SHA on wrong ref blocked', () => blocked(check({ candidate: { ...candidate, ref: 'refs/heads/feature' } }), 'CANONICAL_RELEASE_REF_UNDEFINED'));
test('Native GitHub authority unavailable blocks promotion', () => blocked(check({ candidate: { ...candidate, nativePushed: false } }), 'NATIVE_BASELINE_NOT_ON_CANONICAL_GITHUB_REF'));
test('second lease owner blocked', () => blocked(check({ lease: { ...lease, owner_task_id: 'OTHER' } }), 'DEPLOYMENT_LEASE_HELD_BY_OTHER'));
test('Production receipt hash drift blocked', () => blocked(check({ currentHashes: { pass: false } }), 'PRODUCTION_ARTIFACT_RECEIPT_MISMATCH'));
test('lost capability blocked', () => blocked(check({ candidate: { ...candidate, capabilities: [] } }), 'CANDIDATE_MISSING_CAPABILITY'));
test('intentional removal requires committed decision', () => {
  const proposed = { ...candidate, capabilities: [], intentionalRemovals: ['skill-tree'] };
  blocked(check({ candidate: proposed }), 'CANDIDATE_MISSING_CAPABILITY');
  assert.equal(check({ candidate: { ...proposed, committedDecisions: ['skill-tree'] } }).eligible, true);
});
const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'promotion-git-ref-'));
try {
  const bare = path.join(gitRoot, 'remote.git');
  const work = path.join(gitRoot, 'work');
  fs.mkdirSync(work);
  const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8', windowsHide: true }).trim();
  execFileSync('git', ['init', '--bare', '-q', bare], { windowsHide: true });
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('remote', 'add', 'origin', bare);
  git('commit', '-q', '--allow-empty', '-m', 'accepted');
  const accepted = git('rev-parse', 'HEAD');
  git('push', '-q', 'origin', 'HEAD:refs/heads/main');
  test('actual Git SHA reachable from authorized fixture ref', () => assert.equal(gitRefReachable(work, bare, 'refs/heads/main', accepted), true));
  git('commit', '-q', '--allow-empty', '-m', 'local-only');
  const local = git('rev-parse', 'HEAD');
  test('actual local-only Git SHA blocked', () => assert.equal(gitRefReachable(work, bare, 'refs/heads/main', local), false));
  git('push', '-q', 'origin', 'HEAD:refs/heads/feature');
  test('actual pushed SHA on wrong ref blocked', () => assert.equal(gitRefReachable(work, bare, 'refs/heads/main', local), false));
  git('push', '-q', 'origin', 'HEAD:refs/heads/main');
  test('actual promoted SHA becomes release reachable', () => assert.equal(gitRefReachable(work, bare, 'refs/heads/main', local), true));
} finally { fs.rmSync(gitRoot, { recursive: true, force: true }); }
test('receipt records exact Git SHAs', () => {
  assert.equal(receiptComplete({ web_git_sha: web }, os.tmpdir()), false);
});
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promotion-governance-'));
try {
  const target = path.join(root, 'app.js');
  fs.writeFileSync(target, 'v1');
  fs.writeFileSync(path.join(root, 'map-server.exe'), 'native-v1');
  const digest = createHash('sha256').update('v1').digest('hex');
  const webManifest = JSON.stringify({ files: [{ path: 'app.js', sha256: digest }] });
  fs.writeFileSync(path.join(root, 'manifest.json'), webManifest);
  const receipt = { deploy_id: 'new', deployed_at: new Date().toISOString(), owner_task_id: 'GOV',
    canonical_product_checkpoint: web, web_git_sha: web, native_git_sha: native,
    github_remote: repo, github_ref: 'refs/heads/main', web_build_manifest: 'manifest.json',
    web_build_manifest_sha256: createHash('sha256').update(webManifest).digest('hex'),
    native_build_sha256: createHash('sha256').update('native-v1').digest('hex'), native_artifact_path: 'map-server.exe',
    runtime_pids: [1, 2, 3, 4], openkore_runtime_count: 0,
    live_acceptance_results: { pass: true }, rollback_artifact: 'backup',
    files: [{ path: 'app.js', sha256: digest }] };
  test('postdeploy artifact matches receipt', () => assert.equal(receiptComplete(receipt, root), true));
  test('postdeploy artifact drift blocks baseline', () => {
    fs.writeFileSync(target, 'changed');
    assert.equal(receiptComplete(receipt, root), false);
    fs.writeFileSync(target, 'v1');
  });
  test('out of band hotfix opens drift gate', () => blocked(check({ state: { ...state, production_drift: 'OPEN' } }), 'PRODUCTION_DRIFT_OPEN'));
  test('hotfix normalization requires all evidence', () => {
    const open = { ...state, production_drift: 'OPEN' };
    assert.equal(canCloseDrift(open, receipt, root), false);
    assert.equal(canCloseDrift(open, { ...receipt, hotfix_normalization: {
      source_reconstructed: true, bounded_tests_pass: true, github_promoted: true, behavior_equivalent: true } }, root), true);
  });
  test('missing Git SHA invalidates baseline', () => blocked(check({ state: { ...state, current_native_git_sha: null } }), 'PRODUCTION_GIT_BASELINE_INVALID'));
  test('unresolved bootstrap preserves history and blocks promotion', () => {
    const bootstrap = { current_native_git_sha: 'UNRESOLVED', production_drift: 'OPEN' };
    blocked(check({ state: bootstrap }), 'PRODUCTION_GIT_BASELINE_INVALID');
  });
  test('deploy requires owner lease', () => blocked(check({ lease: null }, 'deploy'), 'DEPLOYMENT_LEASE_NOT_OWNED'));
  test('undefined release ref blocks deploy', () => blocked(check({ authority: { web: { repository: repo, release_ref: null } } }), 'CANONICAL_RELEASE_REF_UNDEFINED'));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
process.stdout.write(`GOVERNANCE_TEST_COUNT=${count}\n`);
