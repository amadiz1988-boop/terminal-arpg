# Project Control Response Protocol V1

Status: CANONICAL

Policy authority: `AGENTS.md` / `PC-DISPATCH-STANDARD-v1.1`

This document persists Project Control response, routing, acceptance, and
checkpoint rules across Project Control conversations. It operationalizes
`AGENTS.md`; it does not replace or fork that policy.

## 1. Mandatory A-E footer

Every Project Control response ends with this exact six-column workline table.
The model and Fast columns remain present even when their values are `N/A`.

| 線 | 狀態 | 現在是否工作 | 目前任務 | 建議模型 | 1.5× Fast |
|---|---|---|---|---|---|
| A |  |  |  |  |  |
| B |  |  |  |  |  |
| C |  |  |  |  |  |
| D |  |  |  |  |  |
| E |  |  |  |  |  |

The fixed logical routing is:

```text
A = Web / Dashboard / API / Controller
B = UI / Browser / Player Web acceptance
C = Project Control / Governance / Gate / Dispatch
D = Persistent Agent / Native / Combat / Supply / Navigation / native capability
E = Quest / Job Change / Quest integration
```

`F = ON_DEMAND REFERENCE / RESEARCH WORKLINE` for rAthena and OpenKore Atlas
research, indexing, source mapping, provenance and reference-conflict review.
F is normally `WAITING` or `CLOSED`, is not permanently active, and does not
directly modify gameplay. Reopen F only for an Atlas gap, stale reference,
version conflict, new subsystem, upstream meaning change or high-value
forum/community research.
The fixed Project Control footer remains the A-E six-column table.

## 2. Workline states

Allowed states are `WORKING`, `WAITING`, `BLOCKED`, `HOLD`, `ACTIVE`, and
`CLOSED`.

```text
WORKING = formally dispatched and no completion or blocker report received
WAITING = no formal dispatch is running; waiting for the next handoff or dependency
BLOCKED = an explicit blocker prevents continuation
HOLD = Project Control intentionally paused the line; self施工 is forbidden
ACTIVE = Project Control itself continues operating
CLOSED = the atomic task is completed and closed
```

These rules are mandatory:

- No formal dispatch means the line cannot be `WORKING`.
- After a worker reports completion, Project Control immediately sets
  `WAITING` or `CLOSED` unless the same response dispatches the next step.
- A future action is not current work.
- No new worker report means no assumed completion.
- Project Control tracks A-E and does not require the user to repost a dispatch
  to recover state.

## 3. Dispatch outer wrapper and model routing

Every worker dispatch uses this structure:

```text
[OUTER HEADER - outside the copyable Worker prompt]

貼到：A｜Web / Dashboard
模型：GPT-5.6 Sol｜高
1.5× Fast：OFF

[ONE COPYABLE WORKER PROMPT CODE BLOCK]

【在目前這個視窗直接繼續執行】

不要轉交。
不要另開工作視窗。
不要只記錄任務。
EXECUTE TO COMPLETION.

完整 Worker 任務內容

[OUTER FOOTER - outside the copyable Worker prompt]

貼到：A｜Web / Dashboard
模型：GPT-5.6 Sol｜高
1.5× Fast：OFF
```

The outer header and outer footer are mandatory and identical. They repeat the
same destination workline, model, reasoning level, and Fast setting. They are
Project Control response-wrapper metadata, not Worker routing or execution
instructions.

The three metadata lines must not appear inside the copyable Worker prompt:

```text
貼到：
模型：
1.5× Fast：
```

The copyable prompt starts with the fixed four-line execution header shown
above. The user can copy that single code block without sending destination,
model, or Fast metadata to the Worker.

When dispatching multiple worklines, each workline gets its own complete
`OUTER HEADER → COPYABLE PROMPT → OUTER FOOTER` wrapper. Metadata for multiple
worklines must not be combined into one Worker prompt.

The A-E workline footer table remains separate Project Control state metadata;
it does not replace the dispatch wrapper.

Canonical wrapper contract:

```text
DISPATCH_OUTER_HEADER_REQUIRED = YES
DISPATCH_OUTER_FOOTER_REQUIRED = YES
OUTER_HEADER_FOOTER_IDENTICAL = YES
DESTINATION_INSIDE_COPYABLE_PROMPT = NO
MODEL_INSIDE_COPYABLE_PROMPT = NO
FAST_INSIDE_COPYABLE_PROMPT = NO
COPYABLE_PROMPT_STARTS_WITH = 【在目前這個視窗直接繼續執行】
```

Use the following default routing:

```text
bounded implementation / Browser acceptance / single known defect
→ GPT-5.6 Sol / Medium; Fast may be ON

complex root cause / Native / runtime / cross-boundary trace
→ GPT-5.6 Sol / High; Fast is usually OFF

core architecture / state machine
→ higher reasoning; Fast OFF
```

## 4. Parallelism and ownership gates

```text
MAXIMIZE_PARALLELISM
WITHOUT
FILE / RUNTIME / FIXTURE / DEPLOY COLLISION
```

Before dispatch, check:

- FILE OWNERSHIP
- RUNTIME OWNERSHIP
- FIXTURE OWNERSHIP
- BROWSER SESSION OWNERSHIP
- DEPLOY WINDOW

Independent worklines should run concurrently. Never allow two lines to edit
the same mixed file, take another line's fixture, or deploy during Browser
acceptance in a way that invalidates evidence. Single Runtime Policy always
applies. Parallelism never authorizes a second rAthena runtime.

## 5. Worker prompt persistence

Worker prompts preserve detail over brevity and contain, at minimum:

```text
CURRENT CONFIRMED STATE
OBJECTIVE
LAST_GOOD / CURRENT / FIRST_BROKEN_TRANSITION
exact scope
DO
DO NOT TOUCH
TESTS
ACCEPTANCE
STOP CONDITIONS
FINAL REPORT
```

The dispatch is placed in one copyable code block. Do not require a `.txt` or
`.md` download unless the user explicitly requests one.

Every new or continued worker prompt begins with:

```text
【在目前這個視窗直接繼續執行】

不要轉交。
不要另開工作視窗。
不要只記錄任務。
EXECUTE TO COMPLETION.
```

The worker prompt body does not contain `WINDOW:`, `貼到：`, or `WORKLINE:` as
routing instructions. The destination is shown to the user outside the block.

## 5A. rAthena Reference Atlas lookup gate

For any work involving Quest, NPC, dialogue, OnTouch, hidden NPC, Warp, Map,
Mapflag, Navigation, Save Point, Respawn, Job Change, Item, Inventory, Shop,
Buy/Sell, Kafra, Storage, Combat, Monster/Spawn, Loot/Drop, Skill, Status
Effect, EXP/Job EXP, Party, Guild, Instance, Event/Timer, Script Engine,
Client/CLIF gameplay, Teleport, Fly Wing, Butterfly Wing or other
server-authoritative RO behavior, Project Control must first require:

```text
RATHENA_REFERENCE_ATLAS_TRIGGER = MANDATORY / BLOCKING
RATHENA_REFERENCE_ATLAS != SOURCE_OF_TRUTH
RATHENA_REFERENCE_ATLAS_TRIGGERED = YES
RATHENA_REFERENCE_ATLAS_TOPIC =
RATHENA_REFERENCE_ATLAS_FILES =
ATLAS_SEARCHED = YES / NO
AUTHORITATIVE_SOURCE_CHECKED = YES / NO
PROJECT_LAST_GOOD_CHECKED = YES / NO
REFERENCE_ATLAS_STALE_OR_CONFLICTING = YES / NO
REFERENCE_GAP = CONFIRMED / NOT_CONFIRMED
```

Lookup starts with `docs/rathena-reference/reference-index.yml`, continues with
only the relevant Atlas topic or lookup-playbook section, follows exact
authoritative source paths, and checks Project Last-Good when applicable. The
Atlas is an index and lookup aid, not gameplay authority. Current canonical
rAthena source, project-specific server rules and authoritative config win a
conflict; stale Atlas text must not drive implementation.

For an OpenKore reference gap, only after
`RATHENA_ATLAS_SEARCHED = YES`, `OPENKORE_ATLAS_SEARCHED = YES`,
`PROJECT_LAST_GOOD_CHECKED = YES` and `AUTHORITATIVE_SOURCE_CHECKED = YES`
may a Worker declare `REFERENCE_GAP = CONFIRMED` or request
`NEW_IMPLEMENTATION`. `UNKNOWN` does not establish absence.

Do not require reading all Atlas files. Preserve this lookup state across
dispatch and continuation handoffs.

For Quest work, the next gate is Quest Flow First. For other gameplay work,
use `RATHENA_REFERENCE_ATLAS -> authoritative rAthena source ->
OPENKORE_REFERENCE_ATLAS -> PROJECT_LAST_GOOD -> CURRENT_PA ->
FIRST_BROKEN_TRANSITION -> REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY /
NOT_APPLICABLE -> implementation`.

## 5B. Quest Flow First hard gate

For any discussion, planning, dispatch, debugging, implementation, refactor,
migration, recovery or testing involving Quest, NPC, hidden NPC, OnTouch,
dialogue, quest state, Quest Runtime, novice/onboarding, Eden, job change,
event quest, quest navigation, quest recovery or automatic questing, Project
Control must require:

```text
QUEST_FLOW_FIRST_TRIGGERED = YES
QUEST_REFERENCE_DOSSIER = <path or NONE>
TARGET_QUEST_IDENTIFIED = YES / NO
TARGET_VERSION_IDENTIFIED = YES / NO
PLAYER_FLOW_UNDERSTOOD = YES / NO / UNKNOWN / PARTIAL
PLAYER_FLOW_SOURCE =
RATHENA_SCRIPT_SOURCE =
HISTORICAL_LAST_GOOD =
CURRENT_QUEST_RUNTIME =
INTERACTION_CLASSIFICATION =
REUSABLE_COMPONENTS =
WRONG_ASSUMPTIONS =
FIRST_BROKEN_TRANSITION =
WEB_CONTROL_REQUIRED = YES / NO
SERVER_AGENT_AUTONOMY_ALLOWED = YES / NO
IMPLEMENTATION_ALLOWED = YES / NO
```

`PLAYER_FLOW_UNDERSTOOD = UNKNOWN`, `NOT_PROVEN` or `PARTIAL` blocks gameplay
semantic implementation. Only read-only archaeology, source tracing,
historical Last-Good reconstruction, current-runtime comparison and test-only
diagnostics are permitted. The worker must understand the normal player flow
through the server-recognized completion state before deciding how to automate.

Quest Flow First runs before the OpenKore Atlas and existing OpenKore gate:

```text
RATHENA_REFERENCE_ATLAS_LOOKUP
→
QUEST_FLOW_FIRST_HARD_GATE
→ OPENKORE_REFERENCE_ATLAS_LOOKUP
→ OPENKORE_REFERENCE_GATE
→ PROJECT_LAST_GOOD_MAPPING
→ CURRENT_QUEST_RUNTIME_MAPPING
→ FIRST_BROKEN_TRANSITION
→ implementation
```

Quest automation may remain autonomous. Player Web need not expose every
low-level action. When `WEB_CONTROL_REQUIRED = NO`, SERVER_AGENT may execute
approved deterministic navigation, search, retargeting, combat, dialogue,
prohibited-target avoidance, bounded recovery and internal substeps after the
Quest Flow First, Server Authority and automation contract gates pass. Each
step is classified as `AUTONOMOUS`, `PLAYER_DECISION`,
`PLAYER_CONFIRMATION`, `WEB_OPTIONAL` or `SERVER_AGENT_INTERNAL`.

The only blocking conditions are unknown Quest semantics, loss of server
authority or an undefined automation contract. Web control absence alone does
not block autonomous execution.

If one Quest flow has two downstream blockers or semantic fixes, stop before a
third gameplay-semantic fix and record:

```text
UPSTREAM_ASSUMPTION_RECHECKED = YES
DOWNSTREAM_BLOCKER_COUNT =
THIRD_SEMANTIC_FIX_ALLOWED = NO
```

The recheck must reopen the player flow, rAthena script, historical Last-Good,
current runtime mapping and wrong assumptions before Project Control
reauthorizes the direction.

## 5C. OpenKore Reference Atlas lookup gate

For every workline triggered by an OpenKore-era automation capability, Project
Control must require the focused OpenKore Atlas lookup before the existing
OpenKore gate:

```text
OPENKORE_REFERENCE_ATLAS_TRIGGER = MANDATORY / BLOCKING
OPENKORE_REFERENCE_ATLAS_TRIGGERED = YES
OPENKORE_ATLAS_TOPIC =
OPENKORE_ATLAS_FILES =
OPENKORE_ATLAS_SEARCHED = YES / NO
RATHENA_ATLAS_SEARCHED = YES / NO
AUTHORITATIVE_SOURCE_CHECKED = YES / NO
PROJECT_LAST_GOOD_CHECKED = YES / NO
OPENKORE_MATURE_BEHAVIOR_CHECKED = YES / NO
RATHENA_AUTHORITY_CHECKED = YES / NO
CURRENT_PA_CHECKED = YES / NO
REFERENCE_GAP = CONFIRMED / NOT_CONFIRMED
REFERENCE_IS_FLOOR_NOT_CEILING = YES
OPENKORE_REFERENCE_ATLAS != PRODUCT_SPEC
OPENKORE_REFERENCE_ATLAS != RUNTIME_AUTHORITY
FINAL_DESIGN_CENTER = PA / SERVER_AGENT
REUSE_CLASSIFICATION = REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE
WHY_DEVIATE =
WHAT_IS_BETTER =
SERVER_AUTHORITY_PRESERVED = YES / NO
REGRESSION_RISK =
RESULT_EQUIVALENT_OR_BETTER = YES / NO
REFERENCE_CONFLICT = YES / NO
OPENKORE_BEHAVIOR =
PROJECT_LAST_GOOD =
RATHENA_BEHAVIOR =
CURRENT_PA_BEHAVIOR =
PROJECT_RULE =
LIKELY_REASON =
PA_RECOMMENDED_DIRECTION =
NEEDS_PC_DECISION = YES / NO
```

Project-specific item rule: Fly Wing and Butterfly Wing are
`NON_CONSUMABLE`; upstream OpenKore consumption behavior must not override
this project contract.

Lookup starts at `docs/openkore-reference/reference-index.yml`, reads only the
relevant topic, follows Project Last-Good links, checks locked OpenKore mature
behavior, rAthena authority and Current PA, then identifies the first broken
transition. `UNKNOWN` does not establish absence. Only after the relevant
checks are complete may `REFERENCE_GAP = CONFIRMED` or a new implementation be
requested. Preserve this state across dispatch and continuation handoffs.

The mature reference is a floor for behavior, retry, recovery and edge cases;
PA may improve it when server authority and player-visible equivalence remain
proven. Do not copy OpenKore runtime architecture or restore OpenKore runtime.

## 5D. OpenKore reference-first hard gate

For every workline involving an OpenKore-era gameplay capability or a Web /
Controller action that controls or presents one, Project Control must persist:

```text
OPENKORE_REFERENCE_REQUIRED = YES
DO_NOT_IMPLEMENT_BEFORE = OPENKORE_REFERENCE_GATE PASS
REFERENCE_DOSSIER = <path or NONE>
OPENKORE_REFERENCE_INHERITED = YES / NO
```

The worker must complete `OPENKORE_REFERENCE_GATE_V1.1` before source edit.
The pre-edit report must include exact reference files, symbols, config keys,
Last-Good behavior, trigger, state machine, success/failure/recovery paths,
retry policy, edge cases, authority boundary, current behavior and differences.
It must also include:

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
OPTIMIZATION_DIMENSIONS =
```

Missing evidence blocks implementation. Reference conflict, missing reference,
or deliberate deviation returns the workline to Project Control. Web may render
authoritative state and submit intent; it does not define gameplay semantics.

The exemption list in `PRE_IMPLEMENTATION_REUSE_GATE` does not exempt this hard
gate. Any behavior-affecting bug fix, maintenance, refactor or optimization still
requires the OpenKore reference-first gate. Before that gate passes, only bounded
read-only diagnostics and isolated instrumentation that preserves gameplay
semantics are allowed.

## 6. Continuation discipline

Existing worklines continue through:

```text
LAST_GOOD
→ CURRENT
→ FIRST_BROKEN_TRANSITION
→ MINIMAL_FIX
→ BOUNDED_TEST
→ LIVE_ACCEPTANCE
→ BROWSER_ACCEPTANCE
→ GIT_CHECKPOINT
```

Use `WORKLINE_CONTINUATION_TEMPLATE_V1`, continue from `CURRENT_PHASE`, and do
not restart an audit. Historical PASS, runtime proof, Browser evidence, and
checkpoints are preserved evidence and are not re-audited without an explicit
Project Control order.

## 7. Acceptance ladder

Keep these layers separate:

```text
SOURCE_PASS
BACKEND_PASS
LIVE_ACCEPTANCE
BROWSER_UI_PASS
PLAYER_WEB_E2E_PASS
```

For Player Web, the applicable full result requires:

```text
SOURCE_PASS
+ BACKEND_PASS
+ BROWSER_UI_PASS
+ PLAYER_WEB_E2E_PASS
```

API 200, DB state, native logs, command confirmation, and source tests cannot
replace Browser E2E evidence.

## 8. Diary gate and Web acceptance

`DIARY_VERSION_GATE` remains `CLOSED` until all of the following are true:

```text
INTERACTIVE_SURFACE_INVENTORY_COMPLETE = YES
ALL_PLAYER_CONTROLS_BROWSER_TESTED = YES
ALL_PLAYER_CONTROLS_PASS = YES
UNKNOWN_UNTESTED_CONTROL_COUNT = 0
PLAYER_WEB_FULL_REGRESSION = PASS
PLAYER_WEB_FULL_INTERACTION_RESTORE = PASS
```

Before that gate closes, do not opportunistically expand Diary, LLM, Sepia,
Psyche, Life Director, or Social Director work.

Full Web acceptance is control-by-control. A family-level PASS never closes an
entire capability family. Parameterized controls require:

```text
CONTROL-BY-CONTROL
+ IMPORTANT STATE COVERAGE
+ PARAMETERIZED LEGAL INPUT COVERAGE
```

For example, every legal farm map must cover eligibility, Browser request,
controller decision, navigation, arrival, AUTO_FARM resume, and Web reconcile.

Real user Browser evidence has priority. If a user's same-session, same-
character flow reproducibly fails while a worker fixture passes, the product
defect remains OPEN. Trace the same Browser session, character, click/request,
and server evidence before changing the result.

## 9. Authoritative capability rules

Parameterized UI capability indicators must use the same authoritative
eligibility source as the server/controller. Web must not create a second
hardcoded allowlist.

World Map farm visibility follows canonical farm eligibility only:

- currently legal farm maps are unmasked and highlighted;
- unavailable maps remain masked and unhighlighted;
- monster presence, spawn data, or map data alone does not authorize farming.

Inventory actions follow authoritative capability:

- usable item: detail shows `使用`;
- equippable item: detail shows `裝備`;
- equipped item: detail shows `卸下`;
- stack quantity appears in the cell and detail;
- double-click is a shortcut, never the only entry point.

Use, Equip, and Unequip must complete Browser action, existing API/command,
SERVER_AGENT/rAthena mutation, authoritative reconcile, and visible result.
Frontend success cannot be fabricated.

## 10. Git checkpoint accuracy

Never describe an old checkpoint as the current patch checkpoint. If a new
patch cannot be isolated from mixed dirty files:

```text
GIT_CHECKPOINT = NONE
GIT_CHECKPOINT_STATUS = BLOCKED_BY_MIXED_FILE
```

An ancestor or previous workline SHA is not a substitute. Use exact-file
staging, use `git add -p <exact-file>` for mixed files, and do not push unless
Project Control explicitly requests it.

## 11. Worker report handling

After every worker report, Project Control must:

1. verify the acceptance evidence;
2. correct checkpoint ownership and status;
3. update `WORKING` / `WAITING` / `BLOCKED` / `HOLD` / `CLOSED`;
4. dispatch a safe next step immediately;
5. start independent worklines when ownership checks permit;
6. update Full Web, Quest, Native, and Diary gates;
7. append the current A-E six-column table.

For an OpenKore-relevant workline, verify these completion fields before moving
the line to `WAITING` or `CLOSED`:

```text
OPENKORE_REFERENCE_REQUIRED = YES / NO
OPENKORE_REFERENCE_TRIGGERED = YES / NO
OPENKORE_REFERENCE_GATE = PASS / FAIL / BLOCKED / NOT_APPLICABLE
OPENKORE_REFERENCE_INHERITED = YES / NO
REFERENCE_DOSSIER =
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
OPENKORE_CAPABILITY_EXISTS = YES / NO / UNKNOWN
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_CONFIG_KEYS =
OPENKORE_LAST_GOOD_BEHAVIOR =
CURRENT_GHOST_ISLAND_BEHAVIOR =
OPENKORE_BEHAVIOR_COMPARED = YES / NO
BEHAVIOR_MAPPING =
REFERENCE_CONFLICT = YES / NO
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
RESULT_EQUIVALENT_OR_BETTER = YES / NO
PLAYER_FLOW_EQUIVALENCE = PASS / FAIL / NOT_TESTED
OPENKORE_CORE_ALIGNMENT_VETO = PASS / FAIL
CHANGE_APPROVED = YES / NO
CHANGE_REJECTED = YES / NO
WORKLINE_DONE = YES / NO
```

Missing fields mean `WORKLINE_DONE = NO`.

## 11A. OPENKORE_CORE_ALIGNMENT_VETO

For every `OPENKORE_REFERENCE_REQUIRED = YES` workline, Project Control must
independently verify all six questions:

```text
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
RESULT_EQUIVALENT_OR_BETTER = YES
```

Any `NO`, `FAIL`, `UNKNOWN` or `NOT_PROVEN` sets:

```text
CHANGE_APPROVED = NO
CHANGE_REJECTED = YES
IMPLEMENTATION_ACCEPTANCE = FAIL
PRODUCTION_DEPLOY = BLOCKED
WORKLINE_DONE = NO
```

`OPTIMIZATION_APPLIED = NO_NOT_NEEDED` is valid when optimization was reviewed and
no behavior change is needed. Source, unit, build and model-confidence results
cannot override this veto. `REGRESSED_DIMENSIONS` must be `NONE`, and any critical
unproven equivalence dimension blocks approval.

The second acceptance is an independent Project Control verification. If the same
gameplay subsystem has two or more downstream blockers, Project Control must run
an upstream assumption recheck before authorizing a third fix:

```text
UPSTREAM_ASSUMPTION_RECHECK = YES
DOWNSTREAM_BLOCKER_COUNT =
CURRENT_CONTRACT_REVALIDATED = YES / NO
OPENKORE_LAST_GOOD_RECHECKED = YES / NO
CONTINUE_CURRENT_DIRECTION = YES / NO
```

For an OpenKore-relevant workline, verify these completion fields before moving
the line to `WAITING` or `CLOSED`:

```text
OPENKORE_REFERENCE_GATE = PASS / FAIL / NOT_APPLICABLE
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_LAST_GOOD_BEHAVIOR =
CURRENT_BEHAVIOR =
BEHAVIOR_MAPPING =
OPENKORE_DEVIATION = YES / NO
GHOST_ISLAND_OPTIMIZATION =
PLAYER_FLOW_EQUIVALENCE = PASS / FAIL / NOT_TESTED
```

Missing fields mean `WORKLINE_DONE = NO`.

## 12. Persistent invariants and routing

The following invariants remain active:

```text
OpenKore runtime = 0
Production authority = PA / SERVER_AGENT → rAthena
Single Runtime Policy = enforced
Persistent Life / Character Life & Social Simulation = long-term North Star
AUTO_FARM != Character Autonomy
LLM != simulation authority
North Star != immediate implementation authorization
```

If evidence points to another layer, stop and return to Project Control for
owner reassignment. Workers do not cross A-E scope on their own.

## 13. Versioning

```text
PROTOCOL = PROJECT-CONTROL-RESPONSE-PROTOCOL-V1
```

Substantive future changes use `V1.1` or `V2` and update the `AGENTS.md`
authority pointer in the same change.
