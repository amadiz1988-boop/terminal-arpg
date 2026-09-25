import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import {
  AdminRecoveryError,
  authorizeAdminRecovery,
  createAdminQuarantineRecoveryTransport,
  parseRecoveryCharId,
} from '../dashboard/admin-quarantine-recovery.mjs';
import { normalizeSupportActor } from '../support-session.mjs';

const actor = { actorAdminId: 'CLOUDFLARE_ACCESS_EDGE', authMethod: 'CLOUDFLARE_ACCESS_EDGE' };
const quarantined = '2000021\t7\tSERVER_AGENT\tQUARANTINED\tQUARANTINED\t1\t0\t0\tprontera\t100\tPERSISTENT_IDLE\t\t\tlast_error\t0';
const recovered = '2000021\t10\tSERVER_AGENT\tSERVER_AGENT\tACTIVE\t1\t0\t0\tprontera\t100\tPERSISTENT_IDLE\t\t\t\t1';

function fixture(state = quarantined, commandResult = 'CONFIRMED\t', inserted = '1') {
  const statements = [];
  const events = [];
  const grants = [];
  const sql = async (query) => {
    statements.push(query);
    if (query.includes('SELECT s.account_id,s.revision')) return state;
    if (query.includes('INSERT INTO persistent_agent_command')) return inserted;
    if (query.includes('SELECT command_status')) return commandResult;
    throw new Error('UNEXPECTED_QUERY');
  };
  const transport = createAdminQuarantineRecoveryTransport({
    sql,
    audit: async (event) => events.push(event),
    issueGrant: async (grant) => grants.push(grant),
  });
  return { transport, statements, events, grants };
}

test('existing Admin Browser authority queues exactly one Native recovery action', async () => {
  const f = fixture();
  const result = await f.transport.submit({ charId: '150021', adminContext: actor, originAllowed: true });
  assert.equal(result.status, 202);
  assert.equal(result.body.state, 'QUEUED');
  assert.equal(f.grants.length, 1);
  assert.equal(f.statements.filter((s) => s.includes('INSERT INTO persistent_agent_command')).length, 1);
  assert.match(f.statements.at(-1), /recover_quarantined_to_idle/);
  assert.match(f.statements.at(-1), /a\.actor_admin_id<>''/);
  assert.doesNotMatch(f.statements.at(-1), /OPENKORE|UPDATE persistent_agent_state|web_sessions/i);
  assert.equal(f.events.at(-1).adminIdentity, actor.actorAdminId);
  assert.equal(f.events.at(-1).result, 'QUEUED');
});

test('public, normal Player, localhost without Admin authority, and support session are denied', async () => {
  for (const input of [
    { adminContext: null, originAllowed: true },
    { adminContext: null, originAllowed: false },
    { adminContext: null, originAllowed: true, supportSession: true },
    { adminContext: actor, originAllowed: true, supportSession: true },
  ]) {
    const f = fixture();
    const result = await f.transport.submit({ charId: '150021', ...input });
    assert.equal(result.status, 403);
    assert.equal(f.statements.length, 0);
    assert.equal(f.grants.length, 0);
    assert.equal(f.events.length, 1);
  }
});

test('invalid character and non-quarantined state reject before grant or command', async () => {
  const f = fixture();
  assert.equal((await f.transport.submit({ charId: 'abc', adminContext: actor, originAllowed: true })).status, 422);
  assert.equal(f.grants.length, 0);
  const active = fixture(recovered);
  const result = await active.transport.submit({ charId: '150021', adminContext: actor, originAllowed: true });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'NOT_QUARANTINED');
  assert.equal(active.grants.length, 0);
  assert.equal(active.statements.length, 1);
  assert.throws(() => parseRecoveryCharId('4294967296'), AdminRecoveryError);
});

test('authoritative command and state are both required for RECOVERED', async () => {
  const f = fixture(recovered);
  const result = await f.transport.result({ charId: '150021', commandId: '12345678-1234-1234-1234-123456789abc',
    adminContext: actor, originAllowed: true });
  assert.equal(result.body.state, 'RECOVERED');
  assert.equal(result.body.afterState.agentMode, 'PERSISTENT_IDLE');
  const stale = fixture(quarantined);
  const pending = await stale.transport.result({ charId: '150021', commandId: '12345678-1234-1234-1234-123456789abc',
    adminContext: actor, originAllowed: true });
  assert.equal(pending.body.state, 'PENDING');
});

test('local developer uses the existing grant, command and audit contract', async () => {
  const f = fixture();
  const requestId = randomUUID();
  const local = { actorAdminId: 'developer-admin', authMethod: 'LOCAL_ADMIN_TOKEN' };
  const submitted = await f.transport.submit({ charId: '150021', adminContext: local,
    originAllowed: true, requestId });
  assert.equal(submitted.status, 202);
  assert.equal(submitted.body.requestId, requestId);
  assert.equal(f.grants[0].authMethod, 'LOCAL_ADMIN_TOKEN');
  assert.equal(f.statements.filter((s) => s.includes('INSERT INTO persistent_agent_command')).length, 1);
  assert.ok(f.events.every((event) => event.source === 'LOCAL_DEVELOPER_ACTION' &&
    event.requestId === requestId && event.action === 'recover_quarantined_to_idle' &&
    event.charId === 150021 && Number.isFinite(event.timestamp)));
  assert.deepEqual(f.events.map((event) => event.result), ['ADMITTED', 'QUEUED']);
  assert.equal(f.events.at(-1).commandId, submitted.body.commandId);
});

test('Admin Browser and local developer submit through the same action semantics', async () => {
  const browser = fixture();
  const developer = fixture();
  const local = { actorAdminId: 'developer-admin', authMethod: 'LOCAL_ADMIN_TOKEN' };
  const browserResult = await browser.transport.submit({ charId: '150021',
    adminContext: actor, originAllowed: true });
  const developerResult = await developer.transport.submit({ charId: '150021',
    adminContext: local, originAllowed: true, requestId: randomUUID() });
  assert.equal(browserResult.status, developerResult.status);
  assert.equal(browserResult.body.state, developerResult.body.state);
  assert.equal(browser.grants.length, developer.grants.length);
  assert.deepEqual(browser.statements.map((statement) => statement.includes('INSERT INTO persistent_agent_command')),
    developer.statements.map((statement) => statement.includes('INSERT INTO persistent_agent_command')));
  assert.deepEqual(browser.events.map((event) => event.result), developer.events.map((event) => event.result));
  assert.equal(browser.events.at(-1).source, 'ADMIN_BROWSER');
  assert.equal(developer.events.at(-1).source, 'LOCAL_DEVELOPER_ACTION');
});

test('competing owner, recovery in flight and generation race fail closed', async () => {
  const wrongOwner = fixture(quarantined.replace('SERVER_AGENT\tQUARANTINED', 'OPENKORE\tQUARANTINED'));
  const ownerResult = await wrongOwner.transport.submit({ charId: '150021',
    adminContext: actor, originAllowed: true });
  assert.equal(ownerResult.body.error, 'RECOVERY_PRECONDITION_BLOCKED');
  assert.equal(wrongOwner.grants.length, 0);
  const inFlight = fixture(quarantined.replace('\t0\tprontera', '\t1\tprontera'));
  const inFlightResult = await inFlight.transport.submit({ charId: '150021',
    adminContext: actor, originAllowed: true });
  assert.equal(inFlightResult.body.error, 'RECOVERY_PRECONDITION_BLOCKED');
  const raced = fixture(quarantined, 'CONFIRMED\t', '0');
  const raceResult = await raced.transport.submit({ charId: '150021',
    adminContext: actor, originAllowed: true });
  assert.equal(raceResult.body.error, 'COMMAND_ADMISSION_FAILED');
  assert.equal(raced.events.at(-1).result, 'COMMAND_ADMISSION_FAILED');
});

test('Native rejection reason and CONFIRMED semantics remain authoritative', async () => {
  const requestId = randomUUID();
  const commandId = randomUUID();
  const local = { actorAdminId: 'developer-admin', authMethod: 'LOCAL_ADMIN_TOKEN' };
  const rejected = fixture(quarantined, 'REJECTED\tINVALID_RECOVERY_REASON');
  const failure = await rejected.transport.result({ charId: '150021', commandId,
    adminContext: local, originAllowed: true, requestId });
  assert.equal(failure.body.state, 'FAILED');
  assert.equal(failure.body.reasonCode, 'INVALID_RECOVERY_REASON');
  assert.equal(rejected.events.at(-1).source, 'LOCAL_DEVELOPER_ACTION');
  assert.equal(rejected.events.at(-1).requestId, requestId);
  const confirmed = fixture(recovered);
  const success = await confirmed.transport.result({ charId: '150021', commandId,
    adminContext: local, originAllowed: true, requestId });
  assert.equal(success.body.state, 'RECOVERED');
  assert.equal(success.body.commandStatus, 'CONFIRMED');
  assert.equal(confirmed.events.at(-1).result, 'RECOVERED');
});

test('authorization contract creates no Player session or Admin identity mapping', () => {
  assert.equal(authorizeAdminRecovery({ adminContext: actor, originAllowed: true }).actorAdminId,
    'CLOUDFLARE_ACCESS_EDGE');
  assert.throws(() => authorizeAdminRecovery({ adminContext: null, originAllowed: true }),
    { code: 'admin_auth_required' });
});

test('Dashboard recovery route and Fleet action preserve the Access host boundary', async () => {
  const dashboard = await readFile(new URL('../dashboard.mjs', import.meta.url), 'utf8');
  const fleet = await readFile(new URL('../dashboard/admin/server-ops.js', import.meta.url), 'utf8');
  const hostStart = dashboard.indexOf('const adminSurfaceHosts =');
  const hostEnd = dashboard.indexOf('async function serveFile(', hostStart);
  const loopbackStart = dashboard.indexOf('function loopbackRequest(');
  const loopbackEnd = dashboard.indexOf('function publicErrorMessage(', loopbackStart);
  const actorStart = dashboard.indexOf('function adminActorFromRequest(');
  const actorEnd = dashboard.indexOf('async function supportSessionFromRequest(', actorStart);
  const fixtureStart = dashboard.indexOf('function adminTestFixtureTransportContext(');
  const fixtureEnd = dashboard.indexOf('async function grantNativeTestFixtureCommand(', fixtureStart);
  const contextStart = dashboard.indexOf('function adminRecoveryTransportContext(');
  const contextEnd = dashboard.indexOf('async function grantNativeQuarantineRecovery(', contextStart);
  assert.ok(hostStart >= 0 && hostEnd > hostStart && loopbackEnd > loopbackStart &&
    actorEnd > actorStart && fixtureEnd > fixtureStart && contextStart >= 0 && contextEnd > contextStart);
  const contextFor = runInNewContext(
    dashboard.slice(hostStart, hostEnd) + dashboard.slice(loopbackStart, loopbackEnd) +
      dashboard.slice(actorStart, actorEnd) + dashboard.slice(fixtureStart, fixtureEnd) +
      dashboard.slice(contextStart, contextEnd) +
      '\nadminRecoveryTransportContext',
    { process: { env: { RO_ADMIN_HOSTS: 'admin.g8land.com',
      RO_LOCAL_ADMIN_ACTOR_ID: 'developer-admin', RO_LOCAL_ADMIN_TOKEN: 'fixture-token' } },
    normalizeSupportActor },
  );
  const request = (host, token = null, address = '127.0.0.1') => ({
    headers: { host, ...(token ? { 'x-ro-local-admin-token': token } : {}) },
    socket: { remoteAddress: address },
  });
  assert.equal(contextFor(request('admin.g8land.com'))?.actorAdminId, 'CLOUDFLARE_ACCESS_EDGE');
  assert.equal(contextFor(request('play.g8land.com')), null);
  assert.equal(contextFor(request('localhost:8788')), null);
  assert.equal(contextFor(request('localhost:8788', 'fixture-token'))?.authMethod, 'LOCAL_ADMIN_TOKEN');
  assert.equal(contextFor(request('127.0.0.1:8788', 'fixture-token'))?.actorAdminId, 'developer-admin');
  assert.equal(contextFor(request('localhost:8788', 'fixture-token', '192.0.2.1')), null);
  assert.equal(contextFor(request('play.g8land.com', 'fixture-token')), null);
  assert.equal(contextFor(request('admin.evil.example')), null);
  const gate = dashboard.indexOf("url.pathname.startsWith('/api/admin/') && !adminRecoveryTransportContext(request)");
  const route = dashboard.indexOf('const adminRecoveryMatch = url.pathname.match(');
  assert.ok(gate > 0 && route > gate, 'Admin host gate precedes recovery API');
  assert.match(dashboard.slice(route, route + 1300), /adminQuarantineRecoveryTransport\.submit\(context\)/);
  assert.match(dashboard.slice(route, route + 1300), /adminQuarantineRecoveryTransport\.result\(/);
  assert.match(dashboard.slice(route, route + 1300), /x-ro-developer-request-id/);
  assert.match(fleet, /data-recover-char/);
  assert.match(fleet, /async function runQuarantineRecovery\(charId\)/);
  assert.match(fleet, /state === 'RECOVERED'/);
  assert.doesNotMatch(dashboard.slice(route, route + 1300), /web_sessions|UPDATE persistent_agent_state/i);
});

test('existing recovery audit records source and request ID without Player state writes', async () => {
  const dashboard = await readFile(new URL('../dashboard.mjs', import.meta.url), 'utf8');
  const start = dashboard.indexOf('let adminRecoveryAuditSchemaPromise;');
  const end = dashboard.indexOf('const adminQuarantineRecoveryTransport =', start);
  assert.ok(start >= 0 && end > start);
  const statements = [];
  const audit = runInNewContext(dashboard.slice(start, end) + '\nauditAdminQuarantineRecovery', {
    sql: async (query) => { statements.push(query); return ''; },
    escapeSql: (value) => String(value).replaceAll("'", "''"), randomUUID,
  });
  const requestId = randomUUID();
  await audit({ adminIdentity: 'developer-admin', source: 'LOCAL_DEVELOPER_ACTION',
    requestId, charId: 150021, commandId: randomUUID(), action: 'recover_quarantined_to_idle',
    beforeState: null, afterState: null, result: 'QUEUED', timestamp: Date.now() });
  assert.equal(statements.length, 3);
  assert.match(statements[1], /ADD COLUMN IF NOT EXISTS source/);
  assert.match(statements[2], /LOCAL_DEVELOPER_ACTION/);
  assert.match(statements[2], new RegExp(requestId));
  assert.doesNotMatch(statements.join('\n'), /UPDATE persistent_agent_state|UPDATE `char`/i);
});
