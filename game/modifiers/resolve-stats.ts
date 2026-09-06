import type { AffixStat, BuildSnapshot, Item, ResolvedStats } from '../core/types';
import { DEFAULT_RO_STATS, roAverageMagicAttack, roMeleeAttack, roRangedAttack } from '../content/ro-stats';
import { isSupportCompatible } from '../content/supports';

function sum(items: Array<Item | undefined>, stat: AffixStat) {
  return items.flatMap((item) => item?.affixes ?? []).filter((affix) => affix.stat === stat).reduce((total, affix) => total + affix.value, 0);
}

const DEFAULT_ATTACK_BASE = {
  thief: { hit: 8, attacksPerSecond: 1.5, critChance: 8 },
  mage: { hit: 7, attacksPerSecond: 1.5, critChance: 8.3 },
  acolyte: { hit: 7, attacksPerSecond: 1.45, critChance: 5 },
} as const;

/** PoE Default Attack uses the weapon hit, local attack rate and weapon critical chance. */
export function resolveDefaultAttack(build: BuildSnapshot) {
  const items = [build.weapon, build.armor, build.helmet, build.gloves, build.boots, build.amulet];
  const mastery = build.masteries ?? { power: 0, tempo: 0, guard: 0 };
  const roStats = build.roStats ?? DEFAULT_RO_STATS;
  const base = DEFAULT_ATTACK_BASE[build.classId ?? 'thief'];
  const damage = sum(items, 'damage') + mastery.power * 8;
  const speed = sum(items, 'speed') + mastery.tempo * 5;
  const attackDelayMultiplier = Math.max(.05, 1 - roStats.agi * .004 - roStats.dex * .001);
  return {
    hitDamage: Math.max(1, Math.round((base.hit + roMeleeAttack(roStats)) * (1 + damage / 100))),
    attacksPerSecond: base.attacksPerSecond * (1 + speed / 100) / attackDelayMultiplier,
    critChance: base.critChance + sum(items, 'crit') + roStats.luk * .3,
  };
}

export function resolveStats(build: BuildSnapshot): ResolvedStats {
  const items = [build.weapon, build.armor, build.helmet, build.gloves, build.boots, build.amulet];
  const mastery = build.masteries ?? { power: 0, tempo: 0, guard: 0 };
  const roStats = build.roStats ?? DEFAULT_RO_STATS;
  const attack=build.skill.tags.includes('attack'),spell=build.skill.tags.includes('spell');
  const damage = sum(items, 'damage') + mastery.power * 8;
  const speed = sum(items, 'speed') + mastery.tempo * 5;
  const crit = build.skill.critChance + sum(items, 'crit') + roStats.luk * .3;
  const moveSpeed = build.skill.moveSpeed + sum(items, 'move') + mastery.tempo * 5;
  const life = Math.round((500 + sum(items, 'life')) * (1 + mastery.guard * .12) * (1 + roStats.vit / 100));
  const armor = Math.round((100 + sum(items, 'armor')) * (1 + mastery.guard * .12));
  const socketItem=build.socketItem??build.weapon;
  const linkedSockets = (socketItem?.sockets ?? Array.from({ length: build.supportSlots ?? 1 }, () => 'W' as const)).slice(0, build.supportSlots ?? socketItem?.links ?? 1);
  const skillSocket = linkedSockets.findIndex((color) => color === 'W' || color === build.skill.socketColor);
  const availableSockets = skillSocket >= 0 ? linkedSockets.filter((_, index) => index !== skillSocket) : [];
  const supports = (build.supports ?? []).filter((support) => {
    if (!isSupportCompatible(support, build.skill.tags)) return false;
    const socket = availableSockets.findIndex((color) => color === 'W' || color === support.socketColor);
    if (socket < 0) return false;
    availableSockets.splice(socket, 1);
    return true;
  });
  const supportDamage = supports.reduce((value, support) => value * support.damageMultiplier, 1);
  const supportSpeed = supports.reduce((value, support) => value * support.speedMultiplier, 1);
  const supportBoss = supports.reduce((value, support) => value * support.bossMultiplier, 1);
  const supportClear = supports.reduce((value, support) => value * support.clearMultiplier, 1);
  const supportLife = supports.reduce((value, support) => value * support.lifeMultiplier, 1);
  const socketPenalty = skillSocket >= 0 ? 1 : .55;
  const statusDamage = attack ? (build.skill.tags.includes('bow') ? roRangedAttack(roStats) : roMeleeAttack(roStats)) : spell ? roAverageMagicAttack(roStats) : 0;
  const actionDelayMultiplier = attack ? Math.max(.05, 1 - roStats.agi * .004 - roStats.dex * .001) : spell ? Math.max(.05, 1 - roStats.dex / 150) : 1;
  const hit = (build.skill.baseDamage + statusDamage) * (1 + damage / 100) * supportDamage * socketPenalty;
  const attacks = build.skill.attacksPerSecond * (1 + speed / 100) * supportSpeed / actionDelayMultiplier;
  const dps = Math.round(hit * attacks * (1 + Math.min(100,crit) / 100 * .5));
  return {
    dps,
    hitDamage: Math.round(hit),
    attacksPerSecond: attacks,
    bossDps: Math.round(dps * (build.skill.tags.includes('projectile') ? 1.12 : 1) * supportBoss),
    clearScore: Math.round(dps * (moveSpeed / 100) * (build.skill.tags.includes('chain') || build.skill.tags.includes('area') ? 1.25 : 1) * supportClear),
    life: Math.round(life * supportLife),
    armor,
    moveSpeed,
    critChance: crit,
    manaPercent: roStats.int,
    skillCostReduction: 0,
  };
}
