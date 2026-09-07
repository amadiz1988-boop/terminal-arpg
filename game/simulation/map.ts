import { createRandom } from '../core/random';
import type { BuildSnapshot, ContractId, FarmingRouteId, GemDrop, Item, MonsterPack, MonsterPopulation, OrbWallet, Policy, RunMode, SkillId, SupportId } from '../core/types';
import { CONTRACTS } from '../content/contracts';
import { EMPTY_ORBS, rollCurrencyDrops } from '../content/currencies';
import { evaluateItem, generateItem } from '../items/items';
import { resolveStats } from '../modifiers/resolve-stats';

export type MapCompletion = {
  success: boolean;
  currency: number;
  xp: number;
  kills: number;
  mapDropTier: number;
  item: Item;
  items: Item[];
  itemDpsDelta: number;
  itemClassification: ReturnType<typeof evaluateItem>['classification'];
  orbs: OrbWallet;
  gemDrop: GemDrop;
  monsters: MonsterPopulation;
  packs: MonsterPack[];
  specialEncounter: boolean;
};

const SLOT_ORDER = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'amulet'] as const;

export function generateMonsterPopulation(seed:number):MonsterPopulation {
  const random=createRandom(seed*17+9);
  const nonBoss=400+Math.floor(random()*201);
  let special=0;for(let index=0;index<nonBoss;index+=1)if(random()<.001)special+=1;
  const remaining=nonBoss-special;
  const normal=Math.round(remaining*(50/100));
  const magic=Math.round(remaining*(35/100));
  const rare=remaining-normal-magic;
  return {total:nonBoss+1,normal,magic,rare,special,boss:1};
}

export function generateMonsterPacks(seed:number, population:MonsterPopulation):MonsterPack[] {
  const random=createRandom(seed*31+17);
  const count=18+Math.floor(random()*9);
  const packs=Array.from({length:count},(_,index)=>({position:8+Math.floor(index*(204/count)+random()*5),normal:0,magic:0,rare:0,special:0}));
  const distribute=(kind:'normal'|'magic'|'rare'|'special',amount:number)=>{
    for(let index=0;index<amount;index+=1)packs[Math.floor(random()*packs.length)][kind]+=1;
  };
  distribute('normal',population.normal);distribute('magic',population.magic);distribute('rare',population.rare);distribute('special',population.special);
  return packs;
}

export function selectCampaignPacks(packs:MonsterPack[]){
  return packs.slice(0,Math.max(1,Math.ceil(packs.length/10)));
}

export function contractFailureChance(build: BuildSnapshot, tier: number, contractId: ContractId) {
  const stats = resolveStats(build);
  return Math.max(0, CONTRACTS[contractId].danger + tier * .025 - Math.min(.22, stats.dps / (tier * 60000)));
}

export function simulateMapCompletion(seed: number, tier: number, policy: Policy, build: BuildSnapshot, contractId: ContractId = 'scout', routeId: FarmingRouteId = 'arsenal', forceSuccess?:boolean): MapCompletion {
  const random = createRandom(seed);
  const monsters=generateMonsterPopulation(seed);
  const packs=generateMonsterPacks(seed,monsters);
  const contract = CONTRACTS[contractId];
  void routeId;
  const failureChance = contractFailureChance(build, tier, contractId);
  const success = forceSuccess ?? random() >= failureChance;
  const mapDropTier = Math.min(5, tier + (random() > .68 - contract.mapChance - (policy === 'boss-rush' ? .16 : 0) ? 1 : 0));
  const emptySlots = SLOT_ORDER.filter((slot) => !build[slot]);
  const plannedSlot = emptySlots.length > 0 ? emptySlots[seed % emptySlots.length] : SLOT_ORDER[seed % SLOT_ORDER.length];
  const dropScore=monsters.normal*.002+monsters.magic*.012+monsters.rare*.07+monsters.special*1.5+3;
  const itemCount=success?Math.max(4,Math.round(dropScore*(.85+random()*.3))):0;
  const items=Array.from({length:itemCount},(_,index)=>generateItem(seed+824+index*101,tier*12+contract.itemLevel+(policy==='full-clear'?4:0)+(index===0&&monsters.special>0?10:0),index===0?plannedSlot:undefined));
  const item = items[0] ?? generateItem(seed + 824, tier * 12, plannedSlot);
  const evaluation = evaluateItem(item, build);
  const skillDrops: SkillId[] = ['venom', 'firebolt', 'smite', 'ember', 'arc', 'quake'];
  const supportDrops: SupportId[] = ['momentum', 'echo', 'focus', 'fortify'];
  const gemIndex = seed % (skillDrops.length + supportDrops.length);
  const gemDrop: GemDrop = gemIndex < skillDrops.length
    ? { type: 'skill', id: skillDrops[gemIndex] }
    : { type: 'support', id: supportDrops[gemIndex - skillDrops.length] };
  const orbScore=monsters.normal*.004+monsters.magic*.025+monsters.rare*.09+monsters.special*3+4;
  const orbBudget=success?Math.max(8,Math.round(orbScore*(policy==='currency'?1.45:1))):0;
  const killRatio=policy==='full-clear'?1:policy==='currency'?.82:.56;
  const kills=success?Math.max(1,Math.round((monsters.total-1)*killRatio)+1):Math.round(monsters.total*.18);
  return {
    success,
    currency: 0,
    xp: success ? Math.round(kills*.09) + tier * 9 : 8 + tier * 2,
    kills,
    mapDropTier,
    item,
    items,
    itemDpsDelta: evaluation.dpsDelta,
    itemClassification: evaluation.classification,
    orbs: success ? rollCurrencyDrops(seed*97+31,orbBudget,tier*12+contract.itemLevel+(monsters.special>0?10:0)) : {...EMPTY_ORBS},
    gemDrop,
    monsters,
    packs,
    specialEncounter: monsters.special > 0,
  };
}

export function getRunStopReason(input: { mode: RunMode; completed: number; goal: number; elapsedMs: number; availableNext: number; tier: number }) {
  if (input.tier > 1 && input.availableNext < 1) return `T${input.tier} 地圖耗盡，可回 T1 無限遠征補給`;
  if (input.mode === 'time' && input.elapsedMs >= input.goal * 10_000) return '達到設定時間';
  if (input.mode === 'count' && input.completed >= input.goal) return '達到設定張數';
  return null;
}
