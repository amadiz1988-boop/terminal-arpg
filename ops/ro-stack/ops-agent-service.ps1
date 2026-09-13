[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'stop', 'health')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime = Join-Path $projectRoot '.local\ro-stack\ops-agent'
$statePath = Join-Path $runtime 'state.json'
$scriptPath = Join-Path $PSScriptRoot 'ops-agent\server.mjs'
$effectiveRuntimeRoot = if ($env:OPS_AGENT_RUNTIME_ROOT) {
  (Resolve-Path -LiteralPath $env:OPS_AGENT_RUNTIME_ROOT).Path
} else {
  Join-Path $projectRoot '.local\ro-stack'
}
$authPath = if ($env:OPS_AGENT_AUTH_FILE) {
  $env:OPS_AGENT_AUTH_FILE
} else {
  Join-Path $effectiveRuntimeRoot 'ops-agent\auth.json'
}
$port = if ($env:OPS_AGENT_PORT) { [int]$env:OPS_AGENT_PORT } else { 8790 }
if (-not $env:OPS_AGENT_PORT -and (Test-Path -LiteralPath $statePath)) {
  try {
    $savedPort = [int](Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).port
    if ($savedPort -ge 1 -and $savedPort -le 65535) { $port = $savedPort }
  } catch {}
}

function Get-OpsAgentProcess {
  if (-not (Test-Path -LiteralPath $statePath)) { return $null }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
    if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine -like "*$scriptPath*") {
      return $process
    }
  } catch {}
  return $null
}

if ($Action -eq 'health') {
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 3
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop)
    $loopbackOnly = $listeners.Count -gt 0 -and @(
      $listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }
    ).Count -eq 0
    if (
      $health.ok -and
      $health.mode -eq 'read-only' -and
      $health.access -eq 'authenticated' -and
      $loopbackOnly
    ) {
      Write-Host 'OPS_AGENT_HEALTHY'
      exit 0
    }
  } catch {}
  Write-Host 'OPS_AGENT_UNHEALTHY'
  exit 1
}

if ($Action -eq 'stop') {
  $process = Get-OpsAgentProcess
  if ($process) { Stop-Process -Id $process.ProcessId -Force }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'Ops Agent stopped.'
  exit 0
}

if (Get-OpsAgentProcess) {
  Write-Host 'Ops Agent already running.'
  exit 0
}

if (-not (Test-Path -LiteralPath $authPath)) {
  throw 'Ops Agent authentication is not initialized. Run npm run ops:agent:auth:init first.'
}

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $runtime "$stamp.out.log"
$stderr = Join-Path $runtime "$stamp.err.log"
$process = Start-Process -FilePath 'node' -ArgumentList @($scriptPath) `
  -WorkingDirectory $projectRoot -WindowStyle Hidden `
  -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
@{
  pid = $process.Id
  port = $port
  startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  stdout = $stdout
  stderr = $stderr
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

$deadline = (Get-Date).AddSeconds(10)
do {
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2
    if ($health.ok) {
      Write-Host "Ops Agent started: http://127.0.0.1:$port/"
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 250
  }
} while ((Get-Date) -lt $deadline)

throw "Ops Agent startup timed out. See $stderr"
