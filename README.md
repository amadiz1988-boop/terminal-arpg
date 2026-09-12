# 鬼島傳說

以鎖定版 rAthena Renewal 資料與 OpenKore 自動化行為為基準的 RO 純掛機遊戲。玩家負責角色養成、裝備、技能、地圖與掛機策略；世界服務負責逐格移動、戰鬥、掉落、拾取、補給、死亡、重生與事件。

## 新工作先讀這裡

| 文件 | 用途 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 專案規則、source of truth、修改邊界、測試與提交流程 |
| [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) | 已完成、進行中、下一步與最新檢查快照 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 實際檔案分層、API、模擬、資料庫與執行環境 |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | 玩家循環、系統責任、RO 來源與產品邊界 |
| [docs/TODO.md](docs/TODO.md) | 可單次接手的優先任務與完成條件 |

之後的 Work／Codex 只需要依上述順序讀取，再依 `TODO.md` 選一個明確範圍。版本歷史與來源稽核放在 `docs/DEVELOPMENT_REVIEW_LOG.md`、`docs/RO_SOURCE_BASELINE.md`、`docs/*_SOURCE_AUDIT.md`。

產品鐵律見 [RO_AUTOMATION_PRODUCT_CONSTITUTION.md](docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md)，OpenKore 行為盤點見 [OPENKORE_FEATURE_AUDIT.md](docs/OPENKORE_FEATURE_AUDIT.md)，發布驗收見 [RELEASE_STRESS_GATE.md](docs/RELEASE_STRESS_GATE.md)，工作追蹤索引見 [ISSUE_BOARD.md](docs/ISSUE_BOARD.md)。

## 目前玩家入口

唯一啟用的玩家網頁是 `http://127.0.0.1:8788/`，使用 rAthena、OpenKore 與 MariaDB 真實狀態。localhost 的 3000 埠 Vinext／D1 瀏覽器原型已封存並停用，記錄見 [archive/legacy-vinext-demo/README.md](archive/legacy-vinext-demo/README.md)。

## 目前可玩範圍

- 8788 Dashboard 連接 rAthena、每角色 OpenKore 程序與 MariaDB，呈現實際地圖、角色、怪物、戰鬥、掉落、任務與小地圖狀態。
- Base／Job 經驗、等級、能力點、技能點、初心者技能、裝備與 Renewal 負重規則。
- OpenKore 風格視野、蒼蠅翅膀政策、隨機巡走、自動拾取與負重限制。
- Dashboard 提供帳號、工作階段、角色建立、角色選擇、掛機控制與狀態 API。
- RO 風格玩家頁、戰鬥終端、聊天、排行榜、任務、狀態、技能、裝備、道具與地圖情報視窗。
- 固定版 rAthena／OpenKore 本機 stack 與朋友測試控制腳本，操作方式見 [docs/RO_LOCAL_SERVER_ARCHITECTURE.md](docs/RO_LOCAL_SERVER_ARCHITECTURE.md)。

完整進度與未完成項目以 [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) 為準。

## 固定來源

- rAthena Renewal：`e985006171d2eb320ee512a653f4c83aea3d81b6`
- OpenKore：`51de1ddfc4449ae5217f6886de702f87ca934030`

來源識別與 URL 位於 `game/ro/source.ts`。未能由固定來源或可重現驗收證明的公式、物品、技能、地圖與功能，維持 `【資料不足，無法確認】`，不進入正式資料。

## 開發與驗證

```bash
npm install
npm run dev
npm test
npm run lint
npm run test:active-web-entrypoint
```

`npm run dev` 與 `npm start` 現在都啟動 8788 Dashboard。舊 Vinext 的 build、UI QA 與 release gate 已停用，避免將瀏覽器模擬版誤當正式版本。

文件整理只變更 Markdown 時，至少執行 `git diff --check`；改動程式、API 或玩家流程時，依 [AGENTS.md](AGENTS.md) 執行對應 Dashboard 測試。新的綜合發布指令尚未建立，完成前以 `未通過發布門檻` 記錄。

## 本機 RO stack

Windows 本機完整 stack 由 `ops/ro-stack/` 管理，使用 MariaDB、rAthena Login／Character／Map Server 與 OpenKore。常用入口：

```text
setup-local-ro.cmd          首次抓取固定來源、編譯與建立資料庫
start-local-ro.cmd          啟動 rAthena 與 MariaDB
health-local-ro.cmd         檢查服務、連接埠與資料表
start-local-playable.cmd    啟動可玩控制頁 http://127.0.0.1:8788/
test-local-playable.cmd     驗證本機可玩流程
stop-local-playable.cmd     停止朋友測試與本機服務
```

本機密碼、來源 checkout、log 與程序狀態位於 `.local/ro-stack`，不加入 Git。Vinext／D1 網站原型的封存狀態，以 `archive/legacy-vinext-demo/README.md` 與 `docs/CURRENT_STATUS.md` 為準。

## 標準新工作啟動指令

```text
請先讀取 AGENTS.md、docs/CURRENT_STATUS.md、docs/ARCHITECTURE.md、docs/GAME_DESIGN.md、docs/TODO.md，再檢查 git status。只處理 TODO 中指定的一個範圍，先列出相關 source of truth、完成條件與預計修改檔案；完成後執行必要測試、更新現況文件，並回報實際修改與未完成項目。不要依賴舊對話，也不要改動任務範圍外的遊戲功能。
```

## 專案 Skills

需要固定流程時，按需使用 `.agents/skills/`：`$project-handoff` 用於快速接手、`$implement-feature` 用於最小範圍功能實作、`$debug-bug` 用於證據導向除錯。三者只載入必要文件與相關路徑，不包含 RO／OpenKore 背景資料，也不取代 `AGENTS.md` 的規則。
