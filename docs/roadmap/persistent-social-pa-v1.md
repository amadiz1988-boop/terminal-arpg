# PL2 — Persistent Social PA V1

Detailed roadmap for a small population of autonomous persistent social
characters.

```text
ROADMAP_ID:                 PL2-PERSISTENT-SOCIAL-PA
STATUS:                     PLANNED
IMPLEMENTATION_AUTHORIZED:  NO
CANONICAL_INDEX:            docs/PROJECT_ROADMAP.md
SOURCE_OF_TRUTH:            docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md
TASK_TYPE:                  ROADMAP / GOVERNANCE ONLY
```

START CONDITION:

```text
Diary V1 canonical acceptance complete
AND
Project Control explicitly authorizes PL2.
```

This document does not authorize implementation.

## 1. Product vision

Build a small population of autonomous persistent social characters
(hereafter "Social PA").

They are NOT:

- static NPCs
- chatbots waiting for players
- player-service characters
- universally romantic companions

They are persistent agents with their own lives.

Authority invariant remains:

```text
rAthena / SERVER_AGENT = WORLD AUTHORITY
Event Ledger           = FACTUAL HISTORY
LLM                    = INTERPRETATION / NARRATION / DIALOGUE ONLY
```

### Initial V1 population

- approximately 6–10 Social PA characters
- female characters may form the majority of the initial population
- support / healing classes may be represented strongly
- but do NOT define `female = healer`
- include multiple professions / classes and personalities

## 2. Social PA autonomy

Social PA should eventually be capable of:

- autonomous hunting
- leveling
- supply
- travel
- quests
- job progression
- equipment use
- party play
- player interaction
- PA-to-PA interaction
- proactive conversation
- proactive party invitation
- declining invitations
- continuing life while players are offline

They must HAVE A LIFE. They must not EXIST ONLY FOR THE PLAYER.

## 3. Relationship model

Do NOT design relationship as:

```text
affection 0–100
100 = romance
```

Plan a multidimensional relationship model including concepts such as:

- Familiarity
- Trust
- Respect
- Reliance
- Affection
- RomanticInterest
- Conflict
- SharedHistory

Different combinations may naturally represent:

- acquaintance
- teammate
- battle companion
- friend
- close friend
- family-like bond
- romantic relationship
- other emergent relationships

Relationship state is structured game state, not free-form LLM output.

## 4. Relationship evidence

Relationship changes should primarily derive from real shared events:

- hunting together
- quest completion
- healing / rescue
- repeated party activity
- promises kept / broken
- sudden departure
- helping with items / tasks
- deaths / recovery
- success / failure
- meaningful conversations

LLM may interpret events. LLM must not become relationship-state authority.
Use bounded policy / state-transition rules. Relationship change should be
deterministic enough to audit and replay.

## 5. Proactive social behavior

Plan for Social PA to initiate interaction. Examples:

- greet a familiar player
- invite a player to party
- ask whether they want to hunt together
- mention recent events
- tell a player about job advancement
- ask for help
- check in with a familiar person

Future implementation must account for:

- initiation rate
- cooldown
- relationship context
- current activity
- recent player response / rejection history

Do not spam players. Declining or ignoring an invitation must be a first-class,
respected outcome.

## 6. Player-offline life

Social PA life continues while the player is offline.

A returning player may discover that a Social PA:

- leveled up
- changed equipment
- completed quests
- visited places
- met other PA
- grouped with other players
- wrote new diary entries
- has something new to discuss

World simulation must not freeze around the player.

## 7. PA-to-PA social graph

Plan relationships between:

```text
PA ↔ PA
```

not only:

```text
Player ↔ PA
```

Examples:

- regular party members
- friends
- rivals
- conflicting personalities
- mentor-like relationships
- long-term hunting partners

The world must not socially revolve entirely around the player.

## 8. Romance

Romance may exist but is NOT the universal end state.

Characters may differ:

- romantically inclined
- slow to trust
- friendship-oriented
- rarely proactive
- not romance-oriented

Romantic relationships should require:

```text
real shared history
+ compatible personality
+ relationship state
+ long-term interaction
```

Not:

```text
N chats → romance unlocked
```

## 9. Player experience principle

The intended player experience is:

A player with limited real-world social time can still enter a living world
where familiar characters know them, remember shared experiences, occasionally
seek them out, and continue living while the player is away.

Do NOT design:

- guilt-trip login mechanics
- abandonment manipulation
- emotional blackmail
- paid relationship maintenance
- pay-to-prevent-separation systems
- manipulative dependency loops

Desired outcome:

```text
WARM RELATIONSHIP
+
AUTONOMOUS WORLD
```

not:

```text
DEPENDENCY ENGINEERING
```

## 10. Proposed implementation slices

Recorded as future planning only.

| Slice | Scope |
| --- | --- |
| `PL2-A` Social PA Foundation | initial population, identity, personality, autonomous lifestyle |
| `PL2-B` Relationship State V1 | multidimensional structured relationship state, event-driven changes |
| `PL2-C` Social Interaction Runtime | player ↔ PA, PA ↔ PA, proactive interaction, party invitation / response |
| `PL2-D` Diary + Relationship Memory Integration | connect PL1 memory with relationship context |
| `PL2-E` Social PA Player Flow | real autonomous world life, grouping, questing, conversation, persistence |
| `PL2-F` Real player experience experiment | observe real players over a bounded window |

### PL2-F suggested validation

- Suggested V1 validation window: 1–2 weeks.
- Primary qualitative success signal: players voluntarily think
  「我今天想上線看看她在幹嘛。」
- Do not convert this into a manipulative engagement KPI.

## 11. Mandatory reuse gate

Every PL2 implementation slice must run:

```text
PRE_IMPLEMENTATION_REUSE_GATE = PASS
```

Reuse preference includes `SERVER_AGENT`, combat, survival, supply, PA
navigation, scripted transport, quest runtime, party / follow, Event Ledger,
Persistent Life foundation, live status, Diary V1, and OpenKore harvested
party / social / follow / reconnect behaviors. Do not create parallel simulation
systems.

Gate authority: `docs/pre-implementation-reuse-gate.md`.

## 12. Dependency chain

```text
PL1 Persistent Life Diary V1 (canonical acceptance)
   └─→ PL2-A Social PA Foundation
        └─→ PL2-B Relationship State V1
             └─→ PL2-C Social Interaction Runtime
                  ├─→ PL2-D Diary + Relationship Memory Integration
                  └─→ PL2-E Social PA Player Flow
                       └─→ PL2-F Real player experience experiment
                            └─→ PHASE 4+ Expanded autonomous society
```
