# 待辦與接手任務

這是可交給新 Work／Codex 的工作清單。一次只挑一個任務，先讀 [CURRENT_STATUS.md](CURRENT_STATUS.md)，再在任務開始時補上範圍、source of truth、完成條件與驗證命令。完成後更新本文件與現況快照。

狀態使用 `todo`、`in_progress`、`blocked`、`done`。`blocked` 必須附上可重現的阻塞證據與需要的外部決策。

## P0：接手與發布基礎

| 狀態 | 任務 | 完成條件 |
| --- | --- | --- |
| done | 建立接手文件組 | `AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/CURRENT_STATUS.md`、`docs/GAME_DESIGN.md`、`docs/TODO.md`、README 導覽互相連結，且描述符合實際檔案 |
| done | 固定公開入口 | `play.g8land.com` Named Tunnel 已由獨立 SYSTEM 排程與 watchdog 維護；受控斷線自動恢復、公開健康檢查與遊戲 PID 不變證據已完成 |
| done | 管理後台外網唯讀入口 | `https://admin.g8land.com` 使用獨立 Named Tunnel、登入保護、限流、手機版與 watchdog；未登入 API 拒絕，控制權限維持關閉 |
| done | 管理後台 Windows 自動復原 | SYSTEM 開機觸發加每分鐘冪等檢查，三個管理程序同時離線後仍可重新啟動；不操作遊戲服務與玩家執行器 |
| done | D1 舊原型退出現行架構 | MariaDB、rAthena 與 OpenKore 為現行權威狀態；Vinext／D1 原型、Sites 設定與 3000 埠已封存並有自動阻擋 |
| in_progress | Git 功能切片入版 | 將目前已修改與未追蹤檔案按功能切片整理，逐項測試、提交及推送；遠端可重建最新可玩版本後完成 |
| todo | Dashboard 發布閘門 | 建立取代舊 Vinext `test:release` 的綜合指令，保存來源 SHA、測試輸出、部署版本、公開網址與同流程冒煙測試 |

## P1：核心內容與驗收

| 狀態 | 任務 | 完成條件 |
| --- | --- | --- |
| in_progress | 完整十種一轉逐職驗收 | 每個職業完成來源、技能、武器、任務、轉職、掛機與手機玩家頁紀錄；資料轉換完成不等於流程完成 |
| in_progress | Renewal 技能與資源規則 | 逐項補齊技能材料、詠唱、延遲、SP、狀態與組合條件，附 rAthena／OpenKore 來源及領域回歸測試 |
| in_progress | 地圖與路線擴充 | 將 `prt_fild08` 的轉換流程擴充至城鎮、學院與公開掛圖，確認 FLD2、傳點、Route、重生與風險權重 |
| in_progress | 官方 UI 對齊 | 完成髮色、紙娃娃分層、字型、視窗比例、官方按鈕與素材缺件清單；390×844 與桌面流程瀏覽器錯誤及 404 皆為零 |
| todo | 整理世界模組邊界 | 先為 `game/ro/world/simulation.ts` 建立行為契約與回歸測試，再以小提交拆分自動化、戰鬥、物品與成長；每步保持事件與存檔相容 |

## P2：服務與社交

| 狀態 | 任務 | 完成條件 |
| --- | --- | --- |
| in_progress | NPC、補給與倉庫閉環 | 玩家實際走到 NPC，完成販售、存倉、購買、補給、回城與返回掛圖；狀態由伺服器驗證並可重連 |
| todo | 二轉與後續職業 | 逐職確認官方門檻、任務、試煉、技能與獎勵，完成防重播及公開測試帳號隔離 |
| todo | 多人與聊天 | 完成共享地圖、頻道、密語、隊伍、公會與語音的來源稽核、權限、限流與雙玩家驗收 |
| in_progress | 排行榜、公會與公開角色頁 | 職業等級排行榜第一版與 11 個開放職業男女動畫身體已完成；尚需公開頁驗收、公會與獨立角色頁 |
| todo | 長時間運作 | 完成多帳號掛機、崩潰重啟、備份、監控、資源上限、TLS 與安全測試；沒有實測證據就保留未完成 |

## 每個任務的標準交付

```text
任務範圍：一個可在單次工作完成的功能切片
Source of truth：列出程式、資料、來源文件與測試
完成條件：可觀察、可重播、可驗收
修改檔案：開始前列出預計檔案
驗證：npm test、npm run lint、npm run test:active-web-entrypoint 與任務直接相關的 npm run test:*
文件：更新 CURRENT_STATUS.md 與本任務相關稽核或設計文件
回報：修改檔案、測試結果、未完成與下一步
```

## 不接手的範圍

- 只為了讓文件看起來完整而建立尚未有實作契約的新模組。
- 未經來源稽核的職業、技能、掉落、配方、數值或經濟規則。
- 以單次建置、單元測試或截圖推斷公開版本已完成。
- 依賴舊對話記憶才能重現的未記錄操作。
