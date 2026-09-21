import assert from 'node:assert/strict';
import { loadWarpGraph, planWebRelocation } from './map-route.mjs';

const runtimeRoot = process.env.RATHENA_RUNTIME_ROOT;
assert.ok(runtimeRoot, 'RATHENA_RUNTIME_ROOT is required');

const graph = await loadWarpGraph(runtimeRoot);
const plan = planWebRelocation(graph, 'prt_fild09', 'pay_dun00');
assert.equal(plan.policy, 'DIRECT');
assert.equal(plan.hops, 6);
assert.ok(Array.isArray(plan.route));

const terminal = plan.route.at(-1);
assert.deepEqual(terminal, { map: 'pay_dun00', x: 73, y: 78 });
assert.equal(terminal.map, 'pay_dun00');

const exitWarp = (graph.get('pay_dun00') ?? []).find((warp) => warp.to === 'pay_arche');
assert.deepEqual(
  { map: exitWarp.map, x: exitWarp.x, y: exitWarp.y, xs: exitWarp.xs, ys: exitWarp.ys },
  { map: 'pay_dun00', x: 21, y: 186, xs: 2, ys: 2 },
);
assert.ok(Math.abs(terminal.x - exitWarp.x) > exitWarp.xs ||
  Math.abs(terminal.y - exitWarp.y) > exitWarp.ys);

const expectedMaps = [
  'prt_fild09', 'moc_fild01', 'moc_fild02', 'pay_gld', 'payon', 'pay_arche', 'pay_dun00',
];
assert.deepEqual(plan.route.map((step) => step.map), expectedMaps);
assert.equal(plan.route.at(-2).portalTo, 'pay_dun00');

console.log(JSON.stringify({
  result: 'PAY_DUN00_ROUTE_IDENTITY_PASS',
  requestedDestination: 'pay_dun00',
  authoritativeArrivalMap: terminal.map,
  terminal,
  exitWarp: { map: exitWarp.map, x: exitWarp.x, y: exitWarp.y, xs: exitWarp.xs, ys: exitWarp.ys },
  immediateMapExitFromTerminal: false,
}));
