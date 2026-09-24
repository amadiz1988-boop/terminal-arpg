# Quest Reference Dossier Schema

Status: CANONICAL GOVERNANCE SCHEMA

Before Quest gameplay-semantic implementation, create or inherit one dossier
at `docs/quest-reference/<quest-key>.md`. The dossier is a bounded evidence
record, not a replacement for rAthena scripts, runtime evidence or player-flow
acceptance.

```text
QUEST =
SERVER / EPISODE / VERSION =
KNOWN_VARIANTS =

PLAYER_FLOW =
PLAYER_FLOW_SOURCE =

RATHENA_SCRIPT_FILES =
QUEST_DB_ENTRIES =

QUEST_IDS =
NPC_SYMBOLS =
NPC_COORDS =
MAPS =
WARPS =
ONTOUCH_TRIGGERS =
HIDDEN_NPCS =
DIALOGUE_SEQUENCE =
MENU_CHOICES =
ITEM_REQUIREMENTS =
KILL_REQUIREMENTS =
CLASS_REQUIREMENTS =
LEVEL_REQUIREMENTS =

SERVER_AUTHORITATIVE_STATE_TRANSITIONS =

OPENKORE_ERA_LAST_GOOD =
HISTORICAL_PROJECT_IMPLEMENTATION =

CURRENT_QUEST_RUNTIME =
CURRENT_SEQUENCE =
CURRENT_ROUTE_MANIFEST =

REUSABLE_COMPONENTS =
MISSING_COMPONENTS =
WRONG_CURRENT_ASSUMPTIONS =

AUTOMATION_MAPPING =
WEB_CONTROL_REQUIRED = YES / NO
SERVER_AGENT_AUTONOMY_ALLOWED = YES / NO
STEP_EXECUTION_CLASSIFICATION =

FIRST_BROKEN_TRANSITION =

REFERENCE_CONFLICT =
UNRESOLVED_UNCERTAINTIES =
IMPLEMENTATION_ALLOWED = YES / NO
```

## Field Rules

`PLAYER_FLOW` records what a normal player does. `RATHENA_SCRIPT_FILES` and
`SERVER_AUTHORITATIVE_STATE_TRANSITIONS` record what the server executes and
accepts. OpenKore fields record mature historical automation. Current Runtime
fields record the migration state. They must remain distinct.

Classify each key step as one or more of:

```text
AUTONOMOUS
PLAYER_DECISION
PLAYER_CONFIRMATION
WEB_OPTIONAL
SERVER_AGENT_INTERNAL
```

`WEB_CONTROL_REQUIRED = NO` permits internal Quest Runtime execution when the
semantic hard gate, authority rule and automation contract are complete.

An inherited dossier remains valid until server/version/script evidence changes
or a new reference conflict appears. `IMPLEMENTATION_ALLOWED = YES` requires
all Quest Flow First hard-gate fields to be proven.
