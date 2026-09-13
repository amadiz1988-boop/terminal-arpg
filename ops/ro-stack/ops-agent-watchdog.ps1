[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'stop', 'health', 'run')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimeRoot = if ($env:OPS_AGENT_RUNTIME_ROOT) {
  (Resolve-Path -LiteralPath $env:OPS_AGENT_RUNTIME_ROOT).Path
} else {
  Join-Path $projectRoot '.local\ro-stack'
}
$runtime = Join-Path $runtimeRoot 'ops-agent-watchdog'
$statePath = Join-Path $runtime 'state.json'
$logPath = Join-Path $runtime 'watchdog.log'
$serviceScript = Join-Path $PSScriptRoot 'ops-agent-service.ps1'
$tunnelScript = Join-Path $PSScriptRoot 'ops-agent-tunnel.ps1'
$serviceFailureThreshold = 4
$tunnelFailureThreshold = 4

function Get-WatchdogProcess {
  if (-not (Test-Path -LiteralPath $statePath)) { return $null }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
    if (
      $process -and
      $process.Name -match 'powershell|pwsh' -and
      $process.CommandLine -like "*$PSCommandPath*run*"
    ) { return $process }
  } catch {}
  return $null
}

function Write-WatchdogLog([string]$Message) {
  "[$(Get-Date -Format o)] $Message" | Add-Content -LiteralPath $logPath -Encoding utf8
}

if ($Action -eq 'stop') {
  $process = Get-WatchdogProcess
  if ($process) { Stop-Process -Id $process.ProcessId -Force }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'OPS_AGENT_WATCHDOG_STOPPED'
  exit 0
}

if ($Action -eq 'health') {
  if (Get-WatchdogProcess) { Write-Host 'OPS_AGENT_WATCHDOG_HEALTHY'; exit 0 }
  Write-Host 'OPS_AGENT_WATCHDOG_OFFLINE'
  exit 1
}

if ($Action -eq 'start') {
  if (Get-WatchdogProcess) { Write-Host 'OPS_AGENT_WATCHDOG_HEALTHY'; exit 0 }
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, 'run'
  ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  @{
    pid = $process.Id
    startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  Write-Host 'OPS_AGENT_WATCHDOG_STARTED'
  exit 0
}

$serviceFailures = 0
$tunnelFailures = 0
while ($true) {
  $serviceHealth = & $serviceScript health 2>&1
  if ($LASTEXITCODE -eq 0) {
    if ($serviceFailures -gt 0) { Write-WatchdogLog 'ops-agent health recovered without restart' }
    $serviceFailures = 0
  } else {
    $serviceFailures++
    Write-WatchdogLog "ops-agent health failure $serviceFailures/$serviceFailureThreshold`: $($serviceHealth -join ' ')"
  }
  if ($serviceFailures -ge $serviceFailureThreshold) {
    $serviceFailures = 0
    Write-WatchdogLog 'ops-agent recovery started'
    try {
      & $serviceScript stop *>> $logPath
      & $serviceScript start *>> $logPath
    }
    catch { Write-WatchdogLog "ops-agent recovery failed: $($_.Exception.Message)" }
  }
  $tunnelHealth = & $tunnelScript health 2>&1
  if ($LASTEXITCODE -eq 0) {
    if ($tunnelFailures -gt 0) { Write-WatchdogLog 'ops-agent tunnel health recovered without restart' }
    $tunnelFailures = 0
  } else {
    $tunnelFailures++
    Write-WatchdogLog "ops-agent tunnel health failure $tunnelFailures/$tunnelFailureThreshold`: $($tunnelHealth -join ' ')"
  }
  if ($tunnelFailures -ge $tunnelFailureThreshold) {
    $tunnelFailures = 0
    Write-WatchdogLog 'ops-agent tunnel recovery started'
    try {
      & $tunnelScript stop *>> $logPath
      & $tunnelScript start *>> $logPath
    }
    catch { Write-WatchdogLog "ops-agent tunnel recovery failed: $($_.Exception.Message)" }
  }
  Start-Sleep -Seconds 15
}
