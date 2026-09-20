# Admin Support Impersonation Reference Mining

```text
TASK_ID = ADMIN_SUPPORT_IMPERSONATION_REFERENCE_MINING_V1
TOPIC_ID = ADMIN_SUPPORT_IMPERSONATION_SECURITY
WORKLINE = F
RESEARCH_DATE = 2026-09-21
H_CURRENT_DESIGN_ASSESSMENT = PARTIAL
CURRENT_VERSION_APPLICABLE = YES
RUNTIME_CHANGE = NO
```

## 問題與產品邊界

本輪檢查管理者為真實角色建立短期支援 session 時，系統能否持續保留真實操作者、有效玩家身分、權限範圍、撤銷狀態與完整稽核。H contract 固定為：

```text
ACTOR = real admin
EFFECTIVE_IDENTITY = server-resolved player account and character
MODE = OBSERVE_ONLY | PLAYER_ACTIONS
PASSWORD_KNOWLEDGE = FORBIDDEN
PASSWORD_HASH_MUTATION = FORBIDDEN
OWNERSHIP_MUTATION = FORBIDDEN
NESTED_IMPERSONATION = FORBIDDEN
```

研究只涵蓋支援身分代理與 delegated session security。未修改 Dashboard、Controller、Native、PA、Production 或資料庫 schema。

## 已查來源

### Project authority

| Source | Current evidence |
| --- | --- |
| `ops/ro-stack/support-session.mjs` | 模式、1 至 60 分鐘 TTL、actor 正規化、audit redaction、支援 context projection |
| `ops/ro-stack/dashboard.mjs` | session 建立、token hash、角色 owner server resolve、撤銷、nested admin boundary、Origin 與 cookie policy、mutation gate |
| `scripts/test-support-session.mjs` | TTL、actor、OBSERVE_ONLY helper、token redaction 與基本 source contract |
| `scripts/player-scenario-runner.mjs` | 合法 local admin token 建立支援 session，沿用 `Set-Cookie`，附 scenario trace ID |
| `ops/ro-stack/dashboard/app.js` | 玩家頁顯示角色、帳號、操作者、模式與剩餘時間，提供撤銷操作 |
| `docs/ops-admin-console-roadmap.md` | 管理 mutation 應具備管理 session、CSRF、allowlist、rate limit、audit、reason code 與秘密遮罩 |

### Authoritative and mature references

| Source | Pattern extracted | Applicability |
| --- | --- | --- |
| [RFC 8693 OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693) | subject 與 actor 分離，audience、scope、expiry 由發行端裁定 | 適用於概念模型與 downscope，不要求導入 OAuth server |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | 新 session ID、server-side timeout、撤銷、cookie flags、session lifecycle audit、log 不保存 bearer secret | 直接適用 |
| [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | stateful CSRF token或自訂 header，Origin/Referer fail-closed，SameSite 只作防禦層 | 直接適用於 browser mutation |
| [GitLab token security](https://docs.gitlab.com/security/tokens/) | impersonation token 限定 user、scope 與 expiration | 適用於 scope 與 expiry；廣域 API token 不適合 Player Web session |
| [GitLab audit event types](https://docs.gitlab.com/user/compliance/audit_event_types/) | `user_impersonation` 同時記錄開始與停止 | 適用於 lifecycle audit |
| [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) | origin 驗證簽章、issuer 與 audience 後才信任 Access identity | 適用於 admin actor provenance hardening |
| [Keycloak token exchange](https://www.keycloak.org/securing-apps/token-exchange) | audience filtering、scope downscoping、impersonation permission 與 subject/actor delegation | 適用於權限裁切；不採用 experimental delegation runtime |

## 成熟模式對照

| # | Mature pattern | H current evidence | Classification | Decision |
| --- | --- | --- | --- | --- |
| 1 | actor 與 effective identity 永久分離 | `actor_admin_id` 與 `effective_account_id/effective_char_id` 分欄保存 | REUSE | 保留 |
| 2 | 發行前驗證管理者 | `adminActorFromRequest()` 驗證 Access headers 或 loopback secret | ADAPT | 保留 outer boundary，增加簽章與 audience 驗證 |
| 3 | 目標 owner 由 server resolve | 建立 session 時以 `char JOIN login` 解析 owner，拒絕 supplied account mismatch | REUSE | 保留 |
| 4 | 權限轉換建立全新不可預測 session ID | 每次建立 32-byte random token 與 UUID support session ID | REUSE | 保留 |
| 5 | server 只保存 token verifier | `web_sessions.token_hash` 保存 SHA-256 digest | REUSE | 保留，bearer token 不進 audit |
| 6 | server-side absolute timeout | 預設 15 分鐘，上限 60 分鐘，DB query 驗證 expiry | REUSE | 保留 |
| 7 | 高權限 session 同時具備 idle timeout | 目前只有 absolute timeout | ADAPT | 加入短 idle timeout，使用行為不得延長 absolute deadline |
| 8 | server-side revoke 並清除 cache | `support_revoked_at`、holder revoke、admin revoke、cache eviction 已存在 | REUSE | 保留 |
| 9 | 撤銷後每個 mutation 在執行前重驗 | request 初期解析 session，長請求沒有 execution permit recheck | ADAPT | mutation dispatch 前重驗 session ID、expiry、revocation |
| 10 | delegated identity 不能再進管理面 | support context 對全部 `/api/admin/` 回傳 `support_admin_boundary` | REUSE | 保留並加入 negative route test |
| 11 | OBSERVE_ONLY 採 deny-by-default mutation gate | 現行 gate 以部分 pathname regex 決定是否呼叫 `assertSupportMutationAllowed()` | IMPROVE | 所有 state-changing route 先走統一 gate |
| 12 | security-sensitive action 永久排除 impersonation | `PLAYER_ACTIONS` 可到 ownership command surface，含 `claim_agent` 與 `run_server_command` | IMPROVE | 建立明確 denylist，至少涵蓋 ownership、admin、credential、identity、support-session minting |
| 13 | delegated permission 必須 downscope | 目前只有兩個 coarse modes，`PLAYER_ACTIONS` 沒有 endpoint/action allowlist | IMPROVE | mode 對應固定 capability allowlist，任何未知 action fail-closed |
| 14 | 建立、使用、撤銷、過期皆有 audit | 四類 lifecycle event 已入 `web_support_session_events` | REUSE | 保留 |
| 15 | 每個重要 action 記錄 actor、subject、target、result | `SUPPORT_SESSION_USED` 每 30 秒彙總一次，沒有逐 action result audit | IMPROVE | Action Trace 每個 mutation 附 support context 與 authoritative result |
| 16 | 被代理頁面持續顯示身份與剩餘時間 | Player Web banner 顯示 actor、effective IDs、mode、remaining time | REUSE | 保留 |
| 17 | browser mutation 驗證 source origin | 已驗 `Sec-Fetch-Site` 與 Origin；兩者缺失時仍接受 | ADAPT | Admin 與 support browser mutation 改成 missing-origin fail-closed，合法 CLI 使用獨立 authenticated channel |
| 18 | cookie auth 搭配 CSRF token或同源 custom header | 現況沒有 session-bound CSRF token | IMPROVE | 新增 session-bound token 或強制自訂 header，並保留 Origin 檢查 |
| 19 | 高權限 cookie 使用最小 lifetime 與完整 flags | `HttpOnly`、`SameSite=Lax` 已有；`Secure` 依 request 判斷，Max-Age 固定 7 天 | ADAPT | Production 強制 Secure，support cookie Max-Age 對齊 TTL，評估 `__Host-` 前綴 |
| 20 | 日誌禁止 bearer token、password 與 cookie | audit projector 明確丟棄 token，scenario trace metadata 亦有 secret redaction | REUSE | 保留並補 response/log negative test |
| 21 | 直接複製廣域 impersonation API token | GitLab 類 token 可跨 API、repository 與 registry | REJECT_LEGACY | Player Web 不採廣域 PAT 模型 |
| 22 | 使用玩家密碼、改密碼或建立 auth bypass | H contract 與 source 都不需要玩家密碼 | REJECT_LEGACY | 永久禁止 |

```text
REUSE_COUNT = 10
ADAPT_COUNT = 5
IMPROVE_COUNT = 5
REJECT_COUNT = 2
```

## Security gap report

### CRITICAL

`NONE`。本輪 source evidence 沒有證明 plaintext password、plaintext session token 落庫、support session 進入 `/api/admin/`，或直接繞過 owner resolution。

### HIGH

#### H-01 OBSERVE_ONLY mutation coverage is incomplete

`dashboard.mjs` 只對指定 pathname regex 呼叫 `assertSupportMutationAllowed()`。目前未涵蓋的 state-changing routes 包含 `/api/characters`、`/api/job-target`、`/api/social`、`/api/status-point`、`/api/skill-point`、`/api/skill-automation`、`/api/web-presence` 與 telemetry ingestion。`OBSERVE_ONLY` session 因此仍可到達部分 write handlers。第一個破口為：

```text
support session resolved
-> route classified as mutation
-> support mutation gate skipped
```

#### H-02 PLAYER_ACTIONS permits security-sensitive ownership actions

`/api/ro/agents/:charId/ownership/commands` 位於 coarse `PLAYER_ACTIONS` gate 內。該 command surface 接受 `claim_agent`、`release_agent`、`run_server_command` 與其他 lifecycle actions。Production 對 `release_agent` 另有拒絕，但 `claim_agent` 與 `run_server_command` 仍屬可達 action。這與 H contract 的 `OWNERSHIP_MUTATION = FORBIDDEN` 衝突。

### MEDIUM

1. `adminActorFromRequest()` 信任 email 與 `cf-ray` header，未驗證 `Cf-Access-Jwt-Assertion` 的簽章、issuer、audience 與 expiry。Dashboard 預設只綁 loopback 並由 tunnel 導入，縮小 exposure；actor provenance 仍缺 origin-side cryptographic binding。
2. browser mutation 在 `Origin` 與 `Sec-Fetch-Site` 都缺失時接受 request。OWASP 對高價值 mutation 建議 missing source headers fail-closed，或使用 session-bound CSRF token。
3. lifecycle audit 完整，逐 action audit 不完整。`SUPPORT_SESSION_USED` 每 30 秒最多一筆，沒有 action、resource、command ID、result 與 reason code 的一對一 audit。
4. 撤銷在 request admission 與 DB/cache 層有效；長時間 mutation 在 dispatch 前沒有 second revocation check。
5. support cookie 的 `Max-Age=604800` 長於 support session 的 1 至 60 分鐘。server expiry 會拒絕舊 token，瀏覽器仍會長時間保存無效 bearer value。
6. `docs/player-action-trace-foundation.md` 已記錄 Dashboard command 與 Event Ledger 尚未持久化 correlation。現況只能在 HTTP、support lifecycle event 與 Synthetic Runner 邊界保留部分 trace ID。

### LOW

1. 60 分鐘內沒有 session ID renewal。現行 absolute TTL 很短，風險低於 mutation coverage 與 sensitive exclusion。
2. active session 列表沒有顯示 client fingerprint。IP、User-Agent 若加入 audit，必須採 bounded、privacy-aware 格式，且不得取代真正 authorization。

## Required invariants

```text
SUPPORT_MUTATION_DEFAULT = DENY
OBSERVE_ONLY_WRITE_COUNT = 0
PLAYER_ACTIONS_SCOPE = EXPLICIT_ALLOWLIST
OWNERSHIP_ACTIONS_FROM_SUPPORT = DENY
ADMIN_ROUTES_FROM_SUPPORT = DENY
CREDENTIAL_AND_IDENTITY_MUTATION_FROM_SUPPORT = DENY
ACTOR_AND_EFFECTIVE_IDENTITY = BOTH_REQUIRED
SESSION_EXPIRY_AND_REVOCATION = SERVER_ENFORCED
AUDIT_SECRET_FIELDS = REDACTED
ACTION_AUDIT = ACTOR + EFFECTIVE_IDENTITY + ACTION + TARGET + RESULT + TRACE_ID
```

## Expected tests

1. 枚舉全部 POST、PUT、PATCH、DELETE routes，以 `OBSERVE_ONLY` session 驗證零 write side effect。
2. 以 `PLAYER_ACTIONS` session 驗證允許的 gameplay action 可執行，未知 route 與 action 固定 403。
3. 驗證 `claim_agent`、`release_agent`、`run_server_command`、admin route、credential/identity mutation 固定 403。
4. session 建立後確認 token 與原 session 不同，DB 只保存 hash，response body、console、audit 與 Action Trace 都沒有 raw token。
5. expiry 與 revoke 後，state read、command create、dispatch 前 recheck 全部拒絕；cache 不得延長有效期。
6. 缺少 Origin/Referer/CSRF proof 的 browser mutation 固定拒絕；合法 Synthetic Runner channel 仍需明確 admin credential。
7. 每個 mutation 產生一筆可由 supportSessionId 與 traceId 關聯的 action result audit。

## Version and stale notes

Project source 為 2026-09-21 當前 worktree evidence。外部來源皆以本輪官方頁面為準。Keycloak delegation 標記 experimental，僅採 subject/actor 與 downscope pattern。GitLab impersonation token 的廣域 bearer model 不進入 Player Web。未執行 live support session，也未驗證 Production Cloudflare Access policy、AUD、issuer 或 tunnel route；這些部署事實保留 `UNKNOWN`。

## Project usage

本 dossier 供 H workline 實作前 security gate、Synthetic Runner support-session negative tests、Action Trace context 與 Admin/Player Browser acceptance 使用。立即修補規格位於 `docs/reference-mining/H_IMMEDIATE_SECURITY_PATCH_SPEC.md`。

```text
ATLAS_UPDATED = docs/reference-mining/research-backlog.yml
SECURITY_INDEX_UPDATED = docs/reference-mining/README.md
H_IMMEDIATE_SECURITY_PATCH_SPEC = docs/reference-mining/H_IMMEDIATE_SECURITY_PATCH_SPEC.md
SKILL_UPDATE_RECOMMENDED = YES
TRACE_PROPAGATION_GAP = HTTP/support lifecycle trace 可觀察；Dashboard command 與 Event Ledger 尚未持久化跨層 correlation
```

建議在 `.agents/skills/synthetic-first-debugging/SKILL.md` 後續加入 `REAL_CHARACTER_SUPPORT_SESSION_SECURITY` gate：執行 real-character support scenario 前，先驗證 actor/effective identity、TTL、revocation、nested admin denial、OBSERVE_ONLY zero-write、PLAYER_ACTIONS explicit allowlist、secret redaction 與 action-level audit。此建議未在本輪修改 skill。
