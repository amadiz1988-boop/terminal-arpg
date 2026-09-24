$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\procdump-process-identity.ps1')
$mapPath = 'C:\fixture\rathena\map-server.exe'
$dumpPath = 'C:\fixture\crash-capture\canonical-map-13'
$procPath = 'C:\fixture\procdump64.exe'
$filter = '*C0000005*,*C000008D*'
$start = [DateTimeOffset]::Parse('2026-09-23T17:30:52.4649840Z').UtcDateTime
$receipt = [pscustomobject]@{ mapPid=13; procdumpAttachedPid=13; procdumpProcessId=20;
  procdumpAttachStatus='ATTACHED'; mapProcessStartTime=$start.ToString('o'); mapBinaryPath=$mapPath }
$map = [pscustomobject]@{ Name='map-server.exe'; ProcessId=13; ExecutablePath=$mapPath }
$current = [pscustomobject]@{ Id=13; StartTime=$start; HasExited=$false }
$sidecar = [pscustomobject]@{ Name='procdump64.exe'; ProcessId=20; ExecutablePath=$procPath;
  CommandLine=('"{0}" -ma -n 2 -e 1 -f {1} 13 {2}' -f $procPath,$filter,$dumpPath) }
$count=0
function Check([string]$name, $r, [string]$match, [string]$reason, $delta) {
  if ($r.PROCESS_IDENTITY_MATCH -cne $match -or [string]$r.reason -cne $reason -or
      ($null -ne $delta -and $r.start_time_delta_ticks -ne $delta)) {
    throw ('IDENTITY_CASE_FAILED:{0}:{1}' -f $name,($r | ConvertTo-Json -Compress))
  }
  $script:count++
  Write-Output ('PASS {0} {1}' -f $script:count,$name)
}
function Invoke-IdentityFixture($r=$receipt,$target=13,$m=$map,$p=$current,$s=$sidecar) {
  Compare-ProcDumpProcessIdentity $r $target $m $p @($s) $mapPath $procPath $filter
}
Check 'exact start' (Invoke-IdentityFixture) YES $null 0
Check 'current +1 tick' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(1);HasExited=$false})) YES $null 1
Check 'current -1 tick' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(-1);HasExited=$false})) YES $null 1
Check 'current +2 ticks inside CIM microsecond' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(2);HasExited=$false})) YES $null 2
Check 'current +3 ticks inside CIM microsecond (map 47184 sample)' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(3);HasExited=$false})) YES $null 3
Check 'current +9 ticks inside CIM microsecond' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(9);HasExited=$false})) YES $null 9
Check 'current +10 ticks next microsecond' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(10);HasExited=$false})) NO START_TIME_DELTA_EXCEEDED 10
Check 'unaligned receipt +2 ticks' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=13;procdumpProcessId=20;procdumpAttachStatus='ATTACHED';mapProcessStartTime=$start.AddTicks(3).ToString('o');mapBinaryPath=$mapPath}) -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(5);HasExited=$false})) NO START_TIME_DELTA_EXCEEDED 2
Check 'current -2 ticks' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddTicks(-2);HasExited=$false})) NO START_TIME_DELTA_EXCEEDED 2
Check 'same start different PID' (Invoke-IdentityFixture -m ([pscustomobject]@{Name='map-server.exe';ProcessId=14;ExecutablePath=$mapPath})) NO PID_MISMATCH 0
Check 'executable mismatch' (Invoke-IdentityFixture -m ([pscustomobject]@{Name='map-server.exe';ProcessId=13;ExecutablePath='C:\other\map-server.exe'})) NO EXECUTABLE_MISMATCH 0
Check 'receipt target mismatch' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=14;procdumpProcessId=20;procdumpAttachStatus='ATTACHED';mapProcessStartTime=$receipt.mapProcessStartTime;mapBinaryPath=$mapPath})) NO TARGET_PID_MISMATCH 0
Check 'dead map process' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start;HasExited=$true})) NO PROCESS_NOT_ALIVE 0
Check 'ProcDump command targets another PID' (Invoke-IdentityFixture -s ([pscustomobject]@{Name='procdump64.exe';ProcessId=20;ExecutablePath=$procPath;CommandLine=('"{0}" -ma -n 2 -e 1 -f {1} 999 {2}' -f $procPath,$filter,$dumpPath)})) NO PROCDUMP_TARGET_MISMATCH 0
Check 'equivalent UTC formatting' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=13;procdumpProcessId=20;procdumpAttachStatus='ATTACHED';mapProcessStartTime='2026-09-23T17:30:52.464984+00:00';mapBinaryPath=$mapPath})) YES $null 0
Check 'offset represents same instant' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=13;procdumpProcessId=20;procdumpAttachStatus='ATTACHED';mapProcessStartTime='2026-09-24T01:30:52.4649840+08:00';mapBinaryPath=$mapPath})) YES $null 0
Check 'malformed timestamp' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=13;procdumpProcessId=20;procdumpAttachStatus='ATTACHED';mapProcessStartTime='yesterday';mapBinaryPath=$mapPath})) NO START_TIME_INVALID $null
Check 'missing timestamp' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=13;procdumpProcessId=20;procdumpAttachStatus='ATTACHED';mapProcessStartTime=$null;mapBinaryPath=$mapPath})) NO START_TIME_INVALID $null
Check 'PID reuse with later start' (Invoke-IdentityFixture -p ([pscustomobject]@{Id=13;StartTime=$start.AddSeconds(1);HasExited=$false})) NO START_TIME_DELTA_EXCEEDED 10000000
Check 'wrong runtime role' (Invoke-IdentityFixture -m ([pscustomobject]@{Name='char-server.exe';ProcessId=13;ExecutablePath=$mapPath})) NO RUNTIME_ROLE_MISMATCH 0
Check 'ProcDump PID mismatch' (Invoke-IdentityFixture -r ([pscustomobject]@{mapPid=13;procdumpAttachedPid=13;procdumpProcessId=21;procdumpAttachStatus='ATTACHED';mapProcessStartTime=$receipt.mapProcessStartTime;mapBinaryPath=$mapPath})) NO PROCDUMP_PID_MISMATCH 0
Check 'ProcDump executable mismatch' (Invoke-IdentityFixture -s ([pscustomobject]@{Name='procdump64.exe';ProcessId=20;ExecutablePath='C:\other\procdump64.exe';CommandLine=$sidecar.CommandLine})) NO PROCDUMP_EXECUTABLE_MISMATCH 0
Check 'ProcDump flags mismatch' (Invoke-IdentityFixture -s ([pscustomobject]@{Name='procdump64.exe';ProcessId=20;ExecutablePath=$procPath;CommandLine=('"{0}" -ma -n 3 -e 1 -f {1} 13 {2}' -f $procPath,$filter,$dumpPath)})) NO PROCDUMP_TARGET_MISMATCH 0
Write-Output ('PROCDUMP_IDENTITY_TEST_COUNT={0}' -f $count)
