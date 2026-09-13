# 實際 Repository 架構

本文件描述 2026-09-12 工作樹中的現行玩家流程。產品狀態見 [CURRENT_STATUS.md](CURRENT_STATUS.md)，優先工作見 [TODO.md](TODO.md)。

## 現行執行環境

| 層 | 現行實作 | 責任 |
| --- | --- | --- |
| 玩家入口 | `ops/ro-stack/dashboard.mjs`，預設 `127.0.0.1:8788` | 靜態檔案、JSON API、登入工作階段、角色擁有權與命令驗證 |
| 玩家頁 | `ops/ro-stack/dashboard/index.html`、`app.js`、`styles.css` | 登入、創角、選角、狀態、戰鬥、任務、裝備、地圖、聊天與排行榜 |
| 自動操作 | 每角色 OpenKore 程序、`openkore-instance.ps1` | 尋路、戰鬥、NPC 對話、補給及玩家核准的自動操作 |
| 即時狀態 | `openkore-plugins/status-export/`、OpenKore log | 匯出角色、地圖、怪物、物品、任務與事件狀態 |
| 世界服務 | 固定版 rAthena Login／Character／Map Server | Renewal 世界、NPC、任務、戰鬥結果與物品規則 |
| 持久化 | MariaDB | rAthena 帳號、角色、物品、任務及 Dashboard 工作階段與偏好 |
| 服務控制 | `ops/ro-stack/ro-stack.ps1`、`dashboard-service.ps1`、根目錄 `.cmd` | 啟動、停止、健康檢查與朋友測試 |
| 管理觀測 | `ops/ro-stack/ops-agent/`、`ops-agent-service.ps1` | 與玩家 Dashboard 分離的 loopback 唯讀 API、incident snapshot 與 390×844 管理頁；目前不接受管理動作 |
| 公開測試入口 | Cloudflare outbound-only Tunnel → `127.0.0.1:8788` | 暫時 HTTPS 入口；Quick Tunnel 網址不是固定網域 |
| 資產與轉換 | `public/ro/`、`scripts/`、`third_party/openkore/` | 地圖、紙娃娃、圖示、音效、BGM 與來源資料轉換 |

`.local/ro-stack/` 保存本機來源 checkout、執行檔、密碼、log 與程序狀態，不加入 Git。

## 現行依賴方向

```text
瀏覽器 Dashboard
  │ HTTPS / JSON
  ▼
ops/ro-stack/dashboard.mjs
  ├── MariaDB：帳號、角色、物品、任務、工作階段、偏好
  ├── OpenKore 狀態與 log：即時角色、地圖、怪物、任務、事件
  └── OpenKore 命令：掛機、尋路、NPC、補給、裝備、配點
          │ RO 封包
          ▼
       rAthena
          │ SQL
          ▼
       MariaDB
```

rAthena 與 MariaDB 是角色、物品、任務與世界狀態的權威來源。OpenKore 是角色自動操作執行器。Dashboard 顯示狀態並提交經伺服器驗證的操作。

獨立 Ops Agent 預設只監聽 `127.0.0.1:8790`，以標準契約彙整程序、listener、HTTP、資料庫、service link、heartbeat 與 ownership 證據。其生命週期與 8788 Dashboard 分離；管理頁與 incident snapshot 只讀取相同契約，現階段未建立公開入口或控制動作。

## 玩家流程

1. `POST /api/account` 在 MariaDB 建立或驗證帳號，回傳 HttpOnly 工作階段 Cookie。
2. `GET /api/session` 讀取帳號與已選角色；無角色時由 `POST /api/characters` 建立 rAthena 角色。
3. Dashboard 為角色啟動專屬 OpenKore 程序。
4. `GET /api/state` 合併 MariaDB 與 OpenKore 狀態輸出角色、裝備、道具、任務、補給及世界資訊。
5. `GET /api/events` 增量輸出戰鬥與地圖事件；`GET /api/social` 輸出聊天事件。
6. 配點、技能、裝備、任務、補給與掛機 API 只建立受驗證的操作，實際結果回到 rAthena、MariaDB 或 OpenKore 真實狀態。

## 任務與自動化邊界

- Dashboard 任務日誌只顯示、發起與引導。
- rAthena quest state、MariaDB 角色狀態與 OpenKore `%questList` 提供真實任務狀態。
- NPC script 發放任務獎勵，Dashboard 不直接發物品或改寫完成狀態。
- 同一角色的命令由 Dashboard 與 OpenKore bridge 做最小互斥及擁有權驗證。

## 來源與資產邊界

- `game/ro/source.ts` 鎖定 rAthena Renewal `e985006171d2eb320ee512a653f4c83aea3d81b6` 與 OpenKore `51de1ddfc4449ae5217f6886de702f87ca934030`。
- rAthena 規則依鎖定來源的 `src`、`db/re`、`npc` 與 `doc` 查核；OpenKore 行為依鎖定 checkout 查核。
- `public/ro/` 是執行期資產，轉換方式與來源保留在 `scripts/`、`THIRD_PARTY_NOTICES.md` 與相關稽核文件。
- 官方客戶端 GRF 維持唯讀，Repository 只保存已核准匯入的轉換素材。

## 封存的 Vinext／D1 原型

`app/`、`game/server/`、`game/ro/world/`、`db/` 與 Vinext 設定是早期瀏覽器模擬原型，程式碼仍供歷史追溯。`.openai/hosting.json` 已移至 `archive/legacy-vinext-demo/hosting.json` 並停用。

- `http://localhost:3000/` 不再提供服務。
- `npm run dev` 與 `npm start` 啟動 8788 Dashboard。
- `npm run build`、`npm run qa:ui`、`npm run test:release` 會輸出 `LEGACY_WEB_ARCHIVED` 並停止。
- 封存原型的 D1、`world_json`、固定 seed demo 與 `game-shell.tsx` 不得作為現行玩家資料或發布證據。

## 不變條件

1. rAthena／MariaDB 產生並保存正式角色與世界結果。
2. OpenKore 只執行已核准的角色操作，Dashboard 不直接改角色座標、任務完成或獎勵。
3. 每個 API 操作驗證工作階段、角色擁有權、輸入與命令範圍。
4. 資料不足時保留 `【資料不足，無法確認】`，不把推導值寫成原作規則。
5. 公開驗收同時涵蓋本機 8788 與當次公開 HTTPS 入口。

## 目前架構缺口

- 固定公開網域、Tunnel 斷線回復、監控與長時間多人運作尚未完成驗收。
- 新 Dashboard 的綜合發布指令尚未建立，舊 Vinext `test:release` 已停用。
- 完整職業、技能、地圖、NPC、補給、二轉與社交流程仍按 [CURRENT_STATUS.md](CURRENT_STATUS.md) 逐項驗收。
- 工作樹含大量尚未提交變更，提交前需依功能切片整理並執行對應測試。
