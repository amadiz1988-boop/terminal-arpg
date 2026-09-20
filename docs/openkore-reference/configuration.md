# High-Value Configuration Semantics

Reference source: upstream `control/config.txt`, `control/timeouts.txt`,
`control/mon_control.txt`, `control/pickupitems.txt` at commit
`51de1ddfc4449ae5217f6886de702f87ca934030`. Project generated configuration is
produced by `ops/ro-stack/openkore-instance.ps1` and historical player config.

| Key family | Mature meaning | PA design use | Classification |
|---|---|---|---|
| `lockMap*` | Farm map and local tolerance | Durable farm destination; restore after authoritative arrival | REPRODUCE |
| `attackAuto*` | Attack gate, safety, party and service suppression | Explicit AUTO_FARM and sub-state gates | ADAPT |
| `itemsTakeAuto*` | Loot policy and pause behavior | Authoritative loot and inventory observation | ADAPT |
| `teleportAuto*` | Emergency, search, lost-target and respawn triggers | Reasoned teleport intent and result confirmation | ADAPT |
| `route_randomWalk` | Idle movement when no route is active | Bounded fallback only; never primary supply | REJECT_LEGACY |
| `route_teleport*` | Route teleport candidate and ceiling | Bounded relocation policy | ADAPT |
| `route_warpByItem*` | Item-warp candidate, chaining and gain | Reuse candidate semantics, not item authority | ADAPT |
| `saveMap_warp*` | Save-point relocation for services | Butterfly Wing primary Supply Out contract | ADAPT |
| `buyAuto` | Threshold, NPC, max amount and Zeny condition | PA supply target and rAthena transaction | ADAPT |
| `sellAuto` | Sell route, protected items and NPC | Explicit sell policy; acceptance partial | ADAPT |
| `storageAuto` | Weight/item/death-triggered storage | Reference branch with server storage authority | ADAPT |
| `sitAuto*` | HP/SP/idle sit thresholds | Survival sub-state and threshold observation | ADAPT |
| `respawn` | Respawn command and item options | Native rAthena respawn event | REPRODUCE |
| `timeout` | Transport and action ceilings | Per-operation retry policy | REPRODUCE |
| `mon_control` | Monster priority, avoid and KS rules | Character policy over server actors | ADAPT |

## Projection rule

Configuration is policy input. It does not prove a runtime action occurred.
Runtime overrides must record the previous value, owner, reason and restoration
condition. A PA implementation may normalize config into typed durable state when
it preserves the same player-visible contract and rAthena authority.

## Project-specific override

The generator sets item 601 and 602 as permanent and removes their `buyAuto`
entries. This overrides OpenKore consumable assumptions. Do not infer item
consumption, supply completion or save-point arrival from a config line alone.
