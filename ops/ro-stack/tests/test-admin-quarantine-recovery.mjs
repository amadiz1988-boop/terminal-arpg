import assert from 'node:assert/strict';
import test from 'node:test';
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
