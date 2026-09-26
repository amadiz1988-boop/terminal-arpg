import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { inspectSavedTownDelta, validateCommandContractManifest,
  COMMAND_CONTRACT_AMENDMENT as policy } from '../native-command-contract-amendment.mjs';
import { digest } from '../legacy-production-baseline.mjs';
import { verifyCommandContractAmendment } from '../native-promotion-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = 'C:/Users/Administrator/source/ghost-island-rathena';
const newFile = path.join(nativeRoot, policy.sourcePath);
const next = JSON.parse(fs.readFileSync(newFile)), old = structuredClone(next);
const oldSaved = old.commands.find(x => x.action === 'set_saved_town');
oldSaved.payload.optional = {};
oldSaved.statePrecondition = 'resident fd=0, alive, PERSISTENT_IDLE; physically on selected rAthena town map';
let count = 0;
const test = (name, run) => { run(); console.log(`PASS ${++count} ${name}`); };
const reject = (name, run, code) => test(name, () => assert.throws(run, new RegExp(code)));
const copy = value => structuredClone(value);

test('exact canonical source hash', () => {
  assert.equal(digest(newFile), policy.imageSha256);
});
test('only set_saved_town delta', () => {
  assert.deepEqual(inspectSavedTownDelta(old, next).changed_actions, ['set_saved_town']);
});
const handler = fs.readFileSync(path.join(nativeRoot, 'src/map/persistent_agent.cpp'), 'utf8');
test('partial coordinates reach handler and fail closed', () => {
  const section = handler.slice(handler.indexOf('void process_set_saved_town('),
    handler.indexOf('struct M1TownServices'));
  assert.match(section, /payload\.contains\("saveX"\) \|\| payload\.contains\("saveY"\)/);
  assert.match(section, /payload\.at\("saveX"\)/);
  assert.match(section, /payload\.at\("saveY"\)/);
  assert.match(section, /reject_payload_semantic\(command/);
});
test('non-authored Kafra coordinates remain Native rejected', () => {
  const section = handler.slice(handler.indexOf('void process_set_saved_town('),
    handler.indexOf('struct M1TownServices'));
  assert.match(section, /player_kafra_save_authored\(current_map, requested_x, requested_y\)/);
  assert.match(section, /SAVED_TOWN_DESTINATION_INVALID/);
});
reject('unrelated command delta rejected', () => {
  const changed = copy(next); changed.commands.find(x => x.action === 'start_farm').category = 'unexpected';
  inspectSavedTownDelta(old, changed);
}, 'CONTRACT_UNRELATED_ACTION_CHANGED');
reject('save coordinate type drift rejected', () => {
  const changed = copy(next); changed.commands.find(x => x.action === 'set_saved_town').payload.optional.saveX = 'string';
  inspectSavedTownDelta(old, changed);
}, 'SAVED_TOWN_DELTA_INVALID');
reject('unknown optional field rejected', () => {
  const changed = copy(next); changed.commands.find(x => x.action === 'set_saved_town').payload.optional.force = 'boolean';
  inspectSavedTownDelta(old, changed);
}, 'SAVED_TOWN_DELTA_INVALID');
reject('authority precondition drift rejected', () => {
  const changed = copy(next); changed.commands.find(x => x.action === 'set_saved_town').ownerPrecondition = 'none';
  inspectSavedTownDelta(old, changed);
}, 'SAVED_TOWN_DELTA_INVALID');

const h = x => x.repeat(64);
const executables = ['login','char','map'].map(n => ({path:`${n}-server.exe`,sha256:h('A'),
  production_path:`.local/ro-stack/rathena/${n}-server.exe`}));
const manifest = {schema_version:'native-command-contract-amendment-v1',
  native_git_sha:policy.nativeSha,web_git_sha:policy.webSha,lease_id:policy.leaseId,owner_task_id:policy.owner,
  active_candidate_manifest_sha256:h('B'),active_native_receipt_sha256:h('C'),build_receipt_sha256:h('D'),
  executables,config_artifacts:[{source_path:policy.sourcePath,source_git_sha:policy.nativeSha,
    sha256:policy.imageSha256,candidate_package_path:'contract-image.json',production_path:policy.targetPath,
    preimage_sha256:policy.preimageSha256,required_by:'map-server.exe',rollback_model:'RESTORE_EXACT_PREIMAGE'}],
  rollback:{previous_contract_path:policy.targetPath,previous_contract_sha256:policy.preimageSha256,
    executable_hashes:executables}};
test('3 executable and 1 exact config manifest accepted', () =>
  assert.equal(validateCommandContractManifest(manifest), true));
reject('arbitrary config path rejected', () => {
  const m=copy(manifest);m.config_artifacts[0].production_path='ops/ro-stack/stack.config.psd1';
  validateCommandContractManifest(m);
}, 'CONTRACT_CANDIDATE_CONFIG_INVALID');
reject('unlocked config hash rejected', () => {
  const m=copy(manifest);m.config_artifacts[0].sha256=h('E');validateCommandContractManifest(m);
}, 'CONTRACT_CANDIDATE_CONFIG_INVALID');
reject('extra config rejected', () => {
  const m=copy(manifest);m.config_artifacts.push(copy(m.config_artifacts[0]));validateCommandContractManifest(m);
}, 'CONTRACT_CANDIDATE_IDENTITY_INVALID');
reject('missing executable rollback rejected', () => {
  const m=copy(manifest);m.rollback.executable_hashes=m.executables.slice(0,2);validateCommandContractManifest(m);
}, 'CONTRACT_CANDIDATE_CONFIG_INVALID');
reject('wrong lease rejected', () => {
  const m=copy(manifest);m.lease_id='other';validateCommandContractManifest(m);
}, 'CONTRACT_CANDIDATE_IDENTITY_INVALID');
test('post-deploy verifier pins image, preimage, executables and receipt', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'m1-command-contract-proof-'));
  const write=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));return file;};
  try {
    const target=policy.targetPath, oldBytes=JSON.stringify(old), newBytes=fs.readFileSync(newFile,'utf8');
    write(target,newBytes);
    const backup='.local/ro-stack/contract-amendment/preimage.json';write(backup,oldBytes);
    const image='.local/ro-stack/contract-amendment/contract-image.json';write(image,newBytes);
    const rows=executables.map(row=>({...row,sha256:digest(write(row.production_path,row.path))}));
    const m={...manifest,executables:rows,config_artifacts:[{...manifest.config_artifacts[0],sha256:digest(path.join(root,target)),
      preimage_sha256:digest(path.join(root,backup))}],rollback:{...manifest.rollback,
      previous_contract_sha256:digest(path.join(root,backup)),executable_hashes:rows}};
    const mPath='.local/ro-stack/contract-amendment/candidate-manifest.json';write(mPath,m);
    const receipt={schema_version:'native-command-contract-deploy-v1',lease_id:policy.leaseId,
      owner_task_id:policy.owner,native_git_sha:policy.nativeSha,web_git_sha:policy.webSha,
      governance_git_sha:'a'.repeat(40),
      candidate_manifest_sha256:digest(path.join(root,mPath)),current_contract:{path:target,
        sha256:m.config_artifacts[0].sha256,package_path:image},
      previous_contract:{path:target,sha256:m.config_artifacts[0].preimage_sha256,rollback_path:backup},
      executables:rows,rollback_ready:true,runtime_health:{pass:true},openkore_runtime_count:0};
    const rPath='.local/ro-stack/contract-amendment/receipt.json';write(rPath,receipt);
    const ref={receipt:rPath,sha256:digest(path.join(root,rPath)),candidate_manifest:mPath,
      candidate_manifest_sha256:digest(path.join(root,mPath))};
    const lease={lease_id:policy.leaseId,owner_task_id:policy.owner,native_deploy_git_sha:policy.nativeSha,
      web_deploy_git_sha:policy.webSha,native_candidate_manifest_sha256:m.active_candidate_manifest_sha256,
      native_command_contract_amendment:ref};
    const nativeReceipt={artifacts:rows.map(x=>({path:x.production_path,sha256:x.sha256}))};
    assert.equal(verifyCommandContractAmendment(root,lease,{native_command_contract_amendment:ref},nativeReceipt),true);
    write(target,'tampered');
    assert.equal(verifyCommandContractAmendment(root,lease,{native_command_contract_amendment:ref},nativeReceipt),false);
    write(target,newBytes);write(backup,'tampered');
    assert.equal(verifyCommandContractAmendment(root,lease,{native_command_contract_amendment:ref},nativeReceipt),false);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
console.log(`NATIVE_COMMAND_CONTRACT_AMENDMENT_TESTS=${count}`);
