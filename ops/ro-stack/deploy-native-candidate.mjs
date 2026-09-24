#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, verifyLegacyBaseline, pendingPath } from './legacy-production-baseline.mjs';
import { inspectNativeCandidate, equalHash, nativeReceiptPath, nativeReceiptValid, pinned, git } from './native-promotion-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here,'../..');
const check = (ok,code) => {if(!ok)throw Error(code);};
const write = (file,value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const atomic = (file,value) => {const tmp=file+'.'+randomUUID()+'.tmp';write(tmp,value);fs.renameSync(tmp,file);};
function call(args) {
  const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  check(r.status===0,`ADMISSION_BLOCKED:${r.stdout.trim()}`);return JSON.parse(r.stdout);
}
export function runtimeAdapter(root, owner, leaseId) {
  return async action => {
    const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(here,'native-runtime-adapter.ps1'),
      '-Action',action,'-ProductionRoot',root,'-Owner',owner,'-LeaseId',leaseId],{encoding:'utf8',windowsHide:true,timeout:180000});
    check(r.status===0,`NATIVE_RUNTIME_${action.toUpperCase()}_FAILED`);
    return action==='snapshot'?JSON.parse(r.stdout):null;
  };
}

// The adapter boundary allows isolated lifecycle fixtures. CLI has no test-mode
// or adapter injection and accepts only the canonical Production directory.
export async function executeNative({root,file,sha256,owner,leaseId,authority,adapter,inspect=inspectNativeCandidate,webAdmission}) {
  const dir=boundedPath(root,'.local/ro-stack'), stateFile=path.join(dir,'production-deployment-state.json');
  const leaseFile=path.join(dir,'production-deployment-lease/lease.json');
  const state=readJson(stateFile),lease=readJson(leaseFile);
  check(!fs.existsSync(path.join(dir,'native-deploy.lock')),'NATIVE_DEPLOY_BUSY');
  // Durable operation claim. An interrupted attempt cannot be silently replayed.
  fs.mkdirSync(path.join(dir,'native-deploy.lock'));
  let started=false,complete=false;
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
    const receipt={schema_version:'native-deploy-v1',deploy_id:'native-'+randomUUID(),lease_id:leaseId,
      native_git_sha:candidate.manifest.native_git_sha,native_build_sha256:candidate.manifest.binary_sha256,
      candidate_manifest_sha256:sha256,previous_binary_sha256:state.current_native_binary_sha256,
      new_binary_sha256:candidate.manifest.binary_sha256,old_map_pid:before.pids.map,new_map_pid:after.pids.map,
      procdump_receipt:after.procdump_receipt,runtime_health:after,openkore_runtime_count:after.openkore_runtime_count,
      rollback_reference:candidate.manifest.rollback_reference,acceptance_status:'NATIVE_CANDIDATE_ACTIVE',artifacts,
      deployed_at:new Date().toISOString(),owner_task_id:owner};
    check(nativeReceiptValid(receipt,{nativeSha:lease.native_deploy_git_sha,leaseId,manifestHash:sha256}),'NATIVE_POSTDEPLOY_RECEIPT_INVALID');
    write(boundedPath(root,nativeReceiptPath),receipt);
    atomic(boundedPath(root,pendingPath),{...readJson(boundedPath(root,pendingPath)),native_receipt_sha256:digest(boundedPath(root,nativeReceiptPath))});
    complete=true;return receipt;
  } finally {
    // Never auto-close drift or restart again after a partial mutation. Retain
    // operation journal and exact rollback reference for owner reconciliation.
    if(!started || complete){
      const lock=path.join(dir,'native-deploy.lock');
      if(complete)fs.renameSync(lock,path.join(dir,'native-deploy-completed-'+leaseId));
      else if(!fs.readdirSync(lock).length)fs.rmdirSync(lock);
    }
  }
}

async function main(){
  const argv=process.argv.slice(2),a=Object.fromEntries(argv.flatMap((x,i)=>x.startsWith('--')?[[x.slice(2),argv[i+1]]]:[]));
  const root=path.resolve(a['production-root']||'');
  check(root.toLowerCase()==='c:\\users\\administrator\\ghost-island-production\\ro-stack','CANONICAL_ROOT_REQUIRED');
  check(a['candidate-manifest'] && a['manifest-sha256'] && a.owner && a.lease,'DEPLOY_ARGUMENTS_REQUIRED');
  check(git(sourceRoot,'status','--porcelain=v1','--untracked-files=all')==='','GOVERNANCE_SOURCE_DIRTY');
  const sha=git(sourceRoot,'rev-parse','HEAD'),url=git(sourceRoot,'remote','get-url','origin');
  check(url==='https://github.com/amadiz1988-boop/terminal-arpg.git','GOVERNANCE_REMOTE_INVALID');
  const tip=git(sourceRoot,'ls-remote','--exit-code','origin','refs/heads/main').split(/\s/)[0];
  git(sourceRoot,'fetch','--no-tags','--no-write-fetch-head','origin','refs/heads/main');git(sourceRoot,'merge-base','--is-ancestor',sha,tip);
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
