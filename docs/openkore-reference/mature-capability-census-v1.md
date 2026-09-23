# OpenKore mature capability census and closure V1

```text
TASK_ID = OPENKORE_MATURE_CAPABILITY_GAP_CENSUS_AND_CLOSURE_V1
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
STATUS = IN_PROGRESS / SOURCE_ONLY
OPENKORE_RUNTIME = 0
RATHENA_WORLD_AUTHORITY = YES
```

`OPENKORE_FILE` paths below are relative to pinned `.local/ro-stack/openkore`.
`CURRENT_GI_BEHAVIOR` names canonical source symbols. `ALIGNED` requires
behavioral proof, so a source resemblance alone is `PARTIAL`. A row marked
`NOT_IMPLEMENTED` has a named later stage and is not a production claim.
No row licenses OpenKore runtime, a second planner, a second combat engine, or
direct SQL changes to actor state. This census covers the named capability
families and newly found related families; the separate 135-predicate
behavioral parity audit in `runtime-state-policy-parity.md` remains open.

Columns `OPENKORE_DEFAULT` and `OPENKORE_CONFIGURABLE` describe the pinned
`control/config.txt` sample, not an invented universal RO default. The
`OPENKORE_TRANSITION` column records condition to action or retry. `PORT_MAPPING`
names the existing GI seam, or `HOLD` when the executor is not authorized.

## Hunting, movement, and teleport

| ID / capability | OPENKORE_FILE / OPENKORE_SYMBOL / OPENKORE_CONFIG | OPENKORE_DEFAULT / OPENKORE_CONFIGURABLE | OPENKORE_BEHAVIOR / OPENKORE_TRANSITION | CURRENT_GI_BEHAVIOR | CLASSIFICATION | REQUIRED_CHANGE / PORT_MAPPING |
|---|---|---|---|---|---|---|
| H01 Target acquisition | `src/AI/CoreLogic.pm` `processAutoAttack`; `src/Misc.pm` `mon_control`; `attackAuto` | `attackAuto=2`; YES | Gate idle, map, service, actor and monster policy, then queue target attack | `persistent_agent.cpp` `find_target`, farm tick choose `MONSTER_TARGET` | PARTIAL | Audit all gates and target priority; PA farm tick to rAthena target authority |
| H02 Retarget | `src/AI/Attack.pm` `giveUp`, `targetGone`; `attackChangeTarget=1`, `attackNoGiveup=0` | 1 / 0; YES | Target invalid, give-up, clean-target and alternate selection | Native blocked target TTL and scan | PARTIAL | Compare give-up reasons, cooldown and target-change threshold; existing target search |
| H03 Same-map pathing | `src/Task/Route.pm` `iterate`, `routeRepath`, `getRoute`; `route_step=10`, `route_avoidWalls=1` | 10 / 1; YES | Path, move, detect deviation, repath or fail | `walk_to_farm_target`, native path and rAthena movement | PARTIAL | Bound route/repath/no-progress equivalence; existing rAthena path authority |
| H04 Cross-map navigation | `src/Task/MapRoute.pm` `iterate`, `subtaskDone`, `mapChanged`; `route_maxNpcTries=5` | 5; YES | Portal/NPC graph leg, transport confirmation, recalc or fail | PA navigation plus Web route planner and rAthena warp facts | PARTIAL | Complete OpenKore adoption audit and same-route acceptance; existing one planner and PA journey |
| H05 Search-monster gate / GI no-target Fly | `src/AI/CoreLogic.pm:3291` `processAutoAttack`; `src/Misc.pm:3607,3624` `objectAdded/objectRemoved`; `teleportAuto_search=0`, `mon_control.search` | 0; YES | Tagged search-monster count gates auto-attack search; it does not issue a teleport. `NO_TARGET → FLY` has `NO_MATURE_REFERENCE=YES`, `PROJECT_POLICY_REQUIRED=YES` | `try_hunt_relocation` uses 601 after no target; `docs/RO_FLY_WING_SOURCE_AUDIT.md:19` records explicit user policy; source now honors character `flyWing.enabled` | GI_EXPLICIT_OVERRIDE | Keep user policy distinct from OpenKore search; PA farm tick to rAthena item authority |
| H06 Danger / escape teleport | `src/AI/CoreLogic.pm:3636-3673` `processAutoTeleport`, `src/Misc.pm:4191-4296` damage callbacks; `teleportAuto_hp=10`, `teleportAuto_deadly=1`, `teleportAuto_maxDmg=500` | 10 / 1 / 500; YES | Non-city safety gate, timeout, HP/SP threshold **and aggressives**, or aggressive-count trigger; distinct lethal/damage callbacks then request teleport | Native survival handles HP; no proven emergency teleport bridge | MISSING | Preserve distinct guards and cooldown before bounded emergency policy; existing PA interrupt and native item seam |
| H07 Unstuck teleport | `src/Task/Route.pm` `iterate`; `teleportAuto_unstuck=0` | 0; YES | No route progress can teleport only when opted in | Native navigation stuck retry and failure; no equivalent configured teleport | PARTIAL | Preserve opt-in and compare no-progress threshold; existing PA navigation |
| H08 Lost / dropped target teleport | `src/AI/Attack.pm` `targetGone`, `giveUp`; `teleportAuto_lostTarget=0`, `teleportAuto_dropTarget=0`, `teleportAuto_dropTargetEngaged=1` | 0 / 0 / 1; YES | Different target-loss and give-up reasons govern teleport | Native retarget/block; no reason-specific teleport | PARTIAL | Keep triggers separate and default off; existing PA target state |
| H09 Monster-specific policy | `control/mon_control.txt` attack/teleport/search fields; `src/Misc.pm` `mon_control` | No `all` row, `mon_control` fallback `attack_auto=1`; YES | Per-monster policy gates attack/search/teleport; negative attack can suppress even retaliation | Map-only player farm uses legal-mob filter, no per-monster execution policy | PARTIAL | Derive current authorized target restrictions from pinned semantics; avoid new UI monster selection; native target filter |
| H10 Monster-specific teleport | `control/mon_control.txt` teleport field; `src/Misc.pm` damage callback and `processAutoTeleport` caller | Listed bosses use `-1 1 0`; YES | Specific monster sight, proximity or damage can trigger escape | No native per-monster teleport condition | NOT_IMPLEMENTED | M1 tactical policy later gate; HOLD until canonical product choice and source proof |
| H11 Route acceleration teleport | `src/Task/Route.pm` `iterate`; `route_teleport=0`, `minDistance=75`, `maxTries=8` | 0 / 75 / 8; YES | Optional same-map route acceleration retries then walks | GI navigation uses route/warp legs; no route acceleration policy | NOT_IMPLEMENTED | Navigation adoption audit stage; HOLD, never conflate with no-target roaming |
| H12 Fly Wing item semantics | `src/Task/Teleport.pm` `iterate`, `onItemUseAck`; `teleportAuto_item1/2` unset | unset; YES | Select available skill/item, wait ACK, retry or give up | GI permanent item 601, native use_item and farm relocation | GI_EXPLICIT_OVERRIDE | Preserve non-consumption from `config-schema.mjs` `FIXED_POLICY.flyWing`; keep rAthena position proof |
| H13 Butterfly / save return | `src/Task/MapRoute.pm` route and item-warp steps; `route_warpByItem=0` | 0; YES | Item warp is optional route leg with destination confirmation | GI permanent item 602 for supply Save Point | GI_EXPLICIT_OVERRIDE | Preserve non-consumption and Save Point authority; existing supply route |
| H14 No-target random walk | `src/AI/CoreLogic.pm` `processRandomWalk`; `route_randomWalk=1`, `route_randomWalk_inTown=0` | 1 / 0; YES | Idle/search may choose bounded random movement | Native no-target scan and optional hunt relocation; `docs/RO_FLY_WING_SOURCE_AUDIT.md:19` overrides no-target strategy | GI_EXPLICIT_OVERRIDE | Preserve explicit player policy and farm-map containment; advanced roaming remains later stage |

## Combat and action predicates

| ID / capability | OPENKORE_FILE / OPENKORE_SYMBOL / OPENKORE_CONFIG | OPENKORE_DEFAULT / OPENKORE_CONFIGURABLE | OPENKORE_BEHAVIOR / OPENKORE_TRANSITION | CURRENT_GI_BEHAVIOR | CLASSIFICATION | REQUIRED_CHANGE / PORT_MAPPING |
|---|---|---|---|---|---|---|
| C01 Attack mode | `src/Misc.pm` `getAttackAutoMode`; `src/AI/CoreLogic.pm` `processAutoAttack`; `attackAuto=2`, route/out-of-lock keys | 2 / route 1 / out 1; YES | Context chooses -1/0/1/2 before target search | GI config exposes mode; thin farm adapter accepts only active 2 | PARTIAL | Context-sensitive modes need later tested executor contract; existing PA farm intent |
| C02 Normal attack | `src/AI/Attack.pm` `main`; `attackUseWeapon=1`, distance 1 | 1 / 1; YES | Weapon method is candidate only when enabled; native timing/damage authoritative | `issue_melee_attack`, unit_attack; class parity unproven | PARTIAL | M1 melee/bow/gun parity tests; existing rAthena attack primitive |
| C03 Ranged normal attack | `src/AI/Attack.pm` `main`; `attackDistanceAuto=1`, `attackMaxDistance=1` | 1 / 1; YES | Weapon range and line of sight gate ranged action | Native uses `rhw.range` but class/equipment parity unproven; profile rejects | PARTIAL | M1 bow/gun fixture proof before promotion; existing attack primitive |
| C04 Offensive skill slot | `control/config.txt` `attackSkillSlot` block; `src/AI/Attack.pm` `main` | Empty skill name, maxAttempts/maxUses 0; YES | First matching slot checks self and monster predicates, cast parameters and attempts | Native one `skillId`, learned/SP/range/cooldown/cast checks | PARTIAL | M1 multi-slot/target/ground skill adapter and effect proof; existing rAthena skill primitive |
| C05 Skill fallback | `src/AI/Attack.pm` `main` weapon candidate then skill override; `src/Misc.pm` `checkSelfCondition` SP | `attackUseWeapon=1`, no slot; YES | Unavailable skill leaves enabled weapon method; no method waits 6 s then gives up | New thin profile contract prevents SKILL_CAST melee and retains HYBRID weapon | PARTIAL | Verify source guard, 6 s transition and live hit/no-hit; PA to Local Executor |
| C06 Attack retry / failure | `src/AI/Attack.pm` `note_approach_route_failure`, `shouldGiveUp`, `main`; `attackNoGiveup=0`, `attackMaxRouteTime=4` | 0 / 4; YES | Approach retry, target movement, timeout and give-up are separate | Native blocked targets and movement retries | PARTIAL | Enumerate exact failure reasons and bounded retry parity; existing target loop |
| C07 Lost target | `src/AI/Attack.pm` `targetGone`; `teleportAuto_lostTarget=0` | 0; YES | Lost target clears attack; optional distinct teleport | Native target invalidation and scan | PARTIAL | Preserve lost vs unreachable vs killed semantics; existing target state |
| C08 Line of sight / unreachable | `src/AI/Attack.pm` `main`; `attackCheckLOS=1`, `attackCanSnipe=0` | 1 / 0; YES | Check range/LOS, route or give up | Native `battle_check_range`, `walk_to_farm_target` and blocked TTL | PARTIAL | Test LOS, wall and map exit variants; rAthena path/LOS authority |
| C09 Ammo | `src/AI/CoreLogic.pm` `processAutoMakeArrow`; `attackEquip_arrow` empty; `dcOnEmptyArrow=0` | empty / 0; YES | Availability and arrow action are distinct; no automatic disconnect by default | rAthena inventory/equipment authority; Native class proof pending | PARTIAL | M1 bow/gun ammo dry/restore fixtures and no false HIT; existing rAthena combat |
| C10 Equipment requirements | `control/config.txt` `attackEquip_*`, `attackSkillSlot.equip_*`; `src/Misc.pm` `checkSelfCondition` | equipment fields empty; YES | Specific attack/skill may require equipped item | GI equipment commands exist; skill profile conditions not transported | PARTIAL | M1 equipment legality tests, no duplicate rule engine; rAthena equipment authority |
| C11 Auto equipment switch | `control/config.txt` `autoSwitch`, `equipAuto`; `src/AI/CoreLogic.pm` `processAutoEquip` | blocks empty; YES | Optional target/action equipment switch | No PA auto-switch executor | NOT_IMPLEMENTED | Later M1 tactical equipment stage, HOLD pending explicit promotion |
| C12 Buff / self skill | `control/config.txt` `useSelf_skill` empty; `src/AI/CoreLogic.pm` `processAutoSkillUse` | no active row; YES | Per-row self condition gates cast and timeout | GI config stores rows, Native recovery skill allowlist only | NOT_IMPLEMENTED | M1 Stage 3B self-buff; HOLD until condition contract promoted |
| C13 Status predicates | `src/Misc.pm` `checkSelfCondition`, `checkPlayerCondition`, `checkMonsterCondition`; status keys | rows unset; YES | Per-action active/inactive status tests filter candidate actions | rAthena status authority exists; GI row predicates config-only | PARTIAL | Classify 135 keys and port only action-used subset; existing PA/native action seam |
| C14 Party support skill | `control/config.txt` `partySkill` empty; `src/AI/CoreLogic.pm` `processPartySkillUse` | no active row; YES | Target identity, party range, player/self predicates then cast | GI profile config only | NOT_IMPLEMENTED | M1 Stage 3C, full party support outside M1 exit gate; HOLD |
| C15 Follow | `control/config.txt` `follow=0`, distances 3/6; `src/AI/CoreLogic.pm` `processFollow` | off, 3/6; YES | Follow leader, recover lost target, maintain range | GI Web config-only follow, no native executor | NOT_IMPLEMENTED | M1 Stage 3C or later named follow milestone; HOLD |
| C16 Companion/homunculus | `src/AI/Slave.pm` `processAutoAttack`, `processFollow`; slave config prefix | no player companion enable in base config; YES | Separate actor lifecycle/attack state | GI current M1 local player hunting only | NOT_APPLICABLE | Future companion milestone only; HOLD |

## Recovery, supply, lifecycle, and evidence

| ID / capability | OPENKORE_FILE / OPENKORE_SYMBOL / OPENKORE_CONFIG | OPENKORE_DEFAULT / OPENKORE_CONFIGURABLE | OPENKORE_BEHAVIOR / OPENKORE_TRANSITION | CURRENT_GI_BEHAVIOR | CLASSIFICATION | REQUIRED_CHANGE / PORT_MAPPING |
|---|---|---|---|---|---|---|
| R01 HP sit | `src/AI/CoreLogic.pm` `processSitAuto`; `sitAuto_hp_lower=40`, upper=100 | 40/100; YES | Low HP queues sit only under action, safety and weight gates; upper resumes | Native `handle_survival` global HP 30/60 source, stack 70/80 | PARTIAL | Port condition gates and preserve explicit GI thresholds only with canonical override; PA recovery |
| R02 SP sit | same `processSitAuto`; `sitAuto_sp_lower=0`, upper=0 | 0/0; YES | Disabled by default, opt-in independent of action skill SP | Native source 0/0, Production still 20/40 | PARTIAL | Controlled deploy plus route/combat opt-in proof; PA recovery |
| R03 Sit / stand gating | same `processSitAuto`; `sitAuto_over_50=0`, `sitAuto_idle=1` | 0/1; YES | Basic skill, queue action, weight and aggression gate sit; safe upper stand | Native recovery sit lacks full gate equivalence | PARTIAL | Port explicit decision gate and bounded safe-resume tests; PA recovery |
| R04 Recovery item / potion | `control/config.txt` `useSelf_item` empty; `src/AI/CoreLogic.pm` `processAutoItemUse` | no active row; YES | Per-row self condition, item presence and timeout select use | Native `try_recovery_item` global allowlist and thresholds | PARTIAL | M1 action-conditioned item adapter with rAthena use authority |
| R05 Recovery skill | `control/config.txt` `useSelf_skill` empty; `src/AI/CoreLogic.pm` `processAutoSkillUse` | no active row; YES | Learned skill, SP and self conditions gate cast | Native `try_recovery_skill` global allowlist | PARTIAL | M1 condition transport and cast effect proof; existing skill primitive |
| R06 Death / respawn | `src/AI/CoreLogic.pm` `processDead`; `dcOnDeath=0` | no disconnect; YES | Dead action interrupts queues; configured respawn/restart continuation | Native `handle_death`, Save Point, recovery and farm resume | PARTIAL | Same-fixture death to return to HIT proof; PA life cycle |
| R07 Loot acquisition | `src/AI/CoreLogic.pm` `processItemsTake`; `itemsTakeAuto=2`, `itemsGatherAuto=2` | 2/2; YES | Drop detection, route, take and capacity checks | Native loot search/pickup, `LOOT_ACQUIRED` | PARTIAL | M1 Global AutoLoot inventory and factual ledger proof; rAthena item authority |
| R08 Inventory use / capacity | `src/AI/CoreLogic.pm` `processAutoItemUse`, `processItemsTake`; `itemsMaxWeight=89` | 89; YES | Per-action possession and capacity gates | Native item use, loot and supply count authority | PARTIAL | Verify distinct capacity/presence conditions; existing inventory authority |
| R09 Weight | `src/AI/CoreLogic.pm` `processSitAuto`, `processStartAutoStorageBuySell`; `sitAuto_over_50=0`, `itemsMaxWeight_sellOrStore=48` | 0/48; YES | Sit, loot and supply thresholds differ by action | Native weight/loot/supply checks use own thresholds | PARTIAL | Per-action mapping; no single global weight rule |
| R10 Supply trigger | `src/AI/CoreLogic.pm` `processStartAutoStorageBuySell`, `processAutoBuy`; `buyAuto.minAmount=2`, max=3 | no active buy row, template 2/3; YES | Inventory threshold queues service path and bounded purchase | Native `handle_supply` configured item/min/target | PARTIAL | Match per-item trigger, zeny/price/batch and resume where authorized; PA supply |
| R11 Shop buy | `src/AI/CoreLogic.pm` `processAutoBuy`; `buyAuto` block | no active row; YES | NPC route, steps, price/zeny, batch and retry | Native service buy one configured item | PARTIAL | Per-row guards and failure reasons; existing NPC/shop authority |
| R12 Shop sell | `src/AI/CoreLogic.pm` `processAutoSell`; `sellAuto=0` | off; YES | Optional NPC sell route after weight/service decision | GI canonical Global AutoStore off; sell path not current supply default | NOT_IMPLEMENTED | OpenKore Exit C9 / later supply service gate; HOLD |
| R13 Storage | `src/AI/CoreLogic.pm` `processAutoStorage`; `storageAuto=0` | off; YES | Optional NPC storage, capacity, retry and next service | GI Global AutoStore explicitly false, no automatic storage cycle | GI_EXPLICIT_OVERRIDE | Keep `FIXED_POLICY.loot.autoStore=false`; manual storage future gate only |
| R14 Supply return | `src/Task/MapRoute.pm` route and `processAutoBuy` continuation; route config | route per user; YES | Service completion resumes queued route or lock map | Native supply out, service, back and target reacquire | PARTIAL | Same-session supply to HIT/KILL/LOOT proof; PA journey |
| R15 Retry / timeout | `src/Task/Teleport.pm` `iterate` retry 0.5 s/give-up 3 s; `src/Task/Route.pm` `iterate`; route timeout config | teleport task 0.5/3; YES | Action-specific retry, give-up and task failure | Native navigation/supply/recovery bounded retries exist | PARTIAL | Compare per-action limits; never one blanket retry policy |
| R16 Unreachable / stuck | `src/Task/Route.pm` `iterate`; `route_teleport=0`, `teleportAuto_unstuck=0` | both off; YES | Repath, bounded no-progress, optional teleport, fail | Native blocked target and navigation no-progress failure | PARTIAL | No-progress variants and legal fallback proof; existing PA/navigation |
| R17 Disconnect / reconnect | `control/config.txt` `dcOnDisconnect=0`, `autoRestart=0`; `src/AI/CoreLogic.pm` `processAutoBreakTime` | both off; YES | Client network state may disconnect/restart OpenKore process | GI runs one server-owned PA without OpenKore client | GI_EXPLICIT_OVERRIDE | Preserve server-owned rehydrate; no client process model |
| R18 Resume after interruption | `src/Task/Route.pm` `interrupt`, `resume`; `src/Task/Teleport.pm` `interrupt`, `resume` | task lifecycle, no config default; NO | Paused task resumes its own step after interrupt | PA persists farm rules and resumes after supply/death/navigation | PARTIAL | Verify profile snapshot and all interrupt paths; existing PA record |
| R19 Quarantine | No mature OpenKore equivalent; `NO_MATURE_REFERENCE=YES`, `PROJECT_POLICY_REQUIRED=YES` | N/A; NO | N/A | Native `quarantine` with server-owned admission and failure reasons | GI_EXPLICIT_OVERRIDE | Keep canonical server safety policy; no invented OpenKore analogue |
| R20 Runtime state projection | OpenKore AI/client status fields in `src/AI/CoreLogic.pm` `iterate`; no server-side authority model | N/A; NO | Client-local state drives AI queue | Native `LIVE_STATUS_EXPORT`, Dashboard projection, PA state | GI_EXPLICIT_OVERRIDE | Server-authoritative projection remains; no second status authority |
| R21 Combat factual events | `src/AI/Attack.pm` `main` sends attack, damage observed from network; no Event Ledger | N/A; NO | Attack request precedes damage confirmation | Native `MONSTER_ATTACK`, `MONSTER_HIT`, `MONSTER_KILL`, `LOOT_ACQUIRED` | GI_EXPLICIT_OVERRIDE | Keep rAthena factual ledger and verify HIT separately from ATTACK |
| R22 Quest progression | `src/AI/CoreLogic.pm` NPC/route tasks; plugin-specific quest rules outside pinned core | no generic quest config; YES | Task-driven NPC and route interactions | PA Quest runtime exists, M2 continuous progression unaccepted | NOT_IMPLEMENTED | M2 Novice-to-Eden Lv40 milestone; current OpenKore Exit quest seams stay separate |

## Closure accounting

This is a discovered-capability classification, not a full parity certificate.
The table has 52 rows: 14 H, 16 C, 22 R. Classification counts are
`PARTIAL=33`, `MISSING=1`, `NOT_IMPLEMENTED=8`, `NOT_APPLICABLE=1`,
`GI_EXPLICIT_OVERRIDE=9`, and `ALIGNED=0`. Every displayed row has exactly one
classification. All 135 condition-predicate keys have a stage classification
and source pointer in `condition-key-census-v1.md`; their action-level parity
and unenumerated Native decision sites are explicit outstanding work. Therefore
`UNCLASSIFIED_CAPABILITY=0` applies only to displayed rows and the overall exit
gate remains `NO`. `CURRENTLY_AUTHORIZED_PARTIAL` and
`CURRENTLY_AUTHORIZED_MISSING` remain nonzero. Production and Browser proof are
not implied by source changes.

Known deviation decisions are explicit. `R01` HP 30/60 source and 70/80 stack
versus pinned 40/100, `R03` missing sit gates, and `R04/R05` global recovery
allowlists are `A: BUG_OR_ACCIDENTAL_DEVIATION` until corrected and tested.
`H05/H12/H13/H14`, `R13`, and `R17/R19/R20/R21` are
`B: GI_EXPLICIT_OVERRIDE` with the cited GI authority. `R19` also carries
`NO_MATURE_REFERENCE=YES` and needs no fabricated OpenKore behavior. Other
`PARTIAL` rows identify unported or unproven action behavior, not a license to
invent a replacement. Full non-parser site discovery is still open, so
`UNEXPLAINED_DEVIATION=0` has not been certified.

## First broken transitions still open

| Capability | FIRST_BROKEN_TRANSITION | Gate |
|---|---|---|
| Emergency teleport `H06` | Config `combat.travel.teleport.hp/sp` → `start_farm` payload: no emergency-policy fields; Native has no corresponding condition path | Exact OpenKore non-city, aggression, safety and cooldown port; source and safe fixture test |
| Per-row skill `C04` | Stored `combat.skills.attackSlots` → command: only one optional `skillId` from action body; no slot/condition transport | M1 Stage 3A implementation authorization and effect proof |
| HP/sit `R01/R03` | Pinned `processSitAuto` action/safety/weight gate → Native `handle_survival`: global interruption with divergent threshold | Action-level policy and safe combat/recovery test |
| Recovery rows `R04/R05` | Stored `useSelf_item/useSelf_skill` conditions → Native: global item/skill allowlists | Condition adapter, rAthena execution proof |
| Navigation `H04` | Pinned `Task::MapRoute` failure/replan semantics → GI planner/PA retry: adoption audit unfinished | One-engine parity audit and route fixtures |
| Profile live acceptance `C05/H05` | New source payload/guard → current Production binary: deployment intentionally deferred | Full source exit gate, controlled deploy, synthetic then Browser final acceptance |

First bounded closure slice: `attackUseWeapon` and `attackSkillSlot` map through
the authenticated player config to `start_farm` payload, Native acceptance and
the existing farm loop. Unknown/unavailable profiles fail closed. Persisted
`target_rules` preserve the profile through PA restore and supply/death resume.
Pre-contract commands retain explicit legacy weapon behavior; this is a
compatibility bridge, not a second execution policy. Full class-aware combat,
per-row conditions and mature teleport/recovery gates remain open.
