import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ControlOwner,
  EvidenceStatus,
  EvidenceType,
  OPS_API_VERSION,
  OwnershipState,
  ReasonCode,
  RuntimeProvider,
  RuntimeLifecycle,
  ServiceProvider,
  ServiceState,
} from '../ops/ro-stack/ops-agent/contracts.mjs';
import {
  createIncidentMonitor,
  createIncidentStore,
} from '../ops/ro-stack/ops-agent/incidents.mjs';
import { createOpsAgentServer } from '../ops/ro-stack/ops-agent/server.mjs';

const root = await mkdtemp(join(tmpdir(), 'ops-incidents-'));
let nowValue = Date.parse('2026-09-13T10:00:00+08:00');
const now = () => nowValue;
const timestamp = () => new Date(nowValue).toISOString();

function service(serviceId, state = ServiceState.HEALTHY, reasonCode = null) {
  const status = state === ServiceState.HEALTHY ? EvidenceStatus.PASS : EvidenceStatus.FAIL;
  return {
    schemaVersion: OPS_API_VERSION,
    serviceId,
    provider: ServiceProvider.WINDOWS_NATIVE,
    state,
    pid: 100,
    port: 8788,
    startedAt: timestamp(),
    lastHeartbeatAt: state === ServiceState.HEALTHY ? timestamp() : null,
    restartCount: 0,
    lastExitCode: null,
    lastErrorCode: reasonCode,
    evidence: [
      {
        type: EvidenceType.HTTP,
        status,
        checkedAt: timestamp(),
        reasonCode,
        summary:
          state === ServiceState.HEALTHY
            ? 'HTTP 200'
            : 'Authorization: Bearer abc password=def token=ghi cookie=jkl',
      },
    ],
  };
}

function character(lastErrorCode = null) {
  return {
    schemaVersion: OPS_API_VERSION,
    accountId: 2000001,
    characterId: 1500001,
    characterName: '事故測試角色',
    owner: ControlOwner.OPENKORE,
    ownershipState: OwnershipState.OPENKORE,
    provider: RuntimeProvider.OPENKORE,
    lifecycle: RuntimeLifecycle.ACTIVE,
    mode: null,
    map: 'prt_fild08',
    lastHeartbeatAt: lastErrorCode ? null : timestamp(),
    revision: 0,
    commandQueueDepth: 0,
    routeFailureCount: 0,
    lastErrorCode,
    actionAllowed: false,
    capabilities: {
      readStatus: true,
      start: false,
      stop: false,
      restart: false,
      claim: false,
      release: false,
    },
  };
}

try {
  const store = createIncidentStore({
    directory: join(root, 'incidents'),
    maximumEntries: 10,
    now,
  });
  let current = {
    services: [service('dashboard')],
    characters: [character()],
  };
  const monitor = createIncidentMonitor({
    store,
    collect: async () => current,
    intervalMs: 60000,
  });

  assert.equal(await monitor.tick(), null);
  assert.equal((await store.list()).length, 0);

  for (const fixture of [
    {
      services: [
        service(
          'dashboard',
          ServiceState.UNREACHABLE,
          ReasonCode.HEALTHCHECK_FAILED,
        ),
      ],
      characters: [character()],
    },
    {
      services: [
        service(
          'cloudflare-tunnel',
          ServiceState.UNREACHABLE,
          ReasonCode.HEALTHCHECK_FAILED,
        ),
      ],
      characters: [character()],
    },
    {
      services: [
        service(
          'mariadb',
          ServiceState.DEGRADED,
          ReasonCode.DATABASE_QUERY_FAILED,
        ),
      ],
      characters: [character()],
    },
    {
      services: [service('openkore-workers')],
      characters: [character(ReasonCode.STALE_HEARTBEAT)],
    },
  ]) {
    nowValue += 1000;
    current = fixture;
    assert.ok(await monitor.tick());
  }

  nowValue += 1000;
  current = {
    services: [service('dashboard')],
    characters: [character()],
  };
  assert.ok(await monitor.tick());

  const snapshots = await store.list();
  assert.equal(snapshots.length, 5);
  const redacted = await store.read(
    snapshots.find((snapshot) => snapshot.serviceIssueCount > 0).snapshotId,
  );
  assert.equal(redacted.redacted, true);
  const serialized = JSON.stringify(redacted);
  for (const secret of ['abc', 'def', 'ghi', 'jkl', 'Bearer']) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(await store.read('../../secrets'), null);

  const retention = createIncidentStore({
    directory: join(root, 'retention'),
    maximumEntries: 2,
    now,
  });
  for (let index = 0; index < 3; index += 1) {
    nowValue += 1000;
    await retention.write({
      services: [
        service(
          `dashboard-${index}`,
          ServiceState.UNREACHABLE,
          ReasonCode.HEALTHCHECK_FAILED,
        ),
      ],
      characters: [],
    });
  }
  assert.equal((await retention.list()).length, 2);

  const server = createOpsAgentServer(
    { port: 0 },
    {
      incidentStore: store,
      collectorOptions: {
        now,
        probeHttp: async () => ({ ok: true, status: 200 }),
        probeProcess: async () => ({ state: 'unknown' }),
        probeTcp: async () => ({ ok: true }),
        queryMariaDb: async () => '',
        tailContains: async () => true,
      },
    },
  );
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const listResponse = await fetch(`${base}/api/v1/incidents`);
    const listBody = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listBody.incidents.length, 5);
    const detailResponse = await fetch(
      `${base}/api/v1/incidents/${listBody.incidents[0].snapshotId}`,
    );
    assert.equal(detailResponse.status, 200);
    assert.equal((await detailResponse.json()).redacted, true);
    assert.equal((await fetch(`${base}/api/v1/incidents/invalid`)).status, 404);
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }

  console.log('OPS_AGENT_INCIDENTS_PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
