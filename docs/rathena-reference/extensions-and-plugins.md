# Extensions and plugins

## Finding

`RATHENA_PLUGIN_SYSTEM_EXISTS = PARTIAL`。

Current upstream master (`e985006171d2eb320ee512a653f4c83aea3d81b6`) exposes these supported customization seams:

1. Script-only extension: `npc/custom/` plus an active `.conf` entry.
2. Database import overlay: `db/import/` for custom items, mobs, quests and related data.
3. Simple source customization: `src/custom/`, using `ACMD_FUNC` and `BUILDIN_FUNC` registration.
4. Full source modification: `src/map/`, `src/char/`, `src/common/`, `src/config/` and build files.

The public 2016 wiki folder listing mentions `/src/plugins/`, but the current master API directory listing has `src/custom`, `src/map`, `src/web`, and no `src/plugins`. Therefore the old wiki entry is `HISTORICAL_REFERENCE`, not proof of a current generic plugin loader.

## Classification

| mechanism | current evidence | classification |
|---|---|---|
| NPC / quest script | `npc/`, `doc/script_commands.txt`, `.conf` loader | `SCRIPT_ONLY_EXTENSION` |
| DB import | `db/import/`, `db/readme.md` | `DATA_EXTENSION` |
| custom atcommand | `src/custom/atcommand.inc`, `doc/source_doc.txt` | `SOURCE_LEVEL_EXTENSION` |
| custom script command | `src/custom/script.inc`, `BUILDIN_FUNC` registration | `SOURCE_LEVEL_EXTENSION` |
| source patch / diff | normal C++ source and build system | `SOURCE_LEVEL_EXTENSION` |
| external controller / bot | outside rAthena runtime | `EXTERNAL_TOOL` |
| Hercules plugin API | Hercules ecosystem | `EXTERNAL_TO_RATHENA` |

## Do not confuse

- A forum post calling a `.diff` a plugin is a source patch, not a runtime plugin.
- A `.txt` NPC script is a script extension, not a C++ module.
- Hercules `src/plugins` examples must not be copied as rAthena canonical architecture.
- `OpenKore` is an external controller reference; it is not an rAthena extension mechanism.

## Reuse decision

For a new capability, choose script or DB import first when server authority already exists there. Use `src/custom` for a small command or built-in whose registration seam is documented. Escalate to core source only after the authoritative behavior and `FIRST_BROKEN_TRANSITION` are identified.
