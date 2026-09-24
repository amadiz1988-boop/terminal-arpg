export class IdentityError extends Error {
  constructor(code, statusCode = 400) {
    super(code);
    this.statusCode = statusCode;
  }
}

export function hasPasswordCredential(row) {
  return /^[a-f0-9]{32}$/i.test(row?.password_salt ?? '') &&
    /^[a-f0-9]{128}$/i.test(row?.password_hash ?? '');
}

// Reuse the existing pool. Transactions pin one connection, roll back on
// failure, and never retry writes or provider code redemption.
export function createExternalIdentityStore(pool) {
  async function connectionTask(task, transaction = false) {
    let connection;
    try { connection = await pool.getConnection(); }
    catch { throw new IdentityError('discord_storage_unavailable', 503); }
    const query = async (sql, values = []) => {
      const [result] = await connection.query({ sql, values, rowsAsArray: false });
      return result;
    };
    try {
      if (transaction) await connection.beginTransaction();
      const result = await task(query);
      if (transaction) await connection.commit();
      return result;
    } catch (error) {
      if (transaction) await connection.rollback().catch(() => {});
      if (error?.code === 'ER_DUP_ENTRY')
        throw new IdentityError('discord_identity_already_linked', 409);
      if (error instanceof IdentityError) throw error;
      // Never forward mysql statements/parameters to logs or the browser.
      throw new IdentityError('discord_storage_unavailable', 503);
    } finally {
      connection.release();
    }
  }
  async function accountForSession(query, hash, now, lock = false) {
    const rows = await query(
      'SELECT s.* FROM web_sessions s JOIN login l ON l.account_id=s.account_id ' +
      "WHERE s.token_hash=? AND s.expires_at>? AND l.state=0 AND l.sex<>'S' " +
      (lock ? 'FOR UPDATE' : ''), [hash, now]);
    if (!rows[0] || rows[0].support_session_id || rows[0].support_revoked_at != null)
      throw new IdentityError('discord_link_session_required', 401);
    return Number(rows[0].account_id);
  }
  async function eligibleAccount(query, id) {
    const rows = await query("SELECT account_id FROM login WHERE account_id=? AND state=0 AND sex<>'S'", [id]);
    if (!rows[0]) throw new IdentityError('discord_account_unavailable', 403);
  }
  return {
    async identity(accountId) {
      return connectionTask(async (query) => {
        const rows = await query("SELECT provider_user_id,display_name,avatar_url,linked_at,last_login_at FROM account_external_identity WHERE account_id=? AND provider='discord'", [accountId]);
        return rows[0] ?? null;
      });
    },
    async createState(state, now) {
      return connectionTask(async (query) => {
        if (state.intent === 'LINK' &&
            await accountForSession(query, state.sessionHash, now) !== state.accountId)
          throw new IdentityError('discord_link_session_required', 401);
        await query('DELETE FROM web_oauth_state WHERE expires_at<=? LIMIT 1000', [now]);
        await query('INSERT INTO web_oauth_state ' +
          '(state_hash,browser_hash,session_hash,provider,intent,account_id,redirect_uri,created_at,expires_at) ' +
          "VALUES (?,?,?,'discord',?,?,?,?,?)",
        [state.stateHash, state.browserHash, state.sessionHash, state.intent,
          state.accountId, state.redirectUri, now, state.expiresAt]);
      });
    },
    async consumeState({ stateHash, browserHash, sessionHash, redirectUri, now }) {
      return connectionTask(async (query) => {
        const [row] = await query('SELECT * FROM web_oauth_state WHERE state_hash=? FOR UPDATE', [stateHash]);
        if (!row || row.consumed_at !== null || Number(row.expires_at) <= now ||
            row.provider !== 'discord' || row.browser_hash !== browserHash ||
            row.session_hash !== sessionHash || row.redirect_uri !== redirectUri)
          throw new IdentityError('discord_oauth_state_invalid');
        if (row.intent === 'LINK' &&
            await accountForSession(query, sessionHash, now, true) !== Number(row.account_id))
          throw new IdentityError('discord_link_session_required', 401);
        await query('UPDATE web_oauth_state SET consumed_at=? WHERE state_hash=?', [now, stateHash]);
        return { intent: row.intent, accountId: row.account_id == null ? null : Number(row.account_id) };
      }, true);
    },
    async finish({ state, identity, oldSessionHash, newSessionHash, now }) {
      return connectionTask(async (query) => {
        let accountId = state.accountId;
        if (state.intent === 'LINK') {
          if (await accountForSession(query, oldSessionHash, now, true) !== accountId)
            throw new IdentityError('discord_link_session_required', 401);
          await query('SELECT account_id FROM web_accounts WHERE account_id=? FOR UPDATE', [accountId]);
        }
        const [existing] = await query("SELECT * FROM account_external_identity WHERE provider='discord' AND provider_user_id=? FOR UPDATE", [identity.providerUserId]);
        if (state.intent === 'LOGIN') {
          if (!existing) throw new IdentityError('discord_account_not_linked', 403);
          accountId = Number(existing.account_id);
        } else if (existing && Number(existing.account_id) !== accountId) {
          throw new IdentityError('discord_identity_already_linked', 409);
        }
        await eligibleAccount(query, accountId);
        if (!existing) {
          await query('INSERT INTO account_external_identity (account_id,provider,provider_user_id,display_name,avatar_url,linked_at) ' +
            "VALUES (?,'discord',?,?,?,?)",
          [accountId, identity.providerUserId, identity.displayName, identity.avatarUrl, now]);
        } else {
          await query("UPDATE account_external_identity SET display_name=?,avatar_url=?,last_login_at=IF(?='LOGIN',?,last_login_at) WHERE id=?",
            [identity.displayName, identity.avatarUrl, state.intent, now, existing.id]);
        }
        // Identity mapping and session rotation commit together.
        await query('DELETE FROM web_sessions WHERE token_hash=?', [oldSessionHash]);
        await query('INSERT INTO web_sessions (token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)',
          [newSessionHash, accountId, now, now + 7 * 86400000]);
        await query('INSERT INTO web_account_activity (account_id,last_web_login_at,updated_at) VALUES (?,?,?) ' +
          'ON DUPLICATE KEY UPDATE last_web_login_at=VALUES(last_web_login_at),updated_at=VALUES(updated_at)', [accountId, now, now]);
        return { accountId };
      }, true);
    },
    async unlink({ accountId, sessionHash, now }) {
      return connectionTask(async (query) => {
        if (await accountForSession(query, sessionHash, now, true) !== accountId)
          throw new IdentityError('discord_link_session_required', 401);
        const [credential] = await query('SELECT password_salt,password_hash FROM web_accounts WHERE account_id=? FOR UPDATE', [accountId]);
        // Only an implemented login method counts as an alternative.
        if (!hasPasswordCredential(credential))
          throw new IdentityError('discord_unlink_requires_alternative_login', 409);
        await query("DELETE FROM account_external_identity WHERE account_id=? AND provider='discord'", [accountId]);
        return { unlinked: true };
      }, true);
    },
  };
}
