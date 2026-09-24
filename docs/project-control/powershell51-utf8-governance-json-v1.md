# PowerShell 5.1 UTF-8 governance JSON fix V1

WORKLINE_ID = POWERSHELL51_UTF8_GOVERNANCE_JSON_FIX_V1

## Root cause

The first GitHub-first promotion passed admission and acquired the lease with
owner `F｜M1 最終整合`. Native deploy then wrote the pending record, set the
state to `OPEN` and called `native-runtime-adapter.ps1 -Action stop`.
Before any stop, the adapter read the lease.

- LEASE_JSON_PATH = `.local/ro-stack/production-deployment-lease/lease.json`
- LEASE_JSON_WRITER = `production-deployment-state.mjs --action acquire`,
  `JSON.stringify` + `fs.writeFileSync` (Node default UTF-8, no BOM)
- LEASE_JSON_READER = `native-runtime-adapter.ps1`:
  `Get-Content -LiteralPath <lease> -Raw | ConvertFrom-Json`
- LEASE_JSON_ENCODING_ON_DISK = UTF-8 without BOM
- POWERSHELL_VERSION = Windows PowerShell 5.1.22621.963 (`powershell.exe`)
- System ANSI code page for PowerShell 5.1 on this host = 936
- FAILED_OWNER_EXPECTED = `F｜M1 最終整合` (from `-Owner`, passed as a
  UTF-16 command line by Node and received intact)
- FAILED_OWNER_DECODED = code page 936 mojibake. In the isolated reproduction
  the misaligned multibyte sequence also consumed the closing quote, so
  `ConvertFrom-Json` failed before comparison.

Windows PowerShell 5.1 `Get-Content` without `-Encoding` decodes a BOM-less
file with the system ANSI code page. CLASSIFICATION =
POWERSHELL51_DEFAULT_ENCODING_MISMATCH. The adapter's previous `-ne` compare
was also case insensitive.

## Canonical contract

Governance JSON is UTF-8 without BOM, the format all existing Node writers and
PowerShell writers already produce.

- PowerShell: `ops/ro-stack/governance-json.ps1` provides
  `Read-GovernanceJson`, `ConvertFrom-GovernanceJsonBytes`,
  `Write-GovernanceJson` and `Write-GovernanceJsonStdout`. Bytes are decoded
  with `UTF8Encoding(false, true)`. BOM, invalid UTF-8, empty input, malformed
  JSON and missing or relative paths fail closed with
  `GOVERNANCE_JSON_BOM_FORBIDDEN`, `GOVERNANCE_JSON_UTF8_INVALID`,
  `GOVERNANCE_JSON_EMPTY`, `GOVERNANCE_JSON_INVALID` or
  `GOVERNANCE_JSON_MISSING`. There is no code page fallback.
- Node: `readJson` in `legacy-production-baseline.mjs` uses
  `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`. Invalid bytes
  throw instead of becoming U+FFFD; a BOM makes `JSON.parse` fail. The state,
  promotion gate, bootstrap and asset lock readers reuse it.
- Writers: Node `JSON.stringify` + `fs.writeFileSync` and PowerShell
  `Write-GovernanceJson`/`Write-IncidentJson` all emit UTF-8 without BOM.
  `Write-Receipt` now delegates to `Write-GovernanceJson -CreateNew`.
- Process boundaries: PowerShell JSON consumed by Node is written to stdout as
  UTF-8 bytes. `deploy-dashboard-manifest.ps1` sets
  `[Console]::OutputEncoding` to UTF-8 before decoding Node output.
- Lease identity in the Native adapter is `Assert-NativeLeaseOwned`: ordinal,
  case sensitive, no normalization, and the pending record owner must also
  match. Unicode owner names remain valid identities.

## Governance JSON I/O audit

UNCLASSIFIED_JSON_IO = 0. Scope: deployment/governance tooling under
`ops/ro-stack`.

| Site | Before | After |
| --- | --- | --- |
| native-runtime-adapter: lease, state, pending, tracked `state.json`, ProcDump receipt (5 reads) | IMPLICIT_ENCODING_UNSAFE | EXPLICIT_UTF8_SAFE |
| native-runtime-adapter: snapshot stdout to Node | IMPLICIT_ENCODING_UNSAFE | EXPLICIT_UTF8_SAFE |
| capture-legacy-runtime: ProcDump receipt read, stdout to Node | IMPLICIT_ENCODING_UNSAFE (2) | EXPLICIT_UTF8_SAFE |
| deploy-dashboard-manifest: policy, Web manifest, minimap manifest, state (2), lease, rollback receipt (7 reads) | IMPLICIT_ENCODING_UNSAFE | EXPLICIT_UTF8_SAFE |
| deploy-dashboard-manifest: Node output decode for complete check, closure, gate (3) | IMPLICIT_ENCODING_UNSAFE | EXPLICIT_UTF8_SAFE |
| runtime-incident `Read-IncidentJson` (ProcDump prior receipt) | IMPLICIT_ENCODING_UNSAFE | EXPLICIT_UTF8_SAFE |
| Node governance readers: shared `readJson`, state tool, promotion gate, bootstrap, asset lock (5) | UTF-8 with silent U+FFFD, counted unsafe | EXPLICIT_UTF8_SAFE |
| deploy-dashboard-manifest `Write-Receipt` | EXPLICIT_UTF8_SAFE | EXPLICIT_UTF8_SAFE (shared writer) |
| runtime-incident `Write-IncidentJson` (ProcDump receipt writer) | EXPLICIT_UTF8_SAFE | EXPLICIT_UTF8_SAFE |
| Node writers: deploy-native, production-deployment-state, bootstrap (3) | EXPLICIT_UTF8_SAFE | EXPLICIT_UTF8_SAFE |
| SHA-256 digests, `Copy-Validated` byte copies, asset manifest canonical bytes | BINARY/HASH_ONLY | BINARY/HASH_ONLY |
| native-promotion-contract `.cpp` and decision text, bootstrap secret scan, `inter_conf.txt`, ProcDump UTF-16 console logs, `ro-stack.ps1` and `dashboard-service.ps1` process state | NOT_APPLICABLE | NOT_APPLICABLE |

GOVERNANCE_JSON_IO_SITES = 29. UNSAFE_JSON_IO_SITES_BEFORE = 24.
UNSAFE_JSON_IO_SITES_AFTER = 0. `ro-stack.ps1` and `dashboard-service.ps1`
read their own process tracking files, not governance metadata; `ro-stack.ps1`
is a pinned Native lifecycle file and changes only through Native promotion.
The governance adapter reads `state.json` explicitly.

## Failed operation record

After the failed stop, `executeNative` retained `native-deploy.lock` because
state had already been set to `OPEN`. The owner ran `release-failed`, which
verified legacy bytes, closed drift and removed the lease and pending record.
The lock held only `stage/` with the three candidate binaries and blocked any
retry with `NATIVE_DEPLOY_BUSY`.

NATIVE_DEPLOY_LOCK_CLASSIFICATION = COMPLETED_FAILED_OPERATION_RECORD.

`deploy-native-candidate.mjs --action archive-failed-operation --owner <task>
--production-root <canonical>` is the canonical close-out. It runs only from a
clean governance checkout reachable from GitHub `main` and requires: no lease
directory, no pending record, drift `CLOSED` without reason, every current
Native binary equal to the state baseline, no `*.candidate-*` temporary file,
and a lock containing only `operation.json` and `stage/`. It writes
`failed-operation-record.json` with staged artifact hashes and renames the
directory to `native-deploy-failed-<UTC>-<id>`. Staged bytes are retained.
New attempts now write `operation.json` with owner, lease id and manifest hash
when the claim is created.

Executed from governance SHA `55e5105d175a47c3d71ebfdea2d5cb248277ff1e` at
2026-09-24T14:19:32Z: archive
`.local/ro-stack/native-deploy-failed-20260924T141932666Z-a9b2dcaf`. The
guards confirmed lease FREE, pending absent, drift `CLOSED` and all three
current Native binaries equal to the state baseline (map
`294482A6…9B0B`). Staged candidate hashes retained: login `E8111B3F…FEB2`,
char `D701489D…FDD7`, map `2C396313…508F`. The claim predates
`operation.json`, so the record marks the operation journal as not recorded;
the lease id remains in F's release-failed history. After archive,
`native-deploy.lock` is absent and FAILED_OPERATION_RECORD_BLOCKS_NEW_DEPLOY =
NO.

## Runtime observation outside this workline

Read-only checks during this workline found login, char and map absent. The
sentinel incident `16a72f9ab96b45a79faadb690991c8e4` records all three exiting
with code 0 at 2026-09-24T13:55:15Z, about 5.5 minutes after the state file's
release-failed write, with no Windows fault event and no launcher or sentinel
action. Port 8788 was also empty at 13:55:20Z; a new Dashboard later listened
on 8788. The cause is UNRESOLVED. This workline did not stop, start or restart
any process. A Native retry requires a healthy canonical runtime snapshot, so
restoration is a Project Control decision.

## Verification

`ops/ro-stack/tests/test-governance-json-utf8.mjs` runs real Windows
PowerShell 5.1 through `governance-json-ps51-probe.ps1`.
UTF8_GOVERNANCE_TEST_COUNT = 22, all PASS: ASCII, Traditional Chinese,
mixed and Japanese/Korean owners; no-BOM read; deterministic BOM rejection;
Big5 file, malformed UTF-8, malformed JSON and missing file fail closed;
one-character owner change, wrong owner and wrong lease id rejected; state
round trip; Native manifest read; deploy receipt round trip without overwrite;
Unicode `release-failed`; Node-written failed-lease fixture accepted by the new
PowerShell 5.1 reader; PowerShell-written JSON and stdout decoded by Node;
pre-fix reader reproduction; ProcDump receipt reader; ordinal case check; and
failed-operation archive guards.

FAILED_LEASE_FIXTURE_BEFORE = FAIL (reproduced, JSON parse failed under code
page 936). FAILED_LEASE_FIXTURE_AFTER = PASS.

Regression: Native promotion 24, legacy bootstrap 29, promotion governance 31,
full Web manifest 35, private path policy 1, Dashboard manifest deploy 26,
Native adapter 5 (PowerShell 7 and 5.1), ProcDump identity 19, ProcDump
sidecar 14, runtime incident 31, sentinel 11. GOVERNANCE_REGRESSION = PASS,
226 checks. No lease, rollback, manifest, Git SHA, asset, capability,
single-runtime, ProcDump, receipt or baseline gate was relaxed.

Source changes to `runtime-incident.lib.ps1` reach the Production sentinel only
through a later approved Web promotion. This workline did not deploy Web or
Native, restart a service or touch player state.
