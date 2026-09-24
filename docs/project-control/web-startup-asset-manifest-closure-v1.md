# First-promotion Web startup asset manifest closure V1

Workline: F | M1 first GitHub-first promotion. The Native stage remains active under lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a` and has the reconciled Native receipt. This record describes the first Web deploy attempt and its bounded source correction.

## First broken transition

The Web manifest precheck passed for 5,737 files, but the candidate Dashboard read `ops/ro-stack/persistent-agent/world-map-teleport-source.json` during module startup. That Git-tracked file existed at Web SHA `569208c9437cd0b0add5c7b4b6edb822cc34bf5e` and was absent from the manifest and Production. The candidate process exited with `ENOENT` at `dashboard.mjs:492`. The deploy tool recorded `DASHBOARD_SERVICE_start_FAILED:1` in phase `DASHBOARD_START`.

The failure receipt is `.local/ro-stack/dashboard/deploy-receipts/manifest-7e24661a20eb4cdfbdd6d072188bfd71/failure-6e575e71e64b48c78ba89f32441e96aa.json`. It reports `FAIL_CLOSED`, `PREIMAGE_RESTORED` and 5,737/5,737 final preimage matches. The old Dashboard restarted as PID 42260 and `/api/health` returned `ok:true`. Native PIDs 2876, 22084 and 46636 were unchanged. The lease and Native receipt remain active. No Web success receipt was issued.

## Source correction

`manifest-runtime-closure.mjs` now follows a top-level `readFile(join(root, '...'))` when `root` is statically derived from the module directory and resolves to the candidate project root. This includes the exact missing startup JSON in `expectedPayload` and the complete manifest. The test uses that same startup expression and requires the closure to fail when the JSON is omitted.

The old lease pins the old manifest hash and digest. `amend-failed-web-manifest.mjs` provides a formal same-lease rebind for this exact failure and one additional source file. Its dry run checks the owner and lease, pending Native receipt, old and new candidate identity, original failed receipt, every restored Web preimage, reconciled Native binaries and receipt, and fresh complete-manifest admission. Execution writes an immutable amendment record and atomically updates the lease manifest binding. It does not change game application files, Native binaries or the Native receipt. The old manifest and failure record remain unchanged.

## Validation and remaining gates

Source evidence at this checkpoint: `test-web-manifest-amendment.mjs` 8/8, `test-web-full-manifest.mjs` 36/36, promotion governance 31/31 and Native promotion 43/43 passed. Fresh complete manifest generation found 5,738/5,738 files with zero missing, mismatched or rollback gaps; its only added path is the startup JSON. The read-only amendment plan matched the real lease, restored Web bytes and reconciled Native stage. Runtime completion still requires successful Web deployment, smoke checks, Player test flows, Browser presentation, final promotion receipt and lease release. Source tests and a healthy legacy Dashboard do not count as Web Production acceptance.
