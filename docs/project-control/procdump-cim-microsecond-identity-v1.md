# ProcDump CIM microsecond identity V1

WORKLINE_ID = M1_FIRST_GITHUB_FIRST_PROMOTION_RETRY_AFTER_RECOVERY_V7
(bounded blocker found in Phase 2, before lease acquisition)

## Evidence

After OPS recovery the canonical map PID is 47184 and SYSTEM ProcDump PID 55152
targets it. Governance `c3c9fe50` rejected the valid attachment:

- Receipt `mapProcessStartTime` (CIM `Win32_Process.CreationDate`):
  `2026-09-24T14:25:42.1277350Z`
- `Get-Process -Id 47184` StartTime UTC: `2026-09-24T14:25:42.1277353Z`
- CIM CreationDate re-read now: `2026-09-24T14:25:42.1277350Z`
- Delta 3 ticks, reason `START_TIME_DELTA_EXCEEDED`.

CIM CreationDate uses the DMTF format with microsecond resolution, so its last
tick digit is always 0. `Get-Process` exposes the full 100 ns value. For one
process the reader therefore sees the receipt 0 to 9 ticks earlier. The V1
precision fix sampled map 43092 at exactly 1 tick and fixed the tolerance at 1,
which passes only when the last digit is 0 or 1. A newly started map after
Native promotion would fail the post-deploy ProcDump gate about 80 percent of
the time and leave Production in OPEN drift.

CLASSIFICATION = API_PRECISION_VARIANCE (CIM microsecond truncation).

## Rule

`Test-ProcDumpStartMatch` in `procdump-process-identity.ps1` is used by the
Native reader and the sidecar writer. A start matches when either:

- the absolute delta is at most 1 tick (existing rule), or
- the receipt start is microsecond aligned (ticks mod 10 = 0) and the current
  start is 0 to 9 ticks later, inside the same microsecond.

An earlier current start, the next microsecond, or an unaligned receipt still
fails closed. PID, executable, ProcDump PID/path/hash/flags/target and all
other identity checks are unchanged.

## Verification

- `test-procdump-process-identity.ps1`: 23 PASS in PowerShell 7 and 5.1
  (+2, +3, +9 inside the microsecond match; +10, -2 and unaligned +2 fail).
- `test-native-runtime-adapter.ps1`: 6 PASS in PowerShell 7 and 5.1, including
  a JSON receipt 3 ticks behind the live start.
- Regression: sidecar 14, incident 31, sentinel PASS, Native promotion 24,
  UTF-8 governance 22, promotion governance 31, legacy bootstrap 29.
- Read-only Production snapshot with this source: map 47184, ProcDump 55152,
  target 47184, delta 3, `PROCESS_IDENTITY_MATCH = YES`, OpenKore 0.

No lease was acquired and no Production file, process or player state changed.
Adoption requires publication to GitHub `main` and a new governance SHA.
