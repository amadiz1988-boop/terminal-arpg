import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceKeys = ['src', 'backSrc', 'frontSrc'];
const manifestRelativePath = ['public', 'ro', 'client', 'showcase', 'manifest.json'];

function previousBuildEpoch(repositoryRoot, manifest) {
  if (Number.isInteger(manifest?.assetVersioning?.buildEpoch))
    return manifest.assetVersioning.buildEpoch;
  // The in-memory manifest may be freshly assembled (for example a showcase
  // rebuild that keeps the existing equipment section), so the persisted
  // manifest is the authoritative source for the previous epoch.
  const path = join(repositoryRoot, ...manifestRelativePath);
  if (!existsSync(path)) return 0;
  try {
    const previous = JSON.parse(readFileSync(path, 'utf8'));
    return Number.isInteger(previous?.assetVersioning?.buildEpoch)
      ? previous.assetVersioning.buildEpoch
      : 0;
  } catch {
    return 0;
  }
}

export function stampShowcaseAssetHashes(manifest, repositoryRoot) {
  const hashes = new Map();
  let references = 0;

  function hashSource(source) {
    const pathname = String(source).split('?', 1)[0];
    if (!pathname.startsWith('/ro/client/showcase/')) return null;
    if (hashes.has(pathname)) return hashes.get(pathname);
    const diskPath = join(repositoryRoot, 'public', pathname.replace(/^\//, ''));
    if (!existsSync(diskPath)) throw new Error(`Showcase asset is missing: ${pathname}`);
    const digest = createHash('sha256').update(readFileSync(diskPath)).digest('hex');
    hashes.set(pathname, digest);
    return digest;
  }

  // Cache invalidation must survive a content regression. A pure content hash
  // cannot: if an asset is ever served with bytes that do not match its
  // declared hash, browsers and CDNs cache those bytes under a URL that never
  // changes afterwards, even once the correct bytes are restored. Bumping a
  // persisted build epoch on every stamping pass guarantees each build emits
  // new URLs, so stale edge/browser entries can never be reused.
  const buildEpoch = previousBuildEpoch(repositoryRoot, manifest) + 1;

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const key of sourceKeys) {
      if (typeof value[key] !== 'string') continue;
      const digest = hashSource(value[key]);
      if (!digest) continue;
      const pathname = value[key].split('?', 1)[0];
      value[key] = `${pathname}?v=${digest.slice(0, 16)}&b=${buildEpoch}`;
      delete value[`${key}Sha256`];
      references += 1;
    }
    for (const child of Object.values(value)) visit(child);
  }

  visit(manifest);
  manifest.assetVersioning = {
    strategy: 'per-file-sha256-query',
    hashPrefixLength: 16,
    buildEpoch,
    uniqueAssets: hashes.size,
    references,
  };
  return manifest.assetVersioning;
}
