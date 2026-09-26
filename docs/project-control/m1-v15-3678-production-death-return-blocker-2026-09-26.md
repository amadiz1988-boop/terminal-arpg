# M1 V15 3678 Production death-return blocker

Status: `BLOCKED` at `DEATH_RETURN_NOOP_PRODUCTION_ACCEPTANCE`. The same F lease remains active. No five-map, Lv170, Settings, Heimdall, Web deployment, final promotion receipt, or lease release followed this failure.

## Controlled deployment and health

- Governance checkpoint `95c58445ed92f40e8bf17c9ee19ef7f8cffa630f` reached GitHub main. Fresh clean Native source `3678ed862a6562ed17d24557ff0a55b297b57740` passed its 13/13 build tests and the candidate preparation's 17 regression groups. The read-only plan passed under lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`, owner `F｜M1 最終整合`.
- Same-lease Native amendment audit: `.local/ro-stack/native-candidate-amendment-869f1725-dbd0-452d-b9dd-37ee79cc3f9a-3678ed862a65.json`, SHA-256 `3DE069E296D924340A9472D3F351B7A7D5D76C09577ED861CBE1E4E6A7A46705`. The existing tool retired the prior runtime gracefully without forced termination and deployed the three fresh binaries and the frozen config without text transformation. Active Native receipt: `.local/ro-stack/native-promotion-receipt-3678ed862a65.json`.
- Production map executable SHA-256 `1FF0338C5F05736ADA465B4672176A6263809B71463B6F9FC67CA71AA6B4739F`; config SHA-256 `4A7392E038F4394E5B5CE7F5EB6F3CFD4C1E835D46EEC582DC9EFA608AE6FCF2`. Its archived exact preimage is SHA-256 `4DA600DCF955D3510EE1289C0F28D257D1D5C1BAB03D90B9E28DCEC3789E73A0`. `verifyNativeStage` returned `pass=true`, `rollbackReady=true`, `nativeStage=true`.
- Post-deploy runtime snapshot: login/char/map each one, map PID 21548, Dashboard PID 27952, DB PID 22792, OpenKore 0. ProcDump `ATTACHED` to map PID 21548; the new capture directory contained zero `.dmp` files at check. `/api/health` returned `{ "ok": true }`. New map error log contained zero `runtime_phase` width errors. Migration 013 receipt records width 24 to 64; no migration was reapplied in this continuation.

## Ordinary TEST_PLAYER sequence

1. TEST_PLAYER 2000163/150105, Lv6, started at Morocc in `PERSISTENT_IDLE`. Normal authenticated `change-farm-map` to `moc_fild12` passed all runner transitions. Native map log `20260926-204306-map.out.log` recorded `AUTO_FARM_HIT`, including monster HP `70→57`, damage 13. The bounded `combat-cycle` observer also passed authoritative combat observation; fixture Life ledger remained `EXPECTED_EXCLUSION`.
2. Native logged `DEAD_ENTER`, rAthena `RESPAWNED ... map=morocc x=156 y=46`, then `DEATH_TOWN_MAINTENANCE_REQUIRED ... town=morocc farm=moc_fild12`.
3. At HP `53/66`, Native logged `DEATH_STORE_STAGE=NO_OP_NOTHING_TO_STORE`, `DEATH_SELL_STAGE=NO_OP_NOTHING_TO_SELL`, `DEATH_SUPPLY_STAGE=NO_OP_ALREADY_SUFFICIENT`, immediately followed by `M1_FARM_SWITCH_BLOCKED ... reason=DEATH_RETURN_INVALID_CONTEXT ... revision=446`. No death-return `RETURN_PENDING` or death-owner return confirmation was observed.
4. Later `WORLD_MAP_TELEPORT_CONFIRMED ... revision=447` and `AUTO_FARM_STARTED ... revision=448` occurred after the block. Their dispatch origin was not established in this test; subsequent HITs are not counted as death-return recovery. Normal authenticated `stop_farm` passed with trace `scenario-stop-farm-0658aa3c-5552-4f8c-9d05-2701e983282c`; Player state converged to `PERSISTENT_IDLE` at `moc_fild12`, revision 449.

## First broken transition

`FIRST_BROKEN_TRANSITION = authoritative Morocc Saved Town respawn → Native no-op death-maintenance service validation`. In pinned source `src/map/persistent_agent.cpp`, death entry uses `player_saved_town_eligible`, which accepts `MF_TOWN` **or** an authored Kafra save point. The new `no_op_death` path sets `service_valid` to `saved_town_valid`, whose definition requires `saved_town->getMapFlag(MF_TOWN)` and current map equality. `npc/mapflag/town.txt` contains no `morocc` entry; `npc/scripts_mapflags.conf` loads that mapflag file. The source and live rejection align. The exact mapflag state should be verified by Native owner before a fix; no gameplay source was edited by F.

`OWNER = D / Native`. The task's explicit `death-return still fails` stop condition applies. `3678ed86` remains deployed and healthy; the F lease, legacy baseline and OPEN drift remain held. The next action is a bounded Native source correction to the no-op validation parity, source regression, fresh GitHub candidate, then this same shortest live death-return acceptance before five maps.
