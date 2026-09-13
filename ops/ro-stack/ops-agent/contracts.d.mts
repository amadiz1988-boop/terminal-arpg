export type ServiceProvider = 'windows-native' | 'docker' | 'portainer';
export type ServiceState =
  | 'healthy'
  | 'degraded'
  | 'unreachable'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'quarantined'
  | 'unknown';
export type EvidenceType =
  | 'process'
  | 'listener'
  | 'http'
  | 'database'
  | 'service-link'
  | 'heartbeat'
  | 'ownership'
  | 'runtime';
export type EvidenceStatus = 'pass' | 'fail' | 'unknown';
export type RuntimeProvider =
  | 'openkore'
  | 'server-agent'
  | 'client'
  | 'unknown';
export type RuntimeLifecycle = 'active' | 'stopped' | 'unknown';
export type ControlOwner = 'OPENKORE' | 'SERVER_AGENT' | 'CLIENT';
export type OwnershipState =
  | 'OPENKORE'
  | 'CLAIMING_AGENT'
  | 'SERVER_AGENT'
  | 'RELEASING_AGENT'
  | 'QUARANTINED';
export type OpsCapability =
  | 'readStatus'
  | 'start'
  | 'stop'
  | 'restart'
  | 'claim'
  | 'release';
export type IncidentTrigger =
  | 'manual'
  | 'health-transition'
  | 'watchdog'
  | 'action-failure';
export type OpsAction =
  | 'start-service'
  | 'stop-service'
  | 'restart-service'
  | 'claim-agent'
  | 'release-agent'
  | 'quarantine-runtime';
export type ActionResult =
  | 'accepted'
  | 'confirmed'
  | 'rejected'
  | 'failed'
  | 'timeout';
export type ReasonCode =
  | 'CHECK_TIMEOUT'
  | 'EVIDENCE_INSUFFICIENT'
  | 'PROCESS_NOT_FOUND'
  | 'PROCESS_IDENTITY_MISMATCH'
  | 'PORT_NOT_LISTENING'
  | 'HEALTHCHECK_FAILED'
  | 'DATABASE_QUERY_FAILED'
  | 'SERVICE_LINK_FAILED'
  | 'STALE_HEARTBEAT'
  | 'DUPLICATE_PROCESS'
  | 'OWNERSHIP_CONFLICT'
  | 'ACTIVE_CLIENT'
  | 'ACTIVE_OPENKORE'
  | 'ACTIVE_AGENT_NOT_DRAINED'
  | 'STALE_REVISION'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'QUARANTINED'
  | 'ACTION_TIMEOUT'
  | 'ACTION_FAILED';

export interface EvidenceRecord {
  type: EvidenceType;
  status: EvidenceStatus;
  checkedAt: string;
  reasonCode: ReasonCode | null;
  summary: string | null;
}

export interface ServiceStatus {
  schemaVersion: 1;
  serviceId: string;
  provider: ServiceProvider;
  state: ServiceState;
  pid: number | null;
  port: number | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  restartCount: number;
  lastExitCode: number | null;
  lastErrorCode: ReasonCode | null;
  evidence: EvidenceRecord[];
}

export interface RuntimeCapabilities {
  readStatus: boolean;
  start: boolean;
  stop: boolean;
  restart: boolean;
  claim: boolean;
  release: boolean;
}

export interface CharacterRuntimeStatus {
  schemaVersion: 1;
  accountId: number;
  characterId: number;
  characterName: string;
  owner: ControlOwner;
  ownershipState: OwnershipState;
  provider: RuntimeProvider;
  lifecycle: RuntimeLifecycle;
  mode: string | null;
  map: string | null;
  lastHeartbeatAt: string | null;
  revision: number;
  commandQueueDepth: number;
  routeFailureCount: number;
  lastErrorCode: ReasonCode | null;
  actionAllowed: boolean;
  capabilities: RuntimeCapabilities;
}

export interface IncidentSnapshot {
  schemaVersion: 1;
  snapshotId: string;
  createdAt: string;
  trigger: IncidentTrigger;
  redacted: true;
  services: ServiceStatus[];
  characters: CharacterRuntimeStatus[];
}

export interface AuditRecord {
  schemaVersion: 1;
  actionId: string;
  actor: string;
  action: OpsAction;
  target: string;
  requestedAt: string;
  preconditionRevision: number;
  result: ActionResult;
  reasonCode: ReasonCode | null;
  completedAt: string | null;
}

export const OPS_API_VERSION: 1;
export const ServiceProvider: Readonly<
  Record<'WINDOWS_NATIVE' | 'DOCKER' | 'PORTAINER', ServiceProvider>
>;
export const ServiceState: Readonly<Record<string, ServiceState>>;
export const EvidenceType: Readonly<Record<string, EvidenceType>>;
export const EvidenceStatus: Readonly<Record<string, EvidenceStatus>>;
export const RuntimeProvider: Readonly<Record<string, RuntimeProvider>>;
export const RuntimeLifecycle: Readonly<Record<string, RuntimeLifecycle>>;
export const ControlOwner: Readonly<Record<ControlOwner, ControlOwner>>;
export const OwnershipState: Readonly<Record<OwnershipState, OwnershipState>>;
export const OpsCapability: Readonly<Record<string, OpsCapability>>;
export const IncidentTrigger: Readonly<Record<string, IncidentTrigger>>;
export const OpsAction: Readonly<Record<string, OpsAction>>;
export const ActionResult: Readonly<Record<string, ActionResult>>;
export const ReasonCode: Readonly<Record<ReasonCode, ReasonCode>>;

export function assertEvidenceRecord(value: unknown): EvidenceRecord;
export function assertServiceStatus(value: unknown): ServiceStatus;
export function assertCharacterRuntimeStatus(
  value: unknown,
): CharacterRuntimeStatus;
export function assertIncidentSnapshot(value: unknown): IncidentSnapshot;
export function assertAuditRecord(value: unknown): AuditRecord;
