[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('create', 'start', 'stop', 'health')]
  [string]$Action,
  [string]$InstanceId = 'smoke',
  [string]$Username = $env:RO_ACCOUNT_USERNAME,
  [string]$Password = $env:RO_ACCOUNT_PASSWORD,
  [int]$CharacterSlot = 0,
  [string]$LockMap = 'prt_fild08'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimeRoot = Join-Path $projectRoot '.local\ro-stack'
$openkoreRoot = Join-Path $runtimeRoot 'openkore'
$instanceRoot = Join-Path $runtimeRoot "instances\$InstanceId"
$controlRoot = Join-Path $instanceRoot 'control'
$tablesRoot = Join-Path $instanceRoot 'tables'
$logsRoot = Join-Path $instanceRoot 'logs'
$statePath = Join-Path $instanceRoot 'state.json'

if ($InstanceId -notmatch '^[a-z0-9][a-z0-9_-]{0,31}$') { throw 'Invalid instance id.' }

function Set-ConfigValue {
  param([string]$Path, [string]$Name, [string]$Value)
  $content = Get-Content -LiteralPath $Path -Raw
  $pattern = '(?m)^' + [regex]::Escape($Name) + '\s+.*$'
  $replacement = "$Name $Value"
  if ([regex]::IsMatch($content, $pattern)) {
    $content = [regex]::Replace($content, $pattern, $replacement, 1)
  } else {
    $content += "`r`n$replacement`r`n"
  }
  [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

function Get-InstanceState {
  if (-not (Test-Path $statePath)) { return $null }
  return Get-Content $statePath -Raw | ConvertFrom-Json
}

function Get-InstanceProcess {
  $state = Get-InstanceState
  if (-not $state) { return $null }
  $process = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq 'start') { return $process }
  return $null
}

switch ($Action) {
  'create' {
    if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
      throw 'Set RO_ACCOUNT_USERNAME and RO_ACCOUNT_PASSWORD first.'
    }
    if (-not (Test-Path (Join-Path $openkoreRoot 'start.exe'))) { throw 'OpenKore runtime was not found.' }
    New-Item -ItemType Directory -Force -Path $instanceRoot, $tablesRoot, $logsRoot | Out-Null
    if (-not (Test-Path $controlRoot)) { Copy-Item (Join-Path $openkoreRoot 'control') $controlRoot -Recurse }
    Copy-Item (Join-Path $openkoreRoot 'control\routeweights.txt') (Join-Path $controlRoot 'routeweights.txt') -Force
    Copy-Item (Join-Path $openkoreRoot 'tables\ghost-island-servers.txt') (Join-Path $tablesRoot 'servers.txt') -Force
    # Remove legacy Izlude routes and keep the rAthena Renewal coordinates.
    & node (Join-Path $projectRoot 'scripts\build-openkore-renewal-portals.mjs') (Join-Path $openkoreRoot 'tables\tRO\portals.txt') (Join-Path $tablesRoot 'portals.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Failed to build Renewal portal table.' }
    Set-ConfigValue (Join-Path $tablesRoot 'servers.txt') 'serverEncoding' 'UTF-8'
    $configPath = Join-Path $controlRoot 'config.txt'
    Set-ConfigValue $configPath 'master' 'Ghost Island RO Local'
    Set-ConfigValue $configPath 'server' '0'
    Set-ConfigValue $configPath 'username' $Username
    Set-ConfigValue $configPath 'password' $Password
    Set-ConfigValue $configPath 'char' ([string]$CharacterSlot)
    Set-ConfigValue $configPath 'lockMap' $LockMap
    Set-ConfigValue $configPath 'attackAuto' '2'
    Set-ConfigValue $configPath 'route_randomWalk' '1'
    Set-ConfigValue $configPath 'itemsTakeAuto' '2'
    Set-ConfigValue (Join-Path $controlRoot 'sys.txt') 'loadPlugins' '1'
    Write-Host "OpenKore instance $InstanceId created."
  }
  'start' {
    if (Get-InstanceProcess) { throw 'OpenKore instance is already running.' }
    if (-not (Test-Path $controlRoot)) { throw 'Create the OpenKore instance first.' }
    New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
    Copy-Item (Join-Path $openkoreRoot 'tables\ghost-island-servers.txt') (Join-Path $tablesRoot 'servers.txt') -Force
    & node (Join-Path $projectRoot 'scripts\build-openkore-renewal-portals.mjs') (Join-Path $openkoreRoot 'tables\tRO\portals.txt') (Join-Path $tablesRoot 'portals.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Failed to refresh Renewal portal table.' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $stdout = Join-Path $logsRoot "$stamp.out.log"
    $stderr = Join-Path $logsRoot "$stamp.err.log"
    $tablesArgument = "$tablesRoot;$($openkoreRoot)\tables"
    $previousSnapshotPath = $env:RO_STATUS_SNAPSHOT
    $previousCommandDir = $env:RO_COMMAND_DIR
    $previousSocialLog = $env:RO_SOCIAL_LOG
    $env:RO_STATUS_SNAPSHOT = Join-Path $instanceRoot 'status.json'
    $env:RO_COMMAND_DIR = Join-Path $instanceRoot 'commands'
    $env:RO_SOCIAL_LOG = Join-Path $instanceRoot 'social.jsonl'
    New-Item -ItemType Directory -Force -Path $env:RO_COMMAND_DIR | Out-Null
    $pluginsRoot = Join-Path $projectRoot 'ops\ro-stack\openkore-plugins'
    $process = Start-Process -FilePath (Join-Path $openkoreRoot 'start.exe') -WorkingDirectory $openkoreRoot -WindowStyle Hidden -ArgumentList @("--control=$controlRoot", "--tables=$tablesArgument", "--plugins=$pluginsRoot", '--interface=Headless') -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    if ($null -eq $previousSnapshotPath) { Remove-Item Env:RO_STATUS_SNAPSHOT -ErrorAction SilentlyContinue } else { $env:RO_STATUS_SNAPSHOT = $previousSnapshotPath }
    if ($null -eq $previousCommandDir) { Remove-Item Env:RO_COMMAND_DIR -ErrorAction SilentlyContinue } else { $env:RO_COMMAND_DIR = $previousCommandDir }
    if ($null -eq $previousSocialLog) { Remove-Item Env:RO_SOCIAL_LOG -ErrorAction SilentlyContinue } else { $env:RO_SOCIAL_LOG = $previousSocialLog }
    [pscustomobject]@{ pid=$process.Id; stdout=$stdout; stderr=$stderr; startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() } |
      ConvertTo-Json | ForEach-Object { [IO.File]::WriteAllText($statePath, $_, [Text.UTF8Encoding]::new($false)) }
    Write-Host "OpenKore instance $InstanceId started."
  }
  'stop' {
    $process = Get-InstanceProcess
    if ($process) { Stop-Process -Id $process.Id -Force }
    if (Test-Path $statePath) { Remove-Item -LiteralPath $statePath -Force }
    Write-Host "OpenKore instance $InstanceId stopped."
  }
  'health' {
    $process = Get-InstanceProcess
    if (-not $process) { Write-Host 'running: False'; exit 1 }
    $state = Get-InstanceState
    $connected = (Test-Path $state.stdout) -and (Select-String -LiteralPath $state.stdout -SimpleMatch 'You are now in the game' -Quiet)
    Write-Host "running: True"
    Write-Host "mapLoaded: $connected"
    if (-not $connected) { exit 1 }
  }
}
