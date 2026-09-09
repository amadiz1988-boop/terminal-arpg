import { rAthenaSource } from '../source';

export type RenewalStats = Readonly<{
  level: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  con?: number;
  pow?: number;
}>;

export const RENEWAL_FORMULA_SOURCES = Object.freeze({
  derivedStats: rAthenaSource('src/map/status.cpp', 'status_calc_misc'),
  baseAttack: rAthenaSource('src/map/status.cpp', 'status_base_atk'),
  hitCheck: rAthenaSource('src/map/battle.cpp', 'is_attack_hitting'),
  hitRateConfig: rAthenaSource('conf/battle/battle.conf', 'min_hitrate/max_hitrate'),
  maxHp: rAthenaSource('src/map/status.cpp', 'status_calc_maxhp_pc'),
  maxSp: rAthenaSource('src/map/status.cpp', 'status_calc_maxsp_pc'),
});

const intDiv = (value: number, divisor: number) => Math.trunc(value / divisor);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function renewalPlayerHit(stats: RenewalStats) {
  return clamp(
    stats.level + stats.dex + intDiv(stats.luk, 3) + 175 + 2 * (stats.con ?? 0),
    1,
    32767,
  );
}

export function renewalPlayerFlee(stats: RenewalStats) {
  return clamp(
    stats.level + stats.agi + intDiv(stats.luk, 5) + 100 + 2 * (stats.con ?? 0),
    1,
    32767,
  );
}

export function renewalMonsterHit(stats: RenewalStats) {
  return clamp(stats.level + stats.dex + 150 + 2 * (stats.con ?? 0), 1, 32767);
}

export function renewalMonsterFlee(stats: RenewalStats) {
  return clamp(stats.level + stats.agi + 100 + 2 * (stats.con ?? 0), 1, 32767);
}

export function renewalBaseAttack(stats: RenewalStats, rangedWeapon = false) {
  const primary = rangedWeapon ? stats.dex : stats.str;
  const secondary = rangedWeapon ? stats.str : stats.dex;
  const numerator =
    primary * 10 +
    intDiv(secondary * 10, 5) +
    intDiv(stats.luk * 10, 3) +
    intDiv(stats.level * 10, 4);
  return clamp(intDiv(numerator, 10) + 5 * (stats.pow ?? 0), 0, 65535);
}

export function renewalHitChance(attackerHit: number, targetFlee: number) {
  return clamp(attackerHit - targetFlee, 5, 100);
}

export function renewalMaxHp(baseHp: number, vit: number) {
  return Math.max(1, Math.trunc(baseHp * (1 + vit * 0.01)));
}

export function renewalMaxSp(baseSp: number, intelligence: number) {
  return Math.max(1, Math.trunc(baseSp * (1 + intelligence * 0.01)));
}
