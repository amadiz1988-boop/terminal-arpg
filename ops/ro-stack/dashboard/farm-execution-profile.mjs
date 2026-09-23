// Thin command adapter. The persisted player config selects the already
// accepted GI profile; rAthena remains the skill and attack authority.
export function resolveFarmExecutionProfile(config, farmPayload) {
  const profile = config?.combat?.profile;
  const attackMode = config?.combat?.attack?.mode;
  const attackUseWeapon = config?.combat?.attack?.useWeapon;
  const huntRelocationEnabled = config?.combat?.travel?.flyWing?.enabled;
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
  if (profile === 'SKILL_CAST' && (attackUseWeapon || farmPayload.skillEnabled !== true))
    return { ok: false, reason: 'PROFILE_SKILL_ONLY_REQUIRES_SKILL' };
  if (profile === 'HYBRID_DAMAGE' && (!attackUseWeapon || farmPayload.skillEnabled !== true))
    return { ok: false, reason: 'PROFILE_HYBRID_REQUIRES_BOTH' };
  if (profile === 'MELEE_DAMAGE' && !attackUseWeapon)
    return { ok: false, reason: 'PROFILE_NO_ATTACK_METHOD' };
  return { ok: true, payload: {
    combatProfile: profile,
    attackMode,
    attackUseWeapon,
    huntRelocationEnabled,
  } };
}
