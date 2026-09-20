# OpenKore Reference Dossiers

This directory is the canonical index and schema for bounded OpenKore reference
dossiers. It does not authorize runtime use of OpenKore. Production authority
remains `PA / SERVER_AGENT -> rAthena`, and OpenKore process count remains zero.

## Dossier Rule

Create one dossier per reused capability only when the workline needs a durable,
versioned reference record. A dossier is evidence, not a second implementation.
Keep search bounded to the exact files, symbols, configuration and historical
acceptance evidence needed by the capability.

Reference priority:

1. Project actual PASS evidence.
2. Project locked OpenKore version and commit.
3. Mature upstream implementation.
4. Other explicitly identified evidence.

## Required Schema

Every dossier must record:

```text
CAPABILITY =
REFERENCE_VERSION =
REFERENCE_COMMIT =
REFERENCE_FILES =
REFERENCE_SYMBOLS =
REFERENCE_CONFIG =
PROJECT_LAST_GOOD_CONFIG =
TRIGGER =
STATE_MACHINE =
SUCCESS_PATH =
FAILURE_PATH =
RECOVERY =
RETRY =
EDGE_CASES =
RATHENA_REFERENCE =
BEHAVIOR_MAPPING =
ACCEPTED_GHOST_ISLAND_CONTRACT =
KNOWN_DEVIATIONS =
LAST_VERIFIED =
```

`PROJECT_LAST_GOOD_CONFIG` must include source, version and provenance when the
project has historical actual configuration evidence.

## Inheritance

An unchanged dossier may be inherited only when its reference version and commit,
accepted contract and covered edge cases are unchanged. The workline must record:

```text
OPENKORE_REFERENCE_INHERITED = YES
REFERENCE_DOSSIER = docs/openkore-reference/<capability>.md
OPENKORE_BEHAVIOR_COMPARED = YES
```

If any of those conditions changed, set inheritance to `NO` and execute the
missing gate evidence before source edit.

## Authority And Conflicts

OpenKore supplies mature behavior reference. It does not decide world state,
ownership, item state, quest state, map state or player authority. A conflict with
rAthena or the current architecture must stop the workline and report:

```text
OPENKORE_BEHAVIOR =
RATHENA_BEHAVIOR =
CURRENT_ARCHITECTURE_CONSTRAINT =
PLAYER_VALUE_IMPACT =
REFERENCE_CONFLICT_RESOLVED = NO
```

Only Project Control may resolve that conflict.

## Veto

The dossier participates in `OPENKORE_CORE_ALIGNMENT_VETO`. It does not replace
the six-question hard gate, objective equivalence evidence or independent Project
Control acceptance.
