# Thin profile contract reference record

```text
OPENKORE_REFERENCE_REQUIRED = YES
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
OPENKORE_REFERENCE_SOURCE = local pinned .local/ro-stack/openkore
OPENKORE_ATLAS_TOPIC = ATTACK_AUTO, COMBAT, BUFF_HEAL_AUTOMATION
PROJECT_LAST_GOOD = Gate 1A normal attack/HIT, Gate 1B recovery, Gate 2 supply resume
RATHENA_AUTHORITY = unit_attack, unit_skilluse_id, skill_check_condition_castbegin, battle_check_target
REFERENCE_CONFLICT = NO for attackUseWeapon and action-specific SP
REUSE_CLASSIFICATION = ADAPT
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
OPTIMIZATION_APPLIED = NO_NOT_NEEDED
```

The profile labels are a Ghost Island canonical selection context, documented
in `docs/architecture/local-hunting-hybrid-architecture.md`. OpenKore has no
matching eight-profile enum. `NO_MATURE_REFERENCE = YES` for the label catalog;
`PROJECT_POLICY_REQUIRED = YES` was satisfied by the accepted GI Local Hunting
ADR and roadmap. The catalog itself creates no gameplay semantics. Each executable policy below
is mapped independently to a pinned mature behavior.

| OpenKore file | Symbol | Config | Default | Behavior | Transition | Current GI behavior | Port mapping |
|---|---|---|---|---|---|---|---|
| `control/config.txt:89`; `src/AI/Attack.pm:725-754` | `AI::Attack::main` attack-method selection | `attackUseWeapon` | `1` | Weapon method is initial candidate only when enabled; matching skill slot can override it | candidate weapon or none → eligible skill or retained weapon → attack/wait | Native skill failure always falls back to weapon | Bind stored `combat.attack.useWeapon` to session; never issue weapon attack when false |
| `control/config.txt:605-631`; `src/AI/Attack.pm:738-754` | `attackSkillSlot` loop | `attackSkillSlot_*`, `maxUses`, `maxAttempts` | no configured slot | Skip nonmatching or exhausted skill slot; retain enabled weapon candidate | configured slot → condition check → skill selected or skipped | Native supports one optional `skillId`, not full slot scheduler | Keep one existing skill path; unsupported slot scheduling remains explicit Stage3A |
| `src/Misc.pm:5660-5674`; `src/AI/Attack.pm:747,879-891` | `checkSelfCondition`, `AI::Attack::main` no-method branch | skill level and cost; no-method give-up | action-specific; six seconds | Learned level and current SP gate only that skill candidate; no attack method waits six seconds then drops target | skill eligible → selected; insufficient SP → skip; no method → bounded wait → give up | Native checks learned level, cost, cooldown and cast legality, then forces melee | If weapon enabled, retain weapon fallback; if disabled, wait six seconds with typed skill-unavailable reason and retarget |
| `control/config.txt:290-296`; `src/AI/CoreLogic.pm:2909-2962` | `processSitAuto` | `sitAuto_sp_lower`, `sitAuto_sp_upper` | `0`, `0` | SP does not trigger default sit; configured positive threshold may queue sit under action/safety/weight gates | allowed action + threshold → sit; upper threshold → stand | Source checkpoint 6ad4c9c disables global default SP recovery; full sit gate differs | Preserve disabled default and existing positive opt-in; do not introduce profile-invented threshold |
| `control/config.txt:70`; `src/AI/CoreLogic.pm:3273-3295` | `processAutoAttack` | `attackAuto` | `2` | Attack selection is gated by mode, town and service queues | allowed intent → target/combat; blocked intent → wait | PA owns AUTO_FARM and interruption; Web profile `attack.mode` is config-only | Admit current executor only for compatible active attack mode; support/follow schedulers remain unavailable |
| `src/AI/CoreLogic.pm:3291`; `src/Misc.pm:3607,3624`; `docs/RO_FLY_WING_SOURCE_AUDIT.md:19` | `processAutoAttack` search counter; GI explicit no-target override | `teleportAuto_search=0`; GI `combat.travel.flyWing.enabled=true` | OpenKore 0; GI true | OpenKore search count gates attack candidate; it never issues no-target Fly. GI player policy allows Fly after no target | no target + enabled + item present → Native same-map item use, position confirmation | Native env item list had no per-character enabled gate | Carry persisted GI toggle in `start_farm`; gate existing `try_hunt_relocation`, with no new search engine |

`CURRENT_GI_BEHAVIOR` is from `ops/ro-stack/dashboard/config-schema.mjs`,
`dashboard/config-storage.mjs`, `dashboard.mjs::queueOwnershipCommand`, and
`src/map/persistent_agent.cpp::parse_farm_payload/activate_farm_runtime` plus
the farm skill branch. `OPENKORE_LAST_GOOD_PLAYER_RESULT` is an eligible normal
attack when weapon use is enabled, no weapon attack when disabled, and an
unavailable skill does not globally disable movement. The thin contract
preserves this result for currently implemented actions. Full Stage3 skill,
buff, party and follow equivalence remains `NOT_IMPLEMENTED` and cannot be
promoted by this contract.

The intended source gate is: valid stored profile and options, typed rejection
for unknown or unimplemented executor, profile bound into durable `target_rules`,
and a normal-attack check immediately before the existing Native unit attack.
No new combat, recovery, or navigation engine is authorized here.
The GI no-target Fly row has `NO_MATURE_REFERENCE=YES` for that exact trigger
and `PROJECT_POLICY_REQUIRED=YES`, satisfied by the cited explicit player
decision. OpenKore `teleportAuto_search` is not used as its justification.
