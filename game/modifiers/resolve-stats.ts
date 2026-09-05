import type { AffixStat, BuildSnapshot, Item, ResolvedStats } from '../core/types';

function sum(items: Array<Item | undefined>, stat: AffixStat) {
  return items.flatMap((item) => item?.affixes ?? []).filter((affix) => affix.stat === stat).reduce((total, affix) => total + affix.value, 0);
}

export function resolveStats(build: BuildSnapshot): ResolvedStats {
  const items = [build.weapon, build.armor];
  const damage = sum(items, 'damage');
  const speed = sum(items, 'speed');
  const crit = build.skill.critChance + sum(items, 'crit');
  const moveSpeed = build.skill.moveSpeed + sum(items, 'move');
  const life = 500 + sum(items, 'life');
  const armor = 100 + sum(items, 'armor');
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
