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
4. Add skill execution as a separate lease and gate.
5. Implement Global AutoLoot through authoritative inventory mutation and Event
   Ledger facts.
6. Evaluate same-map roam and stuck recovery.
7. Evaluate combat potion, ammo, party and kill-steal policy in separate gates.
