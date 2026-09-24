import { describe, expect, it } from 'vitest';
import {
  NATIVE_COMBAT_EVENT_TYPES,
  nativeLifeEventLine,
  parseLifeEventFacts,
} from '../../ops/ro-stack/web-observation.mjs';

describe('native SERVER_AGENT combat log projection', () => {
  it('only lists event types the native Event Ledger actually persists', () => {
    expect([...NATIVE_COMBAT_EVENT_TYPES].sort()).toEqual(
      [
        'LOOT_ACQUIRED',
        'MAP_CHANGED',
        'MONSTER_ATTACK',
        'MONSTER_HIT',
        'MONSTER_KILL',
        'MONSTER_TARGET',
        'NPC_INTERACTION',
        'SESSION_ENDED',
        'SESSION_STARTED',
      ].sort(),
    );
  });

  it('parses JSON facts defensively', () => {
    expect(parseLifeEventFacts('{"mobId":1002}')).toEqual({ mobId: 1002 });
    expect(parseLifeEventFacts('')).toEqual({});
    expect(parseLifeEventFacts('not json')).toEqual({});
    expect(parseLifeEventFacts({ itemId: 501 })).toEqual({ itemId: 501 });
  });

  it('renders a native MONSTER_KILL into the existing terminal grammar', () => {
    const line = nativeLifeEventLine({
      eventType: 'MONSTER_KILL',
      map: 'prt_fild08',
      facts: { mobId: 1002 },
      mobName: '波利',
    });
    expect(line).toBe('Target Monster 波利 (1002) died');
    // The last-good renderer's own regex must still match the native line.
    expect(/Target Monster (.+?)(?:\s+\(\d+\))? died/.exec(line)?.[1]).toBe(
      '波利',
    );
  });

  it('falls back to the mob id when no localized name is available', () => {
    expect(
      nativeLifeEventLine({
        eventType: 'MONSTER_KILL',
        facts: { mobId: 1002 },
      }),
    ).toBe('Target Monster Monster #1002 (1002) died');
  });

  it('renders native LOOT_ACQUIRED into the inventory grammar', () => {
    const line = nativeLifeEventLine({
      eventType: 'LOOT_ACQUIRED',
      facts: { itemId: 909, amount: 3 },
      itemName: '傑勒比結晶',
    });
    expect(line).toBe('Item added to inventory: 傑勒比結晶 (909) x 3');
    expect(
      /Item added to inventory: (.+?) \(\d+\) x (\d+)/.exec(line)?.slice(1),
    ).toEqual(['傑勒比結晶', '3']);
  });

  it('renders map and npc facts and ignores unknown event types', () => {
    expect(
      nativeLifeEventLine({ eventType: 'MAP_CHANGED', map: 'prt_fild08' }),
    ).toBe('Map Change: prt_fild08');
    expect(
      nativeLifeEventLine({
        eventType: 'NPC_INTERACTION',
        facts: { npc: '卡普拉' },
      }),
    ).toBe('NPC Interaction: 卡普拉');
    expect(nativeLifeEventLine({ eventType: 'SOMETHING_ELSE' })).toBeNull();
  });

  it('renders native TARGET/ATTACK into the targeting grammar', () => {
    expect(
      nativeLifeEventLine({
        eventType: 'MONSTER_TARGET',
        facts: { mobId: 1002, entityId: 4567, distance: 3 },
        mobName: '波利',
      }),
    ).toBe('You are now attacking Monster 波利 (4567)');
    expect(
      nativeLifeEventLine({
        eventType: 'MONSTER_ATTACK',
        facts: { mobId: 1002, entityId: 4567 },
        mobName: '波利',
      }),
    ).toBe('You attack Monster 波利 (4567)');
  });

  it('renders native HIT with entity identity and damage for the float path', () => {
    const line = nativeLifeEventLine({
      eventType: 'MONSTER_HIT',
      facts: {
        mobId: 1002,
        entityId: 4567,
        damage: 42,
        hpBefore: 90,
        hpAfter: 48,
      },
      mobName: '波利',
    });
    expect(line).toBe('You attack Monster 波利 (4567) (Dmg: 42)');
    // The last-good damage renderer must still parse the native HIT line.
    expect(/Monster (.+?) \((\d+)\)/.exec(line)?.slice(1)).toEqual([
      '波利',
      '4567',
    ]);
    expect(/\(Dmg: ([^)]+)\)/.exec(line)?.[1]).toBe('42');
  });
});
