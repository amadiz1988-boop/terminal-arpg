import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { SUPPORTS } from '../../game/content/supports';
import { createStarterWeapon, evaluateItem, generateItem, itemLinks, itemSockets, refineItem, salvageValue } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';
import type { Item } from '../../game/core/types';

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

  it('generates visible sockets and links on socketable equipment',()=>{
    for(const slot of ['weapon','armor','helmet','gloves','boots'] as const){
      const item=generateItem(7200+slot.length,24,slot);
      expect(itemSockets(item).length).toBeGreaterThan(0);
      expect(itemLinks(item)).toBeGreaterThan(0);
    }
    expect(itemSockets(generateItem(7300,24,'amulet'))).toHaveLength(0);
  });

  it('spends crafting through an immutable item upgrade', () => {
    const original = createStarterWeapon();
    const refined = refineItem(original);
    expect(refined).not.toBe(original);
    expect(refined.affixes[0].value).toBeGreaterThan(original.affixes[0].value);
  });

  it('makes weapon links part of build power', () => {
    const oneLink = createStarterWeapon('mage');
    const threeLink: Item = { ...oneLink, id: 'three-link', links: 3, sockets: ['B','W','B'] };
    const build = { skill: SKILLS.firebolt, weapon: oneLink, supports: [SUPPORTS.echo], supportSlots: itemLinks(oneLink) };
    const current = resolveStats(build);
    const evaluation = evaluateItem(threeLink, build);
    expect(itemLinks(threeLink)).toBe(3);
    expect(evaluation.dpsDelta).toBeGreaterThan(15);
    expect(resolveStats({ ...build, weapon: threeLink, supportSlots: itemLinks(threeLink) }).dps).toBeGreaterThan(current.dps);
  });
});
