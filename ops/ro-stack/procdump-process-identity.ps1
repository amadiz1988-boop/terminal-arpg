# ProcDump identity comparison shared by the receipt writer and Native reader.
# One Windows tick is 100 ns. Missing or ambiguous timestamps fail closed.
# Receipts record CIM Win32_Process.CreationDate, which has microsecond
# resolution: its last tick digit is always 0. Get-Process StartTime carries
# the full 100 ns value, so the same process can read 0-9 ticks later. That
# case matches only when the receipt is microsecond aligned and the current
# start lies inside that same microsecond.
$script:procdumpMaxStartTimeDeltaTicks = 1
$script:procdumpCimResolutionTicks = 10
function Get-ProcDumpStartDelta($ReceiptStart, $CurrentStart) {
  $result = [ordered]@{ valid = $false; receipt_start_time_utc = $null;
    current_start_time_utc = $null; start_time_delta_ticks = $null; same_cim_microsecond = $false }
  if ($null -eq $ReceiptStart -or [string]::IsNullOrWhiteSpace([string]$ReceiptStart) -or $null -eq $CurrentStart) {
    return [pscustomobject]$result
  }
  $receiptUtc = $null
  if ($ReceiptStart -is [DateTimeOffset]) { $receiptUtc = $ReceiptStart.ToUniversalTime().UtcDateTime }
  elseif ($ReceiptStart -is [DateTime]) { $receiptUtc = $ReceiptStart.ToUniversalTime() }
  else {
    $source = [string]$ReceiptStart
    if ($source -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$') {
      return [pscustomobject]$result
    }
    $parsed = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($source, [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None, [ref]$parsed)) { return [pscustomobject]$result }
    $receiptUtc = $parsed.UtcDateTime
  }
  try {
    $current = if ($CurrentStart -is [DateTimeOffset]) { $CurrentStart.ToUniversalTime().UtcDateTime }
      elseif ($CurrentStart -is [DateTime]) { $CurrentStart.ToUniversalTime() }
      else {
        $currentText = [string]$CurrentStart
        if ($currentText -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$') { return [pscustomobject]$result }
        $other = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse($currentText, [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::None, [ref]$other)) { return [pscustomobject]$result }
        $other.UtcDateTime
      }
    $result.receipt_start_time_utc = $receiptUtc.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
    $result.current_start_time_utc = $current.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
    $result.start_time_delta_ticks = [Math]::Abs($receiptUtc.Ticks - $current.Ticks)
    $offset = $current.Ticks - $receiptUtc.Ticks
    $result.same_cim_microsecond = ($receiptUtc.Ticks % $script:procdumpCimResolutionTicks) -eq 0 -and
      $offset -ge 0 -and $offset -lt $script:procdumpCimResolutionTicks
    $result.valid = $true
  } catch {}
  return [pscustomobject]$result
}

function Test-ProcDumpStartMatch($Times) {
  return [bool]($Times -and $Times.valid -and
    ($Times.start_time_delta_ticks -le $script:procdumpMaxStartTimeDeltaTicks -or $Times.same_cim_microsecond))
}

function Compare-ProcDumpProcessIdentity($Capture, [int]$TargetPid, $CurrentMap, $CurrentProcess,
    $Sidecars, [string]$ExpectedMapPath, [string]$ExpectedProcDumpPath, [string]$ExpectedFilter) {
  $sidecarsArray = @($Sidecars)
  $sidecar = if ($sidecarsArray.Count -eq 1) { $sidecarsArray[0] } else { $null }
  $currentStart = try { if ($CurrentProcess) { $CurrentProcess.StartTime } } catch { $null }
  $exited = try { if ($CurrentProcess) { [bool]$CurrentProcess.HasExited } else { $true } } catch { $true }
  $times = Get-ProcDumpStartDelta $Capture.mapProcessStartTime $currentStart
  $commandTarget = $null
  if ($sidecar) {
    $line = [string]$sidecar.CommandLine
    $prefix = '^\s*(?:"' + [regex]::Escape($ExpectedProcDumpPath) + '"|' +
      [regex]::Escape($ExpectedProcDumpPath) + ')\s+-ma\s+-n\s+2\s+-e\s+1\s+-f\s+' +
      [regex]::Escape($ExpectedFilter) + '\s+(?<target>\d+)\s+(?:"[^"]+"|\S+)\s*$'
    $match = [regex]::Match($line, $prefix, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $parsedPid = 0
    if ($match.Success -and [int]::TryParse($match.Groups['target'].Value, [ref]$parsedPid)) {
      $commandTarget = $parsedPid
    }
  }
  $alive = $null -ne $CurrentMap -and $null -ne $CurrentProcess -and $null -ne $sidecar -and
    -not $exited
  $evidence = [ordered]@{
    target_pid = $TargetPid
    receipt_start_time_utc = $times.receipt_start_time_utc
    current_start_time_utc = $times.current_start_time_utc
    start_time_delta_ticks = $times.start_time_delta_ticks
    executable_path = if ($CurrentMap) { [string]$CurrentMap.ExecutablePath } else { $null }
    runtime_role = if ($CurrentMap) { [string]$CurrentMap.Name } else { $null }
    procdump_pid = if ($sidecar) { [int]$sidecar.ProcessId } else { $null }
    procdump_target_pid = $commandTarget
    process_alive = $alive
    PROCESS_IDENTITY_MATCH = 'NO'
    reason = $null
  }
  $reason = if (-not $Capture -or $Capture.procdumpAttachStatus -ne 'ATTACHED') { 'RECEIPT_NOT_ATTACHED' }
    elseif ($TargetPid -le 0 -or ($CurrentMap -and [int]$CurrentMap.ProcessId -ne $TargetPid) -or
        ($CurrentProcess -and [int]$CurrentProcess.Id -ne $TargetPid)) { 'PID_MISMATCH' }
    elseif ([int]$Capture.mapPid -ne $TargetPid -or [int]$Capture.procdumpAttachedPid -ne $TargetPid) { 'TARGET_PID_MISMATCH' }
    elseif (-not $alive) { 'PROCESS_NOT_ALIVE' }
    elseif ([string]$CurrentMap.Name -ine 'map-server.exe') { 'RUNTIME_ROLE_MISMATCH' }
    elseif ([string]$CurrentMap.ExecutablePath -ine $ExpectedMapPath -or
        [string]$Capture.mapBinaryPath -ine $ExpectedMapPath) { 'EXECUTABLE_MISMATCH' }
    elseif ([int]$Capture.procdumpProcessId -ne [int]$sidecar.ProcessId) { 'PROCDUMP_PID_MISMATCH' }
    elseif ([string]$sidecar.ExecutablePath -ine $ExpectedProcDumpPath) { 'PROCDUMP_EXECUTABLE_MISMATCH' }
    elseif ($null -eq $commandTarget -or $commandTarget -ne $TargetPid) { 'PROCDUMP_TARGET_MISMATCH' }
    elseif (-not $times.valid) { 'START_TIME_INVALID' }
    elseif (-not (Test-ProcDumpStartMatch $times)) { 'START_TIME_DELTA_EXCEEDED' }
    else { $null }
  $evidence.reason = $reason
  if (-not $reason) { $evidence.PROCESS_IDENTITY_MATCH = 'YES' }
  return [pscustomobject]$evidence
}
