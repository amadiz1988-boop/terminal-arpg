#!/usr/bin/env node
// One approved Native runtime contract artifact, bound to the existing M1
// candidate and owner lease. This is intentionally not an arbitrary-file deployer.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { boundedPath, digest, legacyIdentity } from './legacy-production-baseline.mjs';
import { activeNativeReceiptPath, equalHash, nativeReceiptValid, git, NATIVE_REPOSITORY } from './native-promotion-contract.mjs';
import { validateHistoricalNativeAnchor, M1_PROMOTION_LEASE_ID, M1_PROMOTION_OWNER } from './native-amendment-chain.mjs';

export const CONTRACT_ARTIFACT = Object.freeze({
  id: 'persistent-agent-command-contract', type: 'RUNTIME_CONTRACT',
  sourcePath: 'conf/persistent_agent_commands.json',
  destinationPath: '.local/ro-stack/rathena/conf/persistent_agent_commands.json',
  requiredBy: 'map-server.exe', rollbackModel: 'RESTORE_EXACT_PREIMAGE',
  nativeSha: '18523076a6034ca3731aefb73bf41993f4a0ef06',
  webSha: '5a31570a861e1665841e62245c7caa105a796b3a',
  oldHash: '9CD430EA279CD93817A0C1501BE7AA3314966C9BF3C204F356B9F8ADC7673FC0',
  newHash: '3AF34756EB4DC067167261BD3C25EF8D3AB1FA41C7AAC11E3F567DF5C0D46306',
  action: 'prepare_m1_acceptance_fixture',
  optionalFields: Object.freeze(['attackDistance', 'attackMaxDistance', 'selfRecoverySkillSlots']),
});
const fail = code => { throw Error(code); };
const need = (ok, code) => { if (!ok) fail(code); };
const norm = bytes => bytes.toString('utf8').replaceAll('\r\n', '\n');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const pin = (root, relative) => boundedPath(root, relative);
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const atom = (file, value) => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temporary, file);
};

// Compare the entire existing registry. Only three optional start_farm keys and
// the single approved action may differ. No schema/version or hidden row drift.
export function inspectContractDelta(oldDoc, nextDoc) {
  need(oldDoc?.contractKind === 'persistent_agent_command_contract' && oldDoc.contractVersion === 1 &&
    nextDoc?.contractKind === oldDoc.contractKind && nextDoc.contractVersion === oldDoc.contractVersion &&
    Array.isArray(oldDoc.commands) && oldDoc.commands.length === 46 &&
    Array.isArray(nextDoc.commands) && nextDoc.commands.length === 47,
  'CONTRACT_VERSION_OR_ACTION_COUNT_INVALID');
  const { commands: oldActions, ...oldRoot } = oldDoc;
  const { commands: nextActions, ...nextRoot } = nextDoc;
  need(same(oldRoot, nextRoot), 'CONTRACT_ROOT_CHANGED');
  const before = new Map(oldActions.map(row => [row.action, row]));
  const after = new Map(nextActions.map(row => [row.action, row]));
  need(before.size === 46 && after.size === 47, 'CONTRACT_DUPLICATE_ACTION');
  need([...before.keys()].every(key => after.has(key)) &&
    [...after.keys()].filter(key => !before.has(key)).join(',') === CONTRACT_ARTIFACT.action,
  'CONTRACT_ACTION_SET_CHANGED');
  for (const [key, row] of before) {
    if (key !== 'start_farm') need(same(row, after.get(key)), 'EXISTING_ACTION_CHANGED:' + key);
  }
  const oldFarm = before.get('start_farm'), nextFarm = after.get('start_farm');
  const oldOptional = oldFarm?.payload?.optional, nextOptional = nextFarm?.payload?.optional;
  need(oldOptional && nextOptional && CONTRACT_ARTIFACT.optionalFields.every(key =>
    !Object.hasOwn(oldOptional, key) && Object.hasOwn(nextOptional, key)),
  'START_FARM_OPTIONAL_FIELDS_INVALID');
  const expectedOptional = { ...oldOptional };
  for (const key of CONTRACT_ARTIFACT.optionalFields) expectedOptional[key] = nextOptional[key];
  need(same(expectedOptional, nextOptional), 'START_FARM_OTHER_OPTIONAL_CHANGED');
  const { payload: oldPayload, ...oldFarmRoot } = oldFarm;
  const { payload: nextPayload, ...nextFarmRoot } = nextFarm;
  const { optional: ignoredOld, ...oldPayloadRoot } = oldPayload;
  const { optional: ignoredNext, ...nextPayloadRoot } = nextPayload;
  need(same(oldFarmRoot, nextFarmRoot) && same(oldPayloadRoot, nextPayloadRoot) &&
    nextOptional.attackDistance === 'integer' && nextOptional.attackMaxDistance === 'integer' &&
    nextOptional.selfRecoverySkillSlots?.type === 'array' &&
    nextOptional.selfRecoverySkillSlots?.minItems === 1 && nextOptional.selfRecoverySkillSlots?.maxItems === 8,
  'START_FARM_EXISTING_SCHEMA_CHANGED');
  const fixture = after.get(CONTRACT_ARTIFACT.action);
  need(fixture?.category === 'admin_test' && fixture.dispatcher === 'process_prepare_m1_acceptance_fixture' &&
    fixture.enqueueAdmitted === true && fixture.strictUnknownFields === true &&
    same(fixture.payload?.required, { adminSessionId: 'string', targetCharId: 'unsigned_integer', profile: 'string' }) &&
    same(fixture.payload?.optional, {}) &&
    fixture.ownerPrecondition === 'local Admin session, TEST_PLAYER char 150105, is_test=1, SERVER_AGENT owner' &&
    fixture.statePrecondition?.includes('fixed M1_FLY_SUPPLY_V1 prerequisite profile only'),
  'FIXTURE_CONTRACT_SECURITY_CHANGED');
  return { addedActions: [CONTRACT_ARTIFACT.action], changedExistingActions: ['start_farm'],
    approvedOptionalFields: [...CONTRACT_ARTIFACT.optionalFields], removedActions: [], otherChangedActions: [] };
}

export function validateArtifactManifest(m) {
  need(m?.schema_version === 'native-runtime-contract-artifact-v1' &&
    m.native_git_sha === CONTRACT_ARTIFACT.nativeSha && m.web_git_sha === CONTRACT_ARTIFACT.webSha &&
    m.lease_id === M1_PROMOTION_LEASE_ID && m.owner_task_id === M1_PROMOTION_OWNER &&
    Array.isArray(m.artifacts) && m.artifacts.length === 1,
  'NATIVE_CONTRACT_MANIFEST_IDENTITY_INVALID');
  const a = m.artifacts[0];
  need(a.artifact_id === CONTRACT_ARTIFACT.id && a.artifact_type === CONTRACT_ARTIFACT.type &&
    a.source_path === CONTRACT_ARTIFACT.sourcePath && a.destination_path === CONTRACT_ARTIFACT.destinationPath &&
    a.required_by === CONTRACT_ARTIFACT.requiredBy && a.rollback_model === CONTRACT_ARTIFACT.rollbackModel &&
    equalHash(a.sha256, CONTRACT_ARTIFACT.newHash) && equalHash(a.preimage_sha256, CONTRACT_ARTIFACT.oldHash),
  'NATIVE_CONTRACT_ARTIFACT_NOT_ALLOWLISTED');
  need(/^[a-f0-9]{64}$/i.test(m.native_candidate_manifest_sha256 ?? '') &&
    /^[a-f0-9]{64}$/i.test(m.native_receipt_sha256 ?? '') &&
    m.source_materialization === 'TRACKED_CLEAN_NATIVE_WORKTREE_WITH_GIT_BLOB_EQUIVALENCE',
  'NATIVE_CONTRACT_PROVENANCE_INVALID');
  return true;
}

function sourceBytes(nativeRoot, githubRoot) {
  need(git(githubRoot, 'remote', 'get-url', 'origin') === NATIVE_REPOSITORY &&
    git(githubRoot, 'rev-parse', 'HEAD') === CONTRACT_ARTIFACT.nativeSha &&
    git(githubRoot, 'status', '--porcelain=v1', '--', CONTRACT_ARTIFACT.sourcePath) === '',
    'NATIVE_GITHUB_REMOTE_INVALID');
  git(githubRoot, 'cat-file', '-e', `${CONTRACT_ARTIFACT.nativeSha}^{commit}`);
  const file = pin(nativeRoot, CONTRACT_ARTIFACT.sourcePath);
  need(equalHash(digest(file), CONTRACT_ARTIFACT.newHash) &&
    git(nativeRoot, 'status', '--porcelain=v1', '--', CONTRACT_ARTIFACT.sourcePath) === '',
  'NATIVE_CONTRACT_SOURCE_CHANGED');
  const blob = spawnSync('git', ['show', `${CONTRACT_ARTIFACT.nativeSha}:${CONTRACT_ARTIFACT.sourcePath}`],
    { cwd: githubRoot, windowsHide: true, encoding: 'buffer', timeout: 30000 });
  need(blob.status === 0 &&
    git(nativeRoot, 'rev-parse', `${CONTRACT_ARTIFACT.nativeSha}:${CONTRACT_ARTIFACT.sourcePath}`) ===
      git(githubRoot, 'rev-parse', `${CONTRACT_ARTIFACT.nativeSha}:${CONTRACT_ARTIFACT.sourcePath}`) &&
    norm(fs.readFileSync(file)) === norm(blob.stdout),
    'NATIVE_CONTRACT_GIT_BLOB_MISMATCH');
  return fs.readFileSync(file);
}

function inputs(prodRoot, nativeRoot, githubRoot, manifestFile) {
  const local = pin(prodRoot, '.local/ro-stack');
  const leaseFile = path.join(local, 'production-deployment-lease/lease.json');
  const pendingFile = path.join(local, 'first-github-first-promotion.pending.json');
  const stateFile = path.join(local, 'production-deployment-state.json');
  const lease = json(leaseFile), pending = json(pendingFile), state = json(stateFile);
  validateHistoricalNativeAnchor(prodRoot, lease, pending);
  need(lease.lease_id === M1_PROMOTION_LEASE_ID && lease.owner_task_id === M1_PROMOTION_OWNER &&
    lease.status === 'ACTIVE' && pending.lease_id === lease.lease_id &&
    pending.owner_task_id === lease.owner_task_id &&
    lease.native_deploy_git_sha === CONTRACT_ARTIFACT.nativeSha &&
    pending.native_git_sha === CONTRACT_ARTIFACT.nativeSha &&
    lease.web_deploy_git_sha === CONTRACT_ARTIFACT.webSha &&
    pending.web_git_sha === CONTRACT_ARTIFACT.webSha &&
    lease.active_native_candidate?.deployed === true && legacyIdentity(state) &&
    state.production_drift === 'OPEN' && state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE',
  'NATIVE_CONTRACT_ACTIVE_LEASE_INVALID');
  const candidateFile = lease.active_native_candidate.candidate_manifest;
  need(equalHash(digest(candidateFile), lease.active_native_candidate.candidate_manifest_sha256),
    'NATIVE_CANDIDATE_MANIFEST_CHANGED');
  const nativeReceiptFile = pin(prodRoot, activeNativeReceiptPath(pending));
  need(equalHash(digest(nativeReceiptFile), pending.native_receipt_sha256) &&
    nativeReceiptValid(json(nativeReceiptFile), { nativeSha: CONTRACT_ARTIFACT.nativeSha,
      leaseId: lease.lease_id, manifestHash: lease.native_candidate_manifest_sha256 }),
  'NATIVE_CANDIDATE_RECEIPT_CHANGED');
  const manifest = json(manifestFile);
  validateArtifactManifest(manifest);
  need(equalHash(manifest.native_candidate_manifest_sha256, lease.active_native_candidate.candidate_manifest_sha256) &&
    equalHash(manifest.native_receipt_sha256, pending.native_receipt_sha256),
  'NATIVE_CONTRACT_AMENDMENT_HISTORY_CHANGED');
  const bytes = sourceBytes(nativeRoot, githubRoot);
  const target = pin(prodRoot, CONTRACT_ARTIFACT.destinationPath);
  need(equalHash(digest(target), CONTRACT_ARTIFACT.oldHash), 'NATIVE_CONTRACT_PREIMAGE_CHANGED');
  const delta = inspectContractDelta(json(target), JSON.parse(bytes.toString('utf8')));
  return { local, leaseFile, pendingFile, stateFile, lease, pending, state, manifest,
    manifestFile, bytes, target, delta, hashes: { lease: digest(leaseFile), pending: digest(pendingFile), state: digest(stateFile) } };
}

export function prepareContractArtifact({ prodRoot, nativeRoot, githubRoot, buildRoot }) {
  const bytes = sourceBytes(nativeRoot, githubRoot);
  const target = pin(prodRoot, CONTRACT_ARTIFACT.destinationPath);
  need(equalHash(digest(target), CONTRACT_ARTIFACT.oldHash), 'NATIVE_CONTRACT_PREIMAGE_CHANGED');
  const delta = inspectContractDelta(json(target), JSON.parse(bytes.toString('utf8')));
  const lease = json(pin(prodRoot, '.local/ro-stack/production-deployment-lease/lease.json'));
  const pending = json(pin(prodRoot, '.local/ro-stack/first-github-first-promotion.pending.json'));
  validateHistoricalNativeAnchor(prodRoot, lease, pending);
  need(lease.active_native_candidate?.deployed === true &&
    lease.native_deploy_git_sha === CONTRACT_ARTIFACT.nativeSha &&
    lease.web_deploy_git_sha === CONTRACT_ARTIFACT.webSha,
  'NATIVE_CONTRACT_ACTIVE_CANDIDATE_INVALID');
  const manifest = { schema_version: 'native-runtime-contract-artifact-v1',
    native_git_sha: CONTRACT_ARTIFACT.nativeSha, web_git_sha: CONTRACT_ARTIFACT.webSha,
    lease_id: lease.lease_id, owner_task_id: lease.owner_task_id,
    native_candidate_manifest_sha256: lease.active_native_candidate.candidate_manifest_sha256,
    native_receipt_sha256: pending.native_receipt_sha256,
    source_materialization: 'TRACKED_CLEAN_NATIVE_WORKTREE_WITH_GIT_BLOB_EQUIVALENCE',
    semantic_delta: delta, artifacts: [{ artifact_id: CONTRACT_ARTIFACT.id,
      artifact_type: CONTRACT_ARTIFACT.type, source_path: CONTRACT_ARTIFACT.sourcePath,
      destination_path: CONTRACT_ARTIFACT.destinationPath, sha256: CONTRACT_ARTIFACT.newHash,
      preimage_sha256: CONTRACT_ARTIFACT.oldHash, required_by: CONTRACT_ARTIFACT.requiredBy,
      rollback_model: CONTRACT_ARTIFACT.rollbackModel }] };
  validateArtifactManifest(manifest);
  const file = path.join(buildRoot, `native-runtime-contract-${CONTRACT_ARTIFACT.nativeSha.slice(0, 12)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return { manifest: file, sha256: digest(file), delta };
}

export function preflightContractArtifact({ prodRoot, nativeRoot, githubRoot, manifestFile }) {
  const p = inputs(prodRoot, nativeRoot, githubRoot, manifestFile);
  need(!p.lease.native_runtime_contract_artifact && !p.pending.native_runtime_contract_artifact,
    'NATIVE_CONTRACT_ARTIFACT_ALREADY_ADOPTED');
  const lock = path.join(p.local, 'native-runtime-contract-artifact.lock');
  need(!fs.existsSync(lock), 'NATIVE_CONTRACT_ARTIFACT_DEPLOY_BUSY');
  return { result: 'PASS', lease_id: p.lease.lease_id, native_git_sha: CONTRACT_ARTIFACT.nativeSha,
    preimage_sha256: CONTRACT_ARTIFACT.oldHash, image_sha256: CONTRACT_ARTIFACT.newHash,
    semantic_delta: p.delta, rollback_model: CONTRACT_ARTIFACT.rollbackModel };
}

export function restoreContractPreimage({ target, backup, oldHash }) {
  need(equalHash(digest(backup), oldHash), 'NATIVE_CONTRACT_ROLLBACK_PREIMAGE_INVALID');
  const restore = target + '.restore-' + randomUUID();
  fs.copyFileSync(backup, restore, fs.constants.COPYFILE_EXCL);
  if (fs.existsSync(target)) fs.unlinkSync(target);
  fs.renameSync(restore, target);
  need(equalHash(digest(target), oldHash), 'NATIVE_CONTRACT_ROLLBACK_HASH_INVALID');
}

export function replaceContractImage({ target, staged, displaced, backup, oldHash, newHash, afterReplace }) {
  need(equalHash(digest(target), oldHash) && equalHash(digest(backup), oldHash) &&
    equalHash(digest(staged), newHash), 'NATIVE_CONTRACT_REPLACE_PRECONDITION_INVALID');
  fs.renameSync(target, displaced);
  try {
    fs.renameSync(staged, target);
    need(equalHash(digest(target), newHash) && equalHash(digest(displaced), oldHash),
      'NATIVE_CONTRACT_POSTDEPLOY_HASH_INVALID');
    afterReplace?.();
  } catch (error) {
    restoreContractPreimage({ target, backup, oldHash });
    throw error;
  }
}

export function deployContractArtifact({ prodRoot, nativeRoot, githubRoot, manifestFile }) {
  const p = inputs(prodRoot, nativeRoot, githubRoot, manifestFile);
  preflightContractArtifact({ prodRoot, nativeRoot, githubRoot, manifestFile });
  const lock = path.join(p.local, 'native-runtime-contract-artifact.lock');
  const archive = path.join(p.local, `native-runtime-contract-artifact-${p.lease.lease_id}-${CONTRACT_ARTIFACT.nativeSha.slice(0, 12)}`);
  need(!fs.existsSync(archive), 'NATIVE_CONTRACT_ARTIFACT_REPLAY');
  fs.mkdirSync(lock);
  const beforeLease = fs.readFileSync(p.leaseFile), beforePending = fs.readFileSync(p.pendingFile);
  const backup = path.join(lock, 'preimage.json'), staged = path.join(lock, 'candidate.json');
  const archivedManifest = path.join(lock, 'manifest.json');
  const journal = path.join(lock, 'operation.json');
  fs.writeFileSync(journal, JSON.stringify({ schema_version: 'native-runtime-contract-operation-v1',
    lease_id: p.lease.lease_id, owner_task_id: p.lease.owner_task_id,
    manifest_sha256: digest(manifestFile), preimage_sha256: CONTRACT_ARTIFACT.oldHash,
    image_sha256: CONTRACT_ARTIFACT.newHash, phase: 'STAGE' }, null, 2) + '\n', { flag: 'wx' });
  let replaced = false;
  try {
    fs.copyFileSync(p.target, backup, fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(backup), CONTRACT_ARTIFACT.oldHash), 'NATIVE_CONTRACT_ROLLBACK_PREIMAGE_INVALID');
    fs.copyFileSync(manifestFile, archivedManifest, fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(archivedManifest), digest(manifestFile)), 'NATIVE_CONTRACT_MANIFEST_COPY_INVALID');
    fs.writeFileSync(staged, p.bytes, { flag: 'wx' });
    need(equalHash(digest(staged), CONTRACT_ARTIFACT.newHash), 'NATIVE_CONTRACT_STAGED_HASH_INVALID');
    need(equalHash(digest(p.target), CONTRACT_ARTIFACT.oldHash) &&
      equalHash(digest(p.leaseFile), p.hashes.lease) &&
      equalHash(digest(p.pendingFile), p.hashes.pending) &&
      equalHash(digest(p.stateFile), p.hashes.state),
    'NATIVE_CONTRACT_PREDEPLOY_CHANGED');
    const displaced = path.join(lock, 'displaced.json');
    replaceContractImage({ target: p.target, staged, displaced, backup,
      oldHash: CONTRACT_ARTIFACT.oldHash, newHash: CONTRACT_ARTIFACT.newHash });
    replaced = true;
    const receiptRelative = `.local/ro-stack/native-runtime-contract-artifact-${p.lease.lease_id}-${CONTRACT_ARTIFACT.nativeSha.slice(0, 12)}/receipt.json`;
    const receipt = { schema_version: 'native-runtime-contract-deploy-v1',
      lease_id: p.lease.lease_id, owner_task_id: p.lease.owner_task_id,
      native_git_sha: CONTRACT_ARTIFACT.nativeSha, web_git_sha: CONTRACT_ARTIFACT.webSha,
      native_candidate_manifest_sha256: p.manifest.native_candidate_manifest_sha256,
      native_receipt_sha256: p.manifest.native_receipt_sha256,
      artifact_manifest_sha256: digest(manifestFile), artifact: p.manifest.artifacts[0],
      semantic_delta: p.delta, rollback_preimage: { path: `${path.dirname(receiptRelative)}/preimage.json`,
        sha256: CONTRACT_ARTIFACT.oldHash }, runtime_load: 'PENDING_RESTART',
      previous_native_amendment_count: p.lease.native_candidate_amendments.length,
      deployed_at: new Date().toISOString() };
    fs.writeFileSync(path.join(lock, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    const ref = { receipt: receiptRelative, sha256: digest(path.join(lock, 'receipt.json')),
      artifact_manifest: `${path.dirname(receiptRelative)}/manifest.json`,
      artifact_manifest_sha256: digest(archivedManifest) };
    atom(p.pendingFile, { ...p.pending, native_runtime_contract_artifact: ref });
    atom(p.leaseFile, { ...p.lease, native_runtime_contract_artifact: ref });
    fs.renameSync(lock, archive);
    return { result: 'DEPLOYED_PENDING_RUNTIME_LOAD', receipt: receiptRelative,
      receipt_sha256: ref.sha256, image_sha256: digest(p.target), rollback_preimage_sha256: digest(path.join(archive, 'preimage.json')) };
  } catch (error) {
    if (replaced && fs.existsSync(backup)) {
      restoreContractPreimage({ target: p.target, backup, oldHash: CONTRACT_ARTIFACT.oldHash });
    }
    if (!equalHash(digest(p.leaseFile), p.hashes.lease)) fs.writeFileSync(p.leaseFile, beforeLease);
    if (!equalHash(digest(p.pendingFile), p.hashes.pending)) fs.writeFileSync(p.pendingFile, beforePending);
    fs.writeFileSync(path.join(lock, 'failure.json'), JSON.stringify({ error: error.message,
      rollback_preimage_restored: equalHash(digest(p.target), CONTRACT_ARTIFACT.oldHash) }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  }
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    need(argv[i]?.startsWith('--') && argv[i + 1], 'ARGUMENTS_INVALID');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = args(process.argv.slice(2));
    need(['prepare', 'dry-run', 'deploy'].includes(a.action), 'ACTION_INVALID');
    need(a.prod && a.native && a.github && a.build, 'ROOTS_REQUIRED');
    const input = { prodRoot: path.resolve(a.prod), nativeRoot: path.resolve(a.native),
      githubRoot: path.resolve(a.github), buildRoot: path.resolve(a.build),
      manifestFile: a.manifest && path.resolve(a.manifest) };
    if (a.action === 'deploy') need(a.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
    const result = a.action === 'prepare' ? prepareContractArtifact(input) :
      a.action === 'dry-run' ? preflightContractArtifact(input) : deployContractArtifact(input);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) { process.stderr.write(JSON.stringify({ result: 'BLOCKED', error: error.message }) + '\n'); process.exitCode = 2; }
}
