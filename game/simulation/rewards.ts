import { CURRENCIES, EMPTY_ORBS } from '../content/currencies';
import type { OrbWallet } from '../core/types';
import type { MapCompletion } from './map';
import type { MonsterRank } from './combat';

export type RewardProgress={xp:number;items:number;orbs:number;gem:boolean};
export type RewardDelta={xp:number;itemStart:number;itemEnd:number;orbs:OrbWallet;gem:boolean;rank:MonsterRank};

const EMPTY_PROGRESS:RewardProgress={xp:0,items:0,orbs:0,gem:false};

function paced(total:number,kills:number,totalMonsters:number){
  if(total<=0||kills<=0)return 0;
  if(kills>=totalMonsters)return total;
  if(total===1)return 1;
  return Math.min(total,1+Math.floor((kills-1)*(total-1)/Math.max(1,totalMonsters-1)));
}

export function progressMapRewards(plan:MapCompletion,previous:RewardProgress|undefined,kills:number,totalMonsters:number,rank:MonsterRank){
  const prior=previous??EMPTY_PROGRESS;
  const highValueKill=rank!=='normal';
  const orbSequence=CURRENCIES.flatMap(currency=>Array.from({length:plan.orbs[currency.id]},()=>currency.id));
  const desiredXp=paced(plan.xp,kills,totalMonsters);
  const desiredItems=highValueKill?paced(plan.items.length,kills,totalMonsters):prior.items;
  const desiredOrbs=highValueKill?paced(orbSequence.length,kills,totalMonsters):prior.orbs;
  const desiredGem=prior.gem||(rank==='boss'&&Boolean(plan.gemDrop));
  const orbDelta={...EMPTY_ORBS};
  for(const id of orbSequence.slice(prior.orbs,desiredOrbs))orbDelta[id]+=1;
  return{
    progress:{xp:Math.max(prior.xp,desiredXp),items:Math.max(prior.items,desiredItems),orbs:Math.max(prior.orbs,desiredOrbs),gem:desiredGem},
    delta:{xp:Math.max(0,desiredXp-prior.xp),itemStart:prior.items,itemEnd:Math.max(prior.items,desiredItems),orbs:orbDelta,gem:desiredGem&&!prior.gem,rank},
  };
}
