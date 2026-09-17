# External Ecosystem Reuse Audit

> 狀態：FULL_SCAN 完成。後續 D 工作線固定為 `INCREMENTAL_RESEARCH_ONLY`。
>
> 查核日：2026-09-14。最早建議刷新日：2026-12-14。
>
> production core modifications：0。
>
> 本 audit 是 gate 的研究輸入；實作前必須先有 `PRE_IMPLEMENTATION_REUSE_GATE = PASS`。
> Canonical gate spec：`docs/pre-implementation-reuse-gate.md`。

## 1. 執行摘要

本輪以 repository 現況、鎖定版本與上游 primary source 為準，掃描 50 個不重複證據來源，登錄 58 個候選。分級為 A 26、B 17、C 11、D 4。

1. rAthena 已有 17 組可沿用 native primitive。Persistent Agent 保留 ownership、execution epoch、policy 與 orchestration；底層遊戲操作直接呼叫 rAthena。
2. OpenKore 有 10 組成熟 behavior 可轉為需求規格與驗收案例。其 Perl 與 packet-bot 實作不直接移植進 server。
3. Hercules/HPM 證明 server-side autoattack、autotrade、storage/restock 與 lifecycle hook 可行；HPM plugin ABI 漂移及 GPL 邊界使其適合設計參考。
4. Generic OSS 可直接評估 Pino、OpenTelemetry JS、lru-cache、fast-check、Ajv、Cockatiel、Graphology、k6、Artillery、EventSource、p-retry 與 BehaviorTree.CPP。
5. 現有 ownership、execution epoch、Condition AST、precondition、patch provenance 保留。cache eviction、schema validation、structured telemetry、retry policy 與測試生成可採成熟元件。

| 評級 | 定義 |
|---|---|
| A | 值得直接評估 reuse |
| B | 值得採用 pattern 或受限 spike |
| C | 局部參考，暫不導入 |
| D | 拒絕使用 |

## 2. 查核基線與方法

- 本機 rAthena：[`e985006171d2eb320ee512a653f4c83aea3d81b6`](https://github.com/rathena/rathena/tree/e985006171d2eb320ee512a653f4c83aea3d81b6)，2026-08-21，GPL-3.0。
- 本機 OpenKore：[`51de1ddfc4449ae5217f6886de702f87ca934030`](https://github.com/OpenKore/openkore/tree/51de1ddfc4449ae5217f6886de702f87ca934030)，2026-08-09，project LICENSE 為 GPL-2.0。
- Repository 現況：Dashboard 使用 Node.js bare server；rAthena/MariaDB 為 authoritative state；Persistent Agent 已有 ownership、lifecycle、navigation、combat、loot、recovery、NPC、shop/storage、quest 與 rollout 設計。
- 候選活動時間以 GitHub API 最新 commit 或 forum 頁面可核對資訊記錄。
- Test coverage 百分比未逐一量測；缺少數值時標示「【資料不足，無法確認】」。
- Forum/showcase 未附明確 license 時，一律 `REFERENCE_ONLY` 或 `REJECT`。

## 3. 25 個模組的 Reuse Matrix

| # | 模組 | Native / 外部候選 | 判定 | 實作邊界 |
|---:|---|---|---|---|
| 1 | Persistent Character Lifecycle | rAthena timer/save/respawn + XState/Boost.SML pattern | KEEP_OURS | ownership 與 epoch 保留；動作落到 rAthena |
| 2 | Ownership / Session Control | rAthena session data | KEEP_OURS | unique owner、CAS、disconnect invalidation 保留 |
| 3 | Navigation | rAthena path/unit + OpenKore route pattern | ADOPT_PATTERN | cell movement reuse；跨圖與 stuck policy 採 pattern |
| 4 | Combat / Auto Attack | rAthena unit/skill/status + HPM proof | KEEP_OURS | server-authoritative intent 與 cooldown validation |
| 5 | Loot | rAthena inventory + OpenKore weight policy | ADOPT_PATTERN | 撿取與背包更新由核心處理 |
| 6 | Skill | rAthena skill/status | REUSE | Dashboard 不模擬 skill state |
| 7 | Recovery | rAthena item use/respawn + retry policy | ADOPT_PATTERN | action id、deadline、前置條件 |
| 8 | NPC / Dialog | rAthena NPC script + OpenKore TalkNPC | ADOPT_PATTERN | NPC 原始 state machine 為權威 |
| 9 | Quest Automation | rAthena quest + adapter + eventMacro pattern | KEEP_OURS | rAthena quest state 為權威 |
| 10 | Shop / Storage | rAthena shop/storage + OpenKore cycles | ADOPT_PATTERN | 原生交易 primitive 加流程 orchestration |
| 11 | Party | rAthena party | REUSE | 直接使用建立、邀請、分享 API |
| 12 | Friend | rAthena friend | REUSE | MariaDB/rAthena 為 source of truth |
| 13 | Guild | rAthena guild | REUSE | 直接使用公會 subsystem |
| 14 | Chat | rAthena chat/clif | REUSE | Web 只做 transport/projection |
| 15 | Autotrade / Offline Character | rAthena/Hercules offline vending | ADOPT_PATTERN | 只覆蓋商店；全角色 AI 由 Persistent Agent |
| 16 | Restart / Reconnect | rAthena save + OpenKore backoff | KEEP_OURS | reconnect 後 CAS reclaim 與 epoch 更新 |
| 17 | Timer / Callback Lifecycle | rAthena timer + AbortSignal pattern | KEEP_OURS | timer owner 與 stale callback rejection |
| 18 | Event Log | Pino + OpenTelemetry | REUSE | domain event schema 由本專案定義 |
| 19 | State Machine | Boost.SML/XState/BehaviorTree.CPP | ADOPT_PATTERN | 既有 FSM 保留；新孤立模組可 spike |
| 20 | Web Monitoring / SSE | native EventSource + Node client | REUSE | bounded buffer/backpressure 保留 |
| 21 | Projection Cache | lru-cache | REPLACE | 替換手寫 TTL/LRU；projection 可重建 |
| 22 | Load Test | k6 或 Artillery | REUSE | 測 SSE、API、viewer multiplexing |
| 23 | Social Graph | rAthena authority + Graphology | REUSE | Graphology 只做衍生分析 |
| 24 | AI / Utility Decision | BehaviorTree.CPP + GOAP/gdxAI | ADOPT_PATTERN | deterministic tick、可解釋、data-driven |
| 25 | Daily Journal / Event Summarization | domain events + projection | KEEP_OURS | 摘要可由 event log 重建 |

## 4. Native rAthena primitives

| Primitive | 判定 | 來源 | 建議 |
|---|---|---|---|
| rAthena player iterators | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/map.hpp) | 直接呼叫原生 iterator，加入 ownership filter。 |
| rAthena map iteration | NATIVE_PRIMITIVE_EXISTS | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/map.cpp) | 沿用 map_foreach 系列。 |
| rAthena cell pathfinding | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/path.cpp) | 沿用 path_search_long；跨地圖規劃另做薄封裝。 |
| rAthena unit movement and attack | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/unit.cpp) | Persistent Agent 只負責決策與 token 驗證。 |
| rAthena timer subsystem | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/timer.cpp) | 補 ownership 與 execution epoch。 |
| rAthena NPC dialog and script runtime | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/npc.cpp) | 任務 adapter 應調用正式 NPC primitive。 |
| rAthena party subsystem | NATIVE_PRIMITIVE_EXISTS | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/party.cpp) | 直接沿用。 |
| rAthena guild subsystem | NATIVE_PRIMITIVE_EXISTS | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/guild.cpp) | 直接沿用。 |
| rAthena friend subsystem | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | MariaDB/rAthena 為權威，Graphology 僅做分析。 |
| rAthena storage subsystem | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/storage.cpp) | 補前置條件與交易型流程。 |
| rAthena NPC shop subsystem | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/npc.cpp) | 買賣流程直接進原生 handler。 |
| rAthena autotrade vending primitive | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | 範圍限 vending/buying store，不等同離線戰鬥角色。 |
| rAthena character save pipeline | NATIVE_PRIMITIVE_EXISTS | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/chrif.cpp) | 所有 Agent 狀態橋接需遵循既有 save 邊界。 |
| rAthena respawn primitive | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | 恢復 policy 只選擇時機與目標。 |
| rAthena item-use primitive | NATIVE_PRIMITIVE_EXISTS | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | 禁止 Dashboard 模擬扣除。 |
| rAthena skill cast and status | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/skill.cpp) | Agent 送 intent，由核心驗證與結算。 |
| rAthena quest subsystem | WRAPPER_ONLY_NEEDED | [source](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/quest.cpp) | Quest Runtime adapter 保持 rAthena 權威。 |

邊界：

- `path_search_long` 與 unit movement 處理單圖 cell 導航；跨圖路線、傳送選擇與 stuck recovery 需要 wrapper。
- rAthena autotrade 覆蓋離線 vending/buying store；通用離線角色 AI scheduler 由 Persistent Agent 提供。
- ownership、command lifecycle、execution epoch 與 callback token 位於 native primitive 之上。

## 5. OpenKore 值得轉成規格的 behavior

| 項目 | 可借設計 | 轉換後規格 | 限制 |
|---|---|---|---|
| Plugin hooks | add/del/call hook lifecycle | callback 註冊、撤銷、owner、epoch | Perl callback 不進 map-server |
| AI queue | action 排隊與互斥 | typed action、precondition、deadline、cancel reason | 不使用全域隱式狀態 |
| eventMacro | condition/event/action | data-driven rule、AST、deterministic evaluation | 不執行任意文字命令 |
| reactOnNPC | NPC 文字/選項比對 | quest adapter dialog assertion | 文字不可作唯一識別 |
| Routing | portal、route、teleport、stuck | route segment、transition、timeout/replan | 不沿用 packet movement |
| storageAuto | 負重/格數觸發 | supply FSM、transaction steps、resume | UI 不覆蓋伺服器 state |
| buyAuto/sellAuto | min/max/batch/NPC steps | restock、price/zeny guard、idempotency | 不繞過 shop handler |
| Social auto | invite/share policy | consent、allowlist、cooldown、audit | 不直接寫社交 DB |
| Reconnect | backoff/jitter | bounded retry、jitter、CAS reclaim | 不重複建立 owner |
| Combat/Loot/Recovery | 條件矩陣 | authoritative precondition matrix | Dashboard 不成為 action authority |

來源：[AI](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm)、[config](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/control/config.txt)、[eventMacro](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/plugins/eventMacro/README.md)、[TalkNPC](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/TalkNPC.pm)、[reconnect](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/plugins/reconnect/reconnect.pl)。

## 6. RO ecosystem candidates

| Project / Plugin | License | Activity | Target / Language | Solves | Direct / Pattern | Maintenance / Tests | Security | Cost | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| [rAthena player iterators](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/map.hpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 線上玩家與 map_session_data 迭代 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena map iteration](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/map.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 地圖、範圍與區塊內實體迭代 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena cell pathfinding](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/path.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 單張地圖 cell path search | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena unit movement and attack](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/unit.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 走路、停止、攻擊與 unit timer | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena timer subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/timer.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 伺服器 tick、timer registration、cancel | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena NPC dialog and script runtime](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/npc.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | NPC click、dialog、script event | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena party subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/party.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 隊伍建立、邀請、分享與儲存 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena guild subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/guild.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 公會建立、邀請、成員與儲存 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena friend subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 好友清單、邀請與刪除 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena storage subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/storage.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 倉庫開啟、存入、取出與保存 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena NPC shop subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/npc.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | NPC 買賣與價格規則 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena autotrade vending primitive](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 離線露天商店與計時退出 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena character save pipeline](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/chrif.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 角色狀態持久化與 char-server save | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena respawn primitive](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 死亡重生、存點與重新進圖 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena item-use primitive](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 伺服器權威道具使用與扣除 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena skill cast and status](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/skill.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | 施法、技能結算與狀態變更 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [rAthena quest subsystem](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/quest.cpp) | GPL-3.0 | 2026-08-21 | rAthena map-server / C/C++ + NPC script | quest add/delete/status/update 與保存 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [OpenKore plugin hook API](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Plugins.pm) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 事件 hook 註冊、解除與 callback 擴充 | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore AI action queue](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 互斥 action queue、流程切換與前置條件 | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore eventMacro](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/plugins/eventMacro/README.md) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | data-driven 條件、事件與 macro dispatch | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore reactOnNPC](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/plugins/needs-review/reactOnNPC/trunk/reactOnNPC.pl) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 以 NPC 文字與選項觸發動作 | 否 / reference | 低 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | C / REFERENCE_ONLY |
| [OpenKore routing and map transition](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/Route.pm) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 跨地圖 route、portal、teleport 與 stuck recovery | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore storageAuto](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 負重與格數門檻觸發存倉流程 | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore buyAuto and sellAuto](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/control/config.txt) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 補貨、販售、批次與 NPC steps | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore party/friend/guild automation](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/control/config.txt) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 隊伍接受、分享與社交邀請 policy | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | C / ADOPT_PATTERN |
| [OpenKore reconnect backoff](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/plugins/reconnect/reconnect.pl) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | backoff、jitter、重連與反覆斷線降載 | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [OpenKore combat loot recovery configuration](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/control/config.txt) | GPL-2.0 (project LICENSE text) | 2026-08-09 | OpenKore runtime / Perl | 攻擊、撿取、回血、重量與排程互斥條件 | 否 / pattern | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | packet-bot authority 衝突 | MEDIUM | B / ADOPT_PATTERN |
| [Hercules Plugin Manager hooks](https://github.com/HerculesWS/Hercules) | GPL-3.0 | 2026-07-21 | Hercules map-server / C | server hook ABI 與 plugin lifecycle | 否 / pattern | 中 / coverage【資料不足，無法確認】 | ABI/API 漂移 | MEDIUM | B / ADOPT_PATTERN |
| [HPM @autoattack plugin](https://github.com/dastgirp/HPM-Plugins/blob/master/src/plugins/%40autoattack.c) | GPL-3.0 | 2023-02-24 | Hercules map-server / C | 伺服器端自動鎖敵、攻擊與漫遊 primitive 可行性 | 否 / reference | 低 / coverage【資料不足，無法確認】 | ABI/API 漂移 | HIGH | C / REFERENCE_ONLY |
| [HPM restock and storeit plugins](https://github.com/dastgirp/HPM-Plugins) | GPL-3.0 | 2023-02-24 | Hercules map-server / C | 補貨與存倉命令行為 | 否 / reference | 低 / coverage【資料不足，無法確認】 | ABI/API 漂移 | HIGH | C / REFERENCE_ONLY |
| [HPM script_mapquit plugin](https://github.com/dastgirp/HPM-Plugins) | GPL-3.0 | 2023-02-24 | Hercules map-server / C | 離圖/登出 script hook | 否 / reference | 低 / coverage【資料不足，無法確認】 | ABI/API 漂移 | HIGH | C / REFERENCE_ONLY |
| [Hercules autotrade primitive](https://github.com/HerculesWS/Hercules) | GPL-3.0 | 2026-07-21 | Hercules map-server / C | offline vending lifecycle 與 map quit persistence | 否 / pattern | 中 / coverage【資料不足，無法確認】 | ABI/API 漂移 | MEDIUM | B / ADOPT_PATTERN |
| [Hercules AFK dummy player forum plugin](https://board.herc.ws/threads/plugin-for-id-not-active-be-afk-player.11312/) | Unknown | historical | Community prototype / 【資料不足，無法確認】 | 以 dummy/autotrade 模擬離線玩家 | 否 | 低 / coverage【資料不足，無法確認】 | 授權不明，禁止抄碼 | PROHIBITIVE | D / REJECT |
| [eAthena historical source](https://github.com/eathena/eathena) | GPL-3.0 | 2014-12-20 | Historical RO emulator / C/C++ + NPC script | 歷史 lineage 與舊 packet/server patterns | 否 | 低 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | PROHIBITIVE | D / REJECT |
| [rAthena server-side autopilot forum release](https://rathena.org/board/topic/119137-server-side-ai-command-autopilot/) | Unknown | historical | Community prototype / 【資料不足，無法確認】 | server-side autopilot prototype | 否 | 低 / coverage【資料不足，無法確認】 | 授權不明，禁止抄碼 | HIGH | D / REJECT |
| [rAthena auto combat showcase](https://rathena.org/board/topic/148752-showcase-auto-combat-feature-%E2%80%94-rathena-automation/) | Unknown | 2026 | Community prototype / 【資料不足，無法確認】 | 近期 server-side automation UI 與行為展示 | 否 / reference | 中 / coverage【資料不足，無法確認】 | 授權不明，禁止抄碼 | MEDIUM | C / REFERENCE_ONLY |
| [rAthena AutoTrade2 release](https://rathena.org/board/topic/149428-release-offline-vending-system-autotrade2/) | Unknown | 2026 | Community prototype / 【資料不足，無法確認】 | NPC clone 型離線露天商店 | 否 / reference | 中 / coverage【資料不足，無法確認】 | 授權不明，禁止抄碼 | MEDIUM | C / REFERENCE_ONLY |

## 7. Generic infrastructure candidates

| Project | License | Activity | Target / Language | Solves | Direct / Pattern | Maintenance / Tests | Security | Cost | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| [XState](https://github.com/statelyai/xstate) | MIT | 2026-09-12 | Node/Web or game AI / TypeScript/JavaScript | statechart、actor、persisted snapshot 與 model-based test | 否 / pattern | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | MEDIUM | B / ADOPT_PATTERN |
| [Boost.SML](https://github.com/boost-ext/sml) | BSL-1.0 | 2026-08-09 | C++ runtime / C++ | header-only C++ compile-time FSM | 否 / pattern | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | MEDIUM | B / ADOPT_PATTERN |
| [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP) | MIT | 2026-08-31 | C++ runtime / C++ | async behavior tree、XML data-driven tree、logging/replay | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | MEDIUM | A / REUSE |
| [Taskflow](https://github.com/taskflow/taskflow) | MIT | 2026-09-14 | C++ runtime / C++ | C++ task graph 與 work-stealing executor | 否 / reference | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | HIGH | C / REFERENCE_ONLY |
| [C++ Actor Framework](https://github.com/actor-framework/actor-framework) | BSD-3-Clause | 2026-08-29 | C++ runtime / C++ | C++ actors、message passing、metrics、networking | 否 / reference | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | HIGH | C / REFERENCE_ONLY |
| [BullMQ](https://github.com/taskforcesh/bullmq) | MIT | 2026-09-14 | Node/Web or game AI / TypeScript | durable queue、retry、dedupe、flows | 否 / reference | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 新增分散式故障面 | HIGH | C / REFERENCE_ONLY |
| [Pino](https://github.com/pinojs/pino) | MIT | 2026-09-05 | Node/Web or game AI / JavaScript | 低負載結構化 JSON log、redaction、worker transport | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [OpenTelemetry JS](https://github.com/open-telemetry/opentelemetry-js) | Apache-2.0 | 2026-09-10 | Node/Web or game AI / TypeScript | trace、metric、log correlation 與 exporter 標準 | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | MEDIUM | A / REUSE |
| [lru-cache](https://github.com/isaacs/node-lru-cache) | BlueOak-1.0.0 | 2026-07-07 | Node/Web or game AI / JavaScript | bounded LRU、TTL、size cap、AbortSignal fetch | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [fast-check](https://github.com/dubzzz/fast-check) | MIT | 2026-09-13 | Node/Web or game AI / TypeScript | property/model-based testing、seed/path replay | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [Grafana k6](https://github.com/grafana/k6) | AGPL-3.0 | 2026-09-11 | External load-test / Go + JS scripts | HTTP、SSE/WebSocket load 與 threshold | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 只作外部工具 | LOW | A / REUSE |
| [Artillery](https://github.com/artilleryio/artillery) | MPL-2.0 | 2026-08-14 | External load-test / TypeScript/JavaScript | HTTP、WebSocket、Playwright load test | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | B / REUSE |
| [Graphology](https://github.com/graphology/graphology) | MIT | 2026-09-02 | Node/Web or game AI / JavaScript/TypeScript | JS graph structure、traversal 與 graph algorithms | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [Temporal](https://github.com/temporalio/temporal) | MIT | 2026-09-11 | Node/Web or game AI / Go server + SDKs | durable workflow、retry 與 replay | 否 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 新增分散式故障面 | PROHIBITIVE | D / REJECT |
| [Ajv](https://github.com/ajv-validator/ajv) | MIT | 2026-04-24 | Node/Web or game AI / TypeScript/JavaScript | JSON Schema validation 與 compiled validator | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [Cockatiel](https://github.com/connor4312/cockatiel) | MIT | 2026-09-06 | Node/Web or game AI / TypeScript | retry、timeout、circuit breaker、bulkhead、AbortSignal | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | A / REUSE |
| [RxJS](https://github.com/ReactiveX/rxjs) | Apache-2.0 | 2026-08-05 | Node/Web or game AI / TypeScript | observable stream、subscription cancellation、operators | 否 / reference | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | MEDIUM | C / REFERENCE_ONLY |
| [p-retry](https://github.com/sindresorhus/p-retry) | MIT | 2026-09-01 | Node/Web or game AI / JavaScript | 輕量 async retry、AbortSignal 與 backoff | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | B / REUSE |
| [EventSource](https://github.com/EventSource/eventsource) | MIT | 2026-09-08 | Node/Web or game AI / TypeScript/JavaScript | Node SSE client 與 reconnect handling | 是 | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | LOW | B / REUSE |
| [gdxAI](https://github.com/libgdx/gdx-ai) | Apache-2.0 | 2024-10-01 | Node/Web or game AI / Java | FSM、BT、A*、steering、message 與 scheduler | 否 / reference | 中 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | HIGH | B / REFERENCE_ONLY |
| [crashkonijn GOAP](https://github.com/crashkonijn/GOAP) | Apache-2.0 | 2026-03-06 | Node/Web or game AI / C# / Unity | data-driven GOAP、multi-thread planning、visualizer | 否 / reference | 高 / 有測試資產；coverage 數值【資料不足，無法確認】 | 導入前查 CVE/lockfile/release | HIGH | B / REFERENCE_ONLY |

## 8. 現有自製元件決策

| 元件 | 決策 | 外部對照 | 理由 |
|---|---|---|---|
| Condition AST | KEEP_OURS | Ajv、eventMacro | 保留 domain semantics；Ajv 驗 schema |
| Bounded roaming | KEEP_OURS | rAthena path/unit、OpenKore routing | primitive reuse；邊界與公平性 policy 保留 |
| Timer ownership | KEEP_OURS | rAthena timer、AbortSignal | owner/epoch 為 authoritative lifecycle invariant |
| Execution epoch | KEEP_OURS | actor/statechart pattern | 防 stale callback 與 reconnect replay |
| Projection cache | REPLACE | lru-cache | eviction、TTL、size cap 已成熟 |
| Viewer multiplexing | KEEP_OURS | EventSource、OTel | fanout/replay window 綁定 API contract |
| Precondition framework | KEEP_OURS | Ajv、Cockatiel | domain precondition 保留；輸入與 I/O policy reuse |
| Patch provenance | KEEP_OURS | Git metadata、OTel attributes | rollout/audit 欄位由本專案控制 |
| Rollout telemetry | ADOPT_PATTERN | Pino、OpenTelemetry | 採標準 trace/metric/log correlation |
| Quest step executor | KEEP_OURS | XState、eventMacro、fast-check | rAthena quest/NPC adapter 專屬 |

## 9. Life / Social 預研

1. 權威狀態：rAthena/MariaDB 的 player、party、guild、friend、quest。
2. 決策層：優先評估 BehaviorTree.CPP；GOAP 與 gdxAI 提供 action/precondition/world-state pattern。
3. 關係分析：Graphology 處理衍生 graph 與推薦，不承擔寫入權威。
4. 記憶層：structured domain events、bounded temporal aggregation、可重建 projection。
5. 執行層：Persistent Agent 保留 ownership、epoch、deterministic tick 與 server validation。

目前沒有單一候選同時滿足 RO server authority、deterministic recovery、social memory 與現有 C++/Node 架構，採組合式 primitive。

## 10. Do-not-use list

| 候選 | 判定 | 原因 |
|---|---|---|
| eAthena historical source | D / REJECT | 2014 後無有效維護，packet 與核心架構陳舊 |
| Hercules AFK dummy player forum plugin | D / REJECT | 授權不清、dummy shortcut、缺 recovery/test |
| rAthena server-side autopilot forum release | D / REJECT | 記錄 stuck 限制，授權不清 |
| Temporal cluster | D / REJECT | 引入獨立 workflow cluster，重複 ownership 基礎設施 |
| 未授權 forum snippets | REJECT | Unknown license，禁止抄 code |
| OpenKore packet-bot logic 直接入 map-server | REJECT | authority、lifecycle 與 timer 模型衝突 |
| HPM binary/plugin 直接載入 rAthena | REJECT | ABI 不相容且升級需重編譯 |
| Client optimistic inventory authority | REJECT | 會被 rAthena state 覆蓋並回彈 |
| unsafe raw SQL / GM shortcut | REJECT | 繞過 core invariant、audit、rollback |
| 無 restart/recovery/test 的 AI plugin | REJECT | 不符合 Persistent Agent 驗收 |

## 11. License notes

- rAthena GPL-3.0：既有 core 直接調用 native primitive，持續遵守 source/redistribution 義務。
- OpenKore GPL-2.0：code port 需相容性法律審查；本報告只抽取 behavior/specification。
- Hercules/HPM GPL-3.0：只借設計；plugin binary/code 不直接帶入 rAthena。
- AGPL-3.0 k6：獨立測試工具，不嵌入 production。
- MPL-2.0 Artillery：修改其檔案時遵守 file-level copyleft。
- Unknown：一律 `REFERENCE_ONLY` 或 `REJECT`；未取得 license 前禁止複製 code。

## 12. Top 20

1. rAthena path/unit：直接 reuse 尋路、移動與攻擊 primitive，用於 B。
2. rAthena timer：直接 reuse server tick/cancel，用於 A lifecycle。
3. rAthena NPC/quest：直接 reuse authoritative 對話與任務 state，用於 B。
4. rAthena storage/shop：直接 reuse 交易與保存，用於 B 補給。
5. rAthena party/guild/friend：直接 reuse 社交 authority，用於 Life/Social。
6. OpenKore storageAuto：port behavior spec，用於重量回城、存倉與 resume。
7. OpenKore routing：port route/stuck cases，用於 B navigation。
8. OpenKore eventMacro：reference condition/action pattern，用於 Quest Runtime。
9. OpenKore reconnect：port backoff/jitter，用於 A reconnect。
10. BehaviorTree.CPP：reuse 候選，用於 deterministic Life/Social。
11. Pino：reuse structured log，用於 A/C。
12. OpenTelemetry JS：reuse telemetry correlation，用於 rollout。
13. lru-cache：reuse bounded TTL/LRU，用於 C projection。
14. fast-check：reuse seed replay/model tests，用於 A/B/C。
15. Ajv：reuse schema validator，用於 API、quest、registry。
16. Cockatiel：reuse retry/timeout/circuit breaker，用於冪等 I/O。
17. k6：reuse load test，用於 SSE/API threshold。
18. Graphology：reuse graph algorithm，用於 social analysis。
19. XState：reference statechart/actor snapshot，用於 Web FSM。
20. Boost.SML：reference C++ FSM，用於新孤立 Agent module。

## 13. 十個不要自行重做

1. JSON Schema validation：採 Ajv，取得成熟 error、format 與 compiled validator。
2. LRU/TTL eviction：採 lru-cache，取得 bounded memory、size cap 與 cancellation。
3. Structured logging：採 Pino，降低 serialization/transport 成本。
4. Trace/metric propagation：採 OpenTelemetry pattern，統一跨層 correlation。
5. Property/model generator：採 fast-check，取得 seed/path replay 與 shrinking。
6. Retry/backoff/circuit breaker：採 Cockatiel 或 p-retry，集中 policy 與 AbortSignal。
7. HTTP/SSE/WebSocket load harness：採 k6 或 Artillery，建立可校準 threshold。
8. Social graph algorithms：採 Graphology，權威資料留在 rAthena/MariaDB。
9. Behavior tree runtime：先評估 BehaviorTree.CPP，取得 async node、XML、replay tooling。
10. rAthena 遊戲 primitive：直接調用 path/unit/timer/NPC/party/guild/friend/storage/shop/skill/quest。

## 14. 工作線對照

| 工作線 | 可受益項目 |
|---|---|
| A | rAthena timer/save、XState/Boost.SML pattern、Pino、OTel、Ajv、Cockatiel、fast-check |
| B | rAthena path/unit/NPC/quest/shop/storage、OpenKore behavior spec、HPM feasibility |
| C | EventSource、lru-cache、Pino、OTel、k6/Artillery、fast-check |
| Future-Life-Social | rAthena party/guild/friend、BehaviorTree.CPP、Graphology、GOAP/gdxAI、event projection |

## 15. Immediate recommendations

1. 將 native primitive inventory 納入 Persistent Agent implementation checklist。
2. 把 OpenKore storage/routing/NPC/reconnect behavior 轉為 acceptance tests。
3. C 工作線先評估 lru-cache、Pino、OTel、fast-check、k6/Artillery。
4. Life/Social 只做 BehaviorTree.CPP deterministic tick spike，驗證 save/reload/replay。
5. Dependency 導入前重新核對 commit、license、release、CVE、maintainer 與 lockfile。
6. Registry 為後續研究入口；新鮮條目直接 reuse prior research。

## 16. Research persistence policy

```text
需求出現
→ 查 ops/research/external-reuse-registry.json
→ 條目存在且新鮮
→ 直接 reuse prior research
→ 命中 refresh trigger 才執行 incremental online verification
```

| 類型 | Refresh |
|---|---|
| 穩定基礎工具 | 6 至 12 個月 |
| 活躍 OSS | 3 至 6 個月 |
| 準備導入 dependency | 立即 fresh verify |
| 已 REJECT 且原因仍成立 | 不重查 |

Refresh trigger：registry 缺少領域、候選過 freshness window、version/license/maintainer 改變、架構需求改變、準備導入、使用者明確要求刷新。

本次 `FULL_SCAN`；後續 `INCREMENTAL_RESEARCH_ONLY`；reusedPriorResearchCount 0；newlyDiscoveredCount 58。

## 17. Sources

- [rAthena](https://github.com/rathena/rathena)
- [rAthena map/path/unit/NPC](https://github.com/rathena/rathena/tree/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map)
- [OpenKore](https://github.com/OpenKore/openkore)
- [OpenKore AI](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm)
- [OpenKore config](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/control/config.txt)
- [OpenKore eventMacro](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/plugins/eventMacro/README.md)
- [OpenKore Plugins API](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Plugins.pm)
- [Hercules](https://github.com/HerculesWS/Hercules)
- [HPM Plugins](https://github.com/dastgirp/HPM-Plugins)
- [HPM @autoattack](https://github.com/dastgirp/HPM-Plugins/blob/master/src/plugins/%40autoattack.c)
- [HPM rebuild report](https://board.herc.ws/threads/error-hpmdatacheck-plugin-afk-and-autoattack.9393/)
- [eAthena](https://github.com/eathena/eathena)
- [XState](https://github.com/statelyai/xstate)
- [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP)
- [Boost.SML](https://github.com/boost-ext/sml)
- [C++ Actor Framework](https://github.com/actor-framework/actor-framework)
- [Pino](https://github.com/pinojs/pino)
- [OpenTelemetry JS](https://github.com/open-telemetry/opentelemetry-js)
- [lru-cache](https://github.com/isaacs/node-lru-cache)
- [fast-check](https://github.com/dubzzz/fast-check)
- [Ajv](https://github.com/ajv-validator/ajv)
- [Cockatiel](https://github.com/connor4312/cockatiel)
- [k6](https://github.com/grafana/k6)
- [Artillery](https://github.com/artilleryio/artillery)
- [Graphology](https://github.com/graphology/graphology)
- [gdxAI](https://github.com/libgdx/gdx-ai)
- [GOAP](https://github.com/crashkonijn/GOAP)

逐筆 evidenceLinks、commit、license、freshness 與決策位於 [external-reuse-registry.json](../ops/research/external-reuse-registry.json)。
