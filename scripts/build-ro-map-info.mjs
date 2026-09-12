import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = process.cwd();
const rathena = join(root, '.local', 'ro-stack', 'rathena');
const openkore = join(root, '.local', 'ro-stack', 'openkore');
const mapRoot = join(root, 'public', 'ro', 'maps');
const outputRoot = join(root, 'public', 'ro', 'data');
const detailRoot = join(outputRoot, 'map-info');
const preferredMapNames = {
  prt_fild08: '普隆德拉原野 08',
  moc_fild11: '蘇克拉特沙漠 11',
  pay_dun00: '斐揚洞穴 1樓',
};
const monsterNames = {
  1001: '蠍子',
  1002: '波利',
  1005: '吸血蝙蝠',
  1007: '綠棉蟲',
  1008: '蛹',
  1009: '禿鷹',
  1015: '殭屍',
  1031: '波波利',
  1063: '瘋兔',
  1076: '骷髏',
  1078: '紅色植物',
  1084: '黑菇',
  1107: '沙漠幼狼',
  2398: '小波利',
};
const elementNames = {
  Neutral: '無', Water: '水', Earth: '地', Fire: '火', Wind: '風',
  Poison: '毒', Holy: '聖', Dark: '暗', Ghost: '念', Undead: '不死',
};
const raceNames = {
  Formless: '無形', Undead: '不死', Brute: '動物', Plant: '植物',
  Insect: '昆蟲', Fish: '魚貝', Demon: '惡魔', DemiHuman: '人形',
  Angel: '天使', Dragon: '龍族',
};
const sizeNames = { Small: '小型', Medium: '中型', Large: '大型' };
const typeNames = {
  Healing: '恢復道具', Usable: '消耗品', Etc: '其他', Weapon: '武器',
  Armor: '防具', Card: '卡片', PetEgg: '寵物蛋', PetArmor: '寵物裝備',
  Ammo: '彈藥', DelayConsume: '延遲消耗品', Cash: '商城道具',
};

function parseYamlRecords(text, includeDrops = false) {
  const records = [];
  let record = null;
  let drop = null;
  for (const raw of text.split(/\r?\n/)) {
    let match = raw.match(/^  - Id: (\d+)\s*$/);
    if (match) {
      record = { Id: Number(match[1]), Drops: [] };
      records.push(record);
      drop = null;
      continue;
    }
    if (!record || /^\s*#/.test(raw)) continue;
    match = raw.match(/^    ([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/);
    if (match) {
      if (match[1] === 'Drops') {
        drop = null;
        continue;
      }
      record[match[1]] = /^\d+$/.test(match[2]) ? Number(match[2]) : match[2];
      drop = null;
      continue;
    }
    if (!includeDrops) continue;
    match = raw.match(/^      - Item:\s*(\S+)\s*$/);
    if (match) {
      drop = { Item: match[1] };
      record.Drops.push(drop);
      continue;
    }
    match = raw.match(/^        Rate:\s*(\d+)\s*$/);
    if (match && drop) drop.Rate = Number(match[1]);
  }
  return records;
}

function parseHashTable(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(\d+)#(.*?)#\s*$/);
    if (match) values.set(Number(match[1]), match[2]);
  }
  return values;
}

function parseTwDescriptions(text) {
  const descriptions = new Map();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\d+)#\s*$/);
    if (!match) continue;
    const body = [];
    for (index += 1; index < lines.length && lines[index] !== '#'; index += 1)
      body.push(lines[index]);
    const cleaned = body
      .join('\n')
      .replace(/\^[0-9a-fA-F]{6}/g, '')
      .replace(/^_$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (cleaned) descriptions.set(Number(match[1]), cleaned);
  }
  return descriptions;
}

function parseMapNames(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^.#]+)\.rsw#(.*?)#/);
    if (match && !values.has(match[1])) values.set(match[1], match[2].trim());
  }
  return values;
}

async function activeRenewalScripts() {
  const scripts = new Set();
  const visited = new Set();
  async function visit(relativePath) {
    const normalized = relativePath.replaceAll('\\', '/');
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const text = await readFile(join(rathena, ...normalized.split('/')), 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      const match = line.match(/^(?:npc|import):\s*(\S+)/);
      if (!match) continue;
      const target = match[1].replaceAll('\\', '/');
      if (extname(target) === '.conf') await visit(target);
      else if (extname(target) === '.txt') scripts.add(target);
    }
  }
  await visit('npc/re/scripts_main.conf');
  return [...scripts];
}

const publicMaps = [
  ...(await readdir(mapRoot))
    .filter((name) => name.endsWith('.fld2.gz'))
    .map((name) => name.slice(0, -'.fld2.gz'.length)),
  // Current Eden equipment routes use runtime terrain fallbacks for these maps.
  'moc_fild11',
  'pay_dun00',
].filter((mapId, index, maps) => maps.indexOf(mapId) === index).sort();
const publicMapSet = new Set(publicMaps);
const [mobText, twNameText, twDescriptionText, twMapText, scriptPaths] =
  await Promise.all([
    readFile(join(rathena, 'db', 're', 'mob_db.yml'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'items.txt'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'itemsdescriptions.txt'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'maps.txt'), 'utf8'),
    activeRenewalScripts(),
  ]);
const [itemTexts, scriptTexts] = await Promise.all([
  Promise.all(
    ['item_db_equip.yml', 'item_db_etc.yml', 'item_db_usable.yml'].map((name) =>
      readFile(join(rathena, 'db', 're', name), 'utf8'),
    ),
  ),
  Promise.all(
    scriptPaths.map(async (path) => [
      path,
      await readFile(join(rathena, ...path.split('/')), 'utf8'),
    ]),
  ),
]);
const mobById = new Map(parseYamlRecords(mobText, true).map((mob) => [mob.Id, mob]));
const items = itemTexts.flatMap((text) => parseYamlRecords(text));
const itemByAegis = new Map(items.map((item) => [item.AegisName, item]));
const twNames = parseHashTable(twNameText);
const twDescriptions = parseTwDescriptions(twDescriptionText);
const twMapNames = parseMapNames(twMapText);
const spawnsByMap = new Map(publicMaps.map((mapId) => [mapId, new Map()]));

for (const [sourcePath, text] of scriptTexts) {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^([^,\s]+),[^\t]*\tmonster\t[^\t]+\t(\d+),(\d+)(?:,(\d+))?(?:,(\d+))?/,
    );
    if (!match || !publicMapSet.has(match[1])) continue;
    const mapSpawns = spawnsByMap.get(match[1]);
    const mobId = Number(match[2]);
    const entry = mapSpawns.get(mobId) ?? {
      count: 0,
      delays: [],
      sources: new Set(),
    };
    entry.count += Number(match[3]);
    entry.delays.push(Number(match[4] ?? 0), Number(match[5] ?? match[4] ?? 0));
    entry.sources.add(sourcePath);
    mapSpawns.set(mobId, entry);
  }
}

function displayMapName(mapId) {
  const base = mapId
    .replace(/_[a-d]$/, '')
    .replace(/0[1-4]$/, '');
  return (
    preferredMapNames[mapId] ??
    twMapNames.get(mapId) ??
    twMapNames.get(base) ??
    mapId
  );
}

function monsterRecord(mobId, spawn) {
  const mob = mobById.get(mobId);
  if (!mob) throw new Error(`找不到怪物 ${mobId}`);
  return {
    id: mobId,
    aegisName: mob.AegisName,
    name: monsterNames[mobId] ?? mob.Name,
    count: spawn.count,
    respawnMinMs: Math.min(...spawn.delays),
    respawnMaxMs: Math.max(...spawn.delays),
    level: Number(mob.Level ?? 0),
    hp: Number(mob.Hp ?? 0),
    baseExp: Number(mob.BaseExp ?? 0),
    jobExp: Number(mob.JobExp ?? 0),
    attackMin: Number(mob.Attack ?? 0),
    attackMax: Number(mob.Attack2 ?? mob.Attack ?? 0),
    defense: mob.Defense ?? 0,
    magicDefense: mob.MagicDefense ?? 0,
    size: sizeNames[mob.Size] ?? mob.Size,
    race: raceNames[mob.Race] ?? mob.Race,
    element: `${elementNames[mob.Element] ?? mob.Element} ${mob.ElementLevel ?? 1}`,
    sourceFiles: [...spawn.sources].sort(),
    drops: mob.Drops.map((drop) => {
      const item = itemByAegis.get(drop.Item);
      if (!item) throw new Error(`找不到道具 ${drop.Item}`);
      return {
        itemId: item.Id,
        aegisName: drop.Item,
        name: twNames.get(item.Id) ?? item.Name,
        ratePerTenThousand: drop.Rate,
        type: typeNames[item.Type] ?? item.Type ?? '其他',
        weight: Number(item.Weight ?? 0) / 10,
        attack: Number(item.Attack ?? 0),
        defense: Number(item.Defense ?? 0),
        slots: Number(item.Slots ?? 0),
        description: twDescriptions.get(item.Id) ?? '本地化說明資料未收錄。',
      };
    }),
  };
}

await mkdir(detailRoot, { recursive: true });
const index = {
  generatedAt: new Date().toISOString(),
  sources: {
    ruleset: 'Renewal',
    locale: 'zh-Hant',
    scripts: 'active npc/re/scripts_main.conf imports',
  },
  maps: {},
};
for (const mapId of publicMaps) {
  const monsters = [...spawnsByMap.get(mapId).entries()]
    .map(([mobId, spawn]) => monsterRecord(mobId, spawn))
    .sort((a, b) => a.level - b.level || a.id - b.id);
  const detail = {
    id: mapId,
    name: displayMapName(mapId),
    totalMonsters: monsters.reduce((sum, monster) => sum + monster.count, 0),
    monsters,
  };
  const detailPath = `/ro/data/map-info/${mapId}.json`;
  index.maps[mapId] = {
    id: detail.id,
    name: detail.name,
    totalMonsters: detail.totalMonsters,
    monsterTypes: detail.monsters.length,
    detail: detailPath,
  };
  await writeFile(
    join(detailRoot, `${mapId}.json`),
    `${JSON.stringify(detail, null, 2)}\n`,
  );
}
await writeFile(
  join(outputRoot, 'map-info.json'),
  `${JSON.stringify(index, null, 2)}\n`,
);
console.log(
  `RO_MAP_INFO_BUILT maps=${publicMaps.length} monsters=${Object.values(index.maps).reduce((sum, map) => sum + map.totalMonsters, 0)}`,
);
