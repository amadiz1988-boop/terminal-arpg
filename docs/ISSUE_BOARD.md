# Issue Board

本專案使用 Dashi Taskboard。狀態流程為 `backlog → todo → in_progress → in_review → done`。

產品主軸固定為 rAthena Renewal 規則、OpenKore 自動移動與戰鬥、RO 玩家介面、任務、社交與長時間掛機。

目前依賴順序：來源鎖版 → RO 資料轉換 → 格狀世界 → OpenKore AI → 戰鬥與掉落 → 補給與死亡 → 新生任務與轉職 → 社交與公開驗收。

目前還原度與證據只以 `docs/RO_RESTORATION_PROGRESS.md` 為準；本文件提供工作追蹤，不重複維護完成度數字。接手狀態見 `docs/CURRENT_STATUS.md`，可執行優先序見 `docs/TODO.md`。

## 目前追蹤

| 狀態 | 工作 | 驗收 |
| --- | --- | --- |
| done | 鎖定 RO 資料來源 | rAthena Renewal 與 OpenKore 固定版本已記錄 |
| done | 本機伺服器底座 | MariaDB、登入、角色、地圖、跨服務連線與資料表檢查通過 |
| done | 帳號與離線掛機橋接 | 註冊、角色建立、獨立 worker、重登與服務重啟恢復通過 |
| done | 新生任務與一轉基礎流程 | 盜賊、劍士、服事、魔法師、弓箭手流程已接入 Renewal 學院；中斷可恢復 |
| in_progress | 完整職業資料 | 十種一轉、擴充二轉與二轉職業型別、技能與裝備仍需逐職補齊 |
| in_progress | 任務日誌 | 新生任務、伊甸園訓練、NPC 對話、目標地圖與黑窗時間戳持續補齊 |
| todo | 二轉試煉 | 職業過濾、官方門檻、試煉 instance、證書計數、通用 NPC 與防重播 |
| in_progress | OpenKore 掛機循環 | 尋路、索敵、戰鬥、拾取、負重、回城、倉庫、販售、補給與死亡復原 |
| in_progress | 玩家介面安全邊界 | 原始命令禁用、動作白名單、來源限制、註冊限流與拓樸保密 |
| in_progress | 官方客戶端資產整合 | Default Skin、BGM、音效、髮型、髮色、道具圖示與視窗素材逐批核對 |
| todo | 各職業排行榜與公開角色頁 | Base／Job 排序、紙娃娃、公會資料與測試帳號排除 |
| todo | 公會頁與社交 | rAthena 公會、成員、職位、邀請、公告與公會頻道 |
| todo | 玩家寄售與拍賣 | 先核對伺服器既有交易、露天商店、收購商店與郵件能力，再接入玩家頁 |
| in_progress | 官方 UI 還原 | 藍色標題、原廠按鈕、折疊、對話頻道、裝備欄、任務欄與手機版比例 |
| in_progress | RO 地圖情報 | 已接入 `prt_fild08` 與新生學院地圖，持續加入城鎮、傳點與掛圖建議 |
| todo | 公開入口驗收 | 完整手機流程、瀏覽器錯誤、長時間掛機、斷線重建與公開 HTTPS 回歸 |

## 驗收規則

所有新增功能先查核 rAthena 與 OpenKore 原生能力。規則、數值與名稱必須回到 `docs/RO_SOURCE_BASELINE.md` 的固定版本，來源不足時標記 `【資料不足，無法確認】`，不得直接進入公開資料。
