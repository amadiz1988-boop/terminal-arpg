# Canonical Production Web Deployment

Status: `CANONICAL_DEPLOYMENT_POLICY=ACTIVE`; `SOURCE_VALIDATED=YES`;
`PRODUCTION_VALIDATED=YES`; `PRODUCTION_VALIDATION_STATUS=FINAL_WEB_SUPERSET_PROMOTED`.

## Current promoted Web baseline (2026-09-23)

- Final source: `b975021e449f50c9b53ae06d294ba0daf6a72068` on
  `codex/production-web-final-superset-v1`, composed from the accepted current
  Production fixture baseline `d22361ed9e618f8bd9fd6290c44d989f823a75ef`,
  accepted V5 feature reference `9290df46b0b81d6ccbd67e8b20867d68c48cc992`,
  and request-scoped observability reference `1ef66ac326b77ce8a0ae8de2e2ba49b53673c6f0`.
  Public Admin security lineage `fbe974579f198e451dcc3bc041333ef2baa1aca5`
  and headless fixture transport remain included.
- Dashboard SHA256:
  `A1D48404C6ECE823DEBB29E3105AE75590A13184127CEA3FC1ABCE0804E828A5`.
  The prior accepted Production Dashboard SHA256 was
  `B13AA400B7CB8B1AD764C25589E355C38BF0EDDD9D4DB52A8D952279C65889E4`.
- Final manifest: 194 exact Web paths, SHA256
  `E05EE5F45044D855E83B7365C9AA4E322CF0E620BA44BC43134D172CA143CF2B`;
  read-only precheck passed. Deploy receipt:
  `C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\dashboard\deploy-receipts\manifest-0af69529fa284e0da15ab520d73fe737\deploy-receipt.json`.
- Request-scoped ordinary Player proof: session, lean state, and live-position
  each had zero support-session SQL lookups, zero Admin-data SQL queries, and
  zero synchronous monitoring writes; positive DB query counts confirmed
  attribution. Public Admin data and ordinary Player fixture access were denied.
  Authorized Admin/Test read transport returned `command_not_found` for a
  nonexistent request ID; no fixture command was submitted.
- Player Browser smoke passed at desktop and 390x844 for status, map info,
  available-map preview, no page overflow, and no Admin controls. The
  pre-existing ordinary Player Browser character was nonresident; a separate
  resident TEST_PLAYER provided 20/20 available live-position samples with
  maximum freshness age 509 ms. No gameplay command was sent.
- Final 6901/6122/5122/8788 listeners were each exactly one. Native PIDs
  were unchanged. Dashboard health and Admin Web Experience were healthy.
  Request diagnostics were returned to their default-off mode after proof.
  Production remains on the final Web Superset; no rollback was performed.

The following V3/V4/V5 paragraphs record the earlier preparation and failures.
The historical V5 candidate was later canary-tested and rolled back; it is not
the current Production source.

Policy authority: `AGENTS.md`. Initial tool source checkpoint:
`8f3073079e075771cd63c2a830da100e722068a7`; canonical integration
checkpoint: `855c1bc180f6844e4077c9ea6c5ed0504bfad387`.
The accepted tool and its tests are integrated into the canonical shared
`terminal-arpg` checkout. Source integration and Production validation remain
separate gates. V3 executed a real deploy attempt; the candidate Dashboard
failed startup because an imported local module was omitted from the manifest.
Automatic recovery restored 16/16 preimages and health, but a durable failure
receipt and bounded transaction finalization were missing. V3 did not pass.
The original V3 manifest fails read-only precheck on the omitted module. V4
applied its 195-file manifest, then Node exited before binding 8788 because
`standard-farm-map-release-registry.json` was absent. Automatic rollback
restored 195/195 preimages and Production health. Startup `readFile` closure
now rejects V4 before mutation, including two changed Quest JSON assets.
The additive 198-file V5 manifest passed read-only precheck with 312 resolved
dependencies. At that stage, V5 had not yet been deployed.

## Entrypoints

- `CANONICAL_WEB_DEPLOY_TOOL=ops/ro-stack/deploy-dashboard-manifest.ps1`:
  the sole general multi-file Production Web entrypoint. Modes are
  `-Precheck`, `-Deploy`, and `-Rollback`.
- `CANONICAL_DASHBOARD_LIFECYCLE=ops/ro-stack/dashboard-service.ps1`:
  the Dashboard stop/start primitive.
- `deploy-dashboard-checkpoint.ps1` and `deploy-web-journey-atomic.ps1`:
  `LEGACY_BOUNDED_DEPLOY_TOOL`, `SOURCE_REFERENCE=YES`,
  `GENERAL_PRODUCTION_RELEASE_ENTRYPOINT=NO`. Retain historical receipts.

`WEB_DEPLOY_REQUIRES_MANIFEST=YES`; `WEB_DEPLOY_PRECHECK_REQUIRED=YES`;
`WEB_DEPLOY_CANDIDATE_HASH_REQUIRED=YES`;
`WEB_DEPLOY_PREIMAGE_HASH_REQUIRED=YES`; `WEB_DEPLOY_ROLLBACK_REQUIRED=YES`;
`WEB_DEPLOY_RECEIPT_REQUIRED=YES`; `WEB_DEPLOY_FAIL_CLOSED=YES`;
`WEB_DEPLOY_WEB_ONLY=YES`.

The manifest names 1-256 unique, authorized Web-relative paths, a clean
candidate commit/root, Production root, and exact candidate SHA256 values.
Existing targets require their preimage SHA256; new targets require the explicit
`production_preimage: "ABSENT"` marker. No wildcard or implicit file discovery
is allowed. Before mutation, require valid schema and paths, matching hashes,
clean candidate worktree, healthy Production, one Dashboard, no second runtime,
and simulated post-deploy runtime delivery closure. Missing local imports,
direct Web resources, or map-info detail data fail precheck with no Dashboard
stop and no Production file mutation. `DEPLOYMENT_RUNTIME_CLOSURE_REQUIRED=YES`;
`SOURCE_IMPORT_PASS != DEPLOYMENT_CLOSURE_PASS`.

## Required sequence

```text
MANIFEST -> PRECHECK -> VERIFY PREIMAGES AND CANDIDATE HASHES -> STAGE
-> DASHBOARD STOP -> VERIFY 8788 = 0 -> REPLACE EXACT MANIFEST FILES
-> VERIFY DEPLOYED HASHES -> DASHBOARD START -> VERIFY 8788 = 1
-> /api/health -> PLAYER/API ACCEPTANCE -> DEPLOY RECEIPT
```

No step silently advances after failure. Stage fresh candidate copies and
complete preimage backups before stop. Preserve one Dashboard process only.
`WEB_DEPLOY_RESTARTS_RATHENA=NO`; login/char/map PIDs on 6901/6122/5122
must remain unchanged. A second Dashboard or rAthena stack is forbidden;
OpenKore runtime remains zero.

```text
DEPLOY RECEIPT + SAVED MANIFEST -> DASHBOARD STOP
-> RESTORE ALL MANIFEST PREIMAGES -> VERIFY EVERY PREIMAGE SHA256
-> DASHBOARD START -> VERIFY 8788 = 1 -> /api/health
-> VERIFY 6901/6122/5122 PIDs UNCHANGED -> ROLLBACK RECEIPT
```

Rollback restores all existing manifest preimages. An `ABSENT` preimage is
removed only when its file is manifest-owned and still matches the deployed
candidate hash. Unlisted files, directories, and runtime-created files remain
untouched. Keep backups and receipts as operational evidence; Production
runtime copies are not source authority.

## Receipt and acceptance

Each deploy and rollback receipt must record timestamp, mode, manifest hash,
candidate commit and root, Production root, preimage and candidate hashes,
changed files, Dashboard PID before/after, 6901/6122/5122/8788 listener
counts and PIDs, health before/after, rollback performed, and final state.
Receipts contain no secrets. The saved manifest belongs to the receipt bundle.

The integrated tool records `candidate_root` independently in deploy,
rollback, and failure receipts from the validated manifest source root.
Rollback rejects a deploy receipt whose root differs from the saved manifest.
A failed post-mutation deploy must exit after either verified automatic
rollback or an explicit unsafe-state failure receipt. Its receipt records
failure phase/reason, mutated files, topology and health before/after, rollback
attempt/result, and final preimage validation. Verified automatic rollback
uses the failure receipt as its completion evidence; explicit `-Rollback`
requires a successful deploy receipt. This source contract has offline test
coverage; current Production validation is recorded above.
The current tool writes its runtime deploy receipt after health validation;
Player/API and Browser acceptance must be recorded separately before a release
can pass the full policy sequence.

`SOURCE_PASS + PRECHECK_PASS` does not establish `PRODUCTION_DEPLOY_PASS`.
User-facing releases additionally require controlled deploy, health, Browser
acceptance, and canary rollback or final promotion acceptance. A canary may
activate a candidate, measure and Browser-test it, then restore preimages;
`CANARY_DEPLOY != PRODUCTION_PROMOTION`. Promotion needs separate Project
Control authorization.

## Prohibited paths

`DIRECT_PRODUCTION_FILE_COPY`, `AD_HOC_MULTI_FILE_DEPLOY_COMMAND`,
`GIT_CHECKOUT_IN_PRODUCTION`, `GIT_PULL_IN_PRODUCTION_AS_DEPLOY`,
`DIR_MIRROR_TO_PRODUCTION`, `WILDCARD_DEPLOYMENT`,
`DIRTY_WORKTREE_AS_DEPLOY_SOURCE`, `MANUAL_PARTIAL_ROLLBACK`, and
`UNHASHED_PRODUCTION_OVERWRITE` are forbidden. Feature teams, including
Navigation, Minimap, Settings, Discord linking, Quest, Combat, Diagnostic,
Fleet Health, Life/Social, Diary, Ranking, and Pet UI, use this same contract.

Changes to `deploy-dashboard-manifest.ps1` require a mature-reference audit,
backward compatibility or explicit migration, and passing fail-closed,
rollback, unauthorized-path, bad-preimage, bad-candidate-hash, and
unlisted-file-preservation tests. A feature task does not modify deploy
semantics incidentally.
