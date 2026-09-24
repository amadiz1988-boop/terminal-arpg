[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet('snapshot','stop','start')][string]$Action,
  [Parameter(Mandatory=$true)][string]$ProductionRoot,
  [string]$Owner, [string]$LeaseId
)
$ErrorActionPreference = 'Stop'
$expectedRoot = 'C:\Users\Administrator\ghost-island-production\ro-stack'
if ([IO.Path]::GetFullPath($ProductionRoot).TrimEnd('\') -ine $expectedRoot) { throw 'CANONICAL_ROOT_REQUIRED' }
$runtime = Join-Path $ProductionRoot '.local\ro-stack'
$native = Join-Path $runtime 'rathena'
$launcher = Join-Path $ProductionRoot 'ops\ro-stack\ro-stack.ps1'
. (Join-Path $PSScriptRoot 'procdump-process-identity.ps1')

function Get-Snapshot {
  $all = @(Get-CimInstance Win32_Process)
  $listeners = @(Get-NetTCPConnection -State Listen)
  $counts = [ordered]@{}
  $pids = [ordered]@{}
  $pass = $true
  foreach ($entry in @(@('login',6901),@('char',6122),@('map',5122))) {
    $name = [string]$entry[0]; $port = [int]$entry[1]
    $matches = @($all | Where-Object Name -eq ($name + '-server.exe'))
    $counts[$name] = $matches.Count
    $holders = @($listeners | Where-Object LocalPort -eq $port | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($matches.Count -ne 1 -or $holders.Count -ne 1) { $pass = $false; continue }
    $pids[$name] = [int]$matches[0].ProcessId
    if ([string]$matches[0].ExecutablePath -ine (Join-Path $native ($name + '-server.exe')) -or
        $holders[0] -ne $matches[0].ProcessId) { $pass = $false }
  }
  $openkore = @($all | Where-Object { $_.Name -match '^(openkore|start)\.exe$' -or
    ($_.Name -match '^(perl|wxperl|python|pythonw)\.exe$' -and
      (-not $_.CommandLine -or $_.CommandLine -match 'openkore|\bkore\.pl')) }).Count
  $dashboard = @($listeners | Where-Object LocalPort -eq 8788 | Select-Object -ExpandProperty OwningProcess -Unique)
  $db = @($listeners | Where-Object LocalPort -eq 3307 | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($dashboard.Count -ne 1 -or $db.Count -ne 1 -or $openkore -ne 0) { $pass = $false }
  $capture = $null
  $identity = $null
  $captureFile = Join-Path $runtime 'procdump-attachment-state.json'
  if (Test-Path -LiteralPath $captureFile) {
    $capture = Get-Content -LiteralPath $captureFile -Raw | ConvertFrom-Json
    $sidecars = @($all | Where-Object Name -match '^procdump(64|64a)?\.exe$')
    $mapEntry = @($all | Where-Object Name -eq 'map-server.exe')
    $mapProcess = if ($pids.map) { Get-Process -Id $pids.map -ErrorAction SilentlyContinue } else { $null }
    $approved = 'C:\Users\Administrator\AppData\Local\Microsoft\Sysinternals\ProcDump-12.01\procdump64.exe'
    $filter = '*C0000005*,*C000008D*,*C000008E*,*C000008F*,*C0000090*,*C0000091*,*C0000092*,*C0000093*,*C0000094*,*C0000095*'
    $identity = Compare-ProcDumpProcessIdentity $capture ([int]$pids.map) $(if ($mapEntry.Count -eq 1) { $mapEntry[0] } else { $null }) $mapProcess $sidecars (Join-Path $native 'map-server.exe') $approved $filter
    $approvedHash = try {
      (Get-FileHash -LiteralPath $approved -Algorithm SHA256 -ErrorAction Stop).Hash -eq 'D1FC99AE304BD1D2BF28ABEB62531DA959E2431916194981B88C958FD713A8E6'
    } catch { $false }
    if (-not $approvedHash) {
      $identity.PROCESS_IDENTITY_MATCH = 'NO'
      $identity.reason = 'PROCDUMP_HASH_MISMATCH'
    }
    if ($identity.PROCESS_IDENTITY_MATCH -ne 'YES') { $capture = $null }
  }
  return [pscustomobject]@{pass=$pass; counts=$counts; pids=$pids; openkore_runtime_count=$openkore;
    dashboard_pid= $(if($dashboard.Count -eq 1){$dashboard[0]}else{0}); database_pid=$(if($db.Count -eq 1){$db[0]}else{0});
    procdump_receipt=$capture; procdump_process_identity=$identity; measured_at=[DateTime]::UtcNow.ToString('o')}
}

if ($Action -eq 'snapshot') { Get-Snapshot | ConvertTo-Json -Depth 12 -Compress; exit 0 }
$lease = Get-Content -LiteralPath (Join-Path $runtime 'production-deployment-lease\lease.json') -Raw | ConvertFrom-Json
$state = Get-Content -LiteralPath (Join-Path $runtime 'production-deployment-state.json') -Raw | ConvertFrom-Json
$pending = Get-Content -LiteralPath (Join-Path $runtime 'first-github-first-promotion.pending.json') -Raw | ConvertFrom-Json
if (-not $LeaseId -or $lease.lease_id -ne $LeaseId -or $lease.owner_task_id -ne $Owner -or
    $lease.status -ne 'ACTIVE' -or $lease.promotion_mode -ne 'FIRST_GITHUB_FIRST_PROMOTION' -or
    $pending.lease_id -ne $LeaseId -or $state.production_drift -ne 'OPEN' -or
    $state.drift_reason -ne 'FIRST_PROMOTION_PENDING_FINAL_RECEIPT') { throw 'NATIVE_LEASE_NOT_OWNED' }
if ($Action -eq 'stop') {
  $before = Get-Snapshot
  if (-not $before.pass -or -not $before.procdump_receipt) { throw 'PRESTOP_RUNTIME_INVALID' }
  # Require the tracked state path to prevent the launcher's force-stop fallback.
  $tracked = Get-Content -LiteralPath (Join-Path $runtime 'state.json') -Raw | ConvertFrom-Json
  if (@($tracked.processes).Count -ne 3) { throw 'TRACKED_RUNTIME_REQUIRED' }
  foreach ($name in @('login','char','map')) {
    $entry = @($tracked.processes | Where-Object name -eq $name)
    if ($entry.Count -ne 1 -or $entry[0].id -ne $before.pids[$name] -or
        [string]$entry[0].path -ine (Join-Path $native ($name+'-server.exe'))) { throw 'TRACKED_IDENTITY_CHANGED' }
  }
} else {
  $all = @(Get-CimInstance Win32_Process | Where-Object Name -in @('login-server.exe','char-server.exe','map-server.exe'))
  $ports = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in @(6901,6122,5122))
  if ($all.Count -ne 0 -or $ports.Count -ne 0 -or (Test-Path -LiteralPath (Join-Path $runtime 'state.json'))) { throw 'SECOND_STACK_FORBIDDEN' }
  $snapshot=Get-Snapshot
  if ($snapshot.openkore_runtime_count -ne 0 -or $snapshot.dashboard_pid -le 0 -or $snapshot.database_pid -le 0) { throw 'PRESTART_DEPENDENCY_CHANGED' }
}
# Existing Production procedure owns graceful stop, lifecycle lock, configured
# environment, guard and exactly one replacement. No replacement runtime engine.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -Action $Action | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'EXISTING_LIFECYCLE_FAILED' }
if ($Action -eq 'stop') {
  $left = @(Get-CimInstance Win32_Process | Where-Object Name -in @('login-server.exe','char-server.exe','map-server.exe'))
  $ports = @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -in @(6901,6122,5122))
  if ($left.Count -or $ports.Count) { throw 'OLD_RUNTIME_NOT_STOPPED' }
}
