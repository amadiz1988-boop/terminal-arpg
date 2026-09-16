# OpenKore Exit Source of Truth

本文件是本專案唯一的 `OPENKORE EXIT CANONICAL STATUS DOCUMENT`。A、B、G 工作線與後續規模驗收，都必須依本文件判定 OpenKore 依賴是否真正退出。文件只整理已存在的來源與驗證證據，不修改 Persistent Agent、rAthena、OpenKore、Dashboard、資料庫結構或正式環境。

## Persistent Agent Canonical Source Authority

本專案只有一條 authoritative Persistent Agent source lineage。

```
PERSISTENT_AGENT_CANONICAL_SOURCE:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-gate1a-player-flow-v1
PERSISTENT_AGENT_CANONICAL_BRANCH: canonical/persistent-agent-no-client-v1
PERSISTENT_AGENT_CANONICAL_HEAD:   866f423af9b199a88e7eb7ae1cac0833b46487a8
PERSISTENT_AGENT_LINEAGE:          3ffdad1 -> 5ed8f0d -> 866f423
```

- 未來 Persistent Agent source 變更只從上列 canonical worktree 開始。
- 歷史 PA worktree（`.tmp-server-agent-no-client-controller-v1`、`.tmp-pa-lifecycle-consolidation-v1`）為 frozen read-only reference，不得刪除、不得作為來源權威。
- `.tmp-pa-iso-runtime` 為 SHARED TEST/RUNTIME SUPPORT，不是 source authority，也不是 command-contract authority，亦不得承載 ownership／lifecycle implementation。
- Command contract authority 版本化於 canonical PA source（`conf/persistent_agent_commands.json`、`src/map/persistent_agent_command_contract.hpp`），不位於 harness。
- Binaries 與 runtime copies 永遠不是 source authority。
- 舊 `ops/ro-stack/patches/persistent-agent.patch` 為 `STALE_REFERENCE`／derived artifact，非 canonical 來源，不得以它取代 canonical Git source。
- 未位於 canonical PA worktree 而嘗試 PA source edit：STOP → 回報 `NON_CANONICAL_PA_WORKTREE`。

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

目前 Gate 1A 已通過（`GATE1A_PLAYER_FLOW = PASS`，`2026-09-16`）。驗收 runtime 為 OpenKore process count = 0、`fd = 0` 的 `SERVER_AGENT` no-client 流程，完全不使用 Native RO Client。本輪以自然移動與自然 melee 完成 target → attack → monster HP decrease → kill → loot → post-kill continuation → formal stop → formal release，未以 Fly Wing 作為必要條件。前次記錄的 blocker `HEADLESS WARP RE-ATTACH` 不阻擋本輪自然玩家流程，仍列為 GATE 1B／GATE 3 後續範圍。

後續固定順序為：GATE 1B Death／Respawn／Recovery、GATE 2 Supply Loop、GATE 3 Navigation／Multi-map、GATE 4 NPC／Quest、GATE 5 Web／Dashboard OpenKore File Removal、GATE 6 24h OpenKore=0 soak，最後才進入 100、300、1000 actors scale gates。前一 Gate 未通過時，不得依來源推定後續 Gate READY。

## 已確認證據

- Character claim／ownership：targeted runtime claim 已通過，完整 PLAYER_FLOW 尚未完成，狀態為 `DIAGNOSTIC_PASS`。
- `fd=0 SERVER_AGENT entity`：targeted runtime 已通過，狀態為 `DIAGNOSTIC_PASS`。
- AUTO_FARM start：targeted runtime 已通過，狀態為 `DIAGNOSTIC_PASS`。
- Fly Wing 601：OpenKore process=0、`SERVER_AGENT`、`fd=0`，`pay_dun00` 座標 `30,183 → 58,137`，item 601 數量 `30 → 30`，符合本專案 non-consume 規則，狀態為 `DIAGNOSTIC_PASS`。

### Gate 1A Player-flow Evidence（`2026-09-16`）

`TEST_TYPE: PLAYER_FLOW_TEST`；runtime：OpenKore process count = 0、`fd = 0`、`SERVER_AGENT` entity，無 Native RO Client。

- `CLAIM_AGENT` = PASS；`START_FARM` = PASS。
- 自然 target acquisition、自然 melee：`AUTO_FARM_ATTACK` observed、`AUTO_FARM_HIT` observed。
- Authoritative monster HP decrease：`445 → 353`，damage = `92`。
- `KILL >= 1` = PASS，實際 kills = 2；`LOOT` = PASS；`POST_KILL_CONTINUATION` = PASS。
- 無錯誤 quarantine；`STOP_FARM` = CONFIRMED；`RELEASE_AGENT` = CONFIRMED。
- 最終狀態：`control_owner = OPENKORE`、`ownership_state = OPENKORE`、`runtime_state = INACTIVE`、`mode = PERSISTENT_IDLE`、`entity = 0`、`dup_entity = 0`、`ownership_leak = 0`。

Character receives damage、character HP mutation、fd=0 potion recovery、death recovery，目前都沒有足夠 runtime evidence，不能標記 PASS（屬 GATE 1B 範圍）。只有來源或過往 isolated slice 的 NPC／Quest／service 證據，也不能自動升級成 PLAYER_FLOW_PASS。

## Capability Matrix

欄位中的 `SOURCE_ONLY` 代表已找到來源或 isolated implementation，但尚無本能力的完整 runtime／玩家流程證據。`UNKNOWN` 代表目前資料不足，需補 runtime evidence。證據路徑以文件為索引，細部 log 仍須依 Evidence Policy 保存。

| # | Capability | OpenKore responsibility | Native implementation | Runtime evidence | Player-flow evidence | OpenKore dependency remaining | Current status | Blocker | Evidence path |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Character claim / ownership | login／控制權 | SERVER_AGENT ownership | Gate 1A claim＋release PASS | Gate 1A PASS | OpenKore ownership path 仍在 | `PLAYER_FLOW_PASS` | — | `docs/persistent-server-agent-roadmap.md` ownership／Phase 10 |
| 2 | fd=0 SERVER_AGENT entity | headless entity | map-server persistent entity | fd=0 PASS；release 後 entity=0 | Gate 1A PASS | OpenKore 可共存 | `PLAYER_FLOW_PASS` | — | `docs/persistent-server-agent-roadmap.md` Phase 0 |
| 3 | AUTO_FARM start | attackAuto／任務啟動 | server-side AUTO_FARM | Gate 1A start＋stop PASS | Gate 1A PASS | Dashboard／OpenKore bridge 仍可被呼叫 | `PLAYER_FLOW_PASS` | — | `docs/persistent-server-agent-roadmap.md` Phase 2 |
| 4 | Mob scan | scan nearby monsters | rAthena map entity scan | Gate 1A 自然 target acquisition PASS | Gate 1A PASS | OpenKore scan path 仍在 | `PLAYER_FLOW_PASS` | — | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 5 | Target selection | attackAuto target | native selector primitive | Gate 1A 自然 target PASS | Gate 1A PASS | OpenKore target selector | `PLAYER_FLOW_PASS` | — | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 6 | Movement to target | route／move | rAthena movement | Gate 1A 自然 melee 移動 PASS；warp 跨越走 `AUTO_FARM_MAP_EXIT` | Gate 1A PASS | OpenKore movement path | `PLAYER_FLOW_PASS` | — | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 7 | Normal attack | attack | rAthena combat | Gate 1A `AUTO_FARM_ATTACK`／`AUTO_FARM_HIT` PASS | Gate 1A PASS | OpenKore attack path | `PLAYER_FLOW_PASS` | — | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 8 | Skill attack | attackSkillSlot | server skill combat | 尚無本能力 evidence | 未完整 | OpenKore skill path | `SOURCE_ONLY` | 未完成 player flow | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 9 | Monster HP mutation | damage result | rAthena HP mutation | Gate 1A `445 → 353`（damage 92）、kill＝2 PASS | Gate 1A PASS | OpenKore combat loop | `PLAYER_FLOW_PASS` | — | `docs/persistent-server-agent-roadmap.md` Phase 2 |
| 10 | Character receives damage | survival／dodge | rAthena damage | 尚無 | 未完整 | OpenKore survival path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 3 |
| 11 | Character HP mutation | status export | rAthena status | 尚無 fd=0 player evidence | 未完整 | OpenKore status path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 3 |
| 12 | HP recovery / Red Potion | useSelf_item | rAthena item use | 尚無 fd=0 potion evidence | 未完整 | OpenKore item path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 13 | SP recovery | sit／item | rAthena SP recovery | 尚無 | 未完整 | OpenKore recovery path | `SOURCE_ONLY` | 未證明 | `docs/persistent-server-agent-roadmap.md` Phase 3 |
| 14 | Fly Wing | route_warpByItem | `pc_useitem`／rAthena item | item 601 warp PASS | 未完整 | post-warp agent reattach | `DIAGNOSTIC_PASS` | `sd->prev == nullptr` | `docs/RO_FLY_WING_SOURCE_AUDIT.md`; `docs/persistent-server-agent-roadmap.md` |
| 15 | Butterfly Wing | route／save point | rAthena item／save point | 尚無 | 未完整 | OpenKore route path | `SOURCE_ONLY` | 未證明 | `docs/OPENKORE_FEATURE_AUDIT.md` |
| 16 | Loot pickup | itemsTakeAuto | rAthena drop／pickup | Gate 1A `LOOT` = PASS | Gate 1A PASS | OpenKore loot path | `PLAYER_FLOW_PASS` | — | `docs/OPENKORE_FEATURE_AUDIT.md` |
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
| `SOURCE_ONLY` | 27 |
| `DIAGNOSTIC_PASS` | 1 |
| `PLAYER_FLOW_PASS` | 9 |
| `OPENKORE_REMOVED` | 0 |
| `UNKNOWN` | 3 |
| **Total capabilities** | **40** |

`PLAYER_FLOW_PASS`（9）：#1 Character claim／ownership、#2 fd=0 SERVER_AGENT entity、#3 AUTO_FARM start、#4 Mob scan、#5 Target selection、#6 Movement to target、#7 Normal attack、#9 Monster HP mutation、#16 Loot pickup。全部來自 `2026-09-16` Gate 1A no-client PLAYER_FLOW_TEST。

## Gate evidence policy

每一個 PASS 都要記錄 `TEST_TYPE`、CID／AID、OpenKore process count、owner、fd、runtime evidence、before／after state、log／evidence path、candidate SHA 與 result。沒有 runtime evidence 時，不得標記 `PLAYER_FLOW_PASS`。`DIAGNOSTIC_PASS` 只能記錄底層 primitive，不能取代玩家流程驗收。

## OpenKore Exit 判定

目前 Gate 1A 已通過，並取得 9 項 `PLAYER_FLOW_PASS` 能力證據（皆為 no-client `SERVER_AGENT` runtime）。Phase 11 仍只有靜態依賴矩陣，尚未執行 runtime 切換或移除驗證，OpenKore removal count 仍為 0。因此專案已具備 `PLAYER_FLOW_PASS` 證據，但仍不具備 `OPENKORE_REMOVED` 證據，OpenKore Exit 狀態維持未完成。

本輪文件更新不包含 runtime 測試與程式修改。後續任何能力升級，都必須先補足對應 Gate 的 runtime evidence，再更新本矩陣。

## Architecture Milestone: No-Client SERVER_AGENT Controller

### Formal milestone

`MILESTONE: SERVER_AGENT_NO_CLIENT_CONTROLLER_FEASIBILITY_PROVEN`

日期：`2026-09-16`

隔離實驗已由兩種 continuation 類型取得證據：

1. Fly Wing 601：原生 item effect、random warp、server-side `attach_map_block()`、原生 `map_addblock()`，`sd->prev` 由無效狀態恢復有效，entity 維持 1。
2. TEST_ONLY NPC：原生 `npc_click()`、`npc_scriptcont()`、`next`、`select`、script result 與 close 流程完成，`#test_result=2`。

架構結論：

`Native Client` 定位為 Controller、Transport、Presentation layer。rAthena Server Authority 持續負責 item validation、inventory、cooldown、map restriction、NPC script state、quest state、ownership、execution epoch 與 entity lifecycle。`SERVER_AGENT` 可作為無 Native RO Client 的 headless controller，透過 internal intent 與 server-side continuation 接入同一套 authority。

Server-side continuation 的範圍是移除不存在的 client acknowledgement transport dependency，保留 server authority 與所有原生 invariant。

### Status boundary

| Status | Value |
| --- | --- |
| `ARCHITECTURE_FEASIBILITY` | `PROVEN` |
| `ARCHITECTURE_POC_PASS` | `YES` |
| `HIGH_COST_ARCHITECTURE` | `NO` |
| `EXPERIMENTAL_IMPLEMENTATION` | `YES` |
| `PRODUCTION_READY` | `NO` |
| `GATE1A_PLAYER_FLOW` | `PASS` |
| `OPENKORE_EXIT_GATE1A` | `PASS` |
| `OPENKORE_REMOVED` | `NO` |

完整 evidence 保存在 [server-agent-no-client-continuation-poc.md](experiments/server-agent-no-client-continuation-poc.md)。本里程碑只提升 architecture feasibility evidence，不提升 AUTO_FARM、Combat、Generic Item Use、NPC Quest、Kafra、Storage、Shop 或 Multi-map 的 capability completion status。

### Next engineering step

從真正 OpenKore Exit canonical base 建立乾淨 implementation lineage，只移植已證明的 headless map continuation、headless NPC continuation pattern 與明確的 `SERVER_AGENT` controller semantics。不得直接 merge experiment branch。

後續回到 `GATE 1A PLAYER FLOW`：

```text
OpenKore=0
→ farm
→ no target
→ Fly Wing
→ warp
→ reattach
→ rescan
→ target
→ combat
```

## Gate 1A Milestone Closure（`2026-09-16`）

### Closure status model

```text
SERVER_AGENT_NO_CLIENT_ARCHITECTURE = PROVEN
GATE1A_PLAYER_FLOW                  = PASS
OPENKORE_REMOVED                    = NO
PRODUCTION_READY                    = NO
COMMAND_CONTRACT_HARDENING          = CLOSED
```

`ARCHITECTURE_FEASIBILITY = PROVEN` 與 `GATE1A_PLAYER_FLOW = PASS` 只代表 no-client 玩家戰鬥閉環成立；`OPENKORE_REMOVED = NO`、`PRODUCTION_READY = NO`，不得宣稱完整 OpenKore Exit。

### Provenance

| Item | Value |
| --- | --- |
| Source worktree | `.tmp-gate1a-player-flow-v1` |
| Source branch | `candidate/gate1a-player-flow-v1` |
| `SOURCE_COMMIT` | `5ed8f0d21ee138ddd37db4f7070a4decafeb84e5` |
| `SOURCE_PARENT` | `3ffdad1420feadde1e4d96667d7a33136bddb3c5` |
| `SOURCE_TREE_HASH` | `726947fe46e69e172b428575517719151f1f86fe` |
| `MAP_SERVER_SHA256` | `7C56BB0CE96583B3A81E500DF044584A61F9F079B61E9776D5519C09D2EBB2A1` |
| `BUILD_CONFIGURATION` | `Release\|x64` |
| Runtime binary path | `.tmp-pa-iso-runtime\candidate-v1-runtime2\map-server.exe` |
| Harness | `.tmp-pa-iso-runtime\g1a-run.ps1` |
| `HARNESS_SHA256` | `D103FE7232535132470C3339C118C6A8FDC4F3C7972C97D389F2C5C75919D437` |
| `g1a-map.out` | `9983F31D441EF39E6C3A697AC078357C939ADCBBDC35326AFF4B239C5A9EE2C7` |
| `g1a-run-B.stdout.txt` | `F40F3B76FC2DCDFE54EA2721A98E4F385CB7BBA015D2575EB844DC884117CF27` |

後續 lineage 續行至 `866f423af9b199a88e7eb7ae1cac0833b46487a8`（command-contract hardening）。原 `Source branch` `candidate/gate1a-player-flow-v1` 已於 `2026-09-17` 更名為 `canonical/persistent-agent-no-client-v1`（同一 commit，歷史保留）；此 milestone 由 tag `milestone/gate1a-no-client-player-flow-pass-20260917` 固定指向 `5ed8f0d21ee138ddd37db4f7070a4decafeb84e5`。

本輪只凍結已證明的 source patch 與既有 isolated binary，未重新建置、未部署 production binary。Source patch 只修改 `src/map/persistent_agent.cpp` 與 `src/map/persistent_agent_state.cpp`，未改動 damage 計算、mob HP 寫入、attack timing、target selection、native client／OpenKore 行為、`expected_revision` 或 execution epoch／stale callback 保護。

### Root cause closure

- Direct cause：farm map mismatch 原本觸發 `AUTO_FARM_LIFECYCLE_INVALID` → `QUARANTINED`；已改為 `AUTO_FARM_MAP_EXIT` → clean stop → ownership preserved。
- Direct cause：`QUARANTINED` 原本保留 runtime／entity，使 formal release 不可達；已改為 quarantine → runtime／entity teardown。
- Direct cause：`stop_farm` 原本不是 first-class queued action；已納入 command admission／dispatch。
- Observability：新增 read-only `AUTO_FARM_ATTACK`／`AUTO_FARM_HIT`，未改變任何 combat 語意。
- Systemic：以上修正把「controller 邊界事件」與「terminal quarantine」分離，controller 不再因正常地圖變更而進入不可逆狀態。

### Known remaining work

- GATE 1B：broader recovery／death／respawn／character damage 驗收。
- GATE 2：supply／shop／storage／save point cycle。
- GATE 3：multi-map／longer-running navigation 行為。
- Soak／regression：穩定性與 OpenKore=0 長時間驗證。
- Final OpenKore removal gate：`status.json`／`.cmd`／`.result`／worker／start.exe 正式路徑移除。

### P0.5 technical debt：`COMMAND_CONTRACT_HARDENING` = CLOSED（`2026-09-17`）

`start_farm` schema drift 曾允許 `map`／`mob_id` 欄位，而非 `targetMap`／`mobId`，並被誤分類為 `invalid_transition`。

Recurrence barrier 已實作於 command contract hardening：

- 單一 command contract Source of Truth：`conf/persistent_agent_commands.json`（19 actions；payload shape、required／optional fields、JSON types、validation metadata）。
- Server consumer：`src/map/persistent_agent_command_contract.hpp`。Dispatch 前先做 payload pre-validation；payload 類別（`invalid_payload`／`missing_required_field`／`invalid_field_type`／`unknown_field`）與 lifecycle 類別（`invalid_transition`／`stale_revision`／`ownership_conflict`／…）為 disjoint taxonomy，payload failure 不再可能被標成 `invalid_transition`。
- Admitted-action SQL 改由 contract 產生（`pa_contract::admitted_actions_sql()`），新增 command 只有一個註冊點。
- Harness／builder consumer：`tools/pa-command-contract/PaCommandContract.psm1`；Gate1A harness 不再手寫 `start_farm` JSON。
- Contract tests：C++ matrix `33/33`、PowerShell conformance `200/200`。

Runtime taxonomy proof（isolated runtime，非 production、非 Gate1A combat；`map-server` SHA256 `761F574C591821E639F8BF8BA637B356D09121EFFC95D2EE3D8D5D558F8EF7C6`）：

- malformed payload `{"map":"pay_dun00","mob_id":1076}` → `reason_code=invalid_payload`（`class=missing_required_field`，`missing=targetMap,mobId`），未產生 `invalid_transition`。
- 合法 payload + 未 claim lifecycle → `invalid_transition`。
- 合法 payload + stale `expected_revision` → `stale_revision`。

`SOURCE_COMMIT`：`866f423af9b199a88e7eb7ae1cac0833b46487a8`（parent `5ed8f0d21ee138ddd37db4f7070a4decafeb84e5`，tree `a180b3f00a8344d836e782f69542d1ccb8c16fcf`）。Production server 仍為 authority；contract layer 不重複 ownership transition、combat behavior、runtime lifecycle decisions 或 revision CAS。
