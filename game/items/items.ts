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
export type CurrencyCraftResult={applied:boolean;item:Item;message:string};

function rollAffixes(item:Pick<Item,'id'|'slot'|'itemLevel'>,seed:number,count:number){
  const random=createRandom(seed);const stats=STATS[item.slot];
  return Array.from({length:count},(_,index)=>{const stat=stats[Math.floor(random()*stats.length)];const tier=Math.max(1,8-Math.floor(item.itemLevel/8)-Math.floor(random()*2));const value=Math.max(3,Math.round((10-tier)*(2+random()*2)));return {id:`${item.id}-craft-${seed}-${index}`,name:`+${value}${stat==='life'||stat==='armor'?'':'%'} ${LABELS[stat]}`,stat,value,tier,tags:[stat]};});
}

export function maxSocketsForItem(item:Pick<Item,'slot'|'baseId'|'itemLevel'>){
  if(item.slot==='amulet')return 0;
  const baseCap=item.slot==='weapon'?(item.baseId.includes('wand')||item.baseId.includes('katar')||item.baseId.includes('mace')||item.baseId.includes('sceptre')?3:6):item.slot==='armor'?6:4;
  const levelCap=item.itemLevel>=50?6:item.itemLevel>=35?5:item.itemLevel>=25?4:item.itemLevel>=2?3:2;
  return Math.min(baseCap,levelCap);
}

function socketColorPool(item:Pick<Item,'baseId'>):SocketColor[]{
  if(/wand|robe|crown|wraps|sandals/.test(item.baseId))return ['B','B','B','G','R'];
  if(/hammer|plate|greaves|gauntlets|mace/.test(item.baseId))return ['R','R','R','G','B'];
  if(/bow|leather|hood|grips|treads|katar/.test(item.baseId))return ['G','G','G','B','R'];
  return ['R','G','B'];
}

function rollSocketColors(item:Pick<Item,'baseId'>,count:number,random:()=>number){const pool=socketColorPool(item);return Array.from({length:count},()=>pool[Math.floor(random()*pool.length)]);}

export function createStarterWeapon(classId: ClassId = 'thief'): Item {
  const starter = {
    thief: { baseId: 'glass-shank', name: '玻璃利片', color: 'G' as SocketColor },
    mage: { baseId: 'driftwood-wand', name: '朽木法杖', color: 'B' as SocketColor },
    acolyte: { baseId: 'driftwood-club', name: '朽木之棒', color: 'R' as SocketColor },
  }[classId];
  return { id: 'starter-weapon', baseId: starter.baseId, name: starter.name, slot: 'weapon', rarity: 'COMMON', itemLevel: 1, links: 1, sockets: [starter.color], affixes: [], locked: true };
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
  const maxSockets=maxSocketsForItem({slot,baseId,itemLevel});
  const socketCount=maxSockets>0?1+Math.floor(Math.pow(random(),1.45)*maxSockets):0;
  const sockets = socketCount>0 ? rollSocketColors({baseId},socketCount,random) : undefined;
  const links = socketCount>0 ? 1+Math.floor(Math.pow(random(),1.7)*socketCount) : undefined;
  return { id: `item-${seed}`, baseId, name: `${PREFIX[Math.floor(random() * PREFIX.length)]}${baseName}`, slot, rarity, itemLevel, links, sockets, affixes };
}

export function itemLinks(item?: Item) { return item?.sockets?.length ? Math.max(1,Math.min(item.sockets.length,item.links??1)) : 0; }

export function itemSockets(item?: Item): SocketColor[] {
  if (!item) return [];
  return item.sockets ?? [];
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

export function applyAlteration(item:Item,seed:number):CurrencyCraftResult{
  if(item.rarity!=='MAGIC')return {applied:false,item,message:'改造石只能用於魔法物品'};
  const random=createRandom(seed);const count=1+Math.floor(random()*2);const affixes=rollAffixes(item,seed,count);
  return {applied:true,item:{...item,affixes},message:`重置全部詞綴 · 產生 ${count} 條魔法詞綴`};
}

export function applyTransmutation(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='COMMON')return {applied:false,item,message:'蛻變石只能用於普通物品'};const count=1+Math.floor(createRandom(seed)()*2);return {applied:true,item:{...item,rarity:'MAGIC',affixes:rollAffixes(item,seed,count)},message:`升級為魔法物品 · ${count} 條詞綴`};}
export function applyAugmentation(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='MAGIC'||item.affixes.length>=2)return {applied:false,item,message:'增幅石需要少於 2 條詞綴的魔法物品'};return {applied:true,item:{...item,affixes:[...item.affixes,...rollAffixes(item,seed,1)]},message:'新增 1 條魔法詞綴'};}
export function applyAlchemy(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='COMMON')return {applied:false,item,message:'點金石只能用於普通物品'};return {applied:true,item:{...item,rarity:'RARE',affixes:rollAffixes(item,seed,4)},message:'升級為稀有物品 · 4 條詞綴'};}
export function applyChance(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='COMMON')return {applied:false,item,message:'機會石只能用於普通物品'};const roll=createRandom(seed)();const rarity:Rarity=roll<.75?'MAGIC':roll<.98?'RARE':'LEGENDARY';const count=rarity==='MAGIC'?2:rarity==='RARE'?4:6;return {applied:true,item:{...item,rarity,affixes:rollAffixes(item,seed,count)},message:`隨機升級為 ${rarity}`};}
export function applyScouring(item:Item):CurrencyCraftResult{if(item.rarity==='COMMON'&&item.affixes.length===0)return {applied:false,item,message:'物品已經是無詞綴普通物品'};return {applied:true,item:{...item,rarity:'COMMON',affixes:[]},message:'移除全部詞綴並變回普通物品'};}
export function applyRegal(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='MAGIC')return {applied:false,item,message:'富豪石只能用於魔法物品'};return {applied:true,item:{...item,rarity:'RARE',affixes:[...item.affixes,...rollAffixes(item,seed,1)]},message:'升級為稀有物品並新增 1 條詞綴'};}
export function applyChaos(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='RARE')return {applied:false,item,message:'混沌石只能用於稀有物品'};const count=4+Math.floor(createRandom(seed)()*3);return {applied:true,item:{...item,affixes:rollAffixes(item,seed,count)},message:`重骰稀有物品全部詞綴 · ${count} 條`};}
export function applyExalted(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='RARE'||item.affixes.length>=6)return {applied:false,item,message:'崇高石需要少於 6 條詞綴的稀有物品'};return {applied:true,item:{...item,affixes:[...item.affixes,...rollAffixes(item,seed,1)]},message:'新增 1 條稀有詞綴'};}
export function applyAnnulment(item:Item,seed:number):CurrencyCraftResult{if(item.affixes.length===0)return {applied:false,item,message:'物品沒有可移除的詞綴'};const index=Math.floor(createRandom(seed)()*item.affixes.length);return {applied:true,item:{...item,affixes:item.affixes.filter((_,i)=>i!==index)},message:`隨機移除「${item.affixes[index].name}」`};}
export function applyDivine(item:Item,seed:number):CurrencyCraftResult{if(item.affixes.length===0)return {applied:false,item,message:'物品沒有可重骰的隨機詞綴'};const random=createRandom(seed);const affixes=item.affixes.map(affix=>{const value=Math.max(1,Math.round(affix.value*(.8+random()*.4)));return {...affix,value,name:affix.name.replace(/\+\d+/,`+${value}`)}});return {applied:true,item:{...item,affixes},message:'保留詞綴種類與階級，重骰全部數值'};}
export function applyQuality(item:Item,kind:'weapon'|'armor'):CurrencyCraftResult{const valid=kind==='weapon'?item.slot==='weapon':item.slot!=='weapon'&&item.slot!=='amulet';if(!valid)return {applied:false,item,message:kind==='weapon'?'磨刀石只能用於武器':'護甲片只能用於防具'};if((item.quality??0)>=20)return {applied:false,item,message:'物品品質已達 20%'};const quality=Math.min(20,(item.quality??0)+(item.rarity==='COMMON'?5:item.rarity==='MAGIC'?2:1));return {applied:true,item:{...item,quality},message:`品質提升至 ${quality}%`};}
export function applyBinding(item:Item,seed:number):CurrencyCraftResult{if(item.rarity!=='COMMON')return {applied:false,item,message:'束縛石只能用於普通物品'};const max=Math.min(4,maxSocketsForItem(item));const random=createRandom(seed);const sockets=max>0?rollSocketColors(item,max,random):undefined;return {applied:true,item:{...item,rarity:'RARE',affixes:rollAffixes(item,seed,4),sockets,links:max||undefined},message:`升級為稀有物品${max?`並取得 ${max} 連`:''}`};}

export function applyChromatic(item:Item,seed:number):CurrencyCraftResult{
  const sockets=itemSockets(item);if(sockets.length===0)return {applied:false,item,message:'幻色石只能用於有插槽的物品'};
  const random=createRandom(seed);const colors=rollSocketColors(item,sockets.length,random);
  return {applied:true,item:{...item,sockets:colors},message:`重置插槽顏色 · ${colors.join('－')}`};
}

export function applyJeweller(item:Item,seed:number):CurrencyCraftResult{
  const max=maxSocketsForItem(item);if(max===0)return {applied:false,item,message:'這個物品種類不能擁有插槽'};
  const current=itemSockets(item).length;if(current>=max)return {applied:false,item,message:`已達此物品的 ${max} 洞上限，工匠石未消耗`};
  const random=createRandom(seed);const choices=Array.from({length:max},(_,index)=>index+1).filter(value=>value!==current);const count=choices[Math.floor(random()*choices.length)];const sockets=rollSocketColors(item,count,random);const links=1+Math.floor(random()*count);
  return {applied:true,item:{...item,sockets,links},message:`重置插槽數量 · ${current} 洞 → ${count} 洞，顏色與連線一併重骰`};
}

export function applyFusing(item:Item,seed:number):CurrencyCraftResult{
  const sockets=itemSockets(item);if(sockets.length<2)return {applied:false,item,message:'鏈結石需要至少 2 個插槽'};const current=itemLinks(item);if(current>=sockets.length)return {applied:false,item,message:'插槽已全部連線，鏈結石未消耗'};
  const random=createRandom(seed);const choices=Array.from({length:sockets.length},(_,index)=>index+1).filter(value=>value!==current);const links=choices[Math.floor(random()*choices.length)];
  return {applied:true,item:{...item,links},message:`重置插槽連線 · ${current} 連 → ${links} 連，洞數與顏色不變`};
}

function percentDelta(next: number, current: number) { return current === 0 ? 0 : Math.round(((next - current) / current) * 1000) / 10; }

export function evaluateItem(item: Item, build: BuildSnapshot): ItemEvaluation {
  const current = resolveStats(build);
  const replacesSocketItem=item.slot===(build.socketSlot??'weapon');
  const candidate = resolveStats({ ...build, [item.slot]: item, socketItem:replacesSocketItem?item:build.socketItem, supportSlots:replacesSocketItem?itemLinks(item):build.supportSlots });
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
