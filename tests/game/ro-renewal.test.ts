import { describe, expect, it } from 'vitest';
import { passesDropRate, PORING_RENEWAL } from '../../game/ro/content/poring';
import {
  renewalBaseAttack,
  renewalHitChance,
  renewalMaxHp,
  renewalMaxSp,
  renewalMonsterFlee,
  renewalMonsterHit,
  renewalPlayerFlee,
  renewalPlayerHit,
} from '../../game/ro/formulas/renewal';
import { AUTOMATION_RULESET, RO_RULESET } from '../../game/ro/source';
import { fieldCell, fieldOffset, isWalkable, parseFld2 } from '../../game/ro/world/fld2';

const novice = { level: 1, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
const poring = { level: 1, ...PORING_RENEWAL.stats };

describe('pinned RO source baseline', () => {
  it('does not follow mutable upstream branches at runtime', () => {
    expect(RO_RULESET.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(AUTOMATION_RULESET.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('matches rAthena Renewal level-one derived stats', () => {
    expect(renewalPlayerHit(novice)).toBe(177);
    expect(renewalPlayerFlee(novice)).toBe(102);
    expect(renewalBaseAttack(novice)).toBe(1);
    expect(renewalMaxHp(40, novice.vit)).toBe(40);
    expect(renewalMaxSp(11, novice.int)).toBe(11);
  });

  it('uses rAthena monster defaults for omitted Poring stats', () => {
    expect(renewalMonsterHit(poring)).toBe(157);
    expect(renewalMonsterFlee(poring)).toBe(102);
    expect(renewalHitChance(renewalPlayerHit(novice), renewalMonsterFlee(poring))).toBe(75);
    expect(renewalHitChance(renewalMonsterHit(poring), renewalPlayerFlee(novice))).toBe(55);
  });

  it('uses the documented per-10000 drop rate boundary', () => {
    expect(passesDropRate(20, 19)).toBe(true);
    expect(passesDropRate(20, 20)).toBe(false);
    expect(() => passesDropRate(20, 10000)).toThrow(RangeError);
  });

  it('parses OpenKore FLD2 little-endian dimensions and row offsets', () => {
    const field = parseFld2(new Uint8Array([3, 0, 2, 0, 0, 1, 0, 1, 0, 1]));
    expect(field.width).toBe(3);
    expect(field.height).toBe(2);
    expect(fieldOffset(field, 2, 1)).toBe(5);
    expect(fieldCell(field, 1, 0)).toBe(1);
    expect(isWalkable(field, 0, 0)).toBe(true);
    expect(isWalkable(field, 1, 0)).toBe(false);
    expect(fieldOffset(field, 3, 0)).toBe(-1);
  });

  it('rejects truncated FLD2 data', () => {
    expect(() => parseFld2(new Uint8Array([2, 0, 2, 0, 0]))).toThrow(RangeError);
  });
});
