# M1 V15 farm-map Production acceptance boundary

Date: 2026-09-25. Lease: `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`,
owner `F｜M1 最終整合`.

The isolated Web candidate `6c2884fb531b4e448cab9e0b513365c677f2318d`
contains only the accepted `/api/farm-map-availability` account-order
fix and its direct regression test relative to the previously deployed Web
candidate. Same-lease amendment and complete manifest admission passed:
5,742 paths, 5,741 unchanged, one modified existing path, zero added or
removed. The controlled deploy receipt is
`.local/ro-stack/dashboard/deploy-receipts/manifest-79121547502445179330094151d8d81e/deploy-receipt.json`,
SHA-256 `A65219D16F9187E276F204D495EFDB883D94B66636114C9F05E5BEF9945E4C98`.
It records `CANDIDATE_ACTIVE`, exact fileset match and healthy Dashboard.
Native PIDs 5212, 42440 and 22988 did not change. The outer PowerShell
output-capture process did not exit because the long-lived Dashboard retained
its output pipe; only that completed outer process was stopped. The deployed
Dashboard remains healthy. `DEPLOY_WRAPPER_NORMAL_EXIT=NO`.

An authenticated TEST_PLAYER request to `GET /api/farm-map-availability`
returned HTTP 200 with `maps`, `towns`, `player` and
`cooldownSeconds`. Anonymous access returned 401; query-string identity
spoofing left the session player's projection unchanged.

The next legal Player request, `POST /api/grind-target` for
`prt_fild08`, returned HTTP 503 `伺服器操作失敗`. Dashboard error output
identifies `FARM_MAP_SUPPLY_PREFLIGHT_UNAVAILABLE` and
`Unknown column 'inventory_slots' in 'SELECT'`. Source transition:
`queuePlayerWorldMapTeleport` to `readFarmMapSupplyPreflight` to
`persistent_agent_live_status` schema. The request did not move the
character or start AUTO_FARM. It did leave a
`player_2000163/relocation-pending.json` intent for `prt_fild08`;
the current recovery loop retains that intent while preflight is unavailable.
No direct cleanup or database change was performed.

The tracked `ops/ro-stack/sql/012-m1-supply-live-preflight.sql` defines
the missing nullable columns. Its invocation is in `ro-stack.ps1` setup,
outside the complete Web manifest. More importantly, deployed Native SHA
`18523076a6034ca3731aefb73bf41993f4a0ef06`
`src/map/persistent_agent_state.cpp::persistent_agent_state_export_live_status`
does not write `inventory_slots`, `inventory_max_slots`, `weight`,
`max_weight` or `supply_required`. Adding only SQL columns therefore
does not satisfy the current Web preflight contract. This requires a
separately authorized Native read-model/source and schema integration,
its regression tests, controlled artifact promotion and runtime acceptance.
The current instruction forbids Native source changes and restart, so the
acceptance chain stops here without bypassing the fail-closed preflight.

Remaining gates are unproven: 12 settings effects, 42-setting final census,
Fly to authoritative HIT, Supply return to HIT, 38 Production capabilities,
Desktop/mobile/audio Browser acceptance and final GitHub-first receipt.
Baseline remains `LEGACY_PRE_GITHUB_FIRST`, drift `OPEN`, lease `ACTIVE`.
