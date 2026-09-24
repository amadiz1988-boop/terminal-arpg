# Normal World Authority Closure and Farmability

```text
TASK_ID = NORMAL_WORLD_AUTHORITY_CLOSURE_AND_FARMABILITY_V1
BASE_CHECKPOINT = 12de254
STAGE1_INVENTORY_REUSED = YES
MAP_INDEX_RESCANNED = NO
WEIGHTED_SOLVER_MODIFIED = NO
PA_ADAPTER_ENTERED = NO
PRODUCTION_TOUCHED = NO
OPENKORE_RUNTIME = 0
```

## Transport authority sweep

The eight rows left by the Stage 2 enrichment were checked in the required order: static portal, NPC transport, ship/ferry, airship, scripted transfer, command transfer, save/respawn, item warp, and quest/instance/event requirement.

| Map | Static portal | NPC | Ship/Ferry | Airship | Scripted transfer | Requirement | Final classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `um_dun01` | current exits only, no root entry | none | none | none | none | none | `OTHER_KNOWN` |
| `um_dun02` | current dungeon exits only, no root entry | none | none | none | pre-renewal-only CashShop branch | none | `OTHER_KNOWN` |
| `treasure_n1` | no current edge | none | none | none | none | none | `OTHER_KNOWN` |
| `treasure_n2` | no current edge | none | none | none | none | none | `OTHER_KNOWN` |
| `prt_fild08a` | variant exits, no canonical root path | none | none | none | none | none | `OTHER_KNOWN` |
| `prt_fild08b` | variant exits, no canonical root path | none | none | none | none | none | `OTHER_KNOWN` |
| `prt_fild08c` | variant exits, no canonical root path | none | none | none | none | none | `OTHER_KNOWN` |
| `prt_fild08d` | variant exits, no canonical root path | none | none | none | none | none | `OTHER_KNOWN` |

Evidence used current rAthena imports only. The Umbala entrance in `npc/warps/dungeons/um_dun.txt` is commented, while the pre-re counterpart is outside the current renewal import path. The custom Warper and quest Warper files are commented in `npc/scripts_custom.conf`. `treasure_n1` and `treasure_n2` have active spawn declarations but no current transport declaration, instance registration, or requirement entry. `prt_fild08a-d` have active variant exits and duplicated NPCs but no canonical root entry and no legal monster-spawn declaration. OpenKore `portals.txt`, `portals_commands.txt`, and `portals_airship.txt` were used for semantic cross-check only; they do not override current rAthena authority.

## Reconciled normal-world gate

```text
NORMAL_WORLD_TOTAL_BEFORE_RECONCILIATION = 49
MAPS_RECLASSIFIED = 8
NORMAL_WORLD_TOTAL_AFTER_RECONCILIATION = 26
NORMAL_REACHABLE = 26
NORMAL_UNREACHABLE = 0
NORMAL_ROUTE_STATUS_KNOWN = 26
NORMAL_UNEXPLAINED = 0

NORMAL_AUTO_FARMABLE = 24
NORMAL_LOCKED_REQUIREMENT = 0
NORMAL_NON_FARMABLE = 2
NORMAL_FARMABILITY_KNOWN = 26

GLOBAL_UNSUPPORTED_UNKNOWN = 334
GLOBAL_DEBT_BLOCKS_STAGE2 = NO
REMAINING_TRUE_WORLD_UNREACHABLE = 0
```

The two normal rows without a legal static monster declaration are `amicitia2` and `ein_fild10`; they are `NON_FARMABLE`. The remaining 24 normal rows have a proven route, a loaded map, a legal static monster declaration, and no unresolved requirement gate, so they are `AUTO_FARMABLE`.

```text
ECOSYSTEM_REFERENCE_SWEEP_COMPLETED = YES
MATURE_CAPABILITIES_REUSED = OpenKore command/airship/TalkNPC/MapRoute semantics for cross-check only
GENERIC_TRANSPORT_TRANSFORMER_NEEDED = NO
GENERIC_TRANSFORMERS_ADDED = NONE
CANONICAL_ROUTE_ENGINE_COUNT = 1
PER_MAP_HARDCODE_COUNT = 0
READY_FOR_STAGE2_PA_ADAPTER = YES
```

The adapter phase remains unopened. This closure is offline evidence only and does not authorize Production deployment.
