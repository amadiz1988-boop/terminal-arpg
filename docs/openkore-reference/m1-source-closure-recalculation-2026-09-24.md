# M1 source closure recalculation, 2026-09-24

This is a source-only accounting snapshot for the 38 `M1_REQUIRED` IDs in
`m1-core-hunting-closure.md`. Product authority is
`../project-control/canonical-m1-world-travel-supply-ui-v1.md` at `38cf0bb2`
with the latest `M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1` decision.
The pinned OpenKore symbols, defaults and transitions remain in
`mature-capability-census-v1.md`. `PASS(partial)` means the named test passed
for a narrower seam, not for the full capability. `LIVE_REQUIRED=YES` is the
separate eventual product gate and does not reduce a source score.

Checkpoint shorthand: `W` = committed Web source as of `50d2a264`,
`N` = committed Native source as of `9672f31`; a bare `W/N` is a baseline,
not a capability closure checkpoint. `NONE` means no qualifying capability
checkpoint. Later V2 commits included the generated map-info output and
`monster-names-tw.json` input; the rows below still name their original
capability-specific checkpoints.

| ID | SOURCE_IMPLEMENTATION | SOURCE_TEST | SOURCE_CHECKPOINT | LIVE_REQUIRED | CURRENT_BLOCKER |
|---|---|---|---|---|---|
| H01 | PARTIAL target scan | `test-farm-start-idle-contract.mjs` PASS(partial) | N | YES | Target eligibility through authoritative HIT lacks a bounded fixture. |
| H02 | PARTIAL blocked-target retry | NONE | N | YES | Reason-specific give-up and TTL transition untested. |
| H03 | PARTIAL native same-map walk | NONE | N | YES | Repath, deviation and no-progress terminal fixture absent. |
| H04 | PARTIAL direct World Map command | `test-world-map-teleport.mjs` PASS(partial) | `a815a82f`/`3deab2b` | YES | Command through authoritative arrival and AUTO_FARM resume untested; old player portal route is superseded. |
| H05 | PARTIAL GI no-target Fly policy | `pa-fly-rejection` 10 PASS(partial); `Test-PostWarpObservation.ps1` PASS(partial) | `4aed632`/`f2a268b` | YES | Post-warp source observer exists, but automatic trigger, rescan and target-to-authoritative-HIT chain remain unproven; deployed map-server lacks the new observer. |
| H12 | PARTIAL item 601 use | `test-permanent-travel-wings.mjs` PASS(partial); live synthetic item action PASS | N/W | YES | Group-0 test 150095 confirmed same-map position delta and count 59 unchanged during AUTO_FARM. Automatic legal Fly trigger, rescan and authoritative post-Fly monster HP delta remain unproven. |
| H13 | PARTIAL item 602/Saved Town | `test-world-map-supply-cutover.mjs` PASS(partial) | `1865cea` | YES | Authoritative Save Point arrival/count transition absent. |
| H15 | PARTIAL persisted farm destination | `test-world-map-supply-cutover.mjs` PASS(partial) | `3deab2b` | YES | Service interruption through original farm return untested. |
| H16 | PARTIAL retained city-local/Quest replan | `test-world-map-supply-cutover.mjs` PASS(partial) | W/N | YES | Bounded local/Quest missing-edge recovery fixture absent; player cross-map route superseded. |
| C01 | CLOSED active mode 2 subset | `test-farm-execution-profile.mjs` PASS; Native command contract PASS | `5bd5da4`/N | YES | No source blocker for the authorized subset; other attack modes outside M1. |
| C02 | PARTIAL melee issue | NONE | N | YES | Legal attack-to-authoritative-HIT matrix absent. |
| C03 | PARTIAL ranged authority | NONE | N | YES | Bow/gun ammo, range and LOS matrix absent. |
| C04 | PARTIAL ordered skill adapter | `test-m1-attack-skill-profile.mjs` PASS(partial) | `25dede8a`/`2e7d4fb` | YES | Final cast rejection cannot fall through to a later row in the same tick; effect fixture absent. |
| C05 | PARTIAL weapon fallback | `test-m1-attack-skill-profile.mjs` PASS(partial) | `25dede8a`/N | YES | Typed cast failure to safe wait/retarget/explicit fallback fixture absent. |
| C06 | PARTIAL retry | NONE | N | YES | Approach, cast and target retry ceilings untested. |
| C07 | PARTIAL invalidation | NONE | N | YES | Lost, unreachable and killed target reasons not independently exercised. |
| C08 | PARTIAL rAthena range/walk | NONE | N | YES | Legal LOS and blocked-wall fixtures absent. |
| C09 | PARTIAL rAthena ammo authority with GI nonconsumption override | `Test-NonConsumableAmmo.ps1` PASS(partial) | `633aacb` | YES | Arrow/bullet decrement suppression is source-tested; compatible-ammo presence/type, missing-ammo safe blocked state and multiple authoritative ranged HIT/count checks remain open. Depletion/refill is not an M1 capability. |
| C10 | PARTIAL rAthena equipment authority | NONE | N | YES | Per-enabled-action equipment prerequisite fixture absent. |
| C13 | PARTIAL row predicate adapter | `test-m1-attack-skill-profile.mjs` PASS(partial) | `25dede8a`/`2e7d4fb` | YES | Enabled predicate subset and final cast rejection fallthrough incomplete. |
| C19 | PARTIAL native target priority | NONE | N | YES | Aggressive, party and clean-target priority matrix absent. |
| R01 | PARTIAL HP recovery | `test-m1-hp-potion-profile.mjs` PASS(partial) | `d6e369ce`/N | YES | Action-specific native HP threshold and recovery transition incomplete. |
| R02 | PARTIAL SP recovery | NONE | N | YES | Positive opt-in SP threshold and resume source fixture absent. |
| R03 | PARTIAL sit/stand | NONE | N | YES | Weight, safety, queue and stand/resume gates untested. |
| R04 | PARTIAL ordered potion use | `test-m1-hp-potion-profile.mjs` PASS(partial) | `d6e369ce`/N | YES | Authoritative HP/count delta and global threshold overlap fixture absent. |
| R05 | PARTIAL recovery skill | NONE | N | YES | Configured self-skill predicate, cast effect and recovery resume absent. |
| R07 | PARTIAL loot and ledger | `test-farm-stats-pa-projection.mjs` PASS(partial) | W/N | YES | Inventory-add and factual loot event in one source fixture absent. |
| R08 | PARTIAL inventory authority | NONE | N | YES | Inventory count/capacity, safe `INVENTORY_BLOCKED` or precise equivalent, blocked purchase and no-quarantine matrix absent. Inventory-slot-triggered Supply is outside M1. |
| R09 | PARTIAL weight safety | NONE | N | YES | Sit/loot and unsafe-continuation weight guards lack bounded source/live tests. Weight-triggered storage/sell is outside M1 and is not a Supply trigger. |
| R10 | PARTIAL Supply trigger | `test-world-map-supply-cutover.mjs` PASS(partial) | `a815a82f`/`1865cea` | YES | Genuinely consumable HP/SP and currently supported skill-required-item shortage through paused combat and journey start remain untested; Fly/Butterfly/arrow/bullet depletion triggers are excluded. |
| R11 | PARTIAL shop buy | `test-supply-service-route-controller.mjs` PASS(partial) | W/N | YES | Actual price, Zeny, quantity and inventory delta/failure matrix absent. |
| R14 | PARTIAL direct Supply return | `test-world-map-supply-cutover.mjs` PASS(partial) | `a815a82f`/`1865cea` | YES | Saved Town, service, direct return, resume and renewed HIT chain absent. |
| R15 | PARTIAL action timers | NONE | N | YES | Per-action retry and timeout ceilings untested. |
| R16 | PARTIAL blocked-target/nav recovery | NONE | N | YES | Repeated no-progress safety terminal fixture absent. |
| R18 | PARTIAL persistent resume | `test-farm-start-idle-contract.mjs` PASS(partial) | W/N | YES | Supply/death/navigation interruption to same-session farm resume absent. |
| R19 | PARTIAL quarantine safety override | NONE for M1 core | N | YES | Core-flow quarantine and no-unsafe-loop matrix absent. |
| R20 | PARTIAL state projection | `test-farm-stats-pa-projection.mjs` PASS(partial); live Start/Stop mode transition PASS(partial) | W/N | YES | Group-0 150095 live mode converged to AUTO_FARM then PERSISTENT_IDLE; Fly/Supply position and post-HIT revision coverage remains open. |
| R21 | PARTIAL factual Event Ledger | `test-player-scenario-runner.mjs` PASS(partial); 12-second live combat observer FAIL | W/N | YES | ATTACK/HIT/KILL summary observed, but TARGET/LOOT absent and no per-hit monster HP-before/after correlation for the Fly window. |

Recalculation against the latest nonconsumable canonical policy: 38 classified,
`SOURCE_CLOSED=1` (`C01`), `SOURCE_REMAINING=37`;
`PRODUCT_CLOSED=0`, `PRODUCT_REMAINING=38`. The new policy removes only
storage/sell-trigger and arrow/bullet depletion/refill semantics from R08/R09/R10/C09; their listed M1 safety, ammo-legality and combat-continuity transitions remain open. The current runtime's successful
item-601 relocation does not close H05/H12 without the required
automatic-Fly-to-authoritative-HIT chain.
No row is held open solely for the superseded player cross-map Navigation
planner. H04 is held by arrival/resume, and H16 by retained local/Quest
replanning. The separate local source Browser matrix and HTTP/source tests do
not prove current Production player acceptance.

## Current settings mapping, 42 visible adjustable fields

All 42 are disabled in the source candidate because its `/api/config` contract
reports `execution.applied=false` and `CONFIG_ONLY_NO_EXECUTOR_COMMAND`.
Authenticated `GET /api/config` on the current canonical runtime returned
HTTP 404, so its deployed settings availability remains unproven.
`SUPPORTED_RUNTIME_MAPPING` below means a stored value is read into an
existing `start_farm` adapter, not that all predicates, command effects,
live behavior or UI enablement have passed. `M1_RUNTIME_MAPPING_MISSING`
requires an accepted executor contract before enablement.

| Classification | Exact paths | Count | Evidence / remaining gate |
|---|---|---:|---|
| SUPPORTED_RUNTIME_MAPPING | `combat.profile`, `combat.attack.mode`, `combat.attack.useWeapon`, `combat.travel.flyWing.enabled`, `combat.skills.attackSlots`, `combat.itemUse` | 6 | `farm-execution-profile.mjs` reads each into `start_farm`; capability attestation, action predicates and current-runtime acceptance still open. |
| M1_RUNTIME_MAPPING_MISSING | `supply.enabled`, `supply.services.buy.enabled`, `supply.services.buy.rules`, `combat.attack.distance`, `combat.attack.maxDistance`, `combat.attack.checkLOS`, `combat.attack.canSnipe`, `combat.attack.changeTarget`, `combat.attack.maxRouteDistance`, `combat.attack.maxRouteTime`, `combat.skills.selfSkills`, `combat.targets` | 12 | Persisted schema exists; no complete per-path executor attestation and bounded M1 action test. Attack route limits here concern same-map target approach, not player cross-map Navigation. |
| OUTSIDE_M1 | `supply.weightTriggerPercent`, `supply.inventorySlotTrigger`, `supply.services.storage.enabled`, `supply.services.storage.npc`, `supply.services.storage.npc_steps`, `supply.services.storage.distance`, `supply.services.sell.enabled`, `supply.services.sell.npc`, `supply.services.sell.npc_steps`, `supply.services.sell.distance`, `supply.services.withdraw.enabled`, `supply.services.storage.minZeny`, `supply.services.storage.keepOpen`, `supply.services.withdraw.rules`, `supply.itemRules`, `combat.follow.enabled`, `combat.follow.target`, `combat.follow.distanceMin`, `combat.follow.distanceMax`, `combat.travel.teleport.hp`, `combat.travel.teleport.sp`, `combat.travel.teleport.lostTarget`, `combat.travel.teleport.dropTarget`, `combat.skills.partySkills` | 24 | Weight/slot storage/sell triggers are a GI explicit override; storage/sell/withdraw, granular loot rules, follow/party and emergency teleport remain optional/future. Their stored values remain unchanged and disabled. |
| OBSOLETE | none of the 42 | 0 | `combat.attack.routeToLock` is hidden from Player settings and retained only for migration. |

The path partition is `6+12+24+0=42`, with zero enabled no-op fields.
`GI_EXPLICIT_OVERRIDE_NOT_APPLICABLE=0` within these 42 paths: no Fly,
Butterfly, arrow or bullet depletion/refill threshold is among the twelve
missing paths. The two weight/slot trigger paths stay in `OUTSIDE_M1` under
the latest product decision. The twelve missing mappings remain open until
real executor contracts and bounded tests exist; no reclassification alone
can close them.
OpenKore source/default/transition evidence is indexed by the H/C/R rows in
`mature-capability-census-v1.md` and each schema descriptor's `matureKey`;
this table does not introduce a new combat or recovery policy.

## Generated map-data boundary

`scripts/test-m1-map-info-canonical.mjs` independently regenerates twice
into guarded ignored `.local` directories, byte-compares all 394 files and
compares the accepted working-tree output. On the current accepted inputs it
passes: 249 visible roots, 360 visible map IDs and 251 farm candidates.
The old mixed `scripts/test-map-info-sync.mjs` still asserts 28 unlocked maps,
14 unlocked regions and old Browser DOM semantics. It is superseded as an M1
map-data gate; its other workline's dirty changes have not been overwritten.
The later V2 map-info checkpoint committed the generated files and input;
fresh Git-archive regeneration and the active `test:map-info` and
`test:world-map` source entrypoints passed. The mixed historical
`test-map-info-sync.mjs` remains separate and was not staged here.
