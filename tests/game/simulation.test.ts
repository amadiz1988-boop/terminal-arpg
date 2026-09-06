import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { isSupportCompatible, SUPPORTS } from '../../game/content/supports';
import { createStarterWeapon } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';
import { completeCampaignOperation } from '../../game/progression/campaign';
import { exchangeMaps } from '../../game/progression/maps';
import { generateMonsterPacks, generateMonsterPopulation, getRunStopReason, progressPerTick, simulateMapCompletion } from '../../game/simulation/map';
import { simulateAcceleratedSession } from '../../game/simulation/session';
import type { Item } from '../../game/core/types';

const build = { skill: SKILLS.ember, weapon: createStarterWeapon() };

describe('simulation contracts', () => {
  it('replays map rewards from a seed', () => {
    expect(simulateMapCompletion(824, 1, 'full-clear', build)).toEqual(simulateMapCompletion(824, 1, 'full-clear', build));
  });

  it('scales progress against tier difficulty', () => {
    expect(progressPerTick(build, 1, 'full-clear')).toBeGreaterThan(progressPerTick(build, 3, 'full-clear'));
  });

  it('unlocks maps only after the final campaign operation', () => {
    expect(completeCampaignOperation(4, 'arc').maps).toBeUndefined();
    expect(completeCampaignOperation(5, 'arc').maps?.[1]).toBe(0);
    expect(completeCampaignOperation(5, 'arc').maps?.[2]).toBe(2);
  });

  it('delivers rewards that match the campaign promise', () => {
    expect(completeCampaignOperation(0, 'arc').item?.slot).toBe('armor');
    expect(completeCampaignOperation(1, 'arc').item?.rarity).toBe('RARE');
    expect(completeCampaignOperation(4, 'arc').item?.name).toContain('雷');
  });

  it('keeps T1 infinite and stops a depleted higher tier', () => {
    expect(getRunStopReason({ mode: 'count', completed: 2, goal: 5, elapsedMs: 1000, availableNext: 0, tier: 1 })).toBeNull();
    expect(getRunStopReason({ mode: 'count', completed: 2, goal: 5, elapsedMs: 1000, availableNext: 0, tier: 2 })).toContain('T2 地圖耗盡');
  });

  it('honors count and time stop conditions', () => {
    expect(getRunStopReason({ mode: 'count', completed: 5, goal: 5, elapsedMs: 1000, availableNext: 3, tier: 1 })).toBe('達到設定張數');
    expect(getRunStopReason({ mode: 'time', completed: 3, goal: 1, elapsedMs: 10_000, availableNext: 3, tier: 1 })).toBe('達到設定時間');
  });

  it('makes contract outcomes deterministic and changes rewards', () => {
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed')).toEqual(simulateMapCompletion(900, 2, 'currency', build, 'greed'));
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed').orbs.alteration).toBeGreaterThan(0);
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed').gemDrop).toBeDefined();
  });

  it('gives each map policy a measurable purpose', () => {
    const full = simulateMapCompletion(912, 2, 'full-clear', build);
    const rush = simulateMapCompletion(912, 2, 'boss-rush', build);
    const currency = simulateMapCompletion(912, 2, 'currency', build);
    expect(full.kills).toBeGreaterThan(rush.kills);
    expect(currency.orbs.alteration).toBeGreaterThan(rush.orbs.alteration);
    expect(rush.mapDropTier).toBeGreaterThanOrEqual(2);
  });

  it('lets mastery allocation create distinct character growth', () => {
    const base = resolveStats(build);
    const power = resolveStats({ ...build, masteries: { power: 2, tempo: 0, guard: 0 } });
    const guard = resolveStats({ ...build, masteries: { power: 0, tempo: 0, guard: 2 } });
    expect(power.dps).toBeGreaterThan(base.dps);
    expect(guard.life).toBeGreaterThan(base.life);
  });

  it('lets support choices trade clear speed for boss damage or defense', () => {
    const meleeBuild={skill:SKILLS.quake,weapon:createStarterWeapon('acolyte')};
    const linked: Item = { ...createStarterWeapon('acolyte'), links: 2, sockets: ['R','W'] };
    const clear = resolveStats({ ...meleeBuild, weapon:linked, supports: [SUPPORTS.momentum], supportSlots: 2 });
    const boss = resolveStats({ ...meleeBuild, weapon:linked, supports: [SUPPORTS.focus], supportSlots: 2 });
    const guard = resolveStats({ ...meleeBuild, weapon:linked, supports: [SUPPORTS.fortify], supportSlots: 2 });
    expect(clear.clearScore).toBeGreaterThan(boss.clearScore);
    expect(boss.bossDps).toBeGreaterThan(clear.bossDps);
    expect(guard.life).toBeGreaterThan(clear.life);
  });

  it('requires support conditions to match skill tags', () => {
    expect(isSupportCompatible(SUPPORTS.echo,SKILLS.firebolt.tags)).toBe(true);
    expect(isSupportCompatible(SUPPORTS.echo,SKILLS.venom.tags)).toBe(false);
    expect(isSupportCompatible(SUPPORTS.fortify,SKILLS.venom.tags)).toBe(true);
  });

  it('builds 400 to 600 field monsters into mixed packs and keeps one boss separate', () => {
    const population=generateMonsterPopulation(824);
    const packs=generateMonsterPacks(824,population);
    expect(population.total-1).toBeGreaterThanOrEqual(400);
    expect(population.total-1).toBeLessThanOrEqual(600);
    expect(population.boss).toBe(1);
    expect(packs.some(pack=>[pack.normal,pack.magic,pack.rare].filter(value=>value>0).length>=2)).toBe(true);
    expect(packs.every(pack=>pack.position<220)).toBe(true);
    expect(packs.reduce((sum,pack)=>sum+pack.normal+pack.magic+pack.rare+pack.special,0)).toBe(population.total-1);
  });

  it('makes higher monster ranks contribute more to rewards', () => {
    const result=simulateMapCompletion(824,1,'full-clear',build);
    expect(result.items.length).toBeGreaterThanOrEqual(4);
    expect(result.monsters.rare).toBeGreaterThan(0);
    expect(result.orbs.alteration).toBeGreaterThan(0);
  });

  it('passes the 30 minute equivalent play gate with measurable decisions', () => {
    const report = simulateAcceleratedSession(824, 45);
    console.info('ACCELERATED_PLAYTEST', JSON.stringify(report));
    expect(report.equivalentMinutes).toBeGreaterThanOrEqual(30);
    expect(report.mapsRun).toBe(45);
    expect(report.decisions).toBeGreaterThanOrEqual(14);
    expect(report.gemsFound).toBe(report.successes);
    expect(report.mapExchanges).toBeGreaterThanOrEqual(5);
    expect(report.longestMapsWithoutReward).toBeLessThanOrEqual(5);
    expect(report.lockouts).toBe(0);
    expect(report.orbsSpent).toBeGreaterThan(0);
    expect(report.powerGainPercent).toBeGreaterThanOrEqual(80);
    expect(report.tiersUnlocked).toBeGreaterThanOrEqual(3);
    expect(report.score).toBeGreaterThanOrEqual(7);
  });

  it('exchanges three maps into one higher tier without locking T1 play', () => {
    expect(exchangeMaps([0,3,0,0,0,0],1)).toEqual([0,0,1,0,0,0]);
  });
});
