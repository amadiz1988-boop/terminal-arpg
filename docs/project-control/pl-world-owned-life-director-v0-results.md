# PL-WORLD-OWNED-LIFE-DIRECTOR-V0

```text
WINDOW = LIFE｜WORLD_OWNED V0
WORKLINE_ID = PL-WORLD-OWNED-LIFE-DIRECTOR-V0
PHASE = 1 isolated deterministic PoC
PRODUCTION = STOPPED / NOT TOUCHED
```

## Reuse gate

`PRE_IMPLEMENTATION_REUSE_GATE = PASS`

Record: `docs/project-control/pl-world-owned-life-director-v0-reuse-gate.json`.

The PoC reuses the existing Persistent Agent lifecycle vocabulary, supply and
recovery boundaries, quest/event projection conventions and the harvested
OpenKore behavior contracts. It adds a dependency-free pure reducer only; it
does not create a second executor, runtime, database schema or Web command.

## Contract

```text
CONTROL_AUTHORITY = WORLD_OWNED
PLAYER_CONTROL_PATH = NONE
CURRENT_MACRO_GOAL = HUNT | SUPPLY | RECOVER | QUEST | SOCIAL_BREAK | IDLE
GOAL_STACK = parent goals plus current goal
INTERRUPT = active SUPPLY or RECOVER cause with parent goal
RESUME_TARGET = explicit parent goal while interrupted
DECISION_REASON_CODES = deterministic reason-code list
```

`CONTINUE_CURRENT_ACTIVITY` is always present as the formal candidate. A
decision boundary is required before a continuation decision is recorded.
Without that boundary the reducer returns `NO_DECISION` with
`REEVALUATION_NOT_DUE`, so a caller cannot select a new life direction every
second.

The deterministic harness covers:

```text
WORLD_OWNED character
→ initial HUNT
→ normal continuation
→ SUPPLY interrupt
→ supply complete
→ resume HUNT
→ danger / RECOVER interrupt
→ recover
→ resume HUNT
```

All decisions carry `authority = WORLD_OWNED`, `actor = SELF` and
`playerControlPath = NONE`. Player-originated goal commands are rejected and do
not mutate the goal stack.

## Explicit non-goals

戀愛、公會自主、FREE_AGENT release flow、Relationship Graph、Diary、LLM、
高頻 personality simulation、production deploy、第二套 runtime、Social
Director implementation 均未加入。

## Verification

```text
TEST = node scripts/test-world-owned-life-director-v0.mjs
EXPECTED = deterministic component test only
RUNTIME = not started
LIVE ACCEPTANCE = not applicable for isolated PoC
```

`docs/CURRENT_STATUS.md` was not edited because it already contains unrelated
mixed working-tree changes; this dedicated result record is the isolated status
evidence for the workline.
