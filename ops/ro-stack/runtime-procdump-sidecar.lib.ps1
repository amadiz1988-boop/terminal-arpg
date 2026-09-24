# ProcDump attachment only. The sentinel remains the sole runtime observer.
$script:approvedProcDumpPath = 'C:\Users\Administrator\AppData\Local\Microsoft\Sysinternals\ProcDump-12.01\procdump64.exe'
$script:approvedProcDumpHash = 'D1FC99AE304BD1D2BF28ABEB62531DA959E2431916194981B88C958FD713A8E6'
$script:approvedProcDumpFilter = '*C0000005*,*C000008D*,*C000008E*,*C000008F*,*C0000090*,*C0000091*,*C0000092*,*C0000093*,*C0000094*,*C0000095*'

function Test-ApprovedMapProcDump($sidecar, [int]$mapPid, [string]$captureRoot) {
  $line = [string]$sidecar.CommandLine
  if ([string]$sidecar.ExecutablePath -ine $script:approvedProcDumpPath) { return $false }
  if ($line -notmatch [regex]::Escape('-ma -n 2 -e 1 -f ' + $script:approvedProcDumpFilter)) { return $false }
  if ($line -notmatch ('(?<!\d){0}(?!\d)' -f $mapPid)) { return $false }
  return $line.IndexOf($captureRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-ProcDumpHistoricalState($prior) {
  if (-not $prior) { return $null }
  return [pscustomobject]@{
    runtimeGenerationId = $prior.runtimeGenerationId; mapPid = $prior.mapPid
    mapProcessStartTime = $prior.mapProcessStartTime; mapBinaryPath = $prior.mapBinaryPath
    procdumpAttachedPid = $prior.procdumpAttachedPid; procdumpAttachedAt = $prior.procdumpAttachedAt
    procdumpAttachStatus = $prior.procdumpAttachStatus
  }
}

function Test-MapProcDumpOutput([string]$output, [int]$mapPid, [string]$mapPath, [string]$dumpFolder) {
  if ($output -notmatch ('(?m)^Process:\s+map-server\.exe\s+\({0}\)' -f $mapPid)) { return $false }
  if ($output -notmatch [regex]::Escape($mapPath)) { return $false }
  if ($output -notmatch 'Exception monitor:\s+First Chance\+Unhandled') { return $false }
  if ($output -notmatch 'Number of dumps:\s+2') { return $false }
  if ($output.IndexOf($dumpFolder, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $false }
  foreach ($filter in $script:approvedProcDumpFilter.Split(',')) {
    if ($output.IndexOf($filter, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $false }
  }
  return $true
}

function Get-MapProcDumpFolder($sidecar, [string]$captureRoot) {
  $line = [string]$sidecar.CommandLine
  $offset = $line.IndexOf($captureRoot, [StringComparison]::OrdinalIgnoreCase)
  if ($offset -lt 0) { return $null }
  $folder = $line.Substring($offset).Trim().Trim('"')
  $root = [IO.Path]::GetFullPath($captureRoot).TrimEnd('\') + '\'
  try { $resolved = [IO.Path]::GetFullPath($folder) } catch { return $null }
  if (-not $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { return $null }
  return $resolved
}

function Get-MapProcDumpDecision($state, $servers, $guard, $sidecars, [string]$canonicalRoot, [string]$runtimeRoot) {
  $map = @($state.processes | Where-Object name -eq 'map')
  $liveMaps = @($servers | Where-Object name -eq 'map-server.exe')
  if ($map.Count -ne 1 -or $liveMaps.Count -ne 1) { return [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'MAP_COUNT'; map = $null; sidecar = $null } }
  $candidate = $liveMaps[0]
  $expected = Join-Path $canonicalRoot 'map-server.exe'
  if ([int]$candidate.pid -ne [int]$map[0].id -or [string]$candidate.path -ine [string]$map[0].path -or [string]$candidate.path -ine $expected -or -not $candidate.start -or @($candidate.ports) -notcontains 5122) {
    return [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'MAP_IDENTITY'; map = $null; sidecar = $null }
  }
  if (@($guard.unauthorized).Count -ne 0 -or @($guard.survivors) -notcontains [int]$candidate.pid) {
    return [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'RUNTIME_GUARD'; map = $null; sidecar = $null }
  }
  $captureRoot = Join-Path $runtimeRoot 'crash-capture'
  if (@($sidecars | Where-Object { -not $_.CommandLine -or -not $_.ExecutablePath }).Count) {
    return [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'SIDECAR_INVENTORY_INCOMPLETE'; map = $candidate; sidecar = $null }
  }
  $targetSidecars = @($sidecars | Where-Object { [string]$_.CommandLine -match ('(?<!\d){0}(?!\d)' -f [int]$candidate.pid) })
  if ($targetSidecars.Count -gt 1) { return [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'DUPLICATE_SIDECARS'; map = $candidate; sidecar = $null } }
  if ($targetSidecars.Count -eq 1) {
    if (-not (Test-ApprovedMapProcDump $targetSidecars[0] ([int]$candidate.pid) $captureRoot)) {
      return [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'UNAPPROVED_SIDECAR'; map = $candidate; sidecar = $null }
    }
    return [pscustomobject]@{ status = 'ALREADY_ATTACHED'; reason = 'APPROVED_SIDECAR'; map = $candidate; sidecar = $targetSidecars[0] }
  }
  return [pscustomobject]@{ status = 'ATTACH'; reason = 'CANONICAL_MAP'; map = $candidate; sidecar = $null }
}

function Invoke-MapProcDumpTick([string]$runtimeRoot, [string]$canonicalRoot, $servers, $guard, [bool]$enabled) {
  $statePath = Join-Path $runtimeRoot 'procdump-attachment-state.json'
  $runtimeState = Read-IncidentJson (Join-Path $runtimeRoot 'state.json')
  if (-not $runtimeState) { return }
  $prior = Read-IncidentJson $statePath
  $sidecars = @(Get-CimInstance Win32_Process -Filter "Name='procdump64.exe'" -ErrorAction Stop)
  $decision = Get-MapProcDumpDecision $runtimeState $servers $guard $sidecars $canonicalRoot $runtimeRoot
  if ($decision.map) {
    $portOwners = @(Get-NetTCPConnection -State Listen -LocalPort 5122 -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
    if ($portOwners.Count -ne 1 -or $portOwners[0] -ne [int]$decision.map.pid) {
      $decision = [pscustomobject]@{ status = 'MAP_PROCDUMP_REATTACH_BLOCKED'; reason = 'PORT_5122_OWNER'; map = $decision.map; sidecar = $null }
    }
  }
  $map = $decision.map
  $generation = Get-RuntimeGenerationId $runtimeState
  if ($decision.status -eq 'MAP_PROCDUMP_REATTACH_BLOCKED') {
    if ($prior -and $prior.procdumpAttachStatus -eq 'BLOCKED' -and $prior.procdumpAttachError -eq $decision.reason -and $prior.runtimeGenerationId -eq $generation) { return $prior }
    $record = [pscustomobject]@{ runtimeGenerationId = $generation; mapPid = if ($map) { [int]$map.pid } else { $null }; mapProcessStartTime = if ($map) { [string]$map.start } else { $null }; mapBinaryPath = if ($map) { [string]$map.path } else { $null }; procdumpAttachedPid = $null; procdumpAttachedAt = $null; procdumpProcessId = $null; procdumpAttachStatus = 'BLOCKED'; procdumpAttachError = $decision.reason; mapRuntimeUnaffected = 'YES'; previous = (Get-ProcDumpHistoricalState $prior) }
    Write-IncidentJson $statePath $record
    return $record
  }
  $sameStart = $false
  try { $sameStart = [Math]::Abs(([DateTimeOffset]::Parse([string]$prior.mapProcessStartTime) - [DateTimeOffset]::Parse([string]$map.start)).TotalSeconds) -lt 2 } catch {}
  $sameMap = $prior -and [int]$prior.mapPid -eq [int]$map.pid -and $sameStart -and [string]$prior.runtimeGenerationId -eq $generation
  if ($decision.status -eq 'ALREADY_ATTACHED') {
    if ($sameMap -and [int]$prior.procdumpProcessId -eq [int]$decision.sidecar.ProcessId -and $prior.procdumpAttachStatus -eq 'ATTACHED') { return $prior }
    $folder = Get-MapProcDumpFolder $decision.sidecar (Join-Path $runtimeRoot 'crash-capture')
    $outPath = if ($folder) { Join-Path $folder 'procdump.stdout.log' } else { $null }
    $out = if ($outPath -and (Test-Path -LiteralPath $outPath)) { Get-Content -LiteralPath $outPath -Raw -Encoding Unicode -ErrorAction SilentlyContinue } else { '' }
    if (-not $folder -or -not (Test-MapProcDumpOutput $out ([int]$map.pid) ([string]$map.path) $folder)) {
      if ($sameMap -and $prior.procdumpAttachStatus -eq 'FAILED' -and [int]$prior.procdumpProcessId -eq [int]$decision.sidecar.ProcessId) { return $prior }
      $record = [pscustomobject]@{ runtimeGenerationId = $generation; mapPid = [int]$map.pid; mapProcessStartTime = [string]$map.start; mapBinaryPath = [string]$map.path; procdumpAttachedPid = $null; procdumpAttachedAt = $null; procdumpProcessId = [int]$decision.sidecar.ProcessId; procdumpAttachStatus = 'FAILED'; procdumpAttachError = 'PROCDUMP_OUTPUT_UNVERIFIED'; dumpDirectory = $folder; mapRuntimeUnaffected = 'YES'; previous = if ($sameMap) { $prior.previous } else { Get-ProcDumpHistoricalState $prior } }
      Write-IncidentJson $statePath $record
      return $record
    }
    $record = [pscustomobject]@{ runtimeGenerationId = $generation; mapPid = [int]$map.pid; mapProcessStartTime = [string]$map.start; mapBinaryPath = [string]$map.path; procdumpAttachedPid = [int]$map.pid; procdumpAttachedAt = [DateTimeOffset]::UtcNow.ToString('o'); procdumpProcessId = [int]$decision.sidecar.ProcessId; procdumpAttachStatus = 'ATTACHED'; procdumpAttachError = $null; dumpDirectory = $folder; mapRuntimeUnaffected = 'YES'; previous = if ($sameMap) { $prior.previous } else { Get-ProcDumpHistoricalState $prior } }
    Write-IncidentJson $statePath $record
    return $record
  }
  if (-not $enabled) { return }
  if ($sameMap -and $prior.procdumpAttachStatus -eq 'FAILED' -and $prior.attemptedAt) {
    if ([DateTimeOffset]::UtcNow -lt ([DateTimeOffset]::Parse([string]$prior.attemptedAt)).AddMinutes(1)) { return $prior }
  }
  $record = [pscustomobject]@{ runtimeGenerationId = $generation; mapPid = [int]$map.pid; mapProcessStartTime = [string]$map.start; mapBinaryPath = [string]$map.path; procdumpAttachedPid = $null; procdumpAttachedAt = $null; procdumpProcessId = $null; procdumpAttachStatus = 'FAILED'; procdumpAttachError = $null; attemptedAt = [DateTimeOffset]::UtcNow.ToString('o'); mapRuntimeUnaffected = 'YES'; previous = if ($sameMap) { $prior.previous } else { Get-ProcDumpHistoricalState $prior } }
  try {
    $expectedPorts = @{ login = 6901; char = 6122; map = 5122 }
    $preOwners = @{}
    foreach ($service in @('login', 'char', 'map')) {
      $entry = @($runtimeState.processes | Where-Object name -eq $service)
      $owners = @(Get-NetTCPConnection -State Listen -LocalPort $expectedPorts[$service] -ErrorAction Stop | ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
      if ($entry.Count -ne 1 -or $owners.Count -ne 1 -or $owners[0] -ne [int]$entry[0].id) { throw ('CANONICAL_PORT_UNHEALTHY:{0}' -f $service) }
      $preOwners[$service] = $owners[0]
    }
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/api/health' -Method Get -TimeoutSec 2 -ErrorAction Stop
    if ($health.ok -ne $true) { throw 'DASHBOARD_HEALTH_UNAVAILABLE' }
    $openKore = @(Get-CimInstance Win32_Process -Filter "Name='perl.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -match 'openkore' })
    if ($openKore.Count -gt 0) { throw 'OPENKORE_RUNTIME_PRESENT' }
    if (-not (Test-Path -LiteralPath $script:approvedProcDumpPath) -or (Get-FileHash -LiteralPath $script:approvedProcDumpPath -Algorithm SHA256).Hash -ne $script:approvedProcDumpHash) { throw 'PROCDUMP_IDENTITY_MISMATCH' }
    if (-not (Test-Path -LiteralPath $map.path -PathType Leaf)) { throw 'MAP_BINARY_MISSING' }
    $record | Add-Member -NotePropertyName mapBinarySha256 -NotePropertyValue ((Get-FileHash -LiteralPath $map.path -Algorithm SHA256).Hash) -Force
    $folder = Join-Path (Join-Path $runtimeRoot 'crash-capture') ('canonical-map-{0}-{1}' -f $map.pid, [DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmss'))
    Protect-IncidentDirectory $folder
    $record | Add-Member -NotePropertyName dumpDirectory -NotePropertyValue $folder -Force
    $args = @('-ma', '-n', '2', '-e', '1', '-f', $script:approvedProcDumpFilter, [string]$map.pid, $folder)
    $sidecar = Start-Process -FilePath $script:approvedProcDumpPath -ArgumentList $args -WindowStyle Hidden -RedirectStandardOutput (Join-Path $folder 'procdump.stdout.log') -RedirectStandardError (Join-Path $folder 'procdump.stderr.log') -PassThru -ErrorAction Stop
    $outputVerified = $false
    $outputPath = Join-Path $folder 'procdump.stdout.log'
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
      Start-Sleep -Milliseconds 250
      if ($sidecar.HasExited) { throw 'PROCDUMP_EXITED_DURING_ATTACH' }
      $output = if (Test-Path -LiteralPath $outputPath) { Get-Content -LiteralPath $outputPath -Raw -Encoding Unicode -ErrorAction SilentlyContinue } else { '' }
      if (Test-MapProcDumpOutput $output ([int]$map.pid) ([string]$map.path) $folder) { $outputVerified = $true; break }
    }
    if (-not $outputVerified) { throw 'PROCDUMP_OUTPUT_UNVERIFIED' }
    $currentMap = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$map.pid)" -ErrorAction Stop
    if (-not $currentMap -or [string]$currentMap.ExecutablePath -ine [string]$map.path) { throw 'MAP_POST_ATTACH_IDENTITY_CHANGED' }
    foreach ($service in @('login', 'char', 'map')) {
      $owners = @(Get-NetTCPConnection -State Listen -LocalPort $expectedPorts[$service] -ErrorAction Stop | ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
      if ($owners.Count -ne 1 -or $owners[0] -ne $preOwners[$service]) { throw ('PORT_CHANGED_AFTER_ATTACH:{0}' -f $service) }
    }
    $record.procdumpAttachedPid = [int]$map.pid
    $record.procdumpAttachedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $record.procdumpProcessId = [int]$sidecar.Id
    $record.procdumpAttachStatus = 'ATTACHED'
  } catch { $record.procdumpAttachError = Protect-IncidentText ([string]$_.Exception.Message) }
  Write-IncidentJson $statePath $record
  return $record
}
