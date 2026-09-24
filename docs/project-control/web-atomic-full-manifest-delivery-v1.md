# Complete Web manifest delivery V1

WORKLINE_ID = WEB_ATOMIC_FULL_MANIFEST_DELIVERY_V1

## Authority and migration

WEB_DEPLOYMENT_MANIFEST = COMPLETE_PROMOTION_PAYLOAD
MULTI_MANIFEST_SINGLE_PROMOTION = FORBIDDEN
PRECOPY_OUTSIDE_LEASE = FORBIDDEN
LEGACY_256_FILE_LIMIT = SUPERSEDED

One Web candidate uses one complete manifest, one lease and one Web deployment
receipt. The existing combined Native/Web final acceptance receipt remains the
only authority that advances the accepted Production baseline. These are two
phases of the existing architecture; a Web CANDIDATE_ACTIVE receipt alone does
not advance it.

Ordinary and FIRST_GITHUB_FIRST_PROMOTION admission require `web-complete-v1`.
Old manifests remain readable for explicit historical rollback and isolated
legacy fixtures. They cannot acquire a new normal/first promotion lease.

## Audit of the former limit

- OLD_MANIFEST_FILE_LIMIT = 256
- OLD_LIMIT_CLASSIFICATION = LEGACY_ARBITRARY_BOUND / LEGACY_TOOLING_LIMIT
- NOT_PRODUCT_REQUIREMENT = YES; UNKNOWN_CLASSIFICATIONS = 0
- Evidence: historical Web commit `e274edf2` changed the direct count guard from
  64 to 256 while adding runtime closure and failure recovery. Canonical
  reconstruction `6c6fb444` inherited it. No parser, asset format or cryptographic
  invariant depends on 256. The implemented purpose was bounding input size and
  the deployment replacement loop. No stronger author-intent claim is made.
- Runtime entry/caller: F invokes `ops/ro-stack/deploy-dashboard-manifest.ps1`.
  The only committed executable caller found by exact filename reference was
  `ops/ro-stack/tests/test-dashboard-manifest-deploy.ps1`.
- Count-dependent old tests: 256 PASS and 257 FAIL. They now both PASS; independent
  policy overflow tests replace the former arbitrary refusal.
- Documentation references: AGENTS.md, web-manifest-deploy.md,
  web-production-deployment.md, github-first-production-promotion-protocol-v1.md;
  governance-source-reconstruction-v6.json and web-publication-review-v6.json are
  immutable historical evidence, not current deployment policy.
- Mature local reference reviewed: `deploy-dashboard-checkpoint.ps1` staging,
  preimage backup, File.Replace and rollback/receipt checks, plus the existing
  manifest deploy's new-file ownership and automatic restoration. Classification
  REUSE: retain bounded file replacement and complete preimage recovery. No
  directory swap, second deployment engine or batch promotion is introduced.

## Independent limits

`web-manifest-safety-policy.json` is the reviewed Git authority. A manifest cannot
raise its own limits. Current ceilings are 100,000 files, 67,108,864 manifest
bytes, 4,294,967,296 total payload bytes and 268,435,456 bytes per file. Count
capacity is over 17 times the currently discovered 5,737 required paths. Resource
limits supplement schema, hashes, complete fileset, provenance, path and rollback
guards. Changes require a reviewed governance commit and fixture checks.

Only GIT_SOURCE and PRIVATE_ASSET_RELEASE are currently approved. A future
GENERATED_REPRODUCIBLE source requires a separately reviewed generation/provenance
contract. Unreviewed removals are rejected; this additive/replacement candidate
requires no deletion. Existing replaced files have verified preimage bytes;
added files carry ABSENT and rollback removes only an unchanged owned candidate.

## Complete manifest schema

Header fields: schema_version=`web-complete-v1`, candidate_id, web_git_sha,
canonical_repository, canonical_branch, asset_release, asset_package_sha256,
asset_manifest_sha256, file_count, total_payload_bytes, generated_at,
manifest_digest. The existing candidate_commit, candidate_root, production_root,
private_asset_package_root and FIRST promotion evidence/Native references remain.
`generated_at: git:<exact SHA>` is the deterministic source identity alternative.

Every file has relative_path, sha256, size and source_class. Existing `path` and
`candidate_sha256` aliases must match exactly. Rollback is either
production_preimage_sha256 or production_preimage=`ABSENT`. removed_files is [].
Digest is uppercase SHA256 of recursively key-sorted compact JSON with only
manifest_digest excluded. Array order is preserved. Absolute roots, evidence
pins and every entry are included. Lease also pins the exact serialized bytes.

No traversal, absolute/ADS path, empty segment, Windows device name, trailing dot
or space, reserved wildcard, duplicate or case collision is allowed. Each path
must stay in the approved Web source/data scope. Reparse paths are refused.
Legal existing apostrophe asset names are accepted.

## Generation and admission

Use `scripts/prepare-web-complete-manifest.mjs` from the new published governance
checkout with --candidate-root, --web-sha, --package-root, --production-root and
an external new --output path. For FIRST promotion also supply --native-manifest
and --first-evidence so the final digest covers their pins before lease admission.

The independent census seeds tracked dashboard/public RO/asset index trees plus
all pinned private assets, then follows backend imports, startup JSON and Browser
references. Test/POC files are excluded. Missing or invalid candidate dependencies
and named exports block admission. Production never supplies missing candidate
bytes. Generated output is never silently adopted.

Admission rechecks exact clean Git HEAD, canonical main reachability, current
private immutable release identity and package/manifest hashes, the complete
independently derived path set, source classes, all sizes/hashes and rollback
preimages. Production state/capability superset and combined Native gates remain
mandatory. No lease is acquired until these checks pass with CLOSED drift.
After Native staging, only the existing same-owner/pending-receipt continuation
exception permits OPEN drift. The same raw manifest and digest remain bound.

`--audit true` emits a NON_DEPLOYABLE_CENSUS for source diagnosis. This format is
rejected by deployment admission. It never substitutes for a complete manifest.

## Transaction and receipts

The sole manifest tool stages and backs up every entry before stopping Dashboard.
It retains the existing service lifecycle, verified atomic per-file replacement,
health checks and complete rollback. Failure has no success receipt and does not
advance baseline. Atomic describes acceptance and recovery, not simultaneous OS
replacement of thousands of files.

The Web receipt adds web_git_sha, candidate_id, manifest_digest,
manifest_file_count, manifest_total_payload_bytes, asset_release,
asset_package_sha256, asset_manifest_sha256, predeploy_baseline,
rollback_reference, deployment_result and lease_id. All manifest files are hashed
again after replacement before PRODUCTION_FILESET_MATCHES_MANIFEST=true and the
single Web success receipt can be written.

The combined final receipt must copy these identity fields and provide
`web_deployment_receipt: {path, sha256}` relative to Production. Its files array
must equal the complete Web manifest fileset. Finalization reopens the sealed
manifest, verifies its raw hash and digest against the lease, every deployed
file, receipt identity/owner/lease, rollback backups and prior baseline id. It
also retains Native, capability and live acceptance gates. Reusing a subset
receipt cannot advance the baseline.

## Approved candidate census, 2026-09-24

Web SHA: 4a0b69797b7b75ddbd5ffe18dbc3913c911327b1.
Release: web-runtime-assets-v1.1.0. Current authenticated verification: private,
immutable, 5,107 package entries valid.
Package SHA256: 3f2e1ac73f24c9dd777dc89fa852da450f2c31298a91b98faf67f1909a82029a.
Manifest SHA256: a3e554a6586cc7a57e78c3a76c33e6fa7deea677f26400caacd7b74084ecf2f8.

| Measurement | Verified result |
| --- | ---: |
| Required paths | 5,737 |
| Available files | 5,734 |
| Git source files available | 627 |
| Private asset files available | 5,107 |
| Generated files | 0 |
| Other required files, missing | 3 |
| Available payload bytes | 140,664,749 |
| Maximum available file bytes | 8,828,374 |
| Duplicate paths | 0 |
| Windows case collisions | 0 |
| Non-deployable inventory bytes | 1,384,290 |

Inventory SHA256: F8852CBDDD8FB99BA529DE1C88AC043B5BFBDEA1A1192E93134F499EE71BF4C1.
Complete manifest file count/bytes and complete payload bytes are unavailable:
no valid complete manifest can be generated for this SHA. Inventory bytes must
not be reported as complete deployment manifest bytes.

Missing startup files:

- ops/ro-stack/persistent-agent/quest-content/first-job.json
- ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json
- ops/ro-stack/web-experience/action-registry.json

Missing required named exports:

- persistent-agent/relocation-policy.mjs: coordinatorDeadlineMsForRouteSteps
- combat-sse.mjs: gateCombatSseForServerAgent
- web-latency-trace.mjs: recordWebDiagnosticQuery, webHotPathDiagnosticEnabled

These are canonical candidate blockers independent of the removed count limit.
This governance task does not reconstruct gameplay source or fill from Production.
F must retain BLOCKED until Project Control approves a repaired canonical Web SHA
and regenerates/admit-tests its entire manifest with the new governance tooling.
No real lease, deployment, endpoint contact, service restart or player mutation
was authorized or performed by this workline.

## Isolated verification

- test-web-full-manifest.mjs: 35 checks, including 255/256/394/5,108 file
  admission, independent resource limits, missing/hash/path/provenance/header
  refusal, one lease/digest identity, partial failure without success or baseline
  advancement, actual 5,108-file fixture deployment, receipt and full rollback.
- test-web-private-path-policy.mjs: 1 check covering every one of the 5,107
  pinned private asset paths, including Dashboard pet WebP assets. The read-only
  census path check also accepted all 5,734 available candidate paths.
- test-dashboard-manifest-deploy.ps1: 26 legacy/rollback compatibility checks.
- test-production-promotion-governance.mjs: 31 promotion governance checks.
- test-legacy-production-bootstrap.mjs: 29 migration/finalization checks.
- test-native-promotion.mjs: 24 combined Native/Web contract checks.

Fixture evidence is separate from the blocked approved candidate and from
Production acceptance. The fixture complete fileset has PRESTAGE_FILE_COUNT=5108,
PRESTAGE_MISSING=0, PRESTAGE_HASH_MISMATCH=0,
PRESTAGE_UNMANIFESTED_REQUIRED=0, ROLLBACK_COVERAGE_FILE_COUNT=5108 and
ROLLBACK_UNCOVERED_PATH_COUNT=0. No fixture PASS authorizes deployment of the
incomplete 4a0b6979 source.

WEB_FULL_MANIFEST_GOVERNANCE_TEST_COUNT = 36
ALL_RELEVANT_ISOLATED_CHECKS = 146 PASS
TOOLING_READY = YES
APPROVED_CANDIDATE_READY = NO
WEB_MANIFEST_ADMISSION = BLOCKED_BY_CANONICAL_SOURCE_CLOSURE
