# rAthena Server-Side Auto Combat Reference

```text
TOPIC_ID = RATHENA_SERVER_SIDE_AUTOCOMBAT
REFERENCE_CHECKPOINT = 961ac3c
CLASSIFICATION = ADAPT
RATHENA_MATURE_FLOOR = SAME_MAP_SERVER_SIDE_COMBAT
REFERENCE_IS_FLOOR_NOT_CEILING = YES
CURRENT_VERSION_APPLICABILITY = PARTIAL
```

This file preserves the accepted result of the research checkpoint `961ac3c`.
The public mature floor covers server-side target and retarget, pathing, attack,
skill, buff, potion, loot, teleport, death handling and selected partial-offline
behavior. These are attributed public capability claims, not current Project
runtime certification.

Public evidence does not establish an end-to-end cross-map Supply journey,
return-to-farm or automatic resume after Supply:

```text
CROSS_MAP_SUPPLY_PUBLIC_EVIDENCE = NO_PUBLIC_EVIDENCE
RETURN_TO_FARM_PUBLIC_EVIDENCE = NO_PUBLIC_EVIDENCE
AUTO_RESUME_AFTER_SUPPLY_PUBLIC_EVIDENCE = NO_PUBLIC_EVIDENCE
NO_PUBLIC_EVIDENCE != NOT_SUPPORTED
NO_PUBLIC_EVIDENCE != PASS
```

Project use is bounded to a staged Local Hunting executor. PA retains intent,
journey, interruption, resume, Supply, return-to-farm, Quest, Social, Life,
reconnect and recovery ownership. Current authoritative rAthena source and
Project Last-Good always win over forum claims or stale patches.

Full accepted evidence remains traceable through:

```text
git show 961ac3c:docs/reference-mining/topics/rathena-server-side-autocombat.md
git show 961ac3c:docs/reference-mining/rathena-autocombat-capability-matrix.yml
git show 961ac3c:docs/reference-mining/rathena-autocombat-vs-project-pa.md
```
