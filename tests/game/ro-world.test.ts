import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRT_FILD08, PRT_FILD08_PORING_COUNT } from '../../game/ro/content/prt-fild08';
import { parseFld2, isWalkable } from '../../game/ro/world/fld2';
import { createPoringPositions, shortestPath } from '../../game/ro/world/navigation';
import { advanceRoWorld, createRoWorld } from '../../game/ro/world/simulation';

const compressed = readFileSync(new URL('../../public/ro/maps/prt_fild08.fld2.gz', import.meta.url));
const field = parseFld2(gunzipSync(compressed));

describe('pinned prt_fild08 world', () => {
  it('loads the real OpenKore field dimensions and walkable entry', () => {
    expect(field.width).toBe(400);
    expect(field.height).toBe(400);
    expect(isWalkable(field, PRT_FILD08.noviceEntry.x, PRT_FILD08.noviceEntry.y)).toBe(true);
  });

  it('spawns all 87 Porings on distinct reachable cells deterministically', () => {
    const first = createPoringPositions(field, 824);
    const second = createPoringPositions(field, 824);
    expect(first).toEqual(second);
    expect(first).toHaveLength(PRT_FILD08_PORING_COUNT);
    expect(new Set(first.map(({ x, y }) => `${x},${y}`)).size).toBe(PRT_FILD08_PORING_COUNT);
    expect(first.every(({ x, y }) => isWalkable(field, x, y))).toBe(true);
    expect(shortestPath(field, PRT_FILD08.noviceEntry, first[0]).length).toBeGreaterThan(0);
  });

  it('returns a continuous one-cell walking route', () => {
    const [target] = createPoringPositions(field, 824);
    const path = shortestPath(field, PRT_FILD08.noviceEntry, target);
    let previous = PRT_FILD08.noviceEntry;
    for (const step of path) {
      expect(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y)).toBe(1);
      previous = step;
    }
    expect(previous).toEqual(target);
  });

  it('preserves the exact simulation when paused and resumed', () => {
    const initial = createRoWorld(field, 824);
    const uninterrupted = advanceRoWorld(initial, field, 60_000);
    const paused = advanceRoWorld(initial, field, 30_000);
    const resumed = advanceRoWorld(paused, field, 30_000);
    expect(resumed).toEqual(uninterrupted);
  });

  it('walks, trades hits, kills, drops, and picks up through causal events', () => {
    const result = advanceRoWorld(createRoWorld(field, 824), field, 120_000);
    expect(result.events.some((event) => event.type === 'move')).toBe(true);
    expect(result.events.some((event) => event.type === 'player_hit')).toBe(true);
    expect(result.events.some((event) => event.type === 'monster_hit')).toBe(true);
    expect(result.events.some((event) => event.type === 'death')).toBe(true);

    for (const event of result.events.filter((candidate) => candidate.type === 'drop')) {
      expect(
        result.events.some(
          (candidate) =>
            candidate.type === 'death' && candidate.actorId === event.actorId && candidate.atMs === event.atMs,
        ),
      ).toBe(true);
    }
    for (const event of result.events.filter((candidate) => candidate.type === 'pickup')) {
      expect(
        result.events.some(
          (candidate) =>
            candidate.type === 'drop' && candidate.item === event.item && candidate.atMs <= event.atMs,
        ),
      ).toBe(true);
    }
  });

  it('never moves the player farther than one cell per movement event', () => {
    const result = advanceRoWorld(createRoWorld(field, 824), field, 120_000);
    let previous = PRT_FILD08.noviceEntry;
    for (const event of result.events.filter((candidate) => candidate.type === 'move')) {
      expect(event.position).toBeDefined();
      expect(Math.abs(event.position!.x - previous.x) + Math.abs(event.position!.y - previous.y)).toBe(1);
      previous = event.position!;
    }
  });

  it('runs a 30-minute accelerated diagnostic without fabricated batch combat', () => {
    const result = advanceRoWorld(createRoWorld(field, 824), field, 30 * 60_000);
    console.log('RO_STRESS_DIAGNOSTIC', {
      status: result.status,
      elapsedMs: result.nowMs,
      kills: result.kills,
      baseExp: result.player.baseExp,
      jobExp: result.player.jobExp,
      hp: result.player.hp,
      events: result.events.length,
      inventory: result.inventory,
    });
    expect(result.nowMs).toBeLessThanOrEqual(30 * 60_000);
    expect(result.events.filter((event) => event.type === 'death')).toHaveLength(result.kills);
    expect(result.player.baseExp).toBe(result.kills * 150);
    expect(result.player.jobExp).toBe(result.kills * 40);
  });
});
