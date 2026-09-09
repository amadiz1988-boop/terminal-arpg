# RO Renewal 與 OpenKore 來源基準

鎖定日期：2026-09-09

## 版本決策

遊戲規則採 rAthena Renewal，掛機行為採 OpenKore。選擇依據是可取得的資料覆蓋範圍與原始碼可追溯性。

| 用途 | 專案 | 鎖定 commit | 使用範圍 |
| --- | --- | --- | --- |
| 規則與內容 | `rathena/rathena` | `e985006171d2eb320ee512a653f4c83aea3d81b6` | `src/map`、`src/config/renewal.hpp`、`db/re`、`npc`、`doc` |
| 掛機 AI 與終端 | `OpenKore/openkore` | `51de1ddfc4449ae5217f6886de702f87ca934030` | `src/AI`、`src/Task`、`src/Field.pm`、`tables`、官方 Wiki |

## 已確認的覆蓋範圍

rAthena 的 Renewal 設定明確分離 Renewal 公式、詠唱、掉落、經驗、等級傷害、攻速與能力值計算。`db/re` 提供 Renewal 物品、技能、怪物及相關資料。戰鬥與狀態公式可從 `battle.cpp`、`status.cpp`、`skill.cpp` 追蹤。

OpenKore 的 AI 原始碼提供路線、沿途攻擊、目標選擇、攻擊流程、戰後拾取與工作佇列。`Field.pm` 定義格狀地圖及 `.fld2` 資料的讀取方式，實際可行走判斷以 `src/auto/XSTools/PathFinding/algorithm.cpp` 的 `checkTile_inner` 位元檢查為準。

## 單一版本規則

1. 執行期資料只能來自上述兩個 commit 或專案內已標明來源的衍生資料。
2. 每個公式測試都要記錄對應原始碼檔案、函式或資料列。
3. 更新來源版本時建立新基準文件與遷移報告，禁止直接追蹤 master。
4. Renewal 與 Pre-Renewal 公式禁止混用。
5. 實機影片只用來核對操作節奏及視覺輸出，不能覆蓋已鎖定公式。

## 已知缺口

- rAthena 與 OpenKore 是相容伺服器及自動化客戶端實作，無法直接證明每個細節與指定地區官方伺服器完全一致。
- 官方客戶端美術、音效、劇情文本及完整地圖素材的公開授權狀態：`【資料不足，無法確認】`。
- 公開站能否使用 RO 原名、劇情與素材：`【資料不足，無法確認】`。未確認前不發布新的 RO 內容站。

## 主要來源

- https://github.com/rathena/rathena/tree/e985006171d2eb320ee512a653f4c83aea3d81b6
- https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/config/renewal.hpp
- https://github.com/rathena/rathena/tree/e985006171d2eb320ee512a653f4c83aea3d81b6/db/re
- https://github.com/OpenKore/openkore/tree/51de1ddfc4449ae5217f6886de702f87ca934030
- https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI/Attack.pm
- https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Field.pm
- https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/auto/XSTools/PathFinding/algorithm.cpp
