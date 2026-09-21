# Local Hunting Hybrid Architecture

```text
STATUS = ACCEPTED / MIGRATION_IN_PROGRESS
LOCAL_HUNTING_IS_PRIMARY_RUNTIME_LOOP = YES
LOCAL_HUNTING_OPTIMIZATION_PRIORITY = VERY_HIGH
PA_OWNS_INTENT_JOURNEY_INTERRUPT_RESUME = YES
RATHENA_OWNS_LOCAL_HUNTING_EXECUTION = TARGET_DIRECTION / STAGED_MIGRATION
GLOBAL_AUTOLOOT = YES
GLOBAL_AUTOSTORE = NO
FULL_LOCAL_HUNTING_REPLACEMENT = NO
STAGE2_GLOBAL_PROMOTION = NOT_YET_COMPLETE
CLASS_AWARE_COMBAT_PROFILE = YES
CLASS_AWARE_COMBAT_PROFILE_IMPLEMENTATION_STARTED = NO
NORMAL_ATTACK_CLASS_PARITY = NOT_YET_PROVEN
PARTY_SUPPORT_FIRST_CLASS = YES
SKILL_ONLY_IMPLEMENTED = NO
PARTY_HEAL_IMPLEMENTED = NO
PARTY_BUFF_IMPLEMENTED = NO
PARTY_FOLLOW_IMPLEMENTED = NO
```

## Context

Characters spend most normal runtime hunting. High-frequency same-map combat
therefore has very high optimization value. rAthena is closest to monster state,
position, pathfinding, attack timers, skill legality, damage, hit or miss,
death, drop resolution and inventory mutation. PA remains the product authority
for persistent intent, journeys, interruption and resume.

The design goal is `USE_BETTER_MATURE_HUNTING_BEHAVIOR_WHERE_PROVEN`. Each
authority transfer requires `RESULT_EQUIVALENT_OR_BETTER = YES` plus explicit
proof of no Supply, return-to-farm, Quest, Social or parent-intent regression.

## Decision

PA owns why the character acts, where the character goes next, journey state,
interruptions and resume. A staged rAthena Local Hunting executor may own how
the character fights on the current map. Local Hunting remains a child executor
under PA intent and cannot become a second Life, Journey, Quest or Supply
director.

Migration is capability-by-capability. Big Bang replacement is forbidden and
the existing PA fallback remains available until each promotion gate passes.

## Class-aware combat profiles

The accepted product model is:

```text
JOB
-> AVAILABLE COMBAT PROFILES / OPTIONS
PLAYER
-> PREFERRED PROFILE + PROFILE-SPECIFIC TACTICAL OPTIONS
rAthena Local Hunting Executor
-> LEGAL / AUTHORITATIVE EXECUTION
PA
-> INTENT / JOURNEY / INTERRUPT / RESUME
```

The profile model is `COMBAT_PROFILE + TACTICAL_OPTIONS`, not a collection of
global booleans. The initial accepted catalog is `MELEE_DAMAGE`,
`RANGED_DAMAGE`, `SKILL_CAST`, `HYBRID_DAMAGE`, `HEAL_SUPPORT`,
`COMBAT_SUPPORT`, `FOLLOW_SUPPORT` and `PASSIVE_FOLLOW`.

Availability is derived from canonical job, skill-tree, equipment or attack-type
and available-skill capabilities. A job may expose multiple legal profiles.
Examples are design guidance only and do not authorize a hardcoded final job
table. `SKILL_CAST` must support `NORMAL_ATTACK_CAN_BE_DISABLED = YES`; a
temporarily unavailable skill follows explicit wait, position, regeneration or
approved fallback policy without silently forcing normal attack.

`ONE_COMBAT_AI_FOR_ALL_JOBS = FORBIDDEN` and
`JOB_HARDCODED_SINGLE_BUILD = FORBIDDEN`. This is design accepted and remains
outside implementation authorization.

Representative profile-specific options include:

```text
SKILL_CAST      = disable_normal_attack, offensive_skill, ground_skill,
                  cast_distance, AoE_policy, SP_reserve, no-skill fallback
HEAL_SUPPORT    = self_heal, party_heal, emergency_threshold, buffs,
                  cleanse, follow_leader, follow_distance, SP_reserve
RANGED_DAMAGE   = attack_range, avoid_melee_distance, ranged_attack,
                  offensive_skill, close-enemy_reposition
```

The option set is selected by profile and legal capability. It is not a global
cross-job checkbox list.

## Responsibility Boundary

PA permanently owns:

```text
farm_target
parent_intent
cross-map navigation
supply trigger and supply policy
service selection
buy / sell / storage / withdraw
return-to-farm
arrival confirmation
auto-resume decision
quest navigation and quest runtime
NPC dialogue / OnTouch / menu / quiz / confirmation
job-change orchestration
social intent and life intent
reconnect/restart intent restoration
quarantine and recovery policy
command revision and dedupe ownership
```

rAthena remains world authority for map entities, position, path legality,
attack timing, skill legality, damage, hit, miss, death, drop resolution and
inventory mutation. Event Ledger records authoritative facts only.

## Local Hunting Scope

Separate migration gates may evaluate target scan, target selection and
retarget, approach, same-map pathing, attack-range handling, melee cadence,
skills, buffs, ammo, same-map roaming, same-map stuck recovery, same-map Fly
Wing or teleport and Global AutoLoot. Target authority transfers only after
parity proof. Local Hunting cannot autonomously cross maps.

Party support is a first-class Local Hunting capability. A bounded same-map
executor may follow, reposition, heal, buff and maintain support range. A map
exit or cross-map transition must stop local follow/combat and return to PA for
the cross-map journey, authoritative arrival and resume. Cross-map follow
remains PA-owned.

Skill execution is split into independent future gates:

```text
STAGE_3A = OFFENSIVE_SKILL_EXECUTOR
STAGE_3B = SELF_SUPPORT_EXECUTOR
STAGE_3C = PARTY_SUPPORT_EXECUTOR
```

Stage 3 requires `AUTOSKILL_REFERENCE_FIRST = YES` and a completed
`RATHENA_AUTOSKILL_AND_PARTY_SUPPORT_REFERENCE_MINING_V1` before implementation.

## PA Permanent Ownership

Supply Journey, return-to-farm, Quest, NPC interaction, Social, Life,
persistent intent, interruption, resume and reconnect restoration remain PA
capabilities. Server-side combat events do not directly create relationship,
diary, social-intent or life-goal state.

## Supply / Return Contract

The accepted journey structure is:

```text
SUPPLY_LOW
-> STOP_LOCAL_COMBAT
-> Butterfly Wing
-> authoritative Save Point
-> supplyServiceRoute
-> authoritative buy / sell / storage / withdraw
-> supplyRouteBack
-> farm_target arrival
-> AUTO_FARM resume decision
```

Production evidence for character `150069` records `prt_fild08` as farm target,
Butterfly arrival at `izlude (128,98)`, service routing through `prt_fild05`, Red
Potion `0 -> 15`, return through `prt_fild07` to `prt_fild08`, then
`AUTO_FARM_STARTED`. Web checkpoint is `66aff36fc04dff2f3796e9703b986852c591ff78`.
Native Supply lineage is `774761417a91803ccc460628ac11619a1fc70ed2`.

`supplyServiceRoute` means Save Point to Service. `supplyRouteOut` remains the
Farm to Service fallback when Butterfly Wing is not used. `supplyRouteBack`
means Service to Farm. Local Hunting must not absorb these routes.

## Quest / Social / Life Contract

PA may navigate for a Quest, start a bounded Local Hunting lease, stop it before
NPC dialogue or player interaction, then continue the Quest. Social or Life
interruptions follow the same stop, interact and resume contract. Parent intent
always wins over a Local Hunting lease.

Quest kill objectives may apply a bounded target-policy override. Quest NPC
dialogue, OnTouch, menu, quiz, input, confirmation and job-change orchestration
remain PA-owned. The completed Quest flow may restore the appropriate selected
Combat Profile.

## Global AutoLoot Decision

```text
GLOBAL_AUTOLOOT = YES
GLOBAL_AUTOLOOT_TO_INVENTORY = YES
GLOBAL_AUTOSTORE = NO
DROP != LOOT_ACQUIRED
```

The required fact chain is:

```text
MONSTER_KILL
-> DROP_RESOLUTION
-> GLOBAL_AUTOLOOT_TO_INVENTORY
-> authoritative pc_additem success
-> LOOT_ACQUIRED
-> EVENT_LEDGER
-> PLAYER_COMBAT_LOG
```

Only successful authoritative inventory mutation may emit `LOOT_ACQUIRED` or
`[拾取] ItemName x Amount`. Weight rejection, full inventory or rejected item
add produces no successful pickup event. AutoLoot feeds inventory only so PA can
continue observing weight, ammo and Supply thresholds.

## Current Proven Migration State

Stage 0 architecture audit is `PASS`. Stage 1 Shadow Observer is `PASS` at
Native checkpoint `b40fc4829896ef0ad9e6dd943e12a051fecb9743`, with 26 live
observations across characters `150056` and `150069` on `pay_dun00` and
`prt_fild08`. Timing was p50 `27 us`, p95 `38 us`, max `53 us`, with zero
gameplay authority.

Stage 2 bounded melee canary is `PASS`: PA retained target authority, rAthena
received a bounded melee lease, authoritative `MONSTER_HIT` was observed,
`STOP_LOCAL_COMBAT` produced zero post-stop attacks, and stale epoch, map exit,
Supply, Quest and Social interrupt contracts passed. Global Stage 2 promotion
remains incomplete.

## Remaining Hard Gates

The current unproven transition is:

```text
RETURN_TO_FARM
-> NEW_LOCAL_COMBAT_LEASE
-> TARGET
-> ATTACK
-> at least 3 authoritative MONSTER_HIT
```

Further gates cover target and retarget parity, skill execution, Global
AutoLoot authoritative item-add and Combat Log projection, same-map path and
stuck recovery, ammo, buff, combat potion, party and kill-steal behavior.

Normal attack terminology remains historical at Stage 2. The future gate is:

```text
NORMAL_ATTACK_CLASS_PARITY_GATE = REQUIRED
NORMAL_ATTACK_CLASSES = melee, bow/ranged, gun/ranged
NORMAL_ATTACK_EXECUTOR = GENERALIZED ONLY AFTER ALL THREE PASS
```

`MELEE_EXECUTOR` remains the current canary label and is not renamed in
historical checkpoints. `NORMAL_ATTACK_CLASS_PARITY = NOT_YET_PROVEN`.

## Non-Goals

This decision does not authorize Production deployment, runtime restart,
complete AutoLoot implementation, Global AutoStore, cross-map Local Hunting,
full combat replacement, Supply migration, Quest migration, Social migration or
Life simulation.

## Forbidden Regressions

Promotion requires all of the following:

```text
RESULT_EQUIVALENT_OR_BETTER = YES
NO_SUPPLY_REGRESSION = YES
NO_RETURN_TO_FARM_REGRESSION = YES
NO_QUEST_REGRESSION = YES
NO_SOCIAL_REGRESSION = YES
NO_PARENT_INTENT_REGRESSION = YES
```

## Reference Checkpoints

- rAthena server-side Auto Combat reference: `961ac3c`.
- Mature public floor: same-map server-side combat.
- Public cross-map Supply evidence: `NO_PUBLIC_EVIDENCE`.
- Public return-to-farm evidence: `NO_PUBLIC_EVIDENCE`.
- Public auto-resume-after-Supply evidence: `NO_PUBLIC_EVIDENCE`.
- Stage 1 Native checkpoint: `b40fc4829896ef0ad9e6dd943e12a051fecb9743`.
- Supply Web checkpoint: `66aff36fc04dff2f3796e9703b986852c591ff78`.
- Native Supply lineage: `774761417a91803ccc460628ac11619a1fc70ed2`.
- Reference dossier: `docs/reference-mining/topics/rathena-server-side-autocombat.md`.
- Capability matrix: `docs/reference-mining/rathena-autocombat-capability-matrix.yml`.
- Project comparison: `docs/reference-mining/rathena-autocombat-vs-project-pa.md`.

`NO_PUBLIC_EVIDENCE != NOT_SUPPORTED` and `NO_PUBLIC_EVIDENCE != PASS`.

## Implementation Sequence

1. Preserve Stage 1 shadow observation and PA fallback.
2. Complete Stage 2 return-to-farm reentry proof and bounded melee promotion.
3. Prove target and retarget parity before authority transfer.
4. Add `NORMAL_ATTACK_CLASS_PARITY_GATE` for melee, bow/ranged and gun/ranged.
5. Complete AutoSkill reference mining, then add Stage 3A offensive skills,
   Stage 3B self support and Stage 3C party support as separate leases and
   gates.
6. Implement Global AutoLoot through authoritative inventory mutation and Event
   Ledger facts.
7. Evaluate same-map roam and stuck recovery.
8. Evaluate combat potion, ammo, party and kill-steal policy in separate gates.
