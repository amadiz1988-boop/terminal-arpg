# Source map

## Core source ownership

| 行為 | authoritative paths | 代表 symbols / notes |
|---|---|---|
| Script parser / built-ins | `src/map/script.cpp`, `src/map/script.hpp` | `BUILDIN_FUNC`, `run_script_main`, `buildin_setquest`, `buildin_checkquest` |
| NPC registration / events | `src/map/npc.cpp`, `src/map/npc.hpp` | NPC objects, event labels, `npc_touchnext_areanpc` |
| Player state / warp | `src/map/pc.cpp`, `src/map/pc.hpp` | `pc_setpos`, quest log, save point, job state |
| Unit movement / touch | `src/map/unit.cpp`, `src/map/unit.hpp` | walk, area trigger, `unit_warp` |
| Path feasibility | `src/map/path.cpp`, `src/map/path.hpp` | walkability and route calculation |
| Map state / flags | `src/map/map.cpp`, `src/map/map.hpp`, `doc/mapflags.txt` | map registry, map flags, map indices |
| Quest subsystem | `src/map/quest.cpp`, `src/map/quest.hpp` | quest DB loading, progress and completion data |
| Combat / attribution | `src/map/battle.cpp`, `src/map/mob.cpp`, `src/map/status.cpp` | damage, kill attribution, status effects |
| Skills | `src/map/skill.cpp`, `src/map/skills/` | cast, requirements, implementation classes |
| Inventory / item DB | `src/map/itemdb.cpp`, `src/map/itemdb.hpp`, `db/re/item_db*.yml` | item properties, scripts, restrictions |
| Storage / Kafra | `src/map/storage.cpp`, `src/map/storage.hpp`, `npc/kafras/` | container authority and Kafra UI script |
| Trade / shop / vending | `src/map/trade.cpp`, `src/map/vending.cpp`, `npc/merchants/` | player trade and vendor authority |
| Client packets | `src/map/clif.cpp`, `src/map/clif.hpp`, `doc/packet_client.txt` | client-facing transport, never the game rule authority |
| Character persistence | `src/char/`, SQL schema under `sql-files/` | char-server persistence and inter-server transport |
| Config / script loading | `conf/map_athena.conf`, `npc/re/scripts_athena.conf`, `npc/pre-re/scripts_athena.conf` | loaded script graph |

## DB ownership

| Data | Renewal | Pre-Renewal / custom |
|---|---|---|
| Quest metadata | `db/re/quest_db.yml` | `db/pre-re/quest_db.yml`, `db/import/quest_db.yml` |
| Mob / kill target | `db/re/mob_db.yml` | corresponding `db/pre-re/`, import overlay |
| Item / drop / item script | `db/re/item_db*.yml`, `db/re/item_group_db.yml` | corresponding pre-re/import |
| Skills | `db/re/skill_db.yml`, `db/re/skill_tree.yml` | corresponding pre-re/import |
| Maps / map index | `db/re/map_index.txt`, map cache and `db/` maps | pre-re/import where present |
| Instance definitions | `db/re/instance_db.yml` | pre-re/import where present |
| Constants | `db/const.yml` | shared unless branch-specific |

## Script tree map

- `npc/re/quests/`：Renewal official quest scripts。
- `npc/pre-re/quests/`：Pre-Renewal quest scripts。
- `npc/jobs/`：job change scripts and job quest flows。
- `npc/re/quests/eden/`：Renewal Eden flows; current master loader is `npc/re/scripts_athena.conf`。
- `npc/warps/`：portal and warp scripts; a warp file can still include dialogue or conditions。
- `npc/kafras/`：Kafra scripts and storage / save interactions。
- `npc/merchants/`：official shops and merchant definitions。
- `doc/sample/`：official examples such as `npc_test_quest.txt`, `instancing.txt`, `npc_test_setmapflag.txt`。
- `npc/custom/`：custom scripts; loading requires an explicit `.conf` entry。

## Authority warning

`navigateto()` or a client navigation hint is not proof of a server transfer. Confirm the complete NPC block, trigger label, condition, quest mutation, warp command, and resulting server-side map state.
