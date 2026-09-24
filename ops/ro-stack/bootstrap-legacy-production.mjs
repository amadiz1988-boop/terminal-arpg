import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digest, boundedPath, verifyLegacyBaseline, consumedPath, LEGACY_MODE, UNKNOWN_SHA } from './legacy-production-baseline.mjs';
import { gitRefReachable } from './production-promotion-gate.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const git = (...argv) => execFileSync('git', argv, { cwd: source, encoding: 'utf8', windowsHide: true }).trim();
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const bytes = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const ensure = (condition, message) => { if (!condition) throw Error(message); };
function runtime() {
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(source, 'ops/ro-stack/capture-legacy-runtime.ps1')], { encoding: 'utf8', windowsHide: true, timeout: 60000 }));
}
function main() {
  const head = git('rev-parse', 'HEAD');
  const authority = json(path.join(source, 'docs/project-control/production-release-authority.json'));
  ensure(!git('status', '--porcelain=v1', '--untracked-files=all') &&
    gitRefReachable(source, authority.web.repository, authority.web.release_ref, head), 'BOOTSTRAP_REQUIRES_CLEAN_GITHUB_SOURCE');
  const stateFile = boundedPath(root, '.local/ro-stack/production-deployment-state.json');
  const leaseDir = boundedPath(root, '.local/ro-stack/production-deployment-lease');
  ensure(!fs.existsSync(stateFile) && !fs.existsSync(leaseDir) && !fs.existsSync(boundedPath(root, consumedPath)), 'BOOTSTRAP_ALREADY_INITIALIZED_OR_LEASED');
  const before = runtime();
  const paths = new Set();
  // Exact tracked runtime source paths. Local settings, secrets, logs and DB files are never selected.
  for (const file of git('ls-files').split('\n')) {
    const approved = /^ops\/ro-stack\/[^/]+\.mjs$/.test(file) ||
      /^ops\/ro-stack\/(dashboard|persistent-agent|web-experience)\//.test(file) ||
      /^public\/ro\/data\//.test(file) || /^docs\/ro-asset-index\/[^/]+\.json$/.test(file) ||
      ['package.json', 'package-lock.json'].includes(file);
    if (approved && !/\/(poc|tests)\//.test(file) && fs.existsSync(boundedPath(root, file))) paths.add(file);
  }
  // Bounded current presentation roots, including private runtime assets absent from public Git.
  function inventory(relative) {
    const dir = boundedPath(root, relative);
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      ensure(!item.isSymbolicLink(), 'RUNTIME_ASSET_REPARSE_FORBIDDEN');
      const file = `${relative}/${item.name}`;
      if (item.isDirectory()) inventory(file);
      else if (/\.(png|bmp|webp|jpg|jpeg|gif|wav|mp3|ogg|json|svg)$/i.test(item.name)) paths.add(file);
    }
  }
  inventory('public/ro/client');
  inventory('ops/ro-stack/dashboard/assets/pets');
  paths.add('ops/ro-stack/dashboard/skill-ui-assets.json');
  const rows = [...paths].sort().map(file => {
    const full = boundedPath(root, file);
    if (/\.(mjs|js|json|html|css)$/i.test(file)) {
      const content = fs.readFileSync(full, 'utf8');
      ensure(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/.test(content), 'SECRET_PATTERN_IN_ROLLBACK_SOURCE');
    }
    return { path: file, sha256: digest(full) };
  });
  const native = ['login', 'char', 'map'].map(name => {
    const file = `.local/ro-stack/rathena/${name}-server.exe`;
    return { path: file, sha256: digest(boundedPath(root, file)) };
  });
  const manifest = { schema_version: 1, source_provenance: UNKNOWN_SHA, files: rows };
  const manifestBytes = bytes(manifest);
  const id = hash(manifestBytes + bytes(native)).slice(0, 16).toLowerCase();
  const prefix = `.local/ro-stack/legacy-baseline/${id}`;
  const cap = json(path.join(source, 'docs/project-control/legacy-production-capabilities-v1.json'));
  const capBytes = bytes(cap);
  const state = { schema_version: 2, baseline_mode: LEGACY_MODE, historical_provenance: 'UNRESOLVED',
    current_deploy_id: `LEGACY_BOOTSTRAP_${id}`, current_web_git_sha: UNKNOWN_SHA, current_native_git_sha: UNKNOWN_SHA,
    current_web_deploy_root: root, current_web_artifact_manifest: `${prefix}/web-artifact-manifest.json`,
    current_web_manifest_sha256: hash(manifestBytes), current_native_binary_path: native[2].path,
    current_native_binary_sha256: native[2].sha256, native_binaries: native,
    accepted_capability_manifest: `${prefix}/accepted-capabilities.json`, accepted_capability_manifest_sha256: hash(capBytes),
    accepted_capabilities: cap.capabilities.map(x => x.id), production_drift: 'CLOSED', deployment_lease: 'FREE',
    legacy_bootstrap_available: true, governance_git_sha: head, runtime_snapshot: before,
    legacy_rollback: { root: `${prefix}/rollback`, web_manifest: `${prefix}/rollback-web-manifest.json` } };
  if (!apply) { console.log(JSON.stringify({ apply: false, state, artifact_count: rows.length })); return; }
  const lock = boundedPath(root, '.local/ro-stack/legacy-bootstrap.lock');
  fs.mkdirSync(lock); // Exclusive bootstrap owner; never acquire the deployment lease.
  try {
    ensure(!fs.existsSync(stateFile) && !fs.existsSync(leaseDir) && !fs.existsSync(boundedPath(root, consumedPath)), 'BOOTSTRAP_RACE');
    const base = boundedPath(root, prefix);
    fs.mkdirSync(base, { recursive: true });
    for (const entry of [...rows, ...native]) {
      const target = boundedPath(root, `${state.legacy_rollback.root}/${entry.path}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!fs.existsSync(target)) fs.copyFileSync(boundedPath(root, entry.path), target, fs.constants.COPYFILE_EXCL);
      ensure(digest(target) === entry.sha256, 'ROLLBACK_CAPTURE_MISMATCH');
    }
    for (const [relative, data] of [[state.current_web_artifact_manifest, manifestBytes],
      [state.legacy_rollback.web_manifest, manifestBytes], [state.accepted_capability_manifest, capBytes]]) {
      const file = boundedPath(root, relative);
      if (!fs.existsSync(file)) fs.writeFileSync(file, data, { flag: 'wx' });
      ensure(digest(file) === hash(data), 'BASELINE_METADATA_CONFLICT');
    }
    const after = runtime();
    ensure(['login', 'char', 'map', 'dashboard'].every(key => before.services[key].pid === after.services[key].pid &&
      before.services[key].started_at === after.services[key].started_at) && before.database_pid === after.database_pid && before.procdump_pid === after.procdump_pid, 'RUNTIME_CHANGED_DURING_BOOTSTRAP');
    const checked = verifyLegacyBaseline(root, state);
    ensure(checked.pass && checked.rollbackReady && !fs.existsSync(leaseDir), 'FINAL_BASELINE_OR_LEASE_CHECK_FAILED');
    const stagedState = path.join(lock, 'state.json');
    fs.writeFileSync(stagedState, bytes(state), { flag: 'wx' });
    fs.linkSync(stagedState, stateFile); // Atomic create-if-absent on the same volume.
    fs.unlinkSync(stagedState);
    console.log(JSON.stringify({ bootstrapped: true, deployment_lease: 'FREE', state_file: stateFile, state, artifact_count: rows.length }));
  } finally {
    const temporary = path.join(lock, 'state.json');
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(lock);
  }
}
try { main(); } catch (error) { console.log(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
