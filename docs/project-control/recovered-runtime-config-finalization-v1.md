# Failed runtime config operation finalization V1

This action closes only the failed 2026-09-25 runtime config reconciliation under lease
`869f1725-dbd0-452d-b9dd-37ee79cc3f9a`. The original attempt remains `FAILED` with
`NATIVE_RUNTIME_STOP_FAILED`. The subsequent approved recovery is recorded as `RECOVERED`,
then the separate governance operation becomes `FINALIZED`.

Use `ops/ro-stack/finalize-recovered-runtime-config.mjs` from a clean governance checkout
whose HEAD exactly matches GitHub `terminal-arpg/main`. Run `--action dry-run` first, then
`--action finalize --execute true` with the canonical Production root, owner `F｜M1 最終整合`,
the lease ID above, and `--project-control-evidence` pointing to the supplied V1
continuation instruction. The tool pins its hash and archives a copy. The tool only queries
the existing runtime and loopback health API.
It does not start or stop services.

The gate pins the original failure and operation bytes, rollback config, effective `0/0`
config, low-SP map log, Project Control continuation instruction, 23c Native amendment and
deployment receipts, graceful-cycle receipt, V13 incident record, active lease, pending
promotion, current Native binaries, runtime process identities, ProcDump SYSTEM identity,
OpenKore count, and API health. The low-SP log proves a `0/0` farm start, weapon fallback,
and an authoritative target HP decrease. The V13 incident's root cause remains `UNKNOWN`.

Successful finalization writes a new immutable receipt at
`.local/ro-stack/runtime-config-failed-operation-finalization-<lease-id>.json`, then moves
the retained lock to `.local/ro-stack/runtime-config-failed-finalized-<lease-id>/` without
changing `failure.json` or `operation.json`. The archive retains the pinned Project Control
instruction. It adds a receipt pointer and hash to the
pending promotion and deployment state. An interruption after receipt creation resumes
the remaining archive and pointer writes. Duplicate complete calls report
`already_finalized`.

The F lease stays active. Baseline remains `LEGACY_PRE_GITHUB_FIRST`, drift remains `OPEN`,
and first promotion remains incomplete. The finalized failure history no longer appears as
an active runtime config operation. The separate first promotion gates remain in force.
