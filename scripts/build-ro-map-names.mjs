import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseTwroMapNames } from './ro-map-name-normalize.mjs';

// Deterministic build: canonical OpenKore twRO maps.txt -> web-served
// canonical map-name index. resolveMapDisplayName consumes this index, so
// player-facing navigation logs never fall back to English when canonical
// zh-TW data exists. No names are written by hand here.
const root = process.cwd();
const openkoreRoot = process.env.RO_OPENKORE_ROOT
  ? process.env.RO_OPENKORE_ROOT
  : join(root, '.local', 'ro-stack', 'openkore');
const sourcePath = process.env.RO_OPENKORE_MAPS
  ? process.env.RO_OPENKORE_MAPS
  : join(openkoreRoot, 'tables', 'twRO', 'maps.txt');
const outputPath = join(root, 'public', 'ro', 'data', 'map-names.json');

const table = parseTwroMapNames(await readFile(sourcePath, 'utf8'));
const entries = {};
for (const [mapId, name] of [...table.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!mapId || !name) continue;
  entries[mapId.toLowerCase()] = name;
}
if (Object.keys(entries).length === 0)
  throw new Error(`no canonical map names parsed from ${sourcePath}`);

const payload = {
  schemaVersion: 1,
  kind: 'map-names',
  source: {
    sourceGame: 'OpenKore',
    locale: 'zh-Hant',
    sourcePath: 'tables/twRO/maps.txt',
    normalization:
      'line = "<id>.rsw#<zh-Hant name>#"; first occurrence wins; keys lower-cased',
    generatedBy: 'scripts/build-ro-map-names.mjs',
  },
  entries,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `MAP_NAMES_BUILD_PASS entries=${Object.keys(entries).length} -> ${outputPath}`,
);
