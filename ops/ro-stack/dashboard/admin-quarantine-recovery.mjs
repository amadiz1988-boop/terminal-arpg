import { createHash, randomUUID } from 'node:crypto';

export const ADMIN_RECOVERY_ACTION = 'recover_quarantined_to_idle';
const COMMAND_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export class AdminRecoveryError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function authorizeAdminRecovery({ adminContext, originAllowed, supportSession }) {
  if (supportSession) throw new AdminRecoveryError(403, 'support_admin_boundary');
  if (!originAllowed) throw new AdminRecoveryError(403, 'origin_denied');
  if (!adminContext?.actorAdminId) throw new AdminRecoveryError(403, 'admin_auth_required');
  return adminContext;
}

export function parseRecoveryCharId(value) {
  if (!/^[1-9][0-9]{0,9}$/.test(String(value ?? ''))) {
    throw new AdminRecoveryError(422, 'invalid_char_id');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 4294967295) {
    throw new AdminRecoveryError(422, 'invalid_char_id');
  }
  return id;
}

function parseState(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    accountId: Number(row[0]), revision: Number(row[1]),
    controlOwner: row[2], ownershipState: row[3], runtimeState: row[4],
    agentEnabled: row[5] === '1', online: row[6] === '1',
    pendingRecovery: Number(row[7]), lastMap: row[8], hp: Number(row[9]),
    agentMode: row[10], taskType: row[11], targetMap: row[12],
    lastErrorCode: row[13], resident: row[14] === '1',
  };
}

export function createAdminQuarantineRecoveryTransport({ sql, audit, issueGrant }) {
  async function readState(charId) {
    return parseState(await sql(`SELECT s.account_id,s.revision,s.control_owner,s.ownership_state,
      s.runtime_state,s.agent_enabled,c.online,
      (SELECT COUNT(*) FROM persistent_agent_command p WHERE p.char_id=s.char_id
        AND p.action='recover_quarantined_to_idle' AND p.command_status IN ('QUEUED','ACCEPTED')),
      COALESCE(c.last_map,''),c.hp,COALESCE(s.agent_mode,''),COALESCE(s.task_type,''),
      COALESCE(s.target_map,''),COALESCE(s.last_error_code,''),COALESCE(l.resident,0)
      FROM persistent_agent_state s JOIN \`char\` c ON c.char_id=s.char_id
      LEFT JOIN persistent_agent_live_status l ON l.char_id=s.char_id
      WHERE s.char_id=${charId} LIMIT 1;`));
  }

  async function submit({ charId: rawCharId, adminContext, originAllowed, supportSession }) {
    const timestamp = Date.now();
    let charId = 0;
    let beforeState = null;
    let commandId = null;
    const actor = adminContext?.actorAdminId ?? null;
    try {
      authorizeAdminRecovery({ adminContext, originAllowed, supportSession });
      charId = parseRecoveryCharId(rawCharId);
      beforeState = await readState(charId);
      if (!beforeState) throw new AdminRecoveryError(404, 'character_not_found');
      if (beforeState.ownershipState !== 'QUARANTINED' ||
          beforeState.runtimeState !== 'QUARANTINED') {
        throw new AdminRecoveryError(409, 'NOT_QUARANTINED');
      }
      if (!beforeState.agentEnabled || beforeState.controlOwner !== 'SERVER_AGENT' ||
          beforeState.online || beforeState.pendingRecovery !== 0 ||
          !beforeState.lastMap || beforeState.hp <= 0 ||
          !Number.isSafeInteger(beforeState.revision)) {
        throw new AdminRecoveryError(409, 'RECOVERY_PRECONDITION_BLOCKED');
      }
      await audit({ adminIdentity: actor, charId, commandId: null,
        action: ADMIN_RECOVERY_ACTION, beforeState, result: 'ADMITTED', afterState: null, timestamp });
      const sessionId = adminContext.sessionId || randomUUID();
      if (!COMMAND_PATTERN.test(sessionId)) throw new AdminRecoveryError(403, 'admin_auth_required');
      if (!adminContext.sessionId) {
        if (!issueGrant) throw new AdminRecoveryError(403, 'admin_auth_required');
        await issueGrant({ sessionId, actorAdminId: actor, authMethod: adminContext.authMethod });
      }
      commandId = randomUUID();
      const payload = JSON.stringify({ adminSessionId: sessionId, accountId: beforeState.accountId });
      const payloadHash = createHash('sha256')
        .update(`${ADMIN_RECOVERY_ACTION}\0${charId}\0${beforeState.revision}\0${payload}`)
        .digest('hex');
      const inserted = await sql(`INSERT INTO persistent_agent_command
        (command_id,char_id,action,payload,payload_hash,expected_revision,command_status,requested_at)
        SELECT '${commandId}',s.char_id,'${ADMIN_RECOVERY_ACTION}','${payload}',
        '${payloadHash}',s.revision,'QUEUED',CURRENT_TIMESTAMP(3)
        FROM persistent_agent_state s JOIN \`char\` c ON c.char_id=s.char_id
        JOIN web_admin_sessions a ON a.session_id='${sessionId}'
        WHERE s.char_id=${charId} AND s.account_id=${beforeState.accountId}
          AND s.revision=${beforeState.revision} AND s.agent_enabled=1
          AND s.control_owner='SERVER_AGENT' AND s.ownership_state='QUARANTINED'
          AND s.runtime_state='QUARANTINED' AND c.online=0
          AND a.revoked_at IS NULL AND a.expires_at>UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000
          AND a.actor_admin_id<>''
          AND NOT EXISTS (SELECT 1 FROM persistent_agent_command p
            WHERE p.char_id=s.char_id AND p.action='recover_quarantined_to_idle'
              AND p.command_status IN ('QUEUED','ACCEPTED'));
        SELECT ROW_COUNT();`);
      if (inserted !== '1') throw new AdminRecoveryError(409, 'COMMAND_ADMISSION_FAILED');
      await audit({ adminIdentity: actor, charId, commandId,
        action: ADMIN_RECOVERY_ACTION, beforeState, result: 'QUEUED', afterState: null, timestamp });
      return { status: 202, body: { ok: true, charId, commandId, state: 'QUEUED' } };
    } catch (error) {
      await audit({ adminIdentity: actor, charId, commandId,
        action: ADMIN_RECOVERY_ACTION, beforeState, result: error.code ?? 'FAILED',
        afterState: null, timestamp });
      if (error instanceof AdminRecoveryError) {
        return { status: error.status, body: { ok: false, error: error.code } };
      }
      throw error;
    }
  }

  async function result({ charId: rawCharId, commandId, adminContext, originAllowed, supportSession }) {
    authorizeAdminRecovery({ adminContext, originAllowed, supportSession });
    const charId = parseRecoveryCharId(rawCharId);
    if (!COMMAND_PATTERN.test(String(commandId ?? ''))) {
      throw new AdminRecoveryError(422, 'invalid_command_id');
    }
    const output = await sql(`SELECT command_status,COALESCE(reason_code,'')
      FROM persistent_agent_command WHERE command_id='${commandId}'
      AND char_id=${charId} AND action='${ADMIN_RECOVERY_ACTION}' LIMIT 1;`);
    if (!output) throw new AdminRecoveryError(404, 'command_not_found');
    const [commandStatus, reasonCode] = output.split('\t');
    const afterState = await readState(charId);
    const recovered = commandStatus === 'CONFIRMED' &&
      afterState?.controlOwner === 'SERVER_AGENT' &&
      afterState.ownershipState === 'SERVER_AGENT' &&
      afterState.runtimeState === 'ACTIVE' &&
      afterState.agentMode === 'PERSISTENT_IDLE' && afterState.resident &&
      !afterState.taskType && !afterState.targetMap && afterState.pendingRecovery === 0;
    const state = recovered ? 'RECOVERED' : commandStatus === 'REJECTED' ? 'FAILED' : 'PENDING';
    if (state !== 'PENDING') {
      await audit({ adminIdentity: adminContext.actorAdminId, charId, commandId,
        action: ADMIN_RECOVERY_ACTION, beforeState: null, result: state,
        afterState, timestamp: Date.now() });
    }
    return { status: 200, body: { ok: recovered, charId, commandId, state,
      commandStatus, reasonCode, afterState } };
  }

  return { submit, result };
}
