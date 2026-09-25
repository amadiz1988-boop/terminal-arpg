# M1 V15 settings and fixture preflight

This is a current-source and current-Production preflight, not a promotion
receipt. Web source/deployed SHA: `b490283a88b63125a82454c3b5e0694504acfbab`.
Native deployed SHA: `23c47bfee3a4a1dae21754fb7a4e3ed32d3f657a`.
Pinned OpenKore reference: `51de1ddfc4449ae5217f6886de702f87ca934030`.
Product authority: `docs/project-control/canonical-m1-world-travel-supply-ui-v1.md`,
especially current supply rules and Settings at lines 117-135.

`CURRENT_UI_STATE = DISABLED` for every row below. The authenticated current
`/api/config` response has `execution.applied=false`,
`controller=CONFIG_ONLY`, `reason=CONFIG_ONLY_NO_EXECUTOR_COMMAND`.
`config-capabilities.mjs::configCapability` therefore never returns SUPPORTED;
`config-editor.js` disables every field, array editor, and Save action.
The original UI census is PARTIAL 32 / UNAVAILABLE 10. A stored-to-command
source adapter does not prove a live executor effect.

`UNCLASSIFIED` below is deliberate: these fields are in the currently
authorized M1 settings scope, so calling them `M1_EXPLICITLY_DISABLED` would
hide an unfinished requirement, while calling them `M1_ACTIVE_SUPPORTED`
would falsely assert present player operability. The other rows use exactly
one V15 classification. `M1_EXPLICITLY_DISABLED` means the current UI remains
disabled; it does not attest direct API write rejection.

| SETTING_ID | UI_GROUP | CURRENT_UI_STATE | CURRENT_CONFIG_PATH | CURRENT_CONTROLLER_MAPPING | CURRENT_EXECUTOR | CURRENT_EFFECTIVE_BEHAVIOR | M1_CLASSIFICATION | CLASSIFICATION_EVIDENCE | REQUIRED_CHANGE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `supply.enabled` | 補給 | DISABLED | `supply.enabled` | conditional `nativeSupplyConfigExecution` | Native `configure_supply_policy` when rollout-enabled | Production CONFIG_ONLY | UNCLASSIFIED | Canonical current M1 consumable Supply; `m1-settings-runtime-mapping-gate-v2.md` | Prove policy command and real shortage effect, then attest and enable |
| `supply.weightTriggerPercent` | 補給 | DISABLED | `supply.weightTriggerPercent` | config storage only | none for M1 | no weight-triggered Supply | GI_EXPLICIT_OVERRIDE | Canonical lines 117-129 exclude weight trigger | Keep disabled; reject unsupported writes |
| `supply.inventorySlotTrigger` | 補給 | DISABLED | `supply.inventorySlotTrigger` | config storage only | none for M1 | no slot-triggered Supply | GI_EXPLICIT_OVERRIDE | Canonical lines 117-129 exclude slot trigger | Keep disabled; reject unsupported writes |
| `supply.services.storage.enabled` | 補給 | DISABLED | `supply.services.storage.enabled` | config storage only | none for M1 | no autostorage | M1_EXPLICITLY_DISABLED | Canonical lines 117-129: GLOBAL_AUTOSTORE=NO | Keep disabled; reject unsupported writes |
| `supply.services.storage.npc` | 補給 | DISABLED | `supply.services.storage.npc` | config storage only | none for M1 | no storage NPC policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude storage service | Keep disabled; reject unsupported writes |
| `supply.services.storage.npc_steps` | 補給 | DISABLED | `supply.services.storage.npc_steps` | config storage only | none for M1 | no storage dialogue policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude storage service | Keep disabled; reject unsupported writes |
| `supply.services.storage.distance` | 補給 | DISABLED | `supply.services.storage.distance` | config storage only | none for M1 | no storage NPC distance policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude storage service | Keep disabled; reject unsupported writes |
| `supply.services.sell.enabled` | 補給 | DISABLED | `supply.services.sell.enabled` | config storage only | none for M1 | no autosell | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude sell service | Keep disabled; reject unsupported writes |
| `supply.services.sell.npc` | 補給 | DISABLED | `supply.services.sell.npc` | config storage only | none for M1 | no sell NPC policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude sell service | Keep disabled; reject unsupported writes |
| `supply.services.sell.npc_steps` | 補給 | DISABLED | `supply.services.sell.npc_steps` | config storage only | none for M1 | no sell dialogue policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude sell service | Keep disabled; reject unsupported writes |
| `supply.services.sell.distance` | 補給 | DISABLED | `supply.services.sell.distance` | config storage only | none for M1 | no sell NPC distance policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude sell service | Keep disabled; reject unsupported writes |
| `supply.services.buy.enabled` | 補給 | DISABLED | `supply.services.buy.enabled` | conditional `nativeSupplyConfigExecution` | Native `configure_supply_policy` when rollout-enabled | Production CONFIG_ONLY | UNCLASSIFIED | Canonical current M1 Supply buy chain; `nativeSupplyConfigPaths` | Prove per-character buy policy and merchant result, then attest and enable |
| `supply.services.withdraw.enabled` | 補給 | DISABLED | `supply.services.withdraw.enabled` | config storage only | none for M1 | no withdraw service | M1_EXPLICITLY_DISABLED | Canonical combat-continuity Supply excludes storage withdrawal | Keep disabled; reject unsupported writes |
| `supply.services.storage.minZeny` | 補給 | DISABLED | `supply.services.storage.minZeny` | config storage only | none for M1 | no storage Zeny threshold | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude storage service | Keep disabled; reject unsupported writes |
| `supply.services.storage.keepOpen` | 補給 | DISABLED | `supply.services.storage.keepOpen` | config storage only | none for M1 | no storage session policy | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 exclude storage service | Keep disabled; reject unsupported writes |
| `supply.services.buy.rules` | 補給 | DISABLED | `supply.services.buy.rules` | conditional `nativeSupplyConfigExecution` | Native `parse_m1_supply_policy` when rollout-enabled | Production CONFIG_ONLY | UNCLASSIFIED | Canonical current M1 consumable purchase; `nativeSupplyConfigPaths` | Prove supported item rows, count threshold, purchase and authoritative inventory, then attest and enable |
| `supply.services.withdraw.rules` | 補給 | DISABLED | `supply.services.withdraw.rules` | config storage only | none for M1 | no withdraw rows | M1_EXPLICITLY_DISABLED | Canonical combat-continuity Supply excludes storage withdrawal | Keep disabled; reject unsupported writes |
| `supply.itemRules` | 補給 | DISABLED | `supply.itemRules` | config storage only | Native M1 parser ignores rows | no granular disposition | M1_EXPLICITLY_DISABLED | Canonical lines 117-129 prohibit auto-storage/sell; `m1-settings-runtime-mapping-gate-v2.md` | Keep disabled; reject unsupported writes |
| `combat.profile` | 掛機 | DISABLED | `combat.profile` | `resolveFarmExecutionProfile` in `start_farm` | Native farm profile | Stored option reaches source adapter, Production UI cannot edit | UNCLASSIFIED | `profile-contract-evidence.md`; M1 attack profiles | Prove permitted option subset and live command effect, then attest and enable |
| `combat.attack.mode` | 戰鬥 | DISABLED | `combat.attack.mode` | `resolveFarmExecutionProfile` in `start_farm` | Native AUTO_FARM admission | Source adapter only accepts mode 2 | UNCLASSIFIED | `farm-execution-profile.mjs`; pinned `attackAuto` | Restrict UI options to executable subset or implement exact mature modes; attest effect |
| `combat.attack.useWeapon` | 戰鬥 | DISABLED | `combat.attack.useWeapon` | `resolveFarmExecutionProfile` in `start_farm` | Native weapon method gate | Stored option reaches source adapter, no live UI proof | UNCLASSIFIED | `profile-contract-evidence.md`; pinned `attackUseWeapon` | Prove no weapon attack when false and fallback when true; attest and enable |
| `combat.attack.distance` | 戰鬥 | DISABLED | `combat.attack.distance` | config storage only | Native uses weapon range, ignores per-character value | no adjustable attack distance | UNCLASSIFIED | `m1-settings-runtime-mapping-gate-v2.md`; pinned `attackDistance` | Port exact auto-distance semantics or record explicit M1 scope decision |
| `combat.attack.maxDistance` | 戰鬥 | DISABLED | `combat.attack.maxDistance` | config storage only | rAthena range authority, ignores per-character value | no adjustable max distance | UNCLASSIFIED | `m1-settings-runtime-mapping-gate-v2.md`; pinned `attackMaxDistance` | Port exact bound semantics or record explicit M1 scope decision |
| `combat.attack.checkLOS` | 戰鬥／目標進階 | DISABLED | `combat.attack.checkLOS` | config storage only | fixed rAthena range/LOS | default-like fixed LOS, no toggle | M1_EXPLICITLY_DISABLED | Schema `advanced:true`; canonical allows unsupported advanced settings disabled | Keep disabled; reject unsupported writes |
| `combat.attack.canSnipe` | 戰鬥／目標進階 | DISABLED | `combat.attack.canSnipe` | config storage only | fixed rAthena range/LOS | no snipe toggle | M1_EXPLICITLY_DISABLED | Schema `advanced:true`; no M1 snipe executor | Keep disabled; reject unsupported writes |
| `combat.attack.changeTarget` | 戰鬥／目標進階 | DISABLED | `combat.attack.changeTarget` | config storage only | Native fixed retarget policy | no preemption toggle | M1_EXPLICITLY_DISABLED | Schema `advanced:true`; core retarget remains Native-owned | Keep disabled; reject unsupported writes |
| `combat.attack.maxRouteDistance` | 戰鬥／目標進階 | DISABLED | `combat.attack.maxRouteDistance` | config storage only | Native bounded same-map pathing, ignores per-character value | no adjustable path bound | M1_EXPLICITLY_DISABLED | Schema `advanced:true`; pinned `attackRouteMaxPathDistance` | Keep disabled; reject unsupported writes |
| `combat.attack.maxRouteTime` | 戰鬥／目標進階 | DISABLED | `combat.attack.maxRouteTime` | config storage only | Native bounded same-map pathing, ignores per-character value | no adjustable time bound | M1_EXPLICITLY_DISABLED | Schema `advanced:true`; pinned `attackMaxRouteTime` | Keep disabled; reject unsupported writes |
| `combat.follow.enabled` | 進階功能 | DISABLED | `combat.follow.enabled` | config storage only | none in M1 | no follow | M1_EXPLICITLY_DISABLED | Canonical Settings advanced group; M1 local hunting excludes party follow | Keep disabled; reject unsupported writes |
| `combat.follow.target` | 進階功能 | DISABLED | `combat.follow.target` | config storage only | none in M1 | no follow target | M1_EXPLICITLY_DISABLED | Canonical Settings advanced group; M1 local hunting excludes party follow | Keep disabled; reject unsupported writes |
| `combat.follow.distanceMin` | 進階功能 | DISABLED | `combat.follow.distanceMin` | config storage only | none in M1 | no follow distance floor | M1_EXPLICITLY_DISABLED | Canonical Settings advanced group; M1 local hunting excludes party follow | Keep disabled; reject unsupported writes |
| `combat.follow.distanceMax` | 進階功能 | DISABLED | `combat.follow.distanceMax` | config storage only | none in M1 | no follow distance ceiling | M1_EXPLICITLY_DISABLED | Canonical Settings advanced group; M1 local hunting excludes party follow | Keep disabled; reject unsupported writes |
| `combat.travel.flyWing.enabled` | 蒼蠅翅膀 | DISABLED | `combat.travel.flyWing.enabled` | `resolveFarmExecutionProfile` in `start_farm` | Native `try_hunt_relocation` | Stored option reaches source adapter, automatic Fly-to-HIT unproven | UNCLASSIFIED | `profile-contract-evidence.md`; explicit GI no-target policy | Prove legal trigger, same-map relocation and post-Fly HIT; attest and enable |
| `combat.travel.teleport.hp` | 蒼蠅翅膀 | DISABLED | `combat.travel.teleport.hp` | config storage only | no emergency executor | no low-HP teleport option | M1_EXPLICITLY_DISABLED | `m1-source-closure-recalculation-2026-09-24.md` OUTSIDE_M1 | Keep disabled; reject unsupported writes |
| `combat.travel.teleport.sp` | 蒼蠅翅膀 | DISABLED | `combat.travel.teleport.sp` | config storage only | no emergency executor | no low-SP teleport option | M1_EXPLICITLY_DISABLED | `m1-source-closure-recalculation-2026-09-24.md` OUTSIDE_M1 | Keep disabled; reject unsupported writes |
| `combat.travel.teleport.lostTarget` | 蒼蠅翅膀 | DISABLED | `combat.travel.teleport.lostTarget` | config storage only | no lost-target teleport executor | no lost-target toggle | M1_EXPLICITLY_DISABLED | `m1-source-closure-recalculation-2026-09-24.md` OUTSIDE_M1 | Keep disabled; reject unsupported writes |
| `combat.travel.teleport.dropTarget` | 蒼蠅翅膀 | DISABLED | `combat.travel.teleport.dropTarget` | config storage only | no drop-target teleport executor | no drop-target toggle | M1_EXPLICITLY_DISABLED | `m1-source-closure-recalculation-2026-09-24.md` OUTSIDE_M1 | Keep disabled; reject unsupported writes |
| `combat.skills.attackSlots` | 技能 | DISABLED | `combat.skills.attackSlots` | `resolveAttackSkillProfile` in `start_farm` | Native attack skill slots | Source adapter only; no Production UI effect attestation | UNCLASSIFIED | `profile-contract-evidence.md`; pinned `attackSkillSlot` | Prove supported rows/predicates and live skill effect; attest and enable |
| `combat.skills.selfSkills` | 恢復 | DISABLED | `combat.skills.selfSkills` | config storage only | no ordered self-skill row executor | no adjustable recovery/buff rows | UNCLASSIFIED | `m1-settings-runtime-mapping-gate-v2.md`; pinned `useSelf_skill` | Port exact supported recovery conditions or record explicit M1 scope decision |
| `combat.skills.partySkills` | 進階功能 | DISABLED | `combat.skills.partySkills` | config storage only | no party skill executor in M1 | no party skill rows | M1_EXPLICITLY_DISABLED | Schema `advanced:true`; M1 local hunting excludes party support | Keep disabled; reject unsupported writes |
| `combat.itemUse` | HP / SP | DISABLED | `combat.itemUse` | `resolveHpPotionProfile` in `start_farm` | Native potion policy | Source adapter only; no Production UI effect attestation | UNCLASSIFIED | `m1-source-closure-recalculation-2026-09-24.md`; pinned `useSelf_item` | Prove supported row predicates and authoritative potion use; attest and enable |
| `combat.targets` | 戰鬥／目標進階 | DISABLED | `combat.targets` | config storage only | Native selects monsters from farm map | no player per-monster policy | GI_EXPLICIT_OVERRIDE | AGENTS.md section 13: player selects map, not monster; schema `advanced:true` | Keep disabled; reject unsupported writes |

## Current gate and first blocked transitions

`SETTINGS_TOTAL=42`, `UNCLASSIFIED=12`, `M1_EXPLICITLY_DISABLED=27`,
`GI_EXPLICIT_OVERRIDE=3`, `M1_ACTIVE_SUPPORTED=0`, `NOT_APPLICABLE=0`.
The 12 `UNCLASSIFIED` rows require M1 executor/effect proof or an explicit
canonical scope decision before any of the four final classifications can be
truthfully assigned. `SETTINGS_FINAL_GATE=FAIL`. The UI has
`ENABLED_UNMAPPED=0`, `ENABLED_CONFIG_ONLY=0`, `ENABLED_NO_OP=0` at the observed
CONFIG_ONLY state; direct `/api/config` write admission for disabled fields
remains a separate open check.

`TEST_PLAYER=150105` is currently `PERSISTENT_IDLE`, map/save `iz_int04`,
HP 40/40, SP 11/11, Zeny 0, with no 601/602 in the prior authoritative
inventory observation. The approved `test_fixture_atcommand` command acts
only on its bound actor. The deployed Native SHA's
`test_fixture_atcommand.hpp::test_fixture_atcommand_self_scoped` admits only
self-scoped commands; `persistent_agent.cpp` also requires
`request.actor_char_id == command.char_id`. The historical command for
150105 was `REJECTED/atcommand_permission_denied` by rAthena group 0.
The `TEST_SUPERUSER=150106` transport cannot provision 150105 without a
cross-character authority/security change. The existing Admin fixture
navigation can request a legal route but does not grant items, Zeny, HP or
save point. `FIXTURE_PRECONDITION=BLOCKED_BY_AUTHORITY_BOUNDARY`; no direct DB
write, fixture command, gameplay action, deployment, or restart was attempted
for this preflight.

Current Production lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a` remains
ACTIVE under F; `drift=OPEN`, baseline `LEGACY_PRE_GITHUB_FIRST`, final receipt
absent. The current runtime health check passed and quarantine count was zero.
