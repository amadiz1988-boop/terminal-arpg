# M1 V15 executor closure: twelve remaining settings

Pre-implementation reference and source comparison. Product authority is
`docs/project-control/canonical-m1-world-travel-supply-ui-v1.md` current rules;
the OpenKore revision is exactly `51de1ddfc4449ae5217f6886de702f87ca934030`.
OpenKore is a behavior reference; PA/rAthena remain execution authority.
The fixed 42-row inventory is `docs/project-control/m1-v15-settings-fixture-preflight.md`.

`OPENKORE_REFERENCE_TRIGGERED=YES`; `OPENKORE_BEHAVIOR_COMPARED=YES` for the
rows with exact evidence below. `SERVER_AUTHORITY_INVARIANTS_PRESERVED` and
`RESULT_EQUIVALENT_OR_BETTER` require post-change testing and are not yet
attested. Source modification of a row needs the six-question gate to pass.

| SETTING_ID | CANONICAL_M1_SEMANTICS | OPENKORE_REFERENCE (file, symbol, config, default, transition) | CURRENT_EXECUTOR_CAPABILITY | FIRST_BROKEN_TRANSITION | MINIMAL_FIX | FINAL_CLASSIFICATION | LIVE_EFFECT_PROOF |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `supply.enabled` | Opt-in combat-continuity consumable Supply | No global OpenKore toggle (`NO_MATURE_REFERENCE=YES`); `control/config.txt:734` `buyAuto` has empty row by default, `src/AI/CoreLogic.pm:2073-2105` skips unconfigured rows and queues eligible buy | Native `parse_m1_supply_policy` and `process_configure_supply_policy` exist behind rollout flags | Config write → current Production executor admission | Attest existing typed policy command, enable only after Native capability and effect proof | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `supply.services.buy.enabled` | Gate supported healing-item buy rows | `control/config.txt:734-750` `buyAuto`; `src/AI/CoreLogic.pm:2073-2105`; empty/default-disabled row does not queue, eligible row does | Native `buy_enabled` parser and `m1_buy_due` | Config write → current Production executor admission | Reuse the per-character `buyEnabled` field and prove no-buy when false | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `supply.services.buy.rules` | Ordered eligible healing consumable min/max rows, real NPC purchase | `control/config.txt:734-750` `buyAuto` default template min 2/max 3; `src/AI/CoreLogic.pm:2073-2241` selects eligible row, checks amount/NPC/Zeny and retries/bounds | Native parses up to 32 rows and filters non-healing; existing service route and NPC buy | Saved row → supported-row validation and effective purchase | Admit only supported row fields, reject ignored fields, prove inventory and Zeny effect | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.profile` | Accepted GI damage-profile context, no independent combat engine | No eight-profile OpenKore enum (`NO_MATURE_REFERENCE=YES`); action semantics from `attackAuto` and `attackUseWeapon` below | Web `resolveFarmExecutionProfile`; Native `parse_farm_payload` | UI disabled despite stored-to-`start_farm` adapter | Expose only accepted M1 profiles, attest current PA/controller and next-farm effect | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.attack.mode` | M1 active local hunting mode | `control/config.txt:70` `attackAuto=2`; `src/AI/CoreLogic.pm:3273-3295` gates auto-attack by action/town/service | Web admits only mode 2; Native AUTO_FARM owns scan/combat | UI selector exposes unsupported values and is disabled | Expose only mode 2 or add an exact authorized mode adapter | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.attack.useWeapon` | Weapon candidate may be disabled for skill-only mode | `control/config.txt:89` `attackUseWeapon=1`; `src/AI/Attack.pm:725-754` initializes weapon method, skill slot may override | Web transports boolean; Native guards normal attack | UI disabled despite source adapter | Attest legal weapon fallback and no weapon attack when false | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.attack.distance` | Desired normal-attack approach distance, bounded by server weapon range | `control/config.txt:83-84` `attackDistance=1`, `attackDistanceAuto=1`; `src/AI/Attack.pm:729,765-770` uses desired distance; `src/Network/Receive.pm:10598-10605` lowers desired distance when server range is shorter | Native uses `sd->battle_status.rhw.range` and `walk_to_farm_target`, no per-character desired distance | Stored field → Native approach distance | Carry desired distance while retaining rAthena weapon-range and LOS authority | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.attack.maxDistance` | Maximum normal-attack feasibility distance; at least desired distance | `control/config.txt:85` `attackMaxDistance=1`; `src/Network/Receive.pm:10598-10605` auto-sets server range; `src/AI/Attack.pm:765-792` clamps to desired and calls `canAttack` | Native uses rAthena weapon range/`battle_check_range`, no per-character max | Stored field → Native approach/feasibility | Carry bound without ever permitting an illegal rAthena attack | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.travel.flyWing.enabled` | Explicit GI no-target Fly policy; item 601 is non-consumable | `NO_MATURE_REFERENCE=YES` for no-target Fly; `control/config.txt:317` `teleportAuto_search=0`, `src/AI/CoreLogic.pm:3291` search count does not issue Fly; GI override at `docs/RO_FLY_WING_SOURCE_AUDIT.md:19` | Web transports `huntRelocationEnabled`; Native `try_hunt_relocation` | UI disabled and post-Fly HIT unproven | Attest legal trigger, same-map relocation, rescan and authoritative HIT | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.skills.attackSlots` | Ordered M1 supported skill candidates, rAthena decides legality | `control/config.txt:605-631` empty `attackSkillSlot` by default; `src/AI/Attack.pm:738-754` first matching slot overrides weapon, otherwise fallback | Web `resolveAttackSkillProfile` supports numeric ID/level, HP/SP %, timeout; Native ordered rows | Full row UI exposes unsupported predicates | Enable only supported row subfields; reject unsupported writes; prove cast/fallback | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.skills.selfSkills` | M1 self-recovery skill conditions and cast | `control/config.txt:654-663` empty `useSelf_skill`, smartHeal 1; `src/AI/CoreLogic.pm:3008-3055` selects first eligible row, validates learned skill/conditions, schedules cast | Native HP recovery allowlist and `unit_skilluse_id`, no per-character ordered row | Config row → Native recovery choice | Integrate supported ordered self-recovery rows into existing survival handler; retain rAthena skill legality | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |
| `combat.itemUse` | M1 HP potion condition and native item use | `src/AI/CoreLogic.pm:2982-3003` `processAutoItemUse`; `control/config.txt` `useSelf_item` has no active row by default | Web `resolveHpPotionProfile` supports item ID, HP below %, timeout; Native `try_character_hp_potion` | Full row UI exposes unsupported conditions | Enable only supported subfields; reject unsupported writes; prove HP/count delta | UNCLASSIFIED, target `M1_ACTIVE_SUPPORTED` | NOT_PROVEN |

OpenKore's `attackDistanceAuto` runtime decision is in
`src/Network/Receive.pm:10598-10605`, not `src/AI/Attack.pm`; the latter reads
the resulting values. This corrects the incomplete pointer in
`m1-settings-runtime-mapping-gate-v2.md` without changing the pinned behavior.
GI Fly nonconsumption and combat-continuity-only Supply are explicit canonical
overrides. No OpenKore process, packet engine or second status authority is
authorized. `OPTIMIZATION_APPLIED=NO_NOT_NEEDED` until a row-specific review
shows a server-authority or recovery improvement with equivalent player result.

## V15 source closure addendum

The source candidate carries all twelve paths in
`config-capabilities.mjs::M1_EXECUTOR_PATHS`. They are exposed only when the
controlled Native M1 rollout flag is on and the character controller is
`SERVER_AGENT`. The server rejects unsupported direct writes and row
predicates. This is source evidence, not current Production classification.

The nine combat paths use `resolveFarmExecutionProfile` at the real
`start_farm` Controller boundary. `combat.attack.distance/maxDistance` are
transported to Native `parse_farm_payload`; `m1_weapon_range_policy` caps
both at the equipped rAthena weapon range and `battle_check_range` remains
authoritative. `combat.skills.selfSkills` is limited to ordered, numeric,
self-targeted recovery skill rows with supported HP/SP percentage and timeout
conditions. Native verifies the learned level, cast condition and SP before
`unit_skilluse_id`. Unconfigured recovery retains its historical allowlist.
The three Supply paths reuse `configure_supply_policy` and the existing
M1 healing-item parser/service executor.

Direct source checks: `test-farm-execution-profile.mjs`,
`test-m1-config-capability-gate.mjs`, `test-m1-self-recovery-skill-profile.mjs`,
`test-m1-attack-skill-profile.mjs`, `test-m1-hp-potion-profile.mjs`, and Native
`Test-M1V15ExecutorFixture.ps1`. The clean Native candidate's formal Release
x64 build and thirteen existing regression suites passed. No field is
classified `M1_ACTIVE_SUPPORTED` until the exact Web/Native pair is deployed,
authoritative effects are observed, and the final 42-row gate is recalculated.
