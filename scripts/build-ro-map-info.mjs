import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const rathena = join(root, '.local', 'ro-stack', 'rathena');
const openkore = join(root, '.local', 'ro-stack', 'openkore');
const targetMap = 'prt_fild08';
const monsterNames = {
  1002: '波利',
  1007: '綠棉蟲',
  1008: '蛹',
  1063: '瘋兔',
  2398: '小波利',
};
const mapNames = { prt_fild08: '普隆德拉原野 08' };
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

function parseTwNames(text) {
  const names = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(\d+)#(.*?)#\s*$/);
    if (match) names.set(Number(match[1]), match[2]);
  }
  return names;
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

const [spawnText, mobText, twNameText, twDescriptionText] =
  await Promise.all([
    readFile(join(rathena, 'npc', 're', 'mobs', 'fields', 'prontera.txt'), 'utf8'),
    readFile(join(rathena, 'db', 're', 'mob_db.yml'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'items.txt'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'itemsdescriptions.txt'), 'utf8'),
  ]);
const itemTexts = await Promise.all(
  ['item_db_equip.yml', 'item_db_etc.yml', 'item_db_usable.yml'].map((name) =>
    readFile(join(rathena, 'db', 're', name), 'utf8'),
  ),
);
const mobById = new Map(parseYamlRecords(mobText, true).map((mob) => [mob.Id, mob]));
const items = itemTexts.flatMap((text) => parseYamlRecords(text));
const itemByAegis = new Map(items.map((item) => [item.AegisName, item]));
const twNames = parseTwNames(twNameText);
const twDescriptions = parseTwDescriptions(twDescriptionText);
const spawns = new Map();
for (const line of spawnText.split(/\r?\n/)) {
  const match = line.match(/^([^,]+),[^\t]*\tmonster\t[^\t]+\t(\d+),(\d+),(\d+)(?:,(\d+))?/);
  if (!match || match[1] !== targetMap) continue;
  const mobId = Number(match[2]);
  const entry = spawns.get(mobId) ?? { count: 0, delays: [] };
  entry.count += Number(match[3]);
  entry.delays.push(Number(match[4]), Number(match[5] ?? match[4]));
  spawns.set(mobId, entry);
}

const monsters = [...spawns.entries()].map(([mobId, spawn]) => {
  const mob = mobById.get(mobId);
  if (!mob) throw new Error(`找不到怪物 ${mobId}`);
  return {
    id: mobId,
    aegisName: mob.AegisName,
    name: monsterNames[mobId] ?? mob.Name,
    count: spawn.count,
    respawnMinMs: Math.min(...spawn.delays),
    respawnMaxMs: Math.max(...spawn.delays),
    level: mob.Level,
    hp: mob.Hp,
    baseExp: mob.BaseExp,
    jobExp: mob.JobExp,
    attackMin: mob.Attack,
    attackMax: mob.Attack2 ?? mob.Attack,
    defense: mob.Defense ?? 0,
    magicDefense: mob.MagicDefense ?? 0,
    size: sizeNames[mob.Size] ?? mob.Size,
    race: raceNames[mob.Race] ?? mob.Race,
    element: `${elementNames[mob.Element] ?? mob.Element} ${mob.ElementLevel ?? 1}`,
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
});

const output = {
  generatedAt: new Date().toISOString(),
  sources: {
    ruleset: 'Renewal',
    locale: 'zh-Hant',
  },
  maps: {
    [targetMap]: {
      id: targetMap,
      name: mapNames[targetMap],
      totalMonsters: monsters.reduce((sum, monster) => sum + monster.count, 0),
      monsters,
    },
  },
};
const outputDir = join(root, 'public', 'ro', 'data');
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'map-info.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`${targetMap}: ${output.maps[targetMap].totalMonsters} 隻，${monsters.length} 種怪物`);
