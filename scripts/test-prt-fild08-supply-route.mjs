import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(repoRoot, 'ops', 'ro-stack', 'stack.config.psd1');
const config = await readFile(configPath, 'utf8');

function readRoute(name) {
  const match = config.match(new RegExp(`${name} = '([^']+)'`));
  assert.ok(match, `${name} must be present in the canonical source config`);
  return JSON.parse(match[1]);
}

const supplyOut = readRoute('PersistentAgentRouteSupplyOut');
const supplyBack = readRoute('PersistentAgentRouteSupplyBack');

assert.deepEqual(supplyOut.prt_fild08, [
  { map: 'prt_fild08', x: 16, y: 187, portalTo: 'prt_fild07' },
  { map: 'prt_fild07', x: 132, y: 381, portalTo: 'prt_fild05' },
  { map: 'prt_fild05', x: 289, y: 219 },
]);

assert.deepEqual(supplyBack.prt_fild08, [
  { map: 'prt_fild05', x: 134, y: 14, portalTo: 'prt_fild07' },
  { map: 'prt_fild07', x: 383, y: 239, portalTo: 'prt_fild08' },
  { map: 'prt_fild08', x: 20, y: 239 },
]);

assert.deepEqual(
  supplyBack.mjolnir_06.find((step) => step.map === 'mjolnir_08'),
  { map: 'mjolnir_08', x: 29, y: 346, portalTo: 'mjolnir_07' },
);

assert.deepEqual(supplyOut.prt_fild08.at(-1), { map: 'prt_fild05', x: 289, y: 219 });
console.log('PRT_FILD08_SUPPLY_ROUTE_PASS checks=4');
