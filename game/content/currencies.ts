import type { CurrencyId, OrbWallet } from '../core/types';

export type CurrencyDefinition={id:CurrencyId;name:string;effect:string;weight:number;dropLevel:number;group:'common'|'craft'|'rare'|'special';usable:boolean};

// PoE does not publish server drop weights. These are transparent Alpha weights,
// ordered to preserve PoE's broad common-to-chase rarity progression.
export const CURRENCIES:CurrencyDefinition[]=[
  {id:'wisdom',name:'知識卷軸',effect:'鑑定物品',weight:2200,dropLevel:1,group:'common',usable:false},
  {id:'portal',name:'傳送卷軸',effect:'返回城鎮',weight:700,dropLevel:1,group:'common',usable:false},
  {id:'armourer',name:'護甲片',effect:'提升護甲品質',weight:540,dropLevel:1,group:'common',usable:true},
  {id:'whetstone',name:'磨刀石',effect:'提升武器品質',weight:540,dropLevel:1,group:'common',usable:true},
  {id:'transmutation',name:'蛻變石',effect:'普通升級為魔法',weight:520,dropLevel:2,group:'common',usable:true},
  {id:'augmentation',name:'增幅石',effect:'為魔法物品新增詞綴',weight:470,dropLevel:2,group:'common',usable:true},
  {id:'alteration',name:'改造石',effect:'重骰魔法物品全部詞綴',weight:440,dropLevel:2,group:'common',usable:true},
  {id:'chromatic',name:'幻色石',effect:'重骰插槽顏色',weight:390,dropLevel:2,group:'common',usable:true},
  {id:'jeweller',name:'工匠石',effect:'重骰插槽數量',weight:330,dropLevel:2,group:'common',usable:true},
  {id:'chance',name:'機會石',effect:'隨機升級普通物品',weight:260,dropLevel:2,group:'craft',usable:true},
  {id:'fusing',name:'鏈結石',effect:'重骰插槽連線',weight:220,dropLevel:2,group:'craft',usable:true},
  {id:'alchemy',name:'點金石',effect:'普通升級為稀有',weight:190,dropLevel:2,group:'craft',usable:true},
  {id:'scouring',name:'重鑄石',effect:'移除全部詞綴變回普通',weight:125,dropLevel:12,group:'craft',usable:true},
  {id:'chisel',name:'製圖釘',effect:'提升地圖品質',weight:105,dropLevel:12,group:'craft',usable:false},
  {id:'blessed',name:'祝福石',effect:'重骰固定詞綴數值',weight:95,dropLevel:35,group:'craft',usable:false},
  {id:'regret',name:'後悔石',effect:'獲得天賦重置點',weight:78,dropLevel:2,group:'craft',usable:false},
  {id:'vaal',name:'瓦爾寶珠',effect:'腐化並隨機改變物品',weight:68,dropLevel:12,group:'craft',usable:false},
  {id:'regal',name:'富豪石',effect:'魔法升級為稀有並新增詞綴',weight:55,dropLevel:12,group:'rare',usable:true},
  {id:'chaos',name:'混沌石',effect:'重骰稀有物品全部詞綴',weight:48,dropLevel:12,group:'rare',usable:true},
  {id:'gemcutter',name:'寶石匠的稜鏡',effect:'提升技能寶石品質',weight:32,dropLevel:12,group:'rare',usable:false},
  {id:'glassblower',name:'玻璃彈珠',effect:'提升藥劑品質',weight:28,dropLevel:12,group:'rare',usable:false},
  {id:'binding',name:'束縛石',effect:'普通升稀有並取得最多四連',weight:20,dropLevel:12,group:'rare',usable:true},
  {id:'horizon',name:'地平石',effect:'重鑄為同階地圖',weight:15,dropLevel:35,group:'rare',usable:false},
  {id:'annulment',name:'無效石',effect:'隨機移除一個詞綴',weight:8,dropLevel:35,group:'rare',usable:true},
  {id:'exalted',name:'崇高石',effect:'為稀有物品新增詞綴',weight:5,dropLevel:35,group:'rare',usable:true},
  {id:'divine',name:'神聖石',effect:'重骰隨機詞綴數值',weight:4,dropLevel:35,group:'rare',usable:true},
  {id:'ancient',name:'古變石',effect:'重鑄同類型傳奇物品',weight:1.2,dropLevel:50,group:'special',usable:false},
  {id:'unmaking',name:'撤銷石',effect:'獲得輿圖天賦重置點',weight:1,dropLevel:50,group:'special',usable:false},
  {id:'sacred',name:'聖玉',effect:'重骰護甲基礎防禦數值',weight:.5,dropLevel:50,group:'special',usable:false},
  {id:'fracturing',name:'破裂石',effect:'鎖定稀有物品一條隨機詞綴',weight:.08,dropLevel:68,group:'special',usable:false},
  {id:'mirror',name:'卡蘭德的魔鏡',effect:'複製物品',weight:.01,dropLevel:35,group:'special',usable:false},
];

export const CURRENCY_BY_ID=Object.fromEntries(CURRENCIES.map(currency=>[currency.id,currency])) as Record<CurrencyId,CurrencyDefinition>;
export const CURRENCY_WEIGHT_TOTAL=CURRENCIES.reduce((sum,currency)=>sum+currency.weight,0);
export const EMPTY_ORBS=Object.fromEntries(CURRENCIES.map(currency=>[currency.id,0])) as OrbWallet;

export function repairWallet(value?:Partial<OrbWallet>):OrbWallet{return Object.fromEntries(CURRENCIES.map(currency=>[currency.id,Math.max(0,Number(value?.[currency.id]??0))])) as OrbWallet;}
export function addWallet(left:OrbWallet,right:OrbWallet):OrbWallet{return Object.fromEntries(CURRENCIES.map(currency=>[currency.id,left[currency.id]+right[currency.id]])) as OrbWallet;}

export function rollCurrencyDrops(seed:number,rolls:number,itemLevel:number):OrbWallet{
  let state=seed>>>0;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  const eligible=CURRENCIES.filter(currency=>currency.dropLevel<=itemLevel);const total=eligible.reduce((sum,currency)=>sum+currency.weight,0);const wallet=repairWallet();
  for(let index=0;index<rolls;index+=1){let pick=random()*total;const found=eligible.find(currency=>(pick-=currency.weight)<=0)??eligible[0];wallet[found.id]+=1;}
  return wallet;
}

export function formatCurrencyDrops(wallet:OrbWallet,limit=5){return CURRENCIES.filter(currency=>wallet[currency.id]>0).sort((a,b)=>wallet[b.id]-wallet[a.id]).slice(0,limit).map(currency=>`${currency.name} +${wallet[currency.id]}`).join(' · ');}
