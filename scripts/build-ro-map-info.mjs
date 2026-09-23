import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { parseTwroMapNames } from './ro-map-name-normalize.mjs';
import { parseYamlRecords, rathenaFarmMonsterFlags } from './lib/ro-yaml-records.mjs';
import sharp from 'sharp';

const root = process.cwd();
const rathena = join(root, '.local', 'ro-stack', 'rathena');
const openkore = join(root, '.local', 'ro-stack', 'openkore');
const mapRoot = join(root, 'public', 'ro', 'maps');
const outputRoot = join(root, 'public', 'ro', 'data');
const detailRoot = join(outputRoot, 'map-info');
const standardFarmMapRegistryPath = join(
  root,
  'ops',
  'ro-stack',
  'persistent-agent',
  'standard-farm-map-release-registry.json',
);
const worldPositionPath = join(
  root,
  'public',
  'ro',
  'client',
  'world-map',
  'positions.json',
);
const monsterNamePath = join(outputRoot, 'monster-names-tw.json');
const preferredMapNames = {
  prt_fild08: '普隆德拉原野 08',
  moc_fild11: '蘇克拉特沙漠 11',
  moc_fild20: '蘇克拉特沙漠次元裂縫',
  pay_dun00: '斐揚洞穴 1樓',
  pay_dun01: '斐揚洞穴 2樓',
  pay_dun02: '斐揚洞穴 3樓',
  pay_dun03: '斐揚洞穴 4樓',
  pay_dun04: '斐揚洞穴 5樓',
  moc_pryd01: '夢羅克金字塔 1樓',
  moc_pryd02: '夢羅克金字塔 2樓',
  moc_pryd03: '夢羅克金字塔 3樓',
  moc_pryd04: '夢羅克金字塔 4樓',
  moc_pryd05: '夢羅克金字塔 地下1樓',
  moc_pryd06: '夢羅克金字塔 地下2樓',
  iz_dun00: '海底洞穴 1樓',
  iz_dun01: '海底洞穴 2樓',
  iz_dun02: '海底洞穴 3樓',
  iz_dun03: '海底洞穴 4樓',
  iz_dun04: '海底洞穴 5樓',
  iz_dun05: '海底洞穴 6樓',
};
const dungeonGroups = [
  {
    id: 'undersea_tunnel',
    name: '海底洞穴',
    entranceMapId: 'iz_dun00',
    floors: [
      'iz_dun00',
      'iz_dun01',
      'iz_dun02',
      'iz_dun03',
      'iz_dun04',
      'iz_dun05',
    ],
  },
  {
    id: 'payon_cave',
    name: '斐揚洞穴',
    entranceMapId: 'pay_dun00',
    floors: ['pay_dun00', 'pay_dun01', 'pay_dun02', 'pay_dun03', 'pay_dun04'],
  },
  {
    id: 'morocc_pyramid',
    name: '夢羅克金字塔',
    entranceMapId: 'moc_pryd01',
    floors: [
      'moc_pryd01',
      'moc_pryd02',
      'moc_pryd03',
      'moc_pryd04',
      'moc_pryd05',
      'moc_pryd06',
    ],
  },
];
const dungeonFloorByMap = new Map(
  dungeonGroups.flatMap((dungeon) =>
    dungeon.floors.map((mapId, index) => [
      mapId,
      {
        id: dungeon.id,
        name: dungeon.name,
        entranceMapId: dungeon.entranceMapId,
        floorLabel: preferredMapNames[mapId].replace(`${dungeon.name} `, ''),
        order: index + 1,
      },
    ]),
  ),
);
const standardFarmMapRegistry = JSON.parse(
  await readFile(standardFarmMapRegistryPath, 'utf8'),
);
const standardFarmMapById = new Map(
  (standardFarmMapRegistry.maps ?? []).map((row) => [row.map, row]),
);
const releasedStandardFarmMapIds = (standardFarmMapRegistry.maps ?? [])
  .filter((row) => row.farmSelectionAvailable === true)
  .map((row) => row.map);
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
const officialMonsterNames = new Map(
  Object.entries(JSON.parse(await readFile(monsterNamePath, 'utf8')).names ?? {}),
);
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

function localizedEntityName(value, kind, id) {
  return /\p{Script=Han}/u.test(value ?? '') ? value : `${kind} #${id}`;
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

const previouslyIndexedMaps = [
  ...(await readdir(mapRoot))
    .filter((name) => name.endsWith('.fld2.gz'))
    .map((name) => name.slice(0, -'.fld2.gz'.length)),
  // Current runtime maps may use terrain fallbacks while still exposing spawn data.
  'moc_fild11',
  'moc_fild20',
  ...dungeonGroups.flatMap((dungeon) => dungeon.floors),
  ...releasedStandardFarmMapIds,
].filter((mapId, index, maps) => maps.indexOf(mapId) === index).sort();
const previouslyIndexedMapSet = new Set(previouslyIndexedMaps);
const publicMaps = [...new Set([
  ...previouslyIndexedMaps,
  ...JSON.parse(await readFile(worldPositionPath, 'utf8')).maps.map((position) => position.mapId),
])].sort();
const publicMapSet = new Set(publicMaps);
const [
  mobText,
  twNameText,
  twDescriptionText,
  twMapText,
  worldPositionText,
  scriptPaths,
] =
  await Promise.all([
    readFile(join(rathena, 'db', 're', 'mob_db.yml'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'items.txt'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'itemsdescriptions.txt'), 'utf8'),
    readFile(join(openkore, 'tables', 'twRO', 'maps.txt'), 'utf8'),
    readFile(worldPositionPath, 'utf8'),
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
const twMapNames = parseTwroMapNames(twMapText);
const worldPositionData = JSON.parse(worldPositionText);
const townFlagMaps = new Set((await Promise.all([
  'npc/mapflag/town.txt', 'npc/re/mapflag/town.txt',
].map((path) => readFile(join(rathena, path), 'utf8').catch(() => ''))))
  .flatMap((text) => [...text.matchAll(/^([a-z0-9_]+)\s+mapflag\s+town(?:\s|$)/gm)]
    .map((match) => match[1])));
const worldImage = await sharp(join(root, 'public/ro/client/world-map/world-map.webp'))
  .raw().toBuffer({ resolveWithObject: true });
function redLabelRatio(position) {
  const { data, info } = worldImage;
  let red = 0;
  let pixels = 0;
  for (let y = position.y1; y < position.y2; y += 1)
    for (let x = position.x1; x < position.x2; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset] > 160 && data[offset] > data[offset + 1] * 1.7 &&
          data[offset] > data[offset + 2] * 1.7) red += 1;
      pixels += 1;
    }
  return pixels ? red / pixels : 0;
}
const worldPositions = new Map(
  worldPositionData.maps.map((position) => [position.mapId, position]),
);
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
  const { isMvp, isBoss, isResource } = rathenaFarmMonsterFlags(mob);
  return {
    id: mobId,
    aegisName: mob.AegisName,
    name: localizedEntityName(
      monsterNames[mobId] ?? officialMonsterNames.get(mob.AegisName) ?? mob.Name,
      '怪物',
      mobId,
    ),
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
    isBoss,
    isMvp,
    isResource,
    sourceFiles: [...spawn.sources].sort(),
    drops: mob.Drops.map((drop) => {
      const item = itemByAegis.get(drop.Item);
      if (!item) throw new Error(`找不到道具 ${drop.Item}`);
      return {
        itemId: item.Id,
        aegisName: drop.Item,
        name: localizedEntityName(twNames.get(item.Id) ?? item.Name, '道具', item.Id),
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
  generatedAt: null,
  sources: {
    ruleset: 'Renewal',
    locale: 'zh-Hant',
    scripts: 'active npc/re/scripts_main.conf imports',
    worldMap:
      'authorized Gravity data.grf worldviewdata_table.lub coordinates',
  },
  worldMap: {
    image: '/ro/client/world-map/world-map.webp',
    width: worldPositionData.canvas.width,
    height: worldPositionData.canvas.height,
  },
  maps: {},
};
for (const mapId of publicMaps) {
  const monsters = [...spawnsByMap.get(mapId).entries()]
    .map(([mobId, spawn]) => monsterRecord(mobId, spawn))
    .sort((a, b) => a.level - b.level || a.id - b.id);
  const normalMonsters = monsters.filter((monster) => !monster.isBoss);
  const combatMonsters = normalMonsters.filter((monster) => !monster.isResource);
  const resourceMonsters = normalMonsters.filter((monster) => monster.isResource);
  const bossMonsters = monsters.filter((monster) => monster.isBoss);
  const combatLevels = combatMonsters
    .map((monster) => monster.level)
    .filter((level) => level > 0);
  const fullLevelRange = combatLevels.length
    ? { min: Math.min(...combatLevels), max: Math.max(...combatLevels) }
    : null;
  const combatSpawnCount = combatMonsters.reduce(
    (sum, monster) => sum + monster.count,
    0,
  );
  const representativeMinimum = Math.max(2, Math.ceil(combatSpawnCount * 0.1));
  const representativeMonsters = combatMonsters.filter(
    (monster) => monster.count >= representativeMinimum,
  );
  const rangeMonsters = representativeMonsters.length
    ? representativeMonsters
    : combatMonsters;
  const representativeLevels = rangeMonsters
    .map((monster) => monster.level)
    .filter((level) => level > 0);
  const levelRange = representativeLevels.length
    ? {
        min: Math.min(...representativeLevels),
        max: Math.max(...representativeLevels),
      }
    : null;
  const primaryMonsters = [...rangeMonsters]
    .sort((a, b) => b.count - a.count || a.level - b.level || a.id - b.id)
    .slice(0, 5)
    .map(({ id, name, level, count }) => ({ id, name, level, count }));
  const detail = {
    id: mapId,
    name: displayMapName(mapId),
    category: standardFarmMapById.get(mapId)?.sourceCategory ?? null,
    dungeon: dungeonFloorByMap.get(mapId) ?? null,
    totalMonsters: monsters.reduce((sum, monster) => sum + monster.count, 0),
    normalMonsterCount: normalMonsters.reduce(
      (sum, monster) => sum + monster.count,
      0,
    ),
    levelRange,
    fullLevelRange,
    levelRangeRule:
      '排除資源型與 Boss/MVP，再採出生數至少占可戰鬥普通怪 10% 的代表怪物',
    primaryMonsters,
    resourceMonsters: resourceMonsters.map(({ id, name, level, count }) => ({
      id,
      name,
      level,
      count,
    })),
    bossMonsters: bossMonsters.map(({ id, name, level, count, isMvp }) => ({
      id,
      name,
      level,
      count,
      isMvp,
    })),
    monsters,
  };
  const detailPath = `/ro/data/map-info/${mapId}.json`;
  const availability = standardFarmMapById.get(mapId) ?? null;
  const availableForAfk = availability
    ? availability.farmSelectionAvailable === true
    : combatMonsters.length > 0 && worldPositions.has(mapId);
  index.maps[mapId] = {
    id: detail.id,
    name: detail.name,
    totalMonsters: detail.totalMonsters,
    monsterTypes: detail.monsters.length,
    normalMonsterCount: detail.normalMonsterCount,
    normalMonsterTypes: normalMonsters.length,
    combatMonsterCount: combatSpawnCount,
    combatMonsterTypes: combatMonsters.length,
    resourceMonsterCount: resourceMonsters.reduce(
      (sum, monster) => sum + monster.count,
      0,
    ),
    levelRange,
    fullLevelRange,
    primaryMonsters,
    bossCount: bossMonsters.reduce((sum, monster) => sum + monster.count, 0),
    bossTypes: bossMonsters.length,
    hasMvp: bossMonsters.some((monster) => monster.isMvp),
    dungeon: detail.dungeon,
    category: detail.category,
    farmSelectionAvailable: availability?.farmSelectionAvailable === true,
    availabilityReason: availability?.availabilityReason ?? null,
    routeClass: availability?.routeClass ?? null,
    availableForAfk,
    unlocked: availableForAfk,
    selectable: availableForAfk,
    grindable: availableForAfk,
    worldPosition: worldPositions.get(mapId) ?? null,
    detail: detailPath,
    reviewedDetail: previouslyIndexedMapSet.has(mapId),
  };
  await writeFile(
    join(detailRoot, `${mapId}.json`),
    `${JSON.stringify(detail, null, 2)}\n`,
  );
}
const worldRegionGroups = new Map();
for (const position of worldPositionData.maps) {
  const key = [position.x1, position.y1, position.x2, position.y2].join(':');
  const group = worldRegionGroups.get(key) ?? {
    position: {
      x1: position.x1,
      y1: position.y1,
      x2: position.x2,
      y2: position.y2,
    },
    mapIds: new Set(),
  };
  group.mapIds.add(position.mapId);
  worldRegionGroups.set(key, group);
}
index.worldMap.regions = [...worldRegionGroups.values()]
  .sort(
    (a, b) =>
      a.position.y1 - b.position.y1 ||
      a.position.x1 - b.position.x1 ||
      a.position.y2 - b.position.y2 ||
      a.position.x2 - b.position.x2,
  )
  .map((group, regionIndex) => {
    const mapIds = [...group.mapIds];
    const availableMapIds = mapIds
      .filter((mapId) => index.maps[mapId]?.availableForAfk)
      .sort(
        (a, b) =>
          (index.maps[a]?.dungeon?.order ?? Number.MAX_SAFE_INTEGER) -
            (index.maps[b]?.dungeon?.order ?? Number.MAX_SAFE_INTEGER) ||
          a.localeCompare(b),
      );
    const availableMapId = availableMapIds[0];
    const mapId =
      availableMapId ??
      mapIds.find((candidate) => index.maps[candidate]) ??
      mapIds[0];
    const map = index.maps[mapId];
    const availableForAfk = Boolean(availableMapId);
    return {
      regionId: `region-${regionIndex + 1}`,
      labelKind: redLabelRatio(group.position) >= 0.3 ? 'red'
        : mapIds.some((id) => townFlagMaps.has(id)) ? 'town' : 'normal',
      mapId,
      mapIds,
      availableMapIds,
      name: map?.name ?? displayMapName(mapId),
      position: group.position,
      levelRange: map?.levelRange ?? null,
      availableForAfk,
      unlocked: availableForAfk,
      selectable: availableForAfk,
      unlockCondition: availableForAfk
        ? null
        : '尚未列入目前可掛機地圖',
    };
  });
await writeFile(
  join(outputRoot, 'map-info.json'),
  `${JSON.stringify(index, null, 2)}\n`,
);
console.log(
  `RO_MAP_INFO_BUILT maps=${publicMaps.length} monsters=${Object.values(index.maps).reduce((sum, map) => sum + map.totalMonsters, 0)}`,
);
await import('./sync-map-info-world-map.mjs');
