import { createRandom } from '../core/random';
import type { BuildSnapshot, MonsterPack, SkillId } from '../core/types';
import { resolveDefaultAttack, resolveStats } from '../modifiers/resolve-stats';
import type { RewardProgress } from './rewards';
import type { MapCompletion } from './map';

export const MAP_WIDTH = 64,
  MAP_HEIGHT = 40,
  MAP_SIZE = MAP_WIDTH * MAP_HEIGHT;
export type CombatEvent = { kind: string; text: string };
export type MonsterRank = 'normal' | 'magic' | 'rare' | 'special' | 'boss';
export type CombatPhase = 'search' | 'travel' | 'combat' | 'complete' | 'dead';
export type CombatTarget = {
  id: string;
  rank: MonsterRank;
  position: number;
  maxLife: number;
  life?: number;
};
export type CombatState = {
  phase: CombatPhase;
  targets: CombatTarget[];
  target?: CombatTarget;
  targetLife: number;
  playerPosition: number;
  path: number[];
  travel?: number;
  travelMode?: 'target' | 'explore';
  explored: number[];
  attackFrom?: number;
  attackTo?: number;
  kills: number;
  totalMonsters: number;
  lastKillRank?: MonsterRank;
  killRanks?: MonsterRank[];
  rewardProgress?: RewardProgress;
  rewardPlan?: MapCompletion;
  life: number;
  maxLife: number;
  mana: number;
  maxMana: number;
  lifeFlaskCharges: number;
  manaFlaskCharges: number;
  lifeRecovery: number;
  manaRecovery: number;
  enemyClock: number;
  playerClock: number;
  action: number;
  events: CombatEvent[];
};

export const SKILL_MANA_COST: Record<SkillId, number> = {
  ember: 8,
  arc: 10,
  quake: 10,
  venom: 5,
  firebolt: 5,
  smite: 7,
};
const FIELD: Record<number, { damage: number; life: number }> = {
  1: { damage: 9.8199996948242, life: 62 },
  2: { damage: 18.450000762939, life: 144 },
  3: { damage: 31.959999084473, life: 290 },
  4: { damage: 52.75, life: 543 },
  5: { damage: 84.26000213623, life: 972 },
};
const BOSS: Record<
  number,
  {
    damage: number;
    life: number;
    mapLife: number;
    mapDamage: number;
    bossLife: number;
  }
> = {
  1: {
    damage: 373.54998779297,
    life: 6127,
    mapLife: 0.05,
    mapDamage: 0,
    bossLife: 0.54,
  },
  2: {
    damage: 392.80999755859,
    life: 6520,
    mapLife: 0.09,
    mapDamage: 0.01,
    bossLife: 0.56,
  },
  3: {
    damage: 413.01000976562,
    life: 6937,
    mapLife: 0.13,
    mapDamage: 0.02,
    bossLife: 0.58,
  },
  4: {
    damage: 434.17999267578,
    life: 7380,
    mapLife: 0.19,
    mapDamage: 0.03,
    bossLife: 0.6,
  },
  5: {
    damage: 456.36999511719,
    life: 7850,
    mapLife: 0.24,
    mapDamage: 0.04,
    bossLife: 0.62,
  },
};
const rankLife = {
    normal: 1,
    magic: 2.48 * 1.75,
    rare: 4.9 * 2,
    special: 4.9 * 2,
    boss: 1,
  },
  rankDamage = {
    normal: 1,
    magic: 1.3 * 0.8,
    rare: 1.5 * 0.67,
    special: 1.5 * 0.67,
    boss: 1,
  },
  rankCharge = { normal: 1, magic: 3.5, rare: 6, special: 11, boss: 11 },
  rankName = {
    normal: '普通',
    magic: '魔法',
    rare: '稀有',
    special: '特殊',
    boss: '地圖首領',
  };
export function maximumMana(level: number, manaPercent = 0) {
  return Math.floor((34 + level * 6) * (1 + manaPercent / 100));
}
export function armourReduction(armour: number, hit: number) {
  return Math.min(0.9, armour / (armour + hit * 5));
}
const xy = (x: number, y: number) => y * MAP_WIDTH + x,
  coord = (position: number) => ({
    x: position % MAP_WIDTH,
    y: Math.floor(position / MAP_WIDTH),
  });

export function generateTerrain(seed: number) {
  const random = createRandom(seed * 41 + 7),
    walkable = new Set<number>(),
    rooms: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      cx: number;
      cy: number;
    }> = [];
  for (let index = 0; index < 12; index += 1) {
    const w = 7 + Math.floor(random() * 8),
      h = 5 + Math.floor(random() * 7),
      x = 1 + Math.floor(random() * (MAP_WIDTH - w - 2)),
      y = 1 + Math.floor(random() * (MAP_HEIGHT - h - 2)),
      room = {
        x,
        y,
        w,
        h,
        cx: x + Math.floor(w / 2),
        cy: y + Math.floor(h / 2),
      };
    rooms.push(room);
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) walkable.add(xy(xx, yy));
    if (index) {
      const from = rooms[index - 1],
        horizontalFirst = random() < 0.5;
      if (horizontalFirst) {
        for (
          let xx = Math.min(from.cx, room.cx);
          xx <= Math.max(from.cx, room.cx);
          xx += 1
        )
          walkable.add(xy(xx, from.cy));
        for (
          let yy = Math.min(from.cy, room.cy);
          yy <= Math.max(from.cy, room.cy);
          yy += 1
        )
          walkable.add(xy(room.cx, yy));
      } else {
        for (
          let yy = Math.min(from.cy, room.cy);
          yy <= Math.max(from.cy, room.cy);
          yy += 1
        )
          walkable.add(xy(from.cx, yy));
        for (
          let xx = Math.min(from.cx, room.cx);
          xx <= Math.max(from.cx, room.cx);
          xx += 1
        )
          walkable.add(xy(xx, room.cy));
      }
    }
  }
  const start = xy(rooms[0].cx, rooms[0].cy),
    boss = xy(rooms.at(-1)!.cx, rooms.at(-1)!.cy);
  return { walkable: [...walkable], start, boss };
}

function shortestPath(start: number, end: number, walkable: Set<number>) {
  if (start === end) return [];
  const queue = [start],
    came = new Map<number, number>(),
    seen = new Set([start]);
  while (queue.length) {
    const current = queue.shift()!,
      { x, y } = coord(current);
    for (const next of [
      x > 0 ? current - 1 : -1,
      x < MAP_WIDTH - 1 ? current + 1 : -1,
      y > 0 ? current - MAP_WIDTH : -1,
      y < MAP_HEIGHT - 1 ? current + MAP_WIDTH : -1,
    ]) {
      if (next < 0 || seen.has(next) || !walkable.has(next)) continue;
      seen.add(next);
      came.set(next, current);
      if (next === end) {
        const path = [end];
        let cursor = end;
        while (came.has(cursor) && came.get(cursor) !== start) {
          cursor = came.get(cursor)!;
          path.unshift(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}

export function generateMonsterRoster(
  seed: number,
  tier: number,
  packs: MonsterPack[],
) {
  const random = createRandom(seed * 73 + 19),
    terrain = generateTerrain(seed),
    cells = terrain.walkable.filter(
      (cell) => cell !== terrain.start && cell !== terrain.boss,
    ),
    field = FIELD[tier] ?? FIELD[5],
    targets: CombatTarget[] = [];
  let monsterIndex = 0;
  for (const pack of packs) {
    const position = cells[Math.floor(random() * cells.length)];
    for (const rank of ['normal', 'magic', 'rare', 'special'] as const)
      for (let index = 0; index < pack[rank]; index += 1) {
        monsterIndex += 1;
        const maxLife = Math.round(field.life * rankLife[rank]);
        targets.push({
          id: `M-${String(monsterIndex).padStart(3, '0')}`,
          rank,
          position,
          maxLife,
          life: maxLife,
        });
      }
  }
  const boss = BOSS[tier] ?? BOSS[5],
    bossLife = Math.round(boss.life * (1 + boss.mapLife + boss.bossLife));
  targets.push({
    id: 'BOSS-001',
    rank: 'boss',
    position: terrain.boss,
    maxLife: bossLife,
    life: bossLife,
  });
  return { targets, terrain };
}

export function createCombatState(
  tier: number,
  level: number,
  build: BuildSnapshot,
  packs: MonsterPack[],
  seed = 824,
): CombatState {
  const stats = resolveStats(build),
    { targets, terrain } = generateMonsterRoster(seed, tier, packs),
    maxMana = maximumMana(level, stats.manaPercent);
  return {
    phase: 'search',
    targets,
    target: undefined,
    targetLife: 0,
    playerPosition: terrain.start,
    path: [],
    travel: 0,
    explored: [terrain.start],
    kills: 0,
    totalMonsters: targets.length,
    life: stats.life,
    maxLife: stats.life,
    mana: maxMana,
    maxMana,
    lifeFlaskCharges: 21,
    manaFlaskCharges: 24,
    lifeRecovery: 0,
    manaRecovery: 0,
    enemyClock: 0,
    playerClock: 0,
    action: 0,
    events: [
      {
        kind: 'ROUTE',
        text: `載入地形 · 可行走格 ${terrain.walkable.length} · 隨機生成 ${targets.length - 1} 隻怪 · 首領 1`,
      },
    ],
  };
}

export function stepCombat(
  previous: CombatState,
  input: {
    tier: number;
    level: number;
    build: BuildSnapshot;
    packs: MonsterPack[];
    seed?: number;
    tickMs?: number;
  },
): CombatState {
  if (previous.phase === 'complete' || previous.phase === 'dead')
    return { ...previous, events: [] };
  const tickMs = input.tickMs ?? 250,
    state: CombatState = {
      ...previous,
      targets: previous.targets.map((target) => ({
        ...target,
        life: target.life ?? target.maxLife,
      })),
      path: [...previous.path],
      travel: previous.travel ?? 0,
      explored: [...previous.explored],
      attackFrom: undefined,
      attackTo: undefined,
      lastKillRank: undefined,
      killRanks: [],
      events: [],
    },
    stats = resolveStats(input.build),
    field = FIELD[input.tier] ?? FIELD[5],
    boss = BOSS[input.tier] ?? BOSS[5],
    slice = tickMs / 3000,
    terrain = generateTerrain(input.seed ?? 824),
    walkable = new Set(terrain.walkable);
  if (state.target)
    state.target = state.targets.find(
      (target) => target.id === state.target!.id,
    );
  const nextMaxLife = stats.life,
    nextMaxMana = maximumMana(input.level, stats.manaPercent);
  if (nextMaxLife !== state.maxLife) {
    state.life =
      state.maxLife > 0
        ? nextMaxLife * (state.life / state.maxLife)
        : nextMaxLife;
    state.maxLife = nextMaxLife;
  }
  if (nextMaxMana !== state.maxMana) {
    state.mana =
      state.maxMana > 0
        ? nextMaxMana * (state.mana / state.maxMana)
        : nextMaxMana;
    state.maxMana = nextMaxMana;
  }
  state.mana = Math.min(
    state.maxMana,
    state.mana +
      (state.maxMana * 0.0175 * tickMs) / 1000 +
      Math.min(state.manaRecovery, 50 * slice),
  );
  state.life = Math.min(
    state.maxLife,
    state.life + Math.min(state.lifeRecovery, 70 * slice),
  );
  state.manaRecovery = Math.max(0, state.manaRecovery - 50 * slice);
  state.lifeRecovery = Math.max(0, state.lifeRecovery - 70 * slice);
  if (state.phase === 'search') {
    if (!state.targets.length) {
      state.phase = 'complete';
      return state;
    }
    const here = coord(state.playerPosition),
      fieldTargets = state.targets.filter((target) => target.rank !== 'boss'),
      pool = fieldTargets.length ? fieldTargets : state.targets,
      visibleTargets = pool.filter((target) => {
        const there = coord(target.position);
        return Math.abs(here.x - there.x) + Math.abs(here.y - there.y) <= 3;
      });
    if (fieldTargets.length && visibleTargets.length === 0) {
      const explored = new Set(state.explored),
        unknown = terrain.walkable.filter((cell) => !explored.has(cell));
      let destination = unknown[0];
      let distance = Infinity;
      for (const cell of unknown) {
        const there = coord(cell),
          next = Math.abs(here.x - there.x) + Math.abs(here.y - there.y);
        if (next < distance) {
          distance = next;
          destination = cell;
        }
      }
      if (destination === undefined) {
        destination = fieldTargets[0].position;
      }
      state.target = undefined;
      state.targetLife = 0;
      state.path = shortestPath(state.playerPosition, destination, walkable);
      state.travelMode = 'explore';
      state.phase = state.path.length ? 'travel' : 'search';
      const at = coord(destination);
      state.events.push(
        { kind: 'SCAN', text: '視野內無怪物 · 探索未揭露區域' },
        {
          kind: 'ROUTE',
          text: `前往未知格 (${at.x},${at.y}) · 距離 ${state.path.length} 格`,
        },
      );
      return state;
    }
    const candidates = visibleTargets.length ? visibleTargets : pool;
    let chosen = candidates[0],
      distance = Infinity;
    candidates.forEach((target) => {
      const there = coord(target.position),
        next = Math.abs(here.x - there.x) + Math.abs(here.y - there.y);
      if (next < distance) {
        distance = next;
        chosen = target;
      }
    });
    const chosenIndex = state.targets.findIndex(
      (target) => target.id === chosen.id,
    );
    [state.targets[0], state.targets[chosenIndex]] = [
      state.targets[chosenIndex],
      state.targets[0],
    ];
    state.target = state.targets[0];
    state.targetLife = state.target.life ?? state.target.maxLife;
    state.path = shortestPath(
      state.playerPosition,
      state.target.position,
      walkable,
    );
    state.travelMode = 'target';
    state.phase = state.path.length ? 'travel' : 'combat';
    state.enemyClock = 0;
    state.playerClock = 0;
    const at = coord(state.target.position);
    state.events.push({
      kind: 'SCAN',
      text: `發現 ${rankName[state.target.rank]}怪 ${state.target.id} · 座標 ${at.x},${at.y} · 距離 ${state.path.length} 格`,
    });
    if (!state.path.length)
      state.events.push({
        kind: 'TARGET',
        text: `進入攻擊範圍 · ${state.target.id} HP ${state.targetLife.toLocaleString()}/${state.target.maxLife.toLocaleString()}`,
      });
    return state;
  }
  if (state.phase === 'travel') {
    const ranged =
      input.build.skill.tags.includes('projectile') ||
      input.build.skill.tags.includes('spell');
    if (state.travelMode === 'target' && ranged && state.path.length <= 3) {
      state.phase = 'combat';
      state.path = [];
      state.events.push({
        kind: 'TARGET',
        text: `遠程鎖定 · ${state.target!.id} HP ${state.targetLife.toLocaleString()}/${state.target!.maxLife.toLocaleString()} · 距離 3 格內`,
      });
      return state;
    }
    const moveDelay = Math.max(60, 250 * (100 / Math.max(1, stats.moveSpeed)));
    state.travel = (state.travel ?? 0) + tickMs;
    if (state.travel < moveDelay) return state;
    state.travel -= moveDelay;
    const next = state.path.shift();
    if (next !== undefined) {
      state.playerPosition = next;
      if (!state.explored.includes(next)) state.explored.push(next);
      const at = coord(next);
      state.events.push({
        kind: 'MOVE',
        text: `${state.travelMode === 'target' ? `前往 ${state.target!.id}` : '探索迷霧'} · (${at.x},${at.y}) · 剩餘 ${state.path.length} 格 · 移速 ${Math.round(stats.moveSpeed)}%`,
      });
    }
    if (state.travelMode === 'explore') {
      state.phase = 'search';
      state.path = [];
    } else if (!state.path.length) {
      state.phase = 'combat';
      state.events.push({
        kind: 'TARGET',
        text: `進入攻擊範圍 · ${state.target!.id} HP ${state.targetLife.toLocaleString()}/${state.target!.maxLife.toLocaleString()}`,
      });
    }
    return state;
  }
  state.playerClock += tickMs;
  state.enemyClock += tickMs;
  const skillDelay = Math.max(
      1,
      Math.round(1000 / Math.max(0.1, stats.attacksPerSecond)),
    ),
    cost = Math.max(
      0,
      SKILL_MANA_COST[input.build.skill.id] - stats.skillCostReduction,
    ),
    basic = resolveDefaultAttack(input.build),
    basicDelay = Math.max(
      1,
      Math.round(1000 / Math.max(0.1, basic.attacksPerSecond)),
    );
  if (
    state.mana < cost &&
    state.manaFlaskCharges >= 6 &&
    state.manaRecovery <= 0
  ) {
    state.manaFlaskCharges -= 6;
    state.manaRecovery = 50;
    state.events.push({
      kind: 'FLASK',
      text: `使用小型魔力藥劑 · 3 秒回復 50 魔力 · 充能 ${state.manaFlaskCharges}/24`,
    });
  }
  const useSkill = state.mana >= cost,
    actionDelay = useSkill ? skillDelay : basicDelay;
  if (state.playerClock >= actionDelay) {
    state.playerClock -= actionDelay;
    state.action += 1;
    if (useSkill) state.mana -= cost;
    const random = createRandom(
        (input.seed ?? 824) * 100000 + state.kills * 17 + state.action,
      ),
      crit =
        random() * 100 <
        Math.min(100, useSkill ? stats.critChance : basic.critChance),
      baseHit = useSkill ? stats.hitDamage : basic.hitDamage,
      hit = Math.max(1, Math.round(baseHit * (crit ? 1.5 : 1))),
      primary = state.target!;
    state.attackFrom = state.playerPosition;
    state.attackTo = primary.position;
    const pack = state.targets.filter(
      (target) =>
        target.position === primary.position &&
        target.id !== primary.id &&
        target.rank !== 'boss',
    );
    const additional = useSkill
      ? input.build.skill.targeting.mode === 'area'
        ? pack
        : pack.slice(0, input.build.skill.targeting.additionalTargets ?? 0)
      : [];
    const struck = [primary, ...additional],
      dead: CombatTarget[] = [];
    for (const target of struck) {
      target.life = Math.max(0, (target.life ?? target.maxLife) - hit);
      if (target.id === primary.id) state.targetLife = target.life;
      if (target.life <= 0) dead.push(target);
    }
    state.events.push({
      kind: crit ? 'CRITICAL' : useSkill ? 'HIT' : 'BASIC',
      text: `${useSkill ? input.build.skill.name : '普通攻擊'} → ${primary.id} · ${crit ? 'CRITICAL DAMAGE ' : 'Dmg '}${hit.toLocaleString()} · HP ${state.targetLife.toLocaleString()}/${primary.maxLife.toLocaleString()} · MP ${Math.floor(state.mana)}/${state.maxMana} · Delay ${actionDelay}ms`,
    });
    if (additional.length)
      state.events.push({
        kind: input.build.skill.targeting.mode === 'chain' ? 'CHAIN' : 'AREA',
        text: `${input.build.skill.name} 額外命中 ${additional.length} 個同群目標${dead.length > 0 ? ` · 本擊擊殺 ${dead.length}` : ''}`,
      });
    if (dead.length) {
      const deadIds = new Set(dead.map((target) => target.id));
      state.targets = state.targets.filter((target) => !deadIds.has(target.id));
      for (const target of dead) {
        state.kills += 1;
        state.lastKillRank = target.rank;
        state.killRanks!.push(target.rank);
        state.lifeFlaskCharges = Math.min(
          21,
          state.lifeFlaskCharges + rankCharge[target.rank],
        );
        state.manaFlaskCharges = Math.min(
          24,
          state.manaFlaskCharges + rankCharge[target.rank],
        );
        state.events.push({
          kind: 'KILL',
          text: `${target.id} 死亡 · ${rankName[target.rank]}怪 · 本圖 ${state.kills}/${state.totalMonsters}`,
        });
      }
      state.target = undefined;
      if (dead.some((target) => target.rank === 'boss')) {
        state.phase = 'complete';
        state.events.push({
          kind: 'CLEAR',
          text: `首領死亡 · 地圖完成 · 實際擊殺 ${state.kills}/${state.totalMonsters}`,
        });
      } else state.phase = 'search';
      return state;
    }
  }
  if (state.enemyClock >= 1000 && state.targetLife > 0) {
    state.enemyClock -= 1000;
    const raw =
        state.target!.rank === 'boss'
          ? boss.damage * (1 + boss.mapDamage)
          : field.damage * rankDamage[state.target!.rank],
      taken = Math.max(
        1,
        Math.round(raw * (1 - armourReduction(stats.armor, raw))),
      );
    state.life = Math.max(0, state.life - taken);
    state.events.push({
      kind: 'DAMAGE',
      text: `${state.target!.id} 攻擊你 · 承受 ${taken} 物理傷害 · HP ${Math.ceil(state.life)}/${state.maxLife}`,
    });
  }
  if (
    state.life > 0 &&
    state.life / state.maxLife < 0.5 &&
    state.lifeFlaskCharges >= 7 &&
    state.lifeRecovery <= 0
  ) {
    state.lifeFlaskCharges -= 7;
    state.lifeRecovery = 70;
    state.events.push({
      kind: 'FLASK',
      text: `使用小型生命藥劑 · 3 秒回復 70 生命 · 充能 ${state.lifeFlaskCharges}/21`,
    });
  }
  if (state.life <= 0) {
    state.phase = 'dead';
    state.events.push({
      kind: 'DEATH',
      text: `角色死亡 · 最後目標 ${state.target?.id} · 本圖 ${state.kills}/${state.totalMonsters}`,
    });
  }
  return state;
}
