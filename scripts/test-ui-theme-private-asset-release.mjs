import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UI_THEME_ASSET_PATH, canonicalManifestBytes, validateManifest } from './materialize-web-runtime-assets.mjs';

const control = (name) => new URL(`../docs/project-control/${name}`, import.meta.url);
const json = (name) => JSON.parse(canonicalManifestBytes(readFileSync(control(name))));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = json('web-runtime-assets-manifest-v1.2.0.json');
const lock = json('web-runtime-asset-package-lock-v1.2.0.json');
const release = json('web-runtime-private-release-v1.2.0.json');
const themes = json('ui-themes-manifest-v1.json');
const authority = json('production-release-authority.json');
const registry = readFileSync(new URL('../ops/ro-stack/dashboard/ui-theme.js', import.meta.url), 'utf8');
const uiAssets = manifest.assets.filter((asset) => asset.relative_path.includes('/assets/ui-themes/'));

test('scope is Default + 4 heroine themes with 16 sources and 32 runtime assets', () => {
  const scope = manifest.ui_theme_scope;
  assert.equal(scope.theme_series_count, 1);
  assert.equal(scope.heroine_theme_count, 4);
  assert.equal(scope.player_selectable_theme_count, 5);
  assert.equal(scope.licensed_source_file_count, 16);
  assert.equal(scope.runtime_asset_file_count, 32);
  assert.deepEqual(scope.heroine_themes.map((theme) => [theme.label, theme.variant_count]),
    [['洛琪希', 2], ['艾莉絲', 3], ['希露菲', 7], ['妓神', 4]]);
  assert.equal(uiAssets.length, 32);
});

test('v1.2.0 manifest, lock and release identity are consistent', () => {
  assert.equal(validateManifest(manifest), manifest.expected_package_tree_sha256);
  assert.equal(sha256(canonicalManifestBytes(readFileSync(control('web-runtime-assets-manifest-v1.2.0.json')))),
    lock.manifest_sha256);
  for (const key of ['package_id', 'package_version', 'asset_count', 'manifest_sha256', 'package_sha256'])
    assert.equal(release[key], lock[key], key);
  assert.equal(lock.package_version, '1.2.0');
  assert.equal(lock.asset_count, 5107 + 32);
  assert.equal(release.release_tag, 'web-runtime-assets-v1.2.0');
  assert.equal(release.immutable_required, true);
  assert.equal(release.production_authority, false);
});

test('every UI theme asset matches the theme manifest and Web registry exactly', () => {
  const expected = new Map();
  for (const theme of themes.themes) for (const variant of theme.variants) for (const kind of ['panel', 'thumb'])
    expected.set(`${themes.asset_root}/${theme.id}/${variant.key}/${themes.outputs[kind].file}`,
      { ...variant.outputs[kind], theme: theme.id, variant: variant.key, source: variant.source.sha256 });
  assert.equal(expected.size, 32);
  for (const asset of uiAssets) {
    const want = expected.get(asset.relative_path);
    assert.ok(want, `unreferenced:${asset.relative_path}`);
    assert.equal(asset.sha256, want.sha256);
    assert.equal(asset.size, want.size);
    assert.equal(asset.source_provenance.kind, 'USER_PROVIDED_LICENSED_UI_THEME_DERIVATIVE');
    assert.equal(asset.source_provenance.theme, want.theme);
    assert.equal(asset.source_provenance.source_sha256, want.source);
    assert.match(asset.source_provenance.license_authority, /USER_PROVIDED_LICENSED_IMAGE/);
    assert.ok(registry.includes(`key: '${want.variant}'`));
    assert.ok(registry.includes(`panel: '${expected.get(asset.relative_path.replace('thumb.webp', 'panel.webp')).sha256.slice(0, 8)}'`));
  }
  assert.equal(new Set(uiAssets.map((asset) => asset.source_provenance.source_sha256)).size, 16);
});

test('allowlist admits only the exact UI theme layout', () => {
  for (const path of ['ops/ro-stack/dashboard/assets/ui-themes/heroine-roxy/roxy-01/panel.webp',
    'ops/ro-stack/dashboard/assets/ui-themes/heroine-red-dress/red-04/thumb.webp'])
    assert.ok(UI_THEME_ASSET_PATH.test(path), path);
  for (const path of ['ops/ro-stack/dashboard/assets/ui-themes/readme.txt',
    'ops/ro-stack/dashboard/assets/ui-themes/heroine-roxy/roxy-01/full.png',
    'ops/ro-stack/dashboard/assets/ui-themes/../pets/x.webp',
    'ops/ro-stack/dashboard/assets/other/panel.webp'])
    assert.ok(!UI_THEME_ASSET_PATH.test(path), path);
  const bad = { ...manifest, assets: [...manifest.assets] };
  bad.assets.push({ ...uiAssets[0], relative_path: 'ops/ro-stack/dashboard/assets/zzz/panel.webp' });
  assert.throws(() => validateManifest(bad));
});

test('Production pin stays on v1.1.0 and licensed images stay out of public Git', () => {
  assert.equal(authority.assets.release_tag, 'web-runtime-assets-v1.1.0');
  assert.equal(json('web-runtime-private-release-v1.json').release_tag, 'web-runtime-assets-v1.1.0');
  assert.equal(json('web-runtime-asset-package-lock-v1.json').package_version, '1.1.0');
  const cwd = new URL('..', import.meta.url);
  assert.equal(execFileSync('git', ['ls-files', 'ops/ro-stack/dashboard/assets/ui-themes'], { cwd, encoding: 'utf8' }), '');
});