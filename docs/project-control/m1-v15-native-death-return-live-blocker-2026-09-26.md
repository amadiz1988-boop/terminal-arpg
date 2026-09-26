# M1 V15 Native death-return live blocker

Status: `BLOCKED_NATIVE_AUTHORITY_AND_RUNTIME_INCIDENT`. This is an acceptance record, not a release receipt. The five-map live count is `0/5`; arrival and `AUTO_FARM_STARTED` alone do not establish `HIT`.

## Exact precondition and test acceleration

- Lease: `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`, owner `F｜M1 最終整合`.
- Production Native `668bb9db42dd4bb9cf7651c5c1e40c95531ada35`; Production Web `1346bd0561194da63de5132f9ea11ec820f703e7`.
- TEST_PLAYER account `2000163`, character `150105`, database group `0`, `is_test=1`. Native map login emitted `Group '0'`. The fixed Native `M1_FLY_SUPPLY_V1` prerequisite command was later `CONFIRMED`, whose admission requires resident `sd->group_id == 0` and `is_test=1`.
- Normal authenticated Player `/api/grind-target` on `moc_fild12` increased authoritative Base EXP `2503 -> 2664` and Job EXP `2551 -> 2635` before acceleration.
- GitHub source checkpoint `3e0773cc88cb0ed4039689dd4a8571c9a0aba270` added a lease-bound, test-only fixture helper and exact preimage. Its read-only preflight passed. The helper changed only class `0 -> 4190`, Base Lv `6 -> 170`, and Base EXP `2664 -> 0` while Native was stopped, then reloaded the canonical runtime. Player live readback confirmed Lv170, class4190, source `rathena.persistent_agent.live_status`. No Player API, level gate or gameplay authority was changed.

## Live transition

1. Normal Player request to `ver_eju`: `world_map_teleport` command `32ec90b6-5456-4981-b5a3-6492684d1115` was `CONFIRMED`, followed by `AUTO_FARM_STARTED`. The character arrived with `66/4982` HP, entered recovery, died before TARGET, and rAthena respawned at saved Morocc `(156,46)`. Combat HIT was not observed.
2. Normal Player `stop_farm` command `c441eddd-8273-4a6f-b2cf-fced3f931938` was `CONFIRMED`, mode `PERSISTENT_IDLE`.
3. Bounded Native test fixture `M1_FLY_SUPPLY_V1` command `823b52eb-4c9a-461b-a88e-7389043a17ee` was `CONFIRMED` with `PREREQUISITES_READY`; it healed to full HP and provided its fixed prerequisites. This was setup only.
4. Second normal Player `ver_eju` request: `world_map_teleport` command `84b465d4-5140-4133-899f-1c2eedddab70` and subsequent `start_farm` were `CONFIRMED`. Native logged `DEATH_STORE_STAGE=NO_OP_NOTHING_TO_STORE`, `DEATH_SELL_STAGE=NO_OP_NOTHING_TO_SELL`, `DEATH_SUPPLY_STAGE=NO_OP_ALREADY_SUFFICIENT`, then `M1_FARM_SWITCH_BLOCKED ... reason=DEATH_RETURN_INVALID_CONTEXT` at revision416. Mode converged to `PERSISTENT_IDLE` without TARGET or HIT.
5. `src/map/persistent_agent.cpp` executes the death-return service-validity block before the no-service finish branch. The precise cause of the persisted death-return context requires Native owner review. No Native source was edited in this run.

`FIRST_BROKEN_TRANSITION = Native accepted start_farm -> death-return maintenance context -> AUTO_FARM combat`. Subsequent `persistent_agent_live_status` upserts failed with `Data too long for column 'runtime_phase' at row 1` while exporting `DEATH_RETURN_INVALID_CONTEXT`; Player world-map return and Butterfly Wing were rejected before command creation because their read model was stale. This is a second observed `Native state projection -> Dashboard Controller` break. SQL errors and the later crash are temporally associated; crash causality remains `UNKNOWN` pending dump analysis.

## Safe stop and runtime incident

- The fixture restore command completed: class `4190 -> 0`, Base Lv `170 -> 6`, Base EXP restored from the offline preimage. The restored character remained `PERSISTENT_IDLE` on `ver_eju` `(210,96)` with Morocc saved point. Inventory, Zeny, map and normal gameplay effects were not rolled back; exact game-state restoration is `PARTIAL`.
- Read-only economy eligibility after restore: account `2000163`, group `0`, `isTest=true`, `PERSISTENT_IDLE`, no active command, Zeny `8370`.
- Following the restore reload, map-server PID `27496` logged a crash signal at local `2026-09-26 17:38:42`. Current `/api/health` returned HTTP200 with `ok:false`; login, char, Dashboard and DB listeners were present, map listener absent. `FINAL_RUNTIME_HEALTH = FAIL`.
- ProcDump captured `C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\crash-capture\canonical-map-27496-20260926-093744\map-server.exe_260926_173842.dmp`, 520931166 bytes, SHA-256 `C43EAD8EE4954FDE606DD31F5D24676FF4C8FD73EBE94A74EA0193C91B5D9FCF`. Map error log `20260926-173730-map.err.log` SHA-256 `BF885C37CA291524732379F3C701F6F75C202803744EE0B1AF0645FF467E3443`.
- No restart, deployment, Native source edit, schema change, final receipt or lease release followed this incident.

## Gate

`VER_EJU_LEVEL_GATE = PASS` for the normal level170 Player request. `VER_EJU_LIVE = FAIL`, `FIVE_MAP_LIVE_PASS_COUNT = 0`. Other four maps, Browser Settings persistence and runtime-effect acceptance, capability final reconciliation and Heimdall final amendment were not run after the Native stop condition. `LIVE_NATIVE_DEATH_RESPAWN` has direct saved-Morocc evidence, while the broader maintenance/return lifecycle failed.

Owner: Native/PA and runtime incident recovery. Next: preserve and analyze the dump, repair the Native death-return/projection failure at canonical source, restore one healthy canonical runtime through the approved incident procedure, return the isolated TEST_PLAYER to a safe town through a legal path, then rerun bounded five-map and subsequent gates. Final promotion remains open under the same lease.
