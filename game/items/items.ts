import { createRandom } from '../core/random';
import type { Affix, AffixStat, BuildSnapshot, Item, ItemEvaluation, ItemSlot, Rarity, SalvageMaterials } from '../core/types';
import { resolveStats } from '../modifiers/resolve-stats';

const BASES: Record<ItemSlot, Array<[string, string]>> = {
  weapon: [['short-bow', '短弓'], ['wand', '法杖'], ['hammer', '重錘']],
  armor: [['leather', '皮甲'], ['robe', '法袍'], ['plate', '胸甲']],
};
const PREFIX = ['燼紅', '雷鳴', '玄鐵', '獵影', '符文', '深淵'];
const STATS: Record<ItemSlot, AffixStat[]> = { weapon: ['damage', 'speed', 'crit'], armor: ['life', 'armor', 'move'] };
const LABELS: Record<AffixStat, string> = { damage: '傷害', speed: '攻擊速度', crit: '暴擊率', move: '移動速度', life: '生命', armor: '護甲' };

export function createStarterWeapon(): Item {
  return { id: 'starter-weapon', baseId: 'worn-bow', name: '磨損短弓', slot: 'weapon', rarity: 'COMMON', itemLevel: 1, affixes: [{ id: 'starter-damage', name: '+4% 傷害', stat: 'damage', value: 4, tier: 8, tags: ['attack'] }], locked: true };
}

export function createCampaignItem(step: number, skillId: BuildSnapshot['skill']['id']): Item | undefined {
  if (step === 0) return { id: 'campaign-armor', baseId: 'scout-leather', name: '偵察員皮甲', slot: 'armor', rarity: 'MAGIC', itemLevel: 4, affixes: [{ id: 'campaign-life', name: '+18 生命', stat: 'life', value: 18, tier: 7, tags: ['life'] }] };
  if (step === 1) return { id: 'campaign-weapon', baseId: 'relay-weapon', name: '中繼站戰弓', slot: 'weapon', rarity: 'RARE', itemLevel: 8, affixes: [{ id: 'campaign-damage', name: '+14% 傷害', stat: 'damage', value: 14, tier: 6, tags: ['damage'] }, { id: 'campaign-speed', name: '+9% 攻擊速度', stat: 'speed', value: 9, tier: 6, tags: ['speed'] }] };
  if (step === 4) {
    const names = { ember: '餘燼增幅弓', arc: '雷脈增幅杖', quake: '震央增幅錘' };
    return { id: `campaign-core-${skillId}`, baseId: `${skillId}-core`, name: names[skillId], slot: 'weapon', rarity: 'RARE', itemLevel: 20, affixes: [{ id: `${skillId}-damage`, name: '+24% 傷害', stat: 'damage', value: 24, tier: 4, tags: [skillId] }, { id: `${skillId}-speed`, name: '+12% 攻擊速度', stat: 'speed', value: 12, tier: 5, tags: [skillId] }, { id: `${skillId}-crit`, name: '+10% 暴擊率', stat: 'crit', value: 10, tier: 5, tags: [skillId] }] };
  }
  return undefined;
}

export function generateItem(seed: number, itemLevel: number, forcedSlot?: ItemSlot): Item {
  const random = createRandom(seed);
  const slot: ItemSlot = forcedSlot ?? (random() > .48 ? 'weapon' : 'armor');
  const rarityRoll = random();
  const rarity: Rarity = rarityRoll > .95 ? 'LEGENDARY' : rarityRoll > .6 ? 'RARE' : rarityRoll > .22 ? 'MAGIC' : 'COMMON';
  const affixCount = rarity === 'LEGENDARY' ? 4 : rarity === 'RARE' ? 3 : rarity === 'MAGIC' ? 2 : 1;
  const [baseId, baseName] = BASES[slot][Math.floor(random() * BASES[slot].length)];
  const affixes: Affix[] = Array.from({ length: affixCount }, (_, index) => {
    const stat = STATS[slot][Math.floor(random() * STATS[slot].length)];
    const tier = Math.max(1, 8 - Math.floor(itemLevel / 8) - Math.floor(random() * 2));
    const value = Math.max(3, Math.round((10 - tier) * (2 + random() * 2)));
    return { id: `${seed}-${index}`, name: `+${value}${stat === 'life' || stat === 'armor' ? '' : '%'} ${LABELS[stat]}`, stat, value, tier, tags: [stat] };
  });
  return { id: `item-${seed}`, baseId, name: `${PREFIX[Math.floor(random() * PREFIX.length)]}${baseName}`, slot, rarity, itemLevel, affixes };
}

function percentDelta(next: number, current: number) { return current === 0 ? 0 : Math.round(((next - current) / current) * 1000) / 10; }

export function evaluateItem(item: Item, build: BuildSnapshot): ItemEvaluation {
  const current = resolveStats(build);
  const candidate = resolveStats({ ...build, [item.slot]: item });
  const dpsDelta = percentDelta(candidate.dps, current.dps);
  const bossDelta = percentDelta(candidate.bossDps, current.bossDps);
  const clearDelta = percentDelta(candidate.clearScore, current.clearScore);
  const survivalDelta = percentDelta(candidate.life + candidate.armor, current.life + current.armor);
  const moveDelta = candidate.moveSpeed - current.moveSpeed;
  const potential = item.affixes.reduce((total, affix) => total + (10 - affix.tier) * 8, 0) + item.itemLevel;
  const primary = Math.max(dpsDelta, bossDelta, clearDelta, survivalDelta, moveDelta);
  return { itemId: item.id, dpsDelta, bossDelta, clearDelta, survivalDelta, moveDelta, potential, classification: primary >= 1 ? 'upgrade' : primary > -1 ? 'sidegrade' : potential >= 70 ? 'craft' : 'salvage' };
}

export function salvageValue(item: Item): SalvageMaterials {
  return { scrap: item.rarity === 'COMMON' ? 1 : item.rarity === 'MAGIC' ? 3 : 5, essence: item.rarity === 'RARE' ? 1 : item.rarity === 'LEGENDARY' ? 3 : 0, core: item.rarity === 'LEGENDARY' ? 1 : 0 };
}

export function refineItem(item: Item): Item {
  if (!item.affixes.length) return item;
  const [first, ...rest] = item.affixes;
  const next = { ...first, value: first.value + 1, name: first.name.replace(/\+\d+/, `+${first.value + 1}`) };
  return { ...item, affixes: [next, ...rest] };
}

export function formatAffixes(item: Item) { return item.affixes.map((affix) => affix.name).join(' · '); }
