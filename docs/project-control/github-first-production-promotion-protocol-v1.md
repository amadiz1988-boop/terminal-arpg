# GitHub First Production Promotion Protocol V1

Status: `SOURCE_GOVERNANCE_CHECKPOINT`; Production baseline migration remains blocked.
Authority: `AGENTS.md`, `WORKSPACE_INDEX.md`, and the committed product decisions.

## Authority chain

```text
committed product decision → canonical GitHub ref and exact Git SHA
→ build manifest and artifact hashes → Production deployment
→ live acceptance → final receipt → accepted baseline
```

`GITHUB_CANONICAL_SOURCE_OF_TRUTH=YES`. Production and
`production-deployment-state.json` are runtime and deployment records only.
Any Production asset, script, JSON, CSS, image, audio file, or Native binary must
be traceable to the promoted Git SHA. A local checkpoint without GitHub ref
reachability cannot enter Production. An emergency direct repair opens drift and
blocks every other deployment until the original owner completes normalization.

## Current source discovery, 2026-09-24

| Scope | Canonical source | Configured remote | Authorized release ref |
| --- | --- | --- | --- |
| Web | `terminal-arpg` | `https://github.com/amadiz1988-boop/terminal-arpg.git` | Undefined |
| Native | `C:\Users\Administrator\source\ghost-island-rathena` | Local `rathena-p2-native.bundle` | Undefined |

`CANONICAL_RELEASE_REF_UNDEFINED=YES` for both scopes. Native has no configured
canonical GitHub remote. The exact values are recorded in
`production-release-authority.json`; `null` is a blocking value. No branch was
selected or created in this task. Project Control must approve the existing
promotion path and commit its exact ref to that file before a release can pass.
The Native release also requires a canonical GitHub repository and an equivalent
admission hook on its authorized binary deployment path.

## Web admission and owner lease

The general Web entry is `ops/ro-stack/deploy-dashboard-manifest.ps1`. Its
`-Precheck` and `-Deploy` modes require `-OwnerTaskId` and call
`production-promotion-gate.mjs` before runtime health or endpoint access.
Production runs fail closed when the gate is missing. The gate verifies:

1. Exact HEAD SHA, existing commit, clean worktree, and tracked manifest files
   and required assets with matching hashes.
2. Configured GitHub URL, exact authorized release ref, live advertised remote
   ref, and candidate ancestry under that ref.
3. Current Git SHA baseline, final receipt, all recorded Web file hashes, and
   Native binary hash. Missing state or hash mismatch blocks a new deployment.
4. Closed drift, capability preservation against the accepted Production
   baseline, and a matching owner lease for `-Deploy`.

`production-deployment-state.mjs --action acquire` first repeats the admission
check, then creates the lease directory atomically. It records owner task/window,
target scope, time, Web and Native SHAs, and candidate capabilities. A competing
owner cannot replace it. `-Precheck` is read only; a deployment requires the
matching active lease. A failed or interrupted release leaves the lease for
explicit owner reconciliation.

Capability IDs and source paths are committed in
`production-capabilities.json`. The gate reads that file from the exact candidate
commit. Every capability source path must have the candidate hash in the new
manifest or the same hash in the verified Production baseline. Accepted IDs are
read from the last completed Production baseline.
Removal needs an exact ID and a committed `INTENTIONALLY_REMOVED` or
`SUPERSEDED` decision in `production-capability-decisions.json`. The registry
requires owner maintained acceptance evidence. It cannot establish semantic
equivalence from hashes alone; bounded tests and live acceptance remain required.

The existing manifest deploy receipt ends at `CANDIDATE_ACTIVE`. It records
owner and Git SHAs and retains rollback data. The deployment owner creates a
second final receipt after live acceptance. `--action finalize` validates owner,
SHAs, accepted capability set, GitHub provenance fields, Native binary and every
listed Web artifact hash, live acceptance, and rollback pointer. It atomically
updates the baseline and releases the lease only after the receipt is saved.

Required final receipt fields: `deploy_id`, `deployed_at`, `owner_task_id`,
`canonical_product_checkpoint`, `web_git_sha`, `native_git_sha`,
`github_remote`, `github_ref`, `web_build_manifest`,
`web_build_manifest_sha256`,
`native_artifact_path`, `native_build_sha256`, `files` with SHA256,
`runtime_pids`, `openkore_runtime_count`, `live_acceptance_results`,
`rollback_artifact`, and `accepted_capabilities`. The receipt must cover the
complete accepted Web source set. Preserve the build manifest and hashes.

## Drift and hotfix

Receipt mismatch marks `PRODUCTION_DRIFT=OPEN`; the owner must record it using
`production-deployment-state.mjs --action open-drift`. All ordinary releases
are blocked while drift is open. A direct emergency repair is reserved for an
actual Production failure when the Git path cannot finish in time. The same
owner reconstructs exact source in canonical Git, tests it, promotes the SHA
to GitHub, builds from that SHA, proves behavior and artifact equivalence,
records a retrospective final receipt, and runs `--action normalize-hotfix`.
The state tool checks all four normalization facts before closing drift and
releasing the lease. Production bytes can serve as accepted behavior evidence;
they do not create Git source authority.

## Current migration and unsupported paths

Historical Production receipts do not satisfy the new Web and Native Git SHA
baseline schema. This governance task does not reconstruct or change the
current M1/Web deployment. Until the separate W2 reconciliation creates a
complete accepted baseline, the gate blocks new general Web deployments.

`deploy-dashboard-checkpoint.ps1`, `deploy-web-journey-atomic.ps1`, direct
copies, direct binary replacement, manual service restarts with a candidate,
and Production side edits are `UNSUPPORTED_DEPLOY_PATH`. Existing historical
receipts remain evidence. Rollback through the existing manifest tool remains
available for recovery under its exact receipt contract. Native deployment
does not yet have an integrated GitHub admission gate and is blocked by policy.
Every user opened window reads `AGENTS.md`, `WORKSPACE_INDEX.md`, the current
receipt, and lease before promotion or Production mutation.

## Verification

`node ops/ro-stack/tests/test-production-promotion-governance.mjs` uses only
isolated state fixtures and covers eligibility, dirty/untracked source,
GitHub reachability, lease conflict, drift, capability loss and intentional
removal, receipt completeness, artifact hash, hotfix normalization, and missing
Git SHA. No Production endpoint or runtime is involved.
