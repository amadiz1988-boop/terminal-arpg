---
name: quest-flow-first
description: Require normal-player quest-flow understanding, server-authority tracing, historical reuse and an explicit hard gate before Quest, NPC, dialogue, navigation, job-change or Quest Runtime gameplay semantics are changed.
---

# Quest Flow First

## Trigger

Use for any discussion, planning, dispatch, debugging, implementation,
refactor, migration, recovery or testing involving Quest, NPC, hidden NPC,
OnTouch, dialogue, quest state, Quest Runtime, novice/onboarding, Eden, first
job, second job, job change, event quest, quest navigation, quest warp, quest
recovery or automatic questing. The trigger applies to Project Control and
documentation discussions as well as Worker source work.

## rAthena Reference Atlas Precondition

Before the Quest Flow First gate, search
`docs/rathena-reference/reference-index.yml` by quest/topic keyword. Read only
the relevant Atlas topic and `lookup-playbook` section when needed, follow the
exact authoritative rAthena paths they identify, then check Project Last-Good
and OpenKore reference when applicable.

```text
ATLAS_SEARCHED = YES
AUTHORITATIVE_SOURCE_CHECKED = YES
PROJECT_LAST_GOOD_CHECKED = YES
```

The Atlas is an index and lookup aid. It does not override current canonical
rAthena source, project-specific server rules or authoritative config. Record
`REFERENCE_ATLAS_STALE_OR_CONFLICTING = YES` on conflict and schedule Atlas
correction. Declare `REFERENCE_GAP = CONFIRMED` only after all three checks
above are proven. Atlas lookup does not replace this Skill.

## Purpose and Player Flow First

The fixed order is:

```text
RATHENA_REFERENCE_ATLAS_LOOKUP
-> UNDERSTAND PLAYER FLOW
-> TRACE SERVER AUTHORITY
-> RECOVER EXISTING / LAST-GOOD WORK
-> MAP CURRENT QUEST RUNTIME
-> CLASSIFY INTERACTIONS
-> FIND FIRST_BROKEN_TRANSITION
-> REUSE / ADAPT
-> MINIMAL IMPLEMENTATION
-> LIVE PLAYER-FLOW ACCEPTANCE
```

Before choosing automation, answer:

```text
What does a normal player do from this quest step until the server
recognizes the step as complete?
```

Evidence must cover player flow, rAthena script/state result, quest metadata,
historical Last-Good behavior and Current Quest Runtime. A partial answer sets
`GAMEPLAY_SEMANTIC_IMPLEMENTATION = BLOCKED`; only read-only archaeology,
source tracing, player-flow research, historical reconstruction, runtime
comparison and test-only diagnostics remain allowed.

## Evidence Roles

```text
normal player guide / Wiki / community flow = what the player actually does
rAthena NPC / quest scripts = what the server actually executes
rAthena quest_db = quest IDs and condition metadata
OpenKore-era Last-Good = how the project previously automated it successfully
Current Quest Runtime = what was migrated and where it currently differs
```

Conflicting evidence creates `REFERENCE_CONFLICT`; do not silently choose one
source.

## Reuse Before Rebuild

Inspect historical OpenKore plugins, macros, quest state machines, route
manifests, acceptance evidence, Current Quest Runtime and rAthena scripts.
Classify relevant components as:

```text
REUSE / ADAPT / SUPERSEDED / WRONG_ASSUMPTION / MISSING
```

OpenKore runtime remains retired at zero. Its proven quest knowledge remains
historical migration evidence.

## Quest Reference Dossier

Use `docs/quest-reference/<quest-key>.md`; schema:
`docs/quest-reference/README.md`. Inherit an existing dossier until the
server/version/script changes or new evidence creates a conflict.

Required fields include:

```text
QUEST / SERVER / EPISODE / VERSION / KNOWN_VARIANTS
PLAYER_FLOW / PLAYER_FLOW_SOURCE
RATHENA_SCRIPT_FILES / QUEST_DB_ENTRIES
QUEST_IDS / NPC_SYMBOLS / NPC_COORDS / MAPS / WARPS
ONTOUCH_TRIGGERS / HIDDEN_NPCS / DIALOGUE_SEQUENCE / MENU_CHOICES
ITEM_REQUIREMENTS / KILL_REQUIREMENTS / CLASS_REQUIREMENTS / LEVEL_REQUIREMENTS
SERVER_AUTHORITATIVE_STATE_TRANSITIONS
OPENKORE_ERA_LAST_GOOD / HISTORICAL_PROJECT_IMPLEMENTATION
CURRENT_QUEST_RUNTIME / CURRENT_SEQUENCE / CURRENT_ROUTE_MANIFEST
REUSABLE_COMPONENTS / MISSING_COMPONENTS / WRONG_CURRENT_ASSUMPTIONS
AUTOMATION_MAPPING / FIRST_BROKEN_TRANSITION
REFERENCE_CONFLICT / UNRESOLVED_UNCERTAINTIES / IMPLEMENTATION_ALLOWED
WEB_CONTROL_REQUIRED / SERVER_AGENT_AUTONOMY_ALLOWED
STEP_EXECUTION_CLASSIFICATION
```

## Interaction Classification

Trace script, quest state, dialogue, player action and server result before
classifying each key interaction as one or more of:

```text
VISIBLE_NPC / HIDDEN_NPC / ONTOUCH_TRIGGER / QUEST_TRIGGER
CLIENT_NAVIGATION_HINT / DIALOGUE / MENU_SELECTION / REAL_WARP
SCRIPTED_TRANSFER / ITEM_USE / ITEM_CHECK / KILL_CONDITION
QUEST_STATE_CHECK / CLASS_CHANGE / SERVER_STATE_CHANGE
```

`navigateto()` or a coordinate alone does not establish the interaction type.

## Quest Autonomy Flexibility

Quest Flow First defines correct semantics, required conditions, valid
transitions and completion criteria. It does not require every internal step to
have a Player Web button. SERVER_AGENT / Quest Runtime may autonomously
navigate, search, retarget, fight, avoid prohibited targets, solve bounded
routes, resume after death, recover interruption, sequence NPC interactions,
repeat valid substeps and select approved deterministic options when the quest
flow and server authority are proven.

Classify each step as:

```text
AUTONOMOUS / PLAYER_DECISION / PLAYER_CONFIRMATION / WEB_OPTIONAL /
SERVER_AGENT_INTERNAL
```

Typical autonomous steps include GO_NPC, maze traversal, combat trials,
target search, no-kill-zone traversal with prohibition rules and deterministic
dialogue continuation. Meaningful irreversible choices are
`PLAYER_DECISION`; final job-change confirmation is
`PLAYER_CONFIRMATION` when product design requires it.

`WEB_CONTROL_REQUIRED = NO` permits internal execution when the Quest Flow
First, Server Authority and automation contract gates pass. Web may expose
START, PAUSE, RESUME, CANCEL, STATUS, LOG, required human choice or required
confirmation without exposing low-level actions.

The actual blockers are:

```text
QUEST_SEMANTICS_UNKNOWN
SERVER_AUTHORITY_NOT_PRESERVED
AUTOMATION_CONTRACT_UNDEFINED
```

Web control absence alone does not block autonomous execution.

## Authority Rule

rAthena remains authoritative for quest state, NPC/script progression,
inventory, kills, class, map, warp and completion. Reuse generic primitives
such as `GO_NPC`, `TALK_NPC`, `DIALOG_NEXT`, `DIALOG_MENU_SELECT`, `GO_MAP`,
`WAIT_QUEST_STATE`, `COLLECT_ITEM`, `FARM_UNTIL`, `USE_ITEM` and
`ALLOCATE_SKILL` where they express the proven player flow.

Do not fake completion with fake warp, `pc_setpos` shortcut, SQL quest
mutation, checkpoint mutation, injected result, forced progression or direct
reward injection.

## OpenKore Gate Integration

When OpenKore-era behavior applies:

```text
RATHENA_REFERENCE_ATLAS_LOOKUP
-> QUEST_FLOW_FIRST_HARD_GATE
-> OPENKORE_REFERENCE_ATLAS_LOOKUP
-> OPENKORE_REFERENCE_GATE
-> PROJECT_LAST_GOOD_MAPPING
-> CURRENT_QUEST_RUNTIME_MAPPING
-> FIRST_BROKEN_TRANSITION
-> implementation
```

Complete the focused `docs/openkore-reference/reference-index.yml` lookup after
the player flow is understood, then complete the existing
`OPENKORE_REFERENCE_GATE_V1.1`. Classify the mature behavior as
`REPRODUCE`, `ADAPT`, `IMPROVE`, `REJECT_LEGACY` or `NOT_APPLICABLE`. Do not
duplicate or replace that gate.

## Two-Blocker Circuit Breaker

After two downstream blockers or gameplay-semantic repairs in one Quest flow,
stop before a third fix and reopen:

```text
PLAYER_FLOW / RATHENA_SCRIPT / HISTORICAL_LAST_GOOD
CURRENT_RUNTIME_MAPPING / WRONG_CURRENT_ASSUMPTIONS
```

Record:

```text
UPSTREAM_ASSUMPTION_RECHECKED = YES
DOWNSTREAM_BLOCKER_COUNT =
THIRD_SEMANTIC_FIX_ALLOWED = NO
```

## Novice Anti-Pattern and Future Coverage

Do not define `iz_int04 (18,30)` as navigation-only from `navigateto()` or a
coordinate. Historical `process_onboarding()` is variant-aware: it finds the
current variant's injured NPC, completes the interaction and then moves to the
actual exit. `iz_int` normalization is not a contract without authoritative
evidence.

Apply the same rule to novice onboarding, Eden, first job, second job, event
quests and future quests. Recover and map existing work before rebuilding.

## Pre-Implementation Hard Gate

All fields below must be `YES` before gameplay-semantic implementation:

```text
QUEST_FLOW_FIRST_TRIGGERED
TARGET_QUEST_IDENTIFIED
TARGET_VERSION_IDENTIFIED
PLAYER_FLOW_UNDERSTOOD
SERVER_SCRIPT_TRACED
INTERACTION_TYPES_CLASSIFIED
HISTORICAL_WORK_CHECKED
LAST_GOOD_REUSE_REVIEWED
CURRENT_RUNTIME_MAPPED
FIRST_BROKEN_TRANSITION_IDENTIFIED
DUPLICATE_IMPLEMENTATION_AVOIDED
REFERENCE_CONFLICT_RESOLVED
```

Any `NO`, `UNKNOWN`, `NOT_PROVEN` or `PARTIAL` sets
`GAMEPLAY_SEMANTIC_IMPLEMENTATION = BLOCKED`. Also report
`WEB_CONTROL_REQUIRED` and `SERVER_AGENT_AUTONOMY_ALLOWED`.

## Post-Implementation Acceptance

Use the real player flow from the nearest legal valid state. Prove the
server-authoritative transition, legitimate actions, recovery, completion
criteria and visible status/log where applicable. Fixture or backend evidence
does not substitute for Player-flow PASS when the actual flow is required.

For navigation, use bounded progress signals, bounded retries, verified
fallbacks and a safe terminal state. Read
`.agents/skills/navigation-stall-safety/SKILL.md` for navigation changes and
`.agents/skills/nearest-valid-test-state/SKILL.md` for test starting state.

## Short Form Rule

```text
QUEST_FLOW_FIRST = understand normal player flow and server completion first
UNKNOWN_FLOW = read-only archaeology only
WEB_CONTROL_REQUIRED = NO does not block SERVER_AGENT autonomy
OPENKORE_GATE = run after Quest Flow First when applicable
TWO_BLOCKERS = stop and recheck upstream assumptions before a third fix
```
