# NPC and trigger model

## Classification

| class | syntax / source pattern | server behavior | client dependency | Quest Runtime / SERVER_AGENT |
|---|---|---|---|---|
| VISIBLE_NPC | `<map>,<x>,<y>,<dir> script <name> <sprite>,{...}` | clickable NPC object | sprite and click packet | navigate to coordinate, then talk |
| HIDDEN_NPC | sprite `-1` | invisible and unclickable object; can host events | none | only use when a server event explicitly exposes it |
| ONTOUCH_TRIGGER | trigger X/Y plus `OnTouch:` | walking into area runs attached RID script | client movement still needed | `GO_MAP`, movement, then observe event |
| ONTOUCH_ONCE | `OnTouch_:` | one active trigger instance; next character after prior leaves | client movement | avoid assuming every entrant executes it |
| QUEST_TRIGGER | normal NPC or touch label with `setquest` / `checkquest` | mutates quest only when conditions pass | dialogue packets may be required | full NPC flow, not direct quest mutation |
| DIALOGUE | `mes`, `next`, `select`, `menu` | script state machine waits for client responses | yes | `TALK_NPC` and menu selection |
| REAL_WARP | `warp`, `areawarp`, `mapwarp`, `pc_setpos` | server changes authoritative map/position | client receives map/position packets | observe map and coordinates after transfer |
| SCRIPTED_TRANSFER | helper function that calls warp after conditions | same server authority, custom prerequisites | usually yes | trace helper body before modeling |
| SHOP | `shop`, `cashshop`, `npcshop` | server validates prices, zeny, inventory | shop packets | use shop UI or server-approved command path |
| KAFRA | scripts in `npc/kafras/` | save, storage, teleport menu, service rules | dialogue/menu | preserve Kafra flow and storage authority |
| JOB_CHANGE | scripts in `npc/jobs/` | validates job, skill points, quest variables, then changes class | dialogue and class packets | wait for native class and quest state |
| INSTANCE_ENTRY | `instance_create` / `instance_enter` | party-owned map copy and instance NPC lifecycle | map load and packets | model instance ownership and map name |

## Trigger rules

The official command manual states that a trigger area runs `OnTouch:` when present, otherwise starts at the beginning of the NPC script. `OnTouch_:` is the single-instance variant. `OnTouchNPC:` is for monsters. This distinction is server-side; a client navigation hint alone does not execute the trigger.

## Full-scope reading rule

Before classifying an NPC, read its complete block and helper calls. Record trigger type, conditions, quest mutations, dialogue, menu branches, warp calls, follow-up NPCs, and reward logic. One `navigateto()` line cannot establish the NPC's purpose.

## Official examples

- `doc/sample/npc_test_duplicate.txt` for duplicate trigger structure。
- `doc/sample/npc_test_quest.txt` for quest state checks。
- `doc/sample/instancing.txt` for instance entry and instance labels。
- `npc/re/quests/eden/26-40.txt` for a quest board and collection flow。
- `npc/jobs/2-1/blacksmith.txt` for a multi-NPC job quest。
