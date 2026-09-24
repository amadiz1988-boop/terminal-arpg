# OpenKore Reference Atlas

This directory is the bounded research atlas for mature OpenKore behavior. It
does not authorize runtime use of OpenKore. Production authority remains
`PA / SERVER_AGENT -> rAthena`, and OpenKore process count remains zero.

Baseline provenance:

```text
UPSTREAM_OPENKORE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
UPSTREAM_BRANCH = master
PROJECT_LAST_VERIFIED = 2026-09-21
PROJECT_CANONICAL_ROOT = C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg
```

Primary external provenance is the [OpenKore repository](https://github.com/OpenKore/openkore),
the [current CoreLogic source](https://github.com/OpenKore/openkore/blob/master/src/AI/CoreLogic.pm),
the [Route task](https://github.com/OpenKore/openkore/blob/master/src/Task/Route.pm),
the [eventMacro plugin](https://github.com/OpenKore/openkore/blob/master/plugins/eventMacro/eventMacro.pl),
and the [OpenKore configuration wiki](https://openkore.com/index.php?pageuntil=attackAuto+notWhile+buyAuto&title=Category%3Aconfig.txt).
Community forum pages are bounded historical pattern references only; they do
not override the locked source, project evidence or rAthena authority.

Read the smallest exact reference first:

- [project-last-good-map.md](project-last-good-map.md): historical accepted behavior and current PA status.
- [navigation.md](navigation.md): route, portal, field, lockMap and pathfinding.
- [combat-and-targeting.md](combat-and-targeting.md): combat, mob search, retarget and loot interruption.
- [supply.md](supply.md): supply out, service transaction and farm resume.
- [teleport.md](teleport.md): teleport, Fly Wing and Butterfly Wing semantics.
- [npc-dialogue.md](npc-dialogue.md): NPC ownership, dialogue stages and timeout handling.
- [quest-automation.md](quest-automation.md): upstream primitives separated from project quest logic.
- [macro-eventmacro.md](macro-eventmacro.md): reusable condition and event patterns.
- [recovery.md](recovery.md): death, respawn, stuck, timeout and reconnect.
- [configuration.md](configuration.md): high-value configuration semantics.
- [item-loot-inventory-storage-weight.md](../reference-mining/topics/item-loot-inventory-storage-weight.md): cross-Atlas item, loot, inventory, storage and weight mining dossier.
- [lookup-playbook.md](lookup-playbook.md): problem-to-reference routing.

The machine-readable [reference-index.yml](reference-index.yml) contains all 45
required topics. Each topic records the problem, exact upstream paths and
symbols, configuration keys, behavior and states, retry and recovery, edge
cases, project evidence, PA equivalent and gap, classification, design
implication, flexibility and search keywords.

Classification is behavioral, not architectural:

```text
REPRODUCE       preserve an accepted invariant or player-visible result
ADAPT           preserve intent while moving authority into PA / rAthena
IMPROVE         preserve outcome with a demonstrably stronger implementation
REJECT_LEGACY   historical behavior is unsafe, obsolete or client-bot specific
N/A             no useful mapping for this topic
```

OpenKore implementation style is reference material. It never becomes state
authority, navigation executor, combat executor, supply executor, quest
executor or a PA runtime dependency. Any divergence proposal must record why it
deviates, what is better, how rAthena authority is preserved, regression risk,
and whether the result is equivalent or better.

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
