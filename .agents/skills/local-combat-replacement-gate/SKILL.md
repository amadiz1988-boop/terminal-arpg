---
name: local-combat-replacement-gate
description: Audit or plan a move of PA local combat orchestration into an rAthena server-side executor while preserving PA supply, recovery, loot policy, navigation, quest, social and Life ownership.
---

# LOCAL_COMBAT_REPLACEMENT_GATE_V1

Use this skill for any combat replacement, server-side auto-combat executor,
combat-loop migration, or hybrid PA/rAthena combat design. It is an audit and
gating skill. It does not authorize gameplay implementation, Production
migration, runtime restart, or removal of existing PA combat.

## Canonical hard gate

```text
USE_MATURE_BEHAVIOR_WHERE_PROVEN = YES
DO_NOT_REIMPLEMENT_BETTER_REFERENCE_BEHAVIOR = YES
PA_OWNS_INTENT_JOURNEY_INTERRUPT_RESUME = YES
LOCAL_HUNTING_CANNOT_CROSS_MAP_AUTONOMOUSLY = YES
SUPPLY_OWNER_REMAINS_PA = YES
RETURN_TO_FARM_OWNER_REMAINS_PA = YES
QUEST_OWNER_REMAINS_PA = YES
SOCIAL_OWNER_REMAINS_PA = YES
GLOBAL_AUTOLOOT = YES
GLOBAL_AUTOSTORE = NO
AUTHORITATIVE_LOOT_REQUIRED_FOR_COMBAT_LOG = YES
RESULT_EQUIVALENT_OR_BETTER_REQUIRED_BEFORE_REPLACEMENT = YES
NO_BIG_BANG_MIGRATION = YES
CLASS_AWARE_COMBAT_PROFILE = YES
JOB_DETERMINES_AVAILABLE_OPTIONS = YES
PLAYER_DETERMINES_PREFERRED_PROFILE = YES
RATHENA_DETERMINES_LEGAL_EXECUTION = YES
PA_DETERMINES_INTENT_AND_INTERRUPTION = YES
SKILL_ONLY_NORMAL_ATTACK_OFF_SUPPORTED = REQUIRED
PARTY_SUPPORT_FIRST_CLASS = YES
SAME_MAP_PARTY_FOLLOW_CAN_BE_LOCAL_EXECUTOR = YES
CROSS_MAP_PARTY_FOLLOW_REMAINS_PA = YES
AUTOSKILL_REFERENCE_FIRST = YES
DO_NOT_BUILD_ONE_AI_FOR_ALL_JOBS = YES
PROFILE_SPECIFIC_TACTICAL_OPTIONS = YES
NORMAL_ATTACK_CLASS_PARITY_GATE = REQUIRED
```

Every capability transfer is a separate gate and keeps the PA fallback until
promotion passes. Local Hunting is a child executor under PA parent intent.

## Class-aware combat profile gate

Combat configuration is modeled as:

```text
COMBAT_PROFILE + TACTICAL_OPTIONS
```

`JOB` and the canonical job/skill/equipment capability set determine the
available profile candidates. The player selects a preferred legal profile and
its profile-specific tactical options. rAthena determines legal execution and
authoritative results. PA determines intent, journey, interruption and resume.

The accepted initial catalog is:

```text
MELEE_DAMAGE
RANGED_DAMAGE
SKILL_CAST
HYBRID_DAMAGE
HEAL_SUPPORT
COMBAT_SUPPORT
FOLLOW_SUPPORT
PASSIVE_FOLLOW
```

Availability must be derived from job, skill tree, equipment or attack type and
available skills. Example job mappings are product direction only and must not
become a hardcoded final job table. A single job may expose multiple legal
profiles, including Priest offensive or hybrid choices where the build permits.

Profile-specific tactical options must remain scoped to the selected profile.
`SKILL_CAST` must support disabling normal attacks. When a required skill is
temporarily unavailable, policy may wait, reposition, regenerate or use an
explicitly approved fallback; it must not silently force normal attack.

`ONE_COMBAT_AI_FOR_ALL_JOBS = FORBIDDEN` and `JOB_HARDCODED_SINGLE_BUILD =
FORBIDDEN`. This section records design only. It does not authorize Skill
Executor implementation.

## Party support and follow boundary

```text
PARTY_SUPPORT_IS_FIRST_CLASS_HUNTING_CAPABILITY = YES
```

Future support policy must prioritize self-survival emergency, critical party
HP, low party HP, critical buffs, status recovery, normal buff maintenance,
follow or reposition, then optional offense. Thresholds remain policy or
configuration values rather than scattered constants.

A Local Hunting executor may evaluate same-map follow, support positioning,
heal, buff and support range under a bounded lease. A map exit, portal or
cross-map transition must stop local combat or follow and return to PA for the
cross-map journey and authoritative arrival before resume.

## Staged Skill Executor direction

Skill work is split into independent gates:

```text
STAGE_3A = OFFENSIVE_SKILL_EXECUTOR
  target skill, ground skill, skill level, SP, range, cooldown, cast time,
  effect result, SKILL_ONLY and HYBRID mode

STAGE_3B = SELF_SUPPORT_EXECUTOR
  self heal, self buff, buff refresh, status-aware support

STAGE_3C = PARTY_SUPPORT_EXECUTOR
  party HP, party heal, party buff, status recovery, target priority,
  same-map follow and support positioning
```

Before any Stage 3 implementation, run
`RATHENA_AUTOSKILL_AND_PARTY_SUPPORT_REFERENCE_MINING_V1` and record mature
reference behavior for target and ground skills, cooldown, cast time, SP
fallback, pure-skill combat, buff refresh, self or party heal, party buff,
status cleanse, same-map follow, target priority and death or revive support.
Reuse or adapt proven behavior; do not reimplement a mature reference silently.

## Normal attack parity gate

Stage 2 historical names remain unchanged. The future generalized gate is:

```text
NORMAL_ATTACK_CLASS_PARITY_GATE = REQUIRED
NORMAL_ATTACK_CLASSES = melee, bow/ranged, gun/ranged
NORMAL_ATTACK_EXECUTOR = GENERALIZED ONLY AFTER ALL THREE PASS
```

`MELEE_EXECUTOR` remains the current bounded canary label. It must not be
renamed in historical checkpoints. Class parity is unproven until melee,
bow/ranged and gun/ranged each pass separate authoritative gates.

## Required evidence

Read the relevant rAthena and OpenKore Atlas topics first, then compare:

- current canonical PA source and Project Last-Good;
- rAthena authority for legality, path, range, skill, damage, death, drop and
  inventory;
- OpenKore mature behavior for target, approach, retarget, combat, loot,
  recovery and supply interruption;
- external reuse registry and license status for any candidate executor.

Record these hard-gate fields:

```text
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES / NO
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
REFERENCE_CONFLICT_RESOLVED = YES / NO
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
RESULT_EQUIVALENT_OR_BETTER = YES / NO
```

Any `NO` blocks implementation approval. `UNKNOWN` is not a PASS.

## Ownership gate

Keep these in PA unless a separately approved contract proves otherwise:

- supply trigger, service route, replenishment and return-to-farm;
- HP/SP recovery policy, potion choice and quarantine;
- inventory lifecycle interpretation, weight threshold, supply trigger and
  storage/sell policy;
- cross-map navigation, parent intent, quest pause/resume;
- Social Director and Life Director parent intent and factual event promotion.

rAthena remains authoritative for HP/SP, damage, hit/miss, death, monster drop
resolution, global autoloot execution, authoritative inventory add, loot
acquisition result, position, skill legality, cooldown and map entities. A
candidate executor may own only an ephemeral combat lease, action cadence and
result relay. Ordinary hunting floor-item pickup orchestration is not a PA
requirement after the Global AutoLoot decision.

The product loot contract is fixed:

```text
GLOBAL_AUTOLOOT = YES
GLOBAL_AUTOLOOT_TO_INVENTORY = YES
GLOBAL_AUTOSTORE = NO
DROP != LOOT_ACQUIRED
```

Only a successful authoritative inventory add may emit `LOOT_ACQUIRED`. The
event carries char, monster, item, amount, inventory delta, combat session,
execution epoch and trace identifiers where authoritative data exists. Full
inventory, overweight and item-add failures emit no success pickup.

## Mandatory contracts

Before implementation, define and test:

1. `combatSessionId` and `executionEpoch` lease validation.
2. Idempotent `STOP_LOCAL_COMBAT` with reasons for supply, recovery, quest,
   social, parent intent, death, owner revoke and map exit.
3. `SUPPLY_LOW` signal carrying character, item, threshold, map, epoch and
   trace identifiers. PA performs all supply and return actions.
4. Ordered authoritative events for target, approach, range, attack, hit/miss,
   kill, drop resolution, `LOOT_ADD_REJECTED`, `LOOT_ACQUIRED`, Combat Log
   projection and combat stop/failure.
5. Single-executor admission and stale-epoch rejection. Never create a second
   runtime or parallel combat authority.

For Stage 1 shadow work, observer output is read-only and bounded in memory. It
must not move, attack, cast, consume, teleport, loot, alter target authority,
alter PA state, alter supply state, write Event Ledger rows or start Stage 2.

The current bounded Stage 2 canary is recorded by
`docs/fixtures/hybrid-supply-return-baseline-150069.yml`. It may exercise only
the PA-authorized same-map melee lease and rAthena attack/result path. The
fixture's PA supply, cross-map service, return-to-farm, farm-target and
auto-resume invariants remain hard gates for any later promotion. A canary hit
requires `MONSTER_HIT` or an authoritative monster HP decrease; `MONSTER_ATTACK`
and `MONSTER_KILL` alone do not satisfy that gate.

The bounded melee canary is `PASS` and is not a global promotion. The remaining
promotion gate is `RETURN_TO_FARM -> NEW_LOCAL_COMBAT_LEASE -> TARGET -> ATTACK
-> at least 3 authoritative MONSTER_HIT`. Do not classify the transition as
broken without execution evidence.

## Decision output

Report `SAFE_TO_REPLACE`, `SAFE_WITH_CONTRACT`, `KEEP_IN_PA`, `RESEARCH_MORE`,
`POTION_BOUNDARY`, `LOOT_BOUNDARY`, `SUPPLY_SIGNAL_CONTRACT`,
`STOP_LOCAL_COMBAT_CONTRACT`, `QUEST_IMPACT`, `SOCIAL_IMPACT`, top risks,
staged migration and `GLOBAL_PROMOTION_APPROVED = NO` until all hard gates pass
and Project Control authorizes the next stage. Existing bounded Stage 1 and
Stage 2 evidence may remain recorded as completed evidence.
