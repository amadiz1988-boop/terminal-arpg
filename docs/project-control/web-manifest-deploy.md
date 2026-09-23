# Manifest-driven Dashboard deploy

Tool: `ops/ro-stack/deploy-dashboard-manifest.ps1`.

This is a Web-only extension of the existing Dashboard deployment practice. It
uses `dashboard-service.ps1` for the sole 8788 process, the checkpoint deploy
tool's exact-hash/staging/atomic-replacement pattern, and a durable backup and
receipt for explicit rollback. It never starts or stops login, char, or map.

## Manifest V2

JSON fields:

```json
{
  "candidate_commit": "40 lowercase or uppercase hex characters",
  "candidate_root": "absolute clean Git worktree path",
  "production_root": "absolute Production root path",
  "files": [
    {
      "path": "ops/ro-stack/dashboard.mjs",
      "candidate_sha256": "64 hex characters",
      "production_preimage_sha256": "64 hex characters"
    },
    {
      "path": "ops/ro-stack/persistent-agent/new-runtime-module.mjs",
      "candidate_sha256": "64 hex characters",
      "production_preimage": "ABSENT"
    }
  ]
}
```

The failed V3 16-file manifest remains immutable at
`C:\Users\Administrator\.codex\canary-backups\production-web-superset-v2-9290df4\canary-manifest.json`.
The corrected 195-file V4 candidate manifest and per-dependency closure report
are at `C:\Users\Administrator\.codex\canary-backups\production-web-superset-v4-9290df4\`.
V3 failed when its deployed Dashboard imported a runtime module absent from
Production and omitted from the manifest. The corrected manifest retains the
exact candidate commit and records 123 new targets with `production_preimage:
"ABSENT"` and 56 changed existing map-detail files. The old manifest is not
edited. Deployment makes fresh tool-owned backups of existing targets before
stopping Dashboard. Optional `backup_sha256` must match the preimage hash.

One to 256 explicit files are allowed within the Web paths enforced by the tool.
Paths must be relative, unique, and free of traversal or reparse points. No
glob, directory mirror, Native file, database file, runtime config, or dirty
candidate worktree is accepted. Every future run must recheck live preimages.
An `ABSENT` target requires an existing parent directory and an absent target
at precheck and immediately before replacement. Rollback removes only that
manifest-owned file, and only while its deployed hash still matches.

## Runtime delivery closure

`DEPLOYMENT_RUNTIME_CLOSURE_REQUIRED=YES`.
`SOURCE_IMPORT_PASS != DEPLOYMENT_CLOSURE_PASS`. The tool runs
`manifest-runtime-closure.mjs` before any Production mutation. It follows
bounded local static imports, re-exports, statically resolvable dynamic
imports, direct Browser HTML/CSS/JS asset references, and map-info detail
references. It resolves them against the simulated post-deploy tree:
Production plus only the explicit manifest overlay. Existing Production
modules retain their current bytes and must satisfy the imported export names;
existing assets must resolve. Changed map-info detail data and absent
dependencies must be delivered explicitly. A missing dependency fails precheck
with zero Dashboard stops and zero Production file changes. The full V4
dependency inventory is stored alongside the corrected manifest.

## Modes

- `-Precheck -Manifest <absolute path> -ProductionRoot <absolute path>` reads
  the candidate, Production preimages, current listener topology, and health.
  It writes no Production files and returns a JSON receipt on stdout.
- `-Deploy` takes the same manifest and Production root. It stages and backs up
  all files before stopping Dashboard, temporarily suspends the Web watchdog,
  stops the one Dashboard through `dashboard-service.ps1`, replaces only listed
  files, starts one Dashboard, verifies health and unchanged Native PIDs, and
  creates `deploy-receipt.json`.
- `-Rollback -ReceiptPath <absolute deploy-receipt.json> -ProductionRoot
  <absolute path>` reads the saved manifest and backups beside the receipt.
  It does not require the candidate worktree. It verifies current candidate
  hashes, stops Dashboard if present, restores every existing preimage and
  removes only manifest-owned `ABSENT`-preimage files, starts one
  Dashboard, verifies health, and creates `rollback-receipt.json`.

Deploy and rollback receipts and their backups remain under
`<ProductionRoot>/.local/ro-stack/dashboard/deploy-receipts/manifest-<id>/`.
Receipts use create-new semantics and contain manifest hash, candidate commit,
candidate root, file hashes, Dashboard PIDs, health, Native listener counts/PIDs,
and final state. A failed post-mutation deploy automatically restores its
preimages and records a failure receipt with phase, reason, mutated files,
rollback result, and final preimage verification. A successful automatic
rollback is evidenced by that failure receipt; it does not require an explicit
`-Rollback` without a successful deploy receipt. Explicit `-Rollback` remains
mandatory for a successful canary deploy. Do not delete backups until rollback
and audit retention are resolved.

`-TestMode` is restricted to a temporary non-Production root. It simulates the
Dashboard lifecycle without opening any listener. Offline fixture tests cover
precheck, hash and path refusals, partial failure recovery, successful deploy,
candidate-independent rollback, and unlisted-file preservation.

## Current validation

`PRODUCTION_VALIDATION_STATUS=FAILED_CANARY_DEPENDENCY_CLOSURE`. V3 attempted a
real deploy, candidate Dashboard startup failed, and automatic file restoration
returned 16/16 preimages. V3 did not produce a clean failure receipt. The V4
manifest has only read-only Production precheck evidence; no V4 deploy or
Browser acceptance has occurred. A new controlled canary needs separate
Project Control authorization.
