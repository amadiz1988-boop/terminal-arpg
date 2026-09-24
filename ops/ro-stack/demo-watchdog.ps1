[CmdletBinding()]
param([Parameter(Mandatory=$true,Position=0)][ValidateSet('start','stop','health','pause','resume','run')][string]$Action)

$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime=Join-Path $projectRoot '.local\ro-stack\dashboard'
$statePath=Join-Path $runtime 'watchdog-state.json'
$logPath=Join-Path $runtime 'watchdog.log'
$maintenancePath=Join-Path $runtime 'maintenance.lock'
$roStackScript=Join-Path $PSScriptRoot 'ro-stack.ps1'
$roCheckIntervalSeconds=30
$roFailureThreshold=2
$roRecoveryCooldownSeconds=120

function Write-WatchdogLog {
  param([Parameter(Mandatory=$true)][string]$Message)
  "[$(Get-Date -Format o)] $Message"|Add-Content $logPath -Encoding utf8
}

function Get-WatchdogProcess {
  if(-not(Test-Path $statePath)){return $null}
  try {
    $state=Get-Content $statePath -Raw|ConvertFrom-Json
    $process=Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
    if($process -and $process.ProcessName -match 'powershell|pwsh'){return $process}
  } catch {}
  return $null
}

if($Action -eq 'stop') {
  $process=Get-WatchdogProcess
  if($process){Stop-Process -Id $process.Id -Force}
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'DEMO_WATCHDOG_STOPPED'
  exit 0
}

if($Action -eq 'health') {
  if(Get-WatchdogProcess){
    Write-Host 'DEMO_WATCHDOG_HEALTHY'
    if(Test-Path $maintenancePath){Write-Host 'RO_RECOVERY_PAUSED'}else{Write-Host 'RO_RECOVERY_ACTIVE'}
    exit 0
  }
  Write-Host 'DEMO_WATCHDOG_OFFLINE'
  exit 1
}

if($Action -eq 'pause') {
  New-Item -ItemType Directory -Force -Path $runtime|Out-Null
  @{pausedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}|ConvertTo-Json|Set-Content $maintenancePath -Encoding utf8
  Write-Host 'RO_RECOVERY_PAUSED'
  exit 0
}

if($Action -eq 'resume') {
  Remove-Item -LiteralPath $maintenancePath -Force -ErrorAction SilentlyContinue
  Write-Host 'RO_RECOVERY_ACTIVE'
  exit 0
}

if($Action -eq 'start') {
  if(Get-WatchdogProcess){Write-Host 'DEMO_WATCHDOG_HEALTHY';exit 0}
  New-Item -ItemType Directory -Force -Path $runtime|Out-Null
  $process=Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'run'
  ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  @{pid=$process.Id;startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}|ConvertTo-Json|Set-Content $statePath -Encoding utf8
  Write-Host 'DEMO_WATCHDOG_STARTED'
  exit 0
}

$roFailureCount=0
$lastRoCheck=[DateTimeOffset]::MinValue
$lastRoRecovery=[DateTimeOffset]::MinValue
$maintenanceLogged=$false
$roHealthy=$true
while($true) {
  $now=[DateTimeOffset]::Now
  if(($now-$lastRoCheck).TotalSeconds -ge $roCheckIntervalSeconds) {
    $lastRoCheck=$now
    & $roStackScript health *> $null
    $roHealthy=($LASTEXITCODE -eq 0)
    if($roHealthy) {
      $roFailureCount=0
      $maintenanceLogged=$false
    } elseif(Test-Path $maintenancePath) {
      $roFailureCount=0
      if(-not $maintenanceLogged){Write-WatchdogLog 'rAthena unhealthy; automatic recovery paused for maintenance';$maintenanceLogged=$true}
    } else {
      $maintenanceLogged=$false
      $roFailureCount++
      if($roFailureCount -ge $roFailureThreshold -and ($now-$lastRoRecovery).TotalSeconds -ge $roRecoveryCooldownSeconds) {
        $lastRoRecovery=$now
        $roFailureCount=0
        Write-WatchdogLog 'rAthena recovery started'
        try {
          & $roStackScript stop *>> $logPath
          & $roStackScript start *>> $logPath
          & $roStackScript health *> $null
          $roHealthy=($LASTEXITCODE -eq 0)
          if($roHealthy){Write-WatchdogLog 'rAthena recovery completed'}else{Write-WatchdogLog 'rAthena recovery health check failed'}
        } catch {
          $roHealthy=$false
          Write-WatchdogLog "rAthena recovery failed: $($_.Exception.Message)"
        }
      }
    }
  }

  if($roHealthy) {
    & (Join-Path $PSScriptRoot 'dashboard-service.ps1') health *> $null
    if($LASTEXITCODE -ne 0) {
      Write-WatchdogLog 'dashboard restart'
      try { & (Join-Path $PSScriptRoot 'dashboard-service.ps1') start *>> $logPath }
      catch { Write-WatchdogLog "dashboard restart failed: $($_.Exception.Message)" }
    }
  }

  & (Join-Path $PSScriptRoot 'demo-tunnel.ps1') health *> $null
  if($LASTEXITCODE -ne 0) {
    Write-WatchdogLog 'tunnel restart'
    try { & (Join-Path $PSScriptRoot 'demo-tunnel.ps1') start *>> $logPath }
    catch { Write-WatchdogLog "tunnel restart failed: $($_.Exception.Message)" }
  }
  Start-Sleep -Seconds 15
}
