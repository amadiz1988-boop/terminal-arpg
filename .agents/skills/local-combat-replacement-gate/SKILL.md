---
name: local-combat-replacement-gate
description: Audit or plan a move of PA local combat orchestration into an rAthena server-side executor while preserving PA supply, recovery, loot policy, navigation, quest, social and Life ownership.
---

# LOCAL_COMBAT_REPLACEMENT_GATE_V1

Use this skill for any combat replacement, server-side auto-combat executor,
combat-loop migration, or hybrid PA/rAthena combat design. It is an audit and
gating skill. It does not authorize gameplay implementation, Production
migration, runtime restart, or removal of existing PA combat.

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
GLOBAL_AUTOLOOT = PRODUCT_ACCEPTED_DIRECTION
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

## Decision output

Report `SAFE_TO_REPLACE`, `SAFE_WITH_CONTRACT`, `KEEP_IN_PA`, `RESEARCH_MORE`,
`POTION_BOUNDARY`, `LOOT_BOUNDARY`, `SUPPLY_SIGNAL_CONTRACT`,
`STOP_LOCAL_COMBAT_CONTRACT`, `QUEST_IMPACT`, `SOCIAL_IMPACT`, top risks,
staged migration and an explicit `IMPLEMENTATION_STARTED = NO` until all hard
gates pass and Project Control authorizes the next stage.
