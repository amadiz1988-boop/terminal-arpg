import type { AffixStat, BuildSnapshot, Item, ResolvedStats } from '../core/types';

function sum(items: Array<Item | undefined>, stat: AffixStat) {
  return items.flatMap((item) => item?.affixes ?? []).filter((affix) => affix.stat === stat).reduce((total, affix) => total + affix.value, 0);
}

export function resolveStats(build: BuildSnapshot): ResolvedStats {
  const items = [build.weapon, build.armor];
  const mastery = build.masteries ?? { power: 0, tempo: 0, guard: 0 };
  const damage = sum(items, 'damage') + mastery.power * 8;
  const speed = sum(items, 'speed') + mastery.tempo * 5;
  const crit = build.skill.critChance + sum(items, 'crit');
  const moveSpeed = build.skill.moveSpeed + sum(items, 'move') + mastery.tempo * 5;
  const life = Math.round((500 + sum(items, 'life')) * (1 + mastery.guard * .12));
  const armor = Math.round((100 + sum(items, 'armor')) * (1 + mastery.guard * .12));
  const hit = build.skill.baseDamage * (1 + damage / 100);
  const attacks = build.skill.attacksPerSecond * (1 + speed / 100);
  const dps = Math.round(hit * attacks * (1 + crit * 0.015));
  return {
    dps,
    bossDps: Math.round(dps * (build.skill.tags.includes('projectile') ? 1.12 : 1)),
    clearScore: Math.round(dps * (moveSpeed / 100) * (build.skill.tags.includes('chain') || build.skill.tags.includes('area') ? 1.25 : 1)),
    life,
    armor,
    moveSpeed,
    critChance: crit,
  };
}
