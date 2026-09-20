# WORKLINE_DISPATCH_TEMPLATE_V1

STATUS: CANONICAL

POLICY AUTHORITY:
AGENTS.md / PC-DISPATCH-STANDARD-v1.1

PURPOSE:
Canonical structure for starting a new Project Control workline.

---

## 0. HOW TO USE

Fill every section. Do not omit a section because it looks obvious.

```text
For new workline:
Use WORKLINE_DISPATCH_TEMPLATE_V1.
```

If the value of a field is not known:

```text
UNKNOWN
```

Do not replace an unknown with a guess.

This template defines dispatch structure only. Policy authority remains
`AGENTS.md`; do not restate or fork policy text inside a dispatch.

Existing / blocked worklines do not use this template:

```text
Use WORKLINE_CONTINUATION_TEMPLATE_V1.
Continue from CURRENT_PHASE.
Do not restart audit.
```

---

## 1. WINDOW

```text
【WINDOW】
<short worker window name>
```

---

## 2. WORKLINE_ID

```text
【WORKLINE_ID】
<stable identifier>
```

The identifier is stable for the whole workline. A continuation of the same
workline reuses the same ID; it does not create a second workline.

---

## 3. ROLE

Describe only this workline's responsibility.

```text
【ROLE】

Responsible for:
- <what this workline owns>

Not responsible for:
- <what this workline must not do>

Scope expansion by the worker is forbidden. If the task appears to require
scope outside this ROLE: STOP and return to Project Control.
```

---

## 4. OBJECTIVE

One paragraph stating the completion standard.

```text
【OBJECTIVE】
<completion standard>
```

No chat-style background, no history, no motivation narrative.

---

## 5. CURRENT SOURCE OF TRUTH

Minimum fields:

```text
canonical_web_source:
canonical_native_source:
production_root:
branch_or_checkpoint:
current_runtime_authority:
completed_evidence:
known_blocker:
long_term_product_direction:
canonical_direction_doc:
foundation_status:
autonomous_runtime_status:
```

`long_term_product_direction` is fixed to `Character Life & Social Simulation`
and `canonical_direction_doc` to
`docs/character-life-social-simulation-roadmap.md`. Do not paste the roadmap.

Rules:

- `.tmp-*` paths MUST NOT be used as source authority.
- Fields that do not apply to this workline are `N/A`.
- Evidence means exact files, commits, or acceptance records, not summaries.

---

## 6. WORKSPACE_ROOT

```text
WORKSPACE_ROOT:
<exact absolute root>
```

Exact path only. No placeholders, no relative paths, no path discovery.

---

## 7. ALLOWED_PATHS

Bounded read / modify paths:

```text
ALLOWED_PATHS:
- <exact path>
- <exact path>
```

Anything outside this list is out of scope.

---

## 8. EXACT_FILES_FIRST

```text
EXACT_FILES_FIRST:
- <exact file / symbol>
```

Work starts from exact files and symbols. Recursive discovery is not the entry
point.

---

## 9. FORBIDDEN_SEARCH

```text
FORBIDDEN_SEARCH:
- Get-ChildItem -Recurse
- dir /s
- Project root filesystem recursion
- C:\ recursive search
- .tmp-* archaeology
- node_modules scan
- unrelated worktree search
```

If the required symbol or path cannot be reached inside `ALLOWED_PATHS`:

```text
STOP
SEARCH_SCOPE_INSUFFICIENT = <needed symbol/path>
```

Do not widen the search scope by yourself.

---

## 10. POLICY / GATES

Reference existing governance. Do not copy policy bodies into the dispatch.

```text
Follow PC-DISPATCH-STANDARD.
```

If the workline touches an OpenKore-era capability:

```text
OPENKORE_REFERENCE_REQUIRED = YES
DO_NOT_IMPLEMENT_BEFORE:
OPENKORE_REFERENCE_GATE = PASS
REFERENCE_DOSSIER = <path or NONE>
OPENKORE_REFERENCE_INHERITED = YES / NO
Follow OPENKORE_REFERENCE_POLICY and OPENKORE_REFERENCE_GATE_V1.1.
```

Before source change, the worker must report exact reference files/symbols,
config keys, Last-Good behavior, trigger, state machine, success/failure/
recovery paths, retry policy, edge cases, authority boundary, current behavior,
and behavior differences. The report must classify each major behavior:

```text
BEHAVIOR_MAPPING = REPRODUCE / ADAPT / REJECT_LEGACY
GHOST_ISLAND_OPTIMIZATION =
OPENKORE_DEVIATION = YES / NO
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE =
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
REFERENCE_CONFLICT_RESOLVED = YES / NO
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
OPTIMIZATION_APPLIED = YES / NO_NOT_NEEDED
OPTIMIZATION_REASON =
```

Missing evidence blocks source edit. Reference conflict or deliberate deviation
returns to Project Control for approval.

The required final report fields are:

```text
OPENKORE_REFERENCE_REQUIRED =
OPENKORE_REFERENCE_TRIGGERED =
OPENKORE_REFERENCE_GATE = PASS / FAIL / NOT_APPLICABLE
OPENKORE_REFERENCE_INHERITED = YES / NO
REFERENCE_DOSSIER =
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
OPENKORE_CAPABILITY_EXISTS =
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_CONFIG_KEYS =
OPENKORE_LAST_GOOD_BEHAVIOR =
CURRENT_GHOST_ISLAND_BEHAVIOR =
OPENKORE_BEHAVIOR_COMPARED =
BEHAVIOR_MAPPING =
REFERENCE_CONFLICT =
REFERENCE_CONFLICT_RESOLVED = YES / NO
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
OPENKORE_DEVIATION = YES / NO
PROJECT_CONTROL_APPROVAL =
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
OPTIMIZATION_APPLIED = YES / NO_NOT_NEEDED
OPTIMIZATION_REASON =
OPTIMIZATION_DIMENSIONS =
OPENKORE_LAST_GOOD_PLAYER_RESULT =
GHOST_ISLAND_CURRENT_PLAYER_RESULT =
EQUIVALENCE_EVIDENCE =
BETTER_DIMENSIONS =
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS =
RESULT_EQUIVALENT_OR_BETTER =
PLAYER_FLOW_EQUIVALENCE = PASS / FAIL / NOT_TESTED
OPENKORE_CORE_ALIGNMENT_VETO = PASS / FAIL
CHANGE_APPROVED = YES / NO
CHANGE_REJECTED = YES / NO
WORKLINE_DONE = YES / NO
```

The six-question core alignment veto is mandatory:

```text
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
RESULT_EQUIVALENT_OR_BETTER = YES
```

`OPTIMIZATION_APPLIED = NO_NOT_NEEDED` is valid after a documented review. Any
other veto value, any regression, or any critical unproven equivalence dimension
rejects the change, blocks Production deploy and keeps the workline incomplete.

If the workline touches Browser UI:

```text
Browser evidence required by AGENTS policy.
```

If the workline touches Persistent Agent, Combat, Navigation, Supply, Recovery,
Quest, Event Ledger, Live State, Control Authority, Memory, Social or Character
autonomy, dispatch and acceptance MUST add:

```text
CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS / FAIL / N/A
```

Question: does this implementation remain reusable by Life Director / Social
Director / Autonomous Character without requiring a second runtime engine?

On `FAIL`:

```text
STOP
PROJECT_CONTROL_DECISION_REQUIRED = YES
```

---

## 11. LAST_GOOD / CURRENT / FIRST_BROKEN_TRANSITION

Regression / restore workline:

```text
LAST_GOOD =
CURRENT =
FIRST_BROKEN_TRANSITION =

EXPECTED =
ACTUAL =
```

New capability:

```text
FIRST_BROKEN_TRANSITION = N/A
EXISTING_REUSABLE_CAPABILITIES =
```

A new-capability workline still must name the existing reusable capabilities it
builds on.

---

## 12. PHASES

Create only bounded phases directly tied to this objective. Each phase states:

```text
PHASE <n>: <name>
objective:
allowed changes:
output / evidence:
```

Unbounded exploration is not a phase.

---

## 13. TESTS

```text
SOURCE_TESTS =
BACKEND_TESTS =
LIVE_ACCEPTANCE =
BROWSER_UI_ACCEPTANCE =
```

Rules:

- Backend evidence never substitutes for Browser UI evidence.
- A category that does not apply is `N/A` with a one-line reason.

---

## 14. STOP_CONDITIONS

```text
scope insufficient
requires unrelated architecture rewrite
external runtime restart invalidates test
mixed-file Git conflict
reference conflict requires Project Control
second runtime would be required
```

On STOP: return the blocker only. Do not expand scope to work around it.

---

## 15. DO_NOT_TOUCH

```text
DO_NOT_TOUCH:
- unrelated features
- Native / Web / Production layers outside this workline
- OpenKore runtime
- launcher
- Scheduled Task
- <additional explicit exclusions>
```

---

## 16. GIT_HYGIENE

Forbidden:

```text
git add .
git add -A
destructive git
```

Required:

```text
exact-file stage only
mixed file: git add -p <exact-file>
```

If the change cannot be isolated:

```text
GIT_CHECKPOINT = BLOCKED_BY_MIXED_FILE
```

Do not push unless Project Control explicitly requests it.

---

## 17. FINAL_REPORT

```text
10-20 lines maximum unless explicitly authorized.
```

PASS:

```text
counts / exact evidence only
```

FAIL:

```text
FIRST_BROKEN_TRANSITION =
EXPECTED =
ACTUAL =
evidence (as required) =
```

No chat-style retrospective.

---

## 18. CONTEXT_REPORT

```text
WORKLINE =
WORKSPACE_ROOT =
BRANCH =
HEAD =
WORKSPACE_ROUTING_MATCH =

INDEXED_SEARCHED_PATHS =
TOP_LEVEL_SEARCH_PATH_COUNT =

CROSS_WORKTREE_SEARCH_PERFORMED =
PROJECT_ROOT_SEARCH_PERFORMED =
C_DRIVE_SEARCH_PERFORMED =
UNBOUNDED_RECURSIVE_SEARCH_PERFORMED =

LARGE_OUTPUT_COMMAND_USED =
SOURCE_OF_TRUTH_FILES_READ =
CONTEXT_BUDGET_VIOLATION =
```

---

## 19. VERSIONING

```text
TEMPLATE = WORKLINE_DISPATCH_TEMPLATE_V1
```

No silent semantic change. Future substantive change:

```text
V1.1
V2
```

and the `AGENTS.md` reference must be updated in the same change.
