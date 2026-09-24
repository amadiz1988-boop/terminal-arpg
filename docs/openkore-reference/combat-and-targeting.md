# Combat and Targeting Reference

## OpenKore combat map

At the locked upstream commit, `src/AI/Attack.pm` owns target approach and
attack policy while `src/AI/CoreLogic.pm` coordinates the main loop. Important
symbols are `Attack::process`, `targetGone`,
`approach_target_route_needs_reset`, `note_approach_route_failure` and
`ai_attack_giveup`. `src/Actor/Monster.pm` supplies monster observations and
`control/mon_control.txt` supplies policy data.

```text
visible actors
-> eligibility and priority
-> approach route
-> attack request
-> authoritative damage / death
-> loot interruption or target reacquisition
```

`attackAuto`, `attackAuto_party`, `attackAuto_onlyWhenSafe`,
`attackAuto_notInTown` and `attackAuto_notWhile_storageAuto/buyAuto/sellAuto`
are gates. `teleportAuto_lostTarget`, `dropTarget`, `dropTargetEngaged`,
`atkMiss`, `unstuck` and `minAggressives` describe escape or target-drop
conditions. They define policy, not observed success.

## Mature behavior worth carrying forward

- A target becomes invalid when it dies, disappears, cannot be approached or
  violates safety/ownership policy.
- Route failure resets target-specific path state before retargeting.
- Loot can interrupt combat, but inventory and item ownership are reconciled
  before resuming.
- Search and teleport are distinct reasons. Emergency escape must not silently
  become roaming.
- No-progress, no-damage and target-loss paths have bounded ceilings.

## Project Last-Good

Gate 1A observed natural mob scan, target selection, movement, attack, damage,
kill and loot with OpenKore process count zero. The project bridge records
`AUTO_FARM_ATTACK` and `AUTO_FARM_HIT`. `status-export.pl` additionally contains
target guard, route failure, nudge and recovery logic. These are historical
behavior references, not permission to restore OpenKore.

## PA and future Fly Wing mapping

Current PA combat is rAthena-authoritative. The player selects a valid farm map;
AUTO_FARM selects an eligible monster. A future Fly Wing roaming design may
reuse:

```text
REPRODUCE: target invalidation, retarget, bounded retry, loot resume
ADAPT: search radius, teleport reason, cooldown and post-warp reacquisition
IMPROVE: server-side target index, event ledger, safety and ownership checks
REJECT_LEGACY: client packet polling as authority, infinite teleport search,
  blind replay of mon_control
```

`FLY_WING_ROAMING = RESEARCH_ONLY`. Its acceptance requires a separate design,
server authority review and player-flow evidence.

## Gaps and conflicts

Full parity for party, kill-steal, monster-specific config and teleport search
is not established for current PA. `【資料不足，無法確認】` applies to any claim
that current PA already implements the entire OpenKore targeting matrix.
