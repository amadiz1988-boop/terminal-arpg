import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseDeveloperActionArgs, runDeveloperAdminAction } from '../developer-admin-action.mjs';

const action = 'recover_quarantined_to_idle';
const args = [action, '--char-id', '150070'];
const commandId = '12345678-1234-1234-1234-123456789abc';
const env = { RO_LOCAL_ADMIN_TOKEN: 'fixture-token' };

function reply(status, body) {
  return { status, json: async () => body };
}

test('single recovery action and numeric character are the entire CLI allowlist', () => {
  assert.deepEqual(parseDeveloperActionArgs(args), {
    action, charId: 150070, preflight: false,
  });
  assert.throws(() => parseDeveloperActionArgs(['run_server_command', '--char-id', '150070']),
    { message: 'unsupported_action' });
  assert.throws(() => parseDeveloperActionArgs([...args, '--command', 'anything']),
    { message: 'invalid_arguments' });
  assert.throws(() => parseDeveloperActionArgs([action, '--char-id', '0']),
    { code: 'invalid_char_id' });
});

test('read-only preflight uses existing local Admin roster and does not infer eligibility', async () => {
  const calls = [];
  const requestId = randomUUID();
  const result = await runDeveloperAdminAction([...args, '--preflight'], {
    env, requestId,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return reply(200, { characters: [{ charId: 150070, controlOwner: 'SERVER_AGENT',
        ownershipState: 'QUARANTINED', runtimeState: 'QUARANTINED' }] });
    },
  });
  assert.equal(result.result, 'READ_ONLY_PREFLIGHT');
  assert.equal(result.admission, 'NOT_EVALUATED');
  assert.equal(result.requestId, requestId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:8788/api/admin/characters');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['x-ro-local-admin-token'], env.RO_LOCAL_ADMIN_TOKEN);
  assert.equal(calls[0].init.headers['x-ro-developer-request-id'], requestId);
  assert.equal('cookie' in calls[0].init.headers, false);
});

test('canonical POST and result GET preserve request ID through Native CONFIRMED', async () => {
  const calls = [];
  const requestId = randomUUID();
  const result = await runDeveloperAdminAction(args, {
    env, requestId,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init.method === 'POST') return reply(202, {
        ok: true, charId: 150070, commandId, requestId, state: 'QUEUED',
      });
      return reply(200, { ok: true, charId: 150070, commandId, requestId,
        state: 'RECOVERED', commandStatus: 'CONFIRMED' });
    },
  });
  assert.equal(result.result, 'CONFIRMED');
  assert.equal(result.commandId, commandId);
  assert.deepEqual(calls.map((call) => call.init.method), ['POST', 'GET']);
  assert.equal(calls[0].url, 'http://127.0.0.1:8788/api/admin/characters/150070/quarantine-recovery');
  assert.equal(calls[1].url, `${calls[0].url}/${commandId}`);
  assert.ok(calls.every((call) => call.init.headers['x-ro-developer-request-id'] === requestId));
  assert.ok(calls.every((call) => !('cookie' in call.init.headers)));
});

test('canonical admission rejection remains precise', async () => {
  const result = await runDeveloperAdminAction(args, {
    env,
    fetchImpl: async () => reply(409, { ok: false, error: 'RECOVERY_PRECONDITION_BLOCKED' }),
  });
  assert.equal(result.result, 'REJECTED');
  assert.equal(result.httpStatus, 409);
  assert.equal(result.error, 'RECOVERY_PRECONDITION_BLOCKED');
});

test('Native rejection reason and invalid generation are reported without retry', async () => {
  const requestId = randomUUID();
  let calls = 0;
  const result = await runDeveloperAdminAction(args, {
    env, requestId,
    fetchImpl: async (_url, init) => {
      calls++;
      if (init.method === 'POST') return reply(202, { commandId, requestId, state: 'QUEUED' });
      return reply(200, { commandId, requestId, state: 'FAILED',
        commandStatus: 'REJECTED', reasonCode: 'INVALID_GENERATION' });
    },
  });
  assert.equal(result.result, 'FAILED');
  assert.equal(result.reasonCode, 'INVALID_GENERATION');
  assert.equal(calls, 2);
});

test('CONFIRMED command without authoritative recovered state stays pending', async () => {
  const requestId = randomUUID();
  let time = 0;
  const result = await runDeveloperAdminAction(args, {
    env, requestId, now: () => time, sleep: async (ms) => { time += ms; },
    fetchImpl: async (_url, init) => init.method === 'POST'
      ? reply(202, { commandId, requestId, state: 'QUEUED' })
      : reply(200, { commandId, requestId, state: 'PENDING', commandStatus: 'CONFIRMED' }),
  });
  assert.equal(result.result, 'PENDING');
  assert.equal(time, 30000);
});

test('missing local token and mismatched request identity fail before command acceptance', async () => {
  let calls = 0;
  await assert.rejects(runDeveloperAdminAction(args, {
    env: {}, fetchImpl: async () => { calls++; },
  }), { message: 'local_admin_token_required' });
  await assert.rejects(runDeveloperAdminAction(args, {
    env, requestId: 'bad', fetchImpl: async () => { calls++; },
  }), { message: 'invalid_request_id' });
  assert.equal(calls, 0);
  await assert.rejects(runDeveloperAdminAction(args, {
    env, requestId: randomUUID(),
    fetchImpl: async () => reply(202, { commandId, requestId: randomUUID(), state: 'QUEUED' }),
  }), { message: 'invalid_command_response' });
});

test('developer entrypoint has no direct database or generic command mutation path', async () => {
  const source = await readFile(new URL('../developer-admin-action.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:UPDATE|INSERT|DELETE)\s+(?:INTO\s+|FROM\s+)?(?:persistent_agent|web_admin|`char`)/i);
  assert.doesNotMatch(source, /(?:execFile|spawn|child_process|mysql|mariadb)/i);
  assert.match(source, /\/api\/admin\/characters\/\$\{charId\}\/quarantine-recovery/);
  assert.match(source, /args\[0\] !== ADMIN_RECOVERY_ACTION/);
});
