import assert from 'node:assert/strict';
import { CANONICAL_EDGE_TYPE } from './canonical-route-model.mjs';
import { normalizeTransportType, parseStaticTransportScripts, parseScriptTransportEdges, parseOpenKoreTransportTables } from './canonical-transport-enrichment.mjs';

assert.equal(normalizeTransportType('KAFRA_TRANSPORT'), CANONICAL_EDGE_TYPE.NPC_TRANSPORT);
assert.equal(normalizeTransportType('BUTTERFLY_WING'), CANONICAL_EDGE_TYPE.ITEM_WARP);
assert.equal(normalizeTransportType('DUNGEON_TRANSITION'), CANONICAL_EDGE_TYPE.DUNGEON_TRANSITION);
const staticEdges = parseStaticTransportScripts('payon,1,2,0\twarp2\tdun\t2,2,pay_dun00,20,30', 'npc/re/warps/test.txt');
assert.deepEqual(staticEdges[0], { from: 'payon', to: 'pay_dun00', type: 'PORTAL', cost: 20, requirements: {}, oneWay: true, source: 'npc/re/warps/test.txt:1', authority: 'rAthena', metadata: { x: 1, y: 2, toX: 20, toY: 30, syntax: 'warp2' } });
const scriptEdges = parseScriptTransportEdges('payon,10,10,0\tscript\tKafra\t1,{\n\twarp "pay_dun00",20,30;\n}', 'npc/kafras/kafras.txt');
assert.equal(scriptEdges[0].type, CANONICAL_EDGE_TYPE.NPC_TRANSPORT);
assert.equal(scriptEdges[0].from, 'payon');
const ok = parseOpenKoreTransportTables('payon 10 10 pay_dun00 20 30\npayon 1 2 prontera 3 4 kafra', 'tables/portals.txt');
assert.equal(ok.length, 2);
assert.equal(ok[0].authority, 'ADVISORY_ONLY');
console.log('test-canonical-transport-enrichment: 8/8 PASS');
