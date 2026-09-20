import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTerminalRoute } from '../ops/ro-stack/persistent-agent/map-route.mjs';

const dashboard = await readFile(
  new URL('../ops/ro-stack/dashboard.mjs', import.meta.url),
  'utf8',
);

const graph = new Map([
  ['save_map', [{ map: 'save_map', x: 10, y: 20, name: 'to_hub', to: 'service_hub', toX: 30, toY: 40, xs: 1, ys: 1 }]],
  ['service_hub', [{ map: 'service_hub', x: 30, y: 40, name: 'to_service', to: 'prt_fild05', toX: 100, toY: 200, xs: 1, ys: 1 }]],
]);

const route = buildTerminalRoute(graph, 'save_map', 'prt_fild05', 289, 219);
assert.ok(Array.isArray(route));
assert.equal(route[0].map, 'save_map');
assert.equal(route.at(-1).map, 'prt_fild05');
assert.deepEqual(route.at(-1), { map: 'prt_fild05', x: 289, y: 219 });

const sameMapRoute = buildTerminalRoute(new Map(), 'prt_fild05', 'prt_fild05', 289, 219);
assert.deepEqual(sameMapRoute, [{ map: 'prt_fild05', x: 289, y: 219 }]);

assert.equal(buildTerminalRoute(graph, 'missing_save_map', 'prt_fild05', 289, 219), null);
assert.equal(buildTerminalRoute(graph, 'save_map', 'prt_fild05', -1, 219), null);

assert.match(dashboard, /readCharacterSavePoint\(account\.accountId\)/);
assert.match(dashboard, /buildTerminalRoute\(/);
assert.match(dashboard, /payloadObject\.supplyServiceRoute = supplyServiceRoute/);
assert.match(dashboard, /payloadObject\.supplyRouteOut = supplyRouteOut/);
assert.match(dashboard, /payloadObject\.supplyRouteBack = inbound\.route/);
assert.match(dashboard, /throw new HttpError\(409, 'supply_route_unavailable'\)/);

console.log('SUPPLY_SERVICE_ROUTE_CONTROLLER_PASS checks=13');
