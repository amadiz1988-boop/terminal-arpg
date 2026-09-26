# M1 V15 five-map live admission blocker

Status: `BLOCKED` at `FIVE_MAP_LIVE_ACCEPTANCE`. This record supersedes the build-only blocker in `m1-v15-five-map-native-build-blocker-2026-09-26.md`; it does not authorize a Web deploy or final receipt.

## Confirmed Native admission

- The exact f7 → 668bb9d Native diff contains the four Project Control-authorized files and no fifth file. Both f7 and 15d5c35 are ancestors of 668bb9d. Native GitHub `main` contains `668bb9db42dd4bb9cf7651c5c1e40c95531ada35`.
- F fresh GitHub build: `Release x64`, 13 canonical offline programs PASS, map-server SHA-256 `1C0D32827E43162543F178B4C5EAD22970029D2476E3AEF92FBB283C018C3A56`. The different D build SHA has a different embedded absolute PDB path and build size; both receipts name the same source SHA and MSBuild 17.14.51.32402.
- The same F lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a` deployed 668bb9d with graceful retirement. Production receipt: `.local/ro-stack/native-promotion-receipt-668bb9db42dd.json`. Postdeploy and post-attempt snapshots: login/char/map each one, Dashboard and DB each one, ProcDump SYSTEM bound to map PID 22604 and the new map hash, OpenKore runtime zero. No Web deployment occurred.
- The three f7 rollback executables were hash-matched against the predecessor receipt before replacement. The deployment code now restores them and rechecks runtime health on a failed postreplacement health gate; isolated success, altered-artifact, altered-preimage and failed-health integration tests passed.

## First live TEST_PLAYER result

- Normal authenticated TEST_PLAYER account 2000163 / character 150105 began in `PERSISTENT_IDLE` at `prt_fild08` (50,172), farm target `prt_fild08`. No Support Session or GM path was used.
- Synthetic `change-farm-map` to `ver_eju` through `POST /api/grind-target` returned HTTP 409 `{ "error": "伺服器操作失敗" }`, trace `scenario-change-farm-map-87e6dc01-b1ae-4024-9d2d-97e0a00b8787`. The runner observed no command creation or Native receipt. `FIRST_BROKEN_TRANSITION = HTTP -> Controller`; exact admission boundary is the Web world-map catalog before command creation. Character map, mode and farm target remained unchanged after the request.
- Authenticated read-only `/api/farm-map-availability` on deployed Web returned 251 selectable farm maps. `ver_eju`, `ver_tunn`, `verus03` were denied as `NO_AUTHORIZED_NORMAL_SPAWN_EVIDENCE`; `niflheim` as `MAP_ACCESS_RESTRICTED`; `tur_dun05` as `NO_SAFE_LANDING`. `mag_dun03`, `lhz_dun03`, `ein_dun03`, and boss-only `thor_v03` were also unavailable. These catalog denials do not prove Native admission or combat.
- The current F source catalog computes 274 selectable farm maps but still denies all five targets with the same reasons. Therefore the requested five-map visible-count delta is `0` in this source computation, and Native-only deployment cannot make the old or current Web catalog submit these Player intents.

## Gate consequence

`VER_EJU_LIVE`, the other four target maps, authoritative HIT, tur_dun05 server-selected arrival, and Native denial regressions remain `NOT_PROVEN`. The explicit instruction to stop the affected phase when any target cannot reach HIT applies. The ordered condition “five-map live PASS before final Web deploy” conflicts with the observed Web admission dependency. No intermediate or final Web deployment, Settings/World Map/Kafra Browser acceptance, capability closure, audio user test, final receipt, drift closure, or lease release was performed.

Next required Project Control decision: authorize the minimum source correction for five-map Web catalog admission and choose a safe acceptance sequence that preserves one final Web deployment, or authorize an existing authenticated TEST_PLAYER test transport to prove Native admission separately before that deployment. Neither option may invent safe landing coordinates or substitute admin actions for Player acceptance.
