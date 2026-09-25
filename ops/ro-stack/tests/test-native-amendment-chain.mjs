import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { HISTORICAL_NATIVE_AMENDMENT as old, M1_SECOND_NATIVE_AMENDMENT as policy,
  M1_INVENTORY_MAINTENANCE_NATIVE_AMENDMENT as inventory,
  M1_INVENTORY_PROJECTION_CORRECTION as projection,
  M1_FARM_WORLD_TELEPORT_SPAWN_CORRECTION as farmTeleport,
  M1_START_FARM_SUPPLY_CONTRACT_CORRECTION as startFarmSupply,
  M1_AUTO_FARM_QUARANTINE_RECOVERY_CORRECTION as farmRecovery,
  M1_DORMANT_QUARANTINE_RUNTIME_CORRECTION as dormantRecovery,
  M1_DEATH_TOWN_MAINTENANCE_AMENDMENT as deathMaintenance,
  M1_PLAYER_FLY_WING_EFFECT_CORRECTION as playerFlyWing,
  M1_SUPPLY_COMMAND_ADMISSION_CORRECTION as supplyCommands,
  M1_START_FARM_SERVICE_FIELDS_CORRECTION as farmServiceFields,
  validateNativeAmendmentHistory, validateHistoricalNativeAnchor, validateNextNativeAmendment,
  applyNextNativeAmendment, deployedNativeRuntimeMatches } from '../native-amendment-chain.mjs';
import { retirementDecision } from '../native-candidate-amendment.mjs';

const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const owner = 'F｜M1 最終整合', leaseId = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a';
const next = '3'.repeat(40), third = '4'.repeat(40);
let count = 0;
const pass = name => console.log(`PASS ${++count} ${name}`);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-chain-'));
  const put = (name, value) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value) + '\n');
    return file;
  };
  const base = '.local/ro-stack/';
  const nativeReceipt = (sha, suffix, binary, manifestHash = 'B'.repeat(64)) => {
    const artifacts = ['login', 'char', 'map'].map(name => {
      const p = `${base}rathena/${name}-server.exe`;
      put(p, `${binary}-${name}`);
      return { path: p, sha256: hash(`${binary}-${name}`) };
    });
    const rel = `${base}native-promotion-receipt-${suffix}.json`;
    const file = put(rel, { schema_version: 'native-deploy-v1', deploy_id: `fixture-${suffix}`, lease_id: leaseId,
      native_git_sha: sha, native_build_sha256: artifacts[2].sha256, new_binary_sha256: artifacts[2].sha256,
      previous_binary_sha256: 'A'.repeat(64), candidate_manifest_sha256: manifestHash, old_map_pid: 1,
      new_map_pid: 2, procdump_receipt: { mapPid: 2, procdumpAttachStatus: 'ATTACHED' },
      runtime_health: { pass: true, counts: { login: 1, char: 1, map: 1 } }, openkore_runtime_count: 0,
      rollback_reference: { root: 'legacy' }, acceptance_status: 'NATIVE_CANDIDATE_ACTIVE', artifacts });
    return { path: rel, sha256: hash(fs.readFileSync(file)) };
  };
  const original = nativeReceipt(old.oldSha, 'original', 'old');
  const historicalManifest = put('build/historical.json', { native_git_sha: old.newSha });
  const historicalRef = { path: historicalManifest, sha256: hash(fs.readFileSync(historicalManifest)) };
  const audit = put(`${base}historical-audit.json`, { schema_version: 'native-candidate-amendment-v1',
    lease_id: leaseId, lease_owner: owner, old_native_git_sha: old.oldSha,
    new_native_git_sha: old.newSha, reason: old.reason, old_native_receipt: original,
    new_candidate_manifest: historicalRef });
  const history = [{ old_native_git_sha: old.oldSha, new_native_git_sha: old.newSha,
    reason: old.reason, audit_receipt: `${base}historical-audit.json`, audit_sha256: hash(fs.readFileSync(audit)),
    previous_native_receipt: original, candidate_manifest: historicalManifest,
    candidate_manifest_sha256: historicalRef.sha256 }];
  const deployed = nativeReceipt(old.newSha, old.newSha.slice(0, 12), 'current');
  const active = { native_git_sha: old.newSha, candidate_manifest: historicalManifest,
    candidate_manifest_sha256: historicalRef.sha256, binary_sha256: 'C'.repeat(64),
    deployed: true, graceful_shutdown_live: 'REQUIRED', deploy_receipt: deployed.path };
  const lease = { lease_id: leaseId, owner_task_id: owner, status: 'ACTIVE',
    promotion_mode: 'FIRST_GITHUB_FIRST_PROMOTION', native_candidate_amendments: history,
    active_native_candidate: active, native_deploy_git_sha: old.newSha,
    native_candidate_manifest_sha256: 'B'.repeat(64), web_deploy_git_sha: '9'.repeat(40) };
  const pending = { lease_id: leaseId, owner_task_id: owner,
    started_at: '2026-09-24T14:57:15.109Z', native_candidate_amendments: history,
    active_native_candidate: active, native_git_sha: old.newSha,
    native_receipt_path: deployed.path, native_receipt_sha256: deployed.sha256,
    native_stage: 'NATIVE_STAGE_COMPLETE', web_git_sha: '9'.repeat(40) };
  const state = { schema_version: 2, baseline_mode: 'LEGACY_PRE_GITHUB_FIRST',
    historical_provenance: 'UNRESOLVED', current_web_git_sha: 'UNRESOLVED_LEGACY',
    current_native_git_sha: 'UNRESOLVED_LEGACY', current_deploy_id: 'LEGACY_BOOTSTRAP_0123456789abcdef',
    legacy_bootstrap_available: true, production_drift: 'OPEN',
    drift_reason: 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT',
    first_promotion_phase: 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' };
  const manifest = { native_git_sha: next, amendment_of: { native_git_sha: old.newSha,
    reason: policy.reason, candidate_manifest_sha256: lease.native_candidate_manifest_sha256 },
    rollback_reference: { intermediate_rollback: { native_git_sha: old.newSha } },
    binary_sha256: 'D'.repeat(64) };
  const manifestFile = put('build/new.json', manifest), manifestSha = hash(fs.readFileSync(manifestFile));
  const files = { lease: put(`${base}production-deployment-lease/lease.json`, lease),
    pending: put(`${base}first-github-first-promotion.pending.json`, pending),
    state: put(`${base}production-deployment-state.json`, state) };
  const input = { lease, pending, state, owner, leaseId, previousSha: old.newSha, newSha: next,
    reason: policy.reason, scope: policy.scope,
    promotionId: `FIRST_GITHUB_FIRST_PROMOTION:${pending.started_at}`,
    candidateManifest: manifest, candidateManifestSha256: manifestSha,
    sourceDiff: { scope: policy.scope, files: ['src/map/persistent_agent.cpp'] },
    githubReachable: true, descendant: true, regressionPassed: true,
    rollbackReady: true, runtimeMatchesDeployed: true, previousReceiptSha256: deployed.sha256,
    tests: { result: 'PASS' } };
  const plan = { input, candidateManifestPath: manifestFile,
    currentHashes: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, hash(fs.readFileSync(v))])) };
  return { root, put, files, input, plan, nativeReceipt, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function test(name, action) {
  const x = fixture();
  try { action(x); pass(name); } finally { x.cleanup(); }
}
function reject(name, mutate, code) {
  test(name, x => { mutate(x); assert.throws(() => validateNextNativeAmendment(x.root, x.input), new RegExp(code)); });
}

test('historical amendment accepted without rewriting its receipt', x => {
  assert.equal(validateNativeAmendmentHistory(x.root, x.input.lease, x.input.pending).length, 1);
});
test('production historical anchor refuses synthetic replacement', x => {
  assert.throws(() => validateHistoricalNativeAnchor(x.root, x.input.lease, x.input.pending),
    /HISTORICAL_NATIVE_ANCHOR_CHANGED/);
});
test('second amendment accepted under same lease', x => {
  assert.equal(validateNextNativeAmendment(x.root, x.input).history.length, 1);
});
reject('wrong predecessor rejected', x => { x.input.previousSha = old.oldSha; }, 'PREVIOUS_NATIVE_CANDIDATE_MISMATCH');
reject('skipped candidate rejected', x => { x.input.lease.active_native_candidate.native_git_sha = old.oldSha; }, 'ACTIVE_NATIVE_CANDIDATE_HISTORY_MISMATCH');
reject('wrong owner rejected', x => { x.input.owner = 'OTHER'; }, 'ACTIVE_NATIVE_AMENDMENT_LEASE_REQUIRED');
reject('wrong promotion rejected', x => { x.input.promotionId = 'OTHER'; }, 'PREVIOUS_NATIVE_CANDIDATE_MISMATCH');
reject('unapproved reason rejected', x => { x.input.reason = 'OTHER'; }, 'NATIVE_AMENDMENT_REASON_UNAPPROVED');
reject('unreachable candidate rejected', x => { x.input.githubReachable = false; }, 'NEW_NATIVE_CANDIDATE_NOT_REACHABLE');
reject('out-of-scope Native edit rejected', x => { x.input.sourceDiff.files = ['src/map/map.cpp']; }, 'NATIVE_AMENDMENT_DIFF_OUT_OF_SCOPE');
reject('wrong rollback target rejected', x => { x.input.candidateManifest.rollback_reference.intermediate_rollback.native_git_sha = old.oldSha; }, 'NATIVE_AMENDMENT_MANIFEST_INVALID');
reject('mutated historical audit rejected', x => { x.put('.local/ro-stack/historical-audit.json', 'tampered'); }, 'NATIVE_AMENDMENT_AUDIT_CHANGED');
reject('missing regression proof rejected', x => { x.input.regressionPassed = false; }, 'NATIVE_AMENDMENT_EVIDENCE_INCOMPLETE');
test('second amendment has no forced-retirement path', () => {
  assert.deepEqual(retirementDecision({}, { no_force_retirement: true }),
    { eligible: false, reason: 'NATIVE_V2_FORCE_RETIREMENT_FORBIDDEN' });
});
test('append preserves first audit and blocks replay', x => {
  const first = fs.readFileSync(path.join(x.root, '.local/ro-stack/historical-audit.json'));
  const result = applyNextNativeAmendment(x.root, x.plan);
  assert.equal(result.chain_length, 2);
  assert.deepEqual(fs.readFileSync(path.join(x.root, '.local/ro-stack/historical-audit.json')), first);
  const lease = JSON.parse(fs.readFileSync(x.files.lease)), pending = JSON.parse(fs.readFileSync(x.files.pending));
  assert.equal(validateNativeAmendmentHistory(x.root, lease, pending).length, 2);
  assert.throws(() => applyNextNativeAmendment(x.root, x.plan), /NATIVE_AMENDMENT_INPUT_CHANGED/);
});
test('parallel pending amendment is blocked', x => {
  x.input.lease.active_native_candidate.deployed = false;
  assert.throws(() => validateNextNativeAmendment(x.root, x.input), /DEPLOYED_NATIVE_CANDIDATE_HISTORY_MISMATCH/);
});
test('third amendment can only follow deployed second candidate', x => {
  applyNextNativeAmendment(x.root, x.plan);
  const lease = JSON.parse(fs.readFileSync(x.files.lease)), pending = JSON.parse(fs.readFileSync(x.files.pending));
  x.input.lease = lease; x.input.pending = pending; x.input.previousSha = next; x.input.newSha = third;
  assert.throws(() => validateNextNativeAmendment(x.root, x.input), /PREVIOUS_NATIVE_CANDIDATE_MISMATCH/);
});
function deployedSecond(x) {
  applyNextNativeAmendment(x.root, x.plan);
  const lease = JSON.parse(fs.readFileSync(x.files.lease)), pending = JSON.parse(fs.readFileSync(x.files.pending));
  const second = x.nativeReceipt(next, next.slice(0, 12), 'second', x.input.candidateManifestSha256);
  lease.active_native_candidate = { ...lease.active_native_candidate, deployed: true, deploy_receipt: second.path };
  pending.active_native_candidate = lease.active_native_candidate;
  lease.native_deploy_git_sha = next;
  lease.native_candidate_manifest_sha256 = x.input.candidateManifestSha256;
  pending.native_git_sha = next;
  pending.native_receipt_path = second.path;
  pending.native_receipt_sha256 = second.sha256;
  x.put('.local/ro-stack/production-deployment-lease/lease.json', lease);
  x.put('.local/ro-stack/first-github-first-promotion.pending.json', pending);
  return { lease, pending, second };
}
function thirdInputFor(x, reason, files) {
  const { lease, pending, second } = deployedSecond(x);
  const selected = reason === inventory.reason ? inventory : policy;
  const thirdManifest = { native_git_sha: third, amendment_of: { native_git_sha: next,
    reason, candidate_manifest_sha256: x.input.candidateManifestSha256 },
    rollback_reference: { intermediate_rollback: { native_git_sha: next } }, binary_sha256: 'E'.repeat(64) };
  const thirdFile = x.put('build/third.json', thirdManifest);
  const thirdInput = { ...x.input, lease, pending, previousSha: next, newSha: third,
    reason, scope: selected.scope, sourceDiff: { scope: selected.scope, files },
    candidateManifest: thirdManifest, candidateManifestSha256: hash(fs.readFileSync(thirdFile)),
    previousReceiptSha256: second.sha256 };
  return { thirdInput, thirdFile };
}
test('third inventory-maintenance amendment is accepted after exact second deployment', x => {
  const { thirdInput, thirdFile } = thirdInputFor(x, inventory.reason,
    ['src/map/persistent_agent.cpp', 'src/map/persistent_agent_m1_supply_policy.hpp',
      'tools/pa-command-contract/test-m1-supply-policy.cpp']);
  assert.equal(validateNextNativeAmendment(x.root, thirdInput).history.length, 2);
  const thirdPlan = { input: thirdInput, candidateManifestPath: thirdFile,
    currentHashes: Object.fromEntries(Object.entries(x.files).map(([k, v]) => [k, hash(fs.readFileSync(v))])) };
  assert.equal(applyNextNativeAmendment(x.root, thirdPlan).chain_length, 3);
  const lease = JSON.parse(fs.readFileSync(x.files.lease)), pending = JSON.parse(fs.readFileSync(x.files.pending));
  assert.equal(validateNativeAmendmentHistory(x.root, lease, pending).length, 3);
});
test('repeating an applied amendment reason is rejected', x => {
  const { thirdInput } = thirdInputFor(x, policy.reason, ['src/map/persistent_agent.cpp']);
  assert.throws(() => validateNextNativeAmendment(x.root, thirdInput), /NATIVE_AMENDMENT_REASON_UNAPPROVED/);
});
test('inventory-maintenance amendment rejects files outside its scope', x => {
  const { thirdInput } = thirdInputFor(x, inventory.reason,
    ['src/map/persistent_agent.cpp', 'conf/persistent_agent_commands.json']);
  assert.throws(() => validateNextNativeAmendment(x.root, thirdInput), /NATIVE_AMENDMENT_DIFF_OUT_OF_SCOPE/);
});
test('fourth projection correction requires the deployed inventory candidate', x => {
  const { thirdInput, thirdFile } = thirdInputFor(x, inventory.reason,
    ['src/map/persistent_agent.cpp']);
  const thirdPlan = { input: thirdInput, candidateManifestPath: thirdFile,
    currentHashes: Object.fromEntries(Object.entries(x.files).map(([k, v]) => [k, hash(fs.readFileSync(v))])) };
  applyNextNativeAmendment(x.root, thirdPlan);
  const lease = JSON.parse(fs.readFileSync(x.files.lease));
  const pending = JSON.parse(fs.readFileSync(x.files.pending));
  const manifest = { native_git_sha: '5'.repeat(40), amendment_of: {
    native_git_sha: third, reason: projection.reason,
    candidate_manifest_sha256: thirdInput.candidateManifestSha256 },
    rollback_reference: { intermediate_rollback: { native_git_sha: third } } };
  const fourthFile = x.put('build/fourth.json', manifest);
  const fourthInput = { ...thirdInput, lease, pending, previousSha: third,
    newSha: manifest.native_git_sha, reason: projection.reason, scope: projection.scope,
    sourceDiff: { scope: projection.scope, files: projection.sourcePaths },
    candidateManifest: manifest, candidateManifestSha256: hash(fs.readFileSync(fourthFile)) };
  assert.throws(() => validateNextNativeAmendment(x.root, fourthInput),
    /PREVIOUS_NATIVE_CANDIDATE_MISMATCH/);
  const deployed = x.nativeReceipt(third, third.slice(0, 12), 'third',
    thirdInput.candidateManifestSha256);
  lease.active_native_candidate = { ...lease.active_native_candidate, deployed: true,
    deploy_receipt: deployed.path };
  pending.active_native_candidate = lease.active_native_candidate;
  lease.native_deploy_git_sha = third;
  lease.native_candidate_manifest_sha256 = thirdInput.candidateManifestSha256;
  pending.native_git_sha = third;
  pending.native_receipt_path = deployed.path;
  pending.native_receipt_sha256 = deployed.sha256;
  fourthInput.previousReceiptSha256 = deployed.sha256;
  assert.equal(validateNextNativeAmendment(x.root, fourthInput).history.length, 3);
});
test('farm teleport amendment allows only its exact contract and spawn files', () => {
  assert.equal(farmTeleport.reason, 'M1_FARM_WORLD_TELEPORT_DYNAMIC_SPAWN_ALIGNMENT_V1');
  assert.deepEqual(farmTeleport.sourcePaths, [
    'conf/persistent_agent_commands.json',
    'src/map/persistent_agent.cpp',
    'tools/pa-command-contract/contract-test-matrix.json',
    'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  ]);
  assert.equal(farmTeleport.sourcePaths.includes('src/map/map.cpp'), false);
});
test('start farm supply contract amendment allows only schema and matrix', () => {
  assert.equal(startFarmSupply.reason, 'M1_START_FARM_SUPPLY_POLICY_CONTRACT_ALIGNMENT_V1');
  assert.deepEqual(startFarmSupply.sourcePaths, [
    'conf/persistent_agent_commands.json',
    'tools/pa-command-contract/contract-test-matrix.json',
  ]);
  assert.equal(startFarmSupply.sourcePaths.includes('src/map/persistent_agent.cpp'), false);
});
test('farm quarantine recovery amendment allows only failure and recovery source', () => {
  assert.equal(farmRecovery.reason, 'M1_AUTO_FARM_QUARANTINE_RECOVERY_V1');
  assert.deepEqual(farmRecovery.sourcePaths, [
    'src/map/persistent_agent.cpp',
    'src/map/persistent_agent_state.cpp',
    'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  ]);
  assert.equal(farmRecovery.sourcePaths.includes('src/map/map.cpp'), false);
});
test('dormant quarantine runtime amendment excludes unrelated native source', () => {
  assert.equal(dormantRecovery.reason, 'M1_DORMANT_QUARANTINE_RUNTIME_RELEASE_V1');
  assert.deepEqual(dormantRecovery.sourcePaths, [
    'src/map/persistent_agent.cpp',
    'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  ]);
  assert.equal(dormantRecovery.sourcePaths.includes('src/map/map.cpp'), false);
});
test('V15 death maintenance amendment admits only the reviewed source and evidence', () => {
  assert.equal(deathMaintenance.reason, 'M1_DEATH_TOWN_MAINTENANCE_V1');
  assert.deepEqual(deathMaintenance.sourcePaths, [
    'src/map/persistent_agent.cpp',
    'src/map/persistent_agent_m1_supply_policy.hpp',
    'tools/pa-command-contract/M1DeathMaintenanceReference.md',
    'tools/pa-command-contract/Test-M1DeathMaintenanceSource.ps1',
    'tools/pa-command-contract/test-m1-supply-policy.cpp',
  ]);
  assert.equal(deathMaintenance.sourcePaths.includes('src/map/map.cpp'), false);
});
test('player Fly Wing effect correction admits only the item adapter and guard', () => {
  assert.equal(playerFlyWing.reason, 'M1_PLAYER_FLY_WING_EFFECT_CONFIRMATION_V1');
  assert.deepEqual(playerFlyWing.sourcePaths, [
    'src/map/persistent_agent.cpp',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
  ]);
  assert.equal(playerFlyWing.sourcePaths.includes('src/map/pc.cpp'), false);
});
test('supply command correction admits only contract and its tests', () => {
  assert.equal(supplyCommands.reason, 'M1_SUPPLY_COMMAND_ADMISSION_V1');
  assert.deepEqual(supplyCommands.sourcePaths, [
    'conf/persistent_agent_commands.json',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
    'tools/pa-command-contract/Test-PaCommandContract.ps1',
    'tools/pa-command-contract/contract-test-matrix.json',
  ]);
  assert.equal(supplyCommands.sourcePaths.includes('src/map/persistent_agent.cpp'), false);
});
test('start farm service-field correction admits only contract and its tests', () => {
  assert.equal(farmServiceFields.reason, 'M1_START_FARM_SERVICE_FIELDS_V1');
  assert.deepEqual(farmServiceFields.sourcePaths, [
    'conf/persistent_agent_commands.json',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
    'tools/pa-command-contract/contract-test-matrix.json',
  ]);
  assert.equal(farmServiceFields.sourcePaths.includes('src/map/persistent_agent.cpp'), false);
});
{
  const mapHash = 'A'.repeat(64);
  const receipt = { artifacts: [{ path: '.local/ro-stack/rathena/map-server.exe', sha256: mapHash }],
    procdump_receipt: { mapPid: 2 } };
  const runtime = { pass: true, openkore_runtime_count: 0,
    counts: { login: 1, char: 1, map: 1 }, pids: { map: 3 },
    procdump_receipt: { mapPid: 3, procdumpAttachStatus: 'ATTACHED', mapBinarySha256: mapHash },
    procdump_account: 'NT AUTHORITY\\SYSTEM',
    procdump_process_identity: { PROCESS_IDENTITY_MATCH: 'YES' } };
  assert.equal(deployedNativeRuntimeMatches(runtime, receipt), true);
  pass('same-binary runtime rebind accepts fresh ProcDump PID without rewriting old receipt');
  assert.equal(deployedNativeRuntimeMatches({ ...runtime,
    procdump_receipt: { ...runtime.procdump_receipt, mapBinarySha256: 'B'.repeat(64) } }, receipt), false);
  assert.equal(deployedNativeRuntimeMatches({ ...runtime,
    procdump_receipt: { ...runtime.procdump_receipt, mapPid: 4 } }, receipt), false);
  assert.equal(deployedNativeRuntimeMatches({ ...runtime, procdump_account: 'OTHER' }, receipt), false);
  pass('runtime rebind rejects wrong binary, PID, and ProcDump account');
}
console.log(`NATIVE_AMENDMENT_CHAIN_TESTS=${count}`);
