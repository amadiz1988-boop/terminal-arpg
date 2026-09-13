[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'stop', 'health', 'run')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimeRoot = if ($env:PLAYER_WEB_RUNTIME_ROOT) {
  (Resolve-Path -LiteralPath $env:PLAYER_WEB_RUNTIME_ROOT).Path
} else {
  Join-Path $projectRoot '.local\ro-stack'
}
$runtime = Join-Path $runtimeRoot 'player-web-watchdog'
$statePath = Join-Path $runtime 'state.json'
$logPath = Join-Path $runtime 'watchdog.log'
$serviceScript = Join-Path $PSScriptRoot 'player-web-service.ps1'
$tunnelScript = Join-Path $PSScriptRoot 'player-web-tunnel.ps1'
$failureThreshold = 4

function Get-WatchdogProcess {
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { return $null }
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
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -ge 1MB) {
    Move-Item -LiteralPath $logPath -Destination "$logPath.previous" -Force
  }
  "[$(Get-Date -Format o)] $Message" | Add-Content -LiteralPath $logPath -Encoding utf8
}

function Invoke-Recovery([string]$Label, [string]$Script) {
  Write-WatchdogLog "$Label recovery started"
  try {
    $stopOutput = & $Script stop *>&1
    if ($stopOutput) { ($stopOutput | Out-String).TrimEnd() | Add-Content -LiteralPath $logPath -Encoding utf8 }
    $startOutput = & $Script start *>&1
    $startExitCode = $LASTEXITCODE
    if ($startOutput) { ($startOutput | Out-String).TrimEnd() | Add-Content -LiteralPath $logPath -Encoding utf8 }
    if ($startExitCode -ne 0) { throw "$Label start exited with $startExitCode" }
    Write-WatchdogLog "$Label recovery completed"
  } catch {
    Write-WatchdogLog "$Label recovery failed: $($_.Exception.Message)"
  }
}

if ($Action -eq 'stop') {
  $process = Get-WatchdogProcess
  if ($process) { Stop-Process -Id $process.ProcessId -Force }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'PLAYER_WEB_WATCHDOG_STOPPED'
  exit 0
}

if ($Action -eq 'health') {
  if (Get-WatchdogProcess) { Write-Host 'PLAYER_WEB_WATCHDOG_HEALTHY'; exit 0 }
  Write-Host 'PLAYER_WEB_WATCHDOG_OFFLINE'
  exit 1
}

if ($Action -eq 'start') {
  if (Get-WatchdogProcess) { Write-Host 'PLAYER_WEB_WATCHDOG_HEALTHY'; exit 0 }
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, 'run'
  ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  @{
    pid = $process.Id
    startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  Write-Host 'PLAYER_WEB_WATCHDOG_STARTED'
  exit 0
}

$serviceFailures = 0
$tunnelFailures = 0
while ($true) {
  $serviceHealth = & $serviceScript health *>&1
  if ($LASTEXITCODE -eq 0) {
    if ($serviceFailures -gt 0) { Write-WatchdogLog 'player web service recovered without restart' }
    $serviceFailures = 0
  } elseif (($serviceHealth -join ' ') -match 'PLAYER_WEB_SERVICE_OFFLINE') {
    $serviceFailures = 0
    Invoke-Recovery 'player web service' $serviceScript
  } else {
    $serviceFailures++
    Write-WatchdogLog "player web service health failure $serviceFailures/$failureThreshold`: $($serviceHealth -join ' ')"
    if ($serviceFailures -ge $failureThreshold) {
      $serviceFailures = 0
      Invoke-Recovery 'player web service' $serviceScript
    }
  }

  $tunnelHealth = & $tunnelScript health *>&1
  if ($LASTEXITCODE -eq 0) {
    if ($tunnelFailures -gt 0) { Write-WatchdogLog 'player web tunnel recovered without restart' }
    $tunnelFailures = 0
  } elseif (($tunnelHealth -join ' ') -match 'PLAYER_WEB_TUNNEL_OFFLINE') {
    $tunnelFailures = 0
    Invoke-Recovery 'player web tunnel' $tunnelScript
  } else {
    $tunnelFailures++
    Write-WatchdogLog "player web tunnel health failure $tunnelFailures/$failureThreshold`: $($tunnelHealth -join ' ')"
    if ($tunnelFailures -ge $failureThreshold) {
      $tunnelFailures = 0
      Invoke-Recovery 'player web tunnel' $tunnelScript
    }
  }
  Start-Sleep -Seconds 15
}
