import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createDashboardDatabase } from '../ops/ro-stack/dashboard-db.mjs';

const execFileAsync = promisify(execFile);
const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const mode = process.env.RO_DB_MEASURE_MODE ?? 'cli';
const sampleCount = Number(process.env.RO_DB_MEASURE_SAMPLES ?? 15);
const charId = Number(process.env.RO_DB_MEASURE_CHAR_ID ?? 150094);
const fixturePath =
  process.env.RO_DB_MEASURE_FIXTURE ??
  '.local/ro-stack/quest-runtime-thief-fixture.json';

if (!['cli', 'pool'].includes(mode)) throw new Error(`unsupported mode: ${mode}`);
if (!Number.isInteger(sampleCount) || sampleCount < 5 || sampleCount > 50)
  throw new Error('sample count must be between 5 and 50');

const secrets = JSON.parse(
  await readFile('.local/ro-stack/secrets.json', 'utf8'),
);
const database = {
  host: process.env.RO_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.RO_DB_PORT ?? 3307),
  user: process.env.RO_DB_USER ?? 'rathena_local',
  password: process.env.RO_DB_PASSWORD ?? secrets.databasePassword,
  database: process.env.RO_DB_NAME ?? 'ragnarok',
};

const queries = [
  ['DB_SIMPLE_SELECT', 'SELECT 1;'],
  [
    'ACCOUNT_AUTH_DB',
    "SELECT account_id,userid,sex FROM login WHERE userid='gate2_01' LIMIT 1;",
  ],
  [
    'SESSION_CORE',
    "SELECT account_id,token_hash,expires_at FROM web_sessions WHERE token_hash=REPEAT('0',64) LIMIT 1;",
  ],
  [
    'EQUIPMENT',
    `SELECT nameid,equip,amount,refine FROM inventory WHERE char_id=${charId} AND equip<>0 ORDER BY equip,nameid;`,
  ],
  [
    'PA_LIVE_STATUS',
    `SELECT * FROM persistent_agent_live_status WHERE char_id=${charId} LIMIT 1;`,
  ],
];

async function mariadbPath() {
  const entries = await readdir('C:\\Program Files');
  const folder = entries
    .filter((name) => name.startsWith('MariaDB '))
    .sort()
    .reverse()[0];
  if (!folder) throw new Error('MariaDB client unavailable');
  return join('C:\\Program Files', folder, 'bin', 'mariadb.exe');
}

const maria = mode === 'cli' ? await mariadbPath() : null;
const pool =
  mode === 'pool'
    ? createDashboardDatabase({ ...database })
    : null;

async function runSql(statement) {
  if (pool) return pool.queryText(statement);
  const result = await execFileAsync(
    maria,
    [
      '--batch',
      '--raw',
      '--skip-column-names',
      '--silent',
      '--connect-timeout=3',
      `--host=${database.host}`,
      `--port=${database.port}`,
      `--user=${database.user}`,
      `--database=${database.database}`,
      `--execute=${statement}`,
    ],
    {
      env: { ...process.env, MYSQL_PWD: database.password },
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8',
    },
  );
  return result.stdout;
}

function summary(values) {
  const sorted = [...values].sort((a, b) => a.durationMs - b.durationMs);
  const pick = (ratio) => sorted[Math.ceil(sorted.length * ratio) - 1];
  return {
    samples: sorted.length,
    p50Ms: Number(pick(0.5).durationMs.toFixed(1)),
    p95Ms: Number(pick(0.95).durationMs.toFixed(1)),
    maxMs: Number(sorted.at(-1).durationMs.toFixed(1)),
    medianBytes: pick(0.5).bytes,
  };
}

const sqlResults = {};
for (const [name, statement] of queries) {
  await runSql(statement);
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const started = performance.now();
    const output = await runSql(statement);
    samples.push({
      durationMs: performance.now() - started,
      bytes: Buffer.byteLength(output),
    });
  }
  sqlResults[name] = summary(samples);
}

async function responseMetric(path, cookie = '') {
  const samples = [];
  let lastBody = null;
  for (let index = 0; index < sampleCount; index += 1) {
    const started = performance.now();
    const response = await fetch(`${origin}${path}`, {
      headers: cookie ? { cookie } : undefined,
    });
    const body = await response.arrayBuffer();
    samples.push({
      durationMs: performance.now() - started,
      bytes: body.byteLength,
      status: response.status,
    });
    lastBody = JSON.parse(Buffer.from(body).toString('utf8'));
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  }
  return { ...summary(samples), status: samples.at(-1).status, lastBody };
}

const health = await responseMetric('/api/health');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const loginResponse = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: fixture.username,
    password: fixture.password,
    sex: 'M',
  }),
});
if (!loginResponse.ok) throw new Error(`fixture login failed: ${loginResponse.status}`);
const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0] ?? '';
if (!cookie) throw new Error('fixture login did not return a session cookie');
const session = await responseMetric('/api/session?view=entry', cookie);
const internalHealthResponse = await fetch(`${origin}/api/internal/health`);
const internalHealth = internalHealthResponse.ok
  ? await internalHealthResponse.json()
  : null;

await fetch(`${origin}/api/account`, { method: 'DELETE', headers: { cookie } });
await pool?.close();

console.log(
  JSON.stringify(
    {
      mode,
      sampleCount,
      origin,
      sql: sqlResults,
      http: {
        health: {
          status: health.status,
          p50Ms: health.p50Ms,
          p95Ms: health.p95Ms,
          maxMs: health.maxMs,
          medianBytes: health.medianBytes,
        },
        sessionEntry: {
          status: session.status,
          p50Ms: session.p50Ms,
          p95Ms: session.p95Ms,
          maxMs: session.maxMs,
          medianBytes: session.medianBytes,
          accountPresent: Boolean(session.lastBody?.account),
          equipmentFieldPresent: Object.hasOwn(session.lastBody ?? {}, 'equipment'),
        },
        internalHealth: internalHealth
          ? {
              status: internalHealthResponse.status,
              eventLoopLag: internalHealth.runtime?.eventLoopLag ?? null,
              database: internalHealth.runtime?.database ?? null,
              pool: internalHealth.runtime?.database?.pool ?? null,
            }
          : null,
      },
    },
    null,
    2,
  ),
);
