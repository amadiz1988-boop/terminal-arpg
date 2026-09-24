import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { test } from 'node:test';
import { canonicalManifestBytes, inspectAssets, materializePackage, packageDigest,
  validateManifest, validatePackage,
} from './materialize-web-runtime-assets.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const path = 'public/ro/client/items/example.png';
const good = Buffer.from('authorized fixture bytes');
const entry = { relative_path: path, size: good.length, sha256: hash(good),
  extension: '.png', required_for_web_runtime: true };
const tree = hash(`${path}\0${good.length}\0${hash(good)}\n`);
const manifest = { schema_version: 1, asset_count: 1,
  package_required_asset_count: 1,
  source_class_counts: { AUTHORIZED_CLIENT_SOURCE: 0, PRIVATE_PACKAGE_REQUIRED: 1 },
  expected_package_tree_sha256: tree, assets: [entry] };
entry.source_class = 'PRIVATE_PACKAGE_REQUIRED';
entry.source_provenance = { kind: 'EXACT_HISTORICAL_GIT_BLOB' };
const root = mkdtempSync(join(tmpdir(), 'web-asset-contract-'));
const checkout = join(root, 'checkout');
const packageRoot = join(root, 'package');
mkdirSync(checkout);
mkdirSync(join(packageRoot, 'assets', 'public', 'ro', 'client', 'items'),
  { recursive: true });
const assetPath = join(packageRoot, 'assets', ...path.split('/'));
const markerPath = join(packageRoot, 'asset-package.json');
writeFileSync(join(packageRoot, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
writeFileSync(join(packageRoot, 'provenance.json'), '{}\n');
const manifestHash = hash(readFileSync(join(packageRoot, 'manifest.json')));
const writeMarker = (approval = 'approved-private-test-fixture') =>
  writeFileSync(markerPath, JSON.stringify({ schema_version: 1,
    source_authority: 'PRIVATE_CANONICAL_ASSET_PACKAGE', asset_count: 1,
    asset_tree_sha256: tree, approval_reference: approval,
    package_id: 'ghost-island-web-runtime-assets-v1', package_version: '1.0.0',
    manifest_sha256: manifestHash, created_from_web_head: 'fixture' }));
const lock = () => ({ schema_version: 1, package_id: 'ghost-island-web-runtime-assets-v1',
  package_version: '1.0.0', asset_count: 1, manifest_sha256: manifestHash,
  created_from_web_head: 'fixture', package_sha256: packageDigest(packageRoot, tree) });

try {
  await test('manifest identity and path checks fail closed', () => {
    assert.equal(validateManifest(manifest), tree);
    for (const relative_path of ['ops/ro-stack/dashboard/assets/pets/example/idle.webp', 'ops/ro-stack/dashboard/skill-ui-assets.json']) {
      const expected_package_tree_sha256 = hash(`${relative_path}\0${good.length}\0${hash(good)}\n`);
      assert.equal(validateManifest({ ...manifest, expected_package_tree_sha256, assets: [{ ...entry, relative_path, extension: relative_path.endsWith('.json') ? '.json' : '.webp' }] }), expected_package_tree_sha256);
    }
    assert.throws(() => validateManifest({ ...manifest, assets: [{ ...entry, relative_path: 'ops/ro-stack/dashboard/app.js' }] }), /invalid_manifest_path/);
    assert.equal(hash(canonicalManifestBytes(Buffer.from('{\r\n  "a": 1\r\n}'))),
      hash(Buffer.from('{\n  "a": 1\n}')));
    assert.throws(() => validateManifest({ ...manifest, asset_count: 2 }),
      /invalid_manifest_asset_count/);
    assert.throws(() => validateManifest({ ...manifest, assets: [
      { ...entry, relative_path: 'public/ro/client/../escape.png' },
    ] }), /invalid_manifest_path/);
  });

  await test('missing, mismatch, and extra source files fail before materialization', () => {
    writeMarker();
    assert.equal(validatePackage(packageRoot, manifest, tree, lock()).missing_asset_count, 1);
    writeFileSync(assetPath, 'wrong');
    assert.equal(validatePackage(packageRoot, manifest, tree, lock()).hash_mismatch_count, 1);
    writeFileSync(assetPath, good);
    writeFileSync(join(packageRoot, 'assets', 'unmanifested.bin'), 'extra');
    assert.equal(validatePackage(packageRoot, manifest, tree, lock()).unmanifested_required_asset_count, 1);
    rmSync(join(packageRoot, 'assets', 'unmanifested.bin'));
    assert.equal(inspectAssets(checkout, manifest).missing_asset_count, 1);
  });

  await test('private marker and checkout conflicts fail closed', () => {
    writeMarker('');
    assert.throws(() => validatePackage(packageRoot, manifest, tree, lock()),
      /private_package_contract_invalid/);
    writeMarker();
    const target = join(checkout, ...path.split('/'));
    mkdirSync(join(checkout, 'public', 'ro', 'client', 'items'),
      { recursive: true });
    writeFileSync(target, 'conflict');
    assert.throws(() => materializePackage(packageRoot, checkout, manifest, tree, lock()),
      /checkout_conflict_or_unmanifested_asset/);
    assert.equal(readFileSync(target, 'utf8'), 'conflict');
    rmSync(target);
  });

  await test('verified private package materializes exact bytes', () => {
    const result = materializePackage(packageRoot, checkout, manifest, tree, lock());
    assert.equal(result.ok, true);
    assert.equal(result.missing_asset_count, 0);
    assert.deepEqual(readFileSync(join(checkout, ...path.split('/'))), good);
  });

  await test('wrong package digest and manifest mismatch fail closed', () => {
    assert.throws(() => validatePackage(packageRoot, manifest, tree,
      { ...lock(), package_sha256: '0'.repeat(64) }), /package_hash_mismatch/);
    const other = { ...manifest, package_required_asset_count: 2 };
    assert.throws(() => validatePackage(packageRoot, other, tree, lock()),
      /package_manifest_mismatch/);
  });
} finally {
  const temp = realpathSync(tmpdir()).toLowerCase();
  const target = realpathSync(root).toLowerCase();
  if (!target.startsWith(temp + sep)) throw new Error('unsafe_temp_cleanup_path');
  rmSync(root, { recursive: true, force: true });
}
