import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, readFileSync, readdirSync, mkdirSync, realpathSync,
  statSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const DEFAULT_MANIFEST = 'docs/project-control/web-runtime-assets-manifest-v1.json';
const DEFAULT_LOCK = 'docs/project-control/web-runtime-asset-package-lock-v1.json';
const SOURCE_KINDS = new Set([
  'AUTHORIZED_CLIENT_FILE_HASH_MATCH',
  'EXACT_HISTORICAL_GIT_BLOB',
  'ACCEPTED_CLIENT_IMPORT_MANIFEST_REFERENCE',
  'ACCEPTED_MANIFEST_CLIENT_ARCHIVE_MAPPING',
  'ACCEPTED_RUNTIME_MANIFEST_WITH_CLIENT_HASHES',
  'TRACKED_SHOWCASE_MANIFEST_REFERENCE',
  'USER_PROVIDED_LICENSED_UI_THEME_DERIVATIVE',
]);
// UI theme runtime art is admitted only at its exact registry layout:
// ops/ro-stack/dashboard/assets/ui-themes/<heroine-theme>/<variant>/{panel,thumb}.webp
export const UI_THEME_ASSET_PATH =
  /^ops\/ro-stack\/dashboard\/assets\/ui-themes\/heroine-[a-z0-9-]+\/[a-z]+-\d{2}\/(?:panel|thumb)\.webp$/;
const UI_THEME_ROOT = 'ops/ro-stack/dashboard/assets/ui-themes';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const canonicalManifestBytes = (bytes) =>
  Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
const normalize = (path) => resolve(path).toLowerCase();
const within = (path, root) => path === root || path.startsWith(root + sep);

export function validateManifest(manifest) {
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.assets))
    throw new Error('invalid_manifest_schema');
  if (manifest.asset_count !== manifest.assets.length)
    throw new Error('invalid_manifest_asset_count');
  const seen = new Set();
  const classes = { AUTHORIZED_CLIENT_SOURCE: 0, PRIVATE_PACKAGE_REQUIRED: 0 };
  let previous = '';
  for (const asset of manifest.assets) {
    const path = asset.relative_path;
    const approvedRoot = typeof path === 'string' && (path.startsWith('public/ro/client/') ||
      path.startsWith('ops/ro-stack/dashboard/assets/pets/') ||
      path === 'ops/ro-stack/dashboard/skill-ui-assets.json' ||
      UI_THEME_ASSET_PATH.test(path));
    if (!approvedRoot || path.includes(':') || path.includes('\\') ||
        path.split('/').some(part => !part || part === '.' || part === '..') || isAbsolute(path) ||
        path <= previous || seen.has(path.toLowerCase())) throw new Error('invalid_manifest_path');
    if (!Number.isSafeInteger(asset.size) || asset.size < 0 ||
        !/^[0-9a-f]{64}$/.test(asset.sha256) ||
        asset.required_for_web_runtime !== true ||
        asset.extension !== extname(path).toLowerCase() ||
        !Object.hasOwn(classes, asset.source_class) ||
        !SOURCE_KINDS.has(asset.source_provenance?.kind))
      throw new Error('invalid_manifest_asset');
    classes[asset.source_class] += 1;
    seen.add(path.toLowerCase());
    previous = path;
  }
  if (manifest.package_required_asset_count !== manifest.asset_count ||
      Object.keys(manifest.source_class_counts ?? {}).length !== 2 ||
      Object.entries(classes).some(([key, count]) => manifest.source_class_counts[key] !== count))
    throw new Error('invalid_manifest_class_counts');
  const tree = sha256(manifest.assets.map((asset) =>
    `${asset.relative_path}\0${asset.size}\0${asset.sha256}\n`).join(''));
  if (tree !== manifest.expected_package_tree_sha256)
    throw new Error('manifest_tree_hash_mismatch');
  return tree;
}

export function packageDigest(root, tree) {
  const metadata = ['asset-package.json', 'manifest.json', 'provenance.json'];
  const records = metadata.map((name) => {
    const bytes = readFileSync(join(root, name));
    return `${name}\0${bytes.length}\0${sha256(bytes)}\n`;
  });
  return sha256(`${records.join('')}asset-tree\0${tree}\n`);
}

function filesBelow(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('package_symlink_forbidden');
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error('package_special_file_forbidden');
    }
  };
  walk(root);
  return files;
}

export function inspectAssets(root, manifest, { packageRoot = false, tracked = new Set() } = {}) {
  const base = packageRoot ? join(root, 'assets') : root;
  const expected = new Set(manifest.assets.map((asset) => asset.relative_path));
  const result = { required_asset_count: manifest.asset_count,
    missing_asset_count: 0, hash_mismatch_count: 0,
    unmanifested_required_asset_count: 0, examples: [] };
  const add = (field, path) => {
    result[field] += 1;
    if (result.examples.length < 12) result.examples.push(`${field}:${path}`);
  };
  for (const asset of manifest.assets) {
    const path = join(base, ...asset.relative_path.split('/'));
    if (!existsSync(path)) { add('missing_asset_count', asset.relative_path); continue; }
    const info = statSync(path);
    if (!info.isFile() || info.size !== asset.size ||
        sha256(readFileSync(path)) !== asset.sha256)
      add('hash_mismatch_count', asset.relative_path);
  }
  const inspected = packageRoot ? filesBelow(join(root, 'assets')) : [
    ...filesBelow(join(root, 'public/ro/client')),
    ...filesBelow(join(root, 'ops/ro-stack/dashboard/assets/pets')),
    ...filesBelow(join(root, UI_THEME_ROOT)),
  ];
  for (const file of inspected) {
    const path = relative(base, file).replaceAll('\\', '/');
    if (!expected.has(path) && !tracked.has(path))
      add('unmanifested_required_asset_count', path);
  }
  result.ok = result.missing_asset_count === 0 && result.hash_mismatch_count === 0 &&
    result.unmanifested_required_asset_count === 0;
  return result;
}

function trackedClientPaths(checkout) {
  const output = execFileSync('git', ['ls-files', '-z', '--', 'public/ro/client', 'ops/ro-stack/dashboard/assets/pets', UI_THEME_ROOT],
    { cwd: checkout });
  return new Set(output.toString('utf8').split('\0').filter(Boolean));
}

export function validatePackage(root, manifest, tree, lock) {
  if (!lock || lock.schema_version !== 1 ||
      lock.package_id !== 'ghost-island-web-runtime-assets-v1' ||
      !['1.0.0', '1.1.0', '1.2.0'].includes(lock.package_version) ||
      lock.asset_count !== manifest.asset_count ||
      !/^[0-9a-f]{64}$/.test(lock.manifest_sha256) ||
      !/^[0-9a-f]{64}$/.test(lock.package_sha256))
    throw new Error('private_package_lock_invalid');
  const manifestBytes = readFileSync(join(root, 'manifest.json'));
  if (sha256(manifestBytes) !== lock.manifest_sha256 ||
      JSON.stringify(JSON.parse(manifestBytes)) !== JSON.stringify(manifest))
    throw new Error('package_manifest_mismatch');
  const markerPath = join(root, 'asset-package.json');
  if (!existsSync(markerPath)) throw new Error('private_package_marker_missing');
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  if (marker.schema_version !== 1 ||
      marker.source_authority !== 'PRIVATE_CANONICAL_ASSET_PACKAGE' ||
      marker.asset_count !== manifest.asset_count ||
      marker.asset_tree_sha256 !== tree ||
      marker.package_id !== lock.package_id ||
      marker.package_version !== lock.package_version ||
      marker.manifest_sha256 !== lock.manifest_sha256 ||
      marker.created_from_web_head !== lock.created_from_web_head ||
      typeof marker.approval_reference !== 'string' ||
      !marker.approval_reference.trim())
    throw new Error('private_package_contract_invalid');
  const allowed = new Set(['asset-package.json', 'manifest.json', 'provenance.json', 'assets']);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!allowed.has(entry.name) || entry.isSymbolicLink() ||
        (entry.name === 'assets' ? !entry.isDirectory() : !entry.isFile()))
      throw new Error('unexpected_package_entry');
  }
  if (packageDigest(root, tree) !== lock.package_sha256)
    throw new Error('package_hash_mismatch');
  return inspectAssets(root, manifest, { packageRoot: true });
}

export function materializePackage(packageRoot, checkout, manifest, tree, lock,
    tracked = new Set()) {
  const source = validatePackage(packageRoot, manifest, tree, lock);
  if (!source.ok) return source;
  const target = inspectAssets(checkout, manifest, { tracked });
  if (target.hash_mismatch_count || target.unmanifested_required_asset_count)
    throw new Error('checkout_conflict_or_unmanifested_asset');
  for (const asset of manifest.assets) {
    const destination = join(checkout, ...asset.relative_path.split('/'));
    if (existsSync(destination)) continue;
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(packageRoot, 'assets', ...asset.relative_path.split('/')), destination);
  }
  return inspectAssets(checkout, manifest, { tracked });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--mode', '--manifest', '--package', '--asset-package', '--lock', '--checkout'].includes(argv[i]) ||
        i + 1 >= argv.length) throw new Error('usage: --mode verify-checkout|verify-package|materialize --checkout DIR [--package DIR] [--manifest FILE]');
    args[argv[i].slice(2)] = argv[i + 1];
  }
  if (args['asset-package']) args.package = args['asset-package'];
  if (!['verify-checkout', 'verify-package', 'materialize'].includes(args.mode) || !args.checkout)
    throw new Error('invalid_mode_or_checkout');
  if (args.mode !== 'verify-checkout' && !args.package)
    throw new Error('private_package_required');
  return args;
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const checkout = realpathSync(args.checkout);
    const manifestPath = resolve(args.manifest ?? join(checkout, DEFAULT_MANIFEST));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const lock = args.mode === 'verify-checkout' ? null :
      JSON.parse(readFileSync(resolve(args.lock ?? join(checkout, DEFAULT_LOCK)), 'utf8'));
    if (lock && sha256(canonicalManifestBytes(readFileSync(manifestPath))) !== lock.manifest_sha256)
      throw new Error('manifest_hash_mismatch');
    const tree = validateManifest(manifest);
    const production = normalize(manifest.production_evidence_root);
    if (within(normalize(checkout), production)) throw new Error('production_target_forbidden');
    let result;
    if (args.mode === 'verify-checkout') {
      result = inspectAssets(checkout, manifest,
        { tracked: trackedClientPaths(checkout) });
    } else {
      const packageRoot = realpathSync(args.package);
      if (within(normalize(packageRoot), production)) throw new Error('production_source_forbidden');
      result = args.mode === 'materialize'
        ? materializePackage(packageRoot, checkout, manifest, tree, lock,
          trackedClientPaths(checkout))
        : validatePackage(packageRoot, manifest, tree, lock);
    }
    console.log(JSON.stringify({ mode: args.mode, manifest_asset_count: manifest.asset_count,
      package_tree_sha256: tree, ...result }));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
