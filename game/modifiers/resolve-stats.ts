import type { AffixStat, BuildSnapshot, Item, ResolvedStats } from '../core/types';
import { TALENTS_BY_ID } from '../content/talents';
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
  const talentEffects = (build.talents ?? []).map((id) => TALENTS_BY_ID[id]?.effect ?? {});
  const talent = (key: keyof (typeof talentEffects)[number]) => talentEffects.reduce((total, effect) => total + (typeof effect[key] === 'number' ? effect[key] : 0), 0);
  const base = DEFAULT_ATTACK_BASE[build.classId ?? 'thief'];
  const damage = sum(items, 'damage') + mastery.power * 8 + talent('damage') + talent('attackDamage');
  const speed = sum(items, 'speed') + mastery.tempo * 5 + talent('speed') + talent('attackSpeed');
  return {
    hitDamage: Math.max(1, Math.round(base.hit * (1 + damage / 100))),
    attacksPerSecond: base.attacksPerSecond * (1 + speed / 100),
    critChance: base.critChance + sum(items, 'crit'),
  };
}

export function resolveStats(build: BuildSnapshot): ResolvedStats {
  const items = [build.weapon, build.armor, build.helmet, build.gloves, build.boots, build.amulet];
  const mastery = build.masteries ?? { power: 0, tempo: 0, guard: 0 };
  const talentEffects = (build.talents ?? []).map((id) => TALENTS_BY_ID[id]?.effect ?? {});
  const talent = (key: keyof (typeof talentEffects)[number]) => talentEffects.reduce((total, effect) => total + (typeof effect[key]==='number'?effect[key]:0), 0);
  const attack=build.skill.tags.includes('attack'),spell=build.skill.tags.includes('spell');
  const damage = sum(items, 'damage') + mastery.power * 8 + talent('damage') + (attack?talent('attackDamage'):0) + (spell?talent('spellDamage'):0);
  const speed = sum(items, 'speed') + mastery.tempo * 5 + talent('speed') + (attack?talent('attackSpeed'):0) + (spell?talent('castSpeed'):0);
  const crit = build.skill.critChance + sum(items, 'crit');
  const moveSpeed = build.skill.moveSpeed + sum(items, 'move') + mastery.tempo * 5 + talent('move');
  const life = Math.round((500 + sum(items, 'life')) * (1 + mastery.guard * .12 + talent('life') / 100));
  const armor = Math.round((100 + sum(items, 'armor')) * (1 + mastery.guard * .12 + talent('armor') / 100));
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
  const hit = build.skill.baseDamage * (1 + damage / 100) * supportDamage * socketPenalty;
  const attacks = build.skill.attacksPerSecond * (1 + speed / 100) * supportSpeed;
  const dps = Math.round(hit * attacks * (1 + Math.min(100,crit) / 100 * .5));
  return {
    dps,
    hitDamage: Math.round(hit),
    attacksPerSecond: attacks,
    bossDps: Math.round(dps * (build.skill.tags.includes('projectile') ? 1.12 : 1) * supportBoss * (1 + talent('boss') / 100)),
    clearScore: Math.round(dps * (moveSpeed / 100) * (build.skill.tags.includes('chain') || build.skill.tags.includes('area') ? 1.25 : 1) * supportClear * (1 + talent('clear') / 100)),
    life: Math.round(life * supportLife),
    armor,
    moveSpeed,
    critChance: crit,
    manaPercent: talent('mana'),
    skillCostReduction: talent('skillCostReduction'),
  };
}
