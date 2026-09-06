import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { SUPPORTS } from '../../game/content/supports';
import { applyAlteration, applyChromatic, applyFusing, applyJeweller, createStarterWeapon, evaluateItem, generateItem, itemLinks, itemSockets, maxSocketsForItem, refineItem, salvageValue } from '../../game/items/items';
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
    const original = generateItem(824,24,'weapon');
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
    expect(evaluation.dpsDelta).toBeGreaterThan(0);
    expect(resolveStats({ ...build, weapon: threeLink, supportSlots: itemLinks(threeLink) }).dps).toBeGreaterThan(current.dps);
  });

  it('uses alteration only to reroll all modifiers on magic items',()=>{
    const magic={...generateItem(8100,24,'weapon'),rarity:'MAGIC' as const};
    const rare={...magic,rarity:'RARE' as const};
    const result=applyAlteration(magic,88);
    expect(result.applied).toBe(true);
    expect(result.item.affixes[0].id).not.toBe(magic.affixes[0].id);
    expect(applyAlteration(rare,88).applied).toBe(false);
  });

  it('rerolls socket colors without changing socket count or links',()=>{
    const item={...generateItem(8200,36,'armor'),sockets:['R','G','B'] as Array<'R'|'G'|'B'>,links:2};
    const result=applyChromatic(item,91);
    expect(result.applied).toBe(true);
    expect(result.item.sockets).toHaveLength(3);
    expect(result.item.links).toBe(2);
  });

  it('rerolls socket count within item level and base limits',()=>{
    const item:Item={...generateItem(8300,24,'weapon'),baseId:'short-bow',sockets:['G'],links:1};
    const result=applyJeweller(item,92);
    expect(result.applied).toBe(true);
    expect(result.item.sockets?.length).not.toBe(1);
    expect(result.item.sockets!.length).toBeLessThanOrEqual(maxSocketsForItem(item));
    const maxed:Item={...item,sockets:Array.from({length:maxSocketsForItem(item)},()=> 'G' as const)};
    expect(applyJeweller(maxed,93).applied).toBe(false);
  });

  it('rerolls links while preserving socket count and colors',()=>{
    const item={...generateItem(8400,36,'armor'),sockets:['R','G','B'] as Array<'R'|'G'|'B'>,links:1};
    const result=applyFusing(item,94);
    expect(result.applied).toBe(true);
    expect(result.item.sockets).toEqual(item.sockets);
    expect(result.item.links).not.toBe(1);
  });
});
