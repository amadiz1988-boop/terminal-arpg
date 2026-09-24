import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { packageDigest, validateManifest, validatePackage } from './materialize-web-runtime-assets.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputHead = '6aab887d2938f1fc59005d2478dfed58e04e7b1e';
const manifestPath = resolve('docs/project-control/web-runtime-assets-manifest-v1.json');
const lockPath = resolve('docs/project-control/web-runtime-asset-package-lock-v1.json');
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--source-root' || args[2] !== '--client-root' ||
    args[4] !== '--package')
  throw new Error('usage: --source-root DIR --client-root DIR --package NEW_DIR');
const source = resolve(args[1]);
const client = resolve(args[3]);
const destination = resolve(args[5]);
const production = resolve('C:/Users/Administrator/ghost-island-production/ro-stack').toLowerCase();
const publicRepo = resolve('.').toLowerCase();
const inside = (candidate, root) => candidate === root || candidate.startsWith(root + sep);
if (inside(source.toLowerCase(), production) ||
    inside(destination.toLowerCase(), production) ||
    inside(destination.toLowerCase(), publicRepo) ||
    inside(destination.toLowerCase(), source.toLowerCase()) ||
    existsSync(destination))
  throw new Error('unsafe_or_existing_package_path');

const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const tree = validateManifest(manifest);
const hashFile = (file) => new Promise((done, fail) => {
  const digest = createHash('sha256');
  const stream = createReadStream(file);
  stream.on('data', (chunk) => digest.update(chunk));
  stream.on('error', fail);
  stream.on('end', () => done(digest.digest('hex')));
});
if (await hashFile(join(client, 'Ragnarok.exe')) !== manifest.client_snapshot.executable_sha256)
  throw new Error('client_snapshot_executable_hash_mismatch');
for (const archive of manifest.client_snapshot.archives) {
  if (await hashFile(join(client, archive.name)) !== archive.sha256)
    throw new Error(`client_snapshot_archive_hash_mismatch:${archive.name}`);
}
const sourceKinds = { source_root: 0, git_blob_recovery: 0 };
const provenance = {
  schema_version: 1,
  package_id: 'ghost-island-web-runtime-assets-v1',
  source_root: source,
  authorized_client_root: client,
  git_blob_repository: resolve('.'),
  client_snapshot: manifest.client_snapshot,
  source_rule: 'exact SHA-256 match for each file; missing files recovered only by recorded Git blob ID',
  git_blob_recovery: [],
};
mkdirSync(destination, { recursive: false });
for (const asset of manifest.assets) {
  const sourcePath = join(source, ...asset.relative_path.split('/'));
  let bytes;
  if (existsSync(sourcePath)) {
    bytes = readFileSync(sourcePath);
    sourceKinds.source_root += 1;
  } else if (asset.source_provenance?.kind === 'EXACT_HISTORICAL_GIT_BLOB' &&
      /^[0-9a-f]{40}$/.test(asset.source_provenance.blob_sha1 ?? '')) {
    bytes = execFileSync('git', ['cat-file', 'blob', asset.source_provenance.blob_sha1],
      { cwd: process.cwd(), maxBuffer: Math.max(asset.size + 1024, 1024 * 1024) });
    sourceKinds.git_blob_recovery += 1;
    provenance.git_blob_recovery.push({ relative_path: asset.relative_path,
      blob_sha1: asset.source_provenance.blob_sha1 });
  } else {
    throw new Error(`source_missing:${asset.relative_path}`);
  }
  if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256)
    throw new Error(`source_hash_mismatch:${asset.relative_path}`);
  if (asset.relative_path.startsWith('public/ro/client/bgm/')) {
    const clientBytes = readFileSync(join(client, 'BGM', asset.relative_path.split('/').at(-1)));
    if (sha256(clientBytes) !== asset.sha256)
      throw new Error(`authorized_client_bgm_hash_mismatch:${asset.relative_path}`);
  }
  const target = join(destination, 'assets', ...asset.relative_path.split('/'));
  mkdirSync(dirname(target), { recursive: true });
  if (sourceKinds.git_blob_recovery > provenance.git_blob_recovery.length)
    throw new Error('invalid_recovery_count');
  if (existsSync(sourcePath)) copyFileSync(sourcePath, target);
  else writeFileSync(target, bytes);
}
provenance.source_counts = sourceKinds;
writeFileSync(join(destination, 'manifest.json'), manifestBytes);
writeFileSync(join(destination, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
const lock = {
  schema_version: 1,
  package_id: provenance.package_id,
  package_version: '1.0.0',
  asset_count: manifest.asset_count,
  manifest_sha256: sha256(manifestBytes),
  created_from_web_head: inputHead,
};
writeFileSync(join(destination, 'asset-package.json'), `${JSON.stringify({
  schema_version: 1,
  source_authority: 'PRIVATE_CANONICAL_ASSET_PACKAGE',
  ...lock,
  asset_tree_sha256: tree,
  approval_reference: 'WEB_RUNTIME_PRIVATE_ASSET_PACKAGE_BOOTSTRAP_V1',
}, null, 2)}\n`);
lock.package_sha256 = packageDigest(destination, tree);
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
const result = validatePackage(destination, manifest, tree, lock);
if (!result.ok) throw new Error(JSON.stringify(result));
console.log(JSON.stringify({ package: destination, ...lock,
  asset_tree_sha256: tree, source_counts: sourceKinds, verification: result }));
