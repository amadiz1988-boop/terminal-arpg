#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, verifyLegacyBaseline, pendingPath, consumedPath, legacyIdentity, FIRST_PROMOTION, windowsPowerShellEnv } from './legacy-production-baseline.mjs';
import { inspectNativeCandidate, equalHash, nativeReceiptPath, nativeReceiptValid, pinned, git } from './native-promotion-contract.mjs';
import { prepareCommandContractAmendment, preflightCommandContractAmendment,
  deployCommandContractAmendment } from './native-command-contract-amendment.mjs';
import { replaceContractImage, restoreContractPreimage } from './native-runtime-contract-artifact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here,'../..');
const check = (ok,code) => {if(!ok)throw Error(code);};
const write = (file,value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const atomic = (file,value) => {const tmp=file+'.'+randomUUID()+'.tmp';write(tmp,value);fs.renameSync(tmp,file);};
function call(args) {
  const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  check(r.status===0,`ADMISSION_BLOCKED:${r.stdout.trim()}`);return JSON.parse(r.stdout);
}
export const NATIVE_STAGE_PHASE='FIRST_PROMOTION_NATIVE_STAGE_COMPLETE';
export const reconciledPrefix='native-deploy-reconciled-';
// Lifecycle actions start long-lived services that inherit open handles. They
// run with file-backed stdio so the caller waits only for the adapter process;
// snapshot starts no service and keeps its JSON stdout pipe.
// script is an isolated-fixture boundary; the CLI never passes it.
export function runtimeAdapter(root, owner, leaseId, {logRoot,script=path.join(here,'native-runtime-adapter.ps1')}={}) {
  return async action => {
    const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',script,
      '-Action',action,'-ProductionRoot',root,'-Owner',owner,'-LeaseId',leaseId];
    const options={windowsHide:true,timeout:180000,env:windowsPowerShellEnv()};
    if(action==='snapshot'){
      const r=spawnSync('powershell.exe',args,{...options,encoding:'utf8',maxBuffer:8*1024*1024});
      check(r.status===0 && !r.error,'NATIVE_RUNTIME_SNAPSHOT_FAILED');
      return JSON.parse(r.stdout);
    }
    const dir=logRoot||boundedPath(root,'.local/ro-stack/logs');fs.mkdirSync(dir,{recursive:true});
    const base=path.join(dir,`native-adapter-caller-${action}-${new Date().toISOString().replace(/[-:.]/g,'')}-${randomUUID().slice(0,8)}`);
    const out=fs.openSync(base+'.out.log','wx'),err=fs.openSync(base+'.err.log','wx');
    let r;
    try { r=spawnSync('powershell.exe',args,{...options,stdio:['ignore',out,err]}); } finally { fs.closeSync(out);fs.closeSync(err); }
    check(r.status===0 && !r.error,`NATIVE_RUNTIME_${action.toUpperCase()}_FAILED`);
    return null;
  };
}

// The adapter boundary allows isolated lifecycle fixtures. CLI has no test-mode
// or adapter injection and accepts only the canonical Production directory.
export async function executeNative({root,file,sha256,owner,leaseId,authority,adapter,inspect=inspectNativeCandidate,webAdmission}) {
  const dir=boundedPath(root,'.local/ro-stack'), stateFile=path.join(dir,'production-deployment-state.json');
  const leaseFile=path.join(dir,'production-deployment-lease/lease.json');
  const state=readJson(stateFile),lease=readJson(leaseFile);
  const lock=path.join(dir,'native-deploy.lock'),operationFile=path.join(lock,'operation.json');
  check(!fs.existsSync(lock),'NATIVE_DEPLOY_BUSY');
  check(!fs.existsSync(boundedPath(root,nativeReceiptPath)) && !state.first_promotion_phase,'NATIVE_STAGE_ALREADY_RECORDED');
  // Durable operation claim. An interrupted attempt cannot be silently replayed.
  fs.mkdirSync(lock);
  write(operationFile,{schema_version:'native-deploy-operation-v1',owner_task_id:owner,lease_id:leaseId,
    candidate_manifest_sha256:sha256,started_at:new Date().toISOString()});
  let started=false,complete=false,configReplaced=false,configBackup=null,configTarget=null;
  try {
    check(equalHash(digest(lease.admission_manifest),lease.admission_manifest_sha256),'WEB_MANIFEST_CHANGED');
    const web=readJson(lease.admission_manifest);
    check(equalHash(web.native_candidate_manifest?.sha256,sha256) &&
      path.resolve(path.dirname(lease.admission_manifest),web.native_candidate_manifest.path)===path.resolve(file),'NATIVE_MANIFEST_NOT_LEASE_BOUND');
    const admission=await webAdmission();
    check(admission.eligible,'WEB_PREFLIGHT_FAILED');
    const before=await adapter('snapshot');
    check(before.procdump_receipt?.mapPid===before.pids?.map && before.procdump_receipt.procdumpAttachStatus==='ATTACHED','PROCDUMP_PRECHECK_FAILED');
    const candidate=inspect({file,sha256,root,state,authority,mode:'deploy',lease,owner,leaseId,runtime:before,webCapabilities:admission.candidate_capabilities,webRoot:web.candidate_root,webSha:web.candidate_commit});
    check(candidate.eligible,`NATIVE_CANDIDATE_BLOCKED:${candidate.errors.join(',')}`);
    check(verifyLegacyBaseline(root,state).pass && verifyLegacyBaseline(root,state).rollbackReady,'LEGACY_CHANGED');
    const stage=path.join(dir,'native-deploy.lock','stage');fs.mkdirSync(stage);
    for(const item of candidate.build.artifacts){
      const dest=boundedPath(stage,item.path);fs.copyFileSync(boundedPath(candidate.source,item.path),dest,fs.constants.COPYFILE_EXCL);
      check(equalHash(digest(dest),item.sha256),'STAGED_BINARY_CHANGED');
    }
    const config=candidate.build.config_artifacts?.[0];
    if(config){
      check(candidate.manifest.config_artifacts?.length===1 &&
        JSON.stringify(candidate.manifest.config_artifacts[0])===JSON.stringify(config),
      'NATIVE_CONFIG_NOT_MANIFEST_BOUND');
      configTarget=boundedPath(root,`.local/ro-stack/rathena/${config.source_path}`);
      configBackup=path.join(stage,'contract-preimage.json');
      fs.copyFileSync(configTarget,configBackup,fs.constants.COPYFILE_EXCL);
      const staged=path.join(stage,'contract-image.json');
      fs.copyFileSync(boundedPath(path.dirname(file),config.candidate_package_path),staged,fs.constants.COPYFILE_EXCL);
      check(equalHash(digest(staged),config.sha256),'STAGED_COMMAND_CONTRACT_CHANGED');
    }
    // Recheck ownership and all pinned bytes at the mutation boundary.
    check(readJson(leaseFile).lease_id===leaseId && readJson(leaseFile).owner_task_id===owner && readJson(leaseFile).status==='ACTIVE' &&
      readJson(stateFile).production_drift==='CLOSED','PREMUTATION_STATE_CHANGED');
    for(const item of candidate.manifest.lifecycle_files)pinned(root,item);
    check(equalHash(digest(file),sha256) && verifyLegacyBaseline(root,state).pass && verifyLegacyBaseline(root,state).rollbackReady &&
      equalHash(digest(lease.admission_manifest),lease.admission_manifest_sha256),'PREMUTATION_BYTES_CHANGED');
    write(boundedPath(root,pendingPath),{owner_task_id:owner,lease_id:leaseId,web_git_sha:lease.web_deploy_git_sha,
      native_git_sha:lease.native_deploy_git_sha,started_at:new Date().toISOString()});
    atomic(stateFile,{...state,production_drift:'OPEN',drift_reason:'FIRST_PROMOTION_PENDING_FINAL_RECEIPT'});
    started=true;
    await adapter('stop');
    for(const item of candidate.build.artifacts){
      const target=boundedPath(root,`.local/ro-stack/rathena/${item.path}`);
      check(equalHash(digest(target),state.native_binaries.find(x=>x.path.endsWith('/'+item.path))?.sha256),'NATIVE_PREIMAGE_CHANGED');
      // Same-volume atomic file replacement, only after all old processes exited.
      const temporary=target+'.candidate-'+leaseId;
      fs.copyFileSync(boundedPath(stage,item.path),temporary,fs.constants.COPYFILE_EXCL);
      check(equalHash(digest(temporary),item.sha256),'NATIVE_COPY_CHANGED');fs.renameSync(temporary,target);
    }
    if(config){
      const oldHash=digest(configBackup);
      replaceContractImage({target:configTarget,staged:path.join(stage,'contract-image.json'),
        displaced:path.join(stage,'contract-displaced.json'),backup:configBackup,
        oldHash,newHash:config.sha256});
      configReplaced=true;
    }
    await adapter('start');
    let after;
    for(let attempt=0;attempt<60;attempt++){
      after=await adapter('snapshot');
      if(after.pass && after.procdump_receipt?.mapPid===after.pids?.map && after.procdump_receipt.procdumpAttachStatus==='ATTACHED')break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    check(after.pass && after.dashboard_pid===before.dashboard_pid && after.database_pid===before.database_pid,'POSTDEPLOY_HEALTH_FAILED');
    const artifacts=candidate.build.artifacts.map(x=>({path:`.local/ro-stack/rathena/${x.path}`,sha256:x.sha256}));
    check(artifacts.every(x=>equalHash(digest(boundedPath(root,x.path)),x.sha256)),'POSTDEPLOY_BINARY_CHANGED');
    check(!config || equalHash(digest(configTarget),config.sha256),'POSTDEPLOY_COMMAND_CONTRACT_CHANGED');
    const configArtifacts=config?[{source_path:config.source_path,
      path:`.local/ro-stack/rathena/${config.source_path}`,sha256:config.sha256,
      preimage_sha256:digest(configBackup),rollback_path:`.local/ro-stack/native-deploy-completed-${leaseId}/stage/contract-preimage.json`}]:[];
    const receipt={schema_version:'native-deploy-v1',deploy_id:'native-'+randomUUID(),lease_id:leaseId,
      native_git_sha:candidate.manifest.native_git_sha,native_build_sha256:candidate.manifest.binary_sha256,
      candidate_manifest_sha256:sha256,previous_binary_sha256:state.current_native_binary_sha256,
      new_binary_sha256:candidate.manifest.binary_sha256,old_map_pid:before.pids.map,new_map_pid:after.pids.map,
      procdump_receipt:after.procdump_receipt,runtime_health:after,openkore_runtime_count:after.openkore_runtime_count,
      rollback_reference:candidate.manifest.rollback_reference,acceptance_status:'NATIVE_CANDIDATE_ACTIVE',artifacts,
      config_artifacts:configArtifacts,
      deployed_at:new Date().toISOString(),owner_task_id:owner};
    check(nativeReceiptValid(receipt,{nativeSha:lease.native_deploy_git_sha,leaseId,manifestHash:sha256}),'NATIVE_POSTDEPLOY_RECEIPT_INVALID');
    write(boundedPath(root,nativeReceiptPath),receipt);
    atomic(boundedPath(root,pendingPath),{...readJson(boundedPath(root,pendingPath)),native_receipt_sha256:digest(boundedPath(root,nativeReceiptPath))});
    atomic(stateFile,{...readJson(stateFile),first_promotion_phase:NATIVE_STAGE_PHASE});
    complete=true;return receipt;
  } catch(error){
    // A failed initial stage retains its journal. Restore the exact config
    // preimage on disk; the existing Native operation still owns runtime and
    // executable recovery and must not be silently marked complete.
    if(configReplaced && configBackup && fs.existsSync(configBackup))
      restoreContractPreimage({target:configTarget,backup:configBackup,oldHash:digest(configBackup)});
    throw error;
  } finally {
    // Never auto-close drift or restart again after a partial mutation. Retain
    // operation journal and exact rollback reference for owner reconciliation.
    if(!started || complete){
      if(complete)fs.renameSync(lock,path.join(dir,'native-deploy-completed-'+leaseId));
      else if(fs.readdirSync(lock).every(name=>name==='operation.json')){
        if(fs.existsSync(operationFile))fs.unlinkSync(operationFile);
        fs.rmdirSync(lock);
      }
    }
  }
}

// A failed attempt keeps native-deploy.lock as its operation journal. Once the
// owner has released the lease through release-failed, drift is CLOSED and the
// current Native bytes equal the accepted baseline, this records the outcome
// and renames the journal. Staged candidate bytes are retained for audit.
export const failedOperationPrefix='native-deploy-failed-';
export function archiveFailedNativeOperation({root,owner,governanceSha,now=new Date()}) {
  check(typeof owner==='string' && owner.length>0,'ARCHIVE_OWNER_REQUIRED');
  const dir=boundedPath(root,'.local/ro-stack'),lock=path.join(dir,'native-deploy.lock');
  check(fs.existsSync(lock),'NATIVE_OPERATION_RECORD_ABSENT');
  const lockStat=fs.lstatSync(lock);
  check(lockStat.isDirectory() && !lockStat.isSymbolicLink(),'NATIVE_OPERATION_RECORD_INVALID');
  check(!fs.existsSync(path.join(dir,'production-deployment-lease')),'DEPLOYMENT_LEASE_ACTIVE');
  check(!fs.existsSync(boundedPath(root,pendingPath)),'FIRST_PROMOTION_PENDING');
  const state=readJson(path.join(dir,'production-deployment-state.json'));
  check(state.production_drift==='CLOSED' && !state.drift_reason,'PRODUCTION_DRIFT_OPEN');
  check(Array.isArray(state.native_binaries) && state.native_binaries.length>0 &&
    state.native_binaries.every(x=>equalHash(digest(boundedPath(root,x.path)),x.sha256)),'NATIVE_BASELINE_CHANGED');
  check(!fs.readdirSync(boundedPath(root,'.local/ro-stack/rathena')).some(name=>name.includes('.candidate-')),
    'NATIVE_REPLACEMENT_TEMPORARY_PRESENT');
  const entries=fs.readdirSync(lock).sort();
  check(entries.every(name=>name==='operation.json' || name==='stage'),'NATIVE_OPERATION_RECORD_UNEXPECTED_CONTENT');
  const operation=entries.includes('operation.json') ? readJson(path.join(lock,'operation.json')) : null;
  const staged=[];
  if(entries.includes('stage')){
    const stage=path.join(lock,'stage'),stageStat=fs.lstatSync(stage);
    check(stageStat.isDirectory() && !stageStat.isSymbolicLink(),'NATIVE_STAGE_UNEXPECTED_CONTENT');
    for(const name of fs.readdirSync(stage).sort()){
      const file=path.join(stage,name),info=fs.lstatSync(file);
      check(info.isFile() && !info.isSymbolicLink(),'NATIVE_STAGE_UNEXPECTED_CONTENT');
      staged.push({path:'stage/'+name,bytes:info.size,sha256:digest(file)});
    }
  }
  const archiveId=failedOperationPrefix+now.toISOString().replace(/[-:.]/g,'')+'-'+randomUUID().slice(0,8);
  const record={schema_version:'native-deploy-failed-operation-v1',classification:'COMPLETED_FAILED_OPERATION_RECORD',
    archive_id:archiveId,archived_at:now.toISOString(),archived_by:owner,governance_git_sha:governanceSha||null,
    operation:operation || {recorded:false,reason:'CLAIM_PREDATES_OPERATION_JOURNAL'},staged_artifacts:staged,
    production_drift:'CLOSED',deployment_lease:'FREE',native_binaries_match_baseline:true,
    current_native_binary_sha256:state.current_native_binary_sha256,blocks_new_deploy:false};
  write(path.join(lock,'failed-operation-record.json'),record);
  fs.renameSync(lock,path.join(dir,archiveId));
  return record;
}

const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v;
const textHash=text=>createHash('sha256').update(text).digest('hex').toUpperCase();
// Old PIDs come from the hash-pinned first-promotion evidence bound to the lease.
export function evidenceRuntimePids(evidence) {
  const match=/login (\d+), char (\d+), map (\d+)/.exec(evidence?.runtime_health_gate?.evidence||'');
  check(evidence?.runtime_health_gate?.pass===true && match,'OLD_RUNTIME_EVIDENCE_REQUIRED');
  return {login:Number(match[1]),char:Number(match[2]),map:Number(match[3])};
}

// Formal reconciliation for a first-promotion Native stage whose tool run
// reported NATIVE_RUNTIME_START_FAILED after replacement. It writes nothing
// unless the running processes, current bytes, lease, candidate, failed
// operation, ProcDump and untouched Web bytes all prove the exact authorized
// stage. The failed operation journal is renamed intact, never rewritten.
export function finalizeRunningNativeStage({root,file,sha256,owner,leaseId,authority,failedOutput,oldPids,snapshot,apiHealth,
  governanceSha,inspect=inspectNativeCandidate,now=new Date(),dryRun=false}) {
  const dir=boundedPath(root,'.local/ro-stack'),stateFile=path.join(dir,'production-deployment-state.json');
  const leaseFile=path.join(dir,'production-deployment-lease/lease.json'),pendingFile=boundedPath(root,pendingPath);
  const receiptFile=boundedPath(root,nativeReceiptPath),lock=path.join(dir,'native-deploy.lock');
  const archived=path.join(dir,reconciledPrefix+leaseId);
  check(fs.existsSync(leaseFile),'DEPLOYMENT_LEASE_REQUIRED');
  const leaseHash=digest(leaseFile),stateHash=digest(stateFile);
  const lease=readJson(leaseFile),state=readJson(stateFile);
  check(lease.status==='ACTIVE' && lease.promotion_mode===FIRST_PROMOTION && lease.emergency!==true,'LEASE_NOT_FIRST_PROMOTION');
  check(typeof leaseId==='string' && !!leaseId && lease.lease_id===leaseId,'LEASE_ID_MISMATCH');
  check(typeof owner==='string' && !!owner && lease.owner_task_id===owner,'LEASE_OWNER_MISMATCH');
  check(equalHash(digest(file),sha256) && equalHash(lease.native_candidate_manifest_sha256,sha256),'CANDIDATE_MANIFEST_NOT_LEASE_BOUND');
  check(equalHash(digest(lease.admission_manifest),lease.admission_manifest_sha256),'WEB_MANIFEST_CHANGED');
  const web=readJson(lease.admission_manifest);
  check(equalHash(web.native_candidate_manifest?.sha256,sha256) &&
    path.resolve(path.dirname(lease.admission_manifest),web.native_candidate_manifest.path)===path.resolve(file) &&
    web.candidate_native_commit===lease.native_deploy_git_sha && web.candidate_commit===lease.web_deploy_git_sha,'NATIVE_MANIFEST_NOT_LEASE_BOUND');
  check(legacyIdentity(state) && state.production_drift==='OPEN' && state.drift_reason==='FIRST_PROMOTION_PENDING_FINAL_RECEIPT' &&
    !fs.existsSync(boundedPath(root,consumedPath)),'NATIVE_STAGE_STATE_INVALID');
  check(fs.existsSync(pendingFile),'FIRST_PROMOTION_PENDING_REQUIRED');
  const pending=readJson(pendingFile);
  check(pending.lease_id===leaseId && pending.owner_task_id===owner && pending.native_git_sha===lease.native_deploy_git_sha &&
    pending.web_git_sha===lease.web_deploy_git_sha,'PENDING_UNBOUND');
  check(!pending.native_receipt_sha256 && !state.first_promotion_phase && !fs.existsSync(receiptFile) && !fs.existsSync(archived),'NATIVE_STAGE_ALREADY_RECORDED');
  check(fs.existsSync(lock) && fs.lstatSync(lock).isDirectory() && !fs.lstatSync(lock).isSymbolicLink(),'FAILED_NATIVE_OPERATION_REQUIRED');
  check(JSON.stringify(fs.readdirSync(lock).sort())===JSON.stringify(['operation.json','stage']),'FAILED_NATIVE_OPERATION_UNEXPECTED_CONTENT');
  const operationFile=path.join(lock,'operation.json'),operation=readJson(operationFile),operationSha=digest(operationFile);
  check(operation.owner_task_id===owner && operation.lease_id===leaseId && equalHash(operation.candidate_manifest_sha256,sha256),'FAILED_OPERATION_UNBOUND');
  check(failedOutput && fs.existsSync(failedOutput),'FAILED_TOOL_OUTPUT_REQUIRED');
  const failedResult=readJson(failedOutput);
  check(failedResult.result==='BLOCKED' && failedResult.error==='NATIVE_RUNTIME_START_FAILED' && Object.keys(failedResult).length===2,'FAILED_TOOL_OUTPUT_NOT_START_FAILURE');

  const candidate=inspect({file,sha256,root,state,authority,mode:'reconcile',lease,owner,leaseId,runtime:snapshot,
    webCapabilities:lease.candidate_capabilities||[],webRoot:web.candidate_root,webSha:web.candidate_commit});
  check(candidate.eligible,`NATIVE_CANDIDATE_BLOCKED:${candidate.errors.join(',')}`);
  const artifacts=candidate.build.artifacts.map(x=>({name:x.path.replace('-server.exe',''),file:x.path,
    path:`.local/ro-stack/rathena/${x.path}`,sha256:String(x.sha256).toUpperCase()}));
  check(artifacts.length===3 && equalHash(artifacts.find(x=>x.name==='map')?.sha256,candidate.manifest.binary_sha256),'CANDIDATE_ARTIFACT_SET_INVALID');
  const stageDir=path.join(lock,'stage');
  check(JSON.stringify(fs.readdirSync(stageDir).sort())===JSON.stringify(artifacts.map(x=>x.file).sort()),'FAILED_OPERATION_STAGE_INVALID');
  const stage=artifacts.map(x=>({path:'stage/'+x.file,sha256:digest(path.join(stageDir,x.file))}));
  check(stage.every((x,i)=>equalHash(x.sha256,artifacts[i].sha256)),'FAILED_OPERATION_STAGE_INVALID');
  const binaries=artifacts.map(x=>({name:x.name,path:x.path,expected_sha256:x.sha256,current_sha256:digest(boundedPath(root,x.path)),
    previous_sha256:state.native_binaries.find(y=>y.path===x.path)?.sha256}));
  check(binaries.every(x=>equalHash(x.current_sha256,x.expected_sha256)),'NATIVE_BINARY_MISMATCH');
  check(binaries.every(x=>/^[A-F0-9]{64}$/i.test(x.previous_sha256||'')),'PREVIOUS_BINARY_UNKNOWN');
  const view=structuredClone(state);view.native_binaries=artifacts.map(x=>({path:x.path,sha256:x.sha256}));
  const current=verifyLegacyBaseline(root,view);
  check(current.pass,'WEB_OR_NATIVE_BYTES_CHANGED');
  const rollback=state.legacy_rollback;
  check(equalHash(digest(boundedPath(root,rollback.web_manifest)),state.current_web_manifest_sha256) &&
    [...current.files,...state.native_binaries].every(x=>equalHash(digest(boundedPath(root,`${rollback.root}/${x.path}`)),x.sha256)),'ROLLBACK_CHANGED');
  const webReceipts=boundedPath(root,'.local/ro-stack/dashboard/deploy-receipts');
  const acquired=Date.parse(lease.acquired_at);
  check(Number.isFinite(acquired),'LEASE_ACQUIRED_AT_INVALID');
  check(!fs.existsSync(webReceipts) || !fs.readdirSync(webReceipts).some(name=>name.startsWith('manifest-') &&
    fs.statSync(path.join(webReceipts,name)).mtimeMs>=acquired),'WEB_STAGE_ALREADY_STARTED');

  const s=snapshot,roles=['login','char','map'];
  check(s?.pass===true && roles.every(n=>s.counts?.[n]===1),'SINGLE_RUNTIME_REQUIRED');
  check(s.openkore_runtime_count===0,'OPENKORE_FORBIDDEN');
  check(Number.isInteger(s.dashboard_pid) && s.dashboard_pid>0 && Number.isInteger(s.database_pid) && s.database_pid>0,'DEPENDENCY_UNHEALTHY');
  check(apiHealth?.status===200 && apiHealth.ok===true,'API_UNHEALTHY');
  const pendingStarted=Date.parse(pending.started_at);
  check(Number.isFinite(pendingStarted) && roles.every(n=>{const p=s.processes?.[n];
    return p && p.pid===s.pids?.[n] && typeof p.executable_path==='string' &&
      path.resolve(p.executable_path).toLowerCase()===boundedPath(root,`.local/ro-stack/rathena/${n}-server.exe`).toLowerCase() &&
      Date.parse(p.started_at)>pendingStarted;}),'RUNTIME_BINARY_PATH_OR_START_MISMATCH');
  const evidenceRef=web.first_promotion_evidence;
  const evidenceFile=evidenceRef?.path && path.resolve(path.dirname(lease.admission_manifest),evidenceRef.path);
  check(evidenceFile && fs.existsSync(evidenceFile) && equalHash(digest(evidenceFile),evidenceRef.sha256),'FIRST_PROMOTION_EVIDENCE_CHANGED');
  const evidence=readJson(evidenceFile),recorded=evidenceRuntimePids(evidence);
  check(evidence.native_git_sha===lease.native_deploy_git_sha && evidence.web_git_sha===lease.web_deploy_git_sha,'FIRST_PROMOTION_EVIDENCE_UNBOUND');
  check(oldPids && roles.every(n=>oldPids[n]===recorded[n] && oldPids[n]!==s.pids[n]),'OLD_RUNTIME_PIDS_MISMATCH');
  const id=s.procdump_process_identity,dump=s.procdump_receipt;
  check(id?.PROCESS_IDENTITY_MATCH==='YES' && id.target_pid===s.pids.map && id.procdump_target_pid===s.pids.map &&
    dump?.mapPid===s.pids.map && dump.procdumpAttachedPid===s.pids.map && dump.procdumpAttachStatus==='ATTACHED' &&
    (!dump.mapBinarySha256 || equalHash(dump.mapBinarySha256,candidate.manifest.binary_sha256)),'PROCDUMP_GATE_FAILED');

  const failedOperation={journal_path:'.local/ro-stack/native-deploy.lock',archived_path:`.local/ro-stack/${reconciledPrefix}${leaseId}`,
    operation_sha256:operationSha,operation,stage,tool_output:{path:path.resolve(failedOutput),sha256:digest(failedOutput),result:failedResult}};
  const evidenceBlock={lease:{lease_id:leaseId,owner_task_id:owner,sha256:leaseHash},state_sha256:stateHash,candidate_manifest_sha256:String(sha256).toUpperCase(),
    build_receipt_sha256:candidate.manifest.build_receipt.sha256,binaries,runtime:s,api_health:apiHealth,old_pids:oldPids,
    first_promotion_evidence_sha256:digest(evidenceFile),failed_operation:failedOperation};
  const receipt={schema_version:'native-deploy-v1',deploy_id:'native-reconciled-'+randomUUID(),lease_id:leaseId,owner_task_id:owner,
    native_git_sha:candidate.manifest.native_git_sha,native_build_sha256:candidate.manifest.binary_sha256,
    build_receipt_sha256:candidate.manifest.build_receipt.sha256,candidate_manifest_sha256:String(sha256).toUpperCase(),
    previous_binary_sha256:state.current_native_binary_sha256,new_binary_sha256:candidate.manifest.binary_sha256,
    previous_binaries:binaries.map(x=>({path:x.path,sha256:x.previous_sha256})),artifacts:artifacts.map(x=>({path:x.path,sha256:x.sha256})),
    old_map_pid:oldPids.map,new_map_pid:s.pids.map,old_pids:oldPids,new_pids:{...s.pids},
    procdump_receipt:dump,procdump_process_identity:id,runtime_health:s,api_health:apiHealth,openkore_runtime_count:0,
    rollback_reference:candidate.manifest.rollback_reference,acceptance_status:'NATIVE_CANDIDATE_ACTIVE',deployed_at:s.processes.map.started_at,
    tool_initial_result:'NATIVE_RUNTIME_START_FAILED',reconciliation_result:'RUNTIME_ACTUALLY_STARTED_AND_VERIFIED',
    reconciliation_governance_sha:governanceSha||null,reconciled_at:now.toISOString(),failed_operation:failedOperation,
    reconciliation_evidence_digest:textHash(JSON.stringify(sortKeys(evidenceBlock))),first_promotion_complete:false,web_stage_pending:true};
  check(nativeReceiptValid(receipt,{nativeSha:lease.native_deploy_git_sha,leaseId,manifestHash:sha256}),'NATIVE_STAGE_RECEIPT_INVALID');
  check(digest(leaseFile)===leaseHash && digest(stateFile)===stateHash && digest(operationFile)===operationSha,'RECONCILIATION_INPUT_CHANGED');
  if(dryRun)return {eligible:true,receipt};
  write(receiptFile,receipt);
  atomic(pendingFile,{...pending,native_receipt_sha256:digest(receiptFile),native_stage:'NATIVE_STAGE_COMPLETE',native_stage_reconciled:true});
  atomic(stateFile,{...state,first_promotion_phase:NATIVE_STAGE_PHASE});
  fs.renameSync(lock,archived);
  check(digest(path.join(archived,'operation.json'))===operationSha,'FAILED_OPERATION_RECORD_CHANGED');
  return {receipt,receipt_path:nativeReceiptPath,receipt_sha256:digest(receiptFile)};
}

async function main(){
  const argv=process.argv.slice(2),a=Object.fromEntries(argv.flatMap((x,i)=>x.startsWith('--')?[[x.slice(2),argv[i+1]]]:[]));
  const root=path.resolve(a['production-root']||'');
  check(root.toLowerCase()==='c:\\users\\administrator\\ghost-island-production\\ro-stack','CANONICAL_ROOT_REQUIRED');
  check(git(sourceRoot,'status','--porcelain=v1','--untracked-files=all')==='','GOVERNANCE_SOURCE_DIRTY');
  const sha=git(sourceRoot,'rev-parse','HEAD'),url=git(sourceRoot,'remote','get-url','origin');
  check(url==='https://github.com/amadiz1988-boop/terminal-arpg.git','GOVERNANCE_REMOTE_INVALID');
  const tip=git(sourceRoot,'ls-remote','--exit-code','origin','refs/heads/main').split(/\s/)[0];
  git(sourceRoot,'fetch','--no-tags','--no-write-fetch-head','origin','refs/heads/main');git(sourceRoot,'merge-base','--is-ancestor',sha,tip);
  if(['prepare-command-contract','preflight-command-contract','deploy-command-contract'].includes(a.action)){
    check(a.owner==='F｜M1 最終整合' && a.lease==='869f1725-dbd0-452d-b9dd-37ee79cc3f9a',
      'CONTRACT_AMENDMENT_OWNER_REQUIRED');
    const nativeRoot='C:\\Users\\Administrator\\source\\ghost-island-rathena';
    let result;
    if(a.action==='prepare-command-contract'){
      check(a['package-root'],'CONTRACT_PACKAGE_ROOT_REQUIRED');
      result=prepareCommandContractAmendment({root,nativeRoot,packageRoot:path.resolve(a['package-root'])});
    }else{
      check(a['candidate-manifest'] && a['manifest-sha256'],'CONTRACT_MANIFEST_REQUIRED');
      const input={root,nativeRoot,manifestFile:path.resolve(a['candidate-manifest']),manifestSha256:a['manifest-sha256']};
      if(a.action==='deploy-command-contract'){
        check(a.execute==='true','EXPLICIT_EXECUTE_REQUIRED');
        result=await deployCommandContractAmendment({...input,governanceSha:sha,
          adapter:runtimeAdapter(root,a.owner,a.lease)});
      }else{
        result=preflightCommandContractAmendment(input);
        const runtime=await runtimeAdapter(root,a.owner,a.lease)('snapshot');
        check(runtime?.pass===true && runtime.openkore_runtime_count===0 &&
          runtime.procdump_receipt?.mapPid===runtime.pids?.map,'CONTRACT_RUNTIME_PREFLIGHT_FAILED');
        result={...result,runtime_health:'PASS',procdump_gate:'PASS'};
      }
    }
    console.log(JSON.stringify(result));return;
  }
  if(a.action==='archive-failed-operation'){
    console.log(JSON.stringify({archived:true,record:archiveFailedNativeOperation({root,owner:a.owner,governanceSha:sha})}));
    return;
  }
  if(a.action==='finalize-running-native-stage'){
    check(a.owner && a.lease && a['candidate-manifest'] && a['manifest-sha256'] && a['failed-output'] && a['old-pids'],'RECONCILE_ARGUMENTS_REQUIRED');
    const oldPids=Object.fromEntries(a['old-pids'].split(',').map(x=>x.split('=')).map(([k,v])=>[k,/^\d+$/.test(v||'')?Number(v):NaN]));
    const snapshot=await runtimeAdapter(root,a.owner,a.lease)('snapshot');
    let apiHealth;
    try { const r=await fetch('http://127.0.0.1:8788/api/health',{signal:AbortSignal.timeout(10000)});apiHealth={status:r.status,ok:(await r.json()).ok===true}; }
    catch { apiHealth={status:0,ok:false}; }
    const authority=readJson(path.join(sourceRoot,'docs/project-control/production-release-authority.json')).native;
    const result=finalizeRunningNativeStage({root,file:path.resolve(a['candidate-manifest']),sha256:a['manifest-sha256'],owner:a.owner,
      leaseId:a.lease,authority,failedOutput:path.resolve(a['failed-output']),oldPids,snapshot,apiHealth,governanceSha:sha,dryRun:a['dry-run']==='true'});
    if(result.eligible && !result.receipt_path){
      console.log(JSON.stringify({eligible:true,dry_run:true,old_pids:result.receipt.old_pids,new_pids:result.receipt.new_pids,
        artifacts:result.receipt.artifacts,procdump:result.receipt.procdump_process_identity,evidence_digest:result.receipt.reconciliation_evidence_digest}));
      return;
    }
    console.log(JSON.stringify({reconciled:true,receipt_path:result.receipt_path,receipt_sha256:result.receipt_sha256,deploy_id:result.receipt.deploy_id,
      first_promotion_phase:NATIVE_STAGE_PHASE,web_stage_pending:true,first_promotion_complete:false}));
    return;
  }
  check(!a.action,'INVALID_NATIVE_ACTION');
  check(a['candidate-manifest'] && a['manifest-sha256'] && a.owner && a.lease,'DEPLOY_ARGUMENTS_REQUIRED');
  const lease=readJson(boundedPath(root,'.local/ro-stack/production-deployment-lease/lease.json'));
  const authority=readJson(path.join(sourceRoot,'docs/project-control/production-release-authority.json')).native;
  const preflight=()=>call([path.join(here,'production-promotion-gate.mjs'),'--mode','precheck','--manifest',lease.admission_manifest,'--production-root',root,'--owner',a.owner]);
  // --execute true is the explicit mutation boundary. Default invocation only
  // validates the combined preflight and never creates an operation claim.
  if(a.execute!=='true'){
    const result=preflight();check(result.eligible,'PREFLIGHT_FAILED');
    const web=readJson(lease.admission_manifest);
    check(equalHash(web.native_candidate_manifest?.sha256,a['manifest-sha256']) &&
      path.resolve(path.dirname(lease.admission_manifest),web.native_candidate_manifest.path)===path.resolve(a['candidate-manifest']),'NATIVE_MANIFEST_NOT_LEASE_BOUND');
    const runtime=await runtimeAdapter(root,a.owner,a.lease)('snapshot');
    const inspected=inspectNativeCandidate({file:path.resolve(a['candidate-manifest']),sha256:a['manifest-sha256'],root,
      state:readJson(boundedPath(root,'.local/ro-stack/production-deployment-state.json')),authority,mode:'deploy',lease,
      owner:a.owner,leaseId:a.lease,runtime,webCapabilities:result.candidate_capabilities,webRoot:web.candidate_root,webSha:web.candidate_commit});
    check(inspected.eligible,`NATIVE_PREFLIGHT_FAILED:${inspected.errors.join(',')}`);
    console.log(JSON.stringify({eligible:true,executed:false}));return;
  }
  console.log(JSON.stringify(await executeNative({root,file:path.resolve(a['candidate-manifest']),sha256:a['manifest-sha256'],owner:a.owner,
    leaseId:a.lease,authority,adapter:runtimeAdapter(root,a.owner,a.lease),webAdmission:preflight})));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.log(JSON.stringify({result:'BLOCKED',error:e.message}));process.exitCode=1;});
