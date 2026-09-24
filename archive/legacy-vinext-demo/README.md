# Vinext 舊版網頁封存

封存日期：2026-09-12

這個入口曾使用 `app/`、`game/`、`db/` 與 Vinext，預設開發伺服器會出現在 `http://localhost:3000/`。該畫面使用瀏覽器模擬與 D1 原型資料，不屬於目前 rAthena／OpenKore／MariaDB 玩家流程。

目前唯一玩家入口是 `http://127.0.0.1:8788/`，由 `ops/ro-stack/dashboard.mjs` 提供。

封存措施：

- 專案根目錄不再保留 `.openai/hosting.json`，避免被自動識別成舊 Sites 專案。
- `npm run dev` 與 `npm start` 統一啟動 8788 Dashboard。
- 舊版 `build`、`qa:ui` 與 `test:release` 入口回覆 `LEGACY_WEB_ARCHIVED` 並停止。
- `vite.config.ts` 保留舊架構參考，只有明確設定 `ALLOW_ARCHIVED_VINEXT_WEB=1` 才允許載入。

封存資料不得當成正式版本發布。
