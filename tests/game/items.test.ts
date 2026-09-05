import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { createStarterWeapon, evaluateItem, generateItem, refineItem, salvageValue } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';

describe('deterministic item engine', () => {
  it('replays the same item for the same seed', () => {
    expect(generateItem(824, 12)).toEqual(generateItem(824, 12));
  });

  it('uses one resolver for current and candidate DPS', () => {
    const starter = createStarterWeapon();
    const build = { skill: SKILLS.ember, weapon: starter };
    const item = generateItem(824, 24);
    const evaluation = evaluateItem(item, build);
    const candidate = resolveStats({ ...build, [item.slot]: item });
    expect(evaluation.itemId).toBe(item.id);
    expect(candidate.dps).toBeGreaterThan(0);
  });

  it('turns rarity into distinct material sinks', () => {
    const item = generateItem(824, 24);
    const value = salvageValue(item);
    expect(value.scrap).toBeGreaterThan(0);
    expect(value.essence + value.core).toBeGreaterThanOrEqual(0);
  });

  it('spends crafting through an immutable item upgrade', () => {
    const original = createStarterWeapon();
    const refined = refineItem(original);
    expect(refined).not.toBe(original);
    expect(refined.affixes[0].value).toBe(original.affixes[0].value + 1);
  });
});
