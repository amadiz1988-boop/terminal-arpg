# 固定測試身分契約

`TASK_ID = CANONICAL_TEST_SUPERUSER_AND_PLAYER_FIXTURE_V1`

## 權威與用途

兩種身分是 canonical `ragnarok` runtime 中的永久測試 fixture。`TEST_SUPERUSER` 建立合法前置條件；`TEST_PLAYER` 透過一般玩家登入、ownership、Web 操作與 rAthena 權威執行被測行為。Fixture 與診斷成功不得計入 Player-flow PASS。兩組身分不得改配給真實玩家、作為例行清理刪除，或用於轉移真實玩家 ownership。

非機密對照表見 [canonical-test-fixtures.json](canonical-test-fixtures.json)。憑證僅存於 Git 忽略的 `.local/ro-stack/`，不得複製到原始碼、治理文件、日誌或 receipt。`TEST_PLAYER` 沿用既有 `fresh-e2e-credentials.json`；`TEST_SUPERUSER` 使用 `canonical-test-superuser-credentials.json`。兩檔均含機密，只能留在本機。

## 已查證身分，2026-09-23

| 角色 | 帳號 ID | 角色 ID | rAthena 群組 | 測試旗標 | 用途 |
| --- | ---: | ---: | ---: | ---: | --- |
| `TEST_SUPERUSER` | 2000164 | 150106 | 99，Admin | 1 | 僅建立 fixture 與診斷 |
| `TEST_PLAYER` | 2000163 | 150105 | 0，Player | 1 | 一般玩家流程驗收 |

兩組帳號及角色已從 canonical MariaDB 讀回。管理員帳號採用既有 Dashboard Web 密碼雜湊格式新增，角色透過一般 Web 建角端點建立；玩家帳號與角色沿用既有 fixture。兩組憑證均通過正常 `/api/account` 登入；玩家 session 沒有 Support Session。沒有提升任何真實玩家帳號權限。

Canonical native 來源與現行 map-server 所在 runtime 的 `conf/groups.yml` 均設定群組 99 `all_commands: true` 並記錄指令；現行 runtime 群組 0 是一般 Player，沒有 `all_commands`。這是設定與 DB 權限檢查。兩組身分尚未完成原生 `@warp`、`@heal`、`@item`、角色狀態與生成指令實測，因此 `SUPERUSER_COMMAND_PERMISSION = PENDING_LIVE_COMMAND_TEST`、`TEST_PLAYER_NO_GM_PERMISSION = PENDING_NATIVE_COMMAND_TEST`。玩家向 Player Web item-action 送出原始 `@item` 得到 HTTP 400，僅證明 Web 輸入邊界。Native `run_server_command` 僅接受 allowlist 中的玩家 NPC 綁定指令，不能用作通用 GM 指令入口。

## 使用規則

1. 每輪測試先核對 registry ID、`login.group_id`、`web_account_flags.is_test`、角色 ownership 與 canonical runtime。對照漂移即停止。
2. 管理員僅在測試政策允許時，對測試 fixture 執行定位、治療、物品或等級準備、有限生成、清理與恢復。須透過已驗證的 headless 伺服器指令路徑，由 rAthena 裁定群組權限。Local admin token 與直接 SQL 準備本身均不能證明這組帳號的 GM 指令權限。
3. 記錄起始狀態與管理員準備動作，再以 `TEST_PLAYER` 正常登入並執行被測行為。核對伺服器權威結果；可見 UI 行為另以實際 Browser 驗收。
4. 測試資源不得進入真實玩家交易、市場、公會、排行榜與公開統計。Dashboard 職業排行榜查詢排除 `web_account_flags.is_test=1`；實際 class-0 排行榜回應也沒有兩隻 fixture 角色。這尚未證明交易或市場存在硬隔離，`ECONOMY_ISOLATED` 維持待驗證。
5. 未來 Life Director 與 Social Director 必須排除這兩組 ID。目前 Native Persistent Agent 已替兩隻角色建立 `persistent_life_session` 並寫入 `SESSION_STARTED`，因此不得宣稱現行 Life／Event Ledger 已完全排除。未來模擬排除仍待權威檢查。

### 加速紀錄

每次測試加速都要隨證據記錄：

```text
TEST_ACCELERATION = YES
ACCELERATION_REASON =
SUPERUSER_ACTIONS =
PRE_ACCELERATION_REAL_EVIDENCE =
WHAT_REMAINS_REAL =
PRODUCTION_VALIDITY_IMPACT =
```

遵守 `.agents/skills/nearest-valid-test-state/SKILL.md` 的 Representative Evidence Gate。被加速動作若正是本輪被測功能，即停止。GM 發物品不證明掉落；GM 治療不證明恢復；GM 傳送不證明導航；直接改 Quest 狀態不證明任務。Source、synthetic、Browser 與 Production 驗收分開標記。

## 已驗證項目與未完成閘門

2026-09-23，`TEST_PLAYER` 透過 `/api/account` 正常登入，取得帳號 2000163、角色 150105，沒有 Support Session；以認證後的 Player 路徑修改一項 Web 偏好，讀回變更並還原，最終值也從 MariaDB 讀回。這是有界的一般玩家 Web 動作，並非 gameplay 功能或 Browser UI PASS。Player Web 原始 GM 動作請求回覆 HTTP 400。所有明確指定的帳號、角色與偏好資料修改目標均為這兩組測試 ID；未執行全域的附帶 session 清理稽核。

管理員帳號首次建立時，正常註冊端點回覆 HTTP 429，因此使用政策允許的 DB fixture provisioning。這是帳號前置條件，並非 gameplay 驗收：

```text
TEST_ACCELERATION = YES
ACCELERATION_REASON = 測試身分建立時註冊端點回覆 HTTP 429
SUPERUSER_ACTIONS = NONE；當時專用管理員帳號尚未存在
PRE_ACCELERATION_REAL_EVIDENCE = 既有 TEST_PLAYER 已透過 /api/account 正常登入
WHAT_REMAINS_REAL = 管理員正常 Web 登入與建角；玩家正常登入與 Web 動作
PRODUCTION_VALIDITY_IMPACT = 本輪未證明新帳號註冊流程
```

下列閘門仍須完成，才能將本任務標為完整 DONE：

- 以 `TEST_SUPERUSER` 經認證的 headless 伺服器傳輸執行安全的 warp、heal、item、角色狀態與允許的環境 fixture 指令，核對 rAthena 權限、權威結果與 command log。不得以 Browser 原始指令輸入或 Quest `run_server_command` 代替。
- 以 `TEST_PLAYER` 經相同伺服器傳輸確認同類 GM 指令被 rAthena 權限層拒絕，並確認狀態沒有變動。
- 管理員準備合法 fixture 後，由一般玩家完成一段真正的 gameplay 權威行為。上述 Web 偏好操作不滿足這項 gameplay 鏈。
- 經驗證的測試專用交易與市場邊界，或等效硬隔離。目前 `is_test` 僅在職業排行榜查詢得到驗證。
- 明確的 Life 與 Social 模擬排除決策，包含現存 Event Ledger session 的處理。
- 被測功能依賴可見 UI 時，完成實際 Browser 驗收。

兩種角色的 `READY` 均以適用的現場閘門通過為前提。來源設定、DB ID 與單一 Web API 動作只能提供部分證據。本次未修改 Production gameplay 程式、Navigation、Combat 或 Quest。

## 續作查核，2026-09-23

`TASK_ID = CANONICAL_TEST_IDENTITIES_LIVE_ACCEPTANCE_AND_ISOLATION_V1`。固定 ID 與憑證位置沿用上表，未重建帳號。`FIXTURE_SETUP_IDENTITY = TEST_SUPERUSER`，`FINAL_ACCEPTANCE_IDENTITY = TEST_PLAYER`。群組 99 的 `all_commands` 是 fixture 準備權限契約；伺服器端權威指令尚未實測，故 `SUPERUSER_SERVER_COMMAND_PATH = PENDING`，`TEST_PLAYER_SERVER_COMMAND_REJECTION = PENDING`。Web 的 HTTP 400 不算權限拒絕證據。GM 準備結果不算玩家流程通過。

## Headless 測試控制契約

```text
CLIENT_REQUIRED_FOR_PRODUCT_RUNTIME = NO
CLIENT_REQUIRED_FOR_TESTING = NO
CLIENT_REQUIRED_FOR_ADMIN_CONTROL = NO
NATIVE_CLIENT_REQUIRED_FOR_ACCEPTANCE = NO
OPENKORE_RUNTIME_FOR_TESTING = FORBIDDEN
CANONICAL_PLAYER_CONTROL = WEB → SERVER_AGENT / PA → rAthena
CANONICAL_TEST_CONTROL = ADMIN / TEST TRANSPORT → SERVER_AGENT / TEST FIXTURE ADAPTER → rAthena authority
FIXTURE_SETUP_IDENTITY = TEST_SUPERUSER
FINAL_ACCEPTANCE_IDENTITY = TEST_PLAYER
```

管理端只負責認證及路由；rAthena 裁定群組指令權限並產生權威狀態變更。TEST_SUPERUSER 的 fixture 指令限制於測試身分；TEST_PLAYER 的玩家行為須經正常 Web／PA 路徑完成。

### Superuser 安全界線

`TEST_SUPERUSER_FULL_COMMAND_AUTHORITY = YES` 表示測試身分的群組設定授予完整指令集合。實際使用固定為 `TEST_FIXTURE_SCOPE_ONLY`，真實玩家目標、世界範圍破壞性指令及全域伺服器設定變更均禁止。每次執行記錄指令、操作者、測試目標、權威結果及清理結果。玩家驗收由 `TEST_PLAYER` 以正常權限單獨完成。

### Life 與 Social

Native `src/map/persistent_agent.cpp` 在 attach 時呼叫 `persistent_agent_life_start_session`；原入口沒有檢查 `web_account_flags.is_test`。這直接導致兩筆測試角色的 ACTIVE session 與各一筆 `SESSION_STARTED`。Native canonical source 已加入通用 `is_test` 檢查，測試帳號走現有 `persistent_agent_life_interrupt_session(..., "TEST_FIXTURE_EXCLUDED")`，保留歷史事件並阻止新建 session。來源編譯通過；現行 Production map-server 尚未載入此來源，因此 `FUTURE_TEST_LIFE_ADMISSION = PENDING_DEPLOY`。2026-09-23 讀回 `TEST_SUPERUSER_ACTIVE_LIFE_SESSION = 1`、`TEST_PLAYER_ACTIVE_LIFE_SESSION = 1`。Dashboard 在一般 runtime 禁止 `release_agent`，現有正常生命週期入口無法在 Production 關閉這兩筆 session。同時有兩隻非測試角色在線，本輪沒有重啟 canonical runtime 或執行 session 清理。

目前 Life Director 與 Social Director 均未在 Production 啟用。未來兩者的 enrollment 與 encounter admission 必須以 `web_account_flags.is_test = 1` 排除測試帳號，並在啟用前以權威狀態驗證。現況 `CURRENT_SOCIAL_RUNTIME = NOT_ACTIVE`；未來 gate 為治理契約，尚無執行證據。

### Economy

已定位 Native 的玩家交易、販售商店、收購商店、郵件附件、有限庫存 market shop、公會倉庫與丟棄物品入口；auction 設定為 off。Native canonical source 已在上述入口加入通用 `is_test` 阻擋，郵件送達目標也查詢帳號旗標。Debug Win32 build 通過，Production 尚未部署，未進行原生交易驗收。`ECONOMY_ISOLATION = PARTIAL`，`TEST_IDENTITIES_REAL_ECONOMY_IMPACT = NOT_PROVEN_ZERO`。部署前不得讓 fixture 參與真實玩家經濟。

### 本輪證據界線

本輪對 canonical DB 只做 SELECT。讀回兩組 fixture 的群組與 `is_test`、兩筆 ACTIVE Life session，以及兩隻非測試角色在線。沒有執行 GM 指令、玩家 gameplay 動作、直接 DB 寫入、PA release、Production 部署或 runtime 重啟；因此本輪由工作動作造成的 `NON_TEST_ACCOUNT_MUTATIONS = 0` 與 `NON_TEST_CHARACTER_MUTATIONS = 0`。其他常駐玩家活動仍由既有 runtime 自行執行，此數字不代表全域資料未變。

Native source checkpoint 為 `cb1dd250fbda4109364647943c72749646b924d4`。`CANONICAL_TEST_IDENTITIES_READY = NO`。尚需原生 GM 正反權限實測、Superuser 準備後的玩家權威行為、受控部署、既有測試 Life session 的現場終止，以及 Economy 的原生與 Production 驗收。

## Headless server authority 入口查核，2026-09-23

`TASK_ID = HEADLESS_TEST_SUPERUSER_SERVER_AUTHORITY_V1`。本節取代上方以 Native Client 登入作 GM fixture 前提的舊說法；既有歷史驗收紀錄仍保留原文。

| 層 | 現行能力 | 邊界 |
| --- | --- | --- |
| Admin 認證 | Dashboard `web_admin_sessions` 與本機 Admin header，可建立受稽核的管理身分 | `actorAdminId` 尚未綁定固定測試帳號與角色 |
| Support Session | 可代表角色讀取與執行既有授權動作 | 不是 GM 群組權限來源 |
| Synthetic Runner | 可使用測試憑證或 Support Session 呼叫 canonical Web API | 沒有原生 GM 指令動作 |
| SERVER_AGENT 傳輸 | `persistent_agent_command` 有 command ID、action、payload、revision、狀態 | 現行契約沒有 TEST_FIXTURE_COMMAND |
| Native `run_server_command` | resident `map_session_data` 以 `is_atcommand(..., type=1)` 執行 | 僅允許伺服器 allowlist 且 `binding->level == 0` 的 NPC 綁定指令 |
| rAthena 指令權威 | `is_atcommand(..., type=1)` 依 `sd->group` 的 command table 裁定；群組 99 設定 `all_commands` | type 0、2、3 不具相同玩家群組裁定；成功回傳值本身不能證明世界狀態已變 |

`REUSE_PLAN = THIN_ADAPTER`：在已認證的 Admin／測試傳輸上綁定 fixture actor，將請求送入現有 PA command queue，由 resident actor 的 `map_session_data` 以 rAthena `type=1` 權限路徑執行。Native 需重新核對 actor、group、`is_test` 與 target，限制非測試目標及全域破壞性指令，分開記錄權限結果、執行結果與權威前後狀態。Web、Admin 與 SERVER_AGENT 均不授予 GM 權限。

`CURRENT_HEADLESS_GM_TRANSPORT = GAP`。現行 `run_server_command` 的 NPC 綁定限制不能承載 warp、heal、item 等 GM fixture 指令；直接使用 console 或 script 型態會跳過要求的玩家群組裁定。本任務沒有新增命令入口，也沒有執行 fixture 命令。Native 新動作需要替換 map-server binary；目前 canonical Native source HEAD 包含尚未授權部署的 `cb1dd250` Life／Economy patch。現行 Web `dashboard.mjs` 另有大範圍非本任務 dirty 變更，沒有在該 mixed file 加入新路由。`HEADLESS_TEST_SUPERUSER_READY = NO`。
