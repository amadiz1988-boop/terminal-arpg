# M1 V15 final acceptance: fixture economy boundary

Task: `M1_FIRST_GITHUB_FIRST_PROMOTION_FINAL_ACCEPTANCE_V15`.
Status: `BLOCKED` at live Inventory Maintenance Store/Sell acceptance. This record does not authorize final promotion.

## Last-good and bounded closure

- Canonical Native GitHub SHA `ebb54ccd4bd0158806454df74f558a8c4e08fa24` passed a fresh Release x64 build and 13 candidate checks. The same F lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a` deployed it with a graceful retirement receipt at `.local/ro-stack/native-promotion-receipt-ebb54ccd4bd0.json`.
- The exact five-field `start_farm` contract delta passed a read-only preflight and was installed with receipt `.local/ro-stack/native-start-farm-service-contract-869f1725-dbd0-452d-b9dd-37ee79cc3f9a-ebb54ccd4bd0/receipt.json` (SHA-256 `D1E3B59DAB13E307FA6A8179136968553DED99DBE878741AA4E892AB44DB4C70`). The subsequent same-lease graceful cycle passed.
- Authenticated TEST_PLAYER 150105 `change-farm-map` to its current `prt_fild08` passed: `start_farm` command `08e0969b-c7eb-467f-8daf-d6db5e4bf953` was `CONFIRMED`; authoritative mode became `AUTO_FARM`.
- Native recorded `M1_FARM_SUPPLY_ACCEPTED` for `SUPPLY_ITEM_LOW`, Saved Town service, `SUPPLY_RETURN_TELEPORT_CONFIRMED` to `prt_fild08`, `POST_RELOCATION_TARGET`, `POST_RELOCATION_ATTACK`, and `POST_RELOCATION_HIT` with monster HP `59→45`, damage `14`.
- Native six-field live projection was sampled at `7/100` slots, `510/20300` weight, `supplyRequired=true`, `SUPPLY_ITEM_LOW` in Saved Town; after return it showed `10/100`, `7270/20300`, `supplyRequired=false`.

## First broken transition

TEST_PLAYER 150105 cannot prove live Sell. Native `m1_sell_candidate` calls `m1_safe_sell_slot` → `pc_can_sell_item` → `pc_can_give_items`. `src/map/pc.cpp` requires `test_fixture_economy_admitted(account_id)`; `src/map/test_fixture_economy.hpp` rejects an account whose `web_account_flags.is_test` is true. The fixture is classified as TEST_PLAYER in `docs/project-control/m1-v15-settings-fixture-preflight.md`. An explicit SELL rule for naturally looted item 915 and a seven-slot trigger produced no sale; item 915 remained in inventory and Zeny remained 9000. This is an intentional economy isolation boundary. No bypass or test-flag change was made.

The same character also produced `storage=0` with an explicit STORE rule. Source `m1_storage_candidate` requires `m1_storage_openable`, whose gate is NV_BASIC level 6 or SU_BASIC_SKILL level 1. The live skill level was not sampled, so the exact Store rejection reason remains unconfirmed. Neither Store nor Sell is marked live PASS.

## Fixture cleanup and release state

- The temporary Player config was restored by authenticated `/api/config` revision 4: `supply.enabled=false`, `inventorySlotTrigger=99`, and the explicit item-915 row removed. Native `configure_supply_policy` confirmed it.
- Authenticated `stop_farm` command `e14e0068-493e-4575-80f1-8ab0ee3d9459` was `CONFIRMED`; TEST_PLAYER 150105 returned to `PERSISTENT_IDLE`.
- Runtime health sampled all five listeners healthy; quarantine count was zero. OpenKore runtime was not started.
- First promotion remains `FIRST_PROMOTION_NATIVE_STAGE_COMPLETE`, baseline `LEGACY_PRE_GITHUB_FIRST`, drift `OPEN`, and the F lease remains `ACTIVE`. No final receipt was written and no lease release was attempted.
- The 12 Settings effects, 38-capability recalc, Desktop/mobile World Map, and teleport audio still lack the requested final Production acceptance. No Browser session was available at the time of this record.

## Required Project Control decision

Choose a legally authorized acceptance actor and fixture policy that can perform rAthena-governed Store/Sell without lifting the TEST_PLAYER economy isolation, then complete the outstanding Browser acceptance. Retain the existing lease and do not finalize GitHub-first promotion until these gates pass.
