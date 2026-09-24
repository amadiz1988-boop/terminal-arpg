# Legacy Production baseline bootstrap V1

Task: PRODUCTION_LEGACY_BASELINE_BOOTSTRAP_V1.
This task authorizes a one-time source-governance migration and current-artifact
capture. It does not deploy application files, restart services, mutate players,
or acquire F's deployment lease.

## Authority and baseline

Web and Native historical Git provenance remains UNRESOLVED_LEGACY. Never assign
future approved SHAs to pre-governance runtime. The explicit baseline mode is
LEGACY_PRE_GITHUB_FIRST, schema_version 2. The bootstrap tool requires its own
clean GitHub-main-reachable source before any real execution. Current app files
are read from bounded Web paths; credentials, runtime settings, databases and
logs are excluded. The capture includes current private presentation assets.
Three current Native executables are captured individually. The private rollback
copies and manifests stay below Production .local and are never committed.

The accepted capability manifest has 18 entries, 8 Web and 10 Native, inherited
from Project Control's explicit accepted baseline and linked historical evidence.
Fresh hash observation does not claim a new Browser or gameplay acceptance.
Candidate capability records include both domains. Native records resolve paths
in the exact candidate Native Git tree. First promotion permits zero missing
accepted capabilities, including no intentional-removal exemption.

Run the committed bootstrap tool first without arguments for read-only capture,
then with --apply only after isolated tests pass. The tool creates a stable
artifact-derived bootstrap ID, copies exact nonsecret rollback files, rechecks
all current and rollback hashes plus runtime PID/start identities, and atomically
creates production-deployment-state.json only if state/lease/consumption marker
are absent. A separate bootstrap lock prevents concurrent bootstrap writers.
The real deployment lease directory is never acquired by bootstrap.

## F first-promotion contract

The candidate deployment manifest adds these fields to the existing contract:

- promotion_mode: FIRST_GITHUB_FIRST_PROMOTION
- candidate_native_commit: exact GitHub private main reachable Native SHA
- private_asset_package_root: verified private package directory
- first_promotion_evidence: object with path and sha256 of the preflight report

The preflight report binds web_git_sha and native_git_sha and contains
web_regression, native_build, native_regression, procdump_gate and
runtime_health_gate, each with pass: true and a nonempty evidence reference.
The manifest pins the report bytes; F must produce actual evidence, not asserted
or fabricated results. Existing deployment topology, runtime closure, preimage,
rollback, health and live-acceptance requirements remain in force.

Use production-deployment-state.mjs action acquire, with --promotion-mode
FIRST_GITHUB_FIRST_PROMOTION, --manifest, --web-sha, --native-sha and --owner.
Lease acquisition alone requires FREE. Subsequent read-only prechecks accept the
same owner lease. The directory claim remains atomic and repeat acquisition is
blocked. State's deployment_lease field records bootstrap-time FREE; the live
lease directory/lease.json remains the authoritative owner record.

Before the first application mutation, the owner calls action
begin-first-promotion. The Web manifest deployment tool does this automatically
immediately before its controlled Dashboard stop. For a coordinated Native
operation, F must call the same action before any Native binary mutation.
This writes a durable pending marker and opens drift until final acceptance.
Only the existing owner can reconcile it. The current Web admission precheck
requires unchanged legacy artifacts, so complete Web admission/prechecks before
any Native binary replacement. Ordering and runtime deployment remain F's scope.
A later request to re-admit a partially deployed candidate remains blocked until
reconciliation; this mechanism provides no skip or partial-deployment bypass.

The final successful receipt must pass the existing complete-receipt validator,
match the lease's exact Web/Native SHAs, preserve all accepted capabilities and
have result PROMOTED. It additionally records first_github_first_gates with
source_regression, native_build, asset_hash, rollback, single_owner, procdump,
runtime_health and live_acceptance, each with pass and an evidence reference.
Use action finalize with --candidate-root and --receipt. Canonical GitHub
reachability is rechecked. CANDIDATE_ACTIVE is insufficient.

On success the accepted receipt is saved, a permanent consumption marker is
created, and the state is atomically replaced with GITHUB_FIRST, real deployed
SHAs, final deploy ID/receipt and legacy_bootstrap_available=false. The marker
makes restoring an old legacy state unable to re-enable migration. If state
replacement fails, the pending/open-drift state and marker continue blocking.
After success all future leases use NORMAL. The first-mode path cannot recur.

For a never-started/rolled-back failed attempt, owner action release-failed
requires all legacy and rollback bytes to match before releasing its lease and
closing drift; baseline mode and bootstrap availability remain unchanged.
Changed artifacts keep drift OPEN and retain ownership for reconciliation.
Missing or incomplete final receipt after begin also leaves drift OPEN.

## Isolated verification

- test-legacy-production-bootstrap.mjs: tests all 14 requested cases plus
  duplicate-owner, evidence binding, artifact mismatch and consumption safety.
- test-production-promotion-governance.mjs: existing 31 governance assertions.
- test-dashboard-manifest-deploy.ps1: existing fixture-only deployment/rollback
  suite. It never operates on the canonical Production root.

No test acceleration, gameplay fixture, live acceptance or runtime restart is
used by this task. Real bootstrap results are recorded separately after the
source checkpoint is promoted to GitHub main and executed from a clean checkout.
