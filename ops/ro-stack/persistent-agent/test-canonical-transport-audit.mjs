import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditCanonicalTransportEnrichment } from './audit-canonical-transport-enrichment.mjs';

const report = await auditCanonicalTransportEnrichment({
  inventoryPath: 'docs/openkore-reference/world-map-inventory.json',
  openkoreRoot: '.local/ro-stack/openkore',
});
assert.equal(report.stage1InventoryReused, true);
assert.equal(report.mapIndexRescanned, false);
assert.equal(report.normalWorldTotal, 49);
assert.equal(report.normalWorldClassified, '100%');
assert.equal(report.normalUnknown, 0);
assert.equal(report.otherUnexplained, 0);
assert.equal(report.canonicalRouteEngineCount, 1);
assert.equal(report.perMapHardcodeCount, 0);
assert.ok(report.capabilityCounts.STATIC_PORTAL_DATA_GAP > 0);
assert.ok(report.rows.some((row) => row.advisoryEvidence > 0));
assert.ok(report.capabilityCounts.MISSING_REQUIREMENT_METADATA > 0);
assert.equal(report.productionTouched, false);
console.log(`test-canonical-transport-audit: PASS (${report.normalWorldTotal} rows, ${report.normalUnreachable} unresolved topology rows)`);
