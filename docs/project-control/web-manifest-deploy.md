# Manifest-driven Dashboard deploy

Tool: `ops/ro-stack/deploy-dashboard-manifest.ps1`.

This is a Web-only extension of the existing Dashboard deployment practice. It
uses `dashboard-service.ps1` for the sole 8788 process, the checkpoint deploy
tool's exact-hash/staging/atomic-replacement pattern, and a durable backup and
receipt for explicit rollback. It never starts or stops login, char, or map.

## Manifest V1

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
    }
  ]
}
```

The current 16-file canary manifest is outside the repository at
`C:\Users\Administrator\.codex\canary-backups\production-web-superset-v2-9290df4\canary-manifest.json`.
Its optional `backup_root` and per-file `backup_sha256` record the earlier
preimage capture. Deployment makes a fresh, tool-owned backup before stopping
Dashboard. Any optional `backup_sha256` must match the preimage hash.

One to 64 explicit files are allowed within the Web paths enforced by the tool.
Paths must be relative, unique, and free of traversal or reparse points. No
glob, directory mirror, Native file, database file, runtime config, or dirty
candidate worktree is accepted. Every future run must recheck live preimages.

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
  hashes, stops Dashboard if present, restores every preimage, starts one
  Dashboard, verifies health, and creates `rollback-receipt.json`.

Deploy and rollback receipts and their backups remain under
`<ProductionRoot>/.local/ro-stack/dashboard/deploy-receipts/manifest-<id>/`.
Receipts use create-new semantics and contain manifest hash, candidate commit,
candidate root, file hashes, Dashboard PIDs, health, Native listener counts/PIDs, and final
state. A failed transaction records a separate failure receipt. Do not delete
the backup until rollback and audit retention are resolved.

`-TestMode` is restricted to a temporary non-Production root. It simulates the
Dashboard lifecycle without opening any listener. Offline fixture tests cover
precheck, hash and path refusals, partial failure recovery, successful deploy,
candidate-independent rollback, and unlisted-file preservation.

## Current authorization

The 16-file candidate `9290df46b0b81d6ccbd67e8b20867d68c48cc992` has
not been deployed by this tool. The current task authorizes only offline tests
and read-only Production `-Precheck`. `-Deploy` and `-Rollback` against
Production require a separately authorized, monitored canary. A successful
Precheck does not establish that the execution environment permits mutation.
