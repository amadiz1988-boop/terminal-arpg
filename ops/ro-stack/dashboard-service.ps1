[CmdletBinding()]
param([Parameter(Mandatory=$true,Position=0)][ValidateSet('start','stop','health')][string]$Action)

$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime=Join-Path $projectRoot '.local\ro-stack\dashboard'
$statePath=Join-Path $runtime 'state.json'
$scriptPath=Join-Path $PSScriptRoot 'dashboard.mjs'

function Get-DashboardProcess {
  if(-not(Test-Path $statePath)){return $null}
  try{$state=Get-Content $statePath -Raw|ConvertFrom-Json;$process=Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue;if($process -and $process.ProcessName -eq 'node'){return $process}}catch{}
  return $null
}

if($Action -eq 'stop'){
  $process=Get-DashboardProcess
  if($process){Stop-Process -Id $process.Id -Force}
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'Dashboard stopped.'
  exit 0
}

if($Action -eq 'health'){
  try{
    $state=Invoke-RestMethod 'http://127.0.0.1:8788/api/internal/health' -TimeoutSec 3
    $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8788 -ErrorAction Stop)
    $loopbackOnly=$listeners.Count -gt 0 -and @($listeners|Where-Object{$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -eq 0
    if($loopbackOnly -and $state.services.database -and $state.services.login -and $state.services.character -and $state.services.map){Write-Host 'DASHBOARD_HEALTHY';exit 0}
  }catch{}
  Write-Host 'DASHBOARD_UNHEALTHY'
  exit 1
}

if(Get-DashboardProcess){Write-Host 'Dashboard already running.';exit 0}
New-Item -ItemType Directory -Force -Path $runtime|Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout=Join-Path $runtime "$stamp.out.log";$stderr=Join-Path $runtime "$stamp.err.log"
$previousHost=$env:RO_DASHBOARD_HOST
$env:RO_DASHBOARD_HOST='127.0.0.1'
try{$process=Start-Process -FilePath 'node' -ArgumentList @($scriptPath) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru}finally{$env:RO_DASHBOARD_HOST=$previousHost}
@{pid=$process.Id;startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();stdout=$stdout;stderr=$stderr}|ConvertTo-Json|Set-Content $statePath -Encoding utf8
$deadline=(Get-Date).AddSeconds(10)
do{try{
  $null=Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 2
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8788 -ErrorAction Stop)
  if($listeners.Count -gt 0 -and @($listeners|Where-Object{$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -eq 0){Write-Host 'Dashboard started: http://127.0.0.1:8788/';exit 0}
}catch{Start-Sleep -Milliseconds 250}}while((Get-Date)-lt$deadline)
throw "Dashboard startup timed out. See $stderr"
