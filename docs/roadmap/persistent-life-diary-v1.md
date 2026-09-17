# PL1 — Persistent Life Diary V1

Detailed roadmap for the first Persistent Life product slice.

```text
ROADMAP_ID:                 PL1-PERSISTENT-LIFE-DIARY
STATUS:                     PLANNED
IMPLEMENTATION_AUTHORIZED:  NO
CANONICAL_INDEX:            docs/PROJECT_ROADMAP.md
SOURCE_OF_TRUTH:            docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md
TASK_TYPE:                  ROADMAP / GOVERNANCE ONLY
```

START CONDITION:

```text
OpenKore Exit sufficiently stabilized
OR
Project Control explicitly authorizes PL1.
```

This document does not authorize implementation. LLM remains narrator-only.

## 1. Product goal

Each persistent character should be able to live through a real day, then
produce at most one bounded LLM diary generation per in-world day.

Required conceptual pipeline:

```text
rAthena / SERVER_AGENT real behavior
→ Event Ledger
→ Daily Event Aggregation
→ Daily Diary
→ Diary Summary
→ Emotional Impression
→ Long-term memory / context
→ next-day interpretation
```

Authority invariant:

```text
rAthena / SERVER_AGENT = WORLD AUTHORITY
Event Ledger           = FACTUAL HISTORY
LLM                    = INTERPRETATION / NARRATION / DIALOGUE ONLY
```

LLM must not invent factual events. Every generated diary entry must be
traceable to its backing Event Ledger facts.

## 2. Minimum modules

### PL1-A — Daily Event Aggregator

Purpose: convert large numbers of factual events into a small set of important
daily events.

- deterministic filtering / importance selection before any narration
- bounded output (do not feed unlimited raw history forward)
- no LLM involvement at this stage

### PL1-B — Diary Storage Contract

At minimum conceptually store:

- character identity
- world / date key
- diary text
- summary
- emotional tags / impression
- important people
- important events
- provenance / source event window

Schema is not frozen here. Any persistence work must follow existing migration
and testing conventions when implementation is authorized.

### PL1-C — Daily Diary LLM

Input:

- factual daily summary
- character identity / personality
- recent diary context
- relationship context where relevant

Output:

- diary prose
- summary
- bounded emotional interpretation

Cadence policy:

```text
one primary diary-generation call per character/day
```

unless Project Control later changes this policy. This bounds cost and prevents
LLM-driven simulation drift.

### PL1-D — Diary Memory Context

Initial strategy:

- recent full diary entries
- older condensed summaries
- important lasting memories

Do not feed unlimited raw history.

### PL1-E — Diary Player UI

Player can browse a character's diary chronologically. V1 should remain simple.

## 3. Success condition

A character:

- experiences real autonomous world events
- produces a diary grounded in those real events
- remembers relevant previous diary context next day
- exposes diary to the player
- does not hallucinate factual world history

Completion is not proven by: a one-off offline script, LLM producing text, or an
event table containing rows. It requires a real player-flow acceptance showing
facts recorded and diary accurately reflecting those facts.

## 4. Non-goals

- No new OpenKore dependency.
- No LLM authority over world state.
- No unlimited raw event/history feed into the model.
- No Social PA features (those belong to `PL2-PERSISTENT-SOCIAL-PA`).
- No calendar dates are committed by this document.

## 5. Mandatory reuse gate

Every PL1 implementation slice must run:

```text
PRE_IMPLEMENTATION_REUSE_GATE = PASS
```

Reuse preference includes `SERVER_AGENT`, Event Ledger foundation, Persistent
Life foundation, live status, quest runtime, NPC interaction runtime, and
OpenKore harvested behaviors. Do not create parallel simulation systems.

Gate authority: `docs/pre-implementation-reuse-gate.md`.

## 6. Dependencies

```text
OpenKore Exit / SERVER_AGENT migration (PHASE 1)
   └─→ PL1-A Daily Event Aggregator
        └─→ PL1-B Diary Storage Contract
             └─→ PL1-C Daily Diary LLM
                  └─→ PL1-D Diary Memory Context
                       └─→ PL1-E Diary Player UI
                            └─→ PL1 success condition / acceptance
                                 └─→ PL2 Persistent Social PA V1
```
