import { createRandom } from '../core/random';
import type { Affix, AffixStat, BuildSnapshot, ClassId, Item, ItemEvaluation, ItemSlot, Rarity, SalvageMaterials, SocketColor } from '../core/types';
import { resolveStats } from '../modifiers/resolve-stats';

const BASES: Record<ItemSlot, Array<[string, string]>> = {
  weapon: [['short-bow', '短弓'], ['wand', '法杖'], ['hammer', '重錘']],
  armor: [['leather', '皮甲'], ['robe', '法袍'], ['plate', '胸甲']],
  helmet: [['hood', '兜帽'], ['crown', '戰冠'], ['mask', '面具']],
  gloves: [['grips', '護手'], ['wraps', '纏手'], ['gauntlets', '臂鎧']],
  boots: [['treads', '行靴'], ['greaves', '脛甲'], ['sandals', '秘履']],
  amulet: [['fang', '牙墜'], ['eye', '凝視之眼'], ['seal', '古印']],
};
const PREFIX = ['燼紅', '雷鳴', '玄鐵', '獵影', '符文', '深淵'];
const STATS: Record<ItemSlot, AffixStat[]> = {
  weapon: ['damage', 'speed', 'crit'], armor: ['life', 'armor', 'move'],
  helmet: ['life', 'armor', 'crit'], gloves: ['damage', 'speed', 'life'],
  boots: ['move', 'life', 'armor'], amulet: ['damage', 'crit', 'life'],
};
const LABELS: Record<AffixStat, string> = { damage: '傷害', speed: '攻擊速度', crit: '暴擊率', move: '移動速度', life: '生命', armor: '護甲' };

export function createStarterWeapon(classId: ClassId = 'thief'): Item {
  const starter = {
    thief: { baseId: 'novice-katar', name: '見習拳刃', color: 'G' as SocketColor },
    mage: { baseId: 'novice-wand', name: '見習法杖', color: 'B' as SocketColor },
    acolyte: { baseId: 'novice-mace', name: '見習權杖', color: 'R' as SocketColor },
  }[classId];
  return { id: 'starter-weapon', baseId: starter.baseId, name: starter.name, slot: 'weapon', rarity: 'COMMON', itemLevel: 1, links: 1, sockets: [starter.color], affixes: [{ id: 'starter-damage', name: '+4% 傷害', stat: 'damage', value: 4, tier: 8, tags: ['attack'] }], locked: true };
}

export function createCampaignItem(step: number, skillId: BuildSnapshot['skill']['id']): Item | undefined {
  if (step === 0) return { id: 'campaign-armor', baseId: 'scout-leather', name: '偵察員皮甲', slot: 'armor', rarity: 'MAGIC', itemLevel: 4, affixes: [{ id: 'campaign-life', name: '+18 生命', stat: 'life', value: 18, tier: 7, tags: ['life'] }] };
  if (step === 1) return { id: 'campaign-weapon', baseId: 'relay-weapon', name: '中繼站戰弓', slot: 'weapon', rarity: 'RARE', itemLevel: 8, links: 2, sockets: ['G', 'B'], affixes: [{ id: 'campaign-damage', name: '+14% 傷害', stat: 'damage', value: 14, tier: 6, tags: ['damage'] }, { id: 'campaign-speed', name: '+9% 攻擊速度', stat: 'speed', value: 9, tier: 6, tags: ['speed'] }] };
  if (step === 4) {
    const names = { ember: '餘燼增幅弓', arc: '雷脈增幅杖', quake: '震央增幅錘', venom: '音速拳刃', firebolt: '熾焰法杖', smite: '聖光權杖' };
    const skillColors: Record<BuildSnapshot['skill']['id'], SocketColor[]> = { ember: ['G', 'G', 'B'], arc: ['B', 'B', 'G'], quake: ['R', 'R', 'B'], venom: ['G', 'G', 'R'], firebolt: ['B', 'B', 'G'], smite: ['R', 'R', 'B'] };
    return { id: `campaign-core-${skillId}`, baseId: `${skillId}-core`, name: names[skillId], slot: 'weapon', rarity: 'RARE', itemLevel: 20, links: 3, sockets: skillColors[skillId], affixes: [{ id: `${skillId}-damage`, name: '+24% 傷害', stat: 'damage', value: 24, tier: 4, tags: [skillId] }, { id: `${skillId}-speed`, name: '+12% 攻擊速度', stat: 'speed', value: 12, tier: 5, tags: [skillId] }, { id: `${skillId}-crit`, name: '+10% 暴擊率', stat: 'crit', value: 10, tier: 5, tags: [skillId] }] };
  }
  return undefined;
}

export function generateItem(seed: number, itemLevel: number, forcedSlot?: ItemSlot): Item {
  const random = createRandom(seed);
  const slots: ItemSlot[] = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'amulet'];
  const slot: ItemSlot = forcedSlot ?? slots[Math.floor(random() * slots.length)];
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
  const socketCount = slot === 'weapon' ? Math.min(4, rarity === 'LEGENDARY' ? 4 : rarity === 'RARE' ? 3 : rarity === 'MAGIC' ? 2 : 1) : 0;
  const colorPool: SocketColor[] = baseId === 'wand' ? ['B', 'B', 'G', 'R'] : baseId === 'hammer' ? ['R', 'R', 'B', 'G'] : ['G', 'G', 'B', 'R'];
  const sockets = slot === 'weapon' ? Array.from({ length: socketCount }, () => colorPool[Math.floor(random() * colorPool.length)]) : undefined;
  const links = slot === 'weapon' ? Math.max(1, socketCount - (random() > .78 ? 1 : 0)) : undefined;
  return { id: `item-${seed}`, baseId, name: `${PREFIX[Math.floor(random() * PREFIX.length)]}${baseName}`, slot, rarity, itemLevel, links, sockets, affixes };
}

export function itemLinks(item?: Item) { return item?.slot === 'weapon' ? Math.max(1, item.links ?? (item.rarity === 'LEGENDARY' ? 4 : item.rarity === 'RARE' ? 3 : item.rarity === 'MAGIC' ? 2 : 1)) : 0; }

export function itemSockets(item?: Item): SocketColor[] {
  if (!item || item.slot !== 'weapon') return [];
  return item.sockets ?? Array.from({ length: itemLinks(item) }, () => 'W' as SocketColor);
}

export function recolorSockets(item: Item): Item {
  const next: Record<SocketColor, SocketColor> = { R: 'G', G: 'B', B: 'R', W: 'R' };
  return { ...item, sockets: itemSockets(item).map((color) => next[color]) };
}

export function addSocket(item: Item): Item {
  const sockets = itemSockets(item);
  if (sockets.length >= 4) return item;
  const cycle: SocketColor[] = ['R', 'G', 'B'];
  return { ...item, sockets: [...sockets, cycle[sockets.length % cycle.length]] };
}

export function addLink(item: Item): Item {
  return { ...item, links: Math.min(itemSockets(item).length, itemLinks(item) + 1) };
}

function percentDelta(next: number, current: number) { return current === 0 ? 0 : Math.round(((next - current) / current) * 1000) / 10; }

export function evaluateItem(item: Item, build: BuildSnapshot): ItemEvaluation {
  const current = resolveStats(build);
  const candidate = resolveStats({ ...build, [item.slot]: item, supportSlots: item.slot === 'weapon' ? itemLinks(item) : build.supportSlots });
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
  const gain = Math.max(2, Math.ceil(first.value * .18));
  const nextValue = first.value + gain;
  const next = { ...first, tier: Math.max(1, first.tier - 1), value: nextValue, name: first.name.replace(/\+\d+/, `+${nextValue}`) };
  return { ...item, name: item.name.includes('＋') ? item.name : `${item.name}＋`, affixes: [next, ...rest] };
}

export function essenceCraft(item: Item): Item {
  const available = STATS[item.slot];
  const used = new Set(item.affixes.map((affix) => affix.stat));
  const stat = available.find((candidate) => !used.has(candidate)) ?? available[0];
  const value = stat === 'life' || stat === 'armor' ? 28 : 18;
  const added: Affix = { id: `${item.id}-essence-${item.affixes.length}`, name: `+${value}${stat === 'life' || stat === 'armor' ? '' : '%'} ${LABELS[stat]}`, stat, value, tier: 3, tags: [stat, 'essence'] };
  const affixes = item.affixes.length < 4 ? [...item.affixes, added] : item.affixes.map((affix, index) => index === 0 ? { ...affix, value: affix.value + value, tier: Math.max(1, affix.tier - 2), name: affix.name.replace(/\+\d+/, `+${affix.value + value}`) } : affix);
  return { ...item, rarity: item.rarity === 'COMMON' || item.rarity === 'MAGIC' ? 'RARE' : item.rarity, name: `${item.name}．精華`, affixes };
}

export function ascendItem(item: Item): Item {
  const affixes = item.affixes.map((affix) => {
    const value = affix.value + Math.max(4, Math.ceil(affix.value * .25));
    return { ...affix, tier: Math.max(1, affix.tier - 2), value, name: affix.name.replace(/\+\d+/, `+${value}`) };
  });
  return { ...item, rarity: 'LEGENDARY', name: `${item.name}．升華`, affixes };
}

export function formatAffixes(item: Item) { return item.affixes.map((affix) => affix.name).join(' · '); }
