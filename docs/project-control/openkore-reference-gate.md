# OPENKORE_REFERENCE_GATE_V1.1

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
```

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

OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_HISTORICAL_EVIDENCE =

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
