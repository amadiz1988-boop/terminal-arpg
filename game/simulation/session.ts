import { SKILLS } from '../content/skills';
import { SUPPORTS } from '../content/supports';
import { addWallet, EMPTY_ORBS } from '../content/currencies';
import type { BuildSnapshot, Item, ItemSlot, OrbWallet, SalvageMaterials, SkillId, SupportId } from '../core/types';
import { applyAlteration, applyChromatic, applyFusing, applyJeweller, createStarterWeapon, evaluateItem, itemLinks, salvageValue } from '../items/items';
import { resolveStats } from '../modifiers/resolve-stats';
import { exchangeMaps } from '../progression/maps';
import { unlockedTier } from '../progression/power';
import { simulateMapCompletion } from './map';

export type AcceleratedSessionReport = {
  equivalentMinutes:number; mapsRun:number; successes:number; deaths:number; decisions:number; upgrades:number;
  gemsFound:number; uniqueGems:number; orbsEarned:number; orbsSpent:number; mapExchanges:number; freeRuns:number;
  lockouts:number; longestMapsWithoutReward:number; startingDps:number; finalDps:number; powerGainPercent:number;
  tiersUnlocked:number;
};

export function simulateAcceleratedSession(seed=824,mapsToRun=45):AcceleratedSessionReport{
  const equipment:Partial<Record<ItemSlot,Item>>={weapon:createStarterWeapon('thief')};
  const knownSkills=new Set<SkillId>(['venom']); const knownSupports=new Set<SupportId>();
  let activeSkill:SkillId='venom'; let activeSupports:SupportId[]=[]; let talents:string[]=[]; let secondJob=false;
  let stock=[0,0,0,0,0,0]; let materials:SalvageMaterials={scrap:0,essence:0,core:0}; let orbs:OrbWallet={...EMPTY_ORBS};
  let successes=0,deaths=0,decisions=1,upgrades=0,gemsFound=0,orbsEarned=0,orbsSpent=0,mapExchanges=0,freeRuns=0,peakTier=1,mapsSinceReward=0,longestMapsWithoutReward=0;
  const snapshot=():BuildSnapshot=>({skill:SKILLS[activeSkill],...equipment,supports:activeSupports.map(id=>SUPPORTS[id]),supportSlots:itemLinks(equipment.weapon),talents,classId:'thief',secondJobId:secondJob?'assassin':undefined,ascendancyNodes:secondJob?['assassin-katar']:[]});
  const startingDps=resolveStats(snapshot()).dps;
  for(let index=0;index<mapsToRun;index+=1){
    if(index===6){talents=['hunt-speed'];decisions+=1;} if(index===12){talents.push('hunt-crit');secondJob=true;decisions+=2;}
    const allowed=unlockedTier(resolveStats(snapshot()).dps);peakTier=Math.max(peakTier,allowed);
    const tier=[5,4,3,2].find(value=>value<=allowed&&stock[value]>0)??1;if(tier===1)freeRuns+=1;else stock[tier]-=1;
    const result=simulateMapCompletion(seed+index,tier,index%3===0?'boss-rush':'full-clear',snapshot(),index%7===0?'greed':'scout');mapsSinceReward+=1;
    if(!result.success){deaths+=1;continue;}successes+=1;stock[1]+=1;if(result.mapDropTier>1)stock[result.mapDropTier]+=1;
    gemsFound+=1;if(result.gemDrop.type==='skill'){const before=knownSkills.size;knownSkills.add(result.gemDrop.id);if(knownSkills.size>before&&index%9===0){activeSkill=result.gemDrop.id;decisions+=1;}}
    else {const before=knownSupports.size;knownSupports.add(result.gemDrop.id);if(knownSupports.size>before){activeSupports=[...knownSupports].slice(0,Math.max(0,itemLinks(equipment.weapon)-1));decisions+=1;}}
    const gained=Object.values(result.orbs).reduce((a,b)=>a+b,0);orbsEarned+=gained;orbs=addWallet(orbs,result.orbs);longestMapsWithoutReward=Math.max(longestMapsWithoutReward,mapsSinceReward);mapsSinceReward=0;
    const evaluation=evaluateItem(result.item,snapshot());if(!equipment[result.item.slot]||evaluation.classification==='upgrade'){equipment[result.item.slot]=result.item;upgrades+=1;decisions+=1;}else{const gain=salvageValue(result.item);materials={scrap:materials.scrap+gain.scrap,essence:materials.essence+gain.essence,core:materials.core+gain.core};}
    if(stock[1]>=3){stock=exchangeMaps(stock,1);mapExchanges+=1;decisions+=1;}
    const weapon=equipment.weapon;const craft=weapon?(index%5===4?applyAlteration(weapon,9000+index):index%6===5?applyJeweller(weapon,9000+index):index%7===6?applyFusing(weapon,9000+index):index%8===7?applyChromatic(weapon,9000+index):null):null;
    const orb= index%5===4?'alteration':index%6===5?'jeweller':index%7===6?'fusing':'chromatic';
    if(craft?.applied&&orbs[orb]>0){equipment.weapon=craft.item;orbs[orb]-=1;orbsSpent+=1;decisions+=1;}
  }
  longestMapsWithoutReward=Math.max(longestMapsWithoutReward,mapsSinceReward);const finalDps=resolveStats(snapshot()).dps;const powerGainPercent=Math.round((finalDps/startingDps-1)*100);
  return{equivalentMinutes:Math.round(mapsToRun*42/60*10)/10,mapsRun:mapsToRun,successes,deaths,decisions,upgrades,gemsFound,uniqueGems:knownSkills.size+knownSupports.size,orbsEarned,orbsSpent,mapExchanges,freeRuns,lockouts:0,longestMapsWithoutReward,startingDps,finalDps,powerGainPercent,tiersUnlocked:peakTier};
}
