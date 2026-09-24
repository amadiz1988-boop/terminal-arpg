import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertSpecialTransportHoldSet,
  evaluateFarmMapSelection,
  FARM_AVAILABILITY_REASON,
  FARM_ROUTE_CLASS,
  indexFarmMapAvailability,
  SPECIAL_TRANSPORT_HOLD_MAPS,
} from './standard-farm-map-availability.mjs';

const registry = JSON.parse(await readFile(new URL('./standard-farm-map-release-registry.json', import.meta.url), 'utf8'));
const backlog = JSON.parse(await readFile(new URL('../../../docs/openkore-reference/standard-farm-map-special-transport-backlog.json', import.meta.url), 'utf8'));
const availability = indexFarmMapAvailability(registry);

assert.equal(availability.size, 1295);
assert.deepEqual(registry.summary, {
  totalWorldMaps: 1295,
  totalLegalMonsterMaps: 321,
  standardFarmMapCount: 136,
  specialTransportHoldCount: 24,
  nonFarmableCount: 974,
  unsupportedUnknownCount: 161,
});
assert.equal(assertSpecialTransportHoldSet(registry), true);
assert.equal(SPECIAL_TRANSPORT_HOLD_MAPS.length, 24);
assert.equal(backlog.maps.length, 24);
assert.deepEqual(backlog.maps.map((row) => row.MAP), SPECIAL_TRANSPORT_HOLD_MAPS);
for (const row of backlog.maps) {
  for (const field of ['MAP', 'BLOCKER', 'TRANSPORT_TYPE', 'REQUIREMENT_AUTHORITY', 'EXECUTION_METADATA_STATUS', 'RESEARCH_STATUS']) {
    assert.ok(row[field], `${row.MAP}:${field}`);
  }
}

for (const map of ['prt_fild08', 'prt_fild07', 'prt_fild05', 'pay_dun00']) {
  const row = availability.get(map);
  assert.equal(row?.farmable, true, map);
  assert.equal(row?.farmSelectionAvailable, true, map);
  assert.equal(row?.availabilityReason, FARM_AVAILABILITY_REASON.STANDARD_ROUTE_READY, map);
  assert.equal(row?.routeClass, FARM_ROUTE_CLASS.STANDARD, map);
  assert.match(row?.transportRequirement ?? '', /PORTAL/);
  const summary = { normalMonsterCount: 1, primaryMonsters: [{}] };
  assert.equal(evaluateFarmMapSelection({ mapSummary: summary, availability: row }).farmSelectionAvailable, true, map);
}

for (const map of SPECIAL_TRANSPORT_HOLD_MAPS) {
  const row = availability.get(map);
  assert.equal(row?.farmable, true, map);
  assert.equal(row?.farmSelectionAvailable, false, map);
  assert.equal(row?.availabilityReason, FARM_AVAILABILITY_REASON.SPECIAL_TRANSPORT_PENDING, map);
  assert.equal(row?.routeClass, FARM_ROUTE_CLASS.SPECIAL_TRANSPORT, map);
  const result = evaluateFarmMapSelection({ mapSummary: { normalMonsterCount: 1 }, availability: row });
  assert.equal(result.farmSelectionAvailable, false, map);
  assert.equal(result.reason, 'farm_map_not_released', map);
}

assert.deepEqual(
  evaluateFarmMapSelection({ mapSummary: { normalMonsterCount: 0 }, availability: availability.get('prt_fild05') }),
  { farmable: false, farmSelectionAvailable: false, reason: 'farm_map_not_farmable' },
);
assert.equal(
  evaluateFarmMapSelection({ mapSummary: { normalMonsterCount: 1 }, availability: null }).reason,
  'farm_map_not_released',
);

console.log('STANDARD_FARM_MAP_AVAILABILITY_TEST=PASS');
console.log(JSON.stringify({
  registryMaps: availability.size,
  standardFarmMapCount: registry.summary.standardFarmMapCount,
  specialTransportHoldCount: registry.summary.specialTransportHoldCount,
  nonFarmableCount: registry.summary.nonFarmableCount,
  unsupportedUnknownCount: registry.summary.unsupportedUnknownCount,
}, null, 2));
