import {
  DEFAULT_RO_STATS,
  nextStatCost,
  statusPointsForLevel,
  type RoStatId,
  type RoStats,
} from '../../content/ro-stats';
import { APPLE_RENEWAL } from '../content/items';
import { EQUIPMENT } from '../content/equipment';
import { PRT_FILD08 } from '../content/prt-fild08';
import {
  PRT_FILD08_MONSTERS,
  type PrtFild08MonsterKey,
} from '../content/monsters';
import { passesDropRate } from '../content/poring';
import {
  renewalAttackDelayMs,
  renewalBaseAttack,
  renewalDisplayedAspd,
  renewalHitChance,
  renewalMonsterFlee,
  renewalMonsterHit,
  renewalNaturalHpRecovery,
  renewalPhysicalDefense,
  renewalPlayerFlee,
  renewalPlayerHit,
} from '../formulas/renewal';
import { isWalkable, type RoField } from './fld2';
import {
  createMonsterPlacements,
  shortestPath,
  type GridPosition,
} from './navigation';

export type RoWorldEventType =
  | 'target'
  | 'move'
  | 'player_hit'
  | 'player_miss'
  | 'monster_hit'
  | 'monster_miss'
  | 'death'
  | 'drop'
  | 'pickup'
  | 'heal'
  | 'use_item'
  | 'base_level_up'
  | 'job_level_up';
export type RoWorldEvent = Readonly<{
  atMs: number;
  type: RoWorldEventType;
  actorId?: string;
  targetId?: string;
  amount?: number;
  jobAmount?: number;
  remainingHp?: number;
  maximumHp?: number;
  item?: string;
  position?: GridPosition;
  baseLevel?: number;
  jobLevel?: number;
  baseExpCurrent?: number;
  baseExpRequired?: number;
  jobExpCurrent?: number;
  jobExpRequired?: number;
  statusPointsGained?: number;
  skillPointsGained?: number;
}>;
export type MonsterActor = {
  id: string;
  monster: PrtFild08MonsterKey;
  spawnIndex: number;
  position: GridPosition;
  home: GridPosition;
  hp: number;
  alive: boolean;
  engaged: boolean;
  nextAttackAt: number;
  nextMoveAt: number;
  respawnAt: number | null;
  respawnMs: number;
};
export type GroundItem = { id: string; item: string; position: GridPosition };
export type NoviceSkills = { NV_BASIC: number; NV_FIRSTAID: 0 };
export type RoWorldState = {
  nowMs: number;
  randomState: number;
  status: 'running' | 'dead';
  player: {
    position: GridPosition;
    hp: number;
    maxHp: number;
    sp: number;
    maxSp: number;
    baseExp: number;
    jobExp: number;
    baseLevel: number;
    jobLevel: number;
    stats: RoStats;
    statusPoints: number;
    skillPoints: number;
    skills: NoviceSkills;
    equipment: { rightHand: string | null; leftHand: string | null };
    nextActionAt: number;
    nextHpRegenAt: number;
  };
  monsters: MonsterActor[];
  groundItems: GroundItem[];
  inventory: Record<string, number>;
  targetId: string | null;
  pickupId: string | null;
  route: GridPosition[];
  events: RoWorldEvent[];
  kills: number;
};

const PLAYER_WALK_DELAY_MS = 150;
export const BASE_EXP_REQUIREMENTS = [
  548, 894, 1486, 2173, 3152, 3732, 4112, 4441, 4866, 5337,
];
export const JOB_EXP_REQUIREMENTS = [
  10, 18, 28, 40, 91, 151, 205, 268, 340, 999,
];
export function experienceProgress(
  total: number,
  requirements: readonly number[],
) {
  let level = 1,
    remaining = total;
  while (level <= requirements.length && remaining >= requirements[level - 1]) {
    remaining -= requirements[level - 1];
    level += 1;
  }
  const required =
    requirements[Math.min(level - 1, requirements.length - 1)] ?? 999999999;
  return {
    level,
    current: remaining,
    required,
    percent: Math.min(100, Math.floor((remaining / required) * 1000) / 10),
  };
}
function nextRandom(s: RoWorldState) {
  s.randomState = (s.randomState + 0x6d2b79f5) >>> 0;
  let r = s.randomState;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}
function rollPercent(s: RoWorldState, chance: number) {
  return Math.trunc(nextRandom(s) * 100) < chance;
}
function cloneWorld(s: RoWorldState): RoWorldState {
  return {
    ...s,
    player: {
      ...s.player,
      position: { ...s.player.position },
      stats: { ...s.player.stats },
      skills: { ...s.player.skills },
      equipment: { ...s.player.equipment },
    },
    monsters: s.monsters.map((m) => ({
      ...m,
      position: { ...m.position },
      home: { ...m.home },
    })),
    groundItems: s.groundItems.map((i) => ({
      ...i,
      position: { ...i.position },
    })),
    inventory: { ...s.inventory },
    route: s.route.map((p) => ({ ...p })),
    events: [...s.events],
  };
}
const samePosition = (a: GridPosition, b: GridPosition) =>
  a.x === b.x && a.y === b.y;
const distance = (a: GridPosition, b: GridPosition) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function pushEvent(s: RoWorldState, e: Omit<RoWorldEvent, 'atMs'>) {
  s.events.push({ atMs: s.nowMs, ...e });
}
const playerStats = (s: RoWorldState) => ({
  level: s.player.baseLevel,
  ...s.player.stats,
});
const maxHp = (s: RoWorldState) =>
  Math.trunc(40 * (1 + s.player.stats.vit * 0.01));
const maxSp = (s: RoWorldState) =>
  Math.trunc(11 * (1 + s.player.stats.int * 0.01));

export function allocateStatusPoint(input: RoWorldState, stat: RoStatId) {
  const s = cloneWorld(input),
    cost = nextStatCost(s.player.stats[stat]);
  if (s.player.statusPoints < cost || s.player.stats[stat] >= 99) return s;
  s.player.stats[stat] += 1;
  s.player.statusPoints -= cost;
  const oldHp = s.player.maxHp,
    oldSp = s.player.maxSp;
  s.player.maxHp = maxHp(s);
  s.player.maxSp = maxSp(s);
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp - oldHp);
  s.player.sp = Math.min(s.player.maxSp, s.player.sp + s.player.maxSp - oldSp);
  return s;
}
export function resetStatusPoints(input: RoWorldState) {
  const s = cloneWorld(input);
  s.player.stats = { ...DEFAULT_RO_STATS };
  s.player.statusPoints = statusPointsForLevel(s.player.baseLevel);
  s.player.maxHp = maxHp(s);
  s.player.maxSp = maxSp(s);
  s.player.hp = Math.min(s.player.hp, s.player.maxHp);
  s.player.sp = Math.min(s.player.sp, s.player.maxSp);
  return s;
}
export function allocateNoviceSkill(input: RoWorldState) {
  const s = cloneWorld(input);
  if (s.player.skillPoints < 1 || s.player.skills.NV_BASIC >= 9) return s;
  s.player.skills.NV_BASIC += 1;
  s.player.skillPoints -= 1;
  return s;
}

export function equipInventoryItem(input: RoWorldState, item: string) {
  const definition = EQUIPMENT[item];
  const state = cloneWorld(input);
  if (
    !definition ||
    (state.inventory[item] ?? 0) < 1 ||
    state.player.baseLevel < definition.equipLevelMin
  )
    return state;
  state.inventory[item] -= 1;
  if (state.inventory[item] === 0) delete state.inventory[item];
  const previous = state.player.equipment[definition.slot];
  if (previous)
    state.inventory[previous] = (state.inventory[previous] ?? 0) + 1;
  state.player.equipment[definition.slot] = item;
  return state;
}

function chooseTarget(s: RoWorldState) {
  const target = s.monsters
    .filter((m) => m.alive)
    .sort(
      (a, b) =>
        distance(s.player.position, a.position) -
        distance(s.player.position, b.position),
    )[0];
  if (!target) return;
  s.targetId = target.id;
  s.route = [];
  pushEvent(s, {
    type: 'target',
    targetId: target.id,
    position: target.position,
  });
}
function createDrops(s: RoWorldState, m: MonsterActor) {
  for (const drop of PRT_FILD08_MONSTERS[m.monster].drops) {
    if (
      !passesDropRate(
        drop.ratePerTenThousand,
        Math.trunc(nextRandom(s) * 10000),
      )
    )
      continue;
    const item = {
      id: `drop-${s.kills}-${s.groundItems.length}`,
      item: drop.item,
      position: { ...m.position },
    };
    s.groundItems.push(item);
    pushEvent(s, {
      type: 'drop',
      actorId: m.id,
      item: drop.item,
      position: m.position,
    });
  }
}
function respawnPosition(s: RoWorldState, field: RoField, m: MonsterActor) {
  const spawn = PRT_FILD08.monsterSpawns[m.spawnIndex];
  const halfWidth = Math.trunc(spawn.width / 2),
    halfHeight = Math.trunc(spawn.height / 2);
  const minX = spawn.width === 0 ? 0 : Math.max(0, spawn.centerX - halfWidth),
    maxX =
      spawn.width === 0
        ? field.width - 1
        : Math.min(field.width - 1, spawn.centerX + halfWidth),
    minY = spawn.height === 0 ? 0 : Math.max(0, spawn.centerY - halfHeight),
    maxY =
      spawn.height === 0
        ? field.height - 1
        : Math.min(field.height - 1, spawn.centerY + halfHeight);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const position = {
      x: minX + Math.trunc(nextRandom(s) * (maxX - minX + 1)),
      y: minY + Math.trunc(nextRandom(s) * (maxY - minY + 1)),
    };
    if (
      isWalkable(field, position.x, position.y) &&
      !s.monsters.some(
        (other) =>
          other !== m && other.alive && samePosition(other.position, position),
      )
    )
      return position;
  }
  return { ...m.home };
}
function processRespawns(s: RoWorldState, field: RoField) {
  for (const m of s.monsters) {
    if (m.respawnAt === null || m.respawnAt > s.nowMs) continue;
    const d = PRT_FILD08_MONSTERS[m.monster];
    m.position = respawnPosition(s, field, m);
    m.home = { ...m.position };
    m.hp = d.hp;
    m.alive = true;
    m.engaged = false;
    m.respawnAt = null;
    m.nextAttackAt = 0;
    m.nextMoveAt = s.nowMs + d.walkSpeedMs;
  }
}
function processMonsterMovement(s: RoWorldState, field: RoField) {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (const m of s.monsters) {
    if (!m.alive || m.engaged || m.id === s.targetId || m.nextMoveAt > s.nowMs)
      continue;
    const d = PRT_FILD08_MONSTERS[m.monster],
      direction = directions[Math.trunc(nextRandom(s) * directions.length)],
      next = { x: m.position.x + direction.x, y: m.position.y + direction.y };
    if (isWalkable(field, next.x, next.y)) m.position = next;
    m.nextMoveAt = s.nowMs + d.walkSpeedMs;
  }
}
function processRecovery(s: RoWorldState) {
  if (s.route.length === 0 && s.player.hp < s.player.maxHp) {
    const amount = Math.min(
      renewalNaturalHpRecovery(s.player.maxHp, s.player.stats.vit),
      s.player.maxHp - s.player.hp,
    );
    s.player.hp += amount;
    if (amount > 0) pushEvent(s, { type: 'heal', actorId: 'player', amount });
  }
  s.player.nextHpRegenAt = s.nowMs + 6000;
}
function preparePickup(s: RoWorldState, field: RoField) {
  if (s.pickupId && s.groundItems.some((i) => i.id === s.pickupId)) return true;
  const item = s.groundItems[0];
  if (!item) return false;
  s.pickupId = item.id;
  s.route = shortestPath(field, s.player.position, item.position);
  return true;
}
function awardExperience(s: RoWorldState, m: MonsterActor) {
  const d = PRT_FILD08_MONSTERS[m.monster],
    beforeBase = s.player.baseLevel,
    beforeJob = s.player.jobLevel;
  s.player.baseExp += d.baseExp;
  s.player.jobExp += d.jobExp;
  const base = experienceProgress(s.player.baseExp, BASE_EXP_REQUIREMENTS),
    job = experienceProgress(s.player.jobExp, JOB_EXP_REQUIREMENTS);
  s.player.baseLevel = base.level;
  s.player.jobLevel = job.level;
  if (base.level > beforeBase) {
    const gained =
      statusPointsForLevel(base.level) - statusPointsForLevel(beforeBase);
    s.player.statusPoints += gained;
    s.player.maxHp = maxHp(s);
    pushEvent(s, {
      type: 'base_level_up',
      actorId: 'player',
      baseLevel: base.level,
      statusPointsGained: gained,
    });
  }
  if (job.level > beforeJob) {
    const gained = job.level - beforeJob;
    s.player.skillPoints += gained;
    pushEvent(s, {
      type: 'job_level_up',
      actorId: 'player',
      jobLevel: job.level,
      skillPointsGained: gained,
    });
  }
  pushEvent(s, {
    type: 'death',
    actorId: m.id,
    targetId: 'player',
    position: m.position,
    amount: d.baseExp,
    jobAmount: d.jobExp,
    baseLevel: base.level,
    jobLevel: job.level,
    baseExpCurrent: base.current,
    baseExpRequired: base.required,
    jobExpCurrent: job.current,
    jobExpRequired: job.required,
  });
}

function processPlayerAction(s: RoWorldState, field: RoField) {
  if (
    s.player.hp <= Math.trunc(s.player.maxHp / 2) &&
    (s.inventory.Apple ?? 0) > 0
  ) {
    s.inventory.Apple -= 1;
    const rolled =
      APPLE_RENEWAL.healMinimum +
      Math.trunc(
        nextRandom(s) *
          (APPLE_RENEWAL.healMaximum - APPLE_RENEWAL.healMinimum + 1),
      );
    const amount = Math.min(rolled, s.player.maxHp - s.player.hp);
    s.player.hp += amount;
    pushEvent(s, {
      type: 'use_item',
      actorId: 'player',
      item: APPLE_RENEWAL.aegisName,
      amount,
    });
  }
  if (preparePickup(s, field)) {
    const item = s.groundItems.find((i) => i.id === s.pickupId);
    if (!item) return;
    if (samePosition(s.player.position, item.position)) {
      s.inventory[item.item] = (s.inventory[item.item] ?? 0) + 1;
      s.groundItems = s.groundItems.filter((i) => i.id !== item.id);
      pushEvent(s, {
        type: 'pickup',
        item: item.item,
        position: item.position,
      });
      s.pickupId = null;
      s.route = [];
      return;
    }
    if (s.route.length === 0)
      s.route = shortestPath(field, s.player.position, item.position);
    const step = s.route.shift();
    if (step) {
      s.player.position = step;
      pushEvent(s, { type: 'move', actorId: 'player', position: step });
    }
    s.player.nextActionAt = s.nowMs + PLAYER_WALK_DELAY_MS;
    return;
  }
  if (!s.targetId) chooseTarget(s);
  const target = s.monsters.find((m) => m.id === s.targetId && m.alive);
  if (!target) {
    s.targetId = null;
    s.route = [];
    s.player.nextActionAt = s.nowMs;
    return;
  }
  const d = PRT_FILD08_MONSTERS[target.monster];
  if (distance(s.player.position, target.position) > d.attackRange) {
    if (s.route.length === 0)
      s.route = shortestPath(field, s.player.position, target.position).slice(
        0,
        -d.attackRange,
      );
    const step = s.route.shift();
    if (step) {
      s.player.position = step;
      pushEvent(s, {
        type: 'move',
        actorId: 'player',
        targetId: target.id,
        position: step,
      });
    }
    s.player.nextActionAt = s.nowMs + PLAYER_WALK_DELAY_MS;
    return;
  }
  target.engaged = true;
  if (target.nextAttackAt === 0)
    target.nextAttackAt = s.nowMs + d.attackDelayMs;
  const stats = playerStats(s),
    monsterStats = { level: d.level, ...d.stats };
  if (
    rollPercent(
      s,
      renewalHitChance(
        renewalPlayerHit(stats),
        renewalMonsterFlee(monsterStats),
      ),
    )
  ) {
    const weaponAttack =
      EQUIPMENT[s.player.equipment.rightHand ?? '']?.attack ?? 0;
    const damage = renewalPhysicalDefense(
      renewalBaseAttack(stats) + weaponAttack,
      d.defense,
      d.stats.vit,
    );
    target.hp = Math.max(0, target.hp - damage);
    pushEvent(s, {
      type: 'player_hit',
      actorId: 'player',
      targetId: target.id,
      amount: damage,
      remainingHp: target.hp,
      maximumHp: d.hp,
    });
    if (target.hp === 0) {
      target.alive = false;
      target.engaged = false;
      target.respawnAt = s.nowMs + target.respawnMs;
      s.kills += 1;
      awardExperience(s, target);
      createDrops(s, target);
      s.targetId = null;
      s.route = [];
    }
  } else
    pushEvent(s, {
      type: 'player_miss',
      actorId: 'player',
      targetId: target.id,
    });
  s.player.nextActionAt =
    s.nowMs + renewalAttackDelayMs(renewalDisplayedAspd(s.player.stats, 55));
}
function processMonsterAttacks(s: RoWorldState) {
  for (const m of s.monsters) {
    if (!m.alive || !m.engaged || m.nextAttackAt > s.nowMs) continue;
    const d = PRT_FILD08_MONSTERS[m.monster];
    if (distance(m.position, s.player.position) > d.attackRange) continue;
    const chance = renewalHitChance(
      renewalMonsterHit({ level: d.level, ...d.stats }),
      renewalPlayerFlee(playerStats(s)),
    );
    if (rollPercent(s, chance)) {
      const shieldDefense =
        EQUIPMENT[s.player.equipment.leftHand ?? '']?.defense ?? 0;
      const damage = renewalPhysicalDefense(
        d.attackMin +
          Math.trunc(nextRandom(s) * (d.attackMax - d.attackMin + 1)),
        shieldDefense,
        s.player.stats.vit,
      );
      s.player.hp = Math.max(0, s.player.hp - damage);
      pushEvent(s, {
        type: 'monster_hit',
        actorId: m.id,
        targetId: 'player',
        amount: damage,
        remainingHp: s.player.hp,
        maximumHp: s.player.maxHp,
      });
      if (s.player.hp === 0) s.status = 'dead';
    } else
      pushEvent(s, { type: 'monster_miss', actorId: m.id, targetId: 'player' });
    m.nextAttackAt = s.nowMs + d.attackDelayMs;
  }
}

export function createRoWorld(field: RoField, seed: number): RoWorldState {
  const s: RoWorldState = {
    nowMs: 0,
    randomState: seed >>> 0,
    status: 'running',
    player: {
      position: { ...PRT_FILD08.noviceEntry },
      hp: 40,
      maxHp: 40,
      sp: 11,
      maxSp: 11,
      baseExp: 0,
      jobExp: 0,
      baseLevel: 1,
      jobLevel: 1,
      stats: { ...DEFAULT_RO_STATS },
      statusPoints: 0,
      skillPoints: 0,
      skills: { NV_BASIC: 0, NV_FIRSTAID: 0 },
      equipment: { rightHand: 'Knife_', leftHand: null },
      nextActionAt: 0,
      nextHpRegenAt: 6000,
    },
    monsters: [],
    groundItems: [],
    inventory: {},
    targetId: null,
    pickupId: null,
    route: [],
    events: [],
    kills: 0,
  };
  s.monsters = createMonsterPlacements(field, seed).map((p, index) => {
    const d = PRT_FILD08_MONSTERS[p.monster];
    return {
      id: `${p.monster.toLowerCase()}-${index + 1}`,
      monster: p.monster,
      spawnIndex: p.spawnIndex,
      position: { x: p.x, y: p.y },
      home: { x: p.x, y: p.y },
      hp: d.hp,
      alive: true,
      engaged: false,
      nextAttackAt: 0,
      nextMoveAt: d.walkSpeedMs,
      respawnAt: null,
      respawnMs: p.respawnMs,
    };
  });
  return s;
}
export function advanceRoWorld(
  input: RoWorldState,
  field: RoField,
  durationMs: number,
  playerAutomation = true,
) {
  if (!Number.isFinite(durationMs) || durationMs < 0)
    throw new RangeError('duration must be non-negative');
  const s = cloneWorld(input),
    finishAt = s.nowMs + durationMs;
  while (s.status === 'running') {
    const attack = s.monsters.reduce(
        (n, m) =>
          m.alive && m.engaged && m.nextAttackAt > 0
            ? Math.min(n, m.nextAttackAt)
            : n,
        Infinity,
      ),
      move = s.monsters.reduce(
        (n, m) =>
          m.alive && !m.engaged && m.id !== s.targetId
            ? Math.min(n, m.nextMoveAt)
            : n,
        Infinity,
      ),
      respawn = s.monsters.reduce(
        (n, m) => (m.respawnAt === null ? n : Math.min(n, m.respawnAt)),
        Infinity,
      ),
      nextAt = Math.min(
        playerAutomation ? s.player.nextActionAt : Infinity,
        s.player.nextHpRegenAt,
        attack,
        move,
        respawn,
      );
    if (nextAt > finishAt) break;
    s.nowMs = nextAt;
    processRespawns(s, field);
    processMonsterMovement(s, field);
    processMonsterAttacks(s);
    if (s.status === 'running' && s.player.nextHpRegenAt <= s.nowMs)
      processRecovery(s);
    if (
      playerAutomation &&
      s.status === 'running' &&
      s.player.nextActionAt <= s.nowMs
    )
      processPlayerAction(s, field);
  }
  if (s.status === 'running') s.nowMs = finishAt;
  return s;
}
