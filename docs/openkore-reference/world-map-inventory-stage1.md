# World Map Inventory Reconciliation

`ALL_MAP_WORLD_INVENTORY_RECONCILIATION_V1` is an offline, read-only evidence
pass. It does not modify the canonical route solver, PA adapter, planner or
Production runtime.

## Source reconciliation

| Source | Count | Meaning |
| --- | ---: | --- |
| rAthena `db/map_index.txt` | 1,295 | authoritative registered map universe |
| rAthena map cache | 1,288 | loaded terrain cache entries; not the complete role taxonomy |
| project `map-info.json` | 69 | custom farm metadata subset generated from exported FLD2 maps and explicit dungeon additions |
| OpenKore `.fld2` map IDs | 1,115 | advisory terrain artifacts |
| OpenKore `twRO/maps.txt` IDs | 1,056 | advisory names table |
| OpenKore union | 1,374 | enrichment universe, never authority over rAthena existence |

The 69 project entries are therefore `CUSTOM_PROJECT_SUBSET`, not full-world
data. `availableForAfk` and `unlocked` are UI/farm metadata fields; they are not
authoritative route or map-existence claims.

## Graph accounting

The current static rAthena warp graph contains 557 source nodes and 1,836 edges.
Its unique source plus destination endpoint universe contains 566 nodes. The
exact destination-only set is:

`airplane`, `airplane_01`, `jupe_ele_r`, `moc_fild20`, `moc_fild22b`,
`prt_lib_q`, `ra_san01`, `tha_t06`, `tha_t12`.

Therefore the previous 566 versus current 557 difference is an expected counting
convention difference, not a nine-edge data loss or transform failure.

## Current classification

The 1,295 map-index rows are all accounted for:

| Category | Count |
| --- | ---: |
| NORMAL_FIELD | 14 |
| NORMAL_DUNGEON | 35 |
| TOWN | 34 |
| INTERIOR | 153 |
| QUEST_GATED | 101 |
| INSTANCE | 106 |
| EVENT | 5 |
| SCRIPT_GATED | 220 |
| SERVICE_ONLY | 312 |
| TEST | 0 |
| UNUSED | 30 |
| OTHER_KNOWN | 285 |
| UNKNOWN | 0 |

`OTHER_KNOWN` means the authoritative map exists and was loaded, while the
active data showed no static monster spawn or special role evidence. Those rows
are excluded from normal-world farmability; they are not treated as farmable.

Farmability: `AUTO_FARMABLE=0`, `LOCKED_REQUIREMENT=432`,
`NON_FARMABLE=529`, `UNSUPPORTED_UNKNOWN=334`. The zero auto-farmable result is
intentional: this inventory does not promote a map without proven spawn,
requirement and route evidence.

Normal-world static coverage: 49 classified normal maps are not reached from
the `prontera` static root, 9 have no graph source node, and 1 is statically
reachable. Failure classes are `MISSING_PORTAL_EDGE=9`, `OTHER=39`, and
`MISSING_REQUIREMENT_METADATA=1`. `OTHER` means the static subgraph is
disconnected while scripted/service/item/airship requirements remain outside
this read-only inventory; it does not claim authoritative unreachability.

## Gate

`WORLD_INVENTORY_ACCOUNTED=100%` and `NORMAL_WORLD_CLASSIFIED=100%`.
`NORMAL_UNKNOWN=0`. `READY_FOR_STAGE2_ADAPTER=NO` because route requirements
and service/script edge semantics remain unproven for the 49 normal rows.
