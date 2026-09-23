import assert from 'node:assert/strict';
import { defaultCanonicalConfig, defaultConfigRow } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { resolveAttackSkillProfile } from '../ops/ro-stack/dashboard/attack-skill-profile.mjs';
import { resolveFarmExecutionProfile } from '../ops/ro-stack/dashboard/farm-execution-profile.mjs';

const config = defaultCanonicalConfig();
assert.deepEqual(resolveAttackSkillProfile(config), { ok: true, slots: [] });
const first = defaultConfigRow('attackSkill');
first.skill = '5';
first.level = 3;
first.conditions.hp = '< 60%';
first.conditions.timeout = 2;
const second = defaultConfigRow('attackSkill');
second.skill = '46';
second.conditions.sp = '> 20%';
config.combat.skills.attackSlots = [first, second];
assert.deepEqual(resolveAttackSkillProfile(config), {
  ok: true,
  slots: [
    { skillId: 5, level: 3, hpOperator: '<', hpPercent: 60, spOperator: '', spPercent: 0, timeoutMs: 2000 },
    { skillId: 46, level: 1, hpOperator: '', hpPercent: 0, spOperator: '>', spPercent: 20, timeoutMs: 0 },
  ],
});
assert.equal(resolveFarmExecutionProfile(config, { skillEnabled: false }).reason, 'ATTACK_SKILL_SLOTS_REQUIRE_SKILL_ENABLED');
const farm = resolveFarmExecutionProfile(config, { skillEnabled: true });
assert.equal(farm.ok, true);
assert.equal(farm.payload.skillId, 5);
assert.equal(farm.payload.attackSkillSlots.length, 2);
first.conditions.whenStatusActive = 'Blessing';
assert.deepEqual(resolveAttackSkillProfile(config), {
  ok: false, reason: 'ATTACK_SKILL_CONDITION_UNSUPPORTED', index: 0, key: 'conditions.whenStatusActive',
});
first.conditions.whenStatusActive = '';
first.conditions.hp = '<= 60%';
assert.equal(resolveAttackSkillProfile(config).reason, 'ATTACK_SKILL_PERCENT_CONDITION_UNSUPPORTED');
first.conditions.hp = '< 60%';
first.disabled = true;
assert.equal(resolveAttackSkillProfile(config).slots[0].skillId, 46);
console.log('M1_ATTACK_SKILL_PROFILE_PASS');
