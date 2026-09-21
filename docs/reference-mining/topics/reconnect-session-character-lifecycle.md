# Reconnect、Session、Character Lifecycle 與 State Resume

```text
TOPIC_ID = RECONNECT_SESSION_CHARACTER_LIFECYCLE
QUESTION = 斷線、重連、角色保存與 PA resume 的權威邊界及安全不變量為何？
PROJECT_RELEVANCE = 高；影響 ownership、command、AUTO_FARM、Supply、Quest、支援 session 與 Event Ledger。
UPSTREAM_SOURCE_CHECKED = rAthena integration/p2-openkore-exit-native-v1 @ ff72578f608935d1df5d664b3e9df9d436361043; OpenKore reference @ 51de1ddfc4449ae5217f6886de702f87ca934030; current OpenKore master checked 2026-09-21。
FORUM_WIKI_FINDINGS = 官方 rAthena connecting 說明確認 char-server 保存角色資料，map-server 依賴 char-server；未採用未驗證 forum workaround。
CURRENT_VERSION_APPLICABLE = PARTIAL；current project source 優先，完整 production reconnect acceptance 尚未宣告。
PROJECT_LAST_GOOD_CHECKED = docs/openkore-reference/project-last-good-map.md、docs/openkore-reference/recovery.md、docs/openkore-reference/supply.md、docs/openkore-reference/quest-automation.md。
CLASSIFICATION = ADAPT
ATLAS_UPDATED = YES
CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS
```

## 1. Authority boundary

| 層 | 權威與責任 | 重連後可接受的證據 |
|---|---|---|
| Login | 帳號線上狀態、auth session、char-server presence | login online 狀態與 char-server 連線一致 |
| Char | `char_db`、`online_char_db`、角色存檔、`last_map/x/y`、save point、inventory 等角色資料 | `char.online`、last login、角色資料載入完成 |
| Map | `map_session_data`、座標、戰鬥、NPC、map transfer、PA 執行 | auth 完成、map attach、authoritative map/position |
| Dashboard | 合法 session、ownership、revision、command queue、read model | HTTP response 加 command status 加 authoritative state |
| Persistent Agent | execution epoch、runtime instance、task phase、PA mode、checkpoint | runtime instance 與 revision 通過 reconcile |
| Event Ledger | 已發生的狀態與結果事件 | sequence、source、char id、runtime instance 可對應 |
| Browser / SSE | presentation、觀察與 stream cursor | 重新取得 snapshot 或 cursor 後顯示新鮮資料 |

結論：重連流程是「重新取得權威狀態、確認 ownership、恢復可重做的 parent intent」。TCP 連線本身只代表 transport 已建立。

## 2. rAthena login、char、map lifecycle

目前 source 的生命週期如下：

1. login layer 維護帳號線上表與 char-server presence。
2. char-server 維護 `online_char_db`、角色 memory cache 與 MariaDB `char` row。`char_set_char_online` 更新 `online=1` 與 `last_login`，衝突時處理舊 map-server presence；`char_set_char_offline` 清除線上狀態與 cache。
3. map-server 透過 `chrif_authreq_server_owned` 請求 server-owned 角色 attach。`chrif_authok` 收到 `mmo_charstatus` 後呼叫 `pc_authok`，再呼叫 `chrif_char_online`。
4. `pc_authok` 載入角色狀態並依 `last_point` 設定位置；`pc_setpos` 是 map/座標移動 authority。死亡使用 `pc_respawn` 與 save point。
5. char-server 斷線時 `chrif_on_disconnect` 設為 unavailable、呼叫 PA safe pause、清除 map-server map link，並在 bounded delay 後重連。
6. char-server ready 後，PA 重新載入 persistent state，要求 `control_owner=SERVER_AGENT`、`ownership_state` 合法、runtime instance 與 revision 一致，之後標記角色 online、做 save replay、匯出 live status，並重新啟用允許的 runtime。

官方 rAthena connecting 文件也指出 char-server 負責多數角色資料的載入與保存，map-server 依賴 char-server。這是 runtime authority 邊界，不能用 Dashboard snapshot 取代。

## 3. Character save/load authority 與 save race

### 權威順序

```text
map_session_data / pc status
  -> chrif_save / chrif_authok
  -> char-server mmo_charstatus
  -> MariaDB char row
```

`pc_makesavestatus` 將 map memory 轉成存檔 payload。`chrif_save` 將角色狀態交給 char-server。`char_mmo_char_tosql` 寫入角色資料。載入時 `char_mmo_char_fromsql` 讀取 last map、座標、save point、HP/SP、inventory、equipment 等欄位，再由 map-server attach。

### 必須保留的 invariant

- 任何 resume 前先確認角色 attach、online、map 與位置已完成。
- inventory、Zeny、HP/SP、save point、quest state 以 server authority 為準。
- 同一角色的舊 runtime、舊 execution epoch、舊 command 不得覆蓋新 runtime。
- save replay 只能在 char-server ready 且角色 identity 已驗證後執行。
- 交易中斷時保留「尚未確認」狀態，等待 authoritative transaction result；禁止依本地 request 推定已完成。
- reconnect 期間停止 movement、combat、NPC、service、quest mutation，直到 reconcile 通過。

### Race taxonomy

| Race | 風險 | 安全處理 |
|---|---|---|
| map memory 與 char save 交錯 | 舊 snapshot 覆蓋較新欄位 | 帶 runtime instance、revision 與 save 時機，重連後重新讀取 |
| 舊 map session 與新 attach 並存 | duplicate owner 或雙重 action | `chrif_search`、ownership CAS、舊 runtime reclaim 條件 |
| command 在斷線前已送出 | 重連後重播造成重複 mutation | command id、payload hash、expected revision、查詢既有結果 |
| shop / storage / NPC transaction 中斷 | item 或 Zeny 重複扣除 | 交易結果未確認前標 ambiguous，重新觀察 authority |
| map change 途中斷線 | 舊 map 與目標 map 都可能出現在觀察層 | 以 attach 後 authoritative map、座標與 map-change event 決定 |

## 4. Disconnect classification

| 類型 | 觀察層 | 世界 authority 是否中斷 | resume policy |
|---|---|---|---|
| Browser close / refresh | Browser、SSE | 否 | 保留 PA；重新 auth 與讀 snapshot |
| Dashboard restart | Dashboard process | 否，若 canonical runtime 健康 | 重新建立 DB/session/read model；不重送 command |
| Web session expiry / revoke | Dashboard auth | 否 | 立即拒絕後續 mutation；PA 可依既有 ownership 繼續 |
| command channel loss | Dashboard 到 queue | 否 | 以 command id 查詢 QUEUED/ACCEPTED/CONFIRMED；未知結果先觀察 |
| map-server 到 char-server disconnect | rAthena inter-server | 是，save 與 mutation 暫停 | PA safe pause，char ready 後 reconcile |
| player network disconnect | map client session | 角色是否暫留取決於 `clif_delayquit` 與 server policy | 依 authoritative offline、save 與 attach 結果判定 |
| real logout | map、char、login | 是，角色結束當次 presence | 只在新合法 login 後載入；不將 logout 當 transient reconnect |
| death | map gameplay | 角色仍在世界，但 mode 轉 recovery | `pc_respawn` 到 save point，再確認 HP/map/position |
| map transfer / warp interruption | map | 短暫 | 清除舊 route、等待 arrival、重新 scan / target |

## 5. OpenKore reconnect model

OpenKore plugin `plugins/reconnect/reconnect.pl` 以 login reconnect hook 設定 bounded timeout。官方 current master 的預設說明為 `reconnect_backoff 30,60,180` 與 `reconnect_random 20`，重複斷線時依序增加等待並加入 bounded random jitter，連線成功後 reset counter。`control/timeouts.txt` 提供 reconnect timeout 來源。DirectConnection 另有連線嘗試上限與自動 disconnect 保護。

Project Last-Good 將成熟模式歸納為：

```text
transport loss
→ bounded delay/backoff
→ re-authenticate
→ authoritative map/state reconcile
→ restore parent intent or safe failure
```

可重用的 OpenKore pattern：bounded backoff、輸入原因的 retry、重讀 map/target/inventory、恢復 lockMap 或 supply parent intent。需要調整的部分：OpenKore 本地 AI queue 與 status packet 不得成為 Ghost Island authority；PA 應使用 rAthena state、persistent revision、Event Ledger 與 runtime instance。

## 6. Ghost Island stale command 與 duplicate prevention

目前 Dashboard 與 PA 已有下列可觀察狀態：

| 語意 | Current source mapping | 決策 |
|---|---|---|
| NEW | request 尚未形成 persistent command row | API 邊界只接受合法 auth、ownership、action、UUID |
| ACKNOWLEDGED | `QUEUED` 或 native 已 `ACCEPTED` | 允許查詢；不可因重新連線盲目重送 |
| COMPLETED | `CONFIRMED` 且有 resulting revision / authoritative state | 可向使用者報告完成 |
| STALE | expected revision 不符、session 過期、runtime instance 不符、map/position 與前置條件不符 | fail closed，記錄 reason code，要求重新讀取 |
| SUPERSEDED | 新 revision 或新的 parent intent 使舊 pending intent 不再適用 | current schema 尚無獨立 status；以 revision、ownership 與 explicit rejection 表達，未來可增加 durable reason |

duplicate prevention 的現有證據：

- Dashboard 生成或接受 UUID `commandId`，以 action、char id、expected revision、payload 計算 hash。
- `INSERT IGNORE` 保護同一 command id 的重複建立。
- 既有 row 的 payload hash、action、char id、expected revision 不一致時記錄 `DUPLICATE_COMMAND_REJECTED` 與 `idempotency_conflict`。
- native state 以 expected revision 做 CAS；`QUEUED -> ACCEPTED -> CONFIRMED` 是單向狀態。
- 舊 command 不能跨 runtime instance 或 ownership epoch 自動重做。

尚缺：明確 `SUPERSEDED` durable status、每一種 stale reason 的完整 schema、command result 與 Event Ledger 的跨層 trace 全覆蓋。這些屬於 IMPROVE，沒有在本輪實作。

## 7. PA resume invariants

| PA mode | 斷線後安全恢復條件 | 禁止行為 |
|---|---|---|
| `PERSISTENT_IDLE` | attach、owner、revision 通過；等待新合法 command | 自動創造新 task |
| `AUTO_FARM` | map、target、runtime instance、revision 通過；同圖可重新 activate；異圖先 `PERSISTENT_IDLE` 並保留 target | 直接在未知 map 開打 |
| `SUPPLY` | 保留 supply parent intent，重查 HP/SP、inventory、Zeny、service transaction、save point | 重複買、重複扣 item |
| `RETURN_TO_FARM` | authoritative arrival、原 farm target、route result、target reacquire | 只依 route complete 或 HTTP 200 宣告回到農場 |
| `AUTO_QUEST` | sequence id、durable frame checkpoint、rAthena quest/inventory state 一致 | 盲目從上一個 local action 重播 |
| `PLAYER_REQUIRED` | 保留 checkpoint 與阻塞原因，等待真實玩家 | 自動猜 dialogue、choice 或 reward |
| `DEATH_RECOVERY` | death、save point、respawn、map、HP/SP 逐項確認 | 未確認 respawn 就恢復 combat |

所有 mode 都必須先停止 route、attack、skill、NPC、service、quest mutation，重連成功後再依 mode 啟用對應 runtime。`execution epoch` 與 `navigation_token` 用於讓舊 timer、舊路徑與舊 callback 失效。

## 8. AUTO_FARM、Supply 與 map-change invariants

### AUTO_FARM

- farm target 是持久意圖，當前 target mob 必須重新 scan / reacquire。
- 異圖重連只保留 target map 與 target rules，進入 `PERSISTENT_IDLE`，等待合法 relocation。
- `PLAYER_OVERRIDE` 若存在，應優先保留玩家控制 ownership 與 pause reason；重連不應把玩家 action 轉成自動 farm。
- `MONSTER_ATTACK` 不足以證明 hit；resume 後至少重新觀察 authoritative target、hit、kill 或其他明確結果。

### Supply

既有 supply contract 為：

```text
AUTO_FARM
→ SUPPLY_LOW
→ combat pause
→ Butterfly Wing / authoritative save point
→ service / buy
→ inventory、Zeny 確認
→ supplyRouteBack
→ original farm map arrival
→ target reacquire
→ ATTACK / HIT / KILL / LOOT
```

斷線或 restart 時，恢復的是 supply parent intent 與目前已確認 checkpoint。Shop、storage、buy、item use 任何一項結果未知時標 `SERVICE_RESTART_AMBIGUOUS` 或等價 blocked reason，等待 authority，不重放 mutation。

### Map change / warp interruption

導航 dossier 已確認 static warp、scripted service、NPC、instance 與 map graph 必須分開。斷線後 route cache、old map、old cell 都只能作候選觀察；arrival 以 rAthena map 與座標為準。抵達後重新計算 route eligibility、farm eligibility 與 target。

## 9. Quest checkpoint invariants

Native PA 已持久化 sequence id、task id、root step、frame stack、status、blocked reason 與 checkpoint JSON。恢復時：

1. 以 sequence id、checkpoint status、frame stack 載入。
2. `COMPLETE` 或空 frame checkpoint 不恢復為 running。
3. `PAUSED_FOR_RECOVERY` 先進 recovery branch，不盲目 resume。
4. 以 rAthena quest、inventory、NPC、map、position state 驗證 checkpoint；不以 Dashboard `web_quest_runtime` 單獨取代 server state。
5. checkpoint stamp 與相同內容去重，避免同一 phase 重複寫入。
6. mismatch、parse error、owner/revision mismatch 進 blocked 或 quarantine，保留 evidence。

這組 invariant 可供 Life Director / Social Director 作為底層 capability，不需新增第二套 runtime engine。

## 10. Support session lifecycle

現有 `admin-support-impersonation.md` 已定義 actor/effective identity、TTL、revoke、audit、CSRF 與 secret handling。本 topic 只補 lifecycle 交界：

- support session expiry、revoke、browser close、Dashboard restart 都要阻止新的 mutation dispatch。
- dispatch 前重新查詢 session，避免 cache 中仍有有效 token 造成已 revoke session 繼續執行。
- 已建立的 PA command 依 command id 與 revision 繼續受 command contract 管理；session 失效不等於回放或取消既有 authoritative command。
- action event 應保留 `command_id`、`trace_id`、actor/effective identity、result、error code，供 first broken transition 分析。
- 無 idle timeout、完整 session-to-command cross-layer trace 與所有 disconnect reason 的 current production acceptance，維持 gap 記錄。

## 11. Event Ledger 建議

每個 lifecycle event 建議至少有：`char_id`、`account_id`、`runtime_instance_id`、`execution_epoch`、`revision`、`command_id`、`trace_id`、`source`、`occurred_at`、`reason_code`。

建議事件：

```text
LOGIN_AUTH_REQUESTED
LOGIN_AUTHENTICATED
CHAR_ONLINE
CHAR_OFFLINE
CHAR_SERVER_DISCONNECTED
CHAR_RECONNECT_RECONCILED
MAP_ATTACH_STARTED
MAP_CHANGED
MAP_ARRIVAL_CONFIRMED
COMMAND_STALE
COMMAND_DUPLICATE_REJECTED
COMMAND_SUPERSEDED
PA_SAFE_PAUSED
PA_RESUME_REQUESTED
PA_RESUMED
PA_RESUME_BLOCKED
SERVICE_RESTART_AMBIGUOUS
DEATH_OBSERVED
RESPAWN_CONFIRMED
SUPPLY_RESUME_CONFIRMED
QUEST_CHECKPOINT_RESTORED
PLAYER_REQUIRED
```

事件代表已觀察到的 transition。`*_REQUESTED` 不可當作完成證據；`*_CONFIRMED` 必須有 authoritative state 對應。

## 12. Freshness 與 failure taxonomy

Current Dashboard / PA read model 的 `LIVE_STATUS_MAX_AGE_MS` 為 15,000 ms。超過門檻標為 `STALE`；缺 row 標為 unavailable / unknown。SSE combat stream 另有 30 秒 resume ring、10 秒 reconnect rate window、每 window 8 次 reconnect 上限，這些屬 presentation transport guard，不能當成角色生命週期 authority。

failure taxonomy：

- `AUTH_EXPIRED`、`SUPPORT_REVOKED`、`OWNERSHIP_CONFLICT`
- `STALE_REVISION`、`STALE_RUNTIME_INSTANCE`、`STALE_MAP_STATE`
- `COMMAND_DUPLICATE`、`COMMAND_SUPERSEDED`、`COMMAND_RESULT_UNKNOWN`
- `CHAR_SERVER_UNAVAILABLE`、`MAP_ATTACH_FAILED`、`CHAR_RECONNECT_RECONCILE_FAILED`
- `SAVE_NOT_CONFIRMED`、`SERVICE_RESTART_AMBIGUOUS`
- `MAP_ARRIVAL_NOT_CONFIRMED`、`ROUTE_REPLAN_REQUIRED`
- `DEATH_NOT_CONFIRMED`、`RESPAWN_NOT_CONFIRMED`
- `QUEST_CHECKPOINT_INVALID`、`PLAYER_REQUIRED`
- `LIVE_STATUS_STALE`、`EVENT_LEDGER_GAP`

每一項都應保留 first broken transition 與 bounded next action。無 evidence 時輸出 `UNKNOWN` 或 `BLOCKED`。

## 13. Classification summary

| 分類 | 本輪判定 |
|---|---|
| REUSE | rAthena character authority、save/load boundary、OpenKore bounded backoff、current command UUID/hash/CAS、PA safe pause、quest checkpoint structure |
| ADAPT | login/char/map reconnect、AUTO_FARM resume、Supply resume、map arrival reconcile、support session lifecycle、disconnect classification、Event Ledger lifecycle events |
| IMPROVE | explicit SUPERSEDED status、cross-layer trace completeness、stale reason schema、service transaction ambiguity read model、freshness evidence joins |
| REJECT_LEGACY | blind command replay、以 TCP reconnect或HTTP 200推定 gameplay resume、無 ceiling 的 retry loop |
| NOT_APPLICABLE | 本輪沒有需要排除的獨立 upstream capability |

### Current project 可立即重用

可直接沿用：rAthena server authority、PA safe pause/reconcile、runtime instance、execution epoch、revision CAS、command id/hash、AUTO_FARM 異圖 defer、Supply parent intent、Quest frame checkpoint、Dashboard 15 秒 freshness、SSE bounded reconnect guard。

仍需後續明確規格：完整 production reconnect canary、每個 disconnect reason 的 live Event Ledger closure、SUPERSEDED durable status、service transaction recovery、PLAYER_OVERRIDE resume contract、support session idle timeout。

## 14. Source pointers

### Current project

- `ops/ro-stack/dashboard.mjs`: session、command queue、payload hash、expected revision、live read model。
- `scripts/player-scenario-runner.mjs`: authenticated API、trace header、command polling、bounded observer。
- `ops/ro-stack/combat-sse.mjs`: SSE resume window 與 reconnect rate limit。
- `docs/openkore-reference/recovery.md`、`supply.md`、`quest-automation.md`、`project-last-good-map.md`。

### rAthena

- `src/map/chrif.cpp`: char-server connect、save、auth、disconnect、reconnect。
- `src/map/pc.cpp`: `pc_makesavestatus`、`pc_authok`、`pc_setpos`、`pc_respawn`。
- `src/char/char.cpp`: online tables、role load/save、MariaDB authority。
- `src/login/login.cpp`、`src/login/loginchrif.cpp`: login presence 與 char-server disconnect。
- `src/map/persistent_agent.cpp`、`persistent_agent_state.cpp`: PA runtime reclaim、safe pause、reconcile、quest checkpoint。

### Upstream web references

- [OpenKore reconnect plugin](https://github.com/OpenKore/openkore/blob/master/plugins/reconnect/reconnect.pl)
- [OpenKore timeouts](https://github.com/OpenKore/openkore/blob/master/control/timeouts.txt)
- [OpenKore direct connection](https://github.com/OpenKore/openkore/blob/master/src/Network/DirectConnection.pm)
- [rAthena character server source](https://github.com/rathena/rathena/blob/master/src/char/char.cpp)
- [rAthena connecting guide](https://github.com/rathena/rathena/wiki/connecting)

## 15. Safe simplifications

未來若要做最小 vertical slice，可只驗證：

1. 一個合法 char id、既有 ownership、既有 PA runtime。
2. 一次 bounded char-server reconnect 或受控 lifecycle harness。
3. command id + expected revision + authoritative state。
4. AUTO_FARM 同圖 resume、異圖 defer、一次 map arrival reconcile。
5. 一次 Supply checkpoint 或 Quest checkpoint restore。

不需要新增第二套 route planner、combat AI、auth bypass、SQL fixture mutation 或 Browser 代替 server authority。
