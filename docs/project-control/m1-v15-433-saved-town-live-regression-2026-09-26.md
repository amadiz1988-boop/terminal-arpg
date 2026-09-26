# M1 V15 433a3323 Saved Town live regression

Status: Native admission and the previously failed Morocc death-return path passed. Five-map, Settings, capability closure, Heimdall integration, final promotion receipt, and lease release remain pending.

## Provenance and deployment

- Native GitHub main and clean fresh build source: `433a3323efb9eca5c4e0963b9528df6261a3cd76`.
- Config Git blob: `bf8064430a213d3e6caa03fb1868021d27d9dd5b`. Native source and Production materializations have equal content after CRLF normalization. Candidate config and deployed config raw SHA-256 both equal `4A7392E038F4394E5B5CE7F5EB6F3CFD4C1E835D46EEC582DC9EFA608AE6FCF2`; deployment text transform was `NONE`.
- Fresh Release x64 build receipt SHA-256 `69A398275CCA8F3C8104E6508DCE272956FCEA415C4B590EA8EEEC3C7BECF1AC`; 13 build regression groups passed. map-server SHA-256 `AC54B858D7A07515A391ECBC94FBBF7BF69002157CBA371C09A447F03824A740`.
- Same F lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`. Read-only plan passed. Native amendment audit `.local/ro-stack/native-candidate-amendment-869f1725-dbd0-452d-b9dd-37ee79cc3f9a-433a3323efb9.json` has SHA-256 `779B4483777F5600B974121AA329FF86489F5B3F30B861067E3DE96FDFC1BF95`. The predecessor 3678 runtime retired gracefully with no force; active receipt `.local/ro-stack/native-promotion-receipt-433a3323efb9.json` preserves the exact executable and config rollback images.
- Post-deploy receipt records login/char/map each one, OpenKore zero, map PID 39764 and SYSTEM ProcDump attached to the same PID. `/api/health` returned `ok:true`. At the post-test check, map PID 39764 remained alive; the new crash-capture directory contained zero `.dmp` files, and map log had zero `runtime_phase` width errors.

## Normal TEST_PLAYER path

- TEST_PLAYER account 2000163, character 150105, group 0 and `is_test=1`. Normal authenticated `start-farm` from `PERSISTENT_IDLE` at `moc_fild12` returned HTTP 202, Native `CONFIRMED`, authoritative `AUTO_FARM` revision 454. Native map log `20260926-211805-map.out.log` recorded first `AUTO_FARM_TARGET` and `AUTO_FARM_HIT`.
- The same character then had `DEAD_ENTER`, rAthena `RESPAWNED map=morocc x=156 y=46`, and `DEATH_TOWN_MAINTENANCE_REQUIRED town=morocc farm=moc_fild12`. Native recorded Store `NO_OP_NOTHING_TO_STORE`, Sell `NO_OP_NOTHING_TO_SELL`, Supply `NO_OP_ALREADY_SUFFICIENT`, and `DEATH_POST_MAINTENANCE_VERIFY`.
- Native then recorded `AUTO_FARM_RESTORED`, `DEATH_RETURN_ARRIVED map=moc_fild12`, `MAP_REATTACH`, `POST_DEATH_TARGET`, `POST_DEATH_ATTACK`, and authoritative `POST_DEATH_HIT hp=95->84 damage=11`. `DEATH_RETURN_INVALID_CONTEXT` count was zero in this runtime log.
- An explicit normal authenticated `stop-farm` returned PASS while a subsequent death context was active. The first immediate map-change requests received HTTP 409 with the generic Player error. The authenticated farm-map availability read later showed `buttonState=AVAILABLE` and cooldown zero; the same normal request then returned PASS with authoritative arrival and `AUTO_FARM`. Map log revision 461 recorded new `AUTO_FARM_STARTED`, `TARGET` and `HIT hp=77->65 damage=12`, followed by a second normal `stop-farm` PASS. No invalid-context record followed either stop.
- A separate 90-second `combat-cycle` observer started while the character was already in Morocc death recovery, then timed out waiting for a new hit. Its result is FAIL and is not counted as the restart hit proof; the map-server authoritative hit line above is the direct evidence.

## Field Saved Town parity

- Normal Player `world-map-teleport` reached non-MF_TOWN `prt_fild05` at the authored Kafra anchor `(274,243)`; Native recorded `WORLD_MAP_TELEPORT_CONFIRMED` revision 463. Normal Player `set_saved_town` was accepted and Native recorded `SAVED_TOWN_CONFIRMED map=prt_fild05 x=274 y=243` revision 464.
- Pinned Native source `player_saved_town_eligible` uses the same `player_kafra_save_authored` eligibility checked by `set_saved_town`. `handle_m1_farm_supply` now calls `player_saved_town_eligible` for the no-op death path. Source tests include this field hub; a second death cycle was not run for the field hub.

## Remaining fixture state

Legal low-level combat advanced this test character from Base Lv6 to Lv7. The historical fixture preimage remains unchanged as representative EXP evidence. The level-preparation tool was adapted to check a fresh exact offline level preimage and the current approved Native SHA; its bounded unit tests pass. The level-170 fixture and five-map gameplay are not yet accepted.
