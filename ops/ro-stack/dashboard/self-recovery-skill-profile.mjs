import { CONFIG_ROW_SCHEMAS, defaultConfigRow, getConfigPath } from './config-schema.mjs';

// M1 supports ordered, self-targeted HP recovery only. Native validates its
// configured skill allowlist; rAthena remains the cast and SP authority.
const admittedPaths = new Set(['skill', 'level', 'disabled', 'conditions.hp', 'conditions.sp', 'conditions.timeout']);
const defaults = defaultConfigRow('selfSkill');

function percentCondition(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = /^([<>])\s*(\d{1,3})%$/.exec(text);
  if (!match) return undefined;
  const percent = Number(match[2]);
  return percent >= 1 && percent <= 100 ? { operator: match[1], percent } : undefined;
}

export function resolveSelfRecoverySkillProfile(config) {
  const rows = config?.combat?.skills?.selfSkills;
  if (!Array.isArray(rows)) return { ok: false, reason: 'SELF_RECOVERY_SKILL_CONFIG_INVALID' };
  const slots = [];
  for (const [index, row] of rows.entries()) {
    if (row?.disabled === true) continue;
    if (!row || typeof row !== 'object' || slots.length >= 8)
      return { ok: false, reason: 'SELF_RECOVERY_SKILL_SLOTS_UNSUPPORTED', index };
    for (const descriptor of CONFIG_ROW_SCHEMAS.selfSkill) {
      if (admittedPaths.has(descriptor.path)) continue;
      if (JSON.stringify(getConfigPath(row, descriptor.path)) !== JSON.stringify(getConfigPath(defaults, descriptor.path)))
        return { ok: false, reason: 'SELF_RECOVERY_SKILL_CONDITION_UNSUPPORTED', index, key: descriptor.path };
    }
    const skillText = String(row.skill ?? '').trim();
    const skillId = Number(skillText);
    if (!/^\d+$/.test(skillText) || !Number.isSafeInteger(skillId) || skillId < 1 || skillId > 65535)
      return { ok: false, reason: 'SELF_RECOVERY_SKILL_ID_UNSUPPORTED', index };
    const level = Number(row.level);
    if (!Number.isInteger(level) || level < 1 || level > 100)
      return { ok: false, reason: 'SELF_RECOVERY_SKILL_LEVEL_INVALID', index };
    const hp = percentCondition(row.conditions?.hp);
    const sp = percentCondition(row.conditions?.sp);
    if (hp === undefined || sp === undefined)
      return { ok: false, reason: 'SELF_RECOVERY_SKILL_PERCENT_CONDITION_UNSUPPORTED', index };
    const timeoutSeconds = Number(row.conditions?.timeout ?? 0);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 0 || timeoutSeconds > 3600000)
      return { ok: false, reason: 'SELF_RECOVERY_SKILL_TIMEOUT_INVALID', index };
    slots.push({
      skillId, level,
      hpOperator: hp?.operator ?? '', hpPercent: hp?.percent ?? 0,
      spOperator: sp?.operator ?? '', spPercent: sp?.percent ?? 0,
      timeoutMs: Math.round(timeoutSeconds * 1000),
    });
  }
  return { ok: true, slots };
}
