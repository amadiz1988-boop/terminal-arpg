// C3-OPS-CONTROL-PLANE (SERVER OPS): centralized, cached, read-only runtime
// observability for the Server Admin surface.
//
// Design rules enforced here:
//  - ONE background sampler per Dashboard process. HTTP requests NEVER spawn
//    PowerShell/CIM; they read the cached snapshot.
//  - Canonical PROCESS IDENTITY is by executable path under the canonical
//    runtime root (and the canonical Dashboard command line). A process named
//    like an isolated Workline-A runtime (e.g. .tmp-single-agent-mem-v1) can
//    never appear in canonical metrics.
//  - Sampler failure never throws into the request path: the last known good
//    snapshot is retained and labelled STALE/ERROR with an age.
//  - Freshness of live character state is NOT recomputed here. This module only
//    derives a presentation mapping (LIVE/STALE/OFFLINE) from the existing
//    authoritative persistent_agent_live_status timestamp.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const LIVE_STATUS_MAX_AGE_MS = 15_000;
export const SNAPSHOT_FRESH = 'FRESH';
export const SNAPSHOT_STALE = 'STALE';
export const SNAPSHOT_ERROR = 'ERROR';
const HEALTH = Object.freeze({ HEALTHY: 'HEALTHY', DEGRADED: 'DEGRADED', DOWN: 'DOWN', UNKNOWN: 'UNKNOWN' });

// One bounded OS collection per tick. Returns every process with the fields we
// need; the Node side applies the canonical identity rule.
const PROCESS_COLLECT_SCRIPT = `
$ErrorActionPreference='SilentlyContinue'
$os = Get-CimInstance Win32_OperatingSystem
$osCpu = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" | Select-Object -First 1
$perf = @{}
foreach ($row in (Get-CimInstance Win32_PerfFormattedData_PerfProc_Process)) {
  if ($row.IDProcess -gt 0) { $perf[[int]$row.IDProcess] = $row }
}
$out = @()
foreach ($p in (Get-CimInstance Win32_Process)) {
  $pf = $perf[[int]$p.ProcessId]
  $out += [pscustomobject]@{
    pid = [int]$p.ProcessId
    name = [string]$p.Name
    executablePath = [string]$p.ExecutablePath
    commandLine = [string]$p.CommandLine
    creationDate = [string]$p.CreationDate
    threadCount = [int]$p.ThreadCount
    handleCount = [int]$p.HandleCount
    workingSetBytes = [int64]$p.WorkingSetSize
    privateBytes = if ($p.PrivatePageCount) { [int64]$p.PrivatePageCount } else { 0 }
    virtualBytes = [int64]$p.VirtualSize
    cpuPercent = if ($pf) { [double]$pf.PercentProcessorTime } else { 0 }
    workingSetPrivateBytes = if ($pf) { [int64]$pf.WorkingSetPrivate } else { 0 }
  }
}
[pscustomobject]@{
  sampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  hostCpuPercent = if ($osCpu) { [double]$osCpu.PercentProcessorTime } else { 0 }
  memory = [pscustomobject]@{
    totalBytes = [int64]$os.TotalVisibleMemorySize * 1024
    availableBytes = [int64]$os.FreePhysicalMemory * 1024
  }
  logicalProcessors = [int]$os.NumberOfLogicalProcessors
  processes = $out
} | ConvertTo-Json -Depth 5 -Compress
`;

function tcpCheck(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export function createOpsControlPlane({
  root,
  canonicalRathenaRoot,
  canonicalPorts,
  databasePort,
  statePath,
  dashboardPort,
  sql,
  intervalMs = 5_000,
  clock = () => Date.now(),
}) {
  const logPrefix = '[ops-control-plane]';
  const canonicalExe = new Map(); // lowercase exe path -> server name
  for (const [name, file] of [
    ['login', 'login-server.exe'],
    ['char', 'char-server.exe'],
    ['map', 'map-server.exe'],
  ]) {
    canonicalExe.set(join(canonicalRathenaRoot, file).toLowerCase(), name);
  }

  let sample = null; // { sampledAt, host, processes: {login,char,map,mysqld,dashboard} }
  let sampleStatus = SNAPSHOT_ERROR;
  let sampleError = 'not_sampled_yet';
  let lastTickAt = 0;
  let tickCount = 0;
  let timer = null;
  const webChecks = new Map(); // name -> record
  let readModel = { readModelAgeMs: null, liveState: 'OFFLINE' };

  async function trackedCanonicalPids() {
    try {
      const raw = await readFile(statePath, 'utf8');
      const parsed = JSON.parse(raw);
      const set = new Set();
      for (const entry of parsed.processes ?? []) {
        if (typeof entry?.path === 'string' && entry.path.toLowerCase().startsWith(canonicalRathenaRoot.toLowerCase())) {
          set.add(Number(entry.id));
        }
      }
      return set;
    } catch {
      return new Set();
    }
  }

  function classify(proc, trackedPids) {
    const exe = String(proc.executablePath ?? '').toLowerCase();
    const name = canonicalExe.get(exe);
    if (name && trackedPids.has(Number(proc.pid))) return name;
    if (name) return name; // canonical path is authoritative even if state is absent
    if (exe.endsWith('mysqld.exe') && exe.includes('mariadb')) return 'mysqld';
    if (
      String(proc.name ?? '').toLowerCase() === 'node.exe' &&
      String(proc.commandLine ?? '').includes(`ops\\ro-stack\\dashboard.mjs`)
    ) {
      return 'dashboard';
    }
    return null;
  }

  async function collectPlatformSample() {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PROCESS_COLLECT_SCRIPT],
      { windowsHide: true, timeout: 20_000, maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = JSON.parse(String(stdout ?? '').trim() || '{}');
    const trackedPids = await trackedCanonicalPids();
    const byRole = {};
    for (const proc of parsed.processes ?? []) {
      const role = classify(proc, trackedPids);
      if (!role) continue;
      // Prefer the tracked/exact instance when duplicates exist.
      if (byRole[role] && trackedPids.has(Number(byRole[role].pid)) && !trackedPids.has(Number(proc.pid))) continue;
      byRole[role] = {
        role,
        pid: Number(proc.pid),
        name: proc.name,
        executablePath: proc.executablePath,
        uptimeMs: proc.creationDate ? Math.max(0, clock() - Date.parse(proc.creationDate)) : null,
        cpuPercent: Number(proc.cpuPercent ?? 0),
        workingSetBytes: Number(proc.workingSetBytes ?? 0),
        workingSetPrivateBytes: Number(proc.workingSetPrivateBytes ?? 0),
        privateBytes: Number(proc.privateBytes ?? 0),
        virtualBytes: Number(proc.virtualBytes ?? 0),
        threadCount: Number(proc.threadCount ?? 0),
        handleCount: Number(proc.handleCount ?? 0),
      };
    }
    const totalBytes = Number(parsed.memory?.totalBytes ?? 0);
    const availableBytes = Number(parsed.memory?.availableBytes ?? 0);
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const cpuPercent = Number((Number(parsed.hostCpuPercent ?? 0) || 0).toFixed(1));
    return {
      sampledAt: clock(),
      host: {
        cpuPercent,
        logicalProcessors: Number(parsed.logicalProcessors ?? 0),
        memory: {
          totalBytes,
          usedBytes,
          availableBytes,
          usedPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        },
      },
      processes: {
        login: byRole.login ?? null,
        char: byRole.char ?? null,
        map: byRole.map ?? null,
        mysqld: byRole.mysqld ?? null,
        dashboard: byRole.dashboard ?? null,
      },
    };
  }

  function processHealth(proc) {
    return proc ? HEALTH.HEALTHY : HEALTH.DOWN;
  }

  async function queryReadModelFreshness() {
    try {
      const out = await sql(
        'SELECT ROUND(TIMESTAMPDIFF(MICROSECOND,MAX(updated_at),CURRENT_TIMESTAMP(3))/1000) FROM persistent_agent_live_status;',
      );
      const ageMs = Number(String(out).trim());
      if (!Number.isFinite(ageMs)) return { readModelAgeMs: null, liveState: 'OFFLINE' };
      // Presentation mapping only; the timestamp + LIVE_STATUS_MAX_AGE_MS are the
      // existing authoritative semantics (persistent-agent/web-canary.mjs).
      const liveState = ageMs <= LIVE_STATUS_MAX_AGE_MS ? 'LIVE' : 'STALE';
      return { readModelAgeMs: Math.max(0, ageMs), liveState };
    } catch {
      return { readModelAgeMs: null, liveState: 'OFFLINE' };
    }
  }

  async function buildConnectivity() {
    const [dbApp, loginNet, charNet, mapNet, dashboardNet] = await Promise.all([
      sql('SELECT 1;').then(() => true).catch(() => false),
      tcpCheck(canonicalPorts.login),
      tcpCheck(canonicalPorts.character),
      tcpCheck(canonicalPorts.map),
      tcpCheck(dashboardPort),
    ]);
    const procs = sample?.processes ?? {};
    const tracked = sample?.trackedProcesses === true;
    const appHealth = (proc, net) => {
      if (!proc && !net) return HEALTH.DOWN;
      if (proc && net && tracked) return HEALTH.HEALTHY;
      if (proc || net) return HEALTH.DEGRADED;
      return HEALTH.UNKNOWN;
    };
    const pa = await queryReadModelFreshness();
    const paApp = pa.liveState === 'OFFLINE' ? HEALTH.DOWN : pa.liveState === 'LIVE' ? HEALTH.HEALTHY : HEALTH.DEGRADED;
    return [
      { component: 'DATABASE', processHealth: processHealth(procs.mysqld), networkHealth: dbApp ? HEALTH.HEALTHY : HEALTH.DOWN, applicationHealth: dbApp ? HEALTH.HEALTHY : HEALTH.DOWN },
      { component: 'LOGIN', processHealth: processHealth(procs.login), networkHealth: loginNet ? HEALTH.HEALTHY : HEALTH.DOWN, applicationHealth: appHealth(procs.login, loginNet) },
      { component: 'CHAR', processHealth: processHealth(procs.char), networkHealth: charNet ? HEALTH.HEALTHY : HEALTH.DOWN, applicationHealth: appHealth(procs.char, charNet) },
      { component: 'MAP', processHealth: processHealth(procs.map), networkHealth: mapNet ? HEALTH.HEALTHY : HEALTH.DOWN, applicationHealth: appHealth(procs.map, mapNet) },
      { component: 'PERSISTENT_AGENT', processHealth: processHealth(procs.map), networkHealth: mapNet ? HEALTH.HEALTHY : HEALTH.DOWN, applicationHealth: paApp },
      { component: 'DASHBOARD', processHealth: processHealth(procs.dashboard), networkHealth: dashboardNet ? HEALTH.HEALTHY : HEALTH.DOWN, applicationHealth: dashboardNet ? HEALTH.HEALTHY : HEALTH.DEGRADED },
    ];
  }

  const SYNTHETIC_CHECKS = [
    { name: 'dashboard_home', path: '/', accept: [200] },
    { name: 'character_api', path: '/api/session', accept: [200, 401] },
    { name: 'world_map_api', path: '/api/probe', accept: [200] },
    { name: 'server_admin_api', path: '/api/admin/server/status', accept: [200, 401, 403] },
    { name: 'read_model_api', path: '/api/internal/health', accept: [200] },
  ];

  async function runWebChecks() {
    for (const check of SYNTHETIC_CHECKS) {
      const started = clock();
      const record = webChecks.get(check.name) ?? {
        name: check.name,
        path: check.path,
        status: 'UNKNOWN',
        httpStatus: null,
        latencyMs: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        lastError: null,
      };
      try {
        const response = await fetch(`http://127.0.0.1:${dashboardPort}${check.path}`, { redirect: 'manual' });
        record.httpStatus = response.status;
        record.latencyMs = Math.max(0, clock() - started);
        if (check.accept.includes(response.status)) {
          record.status = 'HEALTHY';
          record.lastSuccessAt = clock();
          record.consecutiveFailures = 0;
          record.lastError = null;
        } else {
          record.status = 'DEGRADED';
          record.lastFailureAt = clock();
          record.consecutiveFailures += 1;
          record.lastError = `HTTP ${response.status}`;
        }
      } catch (error) {
        record.status = 'DOWN';
        record.latencyMs = Math.max(0, clock() - started);
        record.lastFailureAt = clock();
        record.consecutiveFailures += 1;
        record.lastError = String(error?.message ?? error);
      }
      webChecks.set(check.name, record);
    }
  }

  async function tick() {
    try {
      const next = await collectPlatformSample();
      next.trackedProcesses = (await trackedCanonicalPids()).size === 3;
      sample = next;
      sampleStatus = SNAPSHOT_FRESH;
      sampleError = null;
      lastTickAt = clock();
    } catch (error) {
      sampleStatus = sample ? SNAPSHOT_STALE : SNAPSHOT_ERROR;
      sampleError = String(error?.message ?? error);
    }
    try {
      readModel = await queryReadModelFreshness();
    } catch {}
    try {
      await runWebChecks();
    } catch {}
  }

  function start() {
    if (timer) return;
    tickCount += 1;
    tick().catch(() => {});
    timer = setInterval(() => {
      tickCount += 1;
      tick().catch((error) => console.warn(`${logPrefix} tick failed: ${error?.message ?? error}`));
    }, Math.max(2_000, intervalMs));
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function snapshotAgeMs() {
    return sample ? Math.max(0, clock() - Number(sample.sampledAt)) : null;
  }

  function refreshIfStale(maxAgeMs = intervalMs * 3) {
    const age = snapshotAgeMs();
    if (age === null || age > maxAgeMs) tick().catch(() => {});
  }

  async function buildStatus() {
    refreshIfStale();
    const connectivity = await buildConnectivity();
    const anyDown = connectivity.some((c) => c.applicationHealth === HEALTH.DOWN);
    const anyDegraded = connectivity.some((c) => c.applicationHealth === HEALTH.DEGRADED);
    const overallHealth = anyDown ? 'DEGRADED' : anyDegraded ? 'DEGRADED' : 'HEALTHY';
    return {
      overallHealth,
      hostMetrics: sample?.host ?? null,
      processes: sample?.processes ?? null,
      connectivity,
      webExperience: {
        checks: [...webChecks.values()],
        readModel,
      },
      snapshotStatus: sampleStatus,
      snapshotError: sampleError,
      sampledAt: sample?.sampledAt ?? null,
      ageMs: snapshotAgeMs(),
      tickCount,
    };
  }

  return {
    start,
    stop,
    buildStatus,
    getSnapshot: () => sample,
    getSnapshotStatus: () => ({ status: sampleStatus, error: sampleError, ageMs: snapshotAgeMs() }),
    getWebExperience: () => ({ checks: [...webChecks.values()], readModel }),
    constants: { HEALTH, LIVE_STATUS_MAX_AGE_MS },
  };
}
