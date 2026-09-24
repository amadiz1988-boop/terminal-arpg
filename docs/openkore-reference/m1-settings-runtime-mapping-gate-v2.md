# M1 settings runtime mapping gate V2

> 最新產品規則為 `M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1`：重量／格數觸發及自動存倉／販售維持 `GI_EXPLICIT_OVERRIDE`、`OUTSIDE_M1`。此前將它們納入 M1 的決策已在 canonical 文件標為歷史。下方 6+12+24 分類仍有效；四類非消耗資源沒有耗盡閾值欄位，不能藉此把其餘 12 個缺口改列已支援。本註記不啟用尚未接通的 UI 控制。

Pinned OpenKore: `51de1ddfc4449ae5217f6886de702f87ca934030`.
Product authority: `docs/project-control/canonical-m1-world-travel-supply-ui-v1.md`
at `c0450b1c`, including the combat-continuity Supply amendment.
Current Web source: `e98d5f91` (Supply adapter at `b1498f21`);
Native source: `de168f5`.
This is a source classification, not Player Browser acceptance. The source
`/api/config` contract reports `CONFIG_ONLY_NO_EXECUTOR_COMMAND`; all 42
adjustable controls are disabled in that source candidate, so source
`ENABLED_UI_NO_OP_COUNT=0`. The current canonical runtime returned HTTP 404
for authenticated `GET /api/config`; source UI availability is not deployed proof.

| M1 field | OPENKORE_FILE / SYMBOL / CONFIG / DEFAULT / TRANSITION | CURRENT_GI_RUNTIME_OWNER | PORT_MAPPING / SOURCE_TEST / UI |
|---|---|---|---|
| `supply.enabled` | `control/config.txt:734` and `src/AI/CoreLogic.pm:2009` `buyAuto`; no global supply toggle; inactive without a configured buy row; enabled rows queue buy service. | Native global `PERSISTENT_AGENT_SUPPLY_ENABLED`, `handle_supply`; per-character stored field ignored. | `NO_MATURE_REFERENCE=YES` for global toggle. GI product wrapper needs an explicit per-character executor contract. MISSING; none; disabled. |
| `supply.weightTriggerPercent` | `control/config.txt:211` `itemsMaxWeight_sellOrStore=48`; `src/AI.pm:679,779` `shouldStartAutoStorage/shouldStartAutoSell`; weight threshold queues storage/sell when those services are enabled. | Native `handle_supply` uses item count, no per-character weight trigger. | `GI_EXPLICIT_OVERRIDE`: `M1_WEIGHT_TRIGGER_SUPPLY=NO`; storage/sell setting `OUTSIDE_M1`, disabled. Authoritative weight remains an M1 safety predicate, with `INVENTORY_BLOCKED` or precise equivalent still requiring source/live proof. |
| `supply.inventorySlotTrigger` | `control/config.txt:212` `itemsMaxNum_sellOrStore=99`; `src/AI.pm:682,782`; full-slot threshold queues storage/sell. | Native item-count Supply only. | `GI_EXPLICIT_OVERRIDE`: `M1_INVENTORY_TRIGGER_SUPPLY=NO`; storage/sell setting `OUTSIDE_M1`, disabled. Authoritative capacity remains an M1 purchase/continuation safety predicate. |
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
count from the prior recalculation. `M1_RUNTIME_MAPPING_MISSING=12` excludes the
two storage/sell-only trigger controls by the explicit M1 product decision;
the remaining twelve lack executor-attested per-path behavior.
`OUTSIDE_M1=24` includes those two disabled controls.
`6+12+24=42`; `ENABLED_UI_NO_OP_COUNT=0`. The two excluded trigger settings
do not close the separate M1 inventory/weight safety predicate.

The authorized group-0 test character 150095 completed live `start-farm`,
`use-fly-wing` and `stop-farm` synthetic actions on the canonical runtime.
The Fly command was confirmed, map stayed `pay_fild07`, position changed and
item 601 count stayed 59. The bounded `combat-cycle` observer returned FAIL:
`MONSTER_TARGET` and `LOOT_ACQUIRED` were not observed in its window. The
deployed map-server does not contain the source-candidate
`FLY_WING_RELOCATED` or `POST_SUPPLY_HIT` observer strings, so neither
`FLY_TO_HIT` nor `SUPPLY_RETURN_TO_HIT` has authoritative HP-before/after
acceptance. No new Native source was deployed or restarted for this test.

## Per-path execution attestation, current source

`SOURCE_IMPLEMENTED=PARTIAL` means the schema field reaches the conditional
Native Supply command. It does not establish successful execution or Player UI
enablement. `RUNTIME_EVIDENCE=NOT_MEASURED` preserves the current Production
gate. All twelve fields below remain disabled while
`PA_NATIVE_SUPPLY_POLICY_ENABLED` is off.

| Path | Source runtime owner | Source implemented | Source test | Runtime evidence | UI state |
| --- | --- | --- | --- | --- | --- |
| `supply.enabled` | Dashboard `nativeSupplyPolicy`; Native `parse_m1_supply_policy` | PARTIAL, conditional policy command | `test-native-supply-policy.mjs` PASS, source adapter only | NOT_MEASURED | DISABLED |
| `supply.services.buy.enabled` | Dashboard `nativeSupplyPolicy`; Native `parse_m1_supply_policy` | PARTIAL, conditional policy command | `test-native-supply-policy.mjs` PASS, source adapter only | NOT_MEASURED | DISABLED |
| `supply.services.buy.rules` | Dashboard `nativeSupplyPolicy`; Native `parse_m1_supply_policy` | PARTIAL, healing-only rows | `test-native-supply-policy.mjs` PASS, source adapter only | NOT_MEASURED | DISABLED |
| `combat.attack.distance` | Native PA/rAthena weapon range | NO per-character executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.attack.maxDistance` | Native PA/rAthena range authority | NO per-character executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.attack.checkLOS` | Native PA/rAthena fixed range/LOS authority | NO configurable executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.attack.canSnipe` | Native PA/rAthena range/LOS authority | NO configurable executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.attack.changeTarget` | Native PA target priority | NO per-character executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.attack.maxRouteDistance` | Native PA same-map target approach | NO per-character executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.attack.maxRouteTime` | Native PA same-map target approach | NO per-character executor mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.skills.selfSkills` | Native PA/rAthena skill authority | NO ordered per-character row mapping | NONE per field | NOT_MEASURED | DISABLED |
| `combat.targets` | Native PA target policy | NO per-monster execution mapping | NONE per field | NOT_MEASURED | DISABLED |

The current Web source attests eight Supply paths as `SUPPORTED` when the
feature flag is on. Five of those paths, `supply.weightTriggerPercent`,
`supply.inventorySlotTrigger`, `supply.services.storage.enabled`,
`supply.services.sell.enabled`, and `supply.itemRules`, are ignored by Native
`parse_m1_supply_policy` under the current M1 rule. This source-level
attestation mismatch is an enabled-no-op risk if the flag is turned on.
The flag remains off; source `ENABLED_UI_NO_OP_COUNT=0` is conditional on that
state. Web owner correction and per-path source/runtime tests are required
before enabling it.
