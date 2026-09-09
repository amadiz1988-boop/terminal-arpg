# Issue Board

本專案使用 Dashi Taskboard。狀態流程為 backlog → todo → in_progress → in_review → done。

2026-09-09 起主軸改為 rAthena Renewal 規則與 OpenKore-like 純掛機。PoE、火炬、T1 地圖、通貨、寶石與詞綴任務全部停止。

目前依賴順序：來源鎖版 → RO 資料轉換 → 格狀世界 → OpenKore AI → 戰鬥與掉落 → 補給與死亡 → 成長與轉職 → 朋友測試。

## 目前追蹤

| 狀態 | 工作 | 驗收 |
| --- | --- | --- |
| done | 鎖定 RO 資料來源 | rAthena Renewal 與 OpenKore 固定 commit 已記錄 |
| in_progress | RO 最小垂直切片 | 初心者在格狀地圖逐格找怪、普攻、受傷、死亡、掉落、拾取 |
| todo | rAthena 資料轉換器 | 從固定版本轉為型別化角色、怪物、物品、技能資料 |
| todo | OpenKore AI 佇列 | route、attack、items_take、sitAuto、storageAuto 可觀測且可暫停 |
| todo | RO 即時戰鬥公式 | 命中、迴避、攻速、射程、傷害、HP、SP 與狀態使用同一引擎 |
| todo | 掉落、負重與補給 | 逐件掉落、拾取權重、負重限制、消耗品與倉庫流程 |
| todo | 能力、技能與轉職 | Base EXP、能力點、技能點與職業進程皆依鎖定來源 |
| blocked | RO 公開版本 | 原名、劇情、地圖與素材的公開使用邊界尚未確認 |

每版自評、證據與下一步統一記錄於 `docs/DEVELOPMENT_REVIEW_LOG.md`。RO 新核心未完成前禁止沿用舊版分數或發布門檻結果。
