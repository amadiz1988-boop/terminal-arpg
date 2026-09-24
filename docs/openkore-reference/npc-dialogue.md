# NPC Interaction and Dialogue

## Protocol reference

`src/Task/TalkNPC.pm` models the dialogue protocol. `src/Actor/NPC.pm` models
the NPC actor. `src/Network/Send.pm` and `Receive.pm` carry talk, continue,
response and cancel messages. Relevant symbols are `sendTalkContinue`,
`sendTalkResponse`, `sendTalkCancel`, `NPC_TIMEOUT_AFTER_ASWER`,
`ai_npc_talk_wait_to_answer` and `autoTalkCont`.

```text
route to NPC
-> acquire dialogue ownership
-> open
-> next or select
-> close or cancel
-> observe quest/service result
```

The mature timeout sequence waits for answer, cancels stale dialogue, destroys
the task after a bounded delay and returns control to the parent task. It does
not declare quest completion from a sent response.

## Project Last-Good

`process_onboarding_dialog` and `process_eden_dialog` use explicit ownership,
`next`, `select` and `close` stages. They throttle actions and release ownership
when the dialogue closes or exceeds its timeout. `process_grind_hub_transition`
and `process_eden_exit_dialog` add Kafra/service variants. Project source also
disables `autoTalkCont` while a custom flow owns dialogue, then restores it.

## PA mapping

Quest Runtime may reuse the protocol as typed primitives:

```text
REPRODUCE = ownership, stage handling, cancel, timeout, result observation
ADAPT = phase-specific choices and persisted resume state
IMPROVE = direct rAthena quest/service state and event-ledger evidence
REJECT_LEGACY = unbounded auto-talk and response-success assumptions
```

Current player-flow closure is phase-specific. Generic NPC acceptance for every
historical flow is `【資料不足，無法確認】`.
