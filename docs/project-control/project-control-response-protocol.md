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

## 3. Dispatch wrapper and model routing

Before each dispatch, tell the user outside the worker prompt:

```text
貼到：A / B / C / D / E
模型：GPT-5.6 Sol｜中 / 高 / 其他
1.5× Fast：ON / OFF
```

The model and Fast choice must not be placed in the routing prompt header. This
prevents the worker from interpreting them as a transfer instruction.

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
