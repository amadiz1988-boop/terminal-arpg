import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function queuePlayerWorldMapTeleport(');
const end = source.indexOf('async function queueServerAgentRelocation(', start);
assert.ok(start >= 0 && end > start);

function fixture(supplyAllowed) {
  const commands = [];
  const pendingRelocations = new Map();
  const context = {
    pendingRelocations,
    relocationRequests: new Set(),
    playerWorldMapProjection: { farmRows: new Map([['tur_dun05', {
      map: 'tur_dun05', kind: 'farm', farmSelectionAvailable: true,
      name: 'Turtle Dungeon', minLevel: 90, landing: null,
    }]]), townRows: new Map() },
    HttpError: class HttpError extends Error { constructor(status, message) {
      super(message); this.status = status;
    } },
    FARM_MAP_SOURCE: { PLAYER_OVERRIDE: 'PLAYER_OVERRIDE' },
    mapRoutingIndex: { maps: { tur_dun05: { levelRange: { min: 90, max: 94 } } } },
    nativeSupplyPolicyCommandEnabled: true,
    readFarmMapSupplyPreflight: async () => ({ allowed: supplyAllowed,
      reason: supplyAllowed ? null : 'SUPPLY_REQUIRED' }),
    playerWorldMapAvailability: async () => ({ maps: [{ map: 'tur_dun05',
      buttonState: 'AVAILABLE', cost: 0, cooldownSeconds: 60 }] }),
    loadNativeSupplyPolicy: async () => ({ enabled: true }),
    writePersistedRelocation: async () => {},
    clearPersistedRelocation: async () => {},
    queueOwnershipCommand: async (_account, _char, command, payload) => {
      commands.push({ command, payload });
      return { commandId: 'map-only-command' };
    },
  };
  const action = runInNewContext(source.slice(start, end) + '\nqueuePlayerWorldMapTeleport', context);
  return { commands, pendingRelocations, run: () => action(
    { accountId: 1, characterId: 2 },
    { liveStatus: { fresh: true, map: 'prontera' },
      agentMode: 'PERSISTENT_IDLE', revision: 7 }, 'tur_dun05', 'farm'),
  };
}

const ready = fixture(true);
const queued = await ready.run();
assert.equal(queued.reason, 'WORLD_MAP_TELEPORT_QUEUED');
assert.equal(ready.commands.length, 1);
assert.equal(ready.commands[0].command.action, 'world_map_teleport');
assert.equal(ready.commands[0].payload.targetMap, 'tur_dun05');
assert.equal(ready.commands[0].payload.anchorX, 0);
assert.equal(ready.commands[0].payload.anchorY, 0);
assert.equal(ready.pendingRelocations.get(2)?.landing, null);

const supply = fixture(false);
await assert.rejects(supply.run(), (error) => error.status === 409 &&
  error.message === 'WORLD_MAP_SUPPLY_LANDING_UNAVAILABLE');
assert.equal(supply.commands.length, 0,
  'legacy supply-switch contract must not receive a guessed coordinate');
assert.match(source, /anchorX: pending\.landing\?\.x \?\? 0, anchorY: pending\.landing\?\.y \?\? 0/);
console.log('WORLD_MAP_MAP_ONLY_INTENT_PASS cases=2 mapLevel=0,0 supplyFailClosed=YES');
