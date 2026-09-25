import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {schema,policy,manifestDigest,validateHeader,validateFiles,validateAuthority,assertLeaseManifest,verifyWebReceipt,receiptIdentity,verifyDeployed,expectedPayload,git} from '../web-complete-manifest.mjs';
import {digest} from '../legacy-production-baseline.mjs';
import {commitAcceptedBaseline} from '../production-deployment-state.mjs';
import {runtimeClosure} from '../manifest-runtime-closure.mjs';
const tempBase=spawnSync('pwsh',['-NoProfile','-Command','[IO.Path]::GetTempPath()'],{encoding:'utf8',windowsHide:true}).stdout.trim();
const root=fs.mkdtempSync(path.join(tempBase,'web-full-manifest-'));
const tool=fileURLToPath(new URL('../deploy-dashboard-manifest.ps1',import.meta.url));
let count=0;const test=(name,fn)=>{fn();console.log(`PASS ${++count} ${name}`);};
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v));return p;};
const seal=m=>{m.file_count=m.files.length;m.total_payload_bytes=m.files.reduce((n,f)=>n+f.size,0);m.manifest_digest=manifestDigest(m);return m;};
function fixture(n){
 const dir=path.join(root,'fixture-'+n),candidate=path.join(dir,'candidate'),production=path.join(dir,'production');fs.mkdirSync(production,{recursive:true});
 const files=Array.from({length:n},(_,i)=>{
  const p=i===0?'ops/ro-stack/dashboard.mjs':i===1?"public/ro/client/items/Angel's_Safeguard.png":`ops/ro-stack/dashboard/fixture-${i}.json`;
  const source=write(path.join(candidate,p),i===0?'export const fixture = true;':'{"fixture":"candidate"}');
  const old=i%2===0?write(path.join(production,p),i===0?'export const fixture = false;':'{"fixture":"previous"}'):null;
  return {path:p,relative_path:p,sha256:digest(source),candidate_sha256:digest(source),size:fs.statSync(source).size,source_class:'GIT_SOURCE',...(old?{production_preimage_sha256:digest(old)}:{production_preimage:'ABSENT'})};
 });
 const m=seal({schema_version:schema,candidate_id:'fixture-'+n,web_git_sha:'a'.repeat(40),candidate_commit:'a'.repeat(40),canonical_repository:'https://github.com/amadiz1988-boop/terminal-arpg.git',canonical_branch:'main',asset_release:'fixture-v1',asset_package_sha256:'1'.repeat(64),asset_manifest_sha256:'2'.repeat(64),generated_at:'fixture',candidate_root:candidate,production_root:production,removed_files:[],files});
 const file=write(path.join(dir,'manifest.json'),m),state=write(path.join(production,'.local/ro-stack/production-deployment-state.json'),{current_deploy_id:'unchanged',production_drift:'CLOSED'});
 return {m,file,state,candidate,production,expected:{paths:files.map(f=>f.path),tracked:new Set(files.map(f=>f.path)),assets:new Map()}};
}
function invoke(f,...args){const r=spawnSync('pwsh',['-NoProfile','-File',tool,'-Manifest',f.file,'-ProductionRoot',f.production,'-OwnerTaskId','fixture','-TestMode',...args],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});assert.ok(r.stdout, r.stderr);return {...r,json:JSON.parse(r.stdout)};}
const mutated=(f,fn)=>{const m=structuredClone(f.m);fn(m);seal(m);return m;};
try{
 const sourceRoot=fileURLToPath(new URL('../../../',import.meta.url));
 const sourceAssets=JSON.parse(fs.readFileSync(path.join(sourceRoot,'docs/project-control/web-runtime-assets-manifest-v1.json'),'utf8'));
 const sourceSet=expectedPayload(sourceRoot,git(sourceRoot,'rev-parse','HEAD'),sourceAssets,{audit:true});
 test('developer Admin action exact path is required',()=>assert.ok(sourceSet.paths.includes('ops/ro-stack/developer-admin-action.mjs')));
 test('Dashboard launcher exact path is required',()=>assert.ok(sourceSet.paths.includes('ops/ro-stack/dashboard-service.ps1')));
 test('Native launcher exact path is required',()=>assert.ok(sourceSet.paths.includes('ops/ro-stack/ro-stack.ps1')));
 test('unrelated ops script is not automatically admitted',()=>assert.ok(!sourceSet.paths.includes('ops/ro-stack/amend-active-web-candidate.mjs')));
 const action=fixture(2),actionPath='ops/ro-stack/developer-admin-action.mjs';
 const actionSource=write(path.join(action.candidate,actionPath),'export const action=true;');
 action.m.files.push({path:actionPath,relative_path:actionPath,sha256:digest(actionSource),candidate_sha256:digest(actionSource),size:fs.statSync(actionSource).size,source_class:'GIT_SOURCE',production_preimage:'ABSENT'});
 seal(action.m);action.expected.paths.push(actionPath);action.expected.tracked.add(actionPath);
 test('developer Admin action preimage and rollback coverage pass',()=>{
  const result=validateFiles(action.m,{candidateRoot:action.candidate,productionRoot:action.production,expected:action.expected});
  assert.equal(result.ROLLBACK_COVERAGE_FILE_COUNT,action.m.files.length);
  assert.equal(result.ROLLBACK_UNCOVERED_PATH_COUNT,0);
 });
 test('missing developer Admin action fails exact-set admission',()=>assert.throws(()=>validateFiles(mutated(action,m=>m.files.pop()),{candidateRoot:action.candidate,productionRoot:action.production,expected:action.expected}),/COMPLETE_PAYLOAD_SET_MISMATCH/));
 test('unrelated extra ops script fails exact-set admission',()=>assert.throws(()=>validateFiles(mutated(action,m=>m.files.push({...m.files.at(-1),path:'ops/ro-stack/amend-active-web-candidate.mjs',relative_path:'ops/ro-stack/amend-active-web-candidate.mjs'})),{candidateRoot:action.candidate,productionRoot:action.production,expected:action.expected}),/COMPLETE_PAYLOAD_SET_MISMATCH/));
 const fixtures=[255,256,394,5108].map(fixture);
 for(const f of fixtures)test(`${f.m.file_count} files complete preflight`,()=>{const r=validateFiles(f.m,{candidateRoot:f.candidate,productionRoot:f.production,expected:f.expected});assert.equal(r.PRESTAGE_FILE_COUNT,f.m.file_count);assert.equal(r.ROLLBACK_UNCOVERED_PATH_COUNT,0);});
 const f=fixtures[0],options={candidateRoot:f.candidate,productionRoot:f.production,expected:f.expected};
 test('configured file ceiling precise refusal',()=>assert.throws(()=>validateHeader(f.m,{...policy,max_files:254}),/MANIFEST_FILE_COUNT_EXCEEDS_POLICY/));
 test('manifest byte ceiling precise refusal',()=>assert.throws(()=>validateHeader(f.m,{...policy,max_manifest_bytes:10}),/MANIFEST_BYTES_EXCEED_POLICY/));
 test('payload byte ceiling precise refusal',()=>assert.throws(()=>validateHeader(f.m,{...policy,max_payload_bytes:1}),/PAYLOAD_BYTES_EXCEED_POLICY/));
 test('single file byte ceiling precise refusal',()=>assert.throws(()=>validateHeader(f.m,{...policy,max_single_file_bytes:1}),/SINGLE_FILE_BYTES_EXCEED_POLICY/));
 test('missing one candidate blocks before mutation',()=>{const p=path.join(f.candidate,f.m.files[1].path);fs.renameSync(p,p+'.saved');try{assert.throws(()=>validateFiles(f.m,options),/PRESTAGE_MISSING/);}finally{fs.renameSync(p+'.saved',p);}});
 test('one changed byte blocks before mutation',()=>{const p=path.join(f.candidate,f.m.files[1].path),bytes=fs.readFileSync(p);write(p,'corrupt');try{assert.throws(()=>validateFiles(f.m,options),/PRESTAGE_HASH_MISMATCH/);}finally{fs.writeFileSync(p,bytes);}});
 test('duplicate path rejected',()=>assert.throws(()=>validateHeader(mutated(f,m=>m.files.push(m.files[0]))),/DUPLICATE_MANIFEST_PATH/));
 test('Windows case collision rejected',()=>assert.throws(()=>validateHeader(mutated(f,m=>m.files.push({...m.files[0],path:m.files[0].path.replace('dashboard','Dashboard'),relative_path:m.files[0].path.replace('dashboard','Dashboard')}))),/WINDOWS_CASE_COLLISION/));
 for(const p of ['../escape.json','C:/escape.json','/escape.json','public/ro/a.json:stream','public/ro/con.json'])test(`unsafe path ${p}`,()=>assert.throws(()=>validateHeader(mutated(f,m=>{m.files[0].path=p;m.files[0].relative_path=p;})),/INVALID_MANIFEST_PATH/));
 test('non-Web executable path blocked',()=>assert.throws(()=>validateHeader(mutated(f,m=>{m.files[0].path='map-server.exe';m.files[0].relative_path='map-server.exe';})),/UNAUTHORIZED_WEB_PATH/));
 test('wrong Web SHA header blocked',()=>assert.throws(()=>validateHeader(mutated(f,m=>m.web_git_sha='b'.repeat(40))),/COMPLETE_MANIFEST_HEADER_INVALID/));
 const authority={assets:{release_tag:f.m.asset_release,package_sha256:f.m.asset_package_sha256,manifest_sha256:f.m.asset_manifest_sha256}};
 test('wrong private release blocked',()=>assert.throws(()=>validateAuthority({...f.m,asset_release:'wrong'},authority),/ASSET_RELEASE_MISMATCH/));
 test('wrong package SHA blocked',()=>assert.throws(()=>validateAuthority({...f.m,asset_package_sha256:'3'.repeat(64)},authority),/ASSET_PACKAGE_HASH_MISMATCH/));
 test('wrong asset manifest SHA blocked',()=>assert.throws(()=>validateAuthority({...f.m,asset_manifest_sha256:'3'.repeat(64)},authority),/ASSET_MANIFEST_HASH_MISMATCH/));
 test('rollback absent proof rejected',()=>assert.throws(()=>validateHeader(mutated(f,m=>delete m.files[0].production_preimage_sha256)),/ROLLBACK_COVERAGE_MISSING/));
 test('rollback changed preimage rejected',()=>assert.throws(()=>validateFiles(mutated(f,m=>m.files[0].production_preimage_sha256='0'.repeat(64)),options),/ROLLBACK_PREIMAGE_MISMATCH/));
 test('legacy preimage class on unrelated path refused',()=>assert.throws(()=>validateHeader(mutated(f,m=>m.files[0].production_preimage_class='EXISTING_LEGACY_PRODUCTION_PREIMAGE')),/UNAPPROVED_LEGACY_PREIMAGE_CLASS/));
 test('exact launcher legacy preimage class admitted',()=>{
  const m=mutated(f,m=>m.files.push({...m.files[0],path:'ops/ro-stack/ro-stack.ps1',relative_path:'ops/ro-stack/ro-stack.ps1',
    production_preimage_sha256:'58DDC2E101F64B47B586CE9C74E9C75D2E3221EEFEC439DA7621DF31262F3CAF',
    production_preimage_class:'EXISTING_LEGACY_PRODUCTION_PREIMAGE'}));
  assert.equal(validateHeader(m).file_count,f.m.file_count+1);
 });
 test('unreviewed removal refused',()=>assert.throws(()=>validateHeader(mutated(f,m=>m.removed_files=['old.json'])),/REMOVALS_REQUIRE_SEPARATE_REVIEW/));
 test('omitted required file blocks complete set',()=>assert.throws(()=>validateFiles(mutated(f,m=>m.files.pop()),options),/COMPLETE_PAYLOAD_SET_MISMATCH/));
 test('digest tamper blocked',()=>assert.throws(()=>validateHeader({...f.m,candidate_id:'tampered'}),/MANIFEST_DIGEST_MISMATCH/));
 const lease={owner_task_id:'fixture',lease_id:'ISOLATED_FIXTURE',web_deploy_git_sha:f.m.web_git_sha,manifest_digest:f.m.manifest_digest,admission_manifest_sha256:digest(f.file)};
 test('one lease rejects second raw manifest',()=>assert.throws(()=>assertLeaseManifest(lease,'0'.repeat(64),f.m),/LEASE_MANIFEST_CHANGED/));
 test('one lease rejects second semantic digest',()=>assert.throws(()=>assertLeaseManifest(lease,digest(f.file),{...f.m,manifest_digest:'0'.repeat(64)}),/LEASE_MANIFEST_DIGEST_CHANGED/));
 test('complete closure never fills missing candidate from Production',()=>{const x=fixture(2);write(path.join(x.candidate,'ops/ro-stack/dashboard.mjs'),"import './dependency.mjs';");write(path.join(x.production,'ops/ro-stack/dependency.mjs'),'export const old=true;');const c=runtimeClosure(x.m,x.candidate,x.production,true);assert.ok(c.missing.some(i=>i.target_path==='ops/ro-stack/dependency.mjs'));});
 test('project-root startup JSON read must be delivered',()=>{const x=fixture(2),required='ops/ro-stack/persistent-agent/world-map-teleport-source.json';write(path.join(x.candidate,'ops/ro-stack/dashboard.mjs'),"import {readFile} from 'node:fs/promises'; import {join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const root=join(dirname(fileURLToPath(import.meta.url)),'..','..'); const catalog=JSON.parse(await readFile(join(root,'ops/ro-stack/persistent-agent/world-map-teleport-source.json'),'utf8')); export {catalog};");write(path.join(x.candidate,required),'{}');const c=runtimeClosure(x.m,x.candidate,x.production,true);assert.ok(c.missing.some(i=>i.target_path===required));assert.equal(c.post_deploy_import_closure,false);});
 const small=fixture(4),before=digest(small.state);
 test('simulated partial failure yields no success receipt',()=>{const r=invoke(small,'-Deploy','-SimulateFailureAfter','2');assert.notEqual(r.status,0,r.stdout);assert.equal(r.json.rollback,'PREIMAGE_RESTORED',r.stdout);const dir=path.dirname(r.json.failure_receipt);assert.equal(fs.existsSync(path.join(dir,'deploy-receipt.json')),false);assert.equal(r.json.final_preimage_validation.pass,true);});
 test('partial failure does not advance baseline',()=>{assert.equal(digest(small.state),before);assert.throws(()=>commitAcceptedBaseline(small.production,{},{...lease},{owner_task_id:'fixture'}),/WEB_DEPLOY_RECEIPT_REQUIRED/);assert.equal(digest(small.state),before);});
 const big=fixtures.at(-1);let deployed;
 test('5108 file real tool fixture deploy passes',()=>{const r=invoke(big,'-Deploy');assert.equal(r.status,0,r.stdout);deployed=r.json.receipt;assert.equal(verifyDeployed(big.m,big.production),true);});
 test('complete simulated deployment receipt eligible',()=>{const d=JSON.parse(fs.readFileSync(deployed));const final={...receiptIdentity(big.m),owner_task_id:'fixture',lease_id:'ISOLATED_FIXTURE',files:big.m.files.map(x=>({path:x.path,sha256:x.sha256})),web_deployment_receipt:{path:path.relative(big.production,deployed).replaceAll('\\','/'),sha256:digest(deployed)}};assert.equal(verifyWebReceipt(final,big.production,{manifest_digest:big.m.manifest_digest,admission_manifest_sha256:digest(big.file)}).manifest.file_count,5108);assert.equal(d.manifest_total_payload_bytes,big.m.total_payload_bytes);});
 test('5108 file complete rollback restores replacements and removes only additions',()=>{const r=invoke(big,'-Rollback','-ReceiptPath',deployed);assert.equal(r.status,0,r.stdout);assert.equal(validateFiles(big.m,{candidateRoot:big.candidate,productionRoot:big.production,expected:big.expected}).ROLLBACK_UNCOVERED_PATH_COUNT,0);});
 console.log(`WEB_FULL_MANIFEST_GOVERNANCE_TEST_COUNT=${count}`);
}finally{
 if(!fs.realpathSync(root).toLowerCase().startsWith(fs.realpathSync(tempBase).toLowerCase().replace(/[\\\/]$/,'')+path.sep))throw Error('UNSAFE_FIXTURE_CLEANUP');
 fs.rmSync(root,{recursive:true,force:true});
}
