import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { canonicalManifestBytes, validateManifest, validatePackage } from '../../scripts/materialize-web-runtime-assets.mjs';

export function assetReleaseErrors(expected, actual) {
  if (!expected || expected.repository !== 'amadiz1988-boop/ghost-island-assets' ||
      expected.immutable_required !== true || !expected.release_id ||
      ![expected.package_sha256, expected.manifest_sha256, expected.archive?.sha256]
        .every(value => /^[a-f0-9]{64}$/.test(value || ''))) return ['PRIVATE_ASSET_AUTHORITY_UNDEFINED'];
  if (!actual?.available) return ['PRIVATE_ASSET_PACKAGE_UNAVAILABLE'];
  if (!actual.private || !actual.immutable) return ['PRIVATE_ASSET_RELEASE_NOT_IMMUTABLE'];
  for (const key of ['repository', 'release_id', 'release_tag', 'package_id', 'package_version',
    'asset_count', 'package_sha256', 'manifest_sha256']) {
    if (actual[key] !== expected[key]) return ['PRIVATE_ASSET_HASH_OR_IDENTITY_MISMATCH'];
  }
  return actual.valid === true && actual.archive_sha256 === expected.archive.sha256
    ? [] : ['PRIVATE_ASSET_HASH_OR_IDENTITY_MISMATCH'];
}

export function inspectPrivatePackage(root, packageRoot, expected) {
  if (!expected || !packageRoot || !fs.existsSync(packageRoot)) return { available: false };
  try {
    const result = spawnSync('python', ['-B', path.join(root, 'scripts/fetch-web-runtime-private-release.py'),
      '--checkout', root, '--verify-release-only'], { encoding: 'utf8', windowsHide: true, timeout: 90000 });
    if (result.status !== 0) return { available: false };
    const remote = JSON.parse(result.stdout);
    const read = file => JSON.parse(fs.readFileSync(path.join(root, 'docs/project-control', file), 'utf8'));
    const manifestBytes = canonicalManifestBytes(fs.readFileSync(path.join(root, 'docs/project-control/web-runtime-assets-manifest-v1.json')));
    const manifest = JSON.parse(manifestBytes);
    const lock = read('web-runtime-asset-package-lock-v1.json');
    const hash = createHash('sha256').update(manifestBytes).digest('hex');
    if (hash !== expected.manifest_sha256 || lock.package_sha256 !== expected.package_sha256)
      return { available: true, valid: false };
    const check = validatePackage(packageRoot, manifest, validateManifest(manifest), lock);
    return { ...remote, ...lock, valid: check.ok === true };
  } catch { return { available: true, valid: false }; }
}
