[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('setup', 'start', 'stop', 'restart', 'health', 'probe', 'guard', 'inventory')]
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
$lockPath = Join-Path $runtimeRoot 'lifecycle.lock'

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
  # Safe stop order: map (5122) -> char (6122) -> login (6901), so downstream
  # servers disconnect before their upstream. Any other tracked entry is
  # stopped afterwards. Each stop waits for clean exit and port release.
  $shutdownOrder = @('map', 'char', 'login')
  $entries = @($state.processes)
  $ordered = @()
  foreach ($name in $shutdownOrder) {
    $ordered += @($entries | Where-Object { $_.name -eq $name })
  }
  $ordered += @($entries | Where-Object { $_.name -notin $shutdownOrder })
  foreach ($entry in $ordered) {
    $process = Get-TrackedProcess $entry ([long]$state.startedAt)
    if ($process) {
      $helper = Join-Path $scriptRoot 'graceful-console-signal.ps1'
      if (-not (Test-Path -LiteralPath $helper)) { throw 'GRACEFUL_SHUTDOWN_HELPER_MISSING' }
      $signalOut = Join-Path $logsRoot ('graceful-signal-{0}-{1}.out.log' -f $entry.name, $process.Id)
      $signalErr = Join-Path $logsRoot ('graceful-signal-{0}-{1}.err.log' -f $entry.name, $process.Id)
      $signalArgs = @{
        FilePath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
        ArgumentList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
          ('"{0}"' -f $helper), '-TargetPid', [string]$process.Id,
          '-ExpectedPath', ('"{0}"' -f [string]$entry.path))
        WindowStyle = 'Hidden'
        RedirectStandardOutput = $signalOut
        RedirectStandardError = $signalErr
        Wait = $true
        PassThru = $true
      }
      $signal = Start-Process @signalArgs
      if ($signal.ExitCode -ne 0) {
        throw ('GRACEFUL_SHUTDOWN_SIGNAL_FAILED name={0} pid={1}' -f $entry.name, $process.Id)
      }
      $timeout = if ($entry.name -eq 'map') { 40 } else { 20 }
      $deadline = [DateTime]::UtcNow.AddSeconds($timeout)
      while ([DateTime]::UtcNow -lt $deadline) {
        if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 200
      }
      if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
        throw ('GRACEFUL_SHUTDOWN_TIMEOUT name={0} pid={1}' -f $entry.name, $process.Id)
      }
      $port = switch ($entry.name) {
        'map' { $config.MapPort }
        'char' { $config.CharacterPort }
        'login' { $config.LoginPort }
      }
      if ($port -and @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -ne 0) {
        throw ('GRACEFUL_SHUTDOWN_PORT_OCCUPIED name={0} port={1}' -f $entry.name, $port)
      }
      Write-Host ('GRACEFUL_SHUTDOWN_CONFIRMED name={0} pid={1} port={2}' -f $entry.name, $process.Id, $port)
    }
  }
  Remove-Item -LiteralPath $statePath -Force
}

# Stateless stop fallback. When state.json is absent (lost or never written),
# a canonical stop must still be possible without guessing. Identify exactly
# one listener per canonical production port, verify its image name AND its
# exact canonical ExecutablePath, then stop. Any ambiguity aborts (fail-closed).
function Get-CanonicalPortHolder {
  param([int]$Port, [string]$FileName)
  $conns = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($conns.Count -eq 0) { return [pscustomobject]@{ ok = $false; reason = 'listener_count_0' } }
  if ($conns.Count -gt 1) { return [pscustomobject]@{ ok = $false; reason = "listener_count_$($conns.Count)" } }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conns[0].OwningProcess)" -ErrorAction SilentlyContinue
  if (-not $proc) { return [pscustomobject]@{ ok = $false; reason = 'process_missing' } }
  $expected = Join-Path $rathenaRoot $FileName
  if ($proc.Name -ne $FileName) { return [pscustomobject]@{ ok = $false; reason = 'name_mismatch' } }
  if ([string]$proc.ExecutablePath -ine $expected) { return [pscustomobject]@{ ok = $false; reason = 'path_mismatch' } }
  return [pscustomobject]@{ ok = $true; pid = [int]$proc.ProcessId; name = $FileName; path = $proc.ExecutablePath; port = $Port }
}

function Stop-CanonicalPortHolders {
  $spec = @(
    @{ file = 'map-server.exe'; port = $config.MapPort },
    @{ file = 'char-server.exe'; port = $config.CharacterPort },
    @{ file = 'login-server.exe'; port = $config.LoginPort }
  )
  $targets = @()
  foreach ($s in $spec) {
    $holder = Get-CanonicalPortHolder -Port $s.port -FileName $s.file
    if ($holder.ok) { $targets += $holder }
    elseif ($holder.reason -ne 'listener_count_0') { throw "STATELESS_STOP_ABORT $($s.file) port=$($s.port) reason=$($holder.reason)" }
  }
  if ($targets.Count -eq 0) { Write-Host 'STATELESS_STOP_NO_TARGETS'; return }
  foreach ($t in $targets) {
    Write-Host "STATELESS_STOP pid=$($t.pid) name=$($t.name) port=$($t.port) path=$($t.path)"
    Stop-Process -Id $t.pid -Force
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while ([DateTime]::UtcNow -lt $deadline) {
      if (-not (Get-Process -Id $t.pid -ErrorAction SilentlyContinue)) { break }
      Start-Sleep -Milliseconds 200
    }
  }
}

# Lifecycle safety primitives (C3 / SERVER OPS CONTROL PLANE).
# Readiness deliberately mirrors Get-Probe: process + port + database signals,
# so "already running" cannot be satisfied by a half-started stack.
function Get-StackReadiness {
  $checks = [ordered]@{}
  $service = Get-Service -Name $config.MariaDbService -ErrorAction SilentlyContinue
  $checks.databaseService = [bool]($service -and $service.Status -eq 'Running')
  $checks.databasePort = Test-TcpPort $config.MariaDbPort
  $checks.loginPort = Test-TcpPort $config.LoginPort
  $checks.characterPort = Test-TcpPort $config.CharacterPort
  $checks.mapPort = Test-TcpPort $config.MapPort
  $checks.trackedProcesses = $false
  if (Test-Path $statePath) {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $tracked = @($state.processes)
    $validCount = @($tracked | Where-Object { Get-TrackedProcess $_ ([long]$state.startedAt) }).Count
    $checks.trackedProcesses = ($tracked.Count -eq 3 -and $validCount -eq 3)
  }
  $healthy = $checks.databaseService -and $checks.databasePort -and $checks.loginPort -and $checks.characterPort -and $checks.mapPort -and $checks.trackedProcesses
  return [pscustomobject]@{ checks = $checks; healthy = $healthy }
}

# Single lifecycle lock. STARTING / STOPPING / RESTARTING are mutually exclusive.
# A lock whose owner PID is dead is treated as stale and taken over.
function Enter-LifecycleLock {
  param([Parameter(Mandatory = $true)][string]$Mode)
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  if (Test-Path $lockPath) {
    $existing = $null
    try { $existing = Get-Content $lockPath -Raw | ConvertFrom-Json } catch {}
    $ownerAlive = $false
    if ($existing -and $existing.pid) {
      $ownerAlive = [bool](Get-Process -Id ([int]$existing.pid) -ErrorAction SilentlyContinue)
    }
    if ($ownerAlive) {
      Write-Host "LIFECYCLE_BUSY mode=$([string]$existing.mode) pid=$([int]$existing.pid)"
      exit 3
    }
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
  }
  [pscustomobject]@{
    mode      = $Mode
    pid       = $PID
    startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json | Set-Content -LiteralPath $lockPath -Encoding utf8
}

function Exit-LifecycleLock {
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}

# Wait until tracked state is gone and all canonical RO ports are released.
function Wait-StackStopped {
  param([int]$TimeoutSeconds = 30)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $portsFree = -not ((Test-TcpPort $config.LoginPort) -or (Test-TcpPort $config.CharacterPort) -or (Test-TcpPort $config.MapPort))
    if ((-not (Test-Path $statePath)) -and $portsFree) { return $true }
    Start-Sleep -Milliseconds 300
  } while ((Get-Date) -lt $deadline)
  $portsFree = -not ((Test-TcpPort $config.LoginPort) -or (Test-TcpPort $config.CharacterPort) -or (Test-TcpPort $config.MapPort))
  return ((-not (Test-Path $statePath)) -and $portsFree)
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

  $persistentAgentRolloutPatch = Join-Path $scriptRoot 'patches\persistent-agent-rollout.patch'
  if (-not (Test-Path $persistentAgentRolloutPatch)) { throw 'The Persistent Agent rollout patch was not found.' }
  $rolloutPatchCheck = & git -C $rathenaRoot apply --check --whitespace=nowarn $persistentAgentRolloutPatch 2>&1
  if ($LASTEXITCODE -eq 0) {
    & git -C $rathenaRoot apply --whitespace=nowarn $persistentAgentRolloutPatch
    if ($LASTEXITCODE -ne 0) { throw 'The Persistent Agent rollout patch could not be applied.' }
  } else {
    $rolloutPatchReverseCheck = & git -C $rathenaRoot apply --reverse --check --whitespace=nowarn $persistentAgentRolloutPatch 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The Persistent Agent rollout patch is neither applicable nor already applied: $rolloutPatchReverseCheck" }
  }

  $edenEquipmentPatch = Join-Path $scriptRoot 'patches\eden-equipment-no-upper-level.patch'
  if (-not (Test-Path $edenEquipmentPatch)) { throw 'The Eden equipment level-rule patch was not found.' }
  $edenPatchCheck = & git -C $rathenaRoot apply --check --whitespace=nowarn $edenEquipmentPatch 2>&1
  if ($LASTEXITCODE -eq 0) {
    & git -C $rathenaRoot apply --whitespace=nowarn $edenEquipmentPatch
    if ($LASTEXITCODE -ne 0) { throw 'The Eden equipment level-rule patch could not be applied.' }
  } else {
    $edenPatchReverseCheck = & git -C $rathenaRoot apply --reverse --check --whitespace=nowarn $edenEquipmentPatch 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The Eden equipment level-rule patch is neither applicable nor already applied: $edenPatchReverseCheck" }
  }

  $edenEquipment40Patch = Join-Path $scriptRoot 'patches\eden-equipment40-no-upper-level.patch'
  if (-not (Test-Path $edenEquipment40Patch)) { throw 'The Eden Lv.40 equipment level-rule patch was not found.' }
  $eden40PatchCheck = & git -C $rathenaRoot apply --check --whitespace=nowarn $edenEquipment40Patch 2>&1
  if ($LASTEXITCODE -eq 0) {
    & git -C $rathenaRoot apply --whitespace=nowarn $edenEquipment40Patch
    if ($LASTEXITCODE -ne 0) { throw 'The Eden Lv.40 equipment level-rule patch could not be applied.' }
  } else {
    $eden40PatchReverseCheck = & git -C $rathenaRoot apply --reverse --check --whitespace=nowarn $edenEquipment40Patch 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The Eden Lv.40 equipment level-rule patch is neither applicable nor already applied: $eden40PatchReverseCheck" }
  }

  $firstJobQuestSkillNpcPatch = Join-Path $scriptRoot 'patches\first-job-quest-skill-npc-guards.patch'
  if (-not (Test-Path $firstJobQuestSkillNpcPatch)) { throw 'The first-job Quest Skill NPC guard patch was not found.' }
  $firstJobQuestSkillNpcPatchCheck = & git -C $rathenaRoot apply --check --whitespace=nowarn $firstJobQuestSkillNpcPatch 2>&1
  if ($LASTEXITCODE -eq 0) {
    & git -C $rathenaRoot apply --whitespace=nowarn $firstJobQuestSkillNpcPatch
    if ($LASTEXITCODE -ne 0) { throw 'The first-job Quest Skill NPC guard patch could not be applied.' }
  } else {
    $firstJobQuestSkillNpcPatchReverseCheck = & git -C $rathenaRoot apply --reverse --check --whitespace=nowarn $firstJobQuestSkillNpcPatch 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The first-job Quest Skill NPC guard patch is neither applicable nor already applied: $firstJobQuestSkillNpcPatchReverseCheck" }
  }

  $allJobQuestSkillPatch = Join-Path $scriptRoot 'patches\all-job-quest-skill-autogrant.patch'
  if (-not (Test-Path $allJobQuestSkillPatch)) { throw 'The all-job Quest Skill auto-grant patch was not found.' }
  $allJobQuestSkillPatchCheck = & git -C $rathenaRoot apply --check --whitespace=nowarn $allJobQuestSkillPatch 2>&1
  if ($LASTEXITCODE -eq 0) {
    & git -C $rathenaRoot apply --whitespace=nowarn $allJobQuestSkillPatch
    if ($LASTEXITCODE -ne 0) { throw 'The all-job Quest Skill auto-grant patch could not be applied.' }
  } else {
    $allJobQuestSkillPatchReverseCheck = & git -C $rathenaRoot apply --reverse --check --whitespace=nowarn $allJobQuestSkillPatch 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The all-job Quest Skill auto-grant patch is neither applicable nor already applied: $allJobQuestSkillPatchReverseCheck" }
  }

  $requiredBinaries = @('login-server.exe', 'char-server.exe', 'map-server.exe') |
    ForEach-Object { Join-Path $rathenaRoot $_ }
  $missingBinaries = @($requiredBinaries | Where-Object { -not (Test-Path -LiteralPath $_) })
  $buildStampPath = Join-Path $rathenaRoot '.persistent-agent-build-stamp'
  $patchHash = (@($persistentAgentPatch, $persistentAgentRolloutPatch) | ForEach-Object {
      (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash.ToLowerInvariant()
    }) -join ':'
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
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_item_db.yml') (Join-Path $rathenaRoot 'db\import\item_db.yml') -Force
  Expand-Template 'openkore-servers.txt' (Join-Path $openkoreRoot 'tables\ghost-island-servers.txt') $secrets
  Copy-Item (Join-Path $scriptRoot 'templates\Headless.pm') (Join-Path $openkoreRoot 'src\Interface\Headless.pm') -Force
  $academyNpc = Join-Path $rathenaRoot 'npc\custom\terminal_academy_job_change.txt'
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_academy_job_change.txt') $academyNpc -Force
  $assassinNpc = Join-Path $rathenaRoot 'npc\custom\terminal_assassin_web.txt'
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_assassin_web.txt') $assassinNpc -Force
  $rogueNpc = Join-Path $rathenaRoot 'npc\custom\terminal_rogue_web.txt'
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_rogue_web.txt') $rogueNpc -Force
  $knightNpc = Join-Path $rathenaRoot 'npc\custom\terminal_knight_web.txt'
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_knight_web.txt') $knightNpc -Force
  $crusaderNpc = Join-Path $rathenaRoot 'npc\custom\terminal_crusader_web.txt'
  Copy-Item (Join-Path $scriptRoot 'templates\terminal_crusader_web.txt') $crusaderNpc -Force
  $customScripts = Join-Path $rathenaRoot 'npc\scripts_custom.conf'
  $academyNpcEntry = 'npc: npc/custom/terminal_academy_job_change.txt'
  if (-not (Select-String -LiteralPath $customScripts -SimpleMatch $academyNpcEntry -Quiet)) {
    Add-Content -LiteralPath $customScripts -Value "`r`n$academyNpcEntry" -Encoding utf8
  }
  $assassinNpcEntry = 'npc: npc/custom/terminal_assassin_web.txt'
  if (-not (Select-String -LiteralPath $customScripts -SimpleMatch $assassinNpcEntry -Quiet)) {
    Add-Content -LiteralPath $customScripts -Value "`r`n$assassinNpcEntry" -Encoding utf8
  }
  $rogueNpcEntry = 'npc: npc/custom/terminal_rogue_web.txt'
  if (-not (Select-String -LiteralPath $customScripts -SimpleMatch $rogueNpcEntry -Quiet)) {
    Add-Content -LiteralPath $customScripts -Value "`r`n$rogueNpcEntry" -Encoding utf8
  }
  $knightNpcEntry = 'npc: npc/custom/terminal_knight_web.txt'
  if (-not (Select-String -LiteralPath $customScripts -SimpleMatch $knightNpcEntry -Quiet)) {
    Add-Content -LiteralPath $customScripts -Value "`r`n$knightNpcEntry" -Encoding utf8
  }
  $crusaderNpcEntry = 'npc: npc/custom/terminal_crusader_web.txt'
  if (-not (Select-String -LiteralPath $customScripts -SimpleMatch $crusaderNpcEntry -Quiet)) {
    Add-Content -LiteralPath $customScripts -Value "`r`n$crusaderNpcEntry" -Encoding utf8
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
  $questRuntimeMigration = (Join-Path $scriptRoot 'sql\002-quest-runtime.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $questRuntimeMigration" $config.MainDatabase
  $persistentAgentRestartMigration = (Join-Path $scriptRoot 'sql\003-persistent-agent-restart-ownership.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $persistentAgentRestartMigration" $config.MainDatabase
  $persistentAgentRolloutMigration = (Join-Path $scriptRoot 'sql\004-persistent-agent-rollout.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $persistentAgentRolloutMigration" $config.MainDatabase
  $persistentLifeMigration = (Join-Path $scriptRoot 'sql\005-persistent-life.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $persistentLifeMigration" $config.MainDatabase
  $persistentAgentLiveStatusMigration = (Join-Path $scriptRoot 'sql\006-persistent-agent-live-status.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $persistentAgentLiveStatusMigration" $config.MainDatabase
  $m1SupplyLivePreflightMigration = (Join-Path $scriptRoot 'sql\012-m1-supply-live-preflight.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $m1SupplyLivePreflightMigration" $config.MainDatabase
  $readModelMigration = (Join-Path $scriptRoot 'sql\007-persistent-agent-read-model.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $readModelMigration" $config.MainDatabase
  $npcDialogMigration = (Join-Path $scriptRoot 'sql\008-persistent-agent-npc-dialog.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $npcDialogMigration" $config.MainDatabase
  $serviceConfigMigration = (Join-Path $scriptRoot 'sql\009-persistent-agent-service-config.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $serviceConfigMigration" $config.MainDatabase
  $opsControlPlaneMigration = (Join-Path $scriptRoot 'sql\010-ops-control-plane.sql').Replace('\', '/')
  Invoke-MariaDb $DatabaseRootPassword "source $opsControlPlaneMigration" $config.MainDatabase
  $rolloutGlobalEnabled = if ($config.PersistentAgentEnabled) { 1 } else { 0 }
  $rolloutCourseAEnabled = if ($config.PersistentAgentEdenCourseAEnabled) { 1 } else { 0 }
  Invoke-MariaDb $DatabaseRootPassword (
    "UPDATE persistent_agent_rollout_policy SET global_enabled=$rolloutGlobalEnabled," +
    "eden_course_a_enabled=$rolloutCourseAEnabled,revision=revision+1 WHERE policy_id=1; " +
    "DELETE FROM persistent_agent_rollout_allowlist WHERE course_key='eden_course_a_v1';"
  ) $config.MainDatabase
  foreach ($accountId in @($config.PersistentAgentAccountAllowlist)) {
    if ([uint32]$accountId -gt 0) {
      Invoke-MariaDb $DatabaseRootPassword "INSERT INTO persistent_agent_rollout_allowlist (account_id,char_id,course_key,enabled) VALUES ($([uint32]$accountId),0,'eden_course_a_v1',1) ON DUPLICATE KEY UPDATE enabled=1;" $config.MainDatabase
    }
  }
  foreach ($charId in @($config.PersistentAgentCharacterAllowlist)) {
    if ([uint32]$charId -gt 0) {
      Invoke-MariaDb $DatabaseRootPassword "INSERT INTO persistent_agent_rollout_allowlist (account_id,char_id,course_key,enabled) VALUES (0,$([uint32]$charId),'eden_course_a_v1',1) ON DUPLICATE KEY UPDATE enabled=1;" $config.MainDatabase
    }
  }
  $interUser = [string]$secrets.interServerUser
  $interPassword = [string]$secrets.interServerPassword
  $internalSql = "INSERT INTO login (account_id,userid,user_pass,sex,email) VALUES (1,'$interUser','$interPassword','S','server@local.invalid') " +
    "ON DUPLICATE KEY UPDATE userid=VALUES(userid),user_pass=VALUES(user_pass),sex='S';"
  Invoke-MariaDb $DatabaseRootPassword $internalSql $config.MainDatabase
  Write-Host "RO local stack setup completed. rAthena=$($config.RAthenaCommit) OpenKore=$($config.OpenKoreCommit)"
}

function Start-Stack {
  $guardOutput = & (Join-Path $scriptRoot 'runtime-guard.ps1') -Slot Production -Action Guard 2>&1
  if ($LASTEXITCODE -ne 0) { throw "SINGLE_RUNTIME_GUARD_BLOCKED: $guardOutput" }
  if (-not (Test-Path (Join-Path $rathenaRoot 'login-server.exe'))) { throw 'Run setup first.' }
  $readiness = Get-StackReadiness
  if ($readiness.healthy) {
    Write-Host 'ALREADY_RUNNING'
    return
  }
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
      $previousAgentServerCommands = $env:PERSISTENT_AGENT_SERVER_COMMANDS
      $previousAgentCharacterAllowlist = $env:PERSISTENT_AGENT_CID_ALLOWLIST
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
      $previousAgentNavigationEnabled = $env:PERSISTENT_AGENT_NAVIGATION_ENABLED
      $previousAgentNavigationMaps = $env:PERSISTENT_AGENT_NAVIGATION_MAPS
      $previousAgentNavigationRetries = $env:PERSISTENT_AGENT_NAVIGATION_MAX_RETRIES
      $previousAgentNavigationStuck = $env:PERSISTENT_AGENT_NAVIGATION_STUCK_MS
      $previousAgentNpcEnabled = $env:PERSISTENT_AGENT_NPC_ENABLED
      $previousAgentNpcMaps = $env:PERSISTENT_AGENT_NPC_MAPS
      $previousAgentNpcs = $env:PERSISTENT_AGENT_NPCS
      $previousAgentNpcTimeout = $env:PERSISTENT_AGENT_NPC_TIMEOUT_MS
      $previousAgentNpcRetries = $env:PERSISTENT_AGENT_NPC_MAX_RETRIES
      $previousAgentServiceEnabled = $env:PERSISTENT_AGENT_SERVICE_ENABLED
      $previousAgentServiceMaps = $env:PERSISTENT_AGENT_SERVICE_MAPS
      $previousAgentServiceNpcs = $env:PERSISTENT_AGENT_SERVICE_NPCS
      $previousAgentServiceItems = $env:PERSISTENT_AGENT_SERVICE_ITEMS
      $previousAgentServiceDestinations = $env:PERSISTENT_AGENT_SERVICE_DESTINATIONS
      $previousAgentServiceTimeout = $env:PERSISTENT_AGENT_SERVICE_TIMEOUT_MS
      $previousAgentServiceRetries = $env:PERSISTENT_AGENT_SERVICE_MAX_RETRIES
      $previousAgentQuestEnabled = $env:PERSISTENT_AGENT_QUEST_ENABLED
      $previousAgentQuestIds = $env:PERSISTENT_AGENT_QUEST_IDS
      $previousAgentQuestTasks = $env:PERSISTENT_AGENT_QUEST_TASKS
      $previousAgentQuestSequences = $env:PERSISTENT_AGENT_QUEST_SEQUENCES
      $previousAgentQuestRewards = $env:PERSISTENT_AGENT_QUEST_REWARD_ITEMS
      $previousAgentQuestTimeout = $env:PERSISTENT_AGENT_QUEST_TIMEOUT_MS
      $previousAgentQuestRetries = $env:PERSISTENT_AGENT_QUEST_MAX_RETRIES
      $previousAgentSupplyEnabled = $env:PERSISTENT_AGENT_SUPPLY_ENABLED
      $previousAgentSupplyItem = $env:PERSISTENT_AGENT_SUPPLY_ITEM
      $previousAgentSupplyMin = $env:PERSISTENT_AGENT_SUPPLY_MIN
      $previousAgentSupplyTarget = $env:PERSISTENT_AGENT_SUPPLY_TARGET
      $previousAgentSupplyNpc = $env:PERSISTENT_AGENT_SUPPLY_NPC
      $previousAgentSupplyGrace = $env:PERSISTENT_AGENT_SUPPLY_GRACE_MS
      $previousAgentSupplyRetries = $env:PERSISTENT_AGENT_SUPPLY_MAX_RETRIES
      $previousAgentM1SupplyEnabled = $env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED
      $previousAgentRouteDeath = $env:PERSISTENT_AGENT_ROUTE_DEATH
      $previousAgentRouteSupplyOut = $env:PERSISTENT_AGENT_ROUTE_SUPPLY_OUT
      $previousAgentRouteSupplyBack = $env:PERSISTENT_AGENT_ROUTE_SUPPLY_BACK
      $previousAgentLiveStatusEnabled = $env:PERSISTENT_AGENT_LIVE_STATUS_ENABLED
      $previousAgentLiveStatusExport = $env:PERSISTENT_AGENT_LIVE_STATUS_EXPORT_MS
      $previousAgentHuntRelocationItems = $env:PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS
      if ($server.name -eq 'map') {
        $env:PERSISTENT_AGENT_ENABLED = if ($config.PersistentAgentEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_ALLOWLIST = (@($config.PersistentAgentAccountAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SERVER_COMMANDS = (@($config.PersistentAgentServerCommandAllowlist) -join ',')
        $env:PERSISTENT_AGENT_CID_ALLOWLIST = (@($config.PersistentAgentCharacterAllowlist) -join ',')
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
        $env:PERSISTENT_AGENT_NAVIGATION_ENABLED = if ($config.PersistentAgentNavigationEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_NAVIGATION_MAPS = (@($config.PersistentAgentNavigationMapAllowlist) -join ',')
        $env:PERSISTENT_AGENT_NAVIGATION_MAX_RETRIES = [string]$config.PersistentAgentNavigationMaxRetries
        $env:PERSISTENT_AGENT_NAVIGATION_STUCK_MS = [string]$config.PersistentAgentNavigationStuckMilliseconds
        $env:PERSISTENT_AGENT_NPC_ENABLED = if ($config.PersistentAgentNpcEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_NPC_MAPS = (@($config.PersistentAgentNpcMapAllowlist) -join ',')
        $env:PERSISTENT_AGENT_NPCS = (@($config.PersistentAgentNpcAllowlist) -join ',')
        $env:PERSISTENT_AGENT_NPC_TIMEOUT_MS = [string]$config.PersistentAgentNpcTimeoutMilliseconds
        $env:PERSISTENT_AGENT_NPC_MAX_RETRIES = [string]$config.PersistentAgentNpcMaxRetries
        $env:PERSISTENT_AGENT_SERVICE_ENABLED = if ($config.PersistentAgentServiceEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_SERVICE_MAPS = (@($config.PersistentAgentServiceMapAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SERVICE_NPCS = (@($config.PersistentAgentServiceNpcAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SERVICE_ITEMS = (@($config.PersistentAgentServiceItemAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SERVICE_DESTINATIONS = (@($config.PersistentAgentServiceDestinationAllowlist) -join ',')
        $env:PERSISTENT_AGENT_SERVICE_TIMEOUT_MS = [string]$config.PersistentAgentServiceTimeoutMilliseconds
        $env:PERSISTENT_AGENT_SERVICE_MAX_RETRIES = [string]$config.PersistentAgentServiceMaxRetries
        $env:PERSISTENT_AGENT_QUEST_ENABLED = if ($config.PersistentAgentQuestEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_QUEST_IDS = (@($config.PersistentAgentQuestIdAllowlist) -join ',')
        $env:PERSISTENT_AGENT_QUEST_TASKS = (@($config.PersistentAgentQuestTaskAllowlist) -join ',')
        $env:PERSISTENT_AGENT_QUEST_SEQUENCES = (@($config.PersistentAgentQuestSequenceAllowlist) -join ',')
        $env:PERSISTENT_AGENT_QUEST_REWARD_ITEMS = (@($config.PersistentAgentQuestRewardItemAllowlist) -join ',')
        $env:PERSISTENT_AGENT_QUEST_TIMEOUT_MS = [string]$config.PersistentAgentQuestTimeoutMilliseconds
        $env:PERSISTENT_AGENT_QUEST_MAX_RETRIES = [string]$config.PersistentAgentQuestMaxRetries
        $env:PERSISTENT_AGENT_SUPPLY_ENABLED = if ($config.PersistentAgentSupplyEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_SUPPLY_ITEM = [string]$config.PersistentAgentSupplyItem
        $env:PERSISTENT_AGENT_SUPPLY_MIN = [string]$config.PersistentAgentSupplyMin
        $env:PERSISTENT_AGENT_SUPPLY_TARGET = [string]$config.PersistentAgentSupplyTarget
        $env:PERSISTENT_AGENT_SUPPLY_NPC = [string]$config.PersistentAgentSupplyNpc
        $env:PERSISTENT_AGENT_SUPPLY_GRACE_MS = [string]$config.PersistentAgentSupplyGraceMilliseconds
        $env:PERSISTENT_AGENT_SUPPLY_MAX_RETRIES = [string]$config.PersistentAgentSupplyMaxRetries
        if ($config.ContainsKey('PersistentAgentM1SupplyEnabled') -and $config.PersistentAgentM1SupplyEnabled -isnot [bool]) { throw 'PERSISTENT_AGENT_M1_SUPPLY_CONFIG_INVALID' }
        $env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED = if ($config.PersistentAgentM1SupplyEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_ROUTE_DEATH = [string]$config.PersistentAgentRouteDeath
        $env:PERSISTENT_AGENT_ROUTE_SUPPLY_OUT = [string]$config.PersistentAgentRouteSupplyOut
        $env:PERSISTENT_AGENT_ROUTE_SUPPLY_BACK = [string]$config.PersistentAgentRouteSupplyBack
        $env:PERSISTENT_AGENT_LIVE_STATUS_ENABLED = if ($config.PersistentAgentLiveStatusEnabled) { '1' } else { '0' }
        $env:PERSISTENT_AGENT_LIVE_STATUS_EXPORT_MS = [string]$config.PersistentAgentLiveStatusExportMilliseconds
        $env:PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS = (@($config.PersistentAgentHuntRelocationItems) -join ',')
      }
      try {
        $process = Start-Process -FilePath $path -WorkingDirectory $rathenaRoot -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
      } finally {
        if ($server.name -eq 'map') {
          if ($null -eq $previousAgentEnabled) { Remove-Item Env:PERSISTENT_AGENT_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ENABLED = $previousAgentEnabled }
          if ($null -eq $previousAgentAllowlist) { Remove-Item Env:PERSISTENT_AGENT_ALLOWLIST -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ALLOWLIST = $previousAgentAllowlist }
          if ($null -eq $previousAgentServerCommands) { Remove-Item Env:PERSISTENT_AGENT_SERVER_COMMANDS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVER_COMMANDS = $previousAgentServerCommands }
          if ($null -eq $previousAgentCharacterAllowlist) { Remove-Item Env:PERSISTENT_AGENT_CID_ALLOWLIST -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_CID_ALLOWLIST = $previousAgentCharacterAllowlist }
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
          if ($null -eq $previousAgentNavigationEnabled) { Remove-Item Env:PERSISTENT_AGENT_NAVIGATION_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NAVIGATION_ENABLED = $previousAgentNavigationEnabled }
          if ($null -eq $previousAgentNavigationMaps) { Remove-Item Env:PERSISTENT_AGENT_NAVIGATION_MAPS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NAVIGATION_MAPS = $previousAgentNavigationMaps }
          if ($null -eq $previousAgentNavigationRetries) { Remove-Item Env:PERSISTENT_AGENT_NAVIGATION_MAX_RETRIES -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NAVIGATION_MAX_RETRIES = $previousAgentNavigationRetries }
          if ($null -eq $previousAgentNavigationStuck) { Remove-Item Env:PERSISTENT_AGENT_NAVIGATION_STUCK_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NAVIGATION_STUCK_MS = $previousAgentNavigationStuck }
          if ($null -eq $previousAgentNpcEnabled) { Remove-Item Env:PERSISTENT_AGENT_NPC_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NPC_ENABLED = $previousAgentNpcEnabled }
          if ($null -eq $previousAgentNpcMaps) { Remove-Item Env:PERSISTENT_AGENT_NPC_MAPS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NPC_MAPS = $previousAgentNpcMaps }
          if ($null -eq $previousAgentNpcs) { Remove-Item Env:PERSISTENT_AGENT_NPCS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NPCS = $previousAgentNpcs }
          if ($null -eq $previousAgentNpcTimeout) { Remove-Item Env:PERSISTENT_AGENT_NPC_TIMEOUT_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NPC_TIMEOUT_MS = $previousAgentNpcTimeout }
          if ($null -eq $previousAgentNpcRetries) { Remove-Item Env:PERSISTENT_AGENT_NPC_MAX_RETRIES -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_NPC_MAX_RETRIES = $previousAgentNpcRetries }
          if ($null -eq $previousAgentServiceEnabled) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_ENABLED = $previousAgentServiceEnabled }
          if ($null -eq $previousAgentServiceMaps) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_MAPS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_MAPS = $previousAgentServiceMaps }
          if ($null -eq $previousAgentServiceNpcs) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_NPCS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_NPCS = $previousAgentServiceNpcs }
          if ($null -eq $previousAgentServiceItems) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_ITEMS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_ITEMS = $previousAgentServiceItems }
          if ($null -eq $previousAgentServiceDestinations) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_DESTINATIONS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_DESTINATIONS = $previousAgentServiceDestinations }
          if ($null -eq $previousAgentServiceTimeout) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_TIMEOUT_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_TIMEOUT_MS = $previousAgentServiceTimeout }
          if ($null -eq $previousAgentServiceRetries) { Remove-Item Env:PERSISTENT_AGENT_SERVICE_MAX_RETRIES -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SERVICE_MAX_RETRIES = $previousAgentServiceRetries }
          if ($null -eq $previousAgentQuestEnabled) { Remove-Item Env:PERSISTENT_AGENT_QUEST_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_ENABLED = $previousAgentQuestEnabled }
          if ($null -eq $previousAgentQuestIds) { Remove-Item Env:PERSISTENT_AGENT_QUEST_IDS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_IDS = $previousAgentQuestIds }
          if ($null -eq $previousAgentQuestTasks) { Remove-Item Env:PERSISTENT_AGENT_QUEST_TASKS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_TASKS = $previousAgentQuestTasks }
          if ($null -eq $previousAgentQuestSequences) { Remove-Item Env:PERSISTENT_AGENT_QUEST_SEQUENCES -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_SEQUENCES = $previousAgentQuestSequences }
          if ($null -eq $previousAgentQuestRewards) { Remove-Item Env:PERSISTENT_AGENT_QUEST_REWARD_ITEMS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_REWARD_ITEMS = $previousAgentQuestRewards }
          if ($null -eq $previousAgentQuestTimeout) { Remove-Item Env:PERSISTENT_AGENT_QUEST_TIMEOUT_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_TIMEOUT_MS = $previousAgentQuestTimeout }
          if ($null -eq $previousAgentQuestRetries) { Remove-Item Env:PERSISTENT_AGENT_QUEST_MAX_RETRIES -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_QUEST_MAX_RETRIES = $previousAgentQuestRetries }
          if ($null -eq $previousAgentSupplyEnabled) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_ENABLED = $previousAgentSupplyEnabled }
          if ($null -eq $previousAgentSupplyItem) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_ITEM -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_ITEM = $previousAgentSupplyItem }
          if ($null -eq $previousAgentSupplyMin) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_MIN -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_MIN = $previousAgentSupplyMin }
          if ($null -eq $previousAgentSupplyTarget) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_TARGET -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_TARGET = $previousAgentSupplyTarget }
          if ($null -eq $previousAgentSupplyNpc) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_NPC -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_NPC = $previousAgentSupplyNpc }
          if ($null -eq $previousAgentSupplyGrace) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_GRACE_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_GRACE_MS = $previousAgentSupplyGrace }
          if ($null -eq $previousAgentSupplyRetries) { Remove-Item Env:PERSISTENT_AGENT_SUPPLY_MAX_RETRIES -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_SUPPLY_MAX_RETRIES = $previousAgentSupplyRetries }
          if ($null -eq $previousAgentM1SupplyEnabled) { Remove-Item Env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED = $previousAgentM1SupplyEnabled }
          if ($null -eq $previousAgentRouteDeath) { Remove-Item Env:PERSISTENT_AGENT_ROUTE_DEATH -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ROUTE_DEATH = $previousAgentRouteDeath }
          if ($null -eq $previousAgentRouteSupplyOut) { Remove-Item Env:PERSISTENT_AGENT_ROUTE_SUPPLY_OUT -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ROUTE_SUPPLY_OUT = $previousAgentRouteSupplyOut }
          if ($null -eq $previousAgentRouteSupplyBack) { Remove-Item Env:PERSISTENT_AGENT_ROUTE_SUPPLY_BACK -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_ROUTE_SUPPLY_BACK = $previousAgentRouteSupplyBack }
          if ($null -eq $previousAgentLiveStatusEnabled) { Remove-Item Env:PERSISTENT_AGENT_LIVE_STATUS_ENABLED -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_LIVE_STATUS_ENABLED = $previousAgentLiveStatusEnabled }
          if ($null -eq $previousAgentLiveStatusExport) { Remove-Item Env:PERSISTENT_AGENT_LIVE_STATUS_EXPORT_MS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_LIVE_STATUS_EXPORT_MS = $previousAgentLiveStatusExport }
          if ($null -eq $previousAgentHuntRelocationItems) { Remove-Item Env:PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS -ErrorAction SilentlyContinue } else { $env:PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS = $previousAgentHuntRelocationItems }
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

function Get-Probe {
  $checks = [ordered]@{}
  $service = Get-Service -Name $config.MariaDbService -ErrorAction SilentlyContinue
  $checks.databaseService = [bool]($service -and $service.Status -eq 'Running')
  foreach ($pair in @(@('database', $config.MariaDbPort), @('login', $config.LoginPort), @('character', $config.CharacterPort), @('map', $config.MapPort))) {
    $checks["$($pair[0])Port"] = Test-TcpPort $pair[1]
  }
  $checks.trackedProcesses = $false
  if (Test-Path $statePath) {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $tracked = @($state.processes)
    $validCount = @($tracked | Where-Object { Get-TrackedProcess $_ ([long]$state.startedAt) }).Count
    $checks.trackedProcesses = ($tracked.Count -eq 3 -and $validCount -eq 3)
  }
  [pscustomobject]$checks | Format-List
  $healthy = $checks.databaseService -and $checks.databasePort -and $checks.loginPort -and $checks.characterPort -and $checks.mapPort -and $checks.trackedProcesses
  if (-not $healthy) { exit 1 }
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
  'start' {
    Enter-LifecycleLock 'STARTING'
    try { Start-Stack } finally { Exit-LifecycleLock }
  }
  'stop' {
    Enter-LifecycleLock 'STOPPING'
    try {
      if (-not (Test-Path $statePath)) {
        Write-Host 'STATE_JSON_ABSENT using stateless canonical-port discovery.'
        Stop-CanonicalPortHolders
        if (-not (Wait-StackStopped)) { Write-Host 'STOP_FAILED reason=stop_timeout'; exit 1 }
      } else {
        Stop-TrackedProcesses
        if (-not (Wait-StackStopped)) { Write-Host 'STOP_FAILED reason=stop_timeout'; exit 1 }
        if ($StopDatabase) {
          $service = Get-Service -Name $config.MariaDbService -ErrorAction SilentlyContinue
          if ($service -and $service.Status -ne 'Stopped') { Stop-Service $config.MariaDbService }
        }
      }
      Write-Host 'STOPPED'
      # Canonical RO game services only. MariaDB and the Dashboard control plane
      # are intentionally preserved so the Web Admin does not stop itself.
      Write-Host 'RO game services stopped. MariaDB remains available unless -StopDatabase is supplied.'
    } finally { Exit-LifecycleLock }
  }
  'restart' {
    Enter-LifecycleLock 'RESTARTING'
    try {
      if (Test-Path $statePath) {
        Stop-TrackedProcesses
        if (-not (Wait-StackStopped)) { Write-Host 'RESTART_FAILED reason=stop_timeout'; exit 1 }
      }
      Start-Stack
      if ((Get-StackReadiness).healthy) {
        Write-Host 'RESTART_SUCCESS'
      } else {
        Write-Host 'RESTART_FAILED reason=health_gate'
        exit 1
      }
    } finally { Exit-LifecycleLock }
  }
  'health' { Get-Health }
  'probe' { Get-Probe }
  'guard' { & (Join-Path $scriptRoot 'runtime-guard.ps1') -Slot Production -Action Guard; exit $LASTEXITCODE }
  'inventory' { & (Join-Path $scriptRoot 'runtime-guard.ps1') -Slot Production -Action Inventory; exit $LASTEXITCODE }
}
