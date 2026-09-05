import { createRandom } from '../core/random';
import type { BuildSnapshot, ContractId, Item, Policy, RunMode } from '../core/types';
import { CONTRACTS } from '../content/contracts';
import { evaluateItem, generateItem } from '../items/items';
import { resolveStats } from '../modifiers/resolve-stats';

export type MapCompletion = {
  success: boolean;
  currency: number;
  xp: number;
  kills: number;
  mapDropTier: number;
  item: Item;
  itemDpsDelta: number;
  itemClassification: ReturnType<typeof evaluateItem>['classification'];
};

export function progressPerTick(build: BuildSnapshot, tier: number, policy: Policy) {
  const stats = resolveStats(build);
  return Math.max(3, Math.round((stats.dps / (tier * 2100)) * (policy === 'boss-rush' ? 8 : 6)));
}

export function contractFailureChance(build: BuildSnapshot, tier: number, contractId: ContractId) {
  const stats = resolveStats(build);
  return Math.max(0, CONTRACTS[contractId].danger + tier * .025 - Math.min(.22, stats.dps / (tier * 60000)));
}

export function simulateMapCompletion(seed: number, tier: number, policy: Policy, build: BuildSnapshot, contractId: ContractId = 'scout'): MapCompletion {
  const random = createRandom(seed);
  const contract = CONTRACTS[contractId];
  const failureChance = contractFailureChance(build, tier, contractId);
  const success = random() >= failureChance;
  const mapDropTier = Math.min(5, tier + (random() > .68 - contract.mapChance ? 1 : 0));
  const item = generateItem(seed + 824, tier * 12 + contract.itemLevel);
  const evaluation = evaluateItem(item, build);
  return {
    success,
    currency: success ? Math.round((4 + tier * 2 + (policy === 'currency' ? 4 : 0)) * contract.currency) : 0,
    xp: success ? 24 + tier * 9 : 8 + tier * 2,
    kills: 25 + tier * 10,
    mapDropTier,
    item,
    itemDpsDelta: evaluation.dpsDelta,
    itemClassification: evaluation.classification,
  };
}

export function getRunStopReason(input: { mode: RunMode; completed: number; goal: number; elapsedMs: number; availableNext: number; tier: number }) {
  if (input.availableNext < 1) return `T${input.tier} 地圖耗盡`;
  if (input.mode === 'time' && input.elapsedMs >= input.goal * 10_000) return '達到設定時間';
  if (input.mode === 'count' && input.completed >= input.goal) return '達到設定張數';
  return null;
}
