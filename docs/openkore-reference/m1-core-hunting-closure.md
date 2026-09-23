# M1 core hunting capability closure

```text
TASK_ID = OPENKORE_MATURE_CAPABILITY_GAP_CENSUS_AND_CLOSURE_V1
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
PRODUCT_DECISION = M1_CORE_HUNTING_IMPLEMENTATION_AUTHORIZED
FULL_STAGE3_IMPLEMENTATION_AUTHORIZED = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
STATUS = SOURCE_CANDIDATE_IN_PROGRESS
```

The exact OpenKore file, symbol, configuration, default and transition for each
ID are in [mature-capability-census-v1.md](mature-capability-census-v1.md).
`M1_REQUIRED` means its core-loop subset must pass, including a subset of
per-action predicates when a skill or item is enabled. It does not promote all
135 predicates, optional monster rules, or full Stage 3. `M1_OPTIONAL` may be
enabled only after independent acceptance. `FUTURE` has no first-release UI
execution. This scope tag does not alter the census's evidence classification.

## Complete scope assignment

| Scope | Census IDs | Count |
|---|---|---:|
| M1_REQUIRED | H01 H02 H03 H04 H05 H12 H13 H15 H16 C01 C02 C03 C04 C05 C06 C07 C08 C09 C10 C13 C19 R01 R02 R03 R04 R05 R07 R08 R09 R10 R11 R14 R15 R16 R18 R19 R20 R21 | 38 |
| M1_OPTIONAL | H06 H07 H08 H09 H14 C11 C12 C17 C18 R06 R12 R13 R17 R23 | 14 |
| FUTURE | H10 H11 H17 C14 C15 R22 | 6 |
| NOT_APPLICABLE | C16 | 1 |

For the first release, `M1_OPTIONAL`, `FUTURE` and `NOT_APPLICABLE` controls
remain disabled or absent. A GI explicit override remains documented in the
census and cannot substitute for authoritative behavior proof.

## M1 required closure contract

All rows below are currently `PARTIAL` for product acceptance. `H05`, `H12`,
`H13`, `R19`, `R20` and `R21` retain a `GI_EXPLICIT_OVERRIDE` evidence class in
the parent census; the override defines semantics, not live acceptance. An
internal-only row has `UI_SETTING=NONE`. Every UI setting is enabled only after
that row's real runtime capability and Player Web wiring are accepted.

| CAPABILITY | CURRENT_STATUS | OPENKORE_REFERENCE | CURRENT_PA_SEAM | BLOCKER / FIRST_BROKEN_TRANSITION | REQUIRED_CHANGE | UI_SETTING | UI_ENABLED_AFTER_ACCEPTANCE |
|---|---|---|---|---|---|---|---|
| H01 Target | PARTIAL | H01 `processAutoAttack` | Native target scan | Target policy and authoritative target cycle unproven | Gate target eligibility; target-to-HIT fixture | 掛機自動找怪 | YES |
| H02 Retarget | PARTIAL | H02 `giveUp` | Native blocked target scan | Give-up reasons and TTL differ | Reason-specific bounded retarget proof | 掛機自動找怪 | YES |
| H03 Same-map path | PARTIAL | H03 `Task::Route` | Native path and rAthena walk | Deviation/repath parity unproven | Bounded no-progress fixtures | 掛機地圖 | YES |
| H04 Cross-map route | PARTIAL | H04 `Task::MapRoute` | PA journey and canonical planner | Adoption and arrival-to-resume proof open | Preserve one planner; route/arrival tests | 切換掛機地圖 | YES |
| H05 No-target Fly search | PARTIAL | H05 `processAutoAttack` plus GI policy | `try_hunt_relocation` | Pinned `teleportAuto_search` is not no-target Fly; GI user policy controls it | Prove no-target trigger, legal Fly, rescan | 蒼蠅翅膀搜尋 | YES |
| H12 Fly item | PARTIAL | H12 `Task::Teleport` plus GI override | Native item 601 | Authoritative same-map move after accepted command unproven | Item/position/count observation | 蒼蠅翅膀搜尋 | YES |
| H13 Butterfly | PARTIAL | H13 `Task::MapRoute` plus GI override | Supply item 602 | Save Point arrival and unchanged count unproven | Item/arrival/count observation | 回城補給 | YES |
| H15 Farm-map return | PARTIAL | H15 `processLockMap` | Persisted farm target and PA return | Service interruption to same selected map unproven | Return-to-target fixture | 掛機地圖 | YES |
| H16 Route replan | PARTIAL | H16 `processReAddMissingPortals` | Canonical graph and PA retry | Missing-edge fallback parity unproven | Safe bounded replan/fail fixture | NONE | NO |
| C01 Attack mode | PARTIAL | C01 `getAttackAutoMode` | Farm profile payload | Only active mode 2 supported | Validate UI exposes only accepted mode | 戰鬥模式 | YES |
| C02 Normal attack | PARTIAL | C02 `Attack::main` | `issue_melee_attack` | Class and authoritative HIT evidence incomplete | Melee/ranged legal attack matrix | 普攻 | YES |
| C03 Ranged attack | PARTIAL | C03 `Attack::main` | Native `rhw.range` | Ranged profile intentionally rejected | Bow/gun ammo/range/LOS proof | 普攻 | YES |
| C04 Attack skills | PARTIAL | C04 `attackSkillSlot` | One Native `skillId` | Stored multiple slots stop at command payload | Ordered slots adapter and cast effect proof | 自動技能 | YES |
| C05 Skill fallback | PARTIAL | C05 `Attack::main` | Profile weapon guard | Source-only, no legal live hit/no-hit proof | Wait/retarget/explicit fallback fixture | 技能失敗處理 | YES |
| C06 Attack retry | PARTIAL | C06 `shouldGiveUp` | Blocked target and walk retry | Failure reasons/limits unclassified | Separate approach/cast/target retry tests | NONE | NO |
| C07 Lost target | PARTIAL | C07 `targetGone` | Target invalidation | Lost vs unreachable vs killed unproven | Typed reason and rescan proof | NONE | NO |
| C08 LOS/unreachable | PARTIAL | C08 `Attack::main` | rAthena range and native walk | LOS and wall cases untested | Bounded legal range/LOS fixtures | NONE | NO |
| C09 Ammo | PARTIAL | C09 `processAutoMakeArrow` | rAthena inventory/equipment | Enabled ranged/skill ammo shortage behavior unproven | Legal ammo failure and refill proof | 彈藥條件 | YES |
| C10 Equipment | PARTIAL | C10 `attackEquip_*` | Native equipment/skill legality | Enabled-skill equipment prerequisites unproven | Per-enabled-action legality fixture | 裝備條件 | YES |
| C13 Conditions | PARTIAL | C13 `checkSelfCondition` family | Config rows, Native action gates | Enabled-action predicate subset stops before command | Transport supported conditions; disable remainder | 技能條件 | YES |
| C19 Target priority | PARTIAL | C19 `processAutoAttack` | Native target scan | Aggressive/party/clean priority unproven | M1 target matrix without monster-picker UI | 掛機自動找怪 | YES |
| R01 HP threshold | PARTIAL | R01 `processSitAuto` | Native `handle_survival` | Native 30/60 and stack 70/80 differ from pinned 40/100 | Action-specific HP gate and accepted threshold | HP 回復門檻 | YES |
| R02 SP threshold | PARTIAL | R02 `processSitAuto` | Native default 0/0 | Production still has positive opt-in | Preserve opt-in; source/live parity proof | SP 回復門檻 | YES |
| R03 Sit/stand | PARTIAL | R03 `processSitAuto` | Native recovery sit | Safety, weight and queue gates incomplete | Port gates and safe stand/resume tests | 自動坐下 | YES |
| R04 Potion/item | PARTIAL | R04 `processAutoItemUse` | Native item allowlist | Stored per-row conditions stop before action | Condition-to-item adapter and HP/count proof | 自動喝水 | YES |
| R05 Recovery skill | PARTIAL | R05 `processAutoSkillUse` | Native skill allowlist | Stored self-skill row conditions stop before action | Enabled-row predicate/cast effect proof | 自我回復技能 | YES |
| R07 Loot | PARTIAL | R07 `processItemsTake` | Native loot and event | Authoritative inventory-add proof incomplete | Global AutoLoot to inventory and ledger test | 自動拾取 | YES |
| R08 Inventory | PARTIAL | R08 `processAutoItemUse` | rAthena inventory | Presence/capacity results not fully typed | Inventory delta and rejection matrix | NONE | NO |
| R09 Weight | PARTIAL | R09 `processSitAuto`, service | Native loot/supply weight checks | Action-specific thresholds differ | Separate sit/loot/supply weight gates | 重量條件 | YES |
| R10 Supply trigger | PARTIAL | R10 `processStartAutoStorageBuySell` | `handle_supply` | Low inventory to interruption/resume unproven | Per-item trigger and session fixture | 補給門檻 | YES |
| R11 Shop buy | PARTIAL | R11 `processAutoBuy` | Native shop service | Zeny/price/batch failure and delta unproven | Bounded buy and failure matrix | 補給品 | YES |
| R14 Supply return | PARTIAL | R14 `processAutoBuy` continuation | PA supply return | Map arrival alone lacks renewed combat proof | Return-to-HIT/KILL/LOOT fixture | 回城補給 | YES |
| R15 Retry/timeout | PARTIAL | R15 `Task::Route`, `Task::Teleport` | Native action timers | Per-action retry ceilings unproven | Deterministic no-progress limit tests | NONE | NO |
| R16 Stuck | PARTIAL | R16 `Task::Route` | Native blocked-target and nav fail | Legal fallback and terminal state unproven | No rapid identical retry; safe terminal | NONE | NO |
| R18 Resume | PARTIAL | R18 `Task::Route` lifecycle | Persisted PA target rules | Profile after supply/death/nav resume unproven live | Same-session interruption matrix | 自動恢復掛機 | YES |
| R19 Quarantine | PARTIAL | R19 GI safety override | Native quarantine | Safe failure terminal not covered in core flow | Assert no unsafe loop and explicit blocker | NONE | NO |
| R20 State projection | PARTIAL | R20 GI server authority override | Native live export and Dashboard | Source-to-Production freshness unproven | State revision and actual-mode tests | 狀態顯示 | YES |
| R21 Factual events | PARTIAL | R21 GI ledger override | Native Event Ledger | `ATTACK` cannot prove `HIT` | Authoritative HIT/KILL/LOOT observation | 戰鬥紀錄 | YES |

## Source and Production boundary

### Settings UI source gate

The existing `/api/config` read/save response currently reports
`execution.applied=false` and `CONFIG_ONLY_NO_EXECUTOR_COMMAND` for its
configuration contract. The existing editor had 46 schema controls, most
interactive despite that execution result. The M1 source candidate now groups
them into nine Player settings sections and derives control enablement from a
single `config-capabilities.mjs` adapter. `SUPPORTED` requires both an explicit
per-path capability attestation and `execution.applied=true`; otherwise the
control is `PARTIAL`, or `UNAVAILABLE` for first-release-excluded party/follow
settings. Three fixed-policy displays remain read-only. The current response
thus enables zero of 43 adjustable schema controls, and
the save action is disabled. This removes the enabled-but-no-op UI behavior
without claiming any runtime acceptance. OpenKore field evidence remains in
the parent census, especially C01/C04/C13 and R01-R05; the UI delta reuse gate
is `m1-settings-ui-reuse-gate.json`. Browser desktop and 390×844 acceptance
remains unmeasured.

### HP potion source seam

`m1-hp-potion-source-gate.md` records the pinned OpenKore default, row order,
HP `< N%` condition, 0.5-second global item-use interval, row timeout and
absent-item fallthrough. The persisted character rows now add an optional
`hpPotionRules` field to the existing `start_farm` command. Native validates
the bounded rows, attempts the first present matching item in the existing PA
survival tick and delegates legality/effect to rAthena `pc_useitem`. Unsupported
configured predicates and item names fail with typed source errors. Current
UI remains disabled; Native build and command-shape tests are source-only.
The exact `R04` runtime HP/inventory delta, overlap with global HP recovery,
resume and Browser proof remain open, so `AUTO_POTION=PARTIAL`.

The requested sequence is source implementation and bounded tests, then a
coherent candidate. No Production file, runtime restart or live-player mutation
is authorized here. A source `PASS` does not turn any row into a released UI
control. Existing interactive controls require separate current runtime and
Browser evidence; unsupported controls must be disabled during the settings UI
phase. Life Director and Social Director remain outside this scope.

## Bounded diagnostic checkpoint

The scenario matrix previously called `planWebRelocation`, which checks only
physical direct edges. The player map-change endpoint calls the canonical
weighted `planFarmMapChange`. From `moc_pryd01`, the old dry-run said
`NO_DIRECT_ROUTE` for both `mjolnir_07` and `pay_fild04`, while the full
planner produced a Kafra multimodal candidate for each. The scenario now
calls the same planner as the endpoint. Matrix output marks that inventory and
SavePoint were not evaluated; it is a route-plan check, not proof of player
resources, command acceptance, arrival or resumed combat. `H04/H16` remain
`PARTIAL` until those transitions pass.
