import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRandom } from '../../game/core/random';
import {
  PRT_FILD08,
  PRT_FILD08_MONSTER_COUNT,
  PRT_FILD08_MONSTER_COUNTS,
  PRT_FILD08_PORING_COUNT,
} from '../../game/ro/content/prt-fild08';
import { PRT_FILD08_MONSTERS } from '../../game/ro/content/monsters';
import { parseFld2, isWalkable } from '../../game/ro/world/fld2';
import {
  createPoringPositions,
  isNearWarpPortal,
  randomTeleportPosition,
  shortestPath,
} from '../../game/ro/world/navigation';
import {
  advanceRoWorld,
  allocateNoviceSkill,
  allocateStatusPoint,
  createRoWorld,
  equipInventoryItem,
  OPENKORE_CLIENT_SIGHT,
  resetStatusPoints,
} from '../../game/ro/world/simulation';

const compressed = readFileSync(
  new URL('../../public/ro/maps/prt_fild08.fld2.gz', import.meta.url),
);
const field = parseFld2(gunzipSync(compressed));

describe('pinned prt_fild08 world', () => {
  it('loads the real OpenKore field dimensions and walkable entry', () => {
    expect(field.width).toBe(400);
    expect(field.height).toBe(400);
    expect(
      isWalkable(field, PRT_FILD08.noviceEntry.x, PRT_FILD08.noviceEntry.y),
    ).toBe(true);
  });

  it('spawns all 87 source-defined Poring actors deterministically', () => {
    const first = createPoringPositions(field, 824);
    const second = createPoringPositions(field, 824);
    expect(first).toEqual(second);
    expect(first).toHaveLength(PRT_FILD08_PORING_COUNT);
    expect(first.every(({ x, y }) => isWalkable(field, x, y))).toBe(true);
    expect(
      shortestPath(field, PRT_FILD08.noviceEntry, first[0]).length,
    ).toBeGreaterThan(0);
  });

  it('returns a continuous one-cell walking route', () => {
    const [target] = createPoringPositions(field, 824);
    const path = shortestPath(field, PRT_FILD08.noviceEntry, target);
    let previous = PRT_FILD08.noviceEntry;
    for (const step of path) {
      expect(
        Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y),
      ).toBe(1);
      previous = step;
    }
    expect(previous).toEqual(target);
  });

  it('preserves the five renewal prt_fild08 warp portals', () => {
    expect(PRT_FILD08.warpPortals).toEqual([
      {
        centerX: 16,
        centerY: 187,
        spanX: 3,
        spanY: 17,
        destination: 'prt_fild07',
      },
      {
        centerX: 16,
        centerY: 239,
        spanX: 3,
        spanY: 15,
        destination: 'prt_fild07',
      },
      {
        centerX: 170,
        centerY: 378,
        spanX: 3,
        spanY: 2,
        destination: 'prontera',
      },
      {
        centerX: 233,
        centerY: 16,
        spanX: 12,
        spanY: 1,
        destination: 'moc_fild01',
      },
      {
        centerX: 55,
        centerY: 21,
        spanX: 4,
        spanY: 2,
        destination: 'moc_fild01',
      },
    ]);
  });

  it('chooses only legal non-portal cells for Fly Wing teleport', () => {
    const random = createRandom(824);
    for (let index = 0; index < 100; index += 1) {
      const position = randomTeleportPosition(field, random);
      expect(position.x).toBeGreaterThanOrEqual(15);
      expect(position.x).toBeLessThanOrEqual(384);
      expect(position.y).toBeGreaterThanOrEqual(15);
      expect(position.y).toBeLessThanOrEqual(384);
      expect(isWalkable(field, position.x, position.y)).toBe(true);
      expect(isNearWarpPortal(position)).toBe(false);
    }
  });

  it('targets an actor inside the OpenKore client sight before teleporting', () => {
    const world = createRoWorld(field, 824);
    for (const monster of world.monsters) {
      monster.alive = false;
      monster.respawnAt = null;
    }
    const nearby = [
      { x: world.player.position.x + 1, y: world.player.position.y },
      { x: world.player.position.x - 1, y: world.player.position.y },
      { x: world.player.position.x, y: world.player.position.y + 1 },
      { x: world.player.position.x, y: world.player.position.y - 1 },
    ].find((position) => isWalkable(field, position.x, position.y));
    expect(nearby).toBeDefined();
    world.monsters[0].alive = true;
    world.monsters[0].position = nearby!;
    world.monsters[0].hp = PRT_FILD08_MONSTERS[world.monsters[0].monster].hp;
    world.inventory.Wing_Of_Fly = 1;
    const result = advanceRoWorld(world, field, 1);
    expect(OPENKORE_CLIENT_SIGHT).toBe(17);
    expect(result.events.some((event) => event.type === 'target')).toBe(true);
    expect(result.events.some((event) => event.type === 'teleport')).toBe(
      false,
    );
    expect(result.inventory.Wing_Of_Fly).toBe(1);
  });

  it('uses one Fly Wing when no monster is visible', () => {
    const world = createRoWorld(field, 824);
    for (const monster of world.monsters) {
      monster.alive = false;
      monster.respawnAt = null;
    }
    world.inventory.Wing_Of_Fly = 1;
    const result = advanceRoWorld(world, field, 1);
    expect(result.events.some((event) => event.type === 'teleport')).toBe(true);
    expect(result.inventory.Wing_Of_Fly).toBeUndefined();
    expect(result.flyWingsUsed).toBe(1);
    expect(
      isWalkable(field, result.player.position.x, result.player.position.y),
    ).toBe(true);
    expect(isNearWarpPortal(result.player.position)).toBe(false);
  });

  it('leaves the player and Fly Wing untouched while automation is stopped', () => {
    const world = createRoWorld(field, 824);
    for (const monster of world.monsters) {
      monster.alive = false;
      monster.respawnAt = null;
    }
    world.inventory.Wing_Of_Fly = 1;
    const result = advanceRoWorld(world, field, 1_000, false);
    expect(result.player.position).toEqual(world.player.position);
    expect(result.inventory.Wing_Of_Fly).toBe(1);
    expect(result.flyWingsUsed).toBe(0);
    expect(result.events.some((event) => event.type === 'teleport')).toBe(
      false,
    );
  });

  it('walks one cell at a time when no monster and no Fly Wing are available', () => {
    const world = createRoWorld(field, 824);
    for (const monster of world.monsters) {
      monster.alive = false;
      monster.respawnAt = null;
    }
    const result = advanceRoWorld(world, field, 200);
    const move = result.events.find((event) => event.type === 'move');
    expect(result.events.some((event) => event.type === 'random_walk')).toBe(
      true,
    );
    expect(move?.position).toBeDefined();
    expect(
      Math.abs(move!.position!.x - world.player.position.x) +
        Math.abs(move!.position!.y - world.player.position.y),
    ).toBe(1);
  });

  it('preserves the exact simulation when paused and resumed', () => {
    const initial = createRoWorld(field, 824);
    const uninterrupted = advanceRoWorld(initial, field, 60_000);
    const paused = advanceRoWorld(initial, field, 30_000);
    const resumed = advanceRoWorld(paused, field, 30_000);
    expect(resumed).toEqual(uninterrupted);
  });

  it('spawns all five source-defined monster populations', () => {
    const world = createRoWorld(field, 824);
    expect(world.monsters).toHaveLength(PRT_FILD08_MONSTER_COUNT);
    expect(
      Object.fromEntries(
        Object.keys(PRT_FILD08_MONSTER_COUNTS).map((key) => [
          key,
          world.monsters.filter((monster) => monster.monster === key).length,
        ]),
      ),
    ).toEqual(PRT_FILD08_MONSTER_COUNTS);
  });

  it('keeps the exact rAthena spawn areas and fixed respawn delays', () => {
    expect(
      PRT_FILD08.monsterSpawns
        .filter((spawn) => spawn.monster === 'LUNATIC' && spawn.count === 10)
        .map(({ centerX, centerY, width, height }) => [
          centerX,
          centerY,
          width,
          height,
        ]),
    ).toEqual([
      [228, 230, 30, 30],
      [246, 263, 50, 50],
      [190, 237, 50, 50],
      [100, 256, 50, 50],
    ]);
    expect(
      PRT_FILD08.monsterSpawns
        .filter((spawn) => spawn.monster === 'FABRE' && spawn.count === 20)
        .map(({ centerX, centerY, width, height }) => [
          centerX,
          centerY,
          width,
          height,
        ]),
    ).toEqual([
      [70, 164, 70, 70],
      [144, 147, 70, 70],
      [263, 79, 90, 90],
    ]);
    expect(
      PRT_FILD08.monsterSpawns.every((spawn) => spawn.respawnVarianceMs === 0),
    ).toBe(true);
  });

  it('keeps monsters moving while player automation is stopped', () => {
    const world = createRoWorld(field, 824);
    const playerPosition = world.player.position;
    const positions = world.monsters.map((monster) => monster.position);
    const stopped = advanceRoWorld(world, field, 3_000, false);
    expect(stopped.player.position).toEqual(playerPosition);
    expect(
      stopped.monsters.some(
        (monster, index) =>
          monster.position.x !== positions[index].x ||
          monster.position.y !== positions[index].y,
      ),
    ).toBe(true);
  });

  it('keeps monster respawn timers running while player automation is stopped', () => {
    const world = createRoWorld(field, 824);
    const monster = world.monsters[0];
    monster.alive = false;
    monster.hp = 0;
    monster.respawnAt = monster.respawnMs;
    const waiting = advanceRoWorld(world, field, monster.respawnMs - 1, false);
    expect(waiting.monsters[0].alive).toBe(false);
    const respawned = advanceRoWorld(waiting, field, 1, false);
    expect(respawned.monsters[0].alive).toBe(true);
    expect(respawned.monsters[0].hp).toBe(
      PRT_FILD08_MONSTERS[respawned.monsters[0].monster].hp,
    );
    expect(
      isWalkable(
        field,
        respawned.monsters[0].position.x,
        respawned.monsters[0].position.y,
      ),
    ).toBe(true);
    expect(respawned.player.position).toEqual(world.player.position);
  });

  it('keeps a dead player stopped, then respawns at the save point after four seconds', () => {
    const world = createRoWorld(field, 824);
    world.status = 'dead';
    world.player.hp = 0;
    world.player.deadAt = 0;
    world.player.respawnAt = 4_000;
    const stopped = advanceRoWorld(world, field, 5_000, false);
    expect(stopped.status).toBe('dead');
    expect(stopped.player.hp).toBe(0);
    const resumed = advanceRoWorld(stopped, field, 1, true);
    expect(resumed.status).toBe('running');
    expect(
      resumed.events.find((event) => event.type === 'respawn')?.position,
    ).toEqual(world.player.savePoint);
    expect(resumed.player.hp).toBe(resumed.player.maxHp);
    expect(resumed.player.sp).toBe(resumed.player.maxSp);
    expect(resumed.events.some((event) => event.type === 'respawn')).toBe(true);
  });

  it('awards real level points and allows reversible allocations', () => {
    const progressed = advanceRoWorld(
      createRoWorld(field, 824),
      field,
      120_000,
    );
    expect(progressed.player.baseLevel).toBeGreaterThan(1);
    expect(progressed.player.jobLevel).toBeGreaterThan(1);
    expect(progressed.player.statusPoints).toBeGreaterThan(0);
    expect(progressed.player.skillPoints).toBeGreaterThan(0);
    const stronger = allocateStatusPoint(progressed, 'str');
    expect(stronger.player.stats.str).toBe(2);
    const skilled = allocateNoviceSkill(stronger);
    expect(skilled.player.skills.NV_BASIC).toBe(1);
    const reset = resetStatusPoints(skilled);
    expect(reset.player.stats.str).toBe(1);
    expect(reset.player.statusPoints).toBeGreaterThan(
      stronger.player.statusPoints,
    );
  });

  it('equips an eligible dropped weapon and returns the replaced weapon', () => {
    const world = createRoWorld(field, 824);
    world.player.baseLevel = 2;
    world.inventory.Sword_ = 1;
    const equipped = equipInventoryItem(world, 'Sword_');
    expect(equipped.player.equipment.rightHand).toBe('Sword_');
    expect(equipped.inventory.Knife_).toBe(1);
    expect(equipped.inventory.Sword_).toBeUndefined();
  });

  it('walks, trades hits, kills, drops, and picks up through causal events', () => {
    const result = advanceRoWorld(createRoWorld(field, 824), field, 120_000);
    expect(result.events.some((event) => event.type === 'move')).toBe(true);
    expect(result.events.some((event) => event.type === 'player_hit')).toBe(
      true,
    );
    expect(result.events.some((event) => event.type === 'monster_hit')).toBe(
      true,
    );
    expect(result.events.some((event) => event.type === 'death')).toBe(true);

    for (const event of result.events.filter(
      (candidate) => candidate.type === 'drop',
    )) {
      expect(
        result.events.some(
          (candidate) =>
            candidate.type === 'death' &&
            candidate.actorId === event.actorId &&
            candidate.atMs === event.atMs,
        ),
      ).toBe(true);
    }
    for (const event of result.events.filter(
      (candidate) => candidate.type === 'pickup',
    )) {
      expect(
        result.events.some(
          (candidate) =>
            candidate.type === 'drop' &&
            candidate.item === event.item &&
            candidate.atMs <= event.atMs,
        ),
      ).toBe(true);
    }
  });

  it('never moves the player farther than one cell per movement event', () => {
    const result = advanceRoWorld(createRoWorld(field, 824), field, 120_000);
    let previous = PRT_FILD08.noviceEntry;
    for (const event of result.events) {
      if (event.type === 'teleport') {
        previous = event.position!;
        continue;
      }
      if (event.type !== 'move') continue;
      expect(event.position).toBeDefined();
      expect(
        Math.abs(event.position!.x - previous.x) +
          Math.abs(event.position!.y - previous.y),
      ).toBe(1);
      previous = event.position!;
    }
  });

  it('runs a 30-minute accelerated diagnostic without fabricated batch combat', () => {
    const result = advanceRoWorld(
      createRoWorld(field, 824),
      field,
      30 * 60_000,
    );
    console.log('RO_STRESS_DIAGNOSTIC', {
      status: result.status,
      elapsedMs: result.nowMs,
      kills: result.kills,
      baseExp: result.player.baseExp,
      jobExp: result.player.jobExp,
      hp: result.player.hp,
      events: result.events.length,
      flyWingsUsed: result.flyWingsUsed,
      inventory: result.inventory,
    });
    expect(result.nowMs).toBeLessThanOrEqual(30 * 60_000);
    expect(
      result.events.filter((event) => event.type === 'death'),
    ).toHaveLength(result.kills);
    expect(result.player.baseExp).toBe(
      result.events
        .filter((event) => event.type === 'death')
        .reduce((sum, event) => sum + (event.amount ?? 0), 0),
    );
    expect(result.player.jobExp).toBe(
      result.events
        .filter((event) => event.type === 'death')
        .reduce((sum, event) => sum + (event.jobAmount ?? 0), 0),
    );
  });
});
