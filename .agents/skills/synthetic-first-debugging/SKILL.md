---
name: synthetic-first-debugging
description: 在 terminal-arpg 針對 Player Web、Controller、PA、Native 與 rAthena 跨層 runtime/control-flow 問題，先用 diagnostic、Action Trace 與 Synthetic Player Scenario 定位 FIRST_BROKEN_TRANSITION，再進行最小修正與分層驗收。
---

# SYNTHETIC_FIRST_DEBUGGING_GATE_V1

本 Skill 定義 Worker 的執行方式。治理硬閘與適用範圍由
`AGENTS.md`、`docs/project-control/project-control-response-protocol.md`、
`WORKLINE_DISPATCH_TEMPLATE_V1` 與 `WORKLINE_CONTINUATION_TEMPLATE_V1`
授權。本 Skill 不建立第二套 debugging workflow。

## 1. 適用範圍

當問題涉及下列任一跨層鏈路時，先啟用本 Skill：

```text
Player Web
Dashboard API
Auth / Ownership
Controller / Command Dispatch
Native / Persistent Agent
rAthena authority
Event Ledger
State reconciliation
```

先回報：

```text
SYNTHETIC_FIRST_TRIGGERED = YES
```

以下工作可標記 `SYNTHETIC_FIRST_TRIGGERED = N/A`：純文件、純設計討論、
純 CSS／layout、asset review、static content、reference research，以及不涉及
runtime／control-flow 的治理維護。

純 Browser／presentation defect 可以 Browser-first，例如 DOM 隱藏、CSS
overflow、click target 被遮蔽、browser-only JavaScript exception、cache／asset
version 問題。此時仍須記錄 Browser 為疑似 `FIRST_BROKEN_TRANSITION` domain。

## 2. Canonical 執行順序

完整順序固定為：

```text
LAST_GOOD / CURRENT
→ WEB_DIAGNOSTIC / RUNTIME_HEALTH
→ ACTION_TRACE
→ SYNTHETIC_SCENARIO
→ FIRST_BROKEN_TRANSITION
→ OWNER
→ MINIMAL_FIX
→ BOUNDED_TEST
→ SYNTHETIC_REGRESSION
→ CLEAN_CHECKPOINT
→ SUPERSET / PROVENANCE
→ CONTROLLED_DEPLOY
→ SYNTHETIC_LIVE_ACCEPTANCE
→ BROWSER_FINAL_ACCEPTANCE
```

高層原則為：

```text
DIAGNOSTIC FIRST
→ TRACE FIRST
→ SYNTHETIC FIRST
→ FIRST_BROKEN_TRANSITION
→ MINIMAL FIX
→ SYNTHETIC REGRESSION
→ BROWSER LAST
```

Worker 不得以反覆手動點擊 Browser 取代前段證據。Browser 用於 UI wiring、
DOM／CSS、browser-specific 行為與最後的真實 Player Web acceptance。

## 3. Phase 0：路由與安全前置

開始前讀取：

```text
AGENTS.md
WORKSPACE_INDEX.md
docs/project-control/project-control-response-protocol.md
docs/project-control/workline-dispatch-template.md
docs/project-control/workline-continuation-template.md
docs/player-scenario-harness.md
docs/player-action-trace-foundation.md
```

確認目前 `ACTIVE_WORKTREE`、branch、HEAD、canonical runtime 與合法測試狀態。
大型或跨層測試依 `.agents/skills/nearest-valid-test-state/SKILL.md`，從
`NEAREST LEGAL REPRODUCIBLE STATE` 開始，不做不必要 reset。

保留既有 gates：

```text
Quest → RATHENA_REFERENCE_ATLAS → QUEST_FLOW_FIRST → OPENKORE_REFERENCE_ATLAS
       → OPENKORE_REFERENCE_GATE → PROJECT_LAST_GOOD → CURRENT_MAPPING

Runtime → Single Runtime Policy
        → OpenKore runtime count = 0
        → canonical rAthena / Dashboard / MariaDB only
```

Synthetic Scenario 只能重現與觀察合法行為，不創造 Quest semantics、world
facts、item authority 或 fake success。

## 4. Phase 1：LAST_GOOD / CURRENT

先固定：

```text
LAST_GOOD =
CURRENT =
EXPECTED =
ACTUAL =
```

辨識目前真實 failure、是否為 regression、是否已存在 deterministic fixture，
以及測試是否會觸發 mutation。不要從錯誤 UI 文案推導 Native failure。

## 5. Phase 2：Diagnostic / Runtime Health

先收集既有可觀測證據：

```text
DIAGNOSTIC_SOURCE =
RUNTIME_HEALTH =
AUTH_STATE =
OWNERSHIP_STATE =
CONTROLLER_STATE =
RECENT_ERROR =
DATA_FRESHNESS =
VERSION / PROVENANCE =
```

Admin Diagnostic Center 可用時優先讀取其 runtime health、function matrix、
recent errors、Action Trace、performance、DB pool、route feasibility、data
freshness、version/provenance 與 known gaps。Diagnostic report 是 evidence，
不具 execution authority。

## 6. Phase 3：Action Trace

確認 `ACTION_TRACE` 是否包含：

```text
actionKey
actionLabel
traceId
character
result
errorCode
failureLayer
FIRST_BROKEN_TRANSITION
timeline
```

目標鏈為：

```text
Browser → API → Auth → Ownership → Controller → Command
→ Native → PA → rAthena → Event Ledger → Reconcile
```

目前 scenario foundation 會明確標示：

```text
TRACE_PROPAGATION_GAP = PRESENT
```

這表示 correlation 尚未跨入所有 command／ledger layer。不得自行補造下游
PASS，也不得把 `NO_EVIDENCE` 轉成 success。

## 7. Phase 4：Synthetic Scenario

唯一入口：

```text
scripts/player-scenario-runner.mjs
```

CLI 參數已由現有 runner `--help` 確認：

```text
--scenario <name>
--matrix
--source <map>
--target <map>
--char <id>
--item-id <id>
--timeout <ms>
--origin <url>
--username <name>
--credentials <path>
--runtime-root <path>
--json
--execute
```

預設為 dry-run／blocked-safe path。需要 gameplay mutation 或 live observation
時，明確使用 `--execute`。以下 scenario 名稱是目前已存在且可使用的 V1
集合：

```text
start-farm
stop-farm
change-farm-map
use-fly-wing
use-butterfly-wing
supply-return
combat-cycle
```

已確認的命令形狀如下，placeholder 需替換為合法現況資料：

```text
node scripts/player-scenario-runner.mjs --matrix --source <map> --json

node scripts/player-scenario-runner.mjs --scenario start-farm --char <id> --username <name> --execute --json
node scripts/player-scenario-runner.mjs --scenario stop-farm --char <id> --username <name> --execute --json
node scripts/player-scenario-runner.mjs --scenario change-farm-map --source <map> --target <map> --char <id> --username <name> --execute --json
node scripts/player-scenario-runner.mjs --scenario use-fly-wing --char <id> --username <name> --execute --json
node scripts/player-scenario-runner.mjs --scenario use-butterfly-wing --char <id> --username <name> --execute --json
node scripts/player-scenario-runner.mjs --scenario supply-return --char <id> --username <name> --execute --json
node scripts/player-scenario-runner.mjs --scenario combat-cycle --char <id> --username <name> --execute --json
```

必要時才加入 `--item-id <id>`、`--timeout <ms>`、`--origin <url>`、
`--credentials <path>` 或 `--runtime-root <path>`。不得猜測新的 scenario、
endpoint 或 CLI option；先重新執行 runner `--help` 並讀實作。

## 8. Scenario 成功判定

HTTP response 只證明該 layer 的 response。完整結果必須由 authoritative state、
Event Ledger 或合法 bounded observation 收斂：

```text
HTTP 200 != PASS
SOURCE_PASS != PRODUCTION_PASS
NO_EVIDENCE != PASS
STALE_EVIDENCE != CURRENT_PASS
```

最低判定：

```text
START_FARM
HTTP accepted + PA mode != AUTO_FARM → FAIL

CHANGE_FARM_MAP
request accepted + arrival not observed → FAIL

FLY_WING / BUTTERFLY_WING
request accepted + authoritative position unchanged → FAIL

SUPPLY_RETURN
returned to map + AUTO_FARM/combat did not resume → FAIL

COMBAT
MONSTER_ATTACK without MONSTER_HIT → damage UNCONFIRMED
```

`combat-cycle` 必須觀察 `MONSTER_TARGET`、`MONSTER_ATTACK`、`MONSTER_HIT`、
`MONSTER_KILL`、`LOOT_ACQUIRED`。`supply-return` 必須依現有 contract 觀察
`SUPPLY_LOW`、`MAP_CHANGED`、`SUPPLY_RETURN` 與 combat resume；若合法前置狀態
不存在，結果為 `BLOCKED`，不可宣稱 gameplay failure。

## 9. FIRST_BROKEN_TRANSITION 與 Owner

依 trace layer 順序，只取第一個 `FAIL`、`TIMEOUT` 或 `BLOCKED`。典型邊界：

```text
Browser → API
API → Auth
Auth → Ownership
Ownership → Controller
Controller Precheck → Command Creation
Command Dispatch → Native Receive
Native Receive → Native Accept
Native Accept → PA State
PA State → rAthena Authority
Authority → Event Ledger
Event Ledger → Web Reconcile
```

Owner routing：

```text
Browser / presentation → B
Dashboard / API / Controller → A
Native / PA → D
Quest semantics → E
Admin diagnostic read model → G
Reference gap → F
Synthetic / Trace infrastructure → H
```

G 與 H 是 Project Control 明確指定後才成立的邏輯 owner label，不改變既有
A～E footer 狀態表。若 Project Control 尚未建立 G／H workline，Worker 只能回報
證據與 routing recommendation，不得自行擴修。

硬停止規則：

```text
A 發現斷點已進 Native → STOP，OWNER = D
D 發現 Native 正常而 Web projection 錯 → STOP，OWNER = A / B
B 發現 server state 正確但 DOM reconcile 錯 → B 繼續
```

Worker 不得跨 owner 擴修。若 evidence 尚未到 Native boundary，不得派 Native
工作給 D。

## 10. Minimal Fix / Tests / Regression

只修 `FIRST_BROKEN_TRANSITION` 所屬 owner 的最小 seam。完成：

```text
OWNER =
MINIMAL_FIX =
BOUNDED_TEST =
SYNTHETIC_REGRESSION =
```

Synthetic regression 必須重跑原始 scenario、相同合法前置條件與 failure fixture。
可用 test-only fixture 加速，但不得手動改 gameplay state 取代真實 authority。

## 11. Checkpoint / Deploy / Acceptance

完成 source／test 後，依序確認：

```text
CLEAN_CHECKPOINT =
SUPERSET / PROVENANCE =
CONTROLLED_DEPLOY =
SYNTHETIC_LIVE_ACCEPTANCE =
BROWSER_FINAL_ACCEPTANCE =
```

Source PASS 與 Synthetic PASS 都不等同 Production PASS。Deploy 只能進入唯一
canonical runtime，遵守 Single Runtime restart safety。涉及 Player Web 的功能，
Synthetic PASS 不取代實際 Browser final acceptance；Browser FAIL 優先於 fixture
或 Synthetic PASS。

## 12. Stop conditions

立即停止並回報：

```text
NO_EVIDENCE
TRACE_PROPAGATION_GAP
FIRST_BROKEN_TRANSITION = UNKNOWN
OWNER = UNKNOWN
NEAREST_LEGAL_STATE_UNAVAILABLE
SECOND_RUNTIME_REQUIRED
MIXED_FILE_GIT_CONFLICT
REFERENCE_CONFLICT_REQUIRES_PROJECT_CONTROL
```

不要以「看起來」「可能」「大概」替代可取得的 deterministic evidence。

## 13. Final report

```text
LAST_GOOD =
CURRENT =
DIAGNOSTIC_SOURCE =
ACTION_TRACE =
SCENARIO =
SCENARIO_RESULT = PASS / FAIL / BLOCKED / N/A
FIRST_BROKEN_TRANSITION =
OWNER =
MINIMAL_FIX =
BOUNDED_TEST =
SYNTHETIC_REGRESSION = PASS / FAIL / BLOCKED / N/A
CLEAN_CHECKPOINT =
SUPERSET / PROVENANCE =
CONTROLLED_DEPLOY = PASS / NOT_RUN / BLOCKED
SYNTHETIC_LIVE_ACCEPTANCE = PASS / NOT_RUN / BLOCKED
BROWSER_FINAL_ACCEPTANCE = PASS / REQUIRES_BROWSER / N/A
SOURCE_PASS = PASS / FAIL / N/A
PRODUCTION_PASS = PASS / FAIL / NOT_PROVEN
TRACE_PROPAGATION_GAP = PRESENT / ABSENT / UNKNOWN
READY = YES / NO
```

`BROWSER_FINAL_ACCEPTANCE = PASS` 只有實際 Browser UI evidence 存在時才可填寫。
