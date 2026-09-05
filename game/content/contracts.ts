import type { ContractId, MasteryId } from '../core/types';

export const CONTRACTS: Record<ContractId, { name: string; description: string; danger: number; currency: number; itemLevel: number; mapChance: number }> = {
  scout: { name: '穩健勘查', description: '低風險，維持地圖庫存', danger: 0, currency: 1, itemLevel: 0, mapChance: .12 },
  greed: { name: '貪婪協議', description: '敵人強化，通貨與裝備提升', danger: .18, currency: 1.6, itemLevel: 8, mapChance: 0 },
  apex: { name: '首領懸賞', description: '高風險，高階地圖機率提升', danger: .32, currency: 1.25, itemLevel: 14, mapChance: .3 },
};

export const MASTERIES: Record<MasteryId, { name: string; description: string }> = {
  power: { name: '毀滅', description: '每階傷害 +8%' },
  tempo: { name: '疾行', description: '每階攻速與移速 +5%' },
  guard: { name: '壁壘', description: '每階生命與護甲 +12%' },
};
