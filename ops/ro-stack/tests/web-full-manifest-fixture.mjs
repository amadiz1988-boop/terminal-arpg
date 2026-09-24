import fs from 'node:fs';
import path from 'node:path';
import {schema,manifestDigest,receiptIdentity} from '../web-complete-manifest.mjs';
import {digest} from '../legacy-production-baseline.mjs';
// Isolated fixtures only. Creates independently hashed receipt/backups for the
// existing Native/legacy finalization suites; never performs a live promotion.
export function attachWebFixture(root,receipt,lease){
  const run='.local/ro-stack/dashboard/deploy-receipts/manifest-fixture';
  const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v));return f;};
  const files=receipt.files.map(f=>({...f,relative_path:f.path,candidate_sha256:f.sha256,size:fs.statSync(path.join(root,f.path)).size,source_class:'GIT_SOURCE',production_preimage_sha256:f.sha256}));
  const m={schema_version:schema,candidate_id:'fixture',web_git_sha:receipt.web_git_sha,candidate_commit:receipt.web_git_sha,canonical_repository:'https://github.com/amadiz1988-boop/terminal-arpg.git',canonical_branch:'main',generated_at:'fixture',asset_release:'fixture',asset_package_sha256:'1'.repeat(64),asset_manifest_sha256:'2'.repeat(64),files,file_count:files.length,total_payload_bytes:files.reduce((n,f)=>n+f.size,0),removed_files:[]};m.manifest_digest=manifestDigest(m);
  const sealed=write(run+'/manifest.json',m);
  for(const f of files){const backup=path.join(root,run,'backup',f.path);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(path.join(root,f.path),backup);}
  Object.assign(lease,{manifest_digest:m.manifest_digest,admission_manifest_sha256:digest(sealed)});
  const d={...receiptIdentity(m),mode:'DEPLOY',result:'CANDIDATE_ACTIVE',deployment_result:'COMPLETE_CANDIDATE_ACTIVE',PRODUCTION_FILESET_MATCHES_MANIFEST:true,predeploy_baseline:JSON.parse(fs.readFileSync(path.join(root,'.local/ro-stack/production-deployment-state.json'))).current_deploy_id,rollback_reference:run,manifest_sha256:digest(sealed),owner_task_id:receipt.owner_task_id,lease_id:lease.lease_id,files};
  const file=write(run+'/deploy-receipt.json',d);
  Object.assign(receipt,receiptIdentity(m),{web_deployment_receipt:{path:run+'/deploy-receipt.json',sha256:digest(file)},web_build_manifest:run+'/manifest.json',web_build_manifest_sha256:digest(sealed)});
  return m;
}
