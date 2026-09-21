import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(
  new URL('../ops/ro-stack/dashboard.mjs', import.meta.url),
  'utf8',
);

assert.match(dashboard, /skipSupplyRouteResolution = currentMap === targetMap/);
assert.match(dashboard, /\}, null, \{ skipSupplyRouteResolution \}\);/);
assert.match(
  dashboard,
  /options\.skipSupplyRouteResolution !== true[\s\S]*action === 'start_farm'/,
);
assert.match(
  dashboard,
  /if \(currentMap !== targetMap\)\s+return await queueServerAgentRelocation/,
);
assert.match(dashboard, /throw new HttpError\(409, 'supply_route_unavailable'\)/);

console.log('AUTO_FARM_SAME_MAP_START_PASS checks=5');
