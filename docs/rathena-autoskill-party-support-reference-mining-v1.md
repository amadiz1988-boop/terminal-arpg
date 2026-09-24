# rAthena AutoSkill and Party Support Reference Mining V1

```text
TASK_ID = RATHENA_AUTOSKILL_AND_PARTY_SUPPORT_REFERENCE_MINING_V1
RESEARCH_DATE = 2026-09-21
CANONICAL_NATIVE_SOURCE = C:\Users\Administrator\source\ghost-island-rathena
NATIVE_BRANCH = integration/p2-openkore-exit-native-v1
NATIVE_HEAD = 7e6f0f527ba122394260562a063e76a1011b3a14
RATHENA_ATLAS_BASELINE = e985006171d2eb320ee512a653f4c83aea3d81b6
OPENKORE_ATLAS_BASELINE = 51de1ddfc4449ae5217f6886de702f87ca934030
REFERENCE_IS_FLOOR_NOT_CEILING = YES
AUTOSKILL_REFERENCE_FIRST = YES
IMPLEMENTATION_AUTHORIZED = NO
RUNTIME_RESTARTED = NO
OPENKORE_RUNTIME_ENABLED = NO
CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS
```

## 1. Executive finding

The current rAthena source already supplies the authoritative primitives needed
for AutoSkill and support execution. The relevant seam is `skill.cpp` and
`skill.hpp` for skill classification, range, SP, cast and delay values,
condition checks and cast-end dispatch; `battle.cpp` for target legality and
range; `status.cpp` for status restrictions; `status_change_start/end` for
effect lifecycle; `party.cpp` for party membership and same-map enumeration;
and `pc.cpp` for bounded follow and respawn.

The mature reference floor is therefore:

```text
PA intent / profile / interruption / resume
  -> bounded local executor lease
  -> rAthena skill legality, cast, status, damage, heal and position authority
  -> authoritative effect result
```

Public community work demonstrates practical AutoSkill and Party Support
policies. Shakto's 2024 Autosupport showcase advertises HP-triggered self,
leader, member and whole-party healing, configurable skill levels, following,
automatic resurrection and cross-map follow claims. Dantoki's 2025 release
advertises healing, status recovery, party buffs, bard song switching,
master-following, resurrection and an explicit support priority order. The
newer AutoSupport UI post claims server-side validation and execution, strict
master-target assistance, same-map checks for assist casts and no independent
monster selection, but its repository is private and its license is not
published. These are attributed behavior claims, not current build or live
acceptance proof.

OpenKore provides mature client-side policy shapes: `Task::UseSkill` has
preparation, cast-start wait, cast-finish wait, target-loss and bounded retry
states; `partySkill` configuration expresses HP, SP, status, timeout and target
conditions; `AI::partyfollow` recalculates the party leader position and pauses
around storage, buy and sell tasks. These behaviors are useful semantic
references. OpenKore remains runtime count zero and cannot become the Project
server authority.

The implementation boundary is explicit:

```text
STAGE_3A = local offensive skill executor under PA combat lease
STAGE_3B = local self-support executor under PA combat lease
STAGE_3C = local same-map party-support executor under PA combat lease
CROSS_MAP_FOLLOW = PA
SUPPLY / SERVICE / RETURN / QUEST / SOCIAL / LIFE = PA
SKILL LEGALITY / CAST / RANGE / COOLDOWN / EFFECT / HP-SP / STATUS = rAthena
```

No Stage 3 gameplay source is changed by this document.

## 2. Mature reference inventory

| Reference | Repository / URL | Version / commit | License | Behavior observed | Useful symbols / files | Direct code reuse |
| --- | --- | --- | --- | --- | --- | --- |
| rAthena upstream | [rAthena repository](https://github.com/rathena/rathena/tree/e985006171d2eb320ee512a653f4c83aea3d81b6) | Atlas baseline `e985006171d2eb320ee512a653f4c83aea3d81b6`; local source checked at `7e6f0f527ba122394260562a063e76a1011b3a14` | GPL-3.0 | Server authority for skill legality, cast type, range, SP, delay, status effect, party area and follow primitives | `src/map/skill.cpp`, `src/map/skill.hpp`, `src/map/battle.cpp`, `src/map/status.cpp`, `src/map/party.cpp`, `src/map/pc.cpp`, `src/map/skills/other/*` | YES, only with GPL-3.0 compliance; adapt through Project contract |
| rAthena skill database and status docs | [skill.hpp](https://github.com/rathena/rathena/blob/master/src/map/skill.hpp), [status.txt](https://github.com/rathena/rathena/blob/master/doc/status.txt) | upstream `master`; exact Project baseline remains above | GPL-3.0 project source, documentation follows repository terms | Cast type, skill level arrays, SP, range, cast, delay, upkeep and status duration are data-backed | `skill_get_casttype`, `skill_get_range`, `skill_get_sp`, `skill_get_cast`, `skill_get_delay`, `skill_get_time`, `status_change_start/end` | YES for source reuse subject to license; behavior reuse is preferred |
| Shakto Autosupport System Extended | [rAthena showcase](https://rathena.org/board/topic/143053-showcase-autosupport-system-extended/) | Posted 2024-09-21; no public commit | UNKNOWN | HP-based heal, selectable skill level and target, party buff, follow distance, same-map or cross-map teleport claim, resurrection and death response | Forum feature description; source not attached in the public post | NO, license unknown |
| Dantoki Auto support system Latest RA | [rAthena showcase](https://rathena.org/board/topic/147542-auto-support-system-latest-ra/) | Version `20250820`; no public repository or commit | UNKNOWN | Smart path to master, priority heal versus buffs, Recovery, status removal, party selection, Lex assist, songs, resurrection and same-map support range | Forum source excerpt; no repository license published | NO, license unknown |
| AutoSupport UI | [rAthena showcase](https://rathena.org/board/topic/149634-showcase-autosupport-ui-qjs-only/) | Posted 2026; server source repository stated private | UNKNOWN | Server-side validation and execution, selected-party-master follow, strict master-target assist, HP/SP thresholds, buff/heal/recovery priority, same-map target check, SQL settings | Public feature description only; private repository cannot be audited | NO, license and source unavailable |
| OpenKore skill task | [Task::UseSkill](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/UseSkill.pm) | Locked baseline `51de1ddfc4449ae5217f6886de702f87ca934030` | GPL-2.0 per source header | Preparation, target-loss detection, explicit or maximum level, cast-start and cast-finish waits, bounded retry and cancellation handling | `Task::UseSkill`, `Skill.pm`, `Task::WithSubtask` | YES under GPL-2.0 compatibility review; Project should adapt behavior, not copy client authority |
| OpenKore AI and follow | [AI::CoreLogic](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI/CoreLogic.pm), [AI.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm) | Locked baseline `51de1ddfc4449ae5217f6886de702f87ca934030` | GPL-2.0 per source header | Ordered AI phases, `processAutoSkillUse`, `processPartyAuto`, follow recalculation, task suppression during storage/buy/sell and map-aware leader position | `processFollow`, `ai_partyfollow`, `processAutoSkillUse`, `processPartyAuto` | YES under GPL-2.0 compatibility review; use as behavior reference only |
| OpenKore support configuration | [configuration wiki](https://openkore.com/index.php?pageuntil=attackAuto+notWhile+buyAuto&title=Category%3Aconfig.txt), [partySkill issue evidence](https://github.com/OpenKore/openkore/issues/1314) | Wiki and issue are versioned historical references; no single commit for the wiki | Wiki terms and source license require separate review | `partySkill`, `useSelf_skill`, HP/SP conditions, inactive-status checks, target timeout and skill timeout | `target_hp`, `target_whenStatusInactive`, `target_timeout`, `sp`, `timeout` | NO direct config copy; adapt semantics and keep server authority |

The community references have no independently verified current build in this
pass. `NO_PUBLIC_EVIDENCE` in the matrix below means that the surveyed public
material did not establish the capability. It does not assert that a private
implementation cannot exist.

## 3. Capability-by-capability matrix

| Capability | RATHENA_REFERENCE | OPENKORE_REFERENCE | COMMON_SEMANTICS | CURRENT_PROJECT_REUSABLE_CAPABILITY | RECOMMENDED_OWNER | DIRECT_CODE_REUSE_ALLOWED | IMPLEMENTATION_GAP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SKILL_ONLY | `skill_get_casttype` selects damage, ground or no-damage cast; cast-end functions dispatch the selected skill | `Task::UseSkill` owns a single skill task and waits for cast/effect | A profile can issue skills without normal attack | `SKILL_CAST` profile exists; `NORMAL_ATTACK_CAN_BE_DISABLED = YES` is accepted design | PA selects profile and lease; local executor casts; rAthena validates | YES for rAthena GPL-3.0 source with compliance; OpenKore GPL-2.0 source requires compatibility review | No generic Project skill lease or effect event |
| NORMAL_ATTACK_DISABLED | rAthena skill primitives do not choose Project profile policy | OpenKore attack and skill loops are separate configuration paths | Skill-only mode must not silently fall back to normal attack | Architecture explicitly requires normal attack off support | PA profile policy plus local executor admission | Behavior reuse only | Stage 3A gate not implemented |
| target skill | `skill_castend_damage_id` / `skill_castend_nodamage_id` plus `battle_check_target` | `Task::UseSkill` accepts actor target and actor list; `targetLost` rejects stale target | Target identity, legality, range and effect are separate checks | Stage 2 target lock and rAthena target authority are reusable | Local executor requests; rAthena decides legality | Source reuse allowed only under license | No typed skill target result and no generic skill target lock |
| ground-target skill | `CAST_GROUND`, `skill_castend_pos2`, `skill_pos_maxcount_check`, range check | `Task::UseSkill` accepts `{x,y}` location target | Ground position requires map, range and cell validation | Navigation and map position authority already exist | Local executor uses rAthena cell/range checks; PA owns intent | Behavior reuse | No ground-skill planner or result proof |
| skill level selection | Skill DB arrays, `skill_get_max`, `pc_checkskill` and cast requirement checks | Explicit level or maximum learned level in `Task::UseSkill` | Level must be legal, learned and policy-selected | Class-aware profile and skill capability direction are reusable | PA tactical option selects allowed level; rAthena verifies learned level | Behavior reuse | No Project level policy or class capability resolver |
| SP gating / SP fallback | `skill_get_sp`, `skill_get_sp_rate`, `skill_check_condition_castbegin`, `status_charge` | `sp >` conditions and timeout-based retry; configuration can select fallback | Resource gate precedes cast; fallback is policy, not fake success | Authoritative HP/SP state and Supply interruption exist | PA owns reserve/fallback policy; rAthena owns cost; local executor acts | Behavior reuse | No typed SP failure or fallback contract |
| skill range | `skill_get_range2`, `battle_check_range`, skill unit range | Skill range and movement task precede cast | Position and range are re-read before cast | Same-map path and arrival evidence are reusable | Local executor plus rAthena | Source reuse allowed with license | No generic skill approach state |
| cooldown | `skill_get_delay`, `skill_delayfix`, `scd`, `canact_tick`, `clif_skill_cooldown` | Skill timeout and packet/effect wait | Cooldown blocks duplicate cast and controls retry | Command dedupe/revision pattern is reusable at a different layer | rAthena owns cooldown; local executor observes; PA owns interruption | Behavior reuse | No skill cooldown projection in PA Event Ledger |
| cast time / interruption | Cast timers, `skill_castend_id/pos`, `skill_blockpc_start`, status cast blocks | `WAITING_FOR_CAST_TO_START`, `WAITING_FOR_CAST_TO_FINISH`, cancellation errors | Cast start, finish, interruption and effect are separate states | Native timer and stop contracts exist for normal attack | rAthena owns cast authority; executor relays; PA may stop lease | Behavior reuse | No generic cast state or interruption event |
| target legality | `battle_check_target` returns valid, enemy/friend/party state; `status_check_skilluse` applies visibility and status restrictions | Actor list and client-visible actor state; known issue shows party target selection can fail | Legality must be server authoritative and rechecked immediately before cast | rAthena remains world authority; target claim is only collision protection | rAthena | Do not copy client legality | Skill-specific legality projection is absent |
| buff refresh | `status_change_start/end`, skill duration and status DB determine effect lifecycle | `target_whenStatusInactive`, `target_timeout` and `partySkill` conditions | Refresh only when status absent/expired and target is legal | Status read model and Event Ledger can observe authoritative state | Local executor schedules; PA controls support profile | Behavior reuse | No generic status-aware scheduler |
| self heal | `skill_calc_heal`, `status_heal`, `clif_skill_nodamage` | `useSelf_skill` and HP/SP thresholds | Self HP observation, resource gate, cast and HP result | HP/SP authoritative read exists | Local executor; PA chooses emergency policy | Behavior reuse | No self-support executor |
| self buff | Self-target no-damage cast and `status_change_start` | `useSelf_skill` and inactive-status conditions | Self buff uses same status lifecycle as party buff | Profile catalog includes `HEAL_SUPPORT` and `COMBAT_SUPPORT` | Local executor under PA support policy | Behavior reuse | No self-buff policy or effect event |
| party HP monitoring | `party_foreachsamemap`, party data and target flags provide same-map candidate enumeration | `partySkill` target HP conditions and party actor state | Monitor online, same-map, party membership, HP and range | Party membership is rAthena authority; no Project scheduler yet | Local executor reads; PA chooses profile and interruption | Behavior reuse | No Project party HP read model or priority scheduler |
| party heal | Heal calculation is authoritative; party skills can enumerate same-map party targets | `partySkill Heal` with `target_hp`, `sp`, `timeout` | Heal selected legal party target and confirm HP/effect | No party-heal implementation is proven | Local executor; PA owns support intent | Behavior reuse | Stage 3C heal path absent |
| party buff | `party_foreachsamemap` with `BCT_PARTY`; party skill implementations call status effect | `partySkill Blessing/Increase AGI`, inactive-status and target timeout | Buff only legal party members and refresh by status | No party-buff implementation is proven | Local executor; PA owns support profile | Behavior reuse | Stage 3C buff path absent |
| status recovery / cleanse | `SkillStatusRecovery` and `status_change_end` remove defined ailments; immunity is checked | `partySkill Recovery` style behavior and target timeout | Cleanse is a targeted status transition with legality and result | No cleanse implementation is proven | Local executor; rAthena status authority | Behavior reuse | Status result event and priority absent |
| support target priority | rAthena supplies target enumeration and legality, not a complete generic scheduler | OpenKore queue order, target timeout and conditions; community scripts advertise heal > recovery > buff > assist | One bounded action per tick with deterministic priority | Architecture lists self survival, critical party HP, status recovery, critical buff, follow, offense | PA profile policy owns priority; executor executes one action | Do not copy constants | No Project deterministic support scheduler |
| same-map follow | `pc_follow_timer` checks target, death, reachability and distance; `pc_follow` starts timer | `ai_partyfollow` recalculates leader position and route, suppressing service tasks | Follow is bounded movement toward a live target | Architecture permits same-map Local Executor follow | Local executor under PA lease | Behavior reuse | Current Local Executor has no support-follow lease |
| support positioning | `unit_can_reach_bl`, `unit_walktobl`, skill range and map cell checks | `followDistanceMax`, route and movement task | Position for support must satisfy range, path and same-map invariant | Same-map path/arrival contracts are reusable | Local executor; rAthena path/range authority | Behavior reuse | No support positioning state |
| resume follow after combat | `pc_follow_timer` only maintains follow timer; it does not own PA parent resume | CoreLogic resumes queued AI phases after combat/task completion | Resume needs parent intent, target re-read and bounded lease renewal | PA owns interruption and resume contract | PA | Do not move resume authority into rAthena | No support resume integration |
| death / revive support | `pc_respawn`, savepoint position, `clif_party_dead` and resurrection skill effects are authoritative | `processDead`, respawn task and support resurrection policies | Death, revive, map arrival and resume are separate checkpoints | PA recovery policy and native death/reconnect evidence exist | PA chooses policy; rAthena performs legal revive/respawn | Behavior reuse | No support-specific death/revive lease |
| pure-skill combat | Damage/no-damage/ground dispatch supports a skill-only loop | `attackSkillSlot` and `Task::UseSkill` provide skill attack policy | No normal attack is emitted when profile disables it | `SKILL_CAST` is canonical profile direction | PA profile policy plus local executor | Behavior reuse | Stage 3A not implemented |
| hybrid skill + normal attack | rAthena can dispatch skill casts and normal `unit_attack`; authority remains server-side | OpenKore attack loop and skill slots coordinate through AI/task queue | Explicit fallback and cooldown rules prevent duplicate or silent mode changes | `HYBRID_DAMAGE` profile is accepted design | PA chooses mode; local executor owns bounded action cadence | Behavior reuse | Normal attack class parity and hybrid gate remain open |

## 4. rAthena versus OpenKore semantic comparison

| Concern | rAthena | OpenKore | Project decision |
| --- | --- | --- | --- |
| Authority | Server validates target, skill, range, status, resource, cooldown and effect | Client bot chooses actions from observed packets and config | Keep rAthena authority; PA owns intent and interruption |
| Skill target | `battle_check_target` and skill checks are authoritative | Actor list and target timeout are client observations | Reuse target-loss shape, require server revalidation |
| Ground cast | `CAST_GROUND`, cell and range checks, cast-end position | Coordinate target hash and route/move tasks | Local executor may issue position intent; rAthena validates |
| Level | Skill DB and learned skill checks | Explicit configured level or maximum learned level | PA tactical option plus server learned-level check |
| SP | Server computes cost and rejects insufficient resource | `sp >` configuration and timeout | PA may choose reserve; rAthena rejects cost violation |
| Cast | Timer and status interruption in map-server | Task state waits and cancellation errors | Preserve state shape, use server result |
| Buff | Status DB and `status_change_start/end` | Inactive-status and target-timeout config | Event-confirmed status refresh |
| Party | Same-map party enumeration and BCT flags | Party actor cache, target conditions and follow target | Same-map support local; cross-map journey PA |
| Follow | `pc_follow` is a primitive, including a cross-map teleport branch | `ai_partyfollow` has map-aware route and task suppression | Local executor must reject map exit; PA owns cross-map follow |
| Death | `pc_respawn` and savepoint map position | Dead/respawn task and resume queue | PA policy, rAthena result |
| Failure | Server failure cause and no effect are authoritative | Timeout, packet error or stale actor can be ambiguous | Add typed Project result events without replacing authority |

The OpenKore issue where `partySkill` healed or buffed the support character
instead of the intended master is a useful negative reference. It proves that
support target identity needs a re-read and a final target check; it does not
prove a server-side rAthena defect.

## 5. Stage 3A recommended reusable floor

Stage 3A should begin with one bounded `combatSessionId` and `executionEpoch`.
The local executor must accept only an active PA lease and must reject stale,
revoked, map-changed or interrupted epochs.

```text
IDLE
  -> PROFILE_ADMITTED
  -> SKILL_SELECTED
  -> TARGET_OR_GROUND_VALIDATED
  -> RANGE_VALIDATED
  -> SP_AND_COOLDOWN_VALIDATED
  -> CASTING
  -> EFFECT_CONFIRMED / CAST_INTERRUPTED / CAST_REJECTED
  -> COOLDOWN
  -> NEXT_ACTION or PA_INTERRUPT
```

Required Stage 3A floor:

1. `SKILL_ONLY` with `NORMAL_ATTACK_DISABLED` as an explicit mode.
2. Target skill and ground skill as separate dispatch paths.
3. Learned skill-level selection with explicit profile option and server check.
4. SP reserve and fallback policy supplied by PA. Insufficient SP must produce a
   typed rejection or explicit wait. It must not silently issue normal attack.
5. Skill range, cell legality, cooldown, cast time and interruption checks.
6. Final target and map re-read immediately before cast.
7. One action per decision tick, bounded retry and no duplicate cast while a
   cast or cooldown is active.
8. Effect confirmation from rAthena status, HP, damage, ground unit or other
   authoritative result. A cast request alone is not success.

Recommended observables are:

```text
SKILL_SELECTED
SKILL_CAST_STARTED
SKILL_CAST_REJECTED
SKILL_CAST_INTERRUPTED
SKILL_EFFECT_CONFIRMED
SKILL_NO_EFFECT
SKILL_COOLDOWN
SKILL_TARGET_LOST
SKILL_SP_INSUFFICIENT
```

The Stage 3A executor must not own farm target, cross-map navigation, Supply,
return-to-farm, Quest, Social, Life or resume decisions.

## 6. Stage 3B recommended reusable floor

Stage 3B is a self-support lease, not a second autonomous agent. It may own
action cadence for self heal, self buff, buff refresh and status-aware cleanup
after PA admits the profile.

```text
SELF_SUPPORT_IDLE
  -> SELF_EMERGENCY_CHECK
  -> SELF_HEAL or SELF_STATUS_RECOVERY
  -> SELF_BUFF_REFRESH
  -> EFFECT_CONFIRMATION
  -> COOLDOWN / WAIT
  -> PA_INTERRUPT or LOCAL_COMBAT_RESUME
```

The order is deterministic:

```text
critical self survival
-> self status recovery
-> self heal
-> critical self buff refresh
-> normal self buff maintenance
-> approved offensive assist
```

The executor reads authoritative HP, SP and status state, checks learned skill,
range, cooldown and SP, then emits one action. PA keeps policy values such as
emergency threshold, reserve threshold, Supply trigger and interruption reason.
Stage 3B must emit `SUPPLY_LOW` when the parent contract requires Supply. It must
not walk to a shop, open storage, buy items or return to a farm map.

## 7. Stage 3C recommended reusable floor

Stage 3C is a same-map party-support executor. It may observe online party
members, choose one legal support action, reposition within support range and
resume support after a bounded combat action. Party membership, status, HP/SP,
skill legality, target legality and effect remain authoritative server state.

```text
PARTY_SUPPORT_IDLE
  -> PARTY_SNAPSHOT
  -> SUPPORT_TARGET_PRIORITY
  -> SUPPORT_POSITION
  -> HEAL / BUFF / RECOVERY / MASTER_TARGET_ASSIST
  -> EFFECT_CONFIRMATION
  -> COOLDOWN / NEXT_MEMBER
  -> PA_INTERRUPT / MAP_EXIT / DEATH
```

Recommended support priority:

```text
0 critical self survival
1 critical party HP
2 party status recovery / cleanse
3 critical party buff refresh
4 low party HP
5 normal party buff maintenance
6 follow or support reposition
7 optional assist against the selected master's current target
```

The list comes from the architecture contract and the public priority claims.
It is a policy floor, not a fixed gameplay constant. Tie-breakers must be
deterministic: same-map legal target, highest urgency, shortest status expiry,
in-range target, cooldown clear, then stable character ID order.

Party Support must stop when the master or target dies, disconnects, leaves the
party, changes map, becomes invalid or changes the assisted monster. A map exit
produces a typed handoff to PA. The executor must not select unrelated nearby
monsters as an offensive fallback.

## 8. Same-map Follow boundary

Same-map Follow can remain a Local Executor capability when all conditions hold:

- the followed actor is online, in the same party contract and on the same map;
- the follow lease is active and has a valid `combatSessionId` and epoch;
- `unit_can_reach_bl`, `unit_walktobl` and support range checks succeed;
- support or combat actions are paused while movement owns the local action slot;
- target loss, death, disconnect, map mismatch or no progress stops the lease;
- map arrival and distance are re-read before the next support cast.

rAthena `pc_follow_timer` contains a cross-map `pc_setpos` branch. That branch
is a primitive, not permission for Local Hunting to own cross-map Follow. The
Project Local Executor must reject or stop on map mismatch and emit a handoff.

## 9. Cross-map Follow PA boundary

Cross-map Follow remains PA-owned because it requires journey intent, route
selection, interruption, authoritative map arrival and resume. The complete
boundary is:

```text
LOCAL_FOLLOW_STOPPED
-> PA_PARENT_INTENT_PRESERVED
-> cross-map route / Supply / Quest decision
-> authoritative map arrival
-> party and master revalidation
-> same-map support lease
-> support or combat resume
```

The local executor must not call cross-map `pc_setpos` to hide a missing route,
must not decide Save Point or service behavior, and must not reacquire a local
target before PA confirms the parent journey result.

## 10. Skill-only and Normal Attack OFF behavior

`SKILL_ONLY` is a profile contract, not a UI checkbox that the executor can
ignore. When `NORMAL_ATTACK_DISABLED = YES`:

```text
skill available and legal -> cast selected skill
skill temporarily unavailable -> wait, reposition, regenerate or approved PA fallback
insufficient SP -> typed wait/reject or PA interruption
target lost -> clear skill target and reselect through the admitted policy
cast interrupted -> observe reason, bounded retry or PA interruption
no approved fallback -> remain skill-only idle
```

The executor must never silently call the normal attack path. `HYBRID_DAMAGE`
is a separate profile with an explicit fallback policy. It must also respect the
normal attack class parity gate for melee, bow/ranged and gun/ranged.

## 11. Party Support priority model

The support decision is a bounded priority queue with one action per tick. It
must snapshot party membership, map, HP/SP, status, distance, skill readiness,
cooldown and current master target before choosing an action. Every candidate is
revalidated immediately before cast.

```text
priority =
  self_critical,
  party_hp_critical,
  party_status_recovery,
  party_buff_critical,
  party_hp_low,
  party_buff_maintenance,
  follow_reposition,
  master_target_assist
```

Priority policy belongs to the selected PA combat profile. Action execution,
range, cast, status and result belong to the Local Executor plus rAthena. This
keeps support policy reusable by future Character Life and Social intents
without adding a second support engine.

## 12. Known gaps

1. Community showcase source attachments were not independently compiled in
   this pass. Current behavior is `HIGH_ATTRIBUTION_UNVERIFIED_BEHAVIOR`.
2. The public community material does not establish a common AutoSkill result
   Event Ledger or restart-safe support lease.
3. rAthena upstream provides primitives and class-specific skill implementations,
   not a canonical generic AutoSkill scheduler or Party Support product.
4. Cross-map Follow claims exist in community descriptions, while the Project
   architecture keeps cross-map journey and resume in PA.
5. Generic Project skill cast, effect, cooldown, SP failure and status events are
   not yet proven.
6. Party Support target priority, support positioning and resume after local
   combat are not implemented as a Project executor.
7. OpenKore party target behavior has documented failure evidence. Client-side
   observation must not replace final server target legality.
8. Community source licenses are absent or unavailable for the surveyed custom
   implementations. Direct code reuse is therefore prohibited for them.

Unknowns remain explicit:

```text
NO_PUBLIC_EVIDENCE != NOT_SUPPORTED
NO_PUBLIC_EVIDENCE != PASS
UNKNOWN_LICENSE -> DIRECT_CODE_REUSE_ALLOWED = NO
SHOWCASE_CLAIM -> BUILD_AND_LIVE_ACCEPTANCE = UNVERIFIED
```

## 13. License and direct-code-reuse matrix

| Reference class | License evidence | DIRECT_CODE_REUSE_ALLOWED | Project action |
| --- | --- | --- | --- |
| rAthena upstream source | Repository identifies GPL-3.0 | YES, with source notices and GPL-3.0 obligations | Reuse authoritative primitives or adapt behavior; preserve Project ownership boundary |
| OpenKore source | `Task::UseSkill.pm`, `AI.pm` and `CoreLogic.pm` headers identify GPL-2.0 | YES only after GPL-2.0 compatibility review | Study state machine and bounded retry; do not copy client authority or runtime |
| Shakto Autosupport | Public showcase, no license or repository commit | NO | Behavior reference only |
| Dantoki Auto support | Public script excerpt, no repository license | NO | Behavior and priority reference only |
| AutoSupport UI | Private repository stated, public license unavailable | NO | Feature claim and boundary reference only |
| Forum snippets and issue reports | Copyright/license status varies | NO | Evidence and negative-case reference only |

The document does not grant legal advice. Any later direct source reuse requires
an exact source file, license text, notice preservation and Project Control
approval. Algorithmic behavior study remains separate from copying source.

## 14. Recommended Stage 3 implementation order

```text
P0  Define combatSessionId, executionEpoch, lease admission and STOP_LOCAL_COMBAT.
P0  Define typed skill events and authoritative effect confirmation.
P0  Implement Stage 3A target and ground skill dispatch with NORMAL_ATTACK_OFF.
P0  Prove SP, range, cooldown, cast interruption and target legality gates.
P1  Implement Stage 3B self heal, self buff, refresh and status recovery.
P1  Prove Supply_LOW handoff without local service or return routing.
P1  Implement Stage 3C same-map party snapshot, priority, heal, buff and cleanse.
P1  Add same-map Follow and support positioning with map-mismatch stop.
P1  Prove death/revive result and same-map support lease recovery.
P2  Add explicit HYBRID_DAMAGE policy after normal attack class parity passes.
P2  Evaluate richer party policy, kill-steal and assist behavior separately.
```

Each step keeps the PA fallback. No step authorizes Production deployment,
runtime restart, OpenKore runtime or a second combat/support engine.

## 15. Capabilities that MUST NOT be reimplemented from zero

- rAthena skill legality, skill DB level data, cast type, range, SP cost,
  cooldown, cast timer, status block and map restriction.
- rAthena target legality, party flags, same-map enumeration, status effect,
  heal formula, damage result, death and respawn authority.
- rAthena party skill implementations such as same-map `BCT_PARTY` dispatch,
  status application and `status_change_end` cleanse behavior.
- rAthena bounded follow primitives as raw movement building blocks. The Project
  must wrap them with same-map lease and map-mismatch stop, not replace them with
  a second path engine.
- OpenKore's proven state-machine shapes for preparation, target loss, cast
  wait, timeout, follow recalculation and task suppression. Adapt the semantics
  to server authority instead of rewriting the invariant from zero.
- PA's parent intent, interruption, Supply, cross-map Follow, Quest, Social,
  Life, reconnect and quarantine policy. These remain outside Local Executor.

The safe classification for Stage 3 is `SAFE_WITH_CONTRACT`. The reference
floor is implementation-ready for design and gate definition. It does not
authorize gameplay implementation until Project Control opens the separate Stage
3A, 3B or 3C gate.

## Source pointers

- [rAthena `skill.hpp`](https://github.com/rathena/rathena/blob/master/src/map/skill.hpp)
- [rAthena `skill_impl.cpp`](https://github.com/rathena/rathena/blob/master/src/map/skills/skill_impl.cpp)
- [rAthena `party.cpp`](https://github.com/rathena/rathena/blob/master/src/map/party.cpp)
- [rAthena `pc.hpp`](https://github.com/rathena/rathena/blob/master/src/map/pc.hpp)
- [OpenKore `Task::UseSkill`](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/UseSkill.pm)
- [OpenKore `AI.pm`](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm)
- [OpenKore `AI::CoreLogic`](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI/CoreLogic.pm)
- [OpenKore partySkill targeting issue](https://github.com/OpenKore/openkore/issues/1314)
- [Project local hunting hybrid architecture](architecture/local-hunting-hybrid-architecture.md)
- [Project rAthena AutoCombat reference checkpoint](reference-mining/topics/rathena-server-side-autocombat.md)
