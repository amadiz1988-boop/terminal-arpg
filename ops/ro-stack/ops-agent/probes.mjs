import { execFile } from 'node:child_process';
import { access, open, readFile, readdir } from 'node:fs/promises';
import net from 'node:net';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { EvidenceStatus, ReasonCode } from './contracts.mjs';

const execFileAsync = promisify(execFile);

function checkedAt(now) {
  return new Date(now()).toISOString();
}

export function evidence(type, status, reasonCode, summary, now = Date.now) {
  return {
    type,
    status,
    checkedAt: checkedAt(now),
    reasonCode,
    summary,
  };
}

export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function withTimeout(callback, timeoutMs, label = 'check') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    return await callback(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`${label} timed out`);
      timeoutError.code = 'CHECK_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeTcp(port, { host = '127.0.0.1', timeoutMs = 1500 } = {}) {
  return await new Promise((resolvePromise) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true }));
    socket.once('timeout', () => finish({ ok: false, timeout: true }));
    socket.once('error', () => finish({ ok: false }));
  });
}

export async function probeHttp(url, { timeoutMs = 2500, fetchImpl = fetch } = {}) {
  try {
    const response = await withTimeout(
      (signal) => fetchImpl(url, { signal, redirect: 'error' }),
      timeoutMs,
      'HTTP check',
    );
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, timeout: error?.code === 'CHECK_TIMEOUT' };
  }
}

function normalizePath(path) {
  return path ? resolve(path).toLowerCase() : null;
}

export async function probeProcess(
  tracked,
  { timeoutMs = 1500, platform = process.platform } = {},
) {
  const pid = Number(tracked?.pid ?? tracked?.id);
  if (!Number.isInteger(pid) || pid < 1) return { state: 'missing' };
  if (platform !== 'win32') {
    try {
      process.kill(pid, 0);
      return { state: 'running', pid, startedAt: null };
    } catch {
      return { state: 'missing', pid };
    }
  }

  const command = [
    `$p=Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\" -ErrorAction SilentlyContinue`,
    'if(-not $p){exit 3}',
    '[pscustomobject]@{pid=[int]$p.ProcessId;name=[string]$p.Name;executablePath=[string]$p.ExecutablePath;created=[string]$p.CreationDate}|ConvertTo-Json -Compress',
  ].join(';');
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 64 * 1024 },
    );
    const details = JSON.parse(stdout.trim());
    const expectedPath = normalizePath(tracked.path);
    const actualPath = normalizePath(details.executablePath);
    const expectedName = tracked.expectedName?.toLowerCase();
    const actualName = details.name?.toLowerCase();
    if (
      (expectedPath && actualPath && expectedPath !== actualPath) ||
      (expectedName && actualName !== expectedName)
    ) {
      return { state: 'mismatch', pid, name: details.name };
    }
    return {
      state: 'running',
      pid,
      name: details.name,
      startedAt: details.created ? new Date(details.created).toISOString() : null,
    };
  } catch (error) {
    if (error?.code === 3) return { state: 'missing', pid };
    return { state: 'unknown', pid };
  }
}

export async function tailContains(path, marker, maximumBytes = 1024 * 1024) {
  if (!path) return false;
  let handle;
  try {
    handle = await open(path, 'r');
    const stat = await handle.stat();
    const length = Math.min(stat.size, maximumBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, stat.size - length));
    return buffer.toString('utf8').includes(marker);
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

async function findMariaDbClient() {
  if (process.platform !== 'win32') return null;
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  try {
    const folders = (await readdir(programFiles, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^MariaDB /i.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const folder of folders) {
      const candidate = join(programFiles, folder, 'bin', 'mariadb.exe');
      try {
        await access(candidate);
        return candidate;
      } catch {}
    }
  } catch {}
  return null;
}

export async function queryMariaDb(config, sql) {
  const secrets = await readJson(join(config.runtimeRoot, 'secrets.json'));
  const client = await findMariaDbClient();
  if (!secrets?.databasePassword || !client) {
    const error = new Error('MariaDB probe prerequisites unavailable');
    error.code = 'EVIDENCE_INSUFFICIENT';
    throw error;
  }
  const args = [
    '--ssl=OFF',
    '--protocol=tcp',
    '-h',
    '127.0.0.1',
    '-P',
    String(config.mariaDbPort),
    '-u',
    config.databaseUser,
    '-N',
    '-B',
    config.mainDatabase,
    '-e',
    sql,
  ];
  try {
    const { stdout } = await execFileAsync(client, args, {
      timeout: config.timeoutMs,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, MYSQL_PWD: String(secrets.databasePassword) },
    });
    return stdout.trim();
  } catch (error) {
    const wrapped = new Error('MariaDB read-only query failed');
    wrapped.code = error?.killed ? 'CHECK_TIMEOUT' : 'DATABASE_QUERY_FAILED';
    throw wrapped;
  }
}

export function reasonForProbe(result, fallback) {
  if (result?.timeout) return ReasonCode.CHECK_TIMEOUT;
  return fallback;
}

export function safeProcessSummary(result, expectedPath) {
  if (result.state === 'running') {
    return `PID ${result.pid}, ${result.name ?? basename(expectedPath ?? '')}`;
  }
  if (result.state === 'mismatch') return `PID ${result.pid} identity mismatch`;
  if (result.state === 'missing') return 'tracked process unavailable';
  return 'process evidence unavailable';
}

export function probeStatus(result) {
  if (result.state === 'running') return EvidenceStatus.PASS;
  if (result.state === 'unknown') return EvidenceStatus.UNKNOWN;
  return EvidenceStatus.FAIL;
}
