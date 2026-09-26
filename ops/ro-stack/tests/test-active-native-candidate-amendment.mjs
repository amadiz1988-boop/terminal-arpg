import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AMENDMENT, validateNativeAmendment, applyNativeAmendment, retirementDecision, deployAmendedNative,
  gracefulShutdownCycle, gracefulShutdownLiveSatisfied, nativeAmendmentApplied } from '../native-candidate-amendment.mjs';
import { nativeReceiptValid, activeNativeReceiptPath, nativeReceiptPath } from '../native-promotion-contract.mjs';

const h = b => createHash('sha256').update(b).digest('hex').toUpperCase();
const OWNER = 'F｜M1 最終整合', LEASE = AMENDMENT.lease_id, OLD = AMENDMENT.old_sha, NEW = AMENDMENT.new_sha, WEB = AMENDMENT.web_sha;
const SYSTEM = 'NT AUTHORITY\\SYSTEM';
let count = 0;
const pass = name => console.log(`PASS ${++count} ${name}`);
const legacyState = () => ({ schema_version: 2, baseline_mode: 'LEGACY_PRE_GITHUB_FIRST', historical_provenance: 'UNRESOLVED',
  current_deploy_id: 'LEGACY_BOOTSTRAP_0123456789abcdef', current_web_git_sha: 'UNRESOLVED_LEGACY', current_native_git_sha: 'UNRESOLVED_LEGACY',
  legacy_bootstrap_available: true, production_drift: 'OPEN', drift_reason: 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT',
  first_promotion_phase: 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE', legacy_rollback: { root: '.local/ro-stack/legacy-baseline/x/rollback' } });

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-amend-')), dir = path.join(root, '.local/ro-stack');
  const put = (rel, v) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.isBuffer(v) || typeof v === 'string' ? v : JSON.stringify(v)); return f; };
  const names = ['login', 'char', 'map'];
  const oldArtifacts = names.map(n => ({ path: `.local/ro-stack/rathena/${n}-server.exe`, sha256: h(put(`.local/ro-stack/rathena/${n}-server.exe`, 'old-' + n) && Buffer.from('old-' + n)) }));
  const build = path.join(root, 'build'), src = path.join(build, 'source');
  const intermediate = oldArtifacts.map(item => {
    const name = path.basename(item.path), saved = `intermediate-rollback/${name}`;
    put(`build/${saved}`, fs.readFileSync(path.join(root, item.path)));
    return { path: saved, production_path: item.path, sha256: item.sha256 };
  });
  const newArtifacts = names.map(n => ({ path: `${n}-server.exe`, sha256: h(put(`build/source/${n}-server.exe`, 'new-' + n) && Buffer.from('new-' + n)) }));
  const lifecycle = ['ro-stack.ps1', 'stack.config.psd1'].map(n => ({ path: 'ops/ro-stack/' + n, sha256: h(fs.readFileSync(put('ops/ro-stack/' + n, 'fixture ' + n))) }));
  const buildReceipt = put('build/build-receipt.json', { schema_version: 'native-build-v1', native_git_sha: NEW, binary_sha256: newArtifacts[2].sha256,
    artifacts: newArtifacts, source_root: src, build_configuration: 'Release x64', tests_result: 'PASS', source_tree_state: 'CLEAN' });
  const manifest = { schema_version: 'native-candidate-v1', native_git_sha: NEW, binary_sha256: newArtifacts[2].sha256,
    build_receipt: { path: 'build-receipt.json', sha256: h(fs.readFileSync(buildReceipt)) }, lifecycle_files: lifecycle,
    amendment_of: { native_git_sha: OLD, candidate_manifest_sha256: 'D'.repeat(64) }, diff_audit: { scope: AMENDMENT.scope },
    rollback_reference: { root: '.local/ro-stack/legacy-baseline/x/rollback', intermediate_rollback: { native_git_sha: OLD, artifacts: intermediate } } };
  const manifestFile = put('build/candidate-manifest.json', manifest);
  const lease = { lease_id: LEASE, owner_task_id: OWNER, status: 'ACTIVE', promotion_mode: 'FIRST_GITHUB_FIRST_PROMOTION', emergency: false,
    native_deploy_git_sha: OLD, web_deploy_git_sha: WEB, native_candidate_manifest_sha256: 'D'.repeat(64), candidate_capabilities: [] };
  const receipt = { schema_version: 'native-deploy-v1', deploy_id: 'native-reconciled-fixture', lease_id: LEASE, owner_task_id: OWNER, native_git_sha: OLD,
    native_build_sha256: oldArtifacts[2].sha256, new_binary_sha256: oldArtifacts[2].sha256, previous_binary_sha256: 'A'.repeat(64),
    candidate_manifest_sha256: 'D'.repeat(64), old_map_pid: 1, new_map_pid: 3, procdump_receipt: { mapPid: 3, procdumpAttachStatus: 'ATTACHED' },
    runtime_health: { pass: true, counts: { login: 1, char: 1, map: 1 } }, openkore_runtime_count: 0, rollback_reference: { root: 'r' },
    acceptance_status: 'NATIVE_CANDIDATE_ACTIVE', artifacts: oldArtifacts };
  const receiptFile = put(nativeReceiptPath, receipt);
  const pending = { lease_id: LEASE, owner_task_id: OWNER, native_git_sha: OLD, web_git_sha: WEB, started_at: '2026-09-24T14:57:15.109Z',
    native_stage: 'NATIVE_STAGE_COMPLETE', native_stage_reconciled: true, native_receipt_sha256: h(fs.readFileSync(receiptFile)) };
  const files = { lease: put('.local/ro-stack/production-deployment-lease/lease.json', lease), state: put('.local/ro-stack/production-deployment-state.json', legacyState()),
    pending: put('.local/ro-stack/first-github-first-promotion.pending.json', pending) };
  const mapLog = put('.local/ro-stack/logs/old-map.out.log', '[Status]: Server is ready\n');
  put('.local/ro-stack/state.json', { processes: [{ name: 'login', id: 1 }, { name: 'char', id: 2 }, { name: 'map', id: 3, stdout: mapLog }] });
  const read = k => JSON.parse(fs.readFileSync(files[k]));
  return { root, dir, put, files, read, oldArtifacts, newArtifacts, manifest, manifestFile, receiptFile, mapLog,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function withConfigDeployment(x) {
  const productionPath = '.local/ro-stack/rathena/conf/persistent_agent_commands.json';
  const old = Buffer.from('{"command":"old"}\r\n');
  const next = Buffer.from('{"command":"new"}\n');
  x.put(productionPath, old);
  x.put('build/intermediate-rollback/persistent_agent_commands.json', old);
  x.put('build/candidate-config.json', next);
  const receiptFile = path.join(x.root, 'build/build-receipt.json');
  const build = JSON.parse(fs.readFileSync(receiptFile));
  build.config_artifacts = [{ source_path: 'conf/persistent_agent_commands.json', source_git_sha: NEW,
    source_blob_oid: 'a'.repeat(40), sha256: h(next) }];
  fs.writeFileSync(receiptFile, JSON.stringify(build));
  x.manifest.build_receipt.sha256 = h(fs.readFileSync(receiptFile));
  x.manifest.config_deployment = { source_path: 'conf/persistent_agent_commands.json',
    source_git_sha: NEW, source_blob_oid: 'a'.repeat(40), package_path: 'candidate-config.json',
    production_path: productionPath, sha256: h(next), preimage_sha256: h(old),
    rollback_path: 'intermediate-rollback/persistent_agent_commands.json', text_transform: 'NONE' };
  fs.writeFileSync(x.manifestFile, JSON.stringify(x.manifest));
  return { productionPath, old, next, policy: { ...AMENDMENT, reason: 'M1_MOROCC_NOOP_DEATH_MAINTENANCE_V1' } };
}

function plan(x) {
  const lease = x.read('lease'), pending = x.read('pending'), state = x.read('state'), receipt = JSON.parse(fs.readFileSync(x.receiptFile));
  return { f: { dir: x.dir, lease: x.files.lease, state: x.files.state, pending: x.files.pending, consumed: path.join(x.dir, 'github-first-bootstrap-consumed.json') },
    input: { lease, state, pending, owner: OWNER, leaseId: LEASE, oldSha: OLD, newSha: NEW, lineage: { descendant: true, mainReachable: true, authorityAccepted: NEW },
      oldReceiptValid: true, buildValid: true, manifestValid: true, manifest: x.manifest, rollbackCovered: true, webSha: WEB, manifestWebSha: WEB,
      diffScope: AMENDMENT.scope, promotionComplete: false },
    current: { file: x.receiptFile, receiptPath: nativeReceiptPath, receipt, sha256: h(fs.readFileSync(x.receiptFile)) },
    manifestFile: x.manifestFile, manifestSha: h(fs.readFileSync(x.manifestFile)), manifest: x.manifest,
    build: { artifacts: x.newArtifacts }, hashes: Object.fromEntries(['lease', 'state', 'pending'].map(k => [k, h(fs.readFileSync(x.files[k]))])) };
}

function blocked(name, mutate, code) {
  const x = fixture();
  try { const p = plan(x); mutate(p.input); assert.throws(() => validateNativeAmendment(p.input), new RegExp(code)); pass(name); }
  finally { x.cleanup(); }
}

// Snapshot fake. Phases: old -> (hung) -> down -> new -> down2 -> new2.
function runtime(x, { hang = false, cycleStopFails = false, deployHealthFail = false } = {}) {
  const s = { phase: 'old', actions: [], clock: 0 };
  const snap = (pids, gen, sha) => ({ pass: true, counts: { login: 1, char: 1, map: 1 }, pids, processes: { map: { started_at: '2026-09-25T01:18:21.000Z' } },
    openkore_runtime_count: 0, dashboard_pid: 9, database_pid: 10, procdump_account: SYSTEM,
    procdump_receipt: { mapPid: pids.map, procdumpAttachStatus: 'ATTACHED', runtimeGenerationId: gen, mapBinarySha256: sha },
    procdump_process_identity: { PROCESS_IDENTITY_MATCH: 'YES' } });
  const adapter = async (action, extra) => {
    s.actions.push(extra ? { action, extra } : action);
    if (action === 'snapshot') {
      if (s.phase === 'old') return snap({ login: 1, char: 2, map: 3 }, 'g1', x.oldArtifacts[2].sha256);
      if (s.phase === 'hung') return { pass: false, counts: { login: 1, char: 1, map: 1 }, pids: { login: 1, char: 2, map: 3 } };
      if (s.phase === 'map-retired') return { pass: false, counts: { login: 1, char: 1, map: 0 }, pids: { login: 1, char: 2 } };
      if (s.phase === 'down' || s.phase === 'down2') return { pass: false, counts: { login: 0, char: 0, map: 0 }, pids: {} };
      if (s.phase === 'new') return { ...snap({ login: 11, char: 12, map: 13 }, 'g2', x.newArtifacts[2].sha256), pass: !deployHealthFail };
      if (deployHealthFail && s.phase === 'new2') return snap({ login: 21, char: 22, map: 23 }, 'g3', x.oldArtifacts[2].sha256);
      return snap({ login: 21, char: 22, map: 23 }, 'g3', x.newArtifacts[2].sha256);
    }
    if (action === 'stop') {
      if (s.phase === 'old') {
        x.put('.local/ro-stack/logs/graceful-signal-map-3.out.log', 'GRACEFUL_SIGNAL_SENT pid=3');
        if (hang) { fs.appendFileSync(x.mapLog, '[Status]: Shutting down...\n[Status]: PersistentAgent: SHUTDOWN_PENDING\n'); s.clock += 41000; s.phase = 'hung'; throw Error('NATIVE_RUNTIME_STOP_FAILED'); }
        s.phase = 'down'; return null;
      }
      if (s.phase === 'new') {
        x.put('.local/ro-stack/logs/graceful-signal-map-13.out.log', 'GRACEFUL_SIGNAL_SENT pid=13');
        if (cycleStopFails) throw Error('NATIVE_RUNTIME_STOP_FAILED');
        fs.appendFileSync(s.newLog, '[Status]: Shutting down...\n[Status]: Terminating...\n'); s.clock += 3000; s.phase = 'down2'; return null;
      }
      throw Error('UNEXPECTED_STOP');
    }
    if (action === 'retire-known-buggy-map') { assert.equal(s.phase, 'hung'); s.phase = 'map-retired'; return { terminated: true }; }
    if (action === 'stop-remaining') { assert.equal(s.phase, 'map-retired'); s.phase = 'down'; return null; }
    if (action === 'start') {
      if (s.phase === 'down') { s.phase = 'new'; s.newLog = x.put('.local/ro-stack/logs/new-map.out.log', '[Status]: ready\n');
        x.put('.local/ro-stack/state.json', { processes: [{ name: 'login', id: 11 }, { name: 'char', id: 12 }, { name: 'map', id: 13, stdout: s.newLog }] }); return null; }
      if (s.phase === 'down2') { s.phase = 'new2'; return null; }
    }
    throw Error('UNEXPECTED_ACTION:' + action);
  };
  return { s, adapter, now: () => s.clock, timing: { extraWaitMs: 0, pollMs: 0, attempts: 1, delayMs: 0 } };
}

const decisionBase = x => ({ leaseOk: true, deployedNativeSha: OLD, liveMapSha256: x.oldArtifacts[2].sha256, expectedOldMapSha256: x.oldArtifacts[2].sha256,
  targetPid: 3, observedMapPids: [3], targetAlive: true, gracefulAttempted: true, elapsedMs: 41000,
  hang: { shuttingDown: true, terminating: false }, evidencePreserved: true });

{ const x = fixture(); try { assert.equal(validateNativeAmendment(plan(x).input), true); pass('1 valid active promotion + descendant Native SHA eligible'); } finally { x.cleanup(); } }
blocked('2 non-descendant Native SHA blocked', i => { i.lineage.descendant = false; }, 'NATIVE_NOT_APPROVED_DESCENDANT');
blocked('3 wrong lease blocked', i => { i.leaseId = 'other-lease'; }, 'ACTIVE_LEASE_IDENTITY_MISMATCH');
blocked('4 wrong Unicode owner blocked', i => { i.owner = 'F|M1 最終整合'; }, 'ACTIVE_LEASE_IDENTITY_MISMATCH');
blocked('5 released lease blocked', i => { i.lease.status = 'RELEASED'; }, 'ACTIVE_LEASE_IDENTITY_MISMATCH');
blocked('6 invalid previous Native receipt blocked', i => { i.oldReceiptValid = false; }, 'PREVIOUS_NATIVE_RECEIPT_INVALID');
blocked('7 invalid new build receipt blocked', i => { i.buildValid = false; }, 'NEW_BUILD_RECEIPT_INVALID');
blocked('8 invalid candidate manifest blocked', i => { i.manifestValid = false; }, 'CANDIDATE_MANIFEST_INVALID');
blocked('9 rollback uncovered blocked', i => { i.rollbackCovered = false; }, 'ROLLBACK_UNCOVERED');
blocked('10 promotion already complete blocked', i => { i.promotionComplete = true; }, 'FIRST_PROMOTION_NOT_STAGED');
blocked('11 unexpected Web candidate change blocked', i => { i.lease.web_deploy_git_sha = 'b'.repeat(40); }, 'WEB_CANDIDATE_CHANGED');
blocked('11b out-of-scope diff blocked', i => { i.diffScope = 'OUT_OF_SCOPE'; }, 'DIFF_SCOPE_INVALID');

let deployed;
{
  const x = fixture();
  try {
    const beforeReceipt = fs.readFileSync(x.receiptFile), r = applyNativeAmendment(plan(x), { governanceSha: 'f'.repeat(40) });
    const lease = x.read('lease'), pending = x.read('pending');
    assert.equal(r.amended, true);
    assert.deepEqual(fs.readFileSync(x.receiptFile), beforeReceipt);
    assert.deepEqual(fs.readFileSync(path.join(x.root, r.receipt_history)), beforeReceipt);
    assert.equal(activeNativeReceiptPath(pending), nativeReceiptPath);
    pass('12 valid amendment preserves original Native receipt bytes and history copy');
    assert.equal(lease.lease_id, LEASE); assert.equal(lease.status, 'ACTIVE'); assert.equal(lease.owner_task_id, OWNER);
    assert.equal(lease.native_deploy_git_sha, OLD); assert.equal(lease.active_native_candidate.native_git_sha, NEW);
    assert.equal(lease.native_candidate_amendments[0].old_disposition, 'INTERMEDIATE_NATIVE_CANDIDATE');
    assert.equal(lease.native_candidate_amendments[0].new_disposition, 'ACTIVE_NATIVE_CANDIDATE');
    assert.equal(lease.web_deploy_git_sha, WEB); assert.equal(nativeAmendmentApplied(x.root, lease, pending), true);
    const audit = JSON.parse(fs.readFileSync(path.join(x.root, r.audit_receipt)));
    assert.equal(audit.reason, AMENDMENT.reason); assert.match(audit.evidence_digest, /^[A-F0-9]{64}$/);
    pass('13 valid amendment keeps same lease, deployed a4c and Web candidate');
    const again = applyNativeAmendment(plan(x));
    assert.equal(again.already_amended, true); assert.deepEqual(x.read('lease'), lease);
    const conflict = plan(x); conflict.manifestSha = '0'.repeat(64);
    assert.throws(() => applyNativeAmendment(conflict), /NATIVE_AMENDMENT_CONFLICT/);
    pass('20 duplicate amendment is idempotent and a different candidate conflicts precisely');

    const rt = runtime(x);
    const d = await deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE, adapter: rt.adapter, now: rt.now, timing: rt.timing });
    assert.equal(d.retirement.method, 'GRACEFUL'); assert.equal(d.retirement.forced, false);
    assert.equal(rt.s.actions.some(a => a.action === 'retire-known-buggy-map'), false);
    assert.deepEqual(fs.readFileSync(x.receiptFile), beforeReceipt);
    const p2 = x.read('pending'), l2 = x.read('lease'), nr = JSON.parse(fs.readFileSync(path.join(x.root, p2.native_receipt_path)));
    assert.equal(nativeReceiptValid(nr, { nativeSha: NEW, leaseId: LEASE, manifestHash: l2.native_candidate_manifest_sha256 }), true);
    assert.equal(l2.native_deploy_git_sha, NEW); assert.equal(l2.lease_id, LEASE);
    pass('14 old a4c graceful stop succeeds: no force fallback, new receipt beside original');
    assert.equal(gracefulShutdownLiveSatisfied(x.root, l2, p2), false);
    const failing = runtime(x, { cycleStopFails: true }); failing.s.phase = 'new';
    await assert.rejects(gracefulShutdownCycle({ root: x.root, owner: OWNER, leaseId: LEASE, adapter: failing.adapter, now: failing.now, timing: failing.timing }), /NEW_NATIVE_GRACEFUL_SHUTDOWN_FAILED/);
    assert.equal(failing.s.actions.some(a => a.action === 'retire-known-buggy-map'), false);
    assert.equal(gracefulShutdownLiveSatisfied(x.root, x.read('lease'), x.read('pending')), false);
    fs.rmSync(path.join(x.dir, 'native-graceful-cycle.lock'), { recursive: true });
    rt.s.phase = 'new';
    const g = await gracefulShutdownCycle({ root: x.root, owner: OWNER, leaseId: LEASE, adapter: rt.adapter, now: rt.now, timing: rt.timing });
    assert.equal(g.NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE, 'PASS');
    assert.equal(gracefulShutdownLiveSatisfied(x.root, x.read('lease'), x.read('pending')), true);
    pass('19 race closure requires a real 23c graceful cycle; failed stop never passes and never forces');
    deployed = true;
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    applyNativeAmendment(plan(x));
    const rt = runtime(x, { hang: true });
    const d = await deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE, adapter: rt.adapter, now: rt.now, timing: rt.timing });
    const retire = rt.s.actions.find(a => a.action === 'retire-known-buggy-map');
    assert.equal(d.retirement.method, 'KNOWN_BUG_FORCE_RETIREMENT'); assert.equal(d.retirement.scope, 'OLD_BUGGY_NATIVE_ONLY');
    assert.equal(retire.extra.TargetPid, 3); assert.equal(retire.extra.ExpectedSha256, x.oldArtifacts[2].sha256);
    const evidence = path.join(x.root, d.retirement.evidence);
    assert.equal(h(fs.readFileSync(evidence)), d.retirement.evidence_sha256);
    assert.equal(JSON.parse(fs.readFileSync(evidence)).hang.terminating, false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(x.root, x.read('pending').native_receipt_path))).old_runtime_retirement.forced, true);
    pass('15 hung old a4c after bounded stop: exact-PID force fallback with preserved evidence');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    assert.equal(retirementDecision(decisionBase(x)).eligible, true);
    assert.equal(retirementDecision({ ...decisionBase(x), observedMapPids: [99] }).reason, 'FORCE_RETIRE_WRONG_PID');
    assert.equal(retirementDecision({ ...decisionBase(x), observedMapPids: [3, 99] }).reason, 'FORCE_RETIRE_WRONG_PID');
    pass('16 wrong or replacement map PID blocks force');
    assert.equal(retirementDecision({ ...decisionBase(x), liveMapSha256: 'E'.repeat(64) }).reason, 'FORCE_RETIRE_WRONG_SHA');
    assert.equal(retirementDecision({ ...decisionBase(x), deployedNativeSha: 'c'.repeat(40) }).reason, 'FORCE_RETIRE_WRONG_SHA');
    pass('17 wrong old Native hash or SHA blocks force');
    assert.equal(retirementDecision({ ...decisionBase(x), deployedNativeSha: NEW }).reason, 'FORCE_RETIRE_HEALTHY_NEW_NATIVE');
    for (const [patch, reason] of [[{ gracefulAttempted: false }, 'GRACEFUL_STOP_NOT_ATTEMPTED'], [{ elapsedMs: 1000 }, 'RETIRE_TIMEOUT_NOT_ELAPSED'],
      [{ targetAlive: false }, 'TARGET_ALREADY_EXITED'], [{ hang: { shuttingDown: true, terminating: true } }, 'KNOWN_HANG_STATE_NOT_OBSERVED'],
      [{ evidencePreserved: false }, 'RETIRE_EVIDENCE_NOT_PRESERVED'], [{ leaseOk: false }, 'FORCE_RETIRE_LEASE_MISMATCH']])
      assert.equal(retirementDecision({ ...decisionBase(x), ...patch }).reason, reason);
    pass('18 new 23c runtime has no force fallback; every other hard gate blocks');
  } finally { x.cleanup(); }
}
assert.ok(deployed);
{
  const x = fixture();
  try {
    applyNativeAmendment(plan(x));
    const rt = runtime(x, { deployHealthFail: true });
    await assert.rejects(deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE,
      adapter: rt.adapter, now: rt.now, timing: rt.timing }), /POSTDEPLOY_HEALTH_FAILED:ROLLBACK_F7_PASS/);
    for (const item of x.oldArtifacts)
      assert.equal(h(fs.readFileSync(path.join(x.root, item.path))), item.sha256);
    assert.equal(x.read('lease').native_deploy_git_sha, OLD);
    assert.equal(x.read('pending').native_git_sha, OLD);
    pass('22 failed postdeploy health automatically restores exact predecessor and keeps lease');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    const cfg = withConfigDeployment(x);
    applyNativeAmendment(plan(x));
    const rt = runtime(x);
    await deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE,
      adapter: rt.adapter, now: rt.now, timing: rt.timing, policy: cfg.policy });
    assert.deepEqual(fs.readFileSync(path.join(x.root, cfg.productionPath)), cfg.next);
    const receipt = JSON.parse(fs.readFileSync(path.join(x.root, x.read('pending').native_receipt_path)));
    assert.equal(receipt.config_artifacts[0].sha256, h(cfg.next));
    assert.deepEqual(fs.readFileSync(path.join(x.root, receipt.config_artifacts[0].rollback_path)), cfg.old);
    pass('23 config deploy preserves candidate bytes and pins prior image in receipt');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    const cfg = withConfigDeployment(x);
    applyNativeAmendment(plan(x));
    const rt = runtime(x, { deployHealthFail: true });
    await assert.rejects(deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE,
      adapter: rt.adapter, now: rt.now, timing: rt.timing, policy: cfg.policy }), /POSTDEPLOY_HEALTH_FAILED:ROLLBACK_F7_PASS/);
    assert.deepEqual(fs.readFileSync(path.join(x.root, cfg.productionPath)), cfg.old);
    pass('24 failed health restores exact config preimage');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    const cfg = withConfigDeployment(x);
    applyNativeAmendment(plan(x));
    fs.writeFileSync(path.join(x.root, 'build/candidate-config.json'), 'tampered');
    const rt = runtime(x);
    await assert.rejects(deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE,
      adapter: rt.adapter, now: rt.now, timing: rt.timing, policy: cfg.policy }), /NATIVE_CONFIG_DEPLOYMENT_INVALID/);
    assert.deepEqual(fs.readFileSync(path.join(x.root, cfg.productionPath)), cfg.old);
    pass('25 altered candidate config blocks before runtime stop');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    applyNativeAmendment(plan(x));
    const rt = runtime(x);
    await assert.rejects(deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE,
      adapter: rt.adapter, now: rt.now, timing: rt.timing,
      policy: { ...AMENDMENT, reason: 'M1_SAVED_TOWN_NOOP_VALIDATOR_V1' } }),
    /NATIVE_CONFIG_DEPLOYMENT_REQUIRED/);
    pass('26 Saved Town amendment requires a frozen config package');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    const cfg = withConfigDeployment(x);
    cfg.policy.reason = 'M1_SAVED_TOWN_NOOP_VALIDATOR_V1';
    applyNativeAmendment(plan(x));
    const rt = runtime(x);
    await deployAmendedNative({ root: x.root, owner: OWNER, leaseId: LEASE,
      adapter: rt.adapter, now: rt.now, timing: rt.timing, policy: cfg.policy });
    assert.deepEqual(fs.readFileSync(path.join(x.root, cfg.productionPath)), cfg.next);
    pass('27 Saved Town amendment deploys exact frozen config bytes');
  } finally { x.cleanup(); }
}
assert.equal(count, 27);
console.log(`NATIVE_CANDIDATE_AMENDMENT_TESTS=PASS COUNT=${count}`);
