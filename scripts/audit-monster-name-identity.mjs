import fs from 'node:fs';
import path from 'node:path';
import {
  getRoAssetIndexSnapshot,
  resolveMonsterDisplayName,
} from '../ops/ro-stack/ro-asset-resolver.mjs';
import { parseMobDbNames } from '../.agents/skills/ro-asset-index/scripts/normalize-monster-names.mjs';

const han = /[\u3400-\u9fff]/u;
const root = process.cwd();
const mobDbPath =
  process.env.RO_MOB_DB_PATH ??
  path.join(root, '.local', 'ro-stack', 'rathena', 'db', 're', 'mob_db.yml');
const instancesRoot = path.join(root, '.local', 'ro-stack', 'instances');

const mobDb = fs.existsSync(mobDbPath)
  ? parseMobDbNames(fs.readFileSync(mobDbPath, 'utf8'))
  : new Map();
const byName = new Map();
for (const entry of mobDb.values()) {
  if (!byName.has(entry.name)) byName.set(entry.name, entry);
}
const namesTw =
  JSON.parse(
    fs.readFileSync(path.join(root, 'public', 'ro', 'data', 'monster-names-tw.json'), 'utf8'),
  ).names ?? {};

const observed = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.out.log')) {
      const text = fs.readFileSync(full, 'utf8');
      for (const line of text.split(/\r?\n/u)) {
        const match = line.match(/Monster ([A-Za-z][A-Za-z'’. -]*?) \(\d+\)/u);
        if (match) observed.add(match[1].trim());
      }
    }
  }
}
if (fs.existsSync(instancesRoot)) walk(instancesRoot);

const audit = {
  KNOWN_MONSTERS_CHECKED: 0,
  ZHTW_RESOLVED: 0,
  ENGLISH_FALLBACK_WITH_ZHTW_AVAILABLE: 0,
  TRUE_CANONICAL_NAME_GAPS: 0,
};
const fallbackWithZh = [];
const trueGaps = [];
for (const name of [...observed].sort()) {
  audit.KNOWN_MONSTERS_CHECKED += 1;
  const resolved = resolveMonsterDisplayName(name);
  if (han.test(resolved ?? '')) {
    audit.ZHTW_RESOLVED += 1;
    continue;
  }
  const rathena = byName.get(name);
  const zh = rathena ? namesTw[rathena.aegisName] : null;
  if (han.test(zh ?? '')) {
    audit.ENGLISH_FALLBACK_WITH_ZHTW_AVAILABLE += 1;
    fallbackWithZh.push({ name, aegisName: rathena.aegisName, zh });
  } else {
    audit.TRUE_CANONICAL_NAME_GAPS += 1;
    trueGaps.push(name);
  }
}

const entries = getRoAssetIndexSnapshot().indexes.monsters ?? [];
let indexAliasCoverageMissing = 0;
for (const entry of entries) {
  const rathena = mobDb.get(Number(entry.mobId));
  if (!rathena) continue;
  const aliases = new Set([entry.enName, ...(entry.aliases ?? [])]);
  if (!aliases.has(rathena.name)) indexAliasCoverageMissing += 1;
}

console.log(
  JSON.stringify(
    {
      result: 'MONSTER_NAME_IDENTITY_AUDIT',
      INDEX_ENTRIES: entries.length,
      INDEX_ALIAS_COVERAGE_MISSING: indexAliasCoverageMissing,
      MONSTER_NAMES_TW_ENTRIES: Object.keys(namesTw).length,
      ...audit,
      fallbackWithZh,
      trueGaps,
    },
    null,
    2,
  ),
);
