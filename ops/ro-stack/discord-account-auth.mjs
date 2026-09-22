import { randomBytes } from 'node:crypto';
import { createDiscordOAuth, discordStateHash } from './discord-oauth.mjs';
import { IdentityError } from './account-external-identity.mjs';

export const DISCORD_FLOW_COOKIE = 'gi_discord_flow';
export const DISCORD_ERRORS = Object.freeze({
  discord_oauth_not_configured: 'Discord 登入尚未設定。',
  discord_oauth_state_invalid: '驗證已失效或已使用，請重新開始。',
  discord_oauth_cancelled: '已取消 Discord 授權。',
  discord_account_not_linked: '此 Discord 尚未綁定。請先以原帳號登入，或使用現有註冊流程，再到帳號設定綁定。',
  discord_identity_already_linked: '此 Discord 或 Ghost Island 帳號已有其他綁定。',
  discord_link_session_required: '請以原帳號重新登入，再開始綁定。',
  discord_unlink_requires_alternative_login: '請先建立另一種登入方式，再解除 Discord 綁定。',
  discord_account_unavailable: '此帳號目前無法登入。',
  discord_link_required: '需要綁定 Discord 才能繼續。',
  discord_guild_membership_unavailable: '官方 Discord 成員驗證尚未設定。',
  discord_guild_membership_required: '需要官方 Discord 成員資格才能繼續。',
  discord_oauth_failed: 'Discord 驗證未完成，請稍後重試。',
});
const flowPattern = /^[A-Za-z0-9_-]{43}$/;
const flag = (value) => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
const cookieValue = (request, name) =>
  String(request.headers.cookie ?? '').split(';').map((s) => s.trim())
    .find((s) => s.startsWith(name + '='))?.slice(name.length + 1) ?? '';

export function discordAccessGate({ linked, linkRequired, guildMembershipRequired, guildMember }) {
  if ((linkRequired || guildMembershipRequired) && !linked) return 'discord_link_required';
  if (guildMembershipRequired && guildMember !== true)
    return guildMember === false ? 'discord_guild_membership_required' : 'discord_guild_membership_unavailable';
  return null;
}

export function createDiscordAccountAuth({
  store, env = process.env, fetchImpl, now = () => Date.now(),
  invalidateSession = () => {}, guildMembershipChecker = null,
}) {
  const oauth = createDiscordOAuth({
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: env.DISCORD_REDIRECT_URI,
    fetchImpl,
  });
  const linkRequired = flag(env.DISCORD_LINK_REQUIRED);
  const guildMembershipRequired = flag(env.DISCORD_GUILD_MEMBERSHIP_REQUIRED);
  const guildId = String(env.DISCORD_GUILD_ID ?? '');
  const secure = oauth.redirectUri?.startsWith('https:') ?? false;
  const flowCookie = (value, maxAge = 600) =>
    DISCORD_FLOW_COOKIE + '=' + value + '; HttpOnly; SameSite=Lax; Path=/auth/discord; Max-Age=' + maxAge + (secure ? '; Secure' : '');
  const sessionCookie = (token) =>
    'ro_session=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800' + (secure ? '; Secure' : '');
  const sessionHash = (request) => discordStateHash(cookieValue(request, 'ro_session'));
  function assertHost(request) {
    if (!oauth.configured) throw new IdentityError('discord_oauth_not_configured', 503);
    if (String(request.headers.host).toLowerCase() !== new URL(oauth.redirectUri).host.toLowerCase())
      throw new IdentityError('discord_redirect_origin_mismatch', 403);
  }
  function assertAccount(account) {
    if (!account || account.supportSessionId)
      throw new IdentityError('discord_link_session_required', 401);
  }
  return {
    configured: oauth.configured,
    requiresAccessCheck: linkRequired || guildMembershipRequired,
    async view(account = null) {
      const row = account && !account.supportSessionId ? await store.identity(account.accountId) : null;
      const identity = row ? {
        provider: 'discord', providerUserId: String(row.provider_user_id),
        displayName: row.display_name, avatarUrl: row.avatar_url,
        linkedAt: Number(row.linked_at),
        lastLoginAt: row.last_login_at == null ? null : Number(row.last_login_at),
      } : null;
      let guildMember = null;
      if (guildMembershipRequired && identity && guildId && guildMembershipChecker) {
        try {
          guildMember = await guildMembershipChecker({
            accountId: account.accountId, providerUserId: identity.providerUserId, guildId,
          });
        } catch { guildMember = null; }
      }
      const result = {
        configured: oauth.configured, linked: Boolean(identity), identity,
        linkRequired, guildMembershipRequired,
        managementAllowed: Boolean(account && !account.supportSessionId),
      };
      return { ...result, accessGate: account ? discordAccessGate({ ...result, guildMember }) : null };
    },
    async begin(request, intent, account = null) {
      assertHost(request);
      if (!['LOGIN', 'LINK'].includes(intent)) throw new IdentityError('discord_oauth_state_invalid');
      if (intent === 'LINK') assertAccount(account);
      const state = randomBytes(32).toString('base64url');
      const browser = randomBytes(32).toString('base64url');
      await store.createState({
        stateHash: discordStateHash(state), browserHash: discordStateHash(browser),
        sessionHash: sessionHash(request), intent,
        accountId: intent === 'LINK' ? Number(account.accountId) : null,
        redirectUri: oauth.redirectUri, expiresAt: now() + 600000,
      }, now());
      return { location: oauth.authorizationUrl(state), cookie: flowCookie(browser) };
    },
    async callback(request, url) {
      assertHost(request);
      const state = url.searchParams.get('state') ?? '';
      const browser = cookieValue(request, DISCORD_FLOW_COOKIE);
      if (!flowPattern.test(state) || !flowPattern.test(browser))
        throw new IdentityError('discord_oauth_state_invalid');
      const oldSessionHash = sessionHash(request);
      const record = await store.consumeState({
        stateHash: discordStateHash(state), browserHash: discordStateHash(browser),
        sessionHash: oldSessionHash, redirectUri: oauth.redirectUri, now: now(),
      });
      if (url.searchParams.has('error')) throw new IdentityError('discord_oauth_cancelled');
      const code = url.searchParams.get('code') ?? '';
      if (!code || code.length > 2048) throw new IdentityError('discord_oauth_failed');
      const accessToken = await oauth.exchangeCode(code);
      const identity = await oauth.fetchIdentity(accessToken);
      const token = randomBytes(32).toString('hex');
      const result = await store.finish({
        state: record, identity, oldSessionHash, newSessionHash: discordStateHash(token), now: now(),
      });
      invalidateSession(oldSessionHash);
      return { accountId: result.accountId, status: record.intent === 'LINK' ? 'linked' : 'logged_in',
        cookies: [sessionCookie(token), flowCookie('', 0)] };
    },
    clearFlowCookie: () => flowCookie('', 0),
    async unlink(request, account) {
      assertAccount(account);
      return store.unlink({ accountId: Number(account.accountId), sessionHash: sessionHash(request), now: now() });
    },
  };
}

// Route adapter shared by the Dashboard and the isolated HTTP acceptance test.
export function createDiscordRouteHandler({ auth, getAccount, originAllowed, allowStart = () => true }) {
  const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
  const send = (response, status, body, extra = {}) => {
    response.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8', ...extra });
    response.end(JSON.stringify(body));
  };
  const redirect = (response, location, cookies) => {
    response.writeHead(303, { ...headers, location, ...(cookies ? { 'set-cookie': cookies } : {}) });
    response.end();
  };
  return async function handle(url, request, response) {
    if (!['/auth/discord', '/auth/discord/callback', '/api/account/discord', '/api/account/discord/link'].includes(url.pathname))
      return false;
    const callback = url.pathname === '/auth/discord/callback';
    try {
      if (callback && request.method === 'GET') {
        const result = await auth.callback(request, url);
        redirect(response, '/?discord=' + result.status, result.cookies);
      } else if (url.pathname === '/auth/discord' && request.method === 'GET') {
        // GET is login-only. Account linking starts with a same-origin POST.
        if (!allowStart(request)) throw new IdentityError('discord_rate_limited', 429);
        const result = await auth.begin(request, 'LOGIN');
        redirect(response, result.location, result.cookie);
      } else if (url.pathname === '/api/account/discord' && request.method === 'GET') {
        send(response, 200, { discord: await auth.view(await getAccount(request)) });
      } else if (
        (url.pathname === '/api/account/discord/link' && request.method === 'POST') ||
        (url.pathname === '/api/account/discord' && request.method === 'DELETE')
      ) {
        if (!originAllowed(request)) throw new IdentityError('discord_csrf_rejected', 403);
        const account = await getAccount(request);
        if (request.method === 'POST') {
          if (!allowStart(request)) throw new IdentityError('discord_rate_limited', 429);
          const result = await auth.begin(request, 'LINK', account);
          send(response, 200, { authorizationUrl: result.location }, { 'set-cookie': result.cookie });
        } else {
          await auth.unlink(request, account);
          send(response, 200, { unlinked: true, discord: await auth.view(account) });
        }
      } else send(response, 405, { error: 'method_not_allowed' });
    } catch (error) {
      const code = Object.hasOwn(DISCORD_ERRORS, error?.message) ? error.message : 'discord_oauth_failed';
      if (callback) redirect(response, '/?discord=' + code, auth.clearFlowCookie());
      else send(response, error?.statusCode ?? 503, { error: DISCORD_ERRORS[code], code });
    }
    return true;
  };
}
