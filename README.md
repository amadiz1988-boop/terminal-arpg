# 鬼島傳說

以 rAthena Renewal 資料與 OpenKore 自動化邏輯為基準的 RO 純掛機遊戲。角色的移動與戰鬥由自動化代理執行，玩家負責人物養成、裝備、道具、技能、轉職與策略設定。

## RO Core R0.3

玩家介面只保留「停止掛機／繼續掛機」。四倍測試與重新開始屬於開發驗證工具，玩家端不顯示，也不改變正常遊戲時間。

- 直接讀取 OpenKore `prt_fild08` 400×400 FLD2 地圖。
- 依 rAthena 六組生成資料建立 87 隻 Poring。
- 初心者會逐格尋路、鎖定目標、普通攻擊、承受反擊、死亡結算、逐件掉落及拾取。
- Base EXP 與 Job EXP 分開累積。
- 戰鬥終端只呈現模擬狀態實際產生的 OpenKore-like 事件。
- 小地圖上的角色位置、怪物位置及交戰標記與戰鬥共用同一份狀態。
- 停止掛機後狀態不再前進，繼續時從原位置恢復。
- Basic Information、Status、Equipment、Item 採 RO 客戶端既有資訊結構。

## 固定資料版本

- rAthena Renewal: `e985006171d2eb320ee512a653f4c83aea3d81b6`
- OpenKore: `51de1ddfc4449ae5217f6886de702f87ca934030`

未能由固定來源證明的公式、物品、技能與功能不得進入正式模擬。

## 尚未完成

- Poring 漫遊、追擊與玩家死亡復原
- Base/Job 等級曲線、能力點及技能點
- 裝備換裝、負重上限及消耗品手動操作
- Fly Wing 找怪、Butterfly Wing 回城、跨圖 MapRoute
- 城鎮、Kafra、倉庫、商店、精煉及轉職 NPC
- 多人共享地圖與聊天

## 開發與驗證

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm run test:release
```

規格與來源：

- [產品鐵律](docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md)
- [OpenKore 功能盤點](docs/OPENKORE_FEATURE_AUDIT.md)
- [來源政策](docs/DESIGN_SOURCE_POLICY.md)
- [Issue Board](docs/ISSUE_BOARD.md)
- [版本檢討](docs/DEVELOPMENT_REVIEW_LOG.md)
