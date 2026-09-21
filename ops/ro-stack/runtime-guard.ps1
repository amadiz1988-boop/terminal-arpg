[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)][string]$Slot = 'Production',
  [ValidateSet('Validate', 'Acquire', 'Release', 'Verify', 'Inventory', 'Guard')][string]$Action = 'Validate',
  [string]$DbName,
  [int]$LoginPort,
  [int]$CharPort,
  [int]$MapPort,
  [int]$DashboardPort,
  # ExecutablePath / runtime root the caller intends to launch from.
  [string]$RuntimeRoot,
  # Owner PID recorded in the lock (defaults to this process; callers pass their own).
  [int]$OwnerPid = $PID,
  [switch]$Force,
  # Override for isolated tests; defaults to <repo>\.local\runtime-slots.
  [string]$StateDir
)

# RUNTIME ADMISSION CONTROL — SINGLE RUNTIME POLICY (EFFECTIVE 2026-09-18)
#
# Only the canonical Production slot is authorized:
#   login 6901 / char 6122 / map 5122 / dashboard 8788, DB ragnarok.
# Every retired test runtime (A/B/C: 6902-6123-5123-8792, 6904-6124-5124,
# 6905-6125-5125) is denied. Extra login/char/map processes, non-canonical
# runtime roots and retired-port listeners are reported as
# UNAUTHORIZED_RATHENA_RUNTIME. Fail-closed: anything unrecognized is denied.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-guard.lib.ps1')

$scriptRoot = $PSScriptRoot
$projectRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
if (-not $StateDir) { $StateDir = Join-Path $projectRoot '.local\runtime-slots' }

# Production is a separate runtime root from this governance/source checkout.
# Keep the admission guard aligned with the executable path used by the
# canonical launcher; do not derive Production from the shared repo path.
$canonicalRoot = 'C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\rathena'
$canonical = @{ db = 'ragnarok'; login = 6901; char = 6122; map = 5122; dashboard = 8788; root = $canonicalRoot }
$retiredPorts = @(6902, 6123, 5123, 8792, 6904, 6124, 5124, 6905, 6125, 5125)
$serverNames = @('login-server.exe', 'char-server.exe', 'map-server.exe')
$unauthorizedToken = 'UNAUTHORIZED_RATHENA_RUNTIME'

function Deny([string]$reason, [string]$token = 'RUNTIME_START_DENIED') { Write-Host "$token slot=$Slot reason=$reason"; exit 2 }
function DenyUnauthorized([string]$reason) { Write-Host "$unauthorizedToken slot=$Slot reason=$reason"; exit 4 }
function Ok([string]$reason = 'ok') { Write-Host "RUNTIME_GUARD_OK slot=$Slot $reason"; exit 0 }

function Get-ServersWithPorts {
  $listen = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  $servers = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $serverNames -contains $_.Name })
  foreach ($s in $servers) {
    [pscustomobject]@{
      pid = [int]$s.ProcessId; ppid = [int]$s.ParentProcessId; name = [string]$s.Name
      path = [string]$s.ExecutablePath; start = [string]$s.CreationDate
      canonical = (Test-RuntimePathCanonical -Path ([string]$s.ExecutablePath) -CanonicalRoot $canonicalRoot)
      ports = @($listen | Where-Object { $_.OwningProcess -eq $s.ProcessId } | ForEach-Object { [int]$_.LocalPort })
    }
  }
}

# Global single-runtime violations. Empty array means the canonical runtime is
# the only rAthena runtime alive.
function Get-RuntimeViolations {
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  return Get-RAthenaRuntimeViolations -Servers @(Get-ServersWithPorts) -Listeners $listeners -CanonicalRoot $canonicalRoot -RetiredPorts $retiredPorts -ServerNames $serverNames
}

function Assert-SingleRuntime {
  $violations = @(Get-RuntimeViolations)
  if ($violations.Count -gt 0) { Write-Host "$unauthorizedToken slot=$Slot violations=$($violations -join '; ')"; exit 4 }
}

# Only the canonical Production slot may be addressed. Everything else is a
# retired test runtime and is denied before any rAthena process is launched.
if ($Slot -ne 'Production') { DenyUnauthorized 'retired_or_unknown_slot canonical_slot=Production' }

if ($Action -eq 'Inventory') {
  $servers = @(Get-ServersWithPorts)
  $violations = @(Get-RuntimeViolations)
  $status = if ($violations.Count -gt 0) { $unauthorizedToken } else { 'SINGLE_RUNTIME_OK' }
  [pscustomobject]@{
    status = $status
    canonicalRoot = $canonicalRoot
    canonicalPorts = @{ login = $canonical.login; char = $canonical.char; map = $canonical.map; dashboard = $canonical.dashboard }
    retiredPorts = $retiredPorts
    servers = @($servers | ForEach-Object { [pscustomobject]@{ pid = $_.pid; ppid = $_.ppid; name = $_.name; canonical = $_.canonical; ports = ($_.ports -join ','); path = $_.path; start = $_.start } })
    violations = $violations
  } | ConvertTo-Json -Depth 5
  if ($violations.Count -gt 0) { exit 4 }
  exit 0
}

if ($Action -eq 'Guard') { Assert-SingleRuntime; Ok 'single_runtime_confirmed' }

$def = $canonical
$callerDb = if ($DbName) { $DbName } else { $def.db }
$callerLogin = if ($LoginPort) { $LoginPort } else { $def.login }
$callerChar = if ($CharPort) { $CharPort } else { $def.char }
$callerMap = if ($MapPort) { $MapPort } else { $def.map }
$callerDash = if ($DashboardPort) { $DashboardPort } else { $def.dashboard }
$callerRoot = if ($RuntimeRoot) { $RuntimeRoot } else { $def.root }

if ($callerDb -ne 'ragnarok') { Deny "production_slot_requires_ragnarok_db got=$callerDb" }
if ($callerLogin -ne $def.login -or $callerChar -ne $def.char -or $callerMap -ne $def.map) {
  Deny "ports_do_not_match_canonical expected=$($def.login)/$($def.char)/$($def.map) got=$callerLogin/$callerChar/$callerMap"
}
foreach ($p in @($retiredPorts)) {
  if ($p -eq $callerLogin -or $p -eq $callerChar -or $p -eq $callerMap -or $p -eq $callerDash) { DenyUnauthorized "retired_port_requested port=$p" }
}
if ($callerRoot -and -not (Test-RuntimePathCanonical -Path $callerRoot -CanonicalRoot $canonicalRoot)) {
  Deny "executable_path_not_canonical expected_root=$($def.root) got=$callerRoot"
}

Assert-SingleRuntime

# --- port availability (no foreign process on the canonical ports) ---
$listen = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
foreach ($p in @($callerLogin, $callerChar, $callerMap, $callerDash)) {
  $owners = @($listen | Where-Object { $_.LocalPort -eq $p } | ForEach-Object { $_.OwningProcess } | Select-Object -Unique)
  foreach ($o in $owners) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$o" -ErrorAction SilentlyContinue
    if ($proc -and -not (Test-RuntimePathCanonical -Path ([string]$proc.ExecutablePath) -CanonicalRoot $canonicalRoot)) {
      Deny "port_in_use_by_foreign_process port=$p pid=$o path=$($proc.ExecutablePath)"
    }
  }
}

if ($Action -eq 'Validate' -or $Action -eq 'Verify') { Ok "db=$callerDb ports=$callerLogin/$callerChar/$callerMap root=$callerRoot" }

$lockPath = Join-Path $StateDir 'Production.lock'
$statePath = Join-Path $StateDir 'Production.json'
function Read-Lock {
  if (-not (Test-Path $lockPath)) { return $null }
  try { return Get-Content $lockPath -Raw | ConvertFrom-Json } catch { return $null }
}
function Test-PidAlive([int]$processId) {
  if (-not $processId) { return $false }
  return [bool](Get-Process -Id $processId -ErrorAction SilentlyContinue)
}

if ($Action -eq 'Release') {
  $lock = Read-Lock
  if (-not $lock) { Ok 'already_released'; }
  if ($Force -or -not (Test-PidAlive ([int]$lock.pid))) {
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    Ok 'released'
  }
  Deny "release_denied_owner_alive pid=$($lock.pid)"
}

if ($Action -eq 'Acquire') {
  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  $mutex = New-Object System.Threading.Mutex($false, "Global\GhostIslandRO-Production")
  $held = $false
  try {
    $held = $mutex.WaitOne(0)
    if (-not $held) { Write-Host 'SLOT_BUSY slot=Production owner=mutex'; exit 3 }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    [pscustomobject]@{ slot = 'Production'; pid = $OwnerPid; startedAt = $now; db = $callerDb; ports = @($callerLogin, $callerChar, $callerMap); dashboardPort = $callerDash; runtimeRoot = $callerRoot } | ConvertTo-Json | Set-Content -LiteralPath $lockPath -Encoding utf8
    [pscustomobject]@{ slot = 'Production'; launcher_pid = $OwnerPid; login_pid = $null; char_pid = $null; map_pid = $null; dashboard_pid = $null; db_name = $callerDb; ports = @($callerLogin, $callerChar, $callerMap); runtime_root = $callerRoot; started_at = $now } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
    Write-Host "RUNTIME_GUARD_OK slot=Production acquired owner=$OwnerPid db=$callerDb"
    exit 0
  } finally { if ($held) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
}
