# M1 farm lifecycle source gate

```text
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
PHASE = SOURCE_ONLY
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
```

| Field | Evidence |
|---|---|
| OPENKORE_FILE | `control/config.txt:70-79`; `src/AI/CoreLogic.pm:2329-2363,3273-3296` |
| OPENKORE_SYMBOL | `processLockMap`, `processAutoAttack`, `getAttackAutoMode` |
| OPENKORE_CONFIG | `lockMap`, `attackAuto`, `attackAuto_routeToLock`, service-queue gates |
| OPENKORE_DEFAULT | Pinned sample `attackAuto=2`, `attackAuto_routeToLock=1`, `attackAuto_notWhile_storageAuto/buyAuto/sellAuto=1`; `lockMap` unset |
| OPENKORE_BEHAVIOR | Lock-map return is considered when AI is idle and configured map differs. Auto-attack is suppressed during an existing attack and by configured service gates. |
| OPENKORE_TRANSITION | Idle plus configured off-lock map → route; eligible idle/route context → target selection. OpenKore has no Dashboard `start_farm` command or GI revision CAS. |
| CURRENT_GI_BEHAVIOR | `web-canary.mjs:createControllerStatus` projects Start only from `PERSISTENT_IDLE`; `dashboard.mjs:queueCanaryAutomation` dispatches the existing command; Native `persistent_agent_state_start_farm` requires `agent_mode='PERSISTENT_IDLE'` and matching revision; `process_stop_farm` persists idle. |
| PORT_MAPPING | Existing Dashboard/PA command adapter and rAthena execution. The idle Start gate is a GI command-contract alignment, not a new OpenKore runtime or gameplay policy. |

The source defect was `farmRunning=false` with `agentMode=NAVIGATING` or another non-idle mode: the Web projected Start as enabled, while Native's CAS rejected it. The new bounded test covers idle, active farm, navigation, NPC/service/quest modes, route failure, non-resident, rollout and missing target. Source evidence includes `scripts/test-farm-start-idle-contract.mjs`, `scripts/test-auto-farm-same-map-start.mjs`, and the Native state update predicate.

Stop uses a separate command gate. `persistent_agent_state.cpp:1227-1235` accepts `stop_farm` only from its explicit active/failure mode set and ownership state `SERVER_AGENT`; `persistent_agent.cpp:6999-7052` then invalidates the execution epoch, stops farm/navigation/NPC/service/quest runtime and confirms the command. The Web now mirrors that mode set instead of treating the Farm Statistics `farmRunning` value as command eligibility. A quarantined owner is not projected as Start/Stop actionable. `test-farm-start-idle-contract.mjs` covers the accepted mode matrix, idle and quarantined negatives. Native `tools/pa-command-contract/build-and-test-pa-contract.ps1` passed 74 cases. Real combat cessation remains a live acceptance item.

For a map selected while an old farm runs on that same physical map, `ALREADY_AT_DESTINATION` now queues `stop_farm`, waits for authoritative idle and the selected map, then queues `start_farm`. The persisted intent remains until `WAIT_FARM` observes authoritative `AUTO_FARM` on that map; an explicit command rejection terminates with its exact reason. Initial dispatch failure restores the previous `grind-target.json` bytes and clears the new recovery marker. A concurrent in-flight relocation is rejected with `farm_relocation_in_progress`; it is never silently overwritten. `test-relocation-coordinator.mjs` exercises the idle, location, dispatch-rollback, rejection and farm-confirmation gates. This does not prove a live command ACK, Event Ledger or Player Web presentation.

```text
FARM_START_STOP_SOURCE_STATUS = SOURCE_CLOSED
FARM_MAP_SWITCH_SOURCE_STATUS = PARTIAL
REMAINING_SOURCE_BLOCKERS = in-flight destination replacement policy; full direct and multimodal arrival/restart contract tests
LIVE_ACCEPTANCE = UNMEASURED
PRODUCT_CLOSED = NO
```

Historical Supply test classification:

```text
HISTORICAL_TEST = scripts/test-supply-interruption-recovery.mjs
CLASSIFICATION = STALE
WHY_STALE = asserts removed dashboard/index.html supplyWeight input and historical OpenKore controller behavior
CURRENT_REPLACEMENT_SEMANTICS = Native handle_supply uses configured item ID and per-item supply_min_count/target_count; PA owns interrupt/service/return
CURRENT_TEST_COVERAGE = tools/pa-supply-recovery/test-supply-recovery.mjs; scripts/test-supply-service-route-controller.mjs; scripts/test-prt-fild08-supply-route.mjs
```

The historical file remains intact. Its removed UI assertion is not a current PA source failure, and its OpenKore process is not a permissible runtime dependency.
