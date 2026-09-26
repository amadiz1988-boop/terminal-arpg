import assert from 'node:assert/strict';
import { classifyEvidence, collectScriptEvidence }
  from '../ops/ro-stack/persistent-agent/audit-world-map-inventory.mjs';
import { chooseLandingAnchor, chooseScriptArrivalAnchor }
  from '../ops/ro-stack/persistent-agent/world-map-teleport-policy.mjs';

const maps = new Set(['bra_dun01', 'pay_dun04', 'jupe_core', 'jupe_ele',
  'gw_fild01', 'ver_eju']);
const e = collectScriptEvidence([
  { path: 'npc/re/mobs/dungeons/bra_dun.txt', text: [
    'bra_dun01\tmonster\tPiranha\t2070,80,5000',
    'bra_dun01,0,0\tmonster\tIara\t2069,30,5000',
    'bra_dun01\tscript\tNotASpawn\t-1,{',
  ].join('\n') },
  { path: 'npc/warps/dungeons/pay_dun.txt', text: [
    '\tcase 0: warp "pay_dun04",201,204; end;',
    '\tcase 1: warp "pay_dun04",0,0; end;',
    '\tmapwarp "jupe_ele","jupe_core",150,286;',
    '\twarp "jupe_core",rand(149,151),286;',
  ].join('\n') },
  { path: 'npc/re/instances/MazeofOz.txt', text: 'gw_fild01,275,337,3\tscript\tEntry\t4_M_MERCHANT,{' },
  { path: 'npc/re/mobs/fields/gw_fild.txt', text: 'gw_fild01\tmonster\tWolf\t1013,50,5000' },
  { path: 'npc/re/mobs/verus.txt', text: 'ver_eju,0,0,0,0\tmonster\tRobot\t3154,50,5000' },
  { path: 'npc/re/quests/example.txt', text: 'monster "ver_eju",0,0,"Temporary",3154,1;' },
], maps);

// Map-only and area spawn heads are both permanent spawns; other map-only
// declarations are not.
assert.deepEqual(e.get('bra_dun01').spawns.map((s) => [s.mobId, s.count, s.habitat]),
  [[2070, 80, 'NORMAL_DUNGEON'], [2069, 30, 'NORMAL_DUNGEON']]);
assert.equal(e.get('bra_dun01').references.some((r) => r.kind === 'script'), false);
assert.equal(e.get('ver_eju').spawns.length, 1);
assert.equal(e.get('ver_eju').spawns[0].declaration, 'monster');
assert.equal(e.get('ver_eju').spawns[0].habitat, null,
  'source directory is not a farmability gate');
// Literal arrivals only; 0,0 and expressions keep no coordinates.
assert.deepEqual(e.get('pay_dun04').transfers.map((t) => [t.x, t.y]),
  [[201, 204], [undefined, undefined]]);
assert.deepEqual(e.get('jupe_core').transfers.filter((t) => t.x).map((t) => [t.x, t.y]), [[150, 286]]);
assert.equal(e.get('jupe_ele').transfers.length, 0);
// A persistent map hosting an instance entrance keeps its normal category.
assert.equal(classifyEvidence(e.get('gw_fild01'), null, true).category, 'NORMAL_FIELD');
assert.equal(classifyEvidence({ ...e.get('gw_fild01'), spawns: [] }, null, true).category, 'INSTANCE');

// Physical portals take precedence; script arrivals are the fallback.
const graph = new Map([['pay_dun03', [{ map: 'pay_dun03', name: 'p', to: 'pay_dun04', toX: 20, toY: 30 }]]]);
const row = { scriptArrivals: [{ x: 34, y: 202, source: 'a:1' }, { x: 201, y: 204, source: 'b:1' }] };
assert.deepEqual(chooseLandingAnchor(graph, 'pay_dun04') ?? chooseScriptArrivalAnchor(row),
  { x: 20, y: 30, source: 'rathena-warp:pay_dun03:p' });
assert.deepEqual(chooseLandingAnchor(new Map(), 'pay_dun04') ?? chooseScriptArrivalAnchor(row),
  { x: 34, y: 202, source: 'rathena-script-warp:a:1' });
assert.equal(chooseScriptArrivalAnchor({ scriptArrivals: [] }), null);
console.log('WORLD_MAP_SCRIPT_EVIDENCE_PASS');
