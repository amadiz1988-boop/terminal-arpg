import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateActiveWebAmendment, validateManifestDelta, duplicateAmendmentIsApplied, applyAmendmentPlan } from '../amend-active-web-candidate.mjs';
import { webAmendmentHistoryValid } from '../production-deployment-state.mjs';

const oldSha='a'.repeat(40),newSha='b'.repeat(40),native='c'.repeat(40);
const owner='F｜M1 最終整合',leaseId='869f1725-dbd0-452d-b9dd-37ee79cc3f9a';
function fixture() {
  const state={schema_version:2,baseline_mode:'LEGACY_PRE_GITHUB_FIRST',historical_provenance:'UNRESOLVED',
    current_deploy_id:'LEGACY_BOOTSTRAP_0123456789abcdef',current_web_git_sha:'UNRESOLVED_LEGACY',
    current_native_git_sha:'UNRESOLVED_LEGACY',legacy_bootstrap_available:true,production_drift:'OPEN',
    first_promotion_phase:'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE'};
  const lease={lease_id:leaseId,owner_task_id:owner,status:'ACTIVE',promotion_mode:'FIRST_GITHUB_FIRST_PROMOTION',
    emergency:false,web_deploy_git_sha:oldSha,native_deploy_git_sha:native,native_candidate_manifest_sha256:'D'.repeat(64)};
  const pending={lease_id:leaseId,owner_task_id:owner,web_git_sha:oldSha,native_git_sha:native,
    native_stage:'NATIVE_STAGE_COMPLETE',native_stage_reconciled:true};
  const oldManifest={web_git_sha:oldSha};
  const nextManifest={web_git_sha:newSha,candidate_native_commit:native,native_candidate_manifest:{sha256:'D'.repeat(64)}};
  const oldReceipt={result:'CANDIDATE_ACTIVE',web_git_sha:oldSha,lease_id:leaseId,owner_task_id:owner};
  const preflight={remoteCheckout:true,sourceRegression:true,manifestAdmission:true,rollbackCoverage:true,
    capabilitySuperset:true,assetAuthority:true,firstEvidence:true};
  return {state,lease,pending,oldManifest,nextManifest,oldReceipt,leaseId,owner,oldSha,newSha,nativeValid:true,preflight};
}
let count=0;
function test(name,change,expected) {
  const input=fixture();change(input);
  if (expected) assert.throws(()=>validateActiveWebAmendment(input),new RegExp(expected));
  else assert.equal(validateActiveWebAmendment(input),true);
  console.log(`PASS ${++count} ${name}`);
}
test('valid staged promotion',()=>{});
const additiveReason='LOCAL_DEVELOPER_ADMIN_ENTRYPOINT_ADDITIVE_MANIFEST_V1';
const actionPath='ops/ro-stack/developer-admin-action.mjs';
const m1Reason='M1_SETTINGS_EXECUTOR_AND_TEST_FIXTURE_V1';
const m1Path='ops/ro-stack/dashboard/self-recovery-skill-profile.mjs';
function deltaFixture() {
  const oldManifest={files:[{path:'ops/ro-stack/dashboard.mjs',sha256:'A'.repeat(64)},
    {path:'public/ro/client/manifest.json',sha256:'E'.repeat(64)}],removed_files:[]};
  const nextManifest={files:[{path:'ops/ro-stack/dashboard.mjs',sha256:'B'.repeat(64),
    production_preimage_sha256:'A'.repeat(64)},
    {path:'public/ro/client/manifest.json',sha256:'E'.repeat(64),
      production_preimage_sha256:'E'.repeat(64)}],removed_files:[]};
  return {oldManifest,nextManifest};
}
function addAction(x,path=actionPath) {
  x.nextManifest.files.push({path,sha256:'C'.repeat(64),production_preimage:'ABSENT'});
}
{
  const x=deltaFixture(),delta=validateManifestDelta(x.oldManifest,x.nextManifest,'ORDINARY_WEB_FIX',true);
  assert.deepEqual(delta.added_paths,[]);
  assert.deepEqual(delta.modified_existing_paths,['ops/ro-stack/dashboard.mjs']);
  assert.deepEqual(delta.unchanged_paths,['public/ro/client/manifest.json']);
  console.log(`PASS ${++count} same-count valid amendment classifies modified existing path`);
}
{
  const x=deltaFixture();addAction(x);
  const delta=validateManifestDelta(x.oldManifest,x.nextManifest,additiveReason,true);
  assert.deepEqual(delta.added_paths,[actionPath]);
  assert.deepEqual(delta.absent_preimage_paths,[actionPath]);
  assert.deepEqual(delta.rollback_remove_paths,[actionPath]);
  assert.deepEqual(delta.removed_paths,[]);
  console.log(`PASS ${++count} approved ABSENT addition has rollback REMOVE semantics`);
}
{
  const x=deltaFixture();addAction(x,m1Path);
  const delta=validateManifestDelta(x.oldManifest,x.nextManifest,m1Reason,true);
  assert.deepEqual(delta.added_paths,[m1Path]);
  assert.deepEqual(delta.rollback_remove_paths,[m1Path]);
  console.log(`PASS ${++count} V15 executor addition has exact rollback REMOVE semantics`);
}
{
  const x=deltaFixture();addAction(x,actionPath);
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,m1Reason,true),/WEB_MANIFEST_ADDITION_UNAPPROVED/);
  console.log(`PASS ${++count} V15 reason rejects a different additive path`);
}
{
  const x=deltaFixture();addAction(x,m1Path);addAction(x,'ops/ro-stack/dashboard/unrelated.mjs');
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,m1Reason,true),/WEB_MANIFEST_ADDITION_UNAPPROVED/);
  console.log(`PASS ${++count} V15 reason rejects multiple additive paths`);
}
{
  const x=deltaFixture();addAction(x);
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,'UNAPPROVED_REASON',true),/WEB_MANIFEST_ADDITION_UNAPPROVED/);
  console.log(`PASS ${++count} unapproved addition reason rejected`);
}
{
  const x=deltaFixture();addAction(x,'ops/ro-stack/unrelated.mjs');
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,additiveReason,true),/WEB_MANIFEST_ADDITION_UNAPPROVED/);
  console.log(`PASS ${++count} unapproved addition path rejected`);
}
{
  const x=deltaFixture();addAction(x);x.nextManifest.files.at(-1).production_preimage='UNKNOWN';
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,additiveReason,true),/ADDED_WEB_PREIMAGE_NOT_ABSENT/);
  console.log(`PASS ${++count} addition with unknown preimage rejected`);
}
{
  const x=deltaFixture();addAction(x);
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,additiveReason,false),/WEB_MANIFEST_ROLLBACK_COVERAGE_MISSING/);
  console.log(`PASS ${++count} addition without rollback coverage rejected`);
}
{
  const x=deltaFixture();x.nextManifest.files=[];
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,'ORDINARY_WEB_FIX',true),/WEB_MANIFEST_REMOVAL_UNAPPROVED/);
  console.log(`PASS ${++count} unexpected removal rejected`);
}
{
  const x=deltaFixture();x.nextManifest.files[0].production_preimage_sha256='D'.repeat(64);
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,'ORDINARY_WEB_FIX',true),/EXISTING_WEB_PREIMAGE_MISMATCH/);
  console.log(`PASS ${++count} existing-file preimage mismatch rejected`);
}
{
  const x=deltaFixture();addAction(x);addAction(x,'ops/ro-stack/unrelated.mjs');
  assert.throws(()=>validateManifestDelta(x.oldManifest,x.nextManifest,additiveReason,true),/WEB_MANIFEST_ADDITION_UNAPPROVED/);
  console.log(`PASS ${++count} mixed approved and unexplained additions rejected`);
}
test('wrong lease ID',x=>{x.leaseId='other';},'ACTIVE_LEASE_IDENTITY_MISMATCH');
test('wrong Unicode owner',x=>{x.owner='F|M1 最終整合';},'ACTIVE_LEASE_IDENTITY_MISMATCH');
test('released lease',x=>{x.lease.status='RELEASED';},'ACTIVE_LEASE_IDENTITY_MISMATCH');
test('first promotion complete',x=>{x.state.baseline_mode='GITHUB_FIRST';},'FIRST_PROMOTION_NOT_STAGED');
test('new SHA off main',x=>{x.preflight.remoteCheckout=false;},'WEB_AMENDMENT_PREFLIGHT_FAILED');
test('Native stage receipt missing',x=>{x.nativeValid=false;},'NATIVE_STAGE_RECEIPT_INVALID');
test('baseline already GitHub First',x=>{x.state.legacy_bootstrap_available=false;},'FIRST_PROMOTION_NOT_STAGED');
test('Web source preflight failed',x=>{x.preflight.sourceRegression=false;},'WEB_AMENDMENT_PREFLIGHT_FAILED');
test('old Web SHA mismatch',x=>{x.oldSha='e'.repeat(40);},'PENDING_PROMOTION_IDENTITY_MISMATCH|WEB_SHA_IDENTITY_MISMATCH');
test('new manifest admission failed',x=>{x.preflight.manifestAdmission=false;},'WEB_AMENDMENT_PREFLIGHT_FAILED');
test('rollback coverage failed',x=>{x.preflight.rollbackCoverage=false;},'WEB_AMENDMENT_PREFLIGHT_FAILED');
test('capability loss',x=>{x.preflight.capabilitySuperset=false;},'WEB_AMENDMENT_PREFLIGHT_FAILED');
test('Native candidate changed',x=>{x.nextManifest.candidate_native_commit='f'.repeat(40);},'NATIVE_CANDIDATE_CHANGED');
test('old Web receipt missing',x=>{x.oldReceipt=null;},'OLD_WEB_RECEIPT_INVALID');
test('pending Native stage not reconciled',x=>{x.pending.native_stage_reconciled=false;},'PENDING_PROMOTION_IDENTITY_MISMATCH');
{
  const x=fixture(),before=structuredClone(x);
  validateActiveWebAmendment(x);
  assert.deepEqual(x,before);
  assert.equal(x.lease.lease_id,leaseId);
  assert.equal(x.lease.native_deploy_git_sha,native);
  assert.equal(x.oldReceipt.web_git_sha,oldSha);
  console.log(`PASS ${++count} validation preserves lease, Native and old receipt`);
}
{
  const x=fixture(),audit={lease_id:leaseId,lease_owner:owner,old_web_git_sha:oldSha,new_web_git_sha:newSha};
  x.lease.web_deploy_git_sha=newSha;x.pending.web_git_sha=newSha;
  assert.equal(duplicateAmendmentIsApplied(audit,x.lease,x.pending,x),true);
  assert.equal(duplicateAmendmentIsApplied({...audit,lease_owner:'other'},x.lease,x.pending,x),false);
  console.log(`PASS ${++count} duplicate invocation has precise applied identity`);
}
{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'web-candidate-amendment-'));
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
  const put=(relative,value)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);return file;};
  try {
    const files={state:put('state.json','baseline'),lease:put('lease.json',JSON.stringify(fixture().lease)),
      pending:put('pending.json',JSON.stringify(fixture().pending)),native:put('native.json','native receipt')};
    const oldManifestFile=put('old-manifest.json','old manifest');
    const newManifestFile=put('new-manifest.json','new manifest');
    const oldReceiptFile=put('old-receipt.json','original Web receipt');
    const auditFile=path.join(root,'audit.json');
    const input=fixture();
    const plan={files,oldHashes:Object.fromEntries(Object.entries(files).map(([key,file])=>[key,hash(file)])),
      oldManifestFile,oldManifestHash:hash(oldManifestFile),newManifestFile,newManifestHash:hash(newManifestFile),
      oldReceiptFile,oldReceiptHash:hash(oldReceiptFile),auditFile,audit:{lease_id:leaseId,old_web_git_sha:oldSha,new_web_git_sha:newSha},
      nextLease:{...input.lease,web_deploy_git_sha:newSha},nextPending:{...input.pending,web_git_sha:newSha}};
    applyAmendmentPlan(root,plan);
    assert.equal(JSON.parse(fs.readFileSync(files.lease)).lease_id,leaseId);
    assert.equal(JSON.parse(fs.readFileSync(files.lease)).native_deploy_git_sha,native);
    assert.equal(JSON.parse(fs.readFileSync(files.pending)).web_git_sha,newSha);
    assert.equal(fs.readFileSync(oldReceiptFile,'utf8'),'original Web receipt');
    assert.equal(JSON.parse(fs.readFileSync(auditFile)).old_web_git_sha,oldSha);
    assert.throws(()=>applyAmendmentPlan(root,plan),/AMENDMENT_CONCURRENT_CHANGE/);
    console.log(`PASS ${++count} isolated apply keeps lease and Native, preserves old receipt, writes audit once`);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'web-amendment-final-history-'));
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
  try {
    const local=path.join(root,'.local','ro-stack');fs.mkdirSync(local,{recursive:true});
    const auditPath=path.join(local,'audit.json');
    const oldReceiptPath=path.join(local,'old-web.json');
    fs.writeFileSync(auditPath,JSON.stringify({lease_id:leaseId,old_web_git_sha:oldSha,new_web_git_sha:newSha}));
    fs.writeFileSync(oldReceiptPath,JSON.stringify({result:'CANDIDATE_ACTIVE',web_git_sha:oldSha}));
    const history=[{old_web_git_sha:oldSha,new_web_git_sha:newSha,
      audit_receipt:'.local/ro-stack/audit.json',audit_sha256:hash(auditPath),
      previous_web_candidate_receipt:'.local/ro-stack/old-web.json',
      previous_web_candidate_receipt_sha256:hash(oldReceiptPath)}];
    const lease={lease_id:leaseId,web_deploy_git_sha:newSha,web_candidate_amendments:history};
    const pending={web_candidate_amendments:structuredClone(history)};
    const receipt={web_git_sha:newSha,web_candidate_amendments:structuredClone(history)};
    assert.equal(webAmendmentHistoryValid(root,lease,pending,receipt),true);
    assert.equal(webAmendmentHistoryValid(root,lease,pending,{...receipt,web_candidate_amendments:[]}),false);
    const finalSha='d'.repeat(40);
    const audit2Path=path.join(local,'audit-v2.json');
    const receipt2Path=path.join(local,'second-web.json');
    fs.writeFileSync(audit2Path,JSON.stringify({lease_id:leaseId,old_web_git_sha:newSha,new_web_git_sha:finalSha}));
    fs.writeFileSync(receipt2Path,JSON.stringify({result:'CANDIDATE_ACTIVE',web_git_sha:newSha}));
    const second={old_web_git_sha:newSha,new_web_git_sha:finalSha,
      audit_receipt:'.local/ro-stack/audit-v2.json',audit_sha256:hash(audit2Path),
      previous_web_candidate_receipt:'.local/ro-stack/second-web.json',
      previous_web_candidate_receipt_sha256:hash(receipt2Path)};
    const chain=[...history,second];
    assert.equal(webAmendmentHistoryValid(root,{...lease,web_deploy_git_sha:finalSha,web_candidate_amendments:chain},
      {web_candidate_amendments:structuredClone(chain)},
      {web_git_sha:finalSha,web_candidate_amendments:structuredClone(chain)}),true);
    fs.writeFileSync(oldReceiptPath,'changed');
    assert.equal(webAmendmentHistoryValid(root,lease,pending,receipt),false);
    console.log(`PASS ${++count} final receipt binds complete immutable amendment history`);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
console.log(`WEB_CANDIDATE_AMENDMENT_TEST_COUNT=${count}`);
