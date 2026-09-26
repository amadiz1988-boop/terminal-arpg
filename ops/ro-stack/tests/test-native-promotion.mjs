import {attachWebFixture} from './web-full-manifest-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateNative,inspectNativeCandidate,nativeReceiptValid,nativeReceiptPath,nativeArtifacts,NATIVE_REPOSITORY,groups,verifyNativeStage,verifyLifecyclePins,stagedRuntimeConfigPin,runtimeConfigNativeLineageValid } from '../native-promotion-contract.mjs';
import { evaluatePromotion,capabilityRegistry } from '../production-promotion-gate.mjs';
import { receiptComplete,commitAcceptedBaseline } from '../production-deployment-state.mjs';
import { executeNative, finalizeRunningNativeStage, NATIVE_STAGE_PHASE, reconciledPrefix } from '../deploy-native-candidate.mjs';
import { digest,readJson,FIRST_PROMOTION,LEGACY_MODE,UNKNOWN_SHA,pendingPath } from '../legacy-production-baseline.mjs';

let count=0;
async function test(name,fn){await fn();console.log(`PASS ${++count} ${name}`);}
const registry=readJson(fileURLToPath(new URL('../../../docs/project-control/production-capabilities.json',import.meta.url))).capabilities;
const ids=['skill-tree','skill-loader','original-ro-button-audio','admin-quarantine-recovery','admin-security','current-player-web','pet-runtime-presentation','dashboard-runtime',
  'native-server-agent','native-persistent-idle','native-quarantine-safe-recovery','native-stale-task-cleanup','native-stale-owner-cleanup','native-stale-target-cleanup','native-command-contract','native-graceful-shutdown','native-farm-combat-authority','native-openkore-zero'];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'native-promotion-'));
function fixture(){
  const root=fs.mkdtempSync(path.join(tmp,'case-')),buildRoot=path.join(root,'build'),source=path.join(buildRoot,'source');
  const write=(p,value)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof value==='string'?value:JSON.stringify(value));return f;};
  write('build/source/src/map/map.cpp','void MapServer::finalize(){if(map_shutdown_handoff().begin()){persistent_agent_prepare_shutdown();persistent_agent_confirm_shutdown();}map_shutdown_handoff().complete();}\nvoid MapServer::handle_shutdown(){map_shutdown_handoff().request();}');
  write('build/source/src/map/persistent_agent.cpp','bool pa_lifecycle_stopped() {} persistent_agent_state_mark_shutdown_pending(runtime.record, runtime_instance_id); persistent_agent_state_confirm_clean_shutdown(runtime.record, runtime_instance_id);');
  write('build/source/src/map/persistent_agent.hpp','fixture header');
  write('build/source/src/map/persistent_agent_state.cpp',"`runtime_state`='SHUTDOWN_PENDING' `runtime_state`='CLEAN_SHUTDOWN'");
  write('build/source/.gitignore','*-server.exe\n');
  const git=(...args)=>execFileSync('git',args,{cwd:source,encoding:'utf8',windowsHide:true}).trim();
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
  git('add','--','.gitignore','src/map/map.cpp','src/map/persistent_agent.cpp','src/map/persistent_agent.hpp','src/map/persistent_agent_state.cpp');git('commit','-qm','isolated source contract');
  const sha=git('rev-parse','HEAD'),web='a'.repeat(40);
  const pin=p=>({path:p,sha256:digest(path.join(buildRoot,p))});
  const artifacts=['login','char','map'].map(n=>({path:n+'-server.exe',sha256:digest(write('build/source/'+n+'-server.exe','candidate-'+n))}));
  const suites=[...new Set(Object.values(groups))].map((test_suite,i)=>({test_suite,result:'PASS',receipt:{path:'logs/'+i+'.txt',sha256:digest(write('build/logs/'+i+'.txt','isolated suite passed'))}}));
  const build={schema_version:'native-build-v1',build_id:'fixture',built_at:'fixture-time',native_git_sha:sha,canonical_repository:NATIVE_REPOSITORY,canonical_branch:'main',build_configuration:'Release x64',toolchain:{version:'fixture'},binary_path:'source/map-server.exe',binary_sha256:artifacts[2].sha256,source_root:source,source_tree_state:'CLEAN',artifacts,tests_run:suites,tests_result:'PASS',build_log:{path:'build.log',sha256:digest(write('build/build.log','fixture build'))}};
  write('build/build-receipt.json',build);
  write('build/native-regression.json',{native_git_sha:sha,result:'PASS',groups:Object.entries(groups).map(([group,test_suite])=>({group,test_suite,result:'PASS',receipt:suites.find(x=>x.test_suite===test_suite).receipt})),shutdown_source_contract:{result:'PASS',files:['map.cpp','persistent_agent.cpp','persistent_agent_state.cpp'].map(n=>({path:'src/map/'+n,sha256:digest(path.join(source,'src/map/'+n))}))}});
  const old=nativeArtifacts.map(p=>({path:p,sha256:digest(write(p,'legacy-'+path.basename(p)))}));
  const webFiles=[{path:'ops/ro-stack/dashboard/app.js',sha256:digest(write('ops/ro-stack/dashboard/app.js','legacy-web'))}];
  const state={schema_version:2,baseline_mode:LEGACY_MODE,historical_provenance:'UNRESOLVED',current_deploy_id:'LEGACY_BOOTSTRAP_0123456789abcdef',current_web_git_sha:UNKNOWN_SHA,current_native_git_sha:UNKNOWN_SHA,legacy_bootstrap_available:true,production_drift:'CLOSED',accepted_capabilities:ids,current_web_artifact_manifest:'baseline/web.json',current_web_manifest_sha256:digest(write('baseline/web.json',{files:webFiles})),accepted_capability_manifest:'baseline/caps.json',accepted_capability_manifest_sha256:digest(write('baseline/caps.json',{capabilities:ids.map(id=>({id}))})),native_binaries:old,current_native_binary_path:nativeArtifacts[2],current_native_binary_sha256:old[2].sha256,legacy_rollback:{root:'rollback',web_manifest:'rollback-web.json'}};
  write('rollback-web.json',{files:webFiles});for(const e of [...webFiles,...old])write('rollback/'+e.path,fs.readFileSync(path.join(root,e.path),'utf8'));
  write('.local/ro-stack/production-deployment-state.json',state);
  const comparison={native_git_sha:sha,baseline_sha256:state.accepted_capability_manifest_sha256,capabilities:ids.map(id=>({id,classification:'PRESERVED',source_paths:registry.find(x=>x.id===id).source_paths}))};write('build/capability-comparison.json',comparison);
  const m={schema_version:'native-candidate-v1',candidate_id:'fixture',native_git_sha:sha,binary_sha256:build.binary_sha256,build_receipt:pin('build-receipt.json'),regression:pin('native-regression.json'),canonical_repository:NATIVE_REPOSITORY,canonical_branch:'main',required_database:'ragnarok',required_runtime_ports:[6901,6122,5122,8788],required_openkore_count:0,required_capability_baseline:{path:state.accepted_capability_manifest,sha256:state.accepted_capability_manifest_sha256},capability_comparison:pin('capability-comparison.json'),rollback_reference:{root:'rollback',current_native_binary_sha256:state.current_native_binary_sha256},lifecycle_files:['ro-stack.ps1','stack.config.psd1','runtime-guard.ps1','runtime-guard.lib.ps1','graceful-console-signal.ps1'].map(n=>{const p='ops/ro-stack/'+n;return {path:p,sha256:digest(write(p,'fixture lifecycle'))};})};
  const file=write('build/candidate.json',m);let hash=digest(file);
  const lease={lease_id:'fixture-lease',owner_task_id:'F',status:'ACTIVE',promotion_mode:FIRST_PROMOTION,native_deploy_git_sha:sha,web_deploy_git_sha:web,native_candidate_manifest_sha256:hash,candidate_capabilities:ids,admission_manifest:write('web.json',{candidate_root:source,candidate_commit:web,native_candidate_manifest:{path:'build/candidate.json',sha256:hash}})};lease.admission_manifest_sha256=digest(lease.admission_manifest);
  write('.local/ro-stack/production-deployment-lease/lease.json',lease);
  const runtime={pass:true,counts:{login:1,char:1,map:1},pids:{login:11,char:12,map:13},dashboard_pid:14,database_pid:15,openkore_runtime_count:0,procdump_receipt:{mapPid:13,procdumpAttachStatus:'ATTACHED'}};
  const options=()=>({file,sha256:hash,root,state,authority:{accepted_source_sha:sha},webCapabilities:ids,remoteVerifier:()=>true,mode:'deploy',lease,owner:'F',leaseId:lease.lease_id,runtime});
  const rewrite=()=>{write('build/candidate.json',m);hash=digest(file);lease.native_candidate_manifest_sha256=hash;};
  const inspect=patch=>inspectNativeCandidate({...options(),...patch});
  return {root,source,buildRoot,build,m,lease,runtime,state,sha,web,write,pin,file,options,inspect,rewrite,comparison,webFiles};
}
function rejected(f,patch,code){let r;try{r=f.inspect(patch);}catch(e){assert.match(e.message,code);return;}assert.equal(r.eligible,false);assert.match(r.errors.join(','),code);}
try {
 const f=fixture();
 await test('new governance registry admits inspection of earlier gameplay SHA',()=>{
   const git=(...args)=>execFileSync('git',args,{cwd:f.source,encoding:'utf8',windowsHide:true}).trim();
   f.write('build/source/docs/project-control/production-capabilities.json',{capabilities:ids.map(id=>({id}))});
   git('add','--','docs/project-control/production-capabilities.json');git('commit','-qm','later governance fixture');
   assert.equal(capabilityRegistry(f.source,f.sha,f.source,FIRST_PROMOTION).capabilities.length,18);
   assert.throws(()=>capabilityRegistry(f.source,f.sha,f.source,'NORMAL'),/GIT_FAILED:show/);
   // Return to the earlier tracked fixture with a detached checkout. No changes
   // are discarded: both commits remain available in this isolated temp repo.
   git('checkout','--detach','-q',f.sha);
 });
 await test('1 canonical source and clean receipt valid',()=>assert.equal(f.inspect().eligible,true));
 await test('2 noncanonical remote SHA blocked',()=>rejected(f,{remoteVerifier:()=>false},/NOT_CANONICAL/));
 await test('3 changed candidate binary blocked',()=>{f.write('build/source/map-server.exe','tampered');rejected(f,{},/BINARY_MISMATCH/);f.write('build/source/map-server.exe','candidate-map');});
 await test('4 dirty source receipt blocked',()=>{const b={...f.build,source_tree_state:'DIRTY'};f.write('build/build-receipt.json',b);f.m.build_receipt=f.pin('build-receipt.json');f.rewrite();rejected(f,{},/SOURCE_DIRTY/);f.write('build/build-receipt.json',f.build);f.m.build_receipt=f.pin('build-receipt.json');f.rewrite();});
 await test('5 missing rollback blocked',()=>{const p=path.join(f.root,'rollback',nativeArtifacts[2]);fs.renameSync(p,p+'.held');rejected(f,{},/ENOENT|ROLLBACK/);fs.renameSync(p+'.held',p);});
 for(const [i,classification] of [[6,'MISSING'],[7,'UNKNOWN']])await test(i+' capability '+classification+' blocked',()=>{f.comparison.capabilities[0].classification=classification;f.write('build/capability-comparison.json',f.comparison);f.m.capability_comparison=f.pin('capability-comparison.json');f.rewrite();rejected(f,{},/SUPERSET/);f.comparison.capabilities[0].classification='PRESERVED';f.write('build/capability-comparison.json',f.comparison);f.m.capability_comparison=f.pin('capability-comparison.json');f.rewrite();});
 await test('8 unrelated OPEN drift blocked',()=>rejected(f,{state:{...f.state,production_drift:'OPEN'}},/DRIFT_OPEN/));
 await test('9 absent lease blocked',()=>rejected(f,{lease:null},/LEASE/));
 await test('10 wrong owner blocked',()=>rejected(f,{owner:'OTHER'},/LEASE/));
 const asset={repository:'amadiz1988-boop/ghost-island-assets',immutable_required:true,release_id:1,release_tag:'test',package_id:'test',package_version:'1',asset_count:1,package_sha256:'1'.repeat(64),manifest_sha256:'2'.repeat(64),archive:{sha256:'3'.repeat(64)}};
 const webCandidate={sha:f.web,head:f.web,commitExists:true,pushed:true,nativePushed:true,dirty:false,fullManifestPass:true,requiredFilesTracked:true,firstPromotionEvidencePass:true,nativeCandidatePass:f.inspect({mode:'precheck'}).eligible,repository:'https://github.com/example/web.git',ref:'refs/heads/main',capabilities:ids,owner:'F',nativeSha:f.sha,assetPackage:{...asset,available:true,private:true,immutable:true,valid:true,archive_sha256:asset.archive.sha256}};
 const combined=patch=>evaluatePromotion({authority:{web:{repository:webCandidate.repository,release_ref:webCandidate.ref},assets:asset},candidate:webCandidate,state:f.state,currentHashes:{pass:true,rollbackReady:true},lease:null,mode:'acquire',promotionMode:FIRST_PROMOTION,...patch});
 await test('11 valid combined preflight eligible for lease',()=>assert.equal(combined().eligible,true));
 await test('12 manifest tampering blocked',()=>{f.write('build/candidate.json',{...f.m,required_openkore_count:1});rejected(f,{},/MANIFEST_TAMPERED/);f.write('build/candidate.json',f.m);});
 await test('13 missing Native receipt forbids baseline transition',()=>{assert.equal(receiptComplete({first_github_first_gates:{}},f.root),false);assert.throws(()=>commitAcceptedBaseline(f.root,f.state,f.lease,{native_git_sha:f.sha}),/RECEIPT/);});
 await test('14 second stack blocked',()=>rejected(f,{runtime:{...f.runtime,counts:{login:1,char:1,map:2}}},/SINGLE_RUNTIME/));
 await test('15 OpenKore nonzero requirement blocked',()=>{f.m.required_openkore_count=1;f.rewrite();rejected(f,{},/OPENKORE/);f.m.required_openkore_count=0;f.rewrite();});
 await test('missing Native gate blocks combined admission',()=>assert.equal(combined({candidate:{...webCandidate,nativeCandidatePass:false}}).eligible,false));
 await test('Web deployment cannot precede Native receipt',()=>assert.ok(combined({mode:'deploy',lease:f.lease}).errors.includes('NATIVE_STAGE_RECEIPT_REQUIRED')));
 await test('suite log mutation invalidates receipt',()=>{const p=path.join(f.buildRoot,f.build.tests_run[0].receipt.path);const old=fs.readFileSync(p);fs.writeFileSync(p,'changed');rejected(f,{},/PINNED_CONTENT_CHANGED/);fs.writeFileSync(p,old);});
 await test('untracked source file invalidates clean build',()=>{const p=f.write('build/source/untracked.txt','unapproved');rejected(f,{},/SOURCE_DIRTY/);fs.unlinkSync(p);});
 await test('lifecycle pin mutation blocks',()=>{const p=path.join(f.root,'ops/ro-stack/ro-stack.ps1');const old=fs.readFileSync(p);fs.writeFileSync(p,'changed lifecycle');rejected(f,{},/PINNED_CONTENT_CHANGED/);fs.writeFileSync(p,old);});
 await test('verified staged Web preimage admits changed lifecycle bytes',()=>{
   const p='ops/ro-stack/ro-stack.ps1',file=path.join(f.root,p),old=fs.readFileSync(file);
   fs.writeFileSync(file,'approved Web lifecycle');
   try {
     const manifest={files:f.m.lifecycle_files.map(item=>({
       path:item.path,production_preimage_sha256:digest(path.join(f.root,item.path))
     }))};
     assert.equal(f.inspect({stagedWebManifest:manifest}).eligible,true);
     assert.throws(()=>verifyLifecyclePins(f.root,f.m.lifecycle_files,{files:manifest.files.filter(row=>row.path!==p)}),/PINNED_CONTENT_CHANGED/);
     assert.throws(()=>verifyLifecyclePins(f.root,f.m.lifecycle_files,{files:manifest.files.map(row=>row.path===p?{...row,production_preimage_sha256:'0'.repeat(64)}:row)}),/STAGED_WEB_LIFECYCLE_PREIMAGE_CHANGED/);
     rejected(f,{},/PINNED_CONTENT_CHANGED/);
   } finally { fs.writeFileSync(file,old); }
 });
 await test('sealed same-lease runtime config receipt admits only its pinned config',()=>{
   const p='ops/ro-stack/stack.config.psd1',file=path.join(f.root,p),old=fs.readFileSync(file);
   fs.writeFileSync(file,'approved runtime config');
   try {
     const ref='.local/ro-stack/runtime-config-reconciliation-fixture.json';
     const receipt={schema_version:'runtime-config-reconciliation-v1',classification:'RUNTIME_CONFIG_RECONCILED',
       lease_id:f.lease.lease_id,lease_owner:f.lease.owner_task_id,native_git_sha:f.sha,
       config_source_path:p,old_config_digest:f.m.lifecycle_files.find(item=>item.path===p).sha256,
       new_config_digest:digest(file),unrelated_config_change_count:0};
     f.write(ref,receipt);
     const sha=digest(path.join(f.root,ref));
     f.write(pendingPath,{runtime_config_reconciliation:ref,runtime_config_reconciliation_sha256:sha});
     const state={...f.state,runtime_config_reconciliation:ref,runtime_config_reconciliation_sha256:sha};
     const pin=stagedRuntimeConfigPin(f.root,state,f.lease),manifest={files:[]};
     verifyLifecyclePins(f.root,f.m.lifecycle_files,manifest,pin);
     verifyLifecyclePins(f.root,f.m.lifecycle_files.map(item=>item.path===p
       ? {...item,sha256:pin.sha256} : item),manifest,pin);
     assert.throws(()=>verifyLifecyclePins(f.root,f.m.lifecycle_files,manifest,{...pin,sha256:'0'.repeat(64)}),/STAGED_RUNTIME_CONFIG_CHANGED/);
     assert.throws(()=>verifyLifecyclePins(f.root,f.m.lifecycle_files,manifest,{...pin,oldSha256:'0'.repeat(64)}),/STAGED_RUNTIME_CONFIG_CHANGED/);
     assert.throws(()=>stagedRuntimeConfigPin(f.root,{...state,runtime_config_reconciliation_sha256:'0'.repeat(64)},f.lease),/RUNTIME_CONFIG_RECEIPT_REFERENCE_MISMATCH/);
     assert.throws(()=>verifyLifecyclePins(f.root,f.m.lifecycle_files,manifest),/PINNED_CONTENT_CHANGED/);
   } finally { fs.writeFileSync(file,old); }
 });
 await test('sealed service allowlist receipt extends the staged runtime config pin',()=>{
   const x=fixture(),p='ops/ro-stack/stack.config.psd1',file=path.join(x.root,p);
   fs.writeFileSync(file,'approved runtime config');
   const baseHash=digest(file),baseRef='.local/ro-stack/runtime-config-reconciliation-chain.json';
   x.write(baseRef,{schema_version:'runtime-config-reconciliation-v1',
     classification:'RUNTIME_CONFIG_RECONCILED',lease_id:x.lease.lease_id,
     lease_owner:x.lease.owner_task_id,native_git_sha:x.sha,config_source_path:p,
     config_source_digest:'B'.repeat(64),old_config_digest:x.m.lifecycle_files.find(item=>item.path===p).sha256,
     new_config_digest:baseHash,unrelated_config_change_count:0});
   fs.writeFileSync(file,'approved runtime config with service allowlists');
   const allowRef='.local/ro-stack/native-service-allowlist-chain.json';
   x.write(allowRef,{schema_version:'native-service-allowlist-config-v1',
     lease_id:x.lease.lease_id,owner_task_id:x.lease.owner_task_id,
     native_git_sha:x.sha,web_git_sha:x.lease.web_deploy_git_sha,
     source_path:p,destination_path:p,preimage_sha256:baseHash,image_sha256:digest(file),
     source_sha256:'B'.repeat(64),unrelated_changes:0,
     changes:[{key:'PersistentAgentServiceMapAllowlist'},{key:'PersistentAgentServiceNpcAllowlist'}],
     preserved_overrides:['PersistentAgentM1SupplyEnabled','WebM1AcceptanceFixtureEnabled',
       'WebNativeSupplyPolicyEnabled']});
   const allowlist={receipt:allowRef,sha256:digest(path.join(x.root,allowRef))};
   const lease={...x.lease,native_service_allowlist_config:allowlist};
   const refSha=digest(path.join(x.root,baseRef));
   x.write(pendingPath,{runtime_config_reconciliation:baseRef,
     runtime_config_reconciliation_sha256:refSha,native_service_allowlist_config:allowlist});
   const state={...x.state,runtime_config_reconciliation:baseRef,
     runtime_config_reconciliation_sha256:refSha};
   const pin=stagedRuntimeConfigPin(x.root,state,lease);
   assert.equal(pin.sha256,digest(file));
   verifyLifecyclePins(x.root,x.m.lifecycle_files,{files:[]},pin);
   assert.throws(()=>stagedRuntimeConfigPin(x.root,state,
     {...lease,native_service_allowlist_config:undefined}),/RUNTIME_CONFIG_ALLOWLIST_RECEIPT_MISSING/);
   x.write(allowRef,{tampered:true});
   assert.throws(()=>stagedRuntimeConfigPin(x.root,state,lease),/PINNED_CONTENT_CHANGED/);
 });
 await test('runtime config pin follows only an intact same-lease Native amendment chain',()=>{
   const x=fixture(),next='b'.repeat(40),auditPath='.local/ro-stack/native-amendment-audit.json';
   const audit={lease_id:x.lease.lease_id,lease_owner:x.lease.owner_task_id,
     old_native_git_sha:x.sha,new_native_git_sha:next,reason:'M1_INVENTORY_MAINTENANCE_V1'};
   x.write(auditPath,audit);
   const entry={old_native_git_sha:x.sha,new_native_git_sha:next,reason:audit.reason,
     audit_receipt:auditPath,audit_sha256:digest(path.join(x.root,auditPath))};
   const lease={...x.lease,native_deploy_git_sha:next,native_candidate_amendments:[entry],
     active_native_candidate:{native_git_sha:next,deployed:true}};
   const pending={native_candidate_amendments:[entry]};
   assert.equal(runtimeConfigNativeLineageValid(x.root,lease,pending,x.sha),true);
   assert.equal(runtimeConfigNativeLineageValid(x.root,lease,pending,'c'.repeat(40)),false);
   assert.equal(runtimeConfigNativeLineageValid(x.root,lease,
     {native_candidate_amendments:[]},x.sha),false);
   x.write(auditPath,{...audit,reason:'UNAPPROVED'});
   assert.equal(runtimeConfigNativeLineageValid(x.root,lease,pending,x.sha),false);
 });
 await test('unapproved supersession blocks',()=>{f.comparison.capabilities[0].classification='INTENTIONALLY_SUPERSEDED';f.write('build/capability-comparison.json',f.comparison);f.m.capability_comparison=f.pin('capability-comparison.json');f.rewrite();rejected(f,{},/SUPERSET/);});
 await test('isolated Native replacement to Web continuation and final receipt',async()=>{
   const x=fixture(),actions=[];let running=true;
   const adapter=async action=>{actions.push(action);if(action==='stop'){assert.equal(readJson(path.join(x.root,'.local/ro-stack/production-deployment-state.json')).production_drift,'OPEN');running=false;return;}
     if(action==='start'){assert.equal(running,false);for(const a of x.build.artifacts)assert.equal(digest(path.join(x.root,'.local/ro-stack/rathena',a.path)),a.sha256);running=true;return;}
     return actions.includes('start')?{...x.runtime,pids:{login:21,char:22,map:23},procdump_receipt:{mapPid:23,procdumpAttachStatus:'ATTACHED'}}:x.runtime;};
   const result=await executeNative({root:x.root,file:x.file,sha256:digest(x.file),owner:'F',leaseId:x.lease.lease_id,authority:{accepted_source_sha:x.sha},adapter,
     inspect:options=>inspectNativeCandidate({...options,remoteVerifier:()=>true}),webAdmission:async()=>({eligible:true,candidate_capabilities:ids})});
   assert.equal(nativeReceiptValid(result),true);assert.deepEqual(actions,['snapshot','stop','start','snapshot']);
   const state=readJson(path.join(x.root,'.local/ro-stack/production-deployment-state.json'));
   const stage=verifyNativeStage(x.root,state,x.lease,x.lease.admission_manifest_sha256);assert.equal(stage.nativeStage,true);
   assert.equal(combined({state,currentHashes:stage,lease:x.lease,mode:'deploy',candidate:{...webCandidate,nativeSha:x.sha}}).eligible,true);
   assert.equal(verifyNativeStage(x.root,state,{...x.lease,owner_task_id:'OTHER'},x.lease.admission_manifest_sha256).pass,false);
   assert.equal(verifyNativeStage(x.root,{...state,drift_reason:'OUT_OF_BAND'},x.lease,x.lease.admission_manifest_sha256).pass,false);
   x.write('ops/ro-stack/dashboard/app.js','unapproved');assert.equal(verifyNativeStage(x.root,state,x.lease,x.lease.admission_manifest_sha256).pass,false);x.write('ops/ro-stack/dashboard/app.js','legacy-web');
   const receipt={result:'PROMOTED',deploy_id:'fixture-final',deployed_at:'fixture',owner_task_id:'F',lease_id:x.lease.lease_id,web_git_sha:x.web,native_git_sha:x.sha,canonical_product_checkpoint:x.web,github_remote:'https://github.com/example/web.git',github_ref:'refs/heads/main',web_build_manifest:x.state.current_web_artifact_manifest,web_build_manifest_sha256:x.state.current_web_manifest_sha256,native_build_sha256:x.m.binary_sha256,native_artifact_path:nativeArtifacts[2],runtime_pids:[21,22,23,14],openkore_runtime_count:0,live_acceptance_results:{pass:true},rollback_artifact:'rollback',files:x.webFiles,accepted_capabilities:ids,first_github_first_gates:Object.fromEntries(['source_regression','native_build','asset_hash','rollback','single_owner','procdump','runtime_health','live_acceptance'].map(k=>[k,{pass:true,evidence:'fixture-only'}])),native_deployment_receipt:{path:nativeReceiptPath,sha256:digest(path.join(x.root,nativeReceiptPath))}};
   attachWebFixture(x.root,receipt,x.lease);
   assert.equal(receiptComplete({...receipt,native_deployment_receipt:null},x.root),false);
   assert.equal(commitAcceptedBaseline(x.root,state,x.lease,receipt).baseline_mode,'GITHUB_FIRST');
 });
 await test('candidate deploy carries exact command contract and rollback preimage',async()=>{
   const x=fixture(),contract='conf/persistent_agent_commands.json';
   const configBytes='{ "contractVersion": 1 }\n',oldBytes='{ "contractVersion": 0 }\n';
   x.write('build/source/'+contract,configBytes);
   x.write('.local/ro-stack/rathena/'+contract,oldBytes);
   const item={source_path:contract,candidate_package_path:'source/'+contract,
     source_git_sha:x.sha,source_blob_oid:'a'.repeat(40),sha256:digest(path.join(x.source,contract))};
   x.build.config_artifacts=[item];x.m.config_artifacts=[item];
   x.write('build/build-receipt.json',x.build);x.m.build_receipt=x.pin('build-receipt.json');x.rewrite();
   const manifestHash=digest(x.file),web=readJson(x.lease.admission_manifest);
   web.native_candidate_manifest.sha256=manifestHash;x.write('web.json',web);
   x.lease.native_candidate_manifest_sha256=manifestHash;
   x.lease.admission_manifest_sha256=digest(x.lease.admission_manifest);
   x.write('.local/ro-stack/production-deployment-lease/lease.json',x.lease);
   let running=true;
   const adapter=async action=>{
     if(action==='stop'){running=false;return;}
     if(action==='start'){
       assert.equal(running,false);
       assert.equal(fs.readFileSync(path.join(x.root,'.local/ro-stack/rathena',contract),'utf8'),configBytes);
       running=true;return;
     }
     return running&&fs.readFileSync(path.join(x.root,'.local/ro-stack/rathena',contract),'utf8')===configBytes
       ? {...x.runtime,pids:{login:21,char:22,map:23},procdump_receipt:{mapPid:23,procdumpAttachStatus:'ATTACHED'}}
       : x.runtime;
   };
   const receipt=await executeNative({root:x.root,file:x.file,sha256:manifestHash,owner:'F',leaseId:x.lease.lease_id,
     authority:{accepted_source_sha:x.sha},adapter,
     inspect:()=>({eligible:true,errors:[],build:x.build,manifest:x.m,source:x.source}),
     webAdmission:async()=>({eligible:true,candidate_capabilities:ids})});
   assert.equal(receipt.config_artifacts.length,1);
   assert.equal(receipt.config_artifacts[0].sha256,item.sha256);
   assert.equal(digest(path.join(x.root,receipt.config_artifacts[0].rollback_path)),digest(x.write('fixture-old-contract.json',oldBytes)));
   assert.equal(verifyNativeStage(x.root,readJson(path.join(x.root,'.local/ro-stack/production-deployment-state.json')),
     x.lease,x.lease.admission_manifest_sha256).pass,true);
 });
 await test('failed controlled stop retains OPEN state and owner without replacement',async()=>{
   const x=fixture(),actions=[];
   await assert.rejects(executeNative({root:x.root,file:x.file,sha256:digest(x.file),owner:'F',leaseId:x.lease.lease_id,authority:{accepted_source_sha:x.sha},
     adapter:async a=>{actions.push(a);if(a==='stop')throw Error('fixture stop failure');return x.runtime;},inspect:o=>inspectNativeCandidate({...o,remoteVerifier:()=>true}),webAdmission:async()=>({eligible:true,candidate_capabilities:ids})}),/stop failure/);
   assert.deepEqual(actions,['snapshot','stop']);assert.equal(readJson(path.join(x.root,'.local/ro-stack/production-deployment-state.json')).production_drift,'OPEN');
   assert.equal(digest(path.join(x.root,nativeArtifacts[2])),x.state.current_native_binary_sha256);assert.equal(fs.existsSync(path.join(x.root,'.local/ro-stack/native-deploy.lock')),true);
   const operation=readJson(path.join(x.root,'.local/ro-stack/native-deploy.lock/operation.json'));
   assert.equal(operation.owner_task_id,'F');assert.equal(operation.lease_id,x.lease.lease_id);assert.equal(operation.candidate_manifest_sha256,digest(x.file));
 });
 const OWNER_U='F｜M1 最終整合';
 const readState=root=>readJson(path.join(root,'.local/ro-stack/production-deployment-state.json'));
 async function failedStage(owner=OWNER_U){
   const x=fixture();
   x.lease.owner_task_id=owner;x.lease.acquired_at=new Date(Date.now()-60000).toISOString();
   const ev=x.write('first-evidence.json',{native_git_sha:x.sha,web_git_sha:x.web,runtime_health_gate:{pass:true,evidence:'Same snapshot: login 11, char 12, map 13 each one listener; OpenKore 0'}});
   x.write('web.json',{...readJson(x.lease.admission_manifest),candidate_commit:x.web,candidate_native_commit:x.sha,first_promotion_evidence:{path:'first-evidence.json',sha256:digest(ev)}});
   x.lease.admission_manifest_sha256=digest(x.lease.admission_manifest);
   x.write('.local/ro-stack/production-deployment-lease/lease.json',x.lease);
   const inspect=o=>inspectNativeCandidate({...o,remoteVerifier:()=>true});
   await assert.rejects(executeNative({root:x.root,file:x.file,sha256:digest(x.file),owner,leaseId:x.lease.lease_id,authority:{accepted_source_sha:x.sha},
     adapter:async a=>{if(a==='start')throw Error('NATIVE_RUNTIME_START_FAILED');return a==='snapshot'?x.runtime:null;},inspect,
     webAdmission:async()=>({eligible:true,candidate_capabilities:ids})}),/NATIVE_RUNTIME_START_FAILED/);
   const failedOutput=x.write('native-deploy.out.json',{result:'BLOCKED',error:'NATIVE_RUNTIME_START_FAILED'});
   const later=new Date(Date.now()+5000).toISOString(),exe=n=>path.join(x.root,'.local/ro-stack/rathena',n+'-server.exe');
   const snapshot={pass:true,counts:{login:1,char:1,map:1},pids:{login:21,char:22,map:23},
     processes:Object.fromEntries([['login',21],['char',22],['map',23]].map(([n,pid])=>[n,{pid,executable_path:exe(n),started_at:later}])),
     dashboard_pid:14,database_pid:15,openkore_runtime_count:0,
     procdump_receipt:{mapPid:23,procdumpAttachedPid:23,procdumpAttachStatus:'ATTACHED',mapBinarySha256:x.m.binary_sha256},
     procdump_process_identity:{PROCESS_IDENTITY_MATCH:'YES',target_pid:23,procdump_target_pid:23}};
   const args=patch=>({root:x.root,file:x.file,sha256:digest(x.file),owner,leaseId:x.lease.lease_id,authority:{accepted_source_sha:x.sha},
     failedOutput,oldPids:{login:11,char:12,map:13},snapshot,apiHealth:{status:200,ok:true},governanceSha:'d'.repeat(40),inspect,...patch});
   return {...x,owner,failedOutput,snapshot,args,lock:path.join(x.root,'.local/ro-stack/native-deploy.lock')};
 }
 const noStageWritten=s=>{assert.equal(fs.existsSync(path.join(s.root,nativeReceiptPath)),false);assert.equal(fs.existsSync(s.lock),true);
   assert.equal(readJson(path.join(s.root,pendingPath)).native_receipt_sha256,undefined);assert.equal(readState(s.root).first_promotion_phase,undefined);};
 const s=await failedStage();
 const blocked=(patch,code)=>{assert.throws(()=>finalizeRunningNativeStage(s.args(patch)),code);noStageWritten(s);};
 await test('reconcile 1 tool failed but exact candidate runtime healthy is eligible',()=>{
   const r=finalizeRunningNativeStage(s.args({dryRun:true}));assert.equal(r.eligible,true);assert.equal(r.receipt.tool_initial_result,'NATIVE_RUNTIME_START_FAILED');noStageWritten(s);});
 await test('reconcile 2 binary mismatch blocked',()=>{const p=path.join(s.root,'.local/ro-stack/rathena/char-server.exe');const old=fs.readFileSync(p);
   fs.writeFileSync(p,'other');blocked({},/NATIVE_BINARY_MISMATCH/);fs.writeFileSync(p,old);});
 await test('reconcile 3 wrong Native Git SHA blocked',()=>blocked({authority:{accepted_source_sha:'e'.repeat(40)}},/NATIVE_SHA_NOT_CANONICAL/));
 await test('reconcile 4 wrong lease id blocked',()=>blocked({leaseId:'other-lease'},/LEASE_ID_MISMATCH/));
 await test('reconcile 5 wrong Unicode owner blocked',()=>blocked({owner:'F｜M1 最終整理'},/LEASE_OWNER_MISMATCH/));
 await test('reconcile 6 released lease blocked',()=>{const d=path.join(s.root,'.local/ro-stack/production-deployment-lease');fs.renameSync(d,d+'.held');
   assert.throws(()=>finalizeRunningNativeStage(s.args()),/DEPLOYMENT_LEASE_REQUIRED/);fs.renameSync(d+'.held',d);noStageWritten(s);});
 await test('reconcile 7 Web already partially deployed blocked',()=>{s.write('ops/ro-stack/dashboard/app.js','partial-web');blocked({},/WEB_OR_NATIVE_BYTES_CHANGED/);
   s.write('ops/ro-stack/dashboard/app.js','legacy-web');const d=path.join(s.root,'.local/ro-stack/dashboard/deploy-receipts/manifest-fixture');fs.mkdirSync(d,{recursive:true});
   blocked({},/WEB_STAGE_ALREADY_STARTED/);fs.rmSync(path.dirname(d),{recursive:true});});
 await test('reconcile 8 ProcDump invalid blocked',()=>{blocked({snapshot:{...s.snapshot,procdump_process_identity:{...s.snapshot.procdump_process_identity,PROCESS_IDENTITY_MATCH:'NO'}}},/PROCDUMP_GATE_FAILED/);
   blocked({snapshot:{...s.snapshot,procdump_process_identity:{...s.snapshot.procdump_process_identity,procdump_target_pid:99}}},/PROCDUMP_GATE_FAILED/);});
 await test('reconcile 9 OpenKore above zero blocked',()=>blocked({snapshot:{...s.snapshot,openkore_runtime_count:1}},/SINGLE_RUNTIME|OPENKORE/));
 await test('reconcile 10 duplicate map runtime blocked',()=>blocked({snapshot:{...s.snapshot,pass:false,counts:{login:1,char:1,map:2}}},/SINGLE_RUNTIME/));
 await test('reconcile 11 healthy runtime with executable path mismatch blocked',()=>{
   const moved={...s.snapshot,processes:{...s.snapshot.processes,map:{...s.snapshot.processes.map,executable_path:'C:\\other\\map-server.exe'}}};
   blocked({snapshot:moved},/RUNTIME_BINARY_PATH_OR_START_MISMATCH/);
   const early={...s.snapshot,processes:{...s.snapshot.processes,map:{...s.snapshot.processes.map,started_at:'2020-01-01T00:00:00.000Z'}}};
   blocked({snapshot:early},/RUNTIME_BINARY_PATH_OR_START_MISMATCH/);});
 await test('reconcile old PID, API and tool result bindings blocked',()=>{blocked({oldPids:{login:11,char:12,map:14}},/OLD_RUNTIME_PIDS_MISMATCH/);
   blocked({apiHealth:{status:500,ok:false}},/API_UNHEALTHY/);
   const other=s.write('other.out.json',{result:'BLOCKED',error:'NATIVE_RUNTIME_STOP_FAILED'});blocked({failedOutput:other},/FAILED_TOOL_OUTPUT_NOT_START_FAILURE/);});
 await test('reconcile 16 failed reconciliation leaves no receipt',()=>noStageWritten(s));
 const operationSha=digest(path.join(s.lock,'operation.json')),outputSha=digest(s.failedOutput),leaseSha=digest(path.join(s.root,'.local/ro-stack/production-deployment-lease/lease.json'));
 await test('reconcile 12 exact valid reconciliation generates Native stage receipt',()=>{
   finalizeRunningNativeStage(s.args());const r=readJson(path.join(s.root,nativeReceiptPath));
   assert.equal(nativeReceiptValid(r,{nativeSha:s.sha,leaseId:s.lease.lease_id,manifestHash:digest(s.file)}),true);
   assert.equal(r.tool_initial_result,'NATIVE_RUNTIME_START_FAILED');assert.equal(r.reconciliation_result,'RUNTIME_ACTUALLY_STARTED_AND_VERIFIED');
   assert.equal(r.owner_task_id,OWNER_U);assert.deepEqual(r.old_pids,{login:11,char:12,map:13});assert.deepEqual(r.new_pids,{login:21,char:22,map:23});
   assert.match(r.reconciliation_evidence_digest,/^[A-F0-9]{64}$/);assert.equal(r.first_promotion_complete,false);
   assert.equal(readJson(path.join(s.root,pendingPath)).native_receipt_sha256,digest(path.join(s.root,nativeReceiptPath)));});
 await test('reconcile 13 Native stage receipt keeps legacy baseline and lease',()=>{const st=readState(s.root);
   assert.equal(st.baseline_mode,LEGACY_MODE);assert.equal(st.production_drift,'OPEN');assert.equal(st.drift_reason,'FIRST_PROMOTION_PENDING_FINAL_RECEIPT');
   assert.equal(st.first_promotion_phase,NATIVE_STAGE_PHASE);assert.equal(digest(path.join(s.root,'.local/ro-stack/production-deployment-lease/lease.json')),leaseSha);});
 await test('reconcile 14 same active lease can resume Web stage',()=>{const st=readState(s.root);
   const stage=verifyNativeStage(s.root,st,s.lease,s.lease.admission_manifest_sha256);assert.equal(stage.nativeStage,true);
   assert.equal(combined({state:st,currentHashes:stage,lease:s.lease,mode:'deploy',candidate:{...webCandidate,owner:OWNER_U,nativeSha:s.sha}}).eligible,true);
   const begin=spawnSync(process.execPath,[fileURLToPath(new URL('../production-deployment-state.mjs',import.meta.url)),'--production-root',s.root,'--test-mode','true','--owner',OWNER_U,'--action','begin-first-promotion'],{encoding:'utf8',windowsHide:true});
   assert.equal(begin.status,0,begin.stdout);assert.equal(fs.existsSync(path.join(s.root,'.local/ro-stack/production-deployment-lease/lease.json')),true);});
 await test('reconcile 15 second Native replacement after reconciled stage blocked',async()=>{
   await assert.rejects(executeNative({root:s.root,file:s.file,sha256:digest(s.file),owner:OWNER_U,leaseId:s.lease.lease_id,authority:{accepted_source_sha:s.sha},
     adapter:async()=>{throw Error('adapter must not run');},webAdmission:async()=>({eligible:true,candidate_capabilities:ids})}),/NATIVE_STAGE_ALREADY_RECORDED/);
   assert.throws(()=>finalizeRunningNativeStage(s.args()),/NATIVE_STAGE_ALREADY_RECORDED/);});
 await test('reconcile 17 original failed operation record remains immutable',()=>{
   const archived=path.join(s.root,'.local/ro-stack',reconciledPrefix+s.lease.lease_id),r=readJson(path.join(s.root,nativeReceiptPath));
   assert.equal(fs.existsSync(s.lock),false);assert.equal(digest(path.join(archived,'operation.json')),operationSha);assert.equal(r.failed_operation.operation_sha256,operationSha);
   assert.deepEqual(fs.readdirSync(archived).sort(),['operation.json','stage']);assert.equal(digest(s.failedOutput),outputSha);assert.equal(r.failed_operation.tool_output.sha256,outputSha);
   for(const x of r.failed_operation.stage)assert.equal(digest(path.join(archived,x.path)),x.sha256);});
 await test('reconcile 18 long-lived child adapter real test',()=>{
   const run=spawnSync(process.execPath,[fileURLToPath(new URL('./test-native-start-adapter.mjs',import.meta.url))],{encoding:'utf8',windowsHide:true,timeout:240000});
   assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/REAL_LONG_LIVED_START_TEST_COUNT=11/);});
 console.log(`NATIVE_PROMOTION_TOOL_TEST_COUNT=${count}`);
}finally{
 if(!fs.realpathSync(tmp).toLowerCase().startsWith(fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep))throw Error('UNSAFE_FIXTURE_CLEANUP');
 fs.rmSync(tmp,{recursive:true,force:true});
}
