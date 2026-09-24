# Synthetic Player Scenario Harness

## Canonical governance

Runtime／control-flow diagnosis uses `SYNTHETIC_FIRST_DEBUGGING_GATE_V1` from
`.agents/skills/synthetic-first-debugging/SKILL.md`. This document defines the
existing runner and scenario contracts; it does not create a separate debugging
workflow. Project Control and Workers must preserve the sequence:

```text
diagnostic → trace → synthetic scenario → FIRST_BROKEN_TRANSITION
→ minimal fix → synthetic regression → controlled acceptance → Browser final acceptance
```

Pure Browser／presentation defects may begin with Browser evidence. Synthetic
PASS remains insufficient for Player Web final acceptance.

`scripts/player-scenario-runner.mjs` is the bounded scenario entrypoint for
Dashboard to Controller to Native/PA to rAthena observations. It reuses the
existing Dashboard endpoints and relocation helpers; it does not implement a
second route planner, combat engine, farm policy or item authority.

The shared action registry, trace schema, bounded trace store and Admin contract
are defined in `docs/player-action-trace-foundation.md`.

## Layers

```text
L1 logic       map metadata + existing server warp planner
L2 API         /api/automation, /api/grind-target, /api/item-action
L3 controller  authenticated session, ownership and validation responses
L4 native      persistent-agent command status and reasonCode
L5 authority   /api/state liveStatus, map, position, mode, inventory
L6 ledger      /api/events bounded cursor window
L7 result      first broken transition and unified result
L8 browser     outside this harness; reserved for wiring and presentation
```

## Safety

The default is `--dry-run`. Live mutation requires `--execute`, an authenticated
session and an optional `--char` ownership check. `change-farm-map --dry-run`
only resolves the existing rAthena warp graph from the canonical Native source,
or from an explicit `--runtime-root`. No DB mutation, admin teleport,
fixture reset or runtime restart is performed by the runner.

Authentication reuses the existing credential file and `/api/account`; the
runner never creates a bypass session. Use `--username` when the credential
file contains only a shared password fixture.

## Commands

```text
node scripts/player-scenario-runner.mjs --matrix --source moc_pryd01 --dry-run
node scripts/player-scenario-runner.mjs --scenario start-farm --char 150094 --username <user> --execute
node scripts/player-scenario-runner.mjs --scenario stop-farm --char 150094 --username <user> --execute
node scripts/player-scenario-runner.mjs --scenario change-farm-map --source moc_pryd01 --target mjolnir_07 --char 150094 --username <user> --execute
node scripts/player-scenario-runner.mjs --scenario use-fly-wing --char 150094 --username <user> --execute
node scripts/player-scenario-runner.mjs --scenario use-butterfly-wing --char 150094 --username <user> --execute
node scripts/player-scenario-runner.mjs --scenario supply-return --char 150094 --username <user> --execute
node scripts/player-scenario-runner.mjs --scenario combat-cycle --char 150094 --username <user> --execute
```

`--json` emits the same checkpoint structure for CI. Exit code `0` is PASS,
`1` is FAIL and `2` is BLOCKED or invalid precondition. Every run carries a
`traceId` and sends it as `x-scenario-trace-id`; current Dashboard command and
ledger records do not persist that header across every layer, so
`TRACE_PROPAGATION_GAP = PRESENT` until the architecture adds a correlation
field without changing the command schema.

## Scenario contracts

- `start-farm`: requires a non-AUTO_FARM state and confirms `AUTO_FARM`.
- `stop-farm`: requires `AUTO_FARM` and confirms `PERSISTENT_IDLE`.
- `change-farm-map`: confirms arrival, target persistence and AUTO_FARM resume.
- `use-fly-wing`: confirms accepted command, authoritative position change and
  unchanged item count.
- `use-butterfly-wing`: additionally requires an observed authoritative save
  point matching the resulting map.
- `supply-return`: read-only observation of the complete supply and combat
  checkpoint chain. It does not manufacture a low-supply condition.
- `combat-cycle`: requires `MONSTER_TARGET`, `MONSTER_ATTACK`, `MONSTER_HIT`,
  `MONSTER_KILL` and `LOOT_ACQUIRED`. `MONSTER_ATTACK` alone never proves hit.

The first broken transition is reported in order:

```text
HTTP -> Controller
Controller -> Command
Command -> Native Receive
Native Receive -> Native Result
Native Result -> Authoritative State
Authoritative State -> Event Ledger
```

If the live runtime or valid authenticated precondition is unavailable, the
runner returns `BLOCKED` with the exact reason and does not claim a gameplay
failure.
