[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'stop', 'health')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectRoot = if ($env:PLAYER_WEB_PROJECT_ROOT) {
  (Resolve-Path -LiteralPath $env:PLAYER_WEB_PROJECT_ROOT).Path
} else {
  $sourceRoot
}
$runtimeRoot = if ($env:PLAYER_WEB_RUNTIME_ROOT) {
  (Resolve-Path -LiteralPath $env:PLAYER_WEB_RUNTIME_ROOT).Path
} else {
  Join-Path $projectRoot '.local\ro-stack'
}
$runtime = Join-Path $runtimeRoot 'dashboard'
$statePath = Join-Path $runtime 'state.json'
$scriptPath = Join-Path $projectRoot 'ops\ro-stack\dashboard.mjs'
$port = 8788
$startMutexName = 'Global\TerminalARPGPlayerWebServiceStart'

function Get-DashboardProcess {
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { return $null }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
    if (
      $process -and
      $process.Name -eq 'node.exe' -and
      $process.CommandLine -like '*dashboard.mjs*'
    ) { return $process }
  } catch {}
  return $null
}

function Test-LocalHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 4
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop)
    $publicListeners = @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })
    return $response.StatusCode -eq 200 -and $response.Content -match '"ok"\s*:\s*true' -and $listeners.Count -gt 0 -and $publicListeners.Count -eq 0
  } catch { return $false }
}

if ($Action -eq 'stop') {
  $process = Get-DashboardProcess
  if ($process) { Stop-Process -Id $process.ProcessId -Force }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'PLAYER_WEB_SERVICE_STOPPED'
  exit 0
}

if ($Action -eq 'health') {
  if (-not (Get-DashboardProcess)) { Write-Host 'PLAYER_WEB_SERVICE_OFFLINE'; exit 1 }
  if (-not (Test-LocalHealth)) { Write-Host 'PLAYER_WEB_SERVICE_UNREACHABLE'; exit 1 }
  Write-Host 'PLAYER_WEB_SERVICE_HEALTHY'
  exit 0
}

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$startMutex = [Threading.Mutex]::new($false, $startMutexName)
$lockAcquired = $false
try {
  try {
    $lockAcquired = $startMutex.WaitOne([TimeSpan]::FromSeconds(30))
  } catch [Threading.AbandonedMutexException] {
    $lockAcquired = $true
  }
  if (-not $lockAcquired) { throw 'Player web service start lock timed out.' }

  $existing = Get-DashboardProcess
  if ($existing) {
    if (Test-LocalHealth) { Write-Host 'PLAYER_WEB_SERVICE_HEALTHY'; exit 0 }
    Write-Host 'PLAYER_WEB_SERVICE_DEGRADED'
    exit 1
  }
  if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "Dashboard entrypoint does not exist: $scriptPath"
  }

  $nodePath = if ($env:PLAYER_WEB_NODE_PATH -and (Test-Path -LiteralPath $env:PLAYER_WEB_NODE_PATH -PathType Leaf)) {
    (Resolve-Path -LiteralPath $env:PLAYER_WEB_NODE_PATH).Path
  } else {
    (Get-Command node -ErrorAction Stop).Source
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdout = Join-Path $runtime "$stamp.out.log"
  $stderr = Join-Path $runtime "$stamp.err.log"
  $previousHost = $env:RO_DASHBOARD_HOST
  $env:RO_DASHBOARD_HOST = '127.0.0.1'
  try {
    $process = Start-Process -FilePath $nodePath -ArgumentList @($scriptPath) `
      -WorkingDirectory $projectRoot -WindowStyle Hidden `
      -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  } finally {
    $env:RO_DASHBOARD_HOST = $previousHost
  }
  @{
    pid = $process.Id
    startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    stdout = $stdout
    stderr = $stderr
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  $deadline = (Get-Date).AddSeconds(20)
  do {
    if (Test-LocalHealth) { Write-Host 'PLAYER_WEB_SERVICE_STARTED'; exit 0 }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "Dashboard startup timed out. See $stderr"
} finally {
  if ($lockAcquired) { $startMutex.ReleaseMutex() }
  $startMutex.Dispose()
}
