# Runtime state policy parity audit

```text
TASK_ID = OPENKORE_RUNTIME_STATE_POLICY_PARITY_AUDIT_AND_CLOSURE_V1
STATUS = IN_PROGRESS / SOURCE_ONLY
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
OPENKORE_RUNTIME_REQUIRED = NO
RATHENA_WORLD_AUTHORITY = YES
```

This is a source-evidence inventory, not a parity certificate. Project Control
authorized the bounded thin profile-to-executor contract after the original
`PC_STOP_4`. Source checkpoint `8000bbc` adds Native command fields and a
fail-closed attack-method guard; Web source now resolves those fields from the
authenticated character config. This does not complete ranged, multi-slot,
self-buff, support, follow, recovery, navigation or teleport policy parity.
The 135 condition keys are classified; action-level semantic port and proof
remain open.
No live parity claim or Native activation follows from these source changes.

## Proven default and first broken transition

Pinned OpenKore `control/config.txt:290-296` sets `sitAuto_hp_lower=40`,
`sitAuto_hp_upper=100`, `sitAuto_sp_lower=0`, `sitAuto_sp_upper=0`,
`sitAuto_over_50=0`, and `sitAuto_idle=1`. `src/AI/CoreLogic.pm:2909-2962`
queues sit only when HP or SP is below its configured lower threshold and
also checks action, basic skill, weight, nearby aggression, attack queue, and
the forced-stop flag. Sit begins only when no aggressive actor is detected;
stand requires both configured upper thresholds, with a safety delay when
standing is unsafe. Thus default HP-triggered sit is enabled, while default
SP-triggered sit is disabled. The default is configurable; it is not a blanket
ban on SP recovery.

Pinned OpenKore `src/Misc.pm:5660-5674` checks skill ownership, learned level,
and SP cost for that skill action. `src/AI/Attack.pm:725-754` starts with
`attackUseWeapon` and selects an `attackSkillSlot` only when its conditions
match. `control/config.txt:70,89` defaults to `attackAuto=2` and
`attackUseWeapon=1`. A skill becoming unavailable therefore does not alone
remove the default weapon attack or unrelated navigation.

Current Ghost Island source `src/map/persistent_agent.cpp:2812-2828` promoted
SP at or below 20% into global recovery, stopping attack and walking. The
navigation tick checked the route's wall-clock timeout before calling this
global recovery at `:8094-8107`. Production evidence in the task reports
SP 6/216, recovery sit, then `ROUTE_TIMEOUT`. The first broken transition is
`action-level SP availability -> global intent interruption`; the timeout is
the subsequent observable failure. Source correction makes 0 an accepted
opt-out for global SP recovery, including after respawn. The canonical source
stack config sets SP threshold/safe to 0. Positive configured thresholds retain
opt-in recovery. Production config and Native binary remain unchanged until a
separate authorized deployment passes all relevant gates.

## Policy comparison at the inspected seams

`Override` is YES only for a documented Ghost Island product rule. `OPEN`
means the exact behavior still lacks full implementation and proof.

| State/decision | OpenKore default | Configurable | Pinned behavior | Current Ghost Island behavior | Override | Parity | Required change |
|---|---|---|---|---|---|---|---|
| HP sit | lower 40, upper 100 | YES | Sit on low HP subject to action/weight/safety; stand at upper | Source default 30/60, stack 70/80; global recovery | NO recorded | PARTIAL_PARITY | Decide and implement HP/action-specific policy with tests |
| SP sit | lower 0, upper 0 | YES | Disabled by default; independent skill SP checks | Source/stack corrected to 0; Production remains 20/40 | NO | PARTIAL_PARITY | Deploy and prove low-SP journey plus opt-in cases |
| Sit gate | Basic skill, no aggression, weight below 50 by default | YES | Queue only on allowed idle/route/follow actions; forced stop and safe stand | Native recovery sits without equivalent action/weight/aggression gate | NO | PARTIAL_PARITY | Policy adaptation within PA interruption semantics |
| Recovery item | No configured `useSelf_item` row | YES | Per-row condition, possession and timeout | Global allowlist and HP/SP threshold | NO | PARTIAL_PARITY | Transport item rows to executor; retain rAthena item authority |
| Recovery skill | No configured `useSelf_skill` row | YES | Per-row condition, learned skill and SP check | Global recovery skill allowlist | NO | PARTIAL_PARITY | Transport self-skill rows to executor |
| Critical HP teleport | `teleportAuto_hp=10` | YES | Separate emergency trigger in `processAutoTeleport` | Web config preview has 10%; no proven execution bridge | NO | MISSING | Typed emergency policy/command and bounded proof |
| Skill insufficient SP | No attack skill slot by default | YES | Skip unavailable slot, retain configured weapon method | Source thin contract guards skill-only melee, Native binary unchanged | NO | PARTIAL_PARITY | Live no-melee proof; complete per-slot conditions |
| Skill learned/cooldown/cast | Server state observed per skill | YES | Candidate conditions and action timing | Native learned/SP/cooldown/castbegin checks for one skill | NO | PARTIAL_PARITY | Extend profile contract; retain rAthena legality |
| Skill range/target | Configured per slot | YES | Chase, retry, give-up under attack policy | Native range walk and target validity checks | NO | PARTIAL_PARITY | Compare bounded retry and profile behavior |
| Death/respawn | Recovery/return policies configurable | YES | Stop dead actions; resume through configured route | Native death, respawn and return path exist | NO | PARTIAL_PARITY | Full same-fixture live death-to-hit proof |
| Weight/inventory/ammo | Per-action conditions | YES | Sit/loot/supply/skill gates are separate | Native inventory/weight authority exists; no complete per-profile policy | NO | PARTIAL_PARITY | Per-action mapping and regression matrix |
| Status effects | `whenStatusActive/Inactive` optional | YES | Evaluates named status per configured action; no universal status list | rAthena owns legality; profile condition rows have no executor bridge | NO | MISSING | Condition transport and status-specific action tests |
| Follow/support | Disabled by default | YES | Actor/party predicates constrain individual actions | Web profile config only; no full Native support executor | NO | MISSING | New accepted executor contract and capability gate |
| Target/position | Attack and route policy | YES | Target/LOS/distance and retarget decisions | Native authoritative target/range checks; route retry exists | NO | PARTIAL_PARITY | Exhaustive decision-site and failure-semantic audit |

The project's permanent Fly/Butterfly Wing rule is an explicit product
override for item consumption. It does not justify any HP/SP/sit deviation.

## Predicate parser inventory boundary

Pinned `src/Misc.pm:5487-6270` exposes 96 self, 23 player, and 16 monster
predicate keys, 135 domain-prefixed keys in total. This count covers these
three condition evaluators only. It does not cover every separate CoreLogic,
Attack, route, supply, death, or teleport decision. The exact keys are:

```text
self (96): aggressives, amuletType, ap, cartActive, defendMonsters, devotees,
disabled, equip_leftAccessory, equip_leftHand, equip_lowHead, equip_midHead,
equip_rightAccessory, equip_rightHand, equip_robe, equip_topHead, homunculus,
homunculus_dead, homunculus_hp, homunculus_noinfo_dead,
homunculus_noinfo_resting, homunculus_notOnAction, homunculus_onAction,
homunculus_resting, homunculus_sp, homunculus_whenIdle,
homunculus_whenNotIdle, hp, inCart, inCartID, inInventory, inInventoryID,
inLockOnly, inMap, inParty, inQueue, inTown, lvl, manualAI, maxBase,
mercenary, mercenary_hp, mercenary_notOnAction, mercenary_onAction,
mercenary_sp, mercenary_whenIdle, mercenary_whenNotIdle,
mercenary_whenStatusActive, mercenary_whenStatusInactive, minBase, monsters,
monstersCount, monstersCountDist, nearPortal, notInMap, notInParty,
notInQueue, notInTown, notMonsters, notOnAction, notWhileBeingCasted,
notWhileCasting, notWhileSitting, onAction, onlyWhenSafe, partyAggressives,
skill, sp, spirit, stopWhenHit, timeout, weight, whenEquip_Left_Hand_Empty,
whenEquip_Left_Hand_Type, whenEquip_Right_Hand_Empty,
whenEquip_Right_Hand_Type, whenEquipped, whenFlag, whenFollowing,
whenGround, whenIdle, whenNearPartyMemberCasting,
whenNoNearPartyMemberCasting, whenNotEquipped, whenNotFlag, whenNotGround,
whenNotIdle, whenNotPermitSkill, whenPartyMembersNear,
whenPartyMembersNearDist, whenPermitSkill, whenStatusActive,
whenStatusInactive, whenWater, whileBeingCasted, whileCasting, zeny
player (23): aggressives, dead, defendMonsters, deltaHp, dist, hp, isGuild,
isJob, isNotGuild, isNotJob, isNotMyDevotee, monsters,
notWhileBeingCasted, notWhileSitting, spirit, timeout, whenGround,
whenNotGround, whenShieldEquipped, whenStatusActive, whenStatusInactive,
whenWeaponEquipped, whileBeingCasted
monster (16): deltaHp, dist, hp, is_aggressive, is_aggressive_party, misses,
notWhileBeingCasted, timeout, totalMisses, whenGround, whenNotGround,
whenShieldEquipped, whenStatusActive, whenStatusInactive,
whenWeaponEquipped, whileBeingCasted
```

All 135 keys now have a capability-stage classification and exact pinned
predicate location in `condition-key-census-v1.md`:
`OPENKORE_STATE_PREDICATES_CLASSIFIED = 135/135`, `UNCLASSIFIED = 0`.
This is classification only. The 76 `PARTIAL` keys still lack complete
per-action GI port/proof, and the 38 later-stage keys are not implemented.
Homunculus and mercenary predicates are explicitly outside current M1 player
hunting; AP and class-specific resource predicates remain later-stage work.

## Current decision sites inspected

Native `persistent_agent.cpp`: `configured_percent`, `load_config`,
`parse_farm_payload`, `try_recovery_item`, `try_recovery_skill`,
`supply_replenishment_required`, `handle_survival`, `finish_recovery`,
`handle_death`, `persistent_agent_navigation_tick`,
`persistent_agent_farm_tick`, `persistent_agent_quest_tick`,
`issue_melee_attack`, the farm skill fallback branch, target filtering,
and loot capacity check. These are 16 inspected sites, not an exhaustive
repository-wide decision-site count. The total is unmeasured and must not be
reported as `UNKNOWN_GI_STATE_DECISION_SITE = 0`.

Web `ops/ro-stack/dashboard/config-schema.mjs` defines the eight profiles;
`docs/openkore-reference/config-ui-replacement-v1.md:82-94` recorded the
pre-contract `CONFIG_ONLY_NO_EXECUTOR_COMMAND` state. Source now adds the
thin profile fields to `start_farm`; Native still accepts one optional
`skillId`, and wider profile capability remains absent.

## Intent-blocking rule and next gate

An SP shortage for one skill blocks that skill. Navigation, NPC interaction,
normal attack when enabled, and unrelated parent intents require their own
authoritative legality checks. A positive global SP recovery threshold is an
explicit opt-in that can pause an intent; threshold 0 disables that pause.
The current Native correction proves this seam in source and a policy unit
test only. It does not prove the full action-by-state matrix or Production.

The thin contract's `PC_STOP_4` authorization was supplied. Closure now
requires per-action closure of 76 partially mapped parser predicates, non-parser
decision-site inventory, deterministic family/profile tests, all currently
authorized mature capability gaps closed, and controlled live acceptance.
Keep OpenKore runtime at zero throughout. The broader census and remaining
classified gaps are tracked in `mature-capability-census-v1.md`.
