function integer(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function parsePolicy(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    globalEnabled: row[0] === '1',
    edenCourseAEnabled: row[1] === '1',
    emergencyDisabled: row[2] === '1',
    revision: integer(row[3]),
    updatedAt: row[4] || null,
  };
}

export async function readPersistentAgentRollout(sql, accountId, charId, {
  requireEdenCourseA = false,
} = {}) {
  const aid = integer(accountId);
  const cid = integer(charId);
  if (aid <= 0 || cid <= 0)
    return { allowed: false, reason: 'rollout_identity_invalid', policy: null };
  try {
    const [policyOutput, allowlistOutput] = await Promise.all([
      sql("SELECT global_enabled,eden_course_a_enabled,emergency_disabled,revision,updated_at FROM persistent_agent_rollout_policy WHERE policy_id=1 LIMIT 1;"),
      sql(`SELECT COUNT(*) FROM persistent_agent_rollout_allowlist WHERE enabled=1 AND course_key='eden_course_a_v1' AND (account_id=${aid} OR char_id=${cid});`),
    ]);
    const policy = parsePolicy(policyOutput);
    if (!policy) return { allowed: false, reason: 'rollout_disabled', policy: null };
    if (policy.emergencyDisabled)
      return { allowed: false, reason: 'emergency_disabled', policy };
    if (!policy.globalEnabled)
      return { allowed: false, reason: 'rollout_disabled', policy };
    if (requireEdenCourseA && !policy.edenCourseAEnabled)
      return { allowed: false, reason: 'eden_course_a_disabled', policy };
    if (integer(allowlistOutput) < 1)
      return { allowed: false, reason: 'rollout_not_allowlisted', policy };
    return { allowed: true, reason: null, policy };
  } catch (error) {
    if (/persistent_agent_rollout_(policy|allowlist).*doesn't exist|does not exist/i.test(String(error?.message ?? error)))
      return { allowed: false, reason: 'rollout_schema_unavailable', policy: null };
    throw error;
  }
}

export function readEdenCourseARollout(sql, accountId, charId) {
  return readPersistentAgentRollout(sql, accountId, charId, {
    requireEdenCourseA: true,
  });
}

export async function recordRolloutEvent(sql, {
  accountId = 0,
  charId = 0,
  eventType,
  errorCode = null,
  commandId = null,
  durationMs = null,
}) {
  const safeEvent = String(eventType ?? '').replace(/[^A-Z0-9_]/g, '').slice(0, 48);
  const safeError = errorCode
    ? `'${String(errorCode).replaceAll("'", "''").slice(0, 64)}'`
    : 'NULL';
  const safeCommand = commandId && /^[0-9a-f-]{36}$/i.test(commandId)
    ? `'${commandId.toLowerCase()}'`
    : 'NULL';
  const safeDuration = Number.isSafeInteger(Number(durationMs)) && Number(durationMs) >= 0
    ? String(Number(durationMs))
    : 'NULL';
  if (!safeEvent) return;
  await sql(
    `INSERT INTO persistent_agent_rollout_event (account_id,char_id,event_type,error_code,command_id,duration_ms) VALUES (${integer(accountId)},${integer(charId)},'${safeEvent}',${safeError},${safeCommand},${safeDuration});`,
  );
}

export async function readRolloutTelemetry(sql) {
  const output = await sql(`SELECT
    (SELECT COUNT(*) FROM persistent_agent_state WHERE agent_enabled=1 AND control_owner='SERVER_AGENT' AND ownership_state='SERVER_AGENT'),
    (SELECT COUNT(*) FROM persistent_agent_state WHERE agent_enabled=1 AND control_owner='SERVER_AGENT' AND agent_mode='AUTO_QUEST'),
    (SELECT COUNT(*) FROM persistent_agent_command WHERE command_status='REJECTED' AND reason_code IN ('ownership_conflict','active_client','active_openkore')),
    (SELECT COUNT(*) FROM persistent_agent_state WHERE ownership_state='QUARANTINED'),
    (SELECT COUNT(*) FROM persistent_agent_rollout_event WHERE event_type='RESTART_RECOVERY'),
    (SELECT COUNT(*) FROM persistent_agent_rollout_event WHERE event_type='DUPLICATE_COMMAND_REJECTED'),
    (SELECT ROUND(AVG(duration_ms)) FROM persistent_agent_rollout_event WHERE event_type='COURSE_A_COMPLETED' AND duration_ms IS NOT NULL),
    (SELECT COUNT(*) FROM persistent_agent_rollout_event WHERE event_type='REWARD_CONFIRMATION_FAILED');`);
  const row = output ? output.split('\t') : [];
  const failures = await sql(`SELECT COALESCE(error_code,'unknown'),COUNT(*) FROM persistent_agent_rollout_event WHERE event_type='QUEST_FAILURE' GROUP BY error_code ORDER BY error_code;`);
  return {
    activeServerAgents: integer(row[0]),
    activeAutoQuest: integer(row[1]),
    ownershipConflicts: integer(row[2]),
    quarantinedCount: integer(row[3]),
    questFailuresByCode: Object.fromEntries(
      failures ? failures.split(/\r?\n/).map((line) => {
        const [code, count] = line.split('\t');
        return [code, integer(count)];
      }) : [],
    ),
    restartRecoveries: integer(row[4]),
    duplicateCommandRejects: integer(row[5]),
    averageCourseACompletionMs: row[6] && row[6].toUpperCase() !== 'NULL'
      ? integer(row[6])
      : null,
    rewardConfirmationFailures: integer(row[7]),
  };
}
