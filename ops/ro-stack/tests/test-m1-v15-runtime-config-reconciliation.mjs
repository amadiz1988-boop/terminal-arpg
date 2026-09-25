import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exactM1ConfigPatch, reconcileActiveRuntimeConfig } from '../reconcile-active-runtime-config.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const leaseId = '869f1725-dbd0-452d-b9dd-37ee79cc3f9a', owner = 'F｜M1 最終整合';
const nativeSha = 'a'.repeat(40), webSha = 'b'.repeat(40);
const oldConfig = Buffer.from('@{\n  Preserved = 123\n}\n');
const sourceConfig = Buffer.from('@{\n  Preserved = 123\n  PersistentAgentM1SupplyEnabled = $false\n  WebNativeSupplyPolicyEnabled = $false\n  WebM1AcceptanceFixtureEnabled = $false\n}\n');
const dashboardSource = Buffer.from('$env:PA_NATIVE_SUPPLY_POLICY_ENABLED=if($stackConfig.WebNativeSupplyPolicyEnabled){}\n' +
  '$env:RO_M1_ACCEPTANCE_FIXTURE_ENABLED=if($stackConfig.WebM1AcceptanceFixtureEnabled){}\n');
const policy = { mode:'M1_V15',operation_suffix:'-m1-v15',lease_id:leaseId,owner,native_sha:nativeSha,web_sha:webSha,
  old_config_sha256:hash(oldConfig),source_config_sha256:hash(sourceConfig),dashboard_launcher_sha256:hash(dashboardSource),
  changes:['PersistentAgentM1SupplyEnabled','WebNativeSupplyPolicyEnabled','WebM1AcceptanceFixtureEnabled'],
  out_of_scope_source_variance:[] };
const put = (root,relative,value) => {
  const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,Buffer.isBuffer(value)?value:typeof value==='string'?value:JSON.stringify(value));return file;
};
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'m1-v15-config-'));
  const artifacts=['login','char','map'].map(name=>{
    const artifact=put(root,`.local/ro-stack/rathena/${name}-server.exe`,`binary-${name}`);
    return {path:path.relative(root,artifact).replaceAll('\\','/'),sha256:hash(fs.readFileSync(artifact))};
  });
  const native={native_git_sha:nativeSha,owner_task_id:owner,new_binary_sha256:artifacts[2].sha256,
    new_pids:{login:5,char:6,map:7},artifacts};
  const activeNativeReceipt='.local/ro-stack/native-promotion-receipt-aaaaaaaaaaaa.json';
  put(root,activeNativeReceipt,native);
  const lease={lease_id:leaseId,owner_task_id:owner,status:'ACTIVE',promotion_mode:'FIRST_GITHUB_FIRST_PROMOTION',
    native_deploy_git_sha:nativeSha,web_deploy_git_sha:webSha,native_candidate_manifest_sha256:'C'.repeat(64)};
  put(root,'.local/ro-stack/production-deployment-lease/lease.json',lease);
  const state={schema_version:2,baseline_mode:'LEGACY_PRE_GITHUB_FIRST',historical_provenance:'UNRESOLVED',
    current_deploy_id:'LEGACY_BOOTSTRAP_0123456789abcdef',current_web_git_sha:'UNRESOLVED_LEGACY',
    current_native_git_sha:'UNRESOLVED_LEGACY',legacy_bootstrap_available:true,production_drift:'OPEN',
    drift_reason:'FIRST_PROMOTION_PENDING_FINAL_RECEIPT',first_promotion_phase:'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE'};
  put(root,'.local/ro-stack/production-deployment-state.json',state);
  const pending={lease_id:leaseId,owner_task_id:owner,native_git_sha:nativeSha,web_git_sha:webSha,
    native_stage:'NATIVE_STAGE_COMPLETE',native_stage_reconciled:true,started_at:'2026-09-24T14:57:15Z',
    native_receipt_path:activeNativeReceipt,
    native_receipt_sha256:hash(fs.readFileSync(path.join(root,activeNativeReceipt)))};
  put(root,'.local/ro-stack/first-github-first-promotion.pending.json',pending);
  const config=put(root,'ops/ro-stack/stack.config.psd1',oldConfig);
  put(root,'ops/ro-stack/ro-stack.ps1',
    "$config = Invoke-Expression (Get-Content (Join-Path $scriptRoot 'stack.config.psd1') -Raw)\n" +
    '$env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED = if ($config.PersistentAgentM1SupplyEnabled) {"1"} else {"0"}\n' +
    'Start-Process -FilePath $path\n');
  put(root,'ops/ro-stack/dashboard-service.ps1',dashboardSource);
  let nativeRunning=false,webRestarted=false;
  const actions=[];
  const snapshot=()=>{
    const pids=nativeRunning?{login:30,char:31,map:32}:{login:10,char:11,map:12};
    return {pass:true,counts:{login:1,char:1,map:1},pids,openkore_runtime_count:0,
      processes:{map:{started_at:nativeRunning?'2026-09-24T15:05:00Z':'2026-09-24T15:00:00Z'}},
      dashboard_pid:webRestarted?41:21,database_pid:22,
      procdump_receipt:{mapPid:pids.map,procdumpAttachStatus:'ATTACHED',mapBinarySha256:native.new_binary_sha256,
        runtimeGenerationId:nativeRunning?'new':'old',procdumpProcessId:nativeRunning?101:100},
      procdump_account:'NT AUTHORITY\\SYSTEM',procdump_process_identity:{PROCESS_IDENTITY_MATCH:'YES'}};
  };
  const adapter=async action=>{
    actions.push(`native:${action}`);
    if(action==='stop')return;
    if(action==='start'){nativeRunning=true;return;}
    assert.equal(action,'snapshot');return snapshot();
  };
  const webAdapter=async action=>{actions.push(`web:${action}`);if(action==='start')webRestarted=true;};
  return {root,config,actions,adapter,webAdapter,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const run=(x,extra={})=>reconcileActiveRuntimeConfig({root:x.root,leaseId,owner,sourceBytes:sourceConfig,
  sourceGitSha:'d'.repeat(40),adapter:x.adapter,webAdapter:x.webAdapter,verifyGit:false,nativeValid:()=>true,
  policy,pollAttempts:1,pollDelayMs:0,...extra});
let count=0;const pass=name=>console.log(`PASS ${++count} ${name}`);
const patch=exactM1ConfigPatch(oldConfig,sourceConfig,policy);
assert.deepEqual(patch.changes.map(x=>x.rollback),['REMOVE','REMOVE','REMOVE']);pass('exact three-key ABSENT to true and REMOVE rollback contract');
assert.equal(patch.bytes.toString().replace(policy.changes.map(k=>`  ${k} = $true\n`).join(''),''),oldConfig.toString());pass('rollback removes only three inserted lines');
assert.throws(()=>exactM1ConfigPatch(Buffer.from(oldConfig.toString().replace('123','124')),sourceConfig,policy),/M1_CONFIG_DIGEST_CHANGED/);pass('old config hash drift blocked');
assert.throws(()=>exactM1ConfigPatch(oldConfig,Buffer.from(sourceConfig.toString().replace('Preserved = 123','Preserved = 124')),{...policy,source_config_sha256:hash(Buffer.from(sourceConfig.toString().replace('Preserved = 123','Preserved = 124')))}),/UNCLASSIFIED_SOURCE_CONFIG_VARIANCE/);pass('unclassified source variance blocked');
{
  const x=fixture();try{
    const before=hash(fs.readFileSync(x.config));const report=await run(x);
    assert.equal(report.action,'DRY_RUN');assert.equal(hash(fs.readFileSync(x.config)),before);
    assert.deepEqual(x.actions,['native:snapshot']);pass('dry-run is read-only and bounded');
  }finally{x.cleanup();}
}
{
  const x=fixture();try{
    fs.writeFileSync(path.join(x.root,'ops/ro-stack/ro-stack.ps1'),
      "$config = Invoke-Expression (Get-Content (Join-Path $scriptRoot 'stack.config.psd1') -Raw)\nStart-Process -FilePath $path\n");
    await assert.rejects(run(x),/NATIVE_LAUNCHER_M1_PROJECTION_MISSING/);
    assert.deepEqual(fs.readFileSync(x.config),oldConfig);pass('deployed Native launcher without M1 projection blocks before mutation');
  }finally{x.cleanup();}
}
{
  const x=fixture();try{
    const report=await run(x,{execute:true});
    assert.equal(report.classification,'RUNTIME_CONFIG_RECONCILED');
    assert.deepEqual(fs.readFileSync(x.config),patch.bytes);
    assert.deepEqual(x.actions,['native:snapshot','native:stop','native:start','native:snapshot',
      'web:stop','web:start','native:snapshot']);pass('only Native and Dashboard consumers restart');
    const receipt=JSON.parse(fs.readFileSync(path.join(x.root,report.receipt_path)));
    assert.equal(receipt.native_stage_receipt,'.local/ro-stack/native-promotion-receipt-aaaaaaaaaaaa.json');
    assert.equal(receipt.startup_runtime_attestation.dashboard_pid,41);
    assert.equal(receipt.rollback_digest,hash(oldConfig));pass('receipt pins new runtimes and exact rollback bytes');
    const again=await run(x,{execute:true});assert.equal(again.already_reconciled,true);pass('duplicate invocation is idempotent');
  }finally{x.cleanup();}
}
{
  const x=fixture();try{
    await assert.rejects(run(x,{execute:true,beforeStop:()=>{throw Error('PRE_STOP_FAILURE');}}),/PRE_STOP_FAILURE/);
    assert.deepEqual(fs.readFileSync(x.config),oldConfig);pass('pre-restart failure restores all three absent keys');
  }finally{x.cleanup();}
}
console.log(`M1_V15_RUNTIME_CONFIG_TESTS=PASS COUNT=${count}`);
