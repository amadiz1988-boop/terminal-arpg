[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('install', 'uninstall', 'start', 'health', 'run')]
  [string]$Action,
  [string]$ServiceProjectRoot,
  [string]$RuntimeRoot,
  [string]$CloudflaredPath,
  [string]$NodePath
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$taskName = 'Terminal ARPG Player Web Self-Heal'
$configDirectory = Join-Path $sourceRoot '.local\ro-stack\player-web-autostart'
$configPath = Join-Path $configDirectory 'config.json'
$logPath = Join-Path $configDirectory 'autostart.log'
$serviceScript = Join-Path $PSScriptRoot 'player-web-service.ps1'
$tunnelScript = Join-Path $PSScriptRoot 'player-web-tunnel.ps1'
$watchdogScript = Join-Path $PSScriptRoot 'player-web-watchdog.ps1'

function Write-AutostartLog([string]$Message) {
  New-Item -ItemType Directory -Force -Path $configDirectory | Out-Null
  if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -ge 1MB) {
    Move-Item -LiteralPath $logPath -Destination "$logPath.previous" -Force
  }
  "[$(Get-Date -Format o)] $Message" | Add-Content -LiteralPath $logPath -Encoding utf8
}

function Get-FullPath([string]$Path, [string]$Label) {
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
    throw "$Label path does not exist: $Path"
  }
  return (Resolve-Path -LiteralPath $Path).Path
}

function Get-AutostartConfig {
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Player web autostart is not configured: $configPath"
  }
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  foreach ($property in @('serviceProjectRoot', 'runtimeRoot', 'cloudflaredPath', 'nodePath')) {
    if ([string]::IsNullOrWhiteSpace([string]$config.$property)) {
      throw "Player web autostart config is missing $property"
    }
  }
  $config.serviceProjectRoot = Get-FullPath ([string]$config.serviceProjectRoot) 'Service project root'
  $config.runtimeRoot = Get-FullPath ([string]$config.runtimeRoot) 'Runtime root'
  $config.cloudflaredPath = Get-FullPath ([string]$config.cloudflaredPath) 'cloudflared'
  $config.nodePath = Get-FullPath ([string]$config.nodePath) 'node'
  return $config
}

function Set-RuntimeEnvironment($Config) {
  $env:PLAYER_WEB_PROJECT_ROOT = [string]$Config.serviceProjectRoot
  $env:PLAYER_WEB_RUNTIME_ROOT = [string]$Config.runtimeRoot
  $env:PLAYER_WEB_CLOUDFLARED_PATH = [string]$Config.cloudflaredPath
  $env:PLAYER_WEB_NODE_PATH = [string]$Config.nodePath
}

function Invoke-Component([string]$Label, [string]$Script, [string]$ComponentAction) {
  $componentOutput = & $Script $ComponentAction 2>&1
  if ($componentOutput) {
    ($componentOutput | Out-String).TrimEnd() | Add-Content -LiteralPath $logPath -Encoding utf8
  }
  if ($LASTEXITCODE -ne 0) { throw "$Label $ComponentAction failed with exit code $LASTEXITCODE" }
}

function Start-Components {
  $config = Get-AutostartConfig
  Set-RuntimeEnvironment $config
  Write-AutostartLog 'self-heal cycle started'
  Invoke-Component 'player-web-watchdog' $watchdogScript 'start'
  Invoke-Component 'player-web-service' $serviceScript 'start'
  Invoke-Component 'player-web-tunnel' $tunnelScript 'start'
  Write-AutostartLog 'self-heal cycle completed'
}

if ($Action -eq 'install') {
  $effectiveProjectRoot = if ($ServiceProjectRoot) { $ServiceProjectRoot } elseif ($env:PLAYER_WEB_PROJECT_ROOT) { $env:PLAYER_WEB_PROJECT_ROOT } else { $sourceRoot }
  $effectiveRuntimeRoot = if ($RuntimeRoot) { $RuntimeRoot } elseif ($env:PLAYER_WEB_RUNTIME_ROOT) { $env:PLAYER_WEB_RUNTIME_ROOT } else { Join-Path $effectiveProjectRoot '.local\ro-stack' }
  $effectiveCloudflared = if ($CloudflaredPath) { $CloudflaredPath } elseif ($env:PLAYER_WEB_CLOUDFLARED_PATH) { $env:PLAYER_WEB_CLOUDFLARED_PATH } else { (Get-Command cloudflared -ErrorAction Stop).Source }
  $effectiveNode = if ($NodePath) { $NodePath } elseif ($env:PLAYER_WEB_NODE_PATH) { $env:PLAYER_WEB_NODE_PATH } else { (Get-Command node -ErrorAction Stop).Source }
  $config = [ordered]@{
    version = 1
    serviceProjectRoot = Get-FullPath $effectiveProjectRoot 'Service project root'
    runtimeRoot = Get-FullPath $effectiveRuntimeRoot 'Runtime root'
    cloudflaredPath = Get-FullPath $effectiveCloudflared 'cloudflared'
    nodePath = Get-FullPath $effectiveNode 'node'
    installedAt = [DateTimeOffset]::UtcNow.ToString('o')
  }
  if (-not (Test-Path -LiteralPath (Join-Path $config.runtimeRoot 'dashboard\tunnel-config.json') -PathType Leaf)) {
    throw 'Named player web tunnel is not configured in the selected runtime root.'
  }
  New-Item -ItemType Directory -Force -Path $configDirectory | Out-Null
  $temporaryConfig = "$configPath.tmp-$PID"
  $config | ConvertTo-Json | Set-Content -LiteralPath $temporaryConfig -Encoding utf8
  Move-Item -LiteralPath $temporaryConfig -Destination $configPath -Force

  $taskArguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$PSCommandPath`" run"
  $taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArguments -WorkingDirectory $sourceRoot
  $startupTrigger = New-ScheduledTaskTrigger -AtStartup
  $recoveryTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $taskName -Action $taskAction `
    -Trigger @($startupTrigger, $recoveryTrigger) -Principal $principal `
    -Settings $settings -Description 'Keeps only the player Dashboard and play.g8land.com Cloudflare tunnel online.' `
    -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  Write-Host 'PLAYER_WEB_AUTOSTART_INSTALLED'
  exit 0
}

if ($Action -eq 'uninstall') {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'PLAYER_WEB_AUTOSTART_UNINSTALLED'
  exit 0
}

if ($Action -eq 'health') {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if (-not $task -or $task.State -eq 'Disabled') {
    Write-Host 'PLAYER_WEB_AUTOSTART_UNHEALTHY task-missing-or-disabled'
    exit 1
  }
  try {
    $config = Get-AutostartConfig
    Set-RuntimeEnvironment $config
    & $serviceScript health *> $null
    $serviceHealthy = $LASTEXITCODE -eq 0
    & $tunnelScript health *> $null
    $tunnelHealthy = $LASTEXITCODE -eq 0
    & $watchdogScript health *> $null
    $watchdogHealthy = $LASTEXITCODE -eq 0
    if ($serviceHealthy -and $tunnelHealthy -and $watchdogHealthy) {
      Write-Host 'PLAYER_WEB_AUTOSTART_HEALTHY'
      exit 0
    }
  } catch {}
  Write-Host 'PLAYER_WEB_AUTOSTART_UNHEALTHY component-offline'
  exit 1
}

if ($Action -eq 'start') {
  Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
  Write-Host 'PLAYER_WEB_AUTOSTART_TRIGGERED'
  exit 0
}

try {
  Start-Components
  exit 0
} catch {
  Write-AutostartLog "self-heal cycle failed: $($_.Exception.Message)"
  exit 1
}
