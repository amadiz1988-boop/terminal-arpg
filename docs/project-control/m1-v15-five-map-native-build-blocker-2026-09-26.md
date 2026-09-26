# M1 V15 five-map Native amendment build blocker

Date: 2026-09-26. Workline F, active lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`. This record covers the source/build gate only. No Production Native replacement or player mutation occurred.

## Exact admission

- Current Production Native is `f7e4097ea2a26c7b204004bfeb5a605324cf2a79`; its login, char and map hashes still match its immutable deploy receipt. An external f7 build contains the same three binary hashes, so the current executable preimage is preserved.
- Project Control authorized successor `15d5c35d50bc1f88ed5fc346784445a29068b4f0` only for `ORIGINAL_HUNTING_LABEL_NATIVE_ADMISSION_CLOSURE_V1`. Native source authority preflight passed, f7 is its ancestor, and the exact diff contains only `src/map/persistent_agent.cpp`, `tools/pa-command-contract/Test-WorldMapFarmAdmissionSource.ps1`, and `tools/pa-command-contract/contract-test-matrix.json`. Native GitHub main fast-forwarded from f7 to 15d.
- The new direct source check passed: `WORLD_MAP_FARM_ADMISSION_SOURCE_PASS checks=25 targets=5 nowarpto_denials=3 source_only=1 live_proof=0`.

## First broken transition

The fresh private-GitHub Release x64 build compiled, but its canonical offline regression stopped at `tools/pa-command-contract/Test-M1CanonicalSource.ps1` with `M1_DYNAMIC_NORMAL_SPAWN_SOURCE_FAILED`. The existing assertion requires the literal `npc/re/mobs/fields/` within `world_map_farm_min_level`. The authorized 15d Native change removes that old source-family whitelist so valid ordinary spawns in the five target maps can enter the same rAthena admission path. The new three-file test verifies this removal, but the older fourth-file test was not revised by D.

`FIRST_BROKEN_TRANSITION = authorized Native source -> canonical offline regression`. The complete Native build receipt and candidate manifest were not created. The freshly compiled map-server hash was `7A68C30B3983AA4515B7ABB5E7A62897A075CCD48D1BC85CDB686CFEB4BCE41C`; it differs from the D-provided candidate evidence `F95150A018FFD69795427FE473B41BB45FD282DA5548B1EB9E7F60AC820C9B85`. The latter's artifact type and toolchain provenance were not supplied in this dispatch, so the difference is not attributed to a cause.

## Gate and required action

The exact three-file authorization does not include `tools/pa-command-contract/Test-M1CanonicalSource.ps1`. F has not edited Native source or bypassed the test. The five-map Native deploy and all five-map live checks are blocked. The required next authority is a bounded amendment that admits the stale-test correction, or a revised authorized three-file Native candidate that passes the existing canonical regression. A fresh Release x64 build, full offline tests, exact rollback preparation and same-lease plan must pass before any Production replacement.

The separate F Web candidate can integrate A's accepted World Map presentation without this Native replacement. Source-only checks cannot establish five-map Production arrival or HIT.
