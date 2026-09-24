export const SUPPORT_SESSION_MODE = Object.freeze({
  OBSERVE_ONLY: 'OBSERVE_ONLY',
  PLAYER_ACTIONS: 'PLAYER_ACTIONS',
});

export const SUPPORT_SESSION_CREATED_FROM = 'ADMIN_SUPPORT_UI';
export const SUPPORT_SESSION_CONTEXT = 'SUPPORT_IMPERSONATION';
export const SUPPORT_SESSION_DEFAULT_TTL_MS = 15 * 60 * 1000;
export const SUPPORT_SESSION_MAX_TTL_MS = 60 * 60 * 1000;

const PLAYER_ACTION_ENDPOINTS = new Map([
  ['/api/grind-target', 'change_farm_map'],
  ['/api/status-point', 'allocate_status_point'],
  ['/api/skill-point', 'allocate_skill_point'],
  ['/api/job-change', 'job_change'],
  ['/api/npc-dialog', 'npc_dialog'],
  ['/api/onboarding/resume', 'onboarding_resume'],
  ['/api/onboarding/advance', 'onboarding_advance'],
  ['/api/onboarding/graduate', 'onboarding_graduate'],
  ['/api/eden/enroll', 'eden_enroll'],
  ['/api/eden/task', 'eden_task'],
  ['/api/character-reset', 'character_reset'],
  ['/api/web-presence', 'web_presence'],
  ['/api/web-experience/telemetry', 'web_experience_telemetry'],
]);
const ITEM_ACTIONS = new Set(['use', 'equip', 'unequip']);

const SUPPORT_REASON_MAX = 256;
const ACTOR_PATTERN = /^[A-Za-z0-9._:@+\-]{1,128}$/;

export function normalizeSupportSessionInput(input = {}, now = Date.now()) {
  const mode = String(input.mode ?? SUPPORT_SESSION_MODE.OBSERVE_ONLY).trim();
  if (!Object.values(SUPPORT_SESSION_MODE).includes(mode))
    return { ok: false, error: 'support_mode_invalid' };
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 3 || reason.length > SUPPORT_REASON_MAX)
    return { ok: false, error: 'support_reason_required' };
  const ttlMinutes = Number(input.ttlMinutes ?? SUPPORT_SESSION_DEFAULT_TTL_MS / 60000);
  if (!Number.isSafeInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > SUPPORT_SESSION_MAX_TTL_MS / 60000)
    return { ok: false, error: 'support_ttl_invalid' };
  const charId = Number(input.effectiveCharId ?? input.charId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    return { ok: false, error: 'support_character_required' };
  return {
    ok: true,
    mode,
    reason,
    effectiveCharId: charId,
    ttlMinutes,
    createdAt: now,
    expiresAt: now + ttlMinutes * 60_000,
  };
}

export function normalizeSupportActor(actor) {
  const value = String(actor ?? '').trim();
  return ACTOR_PATTERN.test(value) ? value : null;
}

export function supportMutationAllowed(context) {
  return Boolean(context?.supportSessionId) &&
    (context.mode ?? context.supportMode) === SUPPORT_SESSION_MODE.PLAYER_ACTIONS;
}

export function classifySupportMutation(context, input = {}) {
  const method = String(input.method ?? '').toUpperCase();
  const path = String(input.path ?? '');
  const body = input.body && typeof input.body === 'object' ? input.body : {};
  if (!context?.supportSessionId)
    return { allowed: false, actionKey: 'unknown', resource: path, errorCode: 'support_session_required' };
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
    return { allowed: true, actionKey: 'read', resource: path, errorCode: null };
  if (path === '/api/support-session/revoke' && method === 'POST')
    return { allowed: true, actionKey: 'support_session_revoke', resource: path, errorCode: null };
  if ((context.mode ?? context.supportMode) !== SUPPORT_SESSION_MODE.PLAYER_ACTIONS)
    return { allowed: false, actionKey: 'mutation', resource: path, errorCode: 'support_observe_only' };
  if (path === '/api/automation' && method === 'POST') {
    if (body.action === 'start')
      return { allowed: true, actionKey: 'start_farm', resource: path, errorCode: null };
    if (body.action === 'stop')
      return { allowed: true, actionKey: 'stop_farm', resource: path, errorCode: null };
    return { allowed: false, actionKey: 'automation_unknown', resource: path, errorCode: 'support_action_denied' };
  }
  if (path === '/api/item-action' && method === 'POST') {
    const action = String(body.action ?? '').toLowerCase();
    if (ITEM_ACTIONS.has(action))
      return { allowed: true, actionKey: `${action}_item`, resource: path, errorCode: null };
    return { allowed: false, actionKey: 'item_action_unknown', resource: path, errorCode: 'support_action_denied' };
  }
  const actionKey = method === 'POST' ? PLAYER_ACTION_ENDPOINTS.get(path) : null;
  if (actionKey) return { allowed: true, actionKey, resource: path, errorCode: null };
  return { allowed: false, actionKey: 'unknown_mutation', resource: path, errorCode: 'support_mutation_denied' };
}

export function supportContextView(context, now = Date.now()) {
  if (!context?.supportSessionId) return null;
  return {
    context: SUPPORT_SESSION_CONTEXT,
    supportSessionId: context.supportSessionId,
    actorAdminId: context.actorAdminId,
    effectiveAccountId: Number(context.accountId),
    effectiveCharId: Number(context.characterId),
    mode: context.mode,
    reason: context.reason,
    createdFrom: context.createdFrom,
    createdAt: Number(context.createdAt),
    expiresAt: Number(context.expiresAt),
    remainingMs: Math.max(0, Number(context.expiresAt) - now),
  };
}

export function redactSupportAuditEvent(event = {}) {
  return {
    eventType: String(event.eventType ?? ''),
    supportSessionId: String(event.supportSessionId ?? ''),
    actorAdminId: String(event.actorAdminId ?? ''),
    effectiveAccountId: Number(event.effectiveAccountId ?? 0),
    effectiveCharId: Number(event.effectiveCharId ?? 0),
    reason: String(event.reason ?? '').slice(0, SUPPORT_REASON_MAX),
    mode: String(event.mode ?? ''),
    createdFrom: String(event.createdFrom ?? SUPPORT_SESSION_CREATED_FROM),
    occurredAt: Number(event.occurredAt ?? Date.now()),
    traceId: event.traceId ? String(event.traceId).slice(0, 96) : null,
  };
}

export function redactSupportActionAudit(event = {}) {
  return {
    supportSessionId: String(event.supportSessionId ?? ''),
    actorAdminId: String(event.actorAdminId ?? ''),
    effectiveAccountId: Number(event.effectiveAccountId ?? 0),
    effectiveCharId: Number(event.effectiveCharId ?? 0),
    actionKey: String(event.actionKey ?? 'unknown').slice(0, 96),
    resource: String(event.resource ?? '').slice(0, 192),
    commandId: event.commandId ? String(event.commandId).slice(0, 96) : null,
    result: String(event.result ?? 'UNKNOWN').slice(0, 32),
    errorCode: event.errorCode ? String(event.errorCode).slice(0, 96) : null,
    traceId: event.traceId ? String(event.traceId).slice(0, 96) : null,
    occurredAt: Number(event.occurredAt ?? Date.now()),
  };
}
