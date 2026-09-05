import type { ItemSlot } from '../core/types';

export const TIER_POWER_REQUIREMENTS = [0, 0, 14_000, 20_000, 28_000, 40_000];

export const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: '武器', armor: '護甲', helmet: '頭部', gloves: '手套', boots: '鞋子', amulet: '護符',
};

export const FORGE_COSTS = {
  temper: { dust: 12, scrap: 3 },
  essence: { dust: 30, essence: 1 },
  ascend: { dust: 60, core: 1 },
} as const;

export function unlockedTier(dps: number) {
  return [5, 4, 3, 2, 1].find((tier) => dps >= TIER_POWER_REQUIREMENTS[tier]) ?? 1;
}

export function nextPowerGoal(dps: number) {
  const tier = [2, 3, 4, 5].find((value) => dps < TIER_POWER_REQUIREMENTS[value]);
  return tier ? { tier, dps: TIER_POWER_REQUIREMENTS[tier] } : null;
}
