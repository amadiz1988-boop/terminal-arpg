import assert from 'node:assert/strict';
import { defaultCanonicalConfig, defaultConfigRow } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { resolveHpPotionProfile } from '../ops/ro-stack/dashboard/hp-potion-profile.mjs';
import { resolveFarmExecutionProfile } from '../ops/ro-stack/dashboard/farm-execution-profile.mjs';

const config = defaultCanonicalConfig();
assert.deepEqual(resolveHpPotionProfile(config), { ok: true, rules: [] });
const first = defaultConfigRow('itemUse');
first.item = '501';
first.conditions.hp = '< 50%';
first.conditions.timeout = 2.5;
const second = defaultConfigRow('itemUse');
second.item = '504';
second.conditions.hp = '< 20%';
config.combat.itemUse = [first, second];
assert.deepEqual(resolveHpPotionProfile(config), {
  ok: true,
  rules: [
    { itemId: 501, belowPercent: 50, timeoutMs: 2500 },
    { itemId: 504, belowPercent: 20, timeoutMs: 0 },
  ],
});
assert.equal(resolveFarmExecutionProfile(config, { skillEnabled: false }).reason, 'HP_POTION_REQUIRES_SURVIVAL');
const farm = resolveFarmExecutionProfile(config, { skillEnabled: false, survivalEnabled: true });
assert.equal(farm.ok, true);
assert.deepEqual(farm.payload.hpPotionRules, resolveHpPotionProfile(config).rules);
first.conditions.whenStatusActive = 'Blessing';
assert.deepEqual(resolveHpPotionProfile(config), {
  ok: false, reason: 'HP_POTION_CONDITION_UNSUPPORTED', index: 0, key: 'whenStatusActive',
});
first.conditions.whenStatusActive = '';
first.conditions.hp = '<= 50%';
assert.equal(resolveHpPotionProfile(config).reason, 'HP_POTION_HP_CONDITION_UNSUPPORTED');
first.conditions.hp = '< 50%';
first.item = 'Red Potion';
assert.equal(resolveHpPotionProfile(config).reason, 'HP_POTION_ITEM_ID_UNSUPPORTED');
first.disabled = true;
assert.deepEqual(resolveHpPotionProfile(config).rules, [{ itemId: 504, belowPercent: 20, timeoutMs: 0 }]);
console.log('M1_HP_POTION_PROFILE_PASS');
