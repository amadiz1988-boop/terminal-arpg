import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_ROOT, LEGACY_ARCHIVE, assessLocalLineage, classifyOrigin,
  mainRelationAccepted, nativeSourceAuthorityPreflight
} from '../native-source-authority-preflight.mjs';

let passed = 0;
const guardScript = fileURLToPath(new URL('../native-source-authority-preflight.mjs', import.meta.url));
async function test(name, run) {
  await run();
  passed++;
  process.stdout.write('PASS ' + passed + ' ' + name + '\n');
}

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', windowsHide: true
  }).trim();
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-source-authority-guard-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Source Authority Test');
  git(root, 'config', 'user.email', 'test@invalid.example');
  fs.writeFileSync(path.join(root, 'canonical.txt'), 'canonical\n');
  git(root, 'add', 'canonical.txt');
  git(root, 'commit', '-q', '-m', 'canonical base');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return root;
}

function removeFixture(root) {
  const resolved = path.resolve(root);
  const tempRoot = fs.realpathSync(os.tmpdir());
  if (path.dirname(resolved).toLowerCase() !== tempRoot.toLowerCase() ||
      !path.basename(resolved).startsWith('native-source-authority-guard-'))
    throw Error('FIXTURE_PATH_OUTSIDE_TEMP');
  fs.rmSync(resolved, { recursive: true, force: true });
}

await test('current canonical root passes authenticated read-only checks', async () => {
  const missingRoot = spawnSync(process.execPath, [guardScript], {
    encoding: 'utf8', windowsHide: true
  });
  assert.equal(missingRoot.status, 1);
  assert.equal(JSON.parse(missingRoot.stdout).REASON, 'NATIVE_ROOT_ARGUMENT_REQUIRED');
  const result = await nativeSourceAuthorityPreflight();
  assert.equal(result.NATIVE_SOURCE_AUTHORITY_PREFLIGHT, 'PASS', result.REASON);
  assert.equal(result.CURRENT_BRANCH, 'main');
  assert.equal(result.REMOTE_ORIGIN_MATCHES_PRIVATE_GITHUB, true);
  assert.equal(result.WORKTREE_STATUS_REPORTED, true);
});

await test('legacy archive fails before Git lineage inspection', async () => {
  const command = spawnSync(process.execPath, [guardScript, '--root', LEGACY_ARCHIVE], {
    encoding: 'utf8', windowsHide: true
  });
  assert.equal(command.status, 1);
  const result = JSON.parse(command.stdout);
  assert.equal(result.NATIVE_SOURCE_AUTHORITY_PREFLIGHT, 'FAIL');
  assert.equal(result.REASON, 'LEGACY_ARCHIVE_SELECTED');
});

await test('historical .tmp worktree is not canonical source', async () => {
  const root = path.join(path.dirname(CANONICAL_ROOT), '.tmp-historical-native');
  const result = await nativeSourceAuthorityPreflight({ root });
  assert.equal(result.NATIVE_SOURCE_AUTHORITY_PREFLIGHT, 'FAIL');
  assert.equal(result.REASON, 'TMP_WORKTREE_SELECTED');
});

await test('local bundle remote metadata is rejected', () => {
  assert.equal(classifyOrigin('C:\\Users\\Administrator\\backup\\rathena.bundle'),
    'LOCAL_BUNDLE_REMOTE');
});

const root = fixture();
try {
  await test('feature commit descended from tracked canonical main passes', () => {
    git(root, 'switch', '-q', '-c', 'feature');
    fs.writeFileSync(path.join(root, 'feature.txt'), 'feature\n');
    git(root, 'add', 'feature.txt');
    git(root, 'commit', '-q', '-m', 'feature change');
    assert.notEqual(git(root, 'rev-parse', 'HEAD'),
      git(root, 'rev-parse', 'refs/remotes/origin/main'));
    assert.equal(assessLocalLineage(root).ok, true);
    assert.equal(mainRelationAccepted('ahead'), true);
  });

  await test('unrelated root fixture fails lineage check', () => {
    git(root, 'switch', '-q', '--orphan', 'unrelated');
    fs.writeFileSync(path.join(root, 'unrelated.txt'), 'unrelated\n');
    git(root, 'add', 'unrelated.txt');
    git(root, 'commit', '-q', '-m', 'unrelated root');
    const result = assessLocalLineage(root);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'UNRELATED_HISTORY');
  });
} finally {
  removeFixture(root);
}

process.stdout.write('NATIVE_SOURCE_AUTHORITY_GUARD_TESTS=' + passed + '/6 PASS\n');
process.stdout.write('FALSE_POSITIVE_VALID_FEATURE_BRANCH=0\n');
process.stdout.write('FALSE_NEGATIVE_LEGACY_SOURCE=0\n');
