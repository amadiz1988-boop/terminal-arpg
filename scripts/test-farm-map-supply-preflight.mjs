import assert from 'node:assert/strict';
import { farmMapSupplyPreflight } from '../ops/ro-stack/persistent-agent/farm-map-supply-preflight.mjs';

const context = { accountId: 7, charId: 9, revision: 14, currentMap: 'moc_fild01', maxAgeMs: 15000 };
const snapshot = { accountId: 7, charId: 9, revision: 14, resident: true,
  map: 'moc_fild01', ageMs: 20, inventorySlots: 42, inventoryMaxSlots: 100,
  weight: 3200, maxWeight: 5000, supplyRequired: false, supplyReason: null };
let cases = 0;
const expect = (value, reason) => {
  assert.equal(farmMapSupplyPreflight(value, context).reason, reason);
  cases++;
};
expect(snapshot, 'READY');
expect({ ...snapshot, supplyRequired: true, supplyReason: 'WEIGHT' }, 'SUPPLY_REQUIRED');
expect({ ...snapshot, supplyRequired: true, supplyReason: 'SLOTS' }, 'SUPPLY_REQUIRED');
expect({ ...snapshot, supplyRequired: true, supplyReason: 'ITEM_LOW' }, 'SUPPLY_REQUIRED');
expect({ ...snapshot, supplyRequired: null }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
expect({ ...snapshot, ageMs: 15001 }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
expect({ ...snapshot, resident: false }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
expect({ ...snapshot, revision: 13 }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
expect({ ...snapshot, map: 'prontera' }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
expect({ ...snapshot, inventoryMaxSlots: null }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
expect({ ...snapshot, weight: 5100 }, 'SUPPLY_PREFLIGHT_UNAVAILABLE');
console.log(`FARM_MAP_SUPPLY_PREFLIGHT_SOURCE_PASS cases=${cases}`);
