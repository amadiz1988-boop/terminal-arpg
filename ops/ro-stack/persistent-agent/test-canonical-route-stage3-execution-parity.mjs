import assert from 'node:assert/strict';
import { buildCanonicalGraph, CANONICAL_EDGE_TYPE as T, solveCanonicalRoute } from './canonical-route-model.mjs';
import { compileCanonicalRouteShadow } from './canonical-route-pa-adapter.mjs';
import {
  buildExecutionContractMatrix,
  butterflyJourneyResult,
  executionFailureReplan,
  flyWingBoundary,
} from './canonical-route-stage3-execution-parity.mjs';

const graph = buildCanonicalGraph({ edges: [
  { from: 'field', to: 'town', type: T.PORTAL, metadata: { x: 1, y: 2, toX: 3, toY: 4 } },
  { from: 'town', to: 'dungeon1', type: T.DUNGEON_TRANSITION, metadata: { x: 5, y: 6, toX: 7, toY: 8 } },
  { from: 'dungeon1', to: 'dungeon2', type: T.PORTAL, metadata: { x: 9, y: 10, toX: 11, toY: 12 } },
  { from: 'town', to: 'payon', type: T.KAFRA_TRANSPORT, metadata: { npcMap: 'town', destinationCity: 'payon' } },
  { from: 'town', to: 'save', type: T.ITEM_WARP, requirements: { item: 'butterfly', itemCount: 1 }, metadata: { itemId: 602 } },
  { from: 'town', to: 'fly', type: T.ITEM_WARP, metadata: { itemId: 601 } },
  { from: 'locked', to: 'target', type: T.PORTAL, requirements: { quest: 'missing' } },
] });
const context = { kafra: { npcName: 'Kafra Employee#town', saveMenuIndex: 1,
  transportMenuIndex: 2, cityMenuIndex: 3 } };
const solve = (source, target, options = {}) => solveCanonicalRoute(graph, source, target, options);

const portal = compileCanonicalRouteShadow(solve('field', 'town'), context);
assert.equal(portal.commands[0].action, 'start_navigation');
assert.equal(buildExecutionContractMatrix(portal)[0].arrivalSignal, 'authoritative currentMap=town');

const multi = compileCanonicalRouteShadow(solve('field', 'dungeon2'), context);
assert.deepEqual(multi.steps[0].edgeTypes, ['PORTAL', 'DUNGEON_TRANSITION', 'PORTAL']);
assert.equal(multi.commands[0].payload.route.at(-1).map, 'dungeon2');
assert.equal(buildExecutionContractMatrix(multi)[0].completionSignal, 'advance after arrival confirmation');

const kafra = compileCanonicalRouteShadow(solve('town', 'payon'), context);
assert.deepEqual(buildExecutionContractMatrix(kafra)[0].paCommand, [
  'talk_to_npc', 'dialog_next', 'dialog_select', 'dialog_next', 'dialog_select', 'dialog_close',
]);
assert.match(buildExecutionContractMatrix(kafra)[0].expectedAck, /cursor sequence complete/);

const butterfly = compileCanonicalRouteShadow(solve('town', 'save', { items: { butterfly: 1 } }), context);
const butterflyContract = buildExecutionContractMatrix(butterfly)[0];
assert.equal(butterflyContract.paCommand, 'use_item');
assert.match(butterflyContract.arrivalSignal, /savePoint/);
assert.deepEqual(butterflyJourneyResult({ itemPresent: true, expectedMap: 'save', observedSavePoint: 'save',
  quantityBefore: 1, quantityAfter: 1 }), {
  status: 'SUCCESS', reason: null, quantityUnchanged: true, presenceBased: true,
  nonConsumable: true, replan: false,
});
assert.equal(butterflyJourneyResult({ itemPresent: false, expectedMap: 'save' }).reason, 'item_required');

const fly = compileCanonicalRouteShadow(solve('town', 'fly'), context);
assert.equal(fly.missingExecutionSeams[0].missing, 'fly_wing_is_local_hunting_only');
assert.equal(flyWingBoundary(fly).valid, true);

const already = compileCanonicalRouteShadow({ status: 'FOUND', source: 'town', target: 'town', edges: [] }, { startFarm: true });
assert.equal(already.steps[0].kind, 'START_FARM');
assert.equal(buildExecutionContractMatrix(already)[0].completionSignal, 'journey complete after AUTO_FARM confirmation');

const failure = executionFailureReplan({ failure: 'arrival_timeout', currentMap: 'field', targetMap: 'town' });
assert.equal(failure.status, 'REPLAN_REQUIRED');
assert.equal(failure.routeSolverInvoked, false);
assert.deepEqual(failure.canonicalPlannerRequest, { source: 'field', target: 'town' });
assert.equal(executionFailureReplan({ failure: 'portal_unavailable', currentMap: 'field', targetMap: 'town' }).reason, 'PORTAL_UNAVAILABLE');
assert.equal(executionFailureReplan({ failure: 'npc_command_rejection', currentMap: 'town', targetMap: 'payon' }).reason, 'NPC_COMMAND_REJECTION');
assert.equal(executionFailureReplan({ failure: 'unknown', currentMap: 'field', targetMap: 'town' }).replan, false);

const locked = compileCanonicalRouteShadow(solve('locked', 'target'));
assert.equal(locked.reason, 'requirement_locked');
assert.equal(locked.commands.length, 0);

console.log('CANONICAL_ROUTE_STAGE3_EXECUTION_PARITY: 10/10 PASS');
