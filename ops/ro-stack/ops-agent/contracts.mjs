export const OPS_API_VERSION = 1;

export const ServiceProvider = Object.freeze({
  WINDOWS_NATIVE: 'windows-native',
  DOCKER: 'docker',
  PORTAINER: 'portainer',
});

export const ServiceState = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNREACHABLE: 'unreachable',
  STOPPED: 'stopped',
  STARTING: 'starting',
  STOPPING: 'stopping',
  QUARANTINED: 'quarantined',
  UNKNOWN: 'unknown',
});

export const EvidenceType = Object.freeze({
  PROCESS: 'process',
  LISTENER: 'listener',
  HTTP: 'http',
  DATABASE: 'database',
  SERVICE_LINK: 'service-link',
  HEARTBEAT: 'heartbeat',
  OWNERSHIP: 'ownership',
  RUNTIME: 'runtime',
});

export const EvidenceStatus = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
  UNKNOWN: 'unknown',
});

export const RuntimeProvider = Object.freeze({
  OPENKORE: 'openkore',
  SERVER_AGENT: 'server-agent',
  CLIENT: 'client',
  UNKNOWN: 'unknown',
});

export const ControlOwner = Object.freeze({
  OPENKORE: 'OPENKORE',
  SERVER_AGENT: 'SERVER_AGENT',
  CLIENT: 'CLIENT',
});

export const OwnershipState = Object.freeze({
  OPENKORE: 'OPENKORE',
  CLAIMING_AGENT: 'CLAIMING_AGENT',
  SERVER_AGENT: 'SERVER_AGENT',
  RELEASING_AGENT: 'RELEASING_AGENT',
  QUARANTINED: 'QUARANTINED',
});

export const OpsCapability = Object.freeze({
  READ_STATUS: 'readStatus',
  START: 'start',
  STOP: 'stop',
  RESTART: 'restart',
  CLAIM: 'claim',
  RELEASE: 'release',
});

export const IncidentTrigger = Object.freeze({
  MANUAL: 'manual',
  HEALTH_TRANSITION: 'health-transition',
  WATCHDOG: 'watchdog',
  ACTION_FAILURE: 'action-failure',
});

export const OpsAction = Object.freeze({
  START_SERVICE: 'start-service',
  STOP_SERVICE: 'stop-service',
  RESTART_SERVICE: 'restart-service',
  CLAIM_AGENT: 'claim-agent',
  RELEASE_AGENT: 'release-agent',
  QUARANTINE_RUNTIME: 'quarantine-runtime',
});

export const ActionResult = Object.freeze({
  ACCEPTED: 'accepted',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
});

export const ReasonCode = Object.freeze({
  CHECK_TIMEOUT: 'CHECK_TIMEOUT',
  EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
  PROCESS_NOT_FOUND: 'PROCESS_NOT_FOUND',
  PROCESS_IDENTITY_MISMATCH: 'PROCESS_IDENTITY_MISMATCH',
  PORT_NOT_LISTENING: 'PORT_NOT_LISTENING',
  HEALTHCHECK_FAILED: 'HEALTHCHECK_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  SERVICE_LINK_FAILED: 'SERVICE_LINK_FAILED',
  STALE_HEARTBEAT: 'STALE_HEARTBEAT',
  DUPLICATE_PROCESS: 'DUPLICATE_PROCESS',
  OWNERSHIP_CONFLICT: 'OWNERSHIP_CONFLICT',
  ACTIVE_CLIENT: 'ACTIVE_CLIENT',
  ACTIVE_OPENKORE: 'ACTIVE_OPENKORE',
  ACTIVE_AGENT_NOT_DRAINED: 'ACTIVE_AGENT_NOT_DRAINED',
  STALE_REVISION: 'STALE_REVISION',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  QUARANTINED: 'QUARANTINED',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
  ACTION_FAILED: 'ACTION_FAILED',
});

const IDENTIFIER = /^[A-Za-z0-9_.:@-]{1,96}$/;
const MAP_ID = /^[A-Za-z0-9_@-]{1,32}$/;

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} is required`);
  }
  return value;
}

function assertEnum(value, values, label) {
  if (!Object.values(values).includes(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function assertNullableIdentifier(value, label) {
  return value == null ? null : assertIdentifier(value, label);
}

function assertSafeInteger(value, label, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function assertNullableInteger(value, label, options) {
  return value == null ? null : assertSafeInteger(value, label, options);
}

function assertTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value == null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function assertNullableReasonCode(value, label) {
  return value == null ? null : assertEnum(value, ReasonCode, label);
}

function assertSummary(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > 512) {
    throw new TypeError('evidence.summary is invalid');
  }
  return value;
}

export function assertEvidenceRecord(value) {
  const evidence = assertRecord(value, 'evidence');
  const normalized = {
    type: assertEnum(evidence.type, EvidenceType, 'evidence.type'),
    status: assertEnum(evidence.status, EvidenceStatus, 'evidence.status'),
    checkedAt: assertTimestamp(evidence.checkedAt, 'evidence.checkedAt'),
    reasonCode: assertNullableReasonCode(
      evidence.reasonCode,
      'evidence.reasonCode',
    ),
    summary: assertSummary(evidence.summary),
  };
  if (
    normalized.status !== EvidenceStatus.PASS &&
    normalized.reasonCode == null
  ) {
    throw new TypeError('failed or unknown evidence requires reasonCode');
  }
  return normalized;
}

function normalizeEvidence(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 128) {
    throw new TypeError('evidence is invalid');
  }
  return value.map(assertEvidenceRecord);
}

export function assertServiceStatus(value) {
  const status = assertRecord(value, 'serviceStatus');
  if (status.schemaVersion !== OPS_API_VERSION) {
    throw new TypeError('serviceStatus.schemaVersion is invalid');
  }
  const normalized = {
    schemaVersion: OPS_API_VERSION,
    serviceId: assertIdentifier(status.serviceId, 'serviceStatus.serviceId'),
    provider: assertEnum(
      status.provider,
      ServiceProvider,
      'serviceStatus.provider',
    ),
    state: assertEnum(status.state, ServiceState, 'serviceStatus.state'),
    pid: assertNullableInteger(status.pid, 'serviceStatus.pid', { minimum: 1 }),
    port: assertNullableInteger(status.port, 'serviceStatus.port', {
      minimum: 1,
    }),
    startedAt: assertTimestamp(status.startedAt, 'serviceStatus.startedAt', {
      nullable: true,
    }),
    lastHeartbeatAt: assertTimestamp(
      status.lastHeartbeatAt,
      'serviceStatus.lastHeartbeatAt',
      { nullable: true },
    ),
    restartCount: assertSafeInteger(
      status.restartCount,
      'serviceStatus.restartCount',
    ),
    lastExitCode: assertNullableInteger(
      status.lastExitCode,
      'serviceStatus.lastExitCode',
      { minimum: Number.MIN_SAFE_INTEGER },
    ),
    lastErrorCode: assertNullableReasonCode(
      status.lastErrorCode,
      'serviceStatus.lastErrorCode',
    ),
    evidence: normalizeEvidence(status.evidence),
  };
  if (normalized.port != null && normalized.port > 65535) {
    throw new TypeError('serviceStatus.port is invalid');
  }
  if (
    normalized.state === ServiceState.HEALTHY &&
    normalized.evidence.some((entry) => entry.status !== EvidenceStatus.PASS)
  ) {
    throw new TypeError('healthy service requires passing evidence');
  }
  if (
    normalized.state === ServiceState.UNKNOWN &&
    (normalized.lastErrorCode == null ||
      !normalized.evidence.some(
        (entry) => entry.status === EvidenceStatus.UNKNOWN,
      ))
  ) {
    throw new TypeError('unknown service requires missing-evidence reason');
  }
  return normalized;
}

function normalizeCapabilities(value) {
  const capabilities = assertRecord(value, 'runtimeStatus.capabilities');
  return Object.fromEntries(
    Object.values(OpsCapability).map((capability) => {
      if (typeof capabilities[capability] !== 'boolean') {
        throw new TypeError(
          `runtimeStatus.capabilities.${capability} is invalid`,
        );
      }
      return [capability, capabilities[capability]];
    }),
  );
}

function assertProviderMatchesOwner(provider, owner) {
  const expected = {
    [ControlOwner.OPENKORE]: RuntimeProvider.OPENKORE,
    [ControlOwner.SERVER_AGENT]: RuntimeProvider.SERVER_AGENT,
    [ControlOwner.CLIENT]: RuntimeProvider.CLIENT,
  }[owner];
  if (provider !== RuntimeProvider.UNKNOWN && provider !== expected) {
    throw new TypeError('runtimeStatus.provider conflicts with owner');
  }
}

export function assertCharacterRuntimeStatus(value) {
  const status = assertRecord(value, 'runtimeStatus');
  if (status.schemaVersion !== OPS_API_VERSION) {
    throw new TypeError('runtimeStatus.schemaVersion is invalid');
  }
  const owner = assertEnum(status.owner, ControlOwner, 'runtimeStatus.owner');
  const provider = assertEnum(
    status.provider,
    RuntimeProvider,
    'runtimeStatus.provider',
  );
  assertProviderMatchesOwner(provider, owner);
  const map = status.map == null ? null : String(status.map);
  if (map != null && !MAP_ID.test(map)) {
    throw new TypeError('runtimeStatus.map is invalid');
  }
  return {
    schemaVersion: OPS_API_VERSION,
    accountId: assertSafeInteger(status.accountId, 'runtimeStatus.accountId', {
      minimum: 1,
    }),
    characterId: assertSafeInteger(
      status.characterId,
      'runtimeStatus.characterId',
      { minimum: 1 },
    ),
    owner,
    ownershipState: assertEnum(
      status.ownershipState,
      OwnershipState,
      'runtimeStatus.ownershipState',
    ),
    provider,
    mode: assertNullableIdentifier(status.mode, 'runtimeStatus.mode'),
    map,
    lastHeartbeatAt: assertTimestamp(
      status.lastHeartbeatAt,
      'runtimeStatus.lastHeartbeatAt',
      { nullable: true },
    ),
    revision: assertSafeInteger(status.revision, 'runtimeStatus.revision'),
    commandQueueDepth: assertSafeInteger(
      status.commandQueueDepth,
      'runtimeStatus.commandQueueDepth',
    ),
    routeFailureCount: assertSafeInteger(
      status.routeFailureCount,
      'runtimeStatus.routeFailureCount',
    ),
    lastErrorCode: assertNullableReasonCode(
      status.lastErrorCode,
      'runtimeStatus.lastErrorCode',
    ),
    actionAllowed:
      typeof status.actionAllowed === 'boolean'
        ? status.actionAllowed
        : (() => {
            throw new TypeError('runtimeStatus.actionAllowed is invalid');
          })(),
    capabilities: normalizeCapabilities(status.capabilities),
  };
}

function assertUnique(values, selector, label) {
  const keys = values.map(selector);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError(`${label} contains duplicates`);
  }
}

export function assertIncidentSnapshot(value) {
  const snapshot = assertRecord(value, 'incidentSnapshot');
  if (snapshot.schemaVersion !== OPS_API_VERSION) {
    throw new TypeError('incidentSnapshot.schemaVersion is invalid');
  }
  if (!Array.isArray(snapshot.services) || snapshot.services.length > 128) {
    throw new TypeError('incidentSnapshot.services is invalid');
  }
  if (
    !Array.isArray(snapshot.characters) ||
    snapshot.characters.length > 1024
  ) {
    throw new TypeError('incidentSnapshot.characters is invalid');
  }
  if (snapshot.redacted !== true) {
    throw new TypeError('incidentSnapshot.redacted must be true');
  }
  const services = snapshot.services.map(assertServiceStatus);
  const characters = snapshot.characters.map(assertCharacterRuntimeStatus);
  assertUnique(services, (service) => service.serviceId, 'services');
  assertUnique(
    characters,
    (character) => `${character.accountId}:${character.characterId}`,
    'characters',
  );
  return {
    schemaVersion: OPS_API_VERSION,
    snapshotId: assertIdentifier(
      snapshot.snapshotId,
      'incidentSnapshot.snapshotId',
    ),
    createdAt: assertTimestamp(
      snapshot.createdAt,
      'incidentSnapshot.createdAt',
    ),
    trigger: assertEnum(
      snapshot.trigger,
      IncidentTrigger,
      'incidentSnapshot.trigger',
    ),
    redacted: true,
    services,
    characters,
  };
}

export function assertAuditRecord(value) {
  const record = assertRecord(value, 'auditRecord');
  if (record.schemaVersion !== OPS_API_VERSION) {
    throw new TypeError('auditRecord.schemaVersion is invalid');
  }
  const result = assertEnum(record.result, ActionResult, 'auditRecord.result');
  const reasonCode = assertNullableReasonCode(
    record.reasonCode,
    'auditRecord.reasonCode',
  );
  const completedAt = assertTimestamp(
    record.completedAt,
    'auditRecord.completedAt',
    { nullable: true },
  );
  const terminal = result !== ActionResult.ACCEPTED;
  if (terminal && completedAt == null) {
    throw new TypeError('terminal auditRecord requires completedAt');
  }
  if (
    [ActionResult.REJECTED, ActionResult.FAILED, ActionResult.TIMEOUT].includes(
      result,
    ) &&
    reasonCode == null
  ) {
    throw new TypeError('unsuccessful auditRecord requires reasonCode');
  }
  return {
    schemaVersion: OPS_API_VERSION,
    actionId: assertIdentifier(record.actionId, 'auditRecord.actionId'),
    actor: assertIdentifier(record.actor, 'auditRecord.actor'),
    action: assertEnum(record.action, OpsAction, 'auditRecord.action'),
    target: assertIdentifier(record.target, 'auditRecord.target'),
    requestedAt: assertTimestamp(record.requestedAt, 'auditRecord.requestedAt'),
    preconditionRevision: assertSafeInteger(
      record.preconditionRevision,
      'auditRecord.preconditionRevision',
    ),
    result,
    reasonCode,
    completedAt,
  };
}
