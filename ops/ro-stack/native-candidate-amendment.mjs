#!/usr/bin/env node
// ACTIVE_FIRST_PROMOTION_NATIVE_CANDIDATE_AMENDMENT_V1
// Same promotion, same lease, same Web candidate: replace the reconciled Native
// stage candidate with a descendant SHA that carries one bounded source fix.
// Actions: plan (read-only), amend, deploy (owner), graceful-cycle (owner).
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, legacyIdentity, pendingPath, consumedPath, FIRST_PROMOTION, windowsPowerShellEnv } from './legacy-production-baseline.mjs';
import { nativeReceiptValid, activeNativeReceiptPath, equalHash, git, pinned, verifyNativeStage, inspectNativeCandidate,
  verifyNativeRemote, shutdownContract, sourceBody, groups } from './native-promotion-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const governanceRoot = path.resolve(here, '../..');
export const AMENDMENT = Object.freeze({
  reason: 'NATIVE_PA_GRACEFUL_SHUTDOWN_MYSQL_RACE_V1', scope: 'BOUNDED_NATIVE_SHUTDOWN_FIX',
  old_sha: 'a4c736d865eeedca398aad97aeff1c1036f2dc39', new_sha: '23c47bfee3a4a1dae21754fb7a4e3ed32d3f657a',
  web_sha: '8cdb13fb88be7199aae15b81e55a9a89a5ec78c5', lease_id: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a',
  // Launcher map graceful timeout is 40 s; the fallback also waits this long.
  retire_timeout_ms: 40000, retire_extra_wait_ms: 20000, graceful_timeout_ms: 60000
});
export const DIFF_FILES = Object.freeze(['src/map/map.cpp', 'src/map/map_shutdown_handoff.hpp', 'src/map/persistent_agent.cpp',
  'tools/pa-shutdown-handoff/build-and-test-shutdown-handoff.ps1', 'tools/pa-shutdown-handoff/test_shutdown_handoff.cpp']);
const SUITE = 'tools/pa-shutdown-handoff/build-and-test-shutdown-handoff.ps1';
const SUITE_OUTPUTS = ['tools/pa-shutdown-handoff/out/test_shutdown_handoff.exe', 'tools/pa-shutdown-handoff/out/test_shutdown_handoff.obj'];
const check = (ok, code) => { if (!ok) throw Error(code); };
const writeNew = (file, value) => fs.writeFileSync(file, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const atomic = (file, value) => { const tmp = file + '.' + randomUUID() + '.tmp'; writeNew(tmp, value); fs.renameSync(tmp, file); };
const rel = (root, file) => path.relative(root, file).replaceAll('\\', '/');
const short = sha => sha.slice(0, 12);
const trimLines = text => text.split(/\r?\n/).map(x => x.trim());
const meaningful = x => x && !x.startsWith('//') && !x.startsWith('/*') && !x.startsWith('*');
const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
const canonicalDigest = v => createHash('sha256').update(JSON.stringify(sortKeys(v))).digest('hex').toUpperCase();

// PHASE 1: every changed line is inside the shutdown handoff. Anything else,
// including gameplay code in the same files, is rejected.
export function auditShutdownFixDiff(src, oldSha, newSha) {
  git(src, 'cat-file', '-e', oldSha + '^{commit}');
  git(src, 'merge-base', '--is-ancestor', oldSha, newSha);
  const names = git(src, 'diff', '--name-only', oldSha, newSha).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(names) === JSON.stringify([...DIFF_FILES].sort()), 'DIFF_FILE_SET_OUT_OF_SCOPE');
  const delta = file => {
    const lines = git(src, 'diff', '-U0', oldSha, newSha, '--', file).split(/\r?\n/);
    return { removed: lines.filter(x => x.startsWith('-') && !x.startsWith('---')).map(x => x.slice(1).trim()).filter(meaningful),
      added: lines.filter(x => x.startsWith('+') && !x.startsWith('+++')).map(x => x.slice(1).trim()).filter(meaningful) };
  };
  const oldMap = git(src, 'show', oldSha + ':src/map/map.cpp'), newMap = git(src, 'show', newSha + ':src/map/map.cpp');
  const oldHandler = new Set(trimLines(sourceBody(oldMap, 'void MapServer::handle_shutdown()')));
  const newAllowed = new Set([...trimLines(sourceBody(newMap, 'void MapServer::finalize()')),
    ...trimLines(sourceBody(newMap, 'void MapServer::handle_shutdown()')), '#include "map_shutdown_handoff.hpp"',
    'MapShutdownHandoff& map_shutdown_handoff() {', 'static MapShutdownHandoff handoff;', 'return handoff;', '}',
    'void MapServer::handle_shutdown(){', 'map_shutdown_handoff().bind_main_thread();']);
  const map = delta('src/map/map.cpp');
  check(map.removed.every(x => oldHandler.has(x) || x === 'void MapServer::handle_shutdown(){'), 'MAP_REMOVAL_OUTSIDE_SHUTDOWN_HANDLER');
  check(map.added.every(x => newAllowed.has(x)), 'MAP_ADDITION_OUTSIDE_SHUTDOWN_HANDOFF');
  const pa = delta('src/map/persistent_agent.cpp');
  const paAdded = new Set(['if (pa_lifecycle_stopped())', '#include "map_shutdown_handoff.hpp"', 'bool pa_lifecycle_stopped() {',
    'return shutting_down || map_shutdown_handoff().requested();', '}']);
  check(pa.removed.every(x => x === 'if (shutting_down)') && pa.added.every(x => paAdded.has(x)), 'PA_CHANGE_OUTSIDE_LIFECYCLE_GUARD');
  const guards = pa.added.filter(x => x === 'if (pa_lifecycle_stopped())').length;
  check(guards === pa.removed.length && guards === 6, 'PA_GUARD_REPLACEMENT_COUNT_INVALID');
  return { scope: AMENDMENT.scope, files: names, map_lines_removed: map.removed.length, map_lines_added: map.added.length,
    pa_timer_guards_replaced: guards, gameplay_lines_changed: 0 };
}

// PHASE 3: named behaviors. The diff audit proves they are byte-identical
// outside the shutdown hunks; these markers prove they exist in the new SHA.
export function explicitPreservation(src, oldSha, newSha, configBytes) {
  const show = p => git(src, 'show', newSha + ':' + p);
  const sameBlob = p => git(src, 'rev-parse', oldSha + ':' + p) === git(src, 'rev-parse', newSha + ':' + p);
  const pa = show('src/map/persistent_agent.cpp'), skill = show('src/map/persistent_agent_attack_skill_condition.hpp');
  const configText = new TextDecoder('utf-8', { fatal: true }).decode(configBytes);
  const value = key => { const m = configText.match(new RegExp('^\\s*' + key + '\\s*=\\s*(\\d+)\\s*$', 'gm')) || [];
    check(m.length === 1, 'CONFIG_KEY_CARDINALITY_INVALID'); return Number(m[0].split('=')[1]); };
  const rows = [
    { id: 'SP_0_0_BEHAVIOR', pass: value('PersistentAgentSpThresholdPercent') === 0 && value('PersistentAgentSpSafePercent') === 0 &&
      pa.includes('configured_percent("PERSISTENT_AGENT_SP_THRESHOLD_PCT", sp_threshold_pct, 0)') &&
      pa.includes('configured_percent("PERSISTENT_AGENT_SP_SAFE_PCT", sp_safe_pct, 0)'),
      evidence: 'Production stack.config SP 0/0 and unchanged PA SP loader' },
    { id: 'HYBRID_LOW_SP_WEAPON_FALLBACK', pass: sameBlob('src/map/persistent_agent_attack_skill_condition.hpp') &&
      skill.includes('current_sp >= required_sp') && pa.includes('else if (runtime.weapon_attack_enabled)') &&
      sameBlob('src/map/persistent_agent_farm_profile.hpp'),
      evidence: 'skill row availability and weapon fallback unchanged' },
    { id: 'START_STOP_FARM_LIFECYCLE', pass: pa.includes('command.action == "start_farm"') &&
      pa.includes('command.action == "stop_farm"') && pa.includes('void stop_farm_runtime('),
      evidence: 'start_farm/stop_farm dispatch and stop_farm_runtime present; hunks limited to lifecycle guards' }];
  check(rows.every(x => x.pass), 'EXPLICIT_CAPABILITY_NOT_PRESERVED');
  return rows;
}

// Runs the fix's own stress/source suite in the clean clone, pins its log and
// removes only its two exact generated outputs.
export function runShutdownHandoffSuite(buildRoot, src) {
  const log = path.join(buildRoot, 'tests', 'shutdown-handoff.log');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(src, SUITE), '-Root', src],
    { cwd: src, encoding: 'utf8', windowsHide: true, timeout: 600000, env: windowsPowerShellEnv(), maxBuffer: 16 * 1024 * 1024 });
  writeNew(log, Buffer.from((r.stdout || '') + (r.stderr || ''), 'utf8'));
  const text = fs.readFileSync(log, 'utf8');
  const metric = k => Number((text.match(new RegExp(k + '=(\\d+)')) || [])[1]);
  check(r.status === 0 && text.includes('SHUTDOWN_HANDOFF_TEST_PASS') && text.includes('SHUTDOWN_HANDOFF_SOURCE_PASS') &&
    metric('SHUTDOWN_STRESS_ITERATIONS') >= 200 && ['HANG_COUNT', 'DUPLICATE_PREPARE_COUNT', 'CROSS_THREAD_DB_ACCESS_COUNT',
      'POST_SHUTDOWN_REQUEST_NEW_PA_WORK'].every(k => metric(k) === 0), 'SHUTDOWN_HANDOFF_SUITE_FAILED');
  const generated = [];
  for (const p of SUITE_OUTPUTS) {
    const f = boundedPath(src, p);
    if (fs.existsSync(f)) { check(!fs.lstatSync(f).isSymbolicLink(), 'GENERATED_PATH_INVALID'); generated.push({ path: p, sha256: digest(f) }); fs.unlinkSync(f); }
  }
  const out = boundedPath(src, 'tools/pa-shutdown-handoff/out');
  if (fs.existsSync(out)) fs.rmdirSync(out);
  check(git(src, 'status', '--porcelain=v1', '--untracked-files=all') === '', 'SOURCE_NOT_CLEAN_AFTER_SUITE');
  return { test_suite: SUITE, result: 'PASS', receipt: { path: 'tests/shutdown-handoff.log', sha256: digest(log) },
    stress: Object.fromEntries(['SHUTDOWN_STRESS_ITERATIONS', 'HANG_COUNT', 'DUPLICATE_PREPARE_COUNT', 'CROSS_THREAD_DB_ACCESS_COUNT',
      'POST_SHUTDOWN_REQUEST_NEW_PA_WORK'].map(k => [k, metric(k)])), generated_test_outputs: generated };
}

function productionFiles(root) {
  const dir = boundedPath(root, '.local/ro-stack');
  return { dir, lease: path.join(dir, 'production-deployment-lease/lease.json'), state: path.join(dir, 'production-deployment-state.json'),
    pending: boundedPath(root, pendingPath), consumed: boundedPath(root, consumedPath) };
}

function currentNativeStage(root, lease, pending, oldSha) {
  const receiptPath = activeNativeReceiptPath(pending), file = boundedPath(root, receiptPath), receipt = readJson(file);
  const valid = equalHash(pending.native_receipt_sha256, digest(file)) &&
    nativeReceiptValid(receipt, { nativeSha: oldSha, leaseId: lease.lease_id, manifestHash: lease.native_candidate_manifest_sha256 }) &&
    receipt.artifacts.every(x => equalHash(digest(boundedPath(root, x.path)), x.sha256));
  return { receiptPath, file, receipt, valid, sha256: digest(file) };
}

// PHASE 2/3 preparation in --amend-active mode. Output stays in buildRoot.
export function prepareAmendedNativeCandidate({ buildRoot, prod, authority, remoteVerifier = verifyNativeRemote, suite = runShutdownHandoffSuite }) {
  const b = readJson(path.join(buildRoot, 'build-receipt.json')), src = b.source_root;
  check(b.native_git_sha === AMENDMENT.new_sha, 'BUILD_NOT_AMENDED_SHA');
  remoteVerifier(src, b.native_git_sha, authority);
  check(git(src, 'rev-parse', 'HEAD') === b.native_git_sha && !git(src, 'status', '--porcelain=v1', '--untracked-files=all'), 'SOURCE_NOT_CLEAN');
  check(b.schema_version === 'native-build-v1' && b.source_tree_state === 'CLEAN' && b.build_configuration === 'Release x64' && b.tests_result === 'PASS', 'BUILD_RECEIPT_INVALID');
  check(b.artifacts.length === 3 && b.artifacts.every(x => equalHash(digest(boundedPath(src, x.path)), x.sha256)), 'BUILD_ARTIFACT_CHANGED');
  for (const s of b.tests_run) pinned(buildRoot, s.receipt);
  const rows = Object.entries(groups).map(([group, test_suite]) => {
    const s = b.tests_run.find(x => x.test_suite === test_suite); check(s?.result === 'PASS', 'REGRESSION_GROUP_MISSING:' + group);
    return { group, test_suite, result: 'PASS', receipt: s.receipt };
  });
  check(shutdownContract(src), 'SHUTDOWN_SOURCE_CONTRACT_FAILED');
  const handoff = suite(buildRoot, src);
  const diff = auditShutdownFixDiff(src, AMENDMENT.old_sha, b.native_git_sha);
  const f = productionFiles(prod), state = readJson(f.state), lease = readJson(f.lease), pending = readJson(f.pending);
  const stage = verifyNativeStage(prod, state, lease, lease.admission_manifest_sha256);
  check(stage.pass && stage.rollbackReady, 'NATIVE_STAGE_OR_ROLLBACK_INVALID');
  const current = currentNativeStage(prod, lease, pending, AMENDMENT.old_sha);
  check(current.valid, 'PREVIOUS_NATIVE_RECEIPT_INVALID');
  const rollbackDir = path.join(buildRoot, 'intermediate-rollback'); fs.mkdirSync(rollbackDir);
  const intermediate = current.receipt.artifacts.map(x => {
    const dest = path.join(rollbackDir, path.basename(x.path));
    fs.copyFileSync(boundedPath(prod, x.path), dest, fs.constants.COPYFILE_EXCL);
    check(equalHash(digest(dest), x.sha256), 'INTERMEDIATE_ROLLBACK_COPY_CHANGED');
    return { path: 'intermediate-rollback/' + path.basename(x.path), production_path: x.path, sha256: String(x.sha256).toUpperCase() };
  });
  const configFile = boundedPath(prod, 'ops/ro-stack/stack.config.psd1');
  const explicit = explicitPreservation(src, AMENDMENT.old_sha, b.native_git_sha, fs.readFileSync(configFile));
  const accepted = readJson(boundedPath(prod, state.accepted_capability_manifest));
  check(accepted.capabilities.length === 18, 'LEGACY_CAPABILITY_COUNT_CHANGED');
  const registry = readJson(path.join(governanceRoot, 'docs/project-control/production-capabilities.json')).capabilities;
  const comparison = { schema_version: 'native-capabilities-v1', native_git_sha: b.native_git_sha, baseline_sha256: state.accepted_capability_manifest_sha256,
    acceptance_scope: 'SOURCE_CONTRACT; WEB rows require independent combined Web preflight; no live acceptance',
    capabilities: accepted.capabilities.map(x => {
      const d = registry.find(y => y.id === x.id); check(d?.source_paths?.length, 'CAPABILITY_DEFINITION_MISSING');
      if (d.scope === 'NATIVE') for (const p of d.source_paths) git(src, 'cat-file', '-e', b.native_git_sha + ':' + p);
      return { id: x.id, classification: 'PRESERVED', scope: d.scope || 'WEB', source_paths: d.source_paths,
        evidence: d.scope === 'NATIVE' ? 'native-regression.json' : 'COMBINED_WEB_PREFLIGHT_REQUIRED' };
    }), explicit_preservation: explicit, missing: 0, unknown: 0 };
  const write = (name, value) => writeNew(path.join(buildRoot, name), value);
  const pin = name => ({ path: name, sha256: digest(path.join(buildRoot, name)) });
  write('native-regression.json', { schema_version: 'native-regression-v1', native_git_sha: b.native_git_sha, result: 'PASS', groups: rows,
    shutdown_source_contract: { result: 'PASS', files: ['src/map/map.cpp', 'src/map/persistent_agent.cpp', 'src/map/persistent_agent_state.cpp']
      .map(p => ({ path: p, sha256: digest(boundedPath(src, p)) })) }, additional_suites: [handoff] });
  write('capability-comparison.json', comparison);
  const lifecycle = ['ro-stack.ps1', 'stack.config.psd1', 'runtime-guard.ps1', 'runtime-guard.lib.ps1', 'graceful-console-signal.ps1']
    .map(n => ({ path: 'ops/ro-stack/' + n, sha256: digest(boundedPath(prod, 'ops/ro-stack/' + n)) }));
  write('candidate-manifest.json', { schema_version: 'native-candidate-v1', candidate_id: 'native-' + randomUUID(), native_git_sha: b.native_git_sha,
    binary_sha256: b.binary_sha256, build_receipt: pin('build-receipt.json'), regression: pin('native-regression.json'),
    canonical_repository: b.canonical_repository, canonical_branch: 'main', required_database: 'ragnarok',
    required_runtime_ports: [6901, 6122, 5122, 8788], required_openkore_count: 0,
    required_capability_baseline: { path: state.accepted_capability_manifest, sha256: state.accepted_capability_manifest_sha256 },
    capability_comparison: pin('capability-comparison.json'),
    rollback_reference: { root: state.legacy_rollback.root, current_native_binary_sha256: state.current_native_binary_sha256,
      intermediate_rollback: { native_git_sha: AMENDMENT.old_sha, native_receipt: current.receiptPath, native_receipt_sha256: current.sha256, artifacts: intermediate } },
    amendment_of: { native_git_sha: AMENDMENT.old_sha, candidate_manifest_sha256: lease.native_candidate_manifest_sha256,
      native_receipt_sha256: current.sha256, reason: AMENDMENT.reason },
    diff_audit: diff, lifecycle_files: lifecycle });
  const file = path.join(buildRoot, 'candidate-manifest.json');
  return { manifest: file, sha256: digest(file), groups: rows.length, shutdown_handoff: handoff.stress, diff_scope: diff.scope,
    explicit_preservation: explicit.map(x => x.id + '=PASS'), intermediate_rollback: intermediate.length, legacy_capabilities: accepted.capabilities.length };
}

// PHASE 4: pure authority rules. Inputs are measured by planNativeAmendment.
export function validateNativeAmendment(x, policy = AMENDMENT) {
  check(x.lease?.lease_id === x.leaseId && x.lease.owner_task_id === x.owner && x.lease.status === 'ACTIVE' &&
    x.lease.promotion_mode === FIRST_PROMOTION && x.lease.emergency !== true && x.leaseId === policy.lease_id &&
    x.pending?.lease_id === x.leaseId && x.pending.owner_task_id === x.owner, 'ACTIVE_LEASE_IDENTITY_MISMATCH');
  check(!x.promotionComplete && legacyIdentity(x.state) && x.state.production_drift === 'OPEN' &&
    x.state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT' &&
    x.state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' &&
    x.pending.native_stage === 'NATIVE_STAGE_COMPLETE', 'FIRST_PROMOTION_NOT_STAGED');
  check(x.oldSha === policy.old_sha && x.lease.native_deploy_git_sha === x.oldSha && x.pending.native_git_sha === x.oldSha, 'OLD_NATIVE_SHA_MISMATCH');
  check(x.newSha === policy.new_sha && x.newSha !== x.oldSha && x.lineage?.descendant === true && x.lineage.mainReachable === true &&
    x.lineage.authorityAccepted === x.newSha, 'NATIVE_NOT_APPROVED_DESCENDANT');
  check(x.oldReceiptValid === true, 'PREVIOUS_NATIVE_RECEIPT_INVALID');
  check(x.buildValid === true, 'NEW_BUILD_RECEIPT_INVALID');
  check(x.manifestValid === true && x.manifest?.native_git_sha === x.newSha && x.manifest.amendment_of?.native_git_sha === x.oldSha &&
    equalHash(x.manifest.amendment_of.candidate_manifest_sha256, x.lease.native_candidate_manifest_sha256), 'CANDIDATE_MANIFEST_INVALID');
  check(x.rollbackCovered === true, 'ROLLBACK_UNCOVERED');
  check(x.webSha === policy.web_sha && x.lease.web_deploy_git_sha === x.webSha && x.pending.web_git_sha === x.webSha &&
    x.manifestWebSha === x.webSha, 'WEB_CANDIDATE_CHANGED');
  check(x.diffScope === policy.scope, 'DIFF_SCOPE_INVALID');
  check(!x.lease.active_native_candidate && !x.pending.active_native_candidate, 'NATIVE_AMENDMENT_CONFLICT');
  return true;
}

const auditPath = (leaseId, newSha) => `.local/ro-stack/native-candidate-amendment-${leaseId}-${short(newSha)}.json`;

export function planNativeAmendment({ root, owner, leaseId, manifestFile, manifestSha, authority, probe = {} }) {
  const f = productionFiles(root), lease = readJson(f.lease), state = readJson(f.state), pending = readJson(f.pending);
  check(equalHash(digest(manifestFile), manifestSha), 'CANDIDATE_MANIFEST_TAMPERED');
  const m = readJson(manifestFile), base = path.dirname(manifestFile);
  const buildFile = pinned(base, m.build_receipt), b = readJson(buildFile), src = b.source_root;
  const current = (() => { try { return currentNativeStage(root, lease, pending, AMENDMENT.old_sha); } catch { return { valid: false }; } })();
  const measure = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  const buildValid = measure(() => b.schema_version === 'native-build-v1' && b.native_git_sha === m.native_git_sha &&
    b.build_configuration === 'Release x64' && b.tests_result === 'PASS' && b.source_tree_state === 'CLEAN' &&
    equalHash(b.binary_sha256, m.binary_sha256) && b.artifacts.length === 3 &&
    b.artifacts.every(x => equalHash(digest(boundedPath(src, x.path)), x.sha256)) &&
    git(src, 'rev-parse', 'HEAD') === m.native_git_sha && git(src, 'status', '--porcelain=v1', '--untracked-files=all') === '' &&
    readJson(pinned(base, m.regression)).additional_suites?.some(s => s.test_suite === SUITE && s.result === 'PASS' && !!pinned(base, s.receipt)), false);
  const inspect = probe.inspect || (() => inspectNativeCandidate({ file: manifestFile, sha256: manifestSha, root, state: { ...state, production_drift: 'CLOSED' },
    authority, webCapabilities: lease.candidate_capabilities || [], webRoot: governanceRoot, webSha: git(governanceRoot, 'rev-parse', 'HEAD') }));
  const inspected = measure(inspect, { eligible: false, errors: ['INSPECTION_FAILED'] });
  const lineage = probe.lineage ? probe.lineage() : measure(() => {
    git(src, 'merge-base', '--is-ancestor', AMENDMENT.old_sha, m.native_git_sha);
    return { descendant: true, mainReachable: inspected.eligible === true, authorityAccepted: authority.accepted_source_sha };
  }, { descendant: false });
  const diffScope = probe.diff ? probe.diff() : measure(() => auditShutdownFixDiff(src, AMENDMENT.old_sha, m.native_git_sha).scope, 'OUT_OF_SCOPE');
  const ir = m.rollback_reference?.intermediate_rollback;
  const rollbackCovered = measure(() => m.rollback_reference.root === state.legacy_rollback.root &&
    ir.native_git_sha === AMENDMENT.old_sha && equalHash(ir.native_receipt_sha256, current.sha256) && ir.artifacts.length === 3 &&
    ir.artifacts.every(a => equalHash(digest(boundedPath(base, a.path)), a.sha256) &&
      current.receipt.artifacts.some(c => c.path === a.production_path && equalHash(c.sha256, a.sha256))) &&
    verifyNativeStage(root, state, lease, lease.admission_manifest_sha256).rollbackReady === true, false);
  const input = { lease, state, pending, owner, leaseId, oldSha: lease.native_deploy_git_sha, newSha: m.native_git_sha, lineage,
    oldReceiptValid: current.valid === true, buildValid, manifestValid: inspected.eligible === true, manifest: m,
    rollbackCovered, webSha: lease.web_deploy_git_sha, manifestWebSha: lease.web_deploy_git_sha, diffScope,
    promotionComplete: fs.existsSync(f.consumed) };
  return { f, input, current, manifestFile, manifestSha, manifest: m, build: b, inspected,
    hashes: { lease: digest(f.lease), state: digest(f.state), pending: digest(f.pending) } };
}

export function nativeAmendmentApplied(root, lease, pending) {
  const a = lease?.active_native_candidate, entry = lease?.native_candidate_amendments?.at(-1);
  if (!a || !entry || JSON.stringify(lease.native_candidate_amendments) !== JSON.stringify(pending?.native_candidate_amendments) ||
      JSON.stringify(a) !== JSON.stringify(pending.active_native_candidate)) return false;
  try { return equalHash(digest(boundedPath(root, entry.audit_receipt)), entry.audit_sha256) && a.native_git_sha === entry.new_native_git_sha; }
  catch { return false; }
}

// PHASE 4/5: records the amendment. Native bytes and runtime are untouched.
export function applyNativeAmendment(plan, { governanceSha, now = new Date(), policy = AMENDMENT } = {}) {
  const { f, input } = plan, root = path.dirname(path.dirname(f.dir));
  if (input.lease.active_native_candidate?.native_git_sha === input.newSha) {
    check(nativeAmendmentApplied(root, input.lease, input.pending) &&
      equalHash(input.lease.active_native_candidate.candidate_manifest_sha256, plan.manifestSha), 'NATIVE_AMENDMENT_CONFLICT');
    return { already_amended: true, active_native_candidate: input.newSha, audit_receipt: input.lease.native_candidate_amendments.at(-1).audit_receipt };
  }
  validateNativeAmendment(input, policy);
  check(digest(f.lease) === plan.hashes.lease && digest(f.state) === plan.hashes.state && digest(f.pending) === plan.hashes.pending &&
    equalHash(digest(plan.current.file), plan.current.sha256) && equalHash(digest(plan.manifestFile), plan.manifestSha), 'AMENDMENT_INPUT_CHANGED');
  const historyDir = path.join(f.dir, 'native-receipt-history'); fs.mkdirSync(historyDir, { recursive: true });
  const history = path.join(historyDir, plan.current.receipt.deploy_id + '.json');
  if (fs.existsSync(history)) check(equalHash(digest(history), plan.current.sha256), 'RECEIPT_HISTORY_CONFLICT');
  else fs.copyFileSync(plan.current.file, history, fs.constants.COPYFILE_EXCL);
  check(equalHash(digest(history), plan.current.sha256), 'RECEIPT_HISTORY_COPY_CHANGED');
  const m = plan.manifest, audit = boundedPath(root, auditPath(input.leaseId, input.newSha));
  const record = { schema_version: 'native-candidate-amendment-v1', classification: 'NATIVE_CANDIDATE_AMENDED',
    lease_id: input.leaseId, lease_owner: input.owner, promotion_id: `${FIRST_PROMOTION}:${input.pending.started_at}`,
    old_native_git_sha: input.oldSha, new_native_git_sha: input.newSha, reason: policy.reason, diff_scope: m.diff_audit,
    old_native_receipt: { path: plan.current.receiptPath, sha256: plan.current.sha256, history_path: rel(root, history), preserved: true },
    new_build_receipt: { path: path.join(path.dirname(plan.manifestFile), m.build_receipt.path), sha256: m.build_receipt.sha256 },
    new_candidate_manifest: { path: plan.manifestFile, sha256: String(plan.manifestSha).toUpperCase() },
    new_binary_hashes: plan.build.artifacts, rollback_reference: m.rollback_reference,
    web_candidate_unchanged: input.webSha, deployed_native_still: input.oldSha,
    retirement_contract: { SAFE_MAIN_THREAD_STOP_PATH_AVAILABLE: 'NO', KNOWN_BUG_FORCE_FALLBACK_SCOPE: 'OLD_BUGGY_NATIVE_ONLY',
      reason: 'map console off; @mapexit not permitted by the fixture bridge; launcher stop uses the Ctrl+C callback path' },
    required_before_race_closure: 'NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE=PASS', first_promotion_complete: false,
    timestamp: now.toISOString(), governance_sha: governanceSha || null };
  record.evidence_digest = canonicalDigest(record);
  writeNew(audit, record);
  const entry = { old_native_git_sha: input.oldSha, old_disposition: 'INTERMEDIATE_NATIVE_CANDIDATE',
    new_native_git_sha: input.newSha, new_disposition: 'ACTIVE_NATIVE_CANDIDATE', reason: policy.reason,
    audit_receipt: rel(root, audit), audit_sha256: digest(audit), previous_native_receipt: record.old_native_receipt,
    candidate_manifest: plan.manifestFile, candidate_manifest_sha256: String(plan.manifestSha).toUpperCase() };
  const active = { native_git_sha: input.newSha, candidate_manifest: plan.manifestFile, candidate_manifest_sha256: entry.candidate_manifest_sha256,
    binary_sha256: m.binary_sha256, deployed: false, graceful_shutdown_live: 'REQUIRED' };
  const history2 = [...(input.lease.native_candidate_amendments || []), entry];
  atomic(f.pending, { ...input.pending, native_candidate_amendments: history2, active_native_candidate: active });
  atomic(f.lease, { ...input.lease, native_candidate_amendments: history2, active_native_candidate: active });
  return { amended: true, audit_receipt: entry.audit_receipt, audit_sha256: entry.audit_sha256, active_native_candidate: input.newSha,
    deployed_native_still: input.oldSha, receipt_history: rel(root, history) };
}

// PHASES 6/7: the only forced termination path. Eligible solely for the
// known-buggy pre-fix map that is still alive in its known hang state.
export function retirementDecision(x, policy = AMENDMENT) {
  if (policy.no_force_retirement === true) return { eligible: false, reason: 'NATIVE_V2_FORCE_RETIREMENT_FORBIDDEN' };
  if (!x.leaseOk) return { eligible: false, reason: 'FORCE_RETIRE_LEASE_MISMATCH' };
  if (x.deployedNativeSha === policy.new_sha) return { eligible: false, reason: 'FORCE_RETIRE_HEALTHY_NEW_NATIVE' };
  if (x.deployedNativeSha !== policy.old_sha || !equalHash(x.liveMapSha256, x.expectedOldMapSha256)) return { eligible: false, reason: 'FORCE_RETIRE_WRONG_SHA' };
  if (!Array.isArray(x.observedMapPids) || x.observedMapPids.length !== 1 || x.observedMapPids[0] !== x.targetPid) return { eligible: false, reason: 'FORCE_RETIRE_WRONG_PID' };
  if (!x.gracefulAttempted) return { eligible: false, reason: 'GRACEFUL_STOP_NOT_ATTEMPTED' };
  if (!(x.elapsedMs >= policy.retire_timeout_ms)) return { eligible: false, reason: 'RETIRE_TIMEOUT_NOT_ELAPSED' };
  if (!x.targetAlive) return { eligible: false, reason: 'TARGET_ALREADY_EXITED' };
  if (!(x.hang?.shuttingDown === true && x.hang.terminating === false)) return { eligible: false, reason: 'KNOWN_HANG_STATE_NOT_OBSERVED' };
  if (!x.evidencePreserved) return { eligible: false, reason: 'RETIRE_EVIDENCE_NOT_PRESERVED' };
  return { eligible: true, reason: null, scope: 'OLD_BUGGY_NATIVE_ONLY' };
}

function mapHangState(root, trackedMap) {
  const logs = boundedPath(root, '.local/ro-stack/logs');
  const file = path.resolve(String(trackedMap?.stdout || ''));
  check(file.toLowerCase().startsWith(logs.toLowerCase() + path.sep) && fs.existsSync(file), 'MAP_LOG_UNAVAILABLE');
  const text = fs.readFileSync(file, 'utf8');
  return { log: file, shuttingDown: text.includes('Shutting down...'), terminating: text.includes('Terminating...') };
}

function signalSent(root, name, pid) {
  const file = boundedPath(root, `.local/ro-stack/logs/graceful-signal-${name}-${pid}.out.log`);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('GRACEFUL_SIGNAL_SENT');
}

function healthyAfterStart(after, before, native, sameDependencies = true) {
  return after?.pass === true && after.openkore_runtime_count === 0 && ['login', 'char', 'map'].every(n => after.counts?.[n] === 1 &&
    after.pids[n] !== before.pids[n]) && after.procdump_receipt?.mapPid === after.pids.map &&
    after.procdump_receipt.procdumpAttachStatus === 'ATTACHED' && after.procdump_account === 'NT AUTHORITY\\SYSTEM' &&
    after.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES' &&
    after.procdump_receipt.runtimeGenerationId !== before.procdump_receipt?.runtimeGenerationId &&
    (!after.procdump_receipt.mapBinarySha256 || equalHash(after.procdump_receipt.mapBinarySha256, native)) &&
    (!sameDependencies || (after.dashboard_pid === before.dashboard_pid && after.database_pid === before.database_pid));
}

async function pollStarted(adapter, before, native, { attempts = 60, delayMs = 1000 } = {}) {
  let after;
  for (let i = 0; i < attempts; i++) {
    after = await adapter('snapshot');
    if (healthyAfterStart(after, before, native)) return after;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return after;
}

function nativeGone(s) { return ['login', 'char', 'map'].every(n => !s?.counts?.[n]); }

// Owner deploy of the amended candidate. First retirement of the pre-fix map
// tries the existing graceful stop and falls back only under retirementDecision.
export async function deployAmendedNative({ root, owner, leaseId, adapter, now = () => Date.now(), timing = {}, policy = AMENDMENT }) {
  const f = productionFiles(root), lease = readJson(f.lease), pending = readJson(f.pending), state = readJson(f.state);
  check(lease.lease_id === leaseId && lease.owner_task_id === owner && lease.status === 'ACTIVE' && lease.promotion_mode === FIRST_PROMOTION &&
    pending.lease_id === leaseId && pending.owner_task_id === owner, 'ACTIVE_LEASE_IDENTITY_MISMATCH');
  check(nativeAmendmentApplied(root, lease, pending) && lease.active_native_candidate.deployed === false, 'NATIVE_AMENDMENT_NOT_PENDING_DEPLOY');
  check(lease.native_deploy_git_sha === policy.old_sha && legacyIdentity(state) && state.production_drift === 'OPEN' &&
    !fs.existsSync(f.consumed), 'FIRST_PROMOTION_NOT_STAGED');
  const a = lease.active_native_candidate, file = a.candidate_manifest;
  check(equalHash(digest(file), a.candidate_manifest_sha256), 'CANDIDATE_MANIFEST_TAMPERED');
  const m = readJson(file), base = path.dirname(file), b = readJson(pinned(base, m.build_receipt));
  check(m.native_git_sha === policy.new_sha && b.native_git_sha === m.native_git_sha, 'CANDIDATE_SHA_MISMATCH');
  check(b.artifacts.every(x => equalHash(digest(boundedPath(b.source_root, x.path)), x.sha256)), 'CANDIDATE_BINARY_CHANGED');
  for (const item of m.lifecycle_files) pinned(root, item);
  const current = currentNativeStage(root, lease, pending, policy.old_sha);
  check(current.valid, 'PREVIOUS_NATIVE_RECEIPT_INVALID');
  const oldMap = current.receipt.artifacts.find(x => x.path.endsWith('/map-server.exe'));
  const lock = path.join(f.dir, 'native-amendment-deploy.lock');
  const archive = path.join(f.dir, `native-amendment-deployed-${leaseId}-${short(policy.new_sha)}`);
  check(!fs.existsSync(lock) && !fs.existsSync(archive), 'NATIVE_AMENDMENT_DEPLOY_BUSY');
  // Evidence is referenced by its post-success archive location.
  const archived = file => rel(root, path.join(archive, path.basename(file)));
  const before = await adapter('snapshot');
  check(before?.pass === true && before.procdump_receipt?.mapPid === before.pids?.map && before.procdump_account === 'NT AUTHORITY\\SYSTEM', 'PRESTOP_RUNTIME_INVALID');
  const tracked = readJson(path.join(f.dir, 'state.json'));
  const trackedMap = (tracked.processes || []).find(x => x.name === 'map');
  check(trackedMap?.id === before.pids.map, 'TRACKED_IDENTITY_CHANGED');
  fs.mkdirSync(lock);
  const journal = path.join(lock, 'operation.json'), phase = p => atomic(journal, { ...readJson(journal), phase: p });
  writeNew(journal, { schema_version: 'native-amendment-deploy-v1', lease_id: leaseId, owner_task_id: owner, old_native_git_sha: policy.old_sha,
    new_native_git_sha: policy.new_sha, candidate_manifest_sha256: a.candidate_manifest_sha256, before, started_at: new Date(now()).toISOString(), phase: 'STAGE' });
  const stage = path.join(lock, 'stage'); fs.mkdirSync(stage);
  for (const x of b.artifacts) { const d = path.join(stage, x.path); fs.copyFileSync(boundedPath(b.source_root, x.path), d, fs.constants.COPYFILE_EXCL);
    check(equalHash(digest(d), x.sha256), 'STAGED_BINARY_CHANGED'); }
  let retirement;
  try {
    phase('RETIRE_OLD_RUNTIME');
    const t0 = now();
    try { await adapter('stop'); retirement = { method: 'GRACEFUL', forced: false }; }
    catch (stopError) {
      let s = await adapter('snapshot');
      for (let waited = 0; s?.counts?.map === 1 && waited < (timing.extraWaitMs ?? policy.retire_extra_wait_ms); waited += (timing.pollMs ?? 1000)) {
        await new Promise(resolve => setTimeout(resolve, timing.pollMs ?? 1000)); s = await adapter('snapshot');
      }
      const hang = mapHangState(root, trackedMap), pid = before.pids.map;
      const evidence = path.join(lock, 'retirement-evidence.json');
      writeNew(evidence, { stop_error: String(stopError.message), snapshot: s, hang, signal_sent: signalSent(root, 'map', pid),
        map_log_sha256: digest(hang.log), measured_at: new Date(now()).toISOString() });
      const targetAlive = s?.counts?.map === 1 && s.pids?.map === pid;
      if (!targetAlive && !s?.counts?.map) {
        // Map exited late on its own: no force; stop char/login normally.
        await adapter('stop-remaining'); retirement = { method: 'GRACEFUL_LATE', forced: false, evidence: archived(evidence), evidence_sha256: digest(evidence) };
      } else {
        const decision = retirementDecision({ leaseOk: readJson(f.lease).lease_id === leaseId && readJson(f.lease).owner_task_id === owner,
          deployedNativeSha: readJson(f.lease).native_deploy_git_sha, liveMapSha256: digest(boundedPath(root, oldMap.path)),
          expectedOldMapSha256: oldMap.sha256, targetPid: pid, observedMapPids: s?.counts?.map === 1 ? [s.pids.map] : (s?.observed_map_pids || []),
          targetAlive, gracefulAttempted: signalSent(root, 'map', pid), elapsedMs: now() - t0, hang, evidencePreserved: fs.existsSync(evidence) }, policy);
        check(decision.eligible, 'KNOWN_BUG_RETIREMENT_BLOCKED:' + decision.reason);
        await adapter('retire-known-buggy-map', { TargetPid: pid, ExpectedSha256: oldMap.sha256, ExpectedStartUtc: before.processes.map.started_at });
        await adapter('stop-remaining');
        retirement = { method: 'KNOWN_BUG_FORCE_RETIREMENT', forced: true, scope: decision.scope, retired_pid: pid, evidence: archived(evidence),
          evidence_sha256: digest(evidence) };
      }
    }
    check(nativeGone(await adapter('snapshot')), 'OLD_RUNTIME_NOT_STOPPED');
    phase('REPLACE_BINARIES');
    for (const x of b.artifacts) {
      const target = boundedPath(root, '.local/ro-stack/rathena/' + x.path);
      check(equalHash(digest(target), current.receipt.artifacts.find(y => y.path.endsWith('/' + x.path)).sha256), 'NATIVE_PREIMAGE_CHANGED');
      const temporary = target + '.candidate-' + leaseId;
      fs.copyFileSync(path.join(stage, x.path), temporary, fs.constants.COPYFILE_EXCL);
      check(equalHash(digest(temporary), x.sha256), 'NATIVE_COPY_CHANGED'); fs.renameSync(temporary, target);
    }
    phase('START');
    await adapter('start');
    const after = await pollStarted(adapter, before, m.binary_sha256, timing);
    check(healthyAfterStart(after, before, m.binary_sha256), 'POSTDEPLOY_HEALTH_FAILED');
    const artifacts = b.artifacts.map(x => ({ path: '.local/ro-stack/rathena/' + x.path, sha256: String(x.sha256).toUpperCase() }));
    check(artifacts.every(x => equalHash(digest(boundedPath(root, x.path)), x.sha256)), 'POSTDEPLOY_BINARY_CHANGED');
    const receiptRel = `.local/ro-stack/native-promotion-receipt-${short(policy.new_sha)}.json`;
    const receipt = { schema_version: 'native-deploy-v1', deploy_id: 'native-amended-' + randomUUID(), lease_id: leaseId, owner_task_id: owner,
      native_git_sha: m.native_git_sha, native_build_sha256: m.binary_sha256, build_receipt_sha256: m.build_receipt.sha256,
      candidate_manifest_sha256: String(a.candidate_manifest_sha256).toUpperCase(), previous_binary_sha256: String(oldMap.sha256).toUpperCase(),
      new_binary_sha256: m.binary_sha256, previous_binaries: current.receipt.artifacts, artifacts, old_map_pid: before.pids.map,
      new_map_pid: after.pids.map, old_pids: before.pids, new_pids: after.pids, procdump_receipt: after.procdump_receipt,
      procdump_process_identity: after.procdump_process_identity, runtime_health: after, openkore_runtime_count: 0,
      rollback_reference: m.rollback_reference, acceptance_status: 'NATIVE_CANDIDATE_ACTIVE', deployed_at: new Date(now()).toISOString(),
      amendment_of: { native_git_sha: policy.old_sha, native_receipt: current.receiptPath, native_receipt_sha256: current.sha256 },
      old_runtime_retirement: retirement, graceful_shutdown_live: 'PENDING', first_promotion_complete: false };
    check(nativeReceiptValid(receipt, { nativeSha: policy.new_sha, leaseId, manifestHash: a.candidate_manifest_sha256 }), 'NATIVE_POSTDEPLOY_RECEIPT_INVALID');
    writeNew(boundedPath(root, receiptRel), receipt);
    const deployed = { ...a, deployed: true, deploy_receipt: receiptRel };
    const p2 = readJson(f.pending), l2 = readJson(f.lease);
    atomic(f.pending, { ...p2, native_git_sha: policy.new_sha, native_receipt_path: receiptRel,
      native_receipt_sha256: digest(boundedPath(root, receiptRel)), active_native_candidate: deployed });
    atomic(f.lease, { ...l2, native_deploy_git_sha: policy.new_sha, native_candidate_manifest_sha256: String(a.candidate_manifest_sha256).toUpperCase(),
      active_native_candidate: deployed });
    phase('COMPLETE');
    fs.renameSync(lock, archive);
    return { deployed: true, receipt_path: receiptRel, retirement, new_pids: after.pids, NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE: 'PENDING' };
  } catch (error) {
    // Journal, stage and evidence stay for owner recovery; lease and drift unchanged.
    writeNew(path.join(lock, 'failure-' + Date.now() + '.json'), { error: error.message, retirement: retirement || null,
      lease_held: true, production_drift: 'OPEN', forced_fallback_used: retirement?.forced === true, failed_at: new Date().toISOString() });
    throw error;
  }
}

// PHASE 8: real graceful stop and restart of the NEW binary. A forced stop can
// never produce PASS: any stop failure is recorded as FAIL with no fallback.
export async function gracefulShutdownCycle({ root, owner, leaseId, adapter, now = () => Date.now(), timing = {}, policy = AMENDMENT }) {
  const f = productionFiles(root), lease = readJson(f.lease), pending = readJson(f.pending);
  check(lease.lease_id === leaseId && lease.owner_task_id === owner && lease.status === 'ACTIVE', 'ACTIVE_LEASE_IDENTITY_MISMATCH');
  check(lease.active_native_candidate?.deployed === true && lease.native_deploy_git_sha === policy.new_sha &&
    pending.native_git_sha === policy.new_sha, 'AMENDED_NATIVE_NOT_DEPLOYED');
  check(pending.native_graceful_shutdown_live?.result !== 'PASS', 'GRACEFUL_CYCLE_ALREADY_PASSED');
  const current = currentNativeStage(root, lease, pending, policy.new_sha);
  check(current.valid, 'AMENDED_NATIVE_RECEIPT_INVALID');
  const lock = path.join(f.dir, 'native-graceful-cycle.lock');
  check(!fs.existsSync(lock), 'GRACEFUL_CYCLE_BUSY');
  const before = await adapter('snapshot');
  check(before?.pass === true && before.procdump_receipt?.procdumpAttachStatus === 'ATTACHED', 'PRESTOP_RUNTIME_INVALID');
  const trackedMap = (readJson(path.join(f.dir, 'state.json')).processes || []).find(x => x.name === 'map');
  check(trackedMap?.id === before.pids.map, 'TRACKED_IDENTITY_CHANGED');
  fs.mkdirSync(lock);
  const record = { schema_version: 'native-graceful-shutdown-live-v1', lease_id: leaseId, owner_task_id: owner, native_git_sha: policy.new_sha,
    before, forced_termination_used: false, started_at: new Date(now()).toISOString() };
  const t0 = now();
  try {
    await adapter('stop');
  } catch (error) {
    writeNew(path.join(lock, 'result.json'), { ...record, NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE: 'FAIL', error: error.message });
    throw Error('NEW_NATIVE_GRACEFUL_SHUTDOWN_FAILED');
  }
  const stopMs = now() - t0, hang = mapHangState(root, trackedMap), stopped = await adapter('snapshot');
  const graceful = nativeGone(stopped) && stopMs <= policy.graceful_timeout_ms && hang.shuttingDown && hang.terminating &&
    signalSent(root, 'map', before.pids.map);
  if (!graceful) {
    writeNew(path.join(lock, 'result.json'), { ...record, NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE: 'FAIL', stop_ms: stopMs, hang });
    throw Error('NEW_NATIVE_GRACEFUL_SHUTDOWN_FAILED');
  }
  await adapter('start');
  const after = await pollStarted(adapter, before, current.receipt.new_binary_sha256, timing);
  const healthy = healthyAfterStart(after, before, current.receipt.new_binary_sha256) &&
    current.receipt.artifacts.every(x => equalHash(digest(boundedPath(root, x.path)), x.sha256));
  const result = { ...record, NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE: healthy ? 'PASS' : 'FAIL', stop_ms: stopMs, map_log: rel(root, hang.log),
    map_log_sha256: digest(hang.log), after, completed_at: new Date(now()).toISOString() };
  writeNew(path.join(lock, 'result.json'), result);
  check(healthy, 'RESTART_AFTER_GRACEFUL_STOP_FAILED');
  const receiptRel = `.local/ro-stack/native-graceful-shutdown-live-${leaseId}-${short(policy.new_sha)}.json`;
  writeNew(boundedPath(root, receiptRel), result);
  const live = { result: 'PASS', receipt: receiptRel, sha256: digest(boundedPath(root, receiptRel)) };
  atomic(f.pending, { ...readJson(f.pending), native_graceful_shutdown_live: live });
  const l2 = readJson(f.lease);
  atomic(f.lease, { ...l2, active_native_candidate: { ...l2.active_native_candidate, graceful_shutdown_live: 'PASS' } });
  fs.renameSync(lock, path.join(f.dir, `native-graceful-cycle-passed-${leaseId}-${short(policy.new_sha)}`));
  return { NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE: 'PASS', receipt: receiptRel, stop_ms: stopMs, new_pids: after.pids };
}

// Final receipt gate (PHASE 8/9). Promotions without a Native amendment are unaffected.
export function gracefulShutdownLiveSatisfied(root, lease, pending) {
  if (!lease?.native_candidate_amendments?.length) return true;
  try {
    const live = pending?.native_graceful_shutdown_live, file = boundedPath(root, live.receipt), r = readJson(file);
    return live.result === 'PASS' && equalHash(digest(file), live.sha256) && r.NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE === 'PASS' &&
      r.forced_termination_used === false && r.lease_id === lease.lease_id && r.native_git_sha === lease.native_deploy_git_sha &&
      lease.active_native_candidate?.native_git_sha === lease.native_deploy_git_sha && lease.active_native_candidate.deployed === true;
  } catch { return false; }
}

export function amendmentAdapter(root, owner, leaseId, script = path.join(here, 'native-runtime-adapter.ps1')) {
  return async (action, extra = {}) => {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', action, '-ProductionRoot', root, '-Owner', owner, '-LeaseId', leaseId,
      ...Object.entries(extra).flatMap(([k, v]) => ['-' + k, String(v)])];
    const opts = { windowsHide: true, timeout: 240000, env: windowsPowerShellEnv() };
    if (action === 'snapshot' || action === 'retire-known-buggy-map') {
      const r = spawnSync('powershell.exe', args, { ...opts, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      check(r.status === 0 && !r.error, 'NATIVE_RUNTIME_' + action.toUpperCase().replaceAll('-', '_') + '_FAILED');
      return JSON.parse(r.stdout);
    }
    const dir = boundedPath(root, '.local/ro-stack/logs'); fs.mkdirSync(dir, { recursive: true });
    const log = path.join(dir, `native-amendment-${action}-${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID().slice(0, 8)}`);
    const out = fs.openSync(log + '.out.log', 'wx'), err = fs.openSync(log + '.err.log', 'wx');
    let r; try { r = spawnSync('powershell.exe', args, { ...opts, stdio: ['ignore', out, err] }); } finally { fs.closeSync(out); fs.closeSync(err); }
    check(r.status === 0 && !r.error, 'NATIVE_RUNTIME_' + action.toUpperCase().replaceAll('-', '_') + '_FAILED');
    return null;
  };
}

async function main() {
  const argv = process.argv.slice(2), a = Object.fromEntries(argv.flatMap((x, i) => x.startsWith('--') ? [[x.slice(2), argv[i + 1]]] : []));
  const root = path.resolve(a['production-root'] || '');
  check(root.toLowerCase() === 'c:\\users\\administrator\\ghost-island-production\\ro-stack', 'CANONICAL_ROOT_REQUIRED');
  check(a.owner && a.lease && ['plan', 'amend', 'deploy', 'graceful-cycle'].includes(a.action), 'ARGUMENTS_REQUIRED');
  check(a.action === 'plan' || a.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
  check(git(governanceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '', 'GOVERNANCE_SOURCE_DIRTY');
  const sha = git(governanceRoot, 'rev-parse', 'HEAD');
  check(git(governanceRoot, 'remote', 'get-url', 'origin') === 'https://github.com/amadiz1988-boop/terminal-arpg.git', 'GOVERNANCE_REMOTE_INVALID');
  git(governanceRoot, 'fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main');
  git(governanceRoot, 'merge-base', '--is-ancestor', sha, git(governanceRoot, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0]);
  const authority = readJson(path.join(governanceRoot, 'docs/project-control/production-release-authority.json')).native;
  let result;
  if (a.action === 'plan' || a.action === 'amend') {
    check(a['candidate-manifest'] && a['manifest-sha256'], 'CANDIDATE_ARGUMENTS_REQUIRED');
    const plan = planNativeAmendment({ root, owner: a.owner, leaseId: a.lease, manifestFile: path.resolve(a['candidate-manifest']), manifestSha: a['manifest-sha256'], authority });
    if (a.action === 'plan') {
      let eligible = true, error = null;
      if (!plan.input.lease.active_native_candidate) try { validateNativeAmendment(plan.input); } catch (e) { eligible = false; error = e.message; }
      result = { eligible, error, dry_run: true, old_native_sha: plan.input.oldSha, new_native_sha: plan.input.newSha,
        lineage: plan.input.lineage, diff_scope: plan.input.diffScope, old_receipt_valid: plan.input.oldReceiptValid, build_valid: plan.input.buildValid,
        manifest_valid: plan.input.manifestValid, inspect_errors: plan.inspected.errors, capability_counts: plan.inspected.capability_counts,
        rollback_covered: plan.input.rollbackCovered, web_sha: plan.input.webSha, already_amended: !!plan.input.lease.active_native_candidate };
    } else result = applyNativeAmendment(plan, { governanceSha: sha });
  } else if (a.action === 'deploy') result = await deployAmendedNative({ root, owner: a.owner, leaseId: a.lease, adapter: amendmentAdapter(root, a.owner, a.lease) });
  else result = await gracefulShutdownCycle({ root, owner: a.owner, leaseId: a.lease, adapter: amendmentAdapter(root, a.owner, a.lease) });
  console.log(JSON.stringify({ ...result, governance_sha: sha }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(JSON.stringify({ eligible: false, error: error.message })); process.exitCode = 1; });
