import assert from 'node:assert/strict';
import { validateAmendment } from '../amend-failed-web-manifest.mjs';

const web = 'a'.repeat(40), native = 'b'.repeat(40), oldHash = 'C'.repeat(64);
const added = 'ops/ro-stack/persistent-agent/world-map-teleport-source.json';
const oldRow = { path: 'ops/ro-stack/dashboard.mjs', sha256: 'D'.repeat(64) };
const newRow = { path: added, sha256: 'E'.repeat(64) };
function fixture() {
  const oldManifest = { schema_version: 'web-complete-v1', candidate_id: 'web-'+web,
    web_git_sha:web, candidate_commit:web, candidate_root:'C:/candidate', production_root:'C:/production',
    canonical_repository:'https://github.com/example/web.git', canonical_branch:'main', generated_at:'git:'+web,
    asset_release:'assets-v1', asset_package_sha256:'1'.repeat(64), asset_manifest_sha256:'2'.repeat(64),
    private_asset_package_root:'C:/assets', promotion_mode:'FIRST_GITHUB_FIRST_PROMOTION', candidate_native_commit:native,
    native_candidate_manifest:{path:'native.json',sha256:'3'.repeat(64)}, first_promotion_evidence:{path:'evidence.json',sha256:'4'.repeat(64)},
    removed_files:[], file_count:1, manifest_digest:'5'.repeat(64), files:[oldRow] };
  const newManifest = { ...structuredClone(oldManifest), file_count:2, manifest_digest:'6'.repeat(64), files:[oldRow,newRow] };
  const lease = { status:'ACTIVE', promotion_mode:'FIRST_GITHUB_FIRST_PROMOTION', lease_id:'fixture-lease',
    owner_task_id:'F', admission_manifest_sha256:oldHash, manifest_digest:oldManifest.manifest_digest,
    web_deploy_git_sha:web, native_deploy_git_sha:native };
  const pending = { lease_id:lease.lease_id, owner_task_id:'F', web_git_sha:web,
    native_git_sha:native, native_receipt_sha256:'7'.repeat(64) };
  const state = { schema_version:2, baseline_mode:'LEGACY_PRE_GITHUB_FIRST', historical_provenance:'UNRESOLVED',
    current_web_git_sha:'UNRESOLVED_LEGACY', current_native_git_sha:'UNRESOLVED_LEGACY',
    legacy_bootstrap_available:true, current_deploy_id:'LEGACY_BOOTSTRAP_0123456789abcdef',
    production_drift:'OPEN', first_promotion_phase:'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' };
  const failure = { mode:'DEPLOY', status:'FAILED', result:'FAIL_CLOSED', failure_phase:'DASHBOARD_START',
    error:'DASHBOARD_SERVICE_start_FAILED:1', manifest_sha256:oldHash, candidate_commit:web,
    automatic_rollback_result:'PREIMAGE_RESTORED', final_preimage_validation:{pass:true,matched:1,total:1} };
  return { lease,pending,state,oldManifest,newManifest,oldHash,failure,oldCount:1 };
}
let count=0;
const test=(name,fn)=>{fn();console.log(`PASS ${++count} ${name}`);};
test('same-lease single missing startup asset is eligible',()=>assert.equal(validateAmendment(fixture()).added_path,added));
test('second added file is refused',()=>{const f=fixture();f.newManifest.files.push({path:'other.json'});assert.throws(()=>validateAmendment(f),/WEB_FILESET_CHANGE_EXCEEDS/);});
test('existing file hash change is refused',()=>{const f=fixture();f.newManifest.files[0]={...oldRow,sha256:'0'.repeat(64)};assert.throws(()=>validateAmendment(f),/WEB_FILESET_CHANGE_EXCEEDS/);});
test('candidate identity change is refused',()=>{const f=fixture();f.newManifest.candidate_id='other';assert.throws(()=>validateAmendment(f),/MANIFEST_IDENTITY_CHANGED/);});
test('wrong lease binding is refused',()=>{const f=fixture();f.lease.admission_manifest_sha256='0'.repeat(64);assert.throws(()=>validateAmendment(f),/LEASE_OLD_MANIFEST_MISMATCH/);});
test('wrong Native pending identity is refused',()=>{const f=fixture();f.pending.native_receipt_sha256='';assert.throws(()=>validateAmendment(f),/PENDING_NATIVE_STAGE_MISMATCH/);});
test('incomplete rollback is refused',()=>{const f=fixture();f.failure.final_preimage_validation.matched=0;assert.throws(()=>validateAmendment(f),/FAILED_WEB_ROLLBACK_NOT_PROVEN/);});
test('unrelated OPEN state is refused',()=>{const f=fixture();f.state.first_promotion_phase='OTHER';assert.throws(()=>validateAmendment(f),/NATIVE_STAGE_STATE_REQUIRED/);});
console.log(`WEB_MANIFEST_AMENDMENT_TEST_COUNT=${count}`);
