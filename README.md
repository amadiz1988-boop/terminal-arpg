# Terminal ARPG

以 Build 規劃、自動刷圖、打寶成長與戰鬥終端為核心的文字放置 ARPG。

## Alpha 0.5

- 從等級 1、磨損武器與單一技能開始
- 六段短篇行動逐步解鎖裝備、技能、材料與 T1 地圖
- Build 藍圖顯示目前進度與下一個目標
- 按張數、時間或地圖耗盡持續刷圖
- 玩家指定 T1 至 T5 的固定階級連刷與跨 Tier 地圖掉落
- 失落軍械庫、餘燼熔爐、頂峰追獵三種刷圖產業
- 每四次成功取得一次 Build 感知的戰利品三選一或製裝材料結算
- Build 感知裝備排序，顯示 DPS、清圖或生存差異
- 關閉、普通與智慧三種自動分解設定
- 分解材料可校準裝備詞綴
- 瀏覽器本機永久存檔
- 固定 seed 的可重播遊戲核心

## 架構

遊戲資料、Modifier、物品、進度與地圖模擬位於 `game/`。React 介面負責編排玩家操作與呈現領域結果。

* [架構規則](docs/ARCHITECTURE.md)
* [PoE 與火炬玩家循環研究](docs/ARPG_PLAYER_LOOP_RESEARCH.md)
* [核心公式與內容架構](docs/CORE_FORMULA_ARCHITECTURE.md)
* [Alpha 0.5 實玩驗收](docs/PLAYTEST_ALPHA_0.5.md)

## 開發與驗證

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

公開版本需完成三種停止模式、換裝、技能重評分、自動分解、材料消耗、存檔重載與手機版回歸。
