// Build web-runtime-assets-v1.2.0: the verified v1.1.0 package plus the
// approved UI theme runtime art (UI_THEME_PRODUCT_SCOPE_V1). The Production
// pin (web-runtime-*-v1.json and production-release-authority.json) is not
// touched; this writes versioned v1.2.0 files for the next promotion.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import {
  UI_THEME_ASSET_PATH, canonicalManifestBytes, packageDigest, validateManifest, validatePackage,
} from './materialize-web-runtime-assets.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const control = resolve('docs/project-control');
const read = (name) => JSON.parse(canonicalManifestBytes(readFileSync(join(control, name))));
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--base-package' || args[2] !== '--package' || args[4] !== '--web-head')
  throw new Error('usage: --base-package V1_1_0_PACKAGE_DIR --package NEW_DIR --web-head SHA');
const base = resolve(args[1]);
const destination = resolve(args[3]);
const webHead = args[5];
if (!/^[0-9a-f]{40}$/.test(webHead)) throw new Error('web_head_sha_required');
const production = resolve('C:/Users/Administrator/ghost-island-production/ro-stack').toLowerCase();
const inside = (candidate, root) => candidate === root || candidate.startsWith(root + sep);
if (existsSync(destination) || inside(destination.toLowerCase(), production) ||
    inside(destination.toLowerCase(), resolve('.').toLowerCase()))
  throw new Error('unsafe_or_existing_package_path');

const baseManifest = read('web-runtime-assets-manifest-v1.json');
const baseLock = read('web-runtime-asset-package-lock-v1.json');
if (baseLock.package_version !== '1.1.0') throw new Error('base_must_be_v1.1.0');
const baseCheck = validatePackage(base, baseManifest, validateManifest(baseManifest), baseLock);
if (!baseCheck.ok) throw new Error('base_package_invalid');

const themes = read('ui-themes-manifest-v1.json');
const registry = readFileSync('ops/ro-stack/dashboard/ui-theme.js', 'utf8');
const scope = {
  id: 'UI_THEME_PRODUCT_SCOPE_V1',
  theme_series: ['無職轉生'],
  theme_series_count: 1,
  default_theme: 'current RO-style UI; uses no licensed heroine image',
  heroine_themes: themes.themes.map((theme) => ({ id: theme.id, label: theme.heroine,
    variant_count: theme.variants.length })),
  heroine_theme_count: themes.themes.length,
  player_selectable_theme_count: themes.themes.length + 1,
  licensed_source_file_count: themes.themes.reduce((n, theme) => n + theme.variants.length, 0),
  runtime_asset_file_count: 0,
  meaning: 'Default + 4 heroine themes = 5 selectable themes; each licensed source image is one ' +
    'rotating variant of a heroine theme (not a theme) and yields panel.webp + thumb.webp.',
  access_policy: 'ALL_PLAYERS; no Donate gating in this release',
};
if (scope.heroine_theme_count !== 4 || scope.licensed_source_file_count !== 16)
  throw new Error('theme_scope_mismatch');
const licenseAuthority = 'USER_PROVIDED_LICENSED_IMAGE: supplied by the project owner as licensed ' +
  'images for this UI (UI_THEME_SYSTEM_V1); private release approved by Project Control ' +
  'WEB_UI_THEME_PRIVATE_ASSET_RELEASE_V1_2_0';

const additions = [];
const sources = [];
const seenSources = new Set();
for (const theme of themes.themes) {
  for (const variant of theme.variants) {
    if (seenSources.has(variant.source.sha256)) throw new Error('duplicate_source_mapping');
    seenSources.add(variant.source.sha256);
    const derived = {};
    for (const kind of ['panel', 'thumb']) {
      const relativePath = `${themes.asset_root}/${theme.id}/${variant.key}/${themes.outputs[kind].file}`;
      if (!UI_THEME_ASSET_PATH.test(relativePath)) throw new Error(`ui_theme_path_invalid:${relativePath}`);
      const bytes = readFileSync(relativePath);
      const expected = variant.outputs[kind];
      if (bytes.length !== expected.size || sha256(bytes) !== expected.sha256)
        throw new Error(`ui_theme_asset_hash_mismatch:${relativePath}`);
      const version = `{ key: '${variant.key}', versions: { panel: '${variant.outputs.panel.sha256.slice(0, 8)}', thumb: '${variant.outputs.thumb.sha256.slice(0, 8)}' } }`;
      if (!registry.includes(version)) throw new Error(`web_registry_mismatch:${variant.key}`);
      derived[kind] = relativePath;
      additions.push({
        relative_path: relativePath, size: bytes.length, sha256: expected.sha256, extension: '.webp',
        required_for_web_runtime: true, source_class: 'PRIVATE_PACKAGE_REQUIRED',
        source_provenance: { kind: 'USER_PROVIDED_LICENSED_UI_THEME_DERIVATIVE',
          theme: theme.id, heroine: theme.heroine, variant: variant.key, output: kind,
          source_folder: variant.source.folder, source_file: variant.source.file,
          source_sha256: variant.source.sha256, license_authority: licenseAuthority,
          derivation: 'scripts/build-ui-themes.py per docs/project-control/ui-themes-manifest-v1.json' },
        requirement_evidence: 'ops/ro-stack/dashboard/ui-theme.js registry variant versions',
      });
    }
    sources.push({ theme: theme.id, heroine: theme.heroine, source_id: variant.key,
      source_folder: variant.source.folder, source_file: variant.source.file,
      source_sha256: variant.source.sha256, license_authority: licenseAuthority,
      derived_panel: derived.panel, derived_thumb: derived.thumb });
  }
}
scope.runtime_asset_file_count = additions.length;
if (additions.length !== 32) throw new Error('runtime_asset_count_mismatch');

const assets = [...baseManifest.assets, ...additions]
  .sort((a, b) => (a.relative_path < b.relative_path ? -1 : a.relative_path > b.relative_path ? 1 : 0));
const tree = sha256(assets.map((asset) =>
  `${asset.relative_path}\0${asset.size}\0${asset.sha256}\n`).join(''));
const origin = { ...baseManifest.origin_evidence_counts,
  USER_PROVIDED_LICENSED_UI_THEME_DERIVATIVE: additions.length };
const manifest = { ...baseManifest,
  input_web_head: webHead,
  asset_count: assets.length,
  classification_scope: `${baseManifest.classification_scope}; v1.2.0 adds UI_THEME_PRODUCT_SCOPE_V1 runtime art`,
  expected_package_tree_sha256: tree,
  source_class_counts: { ...baseManifest.source_class_counts,
    PRIVATE_PACKAGE_REQUIRED: baseManifest.source_class_counts.PRIVATE_PACKAGE_REQUIRED + additions.length },
  origin_evidence_counts: origin,
  package_required_asset_count: assets.length,
  base_release: { release_tag: 'web-runtime-assets-v1.1.0', package_sha256: baseLock.package_sha256,
    manifest_sha256: baseLock.manifest_sha256, asset_count: baseLock.asset_count },
  ui_theme_scope: scope,
  approval_reference: 'WEB_UI_THEME_PRIVATE_ASSET_RELEASE_V1_2_0',
  assets,
};
if (validateManifest(manifest) !== tree) throw new Error('manifest_tree_invalid');
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);

mkdirSync(destination, { recursive: false });
cpSync(join(base, 'assets'), join(destination, 'assets'), { recursive: true, errorOnExist: true });
for (const asset of additions) {
  const target = join(destination, 'assets', ...asset.relative_path.split('/'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(asset.relative_path), { flag: 'wx' });
}
const baseProvenance = JSON.parse(readFileSync(join(base, 'provenance.json'), 'utf8'));
writeFileSync(join(destination, 'manifest.json'), manifestBytes);
writeFileSync(join(destination, 'provenance.json'), `${JSON.stringify({
  ...baseProvenance, package_version: '1.2.0',
  base_package: { package_version: '1.1.0', package_sha256: baseLock.package_sha256 },
  ui_theme_scope: scope, ui_theme_sources: sources,
}, null, 2)}\n`);
const lock = { schema_version: 1, package_id: baseLock.package_id, package_version: '1.2.0',
  asset_count: assets.length, manifest_sha256: sha256(manifestBytes), created_from_web_head: webHead };
writeFileSync(join(destination, 'asset-package.json'), `${JSON.stringify({
  schema_version: 1, source_authority: 'PRIVATE_CANONICAL_ASSET_PACKAGE', ...lock,
  asset_tree_sha256: tree, approval_reference: 'WEB_UI_THEME_PRIVATE_ASSET_RELEASE_V1_2_0',
}, null, 2)}\n`);
lock.package_sha256 = packageDigest(destination, tree);
const result = validatePackage(destination, manifest, tree, lock);
if (!result.ok) throw new Error(JSON.stringify(result));
writeFileSync(join(control, 'web-runtime-assets-manifest-v1.2.0.json'), manifestBytes);
writeFileSync(join(control, 'web-runtime-asset-package-lock-v1.2.0.json'), `${JSON.stringify(lock, null, 2)}\n`);
console.log(JSON.stringify({ package: destination, ...lock, asset_tree_sha256: tree,
  added: additions.length, scope, verification: result }));