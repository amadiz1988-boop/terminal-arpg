import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTerminalRoute } from '../ops/ro-stack/persistent-agent/map-route.mjs';
import { SUPPLY_TOWN_SERVICES, SUPPLY_TOWN_STORAGE } from '../ops/ro-stack/persistent-agent/supply-town-services.mjs';

const dashboard = await readFile(
  new URL('../ops/ro-stack/dashboard.mjs', import.meta.url),
  'utf8',
);

// Supply Navigation remains a city-local service leg. Farm return uses the
// separate authoritative World Map teleport command.
const graph = new Map();
const route = buildTerminalRoute(graph, 'prontera', 'prontera', 146, 89);
assert.ok(Array.isArray(route));
assert.deepEqual(route, [{ map: 'prontera', x: 146, y: 89 }]);

assert.equal(buildTerminalRoute(graph, 'unsupported_town', 'prontera', 146, 89), null);
assert.equal(buildTerminalRoute(graph, 'prontera', 'prontera', -1, 89), null);

assert.match(dashboard, /readCharacterSavePoint\(account\.accountId\)/);
assert.match(dashboard, /buildTerminalRoute\(/);
assert.match(dashboard, /Object\.assign\(farmRules, services\)/);
assert.match(dashboard, /return \{ storageNpcName: storage\.npc, shopNpcName: shop\.npc,[\s\S]*?storageMenuIndex: storage\.storageMenuIndex,[\s\S]*?storageServiceRoute, shopServiceRoute \}/);
assert.match(dashboard, /farmRules\.supplyServiceRoute = services\.shopServiceRoute/);
assert.match(dashboard, /throw new HttpError\(409, 'SUPPLY_SERVICE_UNAVAILABLE'\)/);
assert.doesNotMatch(dashboard, /payloadObject\.supplyRouteOut\s*=/);
assert.doesNotMatch(dashboard, /payloadObject\.supplyRouteBack\s*=/);
assert.deepEqual(Object.keys(SUPPLY_TOWN_STORAGE).sort(), Object.keys(SUPPLY_TOWN_SERVICES).sort());
for (const [town, service] of Object.entries(SUPPLY_TOWN_STORAGE)) {
  assert.equal(service.map, town);
  assert.deepEqual(buildTerminalRoute(graph, town, service.map, service.x, service.y),
    [{ map: town, x: service.x, y: service.y }]);
  assert.equal(service.storageMenuIndex, 2);
}
assert.match(dashboard, /storageServiceRoute, shopServiceRoute/);

console.log('SUPPLY_SERVICE_ROUTE_CONTROLLER_PASS checks=33');
