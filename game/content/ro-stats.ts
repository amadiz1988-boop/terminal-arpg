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
  sourceUrl: 'https://ro.ntome.com/stat/attr',
  sourceVersion: '仙境全書 · 角色數值',
  verifiedAt: '2026-09-06',
  sourceStatus: 'verified' as const,
};

export const RO_STAT_DEFINITIONS: StatDefinition[] = [
  { id: 'str', name: 'STR 力量', summary: '每點近戰素質 ATK +1；每 5 點遠程 ATK +1', ...SOURCE, implementationNotes: '近戰素質 ATK 採 STR；遠程每 5 STR 增加 1。裝備 ATK 加成等武器基礎攻擊拆分後接入。' },
  { id: 'agi', name: 'AGI 敏捷', summary: '每點 FLEE +1；每 5 點 DEF +1', ...SOURCE, implementationNotes: 'ASPD 仍依已核實的 iRO 武器延遲換算；AGI 進入目前攻擊間隔計算。' },
  { id: 'vit', name: 'VIT 體力', summary: '每點增加 1% 最大生命', ...SOURCE, implementationNotes: '乘算於角色與裝備提供的生命總和。' },
  { id: 'int', name: 'INT 智力', summary: '每點 MATK +1.5、MDEF +1、最大魔力 +1%', ...SOURCE, implementationNotes: '最大 SP 對應本作最大魔力；INT 依 Renewal VCT 公式提供 DEX 一半的權重。' },
  { id: 'dex', name: 'DEX 靈巧', summary: '每點遠程 ATK、HIT；每 5 點近戰 ATK、MATK、MDEF', ...SOURCE, implementationNotes: 'DEX 與 INT 依 Renewal VCT 公式降低法術施放間隔。' },
  { id: 'luk', name: 'LUK 幸運', summary: '暴擊；每 3 點增加 ATK、MATK、HIT', ...SOURCE, implementationNotes: '每 5 點增加 FLEE，每 10 點增加完全迴避；不影響物品掉落。' },
];

export function statusPointsForLevel(level: number) {
  const capped = Math.max(1, Math.floor(level));
  let total = 0;
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

export function repairRoStatsForLevel(value: unknown, level: number): RoStats {
  const repaired = repairRoStats(value);
  return spentStatusPoints(repaired) <= statusPointsForLevel(level) ? repaired : { ...DEFAULT_RO_STATS };
}

export function roMeleeAttack(stats: RoStats, level = 1) {
  return stats.str + Math.floor(stats.dex / 5) + Math.floor(stats.luk / 3) + Math.floor(level / 4);
}

export function roRangedAttack(stats: RoStats, level = 1) {
  return stats.dex + Math.floor(stats.str / 5) + Math.floor(stats.luk / 3) + Math.floor(level / 4);
}

export function roAverageMagicAttack(stats: RoStats, level = 1) {
  return stats.int * 1.5 + Math.floor(stats.dex / 5) + Math.floor(stats.luk / 3) + Math.floor(level / 4);
}

export function roPhysicalDefense(stats: RoStats, level = 1) {
  return Math.floor(stats.agi / 5) + Math.floor(stats.vit / 2) + Math.floor(level / 2);
}

export function roMagicDefense(stats: RoStats, level = 1) {
  return stats.int + Math.floor(stats.dex / 5) + Math.floor(stats.vit / 5) + Math.floor(level / 4);
}

export function roHit(level: number, stats: RoStats) {
  return Math.max(1, Math.floor(level)) + stats.dex + Math.floor(stats.luk / 3);
}

export function roFlee(level: number, stats: RoStats) {
  return Math.max(1, Math.floor(level)) + stats.agi + Math.floor(stats.luk / 5);
}

export function roPerfectDodge(stats: RoStats) {
  return 1 + Math.floor(stats.luk / 10);
}

export function roVariableCastMultiplier(stats: RoStats) {
  return Math.max(0, 1 - Math.sqrt(Math.min(530, stats.dex * 2 + stats.int) / 530));
}

export function roAspdFromAttacksPerSecond(attacksPerSecond: number) {
  return Math.min(190, Math.max(0, 200 - 50 / Math.max(.01, attacksPerSecond)));
}
