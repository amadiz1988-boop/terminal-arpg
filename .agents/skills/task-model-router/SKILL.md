---
name: task-model-router
description: 在 terminal-arpg 開始 substantial Repository 工作前，依複雜度、風險、範圍與既有進度建議模型、推理強度及速度。小型 typo 可略過。
---

# Task Model Router

在每個新的 substantial Repository 任務施工前執行一次判斷。先輸出：

```text
【模型建議】<模型> / <推理強度> / <速度>
理由：<最多一句>
```

輸出後立即繼續工作。此 Skill 只提供建議，不得阻塞任務、改變 scope 或宣稱已切換模型。單純 typo 等極小修改可省略提醒。

## 路由順序

1. 先檢查 Astra 閘門，再檢查 Sol High 條件；其餘使用預設值。
2. 根因已確認且只剩明確 patch 時，即使前輪使用 High 或 Astra，也提醒可降回 Sol Medium。
3. 最後依速度規則決定 `1x` 或 `1.5x`。模型升級不得擴大任務範圍。

## 預設：GPT-5.6 Sol / Medium / 1x

適用於明確 scope 的單一功能、Production PR 或 Phase、一般 TypeScript／JavaScript、Markdown／Roadmap、Regression、一般 API、已知架構上的功能搬移，以及已有前置架構的 Loot、Skill、Survival、NPC、Service 工作。

Persistent Server Agent Roadmap 的一般 Production PR，以及 Eden 的資料 mapping／UI，均使用此預設。100+ entity benchmark 仍使用 Sol Medium／1x。

## GPT-5.6 Sol / High / 1x

符合任一項即升級：

- rAthena C++ lifecycle、`map_session_data` lifetime、use-after-free、stale callback／timer 或核心 crash。
- restart recovery、race condition、atomic CAS、ownership、memory safety、多執行緒或 concurrency。
- 跨三個以上核心模組的 state machine。
- 正式 Quest chain，或 Quest、Navigation、NPC、Restart 同時交互。
- 高風險 Production migration。
- 難以重現的核心 bug，或同一核心問題經兩次普通修正仍失敗。
- Persistent Server Agent 的 ownership、restart、lifecycle、crash 或 quest-navigation binding。
- Eden 多個正式 Quest ID 與 NPC、Navigation、restart runtime 的整合。

典型案例包含 GO_MAP restart crash、`chrif.cpp` lifecycle crash、OpenKore 與 SERVER_AGENT ownership collision、Eden Course A 7128 至 7132 正式 runtime、persistent agent restart／recovery。

## GPT-6 Astra / High / 1x

僅在符合任一閘門時建議 Astra：

1. 同一核心問題已由 Sol High 連續兩輪處理，仍無法解決。
2. 需要重新推導核心 architecture。
3. 多個子系統證據互相矛盾，Sol 無法定位。
4. Production 上線前的重大 architecture、safety 或 security review。
5. 嚴重 concurrency、memory corruption 或 distributed lifecycle 問題。
6. 高度陌生且需要大規模跨來源研究的核心技術決策。

不得只以 Astra 能力較強作為理由。優先控制 Work／Codex allowance、context 大小、runtime 時間與工具呼叫數量。

## 速度

預設 `1x`。只有 scope 非常小、不需長時間 runtime、不需大量 compiler／test，且使用者明確重視完成速度時，才建議 `1.5x`。

長時間 compile、runtime integration test、restart test、Agent 壓測、100+ entity benchmark、大型 Repository research 與 Astra 任務固定使用 `1x`。

## 升降級

- Medium 發現 lifecycle、race、memory safety、concurrency、跨三個以上核心模組，或兩次普通修正失敗時，升至 Sol High。
- Sol High 只有在同一核心問題連續兩輪失敗或符合 Astra 閘門時，升至 Astra。
- High 或 Astra 已確認根因，後續只剩明確實作時，主動建議降回 Sol Medium。

每次判斷同時考慮能力需求、allowance、context、runtime 與工具呼叫數量。更高模型不作為預設。
