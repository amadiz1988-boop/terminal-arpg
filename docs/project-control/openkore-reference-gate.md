# OPENKORE_REFERENCE_GATE_V1.1

HARD_GATE_POLICY: `OPENKORE_REFERENCE_FIRST_HARD_GATE`
HARD_GATE_VERSION: `V1`
HARD_GATE_SEVERITY: `MANDATORY / BLOCKING`

VERSION: V1.1 (backward-compatible enhancement of V1)

STATUS: CANONICAL

POLICY AUTHORITY:
AGENTS.md / OPENKORE_REFERENCE_POLICY

PURPOSE:
Operational compliance gate for any workline involving
an OpenKore-era capability.

V1.1 additionally covers mature rAthena official/community
implementations as a secondary reference pool, license awareness,
reference-conflict reporting, and triangulated behavior mapping.

---

## 0. POLICY LOAD

Before any source change:

Read canonical `AGENTS.md`.

Confirm:

```text
AGENTS_POLICY_READ = YES
OPENKORE_REFERENCE_POLICY_READ = YES
```

If policy cannot be found:

```text
STOP.
```

No implementation is allowed.

---

## 1. OPENKORE REFERENCE EVIDENCE

For any OpenKore-era capability, identify exact:

```text
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_HISTORICAL_EVIDENCE =
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE =
OPENKORE_REFERENCE_INHERITED = YES / NO
REFERENCE_DOSSIER = <path or NONE>
```

Reference priority is: project actual PASS evidence, project locked version,
mature upstream implementation, then other evidence. If a dossier exists and its
version, contract and covered edge cases are unchanged, the workline may inherit
it with `OPENKORE_REFERENCE_INHERITED = YES`; it must still report
`OPENKORE_BEHAVIOR_COMPARED = YES`.

Acceptable evidence includes:

- OpenKore source
- OpenKore plugin/source behavior
- historical acceptance reports
- OpenKore Exit evidence
- last-good runtime evidence

A statement such as:

```text
"OpenKore was referenced"
```

is **NOT** sufficient evidence.

The pre-edit record must also identify:

```text
OPENKORE_CAPABILITY_EXISTS = YES / NO / UNKNOWN
OPENKORE_CONFIG_KEYS =
OPENKORE_TRIGGER_CONDITION =
OPENKORE_STATE_MACHINE =
OPENKORE_SUCCESS_PATH =
OPENKORE_FAILURE_PATH =
OPENKORE_RECOVERY_PATH =
OPENKORE_RETRY_POLICY =
OPENKORE_EDGE_CASES =
OPENKORE_AUTHORITY_BOUNDARY =
CURRENT_GHOST_ISLAND_BEHAVIOR =
BEHAVIOR_DIFFERENCES =
```

Search must remain bounded.

Forbidden:

- whole OpenKore recursive scan
- `C:\` recursive search
- `.tmp-*` archaeology
- unrelated project-root recursion

If scope is insufficient:

```text
STOP
SEARCH_SCOPE_INSUFFICIENT = <needed symbol/path>
```

---

## 2. RECONSTRUCT LAST-GOOD

Before code changes, reconstruct:

```text
LAST_GOOD_TRIGGER =
LAST_GOOD_INPUT =
LAST_GOOD_STATE_MODEL =
LAST_GOOD_ALGORITHM =
LAST_GOOD_TRANSITIONS =
LAST_GOOD_OUTPUT =
LAST_GOOD_EDGE_CASES =
LAST_GOOD_RECOVERY =
```

Only evidence-supported behavior may be recorded.

Unknown behavior must be:

```text
UNKNOWN
```

Do not invent missing behavior.

---

## 3. OPENKORE → PA BEHAVIOR MAPPING

Produce explicit mapping:

```text
OPENKORE_BEHAVIOR
→ CURRENT_PA_EQUIVALENT
```

Required categories:

```text
TRIGGER
STATE
ALGORITHM
EXECUTION
RECOVERY
DATA_OUTPUT
```

For each:

```text
OpenKore =
PA =
```

If PA already provides an equivalent capability:

```text
REUSE IT.
```

---

## 4. FIRST BROKEN TRANSITION

Mandatory sequence:

```text
LAST_GOOD
→ CURRENT
→ FIRST_BROKEN_TRANSITION
```

Report:

```text
FIRST_BROKEN_TRANSITION =
EXPECTED =
ACTUAL =
```

No rewrite proposal is allowed before this point.

---

## 5. IMPLEMENTATION RULE

Allowed implementation categories:

- Minimal Glue
- Minimal Port
- Semantic Mapping
- Missing Adapter
- Missing Runtime Seam

Forbidden without Project Control approval:

- second navigation engine
- second combat engine
- second supply engine
- second route planner
- second state machine
- second character-state model
- second Web data contract

If deviation from OpenKore Last-Good is required:

```text
STOP
```

Report:

```text
DEVIATION_REQUIRED = YES
TECHNICAL_REASON =
CURRENT_ARCHITECTURE_CONSTRAINT =
PROJECT_CONTROL_DECISION_REQUIRED = YES
```

Do not continue until approved.

## 5A. BEHAVIOR MAPPING AND OPTIMIZATION REVIEW

Every major behavior must be classified before source edit:

```text
REPRODUCE = retain OpenKore semantics
ADAPT = retain semantics and move execution to PA / SERVER_AGENT → rAthena
REJECT_LEGACY = record why the legacy behavior is unsuitable
```

Then complete the review:

```text
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
OPTIMIZATION_APPLIED = YES / NO_NOT_NEEDED
OPTIMIZATION_REASON =
OPTIMIZATION_DIMENSIONS =
```

The optimization record covers invariants, PA authority boundaries, removable
client/process/file transport, retained recovery/retry/edge cases, latency or
duplicate-state gains, and player-flow equivalence. It cannot be used to skip
reference reconstruction. `NO_NOT_NEEDED` is valid when the review confirms that
changing mature behavior would add risk without player or architecture value.

If the proposed behavior deliberately differs from OpenKore:

```text
OPENKORE_DEVIATION = YES
OPENKORE_BEHAVIOR =
PROPOSED_GHOST_ISLAND_BEHAVIOR =
WHY_OPENKORE_IS_NOT_SUITABLE =
PLAYER_VALUE_GAIN =
ARCHITECTURE_GAIN =
NEW_RISK =
ROLLBACK_PATH =
PROJECT_CONTROL_APPROVAL = REQUIRED
```

Without approval, the gate remains `FAIL` and source edit is prohibited.

## 5B. SERVER AUTHORITY AND OBJECTIVE EQUIVALENCE

OpenKore is a behavior reference, not world authority. The authority remains:

```text
PA / SERVER_AGENT → rAthena
```

The worker must prove:

```text
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
REFERENCE_CONFLICT_RESOLVED = YES / NO
```

When OpenKore and rAthena or current architecture conflict, stop and report:

```text
OPENKORE_BEHAVIOR =
RATHENA_BEHAVIOR =
CURRENT_ARCHITECTURE_CONSTRAINT =
PLAYER_VALUE_IMPACT =
```

The worker cannot select or blend the conflicting contracts.

Objective equivalence requires evidence for all dimensions:

```text
EQUIVALENCE_EVIDENCE =
PLAYER_VISIBLE_BEHAVIOR = PROVEN / UNPROVEN
SUCCESS_PATH = PROVEN / UNPROVEN
FAILURE_PATH = PROVEN / UNPROVEN
RECOVERY = PROVEN / UNPROVEN
RETRY = PROVEN / UNPROVEN
RESTART_SAFETY = PROVEN / UNPROVEN
RECONNECT_SAFETY = PROVEN / UNPROVEN
AUTHORITY_CORRECTNESS = PROVEN / UNPROVEN
STATE_CONSISTENCY = PROVEN / UNPROVEN
RELIABILITY = PROVEN / UNPROVEN
LATENCY = PROVEN / UNPROVEN
SCALABILITY = PROVEN / UNPROVEN
MAINTAINABILITY = PROVEN / UNPROVEN
BETTER_DIMENSIONS =
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS =
```

Any regression or critical unproven dimension prevents
`RESULT_EQUIVALENT_OR_BETTER = YES` and requires Project Control decision.

Before the hard gate passes, only read-only diagnostics and isolated test-only
instrumentation that preserves gameplay semantics are allowed. Gameplay source
edit, state-machine redesign, production deploy, runtime mutation, new gameplay
contract and permanent route/supply/combat/recovery implementation are prohibited.

## 5C. OPENKORE_CORE_ALIGNMENT_VETO

The gate is approved only when all six questions are independently confirmed:

```text
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
RESULT_EQUIVALENT_OR_BETTER = YES
```

`OPTIMIZATION_APPLIED = NO_NOT_NEEDED` is valid after a completed review. Any
other value, any regression, or any critical unproven dimension produces:

```text
OPENKORE_CORE_ALIGNMENT_VETO = FAIL
CHANGE_APPROVED = NO
PRODUCTION_DEPLOY = BLOCKED
WORKLINE_DONE = NO
```

Project Control must repeat the six-question check independently during second
acceptance. Worker self-report, source tests, build success and model confidence
cannot override the veto.

If one gameplay subsystem has at least two downstream blockers, pause the next
fix and record:

```text
UPSTREAM_ASSUMPTION_RECHECK = YES
DOWNSTREAM_BLOCKER_COUNT =
CURRENT_CONTRACT_REVALIDATED = YES / NO
OPENKORE_LAST_GOOD_RECHECKED = YES / NO
CONTINUE_CURRENT_DIRECTION = YES / NO
```

No third downstream fix is authorized before that recheck.

---

## 6. RUNTIME AUTHORITY

Production runtime authority:

```text
PA / SERVER_AGENT
→ rAthena
```

OpenKore may be used only as:

- Reference Implementation
- Last-Good Knowledge
- Algorithm Reference
- Data Contract Reference
- State-Machine Reference
- Historical Evidence

Mandatory:

```text
OPENKORE_RUNTIME_USED = NO
OPENKORE_PROCESS_COUNT = 0
```

Forbidden:

```text
PA
→ OpenKore
→ rAthena
```

---

## 7. DATA MIGRATION

For Web/Dashboard data flows:

Prefer:

```text
OpenKore-provided semantics
→ PA-provided authoritative semantics
```

Do not default to:

```text
OpenKore removed
→ every Web consumer rebuilds its own state
  from unrelated DB sources.
```

Prefer existing PA:

- Live Snapshot
- Projection
- Event Ledger
- Farm Session State
- Inventory / Equipment State
- Runtime State

---

## 8. RESTORE FIRST, OPTIMIZE SECOND

Mandatory order:

```text
1. Correct behavior
2. Bounded test
3. Live acceptance
4. Browser acceptance
5. Measurement
6. Optimization
```

Performance work must be measurement-driven.

Do not perform speculative architecture rewrites
while behavior/data wiring remains incomplete.

---

## 9. FINAL COMPLIANCE REPORT

Every applicable workline must include:

```text
AGENTS_POLICY_READ =
OPENKORE_REFERENCE_POLICY_READ =
REFERENCE_GATE_VERSION = V1.1
OPENKORE_REFERENCE_FIRST_HARD_GATE = PASS / FAIL / BLOCKED

OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_HISTORICAL_EVIDENCE =
OPENKORE_REFERENCE_INHERITED = YES/NO
REFERENCE_DOSSIER =
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
OPENKORE_CAPABILITY_EXISTS =
OPENKORE_CONFIG_KEYS =
PROJECT_LAST_GOOD_OPENKORE_CONFIG =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE =
OPENKORE_TRIGGER_CONDITION =
OPENKORE_STATE_MACHINE =
OPENKORE_SUCCESS_PATH =
OPENKORE_FAILURE_PATH =
OPENKORE_RECOVERY_PATH =
OPENKORE_RETRY_POLICY =
OPENKORE_EDGE_CASES =
OPENKORE_AUTHORITY_BOUNDARY =
CURRENT_GHOST_ISLAND_BEHAVIOR =
BEHAVIOR_DIFFERENCES =

RATHENA_REFERENCE_APPLICABLE =
RATHENA_REFERENCE_SOURCES =
RATHENA_REFERENCE_FILES =
RATHENA_REFERENCE_SYMBOLS =
RATHENA_REFERENCE_BEHAVIOR =
RATHENA_REFERENCE_LICENSE =

DIRECT_CODE_REUSE_ALLOWED =

LAST_GOOD_BEHAVIOR =

REFERENCE_BEHAVIOR_MAPPING =
  OpenKore:
  rAthena:
  Project Last-Good:
  PA Current:

REFERENCE_CONFLICT = YES/NO

FIRST_BROKEN_TRANSITION =
EXPECTED =
ACTUAL =

REUSED_PA_CAPABILITIES =
MINIMAL_PORT_OR_GLUE =
BEHAVIOR_MAPPING =
OPENKORE_DEVIATION = YES/NO
REFERENCE_CONFLICT_RESOLVED = YES/NO
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES/NO
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES/NO
OPTIMIZATION_APPLIED = YES/NO_NOT_NEEDED
OPTIMIZATION_REASON =
OPTIMIZATION_DIMENSIONS =
EQUIVALENCE_EVIDENCE =
BETTER_DIMENSIONS =
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS =
GHOST_ISLAND_OPTIMIZATION =
OPENKORE_LAST_GOOD_PLAYER_RESULT =
GHOST_ISLAND_CURRENT_PLAYER_RESULT =
RESULT_EQUIVALENT_OR_BETTER = YES/NO
OPENKORE_CORE_ALIGNMENT_VETO = PASS/FAIL
PLAYER_FLOW_EQUIVALENCE = PASS/FAIL/NOT_TESTED

DUPLICATE_ENGINE_CREATED = YES/NO
NEW_STATE_MACHINE_CREATED = YES/NO
NEW_DATA_CONTRACT_CREATED = YES/NO

OPENKORE_RUNTIME_USED = NO
OPENKORE_PROCESS_COUNT = 0
THIRD_PARTY_RUNTIME_DEPENDENCY_ADDED = NO

SOURCE_PASS =
LIVE_PASS =
BROWSER_UI_PASS =

POLICY_COMPLIANCE = PASS/FAIL
```

---

## 10. SECONDARY MATURE REFERENCE CHECK

若 capability 與 rAthena server-side automation 直接相關，必須判斷：

```text
RATHENA_REFERENCE_APPLICABLE = YES/NO
```

若 YES，必須查直接相關的成熟實作。優先來源：

- rAthena official source
- rAthena official/community forum source release
- established rAthena plugin/script/source mod
- source repository linked from authoritative rAthena discussion

必須列出：

```text
RATHENA_REFERENCE_SOURCES =
RATHENA_REFERENCE_FILES =
RATHENA_REFERENCE_SYMBOLS =
RATHENA_REFERENCE_BEHAVIOR =
RATHENA_REFERENCE_LICENSE =
```

不得只回：

```text
"參考過 rAthena plugin"
```

這不算 evidence。

### SEARCH RULE

搜尋必須 bounded。

若需要 external research，只搜尋與 capability 直接相關的：

```text
rAthena
+ exact feature name
```

例如：

```text
rAthena auto attack
rAthena auto combat
rAthena auto potion
rAthena auto loot
```

禁止無界限爬整個論壇或 GitHub。

如果沒有 Web capability，回報：

```text
RATHENA_EXTERNAL_REFERENCE = REQUIRES_WEB
```

不得虛構 reference。

### LICENSE / CODE REUSE RULE

允許研究：

- behavior
- architecture
- algorithm
- state machine
- edge cases
- data semantics

但直接複製第三方 source code 前，必須確認 license。

Mandatory fields：

```text
REFERENCE_LICENSE =
DIRECT_CODE_REUSE_ALLOWED = YES/NO/UNKNOWN
```

若：

```text
LICENSE = UNKNOWN
```

則：

```text
DIRECT_CODE_REUSE_ALLOWED = NO
```

可以研究行為，但不得直接 copy source。

OpenKore 亦同樣適用。

---

## 11. TRIANGULATED BEHAVIOR MAPPING

原本：

```text
OpenKore
→ PA
```

擴充為：

```text
OpenKore Reference
+
rAthena Mature Reference（若適用）
+
Project Last-Good
        ↓
CURRENT PA
        ↓
FIRST_BROKEN_TRANSITION
```

Reference reconstruction 優先考慮：

```text
A. OpenKore mature implementation
B. Mature rAthena official/community implementation
C. Project historical Last-Good / acceptance evidence
D. Current PA implementation
```

但這不是「排名決定誰一定正確」。真正流程是：

```text
collect mature references
→ compare proven behaviors
→ identify common semantics
→ map into PA architecture
```

Mandatory mapping：

```text
REFERENCE_BEHAVIOR_MAPPING =

OpenKore:
<behavior>

rAthena:
<behavior or NOT_APPLICABLE>

Project Last-Good:
<observed behavior>

PA Current:
<current behavior>
```

若 OpenKore 與 rAthena implementation 有差異，不得自行選一邊，必須記錄：

```text
REFERENCE_CONFLICT = YES
```

並列出：

```text
OPENKORE_BEHAVIOR =
RATHENA_BEHAVIOR =
CURRENT_PA_CONSTRAINT =
```

再由 Project Control 決定。

---

## 12. IMPLEMENTATION DECISION

只有完成 Reference Mapping 後，才允許 source change。

實作原則仍是：

- Minimal Glue
- Minimal Port
- Semantic Mapping
- Missing Adapter
- Missing Runtime Seam

如果成熟 reference 已存在，禁止無證據建立：

- second combat engine
- second navigation engine
- second supply engine
- second planner
- second recovery state machine
- second data contract

---

## 13. SERVER-SIDE PREFERENCE

因 PA 本身位於 rAthena authority：當 OpenKore 與成熟 rAthena implementation
提供相同行為能力時，必須特別評估 rAthena implementation 如何在 server-side：

```text
- access character state
- manipulate movement
- acquire target
- execute skill/attack
- consume item
- update inventory/equipment
- detect death
- perform recovery
- interact with NPC/service
```

目的不是直接裝 plugin，而是找：

```text
"最適合 PA/rAthena authority 的 server-side 實作方式"
```

---

## 14. FINAL RUNTIME GUARANTEE

不論參考多少外部實作，最後 Production 必須保持：

```text
PA / SERVER_AGENT
→ rAthena
```

Mandatory：

```text
OPENKORE_RUNTIME_USED = NO
OPENKORE_PROCESS_COUNT = 0
THIRD_PARTY_RUNTIME_DEPENDENCY_ADDED = NO
```

禁止：

```text
PA
→ third-party rAthena plugin runtime
→ rAthena
```

除非 Project Control 明確批准，否則不得將第三方 plugin 變成新的核心
Runtime dependency。

OpenKore / rAthena community implementations 都只是 Reference Implementation。
正式功能最終仍必須整合至 PA / SERVER_AGENT / canonical rAthena runtime。

---

## VERSION HISTORY

```text
V1:
OpenKore reference compliance

V1.1:
adds mature rAthena implementation reference,
license awareness,
and triangulated behavior mapping.
```

## VERSIONING RULE

`OPENKORE_REFERENCE_GATE_V1.1` 不得被 silently 改變語意。

未來若 Gate 行為有實質變動，使用 `V1.2`、`V2`，並同步更新
`AGENTS.md` reference。

`AGENTS.md` 永遠是 policy authority。
