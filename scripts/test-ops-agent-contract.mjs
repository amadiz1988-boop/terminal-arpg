import assert from 'node:assert/strict';

import {
  ActionResult,
  ControlOwner,
  EvidenceStatus,
  EvidenceType,
  IncidentTrigger,
  OPS_API_VERSION,
  OpsAction,
  OwnershipState,
  ReasonCode,
  RuntimeProvider,
  RuntimeLifecycle,
  ServiceProvider,
  ServiceState,
  assertAuditRecord,
  assertCharacterRuntimeStatus,
  assertIncidentSnapshot,
  assertServiceStatus,
} from '../ops/ro-stack/ops-agent/contracts.mjs';

const tests = [];

async function test(name, callback) {
  try {
    await callback();
    tests.push({ name, status: 'PASS' });
  } catch (error) {
    tests.push({ name, status: 'FAIL', error: error.stack ?? String(error) });
  }
}

const observedAt = '2026-09-13T10:00:00+08:00';

function passingEvidence(type = EvidenceType.HTTP) {
  return {
    type,
    status: EvidenceStatus.PASS,
    checkedAt: observedAt,
    reasonCode: null,
    summary: 'verified',
  };
}

function service(overrides = {}) {
  return {
    schemaVersion: OPS_API_VERSION,
    serviceId: 'dashboard',
    provider: ServiceProvider.WINDOWS_NATIVE,
    state: ServiceState.HEALTHY,
    pid: 1234,
    port: 8788,
    startedAt: observedAt,
    lastHeartbeatAt: observedAt,
    restartCount: 0,
    lastExitCode: null,
    lastErrorCode: null,
    evidence: [passingEvidence()],
    ...overrides,
  };
}

function capabilities(overrides = {}) {
  return {
    readStatus: true,
    start: false,
    stop: false,
    restart: false,
    claim: false,
    release: false,
    ...overrides,
  };
}

function runtime(overrides = {}) {
  return {
    schemaVersion: OPS_API_VERSION,
    accountId: 2000001,
    characterId: 1500001,
    characterName: '測試角色',
    owner: ControlOwner.OPENKORE,
    ownershipState: OwnershipState.OPENKORE,
    provider: RuntimeProvider.OPENKORE,
    lifecycle: RuntimeLifecycle.ACTIVE,
    mode: 'AUTO_FARM',
    map: 'prt_fild08',
    lastHeartbeatAt: observedAt,
    revision: 7,
    commandQueueDepth: 0,
    routeFailureCount: 0,
    lastErrorCode: null,
    actionAllowed: false,
    capabilities: capabilities(),
    ...overrides,
  };
}

await test('contract enums are immutable', () => {
  assert.equal(Object.isFrozen(ServiceState), true);
  assert.throws(() => {
    ServiceState.BROKEN = 'broken';
  }, TypeError);
});

await test('healthy service accepts evidence and strips extra fields', () => {
  const normalized = assertServiceStatus({
    ...service(),
    password: 'must-not-leak',
  });
  assert.equal(normalized.state, ServiceState.HEALTHY);
  assert.equal(normalized.port, 8788);
  assert.equal('password' in normalized, false);
});

await test('healthy service rejects failed evidence', () => {
  assert.throws(
    () =>
      assertServiceStatus(
        service({
          evidence: [
            {
              type: EvidenceType.HTTP,
              status: EvidenceStatus.FAIL,
              checkedAt: observedAt,
              reasonCode: ReasonCode.HEALTHCHECK_FAILED,
              summary: 'HTTP 500',
            },
          ],
        }),
      ),
    /healthy service requires passing evidence/,
  );
});

await test('unknown service requires explicit missing-evidence reason', () => {
  assert.throws(
    () =>
      assertServiceStatus(
        service({
          state: ServiceState.UNKNOWN,
          lastErrorCode: null,
          evidence: [passingEvidence()],
        }),
      ),
    /unknown service requires missing-evidence reason/,
  );
  const normalized = assertServiceStatus(
    service({
      state: ServiceState.UNKNOWN,
      lastErrorCode: ReasonCode.EVIDENCE_INSUFFICIENT,
      evidence: [
        {
          type: EvidenceType.PROCESS,
          status: EvidenceStatus.UNKNOWN,
          checkedAt: observedAt,
          reasonCode: ReasonCode.EVIDENCE_INSUFFICIENT,
          summary: 'process access denied',
        },
      ],
    }),
  );
  assert.equal(normalized.state, ServiceState.UNKNOWN);
});

await test('service ports stay within TCP range', () => {
  assert.throws(
    () => assertServiceStatus(service({ port: 65536 })),
    /serviceStatus.port is invalid/,
  );
});

await test('OpenKore runtime accepts read-only capabilities', () => {
  const normalized = assertCharacterRuntimeStatus(runtime());
  assert.equal(normalized.owner, ControlOwner.OPENKORE);
  assert.equal(normalized.capabilities.readStatus, true);
  assert.equal(normalized.actionAllowed, false);
});

await test('runtime provider cannot conflict with authoritative owner', () => {
  assert.throws(
    () =>
      assertCharacterRuntimeStatus(
        runtime({
          provider: RuntimeProvider.SERVER_AGENT,
        }),
      ),
    /provider conflicts with owner/,
  );
});

await test('all runtime capabilities must be explicit booleans', () => {
  const incomplete = capabilities();
  delete incomplete.release;
  assert.throws(
    () => assertCharacterRuntimeStatus(runtime({ capabilities: incomplete })),
    /capabilities.release is invalid/,
  );
});

await test('incident snapshot requires redaction and unique identities', () => {
  const normalized = assertIncidentSnapshot({
    schemaVersion: OPS_API_VERSION,
    snapshotId: 'incident-0001',
    createdAt: observedAt,
    trigger: IncidentTrigger.MANUAL,
    redacted: true,
    services: [service()],
    characters: [runtime()],
    tunnelToken: 'must-not-leak',
  });
  assert.equal(normalized.redacted, true);
  assert.equal('tunnelToken' in normalized, false);
  assert.throws(
    () =>
      assertIncidentSnapshot({
        ...normalized,
        services: [service(), service()],
      }),
    /services contains duplicates/,
  );
  assert.throws(
    () => assertIncidentSnapshot({ ...normalized, redacted: false }),
    /redacted must be true/,
  );
});

await test('terminal audit records require completion evidence', () => {
  const rejected = assertAuditRecord({
    schemaVersion: OPS_API_VERSION,
    actionId: 'action-0001',
    actor: 'admin-0001',
    action: OpsAction.RESTART_SERVICE,
    target: 'map-server',
    requestedAt: observedAt,
    preconditionRevision: 12,
    result: ActionResult.REJECTED,
    reasonCode: ReasonCode.ACTIVE_AGENT_NOT_DRAINED,
    completedAt: observedAt,
  });
  assert.equal(rejected.result, ActionResult.REJECTED);
  assert.throws(
    () => assertAuditRecord({ ...rejected, completedAt: null }),
    /terminal auditRecord requires completedAt/,
  );
  assert.throws(
    () => assertAuditRecord({ ...rejected, reasonCode: null }),
    /unsuccessful auditRecord requires reasonCode/,
  );
});

const failed = tests.filter((entry) => entry.status === 'FAIL');
for (const entry of tests) {
  console.log(
    `${entry.status}\t${entry.name}${entry.error ? `\n${entry.error}` : ''}`,
  );
}
if (failed.length) process.exitCode = 1;
else console.log('OPS_AGENT_CONTRACT_PASS');
