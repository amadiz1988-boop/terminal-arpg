# Terminal ARPG

以 Build 規劃、自動刷圖、打寶成長與戰鬥終端為核心的文字放置 ARPG。

## Alpha 0.2

- 從等級 1、磨損武器與單一技能開始
- 六段短篇行動逐步解鎖裝備、技能、材料與 T1 地圖
- Build 藍圖顯示目前進度與下一個目標
- 按張數、時間或地圖耗盡持續刷圖
- T1 至 T5 地圖庫存與跨 Tier 掉落
- Build 感知裝備排序，顯示 DPS、清圖或生存差異
- 關閉、普通與智慧三種自動分解設定
- 分解材料可校準裝備詞綴
- 瀏覽器本機永久存檔
- 固定 seed 的可重播遊戲核心

## 架構

遊戲資料、Modifier、物品、進度與地圖模擬位於 `game/`。React 介面負責編排玩家操作與呈現領域結果。詳細規則見 `docs/ARCHITECTURE.md`。

## 開發與驗證

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

公開版本需完成三種停止模式、換裝、技能重評分、自動分解、材料消耗、存檔重載與手機版回歸。
