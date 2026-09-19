# WORKLINE_CONTINUATION_TEMPLATE_V1

STATUS: CANONICAL

POLICY AUTHORITY:
AGENTS.md / PC-DISPATCH-STANDARD-v1.1

PURPOSE:
Canonical structure for continuing an existing workline
without restarting discovery or losing current state.

---

## 0. CORE PRINCIPLE

```text
CONTINUE FROM CURRENT STATE.
DO NOT RESTART AUDIT.
```

Restart discovery only when:

```text
CURRENT evidence is invalid
```

or:

```text
Project Control explicitly orders a Last-Good reconstruction.
```

Short form:

```text
For existing workline:
Use WORKLINE_CONTINUATION_TEMPLATE_V1.
Continue from CURRENT_PHASE.
Do not restart audit.
```

---

## 1. CONTINUE EXISTING WINDOW

```text
【CONTINUE EXISTING WINDOW】
<window name>
```

---

## 2. WORKLINE_ID

Reuse the original ID.

```text
WORKLINE_ID = <original stable identifier>
```

A continuation MUST NOT create a second duplicate workline.

---

## 3. CURRENT_PHASE

```text
CURRENT_PHASE =
```

Allowed values:

```text
SOURCE_ANALYSIS
BUILD
DEPLOY
LIVE_ACCEPTANCE
BROWSER_ACCEPTANCE
BLOCKED
```

---

## 4. LAST_CONFIRMED_GOOD

```text
LAST_CONFIRMED_GOOD =
```

Record only the last transition that was actually proven successful.

---

## 5. CURRENT_BLOCKER

```text
EXPECTED =
ACTUAL =

FIRST_BROKEN_TRANSITION =

BLOCKER_LAYER =
```

`BLOCKER_LAYER` is limited to:

```text
CONFIG
COMMAND_CONTRACT
CONTROLLER
READ_MODEL
TRANSPORT
ROUTE_RESOLUTION
COMMAND_DELIVERY
NATIVE_INTAKE
RUNTIME_EXECUTION
SERVICE_INTERACTION
RETURN
RESUME
BROWSER_RENDER
RUNTIME_LIFECYCLE
TEST_ENVIRONMENT
GIT_DEPLOY_CONFLICT
```

---

## 6. SOURCE_CHANGE_REQUIRED

```text
SOURCE_CHANGE_REQUIRED = YES / NO / UNKNOWN
```

If `UNKNOWN`:

```text
bounded trace first.
```

Do not modify source before the first broken transition is located.

---

## 7. DO NOT REPEAT

List work already completed that must not be rerun, for example:

```text
Last-Good reconstruction complete
canonical resolver identified
Native build already passed
browser root cause already located
reference Gate already completed
```

Purpose: prevent a re-continued worker from re-burning tokens on finished work.

---

## 8. NEXT_MINIMAL_ACTION

```text
NEXT_ACTION =
```

Exactly one minimal action. Opening several new directions at once is forbidden.

---

## 9. REFERENCE / POLICY

Every continuation handoff MUST also carry the long-term product direction:

```text
LONG_TERM_PRODUCT_DIRECTION = Character Life & Social Simulation
CANONICAL_DIRECTION_DOC      = docs/character-life-social-simulation-roadmap.md
```

Do not paste the roadmap. For scopes listed in `AGENTS.md`
(`CHARACTER_LIFE_SOCIAL_SIMULATION_DIRECTION`), report
`CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS / FAIL / N/A`.

Continue the policy already required by the original workline, for example:

```text
Follow OPENKORE_REFERENCE_POLICY.
Reference Gate already completed at <evidence>.
```

If reference suitability has not yet been evaluated:

```text
Execute only the missing Gate subsection.
```

Do not rerun the entire Gate.

---

## 10. LIVE TEST INVALIDATION RULE

If acceptance is disturbed by any of the following:

```text
map restart
Dashboard restart
external deploy
resident char lost
unrelated worker modified runtime
```

then:

```text
TEST = INVALIDATED
```

Do not judge the source FAIL. Re-obtain a stable window and retest.

---

## 11. FAIL RULE

On continuation failure report only:

```text
CURRENT_PHASE =
LAST_CONFIRMED_GOOD =
EXPECTED =
ACTUAL =
FIRST_BROKEN_TRANSITION =
BLOCKER_LAYER =
SOURCE_CHANGE_REQUIRED =
```

Do not rewrite the whole project history.

---

## 12. FINAL REPORT

```text
12-16 lines maximum
```

Report only:

```text
CURRENT_PHASE
LAST_CONFIRMED_GOOD
FIRST_BROKEN_TRANSITION
SOURCE_CHANGE_REQUIRED
FILES_CHANGED
TESTS
LIVE_PASS
BROWSER_UI_PASS
NEXT_ACTION / CLOSED
```

---

## 13. VERSIONING

```text
TEMPLATE = WORKLINE_CONTINUATION_TEMPLATE_V1
```

No silent semantic change. Future substantive change:

```text
V1.1
V2
```

and the `AGENTS.md` reference must be updated in the same change.
