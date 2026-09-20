# Mining Dossier: Navigation, Warp, Portal and Pathfinding

```text
TOPIC_ID = NAVIGATION_WARP_PORTAL_PATHFINDING
QUESTION = Which rAthena transition types and OpenKore route invariants must the Project preserve when planning and executing cross-map navigation?
PROJECT_RELEVANCE = Change Farm Map, Supply Return, Quest navigation, death/recovery and future persistent roaming.
UPSTREAM_SOURCE_CHECKED = rAthena native source at current project head ff72578f608935d1df5d664b3e9df9d436361043 plus Atlas baseline e985006171d2eb320ee512a653f4c83aea3d81b6; OpenKore master reference 51de1ddfc4449ae5217f6886de702f87ca934030.
FORUM / WIKI FINDINGS = Official rAthena docs and source were sufficient. No forum claim was promoted into a capability.
CURRENT_VERSION_APPLICABLE = PARTIAL
PROJECT_LAST_GOOD_CHECKED = Gate 3 multi-map navigation, docs/openkore-reference/navigation.md, docs/openkore-reference/recovery.md, docs/architecture/control-chain-responsibility-audit.md and current map-route.mjs.
CLASSIFICATION = ADAPT
CANONICAL_SOURCE_POINTERS = See tables below and the two Atlas index updates.
PROJECT_USAGE = Dashboard may expose a bounded plan. PA executes intent and lifecycle. rAthena owns movement, transition legality and arrival.
KNOWN_RISKS = Static-only graph, scripted service transfers, stale portal metadata, mapflag restrictions, instance identity, missing portal retry and false arrival based on request acceptance.
STALE / VERSION CONFLICT = The rAthena Atlas project head was refreshed from 1ffd06a to ff72578. OpenKore route and portal behavior is reference-only. Project's server-side authority is intentionally different. Current project graph does not model scripted NPC/service edges.
ATLAS_UPDATED = YES
```

## 1. Source and authority baseline

| Source | Baseline | Evidence role |
|---|---|---|
| Project Web / PA | `ops/ro-stack/persistent-agent/map-route.mjs` at current worktree | Current graph input and route contract |
| Project Native | `C:\Users\Administrator\source\ghost-island-rathena`, branch `integration/p2-openkore-exit-native-v1`, `ff72578f608935d1df5d664b3e9df9d436361043` | Current rAthena authority inspected read-only; pre-existing untracked build evidence preserved |
| rAthena Atlas | `e985006171d2eb320ee512a653f4c83aea3d81b6` | Stable source and documentation pointers |
| OpenKore Atlas | `51de1ddfc4449ae5217f6886de702f87ca934030` | Mature reference only, runtime count remains zero |

The responsibility chain remains:

```text
Player Web intent
  -> Dashboard authentication, ownership and bounded plan
  -> PA navigation intent, execution and recovery
  -> rAthena movement, warp/NPC/service semantics and authoritative position
  -> Event Ledger and live-status projection
```

`docs/architecture/control-chain-responsibility-audit.md` already assigns navigation execution to PA/rAthena and projection to Dashboard/Event Ledger. This dossier adds transition-type detail only; it does not change that architecture.

## 2. rAthena transition taxonomy

| Transition type | Current source evidence | What it proves | Planner consequence |
|---|---|---|---|
| Static `warp` / `warp2` NPC | `doc/script_commands.txt` static warp syntax; `src/map/npc.cpp` warp handling | A directed map edge with a trigger area can call authoritative `pc_setpos`; `warp2` also affects hidden players | Safe graph input when the exact loaded script line is parsed. Trigger area and destination remain server-owned. |
| `OnTouch`, `OnTouch_`, `OnTouchNPC` | `doc/script_commands.txt`; `src/map/npc.cpp::npc_ontouch_event`, `npc_ontouch2_event` | Walking into an NPC area can run arbitrary script or a monster touch event | Requires an interaction edge. A static warp parser cannot infer its outcome from the NPC line alone. |
| Script `warp`, `areawarp`, `mapwarp` | `doc/script_commands.txt` script command sections; `src/map/script.cpp` | A script can move one player, an area, or a group without a static portal edge | Requires a scripted-transfer capability and post-action map observation. |
| NPC dialogue and service transfer | `npc/custom/warper.txt`, Kafra scripts, `src/map/script.cpp` dialogue commands | Menu choice, ownership, cooldown and script state can determine destination | Model as a bounded service route with dialogue checkpoints and exact result reason. |
| `navigateto` | `doc/script_commands.txt`; `src/map/script.cpp::BUILDIN_FUNC(navigateto)` | Sends client navigation guidance and can label Kafra/Airship/Scroll candidates | It is client guidance, not a server teleport and cannot prove reachability or arrival. |
| Instance entry | `instance_enter` documentation and instance source | Destination map identity may be instance-specific and created by party/instance state | Requires instance identity and authoritative entry result; ordinary global map graph is insufficient. |
| Save point and respawn | `pc_setpos`, save-point scripts and recovery flow | Death, Butterfly Wing or recovery can produce a server-selected save map/cell | Treat as a state transition with authoritative map/cell confirmation. |
| Item teleport | `unit_warp`, item semantics and project Fly/Butterfly rules | Item use may randomize position or select a Save Point | Item acceptance is only an action result; map and position must be reread. |
| Map flags | `setmapflag`, `doc/mapflags.txt`, `src/map/unit.cpp` | `MF_NOTELEPORT`, `MF_NOWARP`, `MF_NOGO`, `MF_NOSAVE` and related flags constrain legal transitions | A route candidate must carry map-flag constraints and return exact rejection reasons. |

### Static parser boundary

`loadWarpGraph()` currently reads only `npc/scripts_warps.conf` and `npc/re/scripts_warps.conf`. `parseWarpScripts()` accepts tab/whitespace static warp lines with map, coordinate, facing, span and destination fields. `buildWarpGraph()` emits directed map edges and `buildRouteSteps()` emits portal steps plus a terminal cell, with a route length ceiling of 15. The parser intentionally excludes `Warper`, `Warpra`, `duplicate(...)`, Kafra and other conversational or paid transfers.

This boundary is useful for a deterministic static feasibility check. It cannot represent arbitrary script control flow, dynamic NPC state, instance identity, map flags or a service menu choice.

## 3. OpenKore mature navigation capabilities

The locked OpenKore source and existing Atlas show a bounded state machine:

```text
destination intent
  -> same-map collision-aware path or map-route solution
  -> walk to portal/NPC/airship candidate
  -> wait for authoritative map change
  -> recompute from the new map
  -> arrival tolerance or bounded failure
```

| Capability | Source evidence | Project decision |
|---|---|---|
| Static portal tables | `src/Task/CalcMapRoute.pm`, `src/functions.pl` load `portals.txt`, `portalsLOS.txt`, `portals_commands.txt`, `portals_spawns.txt`, `portals_airship.txt` | ADAPT: retain metadata as advisory input, never as position authority |
| Same-map collision path | `src/Task/Route.pm::getRoute`, `src/Field.pm` | IMPROVE: use server-side walkability and authoritative result instead of replaying client path |
| Portal map chaining | `src/Task/MapRoute.pm` and `CalcMapRoute.pm` | ADAPT: preserve destination intent, step through a candidate, then replan from observed map |
| Map-change confirmation | `MapRoute` clears stale step state when current map differs from solution | REUSE: make authoritative map match a hard checkpoint |
| Unknown portal discovery | `AI/CoreLogic.pm::processPortalRecording` links prior source portal to nearest destination portal after a map change | IMPROVE: future learning may update metadata, while PA keeps durable evidence and rAthena authority |
| Missing portal handling | `MapRoute` waits, marks `missing_portal`, suspends the source and can guess a nearby portal | IMPROVE: keep bounded alternative and diagnostic reason, omit blind guessing as authority |
| Suspended portal restoration | `processReAddMissingPortals` restores a route source after a timeout | ADAPT: use bounded cache invalidation and refresh rather than permanent deletion |
| NPC/Airship transfer | `MapRoute` owns NPC/airship retry and `route_maxNpcTries` | ADAPT: expose dialogue/service checkpoints and exact script result |
| `lockMap` | `CoreLogic.pm`, `control/config.txt` | REUSE: farm destination remains one selected map, restored after authoritative match |
| Retry and timeout | `Task/Timeout.pm`, `MapRoute.pm`, `control/timeouts.txt` | ADAPT: operation-specific ceilings, backoff and no-progress timestamps |
| Teleport candidate | `MapRoute` bounded route teleport and `CalcMapRoute` item candidates | ADAPT: project item semantics and server result override client assumptions |
| Kafra/service route | `TalkNPC.pm`, `CoreLogic.pm`, portal/service tables | ADAPT: normal dialogue and transaction flow with server confirmation |
| Death/respawn/recovery | `Task/Teleport.pm`, `CoreLogic.pm`, `recovery.md` | ADAPT: save-point result, lease/intent reconciliation and bounded resume |
| Infinite random walking | Legacy failure mode when route data is absent | REJECT_LEGACY: fail with reason and safe idle/backoff |
| `navigateto` as teleport proof | Client guidance only | REJECT_LEGACY: never equate a navigation hint with a map change |

## 4. Current Project graph and route-chain comparison

The current chain is:

```text
rAthena warp scripts
  -> loadWarpGraph
  -> parseWarpScripts
  -> buildWarpGraph
  -> findWarpPath
  -> buildRouteSteps
  -> planWebRelocation
  -> PA/native execution and rAthena arrival
```

### Current inputs and supported edge types

| Area | Current status |
|---|---|
| Input files | `npc/scripts_warps.conf`, `npc/re/scripts_warps.conf` and their listed files |
| Edge shape | Directed static map warp with source coordinate/span and destination map/cell |
| Search | Bounded BFS by map; self-map edges ignored |
| Route output | Portal steps followed by terminal destination cell; route length over 15 is unrepresentable |
| Policy | DIRECT, service-required, invalid target, already-at-destination and `no_direct_route` results |
| Runtime owner | PA executes; rAthena confirms movement and position |
| Excluded edges | OnTouch script, Warper/Warpra, Kafra, airship dialogue, `warp`/`mapwarp` script calls, instances, item teleport, dynamic or learned portals and mapflag legality |

### Read-only route diagnosis

The current graph contains 557 map nodes and 1,836 directed static edges. From `moc_pryd01`, the observed static edges are:

```text
moc_pryd01 10,195 -> moc_pryd02 10,192
moc_pryd01 195,9  -> moc_ruins 60,161
moc_pryd01 90,109 -> moc_prydb1 100,185
```

The BFS component from `moc_pryd01` reaches 52 maps and contains neither `mjolnir_07` nor `pay_fild04`. The target maps are present elsewhere in the graph: `mjolnir_07` has incoming static edges from `mjolnir_03`, `mjolnir_06`, `mjolnir_08` and `prt_fild00`; `pay_fild04` has incoming static edges from `moc_fild02` and `moc_fild01`. Reverse checks show the target components do not reach back to `moc_pryd01` either.

The canonical `npc/custom/warper.txt` contains a Pyramids choice and registrations for the Mjolnir and Payon field destinations, including `pay_fild04`, plus `naviregisterwarp("Warper > Pyramids 1", "moc_pryd01", 192, 9)`. That is a scripted service transfer and is deliberately outside the current static parser.

| Source -> target | Static planner result | Classification | Exact first limitation |
|---|---|---|---|
| `moc_pryd01 -> mjolnir_07` | `planWebRelocation.reason = no_direct_route`, `route = null` | `C UNSUPPORTED_EDGE_TYPE` + `D NPC/SCRIPTED_TRANSFER_REQUIRED` + `B PROJECT_GRAPH_INCOMPLETE` | No static path exists in the parsed source component; the legal Warper service edge is excluded from the graph |
| `moc_pryd01 -> pay_fild04` | `planWebRelocation.reason = no_direct_route`, `route = null` | `C UNSUPPORTED_EDGE_TYPE` + `D NPC/SCRIPTED_TRANSFER_REQUIRED` + `B PROJECT_GRAPH_INCOMPLETE` | Same parser boundary; the Warper script registers `pay_fild04`, while static graph reachability from the source is absent |

`A WORLD_TOPOLOGY_DISCONNECTED` is not the primary conclusion. The static edge subgraph is disconnected in this direction, yet the rAthena world has a scripted Warper transfer. The evidence proves a Project graph coverage gap and unsupported transition type. It does not prove that the authoritative world makes either destination unreachable.

## 5. Comparison matrix

The machine-readable form is `docs/reference-mining/navigation-capability-matrix.yml`.

| Capability | Mature reference | Current Project | Classification | Safe reuse now |
|---|---|---|---|---|
| Static warp graph | Static portal metadata and map chaining | Parses canonical static warp files | REUSE | Yes for static feasibility only |
| Same-map path | Collision-aware field route | PA/rAthena execution | IMPROVE | Yes as an authority boundary |
| Authoritative map checkpoint | Wait for changed map and replan | Native map and live position | REUSE | Yes |
| OnTouch family | Script-triggered transition | Not represented in graph | ADAPT | Metadata only |
| Script warp family | Server-side `warp`/`mapwarp`/`areawarp` | Not represented in graph | ADAPT | Contract design only |
| Warper/NPC dialogue | Menu and service route | Excluded from resolver | ADAPT | Requires bounded service executor |
| Kafra service | TalkNPC plus transaction | Supply coordinator has fixed service route | ADAPT | Preserve player-flow checkpoints |
| Client `navigateto` | Guidance packet | No server authority | REJECT_LEGACY | Never as arrival proof |
| Instance entry | Instance-aware transfer | No instance edge model | ADAPT | Future capability only |
| Mapflag restrictions | Runtime legality checks | No graph annotation | ADAPT | Add reason taxonomy before execution |
| Unknown portal recording | Learn source/destination from map change | No durable learner | IMPROVE | Evidence proposal only |
| Missing portal removal/readd | Bounded suspend, alternative, re-add | No equivalent full branch | IMPROVE | Reuse policy shape |
| Route chaining | Replan after every map change | Static BFS route steps | ADAPT | Preserve destination intent |
| Unreachable diagnosis | Failure reason and route source suppression | `no_direct_route` only | IMPROVE | Add typed A-H result |
| `lockMap` | One farm map and bounded return | Target map and relocation policy | REUSE | Yes |
| Timeout and retry | Operation-specific ceiling | PA recovery has bounded retries | ADAPT | Reuse invariant, not client values |
| Teleport candidate | Route teleport/item candidate | Project wing semantics | ADAPT | Server-confirmed result only |
| Save-point/death recovery | Respawn then route resume | PA recovery and farm resume | ADAPT | Requires authoritative map match |
| Infinite random walk | Unbounded fallback | Not a required Project behavior | REJECT_LEGACY | Safe idle/backoff instead |

Summary counts for this matrix: `REUSE = 3`, `ADAPT = 10`, `IMPROVE = 4`, `REJECT_LEGACY = 2`, `NOT_APPLICABLE = 0`.

## 6. Reusable metadata contract

Future planner metadata can safely describe a transition without pretending to own it:

```yaml
edge:
  source_map: moc_pryd01
  source_cell: { x: 192, y: 9 }
  kind: npc_service
  actor: Warper > Pyramids 1
  destination_map: mjolnir_07
  destination_cell: null
  requirements: [dialogue_choice, authoritative_map_match]
  constraints: [mapflags, instance_context, cooldown]
  evidence: [script_path, source_line, observed_event]
  executor: PA
  authority: rAthena
  arrival: authoritative_map_and_position
  failure_codes: [NPC_NOT_FOUND, DIALOGUE_REJECTED, MAP_UNCHANGED, TIMEOUT]
```

The metadata is advisory and versioned. A generated table can propose a candidate, but PA must perform the interaction and rAthena must confirm the result. A failed candidate can be suspended for a bounded interval and re-added after fresh evidence. The planner should return `farmEligible`, `relocationSupported`, `routeFound` and `reason` separately.

## 7. First-broken-transition guidance

For future synthetic or player-flow tests, emit checkpoints in this order:

```text
intent accepted
-> policy and target validation
-> candidate edge selected
-> same-map approach or NPC/dialogue started
-> command/interaction accepted
-> authoritative map changed
-> authoritative arrival cell matched
-> target reacquired or service resumed
```

The first broken transition must carry the typed A-H classification. `HTTP 200`, a queued command, `navigateto` output or a static route list cannot substitute for authoritative arrival.

## Decision

```text
CLASSIFICATION = ADAPT
CURRENT_VERSION_APPLICABLE = PARTIAL
RATHENA_AUTHORITY = PASS
OPENKORE_REFERENCE = PASS, runtime return prohibited
REFERENCE_MINING_GAP = YES for scripted/service/instance edges and full failure taxonomy
PROJECT_CAN_REUSE_NOW = static graph feasibility, destination intent, authoritative map checkpoint, lockMap invariant and bounded retry shape
PA_FUTURE_NAVIGATION_CAPABILITIES = typed edge metadata, NPC/service executor, instance-aware routes, mapflag-aware rejection, portal evidence learner and durable replan
SAFE_SIMPLIFICATIONS = static-only dry-run, separate eligibility from route feasibility, bounded route length, no blind random walking
GAMEPLAY_CHANGE = NO
```

This dossier is evidence for future implementation and does not authorize Dashboard, PA, Native, rAthena script, Quest, database or Production changes.
