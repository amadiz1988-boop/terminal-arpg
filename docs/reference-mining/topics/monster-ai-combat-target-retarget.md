# Mining Dossier: Monster AI, Combat, Target and Retarget

```text
TOPIC_ID = MONSTER_AI_COMBAT_TARGET_RETARGET
QUESTION = Which mature discovery, target, combat, hit, kill, loot and recovery invariants should the Project reuse without confusing attack intent with authoritative damage?
PROJECT_RELEVANCE = AUTO_FARM target acquisition, combat correctness, retarget safety, supply/death interruption and future bounded roaming.
UPSTREAM_SOURCE_CHECKED = rAthena native source at project head ff72578f608935d1df5d664b3e9df9d436361043 plus Atlas baseline e985006171d2eb320ee512a653f4c83aea3d81b6; OpenKore reference baseline 51de1ddfc4449ae5217f6886de702f87ca934030 and current upstream source pointers.
FORUM / WIKI FINDINGS = Official source and project evidence were sufficient. No forum claim was promoted into a capability.
CURRENT_VERSION_APPLICABLE = PARTIAL
PROJECT_LAST_GOOD_CHECKED = Gate 1A combat evidence, docs/openkore-reference/combat-and-targeting.md, docs/openkore-reference/recovery.md, docs/reference-mining/topics/item-loot-inventory-storage-weight.md, docs/architecture/control-chain-responsibility-audit.md and current persistent_agent.cpp.
CLASSIFICATION = ADAPT
CANONICAL_SOURCE_POINTERS = See the rAthena/OpenKore Atlas rows, tables and matrix below.
PROJECT_USAGE = PA owns bounded scan, target lock, approach, attack orchestration and recovery; rAthena owns legality, damage, death, loot ownership and authoritative state; Event Ledger observes; Dashboard presents.
KNOWN_RISKS = Nearest-target policy is narrower than OpenKore mon_control; current PA has no explicit MISS event or typed RETARGET event; party/kill-steal policy parity and Fly Wing roaming remain partial.
STALE / VERSION CONFLICT = OpenKore is mature reference only and remains runtime count 0. Project AUTO_FARM is map-only and server-authoritative, so client polling/config behavior is adapted rather than copied.
ATLAS_UPDATED = YES
```

## 1. Authority and responsibility

```text
Dashboard intent / presentation
  -> controller authentication, ownership and command validation
  -> PA scan, target lock, approach, attack orchestration and bounded recovery
  -> rAthena unit legality, path/range, damage, death, drop and loot ownership
  -> Event Ledger and live read-model projection
```

The player chooses a farm map. Current AUTO_FARM selects an eligible monster on that map. Dashboard does not own combat AI. `MONSTER_ATTACK` records an attack intent. `MONSTER_HIT` records an observed authoritative HP decrease. A request, animation, log line or `MONSTER_ATTACK` event cannot prove damage.

## 2. rAthena authoritative combat chain

| Concern | Current source evidence | Authority result |
|---|---|---|
| Monster existence and lifecycle | `src/map/mob.cpp`, `mob_data`, `status_isdead` | The live mob block and server status determine whether a target exists and is alive. |
| Target legality | `src/map/unit.cpp::unit_attack`, `unit_attack_timer_sub`, `battle_check_target` | Server rejects invalid, dead, non-enemy or otherwise unattackable targets. |
| Approach and reachability | `src/map/path.cpp::path_search`, `src/map/unit.cpp::unit_can_reach_pos`, `unit_walktobl` | A route or move request is only an approach attempt. Arrival and attack range require fresh state. |
| Range and cadence | `unit_attack_timer_sub`, `unit_can_attack`, `battle_weapon_attack` | Native timers and battle rules decide when an attack can resolve. |
| Miss / block / damage result | `src/map/battle.cpp::battle_calc_attack` | A total damage below one is classified as `ATK_MISS` unless blocked; the attack request remains non-proof. |
| Delayed damage | `battle_delay_damage` | Delayed damage is revalidated for source, target, map, invincibility and range before `battle_damage`. |
| Authoritative HP mutation | `battle_damage`, `status_damage` | Positive HP mutation is the strongest hit evidence available to the PA observer. |
| Kill and attribution | `src/map/mob.cpp::mob_log_damage`, `mob_dead` | Damage log, first attacker, ranked damage dealers and alive/same-map checks determine kill and loot ownership. |
| Drop and pickup | `mob_item_drop`, floor item ownership, `pc_takeitem` and inventory checks | Drop creation, floor ownership, item removal and inventory increase are separate checkpoints. |
| Client visual damage | `src/map/clif.cpp::clif_damage` | Presentation transport only; it does not replace battle/status authority. |

The minimum proof chain is:

```text
TARGET_SELECTED
  -> APPROACH / ARRIVAL
  -> IN_ATTACK_RANGE
  -> MONSTER_ATTACK
  -> MONSTER_HIT (authoritative HP decrease)
  -> MONSTER_KILL (authoritative death / removal)
  -> LOOT_ACQUIRED (floor removal plus inventory increase)
```

`PATH_FOUND != ARRIVAL != IN_ATTACK_RANGE != ATTACK_ACCEPTED != HIT != KILL`.

## 3. Mature OpenKore primitives

| Capability | Mature reference | Project classification |
|---|---|---|
| Visible actor discovery and eligibility | `AI::Attack`, `Actor::Monster`, `ai_getAggressives` | ADAPT: server-side scan is authoritative, policy remains explicit. |
| Target selection and priority | `Attack.pm`, `Actor::Monster`, `control/mon_control.txt` | ADAPT: current Project chooses nearest legal target and lacks full mon_control parity. |
| Target lock and invalidation | `attackID`, `targetGone` | REUSE: retain entity identity and clear it on invalidation. |
| Approach and attack range | `Attack::process`, `Route.pm`, `attack_continue` | REUSE: retain approach before attack and use rAthena range authority. |
| Retarget after loss or route failure | `targetGone`, `approach_target_route_needs_reset`, `ai_attack_giveup` | IMPROVE: retain bounded reset, add typed reason and attempt telemetry. |
| Attack cadence | `attackAuto` plus timeout policy | ADAPT: native timing and server state outrank client timing. |
| Hit / miss distinction | Attack result and damage observation | ADAPT: only HP mutation proves hit; expose miss/no-damage separately. |
| Kill and loot interruption | `CoreLogic` item take flow and attack resumption | ADAPT: reuse interruption invariant, use rAthena damage log and inventory authority. |
| Stuck and route recovery | `Route.pm`, `note_approach_route_failure`, `routeRepath`, `control/timeouts.txt` | IMPROVE: bounded repath/backoff, never an infinite move loop. |
| Teleport search | `Task::Teleport`, `CalcMapRoute`, `teleportAuto_search` | ADAPT: research shape only; Project Fly Wing semantics are non-consumable and server-confirmed. |
| Death and supply interruption | `Task::Teleport`, `CoreLogic`, `recovery.md` | REUSE: stop combat, clear target, recover authoritative state, then reacquire. |
| Unbounded random walking or client damage as proof | Historical failure patterns | REJECT_LEGACY. |

OpenKore timeouts provide shape, not Project constants: `ai_move_retry`, `ai_move_giveup`, `ai_route_unstuck`, `ai_attack_giveup`, `ai_attack_failedLOS`, `ai_portal_wait` and `ai_portal_give_up` are bounded-operation examples. They must not be copied as gameplay authority.

## 4. Target state machine and retarget taxonomy

```text
SCAN
  -> CANDIDATE
  -> LOCKED
  -> APPROACHING
  -> IN_ATTACK_RANGE
  -> ATTACKING
  -> HIT -> ATTACKING
  -> MISS / NO_DAMAGE -> bounded retry or RETARGET
  -> KILL_CONFIRMED -> LOOT_PENDING -> PICKUP_CONFIRMED or LOOT_SKIPPED -> SCAN

LOCKED / APPROACHING / ATTACKING
  -> TARGET_LOST / UNREACHABLE / SAFETY / SUPPLY / DEATH
  -> clear target -> recovery or SCAN
```

Recommended `RETARGET_REASON` values:

```text
TARGET_DEAD, TARGET_DISAPPEARED, TARGET_CLAIMED, MAP_CHANGED,
UNREACHABLE, PATH_REJECTED, OUT_OF_RANGE, LINE_OF_SIGHT_BLOCKED,
ATTACK_TIMEOUT, NO_DAMAGE, PLAYER_CRITICAL, SUPPLY_REQUIRED, DEATH,
HIGHER_PRIORITY_THREAT, LEASH_VIOLATION, MAP_EXIT_PORTAL,
TARGET_BLACKLISTED, QUEST_CONSTRAINT, UNKNOWN
```

Current PA evidence supports dead/disappeared target clearing, target ownership avoidance, `MAP_EXIT_PORTAL`, `UNREACHABLE`, five-second target blocking, survival/supply/death clearing and post-recovery reacquisition. It does not yet emit a first-class `MISS`, `NO_DAMAGE`, `ATTACK_TIMEOUT`, `RETARGET` or `TARGET_REJECTED` Event Ledger event.

## 5. Current Project mapping

| Capability | Current implementation evidence | Classification | Safe reuse now |
|---|---|---|---|
| Farm-map eligibility | `farm_map_has_attackable_mob` scans live `map_data.moblist` and mob DB | REUSE | Yes |
| Candidate discovery | `find_target` scans same-map mobs, rejects dead/non-enemy/claimed/leash-invalid and chooses nearest | ADAPT | Yes, with current map-only policy |
| Target lock | `runtime.target_id`, pending HP and target mob identity | REUSE | Yes |
| Target priority | Nearest eligible target; no complete aggression, level, danger or `mon_control` policy | ADAPT | Current behavior only |
| Approach | `walk_to_farm_target`, `unit_walktobl`, exact path and portal avoidance | REUSE | Yes with typed failure evidence |
| Attack request | `issue_melee_attack` emits `MONSTER_ATTACK`, then calls `unit_attack` | REUSE | Intent only |
| Hit confirmation | `report_melee_hit` compares authoritative monster HP before/after and emits `MONSTER_HIT` | REUSE | Yes |
| Miss / no damage | Native battle has `ATK_MISS`; PA has no corresponding Event Ledger event | IMPROVE | No event-level proof yet |
| Kill confirmation | Dead/removed target increments kills and emits `MONSTER_KILL` | ADAPT | Yes, preserve rAthena death authority |
| Loot transition | `find_loot`, floor ownership, `pc_takeitem`, inventory delta and `LOOT_ACQUIRED` | ADAPT | Reuse item dossier for inventory semantics |
| Retarget | Clear target on death, route failure or recovery; target block expires after five seconds | IMPROVE | Bounded policy only |
| Stuck recovery | `UNREACHABLE` and `MAP_EXIT_PORTAL` clear target and stop attack | IMPROVE | Add progress/attempt reason before broadening |
| Death interruption | `handle_death` and `clear_death_actions` clear target/loot/attack state | REUSE | Yes |
| Supply interruption | `handle_supply` clears target/loot and pauses combat before return | REUSE | Yes |
| Multi-player ownership | `target_claimed` plus rAthena damage and loot rights | ADAPT | Basic collision only; full party/KS parity remains partial |
| Fly Wing roaming | Existing item semantic is non-consumable; random roaming search is not implemented | NOT_APPLICABLE | Research-only contract |

## 6. Kill-steal, multi-player and monster-AI boundary

rAthena `mob_dead` owns damage attribution and first/second/third loot ownership from its damage log. A player’s last attack request cannot establish kill ownership. The current PA `target_claimed` check prevents two active runtimes from selecting the same entity, while rAthena remains the final authority when multiple players or external damage sources are present. Full OpenKore party, priority and kill-steal policy parity is `【資料不足，無法確認】` from current Project evidence and remains a documented gap.

Monster AI is rAthena `mob.cpp` behavior: monster target selection, movement, skills, aggression and attacks against players. PA Player AI is the player-side loop: scan a legal monster, lock it, approach, issue an attack, observe hit/kill, collect loot and recover. These are different actors and must not share a fake client-side authority.

## 7. Fly Wing roaming research contract

This dossier records research only. A future roaming policy should require all of the following before `ROAMING_TRIGGERED`: no legal target for a bounded interval, no active supply/recovery/death/quest transition, safe HP/SP, map teleport legality, item cooldown clear, bounded recent teleport count, authoritative map/position reread and target-map reacquisition. Failure must end in a typed reason and safe idle/backoff. Project rule remains `Fly Wing = NON-CONSUMABLE`; no implementation is authorized here.

## 8. Event and trace recommendations

Recommended future events are:

```text
TARGET_SELECTED, TARGET_REJECTED, TARGET_LOST, RETARGET,
APPROACH_STARTED, APPROACH_FAILED, PATH_FOUND, ARRIVAL, IN_ATTACK_RANGE,
MONSTER_ATTACK, MONSTER_HIT, MONSTER_MISS, MONSTER_KILL,
LOOT_CANDIDATE, LOOT_ACQUIRED, LOOT_SKIPPED, STUCK,
TARGET_BLACKLISTED, ROAMING_TRIGGERED
```

Current presentation mapping should remain:

```text
[鎖定] MONSTER_TARGET
[攻擊] MONSTER_ATTACK
[命中] MONSTER_HIT
[未命中] future MONSTER_MISS / typed no-damage observation
[擊倒] MONSTER_KILL
[掉落] LOOT_ACQUIRED
```

`MONSTER_ATTACK` must render attack intent. Only `MONSTER_HIT` may render authoritative damage. The current Web observation already distinguishes these two event names; this research does not change its parser or UI.

## 9. Decision

```text
CLASSIFICATION = ADAPT
CURRENT_VERSION_APPLICABLE = PARTIAL
RATHENA_COMBAT_AUTHORITY = PASS
OPENKORE_REFERENCE = PASS, runtime return prohibited
PROJECT_CAN_REUSE_NOW = map eligibility, bounded target lock, server approach/range, attack intent, HP-decrease hit proof, kill/death authority, loot inventory checkpoint, death and supply interruption invariants
PA_FUTURE_COMBAT_CAPABILITIES = typed candidate rejection, explicit retarget reasons, MISS/NO_DAMAGE event, attack timeout, richer priority policy, full party/kill-steal policy and bounded roaming
SAFE_SIMPLIFICATIONS = nearest legal target, map-only AUTO_FARM, bounded five-second target block, no Fly Wing roaming, no client damage proof
REFERENCE_MINING_GAP = YES for fine-grained combat events, full policy parity and roaming
GAMEPLAY_CHANGE = NO
```

This dossier is reference evidence only. It does not authorize Dashboard, PA, Native, rAthena script, database, runtime or Production changes.
