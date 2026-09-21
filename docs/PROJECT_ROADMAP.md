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

Local Hunting is the primary runtime loop for normal character activity and is
a very high optimization priority. The accepted architecture keeps PA ownership
of intent, journey, interruption and resume while migrating proven same-map
combat capabilities to rAthena through separate gates. Canonical decision:
`docs/architecture/local-hunting-hybrid-architecture.md`.

Near-term Local Hunting priority:

```text
P0/P1 = Stage 2 reentry proof, bounded melee promotion, target/retarget parity,
        NORMAL_ATTACK_CLASS_PARITY_GATE, AutoSkill reference mining,
        Stage 3A offensive skills, Stage 3B self support,
        Stage 3C party support / follow, Global AutoLoot with authoritative
        LOOT_ACQUIRED, same-map path and stuck recovery
LATER = combat potion, ammo, advanced roaming, party / kill-steal policy
```

Class-aware combat profiles are accepted design for Local Hunting:

```text
CLASS_AWARE_COMBAT_PROFILE = YES
JOB_DETERMINES_AVAILABLE_OPTIONS = YES
PLAYER_DETERMINES_PREFERRED_PROFILE = YES
RATHENA_DETERMINES_LEGAL_EXECUTION = YES
PA_DETERMINES_INTENT_AND_INTERRUPTION = YES
PARTY_SUPPORT_FIRST_CLASS = YES
SKILL_ONLY_NORMAL_ATTACK_OFF_SUPPORTED = REQUIRED
AUTOSKILL_REFERENCE_FIRST = YES
CLASS_AWARE_COMBAT_PROFILE_IMPLEMENTATION_STARTED = NO
NORMAL_ATTACK_CLASS_PARITY = NOT_YET_PROVEN
```

The profile catalog is `MELEE_DAMAGE`, `RANGED_DAMAGE`, `SKILL_CAST`,
`HYBRID_DAMAGE`, `HEAL_SUPPORT`, `COMBAT_SUPPORT`, `FOLLOW_SUPPORT` and
`PASSIVE_FOLLOW`. Availability derives from canonical job, skill, equipment and
attack-type capabilities. This design does not authorize a new Skill Executor
implementation or a hardcoded one-build-per-job table.

## Product milestone order

The accepted post-foundation product sequence is:

```text
M1 LOCAL_HUNTING_V1
   -> hard gate
M2 NOVICE_TO_EDEN_LV40_QUEST_AUTOMATION_V1 + QUEST_UI_V1
   -> hard gate
M3 CHARACTER_AUTONOMY_V1
```

### M1 LOCAL_HUNTING_V1

```text
GOAL = Make long-running server-authoritative Hunting and AutoSkill a usable
       product capability.
DEPENDENCIES = OpenKore Exit foundation, rAthena authority, PA intent/journey/
               supply/return/interrupt/resume contracts, Local Hunting ADR.
EXIT_GATE = Normal attack parity for melee, bow/ranged and gun/ranged;
            AutoSkill target and ground execution with level, SP, range,
            cooldown, cast time and effect proof; SKILL_ONLY and HYBRID modes;
            Global AutoLoot to inventory with authoritative LOOT_ACQUIRED;
            no Supply, cross-map navigation, return-to-farm or interrupt/resume
            regression; Browser acceptance where UI is involved.
NON_GOALS = Character Autonomy, Life Director, Social Director, unrestricted
            Free Agent behavior, full Party Support completion and generational
            simulation.
CURRENT_STATUS = IN_PROGRESS
```

M1 detailed authority and staged gates remain in
`docs/roadmap/hybrid-local-combat-migration.md` and
`docs/architecture/local-hunting-hybrid-architecture.md`.

### M2 NOVICE_TO_EDEN_LV40_QUEST_AUTOMATION_V1 + QUEST_UI_V1

```text
GOAL = Complete one continuous character progression flow from new-character
       onboarding through novice and Eden equipment progression to the Lv40
       milestone, with the accepted Quest Journal / dialogue / interaction /
       minimap context / runtime log Web surface.
DEPENDENCIES = M1 Hunting and AutoSkill stability, Quest Flow First, rAthena
               quest authority, Quest Runtime, PA Journey, Supply, Return and
               Player Interaction contracts, Quest and OpenKore reference Atlas.
EXIT_GATE = Fresh-character flow reaches the Eden Lv40 milestone through
            server-authoritative quest transitions, combat, NPC interaction,
            required player choices and recovery; Quest UI renders authoritative
            state; Supply, death, reconnect and interruption preserve the Quest
            parent intent; Browser final acceptance passes for the Web surface.
NON_GOALS = Character Autonomy decision layer, unrestricted agent behavior,
            Life/Social simulation, relationship, romance and generational
            systems.
CURRENT_STATUS = DESIGN / EXISTING PARTIAL QUEST RUNTIME
```

Quest UI must keep dialogue authority, quiz judgment and quest state in
rAthena / Quest Runtime. Web may expose required human choices and confirmations
without becoming low-level quest execution authority.

### M3 CHARACTER_AUTONOMY_V1

```text
GOAL = Add a bounded high-level decision layer that chooses the next legal
       intent for persistent characters while reusing canonical executors.
DEPENDENCIES = M1 accepted execution substrate, M2 continuous Quest progression,
               PA intent/journey/interrupt/resume, Local Hunting, Supply, Quest
               Runtime, Social foundations and canonical rAthena runtime.
EXIT_GATE = Decision layer consumes character state, job, level, map, inventory,
            supply, quest, available goals, parent intent, social candidates and
            interruption state; emits a bounded NEXT_HIGH_LEVEL_INTENT; admin
            autonomous characters and opted-in player characters execute through
            PA/rAthena/Quest/Local Hunting; no second runtime or authority bypass;
            reconnect, quarantine and resume evidence passes.
NON_GOALS = Full Life Simulation, unrestricted Free Agent, direct attack or
            teleport, direct quest or inventory mutation, LLM high-frequency
            control, romance, generations and broad social simulation.
CURRENT_STATUS = DESIGN_ACCEPTED / IMPLEMENTATION_NOT_STARTED
```

M3 autonomy is a decision layer only. `HUNT`, `QUEST`, `SUPPLY`, `TRAVEL`,
`FOLLOW`, `SOCIAL`, `REST` and `IDLE` remain candidates subject to subsystem
readiness; unavailable executors must not be advertised as runnable intents.

```text
LOCAL_HUNTING_BEFORE_AUTONOMY = YES
QUEST_EXECUTION_BEFORE_AUTONOMY = YES
AUTONOMY_REUSES_EXISTING_EXECUTORS = YES
AUTONOMY_MUST_NOT_CREATE_SECOND_RUNTIME = YES
ADMIN_AUTONOMOUS_CHARACTERS_USE_CANONICAL_RUNTIME = YES
PLAYER_AUTONOMY_IS_HIGH_LEVEL_DECISION_LAYER = YES
```

Supply Journey, Quest, Social and Life remain parallel core systems with their
own authority and acceptance gates.

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
  HYBRID_LOCAL_COMBAT_MIGRATION — ACCEPTED / MIGRATION_IN_PROGRESS /
  STAGE2_MELEE_CANARY_BOUNDED_PASS_NOT_GLOBALLY_PROMOTED
  (LOCAL_HUNTING_IS_PRIMARY_RUNTIME_LOOP = YES. Global AutoLoot to inventory is
   accepted; Global AutoStore is forbidden. rAthena owns
   drop resolution and authoritative item add; PA keeps inventory lifecycle,
   weight, supply, storage/sell, navigation, return-to-farm, quest, social,
   Life and parent-intent ownership. Stage 2 global promotion remains closed
   until return-to-farm creates a new lease and produces at least three
   authoritative MONSTER_HIT events. Reference dependency is
   rAthena server-side autocombat checkpoint 961ac3c, whose mature floor is
   same-map server-side combat. Public evidence does not establish cross-map
   Supply, return-to-farm or auto-resume after Supply; those remain PA-owned.
   Regression fixture: `docs/fixtures/hybrid-supply-return-baseline-150069.yml`.)

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
| `HYBRID-LOCAL-COMBAT-MIGRATION` | `docs/roadmap/hybrid-local-combat-migration.md` | `MIGRATION_IN_PROGRESS (STAGE2_CANARY_BOUNDED, GLOBAL_PROMOTION_PENDING)` | `NO` |

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
| Character Life / Social long-term direction | `docs/character-life-social-simulation-roadmap.md` (M3 and later design dependency; implementation remains gated) |
| Character Autonomy / Player Agency | `docs/roadmap/character-autonomy-player-agency.md` (`PLANNED`, `IMPLEMENTATION_AUTHORIZED = NO`) |
| Quest Flow / reference authority | `docs/quest-reference/README.md`, `docs/rathena-reference/quest-automation.md`, `docs/openkore-reference/quest-automation.md` |
| RO World Context / Character Autonomy Research | `docs/research/ro-world-context-autonomy-v1.md` (`RESEARCH_REFERENCE`, checkpoint `03c53a14a2187bd5c4c6752b409fb60ffa45db43`; context/bias/meaning only, no deterministic behavior or authority) |
| Current status snapshot | `docs/CURRENT_STATUS.md` |
| Actionable task list | `docs/TODO.md` |
| Legacy RO milestone roadmap (superseded) | `docs/ROADMAP.md` |

Governance rule: documentation explains the program; it does not replace code,
tests, or locked sources. If a status document conflicts with repository
evidence, fix the document or open an audit item before claiming completion.
