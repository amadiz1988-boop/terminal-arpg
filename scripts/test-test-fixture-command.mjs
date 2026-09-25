import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import {
  createTestFixtureCommandTransport,
  normalizeTestFixtureCommand,
  testFixtureCommandResult,
} from '../ops/ro-stack/test-fixture-command.mjs';

const registry = JSON.parse(await readFile(new URL('../docs/project-control/canonical-test-fixtures.json', import.meta.url)));
const admin = { context: 'ADMIN_TRANSPORT', actorAdminId: 'CLOUDFLARE_ACCESS_EDGE',
  sessionId: randomUUID(), authMethod: 'CLOUDFLARE_ACCESS_EDGE' };
const id = randomUUID();
const request = { fixtureRole: 'TEST_SUPERUSER', command: 'warp', arguments: 'prontera 150 150' };
const admitted = normalizeTestFixtureCommand(request, registry, admin, id);
assert.equal(admitted.ok, true);
assert.equal(admitted.payload.adminSessionId, admin.sessionId);
assert.equal(admitted.payload.actorAccountId, registry.identities.find((entry) => entry.logicalRole === 'TEST_SUPERUSER').accountId);
assert.equal(admitted.payload.actorCharId, registry.identities.find((entry) => entry.logicalRole === 'TEST_SUPERUSER').characterId);
assert.equal('groupId' in admitted.payload, false);
assert.equal('targetCharId' in admitted.payload, false);
assert.equal('requestId' in admitted.payload, false);

const playerFixture = normalizeTestFixtureCommand({ fixtureRole: 'TEST_PLAYER', command: 'item', arguments: '512 1' },
  registry, admin, randomUUID());
assert.equal(playerFixture.ok, true);
assert.equal(playerFixture.payload.command, 'item');
assert.equal('groupId' in playerFixture.payload, false);

assert.equal(normalizeTestFixtureCommand(request, registry, null, randomUUID()).status, 403);
assert.equal(normalizeTestFixtureCommand(request, registry, { accountId: admitted.accountId }, randomUUID()).status, 403);
assert.equal(normalizeTestFixtureCommand(request, registry, { supportSessionId: randomUUID(), actorAdminId: 'admin' }, randomUUID()).status, 403);
assert.equal(normalizeTestFixtureCommand(request, registry, { context: 'ADMIN_TRANSPORT',
  actorAdminId: 'admin', authMethod: 'LOCAL_ADMIN_TOKEN' }, randomUUID()).status, 403);
assert.equal(normalizeTestFixtureCommand({ ...request, fixtureRole: 'UNKNOWN_FIXTURE' }, registry, admin, randomUUID()).status, 403);
assert.equal(normalizeTestFixtureCommand({ ...request, targetCharId: 1 }, registry, admin, randomUUID()).status, 422);
assert.equal(normalizeTestFixtureCommand({ ...request, groupId: 99 }, registry, admin, randomUUID()).status, 422);
assert.equal(normalizeTestFixtureCommand({ ...request, adminSessionId: randomUUID() }, registry, admin, randomUUID()).status, 422);
assert.equal(normalizeTestFixtureCommand({ ...request, arguments: 'prontera\n@kickall' }, registry, admin, randomUUID()).status, 422);
assert.equal(normalizeTestFixtureCommand(request, { identities: [] }, admin, randomUUID()).status, 403);
assert.equal(normalizeTestFixtureCommand({ fixtureRole: 'TEST_SUPERUSER', command: 'kickall' }, registry, admin, randomUUID()).ok, true);
assert.equal(testFixtureCommandResult({ action: 'test_fixture_atcommand', status: 'REJECTED', reasonCode: 'test_fixture_command_scope_denied' }).state, 'COMMAND_NOT_ALLOWED');
assert.equal(testFixtureCommandResult({ action: 'test_fixture_atcommand', status: 'REJECTED', reasonCode: 'atcommand_permission_denied' }).state, 'DENIED');
assert.equal(testFixtureCommandResult({ action: 'test_fixture_atcommand', status: 'ACCEPTED' }).state, 'QUEUED');
assert.equal(testFixtureCommandResult({ action: 'test_fixture_atcommand', status: 'CONFIRMED' }).state, 'EXECUTED');

function fakeTransport({ testFlag = 1, accountOverride = null } = {}) {
  const statements = [];
  const events = [];
  const grants = [];
  let queued = null;
  const sql = async (statement) => {
    statements.push(statement);
    if (statement.includes('LEFT JOIN web_account_flags')) {
      const charId = Number(statement.match(/c\.char_id=(\d+)/)?.[1]);
      const fixture = registry.identities.find((entry) => entry.characterId === charId);
      return fixture ? `${accountOverride ?? fixture.accountId}\t${testFlag}` : '';
    }
    if (statement.includes('SELECT account_id,revision FROM persistent_agent_state')) {
      const charId = Number(statement.match(/char_id=(\d+)/)?.[1]);
      const fixture = registry.identities.find((entry) => entry.characterId === charId);
      return fixture ? `${fixture.accountId}\t7` : '';
    }
    if (statement.includes('INSERT IGNORE INTO persistent_agent_command')) {
      const match = statement.match(/VALUES \('([0-9a-f-]{36})',(\d+),'test_fixture_atcommand',\s*'([^']+)','([0-9a-f]{64})',7,'QUEUED'/);
      assert.ok(match, 'native queue schema and payload hash');
      queued = { requestId: match[1], charId: Number(match[2]), payload: JSON.parse(match[3]), hash: match[4] };
      return '';
    }
    if (statement.includes('FROM persistent_agent_command c')) {
      if (!queued) return '';
      return `${queued.requestId}\t${queued.charId}\ttest_fixture_atcommand\t7\tQUEUED\t\t\t\t\t${queued.hash}`;
    }
    if (statement.includes('FROM persistent_agent_rollout_event'))
      return 'g=99;p=ALLOW;e=EXECUTED\t2026-09-23 12:00:00.000';
    throw new Error(`Unexpected SQL: ${statement}`);
  };
  return {
    service: createTestFixtureCommandTransport({ sql, escapeSql: (value) => String(value).replaceAll("'", "''"),
      audit: async (event) => { events.push(event); },
      nativeGrant: async (normalized) => { grants.push(normalized); }, registry }),
    statements, events, grants, get queued() { return queued; },
  };
}

for (const role of ['TEST_SUPERUSER', 'TEST_PLAYER']) {
  const fake = fakeTransport();
  const response = await fake.service.submit({ fixtureRole: role, command: 'heal' }, admin);
  assert.equal(response.status, 202);
  assert.equal(response.body.state, 'QUEUED');
  assert.equal(response.body.fixtureRole, role);
  assert.equal(fake.queued.payload.actorCharId, registry.identities.find((entry) => entry.logicalRole === role).characterId);
  assert.equal(fake.queued.payload.command, 'heal');
  assert.equal(fake.queued.payload.adminSessionId, admin.sessionId);
  assert.equal(fake.events[0].eventType, 'TEST_FIXTURE_REQUEST');
  assert.equal(fake.events[0].commandId, fake.queued.requestId);
  assert.equal(fake.events[0].charId, fake.queued.charId);
  assert.equal(fake.grants[0].adminAuthMethod, 'CLOUDFLARE_ACCESS_EDGE');
  assert.equal(fake.grants[0].adminSessionId, admin.sessionId);
  assert.ok(fake.statements.some((statement) => statement.includes("'test_fixture_atcommand'")));
  assert.ok(!fake.statements.some((statement) => statement.includes('groupId')));
}

const nonTest = fakeTransport({ testFlag: 0 });
assert.equal((await nonTest.service.submit(request, admin)).status, 403);
assert.equal(nonTest.queued, null);
const wrongAccount = fakeTransport({ accountOverride: 1 });
assert.equal((await wrongAccount.service.submit(request, admin)).status, 403);
assert.equal(wrongAccount.queued, null);
const denied = fakeTransport();
assert.equal((await denied.service.submit(request, null)).status, 403);
assert.equal(denied.queued, null);
assert.equal(denied.events[0].errorCode, 'admin_auth_required');
const fakeGroup = fakeTransport();
assert.equal((await fakeGroup.service.submit({ ...request, groupId: 99 }, admin)).status, 422);
assert.equal(fakeGroup.queued, null);
let insertedWithoutAudit = false;
const failClosed = createTestFixtureCommandTransport({
  sql: async (statement) => {
    if (statement.includes('LEFT JOIN web_account_flags')) return `${admitted.accountId}\t1`;
    if (statement.includes('SELECT account_id,revision')) return `${admitted.accountId}\t7`;
    if (statement.includes('INSERT IGNORE')) insertedWithoutAudit = true;
    return '';
  },
  escapeSql: String, registry,
  audit: async () => { throw new Error('audit unavailable'); },
  nativeGrant: async () => {},
});
await assert.rejects(failClosed.submit(request, admin), /audit unavailable/);
assert.equal(insertedWithoutAudit, false);
const grantUnavailable = createTestFixtureCommandTransport({
  sql: async (statement) => {
    if (statement.includes('LEFT JOIN web_account_flags')) return `${admitted.accountId}\t1`;
    if (statement.includes('SELECT account_id,revision')) return `${admitted.accountId}\t7`;
    if (statement.includes('INSERT IGNORE')) insertedWithoutAudit = true;
    return '';
  },
  escapeSql: String, registry, audit: async () => {},
  nativeGrant: async () => { throw new Error('native grant unavailable'); },
});
await assert.rejects(grantUnavailable.submit(request, admin), /native grant unavailable/);
assert.equal(insertedWithoutAudit, false);
const statusTransport = fakeTransport();
await statusTransport.service.submit(request, admin);
const result = await statusTransport.service.result(statusTransport.queued.requestId, 'TEST_SUPERUSER', admin);
assert.equal(result.status, 200);
assert.equal(result.body.permission, 'ALLOW');
assert.equal(result.body.execution, 'EXECUTED');
assert.equal(result.body.resolvedGroup, 99);
assert.equal('adminSessionId' in result.body, false);

const dashboard = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
assert.match(dashboard, /function adminTestFixtureTransportContext\(request\)/);
assert.match(dashboard, /if \(!adminContext \|\| \(\(isM1Submit \|\| m1ResultMatch\)/);
assert.match(dashboard, /if \(await handleAdminTestFixtureCommand\(url, request, response\)\) return/);
assert.match(dashboard, /RO_TEST_FIXTURE_COMMANDS_ENABLED !== '1'/);
assert.ok(dashboard.indexOf("supportRequestContext && url.pathname.startsWith('/api/admin/')") <
  dashboard.indexOf('if (await handleAdminTestFixtureCommand(url, request, response)) return'));
assert.ok(dashboard.indexOf("if (url.pathname.startsWith('/api/admin/')") <
  dashboard.indexOf('if (await handleAdminTestFixtureCommand(url, request, response)) return'));
assert.match(dashboard, /CREATE TABLE IF NOT EXISTS web_admin_sessions/);
assert.match(dashboard, /const createdFrom = normalized\.createdFrom === 'M1_FLY_SUPPLY_V1'/);
assert.match(dashboard, /'\$\{createdFrom\}',\$\{createdAt\}/);
const contextStart = dashboard.indexOf('function adminTestFixtureTransportContext(request) {');
const contextEnd = dashboard.indexOf('\n}', contextStart);
assert.ok(contextStart > 0 && contextEnd > contextStart);
const contextSource = dashboard.slice(contextStart, contextEnd + 2);
const adminContextFor = runInNewContext(`(${contextSource})`, {
  adminActorFromRequest: (req) => req.localActor ?? null,
  loopbackRequest: (req) => req.socket.remoteAddress === '127.0.0.1',
  isAdminSurfaceHost: (req) => req.headers.host === 'admin.g8land.com',
});
const fixtureRequest = (host, localActor = null) =>
  ({ headers: { host }, localActor, socket: { remoteAddress: '127.0.0.1' } });
assert.equal(adminContextFor(fixtureRequest('play.g8land.com')), null);
assert.equal(adminContextFor(fixtureRequest('play.g8land.com', 'local-admin')), null);
assert.equal(adminContextFor(fixtureRequest('127.0.0.1:8788', 'local-admin')).actorAdminId, 'local-admin');
assert.equal(adminContextFor(fixtureRequest('admin.g8land.com')).actorAdminId, 'CLOUDFLARE_ACCESS_EDGE');
const grantStart = dashboard.indexOf('async function grantNativeTestFixtureCommand(normalized) {');
const grantEnd = dashboard.indexOf('\n}', grantStart);
assert.ok(grantStart > 0 && grantEnd > grantStart);
const grantSql = [];
const grant = runInNewContext(`(${dashboard.slice(grantStart, grantEnd + 2)})`, {
  sql: async (statement) => { grantSql.push(statement); },
  createHash, escapeSql: String, Date,
});
await grant(admitted);
assert.equal(grantSql.length, 2);
assert.match(grantSql[0], /CREATE TABLE IF NOT EXISTS web_admin_sessions/);
assert.match(grantSql[1], /INSERT INTO web_admin_sessions/);
assert.ok(grantSql[1].includes(admitted.adminSessionId));
assert.ok(grantSql[1].includes("'CLOUDFLARE_ACCESS_EDGE'"));
assert.doesNotMatch(grantSql.join('\n'), /password|ro_session|cookie/i);
const playerActions = dashboard.match(/const ownershipActions = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
assert.doesNotMatch(playerActions, /test_fixture_atcommand/);

if (process.env.GI_NATIVE_COMMAND_CONTRACT) {
  const nativeContract = JSON.parse(await readFile(process.env.GI_NATIVE_COMMAND_CONTRACT, 'utf8'));
  const action = nativeContract.commands.find((entry) => entry.action === 'test_fixture_atcommand');
  assert.ok(action?.enqueueAdmitted);
  assert.equal(action.strictUnknownFields, true);
  assert.deepEqual(Object.keys(action.payload.required).sort(),
    ['adminSessionId', 'actorAccountId', 'actorCharId', 'command'].sort());
  assert.deepEqual(Object.keys(action.payload.optional), ['arguments']);
  assert.deepEqual(Object.keys(admitted.payload).sort(),
    [...Object.keys(action.payload.required), ...Object.keys(action.payload.optional)].sort());
  const withoutArguments = normalizeTestFixtureCommand(
    { fixtureRole: 'TEST_PLAYER', command: 'heal' }, registry, admin, randomUUID());
  assert.deepEqual(Object.keys(withoutArguments.payload).sort(),
    Object.keys(action.payload.required).sort());
}
if (process.env.GI_NATIVE_FIXTURE_POLICY) {
  const nativePolicy = await readFile(process.env.GI_NATIVE_FIXTURE_POLICY, 'utf8');
  const selfScoped = nativePolicy.match(/inline bool test_fixture_atcommand_self_scoped[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(selfScoped, /command == "mapmove"/);
  assert.match(selfScoped, /command == "item"/);
  assert.doesNotMatch(selfScoped, /command == "kickall"|command == "reloadscript"|command == "nuke"/);
}

console.log('TEST_FIXTURE_COMMAND_SOURCE_TEST_PASS');
