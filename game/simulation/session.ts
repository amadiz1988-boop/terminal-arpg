import { FARMING_ROUTES } from '../content/farming-routes';
import { SKILLS } from '../content/skills';
import type { FarmingRouteId, Item, SalvageMaterials } from '../core/types';
import { createStarterWeapon, evaluateItem, generateItem, salvageValue } from '../items/items';
import { simulateMapCompletion } from './map';

export type AcceleratedSessionReport = {
  equivalentMinutes: number;
  mapsRun: number;
  successes: number;
  deaths: number;
  decisions: number;
  upgrades: number;
  chaseRewards: number;
  strategyChanges: number;
  recoveries: number;
  longestMapsWithoutReward: number;
  materialsSpent: number;
  finalCurrency: number;
  score: number;
  scoreBreakdown: Record<'decisions'|'feedback'|'build'|'chase'|'replay'|'stability', number>;
};

const ROUTE_ORDER: FarmingRouteId[] = ['arsenal', 'foundry', 'hunter'];

export function simulateAcceleratedSession(seed = 824, mapsToRun = 45): AcceleratedSessionReport {
  let routeIndex = 0;
  let routeId = ROUTE_ORDER[routeIndex];
  let weapon: Item = createStarterWeapon();
  let armor: Item | undefined;
  let currency = 0;
  let decisions = 1;
  let upgrades = 0;
  let chaseRewards = 0;
  let strategyChanges = 0;
  let recoveries = 0;
  let successes = 0;
  let deaths = 0;
  let routeProgress = 0;
  let mapsSinceReward = 0;
  let longestMapsWithoutReward = 0;
  let materials: SalvageMaterials = { scrap: 0, essence: 0, core: 0 };
  let materialsSpent = 0;
  const stock = [0, 8, 0, 0, 0, 0];

  for (let index = 0; index < mapsToRun; index += 1) {
    if (index > 0 && index % 10 === 0) {
      routeIndex = (routeIndex + 1) % ROUTE_ORDER.length;
      routeId = ROUTE_ORDER[routeIndex];
      strategyChanges += 1;
      decisions += 1;
    }
    let tier = [5, 4, 3, 2, 1].find((value) => stock[value] > 0);
    if (!tier) {
      stock[1] += 3;
      materials.scrap += 3;
      recoveries += 1;
      tier = 1;
    }
    stock[tier] -= 1;
    const build = { skill: SKILLS[FARMING_ROUTES[routeId].favoredSkill], weapon, armor };
    const result = simulateMapCompletion(seed + index, tier, routeId === 'hunter' ? 'boss-rush' : routeId === 'foundry' ? 'currency' : 'full-clear', build, routeId === 'hunter' ? 'greed' : 'scout', routeId);
    mapsSinceReward += 1;
    if (!result.success) {
      deaths += 1;
      continue;
    }
    successes += 1;
    currency += result.currency;
    stock[result.mapDropTier] += 1;
    routeProgress += 1;
    const evaluation = evaluateItem(result.item, build);
    if (evaluation.classification === 'upgrade') {
      if (result.item.slot === 'weapon') weapon = result.item;
      else armor = result.item;
      upgrades += 1;
      decisions += 1;
      longestMapsWithoutReward = Math.max(longestMapsWithoutReward, mapsSinceReward);
      mapsSinceReward = 0;
    } else {
      const gained = salvageValue(result.item);
      materials = { scrap: materials.scrap + gained.scrap, essence: materials.essence + gained.essence, core: materials.core + gained.core };
    }
    if (routeProgress >= 4) {
      const choices = [0, 1, 2].map((offset) => generateItem(seed + index * 20 + offset, tier * 18 + 20, routeId === 'arsenal' ? 'weapon' : undefined));
      const best = choices.map((item) => ({ item, value: Math.max(evaluateItem(item, { ...build, weapon, armor }).dpsDelta, evaluateItem(item, { ...build, weapon, armor }).survivalDelta) })).sort((a, b) => b.value - a.value)[0].item;
      if (best.slot === 'weapon') weapon = best;
      else armor = best;
      routeProgress = 0;
      chaseRewards += 1;
      upgrades += 1;
      decisions += 1;
      longestMapsWithoutReward = Math.max(longestMapsWithoutReward, mapsSinceReward);
      mapsSinceReward = 0;
    }
    if (materials.scrap >= 5 && index % 6 === 5) {
      materials.scrap -= 5;
      materialsSpent += 5;
      decisions += 1;
    }
  }
  longestMapsWithoutReward = Math.max(longestMapsWithoutReward, mapsSinceReward);
  const scoreBreakdown = {
    decisions: decisions >= 14 ? 2 : decisions >= 9 ? 1.5 : 1,
    feedback: chaseRewards >= 7 && longestMapsWithoutReward <= 5 ? 2 : chaseRewards >= 5 ? 1.5 : 1,
    build: upgrades >= 8 && materialsSpent > 0 ? 2 : upgrades >= 5 ? 1.5 : 1,
    chase: chaseRewards >= 7 ? 2 : chaseRewards >= 4 ? 1.5 : 1,
    replay: strategyChanges >= 3 ? 1 : .5,
    stability: mapsToRun >= 40 && successes + deaths === mapsToRun ? 1 : 0,
  };
  return {
    equivalentMinutes: Math.round((mapsToRun * 42) / 60 * 10) / 10,
    mapsRun: mapsToRun,
    successes, deaths, decisions, upgrades, chaseRewards, strategyChanges, recoveries,
    longestMapsWithoutReward, materialsSpent, finalCurrency: currency,
    score: Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0),
    scoreBreakdown,
  };
}
