# GitHub First Production Promotion Protocol V1

Status: `GITHUB_FIRST_SOURCE_POLICY_V6`; source authority activation is recorded in the V6 report. Production baseline migration requires separate runtime evidence.
Authority: `AGENTS.md`, `WORKSPACE_INDEX.md`, and the committed product decisions.

## V6 cutover authority

`production-release-authority.json` now pins Web main, private Native main and
private immutable asset Release 1.1.0. These fields supersede the historical
undefined-ref and missing-repository findings below. Exact candidate Git SHAs
must be reachable from those refs. Private assets must match all package,
manifest and archive hashes and the current private/immutable GitHub state.
A deployment manifest supplies `private_asset_package_root` to the independently
verified download directory's `package` subdirectory. Required licensed files
are admitted through their pinned manifest byte hashes; source files remain
Git-tracked. The complete package is checked before admission.

The source-only governance activation does not fill a Production receipt,
close Production drift, acquire a deployment lease, reconcile old Native runtime
SHAs, or start a deployment. Missing runtime baseline evidence remains blocking.
Native binary deployment remains unavailable until its exact artifact receipt
and controlled deployment admission are authorized and implemented.

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

## Historical pre-V6 source discovery, 2026-09-24

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

### Activation audit, 2026-09-24

The remote advertises `refs/heads/main`,
`refs/heads/recovery/2026-09-13-working-tree`, and
`refs/heads/feat/official-ro-damage-visuals`. None is identified as an
authorized Production release ref in existing deployment docs. `main` does not
contain `deploy-dashboard-manifest.ps1`. The local governance branch has no
upstream and diverges from the fetched remote `main` by five remote-only and
269 local-only commits. A push of its HEAD would publish those 269 commits;
this task does not do so. `WEB_RELEASE_REF_CLASSIFICATION=NO_RELEASE_REF_DEFINED`.
The local `b975021` and later `be9ddb39` Web receipt candidate SHAs are not
reachable from fetched `origin/main`. A receipt with `CANDIDATE_ACTIVE` remains
runtime evidence without final canonical Git authority.

Native `origin` remains the local `rathena-p2-native.bundle`. The inspected
Native source and shared governance files name no private canonical GitHub
repository. The public `amadiz1988-boop` GitHub listing exposed only
`terminal-arpg`; private repository existence remains unverified.
`NATIVE_GITHUB_REMOTE_REQUIRED=YES`. No Native source was published.

`production-deployment-state-bootstrap-v3.json` is source-side governance
metadata. It distinguishes the last observed runtime receipt from canonical
Git authority. All unresolved historical SHAs and the formal deploy ID are
literal `UNRESOLVED`. The latest observed Web receipt is dated
2026-09-24 08:04:49 +08:00 and records `CANDIDATE_ACTIVE` for `be9ddb39`.
The Production state file was absent at inspection; no Production file was
created. The gate rejects this bootstrap template for deployment until a
separate accepted-baseline reconciliation fills exact GitHub-reachable SHAs.

`deploy-dashboard-checkpoint.ps1`, `deploy-web-journey-atomic.ps1`, direct
copies, direct binary replacement, manual service restarts with a candidate,
and Production side edits are `UNSUPPORTED_DEPLOY_PATH`. Existing historical
receipts remain evidence. Rollback through the existing manifest tool remains
available for recovery under its exact receipt contract. Native deployment
does not yet have an integrated GitHub admission gate and is blocked by policy.
Every user opened window reads `AGENTS.md`, `WORKSPACE_INDEX.md`, the current
receipt, and lease before promotion or Production mutation.

### Lineage continuation audit, 2026-09-24

The [Web lineage report](web-main-lineage-reconciliation-v1.md) freezes
`origin/main` at `6b61e318` and local Web HEAD at `1d16484b` before active W2
changes. Exact divergence is five remote-only and 271 local-only commits.
Every local-only commit has a classification. Eleven commits contain client or
collaboration binary assets whose public-repository redistribution authority
is unconfirmed. `WEB_MAIN_PROMOTION=PUBLICATION_BLOCKED`; no push occurred.

The [Native full-history audit](native-github-bootstrap-audit-v1.md) restored
the shallow source's official rAthena ancestry and found historical account
data, execution logs, removed generated binaries, and third-party binary
license questions. The user's zero-risk publication gates fail.
`NATIVE_GITHUB_REMOTE_REQUIRED=YES` remains in force; the proposed private
`ghost-island-rathena` repository was not created or pushed. The existing Web
promotion gate checks Native GitHub reachability and therefore fails closed.
An integrated Native deployment SHA gate remains pending.

## Verification

`node ops/ro-stack/tests/test-production-promotion-governance.mjs` uses only
isolated state fixtures and covers eligibility, dirty/untracked source,
GitHub reachability, lease conflict, drift, capability loss and intentional
removal, receipt completeness, artifact hash, hotfix normalization, and missing
Git SHA. No Production endpoint or runtime is involved.
