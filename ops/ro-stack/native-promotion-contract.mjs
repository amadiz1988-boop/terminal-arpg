import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, FIRST_PROMOTION, legacyIdentity, verifyLegacyBaseline, pendingPath } from './legacy-production-baseline.mjs';

export const NATIVE_REPOSITORY = 'https://github.com/amadiz1988-boop/ghost-island-rathena.git';
export const nativeReceiptPath = '.local/ro-stack/native-promotion-receipt.json';
export const nativeArtifacts = ['login', 'char', 'map'].map(n => `.local/ro-stack/rathena/${n}-server.exe`);
export const groups = {
  'PA command contracts': 'tools/pa-command-contract/Test-PaCommandContract.ps1',
  'C++ contracts': 'tools/pa-command-contract/build-and-test-pa-contract.ps1',
  'SERVER_AGENT': 'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  'PERSISTENT_IDLE': 'tools/pa-restart-restore/Test-PaRestartRestore.ps1',
  'quarantine recovery': 'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  'stale task cleanup': 'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  'stale owner cleanup': 'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  'stale target cleanup': 'tools/pa-quarantine-idle-recovery/build-and-test.ps1',
  'graceful shutdown/restart': 'tools/pa-restart-restore/Test-PaRestartRestore.ps1',
  'farm/combat authority': 'tools/pa-command-contract/Test-PaCommandContract.ps1',
  'M1 Supply policy': 'C++ M1 supply policy',
  'Fly nonconsumption': 'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  'Butterfly nonconsumption': 'tools/pa-command-contract/Test-M1CanonicalSource.ps1',
  'Arrow nonconsumption': 'tools/pa-post-warp-observation/Test-NonConsumableAmmo.ps1',
  'Bullet nonconsumption': 'tools/pa-post-warp-observation/Test-NonConsumableAmmo.ps1',
  'missing-ammo safe block': 'tools/pa-command-contract/Test-M1AmmoBlockedSource.ps1',
  'AUTO_FARM relevant contracts': 'tools/pa-auto-farm-target/test-auto-farm-target-acquisition.mjs'
};
const check = (ok, code) => { if (!ok) throw Error(code); };
export const equalHash = (a, b) => /^[a-f0-9]{64}$/i.test(a || '') && String(a).toUpperCase() === String(b).toUpperCase();
export function pinned(base, ref) {
  check(ref?.path && ref.sha256, 'PINNED_REFERENCE_REQUIRED');
  const file = boundedPath(base, ref.path);
  check(fs.existsSync(file) && equalHash(digest(file), ref.sha256), 'PINNED_CONTENT_CHANGED');
  return file;
}
export function git(root, ...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  check(r.status === 0, `GIT_${args[0]}_FAILED`); return r.stdout.trim();
}
export function verifyNativeRemote(root, sha, authority) {
  check(sha === authority.accepted_source_sha && authority.github_repository === NATIVE_REPOSITORY, 'NATIVE_SHA_NOT_APPROVED');
  check(git(root, 'remote', 'get-url', 'origin') === NATIVE_REPOSITORY, 'NATIVE_REMOTE_INVALID');
  const tip = git(root, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
  git(root, 'fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main');
  git(root, 'merge-base', '--is-ancestor', sha, tip);
  const entry = fileURLToPath(new URL('../../scripts/build-native-candidate.py',import.meta.url));
  const privacy = spawnSync('python',[entry,'--sha',sha,'--verify-remote-only'],{encoding:'utf8',windowsHide:true,timeout:45000});
  check(privacy.status===0 && JSON.parse(privacy.stdout).private===true,'CANONICAL_PRIVATE_REPOSITORY_REQUIRED');
  return true;
}

// Additional source contract for graceful shutdown ordering, executed without runtime.
export function shutdownContract(root) {
  const map = fs.readFileSync(boundedPath(root, 'src/map/map.cpp'), 'utf8');
  const pa = fs.readFileSync(boundedPath(root, 'src/map/persistent_agent.cpp'), 'utf8');
  const state = fs.readFileSync(boundedPath(root, 'src/map/persistent_agent_state.cpp'), 'utf8');
  const body = map.slice(map.indexOf('void MapServer::handle_shutdown()'), map.indexOf('void MapServer::handle_shutdown()') + 2500);
  return body.indexOf('persistent_agent_prepare_shutdown();') >= 0 &&
    body.indexOf('persistent_agent_confirm_shutdown();') > body.indexOf('persistent_agent_prepare_shutdown();') &&
    pa.includes('persistent_agent_state_mark_shutdown_pending(runtime.record, runtime_instance_id)') &&
    pa.includes('persistent_agent_state_confirm_clean_shutdown(runtime.record, runtime_instance_id)') &&
    state.includes("`runtime_state`='SHUTDOWN_PENDING'") && state.includes("`runtime_state`='CLEAN_SHUTDOWN'");
}

export function evaluateNative({ manifest: m, build: b, authority, reachable, sourceClean,
  artifactsValid, regressionValid, capabilities, rollbackValid, state, lease, owner, leaseId,
  manifestHash, mode = 'precheck', runtime }) {
  const errors = []; const need = (ok, code) => { if (!ok) errors.push(code); };
  need(m?.schema_version === 'native-candidate-v1' && /^[A-Za-z0-9_-]+$/.test(m.candidate_id || ''), 'NATIVE_MANIFEST_INVALID');
  need(m?.native_git_sha === authority.accepted_source_sha && /^[a-f0-9]{40}$/.test(m?.native_git_sha || '') && reachable, 'NATIVE_SHA_NOT_CANONICAL');
  need(m?.canonical_repository === NATIVE_REPOSITORY && m.canonical_branch === 'main', 'NATIVE_REMOTE_INVALID');
  need(b?.schema_version === 'native-build-v1' && b.build_id && b.built_at && b.toolchain?.version &&
    b.native_git_sha === m.native_git_sha && b.canonical_repository === m.canonical_repository &&
    b.canonical_branch === 'main' && b.build_configuration === 'Release x64', 'NATIVE_BUILD_RECEIPT_INVALID');
  need(b?.source_tree_state === 'CLEAN' && sourceClean, 'NATIVE_SOURCE_DIRTY');
  need(artifactsValid && equalHash(b?.binary_sha256, m?.binary_sha256), 'NATIVE_BINARY_MISMATCH');
  need(b?.tests_result === 'PASS' && regressionValid, 'NATIVE_REGRESSION_REQUIRED');
  need(capabilities?.pass === true, 'NATIVE_CAPABILITY_SUPERSET_FAILED');
  need(rollbackValid, 'NATIVE_ROLLBACK_REQUIRED');
  need(m?.required_database === 'ragnarok' && JSON.stringify(m?.required_runtime_ports) === JSON.stringify([6901,6122,5122,8788]), 'NATIVE_TOPOLOGY_INVALID');
  need(m?.required_openkore_count === 0, 'OPENKORE_FORBIDDEN');
  // reconcile: the candidate was already staged under this lease; the only
  // admitted state is the lease-owned first-promotion Native stage.
  if (mode === 'reconcile') need(legacyIdentity(state) && state?.production_drift === 'OPEN' &&
    state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT', 'NATIVE_STAGE_STATE_INVALID');
  else need(legacyIdentity(state) && state?.production_drift === 'CLOSED', 'PRODUCTION_DRIFT_OPEN');
  if (mode === 'deploy' || mode === 'reconcile') {
    need(lease?.status === 'ACTIVE' && lease.promotion_mode === FIRST_PROMOTION && lease.owner_task_id === owner &&
      lease.lease_id === leaseId && !!leaseId && lease.native_deploy_git_sha === m.native_git_sha &&
      equalHash(lease.native_candidate_manifest_sha256, manifestHash), 'NATIVE_LEASE_NOT_OWNED');
    need(runtime?.pass === true && runtime.openkore_runtime_count === 0 &&
      ['login','char','map'].every(n => runtime.counts?.[n] === 1), 'SINGLE_RUNTIME_REQUIRED');
  }
  return { eligible: !errors.length, errors };
}

export function inspectNativeCandidate({ file, sha256, root, state, authority, mode = 'precheck', lease, owner, leaseId, runtime, webCapabilities = [], webRoot, webSha, remoteVerifier = verifyNativeRemote }) {
  check(equalHash(digest(file), sha256), 'NATIVE_MANIFEST_TAMPERED');
  const m = readJson(file), base = path.dirname(file);
  const buildFile = pinned(base, m.build_receipt), build = readJson(buildFile), buildBase = path.dirname(buildFile);
  check(build.binary_path === 'source/map-server.exe' && path.resolve(build.source_root) === path.join(buildBase, 'source'), 'NATIVE_BUILD_LAYOUT_INVALID');
  const source = build.source_root;
  const reachable = remoteVerifier(source, m.native_git_sha, authority);
  const sourceClean = git(source, 'rev-parse', 'HEAD') === m.native_git_sha && !git(source, 'status', '--porcelain=v1', '--untracked-files=all');
  const artifactsValid = JSON.stringify((build.artifacts || []).map(x => x.path).sort()) === JSON.stringify(['char-server.exe','login-server.exe','map-server.exe']) &&
    build.artifacts.every(x => equalHash(digest(boundedPath(source, x.path)), x.sha256)) &&
    equalHash(digest(boundedPath(buildBase, build.binary_path)), m.binary_sha256);
  pinned(buildBase, build.build_log);
  const suites = build.tests_run || [];
  check(suites.length > 0 && new Set(suites.map(x => x.test_suite)).size === suites.length, 'NATIVE_TEST_SUITES_INVALID');
  for (const suite of suites) pinned(buildBase, suite.receipt);
  const regressionValid = suites.every(x => x.result === 'PASS') && Object.values(groups).every(id => suites.some(x => x.test_suite === id && x.result === 'PASS')) && shutdownContract(source);
  const regression=readJson(pinned(base,m.regression));
  check(regression.native_git_sha===m.native_git_sha && regression.result==='PASS' &&
    JSON.stringify(regression.groups?.map(x=>x.group).sort())===JSON.stringify(Object.keys(groups).sort()) &&
    regression.groups.every(x=>x.result==='PASS' && x.test_suite===groups[x.group] &&
      equalHash(x.receipt?.sha256,suites.find(y=>y.test_suite===x.test_suite)?.receipt?.sha256)) &&
    regression.shutdown_source_contract?.result==='PASS' && regression.shutdown_source_contract.files?.length===3 &&
    regression.shutdown_source_contract.files.every(x=>equalHash(digest(boundedPath(source,x.path)),x.sha256)), 'NATIVE_REGRESSION_RECEIPT_INVALID');
  check(m.required_capability_baseline?.path === state.accepted_capability_manifest &&
    equalHash(m.required_capability_baseline.sha256, state.accepted_capability_manifest_sha256), 'CAPABILITY_BASELINE_CHANGED');
  const accepted = readJson(pinned(root, m.required_capability_baseline)).capabilities;
  const comparisonFile = pinned(base, m.capability_comparison), comparison = readJson(comparisonFile);
  check(comparison.native_git_sha === m.native_git_sha && equalHash(comparison.baseline_sha256, m.required_capability_baseline.sha256), 'CAPABILITY_COMPARISON_UNBOUND');
  const rows = comparison.capabilities || [];
  const ids = accepted.map(x => x.id).sort();
  const registry=readJson(fileURLToPath(new URL('../../docs/project-control/production-capabilities.json',import.meta.url))).capabilities;
  let capsPass = ids.length === 18 && JSON.stringify(rows.map(x => x.id).sort()) === JSON.stringify(ids);
  for (const row of rows) {
    if (row.classification === 'PRESERVED') {
      if (row.id.startsWith('native-')) {
        const canonical=registry.find(x=>x.id===row.id && x.scope==='NATIVE');
        capsPass &&= regressionValid && !!canonical && JSON.stringify(row.source_paths)===JSON.stringify(canonical.source_paths) && row.source_paths?.length > 0 && row.source_paths.every(p => {
          try { git(source, 'cat-file', '-e', `${m.native_git_sha}:${p}`); return true; } catch { return false; }
        });
      } else capsPass &&= webCapabilities.includes(row.id);
    } else if (row.classification === 'INTENTIONALLY_SUPERSEDED') {
      try {
        check(webRoot && /^[a-f0-9]{40}$/.test(webSha || '') && row.decision?.path && row.decision.sha256,'CANONICAL_DECISION_REQUIRED');
        const decisionPath=boundedPath(webRoot,row.decision.path);
        check(equalHash(digest(decisionPath),row.decision.sha256),'DECISION_HASH_CHANGED');
        check(git(webRoot,'show',`${webSha}:${row.decision.path}`)===fs.readFileSync(decisionPath,'utf8').trim(),'DECISION_NOT_CANONICAL');
        const decision=readJson(decisionPath);
        check(decision.capability===row.id && decision.disposition==='INTENTIONALLY_SUPERSEDED' &&
          decision.approved_by==='PROJECT_CONTROL' && decision.reason && decision.replacement && webCapabilities.includes(decision.replacement),'SUPERSESSION_NOT_APPROVED');
      } catch { capsPass=false; }
    } else capsPass = false;
  }
  const rb = m.rollback_reference;
  const rollbackValid = rb?.root === state.legacy_rollback?.root &&
    equalHash(rb.current_native_binary_sha256, state.current_native_binary_sha256) &&
    (state.native_binaries || []).length === 3 && state.native_binaries.every(x =>
      nativeArtifacts.includes(x.path) && equalHash(digest(boundedPath(root, `${rb.root}/${x.path}`)), x.sha256));
  // Pin all existing lifecycle inputs. No launcher/config reconstruction at deploy time.
  check(m.lifecycle_files?.length >= 5 && ['ops/ro-stack/ro-stack.ps1','ops/ro-stack/stack.config.psd1',
    'ops/ro-stack/runtime-guard.ps1','ops/ro-stack/runtime-guard.lib.ps1','ops/ro-stack/graceful-console-signal.ps1'].every(p => m.lifecycle_files.some(x => x.path === p)), 'LIFECYCLE_PINS_REQUIRED');
  for (const item of m.lifecycle_files) pinned(root, item);
  const result = evaluateNative({ manifest:m,build,authority,reachable,sourceClean,artifactsValid,regressionValid,
    capabilities:{pass:capsPass},rollbackValid,state,lease,owner,leaseId,manifestHash:sha256,mode,runtime });
  return { ...result, manifest:m, build, source, capability_rows:rows, regression_groups:Object.keys(groups),
    NATIVE_PREDEPLOY_REGRESSION:regressionValid?'PASS':'FAIL',
    NATIVE_CAPABILITY_SUPERSET_GATE:capsPass?'PASS':'FAIL',
    NATIVE_ROLLBACK_GATE:rollbackValid?'PASS':'FAIL',
    capability_counts:Object.fromEntries(['PRESERVED','INTENTIONALLY_SUPERSEDED','MISSING','UNKNOWN'].map(k=>[k,rows.filter(x=>x.classification===k).length])) };
}

export function nativeReceiptValid(r, { nativeSha, binaryHash, leaseId, manifestHash } = {}) {
  return r?.schema_version === 'native-deploy-v1' && /^[A-Za-z0-9_-]+$/.test(r.deploy_id || '') &&
    !!r.lease_id && (!leaseId || r.lease_id === leaseId) && /^[a-f0-9]{40}$/i.test(r.native_git_sha || '') &&
    (!nativeSha || r.native_git_sha === nativeSha) && equalHash(r.native_build_sha256, r.new_binary_sha256) &&
    (!binaryHash || equalHash(binaryHash, r.new_binary_sha256)) && /^[a-f0-9]{64}$/i.test(r.previous_binary_sha256 || '') &&
    /^[a-f0-9]{64}$/i.test(r.candidate_manifest_sha256 || '') && (!manifestHash || equalHash(manifestHash,r.candidate_manifest_sha256)) &&
    Number.isInteger(r.old_map_pid) && r.old_map_pid > 0 && Number.isInteger(r.new_map_pid) && r.new_map_pid > 0 && r.new_map_pid !== r.old_map_pid &&
    r.procdump_receipt?.mapPid === r.new_map_pid && r.procdump_receipt.procdumpAttachStatus === 'ATTACHED' &&
    r.runtime_health?.pass === true && r.runtime_health.counts?.map === 1 && r.runtime_health.counts?.login === 1 && r.runtime_health.counts?.char === 1 &&
    r.openkore_runtime_count === 0 && !!r.rollback_reference && r.acceptance_status === 'NATIVE_CANDIDATE_ACTIVE' &&
    r.artifacts?.length === 3 && JSON.stringify(r.artifacts.map(x=>x.path).sort()) === JSON.stringify([...nativeArtifacts].sort()) &&
    r.artifacts.every(x=>/^[a-f0-9]{64}$/i.test(x.sha256 || ''));
}

// The only permitted OPEN state for Web continuation is a receipt-proven Native
// stage owned by this exact lease. Every untouched legacy Web byte is rechecked.
export function verifyNativeStage(root, state, lease, webManifestHash) {
  try {
    check(legacyIdentity(state) && state.production_drift === 'OPEN' && state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT', 'NOT_NATIVE_STAGE');
    check(lease?.status === 'ACTIVE' && lease.promotion_mode === FIRST_PROMOTION && equalHash(lease.admission_manifest_sha256,webManifestHash), 'LEASE_UNBOUND');
    const pending = readJson(boundedPath(root,pendingPath));
    check(pending.owner_task_id === lease.owner_task_id && pending.lease_id === lease.lease_id && pending.native_git_sha === lease.native_deploy_git_sha && pending.web_git_sha === lease.web_deploy_git_sha, 'PENDING_UNBOUND');
    const r = readJson(boundedPath(root,nativeReceiptPath));
    check(equalHash(pending.native_receipt_sha256,digest(boundedPath(root,nativeReceiptPath))) &&
      nativeReceiptValid(r,{nativeSha:lease.native_deploy_git_sha,leaseId:lease.lease_id,manifestHash:lease.native_candidate_manifest_sha256}), 'NATIVE_RECEIPT_INVALID');
    const snapshot = structuredClone(state);
    snapshot.native_binaries = r.artifacts;
    // Verify unchanged Web and the new native bytes, with legacy rollback
    // independently checked against its original hashes.
    const current = verifyLegacyBaseline(root,snapshot);
    check(current.pass, 'STAGED_BYTES_CHANGED');
    const rollback = state.legacy_rollback;
    check(equalHash(digest(boundedPath(root,rollback.web_manifest)),state.current_web_manifest_sha256) &&
      [...current.files,...state.native_binaries].every(x=>equalHash(digest(boundedPath(root,`${rollback.root}/${x.path}`)),x.sha256)), 'ROLLBACK_CHANGED');
    return {...current,pass:true,rollbackReady:true,nativeStage:true,receipt:r};
  } catch { return {pass:false,rollbackReady:false,nativeStage:false}; }
}
