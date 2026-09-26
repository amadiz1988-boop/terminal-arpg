// Admin transport admission only. Native rAthena decides atcommand permission.
import { createHash, randomUUID } from 'node:crypto';
const sessionIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const commandPattern = /^[a-z][a-z0-9_]{0,30}$/;
const argumentsPattern = /^[A-Za-z0-9_,.\- ]{0,200}$/;
const commandIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestFields = new Set(['fixtureRole', 'command', 'arguments', 'requestId']);
const fixtureRoles = new Set(['TEST_SUPERUSER', 'TEST_PLAYER']);

export function fixtureTransportEnabled(kind, environment = process.env) {
  if (kind === 'M1_ACCEPTANCE') return environment.RO_M1_ACCEPTANCE_FIXTURE_ENABLED === '1';
  if (kind === 'GENERIC') return environment.RO_TEST_FIXTURE_COMMANDS_ENABLED === '1';
  return false;
}

export function resolveCanonicalTestFixture(registry, role) {
  if (!fixtureRoles.has(role))
    return { ok: false, status: 403, error: 'fixture_identity_rejected' };
  const fixture = registry?.identities?.find((entry) => entry?.logicalRole === role);
  const accountId = Number(fixture?.accountId);
  const charId = Number(fixture?.characterId);
  if (!fixture || fixture.testFlag !== true || !Number.isSafeInteger(accountId) || accountId <= 0 ||
      !Number.isSafeInteger(charId) || charId <= 0)
    return { ok: false, status: 403, error: 'fixture_identity_rejected' };
  return { ok: true, role, accountId, charId };
}

export function normalizeTestFixtureCommand(body, registry, adminContext, requestId) {
  if (!adminContext?.actorAdminId || adminContext.context !== 'ADMIN_TRANSPORT' ||
      !sessionIdPattern.test(String(adminContext.sessionId ?? '')))
    return { ok: false, status: 403, error: 'admin_auth_required' };
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((field) => !requestFields.has(field)))
    return { ok: false, status: 422, error: 'invalid_fixture_command_request' };
  const fixture = resolveCanonicalTestFixture(registry, String(body.fixtureRole ?? ''));
  if (!fixture.ok) return fixture;
  const { role, accountId, charId } = fixture;
  const command = String(body.command ?? '');
  const argumentsText = String(body.arguments ?? '');
  if (!commandPattern.test(command) || !argumentsPattern.test(argumentsText))
    return { ok: false, status: 422, error: 'invalid_fixture_command_request' };
  const id = String(body.requestId ?? requestId ?? '').toLowerCase();
  if (!commandIdPattern.test(id))
    return { ok: false, status: 422, error: 'invalid_request_id' };
  return {
    ok: true,
    requestId: id,
    role,
    accountId,
    charId,
    adminSessionId: String(adminContext.sessionId),
    adminActorId: String(adminContext.actorAdminId),
    adminAuthMethod: String(adminContext.authMethod ?? ''),
    payload: {
      adminSessionId: String(adminContext.sessionId),
      actorAccountId: accountId,
      actorCharId: charId,
      command,
      ...(argumentsText ? { arguments: argumentsText } : {}),
    },
  };
}

export function testFixtureCommandResult(command) {
  if (!command || command.action !== 'test_fixture_atcommand')
    return { state: 'FAILED', reason: 'command_not_found' };
  if (command.status === 'QUEUED') return { state: 'QUEUED' };
  // PA ACCEPTED is a revision claim; rAthena has not decided GM permission yet.
  if (command.status === 'ACCEPTED') return { state: 'QUEUED' };
  if (command.status === 'CONFIRMED') return { state: 'EXECUTED' };
  const reason = String(command.reasonCode ?? '');
  if (reason === 'resident_test_character_required')
    return { state: 'TARGET_NOT_RESIDENT' };
  if (reason === 'test_fixture_identity_required' || reason === 'admin_auth_required')
    return { state: 'FIXTURE_IDENTITY_REJECTED' };
  if (reason === 'test_fixture_command_scope_denied' || reason === 'test_fixture_bound_command_denied')
    return { state: 'COMMAND_NOT_ALLOWED' };
  if (reason === 'atcommand_permission_denied') return { state: 'DENIED' };
  return { state: 'FAILED' };
}

const queueAction = 'test_fixture_atcommand';

function commandRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    commandId: row[0], charId: Number(row[1]), action: row[2],
    expectedRevision: Number(row[3]), status: row[4], reasonCode: row[5] || null,
    resultingRevision: row[6] ? Number(row[6]) : null,
    acceptedAt: row[7] || null, confirmedAt: row[8] || null,
    payloadHash: row[9] || '',
  };
}

export function createTestFixtureCommandTransport({ sql, escapeSql, audit, nativeGrant, registry }) {
  async function readCommand(fixture, requestId) {
    const output = await sql(`SELECT c.command_id,c.char_id,c.action,c.expected_revision,c.command_status,
      COALESCE(c.reason_code,''),COALESCE(c.resulting_revision,''),COALESCE(c.accepted_at,''),
      COALESCE(c.confirmed_at,''),c.payload_hash FROM persistent_agent_command c
      JOIN persistent_agent_state s ON s.char_id=c.char_id
      WHERE c.command_id='${escapeSql(requestId)}' AND c.char_id=${fixture.charId}
      AND s.account_id=${fixture.accountId} LIMIT 1;`);
    return commandRow(output);
  }

  async function fixtureStillEligible(fixture) {
    const output = await sql(`SELECT c.account_id,COALESCE(f.is_test,0) FROM \`char\` c
      LEFT JOIN web_account_flags f ON f.account_id=c.account_id
      WHERE c.char_id=${fixture.charId} LIMIT 1;`);
    if (!output) return false;
    const [accountId, testFlag] = output.split('\t');
    return Number(accountId) === fixture.accountId && Number(testFlag) === 1;
  }

  async function submit(body, adminContext) {
    const fallbackId = randomUUID();
    const normalized = normalizeTestFixtureCommand(body, registry, adminContext, fallbackId);
    const requestId = normalized.ok ? normalized.requestId : fallbackId;
    const actor = normalized.ok ? normalized : { accountId: 0, charId: 0 };
    const auditAttempt = async (code) => audit({ accountId: actor.accountId, charId: actor.charId,
      eventType: 'TEST_FIXTURE_REQUEST', errorCode: code, commandId: requestId });
    if (!normalized.ok) {
      await auditAttempt(normalized.error);
      return { status: normalized.status, body: { requestId, state: 'DENIED', error: normalized.error } };
    }
    if (!await fixtureStillEligible(normalized)) {
      await auditAttempt('fixture_identity_rejected');
      return { status: 403, body: { requestId, state: 'FIXTURE_IDENTITY_REJECTED' } };
    }
    const stateOutput = await sql(`SELECT account_id,revision FROM persistent_agent_state
      WHERE char_id=${normalized.charId} LIMIT 1;`);
    const [stateAccount, stateRevision] = String(stateOutput ?? '').split('\t');
    const revision = Number(stateRevision);
    if (Number(stateAccount) !== normalized.accountId || !Number.isSafeInteger(revision) || revision < 0) {
      await auditAttempt('fixture_agent_state_unavailable');
      return { status: 409, body: { requestId, state: 'TARGET_NOT_RESIDENT' } };
    }
    const payload = JSON.stringify(normalized.payload);
    const payloadHash = createHash('sha256')
      .update(`${queueAction}\0${normalized.charId}\0${revision}\0${payload}`)
      .digest('hex');
    // Fail closed when the existing audit store cannot record admission.
    await auditAttempt('admission_checked');
    await nativeGrant(normalized);
    await sql(`INSERT IGNORE INTO persistent_agent_command
      (command_id,char_id,action,payload,payload_hash,expected_revision,command_status,requested_at)
      VALUES ('${escapeSql(requestId)}',${normalized.charId},'${queueAction}',
      '${escapeSql(payload)}','${payloadHash}',${revision},'QUEUED',CURRENT_TIMESTAMP(3));`);
    const command = await readCommand(normalized, requestId);
    if (!command || command.action !== queueAction || command.expectedRevision !== revision ||
        command.payloadHash !== payloadHash) {
      await auditAttempt('idempotency_conflict');
      return { status: 409, body: { requestId, state: 'FAILED', error: 'idempotency_conflict' } };
    }
    await auditAttempt('queued').catch(() => {});
    return { status: 202, body: { requestId, fixtureRole: normalized.role,
      actorAccountId: normalized.accountId, actorCharId: normalized.charId,
      command: normalized.payload.command, ...testFixtureCommandResult(command) } };
  }

  async function result(requestId, role, adminContext) {
    if (!adminContext?.actorAdminId || adminContext.context !== 'ADMIN_TRANSPORT')
      return { status: 403, body: { error: 'admin_auth_required' } };
    if (!commandIdPattern.test(String(requestId ?? '')))
      return { status: 422, body: { error: 'invalid_request_id' } };
    const fixture = resolveCanonicalTestFixture(registry, role);
    if (!fixture.ok || !await fixtureStillEligible(fixture))
      return { status: 403, body: { error: 'fixture_identity_rejected' } };
    const command = await readCommand(fixture, requestId);
    if (!command || command.action !== queueAction)
      return { status: 404, body: { error: 'command_not_found' } };
    const auditOutput = await sql(`SELECT COALESCE(error_code,''),created_at FROM persistent_agent_rollout_event
      WHERE command_id='${escapeSql(requestId)}' AND event_type='TEST_FIXTURE_COMMAND'
      ORDER BY event_id DESC LIMIT 1;`);
    const [auditCode = '', nativeResultAt = ''] = String(auditOutput ?? '').split('\t');
    const match = /^g=(\d+|NA);p=(ALLOW|DENY|NA|PENDING);e=([A-Z_]+)$/.exec(auditCode);
    return { status: 200, body: { requestId, fixtureRole: fixture.role,
      actorAccountId: fixture.accountId, actorCharId: fixture.charId,
      ...testFixtureCommandResult(command),
      resolvedGroup: match?.[1] === 'NA' ? null : (match ? Number(match[1]) : null),
      permission: match?.[2] ?? 'UNKNOWN', execution: match?.[3] ?? 'NOT_REACHED',
      nativeResultAt: nativeResultAt || null,
      acceptedAt: command.acceptedAt, confirmedAt: command.confirmedAt } };
  }

  return { submit, result };
}

// One local-Admin-only, fixed-profile prerequisite setup. This shares the
// authenticated test transport and command ledger; no generic target, item,
// Zeny, map or state parameter is admitted.
export function createM1AcceptanceFixtureTransport({ sql, escapeSql, audit, nativeGrant, registry }) {
  const action = 'prepare_m1_acceptance_fixture';
  const profiles = new Set(['M1_FLY_SUPPLY_V1', 'M1_ECONOMY_SETUP_V1', 'M1_ECONOMY_CLEANUP_V1']);
  const targetCharId = 150105;
  const targetAccountId = 2000163;
  const fixture = resolveCanonicalTestFixture(registry, 'TEST_PLAYER');

  async function eligible() {
    if (!fixture.ok || fixture.charId !== targetCharId || fixture.accountId !== targetAccountId)
      return false;
    const row = await sql(`SELECT c.account_id,COALESCE(f.is_test,0),s.revision FROM \`char\` c
      JOIN persistent_agent_state s ON s.char_id=c.char_id
      LEFT JOIN web_account_flags f ON f.account_id=c.account_id
      WHERE c.char_id=${targetCharId} LIMIT 1;`);
    const [accountId, testFlag, revision] = String(row ?? '').split('\t');
    return Number(accountId) === targetAccountId && Number(testFlag) === 1 &&
      Number.isSafeInteger(Number(revision)) && Number(revision) >= 0 ? Number(revision) : false;
  }

  async function readCommand(requestId) {
    const output = await sql(`SELECT c.command_id,c.char_id,c.action,c.expected_revision,c.command_status,
      COALESCE(c.reason_code,''),COALESCE(c.resulting_revision,''),COALESCE(c.accepted_at,''),
      COALESCE(c.confirmed_at,''),c.payload_hash,c.payload FROM persistent_agent_command c
      WHERE c.command_id='${escapeSql(requestId)}' AND c.char_id=${targetCharId} LIMIT 1;`);
    if (!output) return null;
    const command = commandRow(output);
    try { return { ...command, profile: JSON.parse(output.split('\t')[10]).profile }; }
    catch { return { ...command, profile: null }; }
  }

  const localAdmin = context => context?.context === 'ADMIN_TRANSPORT' &&
    context.authMethod === 'LOCAL_ADMIN_TOKEN' && !!context.actorAdminId;

  async function submit(body, context) {
    if (!localAdmin(context) || !sessionIdPattern.test(String(context.sessionId ?? '')))
      return { status: 403, body: { state: 'DENIED', error: 'local_admin_required' } };
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['profile', 'requestId'].includes(key)) ||
        !profiles.has(body.profile))
      return { status: 422, body: { state: 'DENIED', error: 'invalid_m1_fixture_profile' } };
    const profile = body.profile;
    const requestId = String(body.requestId ?? randomUUID()).toLowerCase();
    if (!commandIdPattern.test(requestId))
      return { status: 422, body: { state: 'DENIED', error: 'invalid_request_id' } };
    const revision = await eligible();
    if (revision === false)
      return { status: 403, body: { requestId, state: 'DENIED', error: 'fixture_identity_rejected' } };
    const payload = JSON.stringify({ adminSessionId: context.sessionId, targetCharId, profile });
    const payloadHash = createHash('sha256')
      .update(`${action}\0${targetCharId}\0${revision}\0${payload}`).digest('hex');
    await audit({ accountId: targetAccountId, charId: targetCharId,
      eventType: 'M1_FIXTURE_REQUEST', errorCode: 'admission_checked', commandId: requestId });
    await nativeGrant({ adminSessionId: context.sessionId, adminActorId: context.actorAdminId,
      adminAuthMethod: context.authMethod, createdFrom: profile });
    await sql(`INSERT IGNORE INTO persistent_agent_command
      (command_id,char_id,action,payload,payload_hash,expected_revision,command_status,requested_at)
      VALUES ('${escapeSql(requestId)}',${targetCharId},'${action}',
      '${escapeSql(payload)}','${payloadHash}',${revision},'QUEUED',CURRENT_TIMESTAMP(3));`);
    const command = await readCommand(requestId);
    if (!command || command.action !== action || command.expectedRevision !== revision ||
        command.payloadHash !== payloadHash)
      return { status: 409, body: { requestId, state: 'FAILED', error: 'idempotency_conflict' } };
    return { status: 202, body: { requestId, fixtureRole: 'TEST_PLAYER',
      targetCharId, profile, state: 'QUEUED' } };
  }

  async function result(requestId, context) {
    if (!localAdmin(context)) return { status: 403, body: { error: 'local_admin_required' } };
    if (!commandIdPattern.test(String(requestId ?? '')))
      return { status: 422, body: { error: 'invalid_request_id' } };
    if (await eligible() === false)
      return { status: 403, body: { error: 'fixture_identity_rejected' } };
    const command = await readCommand(requestId);
    if (!command || command.action !== action || !profiles.has(command.profile))
      return { status: 404, body: { error: 'command_not_found' } };
    const output = await sql(`SELECT COALESCE(error_code,''),created_at FROM persistent_agent_rollout_event
      WHERE command_id='${escapeSql(requestId)}' AND event_type='M1_ACCEPTANCE_FIXTURE'
      ORDER BY event_id DESC LIMIT 1;`);
    const [nativeEvent = '', nativeResultAt = ''] = String(output ?? '').split('\t');
    const expectedEvent = command.profile === 'M1_ECONOMY_CLEANUP_V1' ? 'CLEANED' : 'PREREQUISITES_READY';
    const confirmed = command.status === 'CONFIRMED' && nativeEvent === expectedEvent;
    return { status: 200, body: { requestId, fixtureRole: 'TEST_PLAYER', targetCharId,
      profile: command.profile,
      state: confirmed ? 'CONFIRMED' : command.status === 'REJECTED' ? 'REJECTED'
        : command.status === 'CONFIRMED' ? 'FAILED' : 'QUEUED',
      reason: command.status === 'CONFIRMED' && !confirmed
        ? 'NATIVE_RESULT_MISSING' : command.reasonCode,
      nativeEvent, nativeResultAt: nativeResultAt || null,
      acceptedAt: command.acceptedAt, confirmedAt: command.confirmedAt } };
  }

  return { submit, result };
}
