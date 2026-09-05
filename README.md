# Terminal ARPG

Terminal ARPG 是一款以 Build、刷圖策略與即時戰鬥終端為核心的文字放置 ARPG。

## Alpha 0.1

- 三種角色 Build
- 全圖掃蕩、首領突襲、通貨獵人三種 Run Policy
- 可調整離場探索率
- 即時移動、掃描、施法、暴擊、掉落與首領紀錄
- 擊殺、探索、掉落及首領狀態統計
- 桌機與手機響應式介面

## 開發

```bash
npm install
npm run dev
```

## 驗證

```bash
npm run build
```

目前版本用於驗證核心循環：Build → Run Policy → 自動刷圖 → Loot → 效率比較。
