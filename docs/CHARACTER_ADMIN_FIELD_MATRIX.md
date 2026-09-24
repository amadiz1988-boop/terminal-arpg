# CHARACTER_ADMIN_FIELD_MATRIX

本表對應 `/api/admin/characters` 與 Server Ops「角色」頁。`CURRENT_STATUS`
只描述本次盤點所證明的來源，不把 UI 有值視為 authority 證據。

| FIELD_LABEL | UI_KEY | BACKEND_FIELD | SOURCE / AUTHORITY | FRESHNESS | NULL / PRESENTATION | CURRENT_STATUS |
|---|---|---|---|---|---|---|
| 角色 ID | `charId` | `char_id` | rAthena `char.char_id` / DB authoritative | static | 不可為空 | PASS |
| Account ID | `accountId` | `account_id` | rAthena `char.account_id` / DB authoritative | static | 不可為空 | PASS |
| 角色名稱 | `name` | `name` | rAthena `char.name` / DB authoritative | static | 空值顯示「尚無資料」 | PASS |
| 職業 | `jobName`, `classId` | `class`, `class_id` | rAthena class id，名稱由 `public/ro/data/skill-trees.json:jobs` canonical resolver | static | 未收錄 ID 顯示「未支援職業 (#ID)」 | PASS |
| Base Level | `baseLevel` | `base_level` | rAthena `char.base_level`，PA read model 優先於玩家 live snapshot | live/derived | 0 依原值 | PASS |
| Job Level | `jobLevel` | `job_level` | rAthena `char.job_level`，PA read model 優先於玩家 live snapshot | live/derived | 0 依原值 | PASS |
| HP / Max HP | `hp`, `maxHp` | live status | rAthena PA live read model | `liveAgeMs` | 離線顯示「目前離線」 | PASS |
| SP / Max SP | `sp`, `maxSp` | live status | rAthena PA live read model | `liveAgeMs` | 離線顯示「目前離線」 | PASS |
| Zeny | `zeny` | live status | rAthena PA live read model | `liveAgeMs` | 無 live row 顯示「尚無資料」 | PASS |
| Map / X / Y | `map`, `x`, `y` | live status fallback `char.last_*` | rAthena map authority；PA projection 只讀 | live/STALE | stale 不標示 LIVE | PASS |
| Save Point | `saveMap`, `saveX`, `saveY` | `char.save_*` | rAthena DB authoritative | static | 空值顯示「尚無資料」 | PASS |
| Farm Target | `farmTarget` | `persistent_agent_state.target_map` | PA intent projection；不改 gameplay | PA updated_at | 沒有目標顯示「尚無資料」 | PASS |
| Farm Target Source | `farmTargetSource` | `target_rules` | PA intent metadata | PA updated_at | 缺少規則顯示「未提供」 | PASS |
| PA Mode / Owner / Resident | `agentMode`, `controlOwner`, `resident` | PA state/live status | PA authoritative control projection | `liveAgeMs` | 缺少 row 顯示「尚無資料」 | PASS |
| AUTO_FARM / Supply phase | `runtimePhase`, `taskPhase` | live/state rows | PA runtime projection | `liveAgeMs` | 空 phase 顯示「未提供」 | PASS |
| Last Movement | `lastMovement` | Event Ledger `MAP_CHANGED` | `persistent_life_event`, source `rathena.map.transition` | event `occurred_at` | 同地圖 movement 尚未被 ledger 發出，顯示「尚無地圖轉移紀錄」 | GAP |
| Last Combat | `lastCombat` | Event Ledger `MONSTER_*`, `LOOT_ACQUIRED` | `persistent_life_event`, rAthena combat/inventory events | event `occurred_at` | 無事件顯示「尚無戰鬥紀錄」 | PASS/GAP |
| Last Attack / Hit / Kill / Loot / Death | `lastAttack`, `lastHit`, `lastKill`, `lastLoot`, `lastDeath` | Event Ledger event type | rAthena PA event ledger | event `occurred_at` | 各自無事件顯示「尚無紀錄」 | PASS |
| Last Recovery | `lastRecovery` | 無目前 canonical event type | 無可證明來源 | unknown | 顯示「未支援」 | UNKNOWN |
| Last Seen / updatedAt | `updatedAt`, `liveAgeMs` | `persistent_agent_live_status.updated_at` | PA read model timestamp | freshness derived | 缺少時間顯示「尚無資料」 | PASS |
| Session state | `online`, `freshness` | `char.online`, live age | rAthena online + PA freshness | live | `LIVE` / `STALE` / `OFFLINE` / `UNKNOWN` | PASS |
| Quest summary | — | not returned by roster endpoint | rAthena quest / PA quest projection | — | 詳情頁未提供，不能假填 | MISSING |
| Inventory state | — | not returned by roster endpoint | PA live inventory read model | — | 詳情頁未提供，不能假填 | MISSING |
| Equipment state | — | not returned by roster endpoint | rAthena inventory/read model | — | 詳情頁未提供，不能假填 | MISSING |

## Legacy / stale findings

`listAdminCharacters` 不再讀 `status.json`、`worker.running`、`.cmd` 或 `.result`。
`currentCharacterLiveSnapshot` 的 OpenKore fallback 僅在 `runtimeMode=isolated-test`
保留，且不屬於此 Admin roster authority。Admin 活動欄位改讀
`persistent_life_event`，資料表不存在時回報來源缺口，不建立假事件。

## First broken transition

`char.class` 與事件 ledger 已有權威值，壞點在 Admin roster projection 沒有 job
resolver、activity query，也沒有把 freshness／null semantics 傳到 UI；前端再以
`/app.js` 正則取得不完整 job mapping，並硬編 last movement/combat 空白。
