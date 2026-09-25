# M1 V15 Native source decision

Status: source decision before executor and fixture implementation. No live result is asserted.

| Concern | Active implementation | Superseded/reference | Enabling configuration and player entry |
| --- | --- | --- | --- |
| Local hunting executor | `C:/Users/Administrator/source/ghost-island-rathena/src/map/persistent_agent.cpp`: `parse_farm_payload`, `activate_farm_runtime`, `persistent_agent_farm_tick`, `handle_survival` | Pinned OpenKore `51de1ddfc4449ae5217f6886de702f87ca934030` `control/config.txt` and `src/AI/{Attack,CoreLogic}.pm` are behavior references only | `conf/persistent_agent_commands.json` `start_farm`; Player Web `ops/ro-stack/dashboard.mjs` creates the command; existing PA capability flags gate the executor |
| M1 Supply | Native `parse_m1_supply_policy`, `process_configure_supply_policy`, `handle_m1_farm_supply`; Renewal `db/re/item_db_usable.yml` item 501, 601, 602 | Historical weight/slot/storage/sell trigger is superseded by `docs/project-control/canonical-m1-world-travel-supply-ui-v1.md` current lines 117–129 | `PA_NATIVE_SUPPLY_POLICY_ENABLED` plus `configure_supply_policy`; rAthena owns inventory, price, Zeny, NPC transaction and map state |
| Acceptance fixture | Existing `test_fixture_atcommand` verifies Admin session and test flag but calls permission-checked self-scoped `is_atcommand`; player group 0 cannot provision itself | Generic GM/editor and cross-player mutation are excluded | Existing local Admin authenticated transport; new fixed profile is scoped to TEST_PLAYER char 150105 and creates prerequisites only |

Current Native HEAD before V15 changes: `de168f566325f140c87b355a1d442dddabf0b8ad`. OpenKore reference HEAD: `51de1ddfc4449ae5217f6886de702f87ca934030`. Renewal item evidence: `db/re/item_db_usable.yml` item 501 Red Potion, 601 Fly Wing, 602 Butterfly Wing. The active server is rAthena Renewal; the `db/re` entries are therefore the relevant local item definitions. Actual execution remains with the currently deployed rAthena process and requires separate live verification.
