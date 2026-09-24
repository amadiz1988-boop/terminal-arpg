# OpenKore Supply Reference Dossier

```text
CAPABILITY = AUTO_FARM supply replenishment and return-to-farm
REFERENCE_VERSION = OpenKore project lock / StackVersion 0.1.0
REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
PROJECT_LAST_GOOD_CONFIG = .local/ro-stack/instances/player_2000034/control/config.txt
PROJECT_GENERATOR_CONFIG = ops/ro-stack/openkore-instance.ps1:164-215,284-299
RATHENA_AUTHORITY = item use, save point, map, NPC transaction, inventory and Zeny
PRODUCT_CONTRACT = Butterfly Wing is the primary Supply Out path
LAST_VERIFIED = 2026-09-20
```

## Evidence Order

Evidence is project-first: the historical project instance and PASS records,
the locked OpenKore source/configuration, the project bridge behavior, then
rAthena server-side semantics. No latest-upstream configuration is treated as
the project canonical configuration.

## OpenKore Last-Good Behavior

The historical project instance has:

```text
route_teleport 1
route_teleport_minDistance 75
route_teleport_maxTries 8
route_warpByItem 1
route_warpByItem_chaining 0
route_warpByItem_minDistance 150
route_warpItem_minGain 40
saveMap_warp 1
saveMap_warpToBuyOrSell 1
saveMap_warp_minDistance 80
buyAuto 501 = maxAmount 100, zeny >= 10
storageAuto 1 = prontera 151 29
```

These values are in `.local/ro-stack/instances/player_2000034/control/config.txt:227-271,727-765`.
The project generator configures item `602` as Butterfly Wing and item `601`
as Fly Wing, removes `buyAuto 601` and `buyAuto 602`, and treats travel wings
as supplied by rAthena rather than as the consumable supply target
(`ops/ro-stack/openkore-instance.ps1:169-214`).

OpenKore's direct service path is:

```text
buyAuto / sellAuto / storageAuto
-> shouldUseWarpToSaveMapForBuyOrSell
-> ai_useTeleport(2)
-> server map change to the authoritative save point
-> normal route to the configured NPC when needed
-> service transaction
```

`shouldUseWarpToSaveMapForBuyOrSell` requires `saveMap`,
`saveMap_warpToBuyOrSell`, a known distance and the configured minimum
distance (`.local/ro-stack/openkore/src/AI/CoreLogic.pm:4122-4134`). The buy,
sell and storage callers invoke `ai_useTeleport(2)` at
`.local/ro-stack/openkore/src/AI/CoreLogic.pm:1481-1501,1924-1943,2150-2170`.
The project bridge records successful item `602` use and the following map
change (`ops/ro-stack/openkore-plugins/status-export/status-export.pl:334-346`),
and verifies Butterfly Wing arrival against the server-authoritative save point
(`ops/ro-stack/openkore-plugins/status-export/status-export.pl:1466-1479`).

## Required Product Boundary

Supply Out and Supply Back are separate:

```text
SUPPLY_OUT = farm map -> Butterfly Wing -> rAthena authoritative Save Point
SUPPLY_BACK = Save Point / service -> normal PA navigation -> farm map
```

The primary chain is:

```text
AUTO_FARM
-> SUPPLY_LOW
-> pause combat
-> verify Butterfly Wing availability
-> use Butterfly Wing
-> verify server map is the authoritative Save Point
-> normal PA navigation to service / shop
-> authoritative rAthena buy
-> confirm inventory and Zeny
-> normal PA navigation to original farm target / lockMap
-> reacquire target
-> combat resume
```

`storageAuto` is present in the historical configuration and remains a
reference branch for storage or weight handling. It does not replace the
mandatory Butterfly Wing Supply Out step or authorize unrelated storage work.

## Behavior Mapping

```text
SUPPLY_LOW = LEGITIMATE_ADAPTATION
  PA owns the intent/state transition; rAthena owns purchase and inventory/Zeny.

Butterfly Wing / saveMap = LEGITIMATE_ADAPTATION
  PA must issue the equivalent authoritative relocation intent.

buyAuto = LEGITIMATE_ADAPTATION
  Reuse the authoritative rAthena shop transaction and confirmation.

storageAuto = REFERENCE_BRANCH
  Retain as evidence; it is not the replacement for Supply Out.

completion / return / combat resume = LEGITIMATE_ADAPTATION
  Supply target reached -> return to original lockMap -> target/combat resume.
```

The route planner adds a save-map teleport candidate when `saveMap_warp` is
enabled (`.local/ro-stack/openkore/src/Task/CalcMapRoute.pm:897-940`). The
separate item-warp candidate list only includes an item present in inventory
(`.local/ro-stack/openkore/src/Task/CalcMapRoute.pm:943-1000,1147-1155,1241-1258`).
These are reference mechanics; rAthena remains authoritative for the result.

## No Butterfly Wing

OpenKore omits an absent item from its item-warp candidates. Its service route
also has a bounded timeout after which it falls back to walking
(`.local/ro-stack/openkore/src/AI/CoreLogic.pm:1488-1500,2156-2168`). The
project bridge limits repeated route failures to three attempts and applies a
five-minute backoff (`ops/ro-stack/openkore-plugins/status-export/status-export.pl:489-554`).

```text
NO_BUTTERFLY_WING_POLICY =
  bounded safe fallback route only when the authoritative route is valid;
  if it cannot complete within the existing retry policy, safe idle / blocked
  supply and retry after backoff;
  never promote walking to primary Supply Out;
  never force indefinite walking;
  do not assume automatic purchase of item 602 because buyAuto 602 is removed
DECISION = FALLBACK_ONLY
```

This is conditional fallback behavior. It does not mean no wing always means
walking.

## Failure, Retry and Restart

```text
FAILURE = bounded route/service failure, insufficient funds, capacity or
  post-supply target failure
RETRY = existing three-failure threshold and five-minute supply backoff
RESTART = preserve active supply intent and prevent duplicate resume
DECISION = LEGITIMATE_ADAPTATION
```

Existing bounded recovery and restart evidence may be reused. It must not hide
a failed Butterfly Wing primary step.

## Required Classification

```text
PersistentAgentRouteSupplyOut = FALLBACK_ONLY
PersistentAgentRouteSupplyBack = LEGITIMATE_ADAPTATION
supply_route preservation = LEGITIMATE_ADAPTATION
service relocation = LEGITIMATE_ADAPTATION
CAN_WALKING_SUPPLY_OUT_REMAIN_AS_FALLBACK = YES
```

The current PA `RouteSupplyOut` JSON is not canonical primary behavior because
it makes multi-map walking the first farm-to-service leg. It remains only as a
bounded no-wing or failed-teleport fallback. `RouteSupplyBack` is valid because
the product contract uses normal PA navigation after Save Point/service.
Service relocation is valid only after Supply Out reaches the authoritative
Save Point.

## Current PA Contract Correction

```text
PERSISTENT_AGENT_SUPPLY_ENABLED = true
PERSISTENT_AGENT_SUPPLY_ITEM = 501
PERSISTENT_AGENT_SUPPLY_MIN = 5
PERSISTENT_AGENT_SUPPLY_TARGET = 15
PERSISTENT_AGENT_SUPPLY_NPC = Tool Dealer#Extended_Prt
PersistentAgentRouteSupplyOut = explicit route JSON, fallback-only
PersistentAgentRouteSupplyBack = explicit route JSON, normal return leg
```

The corrected ordering is:

```text
primary Supply Out = Butterfly Wing -> Save Point
service relocation = normal PA navigation from Save Point
Supply Back = normal PA navigation to original lockMap
```

The current PA implementation is a migration target for D, not the canonical
definition of Supply Out.

## Objective Equivalence Gate

```text
REFERENCE_OBJECTIVE = preserve mature supply outcome while moving runtime
  authority from OpenKore to PA / SERVER_AGENT -> rAthena
PLAYER_VISIBLE_CHAIN_REQUIRED = Butterfly Wing -> Save Point -> service/buy ->
  inventory/Zeny confirmation -> return farm -> combat resume
CURRENT_PA_PRIMARY_OUT = not accepted; classified FALLBACK_ONLY
CURRENT_PA_BACK = accepted normal navigation adaptation
EQUIVALENCE_RESULT = YES for the corrected authorized contract; runtime
  completion evidence remains required from D
BETTER_DIMENSIONS = server authority, persistence, duplicate-state control,
  client/process independence
```

This records the accepted contract and unlocks D. It does not claim that source
implementation is complete.

## Optimization Decision

```text
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
OPTIMIZATION_APPLIED = NO_NOT_NEEDED
REASON = preserve primary teleport-to-save-point behavior while retaining
  existing PA persistence and authority; no unrelated optimization is needed
```

## Six-Question Gate

```text
OPENKORE_REFERENCE_REQUIRED = YES
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
RESULT_EQUIVALENT_OR_BETTER = YES
OPENKORE_CORE_ALIGNMENT_VETO = PASS
```

`RESULT_EQUIVALENT_OR_BETTER` refers to the corrected authorized contract.
Runtime completion remains pending D implementation and bounded player-flow
acceptance.

## Atlas cross-reference

This dossier is the canonical detailed record for topics `17 SHOP_BUY`,
`18 SHOP_SELL`, `19 STORAGE`, `20 KAFRA`, `21 SUPPLY_AUTOMATION`,
`22 WEIGHT_THRESHOLDS`, `28 BUTTERFLY_WING`, `40 RECONNECT_RECOVERY` and the
related recovery topics. The shorter lookup path is
`docs/openkore-reference/lookup-playbook.md`.

The project-specific non-consumable rule is a deliberate authority boundary:
item count stability can coexist with a successful rAthena relocation. Supply
completion still requires authoritative inventory, Zeny, map and return-to-farm
observations.

## Accepted Supply Contract

```text
AUTO_FARM
-> SUPPLY_LOW
-> pause combat
-> use Butterfly Wing
-> arrive at rAthena authoritative Save Point
-> normal PA navigation to service / shop
-> authoritative rAthena buy
-> confirm inventory / Zeny
-> normal PA navigation back to original farm target / lockMap
-> reacquire target
-> combat resume
```

No-wing exception:

```text
no Butterfly Wing
-> attempt only a validated safe fallback route
-> if bounded fallback fails, safe idle / blocked supply
-> retry after existing backoff
```

The contract excludes LLM behavior, client worker ownership, client file
transport, and any claim that walking is primary Supply Out behavior.

## D Resume Task

```text
FIRST_IMPLEMENTATION_TASK_FOR_D =
Change the existing PA supply state machine so SUPPLY_LOW pauses combat, uses
the authoritative Butterfly Wing / Save Point path as primary Supply Out,
verifies the resulting rAthena map, then reuses existing PA service navigation
and authoritative shop buy. Preserve inventory/Zeny confirmation, original
lockMap intent, normal Supply Back navigation, target reacquisition, combat
resume, bounded retry/backoff and safe no-wing fallback. Do not make multi-map
walking primary Supply Out. Do not add buyAuto(602), LLM behavior, a second
navigation engine or unrelated storage scope. Acceptance must prove the full
player-flow chain and explicitly prove the no-wing bounded fallback or
safe-blocked result.
```
