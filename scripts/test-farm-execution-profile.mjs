import assert from 'node:assert/strict';
import { defaultCanonicalConfig } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { resolveFarmExecutionProfile } from '../ops/ro-stack/dashboard/farm-execution-profile.mjs';

const config = defaultCanonicalConfig();
const farm = { skillEnabled: false };
assert.deepEqual(resolveFarmExecutionProfile(config, farm), {
  ok: true,
  payload: { combatProfile: 'MELEE_DAMAGE', attackMode: 2, attackUseWeapon: true,
    huntRelocationEnabled: true, attackDistance: 1, attackMaxDistance: 1 },
});
config.combat.travel.flyWing.enabled = false;
assert.equal(resolveFarmExecutionProfile(config, farm).payload.huntRelocationEnabled, false);
config.combat.travel.flyWing.enabled = 'false';
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'FARM_FLY_WING_POLICY_INVALID');
config.combat.travel.flyWing.enabled = true;
config.combat.profile = 'SKILL_CAST';
config.combat.attack.useWeapon = false;
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'PROFILE_SKILL_ONLY_REQUIRES_SKILL');
assert.equal(resolveFarmExecutionProfile(config, { skillEnabled: true }).payload.attackUseWeapon, false);
config.combat.profile = 'HYBRID_DAMAGE';
config.combat.attack.useWeapon = true;
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'PROFILE_HYBRID_REQUIRES_BOTH');
assert.equal(resolveFarmExecutionProfile(config, { skillEnabled: true }).ok, true);
config.combat.profile = 'RANGED_DAMAGE';
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'PROFILE_EXECUTOR_UNAVAILABLE');
config.combat.profile = 'UNKNOWN';
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'UNKNOWN_COMBAT_PROFILE');
config.combat.profile = 'MELEE_DAMAGE';
config.combat.attack.mode = 1;
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'PROFILE_ATTACK_MODE_UNSUPPORTED');
config.combat.attack.mode = 2;
config.combat.attack.distance = 2;
config.combat.attack.maxDistance = 3;
assert.equal(resolveFarmExecutionProfile(config, farm).payload.attackMaxDistance, 3);
config.combat.attack.maxDistance = 1;
assert.equal(resolveFarmExecutionProfile(config, farm).reason, 'ATTACK_DISTANCE_CONTRACT_INVALID');
console.log('farm execution profile: PASS');
