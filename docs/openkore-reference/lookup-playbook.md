# OpenKore Reference Lookup Playbook

Use the smallest exact reference first. Record the first broken transition
before proposing implementation.

| Symptom | Lookup order |
|---|---|
| 角色找不到怪 | `combat-and-targeting.md` -> topics `07/08/09/12` -> rAthena monster state |
| AUTO_FARM 沒繼續 | `01/06/23/24/40` -> project Last-Good -> current PA lifecycle |
| Supply 卡住 | `supply.md` -> `navigation.md` -> `configuration.md` -> `recovery.md` |
| NPC 對話卡住 | `npc-dialogue.md` -> `25/31/32` -> project phase owner |
| Quest 不會跑 | Quest Flow First -> `project-last-good-map.md` -> `quest-automation.md` -> rAthena script/state |
| Fly Wing roaming | `teleport.md` -> `combat-and-targeting.md` -> `recovery.md`; implementation is out of scope here |
| 死亡後不恢復 | `recovery.md` -> `23/24/40` -> Gate 1B evidence -> native respawn state |
| 路線跨圖失敗 | `navigation.md` -> `04/05/43` -> Gate 3 map evidence |
| 拾取後不打怪 | topics `13/15` -> `09/10` -> inventory and target event |
| 商店交易未完成 | `supply.md` -> topics `17/18/20/22` -> authoritative inventory/Zeny |
| 對話重複觸發 | `npc-dialogue.md` -> `macro-eventmacro.md` -> ownership, run-once and timeout |
| 重連後狀態錯誤 | `recovery.md` -> topic `40` -> persisted intent and authoritative reconciliation |

## Evidence order

```text
OpenKore Reference Atlas
-> Project Last-Good
-> rAthena Reference Atlas
-> current authoritative source
-> first broken transition
-> reuse classification
```

`UNKNOWN` stays unknown. Current PA code is not automatically canonical. A
source or unit test result is separate from backend, browser and player-flow
acceptance. If a required evidence layer is absent, report
`【資料不足，無法確認】`.

## Deviation record

When PA diverges from a mature behavior, record:

```text
WHY_DEVIATE =
WHAT_IS_BETTER =
SERVER_AUTHORITY_PRESERVED =
REGRESSION_RISK =
RESULT_EQUIVALENT_OR_BETTER =
```
