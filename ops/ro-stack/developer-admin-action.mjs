import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ADMIN_RECOVERY_ACTION, parseRecoveryCharId } from './dashboard/admin-quarantine-recovery.mjs';

const COMMAND_ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function parseDeveloperActionArgs(args) {
  if (args[0] !== ADMIN_RECOVERY_ACTION) throw new Error('unsupported_action');
  const options = args.slice(1);
  const preflight = options.includes('--preflight');
  const expected = preflight ? 3 : 2;
  if (options.length !== expected || options[0] !== '--char-id' ||
      (preflight && options[2] !== '--preflight')) throw new Error('invalid_arguments');
  return { action: ADMIN_RECOVERY_ACTION, charId: parseRecoveryCharId(options[1]), preflight };
}

export async function runDeveloperAdminAction(args, {
  env = process.env, fetchImpl = fetch, sleep = delay, now = Date.now,
  requestId = randomUUID(),
} = {}) {
  const { action, charId, preflight } = parseDeveloperActionArgs(args);
  if (!COMMAND_ID.test(requestId)) throw new Error('invalid_request_id');
  const token = String(env.RO_LOCAL_ADMIN_TOKEN ?? '');
  if (!token) throw new Error('local_admin_token_required');
  const port = Number(env.RO_DASHBOARD_PORT ?? 8788);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error('invalid_dashboard_port');
  const origin = `http://127.0.0.1:${port}`;
  const headers = { accept: 'application/json',
    'x-ro-local-admin-token': token, 'x-ro-developer-request-id': requestId };
  const request = async (path, method = 'GET') => {
    const response = await fetchImpl(`${origin}${path}`, {
      method, headers, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    return { status: response.status, body };
  };
  if (preflight) {
    const { status, body } = await request('/api/admin/characters');
    if (status !== 200 || !Array.isArray(body?.characters))
      return { action, charId, requestId, result: 'PREFLIGHT_FAILED',
        httpStatus: status, error: body?.error ?? 'admin_roster_unavailable' };
    const character = body.characters.find((entry) => entry.charId === charId);
    if (!character) return { action, charId, requestId, result: 'TARGET_NOT_IN_ADMIN_ROSTER',
      httpStatus: 404 };
    return { action, charId, requestId, result: 'READ_ONLY_PREFLIGHT', httpStatus: 200,
      controlOwner: character.controlOwner, ownershipState: character.ownershipState,
      runtimeState: character.runtimeState, admission: 'NOT_EVALUATED' };
  }
  const path = `/api/admin/characters/${charId}/quarantine-recovery`;
  const submitted = await request(path, 'POST');
  if (submitted.status !== 202 || submitted.body?.state !== 'QUEUED')
    return { action, charId, requestId, result: 'REJECTED',
      httpStatus: submitted.status, error: submitted.body?.error ?? 'command_not_queued' };
  if (submitted.body.requestId !== requestId || !COMMAND_ID.test(submitted.body.commandId ?? ''))
    throw new Error('invalid_command_response');
  const commandId = submitted.body.commandId;
  const deadline = now() + 30000;
  do {
    const observed = await request(`${path}/${commandId}`);
    if (observed.status !== 200 || observed.body?.requestId !== requestId)
      return { action, charId, requestId, commandId, result: 'RESULT_UNAVAILABLE',
        httpStatus: observed.status, error: observed.body?.error ?? 'invalid_result' };
    if (observed.body.state === 'RECOVERED' && observed.body.ok === true &&
        observed.body.commandStatus === 'CONFIRMED')
      return { action, charId, requestId, commandId, result: 'CONFIRMED',
        httpStatus: observed.status, timestamp: now() };
    if (observed.body.state === 'FAILED')
      return { action, charId, requestId, commandId, result: 'FAILED',
        httpStatus: observed.status, reasonCode: observed.body.reasonCode ?? '',
        timestamp: now() };
    if (now() >= deadline) break;
    await sleep(500);
  } while (true);
  return { action, charId, requestId, commandId, result: 'PENDING', timestamp: now() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runDeveloperAdminAction(process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (!['READ_ONLY_PREFLIGHT', 'CONFIRMED'].includes(result.result)) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAILED', error: error.code ?? error.message }));
    process.exitCode = 1;
  }
}
