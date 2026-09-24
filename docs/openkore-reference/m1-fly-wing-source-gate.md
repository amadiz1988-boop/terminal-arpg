# M1 Fly Wing source gate

```text
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
CLASSIFICATION = GI_EXPLICIT_OVERRIDE / SOURCE_PARTIAL
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
```

| Field | Evidence |
|---|---|
| OPENKORE_FILE | `control/config.txt:226-235,315-335`; `control/mon_control.txt:1-32`; `src/AI/CoreLogic.pm:3273-3296`; `src/Misc.pm:3607,3624`; `src/Task/Teleport.pm:41-49,83-99,131-164` |
| OPENKORE_SYMBOL | `processAutoAttack`, `objectAdded`, `objectRemoved`, `Task::Teleport::iterate` |
| OPENKORE_CONFIG | `teleportAuto_search`, `teleportAuto_idle`, `mon_control.search`, `route_teleport`, item cooldown/teleport retry |
| OPENKORE_DEFAULT | Pinned sample: search 0, idle 0, route teleport 0, route minDistance 75, maxTries 8; Teleport task retry 0.5 s, give-up 3 s |
| OPENKORE_BEHAVIOR | `teleportAuto_search` gates attack selection by search-tagged monster count; it does not issue a Fly Wing. The separate Teleport task waits for item ACK or map change, retries within a bounded task, then fails. |
| OPENKORE_TRANSITION | Search count and attack context → target selection; a separately triggered Teleport task → item use → observed warp or 3 s give-up. |
| CURRENT_GI_BEHAVIOR | Explicit project policy in `docs/RO_FLY_WING_SOURCE_AUDIT.md:19`: no visible target may use Fly Wing. Native `try_hunt_relocation` is called only after an empty target scan, checks farm lease/map/item/cooldown, calls rAthena `pc_useitem` through `persistent_agent_use_item`, requires authoritative position change and same-map containment, then resets scan logging. Canonical stack config selects item 601; rAthena item import gives 601 `NoConsume`. |
| PORT_MAPPING | `resolveFarmExecutionProfile` transports the per-character opt-in through the existing `start_farm` payload. Native PA performs the GI-authorized search action and delegates item/world legality to rAthena. OpenKore runtime and route-teleport acceleration are not imported. |

Source checks passed: `scripts/test-farm-execution-profile.mjs`, `scripts/test-permanent-travel-wings.mjs`, `ops/ro-stack/tests/test-pa-config-projection.ps1` (prior source coverage), and the Native command contract's `huntRelocationEnabled` type checks. No current live wing use, position/count observation or post-warp HIT is claimed.

```text
NO_MATURE_REFERENCE = YES for the GI-specific NO_TARGET → FLY trigger
EXPLICIT_GI_CANONICAL_OVERRIDE = docs/RO_FLY_WING_SOURCE_AUDIT.md:19
PROJECT_POLICY_REQUIRED = NO for rejection terminal/re-arm behavior; Project Control explicitly authorized the rule in OPENKORE_MATURE_CAPABILITY_GAP_CENSUS_AND_CLOSURE_V1
FLY_REJECTION_SOURCE = Native 4aed632; authoritative map-flag rejection records a map-local suppression until the map or restriction changes; no-item exits before item use; opaque item failures return only on a later normal scheduler cycle
FLY_REJECTION_TEST = tools/pa-fly-rejection/build-and-test-fly-rejection.ps1 PASS source/policy checks; x64 Release Solution Build PASS; Native command contract 486 PASS
SOURCE_GAP = authoritative post-warp target, HIT, and live inventory/count observation remain unproven
FLY_WING_M1_SOURCE_CLOSED = NO
PRODUCT_CLOSED = NO
```

This gap is not resolved by enabling a global Fly switch or equating `MONSTER_ATTACK` with a hit. No new retry/fallback policy is introduced here.

V2 source continuation at Native `f2a268b`: successful item 601 use now records
the rAthena position and count delta in `FLY_WING_RELOCATED`, forces the existing
live-status export, and arms the existing post-relocation target/attack/HIT
observer. `Test-PostWarpObservation.ps1` and the Fly rejection suite pass;
Release x64 solution build passes. These are source checks. No legal runtime
fixture has executed the chain under this checkpoint, so
`FLY_RELOCATION_CONFIRMED=NOT_MEASURED`, `FLY_TO_HIT=NOT_MEASURED`, and
`FLY_WING_M1_SOURCE_CLOSED=NO` remain exact.
