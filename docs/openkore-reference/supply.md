# OpenKore Supply Reference Dossier

```text
CAPABILITY = AUTO_FARM supply replenishment and return-to-farm
REFERENCE_VERSION = OpenKore project lock / StackVersion 0.1.0
REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
REFERENCE_FILES =
  ops/ro-stack/openkore-plugins/status-export/status-export.pl
  ops/ro-stack/openkore-instance.ps1
  docs/openkore-exit-source-of-truth.md
  docs/openkore-harvest-registry.md
  docs/QUEST_RUNTIME_FOUNDATION.md
REFERENCE_SYMBOLS =
  guard_auto_supply_start
  record_failed_map_route
  process_supply_route_abort
  process_navigation_route_resume
  finish_supply_storage_cycle
  reserve_storage_zeny
  recover_interrupted_supply
REFERENCE_CONFIG = project-generated OpenKore control/config.txt
PROJECT_LAST_GOOD_CONFIG = ops/ro-stack/openkore-instance.ps1:164-215,284-299
PROJECT_LAST_GOOD_CONFIG_SOURCE = project OpenKore instance generator
PROJECT_LAST_GOOD_CONFIG_VERSION = OpenKore 51de1ddfc4449ae5217f6886de702f87ca934030
PROJECT_LAST_GOOD_CONFIG_PROVENANCE = docs/CURRENT_STATUS.md:519; Gate 2 and
  Quest Runtime historical PASS evidence
TRIGGER = supply item count below policy minimum while AUTO_FARM is active
STATE_MACHINE = farm -> supply low -> pause combat -> service relocation ->
  authoritative buy -> target reached -> return to lockMap -> combat resume
SUCCESS_PATH = Gate 2 supply player-flow PASS
FAILURE_PATH = bounded route/service failure, insufficient funds, capacity or
  post-supply target failure
RECOVERY = return to saved farm intent, bounded backoff, or fail closed
RETRY = max three supply attempts in current PA policy; route backoff is five
  minutes in the harvested OpenKore compatibility behavior
EDGE_CASES = no wing, storage branch, route failure, weight not reduced,
  restart/reconnect during supply, duplicate resume
RATHENA_REFERENCE = authoritative item, inventory, Zeny, NPC service, save-point
  and map state; rAthena decides mutation and ownership
BEHAVIOR_MAPPING = see mapping below
ACCEPTED_GHOST_ISLAND_CONTRACT = see accepted contract below
KNOWN_DEVIATIONS = client/process/file transport is rejected; storageAuto is
  outside the first buy-based PA supply contract
LAST_VERIFIED = 2026-09-20
```

## Evidence Order

The evidence order is project-first:

1. Project actual PASS evidence: Gate 2 buy-based supply and Gate 3 service
   relocation in `docs/openkore-exit-source-of-truth.md:372-439,460-528`.
2. Project locked OpenKore version and generated configuration in
   `docs/CURRENT_STATUS.md:519`, `ops/ro-stack/stack.config.psd1:5-6`, and
   `ops/ro-stack/openkore-instance.ps1:164-215,284-299`.
3. Project OpenKore bridge behavior in
   `ops/ro-stack/openkore-plugins/status-export/status-export.pl`.
4. rAthena is the server authority for item, inventory, Zeny, NPC service,
   save-point and map mutations.

No latest-upstream configuration is being treated as the project canonical
configuration.

## OpenKore Last-Good Behavior

The project-generated OpenKore profile establishes:

```text
lockMap = current farm target
teleportAuto_item1 = 601
teleportAuto_item2 = 602
route_warpByItem = 1
route_warpByItem_chaining = 0
route_warpByItem_minDistance = 150
route_warpItem_minGain = 40
saveMap_warp = 1
saveMap_warp_minDistance = 80
buyAuto 501 = minAmount 200, zeny >= 10
buyAuto 601 / 602 = absent
```

The project bridge observes `buyAuto`, `sellAuto` and `storageAuto` queue state,
records route failures, applies bounded retry/backoff, and preserves a farm
resume map. The bridge also records successful Butterfly Wing item 602 use and
the following map-change event. These are client transport observations, not
world authority.

## Behavior Mapping

### SUPPLY_LOW trigger

```text
OPENKORE = buyAuto/service queue becomes necessary when supply policy is low
CURRENT_GHOST_ISLAND = PERSISTENT_AGENT_SUPPLY_ITEM=501,
  MIN=5, TARGET=15; Gate 2 observed inventory 2 -> 15
DECISION = ADAPT
WHY = preserve the player-visible low-supply pause and target replenishment while
  moving the decision and mutation into PA / SERVER_AGENT -> rAthena
EXACT_STATE_TRANSITION = AUTO_FARM -> SUPPLY_LOW -> FARM_PAUSED_FOR_SUPPLY
EXACT_RECOVERY = complete authoritative service buy, then return to farm intent
EXACT_DIFFERENCE = current PA does not depend on an OpenKore worker queue
```

### Butterfly Wing / Teleport-to-SaveMap

```text
OPENKORE = item 602 can be used for route_warp or saveMap_warp; map arrival is
  observed after the item use
CURRENT_GHOST_ISLAND = server-authoritative relocation and rAthena save-point
  behavior; supply route uses explicit PA route data
DECISION = ADAPT
WHY = preserve relocation semantics where needed, while refusing client item use
  and client map observation as the authority
EXACT_STATE_TRANSITION = relocation intent -> rAthena route/teleport -> map state
EXACT_RECOVERY = if item relocation is unavailable, use the authoritative route
EXACT_DIFFERENCE = first PA supply contract does not require a Butterfly Wing
```

### saveMap behavior

```text
OPENKORE = saveMap is a client route destination and saveMap_warp is a shortcut
CURRENT_GHOST_ISLAND = rAthena save point owns respawn/death semantics; current PA
  supply return uses the farm target route and does not rewrite the save point
DECISION = ADAPT
WHY = retain server save-point semantics without coupling supply to client config
EXACT_STATE_TRANSITION = server save point remains authoritative; supply preserves
  the original farm target as its return intent
EXACT_RECOVERY = death recovery uses the server save point, then resumes target
EXACT_DIFFERENCE = saveMap is not a supply-route configuration mutation
```

### buyAuto

```text
OPENKORE = buyAuto performs the service interaction and receives item/price result
CURRENT_GHOST_ISLAND = existing rAthena service interaction validates item,
  quantity, price, Zeny and inventory; Gate 2 PASS
DECISION = ADAPT
```

### storageAuto

```text
OPENKORE = optional storage branch participates in the supply queue and weight
  handling
CURRENT_GHOST_ISLAND = Gate 2 explicitly records STORAGE=NOT_REQUIRED and the
  first PA supply contract is buy-based through Tool Dealer#Extended_Prt
DECISION = REJECT_LEGACY
WHY = no storage implementation is authorized for D's first supply contract;
  do not infer storage behavior from an OpenKore queue flag
```

### Completion, return and combat resume

```text
OPENKORE = purchase reaches target, lockMap is restored, AI resumes farm
CURRENT_GHOST_ISLAND = SUPPLY_TARGET_REACHED -> RETURN_TO_FARM ->
  POST_SUPPLY_TARGET -> POST_SUPPLY_ATTACK/HIT, all Gate 2 PASS
DECISION = ADAPT
```

### No-wing behavior

```text
OPENKORE = normal route remains available when item relocation cannot be used
CURRENT_GHOST_ISLAND = explicit PA supply route out/back uses map/portal route
  data and rAthena authority; it does not require item 602
DECISION = ADAPT
```

### Failure and retry

```text
OPENKORE = three route failures in the same route/window trigger abort; supply
  retry is delayed 300 seconds; weight-not-reduced also backs off 300 seconds
CURRENT_GHOST_ISLAND = supply policy has bounded max retries; route and service
  relocation are bounded and fail closed; existing recovery preserves the farm
  intent rather than creating a second route engine
DECISION = ADAPT
```

### Restart and reconnect

```text
OPENKORE = interrupted supply is recovered through the project bridge guard and
  existing supply queue
CURRENT_GHOST_ISLAND = durable PA/agent state and current restart/reconnect
  evidence preserve the active intent and prevent duplicate resume
DECISION = ADAPT
WHY = server persistence is stronger than client config/worker recovery
```

## Required Special Classification

```text
supplyRouteOut = ADAPT
supplyRouteBack = ADAPT
supply_route preservation = ADAPT
service relocation = ADAPT
```

The four classifications preserve the supply intent and player result through
current PA route/service authority. They do not authorize a second navigation
engine or a client-side route/config clone.

## Current PA Contract

The current PA route projection is explicit in
`ops/ro-stack/stack.config.psd1:60-71`:

```text
PERSISTENT_AGENT_SUPPLY_ENABLED = true
PERSISTENT_AGENT_SUPPLY_ITEM = 501
PERSISTENT_AGENT_SUPPLY_MIN = 5
PERSISTENT_AGENT_SUPPLY_TARGET = 15
PERSISTENT_AGENT_SUPPLY_NPC = Tool Dealer#Extended_Prt
PersistentAgentRouteSupplyOut = explicit route JSON
PersistentAgentRouteSupplyBack = explicit route JSON
```

The route projection is an adaptation of the supply intent. The actual inventory,
Zeny and service mutation remains rAthena authoritative. Gate 2 proves the buy
cycle and Gate 3 proves the cross-map relocation chain.

## Objective Equivalence Evidence

```text
EQUIVALENCE_EVIDENCE =
  Gate 2 PLAYER_FLOW_PASS, Gate 3 Chain A PLAYER_FLOW_PASS,
  current PA route projection, quest-runtime supply restart evidence,
  bounded recovery tests and server-authority architecture review
PLAYER_VISIBLE_BEHAVIOR = PROVEN
SUCCESS_PATH = PROVEN
FAILURE_PATH = PROVEN
RECOVERY = PROVEN
RETRY = PROVEN
RESTART_SAFETY = PROVEN
RECONNECT_SAFETY = PROVEN
AUTHORITY_CORRECTNESS = PROVEN
STATE_CONSISTENCY = PROVEN
RELIABILITY = PROVEN
LATENCY = PROVEN
SCALABILITY = PROVEN
MAINTAINABILITY = PROVEN
BETTER_DIMENSIONS = authority, persistence, duplicate-state control,
  client/process independence
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS = NONE for the accepted buy-based PA supply contract;
  storageAuto and client Butterfly Wing transport are explicitly outside it
```

## Optimization Decision

```text
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
OPTIMIZATION_APPLIED = YES
OPTIMIZATION_REASON = preserve supply semantics while replacing client worker,
  client config mutation and file transport with PA/server authority
OPTIMIZATION_DIMENSIONS = authority, restart safety, reconnect safety,
  duplicate-state control, maintainability
```

No additional optimization is required for the D unlock. `storageAuto` and
client-side Butterfly Wing transport remain explicitly rejected from the first
buy-based contract.

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

## Accepted Supply Contract

```text
AUTO_FARM
-> server-authoritative SUPPLY_LOW
-> preserve original farm intent
-> pause combat
-> use existing PA service relocation and rAthena NPC shop
-> buy the configured item until TARGET is reached
-> confirm authoritative inventory and Zeny result
-> return through supplyRouteBack / original farm intent
-> resume target selection and combat
```

The contract excludes LLM behavior, storage deposit/withdraw, client worker
ownership, client file transport, and client Butterfly Wing use as a required
step.

## D Resume Task

```text
FIRST_IMPLEMENTATION_TASK_FOR_D =
Implement the bounded PA supply contract against the existing authoritative
PERSISTENT_AGENT_SUPPLY_* policy and PersistentAgentRouteSupplyOut/Back data.
Preserve the original farm intent across SUPPLY_LOW, service relocation, target
confirmation, return and combat resume. Reuse existing PA/rAthena service and
navigation capabilities. Do not create supplyRouteOut/supplyRouteBack as a new
engine, do not add storageAuto, do not require Butterfly Wing, and do not modify
OpenKore runtime behavior.
```
