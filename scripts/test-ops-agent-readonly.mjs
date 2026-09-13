import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadOpsAgentConfig } from '../ops/ro-stack/ops-agent/config.mjs';
import {
  __test,
  collectCharacters,
  collectServices,
} from '../ops/ro-stack/ops-agent/provider.mjs';
import { createOpsAgentServer } from '../ops/ro-stack/ops-agent/server.mjs';

const root = await mkdtemp(join(tmpdir(), 'ops-agent-test-'));
const runtimeRoot = join(root, '.local', 'ro-stack');
const nowValue = Date.parse('2026-09-13T10:00:00+08:00');
const now = () => nowValue;

async function json(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value), 'utf8');
}

try {
  await mkdir(join(root, 'ops', 'ro-stack'), { recursive: true });
  await writeFile(
    join(root, 'ops', 'ro-stack', 'stack.config.psd1'),
    "@{\n MariaDbPort = 3307\n LoginPort = 6901\n CharacterPort = 6122\n MapPort = 5122\n}\n",
    'utf8',
  );
  await json(join(runtimeRoot, 'state.json'), {
    startedAt: nowValue - 60000,
    processes: [
      { name: 'login', id: 101, path: 'login-server.exe', stdout: 'login.log' },
      { name: 'char', id: 102, path: 'char-server.exe', stdout: 'char.log' },
      { name: 'map', id: 103, path: 'map-server.exe', stdout: 'map.log' },
    ],
  });
  await json(join(runtimeRoot, 'dashboard', 'state.json'), {
    pid: 104,
    startedAt: nowValue - 50000,
  });
  await json(join(runtimeRoot, 'dashboard', 'tunnel-state.json'), {
    pid: 105,
    publicUrl: 'https://example.test',
    startedAt: nowValue - 40000,
  });
  await json(join(runtimeRoot, 'instances', 'player_2000001', 'state.json'), {
    pid: 106,
    startedAt: nowValue - 30000,
  });
  await json(join(runtimeRoot, 'instances', 'player_2000001', 'status.json'), {
    name: 'Fixture',
    map: 'prt_fild08',
    updatedAt: nowValue - 1000,
  });

  const config = await loadOpsAgentConfig({
    projectRoot: root,
    runtimeRoot,
    port: 0,
    timeoutMs: 50,
  });
  const passing = {
    now,
    probeHttp: async () => ({ ok: true, status: 200 }),
    probeProcess: async (tracked) => ({
      state: 'running',
      pid: Number(tracked?.pid ?? tracked?.id),
      name: 'fixture.exe',
      startedAt: new Date(nowValue - 30000).toISOString(),
    }),
    probeTcp: async () => ({ ok: true }),
    queryMariaDb: async (_config, sql) =>
      sql === 'SELECT 1;'
        ? '1'
        : '2000001\t1500001\tFixture\tOPENKORE\tOPENKORE\t\t0\t',
    tailContains: async () => true,
  };

  const services = await collectServices(config, passing);
  assert.equal(services.length, 7);
  assert.equal(services.every((service) => service.state === 'healthy'), true);
  assert.equal(
    JSON.stringify(services).includes('databasePassword'),
    false,
  );

  const characters = await collectCharacters(config, passing);
  assert.equal(characters.characters.length, 1);
  assert.equal(characters.characters[0].owner, 'OPENKORE');
  assert.equal(characters.characters[0].actionAllowed, false);
  assert.deepEqual(characters.characters[0].capabilities, {
    readStatus: true,
    start: false,
    stop: false,
    restart: false,
    claim: false,
    release: false,
  });

  const missingDashboard = await collectServices(config, {
    ...passing,
    probeProcess: async (tracked) =>
      Number(tracked?.pid ?? tracked?.id) === 104
        ? { state: 'missing', pid: 104 }
        : passing.probeProcess(tracked),
    probeHttp: async (url) =>
      String(url).includes('127.0.0.1:8788')
        ? { ok: false }
        : { ok: true, status: 200 },
    probeTcp: async (port) =>
      port === 8788 ? { ok: false } : { ok: true },
  });
  const dashboard = missingDashboard.find(
    (service) => service.serviceId === 'dashboard',
  );
  assert.equal(dashboard.state, 'stopped');
  assert.equal(
    missingDashboard.find((service) => service.serviceId === 'ops-agent').state,
    'healthy',
  );

  const staleTrackedState = await collectServices(config, {
    ...passing,
    probeProcess: async (tracked) =>
      Number(tracked?.pid ?? tracked?.id) === 104
        ? { state: 'missing', pid: 104 }
        : passing.probeProcess(tracked),
  });
  assert.equal(
    staleTrackedState.find((service) => service.serviceId === 'dashboard').state,
    'degraded',
  );

  const lowPrivilegeState = await collectServices(config, {
    ...passing,
    probeProcess: async (tracked) =>
      Number(tracked?.pid ?? tracked?.id) === 104
        ? { state: 'unknown', pid: 104 }
        : passing.probeProcess(tracked),
  });
  assert.equal(
    lowPrivilegeState.find((service) => service.serviceId === 'dashboard').state,
    'unknown',
  );

  assert.deepEqual(
    __test.parseOwnershipRows(
      '2000002\t1500002\tAgentFixture\tSERVER_AGENT\tSERVER_AGENT\tAUTO_FARM\t8\t',
    ).get(2000002)[0],
    {
      accountId: 2000002,
      characterId: 1500002,
      characterName: 'AgentFixture',
      owner: 'SERVER_AGENT',
      ownershipState: 'SERVER_AGENT',
      mode: 'AUTO_FARM',
      revision: 8,
      lastError: null,
    },
  );

  const server = createOpsAgentServer(config, { collectorOptions: passing });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${base}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.mode, 'read-only');

    const response = await fetch(`${base}/api/v1/evidence`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.services.length, 7);
    assert.equal(body.characters.length, 1);

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const mutation = await fetch(`${base}/api/v1/services`, { method });
      assert.equal(mutation.status, 405);
      assert.equal((await mutation.json()).error, 'READ_ONLY');
    }
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }

  console.log('OPS_AGENT_READONLY_PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
