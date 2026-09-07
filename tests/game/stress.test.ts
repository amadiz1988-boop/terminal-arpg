import { describe,expect,it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { EMPTY_ORBS } from '../../game/content/currencies';
import { createStarterWeapon } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';
import { simulateMapCompletion } from '../../game/simulation/map';
import { progressMapRewards } from '../../game/simulation/rewards';
import { simulateAcceleratedSession } from '../../game/simulation/session';

const build={skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief' as const};

describe('release stress gate',()=>{
  it('survives 5,000 deterministic map outcomes without invalid rewards',()=>{
    for(let seed=1;seed<=1000;seed+=1)for(let tier=1;tier<=5;tier+=1){
      const result=simulateMapCompletion(seed,tier,'full-clear',build,'scout','arsenal',true);
      expect(result.monsters.total).toBeGreaterThanOrEqual(401);
      expect(result.monsters.total).toBeLessThanOrEqual(601);
      expect(result.items.length).toBeGreaterThanOrEqual(4);
      expect(result.xp).toBeGreaterThan(0);
      expect(Object.values(result.orbs).reduce((sum,value)=>sum+value,0)).toBeGreaterThanOrEqual(8);
      expect(Number.isFinite(resolveStats(build).dps)).toBe(true);
    }
  });

  it('conserves all rewards across 1,000 progressive kill ledgers',()=>{
    for(let seed=1;seed<=1000;seed+=1){
      const plan=simulateMapCompletion(seed,1,'full-clear',build,'scout','arsenal',true);
      const first=progressMapRewards(plan,undefined,1,plan.monsters.total,'normal');
      const middle=progressMapRewards(plan,first.progress,Math.ceil(plan.monsters.total/2),plan.monsters.total,'rare');
      const final=progressMapRewards(plan,middle.progress,plan.monsters.total,plan.monsters.total,'boss');
      expect(final.progress.xp).toBe(plan.xp);
      expect(final.progress.items).toBe(plan.items.length);
      expect(final.progress.orbs).toBe(Object.values(plan.orbs).reduce((sum,value)=>sum+value,0));
      expect(final.progress.gem).toBe(true);
      expect(Object.keys(final.delta.orbs)).toEqual(Object.keys(EMPTY_ORBS));
    }
  });

  it('runs a 1,000-map accelerated account without lockout or numeric overflow',()=>{
    const report=simulateAcceleratedSession(824,1000);
    expect(report.mapsRun).toBe(1000);
    expect(report.lockouts).toBe(0);
    expect(report.orbsEarned).toBeGreaterThan(0);
    expect(report.mapExchanges).toBeGreaterThan(0);
    expect(Number.isFinite(report.finalDps)).toBe(true);
    expect(report.finalDps).toBeGreaterThan(0);
  });
});
