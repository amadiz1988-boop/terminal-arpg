import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadWarpGraph, buildTerminalRoute } from '../ops/ro-stack/persistent-agent/map-route.mjs';
import { SUPPLY_TOWN_SERVICES, SUPPLY_TOWN_STORAGE } from '../ops/ro-stack/persistent-agent/supply-town-services.mjs';
import { farmMapSupplyPreflight, farmSwitchReachedTarget,
  mayRetryFarmSwitch, paidFarmSwitchResumeDecision } from '../ops/ro-stack/persistent-agent/farm-map-supply-preflight.mjs';
import { nativeSupplyPolicy } from '../ops/ro-stack/persistent-agent/native-supply-policy.mjs';
import { defaultCanonicalConfig } from '../ops/ro-stack/dashboard/config-schema.mjs';

const nativeRoot = process.env.RO_RATHENA_ROOT ?? 'C:/Users/Administrator/source/ghost-island-rathena';
const graph = await loadWarpGraph(nativeRoot);
const context = { accountId: 10, charId: 20, revision: 30,
  currentMap: 'pay_fild04', maxAgeMs: 15000 };
const inventory = { accountId: 10, charId: 20, revision: 30, resident: true,
  map: 'pay_fild04', ageMs: 100, inventorySlots: 50,
  inventoryMaxSlots: 100, weight: 2500, maxWeight: 5000,
  supplyRequired: false, supplyReason: null };
assert.equal(farmMapSupplyPreflight(inventory, context).reason, 'READY');
for (const reason of ['INVENTORY_WEIGHT', 'INVENTORY_SLOTS', 'SUPPLY_ITEM_LOW']) {
  const result = farmMapSupplyPreflight({ ...inventory, supplyRequired: true,
    supplyReason: reason }, context);
  assert.equal(result.reason, 'SUPPLY_REQUIRED');
  assert.equal(result.supplyReason, reason);
}
assert.equal(farmMapSupplyPreflight({ ...inventory, ageMs: 16000 }, context).reason,
  'SUPPLY_PREFLIGHT_UNAVAILABLE');
const policy = nativeSupplyPolicy(defaultCanonicalConfig());
assert.equal(policy.itemRules.find((row) => row.itemId === 0).storage, true);
assert.equal(policy.itemRules.find((row) => row.itemId === 501).storage, false);
assert.equal(policy.itemRules.find((row) => row.itemId === 601).sell, false);
assert.equal(policy.itemRules.find((row) => row.itemId === 602).sell, false);
for (const [town, storage] of Object.entries(SUPPLY_TOWN_STORAGE)) {
  const shop = SUPPLY_TOWN_SERVICES[town];
  assert.ok(buildTerminalRoute(graph, town, storage.map, storage.x, storage.y),
    `${town}: storage route`);
  assert.ok(buildTerminalRoute(graph, town, shop.map, shop.x, shop.y),
    `${town}: shop route`);
}
assert.equal(farmSwitchReachedTarget({ currentMap: 'pay_fild04',
  targetMap: 'pay_fild04', mode: 'PERSISTENT_IDLE' }), false);
assert.equal(farmSwitchReachedTarget({ currentMap: 'pay_fild04',
  targetMap: 'mjolnir_07', mode: 'AUTO_FARM' }), false);
assert.equal(farmSwitchReachedTarget({ currentMap: 'mjolnir_07',
  targetMap: 'mjolnir_07', mode: 'AUTO_FARM' }), true);
const blocked = { attemptRevision: 30, attempts: 2, retryAfter: 2000 };
assert.equal(mayRetryFarmSwitch(blocked, 30, 1000), false);
assert.equal(mayRetryFarmSwitch(blocked, 30, 2000), true);
assert.equal(mayRetryFarmSwitch({ ...blocked, attempts: 3 }, 30, 3000), false);
assert.equal(mayRetryFarmSwitch({ ...blocked, attempts: 3 }, 31, 1000), false);
assert.equal(mayRetryFarmSwitch({ ...blocked, attempts: 3 }, 31, 3000), false);
const paidIntent = { kind: 'world-map-farm', targetMap: 'mjolnir_07',
  paidResumeAttempted: false };
const paidReceipt = { stage: 'BLOCKED', stageBeforeBlock: 'ARRIVED_PAID',
  reason: 'SUPPLY_RESTART_RETRY_REQUIRED', targetMap: 'mjolnir_07',
  commandId: 'original-command' };
const originalCommand = { commandId: 'original-command', status: 'REJECTED',
  reasonCode: 'SUPPLY_RESTART_RETRY_REQUIRED' };
const paidLive = { fresh: true, resident: true, map: 'mjolnir_07', revision: 31 };
const paidDecision = (overrides={}) => paidFarmSwitchResumeDecision({
  intent: paidIntent, pending: paidReceipt, command: originalCommand,
  live: paidLive, revision: 31, ...overrides });
assert.equal(paidDecision().allowed, true);
assert.equal(paidDecision({ intent: { ...paidIntent, paidResumeAttempted: true } }).allowed, false);
assert.equal(paidDecision({ pending: { ...paidReceipt, stageBeforeBlock: 'SHOP' } }).allowed, false);
assert.equal(paidDecision({ command: { ...originalCommand, status: 'ACCEPTED' } }).allowed, false);
assert.equal(paidDecision({ live: { ...paidLive, fresh: false } }).allowed, false);
assert.equal(paidDecision({ live: { ...paidLive, map: 'pay_fild04' } }).allowed, false);
assert.equal(paidDecision({ live: { ...paidLive, revision: 30 } }).allowed, false);
const dashboard = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const switchSource = dashboard.slice(dashboard.indexOf('async function queuePlayerWorldMapTeleport('),
  dashboard.indexOf('async function queueServerAgentRelocation('));
assert.ok(switchSource.indexOf("action: 'prepare_farm_switch'") <
  switchSource.indexOf("action: 'stop_farm'"));
assert.match(switchSource, /parentFarmMap: controller\.targetMap/);
assert.match(switchSource, /stage: 'WAIT_PREPARED_FARM'/);
assert.match(switchSource, /nativeSupplyPolicyCommandEnabled && kind === 'farm'\s*\? \{ nextFarmMap: mapId \} : null/);
assert.match(switchSource, /const farmRules = mode === 'PERSISTENT_IDLE'[\s\S]*?buildCanonicalFarmRules\(account[\s\S]*?\{ farmRules \}/);
assert.match(switchSource, /kind === 'farm' && currentMap === mapId[\s\S]*?cost: 0, cooldownSeconds: 0/);
assert.ok(switchSource.indexOf("kind === 'farm' && currentMap === mapId") <
  switchSource.indexOf('readFarmMapSupplyPreflight(account, controller)'));
assert.match(switchSource, /if \(nativeSupplyPolicyCommandEnabled && kind === 'farm'\) \{\s*const preflight/);
assert.match(switchSource, /nativeSupplyPolicyCommandEnabled && kind === 'farm'\s*\? \{ nextFarmMap: mapId \} : null/);
assert.match(dashboard, /if \(farmRules\.supplyPolicy\.enabled\) \{[\s\S]*?Object\.assign\(farmRules, services\)/);
assert.match(dashboard, /if \(!nativeSupplyPolicyCommandEnabled \|\| !farmRules\.supplyPolicy\.enabled\) \{[\s\S]*?farmRules\.supplyServiceRoute = route/);
assert.ok(dashboard.includes("pending.stage === 'WAIT_PREPARED_FARM'"));
assert.ok(dashboard.includes("'SUPPLY_SERVICE_UNAVAILABLE'"));
assert.ok(dashboard.includes('attempts: Math.min(3'));
assert.ok(dashboard.includes("action: 'resume_paid_farm_switch'"));
assert.ok(dashboard.includes("stage: 'WAIT_PAID_FARM_RESUME'"));
assert.ok(dashboard.includes('paidResumeAttempted: true'));
console.log('FARM_MAP_SUPPLY_SYNTHETIC_PASS cases=44 authority=simulated');
