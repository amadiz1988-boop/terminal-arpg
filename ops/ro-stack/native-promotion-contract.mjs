import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, readJson, FIRST_PROMOTION, legacyIdentity, verifyLegacyBaseline, pendingPath } from './legacy-production-baseline.mjs';
import { verifyWebReceipt, readManifest, receiptIdentity } from './web-complete-manifest.mjs';

export const NATIVE_REPOSITORY = 'https://github.com/amadiz1988-boop/ghost-island-rathena.git';
export const nativeReceiptPath = '.local/ro-stack/native-promotion-receipt.json';
// A Native candidate amendment deploys under the same lease without rewriting
// the original stage receipt. The pending promotion names the active receipt;
// absent a pointer the original canonical path applies.
export function isNativeReceiptPath(p) {
  return p === nativeReceiptPath || /^\.local\/ro-stack\/native-promotion-receipt-[a-f0-9]{12}\.json$/.test(p || '');
}
export function activeNativeReceiptPath(pending) {
  const p = pending?.native_receipt_path;
  if (p === undefined || p === null) return nativeReceiptPath;
  if (!isNativeReceiptPath(p)) throw Error('NATIVE_RECEIPT_PATH_INVALID');
  return p;
}
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
// A runtime config reconciliation remains valid through a same-lease Native
// amendment when its config bytes are unchanged and every intervening Native
// amendment has an intact audit receipt. The original receipt is immutable.
export function runtimeConfigNativeLineageValid(root, lease, pending, receiptNativeSha) {
  if (receiptNativeSha === lease.native_deploy_git_sha) return true;
  const history = lease.native_candidate_amendments;
  if (!Array.isArray(history) || !Array.isArray(pending.native_candidate_amendments) ||
      JSON.stringify(history) !== JSON.stringify(pending.native_candidate_amendments) ||
      lease.active_native_candidate?.deployed !== true ||
      lease.active_native_candidate.native_git_sha !== lease.native_deploy_git_sha)
    return false;
  const start = history.findIndex(entry => entry.old_native_git_sha === receiptNativeSha);
  if (start < 0) return false;
  let previous = receiptNativeSha;
  for (const entry of history.slice(start)) {
    if (entry.old_native_git_sha !== previous) return false;
    try {
      const audit = readJson(pinned(root, { path: entry.audit_receipt, sha256: entry.audit_sha256 }));
      if (audit.lease_id !== lease.lease_id || audit.lease_owner !== lease.owner_task_id ||
          audit.old_native_git_sha !== entry.old_native_git_sha ||
          audit.new_native_git_sha !== entry.new_native_git_sha || audit.reason !== entry.reason)
        return false;
    } catch { return false; }
    previous = entry.new_native_git_sha;
  }
  return previous === lease.native_deploy_git_sha;
}
export function stagedRuntimeConfigPin(root, state, lease) {
  const ref = state.runtime_config_reconciliation;
  if (!ref) return null;
  const pending = readJson(boundedPath(root, pendingPath));
  check(ref === pending.runtime_config_reconciliation &&
    equalHash(state.runtime_config_reconciliation_sha256, pending.runtime_config_reconciliation_sha256),
    'RUNTIME_CONFIG_RECEIPT_REFERENCE_MISMATCH');
  const receipt = readJson(pinned(root, {path:ref,sha256:state.runtime_config_reconciliation_sha256}));
  const configPath = boundedPath(root, receipt.config_source_path);
  const currentHash = digest(configPath);
  check(receipt.schema_version === 'runtime-config-reconciliation-v1' &&
    receipt.classification === 'RUNTIME_CONFIG_RECONCILED' &&
    receipt.lease_id === lease.lease_id && receipt.lease_owner === lease.owner_task_id &&
    runtimeConfigNativeLineageValid(root, lease, pending, receipt.native_git_sha) &&
    receipt.config_source_path === 'ops/ro-stack/stack.config.psd1' &&
    receipt.unrelated_config_change_count === 0,
    'RUNTIME_CONFIG_RECEIPT_INVALID');
  if (!equalHash(receipt.new_config_digest, currentHash)) {
    const allowlistRef = lease.native_service_allowlist_config;
    check(allowlistRef?.receipt && allowlistRef?.sha256 &&
      JSON.stringify(allowlistRef) === JSON.stringify(pending.native_service_allowlist_config),
    'RUNTIME_CONFIG_ALLOWLIST_RECEIPT_MISSING');
    const allowlist = readJson(pinned(root, {path:allowlistRef.receipt,sha256:allowlistRef.sha256}));
    const priorWebSha = allowlist.web_git_sha === lease.web_deploy_git_sha ||
      lease.web_candidate_amendments?.some(entry => entry.old_web_git_sha === allowlist.web_git_sha ||
        entry.new_web_git_sha === allowlist.web_git_sha);
    check(allowlist.schema_version === 'native-service-allowlist-config-v1' &&
      allowlist.lease_id === lease.lease_id && allowlist.owner_task_id === lease.owner_task_id &&
      runtimeConfigNativeLineageValid(root, lease, pending, allowlist.native_git_sha) && priorWebSha &&
      allowlist.source_path === receipt.config_source_path &&
      allowlist.destination_path === receipt.config_source_path &&
      equalHash(allowlist.preimage_sha256, receipt.new_config_digest) &&
      equalHash(allowlist.image_sha256, currentHash) &&
      equalHash(allowlist.source_sha256, receipt.config_source_digest) &&
      allowlist.unrelated_changes === 0 &&
      JSON.stringify(allowlist.changes?.map(row => row.key)) ===
        JSON.stringify(['PersistentAgentServiceMapAllowlist', 'PersistentAgentServiceNpcAllowlist']) &&
      JSON.stringify(allowlist.preserved_overrides) ===
        JSON.stringify(['PersistentAgentM1SupplyEnabled', 'WebM1AcceptanceFixtureEnabled',
          'WebNativeSupplyPolicyEnabled']),
    'RUNTIME_CONFIG_ALLOWLIST_RECEIPT_INVALID');
  }
  return {path:receipt.config_source_path,sha256:currentHash,oldSha256:receipt.old_config_digest};
}
export function verifyLifecyclePins(root, pins, stagedWebManifest, runtimeConfigPin) {
  if (!stagedWebManifest) {
    for (const item of pins) pinned(root, item);
    return;
  }
  const rows = new Map(stagedWebManifest.files.map(row => [row.path, row]));
  for (const item of pins) {
    const row = rows.get(item.path);
    if (row) {
      check(row.production_preimage !== 'ABSENT' &&
        equalHash(row.production_preimage_sha256, digest(boundedPath(root, item.path))),
        'STAGED_WEB_LIFECYCLE_PREIMAGE_CHANGED');
    } else if (runtimeConfigPin?.path === item.path) {
      check((equalHash(runtimeConfigPin.oldSha256,item.sha256) ||
        equalHash(runtimeConfigPin.sha256,item.sha256)) &&
        equalHash(runtimeConfigPin.sha256,digest(boundedPath(root,item.path))),
        'STAGED_RUNTIME_CONFIG_CHANGED');
    } else pinned(root,item);
  }
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

// Brace-balanced body of the first definition matching signature, or ''.
export function sourceBody(text, signature) {
  const start = text.indexOf(signature);
  if (start < 0) return '';
  const open = text.indexOf('{', start);
  if (open < 0) return '';
  for (let i = open, depth = 0; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return '';
}

// Source contract for graceful shutdown ordering, executed without runtime.
// NATIVE_PA_GRACEFUL_SHUTDOWN_MYSQL_RACE_V1: on Windows handle_shutdown() runs
// on the console/CRT signal callback thread. It may only record the request;
// finalize() on the map main thread performs PA prepare -> confirm once and
// then completes the handoff. The pre-fix shape (PA work inside the signal
// handler) no longer satisfies this contract.
export function shutdownContract(root) {
  const map = fs.readFileSync(boundedPath(root, 'src/map/map.cpp'), 'utf8');
  const pa = fs.readFileSync(boundedPath(root, 'src/map/persistent_agent.cpp'), 'utf8');
  const state = fs.readFileSync(boundedPath(root, 'src/map/persistent_agent_state.cpp'), 'utf8');
  const handler = sourceBody(map, 'void MapServer::handle_shutdown()');
  const finalize = sourceBody(map, 'void MapServer::finalize()');
  const begin = finalize.indexOf('map_shutdown_handoff().begin()');
  const prepare = finalize.indexOf('persistent_agent_prepare_shutdown()');
  const confirm = finalize.lastIndexOf('persistent_agent_confirm_shutdown()');
  const complete = finalize.indexOf('map_shutdown_handoff().complete()');
  return handler.includes('map_shutdown_handoff().request()') &&
    ['persistent_agent_', 'clif_', 'flush_fifos', 'chrif_', 'Sql_', 'mapit_', 'map_quit'].every(x => !handler.includes(x)) &&
    begin >= 0 && prepare > begin && confirm > prepare && complete > confirm &&
    pa.includes('pa_lifecycle_stopped()') &&
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

export function inspectNativeCandidate({ file, sha256, root, state, authority, mode = 'precheck', lease, owner, leaseId, runtime, webCapabilities = [], webRoot, webSha, stagedWebManifest, runtimeConfigPin, remoteVerifier = verifyNativeRemote }) {
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
  // After a verified Web stage, the next complete manifest pins current Web
  // preimages. Initial Native admission still uses its original lifecycle pins.
  verifyLifecyclePins(root, m.lifecycle_files, stagedWebManifest, runtimeConfigPin);
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

// An amended Web candidate can follow an already deployed intermediate Web
// candidate. Its receipt proves current Web bytes and the original rollback.
// Once the amended candidate itself is deployed, the intermediate receipt is
// superseded: it keeps its integrity checks and the live bytes must instead
// match the single lease-bound receipt of the current Web candidate.
export function currentLeaseWebReceipt(root, lease) {
  const base = '.local/ro-stack/dashboard/deploy-receipts', dir = boundedPath(root, base);
  const hits = fs.readdirSync(dir).filter(n => /^manifest-[a-f0-9]{32}$/.test(n)).map(n => `${base}/${n}/deploy-receipt.json`).filter(p => {
    try { const d = readJson(boundedPath(root, p));
      return d.lease_id === lease.lease_id && d.owner_task_id === lease.owner_task_id && d.web_git_sha === lease.web_deploy_git_sha &&
        d.result === 'CANDIDATE_ACTIVE' && equalHash(d.manifest_sha256, lease.admission_manifest_sha256); } catch { return false; }
  });
  check(hits.length === 1, 'CURRENT_WEB_RECEIPT_NOT_UNIQUE');
  return hits[0];
}
function leaseWebReceiptArgs(root, lease, receiptPath, sha256) {
  const m = readManifest(path.join(path.dirname(boundedPath(root, receiptPath)), 'manifest.json'));
  return { web_deployment_receipt: { path: receiptPath, sha256 }, owner_task_id: lease.owner_task_id, lease_id: lease.lease_id,
    ...receiptIdentity(m), files: m.files.map(item => ({ path: item.path, sha256: item.sha256 })) };
}
export function verifyNativeStage(root, state, lease, webManifestHash) {
  try {
    check(legacyIdentity(state) && state.production_drift === 'OPEN' && state.drift_reason === 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT', 'NOT_NATIVE_STAGE');
    check(lease?.status === 'ACTIVE' && lease.promotion_mode === FIRST_PROMOTION && equalHash(lease.admission_manifest_sha256,webManifestHash), 'LEASE_UNBOUND');
    const pending = readJson(boundedPath(root,pendingPath));
    check(pending.owner_task_id === lease.owner_task_id && pending.lease_id === lease.lease_id && pending.native_git_sha === lease.native_deploy_git_sha && pending.web_git_sha === lease.web_deploy_git_sha, 'PENDING_UNBOUND');
    const receiptPath = activeNativeReceiptPath(pending);
    const r = readJson(boundedPath(root,receiptPath));
    check(equalHash(pending.native_receipt_sha256,digest(boundedPath(root,receiptPath))) &&
      nativeReceiptValid(r,{nativeSha:lease.native_deploy_git_sha,leaseId:lease.lease_id,manifestHash:lease.native_candidate_manifest_sha256}), 'NATIVE_RECEIPT_INVALID');
    const snapshot = structuredClone(state);
    snapshot.native_binaries = r.artifacts;
    const history=lease.web_candidate_amendments || [];
    let current;
    if (history.length) {
      check(JSON.stringify(history)===JSON.stringify(pending.web_candidate_amendments) &&
        history.at(-1).new_web_git_sha===lease.web_deploy_git_sha,'WEB_AMENDMENT_HISTORY_MISMATCH');
      const prior=history.at(-1);
      check(equalHash(digest(boundedPath(root,prior.audit_receipt)),prior.audit_sha256) &&
        equalHash(digest(boundedPath(root,prior.previous_web_candidate_receipt)),prior.previous_web_candidate_receipt_sha256),'WEB_AMENDMENT_EVIDENCE_CHANGED');
      const audit=readJson(boundedPath(root,prior.audit_receipt));
      check(audit.lease_id===lease.lease_id && audit.old_web_git_sha===prior.old_web_git_sha &&
        audit.new_web_git_sha===prior.new_web_git_sha,'WEB_AMENDMENT_AUDIT_INVALID');
      const previousReceipt=readJson(boundedPath(root,prior.previous_web_candidate_receipt));
      const previousArgs=leaseWebReceiptArgs(root,lease,prior.previous_web_candidate_receipt,prior.previous_web_candidate_receipt_sha256);
      let previousLive=true;
      try { verifyWebReceipt(previousArgs,root); } catch { previousLive=false; }
      if(!previousLive){
        verifyWebReceipt(previousArgs,root,null,{currentBytes:false});
        const current=currentLeaseWebReceipt(root,lease);
        verifyWebReceipt(leaseWebReceiptArgs(root,lease,current,digest(boundedPath(root,current))),root,lease);
      }
      if (previousReceipt.web_git_sha!==prior.old_web_git_sha) {
        check(audit.superseded_candidate_was_deployed===false,'PREVIOUS_WEB_SHA_MISMATCH');
        let superseded=prior.old_web_git_sha,bridged=false;
        for (let index=history.length-2;index>=0;index--) {
          const item=history[index];
          check(item.new_web_git_sha===superseded &&
            item.previous_web_candidate_receipt===prior.previous_web_candidate_receipt &&
            equalHash(item.previous_web_candidate_receipt_sha256,prior.previous_web_candidate_receipt_sha256) &&
            equalHash(digest(boundedPath(root,item.audit_receipt)),item.audit_sha256),
            'UNDEPLOYED_WEB_AMENDMENT_CHAIN_INVALID');
          const earlier=readJson(boundedPath(root,item.audit_receipt));
          check(earlier.lease_id===lease.lease_id && earlier.old_web_git_sha===item.old_web_git_sha &&
            earlier.new_web_git_sha===item.new_web_git_sha,'UNDEPLOYED_WEB_AMENDMENT_AUDIT_INVALID');
          superseded=item.old_web_git_sha;
          if (superseded===previousReceipt.web_git_sha) { bridged=true;break; }
        }
        check(bridged,'PREVIOUS_WEB_SHA_MISMATCH');
      }
      check(r.artifacts.every(item=>equalHash(digest(boundedPath(root,item.path)),item.sha256)),'NATIVE_STAGE_BYTES_CHANGED');
      const legacyManifest=readJson(boundedPath(root,state.current_web_artifact_manifest));
      check(equalHash(digest(boundedPath(root,state.current_web_artifact_manifest)),state.current_web_manifest_sha256),'LEGACY_MANIFEST_CHANGED');
      current={pass:true,files:legacyManifest.files,capabilityCount:(state.accepted_capabilities || []).length};
    } else {
      current=verifyLegacyBaseline(root,snapshot);
      check(current.pass,'STAGED_BYTES_CHANGED');
    }
    const rollback = state.legacy_rollback;
    check(equalHash(digest(boundedPath(root,rollback.web_manifest)),state.current_web_manifest_sha256) &&
      [...current.files,...state.native_binaries].every(x=>equalHash(digest(boundedPath(root,`${rollback.root}/${x.path}`)),x.sha256)), 'ROLLBACK_CHANGED');
    return {...current,pass:true,rollbackReady:true,nativeStage:true,receipt:r};
  } catch { return {pass:false,rollbackReady:false,nativeStage:false}; }
}
