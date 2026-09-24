import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exactConfigPatch, validateAuthority, reconcileActiveRuntimeConfig } from '../reconcile-active-runtime-config.mjs';

const h = b => createHash('sha256').update(b).digest('hex').toUpperCase();
const sha = 'a4c736d865eeedca398aad97aeff1c1036f2dc39', web = '8cdb13fb88be7199aae15b81e55a9a89a5ec78c5';
const owner = 'F｜M1 最終整合', leaseId = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a';
const oldConfig = Buffer.from('@{\n PersistentAgentSpThresholdPercent = 20\n PersistentAgentSpSafePercent = 40\n Preserved = 123\n}\n');
const sourceConfig = Buffer.from('@{\n PersistentAgentSpThresholdPercent = 0\n PersistentAgentSpSafePercent = 0\n Preserved = 999\n}\n');
const policy = { lease_id: leaseId, owner, native_sha: sha, web_sha: web,
  old_config_sha256: h(oldConfig), source_config_sha256: h(sourceConfig),
  changes: { PersistentAgentSpThresholdPercent: [20, 0], PersistentAgentSpSafePercent: [40, 0] },
  out_of_scope_source_variance: ['Preserved'] };
const targetConfig = exactConfigPatch(oldConfig, sourceConfig, policy).bytes;
let count = 0;
function pass(name) { console.log(`PASS ${++count} ${name}`); }
function put(root, rel, value) {
  const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value)); return file;
}
function base() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-config-reconcile-'));
  const artifactData = ['login', 'char', 'map'].map(n => Buffer.from(`binary-${n}`));
  const artifacts = ['login', 'char', 'map'].map((n, i) => ({ path: `.local/ro-stack/rathena/${n}-server.exe`, sha256: h(artifactData[i]) }));
  artifacts.forEach((a, i) => put(root, a.path, artifactData[i]));
  const lease = { lease_id: leaseId, owner_task_id: owner, status: 'ACTIVE', promotion_mode: 'FIRST_GITHUB_FIRST_PROMOTION',
    native_deploy_git_sha: sha, web_deploy_git_sha: web, native_candidate_manifest_sha256: 'D'.repeat(64) };
  const state = { schema_version: 2, baseline_mode: 'LEGACY_PRE_GITHUB_FIRST', historical_provenance: 'UNRESOLVED',
    current_deploy_id: 'LEGACY_BOOTSTRAP_0123456789abcdef', current_web_git_sha: 'UNRESOLVED_LEGACY',
    current_native_git_sha: 'UNRESOLVED_LEGACY', legacy_bootstrap_available: true, production_drift: 'OPEN',
    drift_reason: 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT', first_promotion_phase: 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' };
  const pending = { lease_id: leaseId, owner_task_id: owner, native_git_sha: sha, web_git_sha: web,
    native_stage: 'NATIVE_STAGE_COMPLETE', native_stage_reconciled: true, started_at: '2026-09-24T14:57:15Z' };
  const native = { native_git_sha: sha, owner_task_id: owner, new_binary_sha256: artifacts[2].sha256,
    new_pids: { login: 10, char: 11, map: 12 }, artifacts };
  const paths = { lease: put(root, '.local/ro-stack/production-deployment-lease/lease.json', lease),
    state: put(root, '.local/ro-stack/production-deployment-state.json', state),
    native: put(root, '.local/ro-stack/native-promotion-receipt.json', native),
    config: put(root, 'ops/ro-stack/stack.config.psd1', oldConfig),
    launcher: put(root, 'ops/ro-stack/ro-stack.ps1',
      "$config = Invoke-Expression (Get-Content (Join-Path $scriptRoot 'stack.config.psd1') -Raw)\n" +
      '$env:PERSISTENT_AGENT_SP_THRESHOLD_PCT = [string]$config.PersistentAgentSpThresholdPercent\n' +
      '$env:PERSISTENT_AGENT_SP_SAFE_PCT = [string]$config.PersistentAgentSpSafePercent\n' +
      'Start-Process -FilePath $path\n') };
  pending.native_receipt_sha256 = h(fs.readFileSync(paths.native));
  paths.pending = put(root, '.local/ro-stack/first-github-first-promotion.pending.json', pending);
  return { root, paths, lease, state, pending, native, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
function snapshot(pids, native, { health = true, dump = true } = {}) {
  return { pass: health, counts: { login: 1, char: 1, map: 1 }, pids,
    processes: { map: { started_at: pids.map === 12 ? '2026-09-24T15:00:00Z' : '2026-09-24T15:05:00Z' } },
    dashboard_pid: 21, database_pid: 22, openkore_runtime_count: 0,
    procdump_receipt: dump ? { mapPid: pids.map, procdumpAttachStatus: 'ATTACHED', mapBinarySha256: native.new_binary_sha256,
      runtimeGenerationId: pids.map === 12 ? 'old-generation' : 'new-generation', procdumpProcessId: pids.map === 12 ? 100 : 101 } : null,
    procdump_account: dump ? 'NT AUTHORITY\\SYSTEM' : null,
    procdump_process_identity: dump ? { PROCESS_IDENTITY_MATCH: 'YES' } : null };
}
function harness(x, { health = true, dump = true, stopError = false } = {}) {
  const actions = []; let running = 'old';
  const adapter = async action => {
    actions.push(action);
    if (action === 'stop') { if (stopError) throw Error('STOP_FAILURE'); running = 'none'; return; }
    if (action === 'start') { assert.equal(running, 'none'); running = 'new'; return; }
    assert.equal(action, 'snapshot');
    return snapshot(running === 'new' ? { login: 30, char: 31, map: 32 } : x.native.new_pids,
      x.native, running === 'new' ? { health, dump } : {});
  };
  return { actions, adapter };
}
async function run(x, extra = {}) {
  const a = extra.adapter || harness(x).adapter;
  return reconcileActiveRuntimeConfig({ root: x.root, leaseId, owner, sourceBytes: sourceConfig,
    sourceGitSha: 'f'.repeat(40), adapter: a, verifyGit: false, nativeValid: () => true,
    policy, pollAttempts: 1, pollDelayMs: 0, ...extra });
}
function edit(x, name, fn) { const value = JSON.parse(fs.readFileSync(x.paths[name])); fn(value); fs.writeFileSync(x.paths[name], JSON.stringify(value)); }
async function blocked(name, mutate, code) {
  const x = base(); try { mutate(x); await assert.rejects(run(x), new RegExp(code)); pass(name); } finally { x.cleanup(); }
}

{
  const x = base(); try {
    const p = { ...x.pending, native_receipt_actual_sha256: h(fs.readFileSync(x.paths.native)) };
    assert.equal(validateAuthority({ lease: x.lease, state: x.state, pending: p, native: x.native,
      leaseId, owner, nativeValid: () => true, policy }), true); pass('valid lease and exact delta eligible');
  } finally { x.cleanup(); }
}
await blocked('wrong lease ID blocked', x => edit(x, 'lease', v => { v.lease_id = 'wrong'; }), 'ACTIVE_LEASE_IDENTITY_MISMATCH');
await blocked('wrong Unicode owner blocked', x => edit(x, 'lease', v => { v.owner_task_id = 'F|M1 最終整合'; }), 'ACTIVE_LEASE_IDENTITY_MISMATCH');
await blocked('released lease blocked', x => edit(x, 'lease', v => { v.status = 'RELEASED'; }), 'ACTIVE_LEASE_IDENTITY_MISMATCH');
await blocked('wrong Native SHA blocked', x => edit(x, 'lease', v => { v.native_deploy_git_sha = 'b'.repeat(40); }), 'NATIVE_SHA_CHANGED');
await blocked('binary mismatch blocked', x => fs.writeFileSync(path.join(x.root, x.native.artifacts[2].path), 'changed'), 'NATIVE_BINARIES_CHANGED');
await blocked('invalid Native stage receipt blocked', x => edit(x, 'pending', v => { v.native_receipt_sha256 = '0'.repeat(64); }), 'NATIVE_STAGE_RECEIPT_INVALID');
await blocked('old config mismatch blocked', x => fs.appendFileSync(x.paths.config, 'extra\n'), 'CURRENT_CONFIG_DIGEST_CHANGED');
{
  const x = base(); try { await assert.rejects(run(x, { sourceBytes: Buffer.from(sourceConfig.toString().replace('Percent = 0', 'Percent = 1')) }),
    /CANONICAL_CONFIG_DIGEST_CHANGED/); pass('canonical source mismatch blocked'); } finally { x.cleanup(); }
}
{
  const altered = Buffer.from(oldConfig.toString().replace('Preserved = 123', 'Preserved = 124'));
  assert.throws(() => exactConfigPatch(altered, sourceConfig, policy), /CURRENT_CONFIG_DIGEST_CHANGED/);
  const patch = exactConfigPatch(oldConfig, sourceConfig, policy);
  assert.equal(patch.unrelated_config_change_count, 0);
  assert.match(patch.bytes.toString(), /Preserved = 123/);
  assert.notEqual(patch.bytes.toString(), sourceConfig.toString());
  pass('unrelated config mutation blocked and source variance preserved');
}
{
  const x = base(); try {
    const before = Object.fromEntries(Object.entries(x.paths).map(([k, p]) => [k, h(fs.readFileSync(p))]));
    const q = harness(x); const dry = await run(x, { adapter: q.adapter });
    assert.equal(dry.action, 'DRY_RUN'); assert.deepEqual(q.actions, ['snapshot']);
    assert.deepEqual(Object.fromEntries(Object.entries(x.paths).map(([k, p]) => [k, h(fs.readFileSync(p))])), before);
    assert.equal(fs.existsSync(path.join(x.root, '.local/ro-stack/runtime-config-reconcile.lock')), false);
    pass('dry-run has no mutation');
  } finally { x.cleanup(); }
}
{
  const x = base(); try {
    const q = harness(x); const r = await run(x, { adapter: q.adapter, execute: true });
    assert.equal(r.classification, 'RUNTIME_CONFIG_RECONCILED');
    assert.deepEqual(fs.readFileSync(x.paths.config), targetConfig);
    assert.deepEqual(q.actions, ['snapshot', 'stop', 'start', 'snapshot']);
    pass('valid apply fixture changes only approved config');
    assert.equal(r.new_runtime_pids.map, 32); pass('controlled restart creates one replacement runtime');
    const receipt = JSON.parse(fs.readFileSync(path.join(x.root, r.receipt_path)));
    assert.equal(receipt.native_git_sha, sha); pass('same Native SHA preserved');
    assert.equal(receipt.lease_id, leaseId); pass('same lease preserved');
    assert.equal(JSON.parse(fs.readFileSync(x.paths.state)).baseline_mode, 'LEGACY_PRE_GITHUB_FIRST');
    assert.equal(receipt.first_promotion_complete, false); pass('promotion remains incomplete');
    const second = await run(x, { adapter: q.adapter, execute: true });
    assert.equal(second.already_reconciled, true); assert.equal(q.actions.length, 4); pass('duplicate invocation is idempotent');
    const archive = path.join(x.root, '.local/ro-stack', `runtime-config-reconciled-${leaseId}`);
    const rollback = path.join(x.root, '.local/ro-stack', `runtime-config-rollback-${leaseId}.psd1`);
    assert.equal(fs.existsSync(path.join(archive, 'operation.json')), true);
    assert.equal(h(fs.readFileSync(rollback)), h(oldConfig));
    assert.equal(receipt.rollback_reference, path.relative(x.root, rollback).replaceAll('\\', '/'));
    pass('rollback snapshot and digest preserved');
  } finally { x.cleanup(); }
}
{
  const x = base(); try {
    const q = harness(x, { health: false });
    await assert.rejects(run(x, { adapter: q.adapter, execute: true }), /SINGLE_RUNTIME_HEALTH_FAILED/);
    assert.equal(fs.existsSync(path.join(x.root, `.local/ro-stack/runtime-config-reconciliation-${leaseId}.json`)), false);
    pass('health failure has no success receipt');
  } finally { x.cleanup(); }
}
{
  const x = base(); try {
    const q = harness(x, { dump: false });
    await assert.rejects(run(x, { adapter: q.adapter, execute: true }), /PROCDUMP_RECEIPT_INVALID/);
    assert.equal(fs.existsSync(path.join(x.root, `.local/ro-stack/runtime-config-reconciliation-${leaseId}.json`)), false);
    pass('ProcDump failure has no success receipt');
  } finally { x.cleanup(); }
}
{
  const x = base(); try {
    await assert.rejects(run(x, { execute: true, beforeStop: () => { throw Error('PRESTOP_FAILURE'); } }), /PRESTOP_FAILURE/);
    assert.deepEqual(fs.readFileSync(x.paths.config), oldConfig);
    assert.equal(JSON.parse(fs.readFileSync(path.join(x.root, '.local/ro-stack/runtime-config-reconcile.lock/failure.json'))).config_reverted, true);
    pass('pre-restart failure restores known config');
  } finally { x.cleanup(); }
}
{
  const x = base(); try {
    const q = harness(x, { stopError: true });
    await assert.rejects(run(x, { adapter: q.adapter, execute: true }), /STOP_FAILURE/);
    const failure = JSON.parse(fs.readFileSync(path.join(x.root, '.local/ro-stack/runtime-config-reconcile.lock/failure.json')));
    assert.equal(failure.lease_held, true); assert.equal(failure.production_drift, 'OPEN');
    assert.equal(failure.stop_attempted, true); assert.equal(fs.existsSync(path.join(x.root, `.local/ro-stack/runtime-config-reconciliation-${leaseId}.json`)), false);
    pass('partial restart failure retains journal and held lease');
  } finally { x.cleanup(); }
}
assert.equal(count, 22);
console.log(`RUNTIME_CONFIG_RECONCILIATION_TESTS=PASS COUNT=${count}`);
