#!/usr/bin/env node
// Exact same-lease command-registry artifact for the start_farm supplyPolicy key.
// The map server loads this file on startup; deployment alone never restarts it.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, legacyIdentity } from './legacy-production-baseline.mjs';
import { NATIVE_REPOSITORY, equalHash } from './native-promotion-contract.mjs';

export const CONTRACT = Object.freeze({
  lease: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a',
  owner: 'F｜M1 最終整合',
  webSha: '8d2d4ca31ef430a12ea13f15ccf426472010c183',
  nativeSha: 'fb4dcc735536228b3da76f809683a8d01e56b7dc',
  source: 'conf/persistent_agent_commands.json',
  destination: '.local/ro-stack/rathena/conf/persistent_agent_commands.json',
  preimage: '769361A1E9ECA6BFBE3CEC72526B3568118FF7AEBCFAB2570D7F2063435DEA9B',
  image: '49FED5442BCBA1DD2A95AD1D891BF4705C11B82150A28D0CFE893C9055251801',
});
const canonicalProduction = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const need = (ok, code) => { if (!ok) throw Error(code); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const run = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  need(r.status === 0, 'GIT_PROVENANCE_FAILED:' + args[0]);
  return r.stdout.trim();
};
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const atomicBytes = (file, bytes) => {
  const temp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, bytes, { flag: 'wx' });
  try { fs.renameSync(temp, file); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
};
const atomicJson = (file, value) => atomicBytes(file, JSON.stringify(value, null, 2) + '\n');

export function inspectStartFarmSupplyDelta(before, after) {
  need(before?.contractKind === 'persistent_agent_command_contract' &&
    before.contractVersion === 1 && after?.contractKind === before.contractKind &&
    after.contractVersion === before.contractVersion && Array.isArray(before.commands) &&
    Array.isArray(after.commands) && before.commands.length === after.commands.length,
  'CONTRACT_ROOT_OR_ACTION_COUNT_CHANGED');
  const expected = structuredClone(before);
  const row = expected.commands.find(command => command.action === 'start_farm');
  need(row?.strictUnknownFields === true && row.payload?.optional &&
    !Object.hasOwn(row.payload.optional, 'supplyPolicy'), 'START_FARM_PREIMAGE_INVALID');
  row.payload.optional.supplyPolicy = 'object';
  need(same(expected, after), 'UNRELATED_CONTRACT_DELTA');
  return { action: 'start_farm', addedOptionalField: 'supplyPolicy',
    fieldType: 'object', unrelatedChanges: 0, removedActions: 0 };
}

function preflight({ productionRoot, nativeRoot, githubRoot }) {
  const root = path.resolve(productionRoot);
  need(root.toLowerCase() === canonicalProduction.toLowerCase(), 'PRODUCTION_ROOT_INVALID');
  const governanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  need(run(governanceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '',
    'GOVERNANCE_SOURCE_DIRTY');
  const githubMain = run(githubRoot, 'ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
  need(run(githubRoot, 'remote', 'get-url', 'origin') === NATIVE_REPOSITORY &&
    githubMain === CONTRACT.nativeSha, 'NATIVE_GITHUB_MAIN_MISMATCH');
  need(run(nativeRoot, 'rev-parse', 'HEAD') === CONTRACT.nativeSha &&
    run(nativeRoot, 'status', '--porcelain=v1', '--', CONTRACT.source) === '',
    'NATIVE_SOURCE_NOT_CLEAN_EXACT_SHA');
  const source = boundedPath(nativeRoot, CONTRACT.source);
  const blob = spawnSync('git', ['show', CONTRACT.nativeSha + ':' + CONTRACT.source],
    { cwd: githubRoot, encoding: 'buffer', windowsHide: true, timeout: 30000 });
  need(blob.status === 0 && fs.readFileSync(source).toString('utf8').replaceAll('\r\n', '\n') ===
    blob.stdout.toString('utf8').replaceAll('\r\n', '\n') &&
    equalHash(digest(source), CONTRACT.image), 'NATIVE_SOURCE_BLOB_MISMATCH');
  const target = boundedPath(root, CONTRACT.destination);
  need(equalHash(digest(target), CONTRACT.preimage), 'PRODUCTION_CONTRACT_PREIMAGE_CHANGED');
  const delta = inspectStartFarmSupplyDelta(read(target), read(source));
  const local = boundedPath(root, '.local/ro-stack');
  const leaseFile = path.join(local, 'production-deployment-lease/lease.json');
  const pendingFile = path.join(local, 'first-github-first-promotion.pending.json');
  const stateFile = path.join(local, 'production-deployment-state.json');
  const lease = read(leaseFile), pending = read(pendingFile), state = read(stateFile);
  need(lease.status === 'ACTIVE' && lease.lease_id === CONTRACT.lease &&
    lease.owner_task_id === CONTRACT.owner && lease.web_deploy_git_sha === CONTRACT.webSha &&
    lease.native_deploy_git_sha === CONTRACT.nativeSha &&
    pending.lease_id === CONTRACT.lease && pending.owner_task_id === CONTRACT.owner &&
    pending.web_git_sha === CONTRACT.webSha && pending.native_git_sha === CONTRACT.nativeSha &&
    lease.active_native_candidate?.deployed === true &&
    state.baseline_mode === 'LEGACY_PRE_GITHUB_FIRST' && state.production_drift === 'OPEN' &&
    state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' && legacyIdentity(state) &&
    lease.native_world_teleport_policy_contract && pending.native_world_teleport_policy_contract &&
    !lease.native_start_farm_supply_contract && !pending.native_start_farm_supply_contract,
  'ACTIVE_FIRST_PROMOTION_LEASE_INVALID');
  const artifactDir = path.join(local,
    'native-start-farm-supply-contract-' + CONTRACT.lease + '-' + CONTRACT.nativeSha.slice(0, 12));
  const lock = artifactDir + '.lock';
  need(!fs.existsSync(artifactDir) && !fs.existsSync(lock), 'CONTRACT_ARTIFACT_ALREADY_EXISTS');
  return { root, source, target, leaseFile, pendingFile, stateFile, lease, pending,
    delta, artifactDir, lock, hashes: { target: digest(target), lease: digest(leaseFile),
      pending: digest(pendingFile), state: digest(stateFile) } };
}

function deploy(input) {
  const p = preflight(input);
  fs.mkdirSync(p.lock);
  const beforeLease = fs.readFileSync(p.leaseFile), beforePending = fs.readFileSync(p.pendingFile);
  const backup = path.join(p.lock, 'preimage.json');
  const staged = path.join(p.lock, 'candidate.json');
  const displaced = path.join(p.lock, 'displaced.json');
  let replaced = false;
  try {
    fs.copyFileSync(p.target, backup, fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(p.source, staged, fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(backup), CONTRACT.preimage) && equalHash(digest(staged), CONTRACT.image) &&
      equalHash(digest(p.leaseFile), p.hashes.lease) &&
      equalHash(digest(p.pendingFile), p.hashes.pending) &&
      equalHash(digest(p.stateFile), p.hashes.state) &&
      equalHash(digest(p.target), p.hashes.target), 'PREDEPLOY_INPUT_CHANGED');
    fs.renameSync(p.target, displaced);
    replaced = true;
    fs.renameSync(staged, p.target);
    need(equalHash(digest(p.target), CONTRACT.image), 'POSTDEPLOY_CONTRACT_HASH_MISMATCH');
    const receiptPath = path.join(p.lock, 'receipt.json');
    const receipt = { schema_version: 'native-start-farm-supply-contract-v1',
      lease_id: CONTRACT.lease, owner_task_id: CONTRACT.owner,
      source_git_sha: CONTRACT.nativeSha, active_native_binary_git_sha: CONTRACT.nativeSha,
      web_git_sha: CONTRACT.webSha, source_path: CONTRACT.source,
      destination_path: CONTRACT.destination, preimage_sha256: CONTRACT.preimage,
      image_sha256: CONTRACT.image, delta: p.delta, rollback_model: 'RESTORE_EXACT_PREIMAGE',
      runtime_load: 'PENDING_RESTART', deployed_at: new Date().toISOString() };
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    const ref = { receipt: path.relative(p.root, path.join(p.artifactDir, 'receipt.json')).replaceAll('\\', '/'),
      sha256: digest(receiptPath) };
    atomicJson(p.pendingFile, { ...p.pending, native_start_farm_supply_contract: ref });
    atomicJson(p.leaseFile, { ...p.lease, native_start_farm_supply_contract: ref });
    fs.renameSync(p.lock, p.artifactDir);
    return { result: 'DEPLOYED_PENDING_RUNTIME_LOAD', receipt: ref.receipt,
      receipt_sha256: ref.sha256, image_sha256: digest(p.target),
      backup_sha256: digest(path.join(p.artifactDir, 'preimage.json')) };
  } catch (error) {
    if (replaced && fs.existsSync(backup)) atomicBytes(p.target, fs.readFileSync(backup));
    if (!equalHash(digest(p.leaseFile), p.hashes.lease)) atomicBytes(p.leaseFile, beforeLease);
    if (!equalHash(digest(p.pendingFile), p.hashes.pending)) atomicBytes(p.pendingFile, beforePending);
    fs.writeFileSync(path.join(p.lock, 'failure.json'), JSON.stringify({ error: error.message,
      preimage_restored: equalHash(digest(p.target), CONTRACT.preimage) }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, argv) =>
      value.startsWith('--') ? [[value.slice(2), argv[index + 1]]] : []));
    need(['dry-run', 'deploy'].includes(args.action) && args.prod && args.native && args.github,
      'ARGUMENTS_REQUIRED');
    const input = { productionRoot: args.prod, nativeRoot: args.native, githubRoot: args.github };
    if (args.action === 'deploy') need(args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
    console.log(JSON.stringify(args.action === 'deploy' ? deploy(input) :
      { result: 'PREFLIGHT_PASS', ...preflight(input).delta, production_touched: false }));
  } catch (error) {
    console.error(JSON.stringify({ result: 'BLOCKED', error: error.message }));
    process.exitCode = 2;
  }
}
