[CmdletBinding()]
param([Parameter(Mandatory=$true,Position=0)][ValidateSet('start','stop','health','probe')][string]$Action)

$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime=Join-Path $projectRoot '.local\ro-stack\dashboard'
$statePath=Join-Path $runtime 'state.json'
$scriptPath=Join-Path $PSScriptRoot 'dashboard.mjs'
$auditPath=Join-Path $runtime 'lifecycle-audit.log'
function Write-Audit([string]$event,[string]$detail){
  try{
    $parent=(Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue).ParentProcessId
    Add-Content -LiteralPath $auditPath -Encoding utf8 -Value ("{0} event={1} caller_pid={2} caller_parent={3} detail={4}" -f ([DateTimeOffset]::UtcNow.ToString('o')),$event,$PID,$parent,$detail)
  }catch{}
}

function Get-DashboardProcess {
  if(-not(Test-Path $statePath)){return $null}
  try{$state=Get-Content $statePath -Raw|ConvertFrom-Json;$process=Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue;if($process -and $process.ProcessName -eq 'node'){return $process}}catch{}
  return $null
}

if($Action -eq 'stop'){
  $process=Get-DashboardProcess
  Write-Audit 'stop' ("target=" + $(if($process){$process.Id}else{'none'}))
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

if($Action -eq 'probe'){
  try{
    $state=Invoke-RestMethod 'http://127.0.0.1:8788/api/internal/probe' -TimeoutSec 3
    $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8788 -ErrorAction Stop)
    $loopbackOnly=$listeners.Count -gt 0 -and @($listeners|Where-Object{$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -eq 0
    if($loopbackOnly -and $state.ok){Write-Host 'DASHBOARD_PROBE_HEALTHY';exit 0}
  }catch{}
  Write-Host 'DASHBOARD_PROBE_UNHEALTHY'
  exit 1
}

if(Get-DashboardProcess){Write-Host 'Dashboard already running.';exit 0}
New-Item -ItemType Directory -Force -Path $runtime|Out-Null
$canaryConfigPath=Join-Path $runtime 'web-experience-canary.json'
if(Test-Path -LiteralPath $canaryConfigPath){
  try{
    $canary=Get-Content -LiteralPath $canaryConfigPath -Raw|ConvertFrom-Json
    if($null -ne $canary.enabled){$env:WEB_EXPERIENCE_CANARY_ENABLED=if($canary.enabled){'1'}else{'0'}}
    if($null -ne $canary.percentage){$env:WEB_EXPERIENCE_CANARY_PERCENTAGE=[string]$canary.percentage}
    if($null -ne $canary.accounts){$env:WEB_EXPERIENCE_CANARY_ACCOUNTS=($canary.accounts -join ',')}
    if($null -ne $canary.characters){$env:WEB_EXPERIENCE_CANARY_CHARACTERS=($canary.characters -join ',')}
    if($null -ne $canary.users){$env:WEB_EXPERIENCE_CANARY_USERS=($canary.users -join ',')}
  }catch{Write-Host "Web Experience canary config ignored: $($_.Exception.Message)"}
}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout=Join-Path $runtime "$stamp.out.log";$stderr=Join-Path $runtime "$stamp.err.log"
$stdin=Join-Path $runtime "$stamp.stdin.log"
New-Item -ItemType File -Force -Path $stdin|Out-Null
$nodeExe=(Get-Command node -ErrorAction Stop).Source
$previousHost=$env:RO_DASHBOARD_HOST
$previousNativeSupplyPolicy=$env:PA_NATIVE_SUPPLY_POLICY_ENABLED
$previousM1AcceptanceFixture=$env:RO_M1_ACCEPTANCE_FIXTURE_ENABLED
$stackConfig=Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot 'stack.config.psd1')
$env:PA_NATIVE_SUPPLY_POLICY_ENABLED=if($stackConfig.WebNativeSupplyPolicyEnabled){'1'}else{'0'}
$env:RO_M1_ACCEPTANCE_FIXTURE_ENABLED=if($stackConfig.WebM1AcceptanceFixtureEnabled){'1'}else{'0'}
$env:RO_DASHBOARD_HOST='127.0.0.1'
try{$process=Start-Process -FilePath $nodeExe -ArgumentList @($scriptPath) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardInput $stdin -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru}catch{Write-Audit 'start_failed' "reason=process_launch";throw}finally{$env:RO_DASHBOARD_HOST=$previousHost;if($null -eq $previousNativeSupplyPolicy){Remove-Item Env:PA_NATIVE_SUPPLY_POLICY_ENABLED -ErrorAction SilentlyContinue}else{$env:PA_NATIVE_SUPPLY_POLICY_ENABLED=$previousNativeSupplyPolicy};if($null -eq $previousM1AcceptanceFixture){Remove-Item Env:RO_M1_ACCEPTANCE_FIXTURE_ENABLED -ErrorAction SilentlyContinue}else{$env:RO_M1_ACCEPTANCE_FIXTURE_ENABLED=$previousM1AcceptanceFixture}}
@{pid=$process.Id;startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();stdout=$stdout;stderr=$stderr}|ConvertTo-Json|Set-Content $statePath -Encoding utf8
$deadline=(Get-Date).AddSeconds(10)
do{try{
  $null=Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 2
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8788 -ErrorAction Stop)
  if($listeners.Count -gt 0 -and @($listeners|Where-Object{$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -eq 0){Write-Audit 'start' "pid=$($process.Id)";Write-Host 'Dashboard started: http://127.0.0.1:8788/';exit 0}
}catch{Start-Sleep -Milliseconds 250}}while((Get-Date)-lt$deadline)
Write-Audit 'start_failed' "reason=health_timeout pid=$($process.Id)"
throw "Dashboard startup timed out. See $stderr"
