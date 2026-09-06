export type RoStatId = 'str' | 'agi' | 'vit' | 'int' | 'dex' | 'luk';

export type RoStats = Record<RoStatId, number>;

type StatDefinition = {
  id: RoStatId;
  name: string;
  summary: string;
  sourceGame: 'Ragnarok Online';
  sourceUrl: string;
  sourceVersion: string;
  verifiedAt: string;
  sourceStatus: 'verified';
  implementationNotes: string;
};

export const DEFAULT_RO_STATS: RoStats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };

const SOURCE = {
  sourceGame: 'Ragnarok Online' as const,
  sourceUrl: 'https://irowiki.org/classic/Stats',
  sourceVersion: 'iRO Classic Wiki · Stats',
  verifiedAt: '2026-09-06',
  sourceStatus: 'verified' as const,
};

export const RO_STAT_DEFINITIONS: StatDefinition[] = [
  { id: 'str', name: 'STR 力量', summary: '近戰攻擊；每 5 點增加遠程攻擊', ...SOURCE, implementationNotes: '近戰採 STR + floor(STR/10)^2；每 5 DEX 與每 5 LUK 各加 1 攻擊。' },
  { id: 'agi', name: 'AGI 敏捷', summary: '每點縮短 0.4% 普攻與攻擊技能間隔', ...SOURCE, implementationNotes: '套用 iRO Classic 的基本攻擊間隔縮減，僅作用於 Attack 標籤。' },
  { id: 'vit', name: 'VIT 體力', summary: '每點增加 1% 最大生命', ...SOURCE, implementationNotes: '乘算於角色與裝備提供的生命總和。' },
  { id: 'int', name: 'INT 智力', summary: '法術攻擊；每點增加 1% 最大魔力', ...SOURCE, implementationNotes: '法術攻擊取 iRO 最小與最大 MATK 公式的平均值；最大 SP 對應本作最大魔力。' },
  { id: 'dex', name: 'DEX 靈巧', summary: '遠程攻擊；縮短施法時間', ...SOURCE, implementationNotes: '弓技能採 DEX + floor(DEX/10)^2；法術施放間隔乘上 1 - DEX/150。' },
  { id: 'luk', name: 'LUK 幸運', summary: '每點增加 0.3% 暴擊率', ...SOURCE, implementationNotes: '加到技能或武器本身的基礎暴擊率；不影響物品掉落。' },
];

export function statusPointsForLevel(level: number) {
  const capped = Math.max(1, Math.floor(level));
  let total = 48;
  for (let current = 1; current < capped; current += 1) total += Math.floor(current / 5) + 3;
  return total;
}

export function nextStatCost(currentValue: number) {
  return Math.floor((Math.max(1, currentValue) - 1) / 10) + 2;
}

export function spentStatusPoints(stats: RoStats) {
  return Object.values(stats).reduce((total, value) => {
    let spent = 0;
    for (let current = 1; current < Math.min(99, Math.max(1, value)); current += 1) spent += nextStatCost(current);
    return total + spent;
  }, 0);
}

export function repairRoStats(value: unknown): RoStats {
  if (!value || typeof value !== 'object') return { ...DEFAULT_RO_STATS };
  const raw = value as Partial<Record<RoStatId, unknown>>;
  return Object.fromEntries((Object.keys(DEFAULT_RO_STATS) as RoStatId[]).map((id) => [id, Math.min(99, Math.max(1, Math.floor(Number(raw[id]) || 1)))])) as RoStats;
}

export function roMeleeAttack(stats: RoStats) {
  return stats.str + Math.floor(stats.str / 10) ** 2 + Math.floor(stats.dex / 5) + Math.floor(stats.luk / 5);
}

export function roRangedAttack(stats: RoStats) {
  return stats.dex + Math.floor(stats.dex / 10) ** 2 + Math.floor(stats.str / 5) + Math.floor(stats.luk / 5);
}

export function roAverageMagicAttack(stats: RoStats) {
  const minimum = stats.int + Math.floor(stats.int / 7) ** 2;
  const maximum = stats.int + Math.floor(stats.int / 5) ** 2;
  return (minimum + maximum) / 2;
}
