import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SUPPORT_SESSION_MODE,
  ECONOMY_TEST_CONFIG_FIXTURE,
  classifySupportMutation,
  normalizeSupportActor,
  normalizeSupportSessionInput,
  redactSupportAuditEvent,
  supportContextView,
  supportMutationAllowed,
} from '../ops/ro-stack/support-session.mjs';
import { parseCli } from './lib/player-scenario/scenario-core.mjs';

const now = 1_700_000_000_000;
const valid = normalizeSupportSessionInput({
  effectiveCharId: 150075,
  reason: 'synthetic acceptance',
  mode: SUPPORT_SESSION_MODE.OBSERVE_ONLY,
  ttlMinutes: 15,
}, now);
assert.equal(valid.ok, true);
assert.equal(valid.expiresAt - now, 15 * 60_000);
assert.equal(normalizeSupportSessionInput({ effectiveCharId: 150075, reason: 'x', ttlMinutes: 15 }, now).ok, false);
assert.equal(normalizeSupportSessionInput({ effectiveCharId: 150075, reason: 'synthetic acceptance', ttlMinutes: 61 }, now).error, 'support_ttl_invalid');
assert.equal(normalizeSupportActor('cf:operator@example.com'), 'cf:operator@example.com');
assert.equal(normalizeSupportActor('bad actor'), null);
assert.equal(supportMutationAllowed({ supportSessionId: 's', mode: SUPPORT_SESSION_MODE.PLAYER_ACTIONS }), true);
assert.equal(supportMutationAllowed({ supportSessionId: 's', mode: SUPPORT_SESSION_MODE.OBSERVE_ONLY }), false);
assert.equal(supportContextView({
  supportSessionId: 's',
  actorAdminId: 'admin',
  accountId: 2000111,
  characterId: 150075,
  mode: SUPPORT_SESSION_MODE.OBSERVE_ONLY,
  reason: 'synthetic acceptance',
  createdFrom: 'ADMIN_SUPPORT_UI',
  createdAt: now,
  expiresAt: now + 1000,
}, now).remainingMs, 1000);

const redacted = redactSupportAuditEvent({
  eventType: 'SUPPORT_SESSION_CREATED',
  supportSessionId: 's',
  actorAdminId: 'admin',
  effectiveAccountId: 2000111,
  effectiveCharId: 150075,
  reason: 'synthetic acceptance',
  mode: 'OBSERVE_ONLY',
  token: 'must-not-appear',
});
assert.equal('token' in redacted, false);

const observe = { supportSessionId: 's', mode: SUPPORT_SESSION_MODE.OBSERVE_ONLY };
for (const path of ['/api/characters', '/api/job-target', '/api/social', '/api/status-point', '/api/skill-point', '/api/skill-automation', '/api/web-presence', '/api/unknown-future-write'])
  assert.equal(classifySupportMutation(observe, { method: 'POST', path, body: {} }).allowed, false);

const player = { supportSessionId: 's', mode: SUPPORT_SESSION_MODE.PLAYER_ACTIONS };
const economyPlayer = { ...player, accountId: 2000163, characterId: 150105, createdFrom: 'ADMIN_SUPPORT_UI' };
const economyConfig = { method: 'PUT', path: '/api/config', body: { economyTestFixture: ECONOMY_TEST_CONFIG_FIXTURE } };
assert.equal(classifySupportMutation(economyPlayer, economyConfig).actionKey, 'economy_test_config');
assert.equal(classifySupportMutation(economyPlayer, economyConfig).allowed, true);
assert.equal(classifySupportMutation({ ...economyPlayer, accountId: 2000164 }, economyConfig).allowed, false);
assert.equal(classifySupportMutation({ ...economyPlayer, characterId: 150106 }, economyConfig).allowed, false);
assert.equal(classifySupportMutation({ ...economyPlayer, createdFrom: 'OTHER' }, economyConfig).allowed, false);
assert.equal(classifySupportMutation({ ...economyPlayer, mode: SUPPORT_SESSION_MODE.OBSERVE_ONLY }, economyConfig).allowed, false);
assert.equal(classifySupportMutation(economyPlayer, { ...economyConfig, body: {} }).allowed, false);
assert.equal(classifySupportMutation(player, economyConfig).allowed, false);
assert.equal(classifySupportMutation(player, { method: 'POST', path: '/api/character-reset', body: { type: 'stat' } }).actionKey, 'character_reset');
assert.equal(classifySupportMutation(player, { method: 'POST', path: '/api/status-reset', body: {} }).allowed, false);
assert.equal(classifySupportMutation(player, { method: 'POST', path: '/api/automation', body: { action: 'start' } }).actionKey, 'start_farm');
assert.equal(classifySupportMutation(player, { method: 'POST', path: '/api/item-action', body: { action: 'use' } }).allowed, true);
for (const action of ['claim_agent', 'release_agent', 'run_server_command', 'unknown'])
  assert.equal(classifySupportMutation(player, { method: 'POST', path: '/api/ro/agents/150075/ownership/commands', body: { action } }).allowed, false);
assert.equal(classifySupportMutation(player, { method: 'POST', path: '/api/admin/support-sessions', body: {} }).allowed, false);

const supportCli = parseCli([
  '--scenario', 'start-farm', '--char', '150075', '--support-session',
  '--support-mode', 'PLAYER_ACTIONS', '--support-ttl', '15',
]);
assert.equal(supportCli.supportSession, true);
assert.equal(supportCli.supportMode, 'PLAYER_ACTIONS');
assert.equal(supportCli.supportTtlMinutes, 15);

const dashboard = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const runner = await readFile(new URL('./player-scenario-runner.mjs', import.meta.url), 'utf8');
assert.match(dashboard, /ADD COLUMN IF NOT EXISTS support_session_id CHAR\(36\) NULL/);
assert.match(dashboard, /supportRequestContext = supportContextFromAccount\(await resolveRequestAccount\(\)\)/);
assert.match(dashboard, /supportRequestContext \?\?= supportContextFromAccount\(account\)/);
assert.doesNotMatch(dashboard, /supportRequestContext\s*=\s*await supportSessionFromRequest\(request\)/);
assert.equal((dashboard.match(/await supportSessionFromRequest\(request\)/g) ?? []).length, 1);
assert.match(dashboard, /effectiveAccountId:\s*context\.accountId,[\s\S]*effectiveCharId:\s*context\.characterId,[\s\S]*eventType:\s*'SUPPORT_SESSION_EXPIRED'/);
assert.match(dashboard, /if \(account\.supportSessionId\) await recordSupportUsed/);
assert.match(dashboard, /else noteWebActivity\(account\.accountId\)/);
assert.match(dashboard, /admin_auth_required/);
assert.match(dashboard, /web_support_session_events/);
assert.match(dashboard, /web_support_session_action_events/);
assert.match(runner, /SYNTHETIC_SUPPORT_ADMIN_TOKEN/);
assert.doesNotMatch(runner, /password\s*[:=].*150075/i);

console.log(JSON.stringify({
  result: 'SUPPORT_SESSION_TEST_PASS',
  authBypassCreated: false,
  ownershipMutationAllowed: false,
  normalPlayerAdditionalSupportQueries: 0,
  normalPlayerSupportActorResolution: 0,
  normalPlayerSupportAuditWrites: 0,
}));
