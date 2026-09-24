# Project Last-Good Map

```text
REFERENCE_VERSION = OpenKore master
REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
PROJECT_SOURCE = ops/ro-stack/openkore-plugins/status-export/status-export.pl
AUTHORITY = PA / SERVER_AGENT -> rAthena
OPENKORE_RUNTIME = 0
LAST_VERIFIED = 2026-09-20
```

This map prevents reimplementation of behavior already present in the project.
`SOURCE_ONLY` and `DIAGNOSTIC_PASS` remain distinct from `PLAYER_FLOW_PASS`.

| Capability | Historical implementation | Last-Good behavior | Current PA status | Classification |
|---|---|---|---|---|
| Novice onboarding | `status-export.pl::process_onboarding`, `process_onboarding_dialog` | Map, quest, NPC, item-use, skill and graduation phases with dialogue ownership | Quest Runtime sequence is pending/integration-scoped | ADAPT |
| Eden | `process_eden`, `process_eden_dialog`, `process_eden_supply` | Quest observation drives route, hunt, recovery, supply and reward phases | Quest adapters preserve rAthena quest authority | ADAPT |
| Navigation | `src/Task/Route.pm`, `MapRoute.pm`, Gate 3 | Same-map and multi-map route with portal retry | Gate 3 `PLAYER_FLOW_PASS`; native PA route is authority | ADAPT |
| Combat | `src/AI/Attack.pm`, Gate 1A | Approach, attack, damage observation and kill | Gate 1A `AUTO_FARM_ATTACK/HIT` | ADAPT |
| Target selection | `Attack.pm::process`, `targetGone` | Scan eligible mob, engage, drop stale target | Gate 1A target selection | REPRODUCE |
| Mob search | `CoreLogic.pm`, `Actor::Monster` | Visible actor scan and bounded search | AUTO_FARM scan; roaming future work | ADAPT |
| Loot | `CoreLogic.pm::processTake`, `pickupitems.txt` | Pickup and return to combat | Gate 1A loot PASS | ADAPT |
| Supply | `buyAuto`, `sellAuto`, `storageAuto`, `supply.md` | Threshold, pause, service, confirm, return | Gate 2 PASS; Butterfly Wing primary out migration target | ADAPT |
| Shop | `CoreLogic.pm` service callers | Save-point warp or route, NPC transaction | Gate 2 buy PASS; sell partial | ADAPT |
| Storage | `storageAuto`, historical config | Storage session and item deposit | Reference branch, player-flow closure absent | ADAPT |
| Death recovery | `process_job_death`, `Task::Teleport` | Respawn then restore intended route | Gate 1B PASS | REPRODUCE |
| Respawn | `Commands.pm::respawn` | Wait for authoritative save map and HP | Native `pc_respawn`, Gate 1B PASS | REPRODUCE |
| Farm | `lockMap`, `attackAuto` | Constrained farm map, target, loot and resume | AUTO_FARM accepted on validated maps | REPRODUCE |
| lockMap behavior | historical config and `process_job_resume` | Restore map only after map authority confirms arrival | PA target map and relocation state | REPRODUCE |
| Fly Wing | `Task::Teleport`, item 601 | Emergency/search random warp, cooldown, reacquire | Diagnostic item 601 PASS, roaming not implemented | ADAPT |
| Butterfly Wing | `saveMap_warpToBuyOrSell`, item 602 | Return to authoritative save point before service | Contract corrected, primary runtime leg pending | ADAPT |
| NPC dialogue | `process_onboarding_dialog`, `process_eden_dialog` | next/select/close with timeout and cancel | Quest Runtime dialogue primitives | REPRODUCE |
| Quest observation | `quest_state`, `questList` branches | Server quest state selects next legal phase | `web_quest_runtime` and rAthena authority | REPRODUCE |
| Quest automation | `process_onboarding`, `process_eden`, job automation | Composed route, dialogue, item, combat phases | Adapters and pending sequences | ADAPT |
| First Job | `process_onboarding`, `process_job_resume` | Job change then restore hunt route | Historical accepted source; current closure bounded | ADAPT |
| Job resume | `process_job_resume` | Restore equipment, route, lockMap and AI after task | Native PA resume concepts | ADAPT |
| Farm resume | `process_job_resume`, Gate 1B/2 | Reacquire target and continue after supply/death | Gate 1B and Gate 2 PASS | REPRODUCE |
| Reconnect | `plugins/reconnect`, PA audit | Delay, reconnect, reconcile and resume | PA reconciliation evidence; full production closure absent | ADAPT |
| Stuck recovery | `nudge_stalled_grind_target`, `process_supply_route_abort` | Detect no progress, bounded nudge/retry/backoff | Native PA recovery state | IMPROVE |

## Project evidence anchors

- `docs/openkore-exit-source-of-truth.md`: Gate 1A natural combat, Gate 1B
  damage/death/respawn/resume, Gate 2 supply/buy/return, Gate 3 route evidence.
- `docs/OPENKORE_FEATURE_AUDIT.md`: historical capability inventory and
  `lockMap` contract.
- `ops/ro-stack/openkore-instance.ps1:164-215,284-299`: generated historical
  config and permanent item 601/602 policy.
- `ops/ro-stack/openkore-plugins/status-export/status-export.pl`: project
  historical state machine, including onboarding, Eden, supply, dialogue,
  recovery, job resume and route backoff.

## Explicit gaps

`OPENKORE_REMOVED = NO` and `PRODUCTION_READY = NO` remain source-of-truth
constraints. This atlas records reusable behavior. It does not claim that every
OpenKore capability has a current PA player-flow acceptance.

`FLY_WING_ROAMING = RESEARCH_ONLY`.
`STORAGE_PLAYER_FLOW = 【資料不足，無法確認】`.
`GENERIC_PARTY_RUNTIME = N/A`.
