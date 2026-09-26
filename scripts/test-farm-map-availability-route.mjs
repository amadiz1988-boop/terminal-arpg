// Direct regression for GET /api/farm-map-availability.
// Boots dashboard.mjs in isolated-test mode on a random port with the database
// module replaced by an in-memory fake (module hooks), so no MariaDB, rAthena
// or Production state is touched.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dashboardPath = join(root, 'ops', 'ro-stack', 'dashboard.mjs');
const source = readFileSync(dashboardPath, 'utf8');

// Structural guard: the route must sit behind the same authenticated gate as
// every other player API, after the account is resolved.
const routeAt = source.indexOf("url.pathname === '/api/farm-map-availability'");
const declareAt = source.indexOf('const account = await resolveRequestAccount();');
const guardAt = source.indexOf("if (!account) return json(response, 401, { error: '請先登入' });");
assert.ok(routeAt > 0 && declareAt > 0 && guardAt > 0, 'route, account declaration and 401 guard exist');
assert.ok(declareAt < guardAt && guardAt < routeAt, 'farm-map availability runs after account resolution and the 401 guard');
assert.equal(source.split("url.pathname === '/api/farm-map-availability'").length - 1, 1, 'single route');

const TOKEN = 'farm-map-availability-route-test-token';
const ACCOUNT_ID = 2999001;
const CHAR_ID = 159001;
const work = mkdtempSync(join(tmpdir(), 'farm-map-route-'));
const fakeDb = join(work, 'fake-dashboard-db.mjs');
const hooks = join(work, 'hooks.mjs');
const sqlLog = join(work, 'sql.log');
writeFileSync(fakeDb, `
import { appendFileSync } from 'node:fs';
const TOKEN_HASH = ${JSON.stringify(createHash('sha256').update(TOKEN).digest('hex'))};
const row = (...values) => values.join('\\t');
export function formatMysqlResult() { return ''; }
export function isRetryableDatabaseError() { return false; }
export function createDashboardDatabase() {
  const pool = new Proxy({}, { get: () => async () => [[], []] });
  return {
    pool,
    close: async () => {},
    config: Object.freeze({ poolSize: 1 }),
    async queryText(statement) {
      appendFileSync(${JSON.stringify(sqlLog)}, statement.replace(/\\s+/g, ' ') + '\\n');
      if (/FROM web_sessions s JOIN login/.test(statement))
        return statement.includes(TOKEN_HASH)
          ? row(${ACCOUNT_ID}, 'farmroute', 'M', ${CHAR_ID}, 'FarmRoute', 0, 1, 1,
            Date.now() + 3_600_000, 'NULL', 4001, 50, 10,
            'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL')
          : '';
      if (/FROM .char. c LEFT JOIN char_reg_num/.test(statement))
        return statement.includes('c.char_id=${CHAR_ID} AND c.account_id=${ACCOUNT_ID}')
          ? row(50, 120000, 0, 'prontera', 156, 191) : '';
      return '';
    },
  };
}
`);
writeFileSync(hooks, `
import { registerHooks } from 'node:module';
const fake = ${JSON.stringify(pathToFileURL(fakeDb).href)};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './dashboard-db.mjs' && context.parentURL?.endsWith('/dashboard.mjs'))
      return { url: fake, shortCircuit: true };
    return next(specifier, context);
  },
});
`);

// dashboard.mjs reads a few private runtime files under .local/ro-stack at
// startup. A clean checkout has none; supply inert stand-ins only where a file
// is missing and remove them afterwards. Existing files are never touched.
const createdLocal = !existsSync(join(root, '.local'));
const standIns = [
  [['secrets.json'], JSON.stringify({ databasePassword: 'fake' })],
  [['openkore', 'tables', 'portals.txt'], ''],
];
const createdFiles = [];
for (const [parts, content] of standIns) {
  const path = join(root, '.local', 'ro-stack', ...parts);
  if (existsSync(path)) continue;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  createdFiles.push(path);
}

const port = await new Promise((resolve) => {
  const server = createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = server.address();
    server.close(() => resolve(free));
  });
});
const child = spawn(process.execPath, ['--import', pathToFileURL(hooks).href, dashboardPath], {
  cwd: root,
  env: {
    ...process.env,
    RO_DASHBOARD_PORT: String(port),
    RO_DASHBOARD_HOST: '127.0.0.1',
    RO_RUNTIME_MODE: 'isolated-test',
    RO_INSTANCE_ROOT: join(work, 'instances'),
    RO_DB_NAME: 'test_farm_map_route',
    RO_DB_PASSWORD: 'fake',
    RO_RATHENA_ROOT: process.env.RO_RATHENA_ROOT ??
      'C:/Users/Administrator/source/ghost-island-rathena',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });
const origin = `http://127.0.0.1:${port}`;

try {
  for (let attempt = 0; ; attempt += 1) {
    if (/listening on/.test(output)) break;
    if (child.exitCode !== null || attempt > 300)
      throw new Error(`dashboard did not start:\n${output.slice(-2000)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const get = async (path, cookie) => {
    const response = await fetch(origin + path, { headers: cookie ? { cookie } : {} });
    return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
  };
  const session = `ro_session=${TOKEN}`;

  // Unauthenticated and unknown sessions: the same 401 as every player API.
  const anonymous = await get('/api/farm-map-availability');
  assert.equal(anonymous.status, 401);
  assert.deepEqual(anonymous.body, { error: '請先登入' });
  assert.equal((await get('/api/config')).status, anonymous.status);
  const spoofed = await get(`/api/farm-map-availability?accountId=${ACCOUNT_ID}&characterId=${CHAR_ID}`);
  assert.equal(spoofed.status, 401, 'query identity cannot authenticate');
  const bogus = await get('/api/farm-map-availability', 'ro_session=not-a-session');
  assert.equal(bogus.status, 401);
  assert.equal((await get('/api/config', 'ro_session=not-a-session')).status, 401);

  // Authenticated player: normal availability payload.
  const ok = await get('/api/farm-map-availability?accountId=1&characterId=2', session);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Object.keys(ok.body).sort(),
    ['cooldownSeconds', 'maps', 'player', 'towns', 'worldMap']);
  assert.ok(Array.isArray(ok.body.maps) && ok.body.maps.length > 0,
    `farm maps listed: ${JSON.stringify({ player: ok.body.player,
      regions: ok.body.worldMap?.regions?.length, maps: ok.body.maps?.length })}`);
  assert.ok(Array.isArray(ok.body.towns));
  assert.ok(ok.body.maps.every((row) => row.kind === 'farm'));
  assert.ok(ok.body.towns.every((row) => row.kind === 'town'));
  const visibleIds = new Set(ok.body.worldMap.regions.flatMap((row) => row.mapIds));
  const farmIds = new Set(ok.body.maps.map((row) => row.map));
  const townIds = new Set(ok.body.towns.map((row) => row.map));
  assert.equal(ok.body.maps.length, 274);
  assert.equal(ok.body.towns.length, 27);
  assert.equal(visibleIds.size, 295);
  assert.equal(Object.keys(ok.body.worldMap.maps).length, 298);
  assert.ok(ok.body.maps.every((row) => visibleIds.has(row.map)));
  assert.ok(ok.body.towns.every((row) => ok.body.worldMap.maps[row.map] &&
    row.savedPoint?.x > 0 && row.savedPoint?.y > 0));
  for (const map of ['cmd_fild07', 'prt_fild05', 'glast_01']) {
    assert.ok(farmIds.has(map), map);
    assert.ok(townIds.has(map), map);
  }
  for (const map of ['aldeba_in', 'harboro1', 'lhz_in02']) {
    assert.ok(townIds.has(map), map);
    assert.equal(visibleIds.has(map), false);
  }
  assert.deepEqual(ok.body.towns.find((row) => row.map === 'prontera')?.savedPoint,
    { map: 'prontera', x: 116, y: 73 });
  assert.deepEqual(ok.body.towns.find((row) => row.map === 'morocc')?.savedPoint,
    { map: 'morocc', x: 156, y: 46 });
  for (const restored of ['geffen', 'alberta', 'yuno', 'einbroch', 'morocc'])
    assert.equal(visibleIds.has(restored), true, restored);
  assert.doesNotMatch(JSON.stringify(ok.body),
    /NO_AUTHORIZED_NORMAL_SPAWN_EVIDENCE|availabilityReason|unlockCondition|bossMonsters|resourceMonsters/);
  assert.equal(ok.body.player.baseLevel, 50);
  assert.equal(ok.body.player.zeny, 120000);
  assert.equal(ok.body.cooldownSeconds, 60);

  // Character lookup is bound to the session identity, never the query string.
  const statements = readFileSync(sqlLog, 'utf8').split('\n');
  const charQueries = statements.filter((line) => /FROM .char. c LEFT JOIN char_reg_num/.test(line));
  assert.ok(charQueries.length >= 1);
  assert.ok(charQueries.every((line) =>
    line.includes(`c.char_id=${CHAR_ID} AND c.account_id=${ACCOUNT_ID}`)));
  assert.doesNotMatch(output, /before initialization/);
  console.log(JSON.stringify({
    result: 'FARM_MAP_AVAILABILITY_ROUTE_PASS',
    anonymous: anonymous.status,
    spoofedQuery: spoofed.status,
    unknownSession: bogus.status,
    authenticated: ok.status,
    farmMaps: ok.body.maps.length,
    towns: ok.body.towns.length,
  }));
} finally {
  child.kill();
  await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
  if (createdLocal) rmSync(join(root, '.local'), { recursive: true, force: true });
  else for (const path of createdFiles) rmSync(path, { force: true });
  rmSync(work, { recursive: true, force: true });
}
