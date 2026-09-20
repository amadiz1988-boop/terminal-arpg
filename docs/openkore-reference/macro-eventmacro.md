# Macro and EventMacro Patterns

## Sources

- `plugins/macro` and its macro interpreter provide ordered commands, variables,
  labels, waits and explicit stop behavior.
- `plugins/eventMacro/eventMacro.pl` and `control/eventMacros.txt` provide
  condition-triggered macros. Conditions include map, quest, inventory, NPC
  message and counters. Policies include `delay`, `run-once`, `timeout`,
  `repeat`, `exclusive`, `overrideAI` and `orphan`.

The upstream plugin commands include `list`, `status`, `check`, `stop`, `pause`,
`unpause`, `var_get`, `var_set`, `enable`, `disable` and `include`.

## Reusable patterns

```text
condition false -> condition true -> trigger once or bounded repeat
-> action -> observed result -> cooldown or next transition
```

Useful patterns are condition gating, explicit delay, event reaction, bounded
retry, exclusive ownership, safe pause and state-variable handoff. Event storms
must use timeout or run-once. A trigger may clear an AI queue, so ownership must
be visible.

## PA adaptation

Quest Runtime and PA can express these patterns as typed transitions:

```text
REPRODUCE = condition, bounded retry, timeout, ownership, result observation
ADAPT = event-ledger transitions and persisted variables
IMPROVE = server events, idempotency and durable resume
REJECT_LEGACY = porting the interpreter, arbitrary macro loops, client polling authority
```

Macros are historical automation references. They do not replace normal-player
quest-flow analysis and do not authorize a new PA scripting subsystem.
