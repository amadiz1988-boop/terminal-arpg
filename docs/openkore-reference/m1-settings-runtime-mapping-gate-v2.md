# M1 settings runtime mapping gate V2

Pinned OpenKore: `51de1ddfc4449ae5217f6886de702f87ca934030`.
Product authority: `docs/project-control/canonical-m1-world-travel-supply-ui-v1.md`
at `38cf0bb2`. Current Web source: `13f017ae`; Native source: `f2a268b`.
This is a source classification, not runtime or Player Browser acceptance.
`/api/config` still reports `CONFIG_ONLY_NO_EXECUTOR_COMMAND`; all 42 adjustable
controls remain disabled. `ENABLED_UI_NO_OP_COUNT=0`.

| M1 field | OPENKORE_FILE / SYMBOL / CONFIG / DEFAULT / TRANSITION | CURRENT_GI_RUNTIME_OWNER | PORT_MAPPING / SOURCE_TEST / UI |
|---|---|---|---|
| `supply.enabled` | `control/config.txt:734` and `src/AI/CoreLogic.pm:2009` `buyAuto`; no global supply toggle; inactive without a configured buy row; enabled rows queue buy service. | Native global `PERSISTENT_AGENT_SUPPLY_ENABLED`, `handle_supply`; per-character stored field ignored. | `NO_MATURE_REFERENCE=YES` for global toggle. GI product wrapper needs an explicit per-character executor contract. MISSING; none; disabled. |
| `supply.weightTriggerPercent` | `control/config.txt:211` `itemsMaxWeight_sellOrStore=48`; `src/AI.pm:679,779` `shouldStartAutoStorage/shouldStartAutoSell`; weight threshold queues storage/sell when those services are enabled. | Native `handle_supply` uses item count, no per-character weight trigger. | Current GI default 75 differs. A weight-to-buy trigger has no mature reference. `PROJECT_POLICY_REQUIRED=YES`; none; disabled. |
| `supply.inventorySlotTrigger` | `control/config.txt:212` `itemsMaxNum_sellOrStore=99`; `src/AI.pm:682,782`; full-slot threshold queues storage/sell. | Native item-count Supply only. | Mapping this to buy-only M1 has `NO_MATURE_REFERENCE=YES`, `PROJECT_POLICY_REQUIRED=YES`; none; disabled. |
| `supply.services.buy.enabled` | `control/config.txt:734-750` `buyAuto` row, no global buy toggle; `src/AI/CoreLogic.pm:2073-2105` skips disabled/empty rows then selects an eligible one. | Native `supply_capability_enabled` is global. | GI wrapper requires per-character row gate. MISSING; none; disabled. |
| `supply.services.buy.rules` | `control/config.txt:734-750` `buyAuto` template `minAmount=2`, `maxAmount=3`; `src/AI/CoreLogic.pm:2073-2241` evaluates amount, price, Zeny, NPC, batch and timeout before buying. | Native uses one env-configured item/min/target and rAthena NPC purchase. | GI schema's default `20/100` is a separate product value; ordered per-row executor and authoritative inventory test MISSING; none; disabled. |
| `combat.attack.distance` | `control/config.txt:83-85` `attackDistance=1`, `attackDistanceAuto=1`; `src/AI/Attack.pm:729,765-770` selects desired weapon distance, with automatic weapon range adjustment. | Native `sd->battle_status.rhw.range` and `walk_to_farm_target`. | Must preserve `attackDistanceAuto` default, not force one-cell melee. MISSING; none; disabled. |
| `combat.attack.maxDistance` | `control/config.txt:85` `attackMaxDistance=1`; `src/AI/Attack.pm:730,765-792` clamps it at least to desired distance and gates attack feasibility. | Native weapon range and `battle_check_range`. | Per-character max-distance contract MISSING; none; disabled. |
| `combat.attack.checkLOS` | `control/config.txt:92` `attackCheckLOS=1`; `src/AI/Attack.pm:120-125,792` target selection/attack feasibility uses LOS. | Native rAthena `battle_check_range`; no configurable switch. | Default-aligned fixed authority, configurable mapping MISSING; none; disabled. |
| `combat.attack.canSnipe` | `control/config.txt:91` `attackCanSnipe=0`; `src/AI/Attack.pm:125,792,900` passes flag to `canAttack`. | Native rAthena range/LOS; no configurable switch. | MISSING; none; disabled. |
| `combat.attack.changeTarget` | `control/config.txt:96` `attackChangeTarget=1`; `src/AI/Attack.pm:120-140` can preempt a passive target for an aggressor or higher-priority aggressor. | Native invalid-target retarget and blocked-target TTL; no per-character preemption switch. | MISSING; none; disabled. |
| `combat.attack.maxRouteDistance` | Exact pinned symbol is `control/config.txt:93` `attackRouteMaxPathDistance=20`; `src/Misc.pm:3374,4718,4748,4761` bounds path/target search; `src/AI/CoreLogic.pm:3591` passes it to route. The old `attackMaxRouteDistance` symbol does not occur in pinned `control`, `src/AI` or `src/Misc.pm`. | Native same-map target leash/walk. | Schema symbol/default corrected from nonexistent `100` to `attackRouteMaxPathDistance=20` at `13f017ae`; migration/preview test PASS. Per-character executor MISSING; UI disabled. |
| `combat.attack.maxRouteTime` | `control/config.txt:86` `attackMaxRouteTime=4`; `src/AI/Attack.pm:997` bounds the meeting-position route, then target give-up logic applies. | Native same-map walk and blocked-target timers; no per-character 4-second route setting. | MISSING; none; disabled. |
| `combat.skills.selfSkills` | `control/config.txt:654-663` empty `useSelf_skill` row, smart heal default 1; `src/AI/CoreLogic.pm:3008-3047` ordered row conditions, learned skill, cast and timeout. | Native recovery-skill allowlist and rAthena `unit_skilluse_id`, no ordered per-character row. | MISSING; none; disabled. |
| `combat.targets` | `control/mon_control.txt:1-32` attack/teleport/search/level/HP/SP/weight; `src/Misc.pm:3655` name, ID, `all`, then `attack_auto=1` fallback. | Native map-only farm target scan, no per-monster execution policy. | M1 UI must not become a monster-picker for farm destination. Exact per-monster policy adapter MISSING; none; disabled. |

## Gate result

`SUPPORTED_RUNTIME_MAPPING=6` remains the narrow stored-to-start-farm adapter
count from the prior recalculation. `M1_RUNTIME_MAPPING_MISSING=14` remains the
executor-attested count; the corrected OpenKore metadata is not an executor.
`OUTSIDE_M1=22` remains the prior formal classification pending the weight and
slot policy decision. `ENABLED_UI_NO_OP_COUNT=0`.

`PROJECT_CONTROL_DECISION_REQUIRED=YES` for the two weight/slot controls:
either classify their storage/sell semantics outside M1 while disabled, or
specify a GI canonical buy-only trigger with exact thresholds and precedence.
No purchase-trigger behavior was invented. A second independent gate remains:
the single-runtime policy forbids an isolated login/char/map stack, while this
workline forbids Production mutation. Source compile and source-contract checks
cannot establish authoritative Fly-to-HIT or Supply-to-HIT without a legal
world-state fixture and runtime execution. `FLY_TO_HIT=NOT_MEASURED` and
`SUPPLY_RETURN_TO_HIT=NOT_MEASURED`; no PASS is inferred from logs or static
assertions.
