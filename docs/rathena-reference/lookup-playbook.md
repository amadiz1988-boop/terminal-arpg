# Lookup playbook

## Two-minute triage

| symptom / question | first exact lookup | then |
|---|---|---|
| Quest ID 是什麼？ | `db/re/quest_db.yml` | grep ID through `npc/re/quests/`, then read full script scope |
| NPC 沒反應？ | NPC file + trigger label | `doc/script_commands.txt` OnTouch rules, loaded `.conf`, map coordinates |
| 踩點為什麼傳送？ | NPC block around `OnTouch` / `OnTouch_` | `warp` / `pc_setpos` call and map flags |
| 角色為什麼換地圖？ | script `warp` / `mapwarp` / `pc_setpos` | `src/map/pc.cpp`, `src/map/unit.cpp`, resulting map state |
| Job Change 怎麼完成？ | `npc/jobs/` | quest IDs, skill-point gate, `Job_Change`, completion and rewards |
| Eden 怎麼接？ | `npc/re/quests/eden/` + `npc/re/scripts_athena.conf` | selected Renewal branch, quest DB, item prerequisites |
| Kafra 怎麼存倉？ | `npc/kafras/` | `src/map/storage.cpp`, item trade restrictions, packet flow |
| Shop 買賣不對？ | `npc/merchants/` | item DB price/restrictions, `src/map/vending.cpp` / trade |
| Fly Wing / Butterfly Wing？ | item script in `db/re/item_db_usable.yml` | `pc.cpp` savepoint/teleport and map flags |
| Instance 進不去？ | `db/re/instance_db.yml` + `doc/sample/instancing.txt` | `instance_create`, `instance_enter`, party ownership |
| 怪物擊殺沒有 quest progress？ | quest DB target + `src/map/quest.cpp` | mob location/filter, kill attribution, script prerequisite |
| SERVER_AGENT 不會某功能？ | this Atlas | Project Last-Good, then native rAthena seam, then current PA seam |

## Anti-loop checklist

1. Search `docs/rathena-reference/reference-index.yml` by keyword.
2. Search exact local path with `rg`.
3. Check selected branch and commit.
4. Read authoritative source and complete script scope.
5. Compare Project Last-Good.
6. Record `REFERENCE_CONFLICT` or `DISCOVERED_IMPLEMENTATION_GAP` without implementing it in a research task.

## Evidence labels

Use `RATHENA_AUTHORITATIVE_SOURCE`, `RATHENA_OFFICIAL_DOC`, `RATHENA_OFFICIAL_SAMPLE`, `RATHENA_FORUM_REFERENCE`, `COMMUNITY_SCRIPT`, `PLAYER_FLOW_REFERENCE`, `PROJECT_LAST_GOOD`, `OPENKORE_REFERENCE`, and `UNVERIFIED_REFERENCE` exactly. Add `VERSION_CONFIDENCE = LOW` when branch/date cannot be confirmed.
