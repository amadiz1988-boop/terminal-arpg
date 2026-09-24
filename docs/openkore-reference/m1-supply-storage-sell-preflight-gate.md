# M1 補給、存倉、販售與切圖前判定來源閘門

```text
TASK_ID = OPENKORE_MATURE_CAPABILITY_GAP_CENSUS_AND_CLOSURE_V1
PRODUCT_AUTHORITY = docs/project-control/canonical-m1-world-travel-supply-ui-v1.md
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
REFERENCE_CLASS = ADAPT
SOURCE_STATUS = IN_PROGRESS
VERIFIED_TEST_PLAYER_FLOW = NOT_MEASURED
BROWSER_ACCEPTANCE = NOT_MEASURED
PRODUCTION = NOT_TOUCHED
```

本紀錄保存來源與歷史證據，不覆蓋產品決策。新使用者決策取代 `e69f4bb4` 的只按戰鬥消耗品補給規格，明確納入重量、格數、存倉與合規販售。此前 38 項來源閉合 `1/38`、產品閉合 `0/38` 是當時快照；須待新流程權威驗收後重算。

## 鎖定來源與 Last Good

| 問題 | 精確來源 | 已確認語義 |
| --- | --- | --- |
| 觸發順序 | `.local/ro-stack/openkore/src/AI.pm::shouldStartAutoStorage` 約 657 起，`shouldStartAutoSell` 約 773 起；後續 `shouldStartAutoBuy` | 可用服務與門檻成立時，存倉先於販售與採購判定 |
| 角色門檻 | `.local/ro-stack/instances/player_2000034/control/config.txt:207-209` | `itemsMaxWeight=89`、`itemsMaxWeight_sellOrStore=68`、`itemsMaxNum_sellOrStore=99`；此為歷史角色值，不作全角色硬編預設 |
| 逐項政策 | `.local/ro-stack/instances/player_2000034/control/items_control.txt`；鎖定 `control/items_control.txt` | `item keep storage sell`，未列項 `all 0 1 0` 預設存倉；存倉優先，裝備中的物品不處置 |
| 販售篩選 | `.local/ro-stack/openkore/src/AI/CoreLogic.pm` 約 1976-1990 | 排除 equipped 與 unsellable；僅 `control.sell` 且數量高於 keep 時販售超額 |
| 歷史玩家結果 | `docs/openkore-reference/supply.md`、`docs/openkore-exit-source-of-truth.md` Gate 2 | 低補給到購買再返回掛機曾有玩家流程證據；廣義存倉與販售仍缺玩家流程閉合 |
| 現行 rAthena 權威 | `src/map/persistent_agent.cpp::execute_service`、`storage_storageadd`、`npc_selllist`、`npc_buylist`；`src/map/storage.cpp` 與 `src/map/pc.cpp` | Native 提交意圖並核對前後結果；rAthena 裁定背包、重量、容量、交易與 Zeny |

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
