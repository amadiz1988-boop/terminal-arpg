# Issue Board

本專案使用 Dashi Taskboard。狀態流程為 backlog → todo → in_progress → in_review → done。

目前依賴順序：穩定核心架構 → Modifier Engine → Build 感知裝備評分 → 自動分解與材料 → 永久角色 → 朋友帳號 → Alpha 發布。

起始流程為選職後直接進入無限 T1，Build 由隨機取得的裝備、底材、技能與通貨形成。任何發布任務都必須通過 `docs/ROADMAP.md` 的遊玩閘門與 `docs/ARCHITECTURE.md` 的架構閘門。

## 目前追蹤

| 狀態 | 工作 | 驗收 |
| --- | --- | --- |
| in_review | Alpha 0.21 怪群真實追擊與獨立攻擊 | 怪點實際位移、多人近身傷害、紅色攻擊訊號、完整發布門檻 |
| todo | T1 實際怪物原型與技能資料 | 每種怪物綁定 PoEDB 條目、攻擊時間、技能與冷卻 |
| todo | 裝備掉落決策密度 | 每張圖至少出現一次查看、換裝、保留或打造決策 |
| todo | 多步驟打造策略 | 底材、詞綴層級與通貨操作形成可選路徑 |
| todo | 流派改造效果 | 傳奇或特殊機制實際改變技能玩法 |

每版自評、證據與下一步統一記錄於 `docs/DEVELOPMENT_REVIEW_LOG.md`。綜合未達 7.0/10 時維持「持續開發」。
