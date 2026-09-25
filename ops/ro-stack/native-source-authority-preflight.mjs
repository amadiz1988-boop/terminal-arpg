import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CANONICAL_ROOT = 'C:\\Users\\Administrator\\source\\ghost-island-rathena';
export const LEGACY_ARCHIVE = 'C:\\Users\\Administrator\\source\\ghost-island-rathena-legacy-931cd598';
export const GITHUB_REPOSITORY = 'amadiz1988-boop/ghost-island-rathena';
const GITHUB_API = 'https://api.github.com/repos/' + GITHUB_REPOSITORY;
const SHA = /^[0-9a-f]{40}$/i;

const normalizePath = value => path.win32.normalize(path.resolve(value))
  .replace(/^\\\\\?\\/, '').replace(/[\\/]$/, '').toLowerCase();

export function classifyRoot(root) {
  const selected = normalizePath(root);
  if (selected === normalizePath(LEGACY_ARCHIVE)) return 'LEGACY_ARCHIVE_SELECTED';
  if (selected.split(/[\\/]/).some(part => part.startsWith('.tmp-')))
    return 'TMP_WORKTREE_SELECTED';
  if (selected !== normalizePath(CANONICAL_ROOT)) return 'NON_CANONICAL_NATIVE_ROOT';
  return null;
}

export function classifyOrigin(origin) {
  const value = String(origin || '').trim();
  if (/\.bundle(?:[?#].*)?$/i.test(value) ||
      /^(?:[a-z]:[\\/]|\\\\|\/|file:|\.\.?[\\/])/i.test(value))
    return 'LOCAL_BUNDLE_REMOTE';
  if (/^https:\/\/github\.com\/amadiz1988-boop\/ghost-island-rathena(?:\.git)?\/?$/i.test(value) ||
      /^git@github\.com:amadiz1988-boop\/ghost-island-rathena(?:\.git)?$/i.test(value) ||
      /^ssh:\/\/git@github\.com\/amadiz1988-boop\/ghost-island-rathena(?:\.git)?\/?$/i.test(value))
    return null;
  return 'WRONG_REMOTE';
}

function git(root, args, input) {
  const result = spawnSync('git', ['-C', root, ...args], {
    input, encoding: 'utf8', windowsHide: true, timeout: 20000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
  });
  return { ok: result.status === 0 && !result.error, text: (result.stdout || '').trim() };
}

function credential() {
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8', windowsHide: true, timeout: 15000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
  });
  if (result.status !== 0 || result.error) return null;
  const line = (result.stdout || '').split(/\r?\n/).find(row => row.startsWith('password='));
  return line ? line.slice('password='.length) : null;
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ghost-island-native-source-authority-preflight'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return null;
  return response.json();
}

export function assessLocalLineage(root) {
  const originMain = git(root, ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}']);
  if (!originMain.ok || !SHA.test(originMain.text))
    return { ok: false, reason: 'GITHUB_MAIN_NOT_REACHABLE' };
  const common = git(root, ['merge-base', 'HEAD', 'refs/remotes/origin/main']);
  const headRoots = git(root, ['rev-list', '--max-parents=0', 'HEAD']);
  const mainRoots = git(root, ['rev-list', '--max-parents=0', 'refs/remotes/origin/main']);
  if (!common.ok || !SHA.test(common.text) || !headRoots.ok || !mainRoots.ok)
    return { ok: false, reason: 'UNRELATED_HISTORY', originMain: originMain.text };
  const roots = headRoots.text.split(/\r?\n/).filter(Boolean);
  const canonicalRoots = new Set(mainRoots.text.split(/\r?\n/).filter(Boolean));
  if (roots.length === 0 || roots.some(rootSha => !canonicalRoots.has(rootSha)))
    return { ok: false, reason: 'UNRELATED_HISTORY', originMain: originMain.text };
  return { ok: true, originMain: originMain.text, mergeBase: common.text };
}

export function mainRelationAccepted(status) {
  return status === 'identical' || status === 'ahead';
}

function initialReport(root) {
  return {
    NATIVE_SOURCE_AUTHORITY_PREFLIGHT: 'FAIL',
    REASON: null,
    CANONICAL_PATH: CANONICAL_ROOT,
    SELECTED_PATH: root,
    CANONICAL_PATH_EXISTS: false,
    IS_GIT_REPOSITORY: false,
    REMOTE_ORIGIN_MATCHES_PRIVATE_GITHUB: false,
    REMOTE_IS_LOCAL_BUNDLE: null,
    CURRENT_BRANCH: null,
    CURRENT_HEAD: null,
    LOCAL_ORIGIN_MAIN_HEAD: null,
    REMOTE_MAIN_HEAD: null,
    HEAD_REACHABLE_FROM_REMOTE_MAIN_LINEAGE: false,
    NO_UNRELATED_HISTORY: false,
    LEGACY_ARCHIVE_NOT_ACTIVE_SOURCE: false,
    CANONICAL_PATH_NOT_TMP_WORKTREE: false,
    WORKTREE_STATUS_REPORTED: false,
    WORKTREE_STATUS: null,
    WORKTREE_CHANGE_COUNT: null
  };
}

const failed = (report, reason) => ({ ...report, REASON: reason });

export async function nativeSourceAuthorityPreflight({
  root = CANONICAL_ROOT, startFromCurrentMain = false
} = {}) {
  const report = initialReport(root);
  const pathReason = classifyRoot(root);
  if (pathReason) return failed(report, pathReason);
  report.LEGACY_ARCHIVE_NOT_ACTIVE_SOURCE = true;
  report.CANONICAL_PATH_NOT_TMP_WORKTREE = true;
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    return failed(report, 'CANONICAL_PATH_MISSING');
  report.CANONICAL_PATH_EXISTS = true;
  if (normalizePath(fs.realpathSync.native(root)) !== normalizePath(CANONICAL_ROOT))
    return failed(report, 'NON_CANONICAL_NATIVE_ROOT');

  const inside = git(root, ['rev-parse', '--is-inside-work-tree']);
  const top = git(root, ['rev-parse', '--show-toplevel']);
  if (!inside.ok || inside.text !== 'true' || !top.ok ||
      normalizePath(top.text) !== normalizePath(CANONICAL_ROOT))
    return failed(report, 'NOT_GIT_REPOSITORY');
  report.IS_GIT_REPOSITORY = true;

  const branch = git(root, ['branch', '--show-current']);
  const head = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!branch.ok || !branch.text || !head.ok || !SHA.test(head.text))
    return failed(report, 'DETACHED_OR_INVALID_HEAD');
  report.CURRENT_BRANCH = branch.text;
  report.CURRENT_HEAD = head.text;

  const status = git(root, ['status', '--porcelain=v1', '-uall']);
  if (!status.ok) return failed(report, 'WORKTREE_STATUS_UNAVAILABLE');
  report.WORKTREE_STATUS_REPORTED = true;
  report.WORKTREE_STATUS = status.text ? 'DIRTY' : 'CLEAN';
  report.WORKTREE_CHANGE_COUNT = status.text ? status.text.split(/\r?\n/).length : 0;

  const origin = git(root, ['remote', 'get-url', 'origin']);
  if (!origin.ok) return failed(report, 'WRONG_REMOTE');
  const originReason = classifyOrigin(origin.text);
  report.REMOTE_IS_LOCAL_BUNDLE = originReason === 'LOCAL_BUNDLE_REMOTE';
  if (originReason) return failed(report, originReason);

  const token = credential();
  if (!token) return failed(report, 'PRIVATE_GITHUB_IDENTITY_UNVERIFIED');
  let metadata;
  try { metadata = await githubJson(GITHUB_API, token); }
  catch { return failed(report, 'PRIVATE_GITHUB_IDENTITY_UNVERIFIED'); }
  if (metadata?.full_name?.toLowerCase() !== GITHUB_REPOSITORY ||
      metadata?.private !== true || metadata?.default_branch !== 'main')
    return failed(report, 'PRIVATE_GITHUB_IDENTITY_UNVERIFIED');
  report.REMOTE_ORIGIN_MATCHES_PRIVATE_GITHUB = true;

  const remote = git(root, ['ls-remote', 'origin', 'refs/heads/main']);
  const match = remote.text.match(/^([0-9a-f]{40})\s+refs\/heads\/main$/i);
  if (!remote.ok || !match) return failed(report, 'GITHUB_MAIN_NOT_REACHABLE');
  report.REMOTE_MAIN_HEAD = match[1].toLowerCase();

  const lineage = assessLocalLineage(root);
  report.LOCAL_ORIGIN_MAIN_HEAD = lineage.originMain || null;
  if (!lineage.ok) return failed(report, lineage.reason);
  report.NO_UNRELATED_HISTORY = true;

  if (lineage.originMain.toLowerCase() !== report.REMOTE_MAIN_HEAD) {
    const remoteObject = git(root, ['cat-file', '-e', report.REMOTE_MAIN_HEAD + '^{commit}']);
    if (remoteObject.ok) {
      const ancestor = git(root, ['merge-base', '--is-ancestor',
        lineage.originMain, report.REMOTE_MAIN_HEAD]);
      if (!ancestor.ok) return failed(report, 'GITHUB_MAIN_NOT_REACHABLE');
    } else {
      let comparison;
      try {
        comparison = await githubJson(GITHUB_API + '/compare/' +
          lineage.originMain + '...' + report.REMOTE_MAIN_HEAD, token);
      } catch { return failed(report, 'GITHUB_MAIN_NOT_REACHABLE'); }
      if (!mainRelationAccepted(comparison?.status))
        return failed(report, 'GITHUB_MAIN_NOT_REACHABLE');
    }
  }
  report.HEAD_REACHABLE_FROM_REMOTE_MAIN_LINEAGE = true;

  if (startFromCurrentMain &&
      (report.CURRENT_BRANCH !== 'main' || report.CURRENT_HEAD.toLowerCase() !== report.REMOTE_MAIN_HEAD))
    return failed(report, 'START_FROM_CURRENT_MAIN_REQUIRED');
  report.NATIVE_SOURCE_AUTHORITY_PREFLIGHT = 'PASS';
  return report;
}

function options(argv) {
  let root = null;
  let startFromCurrentMain = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1] && !argv[i + 1].startsWith('--'))
      root = argv[++i];
    else if (argv[i] === '--start-from-current-main') startFromCurrentMain = true;
    else throw Error('INVALID_ARGUMENT');
  }
  if (!root) throw Error('NATIVE_ROOT_ARGUMENT_REQUIRED');
  return { root, startFromCurrentMain };
}

if (process.argv[1] && normalizePath(process.argv[1]) === normalizePath(fileURLToPath(import.meta.url))) {
  let result;
  try { result = await nativeSourceAuthorityPreflight(options(process.argv.slice(2))); }
  catch (error) {
    const reason = ['INVALID_ARGUMENT', 'NATIVE_ROOT_ARGUMENT_REQUIRED'].includes(error.message)
      ? error.message : 'PREFLIGHT_EXECUTION_ERROR';
    result = failed(initialReport(process.cwd()), reason);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.NATIVE_SOURCE_AUTHORITY_PREFLIGHT !== 'PASS') process.exitCode = 1;
}
