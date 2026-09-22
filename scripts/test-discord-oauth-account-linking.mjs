import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDiscordAccountAuth, createDiscordRouteHandler } from '../ops/ro-stack/discord-account-auth.mjs';
import { IdentityError } from '../ops/ro-stack/account-external-identity.mjs';
import { discordStateHash } from '../ops/ro-stack/discord-oauth.mjs';

const now = 1_800_000_000_000;
const redirectUri = 'http://127.0.0.1:8788/auth/discord/callback';
const identities = new Map();
const states = new Map();
const accounts = new Map([
  [101, { accountId: 101, passwordCredential: true }],
  [102, { accountId: 102, passwordCredential: false }],
]);
const sessions = new Map([[discordStateHash('old-session'), 101], [discordStateHash('second-session'), 102]]);
const providerIdentity = (id) => ({
  provider_user_id: id,
  display_name: '測試 Discord',
  avatar_url: null,
  linked_at: now,
  last_login_at: now,
});
const store = {
  async identity(accountId) {
    return [...identities.values()].find((row) => row.account_id === accountId) ?? null;
  },
  async createState(state) {
    if (state.intent === 'LINK' && sessions.get(state.sessionHash) !== state.accountId)
      throw new IdentityError('discord_link_session_required', 401);
    states.set(state.stateHash, { ...state, consumed: false });
  },
  async consumeState(input) {
    const row = states.get(input.stateHash);
    if (!row || row.consumed || row.expiresAt <= input.now || row.browserHash !== input.browserHash ||
        row.sessionHash !== input.sessionHash || row.redirectUri !== input.redirectUri)
      throw new IdentityError('discord_oauth_state_invalid');
    row.consumed = true;
    return { intent: row.intent, accountId: row.accountId };
  },
  async finish({ state, identity, oldSessionHash, newSessionHash }) {
    if (state.intent === 'LINK' && sessions.get(oldSessionHash) !== state.accountId)
      throw new IdentityError('discord_link_session_required', 401);
    const existing = identities.get(identity.providerUserId);
    let accountId = state.accountId;
    if (state.intent === 'LOGIN') {
      if (!existing) throw new IdentityError('discord_account_not_linked', 403);
      accountId = existing.account_id;
    } else if (existing && existing.account_id !== accountId) {
      throw new IdentityError('discord_identity_already_linked', 409);
    }
    if (!accounts.has(accountId)) throw new IdentityError('discord_account_unavailable', 403);
    identities.set(identity.providerUserId, {
      account_id: accountId,
      provider_user_id: identity.providerUserId,
      display_name: identity.displayName,
      avatar_url: identity.avatarUrl,
      linked_at: now,
      last_login_at: state.intent === 'LOGIN' ? now : null,
    });
    if (oldSessionHash) sessions.delete(oldSessionHash);
    sessions.set(newSessionHash, accountId);
    return { accountId };
  },
  async unlink({ accountId, sessionHash }) {
    if (sessions.get(sessionHash) !== accountId)
      throw new IdentityError('discord_link_session_required', 401);
    const current = [...identities.entries()].find(([, row]) => row.account_id === accountId);
    if (!current) throw new IdentityError('discord_identity_not_linked', 404);
    if (!accounts.get(accountId)?.passwordCredential)
      throw new IdentityError('discord_unlink_requires_alternative_login', 409);
    identities.delete(current[0]);
    return { unlinked: true };
  },
};
const fetchImpl = async (url, init = {}) => {
  if (url.includes('/oauth2/token')) {
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(new URLSearchParams(init.body).get('client_secret'), 'server-only-secret');
    return new Response(JSON.stringify({
      access_token: 'short-lived-access-token',
      token_type: 'Bearer',
      scope: 'identify',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  assert.equal(init.headers.authorization, 'Bearer short-lived-access-token');
  return new Response(JSON.stringify({
    id: '123456789012345678',
    username: 'discord-user',
    global_name: 'Discord 使用者',
    avatar: null,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const auth = createDiscordAccountAuth({
  store,
  fetchImpl,
  now: () => now,
  env: {
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_CLIENT_SECRET: 'server-only-secret',
    DISCORD_REDIRECT_URI: redirectUri,
  },
  invalidateSession: () => {},
});
const request = (cookie = '') => ({
  headers: { host: '127.0.0.1:8788', cookie },
});
const cookieValue = (header, name) => header.split(';')[0].slice(name.length + 1);
const callbackUrl = (location, code = 'code-1') => {
  const url = new URL(location);
  return new URL(redirectUri + '?code=' + code + '&state=' + url.searchParams.get('state'));
};

const linked = providerIdentity('123456789012345678');
identities.set(linked.provider_user_id, { ...linked, account_id: 101 });
const loginStart = await auth.begin(request(), 'LOGIN');
const loginBrowser = cookieValue(loginStart.cookie, 'gi_discord_flow');
const loginCallbackRequest = request('gi_discord_flow=' + loginBrowser);
const loginResult = await auth.callback(loginCallbackRequest, callbackUrl(loginStart.location));
assert.equal(loginResult.accountId, 101);
assert.equal(loginResult.status, 'logged_in');
assert.ok(loginResult.cookies.some((value) => value.startsWith('ro_session=')));

await assert.rejects(
  () => auth.callback(loginCallbackRequest, callbackUrl(loginStart.location, 'replay')),
  (error) => error.message === 'discord_oauth_state_invalid',
);

identities.delete(linked.provider_user_id);
const unknownStart = await auth.begin(request(), 'LOGIN');
const unknownBrowser = cookieValue(unknownStart.cookie, 'gi_discord_flow');
await assert.rejects(
  () => auth.callback(request('gi_discord_flow=' + unknownBrowser), callbackUrl(unknownStart.location, 'unknown')),
  (error) => error.message === 'discord_account_not_linked',
);
identities.set(linked.provider_user_id, { ...linked, account_id: 101 });

const linkStart = await auth.begin(request('ro_session=old-session'), 'LINK', { accountId: 101 });
const linkBrowser = cookieValue(linkStart.cookie, 'gi_discord_flow');
const linkResult = await auth.callback(
  request('ro_session=old-session; gi_discord_flow=' + linkBrowser),
  callbackUrl(linkStart.location, 'link'),
);
assert.equal(linkResult.accountId, 101);
const rotatedToken = cookieValue(linkResult.cookies[0], 'ro_session');
assert.notEqual(rotatedToken, 'old-session');
assert.equal(sessions.has(discordStateHash('old-session')), false);
assert.equal(sessions.get(discordStateHash(rotatedToken)), 101);

const secondLinkStart = await auth.begin(request('ro_session=second-session'), 'LINK', { accountId: 102 });
const secondLinkBrowser = cookieValue(secondLinkStart.cookie, 'gi_discord_flow');
await assert.rejects(
  () => auth.callback(
    request('ro_session=second-session; gi_discord_flow=' + secondLinkBrowser),
    callbackUrl(secondLinkStart.location, 'second'),
  ),
  (error) => error.message === 'discord_identity_already_linked',
);

const invalidState = await auth.begin(request(), 'LOGIN');
const invalidBrowser = cookieValue(invalidState.cookie, 'gi_discord_flow');
await assert.rejects(
  () => auth.callback(
    request('gi_discord_flow=' + invalidBrowser),
    new URL(redirectUri + '?state=invalid'),
  ),
  (error) => error.message === 'discord_oauth_state_invalid',
);

const missingSecret = createDiscordAccountAuth({
  store,
  env: { DISCORD_CLIENT_ID: 'client-id', DISCORD_REDIRECT_URI: redirectUri },
  fetchImpl,
});
await assert.rejects(
  () => missingSecret.begin(request(), 'LOGIN'),
  (error) => error.message === 'discord_oauth_not_configured',
);

const gateAuth = createDiscordAccountAuth({
  store,
  env: {
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_CLIENT_SECRET: 'server-only-secret',
    DISCORD_REDIRECT_URI: redirectUri,
    DISCORD_LINK_REQUIRED: 'true',
  },
  fetchImpl,
});
assert.equal((await gateAuth.view({ accountId: 101 })).accessGate, null);
assert.equal((await gateAuth.view({ accountId: 102 })).accessGate, 'discord_link_required');
assert.equal((await auth.view({ accountId: 102 })).accessGate, null);

assert.deepEqual(await auth.unlink(request('ro_session=' + rotatedToken), { accountId: 101 }), { unlinked: true });
identities.set(linked.provider_user_id, { ...linked, account_id: 102 });
await assert.rejects(
  () => auth.unlink(request('ro_session=second-session'), { accountId: 102 }),
  (error) => error.message === 'discord_unlink_requires_alternative_login',
);

const html = await readFile('ops/ro-stack/dashboard/index.html', 'utf8');
const app = await readFile('ops/ro-stack/dashboard/app.js', 'utf8');
const migration = await readFile('ops/ro-stack/sql/011-discord-account-linking.sql', 'utf8');
assert.match(html, /id="discordLoginButton"/);
assert.equal((html.match(/id="discordLoginButton"/g) ?? []).length, 1);
assert.match(html, /id="discordLinkButton"/);
assert.match(html, /id="discordUnlinkButton"/);
assert.match(app, /\/api\/account\/discord\/link/);
assert.match(migration, /UNIQUE KEY uq_external_provider_user/);
assert.match(migration, /state_hash/);

const response = {
  headers: null,
  statusCode: null,
  body: '',
  writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
  end(body = '') { this.body += body; },
};
const route = createDiscordRouteHandler({
  auth,
  getAccount: async () => null,
  originAllowed: () => true,
});
assert.equal(await route(new URL('http://127.0.0.1:8788/api/account/discord'), { method: 'GET', headers: {} }, response), true);
assert.equal(response.statusCode, 200);

console.log(JSON.stringify({
  result: 'DISCORD_OAUTH_ACCOUNT_LINKING_SOURCE_TEST_PASS',
  checks: 11,
  unknownLogin: 'rejected',
  replay: 'rejected',
  sessionRotation: 'verified',
  unlinkSafety: 'verified',
}));
