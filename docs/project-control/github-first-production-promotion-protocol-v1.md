## Complete Web promotion payload

WEB_DEPLOYMENT_MANIFEST = COMPLETE_PROMOTION_PAYLOAD
MULTI_MANIFEST_SINGLE_PROMOTION = FORBIDDEN
PRECOPY_OUTSIDE_LEASE = FORBIDDEN
LEGACY_256_FILE_LIMIT = SUPERSEDED

Normal and first GitHub promotions require the `web-complete-v1` contract in
`docs/project-control/web-atomic-full-manifest-delivery-v1.md` and the independent
limits in `web-manifest-safety-policy.json`. One candidate, one complete manifest,
one lease and one Web deployment receipt. Prestage, exact provenance/hashes,
complete rollback and postdeploy fileset checks gate final baseline advancement.
Production cannot fill missing candidate files. Historical subset manifests are
retained only for historical rollback and isolated compatibility fixtures.

# GitHub First Production Promotion Protocol V1

Status: `GITHUB_FIRST_SOURCE_POLICY_V6`; GOVERNANCE_PRODUCTION_ACTIVE=YES, verified in canonical-remote-verification-v6.json. Production baseline migration requires separate runtime evidence.
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
complete manifest. Production baseline bytes cannot satisfy missing candidate source. Accepted IDs are
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
available for recovery under its exact receipt contract. That audit predates the Native entry below. Native promotion now uses its
integrated GitHub admission gate; direct replacement remains unsupported.
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

## Authorized legacy baseline migration

PRODUCTION_LEGACY_BASELINE_BOOTSTRAP_V1 authorizes the exact one-time
FIRST_GITHUB_FIRST_PROMOTION mode described in
[the migration contract](production-legacy-baseline-bootstrap-v1.md).
NORMAL admission still requires valid existing canonical Git SHAs. Explicit
legacy provenance is never replaced with the future candidate's SHA. Both
current artifact/rollback verification and capability superset remain required.
After the first final successful receipt a permanent consumption marker disables
migration and atomic state transition establishes the real GITHUB_FIRST baseline.

## ProcDump process identity precision

`PROCDUMP_PROCESS_IDENTITY_PRECISION_FIX_V1` uses the shared UTC-tick
comparison in `ops/ro-stack/procdump-process-identity.ps1`. Exact PID, live
process, executable/role, ProcDump receipt and command-target checks remain
mandatory. Start-time delta is at most one Windows tick (100 ns). Source,
isolated tests and read-only current receipt evidence are recorded in
`docs/project-control/procdump-process-identity-precision-v1.md`.

## Governance JSON encoding

`POWERSHELL51_UTF8_GOVERNANCE_JSON_FIX_V1`: deployment-critical JSON is UTF-8
without BOM and is read and written with explicit strict UTF-8 in Node and
PowerShell (`ops/ro-stack/governance-json.ps1`). Implicit PowerShell 5.1
default decoding is forbidden. Unicode owner and task names are exact
identities compared ordinally. A failed Native operation journal is closed only
through `deploy-native-candidate.mjs --action archive-failed-operation`.
Evidence: `docs/project-control/powershell51-utf8-governance-json-v1.md`.

## Native GitHub-first promotion entry V1

`NATIVE_PROMOTION_PATH = AVAILABLE`. This entry implements the one-time first
promotion. Actual deployment belongs to F and requires explicit runtime authority.
This tooling work performed no Production application mutation or restart.
Governance commit must be newer than `0863037c016562017c058ae4794182552aea6b85`
and reachable from `terminal-arpg/main`; use a clean governance checkout.
First-mode capability definitions come from that published governance SHA. Their
source paths are still verified against the exact Web/Native gameplay SHAs, so
the approved Web `4a0b6979` need not contain later governance metadata itself.

### Build and candidate preparation

```powershell
python scripts/build-native-candidate.py --sha a4c736d865eeedca398aad97aeff1c1036f2dc39 --output <new-private-build-directory>
node scripts/prepare-native-candidate.mjs --build-root <private-build-directory> --production-root C:\Users\Administrator\ghost-island-production\ro-stack
```

The first command verifies current GitHub PRIVATE visibility and main, clones a
new source directory, verifies approved SHA ancestry, builds `rAthena.sln` Release
x64 and runs the canonical offline suite. Source is checked clean before and after;
only exact generated test executables/objects inside the fresh clone are removed.
The three built executables stay in that clone. Source and build outputs must be
retained until finalization. Build logs and every suite log are hash-pinned.
There are no hardcoded historical test-count thresholds.

`native-build-v1` fields: schema_version, build_id, built_at, native_git_sha,
canonical_repository, canonical_branch, build_configuration, toolchain,
binary_path, binary_sha256, source_root, source_tree_state, tests_run, tests_result,
artifacts and build_log. Each suite records test_suite, result and receipt
{path, sha256}. Artifacts are exactly login-server.exe, char-server.exe and
map-server.exe from the fresh build. An executable outside that receipt and fresh
source layout is inadmissible. CLEAN means tracked source plus untracked source
checks pass; ignored compiler outputs remain covered by artifact hashes.

Preparation reads actual Production legacy manifests and rollback without changing
Production. It writes `native-candidate-v1`, `native-regression-v1` and
`native-capabilities-v1` privately beside the build receipt using create-new writes.
Candidate fields: candidate_id, native_git_sha, binary_sha256, build_receipt,
regression, required_database, required_runtime_ports, required_openkore_count,
required_capability_baseline, capability_comparison, rollback_reference,
canonical_repository, canonical_branch and lifecycle_files. All references have
path and SHA256. Candidate SHA256 is the immutable admission identity; changes
require a new candidate and preflight, never editing an admitted candidate.

Seventeen named regression groups cover PA/C++ commands, SERVER_AGENT, idle,
quarantine, stale task/owner/target, shutdown/restart, farm/combat, M1 Supply,
Fly/Butterfly/Arrow/Bullet nonconsumption, missing ammo and AUTO_FARM. Additional
source assertions check native shutdown prepare/confirm ordering. These prove
source/build contracts; F must separately prove runtime restoration and gameplay.

All 18 accepted legacy IDs must be classified PRESERVED or
INTENTIONALLY_SUPERSEDED, with MISSING=0 and UNKNOWN=0. Web rows require the
independent combined Web preflight. Native rows require canonical source paths
and the regression evidence. Supersession additionally requires a hash-pinned JSON
product decision tracked at the exact canonical Web SHA with capability,
disposition INTENTIONALLY_SUPERSEDED, approved_by PROJECT_CONTROL, reason and
replacement. The replacement must pass candidate capability verification. The
logical legacy capability ID remains represented in the final accepted set.

### Combined admission and controlled execution

The ordinary first-promotion Web manifest additionally pins
`native_candidate_manifest: {path, sha256}`. Paths are relative to their containing
manifest and stay within its directory. Put the combined Web manifest in a parent
folder of the build bundle when preparing F's evidence. Existing assets, Web
regression, runtime preflight and all legacy rollback requirements remain mandatory.
Use the existing state tool's acquire action after combined precheck PASS. The
lease stores both exact Git SHAs, the Web manifest hash, Native manifest hash and
unique lease_id. This work never acquires F's real lease.

```powershell
node ops/ro-stack/deploy-native-candidate.mjs --candidate-manifest <candidate.json> --manifest-sha256 <SHA256> --production-root C:\Users\Administrator\ghost-island-production\ro-stack --owner <owner-task-id> --lease <lease-id>
```

The default is read-only preflight. Only an authorized owner adds `--execute true`.
Native runs first from CLOSED drift. It takes a durable operation claim, stages
and hashes the three authorized executables, rechecks ownership and legacy
preimages/rollback, opens the pending transaction, then uses the existing
Production `ro-stack.ps1` graceful stop and guarded start. Launcher, helper, guard,
guard library and configuration are pinned before mutation. Missing tracked runtime
state is rejected to exclude the historical force-stop fallback. Dashboard and
MariaDB PIDs must stay unchanged. Start requires zero old game processes/listeners;
postcheck requires exactly one replacement each, canonical ports, OpenKore=0 and
verified sentinel ProcDump attachment to the new map PID. No second runtime or
new observer is created. A failure after opening drift never retries/restarts or
claims success automatically; retained operation state and rollback reference are
owned reconciliation evidence.

After the Native receipt, the existing Web manifest tool can continue only when
all untouched legacy Web bytes, new Native bytes, original rollback bytes and
lease/pending identities match. This bounded continuation permits the owned
Native stage's OPEN state. It never accepts unrelated drift. No final baseline
transition occurs until Web deployment and F's required live acceptance complete.

### Receipts and verification

`native-deploy-v1`: deploy_id, lease_id, native_git_sha, native_build_sha256,
candidate_manifest_sha256, previous_binary_sha256, new_binary_sha256, old_map_pid,
new_map_pid, procdump_receipt, runtime_health, openkore_runtime_count,
rollback_reference, acceptance_status and artifacts. The intermediate status is
NATIVE_CANDIDATE_ACTIVE. The pending marker pins the receipt bytes.

The overall final receipt must include matching lease_id and
`native_deployment_receipt: {path: ".local/ro-stack/native-promotion-receipt.json",
sha256: "..."}`. Validation rechecks receipt schema, lease/SHA/manifest identities,
all three deployed binary hashes and the original final live-acceptance gates.
Missing Native receipt cannot consume bootstrap or transition the baseline.

`node ops/ro-stack/tests/test-native-promotion.mjs` runs isolated full contract
fixtures, combined admission, staged replacement through an injected fixture
lifecycle, Web continuation, receipt finalization and failure retention. The CLI
has no fixture-root or alternate runtime adapter option. Also run the existing
legacy bootstrap, promotion governance and Dashboard manifest fixture suites.
