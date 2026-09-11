[CmdletBinding()]
param([Parameter(Mandatory=$true,Position=0)][ValidateSet('start','stop','health','run')][string]$Action)

$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime=Join-Path $projectRoot '.local\ro-stack\dashboard'
$statePath=Join-Path $runtime 'watchdog-state.json'
$logPath=Join-Path $runtime 'watchdog.log'

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
  if(Get-WatchdogProcess){Write-Host 'DEMO_WATCHDOG_HEALTHY';exit 0}
  Write-Host 'DEMO_WATCHDOG_OFFLINE'
  exit 1
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

while($true) {
  $stamp=Get-Date -Format o
  & (Join-Path $PSScriptRoot 'dashboard-service.ps1') health *> $null
  if($LASTEXITCODE -ne 0) {
    "[$stamp] dashboard restart"|Add-Content $logPath -Encoding utf8
    & (Join-Path $PSScriptRoot 'dashboard-service.ps1') start *>> $logPath
  }
  & (Join-Path $PSScriptRoot 'demo-tunnel.ps1') health *> $null
  if($LASTEXITCODE -ne 0) {
    "[$stamp] tunnel restart"|Add-Content $logPath -Encoding utf8
    try { & (Join-Path $PSScriptRoot 'demo-tunnel.ps1') start *>> $logPath }
    catch { "[$stamp] $($_.Exception.Message)"|Add-Content $logPath -Encoding utf8 }
  }
  Start-Sleep -Seconds 15
}
