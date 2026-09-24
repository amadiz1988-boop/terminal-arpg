# Discord OAuth 帳號綁定 V1

## 現況

Ghost Island 的帳號權威仍是 rAthena login.account_id，角色權威仍是 char.account_id。Discord 只提供外部 identity assertion；永久查找鍵是 discord_user_id，顯示名稱與頭像只作呈現。

V1 支援既有 Ghost Island 帳號綁定 Discord，以及已綁定帳號的 Discord 登入。未知 Discord identity 會 fail closed，要求先以既有帳號登入後完成綁定，避免建立第二套註冊與 ownership。

## 設定

以環境變數提供：

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://<public-host>/auth/discord/callback
DISCORD_LINK_REQUIRED=false
DISCORD_GUILD_ID=
DISCORD_GUILD_MEMBERSHIP_REQUIRED=false

DISCORD_CLIENT_SECRET 僅供 Dashboard server 使用，不寫入 repository、HTML、JavaScript、cookie 或資料庫。OAuth 只要求 Discord identify scope，callback 採 authorization-code server-side exchange。

## 安全邊界

web_oauth_state 綁定 state hash、瀏覽器 flow cookie、原始 session hash、provider、意圖、redirect URI 與十分鐘期限。callback 會以交易消耗 state，重播與跨瀏覽器 callback fail closed。成功綁定或登入會刪除舊 ro_session 並建立新 session。

account_external_identity 以 (provider, provider_user_id) 與 (account_id, provider) 唯一索引保證一個 Discord identity 只能指向一個帳號，一個帳號每個 provider 只能有一筆綁定。

解除綁定只在既有 Web 密碼憑證存在時允許。沒有其他合法登入方式時拒絕解除，避免把玩家鎖在帳號外。

## 路徑與測試

GET  /auth/discord
GET  /auth/discord/callback
GET  /api/account/discord
POST /api/account/discord/link
DELETE /api/account/discord

node scripts/test-discord-oauth-account-linking.mjs 驗證 linked login、unknown identity、同一 Discord ID 第二帳號拒絕、state invalid、callback replay、缺 secret、session rotation、安全解除綁定與 DISCORD_LINK_REQUIRED gate。

node --test scripts/test-discord-identity-store.mjs 驗證 state expiry／provider／session／redirect 綁定、transaction rollback、unique-key race、support session 邊界、secret redaction、secure cookie、origin／host gate 與 guild extension seam。

新帳號 provisioning 尚未開放；本輪限制是 EXISTING_ACCOUNT_LINKING + DISCORD_LOGIN_FOR_LINKED_ACCOUNT。
Guild membership 只保留 extension seam，沒有 Bot、踢人、Role 或 feedback bot。
