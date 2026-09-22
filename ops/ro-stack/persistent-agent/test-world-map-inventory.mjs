import assert from 'node:assert/strict';
import { auditWorldInventory, graphAccounting, parseMapCache, parseMapIndex } from './audit-world-map-inventory.mjs';

assert.deepEqual(parseMapIndex('alpha 1\nbeta\n// ignored\ngamma'), [
  { id: 'alpha', index: 1, line: 1 }, { id: 'beta', index: 2, line: 2 }, { id: 'gamma', index: 3, line: 4 },
]);
const cache = Buffer.alloc(8 + 20 + 3); cache.writeUInt16LE(1, 4); cache.write('alpha', 8, 'ascii'); cache.writeInt32LE(3, 24); assert.deepEqual([...parseMapCache(cache)], ['alpha']);
const accounting = graphAccounting(new Map([['a', [{ to: 'b' }]], ['b', []]])); assert.equal(accounting.nodes.size, 2); assert.deepEqual(accounting.destinationOnly, []);

const report = await auditWorldInventory({
  runtimeRoot: 'C:/Users/Administrator/ghost-island-production/ro-stack/.local/ro-stack/rathena',
  mapInfoPath: 'public/ro/data/map-info.json',
  openkoreRoot: '.local/ro-stack/openkore',
});
assert.equal(report.summary.mapIndexTotal, 1295);
assert.equal(report.summary.mapInfoTotal, 69);
assert.equal(report.summary.currentGraphNodes, 566);
assert.equal(report.summary.graphEdges, 1836);
assert.equal(report.summary.totalWorldMapsAccounted, 1295);
assert.equal(report.summary.normalWorldClassified, '100%');
assert.equal(report.summary.normalUnknown, 0);
assert.equal(report.summary.readyForStage2Adapter, false);
console.log('WORLD_MAP_INVENTORY_RECONCILIATION: PASS');
