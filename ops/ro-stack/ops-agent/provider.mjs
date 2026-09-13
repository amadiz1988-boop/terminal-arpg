import { readdir } from 'node:fs/promises';
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
  assertCharacterRuntimeStatus,
  assertServiceStatus,
} from './contracts.mjs';
import {
  evidence,
  probeHttp,
  probeProcess,
  probeStatus,
  probeTcp,
  queryMariaDb,
  readJson,
  reasonForProbe,
  safeProcessSummary,
  tailContains,
} from './probes.mjs';

const readOnlyCapabilities = Object.freeze({
  readStatus: true,
  start: false,
  stop: false,
  restart: false,
  claim: false,
  release: false,
});

function epochToIso(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toISOString()
    : null;
}

function makeEvidence(type, ok, failureCode, summary, now, unknown = false) {
  return evidence(
    type,
    ok ? EvidenceStatus.PASS : unknown ? EvidenceStatus.UNKNOWN : EvidenceStatus.FAIL,
    ok ? null : failureCode,
    summary,
    now,
  );
}

function deriveState(entries, { stoppedWhenProcessMissing = false } = {}) {
  if (entries.every((entry) => entry.status === EvidenceStatus.PASS)) {
    return { state: ServiceState.HEALTHY, lastErrorCode: null };
  }
  const firstFailure = entries.find((entry) => entry.status === EvidenceStatus.FAIL);
  const firstUnknown = entries.find((entry) => entry.status === EvidenceStatus.UNKNOWN);
  if (!firstFailure && firstUnknown) {
    return {
      state: ServiceState.UNKNOWN,
      lastErrorCode: firstUnknown.reasonCode,
    };
  }
  const processFailure = entries.find(
    (entry) => entry.type === EvidenceType.PROCESS && entry.status === EvidenceStatus.FAIL,
  );
  const endpointStillResponding = entries.some(
    (entry) =>
      [EvidenceType.HTTP, EvidenceType.LISTENER].includes(entry.type) &&
      entry.status === EvidenceStatus.PASS,
  );
  if (
    stoppedWhenProcessMissing &&
    !endpointStillResponding &&
    processFailure?.reasonCode === ReasonCode.PROCESS_NOT_FOUND
  ) {
    return { state: ServiceState.STOPPED, lastErrorCode: processFailure.reasonCode };
  }
  const unreachable = entries.some(
    (entry) =>
      entry.status === EvidenceStatus.FAIL &&
      [EvidenceType.HTTP, EvidenceType.LISTENER].includes(entry.type),
  );
  return {
    state: unreachable ? ServiceState.UNREACHABLE : ServiceState.DEGRADED,
    lastErrorCode: firstFailure?.reasonCode ?? firstUnknown?.reasonCode ?? null,
  };
}

function serviceStatus({
  serviceId,
  pid = null,
  port = null,
  startedAt = null,
  lastHeartbeatAt = null,
  evidence: entries,
  stoppedWhenProcessMissing = false,
}) {
  const state = deriveState(entries, { stoppedWhenProcessMissing });
  return assertServiceStatus({
    schemaVersion: OPS_API_VERSION,
    serviceId,
    provider: ServiceProvider.WINDOWS_NATIVE,
    state: state.state,
    pid,
    port,
    startedAt,
    lastHeartbeatAt,
    restartCount: 0,
    lastExitCode: null,
    lastErrorCode: state.lastErrorCode,
    evidence: entries,
  });
}

async function trackedService(
  serviceId,
  tracked,
  port,
  linkMarker,
  config,
  dependencies,
  now,
) {
  const [processResult, listener, linked] = await Promise.all([
    tracked
      ? dependencies.probeProcess(tracked, { timeoutMs: config.timeoutMs })
      : Promise.resolve({ state: 'unknown' }),
    dependencies.probeTcp(port, { timeoutMs: config.timeoutMs }),
    tracked
      ? dependencies.tailContains(tracked.stdout, linkMarker)
      : Promise.resolve(false),
  ]);
  const processReason =
    processResult.state === 'mismatch'
      ? ReasonCode.PROCESS_IDENTITY_MISMATCH
      : processResult.state === 'unknown'
        ? ReasonCode.EVIDENCE_INSUFFICIENT
        : ReasonCode.PROCESS_NOT_FOUND;
  const entries = [
    evidence(
      EvidenceType.PROCESS,
      probeStatus(processResult),
      processResult.state === 'running' ? null : processReason,
      safeProcessSummary(processResult, tracked?.path),
      now,
    ),
    makeEvidence(
      EvidenceType.LISTENER,
      listener.ok,
      reasonForProbe(listener, ReasonCode.PORT_NOT_LISTENING),
      listener.ok ? `loopback port ${port} is listening` : `loopback port ${port} unavailable`,
      now,
    ),
    makeEvidence(
      EvidenceType.SERVICE_LINK,
      linked,
      ReasonCode.SERVICE_LINK_FAILED,
      linked ? 'service-link marker observed' : 'service-link marker unavailable',
      now,
    ),
  ];
  return serviceStatus({
    serviceId,
    pid: processResult.state === 'running' ? processResult.pid : null,
    port,
    startedAt: processResult.startedAt ?? null,
    lastHeartbeatAt: linked ? new Date(now()).toISOString() : null,
    evidence: entries,
    stoppedWhenProcessMissing: true,
  });
}

function findTracked(stackState, name) {
  return stackState?.processes?.find((entry) => entry.name === name) ?? null;
}

export async function collectServices(config, options = {}) {
  const now = options.now ?? Date.now;
  const dependencies = {
    probeHttp: options.probeHttp ?? probeHttp,
    probeProcess: options.probeProcess ?? probeProcess,
    probeTcp: options.probeTcp ?? probeTcp,
    queryMariaDb: options.queryMariaDb ?? queryMariaDb,
    tailContains: options.tailContains ?? tailContains,
  };
  const [stackState, dashboardState, tunnelState, adminTunnelState] = await Promise.all([
    readJson(join(config.runtimeRoot, 'state.json')).catch(() => null),
    readJson(join(config.runtimeRoot, 'dashboard', 'state.json')).catch(() => null),
    readJson(join(config.runtimeRoot, 'dashboard', 'tunnel-state.json')).catch(
      () => null,
    ),
    readJson(join(config.runtimeRoot, 'ops-agent', 'tunnel-state.json')).catch(
      () => null,
    ),
  ]);

  const opsAgent = serviceStatus({
    serviceId: 'ops-agent',
    pid: process.pid,
    port: config.port || null,
    startedAt: epochToIso(options.startedAt ?? Date.now()),
    lastHeartbeatAt: new Date(now()).toISOString(),
    evidence: [
      makeEvidence(
        EvidenceType.RUNTIME,
        true,
        null,
        'read-only provider active',
        now,
      ),
    ],
  });

  const [dashboardProcess, dashboardListener, dashboardHttp] = await Promise.all([
    dashboardState
      ? dependencies.probeProcess(
          { ...dashboardState, expectedName: 'node.exe' },
          { timeoutMs: config.timeoutMs },
        )
      : Promise.resolve({ state: 'unknown' }),
    dependencies.probeTcp(config.dashboardPort, { timeoutMs: config.timeoutMs }),
    dependencies.probeHttp(
      `http://127.0.0.1:${config.dashboardPort}/api/internal/health`,
      { timeoutMs: config.timeoutMs },
    ),
  ]);
  const dashboardEntries = [
    evidence(
      EvidenceType.PROCESS,
      probeStatus(dashboardProcess),
      dashboardProcess.state === 'running'
        ? null
        : dashboardProcess.state === 'unknown'
          ? ReasonCode.EVIDENCE_INSUFFICIENT
          : dashboardProcess.state === 'mismatch'
            ? ReasonCode.PROCESS_IDENTITY_MISMATCH
            : ReasonCode.PROCESS_NOT_FOUND,
      safeProcessSummary(dashboardProcess, 'node'),
      now,
    ),
    makeEvidence(
      EvidenceType.LISTENER,
      dashboardListener.ok,
      reasonForProbe(dashboardListener, ReasonCode.PORT_NOT_LISTENING),
      dashboardListener.ok
        ? `loopback port ${config.dashboardPort} is listening`
        : `loopback port ${config.dashboardPort} unavailable`,
      now,
    ),
    makeEvidence(
      EvidenceType.HTTP,
      dashboardHttp.ok,
      reasonForProbe(dashboardHttp, ReasonCode.HEALTHCHECK_FAILED),
      dashboardHttp.ok
        ? `health endpoint returned HTTP ${dashboardHttp.status}`
        : 'health endpoint unavailable',
      now,
    ),
  ];
  const dashboard = serviceStatus({
    serviceId: 'dashboard',
    pid: dashboardProcess.state === 'running' ? dashboardProcess.pid : null,
    port: config.dashboardPort,
    startedAt:
      dashboardProcess.startedAt ?? epochToIso(dashboardState?.startedAt),
    lastHeartbeatAt: dashboardHttp.ok ? new Date(now()).toISOString() : null,
    evidence: dashboardEntries,
    stoppedWhenProcessMissing: true,
  });

  let publicHealthUrl = null;
  try {
    const candidate = new URL(tunnelState?.publicUrl ?? '');
    if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) {
      candidate.pathname = '/api/health';
      candidate.search = '';
      candidate.hash = '';
      publicHealthUrl = candidate.href;
    }
  } catch {}
  const [tunnelProcess, tunnelHttp] = await Promise.all([
    tunnelState
      ? dependencies.probeProcess(
          { ...tunnelState, expectedName: 'cloudflared.exe' },
          { timeoutMs: config.timeoutMs },
        )
      : Promise.resolve({ state: 'unknown' }),
    publicHealthUrl
      ? dependencies.probeHttp(publicHealthUrl, { timeoutMs: config.timeoutMs })
      : Promise.resolve({ ok: false }),
  ]);
  const tunnelEntries = [
    evidence(
      EvidenceType.PROCESS,
      probeStatus(tunnelProcess),
      tunnelProcess.state === 'running'
        ? null
        : tunnelProcess.state === 'unknown'
          ? ReasonCode.EVIDENCE_INSUFFICIENT
          : ReasonCode.PROCESS_NOT_FOUND,
      safeProcessSummary(tunnelProcess, 'cloudflared'),
      now,
    ),
    makeEvidence(
      EvidenceType.HTTP,
      tunnelHttp.ok,
      reasonForProbe(tunnelHttp, ReasonCode.HEALTHCHECK_FAILED),
      tunnelHttp.ok
        ? `public health returned HTTP ${tunnelHttp.status}`
        : 'public health unavailable',
      now,
    ),
  ];
  const tunnel = serviceStatus({
    serviceId: 'cloudflare-tunnel',
    pid: tunnelProcess.state === 'running' ? tunnelProcess.pid : null,
    startedAt: tunnelProcess.startedAt ?? epochToIso(tunnelState?.startedAt),
    lastHeartbeatAt: tunnelHttp.ok ? new Date(now()).toISOString() : null,
    evidence: tunnelEntries,
    stoppedWhenProcessMissing: true,
  });

  let adminPublicHealthUrl = null;
  try {
    const candidate = new URL(adminTunnelState?.publicUrl ?? '');
    if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) {
      candidate.pathname = '/health';
      candidate.search = '';
      candidate.hash = '';
      adminPublicHealthUrl = candidate.href;
    }
  } catch {}
  const [adminTunnelProcess, adminTunnelHttp] = await Promise.all([
    adminTunnelState
      ? dependencies.probeProcess(
          { ...adminTunnelState, expectedName: 'cloudflared.exe' },
          { timeoutMs: config.timeoutMs },
        )
      : Promise.resolve({ state: 'unknown' }),
    adminPublicHealthUrl
      ? dependencies.probeHttp(adminPublicHealthUrl, { timeoutMs: config.timeoutMs })
      : Promise.resolve({ ok: false }),
  ]);
  const adminTunnel = serviceStatus({
    serviceId: 'ops-admin-tunnel',
    pid:
      adminTunnelProcess.state === 'running' ? adminTunnelProcess.pid : null,
    startedAt:
      adminTunnelProcess.startedAt ?? epochToIso(adminTunnelState?.startedAt),
    lastHeartbeatAt: adminTunnelHttp.ok ? new Date(now()).toISOString() : null,
    evidence: [
      evidence(
        EvidenceType.PROCESS,
        probeStatus(adminTunnelProcess),
        adminTunnelProcess.state === 'running'
          ? null
          : adminTunnelProcess.state === 'unknown'
            ? ReasonCode.EVIDENCE_INSUFFICIENT
            : ReasonCode.PROCESS_NOT_FOUND,
        safeProcessSummary(adminTunnelProcess, 'cloudflared'),
        now,
      ),
      makeEvidence(
        EvidenceType.HTTP,
        adminTunnelHttp.ok,
        reasonForProbe(adminTunnelHttp, ReasonCode.HEALTHCHECK_FAILED),
        adminTunnelHttp.ok
          ? `admin public health returned HTTP ${adminTunnelHttp.status}`
          : 'admin public health unavailable',
        now,
      ),
    ],
    stoppedWhenProcessMissing: true,
  });

  const databaseResult = await Promise.allSettled([
    dependencies.probeTcp(config.mariaDbPort, { timeoutMs: config.timeoutMs }),
    dependencies.queryMariaDb(config, 'SELECT 1;'),
  ]);
  const databaseListener =
    databaseResult[0].status === 'fulfilled'
      ? databaseResult[0].value
      : { ok: false };
  const queryResult = databaseResult[1];
  const queryError = queryResult.status === 'rejected' ? queryResult.reason : null;
  const databaseQuery = {
    ok: queryResult.status === 'fulfilled' && queryResult.value === '1',
    unknown: queryError?.code === 'EVIDENCE_INSUFFICIENT',
    reason:
      queryError?.code === 'CHECK_TIMEOUT'
        ? ReasonCode.CHECK_TIMEOUT
        : queryError?.code === 'EVIDENCE_INSUFFICIENT'
          ? ReasonCode.EVIDENCE_INSUFFICIENT
          : ReasonCode.DATABASE_QUERY_FAILED,
  };
  const databaseEntries = [
    makeEvidence(
      EvidenceType.LISTENER,
      databaseListener.ok,
      reasonForProbe(databaseListener, ReasonCode.PORT_NOT_LISTENING),
      databaseListener.ok
        ? `loopback port ${config.mariaDbPort} is listening`
        : `loopback port ${config.mariaDbPort} unavailable`,
      now,
    ),
    makeEvidence(
      EvidenceType.DATABASE,
      databaseQuery.ok,
      databaseQuery.reason,
      databaseQuery.ok ? 'read-only query succeeded' : 'read-only query unavailable',
      now,
      databaseQuery.unknown,
    ),
  ];
  const database = serviceStatus({
    serviceId: 'mariadb',
    port: config.mariaDbPort,
    lastHeartbeatAt: databaseQuery.ok ? new Date(now()).toISOString() : null,
    evidence: databaseEntries,
  });

  const [login, character, map] = await Promise.all([
    trackedService(
      'login-server',
      findTracked(stackState, 'login'),
      config.loginPort,
      'The login-server is ready',
      config,
      dependencies,
      now,
    ),
    trackedService(
      'char-server',
      findTracked(stackState, 'char'),
      config.characterPort,
      'Connected to login-server',
      config,
      dependencies,
      now,
    ),
    trackedService(
      'map-server',
      findTracked(stackState, 'map'),
      config.mapPort,
      'Successfully logged on to Char Server',
      config,
      dependencies,
      now,
    ),
  ]);

  return [
    opsAgent,
    adminTunnel,
    dashboard,
    tunnel,
    database,
    login,
    character,
    map,
  ];
}

function providerForOwner(owner) {
  if (owner === ControlOwner.SERVER_AGENT) return RuntimeProvider.SERVER_AGENT;
  if (owner === ControlOwner.CLIENT) return RuntimeProvider.CLIENT;
  return RuntimeProvider.OPENKORE;
}

function parseOwnershipRows(output) {
  if (!output) return new Map();
  const rows = new Map();
  for (const line of output.split(/\r?\n/)) {
    const [
      accountId,
      characterId,
      characterName,
      owner,
      ownershipState,
      mode,
      revision,
      lastError,
    ] = line.split('\t');
    const key = Number(accountId);
    const accountRows = rows.get(key) ?? [];
    accountRows.push({
      accountId: key,
      characterId: Number(characterId),
      characterName,
      owner,
      ownershipState,
      mode: mode || null,
      revision: Number(revision),
      lastError: lastError || null,
    });
    rows.set(key, accountRows);
  }
  return rows;
}

async function instanceDirectories(runtimeRoot) {
  try {
    return (await readdir(join(runtimeRoot, 'instances'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^player_\d+$/.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        accountId: Number(entry.name.slice('player_'.length)),
        path: join(runtimeRoot, 'instances', entry.name),
      }));
  } catch {
    return [];
  }
}

async function countCommandQueue(path) {
  try {
    return (await readdir(join(path, 'commands'), { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.json'),
    ).length;
  } catch {
    return 0;
  }
}

export async function collectCharacters(config, options = {}) {
  const now = options.now ?? Date.now;
  const query = options.queryMariaDb ?? queryMariaDb;
  const processProbe = options.probeProcess ?? probeProcess;
  const instances = await instanceDirectories(config.runtimeRoot);
  if (!instances.length) return { characters: [], warnings: [] };
  const accountIds = instances.map((instance) => instance.accountId).join(',');
  let ownershipRows;
  try {
    ownershipRows = parseOwnershipRows(
      await query(
        config,
        `SELECT c.account_id,c.char_id,c.name,COALESCE(s.control_owner,'OPENKORE'),COALESCE(s.ownership_state,'OPENKORE'),COALESCE(s.agent_mode,''),COALESCE(s.revision,0),COALESCE(s.last_error_code,'') FROM \`char\` c LEFT JOIN persistent_agent_state s ON s.char_id=c.char_id AND s.account_id=c.account_id WHERE c.account_id IN (${accountIds}) ORDER BY c.account_id,c.char_num;`,
      ),
    );
  } catch {
    return {
      characters: [],
      warnings: [ReasonCode.EVIDENCE_INSUFFICIENT],
    };
  }

  const characters = [];
  const warnings = [];
  for (const instance of instances) {
    const [status, trackedState] = await Promise.all([
      readJson(join(instance.path, 'status.json')).catch(() => null),
      readJson(join(instance.path, 'state.json')).catch(() => null),
    ]);
    const accountCharacters = ownershipRows.get(instance.accountId) ?? [];
    const ownership =
      accountCharacters.find((row) => row.characterName === status?.name) ??
      (accountCharacters.length === 1 ? accountCharacters[0] : null);
    if (!ownership) {
      warnings.push(`OWNERSHIP_MISSING:${instance.accountId}`);
      continue;
    }
    const processResult = trackedState
      ? await processProbe(
          { ...trackedState, expectedName: 'start.exe' },
          { timeoutMs: config.timeoutMs },
        )
      : { state: 'missing' };
    const lifecycle =
      processResult.state === 'running'
        ? RuntimeLifecycle.ACTIVE
        : processResult.state === 'unknown'
          ? RuntimeLifecycle.UNKNOWN
          : RuntimeLifecycle.STOPPED;
    const heartbeat = epochToIso(status?.updatedAt);
    const stale =
      !heartbeat || now() - Number(status.updatedAt) > config.staleHeartbeatMs;
    const ownershipConflict =
      lifecycle === RuntimeLifecycle.ACTIVE &&
      ownership.owner === ControlOwner.SERVER_AGENT &&
      !stale;
    const lastErrorCode = ownershipConflict
      ? ReasonCode.OWNERSHIP_CONFLICT
      : lifecycle === RuntimeLifecycle.ACTIVE && stale
        ? ReasonCode.STALE_HEARTBEAT
        : lifecycle === RuntimeLifecycle.UNKNOWN
          ? ReasonCode.EVIDENCE_INSUFFICIENT
        : null;
    const mode = ownership.owner === ControlOwner.OPENKORE ? null : ownership.mode;
    characters.push(
      assertCharacterRuntimeStatus({
        schemaVersion: OPS_API_VERSION,
        accountId: ownership.accountId,
        characterId: ownership.characterId,
        characterName: ownership.characterName,
        owner: ownership.owner,
        ownershipState: ownership.ownershipState,
        provider: providerForOwner(ownership.owner),
        lifecycle,
        mode,
        map: status?.map ?? null,
        lastHeartbeatAt: heartbeat,
        revision: ownership.revision,
        commandQueueDepth: await countCommandQueue(instance.path),
        routeFailureCount: Number(status?.routeFailureCount ?? 0),
        lastErrorCode,
        actionAllowed: false,
        capabilities: readOnlyCapabilities,
      }),
    );
  }
  return { characters, warnings };
}

export function summarizeServices(services, characters) {
  const serviceCounts = Object.fromEntries(
    Object.values(ServiceState).map((state) => [
      state,
      services.filter((service) => service.state === state).length,
    ]),
  );
  return {
    serviceCounts,
    characterCount: characters.length,
    activeCharacterCount: characters.filter(
      (character) => character.lifecycle === RuntimeLifecycle.ACTIVE,
    ).length,
    stoppedCharacterCount: characters.filter(
      (character) => character.lifecycle === RuntimeLifecycle.STOPPED,
    ).length,
    attentionCharacterCount: characters.filter(
      (character) => character.lastErrorCode != null,
    ).length,
    staleCharacterCount: characters.filter(
      (character) => character.lastErrorCode === ReasonCode.STALE_HEARTBEAT,
    ).length,
    ownershipConflictCount: characters.filter(
      (character) => character.lastErrorCode === ReasonCode.OWNERSHIP_CONFLICT,
    ).length,
  };
}

export const __test = Object.freeze({ deriveState, parseOwnershipRows });
