[CmdletBinding()]
param(
  [ValidateSet('Detect', 'Enforce')][string]$Mode = 'Enforce',
  [switch]$DryRun,
  [switch]$Continuous,
  [int]$IntervalSeconds = 10,
  [string]$AuditPath
)

# PRODUCTION RUNTIME SENTINEL — single-runtime hard enforcement.
#
# Live process + TCP listener inspection only. Never scans disk for binaries.
# Terminates a second / non-canonical rAthena process, but is fail-safe: the
# process that is canonical path AND holds the canonical port is never killed,
# and a server type with no canonical instance is never killed (only reported).
# Cloudflared is audited, never killed.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-sentinel.lib.ps1')
. (Join-Path $PSScriptRoot 'runtime-incident.lib.ps1')

$scriptRoot = $PSScriptRoot
$projectRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
$canonicalRoot = Join-Path $projectRoot '.local\ro-stack\rathena'
$canonicalPorts = @{ login = 6901; char = 6122; map = 5122 }
$retiredPorts = @(6902, 6123, 5123, 8792, 6904, 6124, 5124, 6905, 6125, 5125)
$serverNames = @('login-server.exe', 'char-server.exe', 'map-server.exe')
$unauthorizedToken = 'UNAUTHORIZED_RATHENA_RUNTIME'
if (-not $AuditPath) { $AuditPath = Join-Path $projectRoot '.local\ro-stack\sentinel-audit.log' }
$statePath = Join-Path $projectRoot '.local\ro-stack\state.json'

function Get-ParentChain([int]$startPid) {
  $chain = @()
  $current = $startPid
  $guard = 0
  while ($current -and $guard -lt 15) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
    if (-not $proc) { break }
    $chain += [pscustomobject]@{ pid = [int]$proc.ProcessId; ppid = [int]$proc.ParentProcessId; name = [string]$proc.Name; cmd = [string]$proc.CommandLine }
    $current = [int]$proc.ParentProcessId
    $guard++
  }
  return $chain
}

function Write-Audit([hashtable]$entry) {
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $AuditPath) | Out-Null
    ($entry | ConvertTo-Json -Compress) | Add-Content -LiteralPath $AuditPath -Encoding utf8
  } catch {}
}

function Get-LiveServers {
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $serverNames -contains $_.Name })
  foreach ($p in $procs) {
    [pscustomobject]@{
      pid = [int]$p.ProcessId; ppid = [int]$p.ParentProcessId; name = [string]$p.Name
      path = [string]$p.ExecutablePath; command = [string]$p.CommandLine; start = ([DateTimeOffset]$p.CreationDate).ToUniversalTime().ToString('o')
      ports = @($listeners | Where-Object { $_.OwningProcess -eq $p.ProcessId } | ForEach-Object { [int]$_.LocalPort })
    }
  }
}

function Get-CanonicalPids {
  if (-not (Test-Path $statePath)) { return @() }
  try {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    return @($state.processes | Where-Object { $_.name -in @('login', 'char', 'map') } | ForEach-Object { [int]$_.id })
  } catch { return @() }
}

function Invoke-SentinelTick {
  $servers = @(Get-LiveServers)
  $decision = Get-RAthenaProcessDecision -Servers $servers -CanonicalRoot $canonicalRoot -CanonicalPorts $canonicalPorts -ServerNames $serverNames -CanonicalPids @(Get-CanonicalPids)
  $survivors = @($decision.survivors)
  $unauthorized = @($decision.unauthorized)

  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  $retiredListeners = @()
  foreach ($retiredPort in $retiredPorts) {
    $owner = @($listeners | Where-Object { $_.LocalPort -eq $retiredPort } | Select-Object -First 1 -ExpandProperty OwningProcess)
    if ($owner) { $retiredListeners += [pscustomobject]@{ port = $retiredPort; pid = [int]$owner } }
  }

  $killed = @()
  $failed = @()
  foreach ($target in $unauthorized) {
    $targetPid = [int]$target.pid
    if ($survivors -contains $targetPid) { continue }
    $proc = @($servers | Where-Object { [int]$_.pid -eq $targetPid } | Select-Object -First 1)
    if (-not $proc) { continue }
    $chain = Get-ParentChain ([int]$proc.ppid)
    Write-Audit @{
      timestamp = [DateTimeOffset]::UtcNow.ToString('o')
      action = if ($Mode -eq 'Enforce' -and -not $DryRun) { 'TERMINATE' } else { 'DETECT' }
      reason = [string]$target.reason
      pid = $targetPid
      ppid = [int]$proc.ppid
      name = [string]$proc.name
      path = [string]$proc.path
      command = [string]$proc.command
      ports = ($proc.ports -join ',')
      parentChain = (@($chain | ForEach-Object { $_.name }) -join '<')
    }
    if ($Mode -eq 'Enforce' -and -not $DryRun) {
      try { Stop-Process -Id $targetPid -Force -ErrorAction Stop; $killed += $targetPid } catch { $failed += $targetPid }
    }
  }

  foreach ($listener in $retiredListeners) {
    Write-Audit @{
      timestamp = [DateTimeOffset]::UtcNow.ToString('o'); action = 'DETECT'
      reason = 'RETIRED_TEST_RUNTIME'; pid = [int]$listener.pid; port = [int]$listener.port
    }
  }

  $liveAfter = @(Get-LiveServers)
  # Evidence collection observes canonical exits only. It has no lifecycle
  # authority and does not change the sentinel's enforcement decision.
  try {
    $stopEvents = @(Get-RuntimeProcessExitEvents (Join-Path $projectRoot '.local\ro-stack') $liveAfter)
    Invoke-RuntimeIncidentTick (Join-Path $projectRoot '.local\ro-stack') $liveAfter $stopEvents
  } catch {
    Write-Audit @{ timestamp = [DateTimeOffset]::UtcNow.ToString('o'); action = 'INCIDENT_EVIDENCE_ERROR'; reason = [string]$_.Exception.Message }
  }
  function Count-Name($all, $name) { return @($all | Where-Object { $_.name -eq $name }).Count }
  $loginCount = Count-Name $liveAfter 'login-server.exe'
  $charCount = Count-Name $liveAfter 'char-server.exe'
  $mapCount = Count-Name $liveAfter 'map-server.exe'

  function Test-CanonicalProtected($all, $name, $port) {
    return @($all | Where-Object { $_.name -eq $name -and (Test-RuntimePathCanonical -Path $_.path -CanonicalRoot $canonicalRoot) -and (@($_.ports) -contains $port) }).Count -gt 0
  }
  $loginProtected = Test-CanonicalProtected $liveAfter 'login-server.exe' 6901
  $charProtected = Test-CanonicalProtected $liveAfter 'char-server.exe' 6122
  $mapProtected = Test-CanonicalProtected $liveAfter 'map-server.exe' 5122

  $cloudflared = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'cloudflared.exe' })
  $cloudflaredLines = @()
  $terminalAttached = $false
  foreach ($cf in $cloudflared) {
    $chain = Get-ParentChain ([int]$cf.ParentProcessId)
    $classification = Get-RuntimeParentChainClassification -ParentNames @($chain | ForEach-Object { $_.name })
    if ($classification.terminalAttached) { $terminalAttached = $true }
    $cloudflaredLines += "CLOUDFLARED_PID=$([int]$cf.ProcessId) PPID=$([int]$cf.ParentProcessId) CHAIN=$($classification.parentChain) ATTACH=$($classification.mode)"
  }
  $cloudflaredTask = Get-ScheduledTask -TaskName 'GhostIslandRO-CloudflaredTunnels' -ErrorAction SilentlyContinue
  $cloudflaredMode = if ($cloudflaredTask) { 'SCHEDULED_TASK_HIDDEN' } elseif ($cloudflared.Count -gt 0) { 'UNMANAGED_PROCESS' } else { 'OFFLINE' }

  $detected = ($unauthorized.Count -gt 0) -or ($retiredListeners.Count -gt 0)
  $blocked = ($killed.Count -gt 0)
  $status = if ($detected) { $unauthorizedToken } else { 'SINGLE_RUNTIME_OK' }

  Write-Host "RUNTIME_SENTINEL mode=$Mode dryRun=$([bool]$DryRun) status=$status login=$loginCount char=$charCount map=$mapCount survivors=$($survivors -join ',') killed=$($killed -join ',') failed=$($failed -join ',')"
  Write-Host "DIRECT_EXE_BYPASS_DETECTED=$(if ($detected) { 'YES' } else { 'NO' })"
  Write-Host "SECOND_RATHENA_AUTO_BLOCK=$(if ($blocked) { 'YES' } else { 'NO' })"
  Write-Host "CANONICAL_LOGIN_PROTECTED=$(if ($loginProtected) { 'YES' } else { 'NO' })"
  Write-Host "CANONICAL_CHAR_PROTECTED=$(if ($charProtected) { 'YES' } else { 'NO' })"
  Write-Host "CANONICAL_MAP_PROTECTED=$(if ($mapProtected) { 'YES' } else { 'NO' })"
  Write-Host "LOGIN_COUNT=$loginCount CHAR_COUNT=$charCount MAP_COUNT=$mapCount"
  Write-Host "CLOUDFLARED_MANAGEMENT_MODE=$cloudflaredMode"
  Write-Host "CLOUDFLARED_TERMINAL_ATTACHED=$(if ($terminalAttached) { 'YES' } else { 'NO' })"
  if ($cloudflaredLines.Count -eq 0) { Write-Host 'CLOUDFLARED_PID=none' }
  foreach ($line in $cloudflaredLines) { Write-Host $line }
  Write-Host 'SENTINEL_VISIBLE_WINDOW=NO'

  if ($failed.Count -gt 0) { return 1 }
  if ($detected) { return 4 }
  return 0
}

if ($Continuous) {
  $interval = [Math]::Max(5, $IntervalSeconds)
  while ($true) {
    try { [void](Invoke-SentinelTick) } catch { Write-Audit @{ timestamp = [DateTimeOffset]::UtcNow.ToString('o'); action = 'ERROR'; reason = [string]$_.Exception.Message } }
    Start-Sleep -Seconds $interval
  }
} else {
  exit (Invoke-SentinelTick)
}
