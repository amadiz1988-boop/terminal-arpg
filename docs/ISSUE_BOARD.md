# Issue Board

本專案使用 Dashi Taskboard。狀態流程為 backlog → todo → in_progress → in_review → done。

2026-09-09 起主軸改為 rAthena Renewal 規則與 OpenKore-like 純掛機。PoE、火炬、T1 地圖、通貨、寶石與詞綴任務全部停止。

目前依賴順序：來源鎖版 → RO 資料轉換 → 格狀世界 → OpenKore AI → 戰鬥與掉落 → 補給與死亡 → 成長與轉職 → 朋友測試。

目前還原度：**34 / 100（34.0%）**。細項、證據與下一批工作見 `docs/RO_RESTORATION_PROGRESS.md`。Dashi Taskboard 服務無法連線期間，此檔與還原度追蹤檔為進度真實來源。

## 目前追蹤

| 狀態 | 工作 | 驗收 |
| --- | --- | --- |
| done | 鎖定 RO 資料來源 | rAthena Renewal 與 OpenKore 固定 commit 已記錄 |
| done | OpenKore 功能盤點 | `docs/OPENKORE_FEATURE_AUDIT.md` 已確認掛圖、跨圖、傳送、MVP、補給與社交功能 |
| done | RO產品鐵律 | `docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md` 已鎖定自動戰鬥與完整養成、UI、NPC服務邊界 |
| done | RO 第一個公開垂直切片 | 真實 `prt_fild08`、五種怪物共 271 隻、逐格尋路、逐擊交戰、掉落拾取、雙 EXP、小地圖及 OpenKore 終端共用單一狀態 |
| done | rAthena 怪物重生校準 | 原始生成範圍、固定延遲、8 次區域取點、中心與全圖回退均有來源核對及自動測試 |
| todo | 多人共享地圖權威 | 同圖玩家共用怪物、HP、掉落、重生及交戰歸屬 |
| todo | 單一 lockMap 與 MapRoute | 手動指定唯一掛圖；最短跨圖路線支援蝴蝶翅膀候選與無道具步行備援 |
| done | Fly Wing 找怪策略 | 17 格視野無怪時消耗蒼蠅翅膀；合法落點、傳點排除、暫停不消耗均有測試 |
| todo | MVP 政策 | MVP 預設迴避，勾選後才列為攻擊目標 |
| todo | rAthena 資料轉換器 | 從固定版本轉為型別化角色、怪物、物品、技能資料 |
| in_progress | OpenKore AI 佇列 | route、attack、items_take 已有可回放狀態；sitAuto、storageAuto 尚未完成 |
| in_progress | RO 即時戰鬥公式 | 命中、迴避、攻速、射程、普攻傷害、HP 與自然恢復已接入；SP 與狀態尚未完成 |
| in_progress | 掉落、負重與補給 | 逐件掉落、真實重量、拾取上限與 70%／90% 狀態已完成；倉庫補給尚未完成 |
| in_progress | 能力、技能與轉職 | Base／Job 升級、能力點、重置、技能點與初心者基本技能已接入；任務技能與轉職尚未完成 |
| in_progress | RO 公開版本 | R0.1 只使用程式化 UI、開源資料與 FLD2；官方美術素材未收錄，完整公開使用邊界仍待確認 |

每版自評、證據與下一步統一記錄於 `docs/DEVELOPMENT_REVIEW_LOG.md`。RO 新核心未完成前禁止沿用舊版分數或發布門檻結果。
