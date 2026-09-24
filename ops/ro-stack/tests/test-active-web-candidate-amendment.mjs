import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateActiveWebAmendment, duplicateAmendmentIsApplied, applyAmendmentPlan } from '../amend-active-web-candidate.mjs';
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
    fs.writeFileSync(oldReceiptPath,'changed');
    assert.equal(webAmendmentHistoryValid(root,lease,pending,receipt),false);
    console.log(`PASS ${++count} final receipt binds complete immutable amendment history`);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
console.log(`WEB_CANDIDATE_AMENDMENT_TEST_COUNT=${count}`);
