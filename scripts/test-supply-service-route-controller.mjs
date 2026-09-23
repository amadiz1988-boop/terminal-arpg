import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTerminalRoute } from '../ops/ro-stack/persistent-agent/map-route.mjs';

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
assert.match(dashboard, /payloadObject\.supplyServiceRoute = supplyServiceRoute/);
assert.match(dashboard, /throw new HttpError\(409, 'SAVED_TOWN_SERVICE_UNAVAILABLE'\)/);
assert.doesNotMatch(dashboard, /payloadObject\.supplyRouteOut\s*=/);
assert.doesNotMatch(dashboard, /payloadObject\.supplyRouteBack\s*=/);

console.log('SUPPLY_SERVICE_ROUTE_CONTROLLER_PASS checks=10');
