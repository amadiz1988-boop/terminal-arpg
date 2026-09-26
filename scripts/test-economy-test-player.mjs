import assert from 'node:assert/strict';
import { defaultCanonicalConfig } from '../ops/ro-stack/dashboard/config-schema.mjs';
import { configWriteAdmission } from '../ops/ro-stack/dashboard/config-capabilities.mjs';
import {
  parseEconomyCli, economyPrecondition, economyTestConfig, economyDeltas,
} from './lib/economy-test-player.mjs';

assert.equal(parseEconomyCli([]).execute, false);
assert.equal(parseEconomyCli(['--execute', '--char', '150105', '--timeout', '120']).timeoutMs, 120000);
assert.throws(() => parseEconomyCli(['--char', '150106']), /FIXTURE_IDENTITY_REQUIRED/);
assert.throws(() => parseEconomyCli(['--timeout', '0']), /TIMEOUT_OUT_OF_RANGE/);
const eligibility = { charId: 150105, accountId: 2000163, groupId: 0, isTest: true,
  characterOnline: true, ownershipState: 'SERVER_AGENT', agentMode: 'PERSISTENT_IDLE', activeCommandCount: 0 };
const before = { resident: true, inventory: { 502: 0, 503: 0 }, storage: { 502: 0, 503: 0 }, zeny: 9000 };
const inventory = { inventorySlots: 17, inventoryMaxSlots: 100 };
assert.equal(economyPrecondition(eligibility, before, inventory), null);
assert.equal(economyPrecondition({ ...eligibility, groupId: 99 }, before, inventory), 'FIXTURE_IDENTITY_MISMATCH');
assert.equal(economyPrecondition(eligibility, { ...before, inventory: { 502: 1, 503: 0 } }, inventory), 'FIXTURE_PREIMAGE_NOT_EMPTY');
const original = defaultCanonicalConfig();
const config = economyTestConfig(original, 17);
assert.equal(original.supply.enabled, false);
assert.equal(config.supply.enabled, true);
assert.equal(config.supply.inventorySlotTrigger, 19);
assert.equal(config.supply.services.buy.enabled, false);
assert.deepEqual(config.supply.itemRules.filter(row => ['502', '503'].includes(row.item))
  .map(row => [row.item, row.storage, row.sell]), [['502', true, false], ['503', false, true]]);
assert.equal(configWriteAdmission(original, config, { editable: true, capabilities: {
  supply: { supported: true }, combat: { supported: true },
} }).ok, false); // Synthetic executor shape cannot be treated as a live capability grant.
assert.deepEqual(economyDeltas({ inventory: { 502: 1, 503: 1 }, storage: { 502: 0 }, zeny: 9000 },
  { inventory: { 502: 0, 503: 0 }, storage: { 502: 1 }, zeny: 9002 }),
  { store: true, sell: true, storeQuantity: 1, storageQuantity: 1, sellQuantity: 1, zenyGain: 2 });
assert.equal(economyDeltas(before, before).store, false);
console.log('ECONOMY_TEST_PLAYER_TEST_PASS');
