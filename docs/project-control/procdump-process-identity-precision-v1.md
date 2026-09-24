# ProcDump process identity precision fix V1

WORKLINE_ID = PROCDUMP_PROCESS_IDENTITY_PRECISION_FIX_V1

## Root cause and evidence

The runtime sentinel obtains the map start from CIM `Win32_Process.CreationDate`,
converts it to UTC and formats it with `ToString('o')`. The ProcDump attachment
writer copies that value into `mapProcessStartTime` in
`procdump-attachment-state.json`; `Write-IncidentJson` serializes the receipt.
The Native adapter reads that JSON with `ConvertFrom-Json`, which can convert
ISO time text to a `DateTime`. It compares its parsed value with
`Get-Process -Id <map PID>.StartTime.ToUniversalTime()` using exact DateTime
inequality. This rejected the current receipt.

The current read-only sample on 2026-09-24 shows:

- CIM start UTC: `2026-09-23T17:30:52.4649840Z`.
- `Get-Process` start UTC: `2026-09-23T17:30:52.4649841Z`.
- Difference: exactly one Windows tick, 100 ns.

CLASSIFICATION = API_PRECISION_VARIANCE. CIM supplies a microsecond-resolution
creation value while `Get-Process` exposes the additional 100 ns digit. The ISO
formatter retained the CIM value accurately; no evidence of rounding by JSON
was observed. `ConvertFrom-Json` type conversion is accounted for by the new
normalizer. No broader time window is admitted.

## Canonical comparison

`procdump-process-identity.ps1` is the single UTC-tick comparison rule used by
the Native reader and the ProcDump writer when recognizing a prior map
attachment. It accepts a typed DateTime/DateTimeOffset or an explicit ISO
string with `Z` or an offset, then compares UTC ticks. A missing, malformed or
ambiguous timestamp fails closed. `START_TIME_MATCH` requires an absolute delta
of at most one tick. The writer's previous two-second prior-attachment window
has been removed.

The reader also requires all of the following: exact current map PID and receipt
attached/map PID; live map and sole ProcDump process; `map-server.exe` role;
canonical map executable path in live inventory and receipt; approved ProcDump
executable path and hash; exact ProcDump process PID in the receipt; approved
command line flags/filter; and the PID in the command's target argument. A PID
occurring only in the dump folder no longer satisfies the target check.

`procdump_process_identity` provides `target_pid`,
`receipt_start_time_utc`, `current_start_time_utc`,
`start_time_delta_ticks`, `executable_path`, `runtime_role`,
`procdump_pid`, `procdump_target_pid`, `process_alive`,
`PROCESS_IDENTITY_MATCH` and a precise failure `reason`. The existing
`procdump_receipt` remains null when identity fails. Runtime topology and all
other promotion gates retain their existing checks.

## Verification

Isolated comparator cases: exact, +1 tick, -1 tick, +2 tick, -2 tick, PID
mismatch, map executable mismatch, receipt target mismatch, dead process,
ProcDump wrong target, equivalent UTC spelling, timezone offset, malformed
and missing timestamp, PID reuse, role mismatch, ProcDump PID/path/flags
mismatch. `PROCDUMP_IDENTITY_TEST_COUNT = 19`; all PASS.

The Native adapter fixture passed 5 checks, including JSON reader admission at
one tick and rejection at two ticks. The ProcDump sidecar suite passed 14 checks.
Native promotion passed 24, legacy bootstrap passed 29, production promotion
governance passed 31, and full Web manifest governance passed 35 checks.
Fixture PASS is not Production runtime acceptance.

Source adapter `snapshot` was run read-only against the existing Production
processes after the source fix. Observed map PID 43092, ProcDump PID 47864,
receipt target 43092, port 5122 owner 43092, map executable path matched,
ProcDump executable identity/hash matched, runtime topology passed,
OpenKore count 0, and start delta 1 tick. `PROCESS_IDENTITY_MATCH = YES` and
the unchanged existing receipt was accepted by the source adapter. This was
validation only. No Production application file, process, monitor or player
state was changed by this workline.

The adapter source must be included in F's approved GitHub-first candidate and
predeploy evidence. This governance fix does not authorize lease acquisition,
Web/Native deployment or service restart.
