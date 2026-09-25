#!/usr/bin/env node
// Exact same-lease runtime registry amendment for three already implemented M1
// supply commands. The binary candidate does not carry conf/ into Production.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundedPath, digest, legacyIdentity } from './legacy-production-baseline.mjs';
import { NATIVE_REPOSITORY, equalHash, nativeReceiptValid } from './native-promotion-contract.mjs';

export const CONTRACT = Object.freeze({
  lease: '869f1725-dbd0-452d-b9dd-37ee79cc3f9a', owner: 'F｜M1 最終整合',
  webSha: '8d2d4ca31ef430a12ea13f15ccf426472010c183',
  nativeSha: '1fb5549f51474eedbaf2c24438a29587c52d0028',
  source: 'conf/persistent_agent_commands.json',
  destination: '.local/ro-stack/rathena/conf/persistent_agent_commands.json',
  preimage: '49FED5442BCBA1DD2A95AD1D891BF4705C11B82150A28D0CFE893C9055251801',
  image: '3EFC2C3E2C3998322733004C3CF63B6886D6814762C09603E9C53545FF6D4881',
  added: Object.freeze(['configure_supply_policy', 'prepare_farm_switch', 'resume_paid_farm_switch']),
});
const production = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const native = 'C:\\Users\\Administrator\\source\\ghost-island-rathena';
const need = (yes, code) => { if (!yes) throw Error(code); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  need(result.status === 0, 'GIT_PROVENANCE_FAILED:' + args[0]);
  return result.stdout.trim();
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

export function inspectSupplyCommandDelta(before, after) {
  need(before?.contractKind === 'persistent_agent_command_contract' && before.contractVersion === 1 &&
    after?.contractKind === before.contractKind && after.contractVersion === 1 &&
    before.commands?.length === 47 && after.commands?.length === 50,
  'CONTRACT_ROOT_OR_ACTION_COUNT_CHANGED');
  const { commands: oldRows, ...oldRoot } = before;
  const { commands: newRows, ...newRoot } = after;
  need(same(oldRoot, newRoot), 'CONTRACT_ROOT_CHANGED');
  const oldMap = new Map(oldRows.map(row => [row.action, row]));
  const newMap = new Map(newRows.map(row => [row.action, row]));
  need(oldMap.size === 47 && newMap.size === 50 &&
    [...oldMap].every(([action, row]) => same(row, newMap.get(action))) &&
    same([...newMap.keys()].filter(action => !oldMap.has(action)).sort(), [...CONTRACT.added].sort()),
  'UNRELATED_CONTRACT_DELTA');
  for (const action of CONTRACT.added) {
    const row = newMap.get(action);
    need(row?.enqueueAdmitted === true && row.dispatcher === `process_${action}` &&
      row.category === 'supply', 'SUPPLY_COMMAND_NOT_ADMITTED:' + action);
  }
  need(same(newMap.get('configure_supply_policy').payload.required, { supplyPolicy: 'object' }) &&
    same(newMap.get('resume_paid_farm_switch').payload.required, { targetMap: 'string' }) &&
    newMap.get('prepare_farm_switch').payload.required.shopServiceRoute?.type === 'array',
  'SUPPLY_COMMAND_SHAPE_CHANGED');
  return { addedActions: [...CONTRACT.added], existingActionsChanged: 0, removedActions: 0 };
}

function preflight(rootArg, nativeArg) {
  const root = path.resolve(rootArg), sourceRoot = path.resolve(nativeArg);
  need(root.toLowerCase() === production.toLowerCase() &&
    sourceRoot.toLowerCase() === native.toLowerCase(), 'CANONICAL_ROOT_REQUIRED');
  const governanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  need(git(governanceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '', 'GOVERNANCE_SOURCE_DIRTY');
  need(git(sourceRoot, 'remote', 'get-url', 'origin') === NATIVE_REPOSITORY &&
    git(sourceRoot, 'rev-parse', 'HEAD') === CONTRACT.nativeSha &&
    git(sourceRoot, 'ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0] === CONTRACT.nativeSha &&
    git(sourceRoot, 'status', '--porcelain=v1', '--untracked-files=all') === '', 'NATIVE_GITHUB_SOURCE_INVALID');
  const source = boundedPath(sourceRoot, CONTRACT.source);
  const blob = spawnSync('git', ['show', CONTRACT.nativeSha + ':' + CONTRACT.source],
    { cwd: sourceRoot, encoding: 'buffer', windowsHide: true, timeout: 30000 });
  need(blob.status === 0 && equalHash(digest(source), CONTRACT.image) &&
    fs.readFileSync(source).toString('utf8').replaceAll('\r\n', '\n') ===
      blob.stdout.toString('utf8').replaceAll('\r\n', '\n'), 'NATIVE_CONTRACT_SOURCE_MISMATCH');
  const target = boundedPath(root, CONTRACT.destination);
  need(equalHash(digest(target), CONTRACT.preimage), 'PRODUCTION_CONTRACT_PREIMAGE_CHANGED');
  const delta = inspectSupplyCommandDelta(read(target), read(source));
  const local = boundedPath(root, '.local/ro-stack');
  const leaseFile = path.join(local, 'production-deployment-lease/lease.json');
  const pendingFile = path.join(local, 'first-github-first-promotion.pending.json');
  const stateFile = path.join(local, 'production-deployment-state.json');
  const lease = read(leaseFile), pending = read(pendingFile), state = read(stateFile);
  need(lease.lease_id === CONTRACT.lease && lease.owner_task_id === CONTRACT.owner && lease.status === 'ACTIVE' &&
    lease.web_deploy_git_sha === CONTRACT.webSha && lease.native_deploy_git_sha === CONTRACT.nativeSha &&
    pending.lease_id === CONTRACT.lease && pending.native_git_sha === CONTRACT.nativeSha &&
    pending.web_git_sha === CONTRACT.webSha && lease.active_native_candidate?.deployed === true &&
    state.baseline_mode === 'LEGACY_PRE_GITHUB_FIRST' && state.production_drift === 'OPEN' &&
    state.first_promotion_phase === 'FIRST_PROMOTION_NATIVE_STAGE_COMPLETE' && legacyIdentity(state) &&
    lease.native_start_farm_supply_contract && pending.native_start_farm_supply_contract &&
    !lease.native_supply_command_contract && !pending.native_supply_command_contract,
  'ACTIVE_FIRST_PROMOTION_LEASE_INVALID');
  const receipt = boundedPath(root, pending.native_receipt_path);
  need(equalHash(digest(receipt), pending.native_receipt_sha256) &&
    nativeReceiptValid(read(receipt), { nativeSha: CONTRACT.nativeSha, leaseId: CONTRACT.lease,
      manifestHash: lease.native_candidate_manifest_sha256 }), 'NATIVE_RECEIPT_INVALID');
  const archive = path.join(local, `native-supply-command-contract-${CONTRACT.lease}-${CONTRACT.nativeSha.slice(0, 12)}`);
  const lock = archive + '.lock';
  need(!fs.existsSync(archive) && !fs.existsSync(lock), 'CONTRACT_ARTIFACT_ALREADY_EXISTS');
  return { root, source, target, leaseFile, pendingFile, stateFile, lease, pending, delta, archive, lock,
    hashes: { target: digest(target), lease: digest(leaseFile), pending: digest(pendingFile), state: digest(stateFile) } };
}

function deploy(root, sourceRoot) {
  const p = preflight(root, sourceRoot);
  fs.mkdirSync(p.lock);
  const leaseBefore = fs.readFileSync(p.leaseFile), pendingBefore = fs.readFileSync(p.pendingFile);
  const backup = path.join(p.lock, 'preimage.json'), staged = path.join(p.lock, 'candidate.json');
  const displaced = path.join(p.lock, 'displaced.json');
  let replaced = false;
  try {
    fs.copyFileSync(p.target, backup, fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(p.source, staged, fs.constants.COPYFILE_EXCL);
    need(equalHash(digest(backup), CONTRACT.preimage) && equalHash(digest(staged), CONTRACT.image) &&
      equalHash(digest(p.target), p.hashes.target) && equalHash(digest(p.leaseFile), p.hashes.lease) &&
      equalHash(digest(p.pendingFile), p.hashes.pending) && equalHash(digest(p.stateFile), p.hashes.state),
    'PREDEPLOY_INPUT_CHANGED');
    fs.renameSync(p.target, displaced);
    replaced = true;
    fs.renameSync(staged, p.target);
    need(equalHash(digest(p.target), CONTRACT.image), 'POSTDEPLOY_CONTRACT_HASH_MISMATCH');
    const receipt = { schema_version: 'native-supply-command-contract-v1', lease_id: CONTRACT.lease,
      owner_task_id: CONTRACT.owner, source_git_sha: CONTRACT.nativeSha,
      active_native_binary_git_sha: CONTRACT.nativeSha, web_git_sha: CONTRACT.webSha,
      source_path: CONTRACT.source, destination_path: CONTRACT.destination,
      preimage_sha256: CONTRACT.preimage, image_sha256: CONTRACT.image,
      delta: p.delta, rollback_model: 'RESTORE_EXACT_PREIMAGE',
      runtime_load: 'PENDING_GRACEFUL_CYCLE', deployed_at: new Date().toISOString() };
    const receiptPath = path.join(p.lock, 'receipt.json');
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    const reference = { receipt: path.relative(p.root, path.join(p.archive, 'receipt.json')).replaceAll('\\', '/'),
      sha256: digest(receiptPath) };
    atomicJson(p.pendingFile, { ...p.pending, native_supply_command_contract: reference });
    atomicJson(p.leaseFile, { ...p.lease, native_supply_command_contract: reference });
    fs.renameSync(p.lock, p.archive);
    return { result: 'DEPLOYED_PENDING_RUNTIME_LOAD', receipt: reference.receipt,
      receipt_sha256: reference.sha256, image_sha256: digest(p.target),
      backup_sha256: digest(path.join(p.archive, 'preimage.json')) };
  } catch (error) {
    if (replaced && fs.existsSync(backup)) atomicBytes(p.target, fs.readFileSync(backup));
    if (!equalHash(digest(p.leaseFile), p.hashes.lease)) atomicBytes(p.leaseFile, leaseBefore);
    if (!equalHash(digest(p.pendingFile), p.hashes.pending)) atomicBytes(p.pendingFile, pendingBefore);
    fs.writeFileSync(path.join(p.lock, 'failure.json'), JSON.stringify({ error: error.message,
      preimage_restored: equalHash(digest(p.target), CONTRACT.preimage) }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    const args = Object.fromEntries(argv.flatMap((item, i) => item.startsWith('--') ? [[item.slice(2), argv[i + 1]]] : []));
    need(['dry-run', 'deploy'].includes(args.action) && args.prod && args.native, 'ARGUMENTS_REQUIRED');
    if (args.action === 'deploy') need(args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
    console.log(JSON.stringify(args.action === 'deploy' ? deploy(args.prod, args.native) :
      { result: 'PREFLIGHT_PASS', ...preflight(args.prod, args.native).delta, production_touched: false }));
  } catch (error) {
    console.error(JSON.stringify({ result: 'BLOCKED', error: error.message }));
    process.exitCode = 2;
  }
}
