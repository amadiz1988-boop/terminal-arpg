# Quest automation reference

## Authority model

Quest metadata comes from `db/re/quest_db.yml` or the selected pre-re/import overlay. NPC scripts decide when a quest is accepted, progressed, completed, rewarded, or branched. `src/map/quest.cpp` and `src/map/script.cpp` implement persistence and command semantics; the client Quest Window is presentation and transport.

## Command semantics

| command | confirmed use | automation implication |
|---|---|---|
| `setquest <id>` | creates/activates the quest entry; official samples and job/Eden scripts use it | observe rAthena state after NPC interaction |
| `checkquest(<id>)` | returns quest state; optional `HUNTING` and `PLAYTIME` modes are documented | use as read condition, never assume a local mirror is authoritative |
| `completequest <id>` | marks a quest complete | completion must follow the NPC script's real branch |
| `erasequest <id>` | removes the quest entry | do not treat absence as completion |
| `changequest <old>,<new>` | transitions one quest entry to another | preserve exact chain ordering |
| `questinfo` | adds client quest-log display condition/icon | presentation hint, not a server-side completion |
| `getquestinfo` | reads quest metadata/progress | use for diagnostics and read models |

Local sample `doc/sample/npc_test_quest.txt` explicitly demonstrates `-1` not started, `1` active, `2` finished, and `checkquest(id,HUNTING) == 2` for all targets killed. Exact return details remain version-sensitive and must be checked against the current `doc/script_commands.txt`.

## Quest metadata and objective types

Current `quest_db.yml` supports title, time limit, monster targets with count/id/race/size/element/level/location filters, displayed map name, map-specific target names, and item drop targets with item/count/rate. A script may still add inventory checks or custom variables outside this metadata.

## Flow patterns

| flow | canonical example | generic primitive mapping |
|---|---|---|
| NPC dialogue chain | `npc/jobs/2-1/blacksmith.txt` | `GO_NPC`, `TALK_NPC`, `DIALOG_NEXT`, `DIALOG_MENU_SELECT` |
| kill-count quest | `doc/sample/npc_test_quest.txt`, Eden quest scripts | `GO_MAP`, `FARM_UNTIL`, `WAIT_QUEST_STATE` |
| item collection | `npc/re/quests/eden/26-40.txt` | `COLLECT_ITEM`, `TALK_NPC`, `WAIT_QUEST_STATE` |
| OnTouch quest trigger | `doc/script_commands.txt` labels and battleground samples | `GO_MAP`, `WAIT_QUEST_STATE` |
| job change | `npc/jobs/` | `TALK_NPC`, `ALLOCATE_SKILL`, `WAIT_QUEST_STATE` |
| instance quest | `doc/sample/instancing.txt`, `db/re/instance_db.yml` | `GO_NPC`, `DIALOG_MENU_SELECT`, instance-scoped `GO_MAP` |

## Required source checks

1. Find quest ID in the selected branch's quest DB.
2. Find every script reference to that ID.
3. Read the full NPC scope, including labels and helper functions.
4. Trace prerequisites, item checks, map changes, kill/drop attribution, and reward.
5. Confirm the loaded `.conf` path and Renewal / Pre-Renewal variant.
6. Observe native quest state after each authoritative transition.

## Project Last-Good mapping

- Eden Course A mapping and source choice: `docs/EDEN_EQUIPMENT_SOURCE_DECISION.md`。
- Next-tier quest source map: `docs/eden-next-tier-source-audit.md`。
- Generic job adapter contract: `docs/JOB_QUEST_ADAPTER_CONTRACT.md`。
- Existing typed sequence: `ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json`。

These documents record project history and adapter seams. They do not replace native rAthena quest state. Historical runtime evidence is scoped to isolated or allowlisted runs and must not be generalized to all quests.

## Common misunderstandings

- Quest ID in a Dashboard request does not advance rAthena state.
- `setquest` does not prove prerequisites, movement, combat, or reward correctness.
- A `questinfo` marker does not implement a quest.
- Item possession checks can be script-local even when the quest DB has no item objective.
- An Eden script loaded in `scripts_athena.conf` is authoritative only for that selected server generation.
- `UNKNOWN` source mapping means more lookup is required; it does not prove rAthena lacks the feature.
