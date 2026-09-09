import {
  DEFAULT_RO_STATS,
  nextStatCost,
  statusPointsForLevel,
  type RoStatId,
  type RoStats,
} from '../../content/ro-stats';
import {
  APPLE_RENEWAL,
  FLY_WING_RENEWAL,
  MAJOR_OVERWEIGHT_PERCENT,
  NOVICE_MAX_WEIGHT,
  RENEWAL_NATURAL_HEAL_WEIGHT_PERCENT,
  roItemWeight,
} from '../content/items';
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
  randomTeleportPosition,
  randomWalkDestination,
  shortestPath,
  sourceSpawnPosition,
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
  | 'job_level_up'
  | 'player_death'
  | 'respawn'
  | 'random_walk'
  | 'teleport'
  | 'pickup_overweight'
  | 'overweight';
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
  respawnVarianceMs: number;
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
    savePoint: GridPosition;
    deadAt: number | null;
    respawnAt: number | null;
    nextActionAt: number;
    nextHpRegenAt: number;
  };
  monsters: MonsterActor[];
  groundItems: GroundItem[];
  inventory: Record<string, number>;
  targetId: string | null;
  pickupId: string | null;
  route: GridPosition[];
  ignoredGroundItemIds: string[];
  events: RoWorldEvent[];
  kills: number;
  deaths: number;
  flyWingsUsed: number;
};

const PLAYER_WALK_DELAY_MS = 150;
export const OPENKORE_CLIENT_SIGHT = 17;
const OPENKORE_ATTACK_SCAN_MS = 500;
const OPENKORE_RANDOM_WALK_MAX_MS = 75_000;
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
    ignoredGroundItemIds: [...s.ignoredGroundItemIds],
    events: [...s.events],
  };
}
const samePosition = (a: GridPosition, b: GridPosition) =>
  a.x === b.x && a.y === b.y;
const distance = (a: GridPosition, b: GridPosition) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const blockDistance = (a: GridPosition, b: GridPosition) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
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

export function carriedWeight(s: RoWorldState) {
  const inventory = Object.entries(s.inventory).reduce(
    (sum, [item, amount]) => sum + roItemWeight(item) * amount,
    0,
  );
  const equipment = Object.values(s.player.equipment).reduce(
    (sum, item) => sum + (item ? roItemWeight(item) : 0),
    0,
  );
  return inventory + equipment;
}

export function carriedWeightPercent(s: RoWorldState) {
  return Math.trunc((carriedWeight(s) * 100) / NOVICE_MAX_WEIGHT);
}

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

function chooseTarget(s: RoWorldState, field: RoField) {
  const visible = s.monsters
    .filter(
      (m) =>
        m.alive &&
        blockDistance(s.player.position, m.position) < OPENKORE_CLIENT_SIGHT,
    )
    .sort(
      (a, b) =>
        distance(s.player.position, a.position) -
        distance(s.player.position, b.position),
    );
  for (const target of visible) {
    if (
      !samePosition(s.player.position, target.position) &&
      shortestPath(field, s.player.position, target.position).length === 0
    )
      continue;
    s.targetId = target.id;
    s.route = [];
    pushEvent(s, {
      type: 'target',
      targetId: target.id,
      position: target.position,
    });
    return true;
  }
  return false;
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
  try {
    return sourceSpawnPosition(field, spawn, () => nextRandom(s));
  } catch {
    return { ...m.home };
  }
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
  if (
    carriedWeightPercent(s) < RENEWAL_NATURAL_HEAL_WEIGHT_PERCENT &&
    s.route.length === 0 &&
    s.player.hp < s.player.maxHp
  ) {
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
  const visible = s.groundItems
    .filter(
      (item) =>
        !s.ignoredGroundItemIds.includes(item.id) &&
        blockDistance(s.player.position, item.position) < OPENKORE_CLIENT_SIGHT,
    )
    .sort(
      (a, b) =>
        distance(s.player.position, a.position) -
        distance(s.player.position, b.position),
    );
  for (const item of visible) {
    const route = shortestPath(field, s.player.position, item.position);
    if (!samePosition(s.player.position, item.position) && route.length === 0)
      continue;
    s.pickupId = item.id;
    s.route = route;
    return true;
  }
  return false;
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
      const nextWeight = carriedWeight(s) + roItemWeight(item.item);
      if (nextWeight > NOVICE_MAX_WEIGHT) {
        s.ignoredGroundItemIds.push(item.id);
        pushEvent(s, {
          type: 'pickup_overweight',
          item: item.item,
          position: item.position,
        });
        s.pickupId = null;
        s.route = [];
        return;
      }
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
  if (!s.targetId && !chooseTarget(s, field)) {
    if ((s.inventory[FLY_WING_RENEWAL.aegisName] ?? 0) > 0) {
      let destination: GridPosition | null = null;
      try {
        destination = randomTeleportPosition(field, () => nextRandom(s));
      } catch {
        destination = null;
      }
      if (destination) {
        s.inventory[FLY_WING_RENEWAL.aegisName] -= 1;
        if (s.inventory[FLY_WING_RENEWAL.aegisName] === 0)
          delete s.inventory[FLY_WING_RENEWAL.aegisName];
        s.player.position = destination;
        s.pickupId = null;
        s.route = [];
        s.flyWingsUsed += 1;
        pushEvent(s, {
          type: 'teleport',
          actorId: 'player',
          item: FLY_WING_RENEWAL.aegisName,
          position: destination,
        });
        s.player.nextActionAt = s.nowMs + OPENKORE_ATTACK_SCAN_MS;
        return;
      }
    }

    if (s.route.length === 0) {
      const destination = randomWalkDestination(field, () => nextRandom(s));
      if (destination) {
        s.route = shortestPath(field, s.player.position, destination).slice(
          0,
          Math.floor(OPENKORE_RANDOM_WALK_MAX_MS / PLAYER_WALK_DELAY_MS),
        );
        if (s.route.length > 0)
          pushEvent(s, {
            type: 'random_walk',
            actorId: 'player',
            position: destination,
          });
      }
    }
    const step = s.route.shift();
    if (step) {
      s.player.position = step;
      pushEvent(s, { type: 'move', actorId: 'player', position: step });
      s.player.nextActionAt = s.nowMs + PLAYER_WALK_DELAY_MS;
    } else s.player.nextActionAt = s.nowMs + OPENKORE_ATTACK_SCAN_MS;
    return;
  }
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
  if (carriedWeightPercent(s) >= MAJOR_OVERWEIGHT_PERCENT) {
    pushEvent(s, { type: 'overweight', actorId: 'player' });
    s.player.nextActionAt = s.nowMs + 1000;
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
      target.respawnAt =
        s.nowMs +
        Math.max(
          1000,
          target.respawnMs +
            (target.respawnVarianceMs > 0
              ? Math.trunc(nextRandom(s) * target.respawnVarianceMs)
              : 0),
        );
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
      if (s.player.hp === 0) {
        s.status = 'dead';
        s.deaths += 1;
        s.player.deadAt = s.nowMs;
        s.player.respawnAt = s.nowMs + 4000;
        s.targetId = null;
        s.pickupId = null;
        s.route = [];
        for (const monster of s.monsters) {
          monster.engaged = false;
          monster.nextAttackAt = 0;
        }
        pushEvent(s, {
          type: 'player_death',
          actorId: 'player',
          position: s.player.position,
        });
        break;
      }
    } else
      pushEvent(s, { type: 'monster_miss', actorId: m.id, targetId: 'player' });
    m.nextAttackAt = s.nowMs + d.attackDelayMs;
  }
}

function processPlayerRespawn(s: RoWorldState, playerAutomation: boolean) {
  if (
    !playerAutomation ||
    s.status !== 'dead' ||
    s.player.respawnAt === null ||
    s.player.respawnAt > s.nowMs
  )
    return;
  s.status = 'running';
  s.player.position = { ...s.player.savePoint };
  s.player.hp = s.player.maxHp;
  s.player.sp = s.player.maxSp;
  s.player.deadAt = null;
  s.player.respawnAt = null;
  s.player.nextActionAt = s.nowMs;
  s.player.nextHpRegenAt = s.nowMs + 6000;
  pushEvent(s, {
    type: 'respawn',
    actorId: 'player',
    position: s.player.position,
  });
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
      savePoint: { ...PRT_FILD08.noviceEntry },
      deadAt: null,
      respawnAt: null,
      nextActionAt: 0,
      nextHpRegenAt: 6000,
    },
    monsters: [],
    groundItems: [],
    inventory: {},
    targetId: null,
    pickupId: null,
    route: [],
    ignoredGroundItemIds: [],
    events: [],
    kills: 0,
    deaths: 0,
    flyWingsUsed: 0,
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
      respawnVarianceMs: p.respawnVarianceMs,
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
  while (s.nowMs < finishAt) {
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
        playerAutomation && s.status === 'running'
          ? Math.max(s.nowMs, s.player.nextActionAt)
          : Infinity,
        s.status === 'running'
          ? Math.max(s.nowMs, s.player.nextHpRegenAt)
          : Infinity,
        playerAutomation && s.status === 'dead'
          ? Math.max(s.nowMs, s.player.respawnAt ?? Infinity)
          : Infinity,
        Math.max(s.nowMs, attack),
        Math.max(s.nowMs, move),
        Math.max(s.nowMs, respawn),
      );
    if (nextAt > finishAt) break;
    s.nowMs = nextAt;
    processRespawns(s, field);
    processMonsterMovement(s, field);
    processPlayerRespawn(s, playerAutomation);
    if (s.status === 'running') processMonsterAttacks(s);
    if (s.status === 'running' && s.player.nextHpRegenAt <= s.nowMs)
      processRecovery(s);
    if (
      playerAutomation &&
      s.status === 'running' &&
      s.player.nextActionAt <= s.nowMs
    )
      processPlayerAction(s, field);
  }
  s.nowMs = finishAt;
  return s;
}
