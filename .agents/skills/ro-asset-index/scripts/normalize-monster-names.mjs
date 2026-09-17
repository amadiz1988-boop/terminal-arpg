import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseMobDbNames(yamlText) {
  const byId = new Map();
  const blockRe =
    /-\s*Id:\s*(\d+)\s*\r?\n\s*AegisName:\s*(\S+)\s*\r?\n\s*Name:\s*(.+?)\r?\n/gu;
  let match;
  while ((match = blockRe.exec(yamlText))) {
    byId.set(Number(match[1]), {
      aegisName: match[2],
      name: match[3].trim(),
    });
  }
  return byId;
}

export function normalizeMonsterNameIndex(index, byId) {
  let renamed = 0;
  let aliased = 0;
  for (const entry of index.entries ?? []) {
    const rathena = byId.get(Number(entry.mobId));
    if (!rathena?.name) continue;
    const aliases = new Set(
      [
        ...(entry.aliases ?? []),
        entry.enName,
        entry.aegisName,
        entry.internalName,
        entry.zhHantName,
        entry.canonicalZhHant,
        rathena.name,
        rathena.aegisName,
      ].filter(Boolean),
    );
    if (entry.enName !== rathena.name) {
      entry.enName = rathena.name;
      renamed += 1;
    }
    if (aliases.size !== (entry.aliases ?? []).length) {
      entry.aliases = [...aliases];
      aliased += 1;
    }
  }
  return { renamed, aliased, entries: index.entries?.length ?? 0 };
}

export function expandMonsterNameIndex(index, byId, namesTw, provenance) {
  const byAegis = new Map();
  for (const [mobId, rathena] of byId) {
    if (!byAegis.has(rathena.aegisName)) byAegis.set(rathena.aegisName, { mobId, ...rathena });
  }
  const present = new Set((index.entries ?? []).map((entry) => Number(entry.mobId)));
  let added = 0;
  for (const [aegisName, zhHantName] of Object.entries(namesTw ?? {})) {
    if (!/[\u3400-\u9fff]/u.test(zhHantName ?? '')) continue;
    const rathena = byAegis.get(aegisName);
    if (!rathena || present.has(rathena.mobId)) continue;
    present.add(rathena.mobId);
    index.entries.push({
      mobId: rathena.mobId,
      aegisName,
      internalName: aegisName,
      zhHantName,
      canonicalZhHant: zhHantName,
      enName: rathena.name,
      aliases: [...new Set([rathena.name, aegisName, zhHantName].filter(Boolean))],
      translationStatus: 'verified-zh-hant',
      assetStatus: 'missing',
      verificationGrade: 'B',
      provenance,
    });
    added += 1;
  }
  index.entries.sort((a, b) => Number(a.mobId) - Number(b.mobId));
  return { added, entries: index.entries.length };
}

export function normalizeMonsterIndex(index, byId, namesTw, provenance) {
  const rename = normalizeMonsterNameIndex(index, byId);
  const expand = expandMonsterNameIndex(index, byId, namesTw, provenance);
  return { ...rename, ...expand, entries: index.entries?.length ?? 0 };
}

function main() {
  const root = process.cwd();
  const indexPath =
    process.env.RO_MONSTER_INDEX_PATH ??
    path.join(root, 'docs', 'ro-asset-index', 'monsters.json');
  const mobDbPath =
    process.env.RO_MOB_DB_PATH ??
    path.join(root, '.local', 'ro-stack', 'rathena', 'db', 're', 'mob_db.yml');
  const namesTwPath = path.join(root, 'public', 'ro', 'data', 'monster-names-tw.json');
  if (!fs.existsSync(mobDbPath)) {
    throw new Error(`missing rAthena mob_db.yml: ${mobDbPath}`);
  }
  if (!fs.existsSync(namesTwPath)) {
    throw new Error(`missing canonical monster localization: ${namesTwPath}`);
  }
  const index = JSON.parse(
    fs.readFileSync(indexPath, 'utf8').replace(/^\uFEFF/, ''),
  );
  const byId = parseMobDbNames(fs.readFileSync(mobDbPath, 'utf8'));
  const namesTw = JSON.parse(
    fs.readFileSync(namesTwPath, 'utf8').replace(/^\uFEFF/, ''),
  ).names;
  const verifiedAt = new Date().toISOString().slice(0, 10);
  const result = normalizeMonsterIndex(index, byId, namesTw, [
    {
      tier: 1,
      sourceType: 'client-navigation',
      sourcePath: 'public/ro/data/monster-names-tw.json',
      verifiedAt,
    },
    {
      tier: 2,
      sourceType: 'rathena',
      sourcePath: '.local/ro-stack/rathena/db/re/mob_db.yml',
      verifiedAt,
    },
  ]);
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        result: 'RO_MONSTER_INDEX_NORMALIZED',
        indexPath,
        mobDbEntries: byId.size,
        namesTwEntries: Object.keys(namesTw).length,
        ...result,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
