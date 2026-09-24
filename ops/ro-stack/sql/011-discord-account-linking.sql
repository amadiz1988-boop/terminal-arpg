-- Additive, idempotent identity mapping; existing login/char authority is unchanged.
-- No FK: do not change the legacy login storage engine for OAuth.
CREATE TABLE IF NOT EXISTS account_external_identity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  provider VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_user_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  avatar_url VARCHAR(512) NULL,
  linked_at BIGINT UNSIGNED NOT NULL,
  last_login_at BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_external_provider_user (provider,provider_user_id),
  UNIQUE KEY uq_external_account_provider (account_id,provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS web_oauth_state (
  state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  browser_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(32) NOT NULL,
  intent ENUM('LOGIN','LINK') NOT NULL,
  account_id INT UNSIGNED NULL,
  redirect_uri VARCHAR(512) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  consumed_at BIGINT UNSIGNED NULL,
  KEY ix_oauth_state_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
