# Teleport, Fly Wing and Butterfly Wing

## Reference behavior

`src/Task/Teleport.pm` handles Random and Respawn tasks. It waits for item
cooldown, map change and a bounded give-up timeout. `src/AI/CoreLogic.pm`
decides why teleport is needed. `src/Task/CalcMapRoute.pm` considers save-map
and item-warp candidates. Relevant teleport keys include `teleportAuto_hp`, `sp`,
`idle`, `portal`, `deadly`, `lostTarget`, `dropTarget`,
`useItemForRespawn`, `route_warpByItem`, `route_warpItem_minGain` and
`saveMap_warpToBuyOrSell`.

Pinned `src/AI/CoreLogic.pm:3291` uses `teleportAuto_search` as a tagged
search-monster count gate before `processAutoAttack`; it does not call
`ai_useTeleport`. Pinned `src/Misc.pm:3607,3624` increments or decrements that
count according to `mon_control.search`. Ghost Island's no-target Fly policy
is separately authorized by `docs/RO_FLY_WING_SOURCE_AUDIT.md:19`.

## Item distinction

```text
Fly Wing item 601       random map position, typed escape or GI no-target policy
Butterfly Wing item 602 authoritative save point, service/recovery relocation
```

The project rule is explicit:

```text
PROJECT_RULE_OVERRIDE = NON_CONSUMABLE
```

OpenKore's consumable inventory decrement cannot be copied. Reusable semantics
are reason, cooldown, authoritative map result, state after relocation, target
reacquisition and bounded retry.

## Project evidence and mapping

The project generator configures items 601 and 602 as permanent items and removes
`buyAuto 601/602`. Gate 1B and `docs/RO_FLY_WING_SOURCE_AUDIT.md` record a Fly
Wing diagnostic with count `30 -> 30`, random map movement and process count
zero. Historical supply evidence records item 602 use and save-point
verification. The corrected supply contract makes Butterfly Wing the primary
Supply Out leg, with normal PA navigation after Save Point.

```text
AUTO_FARM -> SUPPLY_LOW -> pause combat -> verify item 602
-> use -> verify authoritative save point -> service -> return -> resume
```

No-Butterfly-Wing behavior is bounded fallback only. It may walk when the
authoritative route is valid, then enters safe idle/backoff after the configured
failure ceiling. It must not silently promote walking to the primary contract.

## Reuse classification

`ADAPT`: teleport reason, state transition, cooldown and reacquire.
`IMPROVE`: PA event-ledger and server-side result confirmation.
`REJECT_LEGACY`: item consumption assumption, blind map-coordinate inference,
unbounded random search.

Future Fly Wing roaming remains outside this task. Current PA post-warp
reattach and roaming acceptance are separate gaps.
