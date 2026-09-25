// First-promotion Native amendment history. The shutdown-race v1 receipt is
// immutable; each later transition is appended under the same owner lease.
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { boundedPath, digest, FIRST_PROMOTION, legacyIdentity, readJson } from './legacy-production-baseline.mjs';
import { activeNativeReceiptPath, equalHash, nativeReceiptValid } from './native-promotion-contract.mjs';

export const HISTORICAL_NATIVE_AMENDMENT = Object.freeze({
  oldSha: 'a4c736d865eeedca398aad97aeff1c1036f2dc39',
  newSha: '23c47bfee3a4a1dae21754fb7a4e3ed32d3f657a',
  reason: 'NATIVE_PA_GRACEFUL_SHUTDOWN_MYSQL_RACE_V1',
  auditSha256: '9A04EF9431C64DBC33E2999B088D5BF0068716C8902E4B92E7A7BBEE11AD8670',
  predecessorReceiptSha256: 'F3B21421D9B381E7C743526226ED7B239D015E39B1845FAF9C6B457F38220584',
  candidateManifestSha256: '16E0479CF728C675E0FB6737A265AC3E510F22AAE00C29C0D752867BE82E703B',
});
export const M1_PROMOTION_LEASE_ID = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a';
export const M1_PROMOTION_OWNER = 'F｜M1 最終整合';
export const M1_SECOND_NATIVE_AMENDMENT = Object.freeze({
  reason: 'M1_SETTINGS_EXECUTOR_AND_TEST_FIXTURE_V1',
  scope: 'M1_SETTINGS_EXECUTOR_AND_TEST_FIXTURE_V1',
  // The allowed paths are deliberately narrower than the Native repository.
  sourcePaths: Object.freeze([
    'conf/persistent_agent_commands.json',
    'src/map/persistent_agent.cpp',
    'src/map/persistent_agent_state.cpp',
    'src/map/persistent_agent_state.hpp',
    'src/map/persistent_agent.hpp',
    'src/map/persistent_agent_attack_skill_condition.hpp',
    'src/map/persistent_agent_farm_profile.hpp',
    'src/map/persistent_agent_m1_supply_policy.hpp',
    'src/map/test_fixture_atcommand.hpp',
    'src/map/m1_acceptance_fixture.hpp',
    'src/map/m1_weapon_distance.hpp',
    'tools/pa-command-contract/test_pa_contract.cpp',
    'tools/pa-command-contract/Test-PaCommandContract.ps1',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
    'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  ]),
});
// Project Control 2026-09-25: M1_INVENTORY_MAINTENANCE_V1 restores the
// six-field live status, weight/slot maintenance, storage/sell and resume.
export const M1_INVENTORY_MAINTENANCE_NATIVE_AMENDMENT = Object.freeze({
  reason: 'M1_INVENTORY_MAINTENANCE_V1',
  scope: 'M1_INVENTORY_MAINTENANCE_V1',
  sourcePaths: Object.freeze([
    'src/map/persistent_agent.cpp',
    'src/map/persistent_agent_state.cpp',
    'src/map/persistent_agent_state.hpp',
    'src/map/persistent_agent_m1_supply_policy.hpp',
    'tools/pa-command-contract/test-m1-supply-policy.cpp',
    'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  ]),
});
// Live six-field acceptance found a non-shortage reason in idle rows. Correct
// only the projection under the same lease and immutable amendment chain.
export const M1_INVENTORY_PROJECTION_CORRECTION = Object.freeze({
  reason: 'M1_INVENTORY_MAINTENANCE_PROJECTION_CORRECTION_V1',
  scope: 'M1_INVENTORY_MAINTENANCE_PROJECTION_CORRECTION_V1',
  sourcePaths: Object.freeze([
    'src/map/persistent_agent.cpp',
    'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  ]),
});
// The live farm-world-teleport path requires the previously omitted Supply
// policy contract field and must count ordinary dynamic_mobs script spawns.
export const M1_FARM_WORLD_TELEPORT_SPAWN_CORRECTION = Object.freeze({
  reason: 'M1_FARM_WORLD_TELEPORT_DYNAMIC_SPAWN_ALIGNMENT_V1',
  scope: 'M1_FARM_WORLD_TELEPORT_DYNAMIC_SPAWN_ALIGNMENT_V1',
  sourcePaths: Object.freeze([
    'conf/persistent_agent_commands.json',
    'src/map/persistent_agent.cpp',
    'tools/pa-command-contract/contract-test-matrix.json',
    'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  ]),
});
export const M1_START_FARM_SUPPLY_CONTRACT_CORRECTION = Object.freeze({
  reason: 'M1_START_FARM_SUPPLY_POLICY_CONTRACT_ALIGNMENT_V1',
  scope: 'M1_START_FARM_SUPPLY_POLICY_CONTRACT_ALIGNMENT_V1',
  sourcePaths: Object.freeze([
    'conf/persistent_agent_commands.json',
    'tools/pa-command-contract/contract-test-matrix.json',
  ]),
});
// Live TEST_PLAYER acceptance exposed an ACCEPTED start_farm left behind by
// the exact AUTO_FARM_START_CONFIRM_FAILED quarantine, blocking official recovery.
export const M1_AUTO_FARM_QUARANTINE_RECOVERY_CORRECTION = Object.freeze({
  reason: 'M1_AUTO_FARM_QUARANTINE_RECOVERY_V1',
  scope: 'M1_AUTO_FARM_QUARANTINE_RECOVERY_V1',
  sourcePaths: Object.freeze([
    'src/map/persistent_agent.cpp',
    'src/map/persistent_agent_state.cpp',
    'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  ]),
});
export const M1_DORMANT_QUARANTINE_RUNTIME_CORRECTION = Object.freeze({
  reason: 'M1_DORMANT_QUARANTINE_RUNTIME_RELEASE_V1',
  scope: 'M1_DORMANT_QUARANTINE_RUNTIME_RELEASE_V1',
  sourcePaths: Object.freeze([
    'src/map/persistent_agent.cpp',
    'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  ]),
});
// Project Control V15: death preserves the farm parent, evaluates the existing
// Saved Town service policy, and returns through canonical World Travel.
export const M1_DEATH_TOWN_MAINTENANCE_AMENDMENT = Object.freeze({
  reason: 'M1_DEATH_TOWN_MAINTENANCE_V1',
  scope: 'M1_DEATH_TOWN_MAINTENANCE_V1',
  sourcePaths: Object.freeze([
    'src/map/persistent_agent.cpp',
    'src/map/persistent_agent_m1_supply_policy.hpp',
    'tools/pa-command-contract/M1DeathMaintenanceReference.md',
    'tools/pa-command-contract/Test-M1DeathMaintenanceSource.ps1',
    'tools/pa-command-contract/test-m1-supply-policy.cpp',
  ]),
});
// Live player command acceptance exposed a Fly Wing ACK without a position
// change. Only the existing Native item-effect adapter and its source guard
// may advance under the current F lease.
export const M1_PLAYER_FLY_WING_EFFECT_CORRECTION = Object.freeze({
  reason: 'M1_PLAYER_FLY_WING_EFFECT_CONFIRMATION_V1',
  scope: 'M1_PLAYER_FLY_WING_EFFECT_CONFIRMATION_V1',
  sourcePaths: Object.freeze([
    'src/map/persistent_agent.cpp',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
  ]),
});
// The live settings write exposed three Dashboard-emitted actions absent from
// the contract-generated Native poll list. Admit exactly those command rows.
export const M1_SUPPLY_COMMAND_ADMISSION_CORRECTION = Object.freeze({
  reason: 'M1_SUPPLY_COMMAND_ADMISSION_V1',
  scope: 'M1_SUPPLY_COMMAND_ADMISSION_V1',
  sourcePaths: Object.freeze([
    'conf/persistent_agent_commands.json',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
    'tools/pa-command-contract/Test-PaCommandContract.ps1',
    'tools/pa-command-contract/contract-test-matrix.json',
  ]),
});
export const M1_START_FARM_SERVICE_FIELDS_CORRECTION = Object.freeze({
  reason: 'M1_START_FARM_SERVICE_FIELDS_V1',
  scope: 'M1_START_FARM_SERVICE_FIELDS_V1',
  sourcePaths: Object.freeze([
    'conf/persistent_agent_commands.json',
    'tools/pa-command-contract/Test-M1V15ExecutorFixture.ps1',
    'tools/pa-command-contract/contract-test-matrix.json',
  ]),
});
export const APPROVED_NATIVE_AMENDMENTS = Object.freeze([
  M1_SECOND_NATIVE_AMENDMENT, M1_INVENTORY_MAINTENANCE_NATIVE_AMENDMENT,
  M1_INVENTORY_PROJECTION_CORRECTION, M1_FARM_WORLD_TELEPORT_SPAWN_CORRECTION,
  M1_START_FARM_SUPPLY_CONTRACT_CORRECTION, M1_AUTO_FARM_QUARANTINE_RECOVERY_CORRECTION,
  M1_DORMANT_QUARANTINE_RUNTIME_CORRECTION, M1_DEATH_TOWN_MAINTENANCE_AMENDMENT,
  M1_PLAYER_FLY_WING_EFFECT_CORRECTION,
  M1_SUPPLY_COMMAND_ADMISSION_CORRECTION,
  M1_START_FARM_SERVICE_FIELDS_CORRECTION,
]);
export const approvedNativeAmendment = reason =>
  APPROVED_NATIVE_AMENDMENTS.find(item => item.reason === reason) ?? null;

// A service can restart without replacing its approved binary. Preserve the
// immutable historical deploy receipt, and bind the current PID to its fresh
// ProcDump identity plus the exact deployed map binary hash.
export function deployedNativeRuntimeMatches(runtime, deployedReceipt) {
  const map = deployedReceipt?.artifacts?.find(item => item.path?.endsWith('/map-server.exe'));
  return runtime?.pass === true && runtime.openkore_runtime_count === 0 &&
    ['login', 'char', 'map'].every(name => runtime.counts?.[name] === 1) &&
    Number.isInteger(runtime.pids?.map) && runtime.pids.map > 0 &&
    runtime.procdump_receipt?.mapPid === runtime.pids.map &&
    runtime.procdump_receipt?.procdumpAttachStatus === 'ATTACHED' &&
    runtime.procdump_account === 'NT AUTHORITY\\SYSTEM' &&
    runtime.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES' &&
    !!map && equalHash(runtime.procdump_receipt.mapBinarySha256, map.sha256);
}
const SHA = /^[a-f0-9]{40}$/i;
const fail = code => { throw Error(code); };
const require = (ok, code) => { if (!ok) fail(code); };
const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();

function receipt(root, reference) {
  require(reference?.path && equalHash(digest(boundedPath(root, reference.path)), reference.sha256),
    'NATIVE_AMENDMENT_RECEIPT_CHANGED');
  return readJson(boundedPath(root, reference.path));
}

// Returns the immutable ordered chain. Missing, mutated, forked or duplicate
// history is a hard failure, including when lease and pending were only partly
// updated after an interrupted operation.
export function validateNativeAmendmentHistory(root, lease, pending) {
  const history = lease?.native_candidate_amendments;
  require(Array.isArray(history) && history.length > 0 &&
    JSON.stringify(history) === JSON.stringify(pending?.native_candidate_amendments),
  'NATIVE_AMENDMENT_HISTORY_MISMATCH');
  require(lease.lease_id === pending.lease_id && lease.owner_task_id === pending.owner_task_id &&
    lease.status === 'ACTIVE' && lease.promotion_mode === FIRST_PROMOTION,
  'NATIVE_AMENDMENT_LEASE_MISMATCH');
  let previous = HISTORICAL_NATIVE_AMENDMENT.oldSha;
  const usedShas = new Set([previous]);
  const usedAudits = new Set();
  for (const [index, entry] of history.entries()) {
    require(entry.old_native_git_sha === previous && SHA.test(entry.new_native_git_sha ?? '') &&
      !usedShas.has(entry.new_native_git_sha) && !usedAudits.has(entry.audit_receipt),
    'NATIVE_AMENDMENT_CHAIN_FORK');
    require(equalHash(digest(boundedPath(root, entry.audit_receipt)), entry.audit_sha256),
      'NATIVE_AMENDMENT_AUDIT_CHANGED');
    const audit = readJson(boundedPath(root, entry.audit_receipt));
    require(audit.lease_id === lease.lease_id && audit.lease_owner === lease.owner_task_id &&
      audit.old_native_git_sha === entry.old_native_git_sha &&
      audit.new_native_git_sha === entry.new_native_git_sha && audit.reason === entry.reason,
    'NATIVE_AMENDMENT_AUDIT_IDENTITY_MISMATCH');
    const prior = receipt(root, entry.previous_native_receipt);
    require(nativeReceiptValid(prior, { nativeSha: entry.old_native_git_sha, leaseId: lease.lease_id }) &&
      audit.old_native_receipt?.path === entry.previous_native_receipt.path &&
      equalHash(audit.old_native_receipt?.sha256, entry.previous_native_receipt.sha256),
    'NATIVE_AMENDMENT_PREDECESSOR_INVALID');
    require(audit.new_candidate_manifest?.path === entry.candidate_manifest &&
      equalHash(audit.new_candidate_manifest?.sha256, entry.candidate_manifest_sha256) &&
      equalHash(digest(entry.candidate_manifest), entry.candidate_manifest_sha256),
    'NATIVE_AMENDMENT_MANIFEST_CHANGED');
    if (index === 0) {
      require(entry.old_native_git_sha === HISTORICAL_NATIVE_AMENDMENT.oldSha &&
        entry.new_native_git_sha === HISTORICAL_NATIVE_AMENDMENT.newSha &&
        entry.reason === HISTORICAL_NATIVE_AMENDMENT.reason &&
        audit.schema_version === 'native-candidate-amendment-v1',
      'HISTORICAL_NATIVE_AMENDMENT_CHANGED');
    } else {
      const approvedEntry = approvedNativeAmendment(entry.reason);
      require(audit.schema_version === 'native-candidate-amendment-v2' &&
        !!approvedEntry && audit.approved_scope === approvedEntry.scope &&
        audit.rollback_target === entry.old_native_git_sha &&
        history.slice(1, index).every(prior => prior.reason !== entry.reason) &&
        audit.promotion_id === `${FIRST_PROMOTION}:${pending.started_at}`,
      'NATIVE_AMENDMENT_SCOPE_INVALID');
    }
    usedShas.add(entry.new_native_git_sha);
    usedAudits.add(entry.audit_receipt);
    previous = entry.new_native_git_sha;
  }
  const leaseActive = lease.active_native_candidate;
  const pendingActive = pending.active_native_candidate;
  if (leaseActive?.graceful_shutdown_live === 'PASS') {
    const live = pending?.native_graceful_shutdown_live;
    require(live?.result === 'PASS' &&
      equalHash(digest(boundedPath(root, live.receipt)), live.sha256) &&
      readJson(boundedPath(root, live.receipt)).native_git_sha === previous,
    'NATIVE_GRACEFUL_PROOF_INVALID');
  }
  const expectedPending = leaseActive?.graceful_shutdown_live === 'PASS' &&
    pending?.native_graceful_shutdown_live?.result === 'PASS'
    ? { ...leaseActive, graceful_shutdown_live: 'REQUIRED' } : leaseActive;
  require(leaseActive?.native_git_sha === previous &&
    JSON.stringify(expectedPending) === JSON.stringify(pendingActive),
  'ACTIVE_NATIVE_CANDIDATE_HISTORY_MISMATCH');
  const active = leaseActive;
  const latest = history.at(-1);
  require(active.candidate_manifest === latest.candidate_manifest &&
    equalHash(active.candidate_manifest_sha256, latest.candidate_manifest_sha256),
  'ACTIVE_NATIVE_MANIFEST_MISMATCH');
  const expectedDeployed = active.deployed === true ? previous : history.at(-1).old_native_git_sha;
  require(lease.native_deploy_git_sha === expectedDeployed && pending.native_git_sha === expectedDeployed,
    'DEPLOYED_NATIVE_CANDIDATE_HISTORY_MISMATCH');
  return history;
}

// Production-only immutable anchor. Synthetic fixtures exercise the general
// chain with independent hashes; the CLI always requires these exact bytes.
export function validateHistoricalNativeAnchor(root, lease, pending) {
  const history = validateNativeAmendmentHistory(root, lease, pending);
  const first = history[0];
  require(lease.lease_id === M1_PROMOTION_LEASE_ID &&
    lease.owner_task_id === M1_PROMOTION_OWNER &&
    first.audit_sha256 === HISTORICAL_NATIVE_AMENDMENT.auditSha256 &&
    first.previous_native_receipt.sha256 === HISTORICAL_NATIVE_AMENDMENT.predecessorReceiptSha256 &&
    first.candidate_manifest_sha256 === HISTORICAL_NATIVE_AMENDMENT.candidateManifestSha256,
  'HISTORICAL_NATIVE_ANCHOR_CHANGED');
  return history;
}

export function validateNextNativeAmendment(root, input) {
  const { lease, pending, state, owner, leaseId, previousSha, newSha, reason, scope,
    promotionId, candidateManifest, candidateManifestSha256, sourceDiff,
    githubReachable, descendant, regressionPassed, rollbackReady,
    runtimeMatchesDeployed, previousReceiptSha256 } = input;
  const history = validateNativeAmendmentHistory(root, lease, pending);
  require(lease.lease_id === leaseId && lease.owner_task_id === owner &&
    pending.lease_id === leaseId && pending.owner_task_id === owner &&
    legacyIdentity(state) && state.production_drift === 'OPEN' &&
    state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT' &&
    state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' &&
    pending.native_stage === 'NATIVE_STAGE_COMPLETE' &&
    lease.web_deploy_git_sha === pending.web_git_sha,
  'ACTIVE_NATIVE_AMENDMENT_LEASE_REQUIRED');
  require(promotionId === `${FIRST_PROMOTION}:${pending.started_at}` &&
    previousSha === lease.active_native_candidate.native_git_sha &&
    lease.active_native_candidate.deployed === true && previousSha === lease.native_deploy_git_sha &&
    previousSha === pending.native_git_sha, 'PREVIOUS_NATIVE_CANDIDATE_MISMATCH');
  require(SHA.test(newSha ?? '') && newSha !== previousSha &&
    !history.some(entry => entry.new_native_git_sha === newSha) &&
    githubReachable === true && descendant === true,
  'NEW_NATIVE_CANDIDATE_NOT_REACHABLE');
  const approved = approvedNativeAmendment(reason);
  require(!!approved && scope === approved.scope &&
    !history.some(entry => entry.reason === reason), 'NATIVE_AMENDMENT_REASON_UNAPPROVED');
  require(sourceDiff?.scope === scope && Array.isArray(sourceDiff.files) &&
    sourceDiff.files.length > 0 && new Set(sourceDiff.files).size === sourceDiff.files.length &&
    sourceDiff.files.every(file => approved.sourcePaths.includes(file)),
  'NATIVE_AMENDMENT_DIFF_OUT_OF_SCOPE');
  require(regressionPassed === true && rollbackReady === true && runtimeMatchesDeployed === true,
    'NATIVE_AMENDMENT_EVIDENCE_INCOMPLETE');
  const preceding = { path: activeNativeReceiptPath(pending), sha256: pending.native_receipt_sha256 };
  const prior = receipt(root, preceding);
  require(nativeReceiptValid(prior, { nativeSha: previousSha, leaseId,
    manifestHash: lease.native_candidate_manifest_sha256 }) &&
    equalHash(preceding.sha256, previousReceiptSha256) &&
    prior.artifacts.every(item => equalHash(digest(boundedPath(root, item.path)), item.sha256)),
  'NATIVE_AMENDMENT_ROLLBACK_TARGET_INVALID');
  require(candidateManifest?.native_git_sha === newSha &&
    candidateManifest.amendment_of?.native_git_sha === previousSha &&
    candidateManifest.amendment_of?.reason === reason &&
    equalHash(candidateManifest.amendment_of?.candidate_manifest_sha256,
      lease.native_candidate_manifest_sha256) &&
    candidateManifest.rollback_reference?.intermediate_rollback?.native_git_sha === previousSha &&
    /^[a-f0-9]{64}$/i.test(candidateManifestSha256 ?? ''),
  'NATIVE_AMENDMENT_MANIFEST_INVALID');
  return { history, preceding, prior };
}

function atomic(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temporary, file);
}

export function applyNextNativeAmendment(root, plan, now = new Date()) {
  const { input, candidateManifestPath, currentHashes } = plan;
  const dir = boundedPath(root, '.local/ro-stack');
  const leaseFile = path.join(dir, 'production-deployment-lease/lease.json');
  const pendingFile = path.join(dir, 'first-github-first-promotion.pending.json');
  const stateFile = path.join(dir, 'production-deployment-state.json');
  require(equalHash(digest(leaseFile), currentHashes.lease) &&
    equalHash(digest(pendingFile), currentHashes.pending) &&
    equalHash(digest(stateFile), currentHashes.state) &&
    equalHash(digest(candidateManifestPath), input.candidateManifestSha256),
  'NATIVE_AMENDMENT_INPUT_CHANGED');
  const { history, preceding } = validateNextNativeAmendment(root, input);
  const relative = `.local/ro-stack/native-candidate-amendment-${input.leaseId}-${input.newSha.slice(0, 12)}.json`;
  const auditFile = boundedPath(root, relative);
  require(!fs.existsSync(auditFile), 'NATIVE_AMENDMENT_PARALLEL_OR_REPLAY');
  const audit = { schema_version: 'native-candidate-amendment-v2', lease_id: input.leaseId,
    lease_owner: input.owner, promotion_id: input.promotionId,
    old_native_git_sha: input.previousSha, new_native_git_sha: input.newSha,
    reason: input.reason, approved_scope: input.scope, source_diff: input.sourceDiff,
    tests: input.tests, rollback_target: input.previousSha,
    old_native_receipt: preceding, new_candidate_manifest: {
      path: candidateManifestPath, sha256: input.candidateManifestSha256 },
    amendment_timestamp: now.toISOString() };
  fs.writeFileSync(auditFile, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
  const entry = { old_native_git_sha: input.previousSha,
    old_disposition: 'INTERMEDIATE_NATIVE_CANDIDATE',
    new_native_git_sha: input.newSha, new_disposition: 'ACTIVE_NATIVE_CANDIDATE',
    reason: input.reason, audit_receipt: relative, audit_sha256: hash(fs.readFileSync(auditFile)),
    previous_native_receipt: preceding, candidate_manifest: candidateManifestPath,
    candidate_manifest_sha256: input.candidateManifestSha256 };
  const active = { native_git_sha: input.newSha, candidate_manifest: candidateManifestPath,
    candidate_manifest_sha256: input.candidateManifestSha256,
    binary_sha256: input.candidateManifest.binary_sha256,
    deployed: false, graceful_shutdown_live: 'REQUIRED' };
  const nextHistory = [...history, entry];
  atomic(pendingFile, { ...input.pending, native_candidate_amendments: nextHistory,
    active_native_candidate: active, native_graceful_shutdown_live: null });
  atomic(leaseFile, { ...input.lease, native_candidate_amendments: nextHistory,
    active_native_candidate: active });
  return { amended: true, old_native_git_sha: input.previousSha,
    new_native_git_sha: input.newSha, audit_receipt: relative,
    audit_sha256: entry.audit_sha256, chain_length: nextHistory.length,
    deployed_native_still: input.previousSha };
}
