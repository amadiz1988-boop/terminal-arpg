# M1 補給、存倉、販售與切圖前判定來源閘門

```text
TASK_ID = OPENKORE_MATURE_CAPABILITY_GAP_CENSUS_AND_CLOSURE_V1
PRODUCT_AUTHORITY = docs/project-control/canonical-m1-world-travel-supply-ui-v1.md
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
REFERENCE_CLASS = ADAPT
PRE_IMPLEMENTATION_REUSE_GATE = PASS / m1-supply-storage-sell-reuse-gate.json
SOURCE_STATUS = CHECKPOINTED_WITH_SQL_DEPENDENCY_BLOCK
PRODUCT_STATUS = HISTORICAL / SUPERSEDED_BY_M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1
NATIVE_CHECKPOINT = 68ec3f66cf3444c7596ba44d2c19ec50e9ffa5c1
WEB_CHECKPOINT = b1498f21
SQL_LOADER = BLOCKED_BY_MIXED_FILE
FRESH_CHECKOUT_SQL = BLOCKED_BY_DEPENDENCY / untracked 006 creates persistent_agent_live_status
VERIFIED_TEST_PLAYER_FLOW = NOT_MEASURED
BROWSER_ACCEPTANCE = NOT_MEASURED
PRODUCTION = NOT_TOUCHED
```

本紀錄保存來源與歷史證據，不覆蓋產品決策。本工作線的使用者決策曾取代 `e69f4bb4` 的只按戰鬥消耗品補給規格，納入重量、格數、存倉與合規販售；其後 `0a120ae8` 及 `c0450b1c` 又將此決策標為歷史。現行產品權威以 `docs/project-control/canonical-m1-world-travel-supply-ui-v1.md` 為準。此前 38 項來源閉合 `1/38`、產品閉合 `0/38` 是當時快照；此工作線不重算。

## 鎖定來源與 Last Good

| 問題 | 精確來源 | 已確認語義 |
| --- | --- | --- |
| 觸發順序 | `.local/ro-stack/openkore/src/AI.pm::shouldStartAutoStorage` 約 657 起，`shouldStartAutoSell` 約 773 起；後續 `shouldStartAutoBuy` | 可用服務與門檻成立時，存倉先於販售與採購判定 |
| 角色門檻 | `.local/ro-stack/instances/player_2000034/control/config.txt:207-209` | `itemsMaxWeight=89`、`itemsMaxWeight_sellOrStore=68`、`itemsMaxNum_sellOrStore=99`；此為歷史角色值，不作全角色硬編預設 |
| 逐項政策 | `.local/ro-stack/instances/player_2000034/control/items_control.txt`；鎖定 `control/items_control.txt` | `item keep storage sell`，未列項 `all 0 1 0` 預設存倉；存倉優先，裝備中的物品不處置 |
| 販售篩選 | `.local/ro-stack/openkore/src/AI/CoreLogic.pm` 約 1976-1990 | 排除 equipped 與 unsellable；僅 `control.sell` 且數量高於 keep 時販售超額 |
| 歷史玩家結果 | `docs/openkore-reference/supply.md`、`docs/openkore-exit-source-of-truth.md` Gate 2 | 低補給到購買再返回掛機曾有玩家流程證據；廣義存倉與販售仍缺玩家流程閉合 |
| 現行 rAthena 權威 | `src/map/persistent_agent.cpp::execute_service`、`storage_storageadd`、`npc_selllist`、`npc_buylist`；`src/map/storage.cpp` 與 `src/map/pc.cpp` | Native 提交意圖並核對前後結果；rAthena 裁定背包、重量、容量、交易與 Zeny |
| 七城存倉腳本 | `npc/kafras/kafras.txt`、`npc/re/kafras/kafras.txt`、`npc/kafras/functions_kafras.txt::F_Kafra/F_KafStor` | Kafra 先執行對話、選單、技能及費用判定，再 `openstorage`；6 城存倉選項為 2，Izlude 為 1；Native 須核對實際選單 |
| 服務權限邊界 | `ops/ro-stack/stack.config.psd1::PersistentAgentServiceMapAllowlist/PersistentAgentServiceNpcAllowlist/PersistentAgentServiceItemAllowlist`；`src/map/persistent_agent.cpp::parse_service_payload` | 原通用服務命令只允許設定清單內單一物品；逐項政策的自動服務需另有有界、角色專屬、權威驗證的內部契約 |

## FIRST_BROKEN_TRANSITION

1. Native `handle_supply` 只以單一 `supply_item_id` 的低存量啟動，未依重量／格數進入存倉與販售流程。
2. Web `queuePlayerWorldMapTeleport` 對 `AUTO_FARM` 先送 `stop_farm`，沒有在此前向 Native 要求權威補給判定。
3. `/api/supply-cycle` 的正式玩家入口回 `CAPABILITY_NOT_NATIVE`；設定來源與可執行 Native 契約未接通。UI 控制須保持停用直到權威命令與驗收成立。

## 來源驗證矩陣

| 情境 | 必要結果 |
| --- | --- |
| 低藥水 | 購買後權威數量增加，保留返程費與掛機意圖 |
| 滿重、滿格 | 門檻由權威重量／已用格數觸發，先存倉，明確規則才販售 |
| 受保護、裝備中、不可賣 | 不處置或不販售；保留 keep 數量 |
| 倉庫滿、商人／服務不可用、Zeny 不足 | 有界安全阻擋，父意圖與目的地保留，無隔離與空轉 |
| 切圖前與後 | 補給判定早於 stop/費用/冷卻/傳送；成功後到所選地圖恢復 `AUTO_FARM` |

最終玩家證據須包含正式 `VERIFIED_TEST` 角色權威前後狀態、實際 Browser 操作、服務後返回所選地圖及怪物 HP 真實下降。來源或合成 PASS 不提升此閘門。

## 2026-09-24 來源檢查點與受控部署門檻

Native `68ec3f6` 精確提交五個本次檔案，Release x64 `map-server` 編譯及聚焦 C++ 政策檢查通過。Web `b1498f21` 精確提交二十個本次檔案；暫存版 JavaScript／PowerShell 語法與差異檢查通過。Web 工作樹聚焦測試通過：設定投影 19、schema 31、capability 46、route 33、cutover 68、preflight 11、合成情境 44、policy 14、world-map 40。上述均為來源或合成證據。

`012-m1-supply-live-preflight.sql` 已在 Web checkpoint，但 `ro-stack.ps1` 的 012 載入行與既有未追蹤 006～010 載入區塊混合，因此未納入 checkpoint。012 依賴未追蹤 `006-persistent-agent-live-status.sql` 建表。受控部署前需取得 006 建表的可重建來源、精確納入 012 載入點，並完成唯讀部署 precheck。兩側新能力開關預設為關閉。

受控部署、正式 `VERIFIED_TEST` 玩家流程、實際 Browser 操作、返回所選地圖後的真實怪物 HP 下降均未執行；38 項能力維持既有快照，不重算。歷史角色 `itemsMaxWeight=89` 的拾取上限亦未納入本次 sellOrStore 門檻實作，不宣稱全量 OpenKore parity。

後續 canonical 決策 `0a120ae8`、`c0450b1c` 把重量、格數、存倉與販售退出現行 M1。本次新程式兩側開關維持預設關閉，不作受控部署候選；重新啟用前須先由產品權威明確更新決策及完成上述 SQL、權威玩家與 Browser 閘門。
