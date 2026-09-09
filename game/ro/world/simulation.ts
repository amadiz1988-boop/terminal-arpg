import { PORING_RENEWAL, passesDropRate } from '../content/poring';
import { APPLE_RENEWAL } from '../content/items';
import { PRT_FILD08 } from '../content/prt-fild08';
import {
  renewalHitChance,
  renewalMonsterFlee,
  renewalMonsterHit,
  renewalNaturalHpRecovery,
  renewalPlayerFlee,
  renewalPlayerHit,
} from '../formulas/renewal';
import type { RoField } from './fld2';
import { createPoringPlacements, shortestPath, type GridPosition } from './navigation';

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
  | 'use_item';

export type RoWorldEvent = Readonly<{
  atMs: number;
  type: RoWorldEventType;
  actorId?: string;
  targetId?: string;
  amount?: number;
  remainingHp?: number;
  maximumHp?: number;
  item?: string;
  position?: GridPosition;
}>;

export type PoringActor = {
  id: string;
  position: GridPosition;
  home: GridPosition;
  hp: number;
  alive: boolean;
  engaged: boolean;
  nextAttackAt: number;
  respawnAt: number | null;
  respawnMs: number;
};

export type GroundItem = {
  id: string;
  item: string;
  position: GridPosition;
};

export type RoWorldState = {
  nowMs: number;
  randomState: number;
  status: 'running' | 'dead';
  player: {
    position: GridPosition;
    hp: number;
    maxHp: number;
    baseExp: number;
    jobExp: number;
    nextActionAt: number;
    nextHpRegenAt: number;
  };
  monsters: PoringActor[];
  groundItems: GroundItem[];
  inventory: Record<string, number>;
  targetId: string | null;
  pickupId: string | null;
  route: GridPosition[];
  events: RoWorldEvent[];
  kills: number;
};

const novice = Object.freeze({ level: 1, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 });
const poring = Object.freeze({ level: 1, ...PORING_RENEWAL.stats });
const PLAYER_WALK_DELAY_MS = 150;
const PLAYER_ATTACK_DELAY_MS = 1180;
const PLAYER_DAMAGE_TO_PORING = 12;
const PORING_DAMAGE_TO_NOVICE = 1;

function nextRandom(state: RoWorldState) {
  state.randomState = (state.randomState + 0x6d2b79f5) >>> 0;
  let result = state.randomState;
  result = Math.imul(result ^ (result >>> 15), result | 1);
  result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
  return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
}

function rollPercent(state: RoWorldState, chance: number) {
  return Math.trunc(nextRandom(state) * 100) < chance;
}

function cloneWorld(state: RoWorldState): RoWorldState {
  return {
    ...state,
    player: { ...state.player, position: { ...state.player.position } },
    monsters: state.monsters.map((monster) => ({
      ...monster,
      position: { ...monster.position },
      home: { ...monster.home },
    })),
    groundItems: state.groundItems.map((item) => ({ ...item, position: { ...item.position } })),
    inventory: { ...state.inventory },
    route: state.route.map((position) => ({ ...position })),
    events: [...state.events],
  };
}

function samePosition(left: GridPosition, right: GridPosition) {
  return left.x === right.x && left.y === right.y;
}

function distance(left: GridPosition, right: GridPosition) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function pushEvent(state: RoWorldState, event: Omit<RoWorldEvent, 'atMs'>) {
  state.events.push({ atMs: state.nowMs, ...event });
}

function chooseTarget(state: RoWorldState) {
  const target = state.monsters
    .filter((monster) => monster.alive)
    .sort((left, right) => distance(state.player.position, left.position) - distance(state.player.position, right.position))[0];
  if (!target) return;
  state.targetId = target.id;
  state.route = [];
  pushEvent(state, { type: 'target', targetId: target.id, position: target.position });
}

function createDrops(state: RoWorldState, monster: PoringActor) {
  for (const drop of PORING_RENEWAL.drops) {
    const roll = Math.trunc(nextRandom(state) * 10000);
    if (!passesDropRate(drop.ratePerTenThousand, roll)) continue;
    const groundItem: GroundItem = {
      id: `drop-${state.kills}-${state.groundItems.length}`,
      item: drop.item,
      position: { ...monster.position },
    };
    state.groundItems.push(groundItem);
    pushEvent(state, { type: 'drop', actorId: monster.id, item: drop.item, position: monster.position });
  }
}

function processRespawns(state: RoWorldState) {
  for (const monster of state.monsters) {
    if (monster.respawnAt === null || monster.respawnAt > state.nowMs) continue;
    monster.position = { ...monster.home };
    monster.hp = PORING_RENEWAL.hp;
    monster.alive = true;
    monster.engaged = false;
    monster.respawnAt = null;
    monster.nextAttackAt = 0;
  }
}

function isPlayerWalking(state: RoWorldState) {
  return state.route.length > 0;
}

function processNaturalRecovery(state: RoWorldState) {
  if (!isPlayerWalking(state) && state.player.hp < state.player.maxHp) {
    const amount = Math.min(
      renewalNaturalHpRecovery(state.player.maxHp, novice.vit),
      state.player.maxHp - state.player.hp,
    );
    state.player.hp += amount;
    if (amount > 0) pushEvent(state, { type: 'heal', actorId: 'player', amount });
  }
  state.player.nextHpRegenAt = state.nowMs + 6000;
}

function preparePickup(state: RoWorldState, field: RoField) {
  if (state.pickupId && state.groundItems.some((item) => item.id === state.pickupId)) return true;
  const item = state.groundItems[0];
  if (!item) return false;
  state.pickupId = item.id;
  state.route = shortestPath(field, state.player.position, item.position);
  return true;
}

function processPlayerAction(state: RoWorldState, field: RoField) {
  if (state.player.hp <= Math.trunc(state.player.maxHp / 2) && (state.inventory.Apple ?? 0) > 0) {
    state.inventory.Apple -= 1;
    const rolled =
      APPLE_RENEWAL.healMinimum +
      Math.trunc(nextRandom(state) * (APPLE_RENEWAL.healMaximum - APPLE_RENEWAL.healMinimum + 1));
    const amount = Math.min(rolled, state.player.maxHp - state.player.hp);
    state.player.hp += amount;
    pushEvent(state, { type: 'use_item', actorId: 'player', item: APPLE_RENEWAL.aegisName, amount });
  }

  if (preparePickup(state, field)) {
    const item = state.groundItems.find((candidate) => candidate.id === state.pickupId);
    if (!item) return;
    if (samePosition(state.player.position, item.position)) {
      state.inventory[item.item] = (state.inventory[item.item] ?? 0) + 1;
      state.groundItems = state.groundItems.filter((candidate) => candidate.id !== item.id);
      pushEvent(state, { type: 'pickup', item: item.item, position: item.position });
      state.pickupId = null;
      state.route = [];
      return;
    }
    if (state.route.length === 0) state.route = shortestPath(field, state.player.position, item.position);
    const step = state.route.shift();
    if (step) {
      state.player.position = step;
      pushEvent(state, { type: 'move', actorId: 'player', position: step });
    }
    state.player.nextActionAt = state.nowMs + PLAYER_WALK_DELAY_MS;
    return;
  }

  if (!state.targetId) chooseTarget(state);
  const target = state.monsters.find((monster) => monster.id === state.targetId && monster.alive);
  if (!target) {
    state.targetId = null;
    state.route = [];
    state.player.nextActionAt = state.nowMs;
    return;
  }

  if (distance(state.player.position, target.position) > PORING_RENEWAL.attackRange) {
    if (state.route.length === 0) {
      const routeToTarget = shortestPath(field, state.player.position, target.position);
      state.route = routeToTarget.slice(0, -PORING_RENEWAL.attackRange);
    }
    const step = state.route.shift();
    if (step) {
      state.player.position = step;
      pushEvent(state, { type: 'move', actorId: 'player', targetId: target.id, position: step });
    }
    state.player.nextActionAt = state.nowMs + PLAYER_WALK_DELAY_MS;
    return;
  }

  target.engaged = true;
  if (target.nextAttackAt === 0) target.nextAttackAt = state.nowMs + PORING_RENEWAL.attackDelayMs;
  const chance = renewalHitChance(renewalPlayerHit(novice), renewalMonsterFlee(poring));
  if (rollPercent(state, chance)) {
    target.hp = Math.max(0, target.hp - PLAYER_DAMAGE_TO_PORING);
    pushEvent(state, {
      type: 'player_hit', actorId: 'player', targetId: target.id,
      amount: PLAYER_DAMAGE_TO_PORING, remainingHp: target.hp, maximumHp: PORING_RENEWAL.hp,
    });
    if (target.hp === 0) {
      target.alive = false;
      target.engaged = false;
      target.respawnAt = state.nowMs + target.respawnMs;
      state.kills += 1;
      state.player.baseExp += PORING_RENEWAL.baseExp;
      state.player.jobExp += PORING_RENEWAL.jobExp;
      pushEvent(state, { type: 'death', actorId: target.id, targetId: 'player', position: target.position });
      createDrops(state, target);
      state.targetId = null;
      state.route = [];
    }
  } else {
    pushEvent(state, { type: 'player_miss', actorId: 'player', targetId: target.id });
  }
  state.player.nextActionAt = state.nowMs + PLAYER_ATTACK_DELAY_MS;
}

function processMonsterAttacks(state: RoWorldState) {
  for (const monster of state.monsters) {
    if (!monster.alive || !monster.engaged || monster.nextAttackAt > state.nowMs) continue;
    if (distance(monster.position, state.player.position) > PORING_RENEWAL.attackRange) continue;
    const chance = renewalHitChance(renewalMonsterHit(poring), renewalPlayerFlee(novice));
    if (rollPercent(state, chance)) {
      state.player.hp = Math.max(0, state.player.hp - PORING_DAMAGE_TO_NOVICE);
      pushEvent(state, {
        type: 'monster_hit', actorId: monster.id, targetId: 'player',
        amount: PORING_DAMAGE_TO_NOVICE, remainingHp: state.player.hp, maximumHp: state.player.maxHp,
      });
      if (state.player.hp === 0) state.status = 'dead';
    } else {
      pushEvent(state, { type: 'monster_miss', actorId: monster.id, targetId: 'player' });
    }
    monster.nextAttackAt = state.nowMs + PORING_RENEWAL.attackDelayMs;
  }
}

export function createRoWorld(field: RoField, seed: number): RoWorldState {
  return {
    nowMs: 0,
    randomState: seed >>> 0,
    status: 'running',
    player: {
      position: { ...PRT_FILD08.noviceEntry },
      hp: 40,
      maxHp: 40,
      baseExp: 0,
      jobExp: 0,
      nextActionAt: 0,
      nextHpRegenAt: 6000,
    },
    monsters: createPoringPlacements(field, seed).map((placement, index) => ({
      id: `poring-${index + 1}`,
      position: { x: placement.x, y: placement.y },
      home: { x: placement.x, y: placement.y },
      hp: PORING_RENEWAL.hp,
      alive: true,
      engaged: false,
      nextAttackAt: 0,
      respawnAt: null,
      respawnMs: placement.respawnMs,
    })),
    groundItems: [],
    inventory: {},
    targetId: null,
    pickupId: null,
    route: [],
    events: [],
    kills: 0,
  };
}

export function advanceRoWorld(input: RoWorldState, field: RoField, durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('duration must be non-negative');
  const state = cloneWorld(input);
  const finishAt = state.nowMs + durationMs;

  while (state.status === 'running') {
    const nextMonsterAttack = state.monsters.reduce(
      (next, monster) =>
        monster.alive && monster.engaged && monster.nextAttackAt > 0
          ? Math.min(next, monster.nextAttackAt)
          : next,
      Number.POSITIVE_INFINITY,
    );
    const nextRespawn = state.monsters.reduce(
      (next, monster) => (monster.respawnAt === null ? next : Math.min(next, monster.respawnAt)),
      Number.POSITIVE_INFINITY,
    );
    const nextAt = Math.min(
      state.player.nextActionAt,
      state.player.nextHpRegenAt,
      nextMonsterAttack,
      nextRespawn,
    );
    if (nextAt > finishAt) break;
    state.nowMs = nextAt;
    processRespawns(state);
    processMonsterAttacks(state);
    if (state.status === 'running' && state.player.nextHpRegenAt <= state.nowMs) processNaturalRecovery(state);
    if (state.status === 'running' && state.player.nextActionAt <= state.nowMs) processPlayerAction(state, field);
  }

  if (state.status === 'running') state.nowMs = finishAt;
  return state;
}
