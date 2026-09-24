# Persistent Server Agent Roadmap

更新日期：2026-09-13

本文件是 Persistent Server Agent 的唯一進度與證據來源。Phase 1 至 10 結論限於隔離 PoC；Production PR 1 至 PR 9 與 Ownership Control Plane 已形成正式 patch/controller/config，runtime 證據仍限於隔離 production-like 環境，尚未正式帳號 rollout。

## Architecture Decision

採用 rAthena server-owned Persistent Character。角色由 map-server 長期持有，WEB 僅傳送控制意圖。OpenKore 保留為 fallback。

狀態模型：`PERSISTENT_IDLE`、`AUTO_FARM`、`AUTO_QUEST`、`RECOVERING`、`DEAD`、`NAVIGATING`、`ROUTE_FAILED`、`DESTINATION_REACHED`、`NPC_APPROACHING`、`NPC_DIALOG_OPEN`、`NPC_WAIT_NEXT`、`NPC_WAIT_MENU`、`NPC_WAIT_INPUT`、`NPC_COMPLETE`、`NPC_FAILED`、`SERVICE_INTERACTION`、`SERVICE_FAILED`。

## 已通過 PoC

| 能力 | 結論 | 已驗證範圍 |
| --- | --- | --- |
| Persistent Character lifecycle | PASS | 真實 AID/CID、真實 `map_session_data`、`fd=0`、無 Client/OpenKore、inventory/equipment 載入、DB save |
| Stability / restart recovery | PASS | 10 分鐘穩定、map-server 重啟自動恢復同 CID、無 duplicate/ghost/crash/leak |
| Server-side AUTO_FARM | PASS | target、movement、normal attack、kill、retarget、Base/Job EXP、返回 idle |
| RAM scalability | PASS | 0 至 100 agents，100 agents 穩定，約 0.30 至 0.33 MB/agent |
| Phase 1 Loot Pickup | PASS | 真實怪物掉落、原生距離與拾取 API、真實背包、DB save、滿格與超重拒絕 |
| Phase 2 Skill Combat | PASS | 同一 CID 使用 `SM_BASH`、SP 消耗、擊殺、Base/Job 成長、skill/character save |
| Phase 3 HP / SP Survival | PASS | 25% HP threshold、真實 Red Potion、First Aid、SP 消耗、sit/natural recovery、DB save |
| Phase 4 Death / Respawn | PASS | 真實死亡、固定地圖恢復、返回目標區、續戰 10 kills、fd=0、entity 唯一、DB save |
| Phase 5 Navigation | PASS | 同地圖 pathfinding、真實 warp NPC、跨地圖、destination、stuck detection、retry/fallback、DB save |
| Phase 6 NPC Interaction | PASS | approach、click、dialogue、next、menu select、close、script state、fd=0、entity 唯一 |
| Phase 7 Shop Service | PASS | 原生 buy/sell、真實 Zeny/inventory、fd=0、entity 唯一、DB save |
| Phase 7 Storage Service | PASS | 原生 storage open/add/get/close、真實 inventory/storage、fd=0、entity 唯一、DB save |
| Phase 7 Kafra Save Point | PASS | Kafra NPC script、menu select、真實 save point、fd=0、entity 唯一、DB save |
| Phase 7 Transportation | PASS | NPC dialogue/menu、跨圖、map reattach、fd=0、iddb/entity 唯一、DB save |
| Phase 8 AUTO_QUEST | PASS | 隔離 taskId/questId、NPC 接取、route、combat、真實 quest progress、返回 NPC、complete、DB save |
| Controller core 前置 PoC | PASS | CID 定位、合法 mode transition、非法 transition 拒絕、停止移動與攻擊、entity 唯一、DB save |
| Phase 9 WEB Controller | PASS | 隔離 HTTP command/state、start/stop、map/mob、AUTO_QUEST/cancel、authoritative state、控制端關閉後續行 |
| Phase 10 Persistent State | PASS | SQL agent state、AUTO_FARM restart resume、AUTO_QUEST phase/quest-state resume、完成後回 idle |

## Benchmark

| 指標 | 數值 |
| --- | --- |
| 0 agents map-server Working Set | 439.75 MB |
| 100 agents map-server Working Set | 469.96 MB |
| Persistent agent RAM 增量 | 約 0.30 至 0.33 MB/agent |
| OpenKore Working Set | 44.5 MB/角色 |
| OpenKore Private Bytes | 140.4 MB/角色 |

RAM 結果支持 server-side agent 路線。OpenKore 數據僅作 fallback 成本基準。

## Current Architecture

`map-server startup → char-server 載入真實角色 → fd=0 map_session_data → PERSISTENT_IDLE / AUTO_FARM → rAthena 原生 movement、combat、EXP、item、save`

Production PR 1 lifecycle、Ownership Control Plane、Production PR 2 AUTO_FARM、Production PR 3 Loot Pickup、Production PR 4 Skill Combat、Production PR 5 HP/SP Survival、Production PR 6 Death/Respawn、Production PR 7 Navigation、Production PR 8 NPC Interaction 與 Production PR 9 Service Interaction 已存在於 terminal-arpg 的正式 patch/controller/config；實際 runtime gate 在可丟棄 checkout 完成。正式 stack 預設 `PersistentAgentEnabled=$false`、`PersistentAgentLootEnabled=$false`、`PersistentAgentSkillEnabled=$false`、`PersistentAgentSurvivalEnabled=$false`、`PersistentAgentDeathRecoveryEnabled=$false`、`PersistentAgentNavigationEnabled=$false`、`PersistentAgentNpcEnabled=$false`、`PersistentAgentServiceEnabled=$false`，尚未對正式帳號啟用。AUTO_QUEST 與其餘未搬移能力仍只存在隔離 PoC。

## Target Architecture

`WEB → Persistent Character Controller → rAthena Server-side Agent → 真實 character / inventory / equipment / quest data`

角色生命週期由伺服器持有。控制介面關閉不改變角色在線狀態。

## Development Phases

| Phase | 範圍 | 狀態 |
| --- | --- | --- |
| 0 | Persistent lifecycle、restart recovery、AUTO_FARM、RAM benchmark | PASS |
| 1 | Loot pickup、距離、inventory、weight/capacity、save | PASS |
| 2 | Skill combat 最小閉環 | PASS |
| 3 | HP / SP 生存系統 | PASS |
| 4 | Death / Respawn 完整閉環 | PASS |
| 5 | Navigation | PASS |
| 6 | NPC Interaction | PASS |
| 7 | Service Interaction | PASS |
| 8 | AUTO_QUEST | PASS |
| 9 | WEB Controller | PASS |
| 10 | Persistent State | PASS |
| 11 | OpenKore Dependency Reduction | STATIC ONLY，矩陣整理完成，未做 runtime 切換驗證 |
| 12 | Scale / Production Gate | NOT RUN；未驗證草稿已清除 |

## Completed

- 真實角色 server-owned lifecycle 與 restart recovery。
- 單角色 AUTO_FARM 與 100 agents RAM scalability。
- Phase 1 真實地面物品拾取、真實背包保存、滿格與超重邊界。
- Phase 2 `SM_BASH` 技能戰鬥、SP、EXP 與保存。
- Phase 3 低 HP 藥水、自補技能與低 HP/SP 坐下自然恢復。
- Phase 4 `AUTO_FARM → DEAD → RECOVERING → 返回目標區 → AUTO_FARM → PERSISTENT_IDLE`。
- Phase 5 `prt_fild08 → warp NPC → prt_fild07 → destination`，含不可達座標 retry/fallback。
- Phase 6 隔離 NPC 的 approach、click、dialogue、next、menu select、close 完整閉環。
- Phase 7 shop 獨立回歸：買入與賣出同一測試物品，真實 Zeny/inventory 變化與保存正確。
- Phase 7 storage 獨立回歸：測試物品存入、取回、關閉與清除，inventory/storage 保存正確。
- Phase 7 Kafra save-point 獨立回歸：NPC dialogue/menu 寫入真實角色 save point，DB 保存正確。
- Phase 7 transportation 獨立回歸：NPC dialogue/menu 跨圖、reattach 與保存正確。
- Phase 8 隔離 task 70001 / quest 90000 的 NPC、route、3 kills、return、complete 完整閉環。
- Phase 9 隔離 HTTP controller 的 start/stop、target、AUTO_QUEST/cancel、state read 與 WEB 關閉後續行。
- WEB Controller 前置證據：以 CID 控制 `PERSISTENT_IDLE → AUTO_FARM → PERSISTENT_IDLE`，並拒絕非法 `PERSISTENT_IDLE → RECOVERING`。
- Phase 10 SQL agent state schema、AUTO_FARM restart resume、AUTO_QUEST accept/combat/return phase 保存與 quest-state-driven resume。
- Phase 11 僅完成靜態依賴矩陣整理；未執行 runtime 切換或移除驗證，現階段移除數為 0。

## In Progress

目前工作已依指示停止。實際 runtime 驗證完成到 Phase 10；Phase 11 僅完成靜態矩陣整理。

## Pending

- Phase 12 未執行 250、500、1000 agents；量測草稿已由隔離 PoC 清除。

## Known Issues

- Phase 1 只驗證單角色、單地圖、指定怪物、60 秒；未涵蓋多角色 loot contention。
- 5 格遠距 floor item 已驗證會呼叫 `unit_walktobl(..., 2, 2)` 並成功拾取；尚未涵蓋不可達地形。
- 背包滿測試期間後續怪物掉落持續觸發拒絕，60 秒共記錄 70 次 failure；功能正確，正式控制器需採用退避或停止拾取策略。
- 100-agent benchmark 的既有 kill counter 與固定 mob pool 曾出現不一致；RAM、entity、crash/leak 結論有效，kill 數不作容量結論。
- 尚未完成正式 rAthena core 邊界與可維護模組拆分。
- Phase 9 transport 為 loopback HTTP + file queue PoC，尚未具備正式驗證、授權、多命令佇列與跨程序可靠投遞。
- Phase 10 state schema 與恢復器仍位於隔離 PoC，尚未完成 migration、transaction/retry、未知 phase 隔離與版本升級策略。

## Test Evidence

| 測試 | 結果 |
| --- | --- |
| x64 Release rebuild | 成功，0 errors；133 個既有字碼頁 warnings |
| 正常 loot，1 agent，60 秒 | 26 kills、15 pickups、0 failures、1 entity |
| 正常 loot DB save | inventory 由 1 row 增至 5 rows、合計 16 items；Jellopy 11；Base EXP 3948、Job EXP 4271 |
| 遠距 loot movement | floor item 起始距離 5 格；`loot_walks=1`、15 pickups、0 failures、1 entity |
| 背包滿 | 100/100 slots、0 pickups、70 failures、1 entity；未突破容量 |
| 超重 | 起始 14950/23000，地面 Jellopy 806 個；大型拾取未入背包，測後 Jellopy 1464 個，未增加至 2270 個 |
| Phase 2 Skill Combat | `SM_BASH` level 1；7 uses；SP 44→4；Base Lv 14→15；Job Lv 10→12；skill row 已保存；1 entity |
| Phase 3 HP / SP Survival | HP 30→101（Red Potion）；First Aid HP 61→66、SP 27→24；坐下 20 秒後 HP 82、SP 16；entity=1；fd=0；DB save；無 fixture 殘留 |
| Phase 4 Death / Respawn | HP 122→0→62；回到 `prt_fild08 (200,325)`；mode=1 續戰 10 kills；最終 mode=0；fd=0；iddb/in-map=1；entity=1；DB save |
| Phase 5 Navigation | `unit_walktoxy` 進入真實 warp NPC；`prt_fild08 (30,239) → prt_fild07 (379,239) → (365,239)`；不可達 `(0,0)` 回傳 0；retry=1；fallback 至 `(370,239)`；fd=0；entity=1；DB save |
| Phase 6 NPC Interaction | approach distance 4；click result=0；dialogue STOP；next 後 2-option menu；select value=1；close state 完成；fd=0；entity=1；DB save |
| Phase 7 Shop Service | `npc_buysellsel`、`npc_buylist`、`npc_selllist` 均成功；Zeny 1000→900→905；測試物品 0→1→0；fd=0；entity=1；DB save |
| Phase 7 Storage Service | `storage_storageopen/add/get/close` 成功；inventory 0→1→0→1；storage 0→1→0；close flag=0；fd=0；entity=1；DB save；測試物無殘留 |
| Phase 7 Kafra Save Point | NPC click=0；menu=2；select=1；save point=`prt_fild07 (365,239)`；closed=1；fd=0；entity=1；DB save 後一致；測後恢復 `prt_fild08 (100,300)` |
| Phase 7 Transportation | NPC click=0；menu=2；select=1；抵達 `prt_fild08 (100,300)`；reattach=1；fd=0；iddb=1；entity=1；DB save |
| AUTO_QUEST 局部 PoC | Quest 4276；count 0→10；`HUNTING=2`；DB `count1=10`；map-server 重載後仍為 2；1 entity |
| Phase 8 AUTO_QUEST | task 70001 / quest 90000；NPC accept=1；route=1；3 Poring kills；`HUNTING=2`；NPC complete；`Q_COMPLETE=2`；mode=0；fd=0；entity=1；DB state=2/count1=3；測後移除 quest fixture |
| Phase 9 WEB Controller | start farm 後 mode=`AUTO_FARM`、map=`prt_fild08`、mob=1002；WEB 關閉 8 秒 kills 5→9；重開讀到 kills=17；stop 回 idle；AUTO_QUEST cancel race 修正後 active=false；錯誤 CID reject；fd=0；entity=1 |
| Phase 10 AUTO_FARM recovery | SQL row=`enabled=1/mode=AUTO_FARM/task_type=farm/phase=combat/map=prt_fild08/rules=mob=1002`；map-server restart 後 log=`RESTORED`；kills 17→18；fd=0；entity=1；stop 後 row 回 idle |
| Phase 10 AUTO_QUEST recovery | SQL row=`mode=AUTO_QUEST/task=70001/phase=accept/quest=90000`；restart 後依真實 quest absence 恢復 accept→route→combat→3 kills→return→complete；最終 quest state=2/count1=3、agent row=idle、fd=0、entity=1 |
| Controller core 前置 PoC | 非法 recovery transition 拒絕；idle→farm=1；farm→idle=1；最終 mode=0；全程 entity=1；10 秒內 4 kills；DB save |
| shutdown | map-server 正常清理並回報 no memory leaks；最後一輪 char/login 依序關閉亦回報 no memory leaks；早期同步 Ctrl+C 的 login 結果不作穩定性證據 |
| 測試資料清理 | CID 1500901 恢復只保留原 Knife 1 件，`online=0` |

## Phase 1 至 10 Runtime Evidence Index

| Phase | Runtime 測試內容 | 修改檔案 | 關鍵 log / 結果 | 已知限制 | Fixture / 自訂內容 |
| --- | --- | --- | --- | --- | --- |
| 1 Loot | 擊殺、地面掉落、移動拾取、背包與重量邊界、DB save | `src/map/chrif.cpp` | 26 kills、15 pickups、0 failures；滿格 100/100 時 0 pickups；超重物品未入背包 | 單角色、單地圖、單怪種；不可達掉落與多角色競爭未驗證 | Poring pool、遠距 floor item、滿格與超重 fixture；無自訂 NPC/quest |
| 2 Skill | 同 CID 使用 Bash、SP/EXP/cooldown/range/target 與 save | `src/map/chrif.cpp` | `SM_BASH` Lv.1、7 uses、SP 44→4、Base 14→15、Job 10→12、entity=1 | 單職業、單技能；施法中斷與技能矩陣未驗證 | 測試技能與 Poring pool；無自訂 NPC/quest |
| 3 Survival | 低 HP 藥水、First Aid、低 HP/SP 坐下恢復、save | `src/map/chrif.cpp` | HP 30→101；First Aid HP 61→66、SP 27→24；坐下後 HP 82、SP 16 | 單一消耗品與自補技能；耗盡、逃離與策略優先級未驗證 | Red Potion、HP/SP 注入 fixture；無自訂 NPC/quest |
| 4 Death | 真實死亡、save point respawn、返回目標區、續戰、save | `src/map/chrif.cpp` | HP 122→0→62；回 `prt_fild08 (200,325)`；續戰 10 kills；fd=0、entity=1 | 固定地圖與恢復點；重啟中死亡、跨圖失敗重試未驗證 | 強制死亡與固定恢復座標 fixture；無自訂 NPC/quest |
| 5 Navigation | 同圖 pathfinding、warp、跨圖、destination、stuck retry | `src/map/chrif.cpp` | `prt_fild08→prt_fild07`；不可達 `(0,0)` 回傳 0；retry=1；到 `(370,239)` | 單一路線；通用 portal graph、成本與傳送道具未驗證 | 固定座標與不可達點 fixture；使用既有 warp，無自訂 quest |
| 6 NPC | approach、click、dialogue、next、menu、select、close | `src/map/chrif.cpp`、`npc/custom/persistent_poc_npc.txt`、`npc/scripts_custom.conf` | approach distance=4；2-option menu；select=1；closed；fd=0、entity=1 | 僅隔離 NPC；正式 NPC 腳本差異、錯誤選單與超時矩陣未驗證 | 使用自訂 NPC；無自訂 quest |
| 7 Services | shop buy/sell、storage add/get、save point、transport | `src/map/chrif.cpp`、`npc/custom/persistent_poc_npc.txt`、`npc/scripts_custom.conf` | Zeny 1000→900→905；storage 0→1→0；save point DB 一致；transport reattach=1 | 每種服務各一條隔離 happy path；正式 NPC、容量、資金與異常路徑未驗證 | 自訂 shop/Kafra/transport NPC 與測試物品；無自訂 quest |
| 8 AUTO_QUEST | task 70001 驅動 NPC accept、route、combat、return、complete、save | `src/map/chrif.cpp`、`npc/custom/persistent_poc_npc.txt`、`npc/scripts_custom.conf`、`db/import/quest_db.yml` | 3 Poring kills；`HUNTING=2`；`Q_COMPLETE=2`；mode=idle；fd=0、entity=1 | 僅自訂 quest 90000；正式複雜任務【資料不足，無法確認】 | 自訂 NPC 與 quest 90000 |
| 9 WEB Controller | start/stop、map/mob、start/cancel quest、state read、控制端關閉續行 | `src/map/chrif.cpp`、`src/map/chrif.hpp`、`tools/persistent_web_poc.ps1` | WEB 關閉 8 秒 kills 5→9；重開讀到 kills=17；錯誤 CID reject；停止回 idle | 僅 loopback HTTP + file queue；無正式 auth、可靠 queue、ack 或部署驗證 | loopback bridge；quest 命令使用自訂 quest 90000 |
| 10 Persistent State | SQL 保存 mode/task/phase/target；AUTO_FARM 與 AUTO_QUEST restart resume | `src/map/chrif.cpp`、`poc_agent_state.sql` | AUTO_FARM restart 後 kills 17→18；AUTO_QUEST 從 accept 恢復並完成；最終 row=idle、fd=0、entity=1 | 無 migration、transaction/retry、schema version、未知 phase 隔離 | SQL state fixture；AUTO_QUEST recovery 使用自訂 quest 90000 |

Phase 11 只有靜態依賴矩陣，沒有 runtime 切換證據。Phase 12 NOT RUN。

## Modified rAthena Core Files

隔離 PoC checkout：`.tmp-persistent-character-poc`

| 檔案 | 用途 |
| --- | --- |
| `src/map/chrif.cpp` | Persistent lifecycle、AUTO_FARM、loot、skill、recovery、navigation、NPC、service、AUTO_QUEST 與 Controller core PoC |
| `src/map/chrif.hpp` | PoC 初始化入口、mode enum、Controller core API |
| `npc/custom/persistent_poc_npc.txt` | 隔離 NPC 與 shop 測試腳本 |
| `npc/scripts_custom.conf` | 載入隔離 PoC NPC 腳本 |
| `db/import/quest_db.yml` | 隔離 quest 90000 定義 |
| `tools/persistent_web_poc.ps1` | 隔離 loopback HTTP command/state bridge |
| `poc_agent_state.sql` | 隔離 `persistent_agent_state` schema |

隔離環境另修改 `conf/char_athena.conf`、`conf/inter_athena.conf`、`conf/login_athena.conf`、`conf/map_athena.conf`；`poc_seed.sql` 為測試角色資料。`persistent_poc_state.json` 是 runtime 產物。Phase 12 的上限 1000、動態 mob pool、tick latency、save request 與 scale switch 草稿均已清除；依本輪限制未重新編譯或執行測試。

## PoC → Production Integration Gap

| Gap | 隔離 PoC 現況 | 正式整合最低要求 |
| --- | --- | --- |
| 程式所在位置 | 全部 Agent 能力只在 `.tmp-persistent-character-poc` | 以可維護 patch/module 套入鎖定 rAthena；不可直接依賴暫存 checkout |
| Lifecycle hook | PoC 在 char-server ready 路徑載入固定角色，並取代該 checkout 的 autotrade init | 與既有 autotrade 共存；使用明確 enable/config；啟停與 shutdown ownership 可重入 |
| Agent identity | AID/CID、地圖、怪物、task/quest 多為常數或環境旗標 | 從授權後的角色設定與持久狀態載入；拒絕非本人 CID 與重複 entity |
| 模組邊界 | lifecycle、AI、service、WEB/state PoC 集中於 `chrif.cpp` | 拆成 Persistent Agent 模組；rAthena core 僅保留最小 startup/auth/save hook |
| Controller transport | loopback HTTP bridge 與單檔 command/state | 型別化 action、角色 ownership、authentication、durable queue、idempotency、ack 與 timeout |
| Persistent schema | 單一 PoC SQL table | migration、索引、transaction/retry、schema version、invalid phase quarantine 與 backup/rollback |
| 行為覆蓋 | 單地圖、單怪、單技能與少量自訂 NPC/quest | 每項正式內容需獨立 regression；Phase 6、8、9 不可直接外推至正式內容 |
| Reconnect / duplicate | server-owned 無 client 情境已驗證 entity 唯一 | 正式登入接管、duplicate login、ownership transfer 與 rollback 尚無本輪 runtime 證據 |
| Operations | 以環境變數、console log 與手動 SQL 查核 | 健康狀態、metrics、結構化 log、graceful shutdown、故障恢復與管理開關 |
| Build / deployment | 可丟棄 checkout 手動 build | 固定 patch 套用、x64 build、最小 regression、版本 gate 與可回退部署 |

### 正式整合最小修改集合

以下只列規劃，不代表已實作：

| 檔案或元件 | 最小用途 |
| --- | --- |
| rAthena `src/map/persistent_agent.hpp`、`persistent_agent.cpp` | 承載 lifecycle、mode、controller dispatch、AI 與 state restore |
| rAthena `src/map/chrif.cpp` / `chrif.hpp` | char-server ready、真實角色 load/save 的最小掛點 |
| rAthena build project files | 將新模組加入 Windows 與其他正式 build 路徑 |
| `ops/ro-stack/patches/persistent-agent.patch` | 固定並可重現地套用鎖定 rAthena 修改 |
| Agent state SQL migration | 建立具版本的正式 schema 與索引 |
| `ops/ro-stack/stack.config.psd1` | enable flag、允許角色與安全預設值 |
| `ops/ro-stack/ro-stack.ps1` | 套 patch、執行 migration、啟停與回退 |
| `ops/ro-stack/dashboard.mjs` | 接入既有 session ownership 後提供型別化 controller API |
| 最小 persistent-agent regression script | 驗證 lifecycle、save/restart、entity 唯一與 controller ack |

正式整合前，先限定只移植 Phase 0 lifecycle、Phase 9 controller contract、Phase 10 state restore；其餘 Phase 1 至 8 依功能逐項加入，不一次性搬移。

## Production Integration Design

本節是正式實作契約。它不改變 Phase 1 至 10 僅在隔離 PoC 通過的證據邊界，也不授權 Phase 12。

### 1. 模組邊界

建議 rAthena 結構：

```text
src/map/
  persistent_agent.hpp
  persistent_agent.cpp
  persistent_agent_state.hpp
  persistent_agent_state.cpp
  chrif.cpp
  chrif.hpp
  map.cpp
```

`persistent_agent.hpp` 只公開窄介面與型別：`ControlOwner`、`AgentMode`、`AgentState`、`AgentCommand`、`CommandResult`，以及 init、char-server ready、auth complete、prepare shutdown、submit command、read status。它不可公開可繞過 ownership 或 rAthena 規則的操作。

`persistent_agent.cpp` 負責：

- AID/CID registry 與每個 CID 唯一 `map_session_data` ownership。
- server-owned character load、map attach、timer 註冊與取消。
- owner state machine、agent mode state machine、命令驗證與 idempotency。
- save orchestration、shutdown drain、restart reconciliation。
- 呼叫 rAthena 原生 movement、combat、item、skill、NPC、service、quest API。

`persistent_agent_state.cpp/.hpp` 負責 agent state 與 durable command 的 SQL repository、revision compare-and-set、schema version 檢查、錯誤轉換。它不可讀寫 HP、SP、EXP、inventory、equipment、quest 等角色資料副本。

Phase 1 至 8 正式搬移時，behavior 依領域拆成 `persistent_agent_combat.cpp`、`persistent_agent_navigation.cpp`、`persistent_agent_service.cpp`、`persistent_agent_quest.cpp`。第一個 PR 不建立這些 behavior 模組。

`chrif.cpp/.hpp` 只保留：

1. `chrif_on_ready()` 在既有 `do_init_buyingstore_autotrade()` 與 `do_init_vending_autotrade()` 完成後通知 `persistent_agent_on_char_server_ready(first_ready)`；不可取代既有 autotrade 初始化。
2. 既有 character auth 成功後，對 module 已登記的 pending CID 呼叫 `persistent_agent_on_auth_complete(sd)`。
3. char-server 連線中斷與恢復時通知 module 暫停新 mutation、恢復 pending save/command。

`map.cpp` 在 `MapServer::finalize()` 的 player `map_quit()` 迴圈前呼叫 `persistent_agent_prepare_shutdown()`，先停止 timers、持久化 intent 並關閉 NPC/storage context。角色實體仍由既有 `map_quit()`、`chrif_save()`、`unit_free_pc()` 完成最終保存與釋放。

禁止留在 `chrif.cpp` 的邏輯：target selection、movement、attack、loot、skill policy、HP/SP policy、death recovery、navigation、NPC 對話、service、quest phase、WEB command parsing、SQL schema/query、fixture、硬編碼 CID/map/mob/task、agent timer callback。

Windows build 必須把四個新檔加入 `src/map/map-server.vcxproj` 與 `.filters`。CMake 的 `GLOB_RECURSE` 與 Makefile 的 `find *.cpp` 已能收集新檔，仍須在正式 build gate 驗證。

### 2. Character Ownership Contract

每個角色同時只能有一個 controller owner，每個 account 同時只能有一個 resident character。

- `char` table 仍是 account/character 關係的 authority。agent table 只保存 ownership 與執行 intent。
- `char_id` 是 agent state primary key；`account_id` 設 unique key。載入時必須與 `char.account_id` 比對，不一致即進入 `QUARANTINED`。
- 只有 `agent_enabled=1`、`control_owner=SERVER_AGENT`、位於 allowlist 且沒有既存 entity/auth request 的角色可由 map-server 載入。
- WEB 只是一個 controller。它不能建立 `map_session_data`、直接改角色表、送 SQL、送任意 rAthena/OpenKore 指令或宣稱遊戲結果。
- OpenKore 只可在 `control_owner=OPENKORE`、agent entity 已釋放、角色 `online=0`、沒有 pending Agent command 時啟動。
- 同一 AID 或 CID 永遠禁止 OpenKore、RO Client 與 Server Agent 同時控制。
- 第一版不支援 live takeover。ownership 切換只允許由受控管理流程執行。

Ownership state machine：

```text
OPENKORE
  → CLAIMING_AGENT
  → SERVER_AGENT
  → RELEASING_AGENT
  → OPENKORE

任何驗證失敗
  → QUARANTINED
```

`OPENKORE → CLAIMING_AGENT` 前置條件：停止並確認 OpenKore process、角色 `online=0`、無 map entity、無 auth node、無未完成 OpenKore command。完成 DB compare-and-set 後才可載入角色。

`SERVER_AGENT → RELEASING_AGENT` 只允許角色先回 `PERSISTENT_IDLE`。流程依序停止新命令、停止 timer/action、關閉互動 context、保存角色、移除 entity、確認 `online=0`、更新 owner。最後才允許啟動 OpenKore。

`QUARANTINED` 禁止 Agent 與 OpenKore啟動，保留 error code 與 state snapshot，等待人工處理。第一個正式 PR 只開放隔離測試帳號，RO Client 登入不在支援範圍。

### 3. Lifecycle Contract

| 事件 | 必須執行 | 成功後狀態 | 失敗處理 |
| --- | --- | --- | --- |
| server boot | 正常初始化 rAthena、連上 char-server、保留 autotrade init、檢查 schema/config | Agent module READY | module disabled；不可阻止 map-server 啟動 |
| load persistent characters | 查詢 enabled + SERVER_AGENT rows；驗證 AID/CID、allowlist、revision、無 entity/auth duplicate；走既有 char load/auth path | 每 CID 一個 fd=0 entity，先進 `RECOVERING` | 該 CID `QUARANTINED`，其他角色繼續 |
| `PERSISTENT_IDLE` | 保留 entity、停止 AI timer、允許 save/status/ownership release | `active=false` | entity 不完整即 quarantine |
| `AUTO_FARM` | 只由 confirmed command 或 restart intent 進入；執行已註冊 farm behavior | mode=`AUTO_FARM` | validation failure 保持原 mode；runtime fault 停止 action 並回 idle/quarantine |
| `AUTO_QUEST` | 驗證 task/quest adapter 與真實 quest state；依 phase 執行 | mode=`AUTO_QUEST` | 不刪 quest、不偽造完成；停止並保存可恢復 phase |
| save | 先 `pc_makesavestatus()`，再用既有 `chrif_save()` 保存角色；agent intent 以 revision 保存 | dirty flags 清除或標記 pending | char-server 不可用時禁止 server-confirmed mutation並保留 pending |
| map-server shutdown | 停止 command intake、persist intent、取消 timers、停止 movement/attack、關閉 context，再交既有 map shutdown 保存與 free | runtime entity=0；owner intent 保留 | 超時記錄 error；不可啟動 OpenKore |
| restart recovery | 重新驗證 owner/schema；載入同 CID；比對真實 char/quest state；由 `RECOVERING` 進入 persisted mode/phase | 同 CID、單一 entity、原 intent 恢復 | 無法調和的 state 進 quarantine |

Agent mode state machine：

```text
RECOVERING → PERSISTENT_IDLE
PERSISTENT_IDLE → AUTO_FARM → PERSISTENT_IDLE
PERSISTENT_IDLE → AUTO_QUEST → PERSISTENT_IDLE
AUTO_FARM / AUTO_QUEST → DEAD → RECOVERING → persisted intent
任一 active mode → shutdown drain → restart RECOVERING
```

`cancel task` 只停止 Agent task intent並回 idle；真實 rAthena quest state保留。`stop` 只停止 AUTO_FARM。任何未列 transition 都回 `INVALID_TRANSITION`。

### 4. Schema Design

只新增 Agent metadata。角色本體、HP/SP、EXP、位置、inventory、equipment、skill、quest 仍由既有 rAthena tables 保存。

```sql
CREATE TABLE persistent_agent_state (
  char_id             INT UNSIGNED NOT NULL,
  account_id          INT UNSIGNED NOT NULL,
  agent_enabled       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  control_owner       VARCHAR(24) NOT NULL DEFAULT 'OPENKORE',
  ownership_state     VARCHAR(24) NOT NULL DEFAULT 'OPENKORE',
  agent_mode          VARCHAR(24) NOT NULL DEFAULT 'PERSISTENT_IDLE',
  task_type           VARCHAR(24) NULL,
  task_id             BIGINT UNSIGNED NULL,
  task_phase          VARCHAR(32) NULL,
  target_map          VARCHAR(32) NULL,
  target_rules        LONGTEXT NULL,
  revision            BIGINT UNSIGNED NOT NULL DEFAULT 0,
  state_version       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  last_command_id     CHAR(36) NULL,
  last_error_code     VARCHAR(64) NULL,
  updated_at          DATETIME(3) NOT NULL,
  PRIMARY KEY (char_id),
  UNIQUE KEY uq_persistent_agent_account (account_id),
  KEY ix_persistent_agent_boot (agent_enabled, control_owner, ownership_state)
) ENGINE=InnoDB;

CREATE TABLE persistent_agent_command (
  command_id          CHAR(36) NOT NULL,
  char_id             INT UNSIGNED NOT NULL,
  action              VARCHAR(24) NOT NULL,
  payload             LONGTEXT NOT NULL,
  payload_hash        CHAR(64) NOT NULL,
  expected_revision   BIGINT UNSIGNED NOT NULL,
  command_status      VARCHAR(16) NOT NULL,
  reason_code         VARCHAR(64) NULL,
  resulting_revision  BIGINT UNSIGNED NULL,
  requested_at        DATETIME(3) NOT NULL,
  accepted_at         DATETIME(3) NULL,
  confirmed_at        DATETIME(3) NULL,
  PRIMARY KEY (command_id),
  KEY ix_agent_command_pending (char_id, command_status, requested_at)
) ENGINE=InnoDB;
```

`target_rules` 與 `payload` 使用版本化 JSON object，但 SQL 不解析遊戲規則。application 必須驗證 JSON schema、大小與 allowlist。沒有 foreign key，因為鎖定版 `char` table 使用 MyISAM；load 時以 join/lookup 驗證 AID/CID。任何 mismatch 不自動修正。

State update 使用 `char_id + expected revision` compare-and-set；成功後 `revision+1`。command 與 state metadata 使用同一 InnoDB transaction。角色 save 仍走既有 char-server path，因此不宣稱與 Agent metadata 跨服務原子提交。

### 5. Command / Controller Contract

正式路徑：`WEB session → dashboard typed API → durable command table → map-server Agent → authoritative state/command result → dashboard → WEB`。

API：

| Method / path | 用途 |
| --- | --- |
| `POST /api/ro/agents/{charId}/commands` | 提交四種 mutation |
| `GET /api/ro/agents/{charId}/commands/{commandId}` | 查 accepted/rejected/confirmed 結果 |
| `GET /api/ro/agents/{charId}/status` | 讀 owner、mode、phase、revision 與 live state |

Mutation request 共通欄位：

```json
{
  "commandId": "UUID",
  "action": "start_farm | stop | start_quest | cancel_task",
  "expectedRevision": 12,
  "parameters": {}
}
```

| Action | parameters | 接受條件 | confirmed 結果 |
| --- | --- | --- | --- |
| `start_farm` | `targetMap`、版本化 `targetRules` | owner=SERVER_AGENT、mode=idle、無 active task、map/rules allowlisted | mode=AUTO_FARM、revision 增加、timer active |
| `stop` | 空 object | owner=SERVER_AGENT；AUTO_FARM 或已 idle | movement/attack/timer 已停、mode=idle；重送可 confirmed no-op |
| `start_quest` | `taskType`、`taskId`、`questId`、adapter version | owner=SERVER_AGENT、mode=idle、adapter allowlisted、真實 quest state 可開始/恢復 | mode=AUTO_QUEST、task/phase 已保存 |
| `cancel_task` | 可選 `taskId` | owner=SERVER_AGENT、active task 相符或已取消 | action/context 已停、agent task 欄位清除、mode=idle；rAthena quest 不刪除 |

Command status 定義：

- `QUEUED`：Dashboard 已驗證 WEB session、角色 ownership 與 request schema，命令已 durable write。這不代表 Agent 接受。
- `ACCEPTED`：map-server 已驗證 owner、revision、mode transition 與參數。
- `REJECTED`：Agent 拒絕且不改 mode；必須回穩定 `reasonCode`。
- `CONFIRMED`：in-memory transition 完成，Agent metadata transaction committed，status 已反映 resulting revision。

`serverConfirmed=true` 只對 `CONFIRMED`。角色 DB save ack 不在此定義內；需要持久保存證據的流程另由 status 暴露 `savePending/lastSavedAt`。

Idempotency 規則：相同 `commandId + payloadHash` 永遠返回既有結果；相同 commandId 搭配不同 payload 回 `IDEMPOTENCY_CONFLICT`；`expectedRevision` 不符回 `STALE_REVISION`；每 CID 同時只處理一個 mutation。Dashboard timeout 後只能查 commandId，不能產生新 commandId 重送同一操作。

HTTP 建議：durable queued 回 202；已完成 idempotent replay 回 200；session/ownership/格式錯誤回 403/404/422；revision 或 command conflict 回 409。遊戲狀態拒絕可保留 HTTP 200 並由 command result 表達 `REJECTED`，避免把 transport 與遊戲裁定混為一體。

### 6. OpenKore Coexistence

| 功能 | 目前 owner | Agent runtime 證據 | fallback | Ownership 規則 |
| --- | --- | --- | --- | --- |
| 正式角色 lifecycle | OpenKore | 隔離 PoC PASS | OpenKore | selected account 通過正式 gate 前不切換 |
| combat / loot / skill / survival / death | OpenKore | 隔離 PoC 各有最小 PASS | OpenKore | 逐功能 regression 後才啟用 Agent adapter |
| navigation / NPC / service | OpenKore | 隔離單一路徑 PASS | OpenKore | Phase 6 僅隔離 NPC；正式內容未驗證 |
| AUTO_QUEST | OpenKore | 僅自訂 quest 90000 PASS | OpenKore | 正式複雜任務【資料不足，無法確認】 |
| WEB controller | OpenKore command/status bridge | 僅 loopback PoC PASS | 既有 Dashboard + OpenKore | durable contract 完成前不切換 |
| stat/skill allocation、equipment、onboarding、job change、social、pet 類 | OpenKore | 【資料不足，無法確認】 | OpenKore | Agent 禁用 |

禁止同一角色分功能雙重控制。即使 Agent 只負責 combat，該角色也不能由 OpenKore執行 navigation 或 status command；fallback 的單位是整個角色 ownership，不做同時混合控制。

### 7. Build / Deployment Design

正式需要：

1. 以單一 `ops/ro-stack/patches/persistent-agent.patch` 固定 rAthena 新模組與最小 hooks。
2. 更新 Windows `map-server.vcxproj/.filters`；CMake/Make 維持自動收集並納入 build gate。
3. `stack.config.psd1` 新增 disabled-by-default flag、selected account allowlist、poll/save/shutdown timeout；不得放密碼或任意 action。
4. `ro-stack.ps1` 以 rAthena commit + patch hash 建 build stamp；patch 變更時即使 binary 存在也必須 rebuild。
5. bootstrap 先檢查 schema version，再執行獨立、可重複 migration；schema 不相容時保持 Agent disabled。
6. 啟動順序維持 MariaDB、login、char、map、Dashboard；Agent 只在 char-server ready 後載入。
7. 現有 `server-ai-mvp.patch` 使用 vending/autotrade 與 `[server-ai]` sentinel，和已失敗的 vending reopen 路線重疊。它不屬 Persistent Agent 設計；正式 PR 必須移除或由新 patch 明確取代，禁止兩個 patch 同時套用。

Rollback：先關閉新 command、將 selected agents drain 至 idle、保存並釋放 entity、確認 `online=0`，再把 owner 切回 OPENKORE。停止 stack，回復上一個 patch hash與 binary，保留 agent tables 作稽核，不刪角色資料，重新啟動後只對已 release 的角色啟動 OpenKore。

### 8. Regression Gate

| Gate | 最小正式測試 | PASS 條件 |
| --- | --- | --- |
| lifecycle | selected 真角色 load、fd=0、idle 10 分鐘、save/shutdown | CID/AID 正確、entity=1、資料一致、無 error spam/leak |
| restart | idle、AUTO_FARM、AUTO_QUEST 各自 restart | 同 CID 恢復正確 mode/phase、entity=1 |
| combat | 指定正式測試圖與怪物 10 kills | EXP 正常、retarget、stop 回 idle |
| loot | 真掉落、距離、滿格、超重、不可達 | rAthena 規則一致、無重複物品 |
| skill | 一職業一技能起步，含 SP/cooldown/range/failure | server validation 與 save 一致 |
| survival | potion/self skill/sit、資源耗盡 | 真 inventory/SP、無 bypass |
| death | 真死亡、save point、返回、續戰 | DEAD/RECOVERING 正確、無 ghost |
| navigation | 同圖、portal、跨圖、不可達、retry | destination 正確、有限重試、無 busy loop |
| NPC | 隔離 NPC加一個核准的正式代表 NPC | dialogue/menu/close 正確；Phase 6 證據不可單獨滿足 |
| service | shop/storage/save point/transport 的成功與拒絕路徑 | 金錢、物品、storage、位置一致 |
| AUTO_QUEST | quest 90000 regression加一個核准正式代表任務 | 真 quest state、restart/cancel、無偽造完成 |
| WEB command | 四 mutation、status、重送、stale revision、Dashboard restart | accepted/rejected/confirmed 可區分且 idempotent |
| duplicate ownership | Agent resident 時嘗試啟動 OpenKore/第二 Agent；release 後再啟動 | 第二 owner 被拒絕、entity 永遠 ≤1、無角色回滾 |
| rollback | enabled Agent回 OpenKore | drain/save/offline/owner switch 有證據，OpenKore 接回同 CID |

任一 gate 失敗時維持 feature flag off，OpenKore fallback 不變。這些 gate 不等同 Phase 12 壓測。

### 9. 漸進 Migration Order

1. **PoC freeze**：保存 Phase 10 source/evidence，禁止直接複製 fixture、硬編碼與 loopback bridge。
2. **Isolated production-like**：使用正式 patch、build、config、migration、Dashboard contract，但仍使用獨立 DB、port 與測試角色；先只跑 PERSISTENT_IDLE。
3. **Selected test account**：正式 stack 上只 allowlist 一個專用帳號；先完成 lifecycle/restart/duplicate/rollback，再依 Phase 1 至 10 regression逐項開 adapter。
4. **Limited rollout**：固定少量測試帳號，以角色為單位切換 ownership；每批可獨立 rollback；未驗證功能整個角色回 OpenKore。
5. **Broader rollout**：所有功能 gate、觀測、故障演練與 rollback均通過後，才按 cohort 擴大。OpenKore 保留至每項 dependency gate 完成。

每一階段只在前一階段有 server-confirmed evidence、DB一致、entity唯一與 rollback成功後前進。禁止一次取代全部 OpenKore。

### 10. 第一個 Production Integration PR 最小 Scope

第一個 PR 只建立 disabled-by-default 的基礎，範圍固定為：

- 新增 `persistent_agent.hpp/.cpp` 與 `persistent_agent_state.hpp/.cpp`。
- 保留 autotrade，加入 char ready/auth complete 與 map shutdown 三個最小 hooks。
- 新增 state/command schema migration與 schema version check。
- 新增 config flag及單一 selected test account allowlist。
- 只支援 ownership claim/release、真實角色 load、`PERSISTENT_IDLE`、save、restart recovery、status。
- Dashboard 只接 status 與管理用 claim/release；玩家 `start_farm/start_quest` 保持 disabled。
- 加入 lifecycle、restart、duplicate ownership、rollback 四個最小 regression。
- 移除或取代衝突的 `server-ai-mvp.patch` vending/autotrade sentinel 路線。

第一個 PR 明確排除：combat、loot、skill、survival、death、navigation、NPC、service、AUTO_QUEST、正式玩家 rollout、OpenKore 大量移除與 Phase 12。

### 11. Production Integration PR 1 實作紀錄

狀態：**Isolated production-like runtime PASS**。正式 stack 預設仍為 disabled，未對正式玩家或既有 OpenKore instance 啟用。

實作範圍：

- `persistent_agent.cpp/.hpp`：每 CID runtime registry、真實角色載入、fd=0 auth、map attach、`PERSISTENT_IDLE`、status、save、shutdown、restart load、disable/release。
- `persistent_agent_state.cpp/.hpp`：state repository、schema version 檢查、AID/CID 核對、revision compare-and-set、quarantine 與 release transition。
- `chrif.cpp/.hpp`：只加入 char ready、server-owned auth request、auth complete、char-server disconnect 通知。既有 buyingstore/vending autotrade 初始化順序與功能保留。
- `map.cpp`：既有 shutdown player cleanup 前加入 `persistent_agent_prepare_shutdown()`。
- Windows `map-server` 與 `map-server-generator` project/filter 納入四個新檔。

正式專案修改檔案：

| 檔案 | 內容 |
| --- | --- |
| `ops/ro-stack/patches/persistent-agent.patch` | 鎖定 rAthena 的四個正式模組、最小 chrif/map hooks 與 Windows build entries |
| `ops/ro-stack/sql/001-persistent-agent.sql` | `persistent_agent_state`、`persistent_agent_command` metadata schema |
| `ops/ro-stack/stack.config.psd1` | disabled-by-default、account allowlist、poll interval |
| `ops/ro-stack/ro-stack.ps1` | patch apply/check、commit + patch hash build stamp、migration、map-server env |
| `ops/ro-stack/openkore-instance.ps1` | OpenKore start 前 ownership guard |
| `docs/persistent-server-agent-roadmap.md` | PR 1 scope、evidence、限制與 rollback |

舊 `ops/ro-stack/patches/server-ai-mvp.patch` 與 `ops/ro-stack/templates/server_ai_mvp.txt` 已移除。新 patch 不設定 vending、buyingstore 或 autotrade state，也不呼叫 `vending_reopen()`、`buyingstore_reopen()`；原生 vending/autotrade 路徑維持原狀。

Migration 只保存 `char_id`、`account_id`、ownership、agent enabled/mode、task/target metadata、revision、schema version、command state 與 timestamps。HP/SP、EXP、位置、inventory、equipment、quest、Zeny 仍由 rAthena 原生資料表與 char-server save path 管理。

隔離 runtime evidence：

| Gate | 實際結果 |
| --- | --- |
| build | 鎖定 commit `e985006171d2eb320ee512a653f4c83aea3d81b6` 的 `rAthena.sln` Release x64 編譯 PASS；`map-server.exe` 與 `map-server-generator.exe` 均成功 |
| load / idle | AID 2000901、CID 1500901；`LOAD_REQUESTED`、`AUTH_COMPLETE`、`IDLE_READY`；fd=0、map=`prt_fild08`、x=103、y=301、entity=1 |
| native character data | HP 127/127、SP 28/28、inventory count 1、equipment count 1、quest count 1；資料由正常 character auth/load packet 載入 |
| stability / save | `PERSISTENT_IDLE` 持續超過 60 秒；正常 shutdown 出現 `SHUTDOWN_SAVED`；character `online` 回 0；memory manager 回報 no leaks |
| restart recovery | 同 CID 自動重新載入；map/座標、HP/SP、inventory/equipment/quest 一致；entity=1 |
| duplicate ownership | schema runtime 對相同 AID 的第二列回 MariaDB error 1062；module 同時檢查既存 map entity 與 auth node。實際 OpenKore/RO Client 碰撞未執行，標示【資料不足，無法確認】 |
| disable / release | 將隔離列設為 disabled 後依序記錄 `RELEASE_STARTED`、`RELEASED`；entity=0、character `online=0`、owner=`OPENKORE` |
| rollback | `PERSISTENT_AGENT_ENABLED=0` 啟動後記錄 module disabled，未載入 CID；DB 與原生角色資料保持一致，正常 shutdown 無 leak |

Known issues 與證據邊界：

- status query 已有 module API 與 SQL state；Dashboard/WEB contract 本 PR 未接線。
- 實際 OpenKore 與 RO Client ownership collision 尚無 runtime 證據。現有 DB unique constraint、map/auth duplicate guard、OpenKore start guard 已完成靜態與 schema runtime 驗證。
- 未在正式 stack 或正式 DB 啟用；未執行完整 release test、Linux/CMake build、AUTO_FARM 或任何 Phase 12 壓測。
- command table 本 PR 只建立 durable schema，未實作 WEB mutation consumer。

Rollback procedure：

1. 停止新 ownership mutation，將目標列設為 `agent_enabled=0`。
2. 等待 `RELEASED`、entity=0、`char.online=0`，確認 owner 已回 `OPENKORE`。
3. 停止 stack，回復上一個 patch hash與 binary；`ro-stack.ps1` build stamp 會阻止沿用不相符 binary。
4. 保留 Agent metadata tables 作稽核，不刪除或覆寫任何 rAthena 角色資料。
5. 只允許 owner=`OPENKORE` 且無 Agent entity 的帳號恢復 OpenKore。

PR 1 結論：**GO**，限 disabled-by-default 的 lifecycle 基礎整合。正式帳號 rollout、live Client/OpenKore collision gate 與所有 behavior 功能仍未授權。

### 12. Stage A Ownership Collision Runtime Test

執行日期：2026-09-12。結果：**FAIL**。依 gate 停止，Production PR 2 與 AUTO_FARM 均未開始。

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；測試 AID 2000901、CID 1500901。正式 stack 與正式玩家未操作。

Runtime evidence：

| 測試 | 結果 | 證據 |
| --- | --- | --- |
| OpenKore 真實登入 | PASS | OpenKore 完成 account、char、map-server 連線並記錄 `You are now in the game`；map-server 記錄 AID/CID 2000901/1500901、IP 127.0.0.1 |
| OpenKore owner 狀態 | PASS | OpenKore resident 時 `char.online=1`；state row 維持 owner/state=`OPENKORE`、mode=`PERSISTENT_IDLE`、revision=7 |
| OpenKore resident 時 Agent claim | FAIL | 正式 module 沒有 claim API 或 `OPENKORE → CLAIMING_AGENT` compare-and-set 實作。`persistent_agent_state_load_enabled()` 只讀取已是 `SERVER_AGENT` 的 row，且只在首次 char-ready 載入；因此產品路徑無法提交並拒絕此 claim |
| Agent resident 時 OpenKore direct takeover | NOT RUN | Stage A 已在前一必要 gate 失敗，依停止條件未繼續 |
| 正常雙向 ownership transition | NOT RUN | 缺少正式 claim 入口；release 路徑先前僅有 PR 1 Agent disable runtime 證據，未形成本輪 OpenKore 雙向閉環 |
| duplicate/release/非法 transition matrix | NOT RUN | Stage A 失敗後立即停止 |

Collision 問題：schema 有 AID unique constraint，OpenKore launcher 有 start guard，Agent module 也會檢查既存 map entity/auth node；但 ownership claim 沒有單一 authoritative runtime API、CAS precondition 或結果碼。直接修改 metadata 無法視為安全 claim，也無法提供 accepted/rejected 證據。

清理與資料一致性：停止隔離 OpenKore 後，CID 1500901 回到 `online=0`；map=`prt_fild08`、x=103、y=301、HP=127、SP=28；Agent metadata 仍為 disabled、owner/state=`OPENKORE`、revision=7。隔離 login/char/map ports 均已停止監聽，未出現第二 entity 或 ghost 證據。

本輪正式修改檔案只有 `docs/persistent-server-agent-roadmap.md`。PR 2 source、migration、patch 與 AUTO_FARM 修改數量均為 0。

Rollback：Stage A 沒有 ownership mutation；停止隔離 OpenKore並確認 `char.online=0` 後關閉隔離 rAthena。原生角色資料與 PR 1 metadata 保持原值。

下一個建議 Phase：先補齊並單獨審查 atomic ownership claim/release API，包含 expected revision、`char.online=0`、無 entity/auth node、idempotent duplicate claim/release 與穩定 reason code；重跑完整 Stage A 並取得雙向 runtime PASS 後，才允許開始 Production PR 2。

### 13. Ownership Control Plane

狀態：**Isolated runtime PASS**。本節補齊上一節揭露的 claim contract 缺口；AUTO_FARM 與 Production PR 2 修改數量仍為 0。

#### CAS contract

- `claim_agent` 只允許 `control_owner=OPENKORE`、`ownership_state=OPENKORE`、`agent_enabled=0`、`char.online=0`、AID/CID 一致且 revision 相符。
- claim 使用單一條件式 `UPDATE persistent_agent_state JOIN char` 將 state 改為 `CLAIMING_AGENT` 並令 revision 加一；affected rows 必須為 1。state 與 command `ACCEPTED` 寫入同一 InnoDB transaction。
- claim completion 再以 CID、revision、owner、state、last command id 作 CAS，切換至 `SERVER_AGENT`。完成 ownership 後才要求 fd=0 auth；entity attach 完成後 command 才標記 `CONFIRMED`。
- `release_agent` 只允許 enabled、owner/state=`SERVER_AGENT` 且 revision 相符。CAS 成功後進入 `RELEASING_AGENT` 與 `ACCEPTED`，接著停止 Agent、save、`map_quit()`、確認 `char.online=0`，最後在同一 transaction 將 owner/state 改回 `OPENKORE` 並將 command 標記 `CONFIRMED`。
- CAS affected rows 為 0 時才讀取最新狀態分類原因；狀態更新的正確性不依賴先 SELECT 後無條件 UPDATE。
- 相同 CID 的 pending commands 由 map-server 單執行緒依 requested time 處理；DB revision CAS 仍是最終並發裁定。

#### API contract

| API | 行為 |
| --- | --- |
| `POST /api/ro/agents/{charId}/ownership/commands` | 接受 `commandId`、`action=claim_agent或release_agent`、`expectedRevision`，只建立 durable `QUEUED` command |
| `GET /api/ro/agents/{charId}/ownership/commands/{commandId}` | 回傳 `QUEUED`、`ACCEPTED`、`REJECTED`、`CONFIRMED`、reason code 與 resulting revision |
| `GET /api/ro/agents/{charId}/ownership` | 回傳 owner、ownership state、Agent mode、revision 與最後結果 |

Dashboard 只驗證 session、角色歸屬、typed payload 與 idempotency key。ownership state、revision 與 character table 的最終 mutation 只由 map-server repository 執行。相同 command id 與相同 payload 回傳原結果；相同 command id 搭配不同 payload 回 `idempotency_conflict`。

正式 reason codes：`ownership_conflict`、`stale_revision`、`already_owned`、`invalid_transition`、`active_client`、`active_openkore`、`agent_not_owner`。storage fault 另記錄 `storage_error`。

OpenKore coordination：OpenKore launcher 在 start 前查 owner/state；`SERVER_AGENT`、`CLAIMING_AGENT`、`RELEASING_AGENT`、`QUARANTINED` 均拒絕啟動。claim 在 OpenKore resident、`char.online=1` 時回 `active_openkore` 且不建立 Agent entity。release 只有 `CONFIRMED` 後才允許 OpenKore重新啟動。

#### Runtime collision evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124、Dashboard 8799；AID 2000901、CID 1500901。正式 stack 與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| OpenKore online 時 claim | PASS | OpenKore 記錄 `You are now in the game`，`char.online=1`；command `1111…` 由 QUEUED 轉 REJECTED，reason=`active_openkore`，revision 保持 7、owner 保持 OPENKORE |
| 正常 OpenKore → Agent | PASS | command `2222…`：CLAIMING revision 8，SERVER_AGENT load/auth，fd=0、entity=1，CONFIRMED revision 10 |
| Agent resident 時 OpenKore start | PASS | 正式 launcher guard 回 `OpenKore start rejected: the account is owned or quarantined by Persistent Agent.`；未建立 OpenKore process，Agent owner/entity 不變 |
| 正常 Agent → OpenKore | PASS | command `3333…`：RELEASING revision 11，save/entity release，OPENKORE CONFIRMED revision 12；其後 OpenKore 再次進入 map-server |
| concurrent claim | PASS | command `4444…` 與 `5555…` 使用相同 expected revision 12 同時排隊；只有 `5555…` CONFIRMED，`4444…` REJECTED `stale_revision`；entity=1 |
| stale revision | PASS | release command `6666…` 使用 revision 12，在目前 revision 15 時 REJECTED `stale_revision`，owner/entity 不變 |
| duplicate release | PASS | command `7777…` CONFIRMED revision 17；相同 command id/payload 重送回原 CONFIRMED。新 command `8888…` 在 owner=OPENKORE 時 REJECTED `agent_not_owner` |
| duplicate / ghost | PASS | 所有 Agent ready log 均為 entity=1，release log 均為 entity=0；沒有第二 entity、ghost session、duplicate ownership 或 quarantine |

Build：鎖定 rAthena commit 的 Release x64 solution PASS，`map-server.exe` 與 `map-server-generator.exe` 均成功。正式 patch 對 `.tmp-rathena-full` 的 `git apply --check` PASS。

最終隔離 DB：CID 1500901、owner/state=`OPENKORE`、agent disabled、mode=`PERSISTENT_IDLE`、revision=17、`char.online=0`、map=`prt_fild08`、x=103、y=301、HP=127、SP=28。隔離 Dashboard/login/char/map ports 已停止監聽。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - `src/map/persistent_agent_state.cpp/.hpp`
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/openkore-instance.ps1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用 `ops/ro-stack/sql/001-persistent-agent.sql`，現有 state/command 欄位足以完成本輪，沒有複製角色資料。

#### Known limitations

- RO Client 的 `CLIENT` owner reason path 已實作，實際 RO Client collision 本輪未執行，因此標示【資料不足，無法確認】。
- OpenKore gate 依賴受管的 `openkore-instance.ps1` 啟動路徑。操作者直接繞過 launcher 執行第三方 process 的結果【資料不足，無法確認】。
- `persistent_agent_state` 與 command table 是 InnoDB；鎖定版 `char` table 是 MyISAM。claim 的 `char.online=0` 位於同一條 atomic UPDATE predicate，但跨 engine 不提供完整 transaction atomicity。
- 本輪未執行完整 release gate、正式帳號 rollout、AUTO_FARM 或 Phase 12。

#### Rollback

1. 停止接收新 ownership commands。
2. 對 SERVER_AGENT 角色送出帶正確 revision 的 `release_agent`，等待 `CONFIRMED`、entity=0、`char.online=0`。
3. 設定 `PersistentAgentEnabled=$false`，停止 stack並回復上一個 patch hash/binary。
4. 保留 state/command rows 作稽核；不刪除或覆寫 rAthena 原生角色資料。
5. 只有 owner/state=`OPENKORE` 且 release 已 CONFIRMED 的角色可恢復 OpenKore。

Ownership Control Plane 結論：**GO**。下一個建議 Phase 是 Production PR 2 的最小 AUTO_FARM 搬移；本輪未開始該 Phase。

### 14. Production PR 2: AUTO_FARM

狀態：**Isolated production-like runtime PASS**。正式 rAthena patch 已加入最小 AUTO_FARM；Loot、Skill、Survival、Death/Respawn、跨圖 Navigation、NPC、Service、AUTO_QUEST 與 WEB UI 均未開始。

#### Scope 與 ownership interaction

- `persistent_agent.cpp/.hpp` 持有 target selection、movement、normal attack、death detection、retarget、stop 與 mode transition。`chrif.cpp` 沒有加入 combat AI。
- `start_farm` 只接受 owner/state=`SERVER_AGENT`、enabled、revision 相符、resident fd=0、同 CID entity=1 且 mode=`PERSISTENT_IDLE` 的角色。
- target map 與 mob id 必須同時通過 server-side allowlist。測試值為 `prt_fild08` 與 mob 1002。
- movement、path、attack、damage 與 EXP 全部走 rAthena 原生 `map_foreachinrange`、`unit_walktobl`、`unit_attack`、battle/EXP 流程。沒有直接修改 EXP 或 monster HP，沒有建立第二 player entity。
- `stop` 以 revision CAS 將 mode 改回 `PERSISTENT_IDLE`，停止 attack/walk 並保存原生角色資料。`release_agent` 在 AUTO_FARM 中會先停止 farm 與 save，再進入 `RELEASING_AGENT`。
- shutdown 保存目前 `agent_mode` 與 target intent。boot 重新載入同 CID 後，只有 ownership 仍為 SERVER_AGENT、payload 合法且角色位於核准地圖時才恢復 AUTO_FARM。
- server-owned entity 首次成為該地圖使用者時沿用 rAthena dynamic mob lifecycle 呼叫 `map_spawnmobs()`；未建立專用 monster fixture。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124、Dashboard 8799；AID 2000901、CID 1500901；鎖定 rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。正式 stack 與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build 與 patch | PASS | Release x64 `map-server.vcxproj` 編譯成功；正式 patch 對 `.tmp-rathena-full` 執行 `git apply --check` 成功 |
| OPENKORE → SERVER_AGENT | PASS | claim command CONFIRMED；owner/state=`SERVER_AGENT`、fd=0、entity=1、revision 20 |
| start AUTO_FARM | PASS | `start_farm` CONFIRMED；mode=`AUTO_FARM`、map=`prt_fild08`、mob=1002、revision 21 |
| restart intent | PASS | AUTO_FARM 中正常 shutdown 記錄 `SHUTDOWN_SAVED`；後續 boot 記錄同 CID `AUTO_FARM_RESTORED`，owner 維持 SERVER_AGENT、fd=0、entity=1，最終恢復 revision 27 |
| target/move/attack/retarget | PASS | restart 後連續記錄 target acquisition 與 `AUTO_FARM_KILL`，目標距離變化證明移動與 retarget；全部使用 mob 1002 |
| 10 kills | PASS | 最終 recovery run 完成 12 kills，超過最低 10 kills；每次 kill 均伴隨原生 EXP 變化 |
| Base / Job EXP | PASS | Base Lv16 EXP 6994 → Base Lv17 EXP 934，依鎖版 Lv16 threshold 7624 計算總增量 1564；Job Lv10 EXP 11867 → 12285，增量 418 |
| stop → idle | PASS | stop command CONFIRMED，mode=`PERSISTENT_IDLE`、entity=1、revision 28，並記錄角色 save |
| release → OPENKORE | PASS | release command CONFIRMED，owner/state=`OPENKORE`、enabled=0、entity=0、revision 30；OpenKore 隨後成功連入同 CID map session並看到 Base Lv17，退出後 `char.online=0` |
| duplicate / ghost | PASS | Agent 執行期間所有 ready/kill/stop evidence 均為 entity=1；release 為 entity=0；OpenKore 只在 release CONFIRMED 後登入，沒有 duplicate 或 ghost |
| crash / leak | PASS | map-server 無 crash；AUTO_FARM restart 與最終關機均正常完成，memory manager 記錄 `No memory leaks found` |

最終隔離 DB：CID 1500901、owner/state=`OPENKORE`、agent disabled、mode=`PERSISTENT_IDLE`、revision 30、Base Lv17 EXP 934、Job Lv10 EXP 12285、`char.online=0`。隔離 Dashboard/login/char/map ports 已停止監聽。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp/.hpp`
  - `src/map/persistent_agent_state.cpp/.hpp`
  - PR 1 既有最小 chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用 `ops/ro-stack/sql/001-persistent-agent.sql`；本輪未新增 migration，既有 mode/task/target/command/revision 欄位足以保存 AUTO_FARM intent。

#### Known limitations

- Runtime 只涵蓋一個隔離角色、一張地圖與一種怪物；多角色、跨圖與正式帳號【資料不足，無法確認】。
- kill counter 以已選 target 死亡或從 map 移除作 detection；本輪 12 次事件均由 Base/Job EXP 增加交叉驗證。
- 本輪沒有執行完整 release gate、100+ agent 壓測或任何禁止項目。

#### Rollback

1. 停止接收 `start_farm`，對 AUTO_FARM 角色送出帶正確 revision 的 `stop` 並等待 CONFIRMED。
2. 對 SERVER_AGENT 角色送出 `release_agent`，等待 owner/state=`OPENKORE`、entity=0、`char.online=0`。
3. 設定 `PersistentAgentEnabled=$false`，停止 stack並回復 PR 1 patch hash與 binary。
4. 保留 state/command rows作稽核；rAthena 原生 EXP、HP/SP、inventory、equipment與 quest資料不需 rollback。

Production PR 2 結論：**GO**。下一步只進行 PR 2 設計與 runtime evidence 審查；Loot Phase 本輪未開始。

### 15. Production PR 3: Loot Pickup

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入 Loot Pickup；Skill、Survival、Death/Respawn、跨圖 Navigation、NPC、Service、AUTO_QUEST 與 WEB UI 均未開始。

#### Scope 與 Loot state flow

- `persistent_agent.cpp` 持有 floor item detection、eligibility、單一 loot target、move-to-loot、pickup confirmation、failure cooldown、target invalidation 與回到 combat loop。`chrif.cpp` 沒有加入 Loot 邏輯。
- 流程為 `AUTO_FARM → monster death → LOOT_TARGET → move within 2 cells → native pickup → inventory confirmation → AUTO_FARM`。
- Loot 需要全域 `PERSISTENT_AGENT_LOOT_ENABLED=1`、command payload `lootEnabled=true`、owner/state=`SERVER_AGENT`、mode=`AUTO_FARM`、fd=0、resident entity=1。任一 lifecycle 或 ownership 檢查失敗即停止 attack、walk 與 loot transient state。
- floor item 掃描使用 `map_foreachinrange(..., BL_ITEM)`；只選擇無優先 owner或 `first_get_charid` 等於該 CID 的 item。距離使用 `distance_bl`，移動使用 `unit_walktobl`。
- 拾取使用 rAthena 原生 `pc_takeitem()`。最終成功需同時確認 `map_id2bl(floor_id)==nullptr` 且 inventory item amount增加，未直接寫 inventory 或 DB，未繞過重量、slot、拾取權與地圖規則。
- `pc_takeitem()` 拒絕後保留 floor item並進入 5 秒 cooldown；明確記錄 `INVENTORY_FULL`、`OVERWEIGHT`、`ITEM_LIMIT` 或 `NATIVE_PICKUP_REJECTED`，避免同一 tick重複 pickup。
- restart只保存 `lootEnabled=true` intent，未保存當下 floor item id。恢復後重新掃描合法 item。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124、Dashboard 8799；AID 2000901、CID 1500901；鎖定 rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。正式 stack與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build 與 patch | PASS | 清除 test fixture後 Release x64 solution編譯成功；正式 patch對 `.tmp-rathena-full` 執行 `git apply --check` 成功 |
| 真實掉落與原生 pickup | PASS | Poring mob 1002自然掉落；每件均記錄不同 floor id、item id、`LOOT_PICKED` 與 inventory amount `+1`，floor item隨後不存在 |
| 10 pickups與續戰 | PASS | controlled restart前 8件、restart後 4件，共12件；inventory總量 31 → 43；每次拾取後均重新出現 target/kill，combat loop持續 |
| inventory full | PASS | 隔離 fixture以原生 `pc_additem` 填滿 slot；非堆疊 item 1201保留在地面，記錄 `LOOT_SKIPPED reason=INVENTORY_FULL`，未 grant；fixture以原生刪除流程清理 |
| overweight | PASS | 隔離 fixture建立超過剩餘負重的 floor amount；記錄 `LOOT_SKIPPED reason=OVERWEIGHT`，floor item保留，inventory未增加；fixture已清理 |
| vanished item | PASS | Agent鎖定距離5的 floor item後，隔離 fixture移除該 item；記錄 `LOOT_INVALIDATED`，沒有 crash或重複 pickup，隨後繼續選其他目標 |
| multiple floor items | PASS | 同時建立 floor id 54與53；依序各記錄一次 `LOOT_TARGET`、一次 `LOOT_PICKED`，inventory amount 49 → 50 → 51，沒有重複處理同一 floor id |
| ownership release | PASS | Agent鎖定距離20的 floor item後送出 `release_agent`；依序停止 farm/loot、save、entity release，CONFIRMED revision 63、owner=`OPENKORE`、entity=0；該 run `LOOT_PICKED=0` |
| controlled restart recovery | PASS | AUTO_FARM + Loot執行中正常 shutdown記錄 `SHUTDOWN_SAVED` 與 `No memory leaks found`；boot後同 CID記錄 `AUTO_FARM_RESTORED loot=1 fd=0 entity=1`，並再完成 target、kill與4次 pickup |
| DB save | PASS | 核心12件自然拾取完成並 stop/save後，DB inventory總量為43；Base/Job EXP與角色位置同步保存。最終 release後 CID 1500901為 `OPENKORE/OPENKORE`、disabled、idle、revision 63、`char.online=0` |
| crash / leak | PASS | runtime沒有 map-server crash；controlled shutdown皆完成且 memory manager記錄 `No memory leaks found`；所有 boundary stderr無 Error、assert、corruption訊息 |

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - PR 1與PR 2既有 lifecycle、state、chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用 `ops/ro-stack/sql/001-persistent-agent.sql`；`lootEnabled`保存在既有版本化 `target_rules` JSON，沒有新增角色資料副本或 migration。

#### Known limitations

- Runtime只涵蓋一個隔離角色、一張地圖、Poring自然掉落與單一 ownership；多角色 loot競爭、不可達地形及正式地圖【資料不足，無法確認】。
- inventory full、overweight、vanished與multiple item使用可丟棄 checkout的 runtime fixture。fixture程式碼已清除，未進正式 patch。
- controlled shutdown/restart已 PASS。額外執行的 map-server強制終止試驗使 `char.online=1` 暫留，新 map-server依 ownership安全規則進入 `QUARANTINED/DUPLICATE_OWNERSHIP`；未形成 duplicate entity。crash recovery自動清理【資料不足，無法確認】，此試驗不計為 restart PASS。
- Loot只拾取無優先 owner或 first owner為自身 CID的 floor item；party share、多 owner優先期過後的公共拾取與跨圖 loot【資料不足，無法確認】。
- 正式 stack仍預設關閉 Agent與Loot，本輪未執行完整 release gate、大量 Agent壓測或正式帳號 rollout。

#### Rollback

1. 停止接受帶 `lootEnabled=true` 的 `start_farm`。
2. 對 AUTO_FARM角色送出正確 revision的 `stop`，等待 `PERSISTENT_IDLE` CONFIRMED並完成 save。
3. 對 SERVER_AGENT角色送出 `release_agent`，等待 owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定 `PersistentAgentLootEnabled=$false`；需要完整回退時再設定 `PersistentAgentEnabled=$false`，停止 stack並回復 PR 2 patch與 binary。
5. 保留 state/command rows作稽核；rAthena原生 inventory與角色資料不做反向重寫。

Production PR 3 結論：**GO**。

### 16. Production PR 4: Skill Combat

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入單一 Swordman 的 `SM_BASH` 與 `SM_MAGNUM` 最小 Skill Combat；HP/SP Survival、potion、sit、Death/Respawn、Navigation 擴充、NPC、Service、AUTO_QUEST、WEB UI 與全職業 profile 均未開始。

#### Scope 與 Skill decision flow

- `persistent_agent.cpp` 持有技能 allowlist、payload 驗證、skill decision、range/LOS、cast、cooldown及普攻 fallback。`chrif.cpp` 沒有加入 combat decision。
- 流程為 `AUTO_FARM → legal target → learned/SP/range/cooldown/cast-condition checks → native skill cast → kill/retarget`；任何條件不符即回原生 normal attack，未卡死。
- 僅在 owner/state=`SERVER_AGENT`、mode=`AUTO_FARM`、fd=0、resident entity=1 時執行。`stop` 先停止 walk、attack與skill transient state並回 `PERSISTENT_IDLE`；`release_agent` 再 save、釋放 entity並切回 `OPENKORE`。
- 使用 `pc_checkskill()`、`skill_get_requirement()`、`skill_get_range2()`、`skill_get_splash()`、`battle_check_range()`、`skill_check_condition_castbegin()`、`unit_skilluse_id()` 與 `pc_get_skillcooldown()`。SP、monster HP、damage、EXP均由 rAthena原生流程處理。
- restart保存 `skillEnabled`、`skillId` intent於既有版本化 `target_rules` JSON；不保存正在 cast 的瞬間狀態，boot後重新選 target及判斷。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；AID 2000901、CID 1500901；Swordman，`NV_BASIC` 9、`SM_BASH` 5、`SM_MAGNUM` 1；目標 map `prt_fild08`、mob 1002；鎖定 rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。正式 stack與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build 與 patch | PASS | Release x64 solution完成，`map-server.exe`產出；既有 third-party C4819 warning，無 build error；正式 cumulative patch對 `.tmp-rathena-full` 執行 `git apply --check`成功 |
| Skill cast與kill | PASS | 本次收斂 run共24次有效 cast：Magnum 6、Bash restart前7、restart後11；skill參與擊殺23次：6、7、10；已超過10 casts與5 kills gate |
| 原生 SP / damage / EXP | PASS | Magnum每次原生需求30 SP，首 cast log為162→132；Bash需求8 SP；Poring HP `hp_before=55`後由native battle死亡；Base EXP 837→1272，Job EXP 6305→6421 |
| cooldown | PASS | `SM_MAGNUM`回報 `cooldown_ms=2000`；連續 cast間隔3359、3391、4750 ms，期間明確記錄 `SKILL_COOLDOWN`並使用普攻fallback |
| range / LOS | PASS | Magnum distance 11、range 2及Bash distance 13、range 1時先記錄 `SKILL_RANGE_WAIT`並移動；進入合法距離後才cast，未出現超距離施放 |
| invalid / unlearned / SP不足 | PASS | skill 999不在allowlist時command為REJECTED且mode維持idle；未學Bash記錄 `NOT_LEARNED`並普攻；SP=0記錄 `INSUFFICIENT_SP`並普攻完成擊殺 |
| fallback normal attack | PASS | cooldown期間Magnum由普攻完成3 kills；另有未學技能與SP不足run均完成normal attack kill及retarget，未卡死 |
| stop與ownership release | PASS | final run stop為CONFIRMED revision 102、mode=`PERSISTENT_IDLE`；release為CONFIRMED revision 104、owner/state=`OPENKORE`、entity=0、`char.online=0`；release後無後續cast |
| controlled restart recovery | PASS | AUTO_FARM + Bash執行中shutdown記錄 `SHUTDOWN_SAVED` revision 100及no leaks；boot後同CID記錄 `AUTO_FARM_RESTORED skill=5 skill_lv=5 fd=0 entity=1` revision 101，續作11 casts、10 skill kills |
| crash / leak | PASS | runtime無map-server crash；兩次controlled shutdown均完成，memory manager均記錄 `No memory leaks found`；隔離stderr無內容 |

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - PR 1至PR 3既有 lifecycle、state、chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用 `ops/ro-stack/sql/001-persistent-agent.sql`；`skillEnabled`與`skillId`保存在既有 `target_rules` JSON，沒有新增migration或角色資料副本。

#### Known limitations

- Runtime只涵蓋Swordman、`SM_BASH`、`SM_MAGNUM`、一張地圖與一種怪物；其他職業、weapon/job/state requirement矩陣、ground-target skill、cast interruption及正式地圖【資料不足，無法確認】。
- 本輪未加入buff rotation、build planner、HP/SP recovery。SP不足只fallback普攻，不補充SP。
- 未學技能與SP不足使用隔離測試角色fixture；fixture只修改隔離DB，未進正式patch或migration。
- 正式stack預設關閉Agent、Loot與Skill；本輪未執行完整release gate、大量Agent壓測或正式帳號rollout。

#### Rollback

1. 停止接受帶 `skillEnabled=true` 的 `start_farm`。
2. 對AUTO_FARM角色送出正確revision的 `stop`，等待 `PERSISTENT_IDLE` CONFIRMED並完成save。
3. 對SERVER_AGENT角色送出 `release_agent`，等待owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定 `PersistentAgentSkillEnabled=$false`；需要完整回退時再關閉Loot與Agent，停止stack並回復PR 3 patch及binary。
5. 保留state/command rows作稽核；rAthena原生SP、EXP與角色資料不做反向重寫。

Production PR 4 結論：**GO**。

### 17. Production PR 5: HP/SP Survival

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入可設定的 HP/SP threshold、原生 consumable、自我恢復 skill 與 sit recovery；Death/Respawn、回城、補給購買、Navigation 擴充、NPC、Service、AUTO_QUEST、WEB UI 與大量 Agent 壓測均未開始。

#### Scope 與 Survival state flow

- `persistent_agent.cpp` 持有 survival allowlist、threshold、決策與 transient recovery state。`chrif.cpp` 沒有加入 survival decision。
- 流程為 `AUTO_FARM → HP/SP threshold check → RECOVERING → native item / self skill / sit → safe threshold → AUTO_FARM`。RECOVERING 期間停止選怪、移動與攻擊，完成後重新選 target。
- 生存判斷優先於 combat。HP、SP、item amount與技能條件均讀取真實 `map_session_data`；沒有直接寫 HP/SP、直接 grant item或繞過 cooldown。
- 使用 `pc_useitem()`、`pc_checkskill()`、`skill_check_condition_castbegin()`、`unit_skilluse_id()`、`pc_setsit()`、`pc_setstand()`、`skill_sit()`；item消耗、HP/SP恢復與自然 regen均由 rAthena原生流程處理。
- threshold與 allowlist由 `PersistentAgentHpThresholdPercent`、`PersistentAgentHpSafePercent`、`PersistentAgentSpThresholdPercent`、`PersistentAgentSpSafePercent`、HP/SP item allowlist及recovery skill allowlist設定。正式預設 survival關閉。
- `survivalEnabled`保存在既有版本化 `target_rules` JSON。RECOVERING屬瞬時狀態，DB mode維持 `AUTO_FARM`；restart後依當下HP/SP重新判斷。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；AID 2000901、CID 1500901；Swordman；目標 map `prt_fild08`、mob 1002；鎖定 rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。正式 stack與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build 與 patch | PASS | fixture移除後 Release x64 solution完成，`map-server.exe`產出；只有既有third-party C4819 warning；正式cumulative patch對 `.tmp-rathena-full` 執行 `git apply --check`成功 |
| HP potion | PASS | Red Potion 501經 `pc_useitem()`連續成功6次，HP 181→576；inventory amount 10→4，release/save後DB amount為4 |
| SP recovery | PASS | Blue Potion 505經 `pc_useitem()`成功1次，SP 16→153，inventory amount 5→4；因單次已超過safe threshold，其餘case以無SP consumable的sit fallback驗證 |
| Self recovery skill | PASS | `NV_FIRSTAID` 142經原生condition與cast流程成功1次，HP 263→268、SP 162→159；未達safe threshold後安全轉入sit |
| Sit recovery | PASS | self-skill不足與invalid-item兩個run各完成1次sit recovery；後者HP 181→205、SP 32→77，達標後站起並回AUTO_FARM |
| No potion / invalid item | PASS | 無allowlist item時記錄 `NO_USABLE_ITEM_OR_SKILL`並sit；equipment item 1201交給 `pc_useitem()`後回傳0，記錄 `RECOVERY_ITEM_REJECTED`，item未消耗，未卡死 |
| Survival優先與返回combat | PASS | 各run均先記錄 `RECOVERING_ENTER`，期間無新target；`RECOVERY_COMPLETE mode=AUTO_FARM`後恢復target、normal attack與kill |
| Ownership release | PASS | RECOVERING期間直接送出 `release_agent`，command CONFIRMED revision 142，owner/state=`OPENKORE`、mode=`PERSISTENT_IDLE`、entity=0；release後沒有後續item/skill/recovery action |
| Controlled restart recovery | PASS | RECOVERING中shutdown記錄 `SHUTDOWN_SAVED` revision 130及no leaks；boot後同CID記錄 `AUTO_FARM_RESTORED survival=1 fd=0 entity=1` revision 131，低HP重新進 `RECOVERING`與sit；後續restart依當下HP重新判斷並恢復combat |
| crash / leak | PASS | runtime無map-server crash；所有controlled shutdown均完成，memory manager均記錄 `No memory leaks found` |

Runtime fixture只在可丟棄checkout以原生角色API建立低HP/SP、Red Potion、Blue Potion及First Aid前置條件。fixture程式碼、測試物品與測試技能均已清除，未進正式patch、migration或正式DB。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - PR 1至PR 4既有 lifecycle、state、chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用 `ops/ro-stack/sql/001-persistent-agent.sql`；本輪沒有新增migration，也沒有複製HP/SP、inventory、skill或角色資料。

#### Known limitations

- Runtime只涵蓋一個Swordman、Red Potion 501、Blue Potion 505、First Aid 142、一張地圖與一種怪物；其他職業、恢復技能、消耗品restriction與正式地圖【資料不足，無法確認】。
- SP consumable因單次恢復已越過safe threshold，只完成1次；3次SP consumable recovery【資料不足，無法確認】。無SP consumable時的sit fallback已runtime PASS。
- 本輪沒有實作危險逃離、自動購買補品、storage補給、死亡或回城。
- 正式stack預設關閉Agent、Loot、Skill與Survival；未執行完整release gate、大量Agent壓測或正式帳號rollout。

#### Rollback

1. 停止接受帶 `survivalEnabled=true` 的 `start_farm`。
2. 對AUTO_FARM角色送出正確revision的 `stop`，等待 `PERSISTENT_IDLE` CONFIRMED並完成save。
3. 對SERVER_AGENT角色送出 `release_agent`，等待owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定 `PersistentAgentSurvivalEnabled=$false`；需要完整回退時再關閉Skill、Loot與Agent，停止stack並回復PR 4 patch及binary。
5. 保留state/command rows作稽核；rAthena原生HP/SP、inventory與角色資料不做反向重寫。

Production PR 5 結論：**GO**。

### 18. Production PR 6: Death / Respawn

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入死亡偵測、原生 save point respawn、復活後 recovery 與 AUTO_FARM intent 恢復。Navigation 擴充、跨地圖回程、NPC、Service、AUTO_QUEST、WEB UI 與大量 Agent 壓測均未開始。

#### Scope 與 Death state machine

- `persistent_agent.cpp` 持有 `AUTO_FARM / RECOVERING → DEAD → RESPAWNING → RECOVERING → AUTO_FARM` 的 transient runtime state。DB mode持續保存 `AUTO_FARM` intent，未保存瞬時 target、loot target或cast。
- 首次偵測 `status_isdead()` 時，先以 `unit_stop_attack()`、`unit_stop_walking()`、`unit_skillcastcancel()` 清除攻擊、移動、loot與pending skill，再進入 `DEAD`。
- 到達可設定的 respawn delay後，驗證原生 save point與允許地圖，呼叫 `pc_respawn(sd, CLR_OUTSIGHT)`。fd=0 session完成原生respawn後，以既有server-owned attach規則重新加入map block並驗證 `map_id2sd()`、map與entity唯一性。
- 復活後一律先進 `RECOVERING`，依PR 5真實HP/SP與threshold重新判斷。達安全值後重新選怪，死亡前target不會延續。
- 使用的原生rAthena路徑包含 `status_isdead()`、原生damage至`pc_dead()`、`pc_respawn()`、`pc_setrestartvalue()`及其內部save point定位與status cleanup。正式程式沒有直接改HP、DB座標、怪物HP或EXP。
- `deathRecoveryEnabled`保存在既有版本化 `target_rules` JSON。能力由 `PersistentAgentDeathRecoveryEnabled`控制，正式預設關閉；delay與最大嘗試數由config注入。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；AID 2000901、CID 1500901；固定map `prt_fild08`、mob 1002；鎖定rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。正式stack與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build與patch | PASS | fixture移除後Release x64 solution產出`map-server.exe`；僅既有third-party C4819 warning；cumulative patch對`.tmp-rathena-full`執行`git apply --check`成功 |
| 3次完整death cycle | PASS | 連續3次真實HP 0、`DEAD_ENTER`、`RESPAWNING`、`RESPAWNED`、`RECOVERY_COMPLETE`；每次entity=1，第三次後恢復target並完成至少12 kills |
| 原生respawn與penalty | PASS | `pc_respawn()`依`prt_fild08 (100,300)` save point復活；原生死亡penalty反映於Base/Job EXP，後續擊殺再由原生battle增加EXP |
| action cleanup | PASS | 每次死亡log均證明target非0→0、真實floor item loot target非0→0、pending Bash cast skill 5→0；死亡期間沒有延續attack、loot或skill |
| Survival交互 | PASS | respawn後HP 2/907時進RECOVERING，使用真實Red Potion並扣inventory；達safe threshold後回AUTO_FARM並續戰 |
| release during DEAD | PASS | respawn delay期間執行`release_agent`，command CONFIRMED revision 171，owner/state=`OPENKORE`、mode=`PERSISTENT_IDLE`、entity=0；等待後無respawn或action |
| Invalid respawn | PASS | save point map與farm map不一致時進`QUARANTINED`，reason=`RESPAWN_NAVIGATION_REQUIRED`、failures=1；沒有retry spam或無限loop |
| Restart while DEAD | PASS | `DEAD_ENTER`後controlled shutdown記錄`SHUTDOWN_SAVED`；boot後同CID、fd=0、entity=1、owner=`SERVER_AGENT`，由真實角色狀態恢復AUTO_FARM，沒有重複respawn並完成後續kills |
| Restart while RECOVERING | PASS | respawn後HP 181/907進sit recovery；controlled shutdown後DB保存HP 223；boot後`AUTO_FARM_RESTORED`、再次`RECOVERING_ENTER`，原生regen至241/907後回AUTO_FARM並完成12 kills |
| duplicate / crash / leak | PASS | 所有有效controlled runtime中CID entity持續為1，release後為0；一次測試編排重疊啟動第二個map process時被`DUPLICATE_OWNERSHIP`隔離，沒有建立第二entity；沒有產品runtime crash；controlled shutdown均記錄`No memory leaks found` |

死亡fixture只存在可丟棄checkout，透過mob來源的rAthena原生damage/death pipeline建立可重複條件，並建立真實floor item與pending cast驗證清理。fixture、測試物品注入、直接HP前置設定與測試環境變數均已移除，未進正式patch、migration或正式DB。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - `src/map/persistent_agent.hpp`
  - PR 1至PR 5既有lifecycle、state、chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用`ops/ro-stack/sql/001-persistent-agent.sql`；本輪沒有新增migration，也沒有複製HP/SP、EXP、inventory、equipment、quest或座標資料。

#### Known limitations與failure handling

- 第一版要求save point map等於AUTO_FARM target map。跨地圖返回需要Navigation能力，本輪以`RESPAWN_NAVIGATION_REQUIRED`隔離並停止farm。
- Runtime只涵蓋一個Swordman、一張地圖、一種怪物與一個save point；其他地圖restriction、死亡腳本、instance與正式帳號【資料不足，無法確認】。
- `DEAD`、`RESPAWNING`與`RECOVERING`為瞬時state。restart不重播瞬時action，會依rAthena原生角色HP/death/map重新判斷。
- 正式stack預設關閉Agent、Loot、Skill、Survival與Death Recovery；未執行完整release gate、大量Agent壓測或正式帳號rollout。

#### Rollback

1. 停止接受帶`deathRecoveryEnabled=true`的`start_farm`。
2. 對AUTO_FARM角色送出正確revision的`stop`；DEAD或RESPAWNING中的角色先走安全停止、save與PERSISTENT_IDLE。
3. 對SERVER_AGENT角色送出`release_agent`，等待owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定`PersistentAgentDeathRecoveryEnabled=$false`；需要完整回退時再依序關閉Survival、Skill、Loot與Agent，停止stack並回復PR 5 patch及binary。
5. 保留state/command rows作稽核；rAthena原生角色資料不做反向重寫。

Production PR 6 結論：**GO**，限disabled-by-default的isolated production-like整合審查。

### 19. Production PR 7: Navigation

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入同圖座標導航、原生 portal 單段跨圖、2 至 3 段明確 route、有限重試、失敗停止、目的地確認與 restart intent recovery。NPC Interaction、Shop、Storage、Kafra、AUTO_QUEST、WEB UI 擴充、大量 Agent 壓測及正式玩家 rollout 均未開始。

#### Scope 與 Navigation state flow

- `persistent_agent.cpp/.hpp` 持有 route parser、waypoint、portal 辨識、movement、stuck/retry、abort、restart restore 與 transient navigation state。`chrif.cpp/.hpp` 沒有加入導航決策。
- 流程為 `PERSISTENT_IDLE / AUTO_FARM → NAVIGATING → DESTINATION_REACHED → PERSISTENT_IDLE / 原 AUTO_FARM intent`；失敗流程為 `NAVIGATING → limited retry → ROUTE_FAILED → stop → PERSISTENT_IDLE`。
- `start_navigation` 使用既有 command queue、expected revision 與 state CAS。前置條件為 owner/state=`SERVER_AGENT`、entity=1、fd=0；route 最多 16 steps，map 必須在 allowlist。
- 導航期間停止攻擊、cast、farm target selection 與 loot。ownership release 先取消 route、停止 movement、save 並回 `PERSISTENT_IDLE`，再移除 entity 與確認 `OPENKORE` ownership。
- 同圖 movement 使用 `unit_walktoxy()`，由 rAthena 原生 path search、passability 與 movement timer 執行。portal 以當前 map 的 warp NPC cache、`NPCTYPE_WARP`、trigger radius及目的 map metadata 驗證，角色走入 trigger 後由原生 warp touch 流程跨圖。正式程式沒有直接改座標、DB teleport 或 GM warp。
- 不保存瞬時 path node。DB 只沿用既有 `task_type`、`task_phase`、`target_map` 與 `target_rules` 保存 destination、明確 route、原 intent 及 revision；restart 後從角色真實 map/座標重新選起始 step 並重新 pathfind。
- stuck policy 依 position/map progress 與可設定 timeout 判斷，每 step 最多 `PersistentAgentNavigationMaxRetries` 次，超過即 `ROUTE_FAILED`，禁止無限 loop。正式預設 Navigation 關閉。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；AID 2000901、CID 1500901；地圖 `prt_fild08`、`prt_fild07`；鎖定 rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。正式 stack、正式玩家與 NPC Interaction 均未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build 與 patch | PASS | Release x64 solution 已產出 `map-server.exe`；僅既有 third-party C4819 warning；更新後 cumulative patch 對 `.tmp-rathena-full` 執行 `git apply --check` 成功 |
| 同地圖導航 | PASS | 完成 5/5：`(100,300)→(115,300)→(115,315)→(100,315)→(100,300)`，另完成 `(102,298)→(110,300)`；每次均有 `ROUTE_STEP_REACHED` 與 `DESTINATION_REACHED` |
| 單 portal 跨圖 | PASS | 完成 3/3。兩次 `prt_fild08 (30,239)→warp (18,239)→prt_fild07 (379,239)→(365,239)`；另一次反向 route 由 `prt_fild07` 經 warp 返回 `prt_fild08` |
| 2 至 3 段 route | PASS | 反向 3-step route 完成：`prt_fild07 (365,239)→(375,239)→warp (383,239)→prt_fild08 (20,239)→(30,239)` |
| destination confirmation | PASS | 所有成功 route 均以真實 map/x/y 驗證終點，CAS 完成後記錄 `DESTINATION_REACHED` 並清除 navigation task metadata |
| blocked path / retry | PASS | 超過原生 `max_walk_path` 的 segment 連續記錄 retry 1/3 至 4/3，之後進 `ROUTE_FAILED reason=PATH_RETRY_EXHAUSTED`；無無限重試 |
| invalid destination | PASS | `prt_fild07 (9999,9999)` 安全進 `ROUTE_FAILED reason=INVALID_DESTINATION`；stop 後回 `PERSISTENT_IDLE` |
| resume prior intent | PASS | 從 `AUTO_FARM` 啟動 navigation，到達後記錄 `AUTO_FARM_RESTORED`，DB mode 回 `AUTO_FARM` 並完成後續至少 4 kills |
| ownership release during route | PASS | route 移動中送出 `release_agent`，command CONFIRMED；owner/state=`OPENKORE`、mode=`PERSISTENT_IDLE`、entity=0，release 後無 navigation action |
| restart recovery | PASS | NAVIGATING 中 controlled shutdown 記錄 `SHUTDOWN_SAVED` revision 254；有效重啟後同 CID、fd=0、entity=1，記錄 `NAVIGATION_RESTORED` revision 257，重新走完 4 steps 至 `prt_fild08 (120,233)`，`DESTINATION_REACHED` revision 258 |
| duplicate / ghost | PASS | runtime log 全程 entity=1；release CONFIRMED 後 entity=0。未建立第二個 CID entity，未見 ghost session |
| crash / leak | PASS | 有效 runtime 無 map-server crash；controlled shutdown 完成並記錄 `No memory leaks found` |

restart 測試第一次啟動曾以 CID 誤填 account allowlist，module 正確進 `QUARANTINED` 且未建立 entity；該次排除於 PASS 證據。修正隔離測試 metadata 與 AID 設定後，以上有效 restart 流程完整通過。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - `src/map/persistent_agent.hpp`
  - `src/map/persistent_agent_state.cpp`
  - `src/map/persistent_agent_state.hpp`
  - PR 1 至 PR 6 既有 lifecycle、state、chrif/map/build hooks 維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration 沿用 `ops/ro-stack/sql/001-persistent-agent.sql`；本輪沒有新增 migration，也沒有複製座標、HP/SP、EXP、inventory、equipment 或 quest 資料。

#### Known limitations

- 第一版由 caller 提供 1 至 16 個明確 waypoint。通用 world graph、自動 route planner、成本、傳送道具、船班、instance、動態 portal 與 OpenKore route engine 均未整合。
- 單一 segment 受 rAthena 原生 `max_walk_path` 限制；caller 必須提供較短 waypoint。長 segment 會依有限重試政策進 `ROUTE_FAILED`。
- restart 會依目前 map 選擇第一個符合 step；包含重複 map loop 的複雜 route、正式地圖 restriction 與大範圍路線【資料不足，無法確認】。
- 受到攻擊時只允許既有 survival 判斷，不擴大 combat。Navigation 與死亡後跨圖返回的整體產品策略尚未做正式 regression。
- 正式 stack 預設 `PersistentAgentNavigationEnabled=$false` 且 map allowlist 為空；未執行完整 release gate、大量 Agent 壓測或正式帳號 rollout。

#### Rollback

1. 停止接受 `start_navigation` command。
2. 對 NAVIGATING 或 ROUTE_FAILED 角色送出正確 revision 的 `stop`，等待 `PERSISTENT_IDLE` CONFIRMED 並完成 save。
3. 對 SERVER_AGENT 角色送出 `release_agent`，等待 owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定 `PersistentAgentNavigationEnabled=$false` 並清空 map allowlist；需要完整回退時停止 stack，回復 PR 6 patch 及 binary。
5. 保留 state/command rows作稽核；rAthena 原生角色資料不做反向重寫。

Production PR 7 結論：**GO**，限 disabled-by-default 的 isolated production-like 整合審查。

### 20. Production PR 8: NPC Interaction

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入指定 NPC 導航、合法距離互動、原生對話、next、menu select、close/cancel、有限逾時重試、失敗停止與 restart intent recovery。Shop、Storage、Kafra、Transportation、AUTO_QUEST、WEB UI 擴充、大量 Agent 壓測及正式玩家 rollout 均未開始。

#### Scope 與 NPC interaction state machine

- `persistent_agent.cpp/.hpp` 持有 NPC allowlist、typed payload parser、接近、對話 phase、timeout/retry、abort 與 restart restore。`chrif.cpp/.hpp` 沒有加入 NPC 決策。
- 流程為 `PERSISTENT_IDLE → NPC_APPROACHING → NPC_DIALOG_OPEN → NPC_WAIT_NEXT / NPC_WAIT_MENU / NPC_WAIT_INPUT → NPC_COMPLETE → PERSISTENT_IDLE`；失敗進 `NPC_FAILED`，由明確 `stop` 回 idle。
- typed command 限於 `talk_to_npc`、`dialog_next`、`dialog_select`、`dialog_close`。`talk_to_npc` 只接受 allowlist 中的 NPC 與 map；`dialog_select` 會驗證 native script state、目前 menu option 數量及 1-based index。
- approach 使用 `npc_name2id()`、NPC map/block 狀態、距離檢查與 `unit_walktoxy()`；合法距離內以 `npc_click()` 開始原生 script。next/select 使用 `npc_scriptcont()`，close/cancel 使用 `pc_close_npc()`。script VM 與 NPC script 保持唯一 authority。
- Agent 沒有直接寫角色變數、grant item、改 quest state或模擬 script 結果。Runtime 結果由隔離 NPC script 自行更新 account registry 驗證。
- 每個 phase 具有獨立 timeout；超時會關閉當前 context並重新合法 approach/click，超過 `PersistentAgentNpcMaxRetries` 進 `NPC_FAILED`，禁止無限等待。
- ownership release 會先關閉 dialog、停止 movement、清除 transient NPC state、save並回 `PERSISTENT_IDLE`，再釋放 entity。NPC Interaction 僅允許 owner/state=`SERVER_AGENT`。
- DB 不保存 script VM frame。只沿用既有 `task_type`、`task_phase`、`target_map`、`target_rules` 保存 target NPC與高階 goal；restart 後重新 lookup、approach並從頭開始合法對話。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；AID 2000901、CID 1500901；地圖 `prt_fild08`；鎖定 rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。測試 NPC 只存在可丟棄 checkout，正式 stack與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build 與 patch | PASS | Release x64 solution完成並產出 `map-server.exe`；只有既有 third-party C4819 warning；cumulative patch對 `.tmp-rathena-full` 執行 `git apply --check`成功 |
| 完整 NPC 對話 | PASS | 連續完成5/5次 `talk → next → menu select → next → close`；每次均由 `NPC_REACHED`、`NPC_DIALOG_OPEN`、native script phase與 `NPC_COMPLETE`確認，entity=1 |
| NPC script authority | PASS | 隔離 script 的真實 account registry由1增加至6；Agent source沒有寫入該 registry或直接修改結果 |
| menu select | PASS | 至少5次合法index 1選擇成功；另在2個選項時提交index 3，command以 `invalid_transition` REJECTED，revision與dialog保持可恢復 |
| close / cancel | PASS | 對話等待next時執行2次 `dialog_close`，均完成native close、回 `PERSISTENT_IDLE`且沒有stuck context |
| NPC missing / unreachable | PASS | allowlist內不存在名稱進 `NPC_FAILED reason=NPC_NOT_FOUND`；不可達NPC有限重試後進 `NPC_FAILED reason=NPC_UNREACHABLE` |
| dialog timeout | PASS | `NPC_WAIT_NEXT`無回應時完成2次有限retry，第三次進 `NPC_FAILED reason=NPC_DIALOG_TIMEOUT`；沒有無限loop |
| NPC disappears | PASS | 對話next後隔離script停用自身，Agent偵測原block消失並進 `NPC_FAILED reason=NPC_DISAPPEARED`，沒有存取失效target |
| ownership release | PASS | dialog進行中執行 `release_agent`，先記錄 `NPC_ABORTED`，其後owner/state=`OPENKORE`、mode=`PERSISTENT_IDLE`、entity=0，release後無對話action |
| restart recovery | PASS | `NPC_WAIT_NEXT`中controlled shutdown保存高階intent；重啟後同CID、fd=0、entity=1並記錄 `NPC_INTERACTION_RESTORED`，重新lookup/click後回到新的 `NPC_WAIT_NEXT`；未延續舊VM frame |
| duplicate / ghost | PASS | 有效runtime全程同CID entity=1；release後entity=0，未見duplicate或ghost session |
| crash / leak | PASS | 有效runtime無map-server crash；controlled shutdown均完成並記錄 `No memory leaks found` |

restart編排曾兩次使用錯誤測試參數：一次等待超過短timeout而進預期的`NPC_DIALOG_TIMEOUT`，一次將CID誤填account allowlist而進`QUARANTINED`且未建立entity。兩次均排除於restart PASS證據；修正AID與延長隔離timeout後，以上有效restart流程完整通過。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - `src/map/persistent_agent.hpp`
  - `src/map/persistent_agent_state.cpp`
  - `src/map/persistent_agent_state.hpp`
  - PR 1 至 PR 7 既有 lifecycle、state、chrif/map/build hooks 維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用`ops/ro-stack/sql/001-persistent-agent.sql`；本輪沒有新增migration，也沒有複製NPC script frame、角色變數、quest、inventory或角色資料。隔離fixture `persistent_agent_pr8_test.txt` 與 `scripts_custom.conf` 變更未進正式patch。

#### Known limitations

- Runtime只涵蓋一張地圖、三個隔離script NPC與單一角色。正式NPC script、動態instance NPC、event NPC及正式地圖restriction【資料不足，無法確認】。
- `NPC_WAIT_INPUT`可辨識native input state；本輪fixture未要求typed文字或數值輸入，因此實際input提交【資料不足，無法確認】。
- 第一版要求角色與NPC位於同一map。跨圖須先由PR 7完成Navigation，再提交`talk_to_npc`。
- Shop、buy/sell、Storage、Kafra、Transportation與AUTO_QUEST沒有搬入本PR。
- 正式stack預設`PersistentAgentNpcEnabled=$false`，NPC map/NPC allowlist為空；未執行完整release gate、大量Agent壓測或正式帳號rollout。

#### Rollback

1. 停止提交新的NPC typed command。
2. 對`NPC_INTERACTION`或`NPC_FAILED`角色送出正確revision的`stop`，等待native dialog關閉與`PERSISTENT_IDLE` CONFIRMED。
3. 對`SERVER_AGENT`角色送出`release_agent`，等待owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定`PersistentAgentNpcEnabled=$false`並清空NPC/map allowlist；需要完整回退時停止stack，回復PR 7 patch及binary。
5. 保留state/command rows作稽核；不反向改寫rAthena角色或script資料。

Production PR 8 結論：**GO**，限 disabled-by-default 的 isolated production-like 整合審查。

### 21. Production PR 9: Service Interaction

狀態：**Isolated production-like runtime PASS**。正式 patch 已加入 allowlist 限制的商店買賣、倉庫存取、儲存點與 NPC 傳送；AUTO_QUEST、正式 NPC 服務矩陣、大量 Agent 壓測及正式玩家 rollout 均未開始。

#### Scope 與 Service state flow

- `persistent_agent.cpp/.hpp` 持有 typed service parser、NPC approach、原生交易執行、結果確認、timeout/retry、ownership abort 與 restart restore。`chrif.cpp/.hpp` 沒有加入服務決策。
- 流程為 `PERSISTENT_IDLE → SERVICE_INTERACTION(approach) → executing → COMPLETE → PERSISTENT_IDLE`；拒絕流程進 `SERVICE_FAILED`，由明確 `stop` 回 idle。
- typed command 限於 `service_shop_buy`、`service_shop_sell`、`service_storage_deposit`、`service_storage_withdraw`、`service_save_point`、`service_transport`。NPC、map、item及destination均須通過 server-side allowlist。
- 商店使用 `npc_buysellsel()`、`npc_buylist()`、`npc_selllist()`；倉庫透過原生 NPC script 開啟後使用 `storage_storageadd()`、`storage_storageget()`、`storage_storageclose()`；儲存點與傳送由 `npc_click()` 執行原生 script，完成後以角色真實 save point或map/x/y確認。
- Agent沒有直接寫Zeny、inventory、storage、save point、角色座標或DB grant item。重量、格數、資金、商品、倉庫及地圖限制由rAthena原生流程裁定。
- 非堆疊物品的quantity大於1會在typed request入口拒絕，避免原生商店僅完成單件後產生部分完成狀態。
- 每個service command使用既有expected revision與state CAS。進入executing後才執行原生作用；成功時state與command於同一transaction確認，失敗時同一transaction進`SERVICE_FAILED`並寫明reason。
- ownership release會停止移動、關閉storage/dialog、將未完成service command標為`REJECTED / OWNERSHIP_RELEASE`，save並移除entity。一般`stop`以`SERVICE_CANCELLED`終止未完成命令。
- restart不保存瞬時NPC或storage context。`approach` intent會重新lookup並重跑合法流程；`executing`不重播，會以`SERVICE_RESTART_AMBIGUOUS`停止，防止重複扣款或重複移轉。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；AID 2000901、CID 1500901；地圖`prt_fild08`、`prt_fild07`；鎖定rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。服務NPC只存在可丟棄checkout，正式stack與正式玩家未操作。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build與patch | PASS | Release x64 solution完成並產出`map-server.exe`；只有既有third-party C4819 warning；cumulative patch對`.tmp-rathena-full`執行`git apply --check`成功 |
| Shop buy / sell | PASS | 原生商店完成buy 5/5、sell 5/5；每次Zeny與真實inventory同步變化，另完成stackable item quantity 10交易 |
| Storage deposit / withdraw | PASS | 原生storage完成deposit 5/5、withdraw 5/5；inventory與storage數量逐次互抵，完成後storage為0 |
| Save point | PASS | 兩個隔離NPC分別將save point寫為`prt_fild08 (110,300)`與`(120,300)`；另一次服務寫入`(110,300)`後建立真實死亡，`pc_respawn()`實際在該座標復活，entity=1 |
| Transportation | PASS | 完成至少3次付費NPC傳送，涵蓋`prt_fild08 → prt_fild07 (365,239)`與反向`prt_fild07 → prt_fild08 (100,300)`兩個destination；Zeny由原生script扣除 |
| Inventory full | PASS | 100-slot隔離fixture下buy新item回`BUY_ITEM_OR_CAPACITY_REJECTED`；item與Zeny沒有異常增加。相同條件withdraw回`STORAGE_WITHDRAW_REJECTED`，storage item仍存在 |
| Storage full | PASS | 600-slot隔離fixture下deposit回`STORAGE_DEPOSIT_REJECTED`；inventory item未減少、storage維持600 slots |
| Overweight | PASS | 真實weight超限時原生buy回`OVERWEIGHT`；Zeny與item數量未變 |
| Invalid input / service / restriction | PASS | 非allowlist item、quantity 0及非堆疊quantity 2均在執行前REJECTED；不存在NPC回`SERVICE_NPC_NOT_FOUND`；移動中NPC消失回`SERVICE_NPC_DISAPPEARED`；NOWARPTO服務未跨圖並回`TRANSPORT_DESTINATION_REJECTED`；無限等待由`SERVICE_TIMEOUT`終止 |
| Insufficient Zeny | PASS | Zeny為0時付費transport NPC未移動角色，command以`TRANSPORT_DESTINATION_REJECTED`結束；第一版無法從任意NPC script取得更細的資金reason |
| Duplicate / idempotency | PASS | 同一command UUID重複提交只保留1 row、只執行1次save-point transaction，command CONFIRMED，revision精確增加3 |
| Ownership release | PASS | service為ACCEPTED且正在approach時執行`release_agent`；service command轉`REJECTED / OWNERSHIP_RELEASE` revision 537，release CONFIRMED revision 538，owner回OPENKORE、entity=0、`char.online=0` |
| Restart recovery | PASS | approach中controlled shutdown保存`SERVICE_INTERACTION / approach`與ACCEPTED command；重啟後同CID、fd=0、entity=1，記錄`SERVICE_INTERACTION_RESTORED`並完成同一save-point command，回`PERSISTENT_IDLE` |
| Duplicate / ghost / crash / leak | PASS | 有效runtime全程CID entity不超過1；release後entity=0，未見ghost；所有controlled shutdown均記錄`No memory leaks found` |

測試中曾發現非堆疊item quantity 6由原生商店只處理1件，confirmation因此拒絕。正式實作已在typed parser加入非堆疊quantity限制，重新編譯後runtime證明quantity 2在執行前拒絕且Zeny/inventory不變。該次前置失敗不列入Shop PASS計數，隔離測試item已清理。

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - `src/map/persistent_agent.hpp`
  - `src/map/persistent_agent_state.cpp`
  - `src/map/persistent_agent_state.hpp`
  - PR 1至PR 8既有lifecycle、state、chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用`ops/ro-stack/sql/001-persistent-agent.sql`；本輪沒有新增migration，也沒有複製Zeny、inventory、storage、save point、座標或角色資料。隔離fixture `persistent_agent_pr9_test.txt` 與`scripts_custom.conf`變更未進正式patch。

#### Known limitations

- Runtime只涵蓋一個角色、兩張地圖、單一普通shop、單一account storage與隔離script NPC。正式商店、guild/cart storage、Kafra腳本、transport成本矩陣、instance與動態服務【資料不足，無法確認】。
- 付費transport的資金與條件由NPC script裁定；通用Agent只能以destination是否達成確認，無法將任意script分支映射為精細reason。
- executing瞬間的restart replay保護已實作為`SERVICE_RESTART_AMBIGUOUS`，本輪只runtime驗證approach階段restart；executing階段runtime證據【資料不足，無法確認】。
- 第一版不包含自動補貨、售賣策略、storage item planner、Kafra選單泛化或AUTO_QUEST orchestration。
- 正式stack預設`PersistentAgentServiceEnabled=$false`，service map/NPC/item/destination allowlist均為空；未執行完整release gate、大量Agent壓測或正式帳號rollout。

#### Rollback

1. 停止提交新的service typed command。
2. 對`SERVICE_INTERACTION`或`SERVICE_FAILED`角色送出正確revision的`stop`，等待native storage/dialog關閉與`PERSISTENT_IDLE` CONFIRMED。
3. 對`SERVER_AGENT`角色送出`release_agent`，等待owner/state=`OPENKORE`、entity=0、`char.online=0`。
4. 設定`PersistentAgentServiceEnabled=$false`並清空service allowlist；需要完整回退時停止stack，回復PR 8 patch及binary。
5. 保留state/command rows作稽核；rAthena原生角色、inventory、storage與save point資料不做反向改寫。

Production PR 9 結論：**GO**，限 disabled-by-default 的 isolated production-like 整合審查。

### 22. Production PR 10: AUTO_QUEST

狀態：**AUTO_QUEST executor isolated production-like runtime PASS**。本輪 runtime 使用隔離 fixture quest 90000，因此不得解讀為正式 quest PASS；核准正式任務的可用性【資料不足，無法確認】。正式 stack 預設停用，沒有操作正式玩家，也沒有開始 WEB Controller。

#### Scope 與 task executor

- `persistent_agent.cpp/.hpp` 持有 `PERSISTENT_IDLE → AUTO_QUEST → PERSISTENT_IDLE`、高階 task intent、phase 驗證、timeout/retry、ownership abort 與 restart reconciliation。`chrif.cpp/.hpp` 沒有加入 quest 決策。
- durable phase 為 `GO_NPC`、`TALK_NPC`、`ACCEPT_QUEST`、`GO_MAP`、`KILL_MONSTER`、`COLLECT_ITEM`、`RETURN_NPC`、`COMPLETE_QUEST`、`CONFIRM_REWARD`；失敗進 `QUEST_FAILED`，`cancel_task` 保留原生 quest state並回 idle。
- typed `start_quest` payload包含 task/quest ID、必要前置quest、NPC/map、目標map/座標、mob/count、collect item/count與reward item/count。task、quest、NPC、map、mob、reward均須通過server-side allowlist。
- 原生authority使用 `quest_search()`、`quest_check()`、`npc_name2id()`、`npc_click()`、`npc_scriptcont()`、`npc_event_dequeue()`、`unit_walktoxy()`、既有combat/loot的`unit_attack()`與`pc_takeitem()`、`chrif_save()`。Agent沒有直接寫quest table、EXP、Zeny、inventory或monster HP。
- accept、kill progress與complete後先走原生char-server save，再以repository唯讀checkpoint確認quest row已保存，成功後才推進durable phase。這避免fd=0 session的非同步save ACK無法直接作為phase證據。
- start、phase、complete、fail、cancel沿用expected revision與CAS。重複command UUID由既有unique command row與payload hash確保只執行一次；stale revision在執行前拒絕。
- restart不保存path node、target、loot target、cast或script VM frame。重啟後以真實quest state與durable task intent重新計算安全phase。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124；固定地圖`prt_fild08`；鎖定rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`。Runtime quest 90000、NPC `PersistentAgentQuest`、target Poring 1002與reward Red Potion 501均為可丟棄fixture，未進正式patch。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| Build與patch | PASS | Release x64 map-server完成，0 error；只有既有C4819 warning。cumulative patch對`.tmp-rathena-full`執行`git apply --check`成功 |
| 完整quest flow | PASS，fixture限定 | CID 1500904、1500905、1500906各自完成一次quest 90000；shutdown後DB均為quest state 2且reward item各1，合計3次完整合法流程 |
| Native quest state | PASS | 完成角色的quest row由state 1進state 2，count1=3；Agent只讀checkpoint，沒有直接UPDATE quest table |
| Kill / collect | PASS | 每次由原生combat完成3隻Poring，原生quest count到3/3；floor item由既有loot流程拾取，NPC script原生扣除3個Jellopy |
| Reward | PASS，fixture限定 | CID 1500914原生script完成Red Potion 0→1、Base EXP 994→1520、Job EXP 266→430、Zeny 1000→1100；quest state=2 |
| Already completed / duplicate | PASS | 已完成CID再次`start_quest`回`QUEST_ALREADY_COMPLETED`；同UUID重送command table維持1 row，reward仍1，無重複發獎 |
| Validation failures | PASS | 不存在quest/profile回`QUEST_NOT_AVAILABLE_OR_PROFILE_INVALID`；前置未完成回`QUEST_PREREQUISITE_INCOMPLETE`；count與quest definition不符回`QUEST_OBJECTIVE_MISMATCH`；stale revision回`stale_revision` |
| NPC / route / target failure | PASS | NPC缺失回`QUEST_NPC_MISSING`；不可達座標有限retry後回`QUEST_ROUTE_FAILED`；無指定怪物達timeout後回`TARGET_MONSTER_UNRESOLVED_OR_TIMEOUT` |
| Reward inventory full | PASS | 100-slot fixture在`CONFIRM_REWARD`回`REWARD_INVENTORY_FULL`；quest維持active、inventory維持100 slots、reward沒有增加 |
| Ownership release | PASS | AUTO_QUEST進行中第一次release使用舊revision被拒絕；以current revision重試後記錄`AUTO_QUEST_ABORTED / OWNERSHIP_RELEASE`，save、entity 1→0、owner/state回OPENKORE，`char.online=0` |
| Restart NAVIGATING | PASS | `GO_NPC`中controlled shutdown；重啟後同CID、fd=0、entity=1，重新驗證後由`GO_NPC`繼續並完成 |
| Restart KILL_MONSTER | PASS | persisted `KILL_MONSTER`中shutdown；重啟依native active quest重新計算`GO_MAP`，隨即恢復KILL_MONSTER並完成。瞬時combat target未重播 |
| Restart RETURN_NPC | PASS | CID 1500912在`RETURN_NPC`、progress 3/3中shutdown；重啟記錄同phase、native state 1、progress 3/3、entity=1，之後完成並回idle |
| Duplicate / ghost / crash / leak | PASS | 有效runtime全程每CID entity不超過1；controlled shutdown完成所有save及map cleanup，記錄`No memory leaks found` |

#### 修改檔案

- `ops/ro-stack/patches/persistent-agent.patch`
  - `src/map/persistent_agent.cpp`
  - `src/map/persistent_agent.hpp`
  - `src/map/persistent_agent_state.cpp`
  - `src/map/persistent_agent_state.hpp`
  - PR 1至PR 9既有lifecycle、ownership、combat、loot、skill、survival、death、navigation、NPC、service及chrif/map/build hooks維持原邊界
- `ops/ro-stack/dashboard.mjs`
- `ops/ro-stack/ro-stack.ps1`
- `ops/ro-stack/stack.config.psd1`
- `docs/persistent-server-agent-roadmap.md`

Schema migration沿用`ops/ro-stack/sql/001-persistent-agent.sql`；本輪沒有新增migration。quest、EXP、Zeny、inventory、equipment與角色資料繼續由rAthena原生schema保存。隔離fixture `db/import/quest_db.yml`、`persistent_agent_pr10_test.txt`與`scripts_custom.conf`變更未進正式patch。

#### Known limitations

- runtime只覆蓋一個短線性fixture quest、單一NPC、單一地圖、單一mob與collect item。正式quest、分支對話、多NPC、多地圖、party、instance、daily/repeatable task【資料不足，無法確認】。
- `COLLECT_ITEM`只驗證與擊殺目標同一循環產生的原生floor item；獨立採集點、跨圖收集與多種item條件【資料不足，無法確認】。
- reward確認第一版需要allowlisted item及固定數量；純變數、隨機獎勵、多選獎勵與mail/storage delivery【資料不足，無法確認】。
- 正式stack預設`PersistentAgentQuestEnabled=$false`，quest/task/reward allowlist為空；沒有執行正式quest regression、完整release gate、大量Agent壓測或正式帳號rollout。

#### Rollback

1. 停止提交新的`start_quest`與`cancel_task` command。
2. 對`AUTO_QUEST`或`QUEST_FAILED`角色提交正確revision的`cancel_task`，等待action清理、save及`PERSISTENT_IDLE` CONFIRMED；原生quest state保留。
3. 對`SERVER_AGENT`角色提交`release_agent`，等待owner/state=`OPENKORE`、entity=0及`char.online=0`。
4. 設定`PersistentAgentQuestEnabled=$false`並清空quest/task/reward allowlist；需要完整回退時停止stack，回復PR 9 patch與binary。
5. 保留state/command rows作稽核；不反向改寫rAthena quest、角色或inventory資料。

Production PR 10 結論：**GO**，限disabled-by-default的AUTO_QUEST executor整合審查。正式quest rollout維持**NO-GO**，等待核准正式代表任務runtime gate。

### 23. Production PR 11: 第一條正式 rAthena Quest Gate

狀態：**SOURCE GATE PASS；RUNTIME NOT RUN；正式 Quest Runtime FAIL**。鎖定版 Renewal 的伊甸園新手裝備 Course A 來源與規則可確認，但 PR 10 executor 無法在不擴充 task contract 的條件下合法表達該流程。本輪依限制在 runtime 前停止，沒有以 fixture 或部分 quest ID 代替正式 PASS。

#### 鎖定來源與啟用版本

- rAthena commit：`e985006171d2eb320ee512a653f4c83aea3d81b6`。
- Renewal gate：`src/config/core.hpp`載入`src/config/renewal.hpp`；`npc/re/scripts_main.conf`載入`npc/re/scripts_athena.conf`。
- 實際啟用：`npc/re/scripts_athena.conf:201-215`載入Eden Renewal scripts，其中`eden_quests.txt`已啟用；`eden_iro.txt:217`維持註解，未混用另一版本。
- Quest DB：`db/re/quest_db.yml:3583-3601`定義7128至7132。
- Script authority：`npc/re/quests/eden/eden_quests.txt`。原始任務規則未修改。

#### 正式任務契約

| 欄位 | 鎖定來源證據 |
| --- | --- |
| 任務 | Eden Group新手裝備訓練Course A，`Conquer the Desert` |
| 加入前置 | `F_HasEdenGroupMark()`要求item 6219或22508；本版Secretary Lime Evenor發22508 Eden Group Mark |
| Base Level | 12至19。Boya在BaseLevel低於12拒絕；20以上改走Course B |
| Job Level | 這條branch沒有`JobLevel`條件 |
| 起點NPC | `Instructor Boya#para01`，`moc_para01,25,35` |
| Quest IDs | 7128 start；7129 Condor；7130 Baby Desert Wolf；7131 Scorpion；7132 complete |
| Objective | Talking Dog依序要求Condor 10、Baby Desert Wolf 10、Scorpion 5；沒有item objective |
| 目標地圖 | `moc_fild11`；Renewal spawn為Condor 1009、Baby Desert Wolf 1107、Scorpion 1001 |
| 回報 | 每段回`Talking Dog#para03`；最後7131變更為7132後回`Instructor Boya#para01`完成 |
| Quest完成 | Boya在`para_suv01=5`執行`completequest 7132`並將`para_suv01`設為11 |
| 裝備領取 | `Administrator Michael`，`moc_para01,112,96`；選擇供應品與確認空間後由原生script發放 |
| Reward | 5583 Eden Team Hat I、2560 Eden Team Manteau I、2456 Eden Team Boots I、15009 Eden Team Uniform I，各1件；此branch沒有EXP或Zeny reward |
| 一次性 | Michael只在`para_suv01=11`發獎，完成後設`para_suv01=12`及`para_suv02=1`；Hat與Manteau script明示只發一次 |

#### Runtime停止原因

PR 10 executor目前的typed payload與runtime只保存一組`quest_id`、`npc_name`、`mob_id`、`target_count`及一組reward item。啟動時要求該quest DB第一個objective精確符合單一mob/count；完成時要求相同quest ID進入`Q_COMPLETE`，並回到同一NPC確認單一reward。

Course A具有以下不可省略的原生狀態：

1. 五個quest ID透過四次`changequest`轉換，舊ID會被移除。
2. Boya、Talking Dog、Administrator Michael三個NPC各自掌握不同authority。
3. Boya、Talking Dog與Michael均需要特定menu選項，不能用無條件dialog advance取代。
4. 最終quest complete與四件裝備發放分屬兩個NPC及兩個`para_suv01`狀態。

因此，將7129、7130或7131任一段單獨提交，均無法證明完整正式裝備任務完成；使用目前executor直接執行會在`changequest`後無法滿足同一quest ID checkpoint。為避免改寫任務規則、直接grant裝備或產生假PASS，本輪沒有建立測試角色、沒有啟動server、沒有寫DB，也沒有執行restart或ownership runtime。

#### 驗證矩陣

| Case | 狀態 |
| --- | --- |
| 正式source、Renewal版本、啟用script | PASS，靜態來源證據 |
| quest not available / prerequisite incomplete | NOT RUN |
| 正常接取、quest state、mob progress、回報、complete | NOT RUN |
| 原生四件Eden equipment reward | NOT RUN |
| already-completed與reward防重複 | NOT RUN |
| NAVIGATING / KILL_MONSTER / RETURN_NPC restart | NOT RUN |
| ownership release | NOT RUN |
| duplicate / ghost / crash / leak | NOT RUN |

#### 修改與 rollback

- Source、patch、schema、設定與runtime資料修改為0。
- 本節只更新`docs/persistent-server-agent-roadmap.md`，記錄正式來源gate與executor contract gap。
- 沒有server或DB狀態需要rollback；PR 10 disabled-by-default基線維持不變。

Production PR 11 結論：**NO-GO**。需先經獨立設計審查核准multi-quest-ID、multi-NPC、typed menu sequence與multi-reward confirmation contract，才能重新進行這條正式任務的runtime；本輪不實作該擴充。

### 24. Production PR 11A: Typed Multi-Step Quest Sequence Executor

狀態：**ISOLATED RUNTIME PASS；EDEN RUNTIME NOT RUN**。PR 11A只擴充通用typed sequence executor與正式disabled-by-default控制面，未執行或修改伊甸園script、quest DB與正式角色資料。

#### Contract與持久化

- 正式command為`start_quest_sequence`，payload只接受`taskId`、`sequenceId`與1至128個typed `steps`。支援`GO_NPC`、`TALK_NPC`、`DIALOG_NEXT`、`DIALOG_MENU_SELECT`、`ACCEPT_QUEST`、`WAIT_QUEST_STATE`、`GO_MAP`、`KILL_MONSTER`、`COLLECT_ITEM`、`RETURN_NPC`、`COMPLETE_QUEST`、`CONFIRM_REWARD`。
- Dashboard與map-server均拒絕未知step；raw script command runtime回`QUEST_SEQUENCE_INVALID`。quest、task、sequence、NPC、map、mob與reward item均由server-side allowlist裁定。
- menu step保存expected dialog state並驗證目前menu option數量；index超界進入`QUEST_SEQUENCE_INVALID_MENU`。menu後必須接原生quest/reward checkpoint。
- DB只保存既有`task_id`、`task_phase=STEP_n`、`target_map`、typed `target_rules`、revision與command狀態。path node、monster target、NPC script VM frame、cast與floor item不持久化。
- reward確認使用載入角色的authoritative inventory snapshot。Base/Job EXP以baseline level、該級EXP及rAthena job EXP table計算跨升級累積delta；Zeny使用角色狀態delta。沒有直接grant或角色資料複本。
- restart重新讀原生quest/inventory state；原生狀態領先保存cursor時fast-forward，未保存或延續NPC VM frame。

#### Runtime fixture與結果

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124，固定`prt_fild08`，CID 1500903、1500904、1500905。fixture只存在`.tmp-persistent-agent-pr1`，包含quest 91000至91004、NPC `PA11A_Alpha`、`PA11A_Beta`、`PA11A_Gamma`、三段Poring 1002 objective、四次typed menu select，以及由NPC script原生發放501、502、503、504各1件、Base EXP 400、Job EXP 200、Zeny 400。

| Case | Runtime結果 |
| --- | --- |
| 3角色正常閉環 | PASS；task 71104、71105、71109各完成37 steps，五個quest均COMPLETE，四件reward均進真實inventory |
| 3 NPC / menu sequence | PASS；每次閉環依序使用3個NPC及4次menu select，menu option runtime驗證為2 |
| Restart mid-sequence | PASS；task 71109於`STEP_020`完整shutdown，`char.online=0`；將高階cursor模擬落後至`STEP_018`後restart，原生quest 91002 ACTIVE使executor以`fast_forward=yes`恢復`STEP_019`並完成 |
| Already completed | PASS；command `58c7ac30-aee2-11f1-9996-7c5079dfe165`回`QUEST_SEQUENCE_ALREADY_COMPLETED`，未重複發獎 |
| Stale revision | PASS；expected 217對current 218回`stale_revision`，state未變 |
| Duplicate command | PASS；相同UUID第二次寫入由command PK拒絕，唯一row只CONFIRMED一次 |
| Invalid menu / NPC missing | PASS；分別進`QUEST_SEQUENCE_INVALID_MENU`與`QUEST_SEQUENCE_NPC_MISSING`，有限停止後可回idle |
| Quest state mismatch | PASS；原生state與expected ACTIVE不符時進`QUEST_SEQUENCE_STATE_MISMATCH` |
| Missing one reward | PASS；NPC原生發501至504，期望清單將第四件設為不存在的505時進`QUEST_SEQUENCE_REWARD_MISSING`，未補發505 |
| Ownership release | PASS；執行中release先abort sequence、save、清除intent/entity，再CONFIRMED為OPENKORE；reclaim回PERSISTENT_IDLE且未自動續跑 |
| Crash / duplicate / leak | PASS；entity觀測維持1，release後0；無crash，完整shutdown輸出`No memory leaks found` |

首次restart使用PowerShell輸出pipeline，wrapper在map-server完成cleanup前中斷，造成`online=1`並觸發`DUPLICATE_OWNERSHIP`。該次證據已判定無效且未列PASS；後續使用直接控制map-server，取得`Terminating`、`SHUTDOWN_SAVED`、`Finished`、`online=0`及成功restore的完整證據。

#### 修改檔案與限制

- 正式：`ops/ro-stack/patches/persistent-agent.patch`、`ops/ro-stack/dashboard.mjs`、`ops/ro-stack/ro-stack.ps1`、`ops/ro-stack/stack.config.psd1`、本Roadmap。
- 隔離fixture/evidence：`.tmp-persistent-agent-pr1/npc/custom/persistent_agent_pr11a_test.txt`、`npc/scripts_custom.conf`、`db/import/quest_db.yml`、`runtime-evidence/pr11a/`。fixture不進正式patch。
- 正式預設仍為`PersistentAgentQuestEnabled=$false`，新增`PersistentAgentQuestSequenceAllowlist=@()`；未執行正式quest、正式帳號rollout或Phase 12。
- 已驗證sequence內的`GO_MAP`只涵蓋同地圖座標。跨圖sequence尚未把PR 7 route plan綁入step contract，因此目前仍不具備重跑Eden Course A gate所需的完整跨圖能力。

#### Rollback

1. 停止提交`start_quest_sequence`。
2. 對`AUTO_QUEST`或`QUEST_FAILED`角色提交正確revision的`cancel_task`，等待save與`PERSISTENT_IDLE` CONFIRMED。
3. 提交`release_agent`並等待OPENKORE、entity=0與`char.online=0`。
4. 將`PersistentAgentQuestEnabled=$false`並清空quest/task/sequence/reward allowlist；完整回退時恢復PR 10 patch與binary。
5. 保留state/command rows稽核，不修改rAthena原生quest、inventory或角色資料。

Production PR 11A結論：typed multi-step executor **PASS**。Eden Course A runtime仍為**NO-GO**，需先補齊typed跨圖route binding並另行執行正式gate；本輪未執行伊甸園。

### 25. Production PR 11B: Quest Sequence 與 Navigation Binding

狀態：**ISOLATED RUNTIME PASS；EDEN RUNTIME NOT RUN**。原GO_MAP shutdown crash已定位並修復；GO_MAP restart 5/5、RETURN_NPC restart與ownership release during route均取得runtime證據。

#### Binding contract與state coordination

- `GO_NPC`、`GO_MAP`、`RETURN_NPC` typed step新增`destinationType`、map/x/y或NPC identity、既有PR 7 `route`、`retryPolicy`及`expectedArrivalCondition`。Dashboard只正規化typed payload；map-server負責allowlist與實際map/NPC/route驗證。
- Quest executor只提交destination intent。路徑、portal、multi-hop、stuck、retry、timeout與arrival仍由既有PR 7 Navigation runtime執行，未建立第二套route engine。
- 持久化phase使用`NAV_nnn`，保存sequence ID、task ID、current step與destination intent；不保存path node。到達後以真實map/座標或NPC interaction range再次驗證，再推進sequence。
- 每次導航配置token，callback須同時符合token、task ID、sequence ID、step、`NAV_nnn`、SERVER_AGENT ownership與active state。context不符時丟棄結果，避免舊route推進新step。
- GO_NPC與RETURN_NPC在每次啟動或restore時重新解析NPC map/position，接受caller提供且位於interaction range內的可通行approach cell；無合法approach cell時拒絕。

#### Runtime fixture與已取得證據

隔離環境使用MariaDB 3307、login 6902、char 6124、map 5124及CID 1500903、1500904、1500905。fixture只存在`.tmp-persistent-agent-pr1`，含3 maps、3 NPC、quest 92000至92002、7個跨圖navigation steps及一條3-step RETURN_NPC route；未執行或修改伊甸園。

| Case | Runtime結果 |
| --- | --- |
| Release x64 build | PASS |
| 三角色完整sequence | PASS；CID 1500905 task 71206、CID 1500903 task 71207、CID 1500904 task 71209各完成21 steps，quest 92000至92002均COMPLETE，NPC原生發放item 501 |
| GO_NPC / GO_MAP / RETURN_NPC | PASS於上述三次完整閉環；均有`QUEST_NAVIGATION_ACCEPTED`與`DESTINATION_REACHED`，entity=1 |
| 3-map / 3-NPC / 3-step route | PASS；`prt_fild08`、`prontera`、`prt_fild05`與`PA11B_A/B/C`，step 17 RETURN_NPC完成3-step route |
| GO_NPC restart | PASS；task 71200於`NAV_000`完整關閉，restart後同CID/entity=1重算route並完成21 steps |
| GO_MAP restart | PASS 5/5；CID 1500904 task 71202於active `NAV_003`連續受控重啟，每次同CID/entity=1重算route；最終完成11-step route並抵達`prontera (160,150)` |
| RETURN_NPC restart | PASS；CID 1500903 task 71306於active `NAV_005`關閉，restart重算11-step RETURN route並抵達`prontera (167,150)` |
| Route failure / retry | PARTIAL PASS；已觀測`PATH_RETRY_EXHAUSTED`、`UNEXPECTED_MAP`、`QUEST_STEP_TIMEOUT`安全進`QUEST_FAILED`；其餘指定failure matrix未完成 |
| Stale callback protection | PASS於shutdown cancellation path；active walk timer `158/158/25/110/156`均取消為`-1`，navigation token先失效再save；shutdown後舊runtime未推進quest step，restart以persisted phase建立新token |
| Ownership release during GO_MAP | PASS；CID 1500905 task 71307在`NAV_003`接受release，停止AUTO_QUEST與route，entity=0、`char.online=0`、ownership CONFIRMED為OPENKORE，未出現晚到destination推進 |
| Crash / leak | PASS；5次GO_MAP restart、RETURN_NPC restart前後及ownership release shutdown皆無crash，均顯示`Memory manager: No memory leaks found.` |

Crash root cause為shutdown ordering。`handle_shutdown()`先以`clif_GM_kick()`讓fd=0 entity同步進入`map_quit()`並釋放`map_session_data`，`finalize()`稍後才呼叫Agent save，造成`PersistentAgentRuntime::sd`懸空；`chrif.cpp:1659`只是後續解參考時的崩潰位置。修正將Agent shutdown barrier前移到`handle_shutdown()`開頭，先失效navigation token、停止native walking/cast/attack、在有效session上save，再清除runtime resident pointer；`finalize()`hook保留為idempotent fallback。

#### 修改、限制與rollback

- 正式：`ops/ro-stack/patches/persistent-agent.patch`、`ops/ro-stack/dashboard.mjs`、本Roadmap。
- 隔離：`.tmp-persistent-agent-pr1/src/map/persistent_agent.cpp`、`npc/custom/persistent_agent_pr11b_test.txt`、`npc/scripts_custom.conf`、`db/import/quest_db.yml`、`runtime-evidence/pr11b/RESULTS.md`。fixture不進正式patch。
- 本輪修改：正式累積patch中的`src/map/map.cpp`與`src/map/persistent_agent.cpp`；隔離runtime evidence位於`.tmp-persistent-agent-pr1/runtime-evidence/pr11b-restart-fix/`及`runtime-evidence/pr11b/RESULTS.md`。未修改Eden、quest sequence model或Navigation演算法。
- Rollback：保持`PersistentAgentQuestEnabled=$false`，停止提交`start_quest_sequence`；以正確revision停止task並釋放ownership；回退`handle_shutdown()`的Agent barrier與`persistent_agent_prepare_shutdown()`生命週期修正，恢復前一版patch。保留command/state rows供稽核。

Production PR 11B結論：**PASS**。GO_MAP restart crash gate已清除，具備另案重新執行Eden Course A runtime的技術前置條件；本輪未啟動Eden runtime。

### 26. Production PR 11C: Eden Course A Official Runtime

狀態：**OFFICIAL CHARACTER JOURNEY PASS；SINGLE UNINTERRUPTED SEQUENCE NOT RUN；RESTART GATE FAIL；Production PR 11C FAIL**。隔離CID 1500943以fd=0、SERVER_AGENT ownership及單一entity完成Renewal正式Course A、原生quest progress、原生NPC completion與四件裝備領取；指定的五個Eden restart checkpoint沒有通過，因此正式quest rollout維持NO-GO。

#### Active source與typed sequence

- 鎖定rAthena commit：`e985006171d2eb320ee512a653f4c83aea3d81b6`。
- `npc/re/scripts_athena.conf:213`啟用`npc/re/quests/eden/eden_quests.txt`；`eden_iro.txt:217`維持註解。
- `db/re/quest_db.yml:3583-3601`定義7128、7129 Condor 10、7130 Baby Desert Wolf 10、7131 Scorpion 5、7132 complete。
- `eden_quests.txt:643,686,722,769,143`依序執行7128至7132轉換與complete；`eden_quests.txt:1803-1808`設定一次性變數並發放5583、2560、2456、15009。
- 正式sequence data位於`ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json`。executor core沒有硬編碼Eden quest ID，也沒有修改原始Eden script或quest DB。

| 階段 | Typed flow與runtime結果 |
| --- | --- |
| Boya接取 | `GO_NPC → TALK_NPC → NEXT/MENU`；兩次menu index 1後原生建立7128 |
| 前往沙漠 | 經`#eden_out`、Morocc Kafra menu 3與1，進入`moc_fild11` |
| Talking Dog | 初次menu index 2，原生7128→7129；各輪回報後7129→7130→7131→7132 |
| Objectives | Condor 1009為10/10；Baby Desert Wolf 1107為10/10；Scorpion 1001為5/5。全程由Agent target、movement、normal combat、kill attribution及rAthena quest authority更新 |
| Boya完成 | 使用原生Eden Mark 22508回程，Boya將7132設為COMPLETE及`para_suv01=11` |
| Michael領獎 | `#warp_2_pass` menu 1後走原生portal；Michael menu 1與2，四次NEXT後原生發獎，sequence回`PERSISTENT_IDLE` |

#### Runtime、reward與測試加速證據

- 測試層級為隔離integration vertical slice。MariaDB 3307、login 6902、char 6124、map 5124；正式stack與正式角色未變更。
- 測試角色CID 1500943、AID 2000943。Course A開始前的Eden membership與Mark 22508屬隔離fixture，只提供合法前置資格，不列為Course A成功證據。
- Condor與Baby Desert Wolf均由Agent完成10次原生擊殺。Scorpion在加速前已取得真實target selection、movement、combat、kill attribution及native quest progress證據。
- `TEST ACCELERATION`：等待自然刷新不再增加驗證價值後，隔離fixture在角色附近生成4隻同ID Scorpion；Agent自行選怪、移動、攻擊與擊殺，rAthena將既有3/5原生進度推到5/5。fixture沒有改quest count、state、completion、inventory或reward；production validity仍受本節restart gate限制。
- 領獎前inventory中5583、2560、2456、15009均為0。Michael原生script完成後四項各為1，`para_suv01=12`、`para_suv02=1`、quest 7132仍為COMPLETE。此branch的Base EXP、Job EXP與Zeny reward均為0。
- 同一Michael Course A sequence重送於revision 210回`QUEST_SEQUENCE_ALREADY_COMPLETED`；四項inventory仍各1。相同command UUID再次寫入由DB primary key拒絕，row count維持1。

#### Executor修正與正式檔案

- `ops/ro-stack/patches/persistent-agent.patch`：GO_NPC approach加入native path可達性驗證；route最後一步為portal時延後NPC approach可達性判斷；menu checkpoint允許原生menu後的有限`DIALOG_NEXT`；completed protection以sequence所有`CONFIRM_REWARD`項目已存在於native inventory裁定。隔離Scorpion spawn fixture已從正式累積patch與PoC source移除。
- `ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json`：保存active Renewal來源對應的Boya、Dog、Kafra、warp與Michael typed flow及實測可達route。
- `ops/ro-stack/dashboard.mjs`：sequence NPC名稱驗證接受rAthena正式NPC顯示名稱中的空格；caller仍只能提交typed command。
- `docs/persistent-server-agent-roadmap.md`：本節runtime、restart、failure與rollback證據。
- Schema migration沒有變更。quest、variables、inventory、EXP與Zeny仍由rAthena原生資料保存。

#### Restart evidence

| Checkpoint | 結果 |
| --- | --- |
| GO_MAP前往moc_fild11 | FAIL；重啟時`char.online=1`，restore被`DUPLICATE_OWNERSHIP` quarantine；entity沒有重複建立，route無法恢復 |
| KILL_MONSTER | FAIL；Condor 2/10後受控停止，重啟同樣因`char.online=1` quarantine；原生progress沒有被改寫，Agent無法接回 |
| RETURN_NPC | NOT RUN |
| reward前 | NOT RUN |
| reward完成後 | NOT RUN |

PR 11B的fixture GO_MAP restart 5/5仍有效；本節只裁定Eden Course A實際checkpoint。此次結果證明現有startup ownership gate與char online清理在Eden長流程下仍不一致。沒有重複entity或ghost被建立，quarantine安全阻止載入；restart recovery本身未完成，不標示PASS。

#### Ownership、failure與WEB contract

| Case | PR 11C證據 |
| --- | --- |
| OpenKore owner啟動AUTO_QUEST | PASS；command `0f30bdd9-168a-47c7-9ffa-c33ef270908b`回`invalid_transition` |
| release during AUTO_QUEST | PASS；runtime記錄`AUTO_QUEST_ABORTED / OWNERSHIP_RELEASE`，save後entity=0、owner回OPENKORE |
| route failure | PASS；有限retry後`PATH_RETRY_EXHAUSTED`進`QUEST_FAILED`，沒有無限重送或crash |
| invalid menu | PASS；超界menu進`QUEST_SEQUENCE_INVALID_MENU` |
| stale revision | PASS；runtime回`stale_revision`且state未變 |
| duplicate command | PASS；相同UUID由DB primary key拒絕，sequence row維持1 |
| completed replay | PASS；`QUEST_SEQUENCE_ALREADY_COMPLETED`且reward不重複 |
| NPC missing | 【資料不足，無法確認】 |
| target unresolved | 【資料不足，無法確認】 |

現有`GET /api/ro/agents/{charId}/ownership`可取得task type、task phase、target map與raw target rules。它沒有直接提供Eden Course A名稱、authoritative current quest ID、mob progress、current action、completed與reward摘要，因此WEB任務日誌資料契約為**不足**；本輪沒有重構WEB UI或status contract。

#### Build、shutdown、known limitations與rollback

- 移除test acceleration source後，Release x64 solution build成功。正式patch對`.tmp-rathena-full`執行`git apply --check`成功。
- 正常quest runtime全程CID entity=1；release後entity=0、`char.online=0`、owner/state=`OPENKORE`、revision 212。controlled map-server shutdown完成1265 maps cleanup並輸出`Memory manager: No memory leaks found.`。
- 正式Eden runtime只覆蓋Course A與單一隔離角色。該角色全程由Server Agent推進，但調試期間在已保存的原生quest checkpoint重新提交typed sequence；最終93-step JSON修正後未另建新角色做單次不中斷重跑。NPC missing、target unresolved與五階段restart仍未完整通過；正式帳號與正式玩家rollout維持禁止。
- Rollback：保持`PersistentAgentQuestEnabled=$false`；停止提交`eden_course_a_v1`；對active task執行正確revision的cancel與release；回退本輪正式patch、sequence JSON與Dashboard NPC名稱驗證；保留command、state與rAthena原生quest/inventory rows供稽核，不反向改寫角色資料。

Production PR 11C結論：**NO-GO**。已證明Server Agent可在正常、不重啟的隔離runtime中完成第一套正式Eden裝備，但尚未證明完整restart recovery；因此「新手可由Server Agent可靠取得第一套正式Eden裝備」仍未成立。

### 27. Production PR 11D: Restart Ownership Recovery

狀態：**ISOLATED PRODUCTION RUNTIME PASS**。PR 11C 已完成的 Eden Course A 正常角色旅程，配合本輪五個 restart checkpoint，足以將 Eden Course A 裁定為隔離 Production Runtime PASS。正式玩家 rollout 仍維持禁止，單一新角色不中斷跑完整 93 steps 仍為 NOT RUN。

#### Root cause 與 lifecycle contract

PR 11C 的 shutdown 只保存角色與 task intent，未保存 map-server runtime instance、shutdown generation 或 clean marker。下一個 map-server 看到 `char.online=1` 時只能套用 duplicate guard，因此合法 restart 與仍存活的 owner 都會進 `DUPLICATE_OWNERSHIP` quarantine。

PR 11D 為每個 map-server 建立 UUID `runtime_instance_id`，ownership row 新增 `runtime_state` 與 `clean_shutdown_at`。受控關閉順序固定為：停止 Agent action，失效 route token 與 timer，保存原生角色與高階 task intent，將同 instance 由 `ACTIVE` CAS 為 `SHUTDOWN_PENDING`，移除 entity 並 flush char FIFO，最後由同 instance CAS 為 `CLEAN_SHUTDOWN`。`chrif.cpp` 沒有新增 ownership 主邏輯。

Startup 只允許以下兩種 atomic acquire：`char.online=0`，或 owner/state 仍為 SERVER_AGENT、revision 相符、`runtime_state=CLEAN_SHUTDOWN`、marker 存在且 `char.last_login<=clean_shutdown_at`。成功後以新 instance CAS 為 `ACTIVE`；`ACTIVE`、`SHUTDOWN_PENDING`、不同 revision、OpenKore/Client active、既存 map entity 或 auth node均維持 reject/quarantine。程式沒有無條件清除 `char.online`，也沒有停用 duplicate protection。

#### Runtime restart evidence

測試只使用 MariaDB 3307、login 6902、char 6124、map 5124 的隔離環境。為直接覆蓋 char-server stale flag 分支，每次在已取得 `CLEAN_SHUTDOWN` marker 後以 test-only fixture 只將該隔離角色的 `char.online` 設為 1，保留 `last_login`；fixture 未改 quest、count、inventory、reward、ownership、revision、位置或 task metadata。

| Checkpoint | Runtime 結果 |
| --- | --- |
| GO_MAP | PASS；CID 1500930 clean shutdown 後被新 instance reclaim，`fd=0`、entity=1，重新計算 route 並抵達 `moc_fild11 (284,211)` |
| KILL_MONSTER | PASS；CID 1500932 的原生 quest 7129 count 由 2 增至 4 後 restart，reclaim 後繼續完成 7129 並推進至 quest 7130 count 5；未直接改 progress |
| RETURN_NPC | PASS；CID 1500933 保留 quest 7129 count 10，restart 後重新抵達 `Talking Dog#para03`，原生 script 推進至 quest 7130 |
| Reward 前 | PASS；CID 1500940 的 quest 7132 維持 ACTIVE，5583、2560、2456、15009 在 restart 前後均為 0，沒有提前發獎 |
| Reward 後 | PASS；CID 1500943 的 quest 7132 維持 COMPLETE，四項裝備在 restart 前後均各 1，沒有重複發獎 |

以上 checkpoint 均從 rAthena 原生 quest/inventory 狀態重新判斷，不持久化 route node、dialog frame、target 或 cast。受控 shutdown 均完成 map cleanup、`Finished` 與 `No memory leaks found`；沒有 late route callback 推進新 step、ghost entity 或 crash。

#### Duplicate 與 OpenKore collision regression

| Case | Runtime 結果 |
| --- | --- |
| 舊 map-server 活著時啟動第二 map-server | PASS；5124 與 5125 同時存在時，第二 instance 對 CID 1500943 回 `DUPLICATE_OWNERSHIP` 並進 QUARANTINED，沒有第二次 load/auth/entity |
| OpenKore active 時 claim Agent | PASS；CID 1500901 已由 OpenKore 進入 map、`char.online=1`，claim command `72cb6c63-966f-4e66-b862-dc72ee2a9d46` 回 `active_openkore`，owner與 revision 594 不變 |
| SERVER_AGENT active 時 OpenKore 登入 | PASS；Agent claim command `0b87aed8-87dc-4637-a931-e78ae31e7850` CONFIRMED revision 598、`fd=0`、entity=1；OpenKore收到 server duplicate rejection，owner與 runtime instance 不變 |
| release | PASS；command `c0fd3613-b3a5-4cf0-9b6b-2901f8c12be4` CONFIRMED revision 600，owner回 OPENKORE、entity=0、`char.online=0` |
| 實際 RO Client collision | 【資料不足，無法確認】；PR 11D 沒有修改既有 CLIENT owner rejection path，本輪未啟動真實 RO Client |

所有 runtime 觀測中同 CID entity 均不超過 1，AID unique constraint與 revision CAS 保持啟用。第二 map-server 嘗試會將共享 row fail-closed quarantine；此行為安全阻止 duplicate，但需要 operator rollback 或重新執行受驗證 claim 才能恢復該角色，列為已知限制。

#### 修改、migration 與 rollback

- 正式累積 patch：`ops/ro-stack/patches/persistent-agent.patch`，本輪實質 source 變更位於 `src/map/map.cpp`、`persistent_agent.cpp/.hpp`、`persistent_agent_state.cpp/.hpp`。
- Schema：`ops/ro-stack/sql/001-persistent-agent.sql` 升為 state version 2；新增 `003-persistent-agent-restart-ownership.sql`，只加入 runtime instance、runtime state 與 clean timestamp，不複製角色資料。
- Bootstrap：`ops/ro-stack/ro-stack.ps1` 依序套用 001 與 003。
- Runtime evidence：`.tmp-persistent-agent-pr1/runtime-evidence/pr11d/RESULTS.md` 與同目錄 logs。

Rollback：先停止新 command，將可控 Agent 停至 idle、save、release並確認 owner OPENKORE、entity=0、`char.online=0`；保持 Agent feature flag off，回退累積 patch、003 migration bootstrap 與 state version 2 binary。新增欄位可保留供稽核，舊 binary不讀取；不可在仍為 SERVER_AGENT 或 QUARANTINED 時啟動 OpenKore。

Production PR 11D 結論：**PASS**。Eden Course A 轉為 **ISOLATED PRODUCTION RUNTIME PASS**；正式玩家啟用、實際 RO Client collision與大量壓測仍未通過，因此 broader rollout 維持 NO-GO。

### 28. Production PR 12: WEB Quest Journal Contract

狀態：**PASS，限隔離 contract runtime**。現有任務日誌已直接顯示 rAthena 與 Persistent Agent 的權威狀態，沒有新增第二套 Quest UI、Quest DB 或 browser-side quest state。Eden Course A 仍沿用 PR 11D 的隔離原生 quest/reward 證據；正式玩家 rollout 維持 NO-GO。

#### Typed contract 與權威來源

`ops/ro-stack/persistent-agent/quest-journal-contract.mjs` 輸出：`taskId`、`taskType`、`sequenceId`、`sequenceName`、`currentQuestId`、`currentQuestState`、`phase`、`phaseLabel`、`currentAction`、`currentActionLabel`、`targetNpc`、`targetMap`、`mobObjectives[]`、`collectObjectives[]`、`navigation`、`npc`、`rewardSummary[]`、`taskStatus`、`failure`、`ownership`、`executor`、`updatedAt`、`revision`。`taskStatus`只允許`AVAILABLE / ACTIVE / READY_TO_REPORT / COMPLETED / FAILED / PAUSED`；`executor`明確區分`SERVER_AGENT / OPENKORE`。

來源順序固定為：原生`quest` rows決定quest state與mob count，Persistent Agent ownership/task row決定sequence、phase、navigation/NPC/action與revision，原生`inventory` count確認reward，現有twRO item table提供玩家可讀名稱。Browser只渲染`/api/state.questJournal`，沒有以`localStorage`或畫面狀態推導完成。

#### Eden Course A mapping

| 權威狀態 | API / 現有任務日誌顯示 |
| --- | --- |
| 尚未開始 | `AVAILABLE`、`尚未開始` |
| GO_NPC | `ACTIVE`、`正在前往 Instructor Boya#para01` |
| GO_MAP | `ACTIVE`、`正在前往 moc_fild11` |
| quest 7129 | `Condor 4 / 10` |
| quest 7130 | `Baby Desert Wolf 7 / 10`，前一目標顯示10/10 |
| quest 7131 | `Scorpion 3 / 5`，前兩目標顯示10/10 |
| RETURN_NPC | `READY_TO_REPORT`、`任務條件完成，正在返回 NPC` |
| quest 7132完成、reward前 | `READY_TO_REPORT`、`正在與 Administrator Michael 對話` |
| quest 7132完成、四件reward確認 | `COMPLETED`、`任務完成`；5583、2560、2456、15009各1，名稱取自twRO表 |
| completed replay | 維持`COMPLETED`，雙擊不建立command，不重複執行 |

#### Runtime、refresh、login 與 restart evidence

- `scripts/test-persistent-agent-quest-journal-runtime.mjs`在獨立`test_pr12_quest_journal` schema與隔離AID/CID執行真Dashboard及headless browser；十個checkpoint的API contract與既有`#edenMilestones`文字一致，browser exception為0。此處標記 **TEST CONTRACT FIXTURE**：fixture只建立顯示checkpoint，沒有作為quest progress或reward原生發放證據；原生結果仍引用`.tmp-persistent-agent-pr1/runtime-evidence/pr11c/official-course-a-result.txt`與`pr11d/RESULTS.md`。
- Browser refresh後重新進入既有角色選擇流程，revision 50、quest 7129與`Condor 4 / 10`重新由server state顯示。WEB logout時`/api/state`回401；重新登入後owner、mode、phase、revision完全不變，Agent state沒有由browser保存或推進。
- map-server restart採組合runtime證據：PR 11D已對GO_MAP、KILL_MONSTER、RETURN_NPC、reward前後完成健康restart；PR 12另以隔離CID 1500930啟動新map-server instance，記錄`LOAD_REQUESTED`、`AUTH_COMPLETE`、`fd=0`、entity=1、`QUEST_SEQUENCE_RESTORED` revision 57，之後Dashboard `/api/state`自動讀到新revision 58及其typed failure。這證明restart後contract會讀新server state；本輪未將舊CID 1500933的`AUTO_QUEST_RESTORE_INVALID`測試算入PASS，該隔離row已清回OPENKORE/INACTIVE。
- typed雙擊：SERVER_AGENT/PERSISTENT_IDLE建立`start_quest_sequence QUEUED` revision 60；OPENKORE建立`claim_agent QUEUED` revision 61；completed狀態不建立command。Dashboard typed validator補齊現有executor已支援的`USE_ITEM`，並保留KILL step的`leashX/leashY/leashRange`，沒有新增raw command。

#### Failure、修改、限制與 rollback

公開failure mapping覆蓋`prerequisite_incomplete`、`already_completed`、`route_failed`、`path_retry_exhausted`、`npc_missing`、`npc_failed`、`target_unresolved`、`inventory_full`、`overweight`、`ownership_conflict`、`stale_revision`、`reward_missing`、`unexpected_map`、`timeout`、`quarantined`；未識別內部錯誤只顯示`task_failed`通用繁中訊息，不輸出stack trace。

修改檔案：`ops/ro-stack/persistent-agent/quest-journal-contract.mjs`、`ops/ro-stack/dashboard.mjs`、`ops/ro-stack/dashboard/app.js`、`scripts/test-persistent-agent-quest-journal.mjs`、`scripts/test-persistent-agent-quest-journal-runtime.mjs`、`package.json`及本文件。`index.html`、Eden script、Agent executor與schema均未修改。

驗證：contract test PASS、隔離Dashboard/browser runtime PASS、既有`test:eden-equipment` PASS、JS syntax PASS。完整UI/release suite、大量壓測、Course B/Lv26/Lv40與正式玩家均未執行。一次舊checkpoint restore因其sequence/allowlist已不符合目前測試設定而fail-closed quarantine；無duplicate或ghost，受控停止輸出`Memory manager: No memory leaks found.`。

Rollback：先停止新的quest mutation，保留Agent與OpenKore ownership仲裁；回退上述contract module、Dashboard API組裝、既有任務日誌渲染與兩個PR 12 test script，移除package scripts。不要改寫`quest`、`inventory`或`persistent_agent_state`歷史資料；Agent executor、PR 11D restart與原生Eden流程可獨立保留。

Production PR 12 結論：**GO，限正式整合程式與隔離驗證；正式玩家 rollout NO-GO**。

### 29. Production PR 13: Eden Course A Limited Rollout Gate

狀態：**PASS；LIMITED ROLLOUT GO**。正式 server-side rollout gate、allowlist、emergency disable、繁中 failure UX、最低限度 telemetry、三個完整 WEB E2E、三個 completed replay 與受控 restart recovery 均已在隔離 allowlisted 帳號取得 runtime 證據。核准範圍只限 Course A 小量 allowlist，global 與 Course flag 仍維持預設 OFF，禁止全量開放。

#### Rollout flag 與 allowlist

| Gate | 實作與 runtime 結果 |
| --- | --- |
| global feature enabled | `persistent_agent_rollout_policy.global_enabled`；預設0。實際 browser request 在關閉時回繁中拒絕，command新增數0，PASS |
| account/CID allowlist | `persistent_agent_rollout_allowlist`同時支援AID/CID及course key；移除測試CID allowlist後實際browser request被server拒絕，command新增數0，PASS |
| Eden Course A enabled | `eden_course_a_enabled`獨立控制。初測發現OPENKORE狀態會先排claim，已將Course A gate提前至任何claim/start command前；重測command新增數0，PASS |
| emergency disable | `emergency_disabled`優先於其他flag；實際browser request被拒絕，既有Agent由map-server輪詢後安全停止、save、回PERSISTENT_IDLE並release，PASS |
| server-side authority | Dashboard與map-server均查驗policy/allowlist；WEB隱藏按鈕不作為授權。caller不能直接寫ownership或quest結果 |

Migration `ops/ro-stack/sql/004-persistent-agent-rollout.sql`建立singleton policy、AID/CID allowlist與rollout event；連續套用兩次成功。最終安全收尾為`global_enabled=0`、`eden_course_a_enabled=0`、`emergency_disabled=1`、revision 28。最終 E2E allowlist 僅有 AID/CID 2000970/1500970、2000971/1500971、2000972/1500972。

#### WEB E2E 與 interruption evidence

| Case | Runtime 結果 |
| --- | --- |
| 三個測試帳號登入、日誌雙擊、claim、Agent接管 | 三個browser流程均可由現有任務日誌建立typed command並進入SERVER_AGENT；allowlist生效 |
| 快速重複雙擊 | claim與start各只有1個有效command，單次5連點其餘4次被拒絕；無第二sequence或entity，PASS |
| 關閉browser | Agent持續，PASS |
| 重新開啟WEB | 重新讀取server authoritative phase/progress，PASS |
| WEB logout/login | logout期間Agent持續；login後恢復owner/mode/phase，PASS |
| 連續refresh | 5次refresh新增command數0，PASS |
| 完整完成7128至7132 | **3/3，PASS**。CID 1500970、1500971、1500972 均由 WEB login、Quest Journal 雙擊、claim SERVER_AGENT、原生 7128 至 7132 progress、原生 reward、COMPLETED 走完。每個 CID 的 `start_quest_sequence` 均只有一筆 CONFIRMED command |
| reward防重複 | 三個 CID 均各有且僅有 5583、2560、2456、15009 各1件；每個完成角色再次雙擊後 command 數、reward 數量均不增加，revision 分別保持 114、110、110，completed replay **3/3 PASS**，reward duplication 0 |

**TEST ACCELERATION**：先前 PR 11C 已證明 Agent 真實擊殺 Condor、Baby Desert Wolf、Scorpion 會由 rAthena 原生 kill attribution 增加真實 quest progress。本輪隔離 fixture 只在角色附近補充同種怪物數量，Agent 仍自行選怪、移動、攻擊與擊殺；沒有直接修改 quest count、SQL quest state、completion 或 reward。角色職業、等級、測試屬性、Eden Group Mark 22508 與原生 `nak_warp=29` prerequisite 只用於隔離測試帳號，未進正式 gameplay patch。

#### Service restart、ownership 與 rollback evidence

- Dashboard restart：三個active Agent持續執行，WEB恢復後可讀authoritative state，PASS。
- map-server recovery root cause：PR 13 rollout policy、allowlist 與 migration 004 沒有拒絕合法 restore。擴充的 Course A restart 覆蓋揭露兩個既存 restore 缺陷。`activate_navigation_runtime(..., restored)`只選 route 中第一個同名 map node，遇到 route 重複進出同一 map 時會回到錯誤 segment；quest sequence restore 又在 durable `NAV_xxx` phase 上執行 native checkpoint forward scan，跳過持久化 navigation step，落入 restart 後已不存在 script VM frame 的 dialog step，產生 `QUEST_SEQUENCE_DIALOG_STATE_MISMATCH`。
- 最小修正：navigation restore 依目前 map 與座標選最近 route node，同距離時選後段 node，並輸出`NAVIGATION_RESTORE_RESUME`；quest sequence 在 durable `NAV_xxx` restore 時保留 saved step，僅在非 navigation checkpoint 執行 forward scan。rollout permission、ownership CAS、duplicate protection與quest authority均未繞過。
- 受控 map-server restart：GO_MAP、KILL_MONSTER、RETURN_NPC 各1次，合計 **3/3 PASS**。GO_MAP 與 KILL 使用 CID 1500967，RETURN 使用 CID 1500970；每次皆恢復同 CID、entity=1、SERVER_AGENT ownership、合法 rollout permission與持久化 quest intent，route重新計算後任務繼續。無 quarantine、duplicate、ghost 或 reward duplication。
- map-server process hard kill後立即重啟：本輪未重跑；前次共享`char.online=1`導致fail-closed的證據仍保留，標示【資料不足，無法確認】於目前修正版。此限制不納入本輪明定的 controlled restart gate。
- char-server restart：在 CID 1500970 完成任務後重新 claim 成 active SERVER_AGENT、PERSISTENT_IDLE、entity=1，再受控重啟 char-server。map-server 期間保留同一 entity，重連後 ownership/revision 維持 SERVER_AGENT/120，沒有第二次 auth/load；之後 release CONFIRMED，revision 122、owner OPENKORE、entity=0，PASS。AUTO_QUEST 執行中的 char-server restart 為【資料不足，無法確認】。
- OpenKore collision：本輪三個測試身份沒有啟動OpenKore；沿用PR 11D已完成的真實OPENKORE與SERVER_AGENT collision證據。三個 final CID 的 claim、quest、release 全程 entity 不超過1，沒有duplicate或ghost。
- emergency rollback：三個Agent active時設`emergency_disabled=1`，三者均記錄`ROLLOUT_RELEASE`、save、release至OPENKORE，entity=0、`char.online=0`；原生quest分別停在7128、7131、7132既有進度，inventory沒有reward污染。之後受控shutdown輸出`Memory manager: No memory leaks found.`，PASS。

#### Failure UX 與 telemetry

實際headless browser以 **TEST CONTRACT FIXTURE** 驗證八種顯示，不修改quest/reward：`prerequisite_incomplete`、`already_completed`、`ownership_conflict`、`route_failed`、`npc_missing`、`target_unresolved`、`inventory_full`、`quarantined`均顯示可讀繁中；browser payload沒有stack trace、C++檔名或行號，PASS。內部log保留error code、revision、ownership、executor與phase。

`/api/ro/agents/rollout/telemetry` 最終 runtime 回傳：active server agents 0、active AUTO_QUEST 0、ownership conflicts 2、quarantined count 15、duplicate command rejects 244、restart recoveries 9、average Course A completion 230930 ms、reward confirmation failures 0。累積 quarantined 與 failure counter 包含修正前及失敗 fixture 批次，最終三個 E2E CID 的`last_error_code`皆為NULL，沒有 quarantine。三個 final CID 各有1筆`COURSE_A_STARTED`與1筆`COURSE_A_COMPLETED`；CID 1500970 因 sequence 中途 map restart 沒有持久化開始 tick，completion duration 記為NULL，另外兩筆為240031 ms與221829 ms。

#### 修改、驗證、已知限制與 rollback

- 正式檔案：`ops/ro-stack/sql/004-persistent-agent-rollout.sql`、`ops/ro-stack/persistent-agent/rollout-gate.mjs`、`ops/ro-stack/persistent-agent/quest-journal-contract.mjs`、`ops/ro-stack/dashboard.mjs`、`ops/ro-stack/dashboard/app.js`、`ops/ro-stack/stack.config.psd1`、`ops/ro-stack/ro-stack.ps1`、`ops/ro-stack/patches/persistent-agent-rollout.patch`、`scripts/test-persistent-agent-limited-rollout-runtime.mjs`及本文件。
- 隔離rAthena source：`.tmp-persistent-agent-pr1/src/map/persistent_agent.cpp`；主修正位於persistent agent navigation與quest restore lifecycle，`chrif.cpp`沒有新增 workaround。隔離 fixture 為`.tmp-persistent-agent-pr1/npc/custom/persistent_agent_pr13_test.txt`及其`scripts_custom.conf`註冊，只供 TEST ACCELERATION，不納入正式 patch。
- 驗證：Release x64完整solution build成功，map-server連結成功，2個既有C4819 warning、0 error；JS syntax、migration idempotency與正式 patch 在可丟棄 locked-rAthena clone 上疊加後，`persistent_agent.cpp/.hpp`、`persistent_agent_state.cpp/.hpp`均與runtime PoC一致。沒有跑完整release gate或大量壓測。
- 已知限制：只驗證三個隔離 allowlisted 帳號與 Eden Course A；本輪未重跑 hard-kill map recovery、AUTO_QUEST 中 char-server restart或三個新身份的實際 OpenKore process collision。正式 OpenKore collision 沿用已 PASS 的 ownership gate；全量 rollout、Course B與其他等級仍禁止。
- Rollback：先設`emergency_disabled=1`，等待active Agent回PERSISTENT_IDLE並release；確認owner OPENKORE、entity=0、`char.online=0`後維持global/course flag為0。再回退Dashboard gate、supplemental rAthena patch與bootstrap設定。004新增表可保留供稽核；不可刪改原生`char`、`quest`、`inventory`、equipment或reward資料。

Production PR 13 結論：**LIMITED ROLLOUT GO**。僅核准以 server-side global flag、Course flag及AID/CID allowlist受控開放 Eden Course A；預設仍為OFF，emergency disable與OpenKore fallback維持。不得擴大到全量玩家、Course B或其他正式任務。

### 30. Production PR 14: Active AUTO_QUEST Char-server Restart Recovery

狀態：**PASS；GO**。本輪只修正 active `AUTO_QUEST` 在 char-server controlled restart 期間的 lifecycle contract，未增加 gameplay、quest、WEB 或 rollout 功能。測試使用既有 allowlisted 隔離 AID/CID 2000973/1500973；Course A allowlist沒有擴大。

#### Root cause 與 lifecycle contract

修正前 runtime 重現顯示：`persistent_agent_on_char_server_disconnect()`只輸出「lifecycle mutations paused」，各 navigation、combat、NPC、quest 與 command timer仍繼續執行。char-server unavailable期間 Agent revision曾從29推進至82，且 reconnect後`char.online`維持0。`persistent_agent_on_char_server_ready(false)`沒有重新確認 ownership、runtime instance、revision或重播 save；原生`send_users_tochar()`不包含fd=0 server-owned entity，因此也不會替此角色恢復online狀態。

修正後 contract：

- disconnect立即令`char_server_available=false`，停止attack、walk與skill cast，清除各movement-start flag，並遞增active route token使舊callback失效。
- char-server unavailable期間，command、farm、navigation、NPC、service、quest timer只重排自身，不執行Agent mutation。現存同一個fd=0 entity可留在記憶體，但維持`SAFE_PAUSED`語意；Agent不宣告save成功，也不執行reward等不可逆步驟。
- reconnect先由state repository重讀CID，要求owner/state=`SERVER_AGENT`、runtime=`ACTIVE`、`runtime_instance_id`與本process相同、revision完全相符。任一條件失敗即fail-closed quarantine。
- reconcile成功後才呼叫`chrif_char_online(sd)`，接著`pc_makesavestatus()`與`chrif_save(CSAVE_NORMAL | CSAVE_INVENTORY | CSAVE_CART)`重播完整保存；各timeout基準重新設為目前tick，再恢復原intent。
- 沒有以sleep或固定delay裁定狀態，沒有修改char-server protocol，`chrif.cpp/.hpp`沿用既有disconnect與ready hook。

#### Runtime evidence

隔離環境：MariaDB 3307、login 6902、char 6124、map 5124、Dashboard 8799。所有案例使用同一CID 1500973，restart期間均維持單一map-server entity；char-server暫停時`char.online=0`，reconcile後恢復1。

| Case | 結果 | Runtime evidence |
| --- | --- | --- |
| GO_MAP restart | PASS | `NAV_029` revision155在disconnect後維持不變；log記錄`CHAR_DISCONNECT_SAFE_PAUSED`，reconnect記錄`CHAR_RECONNECT_RECONCILED ... revision=155 entity=1 save_replayed=1`，route重算並推進至`NAV_030` revision157 |
| KILL_MONSTER restart | PASS | `STEP_040` revision167、quest 7129 count0在offline窗口不變；reconnect後由Agent真實選怪、移動、擊殺，7129 count達10並推進至`NAV_041` revision169 |
| RETURN_NPC restart | PASS | `NAV_051` revision180在offline窗口不變；reconnect後route重算並抵達NPC，推進至`STEP_058` revision187，無last error |
| reward前 restart | PASS | `NAV_080` revision579命中後立即停止char-server；三秒後phase與revision仍為`NAV_080/579`，quest 7132為原生completed、DB reward inventory為0。reconnect只重播save，route由當前step重算，原生NPC流程完成後revision593，四件reward各1 |
| reward後 restart | PASS | Course A完成後`PERSISTENT_IDLE` revision593、quest 7132 completed，5583、2560、2456、15009各1；再次controlled restart後revision與item count均不變，沒有第二sequence或第二次reward |
| 正常restart repeat | PASS | 另一個`GO_MAP NAV_029` revision268案例在offline窗口保持不變，reconnect後繼續route；本輪合計5個指定phase案例，加1個正常repeat，加1個reward safety repeat均取得runtime evidence |
| stale callback | PASS | disconnect時active route token遞增；offline窗口phase/revision不前進，reconnect後只有新token route推進，沒有舊callback跨越或重複quest step |

**TEST ACCELERATION**：先取得每種目標怪物由Agent真實kill attribution增加原生quest progress的既有runtime證據後，本輪隔離fixture只把相同Condor、Baby Desert Wolf與Scorpion生成區集中在`moc_fild11 (180,240)`附近。Agent仍自行target、move、attack、kill；沒有修改quest count、quest state、completion或reward。該fixture不納入正式patch。

#### Reward、ownership與collision regression

- reward一致性：reward前窗口證明原生quest completion可先於inventory save；reconnect使用相同resident `map_session_data`重播一次完整save，最終5583、2560、2456、15009各1。reward後再restart仍各1，duplication為0。
- revision：各active案例offline期間保持不變，reconnect前以DB authoritative revision與本地record完全比對；恢復後只由既有CAS/sequence mutation單調增加，未觀察倒退。
- OpenKore active再claim：真實OpenKore以CID 1500973進入map、`char.online=1`；command `ba4ad7ef-bf81-4830-b263-1eb7b9bf8afd`回`REJECTED active_openkore`，owner維持OPENKORE、revision595不變。
- Agent active再啟OpenKore：claim command `45fb9e8a-e535-4f96-a050-7c5e57c39eb7`確認SERVER_AGENT revision598、fd=0、entity=1；受管launcher先由ownership guard拒絕，繞過launcher的真實OpenKore登入仍由login-server回`The server still recognizes your last connection`，ownership未被搶走。
- 第二map-server：第一個map-server持有CID時，第二個真實map-server在port 5125啟動，回`DUPLICATE_OWNERSHIP`並將row fail-closed為QUARANTINED；第二process沒有load/auth/entity。全程沒有第二entity或reward duplication。
- controlled shutdown：本輪所有計入案例的map、char、login shutdown均完成；memory manager輸出`No memory leaks found`，沒有crash。

#### 修改檔案、known limitations與rollback

- 正式檔案：`ops/ro-stack/patches/persistent-agent-rollout.patch`與本文件。supplemental patch只加入char-server availability gate、disconnect action cancellation與reconnect reconcile/save replay。
- 隔離runtime source：`.tmp-persistent-agent-pr1/src/map/persistent_agent.cpp`。測試加速fixture為`.tmp-persistent-agent-pr1/npc/custom/persistent_agent_pr13_test.txt`，不進正式patch。
- Build與patch：Release x64完整solution編譯成功；正式`persistent-agent.patch`加更新後`persistent-agent-rollout.patch`可套用到鎖定commit e985006，套用後`persistent_agent.cpp`與runtime PoC一致。
- 已知限制：第二map-server collision的既有策略會將共享row設為QUARANTINED，需operator rollback後才可恢復。若此時同時開啟emergency disable，舊runtime會因revision已被第二process推進而反覆記錄`RELEASE_CAS_FAILED`直到controlled shutdown；保護仍為fail-closed且沒有第二entity，本輪未擴張scope修正此既有operational noise。
- Rollback：先設global與Course flag為OFF、`emergency_disabled=1`，停止新command；讓正常owner角色save、回`PERSISTENT_IDLE`並release。確認entity=0及`char.online=0`後，回退本節新增的supplemental patch hunks並重建map-server。QUARANTINED測試身份只可在所有相關map-server均停止後走受控operator rollback；不可修改原生quest、inventory、equipment或reward資料。

Production PR 14 結論：**GO**。Course A controlled recovery matrix現已覆蓋map-server restart與active AUTO_QUEST char-server restart的GO_MAP、KILL_MONSTER、RETURN_NPC、reward前、reward後；核准範圍仍為PR13的LIMITED ROLLOUT，禁止擴大allowlist、Course等級或全量玩家。

## OpenKore Dependency Matrix

此矩陣只裁定 OpenKore 每角色 runtime。OpenKore 的鎖版資料表、FLD2 與來源查核工具屬資產依賴，不在本階段移除。

| Feature | 正式專案目前路徑 | Server Agent 證據 | 決策與停止依賴 Gate |
| --- | --- | --- | --- |
| Character login / lifecycle | 每角色 OpenKore worker 登入 | 真實 AID/CID、fd=0、restart recovery PASS | 保留；正式 char 建立、啟停、重啟、重複登入 regression 後切換 |
| Normal combat / EXP | OpenKore `attackAuto` | 單怪種 target/move/attack/retarget/EXP PASS | 保留；多怪政策、anti-KS、正式地圖 regression 後切換 |
| Loot | `itemsTakeAuto` / `itemsGatherAuto` | 距離、重量、滿格、真實 inventory PASS | 保留；多角色競爭、不可達掉落與退避完成後切換 |
| Skill combat | `attackSkillSlot` 等 | 單職業 `SM_BASH` PASS | 保留；職業技能矩陣、施法中斷、冷卻與裝備條件完成後切換 |
| HP/SP survival | `useSelf_*`、`sitAuto_*` | 藥水、自補、坐回 PASS | 保留；策略優先級、補給耗盡與危險逃離完成後切換 |
| Death recovery | OpenKore respawn / route | 固定 save point、返回目標、續戰 PASS | 保留；跨圖 save point、失敗重試與重啟中死亡完成後切換 |
| Navigation | `MapRoute` / `CalcMapRoute` | 正式 PR 7 同圖 5/5、跨圖 3/3、有限 retry、release 中止與 restart recovery PASS | 保留；通用 portal graph、成本、傳送道具與大範圍地圖 regression 後切換 |
| NPC interaction | OpenKore talk | 正式 PR 8 隔離對話5/5、menu、close、missing、timeout、disappear、release與restart recovery PASS | 保留；正式 NPC 腳本矩陣與正式地圖 regression 後切換 |
| Shop / storage / transport | OpenKore storage/buy/sell/route | 正式PR 9隔離runtime：buy/sell 5/5、storage存取5/5、save point實際respawn、雙向transport、容量/重量/限制/timeout、release與restart PASS | 保留；正式NPC服務矩陣、策略與正式地圖regression後切換 |
| Quest | OpenKore task plugin | PR 11D：Renewal Eden Course A 7128至7132隔離原生quest、reward及五個restart checkpoint PASS | 保留；只覆蓋Course A與隔離帳號，正式玩家rollout仍NO-GO |
| WEB control / status | OpenKore command dir + status export | PR 12：typed Quest Journal、十個Course A顯示checkpoint、refresh/login/restart state與ownership executor來源 PASS | 保留；正式auth rollout、可靠部署與更廣任務矩陣未完成 |
| Stat / skill allocation、equipment | OpenKore commands/config | 【資料不足，無法確認】 | 保留 |
| Onboarding / job change | OpenKore workflow | 【資料不足，無法確認】 | 保留 |
| Chat / party / guild / trade | OpenKore packet bridge | 【資料不足，無法確認】 | 保留 |
| Pet / homunculus / mercenary | OpenKore AI | 【資料不足，無法確認】 | 保留 |

Phase 11 結論：僅完成靜態矩陣整理。正式 OpenKore runtime 變更為 0；沒有 runtime 證據，因此不標示 PASS。

## Next Action

Production PR 13 已通過受控 Limited Rollout Gate。下一步只能依既有 feature flag 與 AID/CID allowlist開放少量核准測試帳號，持續觀察 ownership conflict、restart recovery、quest failure與reward confirmation telemetry；維持global/course預設關閉及emergency disable能力。不得進Course B、其他等級或全量玩家 rollout。
