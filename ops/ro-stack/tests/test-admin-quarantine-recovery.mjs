import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  AdminRecoveryError,
  authorizeAdminRecovery,
  createAdminQuarantineRecoveryTransport,
  parseRecoveryCharId,
} from '../dashboard/admin-quarantine-recovery.mjs';

const actor = { actorAdminId: 'CLOUDFLARE_ACCESS_EDGE', authMethod: 'CLOUDFLARE_ACCESS_EDGE' };
const quarantined = '2000021\t7\tSERVER_AGENT\tQUARANTINED\tQUARANTINED\t1\t0\t0\tprontera\t100\tPERSISTENT_IDLE\t\t\tlast_error\t0';
const recovered = '2000021\t10\tSERVER_AGENT\tSERVER_AGENT\tACTIVE\t1\t0\t0\tprontera\t100\tPERSISTENT_IDLE\t\t\t\t1';

function fixture(state = quarantined) {
  const statements = [];
  const events = [];
  const grants = [];
  const sql = async (query) => {
    statements.push(query);
    if (query.includes('SELECT s.account_id,s.revision')) return state;
    if (query.includes('INSERT INTO persistent_agent_command')) return '1';
    if (query.includes('SELECT command_status')) return 'CONFIRMED\t';
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
  const contextStart = dashboard.indexOf('function adminRecoveryTransportContext(');
  const contextEnd = dashboard.indexOf('async function grantNativeQuarantineRecovery(', contextStart);
  assert.ok(hostStart >= 0 && hostEnd > hostStart && contextStart >= 0 && contextEnd > contextStart);
  const contextFor = runInNewContext(
    dashboard.slice(hostStart, hostEnd) + dashboard.slice(contextStart, contextEnd) +
      '\nadminRecoveryTransportContext',
    { process: { env: { RO_ADMIN_HOSTS: 'admin.g8land.com' } } },
  );
  const request = (host) => ({ headers: { host } });
  assert.equal(contextFor(request('admin.g8land.com'))?.actorAdminId, 'CLOUDFLARE_ACCESS_EDGE');
  assert.equal(contextFor(request('play.g8land.com')), null);
  assert.equal(contextFor(request('localhost:8788')), null);
  assert.equal(contextFor(request('admin.evil.example')), null);
  const gate = dashboard.indexOf("url.pathname.startsWith('/api/admin/') && !adminRecoveryTransportContext(request)");
  const route = dashboard.indexOf('const adminRecoveryMatch = url.pathname.match(');
  assert.ok(gate > 0 && route > gate, 'Admin host gate precedes recovery API');
  assert.match(dashboard.slice(route, route + 1300), /adminQuarantineRecoveryTransport\.submit\(context\)/);
  assert.match(dashboard.slice(route, route + 1300), /adminQuarantineRecoveryTransport\.result\(/);
  assert.match(fleet, /data-recover-char/);
  assert.match(fleet, /async function runQuarantineRecovery\(charId\)/);
  assert.match(fleet, /state === 'RECOVERED'/);
  assert.doesNotMatch(dashboard.slice(route, route + 1300), /web_sessions|UPDATE persistent_agent_state/i);
});
