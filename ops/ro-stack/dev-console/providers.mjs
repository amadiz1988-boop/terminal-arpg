import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

export const PRODUCTION_ROOT = 'C:\\Users\\Administrator\\ghost-island-production\\ro-stack';
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fail = (code, detail = '') => { const error = new Error(detail || code); error.code = code; throw error; };
const runtime = root => path.join(root, '.local', 'ro-stack');
const inside = (root, candidate) => {
  const full = path.resolve(root, candidate);
  if (full !== path.resolve(root) && !full.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep))
    fail('NOT_AUTHORIZED', 'path_outside_runtime');
  let cursor = path.parse(full).root;
  for (const part of full.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('NOT_AUTHORIZED', 'reparse_path');
  }
  return full;
};
const readJson = file => {
  if (!fs.existsSync(file)) fail('NOT_FOUND', path.basename(file));
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch { fail('UNKNOWN', `invalid_json:${path.basename(file)}`); }
};
const readOptional = file => fs.existsSync(file) ? readJson(file) : null;
const safeId = raw => {
  if (!/^[1-9][0-9]{0,9}$/.test(String(raw ?? ''))) fail('NOT_ELIGIBLE', 'invalid_char_id');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > 4294967295) fail('NOT_ELIGIBLE', 'invalid_char_id');
  return value;
};

export function portOpen(port, timeout = 1200) {
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export async function runtimeHealth({ root = PRODUCTION_ROOT, fetchImpl = fetch } = {}) {
  const ports = { database: 3307, login: 6901, char: 6122, map: 5122, dashboard: 8788 };
  const listeners = Object.fromEntries(await Promise.all(Object.entries(ports).map(async ([name, port]) => [name, await portOpen(port)])));
  const game = readOptional(path.join(runtime(root), 'state.json'));
  const dashboard = readOptional(path.join(runtime(root), 'dashboard', 'state.json'));
  let api = null;
  if (listeners.dashboard) {
    try {
      const response = await fetchImpl('http://127.0.0.1:8788/api/internal/health', {
        redirect: 'error', signal: AbortSignal.timeout(3000), headers: { accept: 'application/json' },
      });
      if (response.ok) {
        const body = await response.json();
        api = { services: body.services, pid: body.runtime?.pid, database: body.runtime?.database?.errors };
      }
    } catch { /* reported through null */ }
  }
  const healthy = Object.values(listeners).every(Boolean) &&
    api?.services?.database && api?.services?.login && api?.services?.character && api?.services?.map;
  return { listeners, api, trackedProcesses: (game?.processes ?? []).map(row => ({
    name: row.name, pid: row.id, path: row.path,
  })), dashboardPid: dashboard?.pid ?? null, runtimeStartedAt: game?.startedAt ?? null,
  healthy: Boolean(healthy), source: 'canonical runtime state + loopback listeners + Dashboard internal health' };
}

export function runtimeProcesses({ root = PRODUCTION_ROOT } = {}) {
  const game = readJson(path.join(runtime(root), 'state.json'));
  const dashboard = readOptional(path.join(runtime(root), 'dashboard', 'state.json'));
  return { startedAt: game.startedAt, processes: (game.processes ?? []).map(row => ({
    name: row.name, pid: row.id, path: row.path,
  })), dashboard: dashboard && { pid: dashboard.pid, startedAt: dashboard.startedAt },
    source: 'canonical tracked runtime state; live process identity requires runtime health' };
}

export function runtimeIdentity({ root = PRODUCTION_ROOT } = {}) {
  const tracked = runtimeProcesses({ root }).processes;
  const ids = tracked.map(row => Number(row.pid));
  if (ids.length !== 3 || ids.some(id => !Number.isSafeInteger(id) || id <= 0))
    fail('STALE', 'tracked_native_processes_incomplete');
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'read-process-identity.ps1');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', script, '-IdsCsv', ids.join(',')], { encoding: 'utf8', windowsHide: true,
    timeout: 7000, maxBuffer: 65536 });
  if (result.error || result.status !== 0) fail('AUTHORITY_UNAVAILABLE', 'windows_process_query_failed');
  let observed;
  try { observed = JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim()); }
  catch { fail('UNKNOWN', 'windows_process_result_invalid'); }
  const rows = Array.isArray(observed) ? observed : [observed];
  const identities = tracked.map(row => {
    const live = rows.find(item => item.pid === row.pid);
    return { service: row.name, pid: row.pid, trackedPath: row.path,
      livePath: live?.path ?? null, startedAt: live?.startedAt ?? null,
      matched: Boolean(live?.path && live.path.toLowerCase() === String(row.path).toLowerCase()) };
  });
  return { identities, allMatched: identities.every(row => row.matched),
    source: 'canonical tracked runtime state + Windows CIM live executable path' };
}

export function deploymentState({ root = PRODUCTION_ROOT } = {}) {
  const dir = runtime(root);
  const state = readJson(path.join(dir, 'production-deployment-state.json'));
  const lease = readOptional(path.join(dir, 'production-deployment-lease', 'lease.json'));
  const pending = readOptional(path.join(dir, 'first-github-first-promotion.pending.json'));
  return { webGitSha: state.current_web_git_sha ?? null,
    nativeGitSha: state.current_native_git_sha ?? null, deployId: state.current_deploy_id ?? null,
    drift: state.production_drift ?? 'UNRESOLVED', receipt: state.last_deploy_receipt ?? null,
    lease: lease && { id: lease.lease_id, status: lease.status, owner: lease.owner_task_id,
      webGitSha: lease.web_deploy_git_sha, nativeGitSha: lease.native_deploy_git_sha,
      promotionMode: lease.promotion_mode },
    pending: pending && { deployId: pending.deploy_id ?? null, phase: pending.phase ?? null },
    source: 'Production deployment state and lease; candidate SHA is not deployed SHA' };
}

export function deploymentReceipt({ root = PRODUCTION_ROOT } = {}) {
  const dir = runtime(root);
  const state = readJson(path.join(dir, 'production-deployment-state.json'));
  if (!state.last_deploy_receipt) fail('NOT_FOUND', 'last_deploy_receipt_unresolved');
  const file = inside(root, path.join(root, state.last_deploy_receipt));
  const receipt = readJson(file);
  return { path: state.last_deploy_receipt, sha256: sha256(file),
    deployId: receipt.deploy_id, webGitSha: receipt.web_git_sha,
    nativeGitSha: receipt.native_git_sha, deployedAt: receipt.deployed_at,
    owner: receipt.owner_task_id, source: 'last deployment receipt named by Production state' };
}

export function procdumpState({ root = PRODUCTION_ROOT } = {}) {
  const file = path.join(runtime(root), 'procdump-attachment-state.json');
  const state = readJson(file);
  return { runtimeGenerationId: state.runtimeGenerationId, mapPid: state.mapPid,
    attachedPid: state.procdumpAttachedPid, attachedAt: state.procdumpAttachedAt,
    status: state.procdumpAttachStatus, error: state.procdumpAttachError,
    source: file };
}

export function latestIncident({ root = PRODUCTION_ROOT } = {}) {
  const dir = path.join(runtime(root), 'runtime-incidents');
  if (!fs.existsSync(dir)) fail('NOT_FOUND', 'runtime_incidents_missing');
  const candidates = fs.readdirSync(dir, { withFileTypes: true }).filter(item => item.isDirectory())
    .map(item => path.join(dir, item.name, 'incident.json'))
    .filter(file => fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!candidates.length) fail('NOT_FOUND', 'no_runtime_incident');
  const incident = readJson(candidates[0]);
  return { incidentId: incident.incidentId, firstExitAt: incident.firstExitAt,
    service: incident.firstExitService, exitCode: incident.firstExitCode,
    classification: incident.exitClassification, runtimeGenerationId: incident.runtimeGenerationId,
    crashDumpCreated: incident.crashDump?.created ?? null,
    bundle: path.dirname(candidates[0]), source: candidates[0] };
}

export function configDiff({ root = PRODUCTION_ROOT, sourceRoot } = {}) {
  const canonical = path.join(sourceRoot, 'ops', 'ro-stack', 'stack.config.psd1');
  const deployed = path.join(root, 'ops', 'ro-stack', 'stack.config.psd1');
  if (!fs.existsSync(canonical) || !fs.existsSync(deployed)) fail('NOT_FOUND', 'stack_config_missing');
  const extract = file => {
    const text = fs.readFileSync(file, 'utf8');
    const values = {};
    for (const key of ['PersistentAgentSpThresholdPercent', 'PersistentAgentSpSafePercent']) {
      const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n#]+)`, 'm'));
      values[key] = match?.[1].trim() ?? null;
    }
    return values;
  };
  return { canonicalSha256: sha256(canonical), deployedSha256: sha256(deployed),
    sameBytes: sha256(canonical) === sha256(deployed), canonical: extract(canonical),
    deployed: extract(deployed), effectiveRuntime: 'UNRESOLVED',
    source: 'source and Production config files; effective process values require separate attestation' };
}

const adminRoster = async ({ env = process.env, fetchImpl = fetch } = {}) => {
  const token = String(env.RO_LOCAL_ADMIN_TOKEN ?? '');
  if (!token) fail('NOT_AUTHORIZED', 'RO_LOCAL_ADMIN_TOKEN_required');
  const response = await fetchImpl('http://127.0.0.1:8788/api/admin/characters', {
    redirect: 'error', signal: AbortSignal.timeout(5000),
    headers: { accept: 'application/json', 'x-ro-local-admin-token': token },
  });
  if (response.status === 403 || response.status === 401) fail('NOT_AUTHORIZED', 'Admin rejected local token');
  if (!response.ok) fail('AUTHORITY_UNAVAILABLE', `Admin_HTTP_${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.characters)) fail('UNKNOWN', 'invalid_admin_roster');
  return data.characters;
};

export async function playerInspect(id, options = {}) {
  const charId = safeId(id);
  const rows = await adminRoster(options);
  const found = rows.find(row => row.charId === charId);
  if (!found) fail(rows.length >= 200 ? 'UNKNOWN' : 'NOT_FOUND', rows.length >= 200 ? 'roster_limit_200' : 'char_not_found');
  return { ...found, source: 'authenticated Dashboard Admin roster; projection freshness is included' };
}

export async function playerFleet(options = {}) {
  const rows = await adminRoster(options);
  return { count: rows.length, complete: rows.length < 200,
    counts: rows.reduce((all, row) => { const key = row.ownershipState || 'UNKNOWN'; all[key] = (all[key] ?? 0) + 1; return all; }, {}),
    characters: rows.map(row => ({ charId: row.charId, name: row.name,
      owner: row.controlOwner, ownershipState: row.ownershipState,
      runtimeState: row.runtimeState, resident: row.resident, freshness: row.freshness })),
    source: 'authenticated Dashboard Admin roster, capped at 200' };
}

export async function playerQuarantine(options = {}) {
  const fleet = await playerFleet(options);
  return { count: fleet.characters.filter(row => row.ownershipState === 'QUARANTINED' || row.runtimeState === 'QUARANTINED').length,
    complete: fleet.complete,
    characters: fleet.characters.filter(row => row.ownershipState === 'QUARANTINED' || row.runtimeState === 'QUARANTINED'),
    source: fleet.source };
}

function mariadbClient() {
  const base = 'C:\\Program Files';
  const names = fs.readdirSync(base).filter(name => /^MariaDB [0-9]/.test(name)).sort().reverse();
  const file = names.map(name => path.join(base, name, 'bin', 'mariadb.exe')).find(fs.existsSync);
  if (!file) fail('TOOLING_MISSING', 'mariadb_client_missing');
  return file;
}

export function parseLiveInventoryRow(row) {
  const numeric = value => /^\d+$/.test(value ?? '') ? Number(value) : null;
  return { charId: numeric(row[0]), accountId: numeric(row[1]), revision: numeric(row[2]),
    resident: row[3] === '1', map: row[4], ageMs: numeric(row[5]),
    inventorySlots: numeric(row[6]), inventoryMaxSlots: numeric(row[7]),
    weight: numeric(row[8]), maxWeight: numeric(row[9]),
    supplyRequired: row[10] === '1' ? true : row[10] === '0' ? false : null,
    supplyReason: row[11] || null };
}

export function fixedDbRead(kind, id, { root = PRODUCTION_ROOT, env = process.env } = {}) {
  const charId = safeId(id);
  const secrets = readJson(path.join(runtime(root), 'secrets.json'));
  if (!secrets.databasePassword) fail('AUTHORITY_UNAVAILABLE', 'db_secret_missing');
  const queries = {
    events: `SELECT event_id,UNIX_TIMESTAMP(occurred_at),event_type,COALESCE(map,''),COALESCE(source,'') FROM persistent_life_event WHERE char_id=${charId} ORDER BY occurred_at DESC,event_id DESC LIMIT 20`,
    commands: `SELECT command_id,action,command_status,COALESCE(reason_code,''),UNIX_TIMESTAMP(requested_at) FROM persistent_agent_command WHERE char_id=${charId} ORDER BY requested_at DESC LIMIT 20`,
    liveInventory: `SELECT char_id,account_id,revision,resident,COALESCE(map,''),ROUND(TIMESTAMPDIFF(MICROSECOND,updated_at,CURRENT_TIMESTAMP(3))/1000),inventory_slots,inventory_max_slots,weight,max_weight,supply_required,COALESCE(supply_reason,'') FROM persistent_agent_live_status WHERE char_id=${charId} LIMIT 1`,
  };
  if (!queries[kind]) fail('NOT_ELIGIBLE', 'unsupported_db_read');
  const executable = mariadbClient();
  const result = spawnSync(executable, ['--ssl=OFF', '--protocol=tcp', '-h', '127.0.0.1', '-P', '3307',
    '-u', 'rathena_local', '-D', 'ragnarok', '--batch', '--raw', '--skip-column-names', '-e', queries[kind]],
  { encoding: 'utf8', timeout: 5000, windowsHide: true, maxBuffer: 262144,
    env: { ...env, MYSQL_PWD: secrets.databasePassword } });
  if (result.error || result.status !== 0) fail('AUTHORITY_UNAVAILABLE', 'bounded_read_only_query_failed');
  const records = result.stdout.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const row = line.split('\t');
    if (kind === 'liveInventory') return parseLiveInventoryRow(row);
    return kind === 'events'
      ? { eventId: row[0], occurredAtUnix: Number(row[1]), type: row[2], map: row[3], source: row[4] }
      : { commandId: row[0], action: row[1], status: row[2], reasonCode: row[3], requestedAtUnix: Number(row[4]) };
  });
  return { charId, records, limit: kind === 'liveInventory' ? 1 : 20,
  source: kind === 'events' ? 'Event Ledger read-only bounded query'
    : kind === 'liveInventory' ? 'Native live-status read-only bounded query'
      : 'Native command ledger read-only bounded query' };
}

export function runtimeLogs(service, { root = PRODUCTION_ROOT, charId = null } = {}) {
  if (!['login', 'char', 'map', 'dashboard'].includes(service)) fail('NOT_ELIGIBLE', 'invalid_service');
  if (charId != null) safeId(charId);
  const stateFile = service === 'dashboard' ? path.join(runtime(root), 'dashboard', 'state.json') : path.join(runtime(root), 'state.json');
  const state = readJson(stateFile);
  const entry = service === 'dashboard' ? state : state.processes?.find(row => row.name === service);
  if (!entry) fail('NOT_FOUND', 'tracked_service_missing');
  const files = [entry.stdout, entry.stderr].filter(Boolean).map(file => inside(root, file));
  const lines = files.filter(fs.existsSync).flatMap(file => {
    const size = fs.statSync(file).size;
    const bytes = Math.min(size, 131072);
    const descriptor = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(bytes);
    try { fs.readSync(descriptor, buffer, 0, bytes, size - bytes); }
    finally { fs.closeSync(descriptor); }
    return buffer.toString('utf8').split(/\r?\n/).slice(-500)
      .filter(line => charId == null || line.includes(String(charId)))
      .map(line => /password|token|secret|authorization|cookie/i.test(line) ? '[REDACTED_SENSITIVE_LOG_LINE]' : line)
      .slice(-80);
  });
  return { service, charId, lines: lines.slice(-80), source: files, window: 'last 500 lines per tracked log' };
}
