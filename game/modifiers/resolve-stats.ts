import type { AffixStat, BuildSnapshot, Item, ResolvedStats } from '../core/types';
import { TALENTS_BY_ID } from '../content/talents';
import { classEffects } from '../content/classes';

function sum(items: Array<Item | undefined>, stat: AffixStat) {
  return items.flatMap((item) => item?.affixes ?? []).filter((affix) => affix.stat === stat).reduce((total, affix) => total + affix.value, 0);
}

export function resolveStats(build: BuildSnapshot): ResolvedStats {
  const items = [build.weapon, build.armor, build.helmet, build.gloves, build.boots, build.amulet];
  const mastery = build.masteries ?? { power: 0, tempo: 0, guard: 0 };
  const job = classEffects(build.classId, build.secondJobId, build.ascendancyNodes);
  const talentEffects = (build.talents ?? []).map((id) => TALENTS_BY_ID[id]?.effect ?? {});
  const talent = (key: 'damage'|'speed'|'crit'|'move'|'life'|'armor'|'boss'|'clear') => talentEffects.reduce((total, effect) => total + (effect[key] ?? 0), 0);
  const damage = sum(items, 'damage') + mastery.power * 8 + talent('damage') + (job.damage ?? 0);
  const speed = sum(items, 'speed') + mastery.tempo * 5 + talent('speed') + (job.speed ?? 0);
  const crit = build.skill.critChance + sum(items, 'crit') + talent('crit') + (job.crit ?? 0);
  const moveSpeed = build.skill.moveSpeed + sum(items, 'move') + mastery.tempo * 5 + talent('move') + (job.move ?? 0);
  const life = Math.round((500 + sum(items, 'life')) * (1 + mastery.guard * .12 + (talent('life') + (job.life ?? 0)) / 100));
  const armor = Math.round((100 + sum(items, 'armor')) * (1 + mastery.guard * .12 + (talent('armor') + (job.armor ?? 0)) / 100));
  const linkedSockets = (build.weapon?.sockets ?? Array.from({ length: build.supportSlots ?? 1 }, () => 'W' as const)).slice(0, build.supportSlots ?? build.weapon?.links ?? 1);
  const skillSocket = linkedSockets.findIndex((color) => color === 'W' || color === build.skill.socketColor);
  const availableSockets = skillSocket >= 0 ? linkedSockets.filter((_, index) => index !== skillSocket) : [];
  const supports = (build.supports ?? []).filter((support) => {
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
  const dps = Math.round(hit * attacks * (1 + crit * 0.015));
  return {
    dps,
    bossDps: Math.round(dps * (build.skill.tags.includes('projectile') ? 1.12 : 1) * supportBoss * (1 + (talent('boss') + (job.boss ?? 0)) / 100)),
    clearScore: Math.round(dps * (moveSpeed / 100) * (build.skill.tags.includes('chain') || build.skill.tags.includes('area') ? 1.25 : 1) * supportClear * (1 + (talent('clear') + (job.clear ?? 0)) / 100)),
    life: Math.round(life * supportLife),
    armor,
    moveSpeed,
    critChance: crit,
  };
}
