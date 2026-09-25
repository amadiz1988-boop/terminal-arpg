# Active first-promotion Native candidate amendment V1

Scope: lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`, owner `F｜M1 最終整合`, Web candidate `8cdb13fb88be7199aae15b81e55a9a89a5ec78c5` (unchanged). The reconciled Native stage `a4c736d865eeedca398aad97aeff1c1036f2dc39` becomes `INTERMEDIATE_NATIVE_CANDIDATE`; the fast-forward descendant `23c47bfee3a4a1dae21754fb7a4e3ed32d3f657a` becomes `ACTIVE_NATIVE_CANDIDATE`. Reason: `NATIVE_PA_GRACEFUL_SHUTDOWN_MYSQL_RACE_V1`. The promotion, lease and Web candidate stay the same and first promotion remains incomplete.

Tool: `ops/ro-stack/native-candidate-amendment.mjs`. It runs only from a clean governance checkout reachable from `terminal-arpg/main`, against the canonical Production root.

## Candidate

The candidate is built by `scripts/build-native-candidate.py --sha 23c47bf…` from a fresh clone of private `ghost-island-rathena/main` (Release x64 plus the 13 offline suites). `scripts/prepare-native-candidate.mjs --amend-active true` then:

- runs `tools/pa-shutdown-handoff/build-and-test-shutdown-handoff.ps1` in the clean clone and pins its log (≥200 stress iterations with hang, duplicate prepare, cross-thread DB and post-request PA work all 0);
- audits the a4c→23c diff: exactly five files, map.cpp changes confined to the shutdown handler/finalize handoff, persistent_agent.cpp changes confined to six timer guards (`BOUNDED_NATIVE_SHUTDOWN_FIX`);
- verifies SP 0/0, the HYBRID low-SP weapon fallback and the Start/Stop Farm lifecycle, plus the 18 accepted capabilities;
- copies the running a4c binaries into `intermediate-rollback/` beside the legacy rollback reference.

The governance shutdown contract now requires the fixed shape: `handle_shutdown()` only records the request; `finalize()` begins the handoff, runs PA prepare→confirm and completes it. The a4c source no longer satisfies it.

## Amendment

`--action plan` is read-only. `--action amend --execute true` requires the exact lease, Unicode owner, valid a4c stage receipt, descendant SHA equal to the release authority, valid build receipt and candidate manifest, rollback coverage, an incomplete promotion and a legacy baseline. It copies the original a4c receipt byte for byte into `.local/ro-stack/native-receipt-history/`, writes `native-candidate-amendment-<lease>-<sha12>.json`, and appends `native_candidate_amendments` plus `active_native_candidate` to the lease and pending record. `native_deploy_git_sha` stays a4c until deployment. A repeated call returns `already_amended`; a different candidate is `NATIVE_AMENDMENT_CONFLICT`.

## Deployment by F

`--action deploy --execute true` stages the new binaries, then retires the running a4c runtime. No main-thread stop path exists for it: map console is off, `@mapexit` is outside the fixture bridge allowlist, and the launcher stop sends Ctrl+C to the signal callback thread that carries the race. The existing graceful stop is always attempted first. Only if it fails is the known-bug fallback considered, and every gate must hold: same lease, deployed SHA a4c, live map binary hash equal to the a4c artifact, exactly one map PID equal to the pinned old PID, graceful signal logged, at least 40 s elapsed, process still alive, map log showing `Shutting down...` without `Terminating...`, and evidence written. The adapter action `retire-known-buggy-map` re-proves PID, path, start time and hash, terminates that PID only, and `stop-remaining` stops char/login through the launcher. Scope: `OLD_BUGGY_NATIVE_ONLY`. Once the deployed SHA is 23c the fallback is unavailable (`FORCE_RETIRE_HEALTHY_NEW_NATIVE`).

The new stage receipt is written to `.local/ro-stack/native-promotion-receipt-23c47bfee3a4.json` and named by `pending.native_receipt_path`; the original receipt file is never overwritten. The lease and pending record then advance to 23c.

## Race closure

`--action graceful-cycle --execute true` performs the required second cycle on 23c: graceful stop through the normal signal path within 60 s, map log ending in `Terminating...`, char/login stopped, restart of the same binaries, one runtime, new SYSTEM ProcDump generation, health PASS. A failed stop records FAIL and never forces. PASS writes `native-graceful-shutdown-live-<lease>-<sha12>.json`. Finalizing the first promotion is blocked with `NEW_NATIVE_GRACEFUL_SHUTDOWN_LIVE_REQUIRED` until that receipt exists.

## Chained Web amendment verification

`verifyNativeStage` previously re-checked the superseded 00e0e9e Web receipt against live bytes after 8cdb13f was deployed and failed with `DEPLOYED_FILESET_MISMATCH`. A superseded receipt now keeps its hash, identity, fileset and rollback checks, and live bytes must match the single lease-bound receipt of the current Web candidate.
