import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {boundedPath,digest,readJson} from '../ops/ro-stack/legacy-production-baseline.mjs';
import {schema,expectedPayload,manifestDigest,admission,git,fail,validateHeader} from '../ops/ro-stack/web-complete-manifest.mjs';
const args=process.argv.slice(2),a=Object.fromEntries(args.flatMap((x,i)=>x.startsWith('--')?[[x.slice(2),args[i+1]]]:[]));
try{
  const root=fs.realpathSync(a['candidate-root']),prod=fs.realpathSync(a['production-root']),out=path.resolve(a.output);
  fail(!out.toLowerCase().startsWith(prod.toLowerCase()+path.sep) && !out.toLowerCase().startsWith(root.toLowerCase()+path.sep),'EXTERNAL_OUTPUT_REQUIRED');
  const sha=git(root,'rev-parse','HEAD');fail(sha===a['web-sha'],'EXACT_WEB_SHA_REQUIRED');
  fail(!git(root,'status','--porcelain=v1','--untracked-files=all'),'CANDIDATE_DIRTY');
  const authority=readJson(fileURLToPath(new URL('../docs/project-control/production-release-authority.json',import.meta.url)));
  const assets=readJson(path.join(root,'docs/project-control/web-runtime-assets-manifest-v1.json'));
  const expected=expectedPayload(root,sha,assets,{audit:a.audit==='true'});
  if(a.audit==='true'){
    const missing=expected.paths.filter(p=>!fs.existsSync(boundedPath(root,p)));
    const present=expected.paths.filter(p=>!missing.includes(p)).map(p=>{const f=boundedPath(root,p);return {relative_path:p,sha256:digest(f),size:fs.statSync(f).size,source_class:expected.assets.has(p)?'PRIVATE_ASSET_RELEASE':'GIT_SOURCE'};});
    const duplicates=expected.paths.length-new Set(expected.paths).size,caseCollisions=expected.paths.length-new Set(expected.paths.map(p=>p.toLowerCase())).size;
    const inventory={kind:'NON_DEPLOYABLE_CENSUS',web_git_sha:sha,required_path_count:expected.paths.length,available_file_count:present.length,missing,closure_errors:expected.closure.errors,files:present};
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(inventory,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({WEB_MANIFEST_ADMISSION:'BLOCKED',TOTAL_MANIFEST_FILE_COUNT:null,TOTAL_MANIFEST_BYTES:null,TOTAL_PAYLOAD_BYTES:null,
      REQUIRED_PATH_COUNT:expected.paths.length,AVAILABLE_FILE_COUNT:present.length,AVAILABLE_PAYLOAD_BYTES:present.reduce((n,f)=>n+f.size,0),MAX_AVAILABLE_SINGLE_FILE_BYTES:present.reduce((n,f)=>Math.max(n,f.size),0),
      PATH_COUNT:expected.paths.length,DUPLICATE_PATH_COUNT:duplicates,CASE_COLLISION_COUNT:caseCollisions,SOURCE_FILES:present.filter(f=>f.source_class==='GIT_SOURCE').length,PRIVATE_ASSET_FILES:present.filter(f=>f.source_class==='PRIVATE_ASSET_RELEASE').length,GENERATED_FILES:0,OTHER_REQUIRED_FILES:missing.length,
      PRESTAGE_COMPLETE:false,PRESTAGE_MISSING:missing.length,missing,closure_errors:expected.closure.errors,inventory_bytes:fs.statSync(out).size,inventory_sha256:digest(out),note:'Inventory is not a deploy manifest. Complete byte totals cannot be determined for absent canonical files.'}));
    process.exit(0);
  }
  const files=expected.paths.map(p=>{
    const candidate=boundedPath(root,p),target=boundedPath(prod,p);fail(fs.existsSync(candidate),`PRESTAGE_MISSING:${p}`);
    const hash=digest(candidate),exists=fs.existsSync(target);
    return {relative_path:p,path:p,sha256:hash,candidate_sha256:hash,size:fs.statSync(candidate).size,
      source_class:expected.assets.has(p)?'PRIVATE_ASSET_RELEASE':'GIT_SOURCE',
      ...(exists?{production_preimage_sha256:digest(target)}:{production_preimage:'ABSENT'})};
  });
  const m={schema_version:schema,candidate_id:'web-'+sha,web_git_sha:sha,candidate_commit:sha,canonical_repository:authority.web.repository,canonical_branch:'main',
    candidate_root:root,production_root:prod,asset_release:authority.assets.release_tag,asset_package_sha256:authority.assets.package_sha256,
    asset_manifest_sha256:authority.assets.manifest_sha256,private_asset_package_root:fs.realpathSync(a['package-root']),
    file_count:files.length,total_payload_bytes:files.reduce((s,f)=>s+f.size,0),generated_at:'git:'+sha,removed_files:[],files,
    promotion_mode:'FIRST_GITHUB_FIRST_PROMOTION',candidate_native_commit:authority.native.accepted_source_sha};
  // F adds its pinned combined preflight and Native manifest before sealing the
  // final lease input. They can be provided here to avoid editing a sealed file.
  for(const [arg,key] of [['native-manifest','native_candidate_manifest'],['first-evidence','first_promotion_evidence']])if(a[arg]){
    const p=path.resolve(a[arg]);m[key]={path:path.relative(path.dirname(out),p).replaceAll('\\','/'),sha256:digest(p)};
  }
  m.manifest_digest=manifestDigest(m);validateHeader(m);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(m,null,2)+'\n',{flag:'wx'});
  const result=admission(out,prod);
  console.log(JSON.stringify({manifest:out,manifest_digest:m.manifest_digest,TOTAL_MANIFEST_BYTES:fs.statSync(out).size,
    TOTAL_MANIFEST_FILE_COUNT:m.file_count,TOTAL_PAYLOAD_BYTES:m.total_payload_bytes,MAX_SINGLE_FILE_BYTES:result.max_single_file_bytes,
    PATH_COUNT:m.file_count,DUPLICATE_PATH_COUNT:0,CASE_COLLISION_COUNT:0,SOURCE_FILES:files.filter(f=>f.source_class==='GIT_SOURCE').length,
    PRIVATE_ASSET_FILES:files.filter(f=>f.source_class==='PRIVATE_ASSET_RELEASE').length,GENERATED_FILES:0,OTHER_REQUIRED_FILES:0,
    PRESTAGE_COMPLETE:result.PRESTAGE_COMPLETE,PRESTAGE_FILE_COUNT:result.PRESTAGE_FILE_COUNT,PRESTAGE_MISSING:0,PRESTAGE_HASH_MISMATCH:0,
    PRESTAGE_UNMANIFESTED_REQUIRED:0,ROLLBACK_COVERAGE_FILE_COUNT:m.file_count,ROLLBACK_UNCOVERED_PATH_COUNT:0,WEB_MANIFEST_ADMISSION:'PASS'}));
}catch(e){console.log(JSON.stringify({result:'BLOCKED',error:e.message}));process.exitCode=1;}
