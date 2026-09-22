import { createHash } from 'node:crypto';
import { IdentityError } from './account-external-identity.mjs';

export const DISCORD_PROVIDER = 'discord';
export const DISCORD_IDENTIFY_SCOPE = 'identify';
export const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
export const DISCORD_CURRENT_USER_URL = 'https://discord.com/api/v10/users/@me';

function text(value) {
  return String(value ?? '').trim();
}

function validRedirectUri(value) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === '/auth/discord/callback' &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
  } catch {
    return false;
  }
}

export function discordIdentityAvatarUrl(userId, avatar) {
  const id = text(userId);
  const hash = text(avatar);
  if (!/^\d{2,32}$/.test(id) || !/^[a-zA-Z0-9_]{2,128}$/.test(hash)) return null;
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
}

export function discordIdentityFromUser(user) {
  const userId = text(user?.id);
  if (!/^\d{2,32}$/.test(userId)) throw new Error('discord_identity_invalid');
  const globalName = text(user?.global_name);
  const username = text(user?.username);
  const displayName = (globalName || username).slice(0, 128) || 'Discord 使用者';
  return Object.freeze({
    provider: DISCORD_PROVIDER,
    providerUserId: userId,
    displayName,
    avatarUrl: discordIdentityAvatarUrl(userId, user?.avatar),
  });
}

export function discordStateHash(state) {
  return createHash('sha256').update(text(state)).digest('hex');
}

export function createDiscordOAuth({
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = Object.freeze({
    clientId: text(clientId),
    clientSecret: text(clientSecret),
    redirectUri: text(redirectUri),
  });
  const configured = Boolean(
    config.clientId &&
      config.clientSecret &&
      validRedirectUri(config.redirectUri) &&
      typeof fetchImpl === 'function',
  );
  const assertConfigured = () => {
    if (!configured) throw new IdentityError('discord_oauth_not_configured', 503);
  };
  async function providerRequest(url, init, failureCode) {
    try {
      const response = await fetchImpl(url, {
        ...init, redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('provider_rejected');
      return await response.json();
    } catch {
      // No raw provider response, request body, secret, code, or token in errors.
      throw new IdentityError(failureCode, 502);
    }
  }
  return Object.freeze({
    configured,
    redirectUri: config.redirectUri || null,
    scope: DISCORD_IDENTIFY_SCOPE,
    authorizationUrl(state) {
      assertConfigured();
      const url = new URL(DISCORD_AUTHORIZE_URL);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('scope', DISCORD_IDENTIFY_SCOPE);
      url.searchParams.set('state', text(state));
      url.searchParams.set('redirect_uri', config.redirectUri);
      return url.toString();
    },
    async exchangeCode(code) {
      assertConfigured();
      const payload = await providerRequest(DISCORD_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code: text(code),
          redirect_uri: config.redirectUri,
        }),
      }, 'discord_token_exchange_failed');
      if (!text(payload?.access_token) || String(payload?.token_type).toLowerCase() !== 'bearer' ||
          !String(payload?.scope).split(' ').includes(DISCORD_IDENTIFY_SCOPE))
        throw new IdentityError('discord_token_invalid', 502);
      // Refresh tokens are discarded. Access token is used only within callback.
      return payload.access_token;
    },
    async fetchIdentity(accessToken) {
      assertConfigured();
      const user = await providerRequest(DISCORD_CURRENT_USER_URL, {
        headers: { authorization: `Bearer ${text(accessToken)}` },
      }, 'discord_identity_fetch_failed');
      return discordIdentityFromUser(user);
    },
  });
}
