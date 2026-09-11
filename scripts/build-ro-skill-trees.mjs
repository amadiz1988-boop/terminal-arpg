import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const rathenaRoot = '.local/ro-stack/rathena';
const openkoreRoot = '.local/ro-stack/openkore';
const jobIds = {
  Novice: 0,
  Swordman: 1,
  Mage: 2,
  Archer: 3,
  Acolyte: 4,
  Merchant: 5,
  Thief: 6,
  Taekwon: 21,
  Supernovice: 23,
  Gunslinger: 24,
  Ninja: 25,
};
const jobNames = {
  Novice: '初心者',
  Swordman: '劍士',
  Mage: '魔法師',
  Archer: '弓箭手',
  Acolyte: '服事',
  Merchant: '商人',
  Thief: '盜賊',
  Taekwon: '跆拳',
  Supernovice: '超級初心者',
  Gunslinger: '神槍手',
  Ninja: '忍者',
};
const selfBuffStatuses = new Map([
  ['SM_ENDURE', 'EFST_ENDURE'],
  ['AL_ANGELUS', 'EFST_ANGELUS'],
  ['AC_CONCENTRATION', 'EFST_CONCENTRATION'],
  ['MC_LOUD', 'EFST_SHOUT'],
]);

const skillNames = new Map();
for (const line of (
  await readFile(`${openkoreRoot}/tables/twRO/skillnametable.txt`, 'utf8')
).split(/\r?\n/)) {
  const [handle, name] = line.split('#');
  if (handle && name) skillNames.set(handle, name);
}

const skillIds = new Map();
for (const line of (
  await readFile(`${openkoreRoot}/tables/twRO/skills.txt`, 'utf8')
).split(/\r?\n/)) {
  const match = line.match(/^(\d+)\s+([A-Z0-9_]+)\s+/);
  if (match) skillIds.set(match[2], Number(match[1]));
}

const descriptions = new Map();
const descriptionText = await readFile(
  `${openkoreRoot}/tables/twRO/skillsdescriptions.txt`,
  'utf8',
);
for (const match of descriptionText.matchAll(
  /^([A-Z0-9_]+)#\r?\n([\s\S]*?)\r?\n#$/gm,
)) {
  descriptions.set(
    match[1],
    match[2]
      .replace(/\^[0-9A-Fa-f]{6}/g, '')
      .replace(/\r/g, '')
      .trim(),
  );
}

function costByLevel(value, maxLevel) {
  if (Number.isFinite(Number(value)))
    return Array.from({ length: maxLevel }, () => Number(value));
  if (!Array.isArray(value)) return [];
  const costs = Array.from({ length: maxLevel }, () => 0);
  for (const entry of value) {
    const level = Number(entry?.Level),
      amount = Number(entry?.Amount);
    if (level >= 1 && level <= maxLevel && Number.isFinite(amount))
      costs[level - 1] = amount;
  }
  return costs;
}

function enabledKeys(value) {
  return Object.entries(value ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => name);
}

const skillDatabaseSource = yaml.load(
  await readFile(`${rathenaRoot}/db/re/skill_db.yml`, 'utf8'),
);
const skillDatabase = new Map(
  (skillDatabaseSource?.Body ?? []).map((skill) => {
    const maxLevel = Number(skill.MaxLevel) || 1,
      requires = skill.Requires ?? {};
    return [
      skill.Name,
      {
        id: Number(skill.Id),
        handle: skill.Name,
        description: skill.Description ?? '',
        type: skill.Type ?? '',
        targetType: skill.TargetType ?? 'Passive',
        range: Number.isFinite(Number(skill.Range)) ? Number(skill.Range) : 0,
        splash: skill.DamageFlags?.Splash === true,
        noDamage: skill.DamageFlags?.NoDamage === true,
        resources: {
          spCostByLevel: costByLevel(requires.SpCost, maxLevel),
          zenyCostByLevel: costByLevel(requires.ZenyCost, maxLevel),
          weapons: enabledKeys(requires.Weapon),
          ammo: enabledKeys(requires.Ammo),
          ammoAmount: Number(requires.AmmoAmount) || 0,
        },
      },
    ];
  }),
);

function automationMode(handle, description, metadata) {
  if (metadata.targetType === 'Attack') return 'attack';
  if (
    metadata.targetType === 'Self' &&
    metadata.noDamage &&
    selfBuffStatuses.has(handle)
  )
    return 'selfBuff';
  if (
    metadata.targetType === 'Self' &&
    metadata.splash &&
    !metadata.noDamage
  )
    return 'attackSelf';
  if (
    ['Self', 'Support'].includes(metadata.targetType) &&
    (handle === 'NV_FIRSTAID' ||
      handle === 'AL_HEAL' ||
      /類型\s*:\s*恢復/u.test(description))
  )
    return 'selfRecovery';
  return null;
}

const jobs = {};
let currentJob = null;
let currentSkill = null;
let currentRequirement = null;
for (const line of (
  await readFile(`${rathenaRoot}/db/re/skill_tree.yml`, 'utf8')
).split(/\r?\n/)) {
  const jobMatch = line.match(/^  - Job: (\w+)$/);
  if (jobMatch) {
    currentJob = Object.hasOwn(jobIds, jobMatch[1]) ? jobMatch[1] : null;
    currentSkill = null;
    currentRequirement = null;
    if (currentJob)
      jobs[jobIds[currentJob]] = {
        id: jobIds[currentJob],
        key: currentJob,
        name: jobNames[currentJob],
        skills: [],
      };
    continue;
  }
  if (!currentJob) continue;
  const skillMatch = line.match(/^      - Name: ([A-Z0-9_]+)$/);
  if (skillMatch) {
    const handle = skillMatch[1],
      description = descriptions.get(handle) ?? '',
      metadata = skillDatabase.get(handle) ?? {
        type: '',
        targetType: 'Passive',
        range: 0,
        splash: false,
        noDamage: false,
      };
    currentSkill = {
      id: skillIds.get(handle) ?? null,
      handle,
      name: skillNames.get(handle) ?? handle,
      maxLevel: 1,
      excluded: false,
      requires: [],
      description,
      englishName: metadata.description || null,
      type: metadata.type,
      targetType: metadata.targetType,
      range: metadata.range,
      automationMode: automationMode(handle, description, metadata),
      automationStatus: selfBuffStatuses.get(handle) ?? null,
      resources: metadata.resources ?? {
        spCostByLevel: [],
        zenyCostByLevel: [],
        weapons: [],
        ammo: [],
        ammoAmount: 0,
      },
    };
    jobs[jobIds[currentJob]].skills.push(currentSkill);
    currentRequirement = null;
    continue;
  }
  if (!currentSkill) continue;
  const maxMatch = line.match(/^        MaxLevel: (\d+)$/);
  if (maxMatch) currentSkill.maxLevel = Number(maxMatch[1]);
  if (/^        Exclude: true$/.test(line)) currentSkill.excluded = true;
  const requirementMatch = line.match(/^          - Name: ([A-Z0-9_]+)$/);
  if (requirementMatch) {
    currentRequirement = {
      handle: requirementMatch[1],
      name: skillNames.get(requirementMatch[1]) ?? requirementMatch[1],
      level: 1,
    };
    currentSkill.requires.push(currentRequirement);
    continue;
  }
  const levelMatch = line.match(/^            Level: (\d+)$/);
  if (levelMatch && currentRequirement)
    currentRequirement.level = Number(levelMatch[1]);
}

await writeFile(
  'public/ro/data/skill-trees.json',
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sources: {
        ruleset: 'Renewal',
        locale: 'zh-Hant',
      },
      jobs,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  Object.values(jobs)
    .map((job) => `${job.name} ${job.skills.length}`)
    .join('、'),
);
