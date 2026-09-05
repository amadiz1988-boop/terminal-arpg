import { createRandom } from '../core/random';
import type { BuildSnapshot, ContractId, FarmingRouteId, GemDrop, Item, OrbWallet, Policy, RunMode, SkillId, SupportId } from '../core/types';
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
  orbs: OrbWallet;
  gemDrop: GemDrop;
};

const SLOT_ORDER = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'amulet'] as const;

export function progressPerTick(build: BuildSnapshot, tier: number, policy: Policy) {
  const stats = resolveStats(build);
  return Math.max(3, Math.round((stats.dps / (tier * 2100)) * (policy === 'boss-rush' ? 8 : 6)));
}

export function contractFailureChance(build: BuildSnapshot, tier: number, contractId: ContractId) {
  const stats = resolveStats(build);
  return Math.max(0, CONTRACTS[contractId].danger + tier * .025 - Math.min(.22, stats.dps / (tier * 60000)));
}

export function simulateMapCompletion(seed: number, tier: number, policy: Policy, build: BuildSnapshot, contractId: ContractId = 'scout', routeId: FarmingRouteId = 'arsenal'): MapCompletion {
  const random = createRandom(seed);
  const contract = CONTRACTS[contractId];
  void routeId;
  const failureChance = contractFailureChance(build, tier, contractId);
  const success = random() >= failureChance;
  const mapDropTier = Math.min(5, tier + (random() > .68 - contract.mapChance - (policy === 'boss-rush' ? .16 : 0) ? 1 : 0));
  const emptySlots = SLOT_ORDER.filter((slot) => !build[slot]);
  const plannedSlot = emptySlots.length > 0 ? emptySlots[seed % emptySlots.length] : SLOT_ORDER[seed % SLOT_ORDER.length];
  const item = generateItem(seed + 824, tier * 12 + contract.itemLevel + (policy === 'full-clear' ? 4 : 0), plannedSlot);
  const evaluation = evaluateItem(item, build);
  const skillDrops: SkillId[] = ['venom', 'firebolt', 'smite', 'ember', 'arc', 'quake'];
  const supportDrops: SupportId[] = ['momentum', 'echo', 'focus', 'fortify'];
  const gemIndex = seed % (skillDrops.length + supportDrops.length);
  const gemDrop: GemDrop = gemIndex < skillDrops.length
    ? { type: 'skill', id: skillDrops[gemIndex] }
    : { type: 'support', id: supportDrops[gemIndex - skillDrops.length] };
  return {
    success,
    currency: 0,
    xp: success ? 24 + tier * 9 : 8 + tier * 2,
    kills: 25 + tier * 10 + (policy === 'full-clear' ? 12 : 0),
    mapDropTier,
    item,
    itemDpsDelta: evaluation.dpsDelta,
    itemClassification: evaluation.classification,
    orbs: success ? {
      alteration: 1 + (seed % 3 === 0 ? 1 : 0) + (policy === 'currency' ? 2 : 0),
      chromatic: seed % 4 === 0 || (policy === 'currency' && seed % 2 === 0) ? 1 : 0,
      fusing: seed % 5 === 0 || (policy === 'currency' && seed % 3 === 0) ? 1 : 0,
      jeweller: seed % 6 === 0 || (policy === 'currency' && seed % 4 === 0) ? 1 : 0,
    } : { alteration: 0, chromatic: 0, fusing: 0, jeweller: 0 },
    gemDrop,
  };
}

export function getRunStopReason(input: { mode: RunMode; completed: number; goal: number; elapsedMs: number; availableNext: number; tier: number }) {
  if (input.tier > 1 && input.availableNext < 1) return `T${input.tier} 地圖耗盡，可回 T1 無限遠征補給`;
  if (input.mode === 'time' && input.elapsedMs >= input.goal * 10_000) return '達到設定時間';
  if (input.mode === 'count' && input.completed >= input.goal) return '達到設定張數';
  return null;
}
