# PROJECT_ROADMAP

Canonical project roadmap index for 鬼島傳說 (terminal-arpg).

This is the single top-level planning entrypoint. Detailed future systems live
under `docs/roadmap/`, but this file remains the navigation index and the
authority for ordering, status labels and authorization state.

```text
ROADMAP_ID:                GOV1-PROJECT-ROADMAP
CANONICAL_ROADMAP_FILE:    docs/PROJECT_ROADMAP.md
DETAILED_ROADMAP_DIR:      docs/roadmap/
TASK_TYPE:                 DOCUMENTATION / GOVERNANCE ONLY
IMPLEMENTATION:            NOT AUTHORIZED BY THIS DOCUMENT
```

This document does not authorize implementation. A feature may be `PLANNED` and
still have `IMPLEMENTATION_AUTHORIZED = NO`.

## 1. Planning status vocabulary

Use these exact planning states:

| State | Meaning |
| --- | --- |
| `IDEA` | Captured direction, not yet shaped into a plan |
| `PLANNED` | Shaped plan with scope and dependencies, not authorized to build |
| `BLOCKED` | Plan exists but an explicit dependency or decision is missing |
| `ACTIVE` | Currently authorized and being worked |
| `VALIDATION` | Implemented, awaiting accepted player-flow / governance evidence |
| `COMPLETE` | Accepted, with evidence recorded in the relevant source of truth |
| `DEFERRED` | Intentionally postponed |

Every roadmap item must also carry:

```text
IMPLEMENTATION_AUTHORIZED = YES / NO
```

`PLANNED` + `IMPLEMENTATION_AUTHORIZED = NO` is the normal state for future work.

## 2. Product North Star

```text
PRODUCT_NORTH_STAR = Persistent Life
```

A player with limited real-world social time can enter a living world whose
familiar characters continue to live while the player is away.

Core architecture invariant:

```text
rAthena / SERVER_AGENT = WORLD AUTHORITY
Event Ledger           = FACTUAL HISTORY
LLM                    = INTERPRETATION / NARRATION / DIALOGUE ONLY
```

LLM MUST NOT become simulation authority. It must not be the authority for
combat outcomes, damage, drops, Zeny, inventory, quest state, party state, NPC
state, movement results, rewards, or any authoritative game-state mutation.

Canonical definition: `docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md`
(section `Short-Term Product North Star — Persistent Life V1`).

## 3. Current engineering priority

```text
CURRENT_ENGINEERING_PRIORITY = OPENKORE EXIT
PLANNING_STATE               = ACTIVE
IMPLEMENTATION_AUTHORIZED    = YES (existing authorized engineering line)
SOURCE_OF_TRUTH              = docs/openkore-exit-source-of-truth.md
```

Accepted high-level state (repository evidence is authority; do not reconstruct
runtime state beyond committed/current evidence):

| Item | Status | Evidence |
| --- | --- | --- |
| OpenKore capability census / harvest | `COMPLETE` | `docs/openkore-harvest-registry.md` |
| Gate1A combat / loot | `PASS` | `docs/openkore-exit-source-of-truth.md` (Gate 1A Milestone Closure) |
| Gate1B survival / recovery | `PASS` | `docs/openkore-exit-source-of-truth.md` (Gate 1B Milestone Closure) |
| Gate2 supply | `PASS` | `docs/openkore-exit-source-of-truth.md` (Gate 2 Milestone Closure) |
| Gate3 relocation / navigation | `PASS` | `docs/openkore-exit-source-of-truth.md` (Gate 3 Milestone Closure) |
| Production PA runtime | `ENABLED` | `docs/PRODUCTION_PA_CANARY_CAPABILITY_PROFILE.md` |
| Production PA Canary | `PASS` | `docs/PRODUCTION_PA_CANARY_CAPABILITY_PROFILE.md` |
| Staged OpenKore removal | `ACTIVE` | `docs/openkore-exit-source-of-truth.md` |

Boundary: `OPENKORE_REMOVED = NO` and `PRODUCTION_READY = NO`. Gate 1A/1B/2/3
passing does not mean OpenKore Exit is complete.

## 4. Roadmap order

Intended high-level sequence:

```text
PHASE 1  OpenKore Exit / SERVER_AGENT migration
   ↓
PHASE 2  Persistent Life Diary V1            (PL1-PERSISTENT-LIFE-DIARY)
   ↓
PHASE 3  Persistent Social PA V1             (PL2-PERSISTENT-SOCIAL-PA)
   ↓
PHASE 4+ Expanded autonomous Persistent Life society / social world
```

No calendar dates are assigned. If an existing canonical schedule later exists,
reference it rather than inventing dates here.

## 5. Roadmap index

```text
CURRENT:
  OpenKore Exit / SERVER_AGENT migration — ACTIVE

NEXT:
  PL1-A Factual Diary Vertical Slice — ACTIVE / AUTHORIZED
  (scoped Project Control authorization; deterministic Event Ledger facts,
   authenticated read-only API, existing Web surface, Browser acceptance;
   Diary window is based on unseen facts, and may include ACTIVE sessions)

  PL1 Persistent Life Diary V1 remainder — PLANNED / NOT AUTHORIZED
  (LLM reflection, Diary storage expansion, memory context, and later modules
   require separate authorization)

AFTER PL1:
  PL2 Persistent Social PA V1 — PLANNED / NOT AUTHORIZED
  (start condition: Diary V1 canonical acceptance complete AND Project Control
   explicitly authorizes PL2)

CROSS-CUTTING DESIGN:
  HYBRID_LOCAL_COMBAT_MIGRATION — DESIGN_ACCEPTED / STAGE1_SHADOW_OBSERVER_ACTIVE
  (Global AutoLoot to inventory is a product accepted direction; rAthena owns
   drop resolution and authoritative item add; PA keeps inventory lifecycle,
   weight, supply, storage/sell, navigation, quest, social and Life ownership;
   Stage 2 authority transfer remains unauthorized)

LONG TERM:
  Expanded autonomous Persistent Life society / social world — PLANNED /
  NOT AUTHORIZED
```

Dependency arrows:

```text
OpenKore Exit (PHASE 1)
   └─→ PL1 Persistent Life Diary V1 (PHASE 2)
             └─→ PL2 Persistent Social PA V1 (PHASE 3)
                       └─→ PHASE 4+ Expanded autonomous society
```

The unscoped PL1 remainder and PL2 are not authorized by this roadmap. PL1-A is
the single scoped exception authorized by Project Control. Gates never advance
by source inspection alone; each slice needs its own acceptance evidence.

## 6. Detailed roadmap documents

| ROADMAP_ID | Document | Status | IMPLEMENTATION_AUTHORIZED |
| --- | --- | --- | --- |
| `PL1-PERSISTENT-LIFE-DIARY` | `docs/roadmap/persistent-life-diary-v1.md` | `PLANNED` | `NO` |
| `PL1-A-FACTUAL-DIARY` | `docs/roadmap/persistent-life-diary-v1.md#scoped-authorization-pl1-a-factual-diary-vertical-slice` | `ACTIVE` | `YES` |
| `PL2-PERSISTENT-SOCIAL-PA` | `docs/roadmap/persistent-social-pa-v1.md` | `PLANNED` | `NO` |
| `HYBRID-LOCAL-COMBAT-MIGRATION` | `docs/roadmap/hybrid-local-combat-migration.md` | `PLANNED (DESIGN_ACCEPTED, STAGE1_ACTIVE)` | `NO` |

Summary of PL1: characters live through a real in-world day, then produce at most
one bounded LLM diary generation per in-world day, grounded in Event Ledger facts.

Summary of PL2: a small population of autonomous persistent social characters
with their own lives, multidimensional relationships derived from real shared
events, proactive social behavior, and PA-to-PA social graph — without dependency
engineering.

## 7. Mandatory reuse gate for all future PL1 / PL2 work

Every implementation slice of PL1 and PL2 MUST run:

```text
PRE_IMPLEMENTATION_REUSE_GATE = PASS
```

Canonical gate authority: `docs/pre-implementation-reuse-gate.md`.
OpenKore preserved knowledge: `docs/openkore-harvest-registry.md`.

Future work must reuse existing capabilities where possible, including:

- `SERVER_AGENT`
- combat
- survival
- supply
- PA navigation
- scripted transport
- quest runtime
- party / follow
- Event Ledger
- Persistent Life foundation
- live status
- Diary V1
- OpenKore harvested party / social / follow / reconnect behaviors

Do not create parallel simulation systems.

## 8. Related authorities

| Topic | Authority |
| --- | --- |
| Product constitution / North Star | `docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md` |
| OpenKore Exit canonical status | `docs/openkore-exit-source-of-truth.md` |
| Persistent Agent implementation roadmap | `docs/persistent-server-agent-roadmap.md` |
| Production PA canary profile | `docs/PRODUCTION_PA_CANARY_CAPABILITY_PROFILE.md` |
| Reuse gate | `docs/pre-implementation-reuse-gate.md` |
| Character Autonomy / Player Agency | `docs/roadmap/character-autonomy-player-agency.md` (`PLANNED`, `IMPLEMENTATION_AUTHORIZED = NO`) |
| RO World Context / Character Autonomy Research | `docs/research/ro-world-context-autonomy-v1.md` (`RESEARCH_REFERENCE`, checkpoint `03c53a14a2187bd5c4c6752b409fb60ffa45db43`; context/bias/meaning only, no deterministic behavior or authority) |
| Current status snapshot | `docs/CURRENT_STATUS.md` |
| Actionable task list | `docs/TODO.md` |
| Legacy RO milestone roadmap (superseded) | `docs/ROADMAP.md` |

Governance rule: documentation explains the program; it does not replace code,
tests, or locked sources. If a status document conflicts with repository
evidence, fix the document or open an audit item before claiming completion.
