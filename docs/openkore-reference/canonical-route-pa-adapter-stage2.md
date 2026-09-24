# Canonical Route to PA Adapter Stage 2

```text
TASK_ID = OPENKORE_CANONICAL_ROUTE_STAGE2_PA_ADAPTER_V1
PHASE = SOURCE_ANALYSIS / SHADOW_INTEGRATION
ADAPTER_MODE = SHADOW_ONLY
PRODUCTION_TOUCHED = NO
OPENKORE_RUNTIME = 0
```

## Contract mapping

| Canonical edge | Existing PA seam | Adapter disposition |
| --- | --- | --- |
| `PORTAL` | `start_navigation` | continuous physical edges become one route |
| `DUNGEON_TRANSITION` | `start_navigation` | preserves floor edge order |
| `NPC_TRANSPORT` | `talk_to_npc` plus dialogue cursor | requires NPC or Kafra content metadata |
| `KAFRA_TRANSPORT` | `talk_to_npc` plus dialogue cursor | existing Kafra sequence |
| `SAVE_MAP` | authoritative save-point observation | no synthetic state mutation |
| `ITEM_WARP` / `BUTTERFLY_WING` | `use_item` | item 602 remains presence based and non-consumable |
| `COMMAND_TRANSFER` | `run_server_command` | requires an allowlisted command supplied by authority metadata |
| `SCRIPTED_TRANSFER` | `run_server_command` | requires an allowlisted command supplied by authority metadata |
| `AIRSHIP` | NPC or server-command seam | fails closed when content metadata is absent |

The adapter receives a solved canonical route. It does not call the solver,
perform map lookup, enqueue commands, or mutate a character. Existing PA
relocation progress, command ledger, dialogue cursor, retry guard and
authoritative arrival confirmation remain the execution owner.

## Parity evidence

`test-canonical-route-pa-adapter.mjs` covers physical portal and dungeon
multi-floor order, Kafra dialogue, Butterfly item use, scripted transfer,
already-on-target, route failure and locked requirements. The test is shadow
only and emits no gameplay command.

```text
THIN_ADAPTER_ONLY = PASS
SECOND_ROUTE_ENGINE_CREATED = NO
EDGE_MAPPING_COMPLETE = PASS
PA_JOURNEY_STATE_MACHINE_REUSED = YES
RATHENA_AUTHORITY_PRESERVED = YES
PER_MAP_HARDCODE_COUNT = 0
OPENKORE_RUNTIME = 0
```

Airship and generic NPC/script edges without current authoritative command
metadata remain explicit missing seams. They are not guessed or converted to a
new route engine.
