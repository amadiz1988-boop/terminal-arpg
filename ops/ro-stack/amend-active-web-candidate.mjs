#!/usr/bin/env node
// Advance only the Web candidate inside an active, staged first promotion.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { admission, readManifest, validateHeader, legacyLauncherPath, legacyLauncherPreimageSha } from './web-complete-manifest.mjs';
import { FIRST_PROMOTION, firstPromotionEvidence, legacyIdentity, pendingPath, consumedPath, readJson } from './legacy-production-baseline.mjs';
import { nativeReceiptValid, activeNativeReceiptPath, equalHash } from './native-promotion-contract.mjs';
import { capabilityRegistry } from './production-promotion-gate.mjs';
import { webAmendmentHistoryValid } from './production-deployment-state.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const governanceRoot = path.resolve(here, '../..');
const canonicalProduction = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const sha = value => /^[a-f0-9]{40}$/i.test(value || '');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const fail = code => { throw Error(code); };
const approvedAdditivePaths = new Map([
  ['LOCAL_DEVELOPER_ADMIN_ENTRYPOINT_ADDITIVE_MANIFEST_V1', 'ops/ro-stack/developer-admin-action.mjs'],
  ['M1_SETTINGS_EXECUTOR_AND_TEST_FIXTURE_V1', 'ops/ro-stack/dashboard/self-recovery-skill-profile.mjs'],
  ['M1_V15_FIXED_FIXTURE_AND_DASHBOARD_LAUNCHER_V1', 'ops/ro-stack/dashboard-service.ps1'],
  ['M1_V15_ECONOMY_FIXTURE_UI_THEME_SUPERSET_V1', [
    'ops/ro-stack/dashboard/ui-theme.css',
    'ops/ro-stack/dashboard/ui-theme.js',
  ]],
]);
const approvedExistingPreimageAddition = 'ops/ro-stack/dashboard-service.ps1';
const approvedLegacyAdoption = new Map([
  ['M1_LEGACY_LAUNCHER_GITHUB_FIRST_RECONCILIATION_V1', {
    path:legacyLauncherPath,
    preimage:legacyLauncherPreimageSha,
  }],
]);
const run = (cwd, command, args) => {
  const result = spawnSync(command, args, { cwd, encoding:'utf8', windowsHide:true, timeout:120000, maxBuffer:16*1024*1024 });
  if (result.status !== 0) fail(`${command.toUpperCase()}_${args[0]}_FAILED:${(result.stdout || result.stderr).slice(-500)}`);
  return result.stdout.trim();
};
const inside = (root, relative) => {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) fail('AMENDMENT_PATH_INVALID');
  const result = path.resolve(root, relative);
  if (!result.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep)) fail('AMENDMENT_PATH_ESCAPE');
  let cursor = path.resolve(root);
  for (const part of path.relative(cursor,result).split(path.sep)) {
    cursor = path.join(cursor,part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('AMENDMENT_REPARSE_PATH');
  }
  return result;
};
const atomic = (file, value) => {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value,null,2)+'\n', {flag:'wx'});
  try { fs.renameSync(temp,file); } finally { if(fs.existsSync(temp)) fs.unlinkSync(temp); }
};

export function validateActiveWebAmendment({ state, lease, pending, oldManifest, nextManifest, oldReceipt,
  leaseId, owner, oldSha, newSha, nativeValid, preflight }) {
  if (!legacyIdentity(state) || state.baseline_mode !== 'LEGACY_PRE_GITHUB_FIRST' ||
      state.production_drift !== 'OPEN' || state.first_promotion_phase !== 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE') fail('FIRST_PROMOTION_NOT_STAGED');
  if (lease?.status !== 'ACTIVE' || lease.promotion_mode !== FIRST_PROMOTION || lease.emergency ||
      lease.lease_id !== leaseId || lease.owner_task_id !== owner) fail('ACTIVE_LEASE_IDENTITY_MISMATCH');
  if (pending?.lease_id !== leaseId || pending.owner_task_id !== owner ||
      pending.native_git_sha !== lease.native_deploy_git_sha || pending.web_git_sha !== oldSha ||
      !pending.native_stage_reconciled || pending.native_stage !== 'NATIVE_STAGE_COMPLETE') fail('PENDING_PROMOTION_IDENTITY_MISMATCH');
  if (!sha(oldSha) || !sha(newSha) || oldSha === newSha || lease.web_deploy_git_sha !== oldSha ||
      oldManifest.web_git_sha !== oldSha || nextManifest.web_git_sha !== newSha) fail('WEB_SHA_IDENTITY_MISMATCH');
  if (oldReceipt?.result !== 'CANDIDATE_ACTIVE' || oldReceipt.web_git_sha !== oldSha ||
      oldReceipt.lease_id !== leaseId || oldReceipt.owner_task_id !== owner) fail('OLD_WEB_RECEIPT_INVALID');
  if (lease.native_deploy_git_sha !== pending.native_git_sha ||
      nextManifest.candidate_native_commit !== lease.native_deploy_git_sha ||
      !equalHash(nextManifest.native_candidate_manifest?.sha256,lease.native_candidate_manifest_sha256)) fail('NATIVE_CANDIDATE_CHANGED');
  if (!nativeValid) fail('NATIVE_STAGE_RECEIPT_INVALID');
  for (const key of ['remoteCheckout','sourceRegression','manifestAdmission','rollbackCoverage','capabilitySuperset','assetAuthority','firstEvidence'])
    if (preflight?.[key] !== true) fail(`WEB_AMENDMENT_PREFLIGHT_FAILED:${key}`);
  return true;
}

export function duplicateAmendmentIsApplied(audit, lease, pending, {leaseId, owner, oldSha, newSha}) {
  return audit?.lease_id===leaseId && audit.lease_owner===owner && audit.old_web_git_sha===oldSha &&
    audit.new_web_git_sha===newSha && lease?.web_deploy_git_sha===newSha && pending?.web_git_sha===newSha &&
    lease.lease_id===leaseId && lease.owner_task_id===owner && lease.status==='ACTIVE' &&
    pending.lease_id===leaseId && pending.owner_task_id===owner;
}

export function validateManifestDelta(oldManifest, nextManifest, reason, rollbackCovered) {
  const oldRows=new Map(oldManifest.files.map(row=>[row.path,row]));
  const nextRows=new Map(nextManifest.files.map(row=>[row.path,row]));
  if (oldRows.size!==oldManifest.files.length || nextRows.size!==nextManifest.files.length)
    fail('MANIFEST_DELTA_DUPLICATE_PATH');
  const delta={unchanged_paths:[],modified_existing_paths:[],added_paths:[],removed_paths:[],
    absent_preimage_paths:[],rollback_remove_paths:[],rollback_restore_paths:[]};
  for (const [path,oldRow] of oldRows) {
    const nextRow=nextRows.get(path);
    if (!nextRow) { delta.removed_paths.push(path); continue; }
    if (!equalHash(nextRow.production_preimage_sha256,oldRow.sha256) || nextRow.production_preimage==='ABSENT')
      fail(`EXISTING_WEB_PREIMAGE_MISMATCH:${path}`);
    (equalHash(nextRow.sha256,oldRow.sha256) ? delta.unchanged_paths : delta.modified_existing_paths).push(path);
  }
  if (delta.removed_paths.length || nextManifest.removed_files?.length) fail('WEB_MANIFEST_REMOVAL_UNAPPROVED');
  for (const [path,row] of nextRows) {
    if (oldRows.has(path)) continue;
    delta.added_paths.push(path);
    if (path===approvedExistingPreimageAddition && reason==='M1_V15_FIXED_FIXTURE_AND_DASHBOARD_LAUNCHER_V1') {
      if (row.production_preimage==='ABSENT' || !/^[a-f0-9]{64}$/i.test(row.production_preimage_sha256 || ''))
        fail(`ADDED_WEB_PREIMAGE_NOT_PINNED:${path}`);
      delta.rollback_restore_paths.push(path);
    } else if (approvedLegacyAdoption.get(reason)?.path===path &&
        row.production_preimage_class==='EXISTING_LEGACY_PRODUCTION_PREIMAGE' &&
        row.production_preimage!=='ABSENT' &&
        equalHash(row.production_preimage_sha256,approvedLegacyAdoption.get(reason).preimage)) {
      delta.rollback_restore_paths.push(path);
    } else {
      if (row.production_preimage!=='ABSENT' || row.production_preimage_sha256)
        fail(`ADDED_WEB_PREIMAGE_NOT_ABSENT:${path}`);
      delta.absent_preimage_paths.push(path);
      delta.rollback_remove_paths.push(path);
    }
  }
  const approved=approvedAdditivePaths.get(reason);
  const legacy=approvedLegacyAdoption.get(reason);
  const approvedPaths=Array.isArray(approved)?approved:approved?[approved]:[];
  if (approved ? delta.added_paths.length!==approvedPaths.length ||
      delta.added_paths.some((path,index)=>path!==approvedPaths[index]) :
      legacy ? delta.added_paths.length!==1 || delta.added_paths[0]!==legacy.path || delta.rollback_restore_paths.length!==1 :
      delta.added_paths.length!==0)
    fail('WEB_MANIFEST_ADDITION_UNAPPROVED');
  if (!rollbackCovered) fail('WEB_MANIFEST_ROLLBACK_COVERAGE_MISSING');
  return delta;
}

function nativeStageValid(root, state, lease, pending) {
  try {
    const file=inside(root,activeNativeReceiptPath(pending)), receipt=readJson(file);
    if (!equalHash(digest(file),pending.native_receipt_sha256) ||
        !nativeReceiptValid(receipt,{nativeSha:lease.native_deploy_git_sha,leaseId:lease.lease_id,manifestHash:lease.native_candidate_manifest_sha256})) return false;
    for (const item of receipt.artifacts) if (!equalHash(digest(inside(root,item.path)),item.sha256)) return false;
    return state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE';
  } catch { return false; }
}

function capabilitiesPreserved(manifest, lease, state) {
  const root=manifest.candidate_root, registry=capabilityRegistry(root,manifest.web_git_sha,governanceRoot,FIRST_PROMOTION);
  const rows=new Map(manifest.files.map(row=>[row.path,row.sha256.toUpperCase()]));
  const ids=new Set();
  for (const item of registry.capabilities || []) {
    if (!item.id || !Array.isArray(item.source_paths) || !item.source_paths.length) continue;
    const valid=item.source_paths.every(relative=> item.scope === 'NATIVE'
      ? spawnSync('git',['cat-file','-e',`${lease.native_deploy_git_sha}:${relative}`],{cwd:path.resolve(readJson(path.join(governanceRoot,'docs/project-control/production-release-authority.json')).native.source_root),windowsHide:true}).status===0
      : rows.has(relative) && fs.existsSync(inside(root,relative)) && equalHash(digest(inside(root,relative)),rows.get(relative)));
    if(valid) ids.add(item.id);
  }
  return [...new Set([...(state.accepted_capabilities || []),...(lease.candidate_capabilities || [])])].every(id=>ids.has(id));
}

export function planActiveWebAmendment({root,owner,leaseId,oldSha,newSha,newManifestFile,oldReceiptFile,sourceFixCheckpoint,reason}) {
  const local=path.join(root,'.local/ro-stack');
  const pendingFile=inside(root,pendingPath);
  const files={state:path.join(local,'production-deployment-state.json'),lease:path.join(local,'production-deployment-lease/lease.json'),
    pending:pendingFile, native:inside(root,activeNativeReceiptPath(readJson(pendingFile)))};
  const state=readJson(files.state),lease=readJson(files.lease),pending=readJson(files.pending);
  if (!webAmendmentHistoryValid(root,lease,pending,{web_git_sha:oldSha,
    web_candidate_amendments:lease.web_candidate_amendments})) fail('PRIOR_WEB_AMENDMENT_HISTORY_INVALID');
  const oldManifestFile=path.resolve(lease.admission_manifest);
  const oldManifest=readManifest(oldManifestFile), nextManifest=readManifest(newManifestFile);
  validateHeader(oldManifest);validateHeader(nextManifest);
  const oldReceipt=readJson(oldReceiptFile);
  const oldReceiptRelative=path.relative(root,oldReceiptFile).replaceAll('\\','/');
  if (!oldReceiptRelative.startsWith('.local/ro-stack/dashboard/deploy-receipts/') ||
      inside(root,oldReceiptRelative) !== path.resolve(oldReceiptFile)) fail('OLD_WEB_RECEIPT_PATH_INVALID');
  if (!equalHash(digest(oldManifestFile),lease.admission_manifest_sha256) ||
      oldManifest.manifest_digest!==lease.manifest_digest ||
      !equalHash(oldReceipt.manifest_sha256,lease.admission_manifest_sha256) ||
      !fs.existsSync(path.join(path.dirname(oldReceiptFile),'manifest.json')) ||
      !equalHash(digest(path.join(path.dirname(oldReceiptFile),'manifest.json')),lease.admission_manifest_sha256)) fail('OLD_WEB_MANIFEST_INVALID');
  const nativeValid=nativeStageValid(root,state,lease,pending);
  const admitted=admission(newManifestFile,root);
  const rollbackCovered=admitted.ROLLBACK_UNCOVERED_PATH_COUNT===0 &&
    admitted.ROLLBACK_COVERAGE_FILE_COUNT===nextManifest.file_count;
  const classified=validateManifestDelta(oldManifest,nextManifest,reason,rollbackCovered);
  const delta={unchanged_path_count:classified.unchanged_paths.length,
    modified_existing_path_count:classified.modified_existing_paths.length,
    added_paths:classified.added_paths,removed_paths:classified.removed_paths,
    absent_preimage_paths:classified.absent_preimage_paths,
    rollback_remove_paths:classified.rollback_remove_paths,
    rollback_restore_paths:classified.rollback_restore_paths};
  const remoteCheckout=run(nextManifest.candidate_root,'git',['rev-parse','HEAD'])===newSha &&
    !run(nextManifest.candidate_root,'git',['status','--porcelain=v1','--untracked-files=all']);
  const offline=run(nextManifest.candidate_root,'node',['scripts/test-canonical-web-offline.mjs']);
  const migration=run(nextManifest.candidate_root,'node',['scripts/test-legacy-item-rule-migration.mjs']);
  const targeted=reason==='START_FARM_HYBRID_PROFILE_SKILL_ENABLED_DEFAULTING_V1'
    ? run(nextManifest.candidate_root,'node',['scripts/test-start-farm-hybrid-skill-default.mjs']) : null;
  const evidenceFile=path.resolve(path.dirname(newManifestFile),nextManifest.first_promotion_evidence?.path || '');
  const evidence=readJson(evidenceFile);
  const firstEvidence=equalHash(digest(evidenceFile),nextManifest.first_promotion_evidence.sha256) &&
    firstPromotionEvidence(evidence,newSha,lease.native_deploy_git_sha);
  const preflight={remoteCheckout,sourceRegression:offline.includes('"failures":0') && migration.includes('LEGACY_ITEM_RULE_MIGRATION_PASS') &&
      (!targeted || targeted.includes('START_FARM_HYBRID_SKILL_DEFAULT_PASS cases=11')),
    manifestAdmission:admitted.PRESTAGE_COMPLETE===true,rollbackCoverage:rollbackCovered,
    capabilitySuperset:capabilitiesPreserved(nextManifest,lease,state),assetAuthority:admitted.assetPackage?.valid===true,firstEvidence};
  validateActiveWebAmendment({state,lease,pending,oldManifest,nextManifest,oldReceipt,leaseId,owner,oldSha,newSha,nativeValid,preflight});
  if (sourceFixCheckpoint!==newSha || !reason?.trim()) fail('AMENDMENT_REASON_REQUIRED');
  const auditRelative=`.local/ro-stack/web-candidate-amendment-${leaseId}-${newSha.slice(0,12)}.json`;
  const auditFile=inside(root,auditRelative);
  const audit={schema_version:'active-first-promotion-web-candidate-amendment-v1', lease_id:leaseId,lease_owner:owner,
    promotion_id:leaseId,old_web_git_sha:oldSha,new_web_git_sha:newSha,reason,source_fix_checkpoint:sourceFixCheckpoint,
    timestamp:new Date().toISOString(),native_stage_receipt_reference:{path:activeNativeReceiptPath(pending),sha256:digest(files.native)},
    previous_web_candidate_receipt_reference:{path:oldReceiptRelative,sha256:digest(oldReceiptFile)},
    prior_web_candidate_receipts:[...(lease.web_candidate_amendments || []).map(item=>({
      path:item.previous_web_candidate_receipt,sha256:item.previous_web_candidate_receipt_sha256})),
      {path:oldReceiptRelative,sha256:digest(oldReceiptFile)}],
    old_manifest_sha256:digest(oldManifestFile),new_manifest_sha256:digest(newManifestFile),
    new_manifest_digest:nextManifest.manifest_digest,manifest_delta:delta,
    governance_sha:run(governanceRoot,'git',['rev-parse','HEAD']),
    amendment_evidence_digest:createHash('sha256').update(JSON.stringify({preflight,offline,migration,targeted,evidence_sha256:digest(evidenceFile)})).digest('hex').toUpperCase(),
    preflight};
  const history={old_web_git_sha:oldSha,new_web_git_sha:newSha,audit_receipt:auditRelative,audit_sha256:createHash('sha256').update(JSON.stringify(audit,null,2)+'\n').digest('hex').toUpperCase(),
    previous_web_candidate_receipt:oldReceiptRelative,previous_web_candidate_receipt_sha256:digest(oldReceiptFile)};
  const nextLease={...lease,web_deploy_git_sha:newSha,admission_manifest:path.resolve(newManifestFile),admission_manifest_sha256:digest(newManifestFile),
    manifest_digest:nextManifest.manifest_digest,web_candidate_amendments:[...(lease.web_candidate_amendments || []),history]};
  const nextPending={...pending,web_git_sha:newSha,web_candidate_amendments:[...(pending.web_candidate_amendments || []),history]};
  return {files,oldHashes:Object.fromEntries(Object.entries(files).map(([key,file])=>[key,digest(file)])),
    oldManifestFile,oldManifestHash:digest(oldManifestFile),newManifestFile,newManifestHash:digest(newManifestFile),
    oldReceiptFile,oldReceiptHash:digest(oldReceiptFile), audit,auditFile,nextLease,nextPending,history,preflight,delta};
}

export function applyAmendmentPlan(root,plan) {
  if (fs.existsSync(plan.auditFile) || Object.entries(plan.files).some(([key,file])=>digest(file)!==plan.oldHashes[key]) ||
      digest(plan.oldManifestFile)!==plan.oldManifestHash || digest(plan.newManifestFile)!==plan.newManifestHash ||
      digest(plan.oldReceiptFile)!==plan.oldReceiptHash || fs.existsSync(inside(root,consumedPath))) fail('AMENDMENT_CONCURRENT_CHANGE');
  fs.writeFileSync(plan.auditFile,JSON.stringify(plan.audit,null,2)+'\n',{flag:'wx'});
  atomic(plan.files.pending,plan.nextPending);
  atomic(plan.files.lease,plan.nextLease);
}

function main() {
  const argv=process.argv.slice(2),args=Object.fromEntries(argv.flatMap((value,index)=>value.startsWith('--')?[[value.slice(2),argv[index+1]]]:[]));
  const root=path.resolve(args['production-root'] || '');
  if (!args['production-root'] || (args['test-mode']==='true' ? !root.startsWith(os.tmpdir()+path.sep) : root.toLowerCase()!==canonicalProduction.toLowerCase())) fail('PRODUCTION_ROOT_INVALID');
  if (!args.owner || !args.lease || !args['old-web-sha'] || !args['new-web-sha'] || !args.manifest || !args['old-web-receipt'] ||
      !args['source-fix-checkpoint'] || !args.reason || !['true','false'].includes(args.execute)) fail('AMENDMENT_ARGUMENTS_REQUIRED');
  const authority=readJson(path.join(governanceRoot,'docs/project-control/production-release-authority.json'));
  if (run(governanceRoot,'git',['remote','get-url','origin'])!==authority.web.repository ||
      run(governanceRoot,'git',['rev-parse','HEAD'])!==run(governanceRoot,'git',['ls-remote','origin',authority.web.release_ref]).split(/\s/)[0] ||
      run(governanceRoot,'git',['status','--porcelain=v1','--untracked-files=all'])) fail('GOVERNANCE_MAIN_REQUIRED');
  const auditFile=inside(root,`.local/ro-stack/web-candidate-amendment-${args.lease}-${args['new-web-sha'].slice(0,12)}.json`);
  const currentLease=readJson(path.join(root,'.local/ro-stack/production-deployment-lease/lease.json'));
  const currentPending=readJson(inside(root,pendingPath));
  if (fs.existsSync(auditFile)) {
    const audit=readJson(auditFile);
    if (duplicateAmendmentIsApplied(audit,currentLease,currentPending,{leaseId:args.lease,owner:args.owner,
      oldSha:args['old-web-sha'],newSha:args['new-web-sha']})) {
      console.log(JSON.stringify({amended:true,idempotent:true,audit_receipt:auditFile}));return;
    }
    fail('AMENDMENT_PARTIAL_OR_CONFLICT');
  }
  const plan=planActiveWebAmendment({root,owner:args.owner,leaseId:args.lease,oldSha:args['old-web-sha'],
    newSha:args['new-web-sha'],newManifestFile:path.resolve(args.manifest),oldReceiptFile:path.resolve(args['old-web-receipt']),
    sourceFixCheckpoint:args['source-fix-checkpoint'],reason:args.reason});
  if (args.execute==='false') {console.log(JSON.stringify({eligible:true,dry_run:true,preflight:plan.preflight,manifest_delta:plan.delta,audit_receipt:plan.auditFile}));return;}
  applyAmendmentPlan(root,plan);
  console.log(JSON.stringify({amended:true,idempotent:false,lease_id:args.lease,old_web_git_sha:args['old-web-sha'],
    new_web_git_sha:args['new-web-sha'],manifest_delta:plan.delta,audit_receipt:plan.auditFile,
    amendment_evidence_digest:plan.audit.amendment_evidence_digest}));
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { main(); } catch(error) {console.log(JSON.stringify({amended:false,error:error.message}));process.exitCode=1;}
}
