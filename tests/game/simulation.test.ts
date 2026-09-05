import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { createStarterWeapon } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';
import { completeCampaignOperation } from '../../game/progression/campaign';
import { getRunStopReason, progressPerTick, selectNextTier, simulateMapCompletion } from '../../game/simulation/map';

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
    expect(completeCampaignOperation(5, 'arc').maps?.[1]).toBe(6);
  });

  it('delivers rewards that match the campaign promise', () => {
    expect(completeCampaignOperation(0, 'arc').item?.slot).toBe('armor');
    expect(completeCampaignOperation(1, 'arc').item?.rarity).toBe('RARE');
    expect(completeCampaignOperation(4, 'arc').item?.name).toContain('雷');
  });

  it('stops every run mode when the selected map tier is exhausted', () => {
    expect(getRunStopReason({ mode: 'count', completed: 2, goal: 5, elapsedMs: 1000, availableNext: 0, tier: 1 })).toBe('T1 地圖耗盡');
  });

  it('honors count and time stop conditions', () => {
    expect(getRunStopReason({ mode: 'count', completed: 5, goal: 5, elapsedMs: 1000, availableNext: 3, tier: 1 })).toBe('達到設定張數');
    expect(getRunStopReason({ mode: 'time', completed: 3, goal: 1, elapsedMs: 10_000, availableNext: 3, tier: 1 })).toBe('達到設定時間');
  });

  it('makes contract outcomes deterministic and changes rewards', () => {
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed')).toEqual(simulateMapCompletion(900, 2, 'currency', build, 'greed'));
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed').currency).toBeGreaterThanOrEqual(simulateMapCompletion(900, 2, 'currency', build, 'scout').currency);
  });

  it('lets mastery allocation create distinct character growth', () => {
    const base = resolveStats(build);
    const power = resolveStats({ ...build, masteries: { power: 2, tempo: 0, guard: 0 } });
    const guard = resolveStats({ ...build, masteries: { power: 0, tempo: 0, guard: 2 } });
    expect(power.dps).toBeGreaterThan(base.dps);
    expect(guard.life).toBeGreaterThan(base.life);
  });

  it('continues into the highest available tier instead of stopping on ascent', () => {
    expect(selectNextTier([0, 0, 0, 0, 1, 0], 3)).toBe(4);
    expect(selectNextTier([0, 0, 0, 0, 0, 0], 5)).toBeNull();
  });
});
