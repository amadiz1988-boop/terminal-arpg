# Navigation Reference

## Proven OpenKore semantics

Exact upstream references at commit `51de1ddfc4449ae5217f6886de702f87ca934030`:

- `src/Task/Route.pm`: same-map route, step movement, path deviation reset,
  `routeRepath`, target tolerance, portal-route flags and route teleport.
- `src/Task/MapRoute.pm`: portal state machine, `portal_wait`,
  `portal_give_up`, `route_maxNpcTries`, missing portal removal and fallback.
- `src/Task/CalcMapRoute.pm`: `%portals_lut`, `%portals_los`,
  `%portals_commands`, `%portals_spawns`, `%teleport_items`, cost and time
  budgets, save-map and item-warp candidates.
- `src/Field.pm`, `src/Actor/Portal.pm`: collision and portal observations.

The mature outcome is a bounded chain:

```text
destination intent
-> same-map path or map-route plan
-> portal/NPC approach
-> authoritative map-change observation
-> recompute from the new map
-> arrival tolerance or bounded failure
```

## Configuration semantics that affect design

`route_step` controls movement granularity. `route_avoidWalls` controls collision
planning. `route_maxNpcTries` bounds NPC transition attempts. `route_teleport`,
`route_teleport_minDistance` and `route_teleport_maxTries` allow a bounded route
teleport candidate. `route_warpByItem`, chaining, minimum distance and minimum
gain affect item-warp candidates. These are policy inputs, not proof that the
route ran.

`lockMap` constrains farm destination. `lockMap_x/y/randX/randY` define the
allowed local area. `attackAuto_outOfLock` controls whether attack can continue
outside it. Project policy keeps one farm map and restores it only after an
authoritative map match.

## Project Last-Good and PA mapping

Project Gate 3 proved same-map and multi-map no-client navigation. Historical
`process_job_route_retry` and `process_job_resume` show bounded retry, map
matching, progress timestamps and route reset. `process_supply_route_abort`
records three failures and a five-minute backoff. `nudge_stalled_grind_target`
uses a walkable adjacent cell as a diagnostic nudge.

The PA equivalent owns destination intent and recovery. rAthena owns movement,
map transitions, portal validity and character position. A generated portal table
is advisory. A route entry cannot override a missing runtime portal or an
authoritative map result.

## Reuse decision

```text
REPRODUCE = destination lock, arrival confirmation, bounded retry, map replan
ADAPT = portal planning, service routes, save-point relocation
IMPROVE = server-side state, event ledger, durable intent, duplicate control
REJECT_LEGACY = client-path replay and indefinite random walking
```

For future Fly Wing roaming, consult `combat-and-targeting.md` and
`teleport.md`. This document does not implement roaming.
