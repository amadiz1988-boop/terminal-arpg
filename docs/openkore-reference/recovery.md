# Recovery, Retry and Reconnect

## Reference semantics

Exact upstream sources:

- `src/Task/Timeout.pm`: operation-bound timeout object.
- `src/Task/Route.pm`: route timeout, path reset, retry and teleport ceiling.
- `src/Task/TalkNPC.pm`: dialogue wait, cancel and destroy timing.
- `src/Task/Teleport.pm`: cooldown-aware retry and map-change wait.
- `plugins/reconnect`, `src/Commands.pm`: reconnect delay and relog command.

The mature invariant is:

```text
observe no progress or lost transport
-> identify operation and reason
-> bounded retry/backoff
-> reconcile authoritative state
-> resume parent intent or enter safe failure
```

## Project Last-Good

`process_supply_route_abort` resets after three failures and schedules a
five-minute retry. `process_job_resume` tracks route progress, waits eight to
ten seconds between retries and fails after four recovery attempts or ten
minutes. `process_job_death` sends one respawn request per bounded interval.
`process_eden_recovery` pauses below 60% HP, escapes attackers with Fly Wing,
then resumes at 90%, with a ten-minute ceiling. `process_onboarding_dialog` and
Eden dialogue use ownership and timeout guards.

Gate 1B proves native death, respawn, recovery and farm resume. Gate 2 proves
supply return and combat resume. Full reconnect persistence in production is
not claimed by this atlas.

## PA mapping

`REPRODUCE`: bounded ceilings, reasoned retries, state restoration.
`ADAPT`: reconnect reconciliation, persisted intent and rAthena events.
`IMPROVE`: idempotency keys, event ledger and duplicate-owner protection.
`REJECT_LEGACY`: infinite polling, blind command replay, retry without a next-at.

Every recovery record should include operation, reason, attempt, ceiling,
backoff, destination and authoritative confirmation. An unchanged external
state is not a new failure signal.
