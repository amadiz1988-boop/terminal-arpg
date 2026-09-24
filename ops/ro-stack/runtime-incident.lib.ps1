# Incident evidence for the existing runtime sentinel. This module never starts,
# stops, or restarts a game process. Compatible with Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'

function Get-RuntimeGenerationId($state) {
  if (-not $state -or -not $state.startedAt) { return $null }
  return ('ro-{0}' -f [long]$state.startedAt)
}

function Protect-IncidentText([string]$value) {
  if ($null -eq $value) { return '' }
  $value = [regex]::Replace($value, '(?im)^\s*(Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n]*', '$1: [REDACTED]')
  $value = [regex]::Replace($value, '(?im)"(password|passwd|secret|token|cookie|authorization|client_secret|api[_-]?key)"\s*:\s*"[^"]*"', '"$1":"[REDACTED]"')
  $value = [regex]::Replace($value, '(?im)(--?(?:password|passwd|secret|token|cookie|authorization|client-secret|api-key))\s+[^\s]+', '$1 [REDACTED]')
  $value = [regex]::Replace($value, '(?im)(password|passwd|secret|token|cookie|authorization|client_secret|api[_-]?key)\s*[=:]\s*([^\s,;]+)', '$1=[REDACTED]')
  $value = [regex]::Replace($value, '(?im)Bearer\s+[^\s]+', 'Bearer [REDACTED]')
  return $value
}

function Read-IncidentJson([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  try { return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } catch { return $null }
}

function Write-IncidentJson([string]$path, $value) {
  $parent = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $temporary = "$path.$PID.tmp"
  $json = $value | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $path -Force
}

function Get-IncidentTail([string]$path, [int]$maxLines = 200, [int]$maxBytes = 262144) {
  if (-not $path -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { return '' }
  try {
    $file = Get-Item -LiteralPath $path
    $stream = [IO.File]::Open($file.FullName, 'Open', 'Read', 'ReadWrite')
    try {
      $offset = [Math]::Max(0, $stream.Length - $maxBytes)
      [void]$stream.Seek($offset, [IO.SeekOrigin]::Begin)
      $bytes = New-Object byte[] ([int]($stream.Length - $offset))
      [void]$stream.Read($bytes, 0, $bytes.Length)
      $text = [Text.Encoding]::UTF8.GetString($bytes)
      if ($offset -gt 0) { $text = [regex]::Replace($text, '^.*?\r?\n', '', 'Singleline') }
      $lines = @($text -split '\r?\n')
      return Protect-IncidentText (($lines | Select-Object -Last $maxLines) -join "`n")
    } finally { $stream.Dispose() }
  } catch { return '[TAIL_UNAVAILABLE]' }
}

function Get-RuntimeProcessExitEvents([string]$runtimeRoot, $live) {
  if (-not $script:incidentProcessHandles) { $script:incidentProcessHandles = @{} }
  $state = Read-IncidentJson (Join-Path $runtimeRoot 'state.json')
  foreach ($entry in @($state.processes)) {
    if ($entry.name -notin @('login', 'char', 'map')) { continue }
    $key = '{0}:{1}' -f $entry.name, [int]$entry.id
    if ($script:incidentProcessHandles.ContainsKey($key)) { continue }
    $identity = @($live | Where-Object { [int]$_.pid -eq [int]$entry.id -and [string]$_.name -eq "$($entry.name)-server.exe" -and [string]$_.path -ieq [string]$entry.path } | Select-Object -First 1)
    if (-not $identity) { continue }
    try {
      $handle = [Diagnostics.Process]::GetProcessById([int]$entry.id)
      $handle.EnableRaisingEvents = $true
      $script:incidentProcessHandles[$key] = [pscustomobject]@{ handle = $handle; pid = [int]$entry.id; name = "$($entry.name)-server.exe"; start = [string]$identity[0].start }
    } catch {}
  }
  $events = @()
  foreach ($key in @($script:incidentProcessHandles.Keys)) {
    $watch = $script:incidentProcessHandles[$key]
    $finished = $false
    try {
      if (-not $watch.handle.HasExited) { continue }
      $finished = $true
      $events += [pscustomobject]@{
        pid = $watch.pid; name = $watch.name
        at = $watch.handle.ExitTime.ToUniversalTime().ToString('o')
        exitCode = if ($watch.handle.ExitCode -lt 0) { [long]$watch.handle.ExitCode + 4294967296 } else { [long]$watch.handle.ExitCode }
      }
    } catch {
      $finished = $true
      $events += [pscustomobject]@{ pid = $watch.pid; name = $watch.name; at = $null; exitCode = $null }
    } finally {
      if ($finished) {
        $watch.handle.Dispose()
        $script:incidentProcessHandles.Remove($key)
      }
    }
  }
  return @($events)
}

# Pure transition function. A poll-only tie stays UNDETERMINED; it does not
# invent a first crash. Retained process handles provide exit timestamps/codes.
function Get-RuntimeExitRecords($tracked, $live, $events, [string]$detectedAt, $alreadyExited) {
  $records = @()
  foreach ($entry in @($tracked)) {
    $service = [string]$entry.name
    $pidValue = [int]$entry.id
    if (@($alreadyExited | Where-Object { $_.service -eq $service -and [int]$_.pid -eq $pidValue }).Count) { continue }
    $stillLive = @($live | Where-Object {
      $sameIdentity = [int]$_.pid -eq $pidValue -and [string]$_.name -eq "$service-server.exe" -and [string]$_.path -ieq [string]$entry.path
      if ($sameIdentity -and $entry.processStartTime -and $_.start) {
        try { $sameIdentity = [Math]::Abs((([DateTimeOffset]::Parse([string]$_.start)) - ([DateTimeOffset]::Parse([string]$entry.processStartTime))).TotalSeconds) -lt 2 } catch { $sameIdentity = $false }
      }
      $sameIdentity
    }).Count -gt 0
    $stop = @($events | Where-Object { [int]$_.pid -eq $pidValue -and [string]$_.name -eq "$service-server.exe" } | Sort-Object at | Select-Object -First 1)
    if ($stillLive -and -not $stop) { continue }
    $time = if ($stop -and $stop[0].at) { [string]$stop[0].at } else { $detectedAt }
    $start = if ($entry.processStartTime) { [string]$entry.processStartTime } else { $null }
    $lifetime = $null
    try { if ($start) { $lifetime = [long]([DateTimeOffset]::Parse($time) - [DateTimeOffset]::Parse($start)).TotalMilliseconds } } catch {}
    $records += [pscustomobject]@{
      service = $service; pid = $pidValue; processStartTime = $start; at = $time
      atUnixMs = ([DateTimeOffset]::Parse($time)).ToUnixTimeMilliseconds()
      timeSource = if ($stop -and $stop[0].at) { 'PROCESS_HANDLE_EXIT_TIME' } else { 'POLL_DETECTION' }
      exitCode = if ($stop) { $stop[0].exitCode } else { $null }
      lifetimeMs = $lifetime; classification = 'UNKNOWN'
    }
  }
  return @($records | Sort-Object at, service)
}

function Get-IncidentAction([string]$path, [int]$pidValue, [DateTimeOffset]$when, [int]$seconds = 30) {
  if (-not (Test-Path -LiteralPath $path)) { return 'NONE' }
  $tail = Get-IncidentTail $path 100 65536
  foreach ($line in @($tail -split '\r?\n')) {
    if ($line -notmatch "(?<!\d)$pidValue(?!\d)") { continue }
    $stamp = $null
    if ($line -match '^\s*(\d{4}-\d\d-\d\dT[^\s]+)') { try { $stamp = [DateTimeOffset]::Parse($Matches[1]) } catch {} }
    elseif ($line -match '"timestamp"\s*:\s*"([^"]+)"') { try { $stamp = [DateTimeOffset]::Parse($Matches[1]) } catch {} }
    if ($stamp -and [Math]::Abs(($stamp - $when).TotalSeconds) -le $seconds) {
      if ($line.TrimStart().StartsWith('{')) {
        try {
          $entry = $line | ConvertFrom-Json
          return ('timestamp={0} action={1} pid={2} reason={3}' -f $entry.timestamp, $entry.action, $entry.pid, (Protect-IncidentText ([string]$entry.reason)))
        } catch { return 'AUDIT_MATCH_REDACTED' }
      }
      return Protect-IncidentText $line
    }
  }
  return 'NONE'
}

function Get-SafeSentinelTail([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return '' }
  $lines = @()
  foreach ($line in @((Get-IncidentTail $path 200 262144) -split '\r?\n')) {
    try {
      $item = $line | ConvertFrom-Json
      $lines += ('timestamp={0} action={1} pid={2} reason={3}' -f $item.timestamp, $item.action, $item.pid, (Protect-IncidentText ([string]$item.reason)))
    } catch { $lines += '[UNPARSEABLE_SENTINEL_AUDIT_REDACTED]' }
  }
  return ($lines -join "`n")
}

function Get-IncidentWindowsEvidence([DateTimeOffset]$when, [string[]]$names) {
  $matchedEvents = @()
  $application = $null; $module = $null; $exception = $null
  try {
    $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $when.AddMinutes(-2).LocalDateTime; EndTime = $when.AddMinutes(2).LocalDateTime; Id = @(1000, 1001) } -MaxEvents 50 -ErrorAction SilentlyContinue)
    foreach ($item in $events) {
      if (@($names | Where-Object { $item.Message -match [regex]::Escape($_) }).Count -eq 0) { continue }
      $safeMessage = Protect-IncidentText ([string]$item.Message)
      $matchedEvents += [pscustomobject]@{ at = $item.TimeCreated.ToUniversalTime().ToString('o'); id = $item.Id; provider = $item.ProviderName; message = $safeMessage.Substring(0, [Math]::Min(2048, $safeMessage.Length)) }
      if ($item.Id -eq 1000 -and $item.Properties.Count -ge 7) {
        $application = [string]$item.Properties[0].Value
        $module = [string]$item.Properties[3].Value
        $exception = [string]$item.Properties[6].Value
      }
    }
  } catch {}
  return [pscustomobject]@{ matchCount = $matchedEvents.Count; werMatch = [bool](@($matchedEvents | Where-Object { $_.id -eq 1001 }).Count); faultingApplication = $application; faultingModule = $module; exceptionCode = $exception; events = @($matchedEvents) }
}

function Get-IncidentDumpReferences([string]$captureRoot, [DateTimeOffset]$when) {
  $result = @()
  if (-not (Test-Path -LiteralPath $captureRoot)) { return @() }
  # ProcDump's accepted map-only directory is read without changing attachment.
  $files = @(Get-ChildItem -LiteralPath $captureRoot -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -ieq '.dmp' -and [Math]::Abs(($_.LastWriteTimeUtc - $when.UtcDateTime).TotalMinutes) -le 5 } | Select-Object -First 4)
  foreach ($file in $files) {
    try { $result += [pscustomobject]@{ path = $file.FullName; size = $file.Length; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash } } catch {}
  }
  return @($result)
}

function Get-IncidentPortState([int[]]$ports) {
  $result = [ordered]@{}
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  foreach ($port in $ports) {
    $owners = @($listeners | Where-Object { [int]$_.LocalPort -eq $port } | ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
    $result[[string]$port] = $owners
  }
  return $result
}

function Test-IncidentTcpReachable([int]$port) {
  $client = New-Object Net.Sockets.TcpClient
  try {
    $pending = $client.BeginConnect('127.0.0.1', $port, $null, $null)
    if (-not $pending.AsyncWaitHandle.WaitOne(300)) { return $false }
    $client.EndConnect($pending)
    return $true
  } catch { return $false } finally { $client.Dispose() }
}

function Get-IncidentImpactSnapshot([string]$runtimeRoot) {
  $unavailable = [pscustomobject]@{
    dbReachable = 'UNAVAILABLE'; onlinePlayerCount = 'UNAVAILABLE'; onlineCharacterCount = 'UNAVAILABLE'
    persistentAgentResidentCount = 'UNAVAILABLE'; persistentAgentModeCounts = 'UNAVAILABLE'
    activeFarmCount = 'UNAVAILABLE'; activeJourneyCount = 'UNAVAILABLE'; activeQuestCount = 'UNAVAILABLE'
    affectedCharacterIds = 'UNAVAILABLE'; affectedCharacterIdsTruncated = 'UNAVAILABLE'
    unavailableReason = 'IMPACT_SOURCE_UNAVAILABLE'
  }
  $helper = Join-Path $PSScriptRoot 'runtime-impact-snapshot.mjs'
  if (-not (Test-Path -LiteralPath $helper)) { return $unavailable }
  try {
    $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
    if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { return $unavailable }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $node
    $start.Arguments = ('"{0}" "{1}"' -f $helper, $runtimeRoot)
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($start)
    try {
      if (-not $process.WaitForExit(5000)) { $process.Kill(); return $unavailable }
      if ($process.ExitCode -ne 0) { return $unavailable }
      $output = $process.StandardOutput.ReadToEnd()
      $result = $output | ConvertFrom-Json
      if (-not $result -or $null -eq $result.onlinePlayerCount) { return $unavailable }
      return $result
    } finally { $process.Dispose() }
  } catch { return $unavailable }
}

function Protect-IncidentDirectory([string]$path) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
  $acl = Get-Acl -LiteralPath $path
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
    $identity = New-Object Security.Principal.SecurityIdentifier($sid)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.SetAccessRule($rule)
  }
  Set-Acl -LiteralPath $path -AclObject $acl
}

function Invoke-IncidentRetention([string]$incidentRoot, [int]$maxDays = 30, [int]$maxCount = 100, [long]$maxBytes = 536870912) {
  if (-not (Test-Path -LiteralPath $incidentRoot)) { return }
  $dirs = @(Get-ChildItem -LiteralPath $incidentRoot -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'incident.json') } | Sort-Object LastWriteTimeUtc -Descending)
  $total = [long]0; $count = 0
  foreach ($dir in $dirs) {
    $bytes = [long](@(Get-ChildItem -LiteralPath $dir.FullName -File -Recurse | Measure-Object -Property Length -Sum)[0].Sum)
    $count++
    if ($dir.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-$maxDays) -or $count -gt $maxCount -or ($total + $bytes) -gt $maxBytes) {
      Remove-Item -LiteralPath $dir.FullName -Recurse -Force
    } else { $total += $bytes }
  }
}

function Invoke-IncidentDumpRetention([string]$captureRoot, [int]$maxDays = 30, [long]$maxBytes = 2147483648) {
  if (-not (Test-Path -LiteralPath $captureRoot)) { return }
  $files = @(Get-ChildItem -LiteralPath $captureRoot -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object Extension -eq '.dmp' | Sort-Object LastWriteTimeUtc -Descending)
  $total = [long]0
  $ledger = Join-Path $captureRoot 'dump-retention-ledger.jsonl'
  foreach ($file in $files) {
    $isOld = $file.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-$maxDays)
    $overBudget = ($total + $file.Length) -gt $maxBytes -and $file.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-1)
    if (-not $isOld -and -not $overBudget) { $total += $file.Length; continue }
    # Never delete an active or newly written dump. Preserve metadata and hash
    # before removal, and keep the ledger outside any incident rotation.
    try {
      $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
      $entry = [pscustomobject]@{ deletedAt = [DateTimeOffset]::UtcNow.ToString('o'); path = $file.FullName; size = $file.Length; sha256 = $hash; reason = if ($isOld) { 'AGE' } else { 'BUDGET' } }
      ($entry | ConvertTo-Json -Compress) | Add-Content -LiteralPath $ledger -Encoding UTF8
      Remove-Item -LiteralPath $file.FullName -Force
    } catch { $total += $file.Length }
  }
}

function Find-IncidentFolder([string]$runtimeRoot, [string]$incidentId) {
  if (-not $incidentId) { return $null }
  $root = Join-Path $runtimeRoot 'runtime-incidents'
  $folder = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*-$incidentId" } | Select-Object -First 1)
  if ($folder) { return $folder[0].FullName }
  return $null
}

function Update-IncidentLateEvidence([string]$runtimeRoot, [string]$incidentId) {
  $folder = Find-IncidentFolder $runtimeRoot $incidentId
  if (-not $folder) { return }
  $path = Join-Path $folder 'incident.json'
  $incident = Read-IncidentJson $path
  if (-not $incident) { return }
  $timeValue = if ($incident.firstExitAt) { [string]$incident.firstExitAt } else { [string]$incident.detectedAt }
  if (-not $timeValue) { return }
  $at = [DateTimeOffset]::Parse($timeValue)
  if ([DateTimeOffset]::UtcNow -gt $at.AddMinutes(3)) { return }
  if ($incident.windowsEvidence.matchCount -eq 0) {
    $windows = Get-IncidentWindowsEvidence $at @('login-server.exe', 'char-server.exe', 'map-server.exe')
    if ($windows.matchCount -gt 0) {
      $incident.windowsEvidence = $windows
      Write-IncidentJson (Join-Path $folder 'windows-events.json') $windows
      foreach ($exit in @($incident.exitOrder)) {
        if ($exit.classification -eq 'UNKNOWN' -and @($windows.events | Where-Object { $_.id -eq 1000 -and $_.message -match "$($exit.service)-server.exe" }).Count) {
          $exit.classification = 'PROCESS_CRASH'
          if ($incident.firstExitService -eq $exit.service -and [int]$incident.firstExitPid -eq [int]$exit.pid) { $incident.exitClassification = 'PROCESS_CRASH' }
        }
      }
      Write-IncidentJson (Join-Path $folder 'timeline.json') @($incident.exitOrder)
    }
  }
  if ($incident.crashDump.created -eq 'NO') {
    $dumps = @(Get-IncidentDumpReferences (Join-Path $runtimeRoot 'crash-capture') $at)
    if ($dumps.Count) {
      $incident.crashDump = [pscustomobject]@{ created = 'YES'; references = $dumps }
      Write-IncidentJson (Join-Path $folder 'dump-reference.json') $dumps
    }
  }
  Write-IncidentJson $path $incident
}

function Set-IncidentRecovery([string]$runtimeRoot, [string]$incidentId, $state, $live) {
  if (-not $incidentId -or -not $state) { return $false }
  $ports = Get-IncidentPortState @(6901, 6122, 5122)
  foreach ($pair in @(@('login', '6901'), @('char', '6122'), @('map', '5122'))) {
    $entry = @($state.processes | Where-Object name -eq $pair[0] | Select-Object -First 1)
    if (-not $entry) { return $false }
    if (@($live | Where-Object { [int]$_.pid -eq [int]$entry[0].id -and [string]$_.path -ieq [string]$entry[0].path }).Count -ne 1) { return $false }
    if (@($ports[$pair[1]]).Count -ne 1 -or [int]$ports[$pair[1]][0] -ne [int]$entry[0].id) { return $false }
  }
  $folder = Find-IncidentFolder $runtimeRoot $incidentId
  if (-not $folder) { return $false }
  $path = Join-Path $folder 'incident.json'
  $incident = Read-IncidentJson $path
  if (-not $incident) { return $false }
  $incident.recoveryPerformed = $true
  $incident.recoveryResult = 'RUNTIME_PORTS_HEALTHY'
  $incident | Add-Member -NotePropertyName postRecoveryHealthAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString('o')) -Force
  Write-IncidentJson $path $incident
  return $true
}

function Invoke-RuntimeIncidentTick([string]$runtimeRoot, $live, $events, $stateOverride = $null) {
  $statePath = Join-Path $runtimeRoot 'state.json'
  $observerPath = Join-Path $runtimeRoot 'incident-observer-state.json'
  $state = if ($stateOverride) { $stateOverride } else { Read-IncidentJson $statePath }
  if (-not $state -and (Test-Path -LiteralPath $statePath)) { return }
  $previous = Read-IncidentJson $observerPath
  $generation = Get-RuntimeGenerationId $state
  $pendingRecoveryId = if ($previous.pendingRecoveryIncidentId) { [string]$previous.pendingRecoveryIncidentId } else { $null }
  if (-not $generation) {
    # Retain the old generation until the next state appears. Exit handles may
    # report after state.json disappears during a controlled restart.
    return
  }
  if (-not $stateOverride -and $previous -and $previous.generationId -and $previous.generationId -ne $generation) {
    $oldStartedAt = [long](([string]$previous.generationId) -replace '^ro-', '')
    $oldState = [pscustomobject]@{ startedAt = $oldStartedAt; processes = @($previous.tracked) }
    Invoke-RuntimeIncidentTick $runtimeRoot $live $events $oldState
    $previous = Read-IncidentJson $observerPath
    $pendingRecoveryId = if ($previous.pendingRecoveryIncidentId) { [string]$previous.pendingRecoveryIncidentId } else { $null }
  }
  $tracked = @($state.processes | Where-Object { $_.name -in @('login', 'char', 'map') })
  if (-not $previous -or $previous.generationId -ne $generation) {
    if ($previous -and $previous.incidentId) { $pendingRecoveryId = [string]$previous.incidentId }
    $previous = [pscustomobject]@{ generationId = $generation; tracked = @(); exits = @(); incidentId = $null }
  }
  if ($pendingRecoveryId -and (Set-IncidentRecovery $runtimeRoot $pendingRecoveryId $state $live)) { $pendingRecoveryId = $null }
  if ($previous.incidentId -and (Set-IncidentRecovery $runtimeRoot ([string]$previous.incidentId) $state $live)) { $pendingRecoveryId = $null }
  $known = @($previous.tracked)
  foreach ($entry in $tracked) {
    if (@($known | Where-Object { $_.name -eq $entry.name -and [int]$_.id -eq [int]$entry.id }).Count) { continue }
    $running = @($live | Where-Object { [int]$_.pid -eq [int]$entry.id -and [string]$_.path -ieq [string]$entry.path } | Select-Object -First 1)
    $known += [pscustomobject]@{ name = [string]$entry.name; id = [int]$entry.id; path = [string]$entry.path; stdout = [string]$entry.stdout; stderr = [string]$entry.stderr; processStartTime = if ($running) { [string]$running[0].start } else { $null }; configId = 'stack.config.psd1' }
  }
  $now = [DateTimeOffset]::UtcNow
  $fresh = @(Get-RuntimeExitRecords $known $live $events $now.ToString('o') @($previous.exits))
  if ($fresh.Count -eq 0) {
    Write-IncidentJson $observerPath ([pscustomobject]@{ generationId = $generation; tracked = $known; exits = @($previous.exits); incidentId = $previous.incidentId; pendingRecoveryIncidentId = $pendingRecoveryId })
    if ($previous.incidentId) { Update-IncidentLateEvidence $runtimeRoot ([string]$previous.incidentId) }
    return
  }
  $lock = Read-IncidentJson (Join-Path $runtimeRoot 'lifecycle.lock')
  $activeLifecycle = $false
  if ($lock -and $lock.pid -and $lock.mode -in @('STOPPING', 'RESTARTING')) {
    $activeLifecycle = [bool](Get-Process -Id ([int]$lock.pid) -ErrorAction SilentlyContinue)
  }
  $launcherPath = Join-Path $runtimeRoot 'logs\map-launch-telemetry.log'
  $sentinelPath = Join-Path $runtimeRoot 'sentinel-audit.log'
  foreach ($record in $fresh) {
    $at = [DateTimeOffset]::Parse($record.at)
    $record | Add-Member -NotePropertyName sentinelAction -NotePropertyValue (Get-IncidentAction $sentinelPath $record.pid $at) -Force
    $record | Add-Member -NotePropertyName launcherAction -NotePropertyValue (Get-IncidentAction $launcherPath $record.pid $at) -Force
    if ($null -eq $record.exitCode -and $record.launcherAction -match '\bexit_code=(\d+)\b') { $record.exitCode = [long]$Matches[1] }
    if ($record.sentinelAction -match '\baction=TERMINATE\b') { $record.classification = 'SENTINEL_TERMINATION' }
    elseif ($record.launcherAction -match '\bSTOP\b') { $record.classification = 'GRACEFUL_STOP' }
    elseif ($activeLifecycle) { $record.classification = 'GRACEFUL_STOP' }
  }
  $all = @($previous.exits) + $fresh
  $unexpected = @($all | Where-Object { $_.classification -ne 'GRACEFUL_STOP' })
  $incidentId = $previous.incidentId
  if (-not $incidentId -and $unexpected.Count) { $incidentId = [guid]::NewGuid().ToString('N') }
  Write-IncidentJson $observerPath ([pscustomobject]@{ generationId = $generation; tracked = $known; exits = $all; incidentId = $incidentId; pendingRecoveryIncidentId = $pendingRecoveryId })
  if (-not $incidentId) { return }
  $root = Join-Path $runtimeRoot 'runtime-incidents'
  $existing = Find-IncidentFolder $runtimeRoot $incidentId
  $priorIncident = if ($existing) { Read-IncidentJson (Join-Path $existing 'incident.json') } else { $null }
  $folder = if ($existing) { $existing } else { Join-Path $root (('{0}-{1}' -f $now.ToString('yyyyMMddTHHmmssZ'), $incidentId)) }
  Protect-IncidentDirectory $root
  Protect-IncidentDirectory $folder
  $ordered = @($all | Sort-Object atUnixMs, service)
  $unexpectedOrdered = @($ordered | Where-Object classification -ne 'GRACEFUL_STOP')
  $firstUnexpected = $unexpectedOrdered[0]
  $firstTime = if ($null -ne $firstUnexpected.atUnixMs) { [DateTimeOffset]::FromUnixTimeMilliseconds([long]$firstUnexpected.atUnixMs).ToString('o') } else { [string]$firstUnexpected.at }
  $tied = @($unexpectedOrdered | Where-Object { $_.atUnixMs -eq $firstUnexpected.atUnixMs -and $_.timeSource -eq 'POLL_DETECTION' })
  $newUnexpected = @($fresh | Where-Object classification -ne 'GRACEFUL_STOP')
  $priorUnexpected = @($previous.exits | Where-Object classification -ne 'GRACEFUL_STOP')
  $ambiguousBatch = $priorUnexpected.Count -eq 0 -and $newUnexpected.Count -gt 1 -and @($newUnexpected | Where-Object timeSource -eq 'POLL_DETECTION').Count -gt 0
  $firstService = if ($tied.Count -gt 1 -or $ambiguousBatch) { 'UNDETERMINED' } else { [string]$firstUnexpected.service }
  for ($index = 0; $index -lt $ordered.Count; $index++) {
    $delta = $null
    try {
      if ($null -ne $ordered[$index].atUnixMs -and $null -ne $firstUnexpected.atUnixMs) { $delta = [long]$ordered[$index].atUnixMs - [long]$firstUnexpected.atUnixMs }
      else { $delta = [long]([DateTimeOffset]::Parse([string]$ordered[$index].at) - [DateTimeOffset]::Parse($firstTime)).TotalMilliseconds }
    } catch {}
    $ordered[$index] | Add-Member -NotePropertyName exitOrder -NotePropertyValue ($index + 1) -Force
    $ordered[$index] | Add-Member -NotePropertyName exitTimeDeltaMs -NotePropertyValue $delta -Force
  }
  $windows = Get-IncidentWindowsEvidence ([DateTimeOffset]::Parse($firstTime)) @('login-server.exe', 'char-server.exe', 'map-server.exe')
  foreach ($record in $ordered) { if ($record.classification -eq 'UNKNOWN' -and @($windows.events | Where-Object { $_.id -eq 1000 -and $_.message -match "$($record.service)-server.exe" }).Count) { $record.classification = 'PROCESS_CRASH' } }
  $captureRoot = Join-Path $runtimeRoot 'crash-capture'
  Protect-IncidentDirectory $captureRoot
  $dumps = @(Get-IncidentDumpReferences $captureRoot ([DateTimeOffset]::Parse($firstTime)))
  $ports = Get-IncidentPortState @(6901, 6122, 5122, 8788)
  $dashboard = @((Get-NetTCPConnection -State Listen -LocalPort 8788 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess))
  $dashboardIdentity = $null
  if ($dashboard) {
    try {
      $dashboardProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$dashboard[0])" -ErrorAction Stop
      if ($dashboardProcess) {
        $dashboardIdentity = [pscustomobject]@{ service = 'dashboard'; pid = [int]$dashboard[0]; processStartTime = ([DateTimeOffset]$dashboardProcess.CreationDate).ToUniversalTime().ToString('o'); binaryPath = [string]$dashboardProcess.ExecutablePath; configId = 'dashboard.mjs' }
      }
    } catch {}
  }
  $impact = if ($priorIncident) {
    [pscustomobject]@{
      capturedAt = $priorIncident.impactCapturedAt; dbReachable = $priorIncident.dbReachable
      onlinePlayerCount = $priorIncident.onlinePlayerCount; onlineCharacterCount = $priorIncident.onlineCharacterCount
      persistentAgentResidentCount = $priorIncident.persistentAgentResidentCount; persistentAgentModeCounts = $priorIncident.persistentAgentModeCounts
      activeFarmCount = $priorIncident.activeFarmCount; activeJourneyCount = $priorIncident.activeJourneyCount; activeQuestCount = $priorIncident.activeQuestCount
      affectedCharacterIds = $priorIncident.affectedCharacterIds; affectedCharacterIdsTruncated = $priorIncident.affectedCharacterIdsTruncated
      unavailableReason = $priorIncident.impactUnavailableReason
    }
  } else { Get-IncidentImpactSnapshot $runtimeRoot }
  $snapshot = [pscustomobject]@{
    capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    portStates = $ports; loginPid = (@($tracked | Where-Object name -eq 'login' | Select-Object -First 1).id); charPid = (@($tracked | Where-Object name -eq 'char' | Select-Object -First 1).id)
    mapPid = (@($tracked | Where-Object name -eq 'map' | Select-Object -First 1).id); dashboardPid = if ($dashboard) { [int]$dashboard[0] } else { $null }
    dashboardIdentity = $dashboardIdentity
    dbReachable = $impact.dbReachable; dbReachabilitySource = 'READ_ONLY_MARIADB_QUERY'
    paResidentCount = $impact.persistentAgentResidentCount; paRuntimeModeCounts = $impact.persistentAgentModeCounts
    playerSessionCount = $impact.onlinePlayerCount; onlineCharacterCount = $impact.onlineCharacterCount
    activeFarmCount = $impact.activeFarmCount; activeJourneyCount = $impact.activeJourneyCount; activeQuestCount = $impact.activeQuestCount
    affectedCharacterIds = $impact.affectedCharacterIds; unavailableReason = $impact.unavailableReason
  }
  Write-IncidentJson (Join-Path $folder 'runtime-state.json') $snapshot
  Write-IncidentJson (Join-Path $folder 'timeline.json') $ordered
  Write-IncidentJson (Join-Path $folder 'windows-events.json') $windows
  Write-IncidentJson (Join-Path $folder 'dump-reference.json') $dumps
  foreach ($entry in $known) {
    foreach ($stream in @('stdout', 'stderr')) {
      $tail = Get-IncidentTail ([string]$entry.$stream)
      [IO.File]::WriteAllText((Join-Path $folder "$($entry.name)-$stream-tail.log"), $tail, [Text.UTF8Encoding]::new($false))
    }
  }
  foreach ($pair in @(@('sentinel', $sentinelPath), @('launcher', $launcherPath))) {
    $tail = if ($pair[0] -eq 'sentinel') { Get-SafeSentinelTail $pair[1] } else { Get-IncidentTail $pair[1] }
    [IO.File]::WriteAllText((Join-Path $folder "$($pair[0])-tail.log"), $tail, [Text.UTF8Encoding]::new($false))
  }
  $incident = [pscustomobject]@{
    incidentId = $incidentId; runtimeGenerationId = $generation; detectedAt = if ($priorIncident) { $priorIncident.detectedAt } else { $now.ToString('o') }
    firstExitService = $firstService; firstExitPid = if ($firstService -eq 'UNDETERMINED') { $null } else { $firstUnexpected.pid }
    firstExitAt = if ($firstService -eq 'UNDETERMINED') { $null } else { $firstTime }
    firstExitCode = if ($firstService -eq 'UNDETERMINED') { 'UNAVAILABLE' } elseif ($null -ne $firstUnexpected.exitCode) { $firstUnexpected.exitCode } else { 'UNAVAILABLE' }
    exitClassification = if ($firstService -eq 'UNDETERMINED') { 'UNKNOWN' } else { $firstUnexpected.classification }
    exitOrder = $ordered; serviceStates = $snapshot; serviceIdentities = $known; portStates = $ports
    sentinelAction = $firstUnexpected.sentinelAction; guardAction = 'NONE'; launcherAction = $firstUnexpected.launcherAction
    crashDump = [pscustomobject]@{ created = if ($dumps.Count) { 'YES' } else { 'NO' }; references = $dumps }
    windowsEvidence = $windows; dbReachable = $impact.dbReachable; impactCapturedAt = $impact.capturedAt
    onlinePlayerCount = $impact.onlinePlayerCount; onlineCharacterCount = $impact.onlineCharacterCount
    persistentAgentResidentCount = $impact.persistentAgentResidentCount; persistentAgentModeCounts = $impact.persistentAgentModeCounts
    activeFarmCount = $impact.activeFarmCount; activeJourneyCount = $impact.activeJourneyCount; activeQuestCount = $impact.activeQuestCount
    affectedCharacterIds = $impact.affectedCharacterIds; affectedCharacterIdsTruncated = $impact.affectedCharacterIdsTruncated
    impactUnavailableReason = $impact.unavailableReason
    onlinePlayerCountBeforeFailure = 'UNAVAILABLE'; onlinePlayerCountAfterFailure = $impact.onlinePlayerCount
    recoveryPerformed = $false; recoveryResult = 'NONE'; rootCauseStatus = 'UNKNOWN'
  }
  Write-IncidentJson (Join-Path $folder 'incident.json') $incident
  Invoke-IncidentRetention $root
  Invoke-IncidentDumpRetention $captureRoot
}
