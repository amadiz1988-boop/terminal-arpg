// Lease-bound delivery of the one command contract omitted from the active
// Native candidate. Historical candidate manifests and receipts stay immutable.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { boundedPath, digest, readJson, pendingPath, legacyIdentity } from './legacy-production-baseline.mjs';
import { activeNativeReceiptPath, equalHash, git, nativeReceiptValid, verifyNativeStage,
  NATIVE_REPOSITORY } from './native-promotion-contract.mjs';
import { validateHistoricalNativeAnchor, M1_PROMOTION_LEASE_ID, M1_PROMOTION_OWNER } from './native-amendment-chain.mjs';
import { replaceContractImage, restoreContractPreimage } from './native-runtime-contract-artifact.mjs';

export const COMMAND_CONTRACT_AMENDMENT = Object.freeze({
  nativeSha: '668bb9db42dd4bb9cf7651c5c1e40c95531ada35',
  webSha: '1346bd0561194da63de5132f9ea11ec820f703e7',
  sourcePath: 'conf/persistent_agent_commands.json',
  targetPath: '.local/ro-stack/rathena/conf/persistent_agent_commands.json',
  preimageSha256: 'C983A78BD9D87E184CBC095C4576332447C4C076F25F5BEDEF932AF37D4661F0',
  imageSha256: '4DA600DCF955D3510EE1289C0F28D257D1D5C1BAB03D90B9E28DCEC3789E73A0',
  leaseId: M1_PROMOTION_LEASE_ID, owner: M1_PROMOTION_OWNER,
});
const policy = COMMAND_CONTRACT_AMENDMENT;
const need = (ok, code) => { if (!ok) throw Error(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const atomic = (file, value) => { const tmp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); fs.renameSync(tmp, file); };

export function inspectSavedTownDelta(before, after) {
  need(before?.contractKind === 'persistent_agent_command_contract' && before.contractVersion === 1 &&
    after?.contractKind === before.contractKind && after.contractVersion === 1 &&
    Array.isArray(before.commands) && Array.isArray(after.commands) &&
    before.commands.length === after.commands.length, 'CONTRACT_ROOT_INVALID');
  const { commands: oldRows, ...oldRoot } = before, { commands: newRows, ...newRoot } = after;
  need(same(canonical(oldRoot), canonical(newRoot)), 'CONTRACT_ROOT_CHANGED');
  need(same(oldRows.map(x => x.action), newRows.map(x => x.action)) &&
    new Set(oldRows.map(x => x.action)).size === oldRows.length, 'CONTRACT_ACTION_SET_CHANGED');
  const changed = oldRows.filter((row, i) => !same(canonical(row), canonical(newRows[i])));
  need(changed.length === 1 && changed[0].action === 'set_saved_town', 'CONTRACT_UNRELATED_ACTION_CHANGED');
  const oldRow = changed[0], row = newRows[oldRows.indexOf(oldRow)];
  const { payload: oldPayload, statePrecondition: oldState, ...oldOther } = oldRow;
  const { payload: newPayload, statePrecondition: newState, ...newOther } = row;
  need(same(canonical(oldOther), canonical(newOther)) &&
    same(canonical(oldPayload?.required), { targetMap: 'string' }) &&
    same(canonical(oldPayload?.optional), {}) &&
    same(canonical(newPayload?.required), { targetMap: 'string' }) &&
    same(canonical(newPayload?.optional), { saveX: 'integer', saveY: 'integer' }) &&
    oldState === 'resident fd=0, alive, PERSISTENT_IDLE; physically on selected rAthena town map' &&
    newState === 'resident fd=0, alive, PERSISTENT_IDLE; physically on selected MF_TOWN or permanent Kafra Save map; optional coordinates must match an authored Kafra Save destination',
  'SAVED_TOWN_DELTA_INVALID');
  return { changed_actions: ['set_saved_town'], added_optional_fields: ['saveX', 'saveY'],
    removed_actions: [], unrelated_changes: 0 };
}

export function validateCommandContractManifest(m) {
  need(m?.schema_version === 'native-command-contract-amendment-v1' &&
    m.native_git_sha === policy.nativeSha && m.web_git_sha === policy.webSha &&
    m.lease_id === policy.leaseId && m.owner_task_id === policy.owner &&
    /^[a-f0-9]{64}$/i.test(m.active_candidate_manifest_sha256 || '') &&
    /^[a-f0-9]{64}$/i.test(m.active_native_receipt_sha256 || '') &&
    /^[a-f0-9]{64}$/i.test(m.build_receipt_sha256 || '') &&
    Array.isArray(m.executables) && m.executables.length === 3 &&
    same(m.executables.map(x => x.path).sort(), ['char-server.exe', 'login-server.exe', 'map-server.exe']) &&
    m.executables.every(x => /^[a-f0-9]{64}$/i.test(x.sha256 || '') &&
      x.production_path === `.local/ro-stack/rathena/${x.path}`) &&
    Array.isArray(m.config_artifacts) && m.config_artifacts.length === 1,
  'CONTRACT_CANDIDATE_IDENTITY_INVALID');
  const item = m.config_artifacts[0];
  need(item.source_path === policy.sourcePath && item.source_git_sha === policy.nativeSha &&
    item.candidate_package_path === 'contract-image.json' && item.production_path === policy.targetPath &&
    equalHash(item.sha256, policy.imageSha256) &&
    equalHash(item.preimage_sha256, policy.preimageSha256) &&
    item.required_by === 'map-server.exe' && item.rollback_model === 'RESTORE_EXACT_PREIMAGE' &&
    m.rollback?.previous_contract_path === policy.targetPath &&
    equalHash(m.rollback.previous_contract_sha256, policy.preimageSha256) &&
    same(m.rollback.executable_hashes, m.executables),
  'CONTRACT_CANDIDATE_CONFIG_INVALID');
  return true;
}

function exactSource(nativeRoot) {
  need(git(nativeRoot, 'remote', 'get-url', 'origin') === NATIVE_REPOSITORY &&
    git(nativeRoot, 'rev-parse', 'HEAD') === policy.nativeSha &&
    git(nativeRoot, 'status', '--porcelain=v1', '--', policy.sourcePath) === '',
  'NATIVE_CONTRACT_SOURCE_NOT_CANONICAL');
  const file = boundedPath(nativeRoot, policy.sourcePath), bytes = fs.readFileSync(file);
  need(equalHash(digest(file), policy.imageSha256), 'NATIVE_CONTRACT_SOURCE_HASH_CHANGED');
  const blob = spawnSync('git', ['show', `${policy.nativeSha}:${policy.sourcePath}`],
    { cwd: nativeRoot, encoding: 'buffer', windowsHide: true, timeout: 30000 });
  need(blob.status === 0 && bytes.toString('utf8').replaceAll('\r\n', '\n') === blob.stdout.toString('utf8'),
    'NATIVE_CONTRACT_GIT_BLOB_MISMATCH');
  return bytes;
}

function anchored(root, manifestFile, nativeRoot) {
  const dir = boundedPath(root, '.local/ro-stack');
  const leaseFile = path.join(dir, 'production-deployment-lease/lease.json');
  const pendingFile = boundedPath(root, pendingPath), stateFile = path.join(dir, 'production-deployment-state.json');
  const lease = readJson(leaseFile), pending = readJson(pendingFile), state = readJson(stateFile);
  validateHistoricalNativeAnchor(root, lease, pending);
  need(lease.lease_id === policy.leaseId && lease.owner_task_id === policy.owner &&
    lease.status === 'ACTIVE' && lease.native_deploy_git_sha === policy.nativeSha &&
    lease.web_deploy_git_sha === policy.webSha && pending.native_git_sha === policy.nativeSha &&
    pending.web_git_sha === policy.webSha && legacyIdentity(state) && state.production_drift === 'OPEN' &&
    state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE',
  'CONTRACT_ACTIVE_LEASE_INVALID');
  need(!lease.native_command_contract_amendment && !pending.native_command_contract_amendment,
    'CONTRACT_ALREADY_AMENDED');
  const candidate = lease.active_native_candidate;
  need(candidate?.deployed === true && candidate.native_git_sha === policy.nativeSha &&
    equalHash(digest(candidate.candidate_manifest), candidate.candidate_manifest_sha256) &&
    equalHash(candidate.candidate_manifest_sha256, lease.native_candidate_manifest_sha256),
  'CONTRACT_ACTIVE_CANDIDATE_INVALID');
  const candidateManifest = readJson(candidate.candidate_manifest);
  const buildFile = boundedPath(path.dirname(candidate.candidate_manifest), candidateManifest.build_receipt.path);
  need(equalHash(digest(buildFile), candidateManifest.build_receipt.sha256), 'CONTRACT_BUILD_RECEIPT_CHANGED');
  const build = readJson(buildFile);
  const receiptPath = activeNativeReceiptPath(pending), receiptFile = boundedPath(root, receiptPath);
  need(equalHash(digest(receiptFile), pending.native_receipt_sha256) &&
    nativeReceiptValid(readJson(receiptFile), { nativeSha: policy.nativeSha, leaseId: policy.leaseId,
      manifestHash: candidate.candidate_manifest_sha256 }), 'CONTRACT_ACTIVE_NATIVE_RECEIPT_INVALID');
  const nativeReceipt = readJson(receiptFile);
  need(verifyNativeStage(root, state, lease, lease.admission_manifest_sha256).rollbackReady === true,
    'CONTRACT_EXECUTABLE_ROLLBACK_NOT_READY');
  const target = boundedPath(root, policy.targetPath);
  need(equalHash(digest(target), policy.preimageSha256), 'CONTRACT_PREIMAGE_CHANGED');
  const bytes = exactSource(nativeRoot);
  const delta = inspectSavedTownDelta(readJson(target), JSON.parse(bytes.toString('utf8')));
  const m = readJson(manifestFile);
  validateCommandContractManifest(m);
  need(equalHash(m.active_candidate_manifest_sha256, candidate.candidate_manifest_sha256) &&
    equalHash(m.active_native_receipt_sha256, pending.native_receipt_sha256) &&
    equalHash(m.build_receipt_sha256, digest(buildFile)) &&
    same(m.executables, build.artifacts.map(x => ({ ...x,
      production_path: `.local/ro-stack/rathena/${x.path}` }))) &&
    nativeReceipt.artifacts.every(x => m.executables.some(y => x.path === y.production_path && equalHash(x.sha256, y.sha256))) &&
    m.executables.every(x => equalHash(digest(boundedPath(root, x.production_path)), x.sha256)) &&
    equalHash(digest(boundedPath(path.dirname(manifestFile), 'contract-image.json')), policy.imageSha256),
  'CONTRACT_CANDIDATE_BYTES_CHANGED');
  return { dir, leaseFile, pendingFile, stateFile, lease, pending, state, target, bytes, delta, manifest:m,
    executables:m.executables, hashes:{lease:digest(leaseFile), pending:digest(pendingFile), state:digest(stateFile)} };
}

export function prepareCommandContractAmendment({ root, nativeRoot, packageRoot }) {
  need(!fs.existsSync(packageRoot), 'FRESH_PACKAGE_REQUIRED');
  need(!path.resolve(packageRoot).toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep),
    'PACKAGE_IN_PRODUCTION_FORBIDDEN');
  const bytes = exactSource(nativeRoot), dir = boundedPath(root, '.local/ro-stack');
  const lease = readJson(path.join(dir, 'production-deployment-lease/lease.json'));
  const pending = readJson(boundedPath(root, pendingPath));
  validateHistoricalNativeAnchor(root, lease, pending);
  need(lease.lease_id === policy.leaseId && lease.owner_task_id === policy.owner &&
    lease.native_deploy_git_sha === policy.nativeSha && lease.web_deploy_git_sha === policy.webSha &&
    lease.active_native_candidate?.deployed === true &&
    equalHash(digest(boundedPath(root, policy.targetPath)), policy.preimageSha256),
  'CONTRACT_PREPARE_STATE_INVALID');
  const candidateFile = lease.active_native_candidate.candidate_manifest;
  const candidate = readJson(candidateFile);
  const buildFile = boundedPath(path.dirname(candidateFile), candidate.build_receipt.path);
  const build = readJson(buildFile);
  const executables = build.artifacts.map(x => ({ ...x, production_path: `.local/ro-stack/rathena/${x.path}` }));
  const manifest = { schema_version:'native-command-contract-amendment-v1',
    native_git_sha:policy.nativeSha, web_git_sha:policy.webSha, lease_id:policy.leaseId, owner_task_id:policy.owner,
    active_candidate_manifest_sha256:lease.active_native_candidate.candidate_manifest_sha256,
    active_native_receipt_sha256:pending.native_receipt_sha256, build_receipt_sha256:digest(buildFile),
    executables, config_artifacts:[{ source_path:policy.sourcePath, source_git_sha:policy.nativeSha,
      sha256:policy.imageSha256, candidate_package_path:'contract-image.json', production_path:policy.targetPath,
      preimage_sha256:policy.preimageSha256, required_by:'map-server.exe', rollback_model:'RESTORE_EXACT_PREIMAGE' }],
    rollback:{ previous_contract_path:policy.targetPath, previous_contract_sha256:policy.preimageSha256,
      executable_hashes:executables } };
  validateCommandContractManifest(manifest);
  fs.mkdirSync(packageRoot);
  fs.writeFileSync(path.join(packageRoot, 'contract-image.json'), bytes, { flag:'wx' });
  fs.writeFileSync(path.join(packageRoot, 'candidate-manifest.json'), JSON.stringify(manifest,null,2)+'\n', { flag:'wx' });
  return { manifest:path.join(packageRoot,'candidate-manifest.json'),
    sha256:digest(path.join(packageRoot,'candidate-manifest.json')),
    executable_count:executables.length, config_count:1, config_sha256:digest(path.join(packageRoot,'contract-image.json')) };
}

export function preflightCommandContractAmendment({ root, nativeRoot, manifestFile, manifestSha256 }) {
  need(equalHash(digest(manifestFile), manifestSha256), 'CONTRACT_MANIFEST_CHANGED');
  const x = anchored(root, manifestFile, nativeRoot);
  need(!fs.existsSync(path.join(x.dir, 'native-command-contract-amendment.lock')),
    'CONTRACT_AMENDMENT_BUSY');
  return { eligible:true, executable_count:3, config_count:1, semantic_delta:x.delta,
    preimage_sha256:policy.preimageSha256, image_sha256:policy.imageSha256,
    rollback_executables_ready:true, rollback_previous_contract_ready:true };
}

export async function deployCommandContractAmendment({ root, nativeRoot, manifestFile, manifestSha256,
  adapter, governanceSha, timeoutMs = 60000 }) {
  need(/^[a-f0-9]{40}$/i.test(governanceSha || ''), 'GOVERNANCE_SHA_REQUIRED');
  const preflight = preflightCommandContractAmendment({root,nativeRoot,manifestFile,manifestSha256});
  const x = anchored(root,manifestFile,nativeRoot), lock = path.join(x.dir,'native-command-contract-amendment.lock');
  const archiveName = `native-command-contract-amendment-${policy.leaseId}-${policy.nativeSha.slice(0,12)}`;
  const archive = path.join(x.dir,archiveName);
  need(!fs.existsSync(archive), 'CONTRACT_AMENDMENT_REPLAY');
  const before = await adapter('snapshot');
  need(before?.pass === true && before.openkore_runtime_count === 0 &&
    ['login','char','map'].every(n => before.counts?.[n] === 1) &&
    before.procdump_receipt?.mapPid === before.pids?.map &&
    before.procdump_process_identity?.PROCESS_IDENTITY_MATCH === 'YES',
  'CONTRACT_PRESTOP_RUNTIME_INVALID');
  fs.mkdirSync(lock);
  const originalLease = fs.readFileSync(x.leaseFile), originalPending = fs.readFileSync(x.pendingFile);
  const backup = path.join(lock,'preimage.json'), staged = path.join(lock,'staged-image.json');
  const archivedImage = path.join(lock,'contract-image.json');
  const journal = path.join(lock,'operation.json');
  fs.writeFileSync(journal,JSON.stringify({schema_version:'native-command-contract-operation-v1',
    lease_id:policy.leaseId, owner_task_id:policy.owner, manifest_sha256:manifestSha256,
    before_pids:before.pids, phase:'STAGE', started_at:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
  let stopped=false, replaced=false, after=null, reference=null;
  try {
    fs.copyFileSync(x.target,backup,fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(boundedPath(path.dirname(manifestFile),'contract-image.json'),archivedImage,fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(archivedImage,staged,fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(backup),policy.preimageSha256) && equalHash(digest(staged),policy.imageSha256) &&
      equalHash(digest(archivedImage),policy.imageSha256),
      'CONTRACT_STAGE_HASH_INVALID');
    need(Object.entries(x.hashes).every(([key,value]) => equalHash(digest(x[key+'File']),value)) &&
      equalHash(digest(manifestFile),manifestSha256) &&
      x.executables.every(row => equalHash(digest(boundedPath(root,row.production_path)),row.sha256)),
    'CONTRACT_PREMUTATION_CHANGED');
    await adapter('stop'); stopped=true;
    atomic(journal,{...readJson(journal),phase:'REPLACE_CONFIG'});
    replaceContractImage({target:x.target,staged,displaced:path.join(lock,'displaced.json'),backup,
      oldHash:policy.preimageSha256,newHash:policy.imageSha256}); replaced=true;
    atomic(journal,{...readJson(journal),phase:'START'});
    await adapter('start');
    const until=Date.now()+timeoutMs;
    do { after=await adapter('snapshot'); if(after?.pass && after.procdump_receipt?.mapPid===after.pids?.map &&
      after.procdump_process_identity?.PROCESS_IDENTITY_MATCH==='YES') break;
      await new Promise(resolve=>setTimeout(resolve,1000)); } while(Date.now()<until);
    need(after?.pass===true && after.openkore_runtime_count===0 &&
      after.dashboard_pid===before.dashboard_pid && after.database_pid===before.database_pid &&
      after.pids.map!==before.pids.map && equalHash(digest(x.target),policy.imageSha256) &&
      x.executables.every(row => equalHash(digest(boundedPath(root,row.production_path)),row.sha256)),
    'CONTRACT_POSTDEPLOY_HEALTH_INVALID');
    need(Object.entries(x.hashes).every(([key,value]) => equalHash(digest(x[key+'File']),value)),
      'CONTRACT_GOVERNANCE_CHANGED_DURING_RESTART');
    const receiptPath = `.local/ro-stack/${archiveName}/receipt.json`;
    const receipt = {schema_version:'native-command-contract-deploy-v1',lease_id:policy.leaseId,
      owner_task_id:policy.owner,native_git_sha:policy.nativeSha,web_git_sha:policy.webSha,
      governance_git_sha:governanceSha,
      candidate_manifest_sha256:manifestSha256,active_candidate_manifest_sha256:x.manifest.active_candidate_manifest_sha256,
      previous_contract:{path:policy.targetPath,sha256:policy.preimageSha256,
        rollback_path:`.local/ro-stack/${archiveName}/preimage.json`},
      current_contract:{path:policy.targetPath,sha256:policy.imageSha256,
        package_path:`.local/ro-stack/${archiveName}/contract-image.json`},
      executables:x.executables, old_pids:before.pids,new_pids:after.pids,
      procdump_receipt:after.procdump_receipt,openkore_runtime_count:after.openkore_runtime_count,
      runtime_health:after,rollback_ready:true,semantic_delta:x.delta,
      deployed_at:new Date().toISOString()};
    fs.writeFileSync(path.join(lock,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    const ref={receipt:receiptPath,sha256:digest(path.join(lock,'receipt.json')),
      candidate_manifest:`.local/ro-stack/${archiveName}/candidate-manifest.json`,
      candidate_manifest_sha256:manifestSha256};
    reference=ref;
    fs.copyFileSync(manifestFile,path.join(lock,'candidate-manifest.json'),fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(path.join(lock,'candidate-manifest.json')),manifestSha256),
      'CONTRACT_MANIFEST_ARCHIVE_INVALID');
    fs.renameSync(lock,archive);
    atomic(x.pendingFile,{...readJson(x.pendingFile),native_command_contract_amendment:ref});
    atomic(x.leaseFile,{...readJson(x.leaseFile),native_command_contract_amendment:ref});
    const verified=verifyNativeStage(root,readJson(x.stateFile),readJson(x.leaseFile),x.lease.admission_manifest_sha256);
    need(verified.pass===true && verified.rollbackReady===true &&
      equalHash(digest(x.target),policy.imageSha256) &&
      equalHash(digest(path.join(archive,'contract-image.json')),policy.imageSha256) &&
      equalHash(digest(path.join(archive,'preimage.json')),policy.preimageSha256),
    'CONTRACT_POSTDEPLOY_RECEIPT_INVALID');
    return { ...preflight, deployed:true, receipt:receiptPath, receipt_sha256:ref.sha256,
      production_contract_sha256:policy.imageSha256,rollback_preimage_sha256:policy.preimageSha256,
      runtime:after };
  } catch(error) {
    let rollback=null,rollbackError=null;
    const evidenceDir=fs.existsSync(archive)?archive:lock;
    const backupFile=path.join(evidenceDir,'preimage.json');
    if(replaced) {
      try {
        const snapshot=await adapter('snapshot');
        if(snapshot?.pass===true && ['login','char','map'].every(n => snapshot.counts?.[n]===1))
          await adapter('stop');
        else need(['login','char','map'].every(n => snapshot?.counts?.[n]===0),
          'CONTRACT_ROLLBACK_PARTIAL_RUNTIME');
        restoreContractPreimage({target:x.target,backup:backupFile,oldHash:policy.preimageSha256});
        await adapter('start');
        const restored=await adapter('snapshot');
        rollback={preimage_restored:equalHash(digest(x.target),policy.preimageSha256),
          executables_unchanged:x.executables.every(row => equalHash(digest(boundedPath(root,row.production_path)),row.sha256)),
          runtime_healthy:restored?.pass===true};
      } catch(failure) { rollbackError=failure.message; }
    } else if(stopped) {
      try { await adapter('start'); rollback={preimage_restored:equalHash(digest(x.target),policy.preimageSha256)}; }
      catch(failure) { rollbackError=failure.message; }
    }
    for(const [file,original] of [[x.pendingFile,originalPending],[x.leaseFile,originalLease]]) {
      if(reference && readJson(file).native_command_contract_amendment?.receipt===reference.receipt) {
        const tmp=file+'.'+randomUUID()+'.rollback';fs.writeFileSync(tmp,original,{flag:'wx'});fs.renameSync(tmp,file);
      }
    }
    fs.writeFileSync(path.join(evidenceDir,'failure-receipt.json'),JSON.stringify({error:error.message,rollback,
      rollback_error:rollbackError,preimage_sha256:fs.existsSync(backupFile)?digest(backupFile):null,
      executables:x.executables,failed_at:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
    throw Error(error.message+(rollbackError?':ROLLBACK_FAILED:'+rollbackError:':ROLLBACK_RECORDED'));
  }
}
