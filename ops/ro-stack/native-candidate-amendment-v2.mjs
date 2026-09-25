#!/usr/bin/env node
// Same-lease M1 amendment after the immutable shutdown-race candidate.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, FIRST_PROMOTION, windowsPowerShellEnv } from './legacy-production-baseline.mjs';
import { git, pinned, equalHash, groups, shutdownContract, verifyNativeRemote,
  inspectNativeCandidate, verifyNativeStage, nativeReceiptValid, activeNativeReceiptPath } from './native-promotion-contract.mjs';
import { amendmentAdapter, deployAmendedNative, gracefulShutdownCycle } from './native-candidate-amendment.mjs';
import { M1_SECOND_NATIVE_AMENDMENT, approvedNativeAmendment, validateHistoricalNativeAnchor,
  validateNextNativeAmendment, applyNextNativeAmendment,
  deployedNativeRuntimeMatches } from './native-amendment-chain.mjs';

// The approved reason selects the exact source scope; default keeps the
// historical second amendment invocation unchanged.
let approved = M1_SECOND_NATIVE_AMENDMENT;
export function selectNativeAmendmentReason(reason) {
  const selected = reason ? approvedNativeAmendment(reason) : M1_SECOND_NATIVE_AMENDMENT;
  if (!selected) throw Error('NATIVE_AMENDMENT_REASON_UNAPPROVED');
  approved = selected;
  return selected;
}

const governanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SUITE = 'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1';
const need = (ok, code) => { if (!ok) throw Error(code); };
const writeNew = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const files = root => ({ lease: boundedPath(root, '.local/ro-stack/production-deployment-lease/lease.json'),
  pending: boundedPath(root, '.local/ro-stack/first-github-first-promotion.pending.json'),
  state: boundedPath(root, '.local/ro-stack/production-deployment-state.json') });
const sourceDiff = (src, previous, next) => {
  git(src, 'merge-base', '--is-ancestor', previous, next);
  const names = git(src, 'diff', '--name-only', previous, next).split(/\r?\n/).filter(Boolean).sort();
  need(names.length > 0 && names.every(name => approved.sourcePaths.includes(name)), 'NATIVE_AMENDMENT_DIFF_OUT_OF_SCOPE');
  return { scope: approved.scope, files: names };
};

// Preparation runs only against a clean GitHub-sourced Native build directory.
// The build source, authoritative runtime, and immutable receipts stay separate.
export function prepareNextNativeCandidate({ buildRoot, prod, authority,
  remoteVerifier = verifyNativeRemote, runSuite = true }) {
  const f = files(prod), lease = readJson(f.lease), pending = readJson(f.pending), state = readJson(f.state);
  const history = validateHistoricalNativeAnchor(prod, lease, pending);
  need(lease.active_native_candidate.deployed === true &&
    lease.native_deploy_git_sha === pending.native_git_sha &&
    lease.native_deploy_git_sha === history.at(-1).new_native_git_sha,
  'PREVIOUS_NATIVE_CANDIDATE_NOT_DEPLOYED');
  const b = readJson(path.join(buildRoot, 'build-receipt.json'));
  const src = b.source_root, previous = lease.native_deploy_git_sha;
  need(path.resolve(src) === path.join(buildRoot, 'source'), 'NATIVE_BUILD_LAYOUT_INVALID');
  remoteVerifier(src, b.native_git_sha, authority);
  need(b.schema_version === 'native-build-v1' && b.source_tree_state === 'CLEAN' &&
    b.build_configuration === 'Release x64' && b.tests_result === 'PASS' &&
    git(src, 'rev-parse', 'HEAD') === b.native_git_sha &&
    git(src, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
    b.artifacts?.length === 3 &&
    b.artifacts.every(item => equalHash(digest(boundedPath(src, item.path)), item.sha256)),
  'NATIVE_BUILD_INVALID');
  for (const row of b.tests_run || []) pinned(buildRoot, row.receipt);
  const regressionGroups = Object.entries(groups).map(([group, suite]) => {
    const row = b.tests_run.find(item => item.test_suite === suite);
    need(row?.result === 'PASS', 'NATIVE_REGRESSION_GROUP_MISSING:' + group);
    return { group, test_suite: suite, result: 'PASS', receipt: row.receipt };
  });
  need(shutdownContract(src), 'SHUTDOWN_SOURCE_CONTRACT_FAILED');
  const diff = sourceDiff(src, previous, b.native_git_sha);
  const stage = verifyNativeStage(prod, state, lease, lease.admission_manifest_sha256);
  need(stage.pass && stage.rollbackReady, 'NATIVE_STAGE_OR_ROLLBACK_INVALID');
  const currentPath = activeNativeReceiptPath(pending), currentFile = boundedPath(prod, currentPath);
  need(equalHash(digest(currentFile), pending.native_receipt_sha256), 'PREVIOUS_NATIVE_RECEIPT_CHANGED');
  const current = readJson(currentFile);
  need(nativeReceiptValid(current, { nativeSha: previous, leaseId: lease.lease_id,
    manifestHash: lease.native_candidate_manifest_sha256 }) &&
    current.artifacts.every(item => equalHash(digest(boundedPath(prod, item.path)), item.sha256)),
  'PREVIOUS_NATIVE_RUNTIME_CHANGED');
  const log = path.join(buildRoot, 'tests', 'm1-v15-executor-fixture.log');
  need(runSuite && fs.existsSync(boundedPath(src, SUITE)), 'M1_V15_DIRECT_SUITE_REQUIRED');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    boundedPath(src, SUITE), '-Root', src], { cwd: src, windowsHide: true, encoding: 'utf8',
    timeout: 600000, env: windowsPowerShellEnv(), maxBuffer: 16 * 1024 * 1024 });
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''), { flag: 'wx' });
  const output = fs.readFileSync(log, 'utf8');
  need(r.status === 0 && output.includes('M1_SETTINGS_EXECUTOR_TEST_PASS') &&
    output.includes('M1_FIXTURE_SECURITY_TEST_PASS') &&
    git(src, 'status', '--porcelain=v1', '--untracked-files=all') === '',
  'M1_V15_DIRECT_SUITE_FAILED');
  const m1Suite = { test_suite: SUITE, result: 'PASS', receipt: { path: 'tests/m1-v15-executor-fixture.log', sha256: digest(log) } };
  const rollbackDir = path.join(buildRoot, 'intermediate-rollback');
  fs.mkdirSync(rollbackDir);
  const intermediate = current.artifacts.map(item => {
    const dest = path.join(rollbackDir, path.basename(item.path));
    fs.copyFileSync(boundedPath(prod, item.path), dest, fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(dest), item.sha256), 'INTERMEDIATE_ROLLBACK_COPY_CHANGED');
    return { path: 'intermediate-rollback/' + path.basename(item.path),
      production_path: item.path, sha256: item.sha256 };
  });
  const accepted = readJson(boundedPath(prod, state.accepted_capability_manifest));
  const registry = readJson(path.join(governanceRoot, 'docs/project-control/production-capabilities.json')).capabilities;
  need(accepted.capabilities?.length === 18, 'LEGACY_CAPABILITY_COUNT_CHANGED');
  const comparison = { schema_version: 'native-capabilities-v1', native_git_sha: b.native_git_sha,
    baseline_sha256: state.accepted_capability_manifest_sha256,
    acceptance_scope: 'SOURCE_CONTRACT; Web requires independent combined preflight',
    capabilities: accepted.capabilities.map(item => {
      const d = registry.find(row => row.id === item.id);
      need(d?.source_paths?.length, 'CAPABILITY_DEFINITION_MISSING');
      if (d.scope === 'NATIVE') for (const p of d.source_paths) git(src, 'cat-file', '-e', `${b.native_git_sha}:${p}`);
      return { id: item.id, classification: 'PRESERVED', scope: d.scope || 'WEB',
        source_paths: d.source_paths, evidence: d.scope === 'NATIVE' ? 'native-regression.json' : 'COMBINED_WEB_PREFLIGHT_REQUIRED' };
    }) };
  const write = (name, value) => writeNew(path.join(buildRoot, name), value);
  const pin = name => ({ path: name, sha256: digest(path.join(buildRoot, name)) });
  write('native-regression.json', { schema_version: 'native-regression-v1', native_git_sha: b.native_git_sha,
    result: 'PASS', groups: regressionGroups,
    shutdown_source_contract: { result: 'PASS', files:
      ['src/map/map.cpp', 'src/map/persistent_agent.cpp', 'src/map/persistent_agent_state.cpp']
        .map(p => ({ path: p, sha256: digest(boundedPath(src, p)) })) }, additional_suites: [m1Suite] });
  write('capability-comparison.json', comparison);
  const lifecycle = ['ro-stack.ps1', 'stack.config.psd1', 'runtime-guard.ps1',
    'runtime-guard.lib.ps1', 'graceful-console-signal.ps1'].map(name => {
    const p = `ops/ro-stack/${name}`;
    return { path: p, sha256: digest(boundedPath(prod, p)) };
  });
  const manifest = { schema_version: 'native-candidate-v1', candidate_id: 'native-' + randomUUID(),
    native_git_sha: b.native_git_sha, binary_sha256: b.binary_sha256,
    build_receipt: pin('build-receipt.json'), regression: pin('native-regression.json'),
    canonical_repository: b.canonical_repository, canonical_branch: 'main',
    required_database: 'ragnarok', required_runtime_ports: [6901, 6122, 5122, 8788],
    required_openkore_count: 0,
    required_capability_baseline: { path: state.accepted_capability_manifest,
      sha256: state.accepted_capability_manifest_sha256 },
    capability_comparison: pin('capability-comparison.json'),
    rollback_reference: { root: state.legacy_rollback.root,
      current_native_binary_sha256: state.current_native_binary_sha256,
      intermediate_rollback: { native_git_sha: previous, native_receipt: currentPath,
        native_receipt_sha256: digest(currentFile), artifacts: intermediate } },
    amendment_of: { native_git_sha: previous,
      candidate_manifest_sha256: lease.native_candidate_manifest_sha256,
      native_receipt_sha256: digest(currentFile), reason: approved.reason },
    diff_audit: diff, lifecycle_files: lifecycle };
  write('candidate-manifest.json', manifest);
  const manifestFile = path.join(buildRoot, 'candidate-manifest.json');
  return { manifest: manifestFile, sha256: digest(manifestFile), previous,
    candidate: b.native_git_sha, source_diff: diff, regression_groups: regressionGroups.length,
    rollback_artifacts: intermediate.length, production_mutated: false };
}

export function planNextNativeAmendment({ root, owner, leaseId, manifestFile, manifestSha,
  authority, runtime }) {
  const f = files(root), lease = readJson(f.lease), pending = readJson(f.pending), state = readJson(f.state);
  validateHistoricalNativeAnchor(root, lease, pending);
  need(equalHash(digest(manifestFile), manifestSha), 'NATIVE_MANIFEST_CHANGED');
  const manifest = readJson(manifestFile), buildRoot = path.dirname(manifestFile);
  const build = readJson(pinned(buildRoot, manifest.build_receipt));
  const currentFile = boundedPath(root, activeNativeReceiptPath(pending));
  const current = readJson(currentFile);
  const inspected = inspectNativeCandidate({ file: manifestFile, sha256: manifestSha,
    root, state: { ...state, production_drift: 'CLOSED' }, authority,
    webCapabilities: lease.candidate_capabilities || [], webRoot: governanceRoot,
    webSha: git(governanceRoot, 'rev-parse', 'HEAD') });
  const regression = readJson(pinned(buildRoot, manifest.regression));
  const m1Suite = regression.additional_suites?.find(row => row.test_suite === SUITE && row.result === 'PASS');
  const output = m1Suite && fs.readFileSync(pinned(buildRoot, m1Suite.receipt), 'utf8');
  const regressionPassed = inspected.eligible === true && !!output &&
    output.includes('M1_SETTINGS_EXECUTOR_TEST_PASS') &&
    output.includes('M1_FIXTURE_SECURITY_TEST_PASS');
  const ir = manifest.rollback_reference?.intermediate_rollback;
  const rollbackReady = verifyNativeStage(root, state, lease, lease.admission_manifest_sha256).rollbackReady === true &&
    ir?.native_git_sha === lease.native_deploy_git_sha &&
    equalHash(ir.native_receipt_sha256, digest(currentFile)) &&
    ir.artifacts?.length === 3 && ir.artifacts.every(item =>
      equalHash(digest(boundedPath(buildRoot, item.path)), item.sha256) &&
      current.artifacts.some(c => c.path === item.production_path && equalHash(c.sha256, item.sha256)));
  const runtimeMatchesDeployed = deployedNativeRuntimeMatches(runtime, current) &&
    current.artifacts.every(item => equalHash(digest(boundedPath(root, item.path)), item.sha256));
  const diff = sourceDiff(build.source_root, lease.native_deploy_git_sha, manifest.native_git_sha);
  need(JSON.stringify(diff) === JSON.stringify(manifest.diff_audit), 'NATIVE_AMENDMENT_DIFF_CHANGED');
  const input = { lease, pending, state, owner, leaseId, previousSha: lease.native_deploy_git_sha,
    newSha: manifest.native_git_sha, reason: approved.reason, scope: approved.scope,
    promotionId: `${FIRST_PROMOTION}:${pending.started_at}`, candidateManifest: manifest,
    candidateManifestSha256: manifestSha, sourceDiff: diff,
    githubReachable: inspected.eligible === true,
    descendant: true, regressionPassed, rollbackReady, runtimeMatchesDeployed,
    previousReceiptSha256: digest(currentFile),
    tests: { m1_suite: m1Suite?.receipt, native_groups: regression.groups?.length,
      shutdown_contract: regression.shutdown_source_contract?.result } };
  validateNextNativeAmendment(root, input);
  return { input, candidateManifestPath: manifestFile,
    currentHashes: Object.fromEntries(Object.entries(f).map(([key, value]) => [key, digest(value)])) };
}

const v2Policy = (oldSha, newSha) => ({ old_sha: oldSha, new_sha: newSha,
  no_force_retirement: true, retire_extra_wait_ms: 20000,
  retire_timeout_ms: 40000, graceful_timeout_ms: 60000 });

async function main() {
  const argv = process.argv.slice(2);
  const args = Object.fromEntries(argv.flatMap((item, i) => item.startsWith('--') ? [[item.slice(2), argv[i + 1]]] : []));
  const root = fs.realpathSync(args['production-root'] || '');
  need(root.toLowerCase() === 'c:\\users\\administrator\\ghost-island-production\\ro-stack',
    'CANONICAL_PRODUCTION_ROOT_REQUIRED');
  need(['prepare', 'plan', 'amend', 'deploy', 'graceful-cycle'].includes(args.action) &&
    args.owner && args.lease, 'ARGUMENTS_REQUIRED');
  need(['prepare', 'plan'].includes(args.action) || args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
  selectNativeAmendmentReason(args.reason);
  need(git(governanceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '', 'GOVERNANCE_SOURCE_DIRTY');
  const governanceSha = git(governanceRoot, 'rev-parse', 'HEAD');
  const mainTip = git(governanceRoot, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
  git(governanceRoot, 'fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main');
  git(governanceRoot, 'merge-base', '--is-ancestor', governanceSha, mainTip);
  const authority = readJson(path.join(governanceRoot, 'docs/project-control/production-release-authority.json')).native;
  if (args.action === 'prepare') {
    need(args['build-root'], 'BUILD_ROOT_REQUIRED');
    const buildRoot = fs.realpathSync(args['build-root']);
    need(!buildRoot.toLowerCase().startsWith(root.toLowerCase() + path.sep), 'BUILD_IN_PRODUCTION_FORBIDDEN');
    console.log(JSON.stringify(prepareNextNativeCandidate({ buildRoot, prod: root, authority }), null, 2));
    return;
  }
  const f = files(root), lease = readJson(f.lease), pending = readJson(f.pending);
  validateHistoricalNativeAnchor(root, lease, pending);
  const adapter = amendmentAdapter(root, args.owner, args.lease);
  if (args.action === 'plan' || args.action === 'amend') {
    need(args['candidate-manifest'] && args['manifest-sha256'], 'CANDIDATE_ARGUMENTS_REQUIRED');
    const runtime = await adapter('snapshot');
    const plan = planNextNativeAmendment({ root, owner: args.owner, leaseId: args.lease,
      manifestFile: path.resolve(args['candidate-manifest']), manifestSha: args['manifest-sha256'],
      authority, runtime });
    const result = args.action === 'plan'
      ? { eligible: true, dry_run: true, previous: plan.input.previousSha, candidate: plan.input.newSha,
        source_diff: plan.input.sourceDiff }
      : applyNextNativeAmendment(root, plan);
    console.log(JSON.stringify({ ...result, governance_sha: governanceSha }, null, 2));
    return;
  }
  const latest = lease.native_candidate_amendments.at(-1);
  need(latest.reason === approved.reason && latest.new_native_git_sha === lease.active_native_candidate.native_git_sha,
    'LATEST_NATIVE_AMENDMENT_SCOPE_INVALID');
  const policy = v2Policy(latest.old_native_git_sha, latest.new_native_git_sha);
  const result = args.action === 'deploy'
    ? await deployAmendedNative({ root, owner: args.owner, leaseId: args.lease, adapter, policy })
    : await gracefulShutdownCycle({ root, owner: args.owner, leaseId: args.lease, adapter, policy });
  console.log(JSON.stringify({ ...result, governance_sha: governanceSha }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(e => { console.error(JSON.stringify({ eligible: false, error: e.message })); process.exitCode = 1; });
