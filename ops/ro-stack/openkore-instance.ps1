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

function Set-BuyAutoValue {
  param(
    [string]$Path,
    [int]$ItemId,
    [string]$Name,
    [string]$Value
  )
  $content = Get-Content -LiteralPath $Path -Raw
  $blockPattern = '(?ms)^buyAuto(?:\s+' + $ItemId + ')?\s*\{.*?^\}'
  $match = [regex]::Match($content, $blockPattern)
  if (-not $match.Success) { throw "buyAuto $ItemId block was not found." }
  $block = [regex]::Replace(
    $match.Value,
    '(?m)^buyAuto\s*\{',
    "buyAuto $ItemId {",
    1
  )
  $linePattern = '(?m)^\s*' + [regex]::Escape($Name) + '\s+.*$'
  if (-not [regex]::IsMatch($block, $linePattern)) {
    throw "buyAuto $ItemId field $Name was not found."
  }
  $indentMatch = [regex]::Match($block, $linePattern)
  $indent = [regex]::Match($indentMatch.Value, '^\s*').Value
  $block = [regex]::Replace(
    $block,
    $linePattern,
    "$indent$Name $Value",
    1
  )
  $content = $content.Substring(0, $match.Index) + $block +
    $content.Substring($match.Index + $match.Length)
  [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

function Ensure-ConfigBlock {
  param(
    [string]$Path,
    [string]$Header,
    [string[]]$Lines
  )
  $content = Get-Content -LiteralPath $Path -Raw
  $pattern = '(?m)^' + [regex]::Escape($Header) + '\s*\{'
  if ([regex]::IsMatch($content, $pattern)) { return }
  $block = @($Header + ' {') + ($Lines | ForEach-Object { "`t$_" }) + @('}')
  $content = $content.TrimEnd() + "`r`n`r`n" + ($block -join "`r`n") + "`r`n"
  [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

function Ensure-ConfigBlockBefore {
  param(
    [string]$Path,
    [string]$Header,
    [string[]]$Lines,
    [string]$BeforeHeader
  )
  $content = Get-Content -LiteralPath $Path -Raw
  $pattern = '(?m)^' + [regex]::Escape($Header) + '\s*\{'
  if ([regex]::IsMatch($content, $pattern)) { return }
  $beforePattern = '(?m)^' + [regex]::Escape($BeforeHeader) + '\s*\{'
  $beforeMatch = [regex]::Match($content, $beforePattern)
  if (-not $beforeMatch.Success) { throw "$BeforeHeader block was not found." }
  $block = @($Header + ' {') + ($Lines | ForEach-Object { "`t$_" }) + @('}')
  $content = $content.Insert($beforeMatch.Index, ($block -join "`r`n") + "`r`n`r`n")
  [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

function Set-ConfigBlockValue {
  param(
    [string]$Path,
    [string]$Header,
    [string]$Name,
    [string]$Value
  )
  $content = Get-Content -LiteralPath $Path -Raw
  $blockPattern = '(?ms)^' + [regex]::Escape($Header) + '\s*\{.*?^\}'
  $match = [regex]::Match($content, $blockPattern)
  if (-not $match.Success) { throw "$Header block was not found." }
  $linePattern = '(?m)^\s*' + [regex]::Escape($Name) + '\s+.*$'
  if (-not [regex]::IsMatch($match.Value, $linePattern)) {
    throw "$Header field $Name was not found."
  }
  $block = [regex]::Replace($match.Value, $linePattern, "`t$Name $Value", 1)
  $content = $content.Substring(0, $match.Index) + $block +
    $content.Substring($match.Index + $match.Length)
  [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

function Set-ItemsControlValue {
  param(
    [string]$Path,
    [int]$ItemId,
    [string]$Value
  )
  $content = Get-Content -LiteralPath $Path -Raw
  $pattern = '(?m)^' + $ItemId + '\s+.*$'
  if ([regex]::IsMatch($content, $pattern)) {
    $content = [regex]::Replace($content, $pattern, $Value, 1)
  } else {
    $content = $content.TrimEnd() + "`r`n$Value`r`n"
  }
  [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

function Set-CombatSupplyDefaults {
  param([string]$ControlPath)
  $configPath = Join-Path $ControlPath 'config.txt'
  Set-ConfigValue $configPath 'attackAuto' '2'
  Set-ConfigValue $configPath 'itemsTakeAuto' '2'
  Set-ConfigValue $configPath 'teleportAuto_idle' '1'
  Set-ConfigValue $configPath 'teleportAuto_useSkill' '0'
  Set-ConfigValue $configPath 'teleportAuto_item1' '601'
  Set-ConfigValue $configPath 'teleportAuto_item2' '602'
  Set-ConfigValue (Join-Path $ControlPath 'timeouts.txt') 'ai_teleport_idle' '12'
  Ensure-ConfigBlock $configPath 'useSelf_item 501' @(
    'hp < 60%',
    'inLockOnly 0',
    'notWhileSitting 1',
    'timeout 1',
    'disabled 0'
  )
  Ensure-ConfigBlockBefore $configPath 'useSelf_item 569' @(
    'hp < 60%',
    'inLockOnly 0',
    'notWhileSitting 1',
    'timeout 1',
    'disabled 0'
  ) 'useSelf_item 501'
  Set-ConfigBlockValue $configPath 'useSelf_item 569' 'inLockOnly' '0'
  Set-ConfigBlockValue $configPath 'useSelf_item 569' 'disabled' '0'
  Set-ConfigBlockValue $configPath 'useSelf_item 501' 'inLockOnly' '0'
  Ensure-ConfigBlock $configPath 'buyAuto 601' @(
    'npc prt_in 126 76',
    'npc_steps b',
    'isMarket 0',
    'distance 3',
    'price 250',
    'minAmount 5',
    'maxAmount 20',
    'batchSize 20',
    'zeny >= 250',
    'disabled 0'
  )
  Ensure-ConfigBlock $configPath 'buyAuto 602' @(
    'npc prt_in 126 76',
    'npc_steps b',
    'isMarket 0',
    'distance 3',
    'price 1000',
    'minAmount 1',
    'maxAmount 3',
    'batchSize 3',
    'zeny >= 1000',
    'disabled 0'
  )
  Set-BuyAutoValue $configPath 501 'zeny' '>= 10'
  Set-BuyAutoValue $configPath 601 'zeny' '>= 250'
  Set-BuyAutoValue $configPath 602 'zeny' '>= 1000'
  $itemsControlPath = Join-Path $ControlPath 'items_control.txt'
  Set-ItemsControlValue $itemsControlPath 501 '501 100 0 0 # Red Potion'
  Set-ItemsControlValue $itemsControlPath 601 '601 20 0 0 # Fly Wing'
  Set-ItemsControlValue $itemsControlPath 602 '602 3 0 0 # Butterfly Wing'
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

function Assert-ServerAgentOwnershipAvailable {
  $stackConfigPath = Join-Path $PSScriptRoot 'stack.config.psd1'
  $secretsPath = Join-Path $runtimeRoot 'secrets.json'
  if (-not (Test-Path $stackConfigPath) -or -not (Test-Path $secretsPath)) { return }
  $stackConfig = Import-PowerShellDataFile $stackConfigPath
  $secrets = Get-Content -LiteralPath $secretsPath -Raw | ConvertFrom-Json
  $configPath = Join-Path $controlRoot 'config.txt'
  $usernameMatch = Select-String -LiteralPath $configPath -Pattern '^username\s+(.+)$' | Select-Object -First 1
  if (-not $usernameMatch) { throw 'OpenKore username is missing.' }
  $accountName = $usernameMatch.Matches[0].Groups[1].Value.Trim().Replace("'", "''")
  $client = Get-ChildItem 'C:\Program Files\MariaDB *\bin\mariadb.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $client) { throw 'MariaDB Client was not found.' }
  $databaseHost = if ($env:RO_DB_HOST) { $env:RO_DB_HOST } else { '127.0.0.1' }
  $databasePort = if ($env:RO_DB_PORT) { [int]$env:RO_DB_PORT } else { [int]$stackConfig.MariaDbPort }
  $databaseUser = if ($env:RO_DB_USER) { $env:RO_DB_USER } else { [string]$stackConfig.DatabaseUser }
  $databaseName = if ($env:RO_DB_NAME) { $env:RO_DB_NAME } else { [string]$stackConfig.MainDatabase }
  $databasePassword = if ($env:RO_DB_PASSWORD) { $env:RO_DB_PASSWORD } else { [string]$secrets.databasePassword }
  $previousPassword = $env:MYSQL_PWD
  $env:MYSQL_PWD = $databasePassword
  try {
    $sql = "SELECT COUNT(*) FROM login l JOIN persistent_agent_state a ON a.account_id=l.account_id " +
      "WHERE l.userid='$accountName' AND (a.control_owner='SERVER_AGENT' OR a.ownership_state IN ('CLAIMING_AGENT','RELEASING_AGENT','QUARANTINED'));"
    $blocked = & $client --ssl=OFF --protocol=tcp -h $databaseHost -P $databasePort -u $databaseUser -N $databaseName -e $sql
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify character ownership.' }
    if ([int]$blocked -gt 0) { throw 'OpenKore start rejected: the account is owned or quarantined by Persistent Agent.' }
  } finally {
    if ($null -eq $previousPassword) { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue } else { $env:MYSQL_PWD = $previousPassword }
  }
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
    # The locked rAthena Renewal item database prices Red Potion (501) at 10 Zeny.
    # Supplying both fields lets OpenKore cap partial purchases and skip buyAuto
    # entirely when the character cannot afford one potion.
    Set-BuyAutoValue $configPath 501 'price' '10'
    Set-BuyAutoValue $configPath 501 'zeny' '>= 10'
    Set-CombatSupplyDefaults $controlRoot
    Set-ConfigValue (Join-Path $controlRoot 'sys.txt') 'loadPlugins' '1'
    Write-Host "OpenKore instance $InstanceId created."
  }
  'start' {
    if (Get-InstanceProcess) { throw 'OpenKore instance is already running.' }
    if (-not (Test-Path $controlRoot)) { throw 'Create the OpenKore instance first.' }
    Assert-ServerAgentOwnershipAvailable
    Set-CombatSupplyDefaults $controlRoot
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
