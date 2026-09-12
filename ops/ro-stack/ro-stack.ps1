[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('setup', 'start', 'stop', 'health')]
  [string]$Action,
  [string]$DatabaseRootPassword = $env:RO_DB_ROOT_PASSWORD,
  [switch]$StopDatabase
)

$ErrorActionPreference = 'Stop'
$scriptRoot = $PSScriptRoot
$projectRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
$config = Invoke-Expression (Get-Content (Join-Path $scriptRoot 'stack.config.psd1') -Raw)
$runtimeRoot = Join-Path $projectRoot '.local\ro-stack'
$rathenaRoot = Join-Path $runtimeRoot 'rathena'
$openkoreRoot = Join-Path $runtimeRoot 'openkore'
$logsRoot = Join-Path $runtimeRoot 'logs'
$statePath = Join-Path $runtimeRoot 'state.json'
$secretsPath = Join-Path $runtimeRoot 'secrets.json'

function Find-MariaDbClient {
  $candidate = Get-ChildItem 'C:\Program Files\MariaDB *\bin\mariadb.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $candidate) { throw 'MariaDB Client was not found. Install MariaDB Server first.' }
  return $candidate
}

function Find-MSBuild {
  $vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path $vswhere)) { throw 'Visual Studio Build Tools was not found.' }
  $candidate = & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe' |
    Select-Object -First 1
  if (-not $candidate) { throw 'MSBuild is missing from Visual Studio Build Tools.' }
  return $candidate
}

function New-RandomSecret {
  param([int]$ByteCount = 24)
  $bytes = New-Object byte[] $ByteCount
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Get-Secrets {
  if (-not (Test-Path $secretsPath)) { throw 'Run setup first. Local secrets were not found.' }
  return Get-Content $secretsPath -Raw | ConvertFrom-Json
}

function Invoke-MariaDb {
  param(
    [Parameter(Mandatory = $true)][string]$Password,
    [Parameter(Mandatory = $true)][string]$Sql,
    [string]$Database
  )
  $client = Find-MariaDbClient
  $previousPassword = $env:MYSQL_PWD
  $env:MYSQL_PWD = $Password
  try {
    $arguments = @('--ssl=OFF', '--protocol=tcp', '-h', '127.0.0.1', '-P', [string]$config.MariaDbPort, '-u', 'root', '-N', '-e', $Sql)
    if ($Database) { $arguments = @('--ssl=OFF', '--protocol=tcp', '-h', '127.0.0.1', '-P', [string]$config.MariaDbPort, '-u', 'root', '-N', $Database, '-e', $Sql) }
    & $client @arguments
    if ($LASTEXITCODE -ne 0) { throw "MariaDB command failed with exit code $LASTEXITCODE." }
  } finally {
    $env:MYSQL_PWD = $previousPassword
  }
}

function Checkout-PinnedRepository {
  param([string]$Url, [string]$Commit, [string]$Destination)
  if (Test-Path (Join-Path $Destination '.git')) {
    $currentCommit = git -C $Destination rev-parse HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and ([string]$currentCommit).Trim() -eq $Commit) { return }
  }
  if (-not (Test-Path (Join-Path $Destination '.git'))) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    git -C $Destination init --quiet
    git -C $Destination remote add origin $Url
  }
  git -C $Destination fetch --depth 1 origin $Commit
  if ($LASTEXITCODE -ne 0) { throw "Could not fetch pinned commit $Commit." }
  git -C $Destination checkout --force --detach $Commit
  if ($LASTEXITCODE -ne 0) { throw "Could not check out pinned commit $Commit." }
}

function Expand-Template {
  param([string]$TemplateName, [string]$Destination, [object]$Secrets)
  $content = Get-Content (Join-Path $scriptRoot "templates\$TemplateName") -Raw
  $content = $content.Replace('{{DB_PORT}}', [string]$config.MariaDbPort)
  $content = $content.Replace('{{LOGIN_PORT}}', [string]$config.LoginPort)
  $content = $content.Replace('{{CHARACTER_PORT}}', [string]$config.CharacterPort)
  $content = $content.Replace('{{MAP_PORT}}', [string]$config.MapPort)
  $content = $content.Replace('{{DB_USER}}', [string]$config.DatabaseUser)
  $content = $content.Replace('{{DB_PASSWORD}}', [string]$Secrets.databasePassword)
  $content = $content.Replace('{{MAIN_DATABASE}}', [string]$config.MainDatabase)
  $content = $content.Replace('{{LOG_DATABASE}}', [string]$config.LogDatabase)
  $content = $content.Replace('{{INTER_USER}}', [string]$Secrets.interServerUser)
  $content = $content.Replace('{{INTER_PASSWORD}}', [string]$Secrets.interServerPassword)
  [IO.File]::WriteAllText($Destination, $content, [Text.UTF8Encoding]::new($false))
}

function Wait-LogText {
  param([string]$Path, [string]$Text, [int]$Seconds = 45)
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ((Test-Path $Path) -and (Select-String -Path $Path -SimpleMatch $Text -Quiet)) { return }
    Start-Sleep -Milliseconds 500
  }
  throw "Service startup timed out: $Text"
}

function Test-TcpPort {
  param([int]$Port, [int]$TimeoutMilliseconds = 1000)
  $client = New-Object Net.Sockets.TcpClient
  try {
    $connect = $client.ConnectAsync('127.0.0.1', $Port)
    return ($connect.Wait($TimeoutMilliseconds) -and $client.Connected)
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-TrackedProcess {
  param([object]$Entry, [long]$StartedAt = 0)
  if (-not ([string]$Entry.path).StartsWith($runtimeRoot, [StringComparison]::OrdinalIgnoreCase)) { return $null }
  if (-not (Test-Path -LiteralPath ([string]$Entry.path))) { return $null }
  $process = Get-Process -Id ([int]$Entry.id) -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  $expectedName = [IO.Path]::GetFileNameWithoutExtension([string]$Entry.path)
  if ($process.ProcessName -ne $expectedName) { return $null }
  if ($StartedAt -gt 0) {
    $processStartedAt = ([DateTimeOffset]$process.StartTime).ToUnixTimeMilliseconds()
    if ($processStartedAt -lt ($StartedAt - 10000)) { return $null }
  }
  return $process
}

function Stop-TrackedProcesses {
  if (-not (Test-Path $statePath)) { return }
  $state = Get-Content $statePath -Raw | ConvertFrom-Json
  foreach ($entry in @($state.processes)) {
    $process = Get-TrackedProcess $entry ([long]$state.startedAt)
    if ($process) { Stop-Process -Id $process.Id -Force }
  }
  Remove-Item -LiteralPath $statePath -Force
}

function Setup-Stack {
  if ([string]::IsNullOrWhiteSpace($DatabaseRootPassword)) {
    throw 'Set RO_DB_ROOT_PASSWORD before running setup.'
  }
  $service = Get-Service -Name $config.MariaDbService -ErrorAction SilentlyContinue
  if (-not $service) { throw "Dedicated MariaDB service $($config.MariaDbService) was not found." }
  if ($service.Status -ne 'Running') { Start-Service $config.MariaDbService }
  New-Item -ItemType Directory -Force -Path $runtimeRoot, $logsRoot | Out-Null

  Checkout-PinnedRepository $config.RAthenaRepository $config.RAthenaCommit $rathenaRoot
  Checkout-PinnedRepository $config.OpenKoreRepository $config.OpenKoreCommit $openkoreRoot

  $persistentAgentPatch = Join-Path $scriptRoot 'patches\persistent-agent.patch'
  if (-not (Test-Path $persistentAgentPatch)) { throw 'The Persistent Agent source patch was not found.' }
  if (Select-String -LiteralPath (Join-Path $rathenaRoot 'src\map\pc.hpp') -SimpleMatch 'server_ai' -Quiet) {
    throw 'Legacy server-ai-mvp patch detected. Restore the managed rAthena checkout to the pinned commit, then rerun setup.'
  }
  $patchCheck = & git -C $rathenaRoot apply --check --whitespace=nowarn $persistentAgentPatch 2>&1
  $patchCheckExit = $LASTEXITCODE
  if ($patchCheckExit -eq 0) {
    & git -C $rathenaRoot apply --whitespace=nowarn $persistentAgentPatch
    if ($LASTEXITCODE -ne 0) { throw 'The Persistent Agent source patch could not be applied.' }
  } else {
    $reverseCheck = & git -C $rathenaRoot apply --reverse --check --whitespace=nowarn $persistentAgentPatch 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The Persistent Agent source patch is neither applicable nor already applied: $reverseCheck" }
  }

  $requiredBinaries = @('login-server.exe', 'char-server.exe', 'map-server.exe') |
    ForEach-Object { Join-Path $rathenaRoot $_ }
  $missingBinaries = @($requiredBinaries | Where-Object { -not (Test-Path -LiteralPath $_) })
  $buildStampPath = Join-Path $rathenaRoot '.persistent-agent-build-stamp'
  $patchHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $persistentAgentPatch).Hash.ToLowerInvariant()
  $expectedBuildStamp = "$($config.RAthenaCommit):$patchHash"
  $actualBuildStamp = if (Test-Path $buildStampPath) { (Get-Content -LiteralPath $buildStampPath -Raw).Trim() } else { '' }
  if ($missingBinaries.Count -gt 0 -or $actualBuildStamp -ne $expectedBuildStamp) {
    $msbuild = Find-MSBuild
    & $msbuild (Join-Path $rathenaRoot 'rAthena.sln') /m /t:Build /p:Configuration=Release /p:Platform=x64 /v:minimal /nologo
    if ($LASTEXITCODE -ne 0) { throw 'rAthena build failed.' }
    [IO.File]::WriteAllText($buildStampPath, $expectedBuildStamp, [Text.UTF8Encoding]::new($false))
  }

  $secrets = if (Test-Path $secretsPath) {
    Get-Secrets
  } else {
    [pscustomobject]@{
      databasePassword = New-RandomSecret
      interServerUser = 'ghost_island_internal'
      interServerPassword = New-RandomSecret 11
    }
  }
  if ([string]$secrets.interServerPassword -notmatch '^[0-9a-f]{22}$') {
    $secrets.interServerPassword = New-RandomSecret 11
  }
  $secrets | ConvertTo-Json | ForEach-Object { [IO.File]::WriteAllText($secretsPath, $_, [Text.UTF8Encoding]::new($false)) }

  $importRoot = Join-Path $rathenaRoot 'conf\import'
  Expand-Template 'inter_conf.txt' (Join-Path $importRoot 'inter_conf.txt') $secrets
  Expand-Template 'login_conf.txt' (Join-Path $importRoot 'login_conf.txt') $secrets
  Expand-Template 'char_conf.txt' (Join-Path $importRoot 'char_conf.txt') $secrets
  Expand-Template 'map_conf.txt' (Join-Path $importRoot 'map_conf.txt') $secrets
  Expand-Template 'packet_conf.txt' (Join-Path $importRoot 'packet_conf.txt') $secrets
  Expand-Template 'battle_conf.txt' (Join-Path $importRoot 'battle_conf.txt') $secrets
  Copy-Item (Join-Path $scriptRoot 'templates\player-groups.yml') (Join-Path $importRoot 'groups.yml') -Force
  Expand-Template 'openkore-servers.txt' (Join-Path $openkoreRoot 'tables\ghost-island-servers.txt') $secrets
  Copy-Item (Join-Path $scriptRoot 'templates\Headless.pm') (Join-Path $openkoreRoot 'src\Interface\Headless.pm') -Force
  $academyNpc = Join-Path $rathenaRoot 'npc\custom\terminal_academy_job_change.txt'
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_academy_job_change.txt') $academyNpc -Force
  $customScripts = Join-Path $rathenaRoot 'npc\scripts_custom.conf'
  $academyNpcEntry = 'npc: npc/custom/terminal_academy_job_change.txt'
  if (-not (Select-String -LiteralPath $customScripts -SimpleMatch $academyNpcEntry -Quiet)) {
    Add-Content -LiteralPath $customScripts -Value "`r`n$academyNpcEntry" -Encoding utf8
  }
  $dbPassword = [string]$secrets.databasePassword
  $createSql = "CREATE DATABASE IF NOT EXISTS $($config.MainDatabase) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; " +
    "CREATE DATABASE IF NOT EXISTS $($config.LogDatabase) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; " +
    "CREATE USER IF NOT EXISTS '$($config.DatabaseUser)'@'127.0.0.1' IDENTIFIED BY '$dbPassword'; " +
    "ALTER USER '$($config.DatabaseUser)'@'127.0.0.1' IDENTIFIED BY '$dbPassword'; " +
    "GRANT ALL PRIVILEGES ON $($config.MainDatabase).* TO '$($config.DatabaseUser)'@'127.0.0.1'; " +
    "GRANT ALL PRIVILEGES ON $($config.LogDatabase).* TO '$($config.DatabaseUser)'@'127.0.0.1'; FLUSH PRIVILEGES;"
  Invoke-MariaDb $DatabaseRootPassword $createSql

  $mainTables = Invoke-MariaDb $DatabaseRootPassword "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$($config.MainDatabase)';"
  if ([int]$mainTables -eq 0) {
    $sqlRoot = (Join-Path $rathenaRoot 'sql-files').Replace('\', '/')
    Invoke-MariaDb $DatabaseRootPassword "source $sqlRoot/main.sql" $config.MainDatabase
    Invoke-MariaDb $DatabaseRootPassword "source $sqlRoot/web.sql" $config.MainDatabase
    Invoke-MariaDb $DatabaseRootPassword "source $sqlRoot/roulette_default_data.sql" $config.MainDatabase
    Invoke-MariaDb $DatabaseRootPassword "source $sqlRoot/logs.sql" $config.LogDatabase
  }
  $persistentAgentMigration = (Join-Path $scriptRoot 'sql\001-persistent-agent.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $persistentAgentMigration" $config.MainDatabase
  $interUser = [string]$secrets.interServerUser
  $interPassword = [string]$secrets.interServerPassword
  $internalSql = "INSERT INTO login (account_id,userid,user_pass,sex,email) VALUES (1,'$interUser','$interPassword','S','server@local.invalid') " +
    "ON DUPLICATE KEY UPDATE userid=VALUES(userid),user_pass=VALUES(user_pass),sex='S';"
  Invoke-MariaDb $DatabaseRootPassword $internalSql $config.MainDatabase
  Write-Host "RO local stack setup completed. rAthena=$($config.RAthenaCommit) OpenKore=$($config.OpenKoreCommit)"
}

function Start-Stack {
  if (-not (Test-Path (Join-Path $rathenaRoot 'login-server.exe'))) { throw 'Run setup first.' }
  if (Test-Path $statePath) { throw 'A runtime state already exists. Run health or stop first.' }
  $service = Get-Service -Name $config.MariaDbService
  if ($service.Status -ne 'Running') { Start-Service $config.MariaDbService }
  New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $processes = @()
  try {
    foreach ($server in @(
      @{ name='login'; file='login-server.exe'; delay=2 },
      @{ name='char'; file='char-server.exe'; delay=3 },
      @{ name='map'; file='map-server.exe'; delay=0 }
    )) {
      $path = Join-Path $rathenaRoot $server.file
      $out = Join-Path $logsRoot "$stamp-$($server.name).out.log"
      $err = Join-Path $logsRoot "$stamp-$($server.name).err.log"
      $previousAgentEnabled = $env:PERSISTENT_AGENT_ENABLED
      $previousAgentAllowlist = $env:PERSISTENT_AGENT_ALLOWLIST
      $previousAgentPoll = $env:PERSISTENT_AGENT_POLL_MS
      $previousAgentFarmMaps = $env:PERSISTENT_AGENT_FARM_MAPS
      $previousAgentFarmMobs = $env:PERSISTENT_AGENT_FARM_MOBS
      $previousAgentLootEnabled = $env:PERSISTENT_AGENT_LOOT_ENABLED
      $previousAgentSkillEnabled = $env:PERSISTENT_AGENT_SKILL_ENABLED
      $previousAgentSkills = $env:PERSISTENT_AGENT_SKILLS
      $previousAgentSurvivalEnabled = $env:PERSISTENT_AGENT_SURVIVAL_ENABLED
      $previousAgentHpThreshold = $env:PERSISTENT_AGENT_HP_THRESHOLD_PCT
      $previousAgentHpSafe = $env:PERSISTENT_AGENT_HP_SAFE_PCT
      $previousAgentSpThreshold = $env:PERSISTENT_AGENT_SP_THRESHOLD_PCT
      $previousAgentSpSafe = $env:PERSISTENT_AGENT_SP_SAFE_PCT
      $previousAgentHpItems = $env:PERSISTENT_AGENT_HP_ITEMS
      $previousAgentSpItems = $env:PERSISTENT_AGENT_SP_ITEMS
      $previousAgentRecoverySkills = $env:PERSISTENT_AGENT_RECOVERY_SKILLS
      $previousAgentDeathRecoveryEnabled = $env:PERSISTENT_AGENT_DEATH_RECOVERY_ENABLED
      $previousAgentRespawnDelay = $env:PERSISTENT_AGENT_RESPAWN_DELAY_MS
      $previousAgentRespawnAttempts = $env:PERSISTENT_AGENT_RESPAWN_MAX_ATTEMPTS
      if ($server.name -eq 'map') {
        $env:PERSISTENT_AGENT_ENABLED = if ($config.PersistentAgentEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_ALLOWLIST = (@($config.PersistentAgentAccountAllowlist) -join ',')
        $env:PERSISTENT_AGENT_POLL_MS = [string]$config.PersistentAgentPollMilliseconds
        $env:PERSISTENT_AGENT_FARM_MAPS = (@($config.PersistentAgentFarmMapAllowlist) -join ',')
        $env:PERSISTENT_AGENT_FARM_MOBS = (@($config.PersistentAgentFarmMobAllowlist) -join ',')
        $env:PERSISTENT_AGENT_LOOT_ENABLED = if ($config.PersistentAgentLootEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_SKILL_ENABLED = if ($config.PersistentAgentSkillEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_SKILLS = (@($config.PersistentAgentSkillAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SURVIVAL_ENABLED = if ($config.PersistentAgentSurvivalEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_HP_THRESHOLD_PCT = [string]$config.PersistentAgentHpThresholdPercent
        $env:PERSISTENT_AGENT_HP_SAFE_PCT = [string]$config.PersistentAgentHpSafePercent
        $env:PERSISTENT_AGENT_SP_THRESHOLD_PCT = [string]$config.PersistentAgentSpThresholdPercent
        $env:PERSISTENT_AGENT_SP_SAFE_PCT = [string]$config.PersistentAgentSpSafePercent
        $env:PERSISTENT_AGENT_HP_ITEMS = (@($config.PersistentAgentHpItemAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SP_ITEMS = (@($config.PersistentAgentSpItemAllowlist) -join ',')
        $env:PERSISTENT_AGENT_RECOVERY_SKILLS = (@($config.PersistentAgentRecoverySkillAllowlist) -join ',')
        $env:PERSISTENT_AGENT_DEATH_RECOVERY_ENABLED = if ($config.PersistentAgentDeathRecoveryEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_RESPAWN_DELAY_MS = [string]$config.PersistentAgentRespawnDelayMilliseconds
        $env:PERSISTENT_AGENT_RESPAWN_MAX_ATTEMPTS = [string]$config.PersistentAgentRespawnMaxAttempts
      }
      try {
        $process = Start-Process -FilePath $path -WorkingDirectory $rathenaRoot -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
      } finally {
        if ($server.name -eq 'map') {
          if ($null -eq $previousAgentEnabled) { Remove-Item Env:PERSISTENT_AGENT_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ENABLED = $previousAgentEnabled }
          if ($null -eq $previousAgentAllowlist) { Remove-Item Env:PERSISTENT_AGENT_ALLOWLIST -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ALLOWLIST = $previousAgentAllowlist }
          if ($null -eq $previousAgentPoll) { Remove-Item Env:PERSISTENT_AGENT_POLL_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_POLL_MS = $previousAgentPoll }
          if ($null -eq $previousAgentFarmMaps) { Remove-Item Env:PERSISTENT_AGENT_FARM_MAPS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_FARM_MAPS = $previousAgentFarmMaps }
          if ($null -eq $previousAgentFarmMobs) { Remove-Item Env:PERSISTENT_AGENT_FARM_MOBS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_FARM_MOBS = $previousAgentFarmMobs }
          if ($null -eq $previousAgentLootEnabled) { Remove-Item Env:PERSISTENT_AGENT_LOOT_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_LOOT_ENABLED = $previousAgentLootEnabled }
          if ($null -eq $previousAgentSkillEnabled) { Remove-Item Env:PERSISTENT_AGENT_SKILL_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SKILL_ENABLED = $previousAgentSkillEnabled }
          if ($null -eq $previousAgentSkills) { Remove-Item Env:PERSISTENT_AGENT_SKILLS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SKILLS = $previousAgentSkills }
          if ($null -eq $previousAgentSurvivalEnabled) { Remove-Item Env:PERSISTENT_AGENT_SURVIVAL_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SURVIVAL_ENABLED = $previousAgentSurvivalEnabled }
          if ($null -eq $previousAgentHpThreshold) { Remove-Item Env:PERSISTENT_AGENT_HP_THRESHOLD_PCT -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_HP_THRESHOLD_PCT = $previousAgentHpThreshold }
          if ($null -eq $previousAgentHpSafe) { Remove-Item Env:PERSISTENT_AGENT_HP_SAFE_PCT -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_HP_SAFE_PCT = $previousAgentHpSafe }
          if ($null -eq $previousAgentSpThreshold) { Remove-Item Env:PERSISTENT_AGENT_SP_THRESHOLD_PCT -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SP_THRESHOLD_PCT = $previousAgentSpThreshold }
          if ($null -eq $previousAgentSpSafe) { Remove-Item Env:PERSISTENT_AGENT_SP_SAFE_PCT -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SP_SAFE_PCT = $previousAgentSpSafe }
          if ($null -eq $previousAgentHpItems) { Remove-Item Env:PERSISTENT_AGENT_HP_ITEMS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_HP_ITEMS = $previousAgentHpItems }
          if ($null -eq $previousAgentSpItems) { Remove-Item Env:PERSISTENT_AGENT_SP_ITEMS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SP_ITEMS = $previousAgentSpItems }
          if ($null -eq $previousAgentRecoverySkills) { Remove-Item Env:PERSISTENT_AGENT_RECOVERY_SKILLS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_RECOVERY_SKILLS = $previousAgentRecoverySkills }
          if ($null -eq $previousAgentDeathRecoveryEnabled) { Remove-Item Env:PERSISTENT_AGENT_DEATH_RECOVERY_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_DEATH_RECOVERY_ENABLED = $previousAgentDeathRecoveryEnabled }
          if ($null -eq $previousAgentRespawnDelay) { Remove-Item Env:PERSISTENT_AGENT_RESPAWN_DELAY_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_RESPAWN_DELAY_MS = $previousAgentRespawnDelay }
          if ($null -eq $previousAgentRespawnAttempts) { Remove-Item Env:PERSISTENT_AGENT_RESPAWN_MAX_ATTEMPTS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_RESPAWN_MAX_ATTEMPTS = $previousAgentRespawnAttempts }
        }
      }
      $processes += [pscustomobject]@{ name=$server.name; id=$process.Id; path=$path; stdout=$out; stderr=$err }
      [pscustomobject]@{ startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); processes=$processes } |
        ConvertTo-Json -Depth 4 | ForEach-Object { [IO.File]::WriteAllText($statePath, $_, [Text.UTF8Encoding]::new($false)) }
      if ($server.delay -gt 0) { Start-Sleep -Seconds $server.delay }
    }
    foreach ($entry in $processes) {
      $ready = switch ($entry.name) { login {'The login-server is ready'} char {'The char-server is ready'} map {"Server is 'ready' and listening"} }
      Wait-LogText $entry.stdout $ready
    }
    $character = $processes | Where-Object name -eq 'char'
    $map = $processes | Where-Object name -eq 'map'
    Wait-LogText $character.stdout 'Connected to login-server'
    Wait-LogText $map.stdout 'Successfully logged on to Char Server'
  } catch {
    Stop-TrackedProcesses
    throw
  }
  Write-Host "RO local services started: DB $($config.MariaDbPort), login $($config.LoginPort), character $($config.CharacterPort), map $($config.MapPort)."
}

function Get-Health {
  $checks = [ordered]@{}
  $service = Get-Service -Name $config.MariaDbService -ErrorAction SilentlyContinue
  $checks.databaseService = [bool]($service -and $service.Status -eq 'Running')
  $checks.databasePort = Test-TcpPort $config.MariaDbPort
  $databaseListeners = @(Get-NetTCPConnection -State Listen -LocalPort $config.MariaDbPort -ErrorAction SilentlyContinue)
  $checks.databaseLoopbackOnly = [bool]($databaseListeners.Count -gt 0 -and @($databaseListeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count -eq 0)
  foreach ($pair in @(@('login', $config.LoginPort), @('character', $config.CharacterPort), @('map', $config.MapPort))) {
    $checks["$($pair[0])Port"] = Test-TcpPort $pair[1]
  }
  $checks.trackedProcesses = $false
  $checks.serverLinks = $false
  if (Test-Path $statePath) {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $tracked = @($state.processes)
    $validCount = 0
    foreach ($entry in $tracked) {
      if (Get-TrackedProcess $entry ([long]$state.startedAt)) { $validCount++ }
    }
    $checks.trackedProcesses = ($tracked.Count -eq 3 -and $validCount -eq 3)
    $character = $tracked | Where-Object name -eq 'char'
    $map = $tracked | Where-Object name -eq 'map'
    $characterLinked = $character -and (Test-Path $character.stdout) -and (Select-String -LiteralPath $character.stdout -SimpleMatch 'Connected to login-server' -Quiet)
    $mapLinked = $map -and (Test-Path $map.stdout) -and (Select-String -LiteralPath $map.stdout -SimpleMatch 'Successfully logged on to Char Server' -Quiet)
    $checks.serverLinks = [bool]($characterLinked -and $mapLinked)
  }
  if ($checks.databaseService) {
    $secrets = Get-Secrets
    $client = Find-MariaDbClient
    $previousPassword = $env:MYSQL_PWD
    $env:MYSQL_PWD = [string]$secrets.databasePassword
    try {
      $tableCount = & $client --ssl=OFF --protocol=tcp -h 127.0.0.1 -P $config.MariaDbPort -u $config.DatabaseUser -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$($config.MainDatabase)';"
      $checks.mainTables = [int]$tableCount
      $logTableCount = & $client --ssl=OFF --protocol=tcp -h 127.0.0.1 -P $config.MariaDbPort -u $config.DatabaseUser -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$($config.LogDatabase)';"
      $checks.logTables = [int]$logTableCount
    } finally { $env:MYSQL_PWD = $previousPassword }
  } else {
    $checks.mainTables = 0
    $checks.logTables = 0
  }
  [pscustomobject]$checks | Format-List
  $healthy = $checks.databaseService -and $checks.databasePort -and $checks.databaseLoopbackOnly -and $checks.loginPort -and $checks.characterPort -and $checks.mapPort -and $checks.trackedProcesses -and $checks.serverLinks -and $checks.mainTables -ge 60 -and $checks.logTables -ge 10
  if (-not $healthy) { exit 1 }
}

switch ($Action) {
  'setup' { Setup-Stack }
  'start' { Start-Stack }
  'stop' {
    Stop-TrackedProcesses
    if ($StopDatabase) {
      $service = Get-Service -Name $config.MariaDbService -ErrorAction SilentlyContinue
      if ($service -and $service.Status -ne 'Stopped') { Stop-Service $config.MariaDbService }
    }
    Write-Host 'RO game services stopped. MariaDB remains available unless -StopDatabase is supplied.'
  }
  'health' { Get-Health }
}
