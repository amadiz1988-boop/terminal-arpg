import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadWarpGraph, buildTerminalRoute } from '../ops/ro-stack/persistent-agent/map-route.mjs';
import { SUPPLY_TOWN_SERVICES } from '../ops/ro-stack/persistent-agent/supply-town-services.mjs';
import { worldMapTeleportDecision } from '../ops/ro-stack/persistent-agent/world-map-teleport-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ?? 'C:/Users/Administrator/source/ghost-island-rathena';
const graph = await loadWarpGraph(native);
const shopSources = [
  await readFile(join(native, 'npc/re/merchants/Dealer_Update.txt'), 'utf8'),
  await readFile(join(native, 'npc/re/merchants/shops.txt'), 'utf8'),
  await readFile(join(native, 'npc/merchants/shops.txt'), 'utf8'),
].join('\n');
const towns = Object.entries(SUPPLY_TOWN_SERVICES);
assert.equal(towns.length, 7);
for (const [town, service] of towns) {
  assert.match(shopSources, new RegExp(`^${service.map},${service.x},${service.y},[^\\n]*\\tshop\\t${service.npc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\t[^\\n]*501:-1`, 'm'), town);
  const route = buildTerminalRoute(graph, town, service.map, service.x, service.y);
  assert.ok(route?.length > 0, `${town}: city-local route missing`);
  assert.equal(route[0].map, town);
  assert.equal(route.at(-1).map, service.map);
  assert.equal(route.at(-1).x, service.x);
  assert.equal(route.at(-1).y, service.y);
}
const decision = (kind, currentIsTown, availableAt = 0) =>
  worldMapTeleportDecision({ kind, currentMap: currentIsTown ? 'prontera' : 'pay_fild04',
    currentIsTown, targetMap: kind === 'town' ? 'geffen' : 'mjolnir_07',
    baseLevel: 67, minLevel: 55, zeny: 550, availableAt, nowSeconds: 1000 });
assert.equal(decision('town', false, 9999).allowed, true);
assert.equal(decision('town', false, 9999).cooldownSeconds, 0);
assert.equal(decision('town', true).cooldownSeconds, 30);
assert.equal(decision('farm', true).cooldownSeconds, 60);
assert.equal(decision('farm', false).cost, 550);
assert.equal(decision('farm', false, 1001).reason, 'WORLD_MAP_TELEPORT_COOLDOWN');
const nativeSource = await readFile(join(native, 'src/map/persistent_agent.cpp'), 'utf8');
assert.match(nativeSource, /void process_set_saved_town\(/);
assert.match(nativeSource, /target_map != mapindex_id2name\(sd->mapindex\)/);
assert.match(nativeSource, /pc_setsavepoint\(sd, sd->mapindex, sd->x, sd->y\)/);
assert.match(nativeSource, /SUPPLY_RETURN_FUNDS_BLOCKED/);
assert.match(nativeSource, /supply_shop_purchase_cost\(sd, nd, supply_item_id, quantity\)/);
assert.match(nativeSource, /SUPPLY_RETURN_TELEPORT_CONFIRMED/);
assert.match(nativeSource, /process_supply_return_pending\(runtime\)/);
assert.match(nativeSource, /if \(!persistent_agent_state_confirm_command\(command.command_id, record.revision\)\) \{\s*if \(cost > 0\)\s*pc_getzeny\(sd, cost, LOG_TYPE_OTHER\)/);
assert.ok(nativeSource.indexOf('requested_supply_npc_name = candidate') <
  nativeSource.indexOf('runtime.farm_active = true'), 'supply NPC validated before farm activation');
const useItemSource = nativeSource.slice(nativeSource.indexOf('void process_use_item('),
  nativeSource.indexOf('void process_world_map_teleport('));
assert.doesNotMatch(useItemSource, /reject_command_reason\(command, "SAVED_TOWN_REQUIRED"/);
assert.match(useItemSource, /persistent_agent_use_item\(\*runtime, request\.item_id, index\)/);
assert.match(nativeSource, /runtime\.supply_home_required = !supported_home|runtime\.supply_home_required = save_map == nullptr/);
assert.match(nativeSource, /runtime\.supply_home_required \? "SUPPLY_HOME_REQUIRED"/);
assert.match(nativeSource, /if \(runtime\.supply_home_required\)\s*return "SUPPLY_HOME_REQUIRED"/);
const html = await readFile(join(root, 'ops/ro-stack/dashboard/index.html'), 'utf8');
const app = await readFile(join(root, 'ops/ro-stack/dashboard/app.js'), 'utf8');
const dashboard = await readFile(join(root, 'ops/ro-stack/dashboard.mjs'), 'utf8');
for (const id of ['worldMapTownLabels', 'worldMapSavedTown', 'worldMapSavedTownHint', 'worldMapConfirm',
  'worldMapConfirmCancel', 'worldMapConfirmSubmit', 'worldMapArrivalToast'])
  assert.ok(html.includes(`id="${id}"`), id);
assert.match(app, /button\.onclick = \(event\) => \{[\s\S]*?selectTownWorldMap\(town\.map\)/);
assert.match(app, /await waitForWorldMapAuthority\(\(state\) =>\s*state\.player\?\.currentMap === mapId\)/);
assert.match(app, /playCombatSound\('warp'/);
assert.match(app, /detail\.replaceChildren\(\s*title,\s*controls,\s*teleportInfo/);
assert.match(dashboard, /'SAVED_TOWN_REQUIRES_PRESENCE'/);
assert.match(dashboard, /savedTownSetupRequired: !savedTown/);
assert.match(app, /worldMapSavedTownHint'\)\.classList\.toggle\('hidden',[\s\S]*?savedTownSetupRequired !== true/);
const worldQueue = dashboard.slice(dashboard.indexOf('async function queuePlayerWorldMapTeleport('),
  dashboard.indexOf('async function queueServerAgentRelocation('));
assert.doesNotMatch(worldQueue, /SAVED_TOWN_REQUIRED/);
assert.match(dashboard, /if \(service && !supplyServiceRoute\)[\s\S]*?if \(supplyServiceRoute\) \{/);
assert.match(dashboard, /if \(currentMap === mapId\) \{[\s\S]*?mode === 'AUTO_FARM'[\s\S]*?action: 'start_farm'[\s\S]*?stage: 'WAIT_FARM'/);
assert.match(dashboard, /sameMapIdleFarmStart[\s\S]*?live\?\.agentMode === 'PERSISTENT_IDLE'/);
assert.match(app, /if \(result.reason === 'WORLD_MAP_FARM_START_QUEUED'\) \{[\s\S]*?\} else \{\s*playCombatSound\('warp'/);
console.log(`WORLD_MAP_SUPPLY_CUTOVER_SOURCE_PASS towns=${towns.length} routes=${towns.length} tests=68`);
