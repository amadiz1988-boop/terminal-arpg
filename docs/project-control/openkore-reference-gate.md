# OPENKORE_REFERENCE_GATE_V1

STATUS: CANONICAL

POLICY AUTHORITY:
AGENTS.md / OPENKORE_REFERENCE_POLICY

PURPOSE:
Operational compliance gate for any workline involving
an OpenKore-era capability.

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

OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_HISTORICAL_EVIDENCE =

LAST_GOOD_BEHAVIOR =

BEHAVIOR_MAPPING =
  OpenKore:
  PA:

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

SOURCE_PASS =
LIVE_PASS =
BROWSER_UI_PASS =

POLICY_COMPLIANCE = PASS/FAIL
```

---

## VERSIONING RULE

`OPENKORE_REFERENCE_GATE_V1` 不得被 silently 改變語意。

未來若 Gate 行為有實質變動，使用 `V1.1`、`V2`，並同步更新
`AGENTS.md` reference。

`AGENTS.md` 永遠是 policy authority。
