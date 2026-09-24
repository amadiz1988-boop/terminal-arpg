import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluatePromotion } from '../production-promotion-gate.mjs';
import { receiptComplete, canCloseDrift } from '../production-deployment-state.mjs';

const web = 'a'.repeat(40);
const native = 'b'.repeat(40);
const repo = 'https://github.com/example/terminal-arpg.git';
const authority = { web: { repository: repo, release_ref: 'refs/heads/release' } };
const state = { current_deploy_id: 'old', current_web_git_sha: web, current_native_git_sha: native,
  last_deploy_receipt: 'receipt.json', production_drift: 'CLOSED', accepted_capabilities: ['skill-tree'] };
const candidate = { repository: repo, ref: 'refs/heads/release', sha: web, head: web, commitExists: true,
  dirty: false, pushed: true, nativePushed: true, requiredFilesTracked: true, owner: 'GOV',
  capabilities: ['skill-tree'], intentionalRemovals: [], committedDecisions: [] };
const lease = { owner_task_id: 'GOV', status: 'ACTIVE', web_deploy_git_sha: web };
const check = (changes = {}, mode = 'precheck') => evaluatePromotion({ authority, state, candidate,
  currentHashes: { pass: true }, lease, mode, ...changes });
const blocked = (result, code) => assert.ok(result.errors.some(x => x.startsWith(code)), JSON.stringify(result));
let count = 0;
const test = (name, fn) => { fn(); count++; process.stdout.write(`PASS ${count} ${name}\n`); };

test('clean pushed canonical SHA eligible', () => assert.equal(check().eligible, true));
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
    github_remote: repo, github_ref: 'refs/heads/release', web_build_manifest: 'manifest.json',
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
    const here = path.dirname(fileURLToPath(import.meta.url));
    const bootstrap = JSON.parse(fs.readFileSync(path.resolve(here, '../../../docs/project-control/production-deployment-state-bootstrap-v3.json'), 'utf8'));
    assert.equal(bootstrap.current_production_runtime.last_observed_receipt_status, 'CANDIDATE_ACTIVE');
    assert.equal(bootstrap.canonical_git_authority.native_git_sha, 'UNRESOLVED');
    blocked(check({ state: bootstrap }), 'PRODUCTION_GIT_BASELINE_INVALID');
  });
  test('deploy requires owner lease', () => blocked(check({ lease: null }, 'deploy'), 'DEPLOYMENT_LEASE_NOT_OWNED'));
  test('undefined release ref blocks deploy', () => blocked(check({ authority: { web: { repository: repo, release_ref: null } } }), 'CANONICAL_RELEASE_REF_UNDEFINED'));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
process.stdout.write(`GOVERNANCE_TEST_COUNT=${count}\n`);
