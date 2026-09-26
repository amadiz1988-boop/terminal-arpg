import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { worldMapTeleportDecision } from '../ops/ro-stack/persistent-agent/world-map-teleport-policy.mjs';

const source = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function queuePlayerWorldMapTeleport(');
const end = source.indexOf('async function queueServerAgentRelocationPrepared(', start);
assert.ok(start >= 0 && end > start, 'current World Map action is present');

function scenario(agentMode) {
  const calls = [];
  const pendingRelocations = new Map();
  const context = {
    pendingRelocations,
    relocationRequests: new Set(),
    playerWorldMapProjection: { farmRows: new Map([['pay_fild04', {
      kind: 'farm', farmSelectionAvailable: true, name: 'Payon Field',
    }]]), townRows: new Map() },
    HttpError: class HttpError extends Error {},
    readGrindTarget: async () => ({ mapId: 'pay_fild04' }),
    FARM_MAP_SOURCE: { PLAYER_OVERRIDE: 'PLAYER_OVERRIDE' },
    mapRoutingIndex: { maps: { pay_fild04: { levelRange: [1, 10] } } },
    writePersistedRelocation: async () => { calls.push('persist_intent'); },
    writeJsonAtomic: async () => { calls.push('write_target'); },
    join: (...parts) => parts.join('/'),
    instancesRoot: '/fixture',
    instanceId: (id) => String(id),
    observationConfigCache: new Map(),
    queueOwnershipCommand: async (_account, _charId, command) => {
      calls.push(command.action);
      return { commandId: 'same-map-command' };
    },
    coordinatorDeadlineMsForRouteSteps: () => 1000,
    clearPersistedRelocation: async () => { calls.push('clear_intent'); },
    readFarmMapSupplyPreflight: async () => { throw new Error('cross-map supply invoked'); },
    queueServerAgentRelocation: async () => { throw new Error('cross-map route invoked'); },
    sql: async () => { throw new Error('unexpected fee or cooldown write'); },
  };
  const action = runInNewContext(source.slice(start, end) + '\nqueuePlayerWorldMapTeleport', context);
  return {
    calls, pendingRelocations,
    run: () => action(
      { accountId: 1, characterId: 2 },
      { liveStatus: { fresh: true, map: 'pay_fild04' }, agentMode, revision: 7 },
      'pay_fild04', 'farm',
    ),
  };
}

const active = scenario('AUTO_FARM');
const unchanged = await active.run();
assert.equal(unchanged.reason, 'ALREADY_ON_TARGET_MAP');
assert.deepEqual(active.calls, [], 'running farm has no restart, teleport or supply call');
assert.equal(active.pendingRelocations.size, 0);

const idle = scenario('PERSISTENT_IDLE');
const started = await idle.run();
assert.equal(started.reason, 'WORLD_MAP_FARM_START_QUEUED');
assert.equal(started.cost, 0);
assert.equal(started.cooldownSeconds, 0);
assert.deepEqual(idle.calls, ['persist_intent', 'write_target', 'start_farm']);
assert.equal(idle.pendingRelocations.get(2)?.stage, 'WAIT_FARM');

const sameMapPolicy = worldMapTeleportDecision({
  kind: 'farm', currentMap: 'pay_fild04', targetMap: 'pay_fild04',
  baseLevel: 67, minLevel: 10, zeny: 0, availableAt: 9999, nowSeconds: 1000,
});
assert.equal(sameMapPolicy.reason, 'ALREADY_ON_TARGET_MAP');
assert.equal(sameMapPolicy.cost, 0);
assert.equal(sameMapPolicy.cooldownRemaining, 0);
console.log('AUTO_FARM_SAME_MAP_START_PASS cases=3 teleport=0 fee=0 cooldown=0 restart=0');
