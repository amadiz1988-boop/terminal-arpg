# 官方客戶端資產整合進度

## 決策

2026-09-10 依使用者最新指示恢復官方素材開發，並確認素材具公開使用與發布授權。紙娃娃第一階段及 Default Skin 第一階段已接入多人控制介面。

## 授權資訊邊界

使用者於 2026-09-10 確認官方客戶端內容具公開使用與發布授權，並指定本機 `RagnarokOnline` 安裝目錄可供專案使用。後續開發不再重複請求授權確認，所有匯入檔案仍保存來源與 SHA-256。

## 已完成且可驗證

- 客戶端檔案全程唯讀，沒有修改安裝目錄。
- 已確認 `data.grf`、`data0.grf`、`event.grf` 可由 GrfCL 唯讀開啟。
- 目前台版客戶端的 `mp3nametable.txt` 將 `prontera.rsw` 指向 `BGM/55.mp3`。本專案依使用者指定的經典版情境鎖定登入 `BGM/01.mp3`、普隆德拉 `BGM/08.mp3`、`prt_fild08` 使用 `BGM/12.mp3`，避免所有畫面固定播放同一首。
- 已抽出男女初心者 ACT／SPR，產生兩張透明背景紙娃娃基底 PNG。
- 已定位並抽出男女各 42 種髮型 ACT／SPR，產生 84 張含頭部髮型的初心者站立紙娃娃；創角髮型欄與裝備頁會依角色 `hair` 即時選圖。
- 已抽出目前 DEMO 會用到的 42 種消耗品、材料、裝備與卡片 BMP 圖示，包含新生訓練裝備、學院帽、四種已驗收一轉贈品、弓箭手三種箭矢筒與卡普拉免費券。
- 已複製原廠關閉按鈕與勾選框三個 skin 元件作為 UI 對照。
- 已將 42 種 BMP 道具圖示固定轉為透明 PNG，並保存衍生檔 SHA-256。
- 已將男女初心者基底接到角色性別、職業、髮型代碼、髮色代碼與裝備欄。
- 裝備欄由 MariaDB `inventory.equip` 與 rAthena `equip_pos` 即時決定。
- 已完整匯入客戶端 `skin/default` 的 101 個 BMP，轉為透明 PNG 並保存衍生檔雜湊。
- 登入與註冊使用官方 `BGM/01.mp3`，普隆德拉使用 `BGM/08.mp3`，`prt_fild08` 使用 `BGM/12.mp3`。使用者的登入或頁面操作會啟動瀏覽器音訊，介面不顯示技術提示。
- 攻擊、受傷與擊倒已接入 `data.grf` 中的官方 WAV，並由新增的真實戰鬥事件觸發。
- 音樂、音效開關與各自音量寫入帳號偏好資料表；登入頁另保存本機預登入設定。
- 登入卡內的第二張 Ragnarok Logo 已移除，保留登入背景本身的標誌，避免重複構圖。
- 登入流程依官方操作順序保留世界選擇、帳號、密碼與確定；性別、名稱、髮型及髮色集中於角色建立畫面。參考：Gungho 官方新手流程與遊戲啟動說明。
- 音樂與音效開關改用本機 `skin/default/checkbox_0.png`、`checkbox_1.png`；顯示百分比維持不變，BGM 實際輸出增益降為原值的一半。
- `public/ro/client/manifest.json` 保存客戶端、三個 GRF 及每個輸出資產的 SHA-256。
- `scripts/import-ro-client-assets.mjs` 可由相同客戶端重建上述本機輸出。
- `scripts/dump-lua-constants.mjs` 可讀取標準 little-endian Lua 5.1 byte碼，供後續核對 `iteminfo.lub` 常數與資源名稱。

## 目前刻意未做

- 尚未完成全部地圖 BGM 映射。目前完成登入、普隆德拉與 `prt_fild08` 三個情境。
- 經典 BGM 編號、名稱與場景校正表已建立於 `docs/RO_CLASSIC_BGM_MAP.md`。夢羅克 11、吉芬 13、艾爾帕蘭 39、`prt_fild08` 12 已鎖定；71 已確認為朱諾原野 `Antique Cowboy`。
- 登入頁加入兩張使用者提供的 1024×768 RO 角色群像，每次頁面載入隨機選一張，該次登入期間不切換。素材已本機化並寫入 SHA-256，玩家瀏覽器不連線 Pinterest 或 Google 圖片服務。
- 使用者提供的第三張 Logo 圖不含 Alpha，灰白棋盤格已寫進像素；本版保存為參考素材，畫面繼續使用已裁切驗證的 `ragnarok-title-reference.png`，避免顯示假透明背景。
- `prt_fild08` 的 40 筆掉落、卡片、背包、裝備欄及劍士、服事、魔法師、弓箭手四種已驗收轉職贈品均已接入透明 PNG；其餘未公開地圖與物品仍待逐批對照。
- 髮型已完成站立方向合成；髮色 Palette、長髮前後層、頭飾、武器、盾牌與披肩的原廠分層順序仍待完成。
- 尚未從 GRF 抽出戰鬥、掉落、升級與 UI 音效。

## 日後恢復時的固定接點

1. 先確認授權範圍包含版本控制、測試站與公開散布。
2. 以 `public/ro/client/manifest.json` 校驗來源版本，版本不同時重新產生整份清單。
3. 由 `game/ro/content/client-assets.ts` 提供唯一資產路徑，遊戲元件不直接硬編客戶端檔名。
4. 紙娃娃採身體、髮型、頭飾、武器、盾牌、披肩的分層模型，角色資料只保存外觀代碼。
5. 道具圖示以 AegisName 作為穩定鍵；繁中名稱先由 OpenKore `tables/twRO/items.txt` 依 item ID 提供，並以官方客戶端 `System/iteminfo_new.lub` 交叉核對，資料庫名稱只作缺件備援。
6. BGM 由地圖資料指定資源鍵，播放器負責靜音、音量、切圖與瀏覽器自動播放限制。
7. 通過資產完整性、透明背景、手機顯示、載入大小與授權清單檢查後，才可接入 DEMO。

## 登入與創角介面依據

- Gungho 官方操作順序：啟動客戶端後先選擇世界，再進入帳號流程。
- Gungho 官方角色建立步驟：玩家在角色建立階段選擇名稱、性別、髮型及髮色。
- 本專案實作：首次帳號建立不再決定角色性別；建立第一個角色時由同一建立請求更新 rAthena `login.sex` 與 `char.sex`，現有角色不受影響。
- 玩家介面只能提交 `M` 或 `F` 的型別化欄位；伺服器再次收斂為兩個有效值。

髮型 ACT／SPR 經 GrfCL 輸出站立方向 GIF 後，可用下列指令重建紙娃娃與 manifest：

```powershell
$env:RO_HAIR_GIF_DIR = '<含 male 與 female 子目錄的髮型 GIF 路徑>'
npm run assets:paperdolls
```

## 恢復指令

```powershell
$env:RO_CLIENT_DIR = 'C:\Program Files (x86)\Gravity\RagnarokOnline'
$env:GRFCL_EXE = '<GrfCL.exe 的本機路徑>'
node scripts/import-ro-client-assets.mjs
```

GrfCL 不納入專案儲存庫。官方客戶端原始 GRF 也不複製進專案。
