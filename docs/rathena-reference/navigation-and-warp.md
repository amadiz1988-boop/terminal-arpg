# Navigation and warp

## Server authority versus guidance

| mechanism | authority | movement required | SERVER_AGENT interpretation |
|---|---|---|---|
| normal walk / path | map server collision and pathing | yes | issue movement intent, verify arrival |
| warp NPC / portal | NPC script + map server | yes, to trigger/click | navigate and interact |
| `OnTouch` warp | NPC trigger area + script | yes, into area | enter trigger area, observe transfer |
| `warp` / `areawarp` / `mapwarp` | map server | no after command executes | legitimate only through an authorized script interaction |
| `pc_setpos` / `unit_warp` | map server source API | no | source-level authority, never fake a client-only transition |
| client navigation hint (`navigateto`) | client guidance | usually yes | route hint only; inspect server script |
| map link / portal data | client or map metadata | yes to traverse | feasibility hint, not completion |
| `savepoint` | char/player persistent state | no immediate movement | update save state, then verify native value |
| death / respawn | map + player subsystem | server-selected | observe death and recovery state |
| Fly Wing | item script + map teleport rules | no walking to destination | item use is the player action; destination remains server-selected |
| Butterfly Wing | item script + saved point | no walking to destination | use item, verify savepoint transfer |

## Exact local references

- `src/map/pc.cpp` / `pc.hpp`: player position, save point, death and job state。
- `src/map/unit.cpp` / `unit.hpp`: unit movement and warp helper；current local source documents `pc_setpos` use for player warping。
- `src/map/path.cpp` / `path.hpp`: path feasibility and collision route。
- `src/map/map.cpp` / `map.hpp`: map registration and map flags。
- `doc/script_commands.txt`: `warp`, `savepoint`, `setmapflag`, `setmapflagnosave`, teleport and event semantics。
- `npc/warps/`: actual warp script patterns；read the target file plus any included helper。

## Fake-transition prohibition

Do not mark `GO_MAP` complete when a command was merely queued. Completion requires authoritative map and coordinate observation after the transfer. Do not replace player movement with a fake state mutation when the real flow is a portal, OnTouch, NPC dialogue, or item use.

## Route feasibility checklist

1. Is the target map loaded in the selected Renewal / Pre-Renewal map set?
2. Is the path walkable under current map flags and collision?
3. Is there an NPC, portal, OnTouch area, or item prerequisite?
4. Does the script use a same-map coordinate move or a cross-map transfer?
5. Does the destination differ for savepoint, death, or instance map?
6. After transfer, did the server report the expected map and position?
