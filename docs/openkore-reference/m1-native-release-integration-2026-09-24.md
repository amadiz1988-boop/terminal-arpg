# M1 Native release integration preflight, 2026-09-24

This is a source and read-only Production preflight. It does not authorize a
restart or establish Fly-to-HIT, Supply-to-HIT, or Player Browser acceptance.
Product authority is `../project-control/canonical-m1-world-travel-supply-ui-v1.md`
at `c0450b1c`; pinned OpenKore reference is
`51de1ddfc4449ae5217f6886de702f87ca934030`.

| Gate | Exact evidence | Result |
| --- | --- | --- |
| Canonical Native source | `2e81281` reconciles nonconsumable Supply; `de168f5` adds missing-ammo safe block. The committed branch descends through `61b6248` quarantine-to-idle, `9672f31` restart preservation, `f1f6e08` action-width migration, `f2a268b` observation, and `633aacb` arrow/bullet nonconsumption. | SOURCE LINEAGE PRESENT |
| Clean candidate | Git archive of `de168f5`, archive SHA256 `880CD777D85C0734811453B6A425C02238FB336B34345DDC83A604B140C2285D`; fresh full Release x64 solution build PASS. Candidate `map-server.exe` SHA256 `7EFF7ECC585AB3B93F9962D85717BF6D61DD106557DB1E2D77A710F89A03047C`. | BUILD PASS |
| Source regression | PA PowerShell command contract 487 checks; C++ contract 81 cases; C++ M1 Supply policy; Native canonical, nonconsumable ammo, missing-ammo block, post-warp observation, restart-restore 39 checks, quarantine-to-idle C++ policy; `git diff --check`. | PASS, source only |
| Current Production binary | SHA256 `294482A656BCE8DC3374514ADFCCC4D074ADD3D4CD90FD0C070D447D02D89B0B`, modified 2026-09-24 01:09 local. Runtime rAthena Git base is `e985006`; `persistent-agent.patch` SHA256 `F3BF03F20D83F52B3989157A77BD2819424090F8FCEDC17DD2BE60960F7347AC`; rollout patch SHA256 `F3B8776C247164D077D00A30A33542F8A274FC607871D5AA9EBB6658A6413C11`. The runtime source files and `.persistent-agent-build-stamp` are absent, and no receipt binds this binary hash to a canonical Native commit. | BINARY LINEAGE UNVERIFIED |
| Accepted capability comparison | All 216 distinct `PersistentAgent:` markers in the running Production binary also occur in the clean candidate; candidate has 231. `RECOVER_QUARANTINED_TO_IDLE` is present in both, and `conf/persistent_agent_commands.json` Git blobs match. Marker inclusion and source ancestry are necessary evidence; they do not prove every executable transition is preserved. | MARKER MISSING 0; CAPABILITY MISSING UNPROVEN |
| Runtime safety | Production health: MariaDB, login 6901, char 6122, map 5122 each healthy; Dashboard `/api/health` HTTP 200; Sentinel `Running`; OpenKore process count 0. Read-only account classification found ten online character rows, six non-test and four test; 150095 is account 2000139, `is_test=1`, group 0. Existing ProcDump sidecar reports `PROCDUMP_OUTPUT_UNVERIFIED` for current map PID. | RESTART GATE BLOCKED |

`PRODUCTION_ACCEPTED_CAPABILITIES_MISSING` remains `UNPROVEN`, despite zero
missing marker names. Before controlled diagnostic deployment, bind the current
Production binary to an accepted Native source/manifest or obtain an equivalent
auditable capability-preservation proof, resolve the ProcDump attachment gate,
and satisfy the canonical restart safety procedure with a player-safe window.
Do not deploy the candidate raw while any of these gates remain open.

The 42 visible adjustable Settings paths still partition as `6+12+24` under
the current disabled source contract. When `PA_NATIVE_SUPPLY_POLICY_ENABLED=1`,
the Web source attests eight Supply paths as `SUPPORTED`, including weight,
slots, storage, sell and `itemRules`; Native `parse_m1_supply_policy` explicitly
ignores those five legacy paths. This is a source-level potential enabled
no-op at the Web capability-attestation seam. Keep the flag off until the Web
owner narrows the attested set to executable M1 fields and tests the result.
