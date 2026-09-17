import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceKeys = ['src', 'backSrc', 'frontSrc'];

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
      value[key] = `${pathname}?v=${digest.slice(0, 16)}`;
      delete value[`${key}Sha256`];
      references += 1;
    }
    for (const child of Object.values(value)) visit(child);
  }

  visit(manifest);
  manifest.assetVersioning = {
    strategy: 'per-file-sha256-query',
    hashPrefixLength: 16,
    uniqueAssets: hashes.size,
    references,
  };
  return manifest.assetVersioning;
}
