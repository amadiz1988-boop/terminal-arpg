# OpenKore Exit Source of Truth

本文件是本專案唯一的 `OPENKORE EXIT CANONICAL STATUS DOCUMENT`。A、B、G 工作線與後續規模驗收，都必須依本文件判定 OpenKore 依賴是否真正退出。文件只整理已存在的來源與驗證證據，不修改 Persistent Agent、rAthena、OpenKore、Dashboard、資料庫結構或正式環境。

## 判定邊界

來源中存在函式、isolated unit test 通過，或程式看起來支援，都不能單獨代表功能完成。每個能力固定使用下列四級狀態：

| 狀態 | 定義 | 可宣稱內容 |
| --- | --- | --- |
| `SOURCE_ONLY` | 來源有相關 function／implementation，尚無 SERVER_AGENT `fd=0` runtime 證據 | 不得稱 `READY`、`DONE` 或 `SUPPORTED` |
| `DIAGNOSTIC_PASS` | isolated／targeted test 證明單一底層 primitive 可運作 | 只能作診斷證據 |
| `PLAYER_FLOW_PASS` | 完全不依賴 OpenKore，依正常玩家行為完成完整 end-to-end flow | 可稱 `FEATURE_READY` |
| `OPENKORE_REMOVED` | 已達 `PLAYER_FLOW_PASS`，且正式路徑不啟動 OpenKore、不讀 `status.json`、不使用 `.cmd`／`.result`、不依賴 OpenKore config 或 worker，也不呼叫 OpenKore path | 唯一代表真正完成 OpenKore Exit |

狀態關係固定為：`SOURCE_ONLY ≠ DIAGNOSTIC_PASS`、`DIAGNOSTIC_PASS ≠ PLAYER_FLOW_PASS`、`PLAYER_FLOW_PASS ≠ OPENKORE_REMOVED`。`pc_useitem`、navigation、combat、recovery、quest handler 等來源存在，仍須取得 runtime evidence 才能升級狀態。

Player-flow 規則沿用 [docs/testing-fixture-policy.md](testing-fixture-policy.md)，本文件不複製該政策。`DIAGNOSTIC_TEST` 用於縮小 blocker；只有 `PLAYER_FLOW_TEST` 可以判定功能驗收 PASS。

## 目前 Gate

### GATE 1A — BASIC PLAYER COMBAT LOOP

完整流程為：

```text
OpenKore process=0
→ SERVER_AGENT claim
→ fd=0 entity
→ AUTO_FARM
→ 附近沒有怪物
→ Fly Wing 或正常移動尋怪
→ teleport／movement
→ rescan
→ target
→ move
→ attack
→ monster HP decreases
→ character may receive damage
→ recovery if naturally required
→ kill
→ loot if dropped
→ continue hunting
```

目前 Gate 1A 未通過。已確認的 blocker 是 `HEADLESS WARP RE-ATTACH`：Fly Wing warp 成功後 `sd->prev == nullptr`，因此 AUTO_FARM 的 post-warp rescan 尚未成立。

後續固定順序為：GATE 1B Death／Respawn／Recovery、GATE 2 Supply Loop、GATE 3 Navigation／Multi-map、GATE 4 NPC／Quest、GATE 5 Web／Dashboard OpenKore File Removal、GATE 6 24h OpenKore=0 soak，最後才進入 100、300、1000 actors scale gates。前一 Gate 未通過時，不得依來源推定後續 Gate READY。

## 已確認證據

- Character claim／ownership：targeted runtime claim 已通過，完整 PLAYER_FLOW 尚未完成，狀態為 `DIAGNOSTIC_PASS`。
- `fd=0 SERVER_AGENT entity`：targeted runtime 已通過，狀態為 `DIAGNOSTIC_PASS`。
- AUTO_FARM start：targeted runtime 已通過，狀態為 `DIAGNOSTIC_PASS`。
- Fly Wing 601：OpenKore process=0、`SERVER_AGENT`、`fd=0`，`pay_dun00` 座標 `30,183 → 58,137`，item 601 數量 `30 → 30`，符合本專案 non-consume 規則，狀態為 `DIAGNOSTIC_PASS`。

Target acquisition、attack、monster HP decrease、kill、character receives damage、character HP mutation、fd=0 potion recovery、loot、death recovery，目前都沒有足夠 runtime evidence，不能標記 PASS。只有來源或過往 isolated slice 的 NPC／Quest／service 證據，也不能自動升級成 PLAYER_FLOW_PASS。

## Capability Matrix

欄位中的 `SOURCE_ONLY` 代表已找到來源或 isolated implementation，但尚無本能力的完整 runtime／玩家流程證據。`UNKNOWN` 代表目前資料不足，需補 runtime evidence。證據路徑以文件為索引，細部 log 仍須依 Evidence Policy 保存。

| # | Capability | OpenKore responsibility | Native implementation | Runtime evidence | Player-flow evidence | OpenKore dependency remaining | Current status | Blocker | Evidence path |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Character claim / ownership | login／控制權 | SERVER_AGENT ownership | targeted claim PASS | 未完整 | OpenKore ownership path 仍在 | `DIAGNOSTIC_PASS` | 完整玩家流程未通過 | `docs/persistent-server-agent-roadmap.md` ownership／Phase 10 |
| 2 | fd=0 SERVER_AGENT entity | headless entity | map-server persistent entity | fd=0 PASS | 未完整 | OpenKore 可共存 | `DIAGNOSTIC_PASS` | 尚無完整 player flow | `docs/persistent-server-agent-roadmap.md` Phase 0 |
| 3 | AUTO_FARM start | attackAuto／任務啟動 | server-side AUTO_FARM | targeted start PASS | 未完整 | Dashboard／OpenKore bridge 仍可被呼叫 | `DIAGNOSTIC_PASS` | Gate 1A 未完成 | `docs/persistent-server-agent-roadmap.md` Phase 2 |
| 4 | Mob scan | scan nearby monsters | rAthena map entity scan | 尚無本能力 evidence | 未完整 | OpenKore scan path 仍在 | `SOURCE_ONLY` | Gate 1A | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 5 | Target selection | attackAuto target | native selector primitive | 尚無 | 未完整 | OpenKore target selector | `SOURCE_ONLY` | 尚無 target runtime evidence | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 6 | Movement to target | route／move | rAthena movement | 尚無 | 未完整 | OpenKore movement path | `SOURCE_ONLY` | Gate 1A | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 7 | Normal attack | attack | rAthena combat | 尚無 | 未完整 | OpenKore attack path | `SOURCE_ONLY` | Gate 1A | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 8 | Skill attack | attackSkillSlot | server skill combat | 尚無本能力 evidence | 未完整 | OpenKore skill path | `SOURCE_ONLY` | 未完成 player flow | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 9 | Monster HP mutation | damage result | rAthena HP mutation | 尚無 | 未完整 | OpenKore combat loop | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 2 |
| 10 | Character receives damage | survival／dodge | rAthena damage | 尚無 | 未完整 | OpenKore survival path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 3 |
| 11 | Character HP mutation | status export | rAthena status | 尚無 fd=0 player evidence | 未完整 | OpenKore status path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 3 |
| 12 | HP recovery / Red Potion | useSelf_item | rAthena item use | 尚無 fd=0 potion evidence | 未完整 | OpenKore item path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 13 | SP recovery | sit／item | rAthena SP recovery | 尚無 | 未完整 | OpenKore recovery path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 3 |
| 14 | Fly Wing | route_warpByItem | `pc_useitem`／rAthena item | item 601 warp PASS | 未完整 | post-warp agent reattach | `DIAGNOSTIC_PASS` | `sd->prev == nullptr` | `docs/RO_FLY_WING_SOURCE_AUDIT.md`; `docs/persistent-server-agent-roadmap.md` |
| 15 | Butterfly Wing | route／save point | rAthena item／save point | 尚無 | 未完整 | OpenKore route path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 16 | Loot pickup | itemsTakeAuto | rAthena drop／pickup | 尚無 | 未完整 | OpenKore loot path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 17 | Equipment / equip change | autoSwitch／equip | rAthena inventory/equipment | 尚無 | 未完整 | OpenKore equip path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 18 | Death detection | autoMoveOnDeath | rAthena death state | 尚無 | 未完整 | OpenKore death path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 4 |
| 19 | Respawn | respawn route | rAthena save point | 尚無本能力 evidence | 未完整 | OpenKore recovery path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 4 |
| 20 | Death recovery | recovery／resume | persistent state recovery | 尚無 player flow | 未完整 | OpenKore recovery path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 4／10 |
| 21 | Same-map navigation | route movement | rAthena movement | isolated PoC only | 未完整 | OpenKore route | `SOURCE_ONLY` | 未完成 Gate 3 | `docs/persistent-server-agent-roadmap.md` Phase 5 |
| 22 | Multi-map navigation | Task::MapRoute | rAthena warp／map attach | isolated PoC only | 未完整 | OpenKore multi-map path | `SOURCE_ONLY` | reattach／player flow | `docs/OPENKORE_FEATURE_AUDIT.md`; roadmap Phase 5 |
| 23 | Route planning | Task::CalcMapRoute | native route data | isolated PoC only | 未完整 | OpenKore route planner | `SOURCE_ONLY` | 未完成 Gate 3 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 24 | NPC talk | NPC approach／click | rAthena NPC handlers | isolated PoC only | 未完整 | OpenKore NPC path | `SOURCE_ONLY` | 正式玩家流程未驗證 | `docs/persistent-server-agent-roadmap.md` Phase 6 |
| 25 | NPC dialog | next／menu／input | rAthena script state | isolated PoC only | 未完整 | OpenKore dialog path | `SOURCE_ONLY` | 正式腳本未驗證 | `docs/persistent-server-agent-roadmap.md` Phase 6 |
| 26 | Quest progression | quest handler | rAthena quest state | isolated custom quest only | 未完整 | OpenKore quest path | `SOURCE_ONLY` | 正式任務 evidence 不足 | `docs/persistent-server-agent-roadmap.md` Phase 8 |
| 27 | Quest USE_ITEM | item quest action | rAthena quest／item | 尚無 | 未完整 | OpenKore item／quest path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 28 | Shop buy | buyAuto | rAthena shop | isolated PoC only | 未完整 | OpenKore shop path | `SOURCE_ONLY` | Supply Gate 2 | `docs/persistent-server-agent-roadmap.md` Phase 7 |
| 29 | Shop sell | sellAuto | rAthena shop | isolated PoC only | 未完整 | OpenKore shop path | `SOURCE_ONLY` | Supply Gate 2 | `docs/persistent-server-agent-roadmap.md` Phase 7 |
| 30 | Kafra storage deposit | storageAuto | rAthena storage | isolated PoC only | 未完整 | OpenKore storage path | `SOURCE_ONLY` | Supply Gate 2 | `docs/persistent-server-agent-roadmap.md` Phase 7 |
| 31 | Kafra storage withdraw | getAuto | rAthena storage | isolated PoC only | 未完整 | OpenKore storage path | `SOURCE_ONLY` | Supply Gate 2 | `docs/persistent-server-agent-roadmap.md` Phase 7 |
| 32 | Save point | Kafra／save | rAthena save point | isolated PoC only | 未完整 | OpenKore service path | `SOURCE_ONLY` | Supply Gate 2／3 | `docs/persistent-server-agent-roadmap.md` Phase 7 |
| 33 | Supply cycle | buy／storage／replenish | server service state | 尚無完整 cycle evidence | 未完整 | OpenKore supply path | `SOURCE_ONLY` | GATE 2 未開始 | `docs/persistent-server-agent-roadmap.md` Phase 7 |
| 34 | Return to farm after supply | route resume | persistent intent／navigation | 尚無完整 cycle evidence | 未完整 | OpenKore route resume | `SOURCE_ONLY` | GATE 2 未開始 | `docs/persistent-server-agent-roadmap.md` Phase 10 |
| 35 | Social send | partyAuto／social commands | server command boundary | 尚無 native player evidence | 未完整 | OpenKore social path | `SOURCE_ONLY` | Agent 禁用 | `docs/OPENKORE_FEATURE_AUDIT.md`; roadmap |
| 36 | Dashboard automation start/stop | command／status bridge | Dashboard controller | isolated loopback PoC only | 未完整 | OpenKore bridge remains | `SOURCE_ONLY` | Exit path not removed | `docs/persistent-server-agent-roadmap.md` Phase 9／11 |
| 37 | Dashboard grind target | target config | Dashboard target validation | 尚無 Exit evidence | 未完整 | OpenKore target config | `SOURCE_ONLY` | 未完成 Gate 5 | `docs/OPENKORE_FEATURE_AUDIT.md`; roadmap |
| 38 | OpenKore status.json removal | status export file | 尚未確認移除 | 【資料不足，無法確認】 | 【資料不足，無法確認】 | 未知 | `UNKNOWN` | Phase 11 僅 static，移除數 0 | `docs/persistent-server-agent-roadmap.md:75,96,159` |
| 39 | OpenKore .cmd/.result removal | command／result files | 尚未確認移除 | 【資料不足，無法確認】 | 【資料不足，無法確認】 | 未知 | `UNKNOWN` | Phase 11 僅 static，移除數 0 | `docs/persistent-server-agent-roadmap.md:75,96,159` |
| 40 | OpenKore worker/start.exe removal | worker process | 尚未確認移除 | 【資料不足，無法確認】 | 【資料不足，無法確認】 | 未知 | `UNKNOWN` | Phase 11 僅 static，移除數 0 | `docs/persistent-server-agent-roadmap.md:75,96,159` |

### Matrix count

| Status | Count |
| --- | ---: |
| `SOURCE_ONLY` | 33 |
| `DIAGNOSTIC_PASS` | 4 |
| `PLAYER_FLOW_PASS` | 0 |
| `OPENKORE_REMOVED` | 0 |
| `UNKNOWN` | 3 |
| **Total capabilities** | **40** |

## Gate evidence policy

每一個 PASS 都要記錄 `TEST_TYPE`、CID／AID、OpenKore process count、owner、fd、runtime evidence、before／after state、log／evidence path、candidate SHA 與 result。沒有 runtime evidence 時，不得標記 `PLAYER_FLOW_PASS`。`DIAGNOSTIC_PASS` 只能記錄底層 primitive，不能取代玩家流程驗收。

## OpenKore Exit 判定

目前 Gate 1A 未通過，Phase 11 只有靜態依賴矩陣，尚未執行 runtime 切換或移除驗證，現階段 OpenKore removal count 為 0。因此目前專案不具備 `PLAYER_FLOW_PASS` 或 `OPENKORE_REMOVED` 證據，OpenKore Exit 狀態維持未完成。

本輪文件更新不包含 runtime 測試與程式修改。後續任何能力升級，都必須先補足對應 Gate 的 runtime evidence，再更新本矩陣。
