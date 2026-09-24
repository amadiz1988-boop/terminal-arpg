# Canonical Route Stage 3 Execution Parity

```text
TASK_ID = OPENKORE_CANONICAL_ROUTE_STAGE3_EXECUTION_PARITY_V1
STAGE2_GIT_CHECKPOINT = d4db2ca
MODE = SHADOW_EXECUTION_PARITY
PRODUCTION_TOUCHED = NO
OPENKORE_RUNTIME = 0
```

The parity harness consumes a solved canonical route and checks the existing PA
command and acknowledgement contract. It does not call the route solver,
enqueue commands, control a character, or create a second coordinator.

## Contracts covered

- Physical portal and dungeon edges use one existing `start_navigation` route;
  arrival advances the Journey only after the authoritative map confirms the
  terminal destination.
- Kafra transport uses the existing `talk_to_npc`, `dialog_next`,
  `dialog_select`, and `dialog_close` cursor sequence.
- Butterfly Wing uses item 602 through `use_item`. Presence is sufficient,
  quantity may remain unchanged, and authoritative map or SavePoint arrival is
  the success signal.
- Fly Wing item 601 is rejected as a route edge and remains a local hunting
  concern.
- Command failure, arrival timeout, portal unavailability, and NPC rejection
  return a bounded `REPLAN_REQUIRED` handoff. The adapter never computes the
  replacement route.
- Requirement locked and already-on-target results retain their existing
  fail-closed and `START_FARM` semantics.

```text
PA_EXECUTION_SEAM_REUSE = PASS
SECOND_EXECUTION_ENGINE_CREATED = NO
BUTTERFLY_JOURNEY_CONTRACT = PASS
FLY_WING_BOUNDARY = PASS
KAFRA_COMMAND_PARITY = PASS
DUNGEON_EXECUTION_PARITY = PASS
RETRY_REPLAN_HANDOFF = PASS
ZERO_GAMEPLAY_AUTHORITY = PASS
PER_MAP_HARDCODE_COUNT = 0
OPENKORE_RUNTIME = 0
```

Generic NPC, Airship, and unbound scripted transfer remain explicit missing
execution seams when authoritative metadata is absent.
