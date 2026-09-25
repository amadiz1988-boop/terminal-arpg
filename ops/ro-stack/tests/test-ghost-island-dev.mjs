import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runConsole } from '../ghost-island-dev.mjs';
import { capabilities } from '../dev-console/registry.mjs';
import { parseLiveInventoryRow } from '../dev-console/providers.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ro-dev-console-'));
const dir = path.join(root, '.local', 'ro-stack');
fs.mkdirSync(path.join(dir, 'dashboard'), { recursive: true });
fs.mkdirSync(path.join(dir, 'production-deployment-lease'), { recursive: true });
fs.writeFileSync(path.join(dir, 'state.json'), '\uFEFF' + JSON.stringify({ startedAt: 123,
  processes: [{ name: 'map', id: 42, path: 'map-server.exe' }] }));
fs.writeFileSync(path.join(dir, 'dashboard', 'state.json'), JSON.stringify({ pid: 43 }));
fs.writeFileSync(path.join(dir, 'production-deployment-state.json'), JSON.stringify({
  current_web_git_sha: 'UNRESOLVED_LEGACY', current_native_git_sha: 'UNRESOLVED_LEGACY',
  production_drift: 'OPEN', last_deploy_receipt: null }));
fs.writeFileSync(path.join(dir, 'production-deployment-lease', 'lease.json'), JSON.stringify({
  status: 'ACTIVE', web_deploy_git_sha: 'a'.repeat(40) }));

try {
  const registry = await runConsole(['capabilities']);
  assert.equal(registry.STATUS, 'OK');
  assert.equal(new Set(capabilities.map(row => row.id)).size, capabilities.length);
  assert(capabilities.every(row => row.current_status && row.authority && row.mode && row.source));
  assert.equal((await runConsole(['capabilities', 'life'])).RESULT.every(row =>
    row.current_status === 'NOT_IMPLEMENTED_PRODUCT'), true);

  const processes = await runConsole(['runtime', 'processes'], { providers: { root } });
  assert.equal(processes.STATUS, 'OK');
  assert.equal(processes.RESULT.processes[0].pid, 42);
  const state = await runConsole(['deployment', 'state'], { providers: { root } });
  assert.equal(state.RESULT.webGitSha, 'UNRESOLVED_LEGACY');
  assert.equal(state.RESULT.lease.webGitSha, 'a'.repeat(40));
  assert.equal(state.RESULT.drift, 'OPEN');
  assert.equal((await runConsole(['deployment', 'receipt'], { providers: { root } })).STATUS, 'NOT_FOUND');

  let fetched = 0;
  const fetchImpl = async () => { fetched++;
    return { ok: true, json: async () => ({ characters: [{ charId: 17, ownershipState: 'QUARANTINED',
      runtimeState: 'QUARANTINED', resident: false, hp: 5, map: 'prontera', freshness: 'FRESH' }] }) };
  };
  const providers = { env: { RO_LOCAL_ADMIN_TOKEN: 'test-only' }, fetchImpl };
  const player = await runConsole(['player', 'inspect', '17'], { providers });
  assert.equal(player.STATUS, 'OK');
  assert.equal(player.RESULT.hp, 5);
  assert.equal((await runConsole(['player', 'quarantine'], { providers })).RESULT.count, 1);
  assert.equal(fetched, 2);
  assert.equal(capabilities.find(row => row.id === 'player.live_inventory').command,
    'player live-inventory <charId>');
  assert.deepEqual(parseLiveInventoryRow(['17', '19', '21', '1', 'izlude', '24',
    '6', '100', '500', '20300', '0', '']), {
    charId: 17, accountId: 19, revision: 21, resident: true, map: 'izlude',
    ageMs: 24, inventorySlots: 6, inventoryMaxSlots: 100, weight: 500,
    maxWeight: 20300, supplyRequired: false, supplyReason: null,
  });
  assert.equal(parseLiveInventoryRow(['17', '19', '21', '1', 'izlude', '24',
    '6', '100', '500', '20300', '1', 'HP_LOW']).supplyRequired, true);
  assert.equal(parseLiveInventoryRow(['17', '19', '21', '1', 'izlude', '24',
    '6', '100', '500', '20300', 'NULL', '']).supplyRequired, null);
  assert.equal((await runConsole(['player', 'live-inventory', '17', '--sql', 'DELETE'])).STATUS,
    'NOT_ELIGIBLE');
  assert.equal((await runConsole(['player', 'fleet'], { providers: { env: {}, fetchImpl } })).STATUS, 'NOT_AUTHORIZED');
  assert.equal(fetched, 2);

  let actions = 0;
  const action = async args => { actions++; assert.deepEqual(args,
    ['recover_quarantined_to_idle', '--char-id', '17', '--preflight']);
    return { result: 'READ_ONLY_PREFLIGHT', requestId: 'fixture-id' };
  };
  assert.equal((await runConsole(['action', 'recover-quarantined', '17'], { action })).STATUS, 'NOT_ELIGIBLE');
  assert.equal(actions, 0);
  const preflight = await runConsole(['action', 'recover-quarantined', '17', '--preflight'], { action });
  assert.equal(preflight.STATUS, 'OK');
  assert.equal(preflight.PRECHECK, 'ROSTER_ONLY');
  assert.equal(actions, 1);
  const rejected = await runConsole(['action', 'recover-quarantined', '17', '--execute'], {
    action: async () => ({ result: 'REJECTED', requestId: 'fixture-id' }),
  });
  assert.equal(rejected.STATUS, 'ACTION_REJECTED');
  assert.equal((await runConsole(['events', 'recent', '17', '--sql', 'DELETE'])).STATUS, 'NOT_ELIGIBLE');
  assert.equal((await runConsole(['runtime', 'logs', 'powershell'])).STATUS, 'NOT_ELIGIBLE');
  console.log('developer console: 19 assertions groups PASS');
} finally {
  assert(path.resolve(root).toLowerCase().startsWith(path.resolve(os.tmpdir()).toLowerCase() + path.sep));
  assert(path.basename(root).startsWith('ro-dev-console-'));
  fs.rmSync(root, { recursive: true, force: true });
}
