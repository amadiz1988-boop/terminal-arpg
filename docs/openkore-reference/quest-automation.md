# Quest Automation Reference

## Hard separation

OpenKore supplies primitives: move, route, talk, dialogue, item use, combat,
quest observation, macro and event hooks. The project supplies custom quest
logic in `ops/ro-stack/openkore-plugins/status-export/status-export.pl`, notably
`process_onboarding`, `process_onboarding_dialog`, `process_eden`,
`process_eden_dialog`, `process_eden_supply`, `process_job_resume` and
`process_job_death`. These functions are project logic, not upstream OpenKore
capability.

## Phase model

```text
server quest observation
-> phase selection
-> route / NPC / item / combat primitive
-> authoritative observation
-> next phase, bounded retry or terminal failure
```

Historical onboarding covers island, Izlude, academy, item use, skill points,
graduation and return to hunt. Historical Eden covers enrollment, equipment
12/26/40, hunt stages, HP recovery, supply, reward and return. Each flow clears
or restores background AI around owned actions.

## Quest Flow First boundary

Normal-player flow understanding remains mandatory. Quest IDs, item counts and
dialogue stages are observations, not authority. rAthena scripts and quest
state decide legal progression. `web_quest_runtime` stores PA phase state and
revision; it does not replace rAthena quest state.

## Current mapping

`ADAPT`: phase-owned route/dialogue/item/combat primitives.
`REPRODUCE`: server-state observation, bounded retry, death and supply resume.
`IMPROVE`: persisted phase, event ledger, idempotent restart and direct server
authority.
`REJECT_LEGACY`: copying a plugin interpreter or treating a macro path as a
complete quest solver.

Historical source and quest-content specs do not automatically equal
`PLAYER_FLOW_PASS`. Where the current status is not proven, report
`【資料不足，無法確認】` and preserve the gap.
