[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'stop', 'health')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimeRoot = if ($env:OPS_AGENT_RUNTIME_ROOT) {
  (Resolve-Path -LiteralPath $env:OPS_AGENT_RUNTIME_ROOT).Path
} else {
  Join-Path $projectRoot '.local\ro-stack'
}
$runtime = Join-Path $runtimeRoot 'ops-agent'
$statePath = Join-Path $runtime 'tunnel-state.json'
$configPath = Join-Path $runtime 'tunnel-config.json'
$startMutexName = 'Global\TerminalARPGOpsAgentTunnelStart'
$port = if ($env:OPS_AGENT_PORT) { [int]$env:OPS_AGENT_PORT } else { 8790 }

function Get-TunnelConfig {
  if (-not (Test-Path -LiteralPath $configPath)) { return $null }
  try {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (
      $config.mode -eq 'named' -and
      -not [string]::IsNullOrWhiteSpace([string]$config.tunnelId) -and
      -not [string]::IsNullOrWhiteSpace([string]$config.credentialsFile) -and
      -not [string]::IsNullOrWhiteSpace([string]$config.publicUrl) -and
      (Test-Path -LiteralPath ([string]$config.credentialsFile))
    ) { return $config }
  } catch {}
  return $null
}

function Get-TunnelProcess {
  if (-not (Test-Path -LiteralPath $statePath)) { return $null }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
    if (
      $process -and
      $process.Name -eq 'cloudflared.exe' -and
      $process.CommandLine -like "*127.0.0.1:$port*"
    ) { return $process }
  } catch {}
  return $null
}

function Test-PublicHealth {
  param([Parameter(Mandatory = $true)][string]$PublicUrl)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($PublicUrl.TrimEnd('/') + '/health') -TimeoutSec 8
    return (
      $response.StatusCode -eq 200 -and
      $response.Content -match '"ok"\s*:\s*true' -and
      $response.Content -match '"access"\s*:\s*"authenticated"'
    )
  } catch { return $false }
}

if ($Action -eq 'stop') {
  $process = Get-TunnelProcess
  if ($process) { Stop-Process -Id $process.ProcessId -Force }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'OPS_AGENT_TUNNEL_STOPPED'
  exit 0
}

if ($Action -eq 'health') {
  $process = Get-TunnelProcess
  if (-not $process) { Write-Host 'OPS_AGENT_TUNNEL_OFFLINE'; exit 1 }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if (-not (Test-PublicHealth -PublicUrl ([string]$state.publicUrl))) {
    Write-Host "OPS_AGENT_TUNNEL_UNREACHABLE $($state.publicUrl)"
    exit 1
  }
  Write-Host "OPS_AGENT_TUNNEL_HEALTHY $($state.publicUrl)"
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
  if (-not $lockAcquired) { throw 'Ops Agent tunnel start lock timed out.' }

  $config = Get-TunnelConfig
  if ((Test-Path -LiteralPath $configPath) -and -not $config) {
    throw "Named Ops Agent tunnel config is invalid: $configPath"
  }
  $existing = Get-TunnelProcess
  if ($existing) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if (Test-PublicHealth -PublicUrl ([string]$state.publicUrl)) {
      Write-Host $state.publicUrl
      exit 0
    }
    Write-Host "OPS_AGENT_TUNNEL_DEGRADED $($state.publicUrl)"
    exit 1
  }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $runtime "$stamp-admin-tunnel.out.log"
$stderr = Join-Path $runtime "$stamp-admin-tunnel.err.log"
$cloudflared = if (
  $env:OPS_AGENT_CLOUDFLARED_PATH -and
  (Test-Path -LiteralPath $env:OPS_AGENT_CLOUDFLARED_PATH -PathType Leaf)
) {
  (Resolve-Path -LiteralPath $env:OPS_AGENT_CLOUDFLARED_PATH).Path
} else {
  (Get-Command cloudflared -ErrorAction Stop).Source
}
$mode = 'quick'
if ($config) {
  $mode = 'named'
  $publicUrl = ([string]$config.publicUrl).TrimEnd('/')
  $arguments = @(
    'tunnel', '--no-autoupdate', 'run',
    '--credentials-file', ([string]$config.credentialsFile),
    '--url', "http://127.0.0.1:$port",
    ([string]$config.tunnelId)
  )
} else {
  $publicUrl = $null
  $arguments = @('tunnel', '--url', "http://127.0.0.1:$port", '--no-autoupdate')
}

$process = Start-Process -FilePath $cloudflared -ArgumentList $arguments `
  -WorkingDirectory $projectRoot -WindowStyle Hidden `
  -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) { break }
  if ($mode -eq 'named') {
    if (Test-PublicHealth -PublicUrl $publicUrl) { break }
  } else {
    $content = ((Get-Content $stdout, $stderr -Raw -ErrorAction SilentlyContinue) -join "`n")
    $match = [regex]::Match($content, 'https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) { $publicUrl = $match.Value; break }
  }
} while ((Get-Date) -lt $deadline)
if ($mode -eq 'named' -and -not (Test-PublicHealth -PublicUrl $publicUrl)) {
  $publicUrl = $null
}
if (-not $publicUrl) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "Ops Agent tunnel startup timed out. See $stderr"
}
@{
  pid = $process.Id
  startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  mode = $mode
  publicUrl = $publicUrl
  stdout = $stdout
  stderr = $stderr
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
Write-Host $publicUrl
} finally {
  if ($lockAcquired) { $startMutex.ReleaseMutex() }
  $startMutex.Dispose()
}
