import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CONTRACT_ARTIFACT as policy, inspectContractDelta, validateArtifactManifest,
  replaceContractImage, restoreContractPreimage } from '../native-runtime-contract-artifact.mjs';

let passed = 0;
function test(name, run) { run(); console.log(`PASS ${++passed} ${name}`); }
function reject(name, run, code) { test(name, () => assert.throws(run, new RegExp(code))); }
const copy = value => structuredClone(value);

function contracts() {
  const commands = Array.from({ length: 45 }, (_, index) => ({ action: `legacy_${index}`, category: 'player',
    payload: { required: {}, optional: {} } }));
  commands.push({ action: 'start_farm', category: 'player', payload: { required: { targetMap: 'string' },
    optional: { skillEnabled: 'boolean', supplyNpcName: 'string' } } });
  const oldDoc = { contractKind: 'persistent_agent_command_contract', contractVersion: 1, commands };
  const nextDoc = copy(oldDoc);
  const optional = nextDoc.commands.at(-1).payload.optional;
  optional.attackDistance = 'integer';
  optional.attackMaxDistance = 'integer';
  optional.selfRecoverySkillSlots = { type: 'array', minItems: 1, maxItems: 8,
    items: { required: { skillId: 'integer' }, optional: {} } };
  nextDoc.commands.push({ action: policy.action, category: 'admin_test',
    dispatcher: 'process_prepare_m1_acceptance_fixture', enqueueAdmitted: true, strictUnknownFields: true,
    payload: { required: { adminSessionId: 'string', targetCharId: 'unsigned_integer', profile: 'string' }, optional: {} },
    ownerPrecondition: 'local Admin session, TEST_PLAYER char 150105, is_test=1, SERVER_AGENT owner',
    statePrecondition: 'resident fd=0 PERSISTENT_IDLE without active task; fixed M1_FLY_SUPPLY_V1 prerequisite profile only' });
  return { oldDoc, nextDoc };
}

function manifest() {
  return { schema_version: 'native-runtime-contract-artifact-v1', native_git_sha: policy.nativeSha,
    web_git_sha: policy.webSha, lease_id: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a',
    owner_task_id: 'F｜M1 最終整合', native_candidate_manifest_sha256: 'A'.repeat(64),
    native_receipt_sha256: 'B'.repeat(64),
    source_materialization: 'TRACKED_CLEAN_NATIVE_WORKTREE_WITH_GIT_BLOB_EQUIVALENCE',
    artifacts: [{ artifact_id: policy.id, artifact_type: policy.type, source_path: policy.sourcePath,
      destination_path: policy.destinationPath, sha256: policy.newHash,
      preimage_sha256: policy.oldHash, required_by: policy.requiredBy, rollback_model: policy.rollbackModel }] };
}

test('only approved semantic delta passes', () => {
  const { oldDoc, nextDoc } = contracts();
  assert.deepEqual(inspectContractDelta(oldDoc, nextDoc).changedExistingActions, ['start_farm']);
});
test('object key insertion order does not change semantics', () => {
  const { oldDoc, nextDoc } = contracts();
  nextDoc.commands.at(-2).payload.optional = Object.fromEntries(
    Object.entries(nextDoc.commands.at(-2).payload.optional).reverse());
  assert.equal(inspectContractDelta(oldDoc, nextDoc).addedActions[0], policy.action);
});
reject('existing command drift blocked', () => {
  const { oldDoc, nextDoc } = contracts(); nextDoc.commands[0].category = 'admin';
  inspectContractDelta(oldDoc, nextDoc);
}, 'EXISTING_ACTION_CHANGED');
reject('existing farm field drift blocked', () => {
  const { oldDoc, nextDoc } = contracts(); nextDoc.commands.at(-2).payload.optional.skillEnabled = 'string';
  inspectContractDelta(oldDoc, nextDoc);
}, 'START_FARM_OTHER_OPTIONAL_CHANGED');
reject('fixture auth weakening blocked', () => {
  const { oldDoc, nextDoc } = contracts(); nextDoc.commands.at(-1).strictUnknownFields = false;
  inspectContractDelta(oldDoc, nextDoc);
}, 'FIXTURE_CONTRACT_SECURITY_CHANGED');
reject('extra action blocked', () => {
  const { oldDoc, nextDoc } = contracts(); nextDoc.commands.push({ action: 'hidden' });
  inspectContractDelta(oldDoc, nextDoc);
}, 'CONTRACT_VERSION_OR_ACTION_COUNT_INVALID');
test('one exact artifact manifest passes', () => assert.equal(validateArtifactManifest(manifest()), true));
reject('arbitrary destination blocked', () => {
  const m = manifest(); m.artifacts[0].destination_path = 'unrelated.json'; validateArtifactManifest(m);
}, 'NATIVE_CONTRACT_ARTIFACT_NOT_ALLOWLISTED');
reject('preimage mismatch blocked', () => {
  const m = manifest(); m.artifacts[0].preimage_sha256 = 'C'.repeat(64); validateArtifactManifest(m);
}, 'NATIVE_CONTRACT_ARTIFACT_NOT_ALLOWLISTED');
reject('wrong candidate blocked', () => {
  const m = manifest(); m.native_git_sha = 'C'.repeat(40); validateArtifactManifest(m);
}, 'NATIVE_CONTRACT_MANIFEST_IDENTITY_INVALID');
reject('wrong lease blocked', () => {
  const m = manifest(); m.lease_id = 'other'; validateArtifactManifest(m);
}, 'NATIVE_CONTRACT_MANIFEST_IDENTITY_INVALID');
reject('multi-file deploy blocked', () => {
  const m = manifest(); m.artifacts.push(copy(m.artifacts[0])); validateArtifactManifest(m);
}, 'NATIVE_CONTRACT_MANIFEST_IDENTITY_INVALID');
function imageFixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm1-contract-image-'));
  const target = path.join(dir, 'target.json'), staged = path.join(dir, 'staged.json');
  const backup = path.join(dir, 'backup.json'), displaced = path.join(dir, 'displaced.json');
  const old = Buffer.from('{"actions":46}\n'), next = Buffer.from('{"actions":47}\n');
  const digest = value => createHash('sha256').update(value).digest('hex');
  fs.writeFileSync(target, old); fs.writeFileSync(backup, old); fs.writeFileSync(staged, next);
  try { run({ target, staged, backup, displaced, oldHash: digest(old), newHash: digest(next), old, next }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('exact image replacement and preimage restore', () => imageFixture(x => {
  replaceContractImage(x);
  assert.deepEqual(fs.readFileSync(x.target), x.next);
  restoreContractPreimage(x);
  assert.deepEqual(fs.readFileSync(x.target), x.old);
}));
test('failure after replacement restores exact preimage', () => imageFixture(x => {
  assert.throws(() => replaceContractImage({ ...x, afterReplace: () => { throw Error('INJECTED_FAILURE'); } }),
    /INJECTED_FAILURE/);
  assert.deepEqual(fs.readFileSync(x.target), x.old);
}));
test('changed staged image leaves target untouched', () => imageFixture(x => {
  fs.writeFileSync(x.staged, 'corrupt');
  assert.throws(() => replaceContractImage(x), /NATIVE_CONTRACT_REPLACE_PRECONDITION_INVALID/);
  assert.deepEqual(fs.readFileSync(x.target), x.old);
}));
console.log(`NATIVE_RUNTIME_CONTRACT_ARTIFACT_TESTS=${passed}`);
