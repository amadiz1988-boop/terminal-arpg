import assert from 'node:assert/strict';
import { auditNormalWorldAuthorityClosure } from './audit-normal-world-authority-closure.mjs';

const report = await auditNormalWorldAuthorityClosure({
  inventoryPath: 'docs/openkore-reference/world-map-inventory.json',
  openkoreRoot: '.local/ro-stack/openkore',
});

assert.equal(report.stage1InventoryReused, true);
assert.equal(report.mapIndexRescanned, false);
assert.equal(report.weightedSolverModified, false);
assert.equal(report.paAdapterEntered, false);
assert.equal(report.productionTouched, false);
assert.equal(report.openkoreRuntime, 0);
assert.equal(report.ecosystemReferenceSweepCompleted, true);
assert.equal(report.canonicalRouteEngineCount, 1);
assert.equal(report.perMapHardcodeCount, 0);
assert.deepEqual(report.reclassifiedMaps, [
  'um_dun01', 'um_dun02', 'treasure_n1', 'treasure_n2',
  'prt_fild08a', 'prt_fild08b', 'prt_fild08c', 'prt_fild08d',
]);
assert.equal(report.normalWorldTotalBeforeReconciliation, 49);
assert.equal(report.normalWorldTotalAfterReconciliation, 26);
assert.equal(report.normalReachable, 26);
assert.equal(report.normalUnreachable, 0);
assert.equal(report.normalRouteStatusKnown, 26);
assert.equal(report.normalUnexplained, 0);
assert.equal(report.farmability.known, true);
assert.equal(report.farmability.autoFarmable, 24);
assert.equal(report.farmability.lockedRequirement, 0);
assert.equal(report.farmability.nonFarmable, 2);
assert.equal(report.globalUnsupportedUnknown, 334);
assert.equal(report.globalDebtBlocksStage2, false);
assert.equal(report.remainingTrueWorldUnreachable, 0);
assert.equal(report.genericTransportTransformerNeeded, false);
assert.equal(report.readyForStage2PaAdapter, true);
assert.equal(report.closures.find((row) => row.id === 'um_dun02').sweep.SCRIPTED_TRANSFER, 'PRE_RE_ONLY_OR_DISABLED');
assert.equal(report.closures.filter((row) => row.finalClassification === 'OTHER_KNOWN').length, 8);
console.log(`test-normal-world-authority-closure: PASS (${report.normalWorldTotalAfterReconciliation} normal rows, ${report.farmability.autoFarmable} auto-farmable)`);
