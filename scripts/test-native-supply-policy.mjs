import assert from 'node:assert/strict';
import { defaultCanonicalConfig } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { nativeSupplyPolicy } from '../ops/ro-stack/persistent-agent/native-supply-policy.mjs';

const config = defaultCanonicalConfig();
const policy = nativeSupplyPolicy(config);
assert.deepEqual([policy.enabled, policy.storageEnabled, policy.sellEnabled, policy.buyEnabled],
  [false, true, true, true]);
assert.equal(policy.weightTriggerPercent, 75);
assert.equal(policy.inventorySlotTrigger, 99);
assert.deepEqual(policy.itemRules[0], { itemId: 0, keepAmount: 0, storage: true, sell: false });
assert.deepEqual(policy.itemRules.find((row) => row.itemId === 501),
  { itemId: 501, keepAmount: 100, storage: false, sell: false });
assert.deepEqual(policy.buyRules.map((row) => row.itemId), [501]);
config.supply.itemRules.push({ ...config.supply.itemRules[0], item: '909',
  keepAmount: 3, storage: false, sell: true });
assert.deepEqual(nativeSupplyPolicy(config).itemRules.find((row) => row.itemId === 909),
  { itemId: 909, keepAmount: 3, storage: false, sell: true });
const custom = config.supply.itemRules.at(-1);
custom.storage = true;
assert.deepEqual(nativeSupplyPolicy(config).itemRules.find((row) => row.itemId === 909),
  { itemId: 909, keepAmount: 3, storage: true, sell: true });
custom.storage = false;
custom.item = 'unknown';
assert.throws(() => nativeSupplyPolicy(config), /SUPPLY_POLICY_UNAVAILABLE/);
custom.item = '909';
config.supply.enabled = true;
config.supply.services.storage.enabled = false;
config.supply.services.sell.enabled = false;
config.supply.services.buy.enabled = false;
const disabledServices = nativeSupplyPolicy(config);
assert.deepEqual([disabledServices.enabled, disabledServices.storageEnabled,
  disabledServices.sellEnabled, disabledServices.buyEnabled], [true, false, false, false]);
assert.deepEqual(disabledServices.buyRules.map((row) => row.itemId), [501]);
config.supply.services.buy.enabled = 'false';
assert.throws(() => nativeSupplyPolicy(config), /SUPPLY_POLICY_UNAVAILABLE/);
config.supply.services.buy.enabled = false;
config.supply.itemRules.push({ ...config.supply.itemRules.at(-1) });
assert.throws(() => nativeSupplyPolicy(config), /SUPPLY_POLICY_UNAVAILABLE/);
config.supply.itemRules.pop();
config.supply.services.buy.rules[0].maxAmount = 0;
assert.throws(() => nativeSupplyPolicy(config), /SUPPLY_POLICY_UNAVAILABLE/);
console.log('NATIVE_SUPPLY_POLICY_SOURCE_PASS cases=14');
