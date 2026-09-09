# Issue Board

本專案使用 Dashi Taskboard。狀態流程為 backlog → todo → in_progress → in_review → done。

2026-09-09 起主軸改為 rAthena Renewal 規則與 OpenKore-like 純掛機。PoE、火炬、T1 地圖、通貨、寶石與詞綴任務全部停止。

目前依賴順序：來源鎖版 → RO 資料轉換 → 格狀世界 → OpenKore AI → 戰鬥與掉落 → 補給與死亡 → 成長與轉職 → 朋友測試。

## 目前追蹤

| 狀態 | 工作 | 驗收 |
| --- | --- | --- |
| done | 鎖定 RO 資料來源 | rAthena Renewal 與 OpenKore 固定 commit 已記錄 |
| done | OpenKore 功能盤點 | `docs/OPENKORE_FEATURE_AUDIT.md` 已確認掛圖、跨圖、傳送、MVP、補給與社交功能 |
| done | RO產品鐵律 | `docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md` 已鎖定自動戰鬥與完整養成、UI、NPC服務邊界 |
| in_progress | RO 最小垂直切片 | 無介面世界循環已完成逐格找怪、普攻、受傷、死亡、掉落、拾取與暫停續跑；下一步為怪物移動與前端可視化 |
| todo | 多人共享地圖權威 | 同圖玩家共用怪物、HP、掉落、重生及交戰歸屬 |
| todo | 單一 lockMap 與 MapRoute | 手動指定唯一掛圖；最短跨圖路線支援蝴蝶翅膀候選與無道具步行備援 |
| todo | Fly Wing 與 MVP 政策 | 無怪找怪傳送；MVP預設迴避，勾選後才列為攻擊目標 |
| todo | rAthena 資料轉換器 | 從固定版本轉為型別化角色、怪物、物品、技能資料 |
| in_progress | OpenKore AI 佇列 | route、attack、items_take 已有可回放狀態；sitAuto、storageAuto 尚未完成 |
| in_progress | RO 即時戰鬥公式 | 命中、迴避、攻速、射程、普攻傷害、HP 與自然恢復已接入；SP 與狀態尚未完成 |
| todo | 掉落、負重與補給 | 逐件掉落、拾取權重、負重限制、消耗品與倉庫流程 |
| todo | 能力、技能與轉職 | Base EXP、能力點、技能點與職業進程皆依鎖定來源 |
| blocked | RO 公開版本 | 原名、劇情、地圖與素材的公開使用邊界尚未確認 |

每版自評、證據與下一步統一記錄於 `docs/DEVELOPMENT_REVIEW_LOG.md`。RO 新核心未完成前禁止沿用舊版分數或發布門檻結果。
