import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateNative,inspectNativeCandidate,nativeReceiptValid,nativeReceiptPath,nativeArtifacts,NATIVE_REPOSITORY,groups,verifyNativeStage } from '../native-promotion-contract.mjs';
import { evaluatePromotion } from '../production-promotion-gate.mjs';
import { receiptComplete,commitAcceptedBaseline } from '../production-deployment-state.mjs';
import { executeNative } from '../deploy-native-candidate.mjs';
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
  write('build/source/src/map/map.cpp','void MapServer::handle_shutdown(){persistent_agent_prepare_shutdown();persistent_agent_confirm_shutdown();}');
  write('build/source/src/map/persistent_agent.cpp','persistent_agent_state_mark_shutdown_pending(runtime.record, runtime_instance_id); persistent_agent_state_confirm_clean_shutdown(runtime.record, runtime_instance_id);');
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
  const webFiles=[{path:'app.js',sha256:digest(write('app.js','legacy-web'))}];
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
 const webCandidate={sha:f.web,head:f.web,commitExists:true,pushed:true,nativePushed:true,dirty:false,requiredFilesTracked:true,firstPromotionEvidencePass:true,nativeCandidatePass:f.inspect({mode:'precheck'}).eligible,repository:'https://github.com/example/web.git',ref:'refs/heads/main',capabilities:ids,owner:'F',nativeSha:f.sha,assetPackage:{...asset,available:true,private:true,immutable:true,valid:true,archive_sha256:asset.archive.sha256}};
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
   x.write('app.js','unapproved');assert.equal(verifyNativeStage(x.root,state,x.lease,x.lease.admission_manifest_sha256).pass,false);x.write('app.js','legacy-web');
   const receipt={result:'PROMOTED',deploy_id:'fixture-final',deployed_at:'fixture',owner_task_id:'F',lease_id:x.lease.lease_id,web_git_sha:x.web,native_git_sha:x.sha,canonical_product_checkpoint:x.web,github_remote:'https://github.com/example/web.git',github_ref:'refs/heads/main',web_build_manifest:x.state.current_web_artifact_manifest,web_build_manifest_sha256:x.state.current_web_manifest_sha256,native_build_sha256:x.m.binary_sha256,native_artifact_path:nativeArtifacts[2],runtime_pids:[21,22,23,14],openkore_runtime_count:0,live_acceptance_results:{pass:true},rollback_artifact:'rollback',files:x.webFiles,accepted_capabilities:ids,first_github_first_gates:Object.fromEntries(['source_regression','native_build','asset_hash','rollback','single_owner','procdump','runtime_health','live_acceptance'].map(k=>[k,{pass:true,evidence:'fixture-only'}])),native_deployment_receipt:{path:nativeReceiptPath,sha256:digest(path.join(x.root,nativeReceiptPath))}};
   assert.equal(receiptComplete({...receipt,native_deployment_receipt:null},x.root),false);
   assert.equal(commitAcceptedBaseline(x.root,state,x.lease,receipt).baseline_mode,'GITHUB_FIRST');
 });
 await test('failed controlled stop retains OPEN state and owner without replacement',async()=>{
   const x=fixture(),actions=[];
   await assert.rejects(executeNative({root:x.root,file:x.file,sha256:digest(x.file),owner:'F',leaseId:x.lease.lease_id,authority:{accepted_source_sha:x.sha},
     adapter:async a=>{actions.push(a);if(a==='stop')throw Error('fixture stop failure');return x.runtime;},inspect:o=>inspectNativeCandidate({...o,remoteVerifier:()=>true}),webAdmission:async()=>({eligible:true,candidate_capabilities:ids})}),/stop failure/);
   assert.deepEqual(actions,['snapshot','stop']);assert.equal(readJson(path.join(x.root,'.local/ro-stack/production-deployment-state.json')).production_drift,'OPEN');
   assert.equal(digest(path.join(x.root,nativeArtifacts[2])),x.state.current_native_binary_sha256);assert.equal(fs.existsSync(path.join(x.root,'.local/ro-stack/native-deploy.lock')),true);
 });
 console.log(`NATIVE_PROMOTION_TOOL_TEST_COUNT=${count}`);
}finally{
 if(!fs.realpathSync(tmp).toLowerCase().startsWith(fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep))throw Error('UNSAFE_FIXTURE_CLEANUP');
 fs.rmSync(tmp,{recursive:true,force:true});
}
