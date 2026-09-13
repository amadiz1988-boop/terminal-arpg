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
$statePath = Join-Path $runtime 'tunnel-state.json'
$configPath = Join-Path $runtime 'tunnel-config.json'
$port = 8788
$startMutexName = 'Global\TerminalARPGPlayerWebTunnelStart'

function Get-TunnelConfig {
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return $null }
  try {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (
      $config.mode -eq 'named' -and
      -not [string]::IsNullOrWhiteSpace([string]$config.tunnelId) -and
      -not [string]::IsNullOrWhiteSpace([string]$config.credentialsFile) -and
      -not [string]::IsNullOrWhiteSpace([string]$config.publicUrl) -and
      (Test-Path -LiteralPath ([string]$config.credentialsFile) -PathType Leaf)
    ) { return $config }
  } catch {}
  return $null
}

function Get-TunnelProcess {
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { return $null }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
    if (
      $process -and
      $process.Name -eq 'cloudflared.exe' -and
      $process.CommandLine -like "*127.0.0.1:$port*" -and
      $process.CommandLine -like "*$($state.tunnelId)*"
    ) { return $process }
  } catch {}
  return $null
}

function Test-PublicHealth([string]$PublicUrl) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($PublicUrl.TrimEnd('/') + '/api/health') -TimeoutSec 8
    return $response.StatusCode -eq 200 -and $response.Content -match '"ok"\s*:\s*true'
  } catch { return $false }
}

if ($Action -eq 'stop') {
  $process = Get-TunnelProcess
  if ($process) { Stop-Process -Id $process.ProcessId -Force }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'PLAYER_WEB_TUNNEL_STOPPED'
  exit 0
}

if ($Action -eq 'health') {
  $process = Get-TunnelProcess
  if (-not $process) { Write-Host 'PLAYER_WEB_TUNNEL_OFFLINE'; exit 1 }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if (-not (Test-PublicHealth ([string]$state.publicUrl))) {
    Write-Host "PLAYER_WEB_TUNNEL_UNREACHABLE $($state.publicUrl)"
    exit 1
  }
  Write-Host "PLAYER_WEB_TUNNEL_HEALTHY $($state.publicUrl)"
  exit 0
}

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$startMutex = [Threading.Mutex]::new($false, $startMutexName)
$lockAcquired = $false
try {
  try {
    $lockAcquired = $startMutex.WaitOne([TimeSpan]::FromSeconds(55))
  } catch [Threading.AbandonedMutexException] {
    $lockAcquired = $true
  }
  if (-not $lockAcquired) { throw 'Player web tunnel start lock timed out.' }

  $config = Get-TunnelConfig
  if (-not $config) { throw "Named player web tunnel config is invalid: $configPath" }
  $existing = Get-TunnelProcess
  if ($existing) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if (Test-PublicHealth ([string]$state.publicUrl)) { Write-Host $state.publicUrl; exit 0 }
    Write-Host "PLAYER_WEB_TUNNEL_DEGRADED $($state.publicUrl)"
    exit 1
  }

  $cloudflared = if ($env:PLAYER_WEB_CLOUDFLARED_PATH -and (Test-Path -LiteralPath $env:PLAYER_WEB_CLOUDFLARED_PATH -PathType Leaf)) {
    (Resolve-Path -LiteralPath $env:PLAYER_WEB_CLOUDFLARED_PATH).Path
  } else {
    (Get-Command cloudflared -ErrorAction Stop).Source
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdout = Join-Path $runtime "$stamp-player-tunnel.out.log"
  $stderr = Join-Path $runtime "$stamp-player-tunnel.err.log"
  $publicUrl = ([string]$config.publicUrl).TrimEnd('/')
  $tunnelId = [string]$config.tunnelId
  $arguments = @(
    'tunnel', '--no-autoupdate', 'run',
    '--credentials-file', ([string]$config.credentialsFile),
    '--url', "http://127.0.0.1:$port",
    $tunnelId
  )
  $process = Start-Process -FilePath $cloudflared -ArgumentList $arguments `
    -WorkingDirectory $projectRoot -WindowStyle Hidden `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  $deadline = (Get-Date).AddSeconds(45)
  do {
    if (Test-PublicHealth $publicUrl) { break }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  if (-not (Test-PublicHealth $publicUrl)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Player web tunnel startup timed out. See $stderr"
  }
  @{
    pid = $process.Id
    startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    mode = 'named'
    tunnelId = $tunnelId
    publicUrl = $publicUrl
    stdout = $stdout
    stderr = $stderr
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  Write-Host $publicUrl
} finally {
  if ($lockAcquired) { $startMutex.ReleaseMutex() }
  $startMutex.Dispose()
}
