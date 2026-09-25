// Thin command adapter. The persisted player config selects the already
// accepted GI profile; rAthena remains the skill and attack authority.
import { resolveHpPotionProfile } from './hp-potion-profile.mjs';
import { resolveAttackSkillProfile } from './attack-skill-profile.mjs';
import { resolveSelfRecoverySkillProfile } from './self-recovery-skill-profile.mjs';

export function resolveFarmExecutionProfile(config, farmPayload) {
  const profile = config?.combat?.profile;
  const attackMode = config?.combat?.attack?.mode;
  const attackUseWeapon = config?.combat?.attack?.useWeapon;
  const huntRelocationEnabled = config?.combat?.travel?.flyWing?.enabled;
  const attackDistance = config?.combat?.attack?.distance;
  const attackMaxDistance = config?.combat?.attack?.maxDistance;
  if (!['MELEE_DAMAGE', 'RANGED_DAMAGE', 'SKILL_CAST', 'HYBRID_DAMAGE',
    'HEAL_SUPPORT', 'COMBAT_SUPPORT', 'FOLLOW_SUPPORT', 'PASSIVE_FOLLOW'].includes(profile))
    return { ok: false, reason: 'UNKNOWN_COMBAT_PROFILE' };
  if (!['MELEE_DAMAGE', 'SKILL_CAST', 'HYBRID_DAMAGE'].includes(profile))
    return { ok: false, reason: 'PROFILE_EXECUTOR_UNAVAILABLE' };
  if (attackMode !== 2)
    return { ok: false, reason: 'PROFILE_ATTACK_MODE_UNSUPPORTED' };
  if (typeof attackUseWeapon !== 'boolean')
    return { ok: false, reason: 'PROFILE_WEAPON_POLICY_INVALID' };
  if (typeof huntRelocationEnabled !== 'boolean')
    return { ok: false, reason: 'FARM_FLY_WING_POLICY_INVALID' };
  if (!Number.isInteger(attackDistance) || !Number.isInteger(attackMaxDistance) ||
      attackDistance < 1 || attackDistance > 30 ||
      attackMaxDistance < attackDistance || attackMaxDistance > 30)
    return { ok: false, reason: 'ATTACK_DISTANCE_CONTRACT_INVALID' };
  if (profile === 'SKILL_CAST' && (attackUseWeapon || farmPayload.skillEnabled !== true))
    return { ok: false, reason: 'PROFILE_SKILL_ONLY_REQUIRES_SKILL' };
  if (profile === 'HYBRID_DAMAGE' && (!attackUseWeapon || farmPayload.skillEnabled !== true))
    return { ok: false, reason: 'PROFILE_HYBRID_REQUIRES_BOTH' };
  if (profile === 'MELEE_DAMAGE' && !attackUseWeapon)
    return { ok: false, reason: 'PROFILE_NO_ATTACK_METHOD' };
  const hpPotion = resolveHpPotionProfile(config);
  if (!hpPotion.ok) return hpPotion;
  if (hpPotion.rules.length && farmPayload.survivalEnabled !== true)
    return { ok: false, reason: 'HP_POTION_REQUIRES_SURVIVAL' };
  const attackSkills = resolveAttackSkillProfile(config);
  if (!attackSkills.ok) return attackSkills;
  if (attackSkills.slots.length && farmPayload.skillEnabled !== true)
    return { ok: false, reason: 'ATTACK_SKILL_SLOTS_REQUIRE_SKILL_ENABLED' };
  const selfRecoverySkills = resolveSelfRecoverySkillProfile(config);
  if (!selfRecoverySkills.ok) return selfRecoverySkills;
  if (selfRecoverySkills.slots.length && farmPayload.survivalEnabled !== true)
    return { ok: false, reason: 'SELF_RECOVERY_SKILLS_REQUIRE_SURVIVAL' };
  return { ok: true, payload: {
    combatProfile: profile,
    attackMode,
    attackUseWeapon,
    huntRelocationEnabled,
    attackDistance,
    attackMaxDistance,
    ...(hpPotion.rules.length ? { hpPotionRules: hpPotion.rules } : {}),
    ...(attackSkills.slots.length ? { skillId: attackSkills.slots[0].skillId, attackSkillSlots: attackSkills.slots } : {}),
    ...(selfRecoverySkills.slots.length ? { selfRecoverySkillSlots: selfRecoverySkills.slots } : {}),
  } };
}
