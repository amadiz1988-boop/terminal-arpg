# Running Native stage reconciliation and start adapter fix V1

WORKLINE_ID = RUNNING_NATIVE_STAGE_RECONCILIATION_AND_START_ADAPTER_FIX_V1

Project Control decision: FORWARD_COMPLETION. The approved Native candidate is
live under lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a` (owner
`F｜M1 最終整合`). The deploy tool returned
`{"result":"BLOCKED","error":"NATIVE_RUNTIME_START_FAILED"}` and issued no
Native stage receipt. Web had not started.

## Start adapter root cause

Topology: Node `spawnSync` (stdio pipes, 180 s timeout) → Windows PowerShell
5.1 `native-runtime-adapter.ps1 -Action start` →
`& powershell.exe -File ro-stack.ps1 -Action start | Out-Host` → launcher
`Start-Process -RedirectStandardOutput <file> -PassThru` → login, char, map.

In Windows PowerShell 5.1, `Start-Process` with redirection creates the
service with handle inheritance enabled. Every inheritable handle of the
launcher is inherited by the long-lived service, including the write ends of
the pipe the adapter reads through `| Out-Host` and, below that, the pipe Node
reads. The launcher exits after the services are ready, but the pipes never
reach EOF while a service is alive.

Isolated reproduction with a harmless 40 s child in the same topology:

| Case | Launcher finished | Caller result |
| --- | --- | --- |
| Node pipes → adapter-style `| Out-Host` → launcher → child | yes, about 1 s | adapter never resumed; Node `ETIMEDOUT`, `status=null`, `SIGTERM` |
| Node pipes → launcher → child | yes, process `status=0` | Node still `ETIMEDOUT` waiting for pipe EOF |
| Node file stdio → adapter-style `| Out-Host` → launcher → child | yes | adapter still blocked |

START_ADAPTER_ROOT_CAUSE = INHERITED_STDIO_HANDLE, at both the adapter's captured
launcher pipe and Node's stdio pipe. ROOT_CAUSE_CONFIDENCE = HIGH (reproduced).
The observed `NATIVE_RUNTIME_START_FAILED` is Node's timeout of the adapter
after a successful launch.

A second defect was confirmed: Windows PowerShell 5.1 started under pwsh 7
inherits a PowerShell 7 `PSModulePath`, loads the wrong
`Microsoft.PowerShell.Utility`, and `Get-FileHash` is missing. Removing
`PSModulePath` from the child environment restores the 5.1 default modules.

## Start contract fix

- `runtimeAdapter` runs `stop`/`start` with file-backed stdio under
  `.local/ro-stack/logs/native-adapter-caller-*.log`; `snapshot` keeps its
  JSON pipe because it starts no service. All Windows PowerShell 5.1 children
  receive `windowsPowerShellEnv()` without `PSModulePath`. The 180 s timeout
  remains.
- `native-runtime-adapter.ps1` invokes the existing launcher through
  `Invoke-BoundedLauncher`: `Start-Process` with stdout/stderr redirected to
  `.local/ro-stack/logs/native-adapter-<action>-*.log`, waiting only for the
  launcher process with a 150 s bound and failing with `LAUNCHER_TIMEOUT` or
  `EXISTING_LIFECYCLE_FAILED`. The launcher itself, its readiness waits, logs
  and single-runtime refusal are unchanged; `ro-stack.ps1` remains a pinned
  lifecycle file.
- The adapter fails with `POWERSHELL_MODULE_PATH_INVALID` if `Get-FileHash` is
  unavailable. Snapshots now also report per-role PID, executable path and
  process start time.

START_ADAPTER_RETURNS_BOUNDEDLY = YES.

## Formal reconciliation action

`deploy-native-candidate.mjs --action finalize-running-native-stage`
(`--dry-run true` validates without writing). Inputs: owner, lease id,
candidate manifest and SHA-256, the failed tool output, and old PIDs. It runs
from a clean governance checkout reachable from GitHub `main`. It writes
nothing unless every check passes:

- lease ACTIVE, FIRST_GITHUB_FIRST_PROMOTION, exact id and exact Unicode owner;
  candidate manifest, admission manifest and first-promotion evidence hashes
  bound to the lease;
- state LEGACY with drift `OPEN` / `FIRST_PROMOTION_PENDING_FINAL_RECEIPT`,
  pending record bound to the lease, no Native receipt and no consumed marker;
- failed operation journal present with exactly `operation.json` and
  `stage/`, bound to lease and manifest, and tool output exactly
  `NATIVE_RUNTIME_START_FAILED`;
- `inspectNativeCandidate` in `reconcile` mode (canonical GitHub SHA, clean
  build receipt, regression, capability superset, rollback, lifecycle pins);
- staged, current Production and build artifact hashes identical for login,
  char and map; every legacy Web byte unchanged; legacy rollback intact; no Web
  deploy receipt directory created after lease acquisition;
- snapshot: one login/char/map, one listener each, one Dashboard and database,
  OpenKore 0, `/api/health` HTTP 200 `ok:true`, each executable at the
  canonical path and started after the pending record;
- old PIDs equal the hash-pinned first-promotion evidence and differ from the
  running PIDs;
- ProcDump identity `YES` targeting the running map PID, receipt ATTACHED with
  the candidate map hash.

On success it writes `.local/ro-stack/native-promotion-receipt.json`
(`native-deploy-v1`, valid under `nativeReceiptValid`) stating
`tool_initial_result = NATIVE_RUNTIME_START_FAILED`,
`reconciliation_result = RUNTIME_ACTUALLY_STARTED_AND_VERIFIED`, the
governance SHA, previous and new binary hashes, old and new PIDs, ProcDump,
runtime health, OpenKore count, failed operation reference and an evidence
digest. It then records the receipt hash in the pending record, sets
`first_promotion_phase = FIRST_PROMOTION_NATIVE_STAGE_COMPLETE` in state
(baseline stays LEGACY, drift stays OPEN for the in-progress promotion, lease
untouched) and renames the journal intact to
`native-deploy-reconciled-<lease id>`. The failed tool output is not edited.

## Resume contract

F resumes the same lease: Web manifest deploy → `begin-first-promotion`
accepts the bound pending record → promotion gate admits the OPEN state only
through `verifyNativeStage`, which requires this receipt and hash → postdeploy
smoke → live acceptance → `finalize` with the final first-promotion receipt →
GITHUB_FIRST transition. A second Native replacement is blocked with
`NATIVE_STAGE_ALREADY_RECORDED`; a second lease cannot be acquired while the
lease directory exists. `release-failed` clears the phase field only when
legacy bytes are restored.

## Verification

`test-native-start-adapter.mjs`: REAL_LONG_LIVED_START_TEST_COUNT = 11, using a
real loopback-listening service through Node → Windows PowerShell 5.1 →
`Invoke-BoundedLauncher` → fixture launcher; the pipe control reproduces the
block, and bounded success, immediate exit, no listener, active stdout, active
stderr, launcher timeout, second runtime, PowerShell 7 module shadowing,
Unicode owner and ProcDump identity cases pass.

`test-native-promotion.mjs`: 43 checks including 19 reconciliation checks
(eligible dry run, binary, Native SHA, lease id, Unicode owner, released lease,
partial Web, ProcDump, OpenKore, duplicate map, executable path and start time,
old PID/API/tool result bindings, no receipt on failure, receipt generation,
legacy baseline kept, same-lease Web resume, second Native attempt blocked,
immutable failed record, and the real long-lived child suite).

Regression: UTF-8 governance 22, legacy bootstrap 29, promotion governance 31,
full Web manifest 35, private path policy 1, Dashboard manifest deploy 26,
Native adapter 6 (PowerShell 7 and 5.1), ProcDump identity 23, ProcDump
sidecar 14, runtime incident 31, sentinel 11. All PASS.

## Production reconciliation

Governance SHA `515187624a058684db4d5fce4341045d21fcd460`, reachable from
GitHub `main`. A `--dry-run true` pass was eligible, then the formal action
ran against the live stage without stop, start or Native copy.

| Role | Previous | Current = expected |
| --- | --- | --- |
| login | `05900C07…7B620` | `E8111B3F…FEB2` |
| char | `C9907E89…CA9D` | `D701489D…FDD7` |
| map | `294482A6…9B0B` | `2C396313…508F` |

Old PIDs login 5248, char 24024, map 47184 (pinned evidence
`1141B936…4940`); running login 2876, char 22084, map 46636 at the canonical
paths, one listener each, Dashboard and database present, OpenKore 0,
`/api/health` 200. ProcDump 7868 targets 46636, identity YES (7 ticks inside
the CIM microsecond rule).

Receipt `.local/ro-stack/native-promotion-receipt.json`, deploy id
`native-reconciled-59630363-cf7b-470f-b8f0-96471f3a269b`, SHA-256
`F3B21421D9B381E7C743526226ED7B239D015E39B1845FAF9C6B457F38220584`, evidence
digest `F107076BE81C3C508C63CD7D6D68A3B16E70D4EEC7232BF4D6068B14B8336472`.
Pending hash matches; `nativeReceiptValid` and `verifyNativeStage` pass.
State: LEGACY baseline, drift OPEN, phase
`FIRST_PROMOTION_NATIVE_STAGE_COMPLETE`. Lease `869f1725…` remains ACTIVE with
owner `F｜M1 最終整合`. Journal renamed to
`native-deploy-reconciled-869f1725-dbd0-452d-b9dd-37ee79cc3f9a` with
`operation.json` hash unchanged; the failed tool output
(`5AF85EBF…1504`) is unchanged. Web deployment is pending under the same lease.
