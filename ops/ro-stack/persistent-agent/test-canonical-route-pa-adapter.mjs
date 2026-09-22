import assert from 'node:assert/strict';
import { buildCanonicalGraph, CANONICAL_EDGE_TYPE as T, solveCanonicalRoute } from './canonical-route-model.mjs';
import {
  adaptCanonicalRouteResult,
  compileCanonicalRouteShadow,
  canonicalRouteMappingReport,
} from './canonical-route-pa-adapter.mjs';

const graph = buildCanonicalGraph({ edges: [
  { from: 'field', to: 'town', type: T.PORTAL, metadata: { x: 10, y: 20, toX: 30, toY: 40 } },
  { from: 'town', to: 'dungeon1', type: T.DUNGEON_TRANSITION, metadata: { x: 2, y: 3, toX: 4, toY: 5 } },
  { from: 'dungeon1', to: 'dungeon2', type: T.PORTAL, metadata: { x: 6, y: 7, toX: 8, toY: 9 } },
  { from: 'town', to: 'payon', type: T.KAFRA_TRANSPORT, metadata: { npcMap: 'town', destinationCity: 'payon' } },
  { from: 'town', to: 'saved', type: T.SAVE_MAP },
  { from: 'town', to: 'item-destination', type: T.ITEM_WARP, metadata: { itemId: 602 } },
  { from: 'town', to: 'scripted', type: T.SCRIPTED_TRANSFER, metadata: { serverCommand: 'quest_transfer' } },
  { from: 'locked', to: 'target', type: T.PORTAL, requirements: { quest: 'missing' } },
] });

const context = { kafra: { npcName: 'Kafra Employee#town', saveMenuIndex: 1,
  transportMenuIndex: 2, cityMenuIndex: 3 } };
const solve = (source, target, options = {}) => solveCanonicalRoute(graph, source, target, options);

const portal = compileCanonicalRouteShadow(solve('field', 'dungeon2'), { ...context, startFarm: true });
assert.equal(portal.policy, 'CANONICAL_ROUTE');
assert.deepEqual(portal.steps.map((step) => step.kind), ['DIRECT_TO_TARGET', 'START_FARM']);
assert.deepEqual(portal.steps[0].edgeTypes, ['PORTAL', 'DUNGEON_TRANSITION', 'PORTAL']);
assert.equal(portal.commands[0].action, 'start_navigation');
assert.equal(portal.commands[0].payload.route.at(-1).map, 'dungeon2');
assert.equal(portal.missingExecutionSeams.length, 0);

const kafra = compileCanonicalRouteShadow(solve('town', 'payon'), context);
assert.equal(kafra.steps[0].kind, 'KAFRA_DIALOG_TRANSFER');
assert.deepEqual(kafra.commands.map((command) => command.action), [
  'talk_to_npc', 'dialog_next', 'dialog_select', 'dialog_next', 'dialog_select', 'dialog_close',
]);

const butterfly = compileCanonicalRouteShadow(solve('town', 'item-destination'), context);
assert.equal(butterfly.steps[0].kind, 'BUTTERFLY_WING');
assert.equal(butterfly.commands[0].action, 'use_item');
assert.equal(butterfly.commands[0].payload.itemId, 602);

const scripted = compileCanonicalRouteShadow(solve('town', 'scripted'));
assert.equal(scripted.commands[0].action, 'run_server_command');
assert.equal(scripted.commands[0].payload.command, 'quest_transfer');

const locked = adaptCanonicalRouteResult(solve('locked', 'target'));
assert.equal(locked.reason, 'requirement_locked');
assert.equal(locked.routeStatus, 'LOCKED_REQUIREMENT');

const savePoint = adaptCanonicalRouteResult(solve('town', 'saved'));
assert.equal(savePoint.steps[0].kind, 'VERIFY_SAVEPOINT');
assert.equal(savePoint.zeroGameplayAuthority, true);

const already = adaptCanonicalRouteResult({ status: 'FOUND', source: 'town', target: 'town', edges: [] }, { startFarm: true });
assert.equal(already.policy, 'ALREADY_AT_DESTINATION');
assert.deepEqual(already.steps, [{ kind: 'START_FARM', targetMap: 'town' }]);

const unavailable = adaptCanonicalRouteResult({ status: 'UNREACHABLE', failureClass: null });
assert.equal(unavailable.reason, 'route_unavailable');

const report = canonicalRouteMappingReport();
assert.equal(report.routeEngineCount, 1);
assert.equal(report.perMapHardcodeCount, 0);
assert.equal(report.mode, 'SHADOW_ONLY');
assert.ok(report.missingExecutionSeams.length >= 1);

console.log('CANONICAL_ROUTE_PA_ADAPTER: 10/10 PASS');
