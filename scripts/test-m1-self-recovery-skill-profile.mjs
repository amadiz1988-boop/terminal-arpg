import assert from 'node:assert/strict';
import { defaultCanonicalConfig, defaultConfigRow } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { resolveSelfRecoverySkillProfile } from '../ops/ro-stack/dashboard/self-recovery-skill-profile.mjs';
import { resolveFarmExecutionProfile } from '../ops/ro-stack/dashboard/farm-execution-profile.mjs';

const config = defaultCanonicalConfig();
assert.deepEqual(resolveSelfRecoverySkillProfile(config), { ok: true, slots: [] });
const row = defaultConfigRow('selfSkill');
row.skill = '28';
row.level = 3;
row.conditions.hp = '< 60%';
row.conditions.timeout = 2;
config.combat.skills.selfSkills = [row];
assert.deepEqual(resolveSelfRecoverySkillProfile(config).slots, [{
  skillId: 28, level: 3, hpOperator: '<', hpPercent: 60,
  spOperator: '', spPercent: 0, timeoutMs: 2000,
}]);
assert.equal(resolveFarmExecutionProfile(config, { skillEnabled: false }).reason,
  'SELF_RECOVERY_SKILLS_REQUIRE_SURVIVAL');
assert.equal(resolveFarmExecutionProfile(config, { skillEnabled: false, survivalEnabled: true })
  .payload.selfRecoverySkillSlots[0].skillId, 28);
row.conditions.whenStatusInactive = 'Blessing';
assert.equal(resolveSelfRecoverySkillProfile(config).reason, 'SELF_RECOVERY_SKILL_CONDITION_UNSUPPORTED');
row.conditions.whenStatusInactive = '';
row.conditions.hp = '<= 60%';
assert.equal(resolveSelfRecoverySkillProfile(config).reason,
  'SELF_RECOVERY_SKILL_PERCENT_CONDITION_UNSUPPORTED');
row.disabled = true;
assert.deepEqual(resolveSelfRecoverySkillProfile(config), { ok: true, slots: [] });
console.log('M1_SELF_RECOVERY_SKILL_PROFILE_PASS');
