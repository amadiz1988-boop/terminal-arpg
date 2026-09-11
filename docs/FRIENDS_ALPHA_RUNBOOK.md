# Friends Alpha 多人測試手冊

## 啟動

1. 在主機雙擊 `start-friends-alpha.cmd`。
2. 等待視窗顯示 `Friends Alpha is ready` 與 `https://...trycloudflare.com`。
3. 主機保持開機、連線與喚醒狀態。
4. 將該 HTTPS 網址傳給測試玩家。

啟動腳本同時啟用 15 秒本機 watchdog。Dashboard 或 Quick Tunnel 程序中斷時會自動重啟；若 Tunnel 重建，新的臨時網址會寫入 `.local/ro-stack/dashboard/tunnel-state.json`。

## 玩家流程

1. 第一次輸入未使用的帳號與密碼，系統會直接建立測試帳號。
2. 再次使用相同帳密即可登入。
3. 建立角色後按「開始掛機」。
4. 關閉或切換網頁後，該角色的 OpenKore 程序仍會在主機持續運行。
5. 網頁服務重新啟動時，系統會依照資料庫中的掛機狀態自動恢復角色程序。

網頁密碼使用 scrypt 獨立雜湊保存。rAthena 與 OpenKore 使用系統產生的內部密碼，玩家密碼不會寫入 OpenKore 設定。Alpha 階段仍建議使用專用測試密碼。

## 測試期間檢查

- 本機入口：`http://127.0.0.1:8788/`
- 同一區域網路入口：`http://192.168.31.73:8788/`
- 健康檢查：`health-local-ro.cmd`
- 多人驗證：`npm run test:multiplayer`

通過標準：資料庫、登入、角色與地圖服務均正常；每個角色能上線、移動、攻擊、擊殺、取得 Base EXP、Job EXP 與掉落；停止單一角色不影響其他角色。

## 停止

測試結束後雙擊 `stop-local-playable.cmd`。此操作會停止公開通道、網頁服務、所有 OpenKore 玩家程序及本機 rAthena 服務。

## 已知限制

- `trycloudflare.com` 為臨時網址，每次重新啟動可能改變。
- 主機休眠、關機或斷網時，朋友無法連線。
- Windows 登入後仍需啟動本機遊戲服務；服務完成啟動後會自動恢復先前仍在掛機的角色。
- 正式百人測試仍需固定網域、TLS、備份、監控與程序監督服務。
