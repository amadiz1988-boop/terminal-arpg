# M1 V15 Settings legacy buy-threshold recovery

Scope: source-only correction for authenticated Player Settings read. No Production file, player state, Native runtime, or database was changed by this checkpoint.

## First broken transition

On 2026-09-26 the controlled Player Browser at `http://127.0.0.1:8788/` loaded the game and showed `角色設定中心：伺服器操作失敗`. The current Dashboard stderr recorded `CONFIG_VALIDATION_FAILED` in `migrateLegacyConfig` during `GET /api/config`, with `supply.services.buy.rules[0]` reporting `補到數量不可低於觸發數量`. The affected legacy `buyAuto 501` row has `minAmount 200`, `maxAmount 3`. No canonical character config file had been created for that legacy account before this read.

`FIRST_BROKEN_TRANSITION = legacy config -> canonical config validation`. The error precedes controller capability reporting and Native dispatch. The previous 46-field/9-section schema test therefore did not establish this Player Browser Settings gate.

## Pinned behavior and minimal mapping

- Pinned OpenKore commit: `51de1ddfc4449ae5217f6886de702f87ca934030`.
- `control/config.txt::buyAuto` defaults to `minAmount 2`, `maxAmount 3`; the row is configurable.
- `src/AI.pm::shouldStartAutoBuy` triggers only when inventory amount is both `<= minAmount` and `< maxAmount`, with an eligible row/NPC and conditions. `src/AI/CoreLogic.pm::processAutoBuy` buys toward `maxAmount` and handles NPC, Zeny, packet-result, and timeout paths.
- Current Native `src/map/persistent_agent_m1_supply_policy.hpp::m1_buy_due` uses the same two inventory comparisons. `m1_buy_range_valid` requires `minimum <= maximum`; Native/rAthena remain the service and inventory authority.
- For the observed `200/3` row, replacing the migrated minimum with `3` leaves the trigger predicate identical for every nonnegative inventory count. The target remains `3`. The original row remains in `migration.retained.blocks`, and the mapping records `ADAPT`. Other valid rows are unchanged.

OpenKore source: [config.txt](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/control/config.txt), [AI.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI.pm), [CoreLogic.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI/CoreLogic.pm). Local atlas topic: `docs/openkore-reference/reference-index.yml::SHOP_BUY`. rAthena atlas topic: `docs/rathena-reference/reference-index.yml::11 SHOP / BUY / SELL`. No upstream code was copied.

## Verification and remaining gate

- The new regression failed with the same `CONFIG_VALIDATION_FAILED` before the source correction.
- `node scripts/test-legacy-item-rule-migration.mjs`: 20 cases PASS.
- `node scripts/test-openkore-config-schema.mjs`: PASS.
- `node scripts/test-m1-config-capability-gate.mjs`: 46 fields, 9 sections PASS at the schema/admission layer.
- Read-only replay of the affected Production legacy `config.txt` through the corrected source: PASS, `minAmount=3`, `maxAmount=3`, zero validation errors, original `200` retained.
- `node --check` for both changed JavaScript files and `git diff --check`: PASS.
- Authenticated TEST_PLAYER 150105 `GET /api/config` on the currently deployed Web returned 200 with `editable=true`, 17 paths marked `SUPPORTED`, `applied=false`, `SAVED_FOR_NEXT_FARM`. This is capability admission, not proof of all 17 runtime effects.

`SETTINGS_FINAL_GATE = OPEN`. The corrected source still requires the single final Web integration/deploy and Player Browser retest. Each editable path requires its own execution-effect evidence. Do not interpret a saved config, an HTTP 200, or a `SUPPORTED` response alone as an authoritative runtime effect.

`OPENKORE_REFERENCE_GATE = BLOCKED` for final Production acceptance. `SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES`; the source test proves the integer trigger predicate for inventory amounts 0 through 300, while `PLAYER_FLOW_EQUIVALENCE = NOT_TESTED` until final Production Browser acceptance. No new supply engine, command, or gameplay rule was introduced.
