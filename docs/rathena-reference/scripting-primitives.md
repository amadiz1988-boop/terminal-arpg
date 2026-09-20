# Scripting primitives

## Loading and scope

`conf/map_athena.conf` points to a script configuration, normally `npc/(pre-)re/scripts_main.conf`, which includes the selected `scripts_athena.conf`. A `.txt` file has no effect until an active `.conf` entry loads it. Variables are scoped by prefix and execution context; timer/event scripts may run without an attached RID.

## High-value primitives

| purpose | commands / labels | exact reference |
|---|---|---|
| dialogue | `mes`, `next`, `close`, `close2`, `select`, `menu` | `doc/script_commands.txt` dialogue section |
| conditions | `if`, `else`, `switch`, `case`, `goto`, `callsub`, `callfunc` | `doc/script_commands.txt` control flow |
| quest | `setquest`, `checkquest`, `completequest`, `erasequest`, `changequest`, `questinfo` | `quest-automation.md` |
| movement | `warp`, `areawarp`, `mapwarp`, `pcblockmove`, `npcwarp` | `navigation-and-warp.md` |
| map state | `setmapflag`, `getmapflag`, `setmapflagnosave` | `doc/mapflags.txt`, command manual |
| inventory | `countitem`, `getitem`, `delitem`, `checkweight`, `checkweight2` | item DB + script manual |
| combat / spawn | `monster`, `areamonster`, mob event labels | `db/re/mob_db.yml`, `src/map/mob.cpp` |
| timing | `initnpctimer`, `OnTimerXXXX`, `addtimer`, `OnClockXXXX` | `doc/script_commands.txt` event labels |
| instance | `instance_create`, `instance_enter`, `instance_mapname`, `OnInstanceInit`, `OnInstanceDestroy` | `doc/sample/instancing.txt` |
| server events | `OnPCLoginEvent`, `OnPCDieEvent`, `OnInit`, `OnAgitStart` | command manual |

## Variable reminders

- `.@` temporary scope is script execution local.
- `.` NPC scope is shared by that NPC.
- `'` account/character attached scope is persistent according to the script variable model.
- `$` server scope is global and must be treated as shared mutable state.
- `#` and `##` are account/character SQL-backed variables in the documented script model.

Exact prefixes and exceptions are version-sensitive; consult the command manual before generating automation.

## Extension seams

Official simple source customization uses `src/custom/` with `ACMD_FUNC` / `BUILDIN_FUNC` and registration in the relevant arrays. Script-only customization uses `npc/custom/`, `db/import/`, and active `.conf` entries. There is no current master `src/plugins/` directory in the 2026-08-21 upstream tree; the old wiki folder listing is historical evidence only.

## Server authority rule

Script commands can request a state transition, but the map/char server owns validation, persistence, collision, inventory, quest state, and packet emission. Controller code must observe the resulting native state rather than treating command submission as success.
