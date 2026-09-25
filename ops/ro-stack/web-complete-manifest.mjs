import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {boundedPath,digest,readJson} from './legacy-production-baseline.mjs';
import {runtimeClosure} from './manifest-runtime-closure.mjs';
import {inspectPrivatePackage,assetReleaseErrors} from './private-asset-release-gate.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export const policy=readJson(path.resolve(here,'../../docs/project-control/web-manifest-safety-policy.json'));
export const schema='web-complete-v1';
export const legacyLauncherPath='ops/ro-stack/ro-stack.ps1';
export const legacyLauncherPreimageSha='58DDC2E101F64B47B586CE9C74E9C75D2E3221EEFEC439DA7621DF31262F3CAF';
export const fail=(ok,code)=>{if(!ok)throw Error(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').toUpperCase();
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function manifestDigest(m){const {manifest_digest,...body}=m;return hash(canonical(body));}
export function safeRelative(p){
  fail(typeof p==='string' && p.length>0 && !/[\\:\x00-\x1f<>"|?*]/.test(p) && !path.isAbsolute(p),'INVALID_MANIFEST_PATH');
  fail(p.split('/').every(s=>s && s!=='.' && s!=='..' && !/[. ]$/.test(s) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)),'INVALID_MANIFEST_PATH');
  return p;
}
export function webPath(p){
  safeRelative(p);
  fail(/^(?:ops\/ro-stack\/(?:[A-Za-z0-9_-]+\.mjs|dashboard-service\.ps1|ro-stack\.ps1|dashboard\/assets\/.+\.(?:png|jpg|jpeg|gif|webp|svg|wav|mp3|ogg|bmp|bin|gz|woff2?)|(?:dashboard|persistent-agent|web-experience|quest-runtime)\/.+\.(?:mjs|js|json|css|html))|public\/ro\/.+\.(?:json|png|jpg|jpeg|gif|webp|svg|wav|mp3|ogg|bmp|bin|gz|woff2?)|docs\/ro-asset-index\/.+\.json|docs\/ro-floor-theme-asset-index\.json|docs\/project-control\/canonical-test-fixtures\.json)$/.test(p),'UNAUTHORIZED_WEB_PATH');
  return p;
}
export function validateAuthority(m,authority){
  fail(m.asset_release===authority.assets.release_tag,'ASSET_RELEASE_MISMATCH');
  fail(m.asset_package_sha256===authority.assets.package_sha256,'ASSET_PACKAGE_HASH_MISMATCH');
  fail(m.asset_manifest_sha256===authority.assets.manifest_sha256,'ASSET_MANIFEST_HASH_MISMATCH');
}
export function assertLeaseManifest(lease,rawHash,m){
  if(!lease)return;
  fail(lease.admission_manifest_sha256?.toUpperCase()===rawHash.toUpperCase(),'LEASE_MANIFEST_CHANGED');
  fail(lease.manifest_digest===m.manifest_digest,'LEASE_MANIFEST_DIGEST_CHANGED');
}
export function git(root,...args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});fail(r.status===0,`GIT_FAILED:${args[0]}`);return r.stdout.trim();}
export function readManifest(file){fail(fs.statSync(file).size<=policy.max_manifest_bytes,'MANIFEST_BYTES_EXCEED_POLICY');return readJson(file);}
export function validateHeader(m, limits=policy){
  fail(m?.schema_version===schema,'COMPLETE_MANIFEST_REQUIRED');
  fail(Buffer.byteLength(JSON.stringify(m))<=limits.max_manifest_bytes,'MANIFEST_BYTES_EXCEED_POLICY');
  fail(Array.isArray(m.files) && m.files.length>0 && m.files.length<=limits.max_files,'MANIFEST_FILE_COUNT_EXCEEDS_POLICY');
  fail(m.file_count===m.files.length && /^[a-f0-9]{40}$/i.test(m.web_git_sha || '') && m.web_git_sha===m.candidate_commit &&
    /^[A-Za-z0-9_-]+$/.test(m.candidate_id||'') && m.canonical_repository==='https://github.com/amadiz1988-boop/terminal-arpg.git' &&
    m.canonical_branch==='main' && typeof m.generated_at==='string' && m.generated_at.length>0 &&
    typeof m.asset_release==='string' && m.asset_release.length>0 && /^[a-f0-9]{64}$/i.test(m.asset_package_sha256||'') && /^[a-f0-9]{64}$/i.test(m.asset_manifest_sha256||''),'COMPLETE_MANIFEST_HEADER_INVALID');
  fail(m.manifest_digest===manifestDigest(m),'MANIFEST_DIGEST_MISMATCH');
  const seen=new Set(),folded=new Set();let total=0;
  for(const f of m.files){
    webPath(f.relative_path);
    fail(!seen.has(f.relative_path),'DUPLICATE_MANIFEST_PATH');seen.add(f.relative_path);
    fail(!folded.has(f.relative_path.toLowerCase()),'WINDOWS_CASE_COLLISION');folded.add(f.relative_path.toLowerCase());
    fail(f.path===f.relative_path && /^[a-f0-9]{64}$/i.test(f.sha256||'') && f.sha256===f.candidate_sha256,'MANIFEST_FILE_HASH_INVALID');
    fail(Number.isSafeInteger(f.size) && f.size>=0 && f.size<=limits.max_single_file_bytes,'SINGLE_FILE_BYTES_EXCEED_POLICY');
    fail(['GIT_SOURCE','PRIVATE_ASSET_RELEASE'].includes(f.source_class),'UNAPPROVED_SOURCE_CLASS');
    total+=f.size;fail(total<=limits.max_payload_bytes,'PAYLOAD_BYTES_EXCEED_POLICY');
    fail(f.production_preimage==='ABSENT' ? !f.production_preimage_sha256 : /^[a-f0-9]{64}$/i.test(f.production_preimage_sha256||''),'ROLLBACK_COVERAGE_MISSING');
    if(f.production_preimage_class!==undefined)fail(f.path===legacyLauncherPath &&
      f.production_preimage_class==='EXISTING_LEGACY_PRODUCTION_PREIMAGE' &&
      f.production_preimage!=='ABSENT' && f.production_preimage_sha256?.toUpperCase()===legacyLauncherPreimageSha,
      'UNAPPROVED_LEGACY_PREIMAGE_CLASS');
  }
  fail(m.required_assets===undefined || (Array.isArray(m.required_assets) && m.required_assets.every(p=>seen.has(p))),'UNMANIFESTED_REQUIRED_ASSET');
  fail(Number.isSafeInteger(m.total_payload_bytes) && m.total_payload_bytes===total,'PAYLOAD_SIZE_MISMATCH');
  fail(Array.isArray(m.removed_files) && m.removed_files.length===0,'REMOVALS_REQUIRE_SEPARATE_REVIEW');
  return {file_count:m.files.length,total_payload_bytes:total,max_single_file_bytes:m.files.reduce((n,x)=>Math.max(n,x.size),0)};
}

// An independently derived allowlist, never the candidate's own claimed count.
// Static/dynamic-index trees are seeded in full; backend imports are followed.
export function expectedPayload(candidateRoot,sha,assetManifest,{audit=false}={}){
  const tracked=new Set(git(candidateRoot,'ls-tree','-r','--name-only',sha,'--','ops/ro-stack','public/ro','docs').split('\n').filter(Boolean));
  const assets=new Map(assetManifest.assets.map(x=>[x.relative_path,x]));
  const wanted=new Set([...tracked].filter(p=>!/(?:^|\/)(?:tests?|poc)(?:[-./]|$)/i.test(p)).filter(p=>/^(ops\/ro-stack\/(dashboard\/)|public\/ro\/|docs\/ro-asset-index\/)/.test(p) ||
    ['ops/ro-stack/dashboard.mjs','ops/ro-stack/dashboard-service.ps1','ops/ro-stack/ro-stack.ps1','ops/ro-stack/developer-admin-action.mjs','docs/ro-floor-theme-asset-index.json','docs/project-control/canonical-test-fixtures.json'].includes(p)));
  for(const p of assets.keys())wanted.add(p);
  // Closure discovery reads only the canonical candidate, never Production.
  const closure=runtimeClosure({files:[...wanted].map(path=>({path}))},candidateRoot,candidateRoot,true);
  for(const item of closure.dependencies){
    if(item.kind==='directory')continue;
    if(!audit)fail(tracked.has(item.target_path)||assets.has(item.target_path),`UNAPPROVED_REQUIRED_FILE:${item.target_path}`);
    wanted.add(item.target_path);
  }
  if(!audit)fail(closure.errors.length===0,`CANDIDATE_RUNTIME_CLOSURE_FAILED:${closure.errors[0]||''}`);
  return {paths:[...wanted].sort(),tracked,assets,closure};
}

export function validateFiles(m,{candidateRoot,productionRoot,expected,checkPreimages=true}){
  const counts=validateHeader(m),actual=new Set(m.files.map(x=>x.path));
  fail(actual.size===expected.paths.length && expected.paths.every(p=>actual.has(p)),'COMPLETE_PAYLOAD_SET_MISMATCH');
  for(const f of m.files){
    const source=boundedPath(candidateRoot,safeRelative(f.path));
    fail(fs.existsSync(source) && fs.statSync(source).isFile(),`PRESTAGE_MISSING:${f.path}`);
    fail(fs.statSync(source).size===f.size && digest(source)===f.sha256.toUpperCase(),`PRESTAGE_HASH_MISMATCH:${f.path}`);
    const asset=expected.assets.get(f.path);
    if(asset)fail(f.source_class==='PRIVATE_ASSET_RELEASE' && f.size===asset.size && f.sha256.toLowerCase()===asset.sha256.toLowerCase(),`ASSET_PROVENANCE_MISMATCH:${f.path}`);
    else fail(f.source_class==='GIT_SOURCE' && expected.tracked.has(f.path),`GIT_PROVENANCE_MISMATCH:${f.path}`);
    if(checkPreimages){
      const target=boundedPath(productionRoot,f.path);
      fail(f.production_preimage==='ABSENT' ? !fs.existsSync(target) : fs.existsSync(target) && digest(target)===f.production_preimage_sha256.toUpperCase(),`ROLLBACK_PREIMAGE_MISMATCH:${f.path}`);
    }
  }
  return {...counts,PRESTAGE_COMPLETE:true,PRESTAGE_FILE_COUNT:m.file_count,PRESTAGE_MISSING:0,PRESTAGE_HASH_MISMATCH:0,PRESTAGE_UNMANIFESTED_REQUIRED:0,ROLLBACK_COVERAGE_FILE_COUNT:m.file_count,ROLLBACK_UNCOVERED_PATH_COUNT:0};
}

export function admission(file,productionRoot,{verifyRemote=true,checkPreimages=true}={}){
  const m=readManifest(file);validateHeader(m);
  const root=path.resolve(m.candidate_root),authority=readJson(path.resolve(here,'../../docs/project-control/production-release-authority.json'));
  fail(path.resolve(m.production_root).toLowerCase()===path.resolve(productionRoot).toLowerCase(),'MANIFEST_PRODUCTION_ROOT_MISMATCH');
  fail(git(root,'rev-parse','HEAD')===m.web_git_sha && !git(root,'status','--porcelain=v1','--untracked-files=all'),'CANDIDATE_NOT_CLEAN_EXACT_SHA');
  fail(git(root,'remote','get-url','origin')===authority.web.repository,'CANONICAL_REMOTE_MISMATCH');
  if(verifyRemote){const tip=git(root,'ls-remote','--exit-code','origin',authority.web.release_ref).split(/\s/)[0];git(root,'fetch','--no-tags','--no-write-fetch-head','origin',authority.web.release_ref);git(root,'merge-base','--is-ancestor',m.web_git_sha,tip);}
  validateAuthority(m,authority);
  const pkg=inspectPrivatePackage(root,m.private_asset_package_root,authority.assets);
  fail(assetReleaseErrors(authority.assets,pkg).length===0,'PRIVATE_ASSET_RELEASE_INVALID');
  const assetManifest=readJson(path.join(root,'docs/project-control/web-runtime-assets-manifest-v1.json'));
  const expected=expectedPayload(root,m.web_git_sha,assetManifest);
  return {...validateFiles(m,{candidateRoot:root,productionRoot,expected,checkPreimages}),assetPackage:pkg,manifest:m};
}
export function verifyDeployed(m,root){
  validateHeader(m);
  for(const f of m.files){const p=boundedPath(root,f.path);fail(fs.existsSync(p) && fs.statSync(p).size===f.size && digest(p)===f.sha256.toUpperCase(),`DEPLOYED_FILESET_MISMATCH:${f.path}`);}
  return true;
}
export function receiptIdentity(m){return {web_git_sha:m.web_git_sha,candidate_id:m.candidate_id,manifest_digest:m.manifest_digest,
  manifest_file_count:m.file_count,manifest_total_payload_bytes:m.total_payload_bytes,asset_release:m.asset_release,asset_package_sha256:m.asset_package_sha256,asset_manifest_sha256:m.asset_manifest_sha256};}

// currentBytes=false verifies a superseded receipt (hash, identity, fileset,
// rollback) without requiring its files to still be the live Production bytes.
export function verifyWebReceipt(receipt,root,lease=null,{currentBytes=true}={}){
  const ref=receipt.web_deployment_receipt;
  fail(ref && /^[a-f0-9]{64}$/i.test(ref.sha256||''),'WEB_DEPLOY_RECEIPT_REQUIRED');
  const file=boundedPath(root,safeRelative(ref.path));
  fail(digest(file)===ref.sha256.toUpperCase(),'WEB_DEPLOY_RECEIPT_HASH_MISMATCH');
  const deployed=readJson(file),manifestFile=path.join(path.dirname(file),'manifest.json'),m=readManifest(manifestFile);
  validateHeader(m);if(currentBytes)verifyDeployed(m,root);
  fail(deployed.mode==='DEPLOY' && deployed.result==='CANDIDATE_ACTIVE' && deployed.deployment_result==='COMPLETE_CANDIDATE_ACTIVE' &&
    deployed.PRODUCTION_FILESET_MATCHES_MANIFEST===true && !deployed.rollback_performed && deployed.predeploy_baseline && deployed.rollback_reference,'WEB_DEPLOY_RECEIPT_INCOMPLETE');
  fail(deployed.manifest_sha256===digest(manifestFile) && deployed.owner_task_id===receipt.owner_task_id && deployed.lease_id===receipt.lease_id,'WEB_DEPLOY_RECEIPT_IDENTITY_MISMATCH');
  for(const [key,value] of Object.entries(receiptIdentity(m)))fail(deployed[key]===value && receipt[key]===value,`WEB_RECEIPT_IDENTITY_MISMATCH:${key}`);
  const compare=rows=>{if(!Array.isArray(rows)||rows.length!==m.files.length)return false;const map=new Map(rows.map(x=>[x.path,(x.sha256||x.candidate_sha256)?.toUpperCase()]));return map.size===m.files.length && m.files.every(f=>map.get(f.path)===f.sha256.toUpperCase());};
  fail(compare(receipt.files) && compare(deployed.files),'WEB_RECEIPT_FILESET_MISMATCH');
  const rollback=boundedPath(root,safeRelative(deployed.rollback_reference));
  fail(path.resolve(rollback)===path.dirname(file),'WEB_ROLLBACK_REFERENCE_MISMATCH');
  for(const f of m.files)if(f.production_preimage!=='ABSENT')fail(digest(boundedPath(path.join(rollback,'backup'),f.path))===f.production_preimage_sha256.toUpperCase(),'WEB_ROLLBACK_HASH_MISMATCH');
  if(lease)assertLeaseManifest(lease,digest(manifestFile),m);
  return {manifest:m,deployed};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [mode,file,root]=process.argv.slice(2),m=readManifest(file);
    if(mode==='schema')console.log(JSON.stringify({pass:true,...validateHeader(m)}));
    else if(mode==='postdeploy'){verifyDeployed(m,root);console.log(JSON.stringify({pass:true,PRODUCTION_FILESET_MATCHES_MANIFEST:true,...receiptIdentity(m)}));}
    else if(mode==='admission'){const r=admission(file,root);console.log(JSON.stringify({pass:true,...r,manifest:undefined,assetPackage:undefined}));}
    else throw Error('INVALID_FULL_MANIFEST_MODE');
  }catch(e){console.log(JSON.stringify({pass:false,error:e.message}));process.exitCode=1;}
}
