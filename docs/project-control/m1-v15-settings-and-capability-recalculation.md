# M1 V15 Settings and capability recalculation

Date: 2026-09-26. This is a current-source and available-live-evidence audit, not a final Production acceptance receipt. Source: `ops/ro-stack/dashboard/config-schema.mjs`, `config-capabilities.mjs`, `farm-execution-profile.mjs`, `ops/ro-stack/persistent-agent/native-supply-policy.mjs`, canonical Native `src/map/persistent_agent.cpp` and `src/map/persistent_agent_m1_supply_policy.hpp`. Product authority: `canonical-m1-world-travel-supply-ui-v1.md`, especially the active `M1_INVENTORY_MAINTENANCE_V1` section. Pinned OpenKore evidence for mature behavior remains in `docs/openkore-reference/mature-capability-census-v1.md`; this audit does not invent a new policy.

## Settings effect gate

The schema has **46 descriptors in 9 sections**: 17 visible editable controls with attested source adapters, 25 visible disabled controls, 3 fixed read-only policies, and 1 migration-only hidden control. With a ready controller and the Native M1 rollout enabled, `configCapabilityCounts` returns `SUPPORTED=17`, `PARTIAL=20`, `UNAVAILABLE=5`. Each `SUPPORTED` path has a source adapter into either `start_farm` or `nativeSupplyPolicy`. This proves a source consumer and write admission, not the per-field authoritative runtime effect or the Production Browser control. An earlier real Player `/api/config` read failed during legacy `buyAuto` migration; source checkpoint `ae2b8c36` repairs that case and has not been deployed. In this continuation, the separate TEST_PLAYER 150105 returned `GET /api/config` HTTP 200 with revision 14; that does not revalidate the affected Player or a Browser save/reload. The table gives schema defaults, not the affected Player's current values. `SETTINGS_FINAL_GATE=BLOCKED` until final Web deployment and Player Browser/runtime-effect proof.

Key: `S` = supported source adapter, editable only with the execution attestation; `P` = visible but disabled pending executor proof; `U` = visible but unavailable for current M1; `F` = fixed and read-only; `H` = hidden migration value. `farm` = saved config to `start_farm` profile/slot payload; `supply` = saved config to Native supply policy; `none` = no admitted per-field Player mutation. `EFFECT_PROVEN=SOURCE` means source adapter and bounded source tests only, `NONE` means no runtime effect is claimed, and `FIXED` means policy display without Player edit. Runtime effect after the final Web deploy remains unproven unless a separate live result is recorded.

| # | Section | Field | Default | State | Consumer | Effect proven |
|---:|---|---|---|:---:|---|---|
| 1 | 補給 | `supply.enabled` | false | S | supply | SOURCE |
| 2 | 補給 | `supply.weightTriggerPercent` | 75 | S | supply maintenance | SOURCE |
| 3 | 補給 | `supply.inventorySlotTrigger` | 99 | S | supply maintenance | SOURCE |
| 4 | 補給 | `supply.services.storage.enabled` | true | S | supply maintenance | SOURCE |
| 5 | 補給 | `supply.services.storage.npc` | empty | P | none | NONE |
| 6 | 補給 | `supply.services.storage.npc_steps` | empty | P | none | NONE |
| 7 | 補給 | `supply.services.storage.distance` | 3 | P | none | NONE |
| 8 | 補給 | `supply.services.sell.enabled` | true | S | supply maintenance | SOURCE |
| 9 | 補給 | `supply.services.sell.npc` | empty | P | none | NONE |
| 10 | 補給 | `supply.services.sell.npc_steps` | s | P | none | NONE |
| 11 | 補給 | `supply.services.sell.distance` | 3 | P | none | NONE |
| 12 | 補給 | `supply.services.buy.enabled` | true | S | supply | SOURCE |
| 13 | 補給 | `supply.services.withdraw.enabled` | false | P | none | NONE |
| 14 | 補給 | `supply.services.storage.minZeny` | 50 | P | none | NONE |
| 15 | 補給 | `supply.services.storage.keepOpen` | false | P | none | NONE |
| 16 | 蝴蝶翅膀 / 回城補給 | `supply.tools.butterflyWing.required` | true | F | fixed policy | FIXED |
| 17 | 補給 | `supply.loot.autoLoot` | true | F | fixed policy | FIXED |
| 18 | 補給 | `supply.loot.autoStore` | false | F | fixed policy | FIXED |
| 19 | 補給 | `supply.services.buy.rules` | empty rows | S | supply | SOURCE |
| 20 | 補給 | `supply.services.withdraw.rules` | empty rows | P | none | NONE |
| 21 | 補給 | `supply.itemRules` | canonical rows | S | supply maintenance | SOURCE |
| 22 | 掛機 | `combat.profile` | MELEE_DAMAGE | S | farm | SOURCE |
| 23 | 戰鬥 | `combat.attack.mode` | 2 | S | farm | SOURCE |
| 24 | 戰鬥 | `combat.attack.useWeapon` | true | S | farm | SOURCE |
| 25 | 戰鬥 | `combat.attack.distance` | 1 | S | farm | SOURCE |
| 26 | 戰鬥 | `combat.attack.maxDistance` | 1 | S | farm | SOURCE |
| 27 | 戰鬥 | `combat.attack.routeToLock` | true | H | none | NONE |
| 28 | 戰鬥 | `combat.attack.checkLOS` | true | P | none | NONE |
| 29 | 戰鬥 | `combat.attack.canSnipe` | false | P | none | NONE |
| 30 | 戰鬥 | `combat.attack.changeTarget` | true | P | none | NONE |
| 31 | 戰鬥 | `combat.attack.maxRouteDistance` | 20 | P | none | NONE |
| 32 | 戰鬥 | `combat.attack.maxRouteTime` | 4 | P | none | NONE |
| 33 | 進階功能 / 尚未支援 | `combat.follow.enabled` | false | U | none | NONE |
| 34 | 進階功能 / 尚未支援 | `combat.follow.target` | empty | U | none | NONE |
| 35 | 進階功能 / 尚未支援 | `combat.follow.distanceMin` | 3 | U | none | NONE |
| 36 | 進階功能 / 尚未支援 | `combat.follow.distanceMax` | 6 | U | none | NONE |
| 37 | 蒼蠅翅膀 | `combat.travel.flyWing.enabled` | true | S | farm | SOURCE |
| 38 | 蒼蠅翅膀 | `combat.travel.teleport.hp` | 10% | P | none | NONE |
| 39 | 蒼蠅翅膀 | `combat.travel.teleport.sp` | empty | P | none | NONE |
| 40 | 蒼蠅翅膀 | `combat.travel.teleport.lostTarget` | false | P | none | NONE |
| 41 | 蒼蠅翅膀 | `combat.travel.teleport.dropTarget` | false | P | none | NONE |
| 42 | 技能 | `combat.skills.attackSlots` | empty rows | S | farm | SOURCE |
| 43 | 恢復 | `combat.skills.selfSkills` | empty rows | S | farm | SOURCE |
| 44 | 進階功能 / 尚未支援 | `combat.skills.partySkills` | empty rows | U | none | NONE |
| 45 | HP / SP | `combat.itemUse` | empty rows | S | farm | SOURCE |
| 46 | 戰鬥 | `combat.targets` | empty rows | P | none | NONE |

Source gates: `scripts/test-m1-config-capability-gate.mjs`, `test-farm-execution-profile.mjs`, `test-native-supply-policy.mjs`, `test-m1-attack-skill-profile.mjs`, `test-m1-self-recovery-skill-profile.mjs`, `test-m1-hp-potion-profile.mjs`, and `test-legacy-item-rule-migration.mjs`. These tests do not promote `SOURCE` to live `EFFECT_PROVEN=YES`.

### V15 shipping contract for all 46 rows

For each table row above, `CONFIG_KEY` is the exact Field path, and `SECTION` and `DEFAULT` are the corresponding displayed values. `S` rows have `PLAYER_VISIBILITY=YES`, `PLAYER_EDITABILITY=YES` only after executor attestation, `SAVE_CONTRACT=PUT /api/config` with revision and `configWriteAdmission`, `RUNTIME_CONSUMER` as shown, `RUNTIME_EFFECT=SOURCE_MAPPED`, `LIVE_EFFECT_REQUIRED=YES`, and `STATUS=RUNTIME_EFFECT_PENDING_LIVE_PROOF`. They reach the final `VISIBLE_EDITABLE_RUNTIME_EFFECT_PROVEN` state only after Production Browser and authoritative effect acceptance. `P` and `U` rows have `PLAYER_VISIBILITY=YES`, `PLAYER_EDITABILITY=NO`, `SAVE_CONTRACT=DENIED`, `RUNTIME_EFFECT=NONE`, `LIVE_EFFECT_REQUIRED=NO` until separately authorized, and `STATUS=VISIBLE_DISABLED_NOT_YET_SUPPORTED`. `F` rows are visible and read-only fixed policy, with no Player save contract. The `H` row has `PLAYER_VISIBILITY=NO`, `PLAYER_EDITABILITY=NO`, `SAVE_CONTRACT=DENIED`, and `STATUS=HIDDEN_NOT_YET_SHIPPED`.

All 20 `P` fields have an explicit owner and M1 scope disposition:

| Fields | Count | Owner and exact scope disposition | Shipping state |
|---|---:|---|---|
| `supply.services.storage.npc`, `.npc_steps`, `.distance`; `supply.services.sell.npc`, `.npc_steps`, `.distance` | 6 | Native service catalog and Web adapter; M1 uses canonical Saved Town services. Per-player NPC or route override has no admitted runtime consumer and is outside the f7 Native amendment. | visible disabled |
| `supply.services.withdraw.enabled`, `supply.services.withdraw.rules` | 2 | Native storage policy; automatic withdrawal is not in the active M1 storage/sell/buy contract. | visible disabled |
| `supply.services.storage.minZeny`, `supply.services.storage.keepOpen` | 2 | Native storage policy; the active M1 contract has no per-player threshold or keep-open command. | visible disabled |
| `combat.attack.checkLOS`, `.canSnipe`, `.changeTarget`, `.maxRouteDistance`, `.maxRouteTime` | 5 | Native combat and movement policy; the current M1 executor has fixed behavior and no admitted per-player consumer. Implementation would require an additional Native source amendment outside the exact f7 authorization. | visible disabled |
| `combat.travel.teleport.hp`, `.sp`, `.lostTarget`, `.dropTarget` | 4 | Native Fly Wing policy; OpenKore condition semantics are in the pinned Atlas, while these per-player selectors have no admitted PA input. Implementation would require an additional Native source amendment outside the exact f7 authorization. | visible disabled |
| `combat.targets` | 1 | Player Web and Native targeting; canonical M1 makes the player select a map while AUTO_FARM owns target selection. No player-authored monster policy is shipped. | visible disabled |

The five `U` fields are the four `combat.follow.*` controls and `combat.skills.partySkills`; follow/party configuration is outside the active M1 Player Settings scope. The source contract test enumerates all 46 descriptors, asserts 17 admitted editable paths and 25 disabled paths, verifies every disabled path is rejected on write, and checks disabled DOM controls. `VISIBLE_EDITABLE_UNSUPPORTED_COUNT=0`, `UNMAPPED_SETTING_COUNT=0`, `CONFIG_ONLY_VISIBLE_FIELD_COUNT=0`, `NO_OP_VISIBLE_FIELD_COUNT=0`, and `PLAYER_CAN_EDIT_NOT_YET_OPEN_FIELD_COUNT=0` in the source candidate. Supply, Store and Sell settings map to the admitted Native supply policy through `supply.enabled`, `supply.services.buy.*`, `supply.services.storage.enabled`, `supply.services.sell.enabled`, `supply.itemRules`, and the weight/slot thresholds. `SETTINGS_SOURCE_CONTRACT_GATE=PASS`; `SETTINGS_BROWSER_PERSISTENCE_GATE` and `SETTINGS_RUNTIME_EFFECT_GATE` remain unmeasured until the final Web deploy.

## Current M1 capability scope

`docs/openkore-reference/m1-core-hunting-closure.md` assigns 38 census IDs to `M1_REQUIRED`, 14 to optional, 6 to future and 1 to not applicable. That table predates the active 2026-09-25 inventory-maintenance decision. Its optional `R12 Shop sell` and `R13 Storage` are now M1-required because the canonical decision explicitly enables `AUTOSELL` and `AUTOSTORE` with return/resume. The current total is **40 required IDs**. No other census ID is promoted by this decision. `CAPABILITIES_38` is superseded for this acceptance.

The 40 IDs are the previous 38 plus R12 and R13. `UNCLASSIFIED=0`. Existing normal-player Store/Sell, Supply-return-to-HIT, Fly-to-HIT, death-maintenance-to-HIT and inventory-maintenance-to-HIT results remain valid bounded chain evidence. They do not establish all conditions in each pinned OpenKore row, such as rejection, timeout and fallback matrices. The subsequent per-ID reconciliation in `m1-v15-capability-reconciliation-2026-09-26.md` promotes H15, C01, R12 and R13 using the preserved last-good chains. Its current classification is `PASS=4`, `PARTIAL=36`, `MISSING=0`, `UNCLASSIFIED=0` among the 40 required IDs. Explicit GI overrides remain semantics metadata, not a substitute for acceptance. `CAPABILITY_FINAL_GATE=BLOCKED` on the 36 exact remaining elements.

The bounded next acceptance must check exact missing transitions from the current 40-row census against current Native/Web checkpoints, without rerunning already-passed chains or replacing authoritative game behavior. Final closure also awaits A's World Map checkpoint, final integrated deployment, Browser acceptance and the user's own Teleport Audio listening result.
