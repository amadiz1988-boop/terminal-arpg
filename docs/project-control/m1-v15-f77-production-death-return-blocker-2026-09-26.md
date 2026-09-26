# M1 V15 f77 Production death-return live blocker

Status: `BLOCKED` at `DEATH_RETURN_SHORTEST_LIVE_REGRESSION`. This is a Production observation under the existing F promotion lease. Five-map and subsequent functional acceptance did not proceed; no final promotion receipt was created.

## Recovery and admission

- The original map-server crash dump remains present with SHA-256 `C43EAD8EE4954FDE606DD31F5D24676FF4C8FD73EBE94A74EA0193C91B5D9FCF`.
- Controlled migration 013 widened `persistent_agent_live_status.runtime_phase` from `VARCHAR(24)` to `VARCHAR(64)` under the F lease. Its receipt is `.local/ro-stack/schema-migration-869f1725-dbd0-452d-b9dd-37ee79cc3f9a-013-persistent-agent-runtime-phase-width.json`, SHA-256 `80AA6E8AEBDC2FF0EAAC0142B378241FFA20E6B7DCE4EC32C69FC87974B28A16`. All 22 pre-existing live-status rows and their all-row hash were preserved.
- Fresh GitHub Native source `f77df6251c1b5793a85ae2b313228f1e36a609a9` was deployed through the same lease. The deployed map binary SHA-256 is `F80EA8674921882748220AAED51E16AB500FDC2DB7C6A001CFB6759D6668EA07`; the command contract JSON is semantically equal to the source-root contract with SHA-256 `4DA600DCF955D3510EE1289C0F28D257D1D5C1BAB03D90B9E28DCEC3789E73A0`. Native receipt: `.local/ro-stack/native-promotion-receipt-f77df6251c1b.json`.
- After recovery, login/char/map, Dashboard and DB were each present once; OpenKore runtime count was zero. SYSTEM ProcDump was bound to new map PID 39128. The new crash-capture directory contained zero dumps at the final check. No `runtime_phase` width write error was observed in the new map error log.

## TEST_PLAYER live sequence

1. At startup, TEST_PLAYER `2000163/150105`, Base Lv6, group 0 and `is_test=1`, reached Morocc Saved Town but retained a blocked death-return bundle. A legitimate authenticated support-session route through `moc_fild12` and Native-confirmed `stop_farm` cleared it. Authoritative state became `PERSISTENT_IDLE`, `runtime_phase=IDLE`, no target rules and no `_pendingFarmSwitch`. This support step is recovery evidence only.
2. The ordinary TEST_PLAYER `/api/account` login, with no Support Session, confirmed char 150105. Normal `POST /api/grind-target` to level-eligible `moc_fild12` returned 202; Native `world_map_teleport` confirmed arrival and resumed `AUTO_FARM`.
3. New map-server log `20260926-192737-map.out.log` recorded authoritative `AUTO_FARM_TARGET`, `AUTO_FARM_ATTACK` and `AUTO_FARM_HIT`, including monster HP `70→57` with damage 13. It then recorded `DEAD_ENTER`, rAthena `RESPAWNED` at Morocc `(156,46)`, and `DEATH_TOWN_MAINTENANCE_REQUIRED` for `moc_fild12`.
4. After bounded natural HP recovery, Native emitted `DEATH_STORE_STAGE=NO_OP_NOTHING_TO_STORE`, `DEATH_SELL_STAGE=NO_OP_NOTHING_TO_SELL`, `DEATH_SUPPLY_STAGE=NO_OP_ALREADY_SUFFICIENT`, then `M1_FARM_SWITCH_BLOCKED ... reason=DEATH_RETURN_INVALID_CONTEXT` at revision 434. No farm return or post-return HIT occurred. The separate `combat-cycle` observer timed out after earlier HITs; its late observation window does not negate the authoritative pre-death HIT log.
5. A subsequent `start_farm` appeared at revision 436 without a manual F start request, followed by another real death and Morocc respawn. The dispatch origin has not been classified. F sent normal authenticated TEST_PLAYER `stop_farm`; command `c334f373-9a6a-4782-8047-56af0b689ad0` was Native `CONFIRMED`. Final authoritative state at revision 437: Morocc, `PERSISTENT_IDLE`, `runtime_phase=IDLE`, empty target map/rules, no `_pendingFarmSwitch`, Base Lv6, group 0, `is_test=1`.

## First broken transition and owner

`FIRST_BROKEN_TRANSITION = authoritative Saved Town arrival → Native death-maintenance service validation`. In pinned Native source `src/map/persistent_agent.cpp`, `m1_town_services` contains seven towns and omits the canonical Morocc Saved Town. `handle_m1_farm_supply` requires `town != nullptr` in `service_valid` for death recovery even when Store, Sell and Buy all have no-op results; this check precedes the no-service `m1_switch_finish_services` branch. The observed `DEATH_RETURN_INVALID_CONTEXT` is therefore explained by the current source and live sequence. `OWNER = D / Native`. The separate revision-436 start origin remains `UNKNOWN`.

The task's explicit stop condition applies. F did not edit Native gameplay source, run the five high-level maps, reprepare Lv170, deploy Web/Heimdall, release the lease, or sign a final receipt. The next authorized step is a bounded Native owner fix and source regression for Morocc no-service death return, followed by a fresh controlled candidate and the same shortest Production gate before five-map acceptance.
