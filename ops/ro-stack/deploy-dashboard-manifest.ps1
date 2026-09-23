[CmdletBinding()]
param(
  [switch]$Precheck,
  [switch]$Deploy,
  [switch]$Rollback,
  [string]$Manifest,
  [Parameter(Mandatory = $true)][string]$ProductionRoot,
  [string]$ReceiptPath,
  [string]$ReceiptDirectory,
  [switch]$TestMode,
  [int]$SimulateFailureAfter = 0,
  [switch]$SimulateStartFailure,
  [switch]$SimulateDashboardDown
)

$ErrorActionPreference = 'Stop'
$canonicalProduction = 'C:\Users\Administrator\ghost-island-production\ro-stack'
$watchdogName = 'GhostIslandRO-WebInfraWatchdog'
$script:fixtureDashboardPid = 9000
$script:watchdogWasEnabled = $false
$script:watchdogChanged = $false
$script:simulatedStartFailureConsumed = $false

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Assert-WithinRoot([string]$Root, [string]$RelativePath) {
  if ($RelativePath -notmatch '^[A-Za-z0-9_./-]+$' -or
      $RelativePath -match '(^|/)\.{1,2}(/|$)' -or $RelativePath.Contains('//')) {
    throw "INVALID_MANIFEST_PATH:$RelativePath"
  }
  $webPath = $RelativePath -eq 'ops/ro-stack/dashboard.mjs' -or
    $RelativePath -match '^ops/ro-stack/dashboard/[A-Za-z0-9_./-]+\.(js|mjs|css|html|json)$' -or
    $RelativePath -match '^ops/ro-stack/web-experience/[A-Za-z0-9_./-]+\.(mjs|json)$' -or
    $RelativePath -match '^ops/ro-stack/persistent-agent/[A-Za-z0-9_-]+\.mjs$' -or
    $RelativePath -in @(
      'ops/ro-stack/persistent-agent/standard-farm-map-release-registry.json',
      'ops/ro-stack/persistent-agent/quest-content/novice-onboarding.allowlists.json',
      'ops/ro-stack/persistent-agent/quest-sequences/novice-onboarding.json'
    ) -or
    $RelativePath -match '^public/ro/data/map-info/[A-Za-z0-9_-]+\.json$' -or
    $RelativePath -eq 'public/ro/client/minimaps/manifest.json' -or
    $RelativePath -match '^public/ro/client/minimaps/[A-Za-z0-9_-]+\.png$' -or
    $RelativePath -in @('public/ro/client/floors/prontera-stone.png',
      'public/ro/client/floors/field-grass.png', 'public/ro/client/floors/morocc-sand.png') -or
    $RelativePath -in @('ops/ro-stack/support-session.mjs', 'ops/ro-stack/ops-control-plane.mjs',
      'ops/ro-stack/web-observation.mjs', 'ops/ro-stack/web-latency-trace.mjs',
      'ops/ro-stack/test-fixture-command.mjs',
      'docs/project-control/canonical-test-fixtures.json', 'public/ro/data/map-info.json')
  if (-not $webPath) { throw "UNAUTHORIZED_WEB_PATH:$RelativePath" }
  $full = [IO.Path]::GetFullPath((Join-Path $Root ($RelativePath.Replace('/', '\'))))
  $prefix = $Root.TrimEnd('\') + '\'
  if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "PATH_ESCAPES_ROOT:$RelativePath"
  }
  $part = $full
  while ($part.Length -ge $prefix.Length) {
    if (Test-Path -LiteralPath $part) {
      $item = Get-Item -LiteralPath $part -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "REPARSE_POINT_FORBIDDEN:$RelativePath"
      }
    }
    $part = Split-Path -Parent $part
  }
  return $full
}

function Read-Plan {
  if (@(@($Precheck, $Deploy, $Rollback) | Where-Object { $_ }).Count -ne 1) {
    throw 'SELECT_EXACTLY_ONE_MODE'
  }
  if ($SimulateFailureAfter -lt 0 -or ($SimulateFailureAfter -gt 0 -and (-not $TestMode -or -not $Deploy))) {
    throw 'SIMULATED_FAILURE_TEST_MODE_ONLY'
  }
  if ($SimulateDashboardDown -and (-not $TestMode -or -not $Rollback)) {
    throw 'SIMULATED_DASHBOARD_DOWN_TEST_MODE_ONLY'
  }
  if ($SimulateStartFailure -and (-not $TestMode -or -not $Deploy)) {
    throw 'SIMULATED_START_FAILURE_TEST_MODE_ONLY'
  }
  $manifestInput = if ($Rollback -and -not $Manifest -and $ReceiptPath) {
    Join-Path (Split-Path -Parent $ReceiptPath) 'manifest.json'
  } else { $Manifest }
  if (-not $manifestInput -or -not [IO.Path]::IsPathFullyQualified($manifestInput) -or
      -not (Test-Path -LiteralPath $manifestInput -PathType Leaf)) { throw 'MANIFEST_ABSOLUTE_PATH_REQUIRED' }
  $manifestPath = (Resolve-Path -LiteralPath $manifestInput).Path
  $data = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($data.candidate_commit -notmatch '^[0-9a-fA-F]{40}$' -or
      -not [IO.Path]::IsPathFullyQualified([string]$data.candidate_root) -or
      -not [IO.Path]::IsPathFullyQualified([string]$data.production_root)) {
    throw 'MANIFEST_SCHEMA_INVALID'
  }
  $production = (Resolve-Path -LiteralPath $ProductionRoot).Path
  $candidate = if ($Rollback) { [IO.Path]::GetFullPath([string]$data.candidate_root) } else {
    (Resolve-Path -LiteralPath $data.candidate_root).Path }
  if ((Get-Item -LiteralPath $production).Attributes -band [IO.FileAttributes]::ReparsePoint -or
      (-not $Rollback -and (Get-Item -LiteralPath $candidate).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'REPARSE_ROOT_FORBIDDEN'
  }
  if ($production -ine ([IO.Path]::GetFullPath([string]$data.production_root)).TrimEnd('\')) {
    throw 'MANIFEST_PRODUCTION_ROOT_MISMATCH'
  }
  if ($TestMode) {
    if ($production -ieq $canonicalProduction) { throw 'TEST_MODE_CANNOT_TARGET_PRODUCTION' }
    if (-not $production.StartsWith([IO.Path]::GetTempPath(), [StringComparison]::OrdinalIgnoreCase)) {
      throw 'TEST_MODE_TEMP_ROOT_REQUIRED'
    }
  } elseif ($production -ine $canonicalProduction) {
    throw 'PRODUCTION_ROOT_NOT_CANONICAL'
  }
  $files = @($data.files)
  if ($files.Count -lt 1 -or $files.Count -gt 256) { throw 'MANIFEST_FILE_COUNT_OUT_OF_BOUNDS' }
  $minimapPngs = @($files | Where-Object { [string]$_.path -match '^public/ro/client/minimaps/[A-Za-z0-9_-]+\.png$' })
  $minimapHashes = @{}
  if ($minimapPngs.Count -gt 0) {
    $minimapManifestPath = 'public/ro/client/minimaps/manifest.json'
    if (-not @($files | Where-Object { [string]$_.path -ceq $minimapManifestPath }).Count) {
      throw 'MINIMAP_MANIFEST_REQUIRED'
    }
    $minimapRoot = if ($Rollback) { $production } else { $candidate }
    $minimapSource = Join-Path $minimapRoot ($minimapManifestPath.Replace('/', '\'))
    if (-not (Test-Path -LiteralPath $minimapSource -PathType Leaf)) { throw 'MINIMAP_MANIFEST_MISSING' }
    $minimapData = Get-Content -LiteralPath $minimapSource -Raw | ConvertFrom-Json
    foreach ($entry in @($minimapData.entries)) {
      if ([string]$entry.availability -ne 'AVAILABLE') { continue }
      $asset = [string]$entry.webAsset
      $hash = [string]$entry.outputHash
      if ($asset -notmatch '^/ro/client/minimaps/([A-Za-z0-9_-]+\.png)\?v=[0-9a-fA-F]{16}$') {
        throw 'MINIMAP_MANIFEST_ENTRY_INVALID'
      }
      $assetPath = 'public/ro/client/minimaps/' + $Matches[1]
      if ($hash -notmatch '^[0-9a-fA-F]{64}$') { throw 'MINIMAP_MANIFEST_ENTRY_INVALID' }
      if ($minimapHashes.ContainsKey($assetPath)) { throw "MINIMAP_MANIFEST_DUPLICATE:$assetPath" }
      $minimapHashes[$assetPath] = $hash.ToUpperInvariant()
    }
  }
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $entries = @()
  foreach ($file in $files) {
    $relative = [string]$file.path
    if (-not $seen.Add($relative)) { throw "DUPLICATE_MANIFEST_PATH:$relative" }
    if ($relative -match '^public/ro/client/minimaps/[A-Za-z0-9_-]+\.png$' -and
        (-not $minimapHashes.ContainsKey($relative) -or
         $minimapHashes[$relative] -ne ([string]$file.candidate_sha256).ToUpperInvariant())) {
      throw "MINIMAP_ASSET_NOT_IN_CANONICAL_MANIFEST:$relative"
    }
    $preimageAbsent = [string]$file.production_preimage -ceq 'ABSENT'
    if ([string]$file.candidate_sha256 -notmatch '^[0-9a-fA-F]{64}$' -or
        (-not $preimageAbsent -and [string]$file.production_preimage_sha256 -notmatch '^[0-9a-fA-F]{64}$') -or
        ($preimageAbsent -and $file.production_preimage_sha256)) {
      throw "MANIFEST_HASH_INVALID:$relative"
    }
    $source = if ($Rollback) { $null } else { Assert-WithinRoot -Root $candidate -RelativePath $relative }
    $target = Assert-WithinRoot -Root $production -RelativePath $relative
    if ((-not $Rollback -and -not (Test-Path -LiteralPath $source -PathType Leaf)) -or
        (-not $preimageAbsent -and -not (Test-Path -LiteralPath (Split-Path -Parent $target) -PathType Container)) -or
        ($Rollback -and -not (Test-Path -LiteralPath $target -PathType Leaf)) -or
        (-not $Rollback -and -not $preimageAbsent -and -not (Test-Path -LiteralPath $target -PathType Leaf))) {
      throw "MANIFEST_FILE_MISSING:$relative"
    }
    $candidateHash = ([string]$file.candidate_sha256).ToUpperInvariant()
    $preimageHash = if ($preimageAbsent) { 'ABSENT' } else { ([string]$file.production_preimage_sha256).ToUpperInvariant() }
    if ($file.backup_sha256 -and ([string]$file.backup_sha256).ToUpperInvariant() -ne $preimageHash) {
      throw "MANIFEST_BACKUP_HASH_MISMATCH:$relative"
    }
    if (-not $Rollback -and (Get-Sha256 $source) -ne $candidateHash) {
      throw "CANDIDATE_HASH_MISMATCH:$relative"
    }
    if ($preimageAbsent -and -not $Rollback) {
      if (Test-Path -LiteralPath $target) { throw "TARGET_EXPECTED_ABSENT:$relative" }
    } else {
      $expectedCurrent = if ($Rollback) { $candidateHash } else { $preimageHash }
      if ((Get-Sha256 $target) -ne $expectedCurrent) { throw "CURRENT_HASH_MISMATCH:$relative" }
    }
    $entries += [pscustomobject]@{
      Path = $relative; Source = $source; Target = $target
      CandidateHash = $candidateHash; PreimageHash = $preimageHash; PreimageAbsent = $preimageAbsent
    }
  }
  if (-not $TestMode -and -not $Rollback) {
    $head = (& git -C $candidate rev-parse HEAD 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $head -ine [string]$data.candidate_commit) {
      throw 'CANDIDATE_COMMIT_MISMATCH'
    }
    $dirty = @(& git -C $candidate status --porcelain --untracked-files=all 2>&1)
    if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw 'CANDIDATE_WORKTREE_DIRTY' }
  }
  $closure = $null
  if (-not $Rollback) {
    $closureScript = Join-Path $PSScriptRoot 'manifest-runtime-closure.mjs'
    if (-not (Test-Path -LiteralPath $closureScript -PathType Leaf)) { throw 'DEPLOYMENT_CLOSURE_TOOL_MISSING' }
    $closureOutput = & node $closureScript $manifestPath $candidate $production 2>&1 | Out-String
    $closureExit = $LASTEXITCODE
    $closure = try { $closureOutput | ConvertFrom-Json } catch { throw 'DEPLOYMENT_CLOSURE_REPORT_INVALID' }
    if ($closureExit -ne 0 -or -not $closure.candidate_source_closure -or
        -not $closure.post_deploy_import_closure -or -not $closure.runtime_delivery_closure) {
      $first = @($closure.missing | Select-Object -First 1 -ExpandProperty target_path)
      if (-not $first) { $first = @($closure.errors | Select-Object -First 1) }
      throw "DEPLOYMENT_RUNTIME_CLOSURE_FAILED:$($first -join ',')"
    }
  }
  return [pscustomobject]@{
    ManifestPath = $manifestPath; ManifestHash = Get-Sha256 $manifestPath
    Commit = ([string]$data.candidate_commit).ToLowerInvariant(); Closure = $closure
    Candidate = $candidate; Production = $production; Entries = $entries
  }
}

function Get-Topology {
  if ($TestMode) {
    $dashboardCount = if ($script:fixtureDashboardPid -eq 0) { 0 } else { 1 }
    return [pscustomobject]@{ DashboardPid = $script:fixtureDashboardPid; NativePids = @(11, 12, 13);
      Counts = @(1, 1, 1, $dashboardCount); OpenKore = 0; Health = [bool]$dashboardCount }
  }
  $ports = @(6901, 6122, 5122, 8788)
  $listeners = @($ports | ForEach-Object {
    ,@(Get-NetTCPConnection -State Listen -LocalPort $_ -ErrorAction SilentlyContinue)
  })
  $counts = @($listeners | ForEach-Object { @($_).Count })
  $nativePids = @(0..2 | ForEach-Object { if (@($listeners[$_]).Count -eq 1) { [int]$listeners[$_][0].OwningProcess } else { 0 } })
  $dashboardPid = if (@($listeners[3]).Count -eq 1) { [int]$listeners[3][0].OwningProcess } else { 0 }
  $openKore = @(Get-Process -Name start,perl,openkore -ErrorAction SilentlyContinue).Count
  $healthy = $false
  try {
    $public = Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 3
    $probe = Invoke-RestMethod 'http://127.0.0.1:8788/api/internal/probe' -TimeoutSec 3
    $healthy = [bool]($public.ok -and $probe.ok)
  } catch {}
  return [pscustomobject]@{ DashboardPid = $dashboardPid; NativePids = $nativePids;
    Counts = $counts; OpenKore = $openKore; Health = $healthy }
}

function Assert-Topology($State, [int[]]$ExpectedNativePids = @(), [switch]$AllowDashboardDown) {
  if (@($State.Counts[0..2] | Where-Object { $_ -ne 1 }).Count -gt 0 -or
      ($AllowDashboardDown -and $State.Counts[3] -notin @(0, 1)) -or
      (-not $AllowDashboardDown -and $State.Counts[3] -ne 1)) {
    throw 'SINGLE_RUNTIME_TOPOLOGY_FAILED'
  }
  if ($State.OpenKore -ne 0 -or (-not $AllowDashboardDown -and -not $State.Health)) {
    throw 'RUNTIME_HEALTH_FAILED'
  }
  if ($ExpectedNativePids.Count -gt 0 -and
      (@(Compare-Object $ExpectedNativePids $State.NativePids).Count -gt 0)) {
    throw 'NATIVE_PID_CHANGED'
  }
  if (-not $TestMode -and $State.DashboardPid -gt 0) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($State.DashboardPid)"
    $expected = Join-Path $plan.Production 'ops\ro-stack\dashboard.mjs'
    if (-not $process -or -not $process.CommandLine.Contains($expected, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'DASHBOARD_PROCESS_IDENTITY_FAILED'
    }
  }
}

function Write-Receipt([string]$Path, $Value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 12))
  $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
  try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
}

function Replace-FileAtomic([string]$Source, [string]$Target) {
  $suffix = [guid]::NewGuid().ToString('N')
  $temporary = "$Target.deploy-$suffix.tmp"
  $previous = "$Target.previous-$suffix.tmp"
  try {
    [IO.File]::WriteAllBytes($temporary, [IO.File]::ReadAllBytes($Source))
    [IO.File]::Replace($temporary, $Target, $previous, $true)
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Force }
  }
}

function Place-NewFileAtomic([string]$Source, [string]$Target) {
  $temporary = "$Target.deploy-$([guid]::NewGuid().ToString('N')).tmp"
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
    [IO.File]::WriteAllBytes($temporary, [IO.File]::ReadAllBytes($Source))
    [IO.File]::Move($temporary, $Target)
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  }
}

function Invoke-DashboardService([string]$Action) {
  $service = Join-Path $plan.Production 'ops\ro-stack\dashboard-service.ps1'
  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = (Get-Command pwsh -ErrorAction Stop).Source
  $startInfo.ArgumentList.Add('-NoProfile')
  $startInfo.ArgumentList.Add('-File')
  $startInfo.ArgumentList.Add($service)
  $startInfo.ArgumentList.Add('-Action')
  $startInfo.ArgumentList.Add($Action)
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($startInfo)
  try {
    if (-not $process.WaitForExit(30000)) {
      $process.Kill()
      throw "DASHBOARD_SERVICE_${Action}_TIMEOUT"
    }
    if ($process.ExitCode -ne 0) { throw "DASHBOARD_SERVICE_${Action}_FAILED:$($process.ExitCode)" }
  } finally { $process.Dispose() }
}

function Invoke-DashboardStop([int]$OldPid) {
  if ($TestMode) { $script:fixtureDashboardPid = 0; return }
  Invoke-DashboardService 'stop'
  $deadline = (Get-Date).AddSeconds(10)
  do {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 8788 -ErrorAction SilentlyContinue)
    $process = if ($OldPid -gt 0) { Get-Process -Id $OldPid -ErrorAction SilentlyContinue } else { $null }
    if ($listeners.Count -eq 0 -and -not $process) { return }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  throw 'DASHBOARD_DID_NOT_STOP'
}

function Invoke-DashboardStart {
  if ($TestMode) {
    if ($SimulateStartFailure -and -not $script:simulatedStartFailureConsumed) {
      $script:simulatedStartFailureConsumed = $true
      throw 'SIMULATED_DASHBOARD_START_FAILURE'
    }
    $script:fixtureDashboardPid = 9001
    return
  }
  Invoke-DashboardService 'start'
  $deadline = (Get-Date).AddSeconds(15)
  do {
    try {
      $state = Get-Topology
      if ($state.Health -and $state.Counts[3] -eq 1) { return }
    } catch {}
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)
  throw 'DASHBOARD_START_HEALTH_TIMEOUT'
}

function Suspend-WebWatchdog {
  if ($TestMode) { return }
  $task = Get-ScheduledTask -TaskName $watchdogName -ErrorAction Stop
  $script:watchdogWasEnabled = [bool]$task.Settings.Enabled
  if ($script:watchdogWasEnabled) {
    Disable-ScheduledTask -TaskName $watchdogName -ErrorAction Stop | Out-Null
    $script:watchdogChanged = $true
  }
}

function Resume-WebWatchdog {
  if ($script:watchdogChanged) {
    Enable-ScheduledTask -TaskName $watchdogName -ErrorAction Stop | Out-Null
    $script:watchdogChanged = $false
  }
}

function Copy-Validated([string]$Source, [string]$Target, [string]$Expected) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  [IO.File]::WriteAllBytes($Target, [IO.File]::ReadAllBytes($Source))
  if ((Get-Sha256 $Target) -ne $Expected) { throw "STAGED_HASH_MISMATCH:$Target" }
}

function Restore-All($Entries, [string]$RunRoot) {
  foreach ($entry in $Entries) {
    if ($entry.PreimageAbsent) {
      if (Test-Path -LiteralPath $entry.Target) {
        if ((Get-Sha256 $entry.Target) -ne $entry.CandidateHash) { throw "NEW_FILE_DRIFT:$($entry.Path)" }
        Remove-Item -LiteralPath $entry.Target -Force
      }
      if (Test-Path -LiteralPath $entry.Target) { throw "NEW_FILE_ROLLBACK_FAILED:$($entry.Path)" }
    } else {
      $backup = Join-Path $RunRoot ('backup\' + $entry.Path.Replace('/', '\'))
      if ((Get-Sha256 $backup) -ne $entry.PreimageHash) { throw "BACKUP_HASH_MISMATCH:$($entry.Path)" }
      Replace-FileAtomic -Source $backup -Target $entry.Target
      if ((Get-Sha256 $entry.Target) -ne $entry.PreimageHash) { throw "ROLLBACK_HASH_MISMATCH:$($entry.Path)" }
    }
    $script:restoredPaths += $entry.Path
  }
}

function Test-Preimages($Entries) {
  $matched = 0
  foreach ($entry in $Entries) {
    if ($entry.PreimageAbsent) {
      if (-not (Test-Path -LiteralPath $entry.Target)) { $matched++ }
    } elseif ((Test-Path -LiteralPath $entry.Target -PathType Leaf) -and
            (Get-Sha256 $entry.Target) -eq $entry.PreimageHash) { $matched++ }
  }
  return [ordered]@{ matched = $matched; total = @($Entries).Count; pass = $matched -eq @($Entries).Count }
}

$plan = $null
$runRoot = $null
$before = $null
$dashboardStopped = $false
$productionTouched = $false
$failure = $null
$failurePhase = 'READ_PLAN'
$script:changedPaths = @()
$script:restoredPaths = @()
try {
  if ($SimulateDashboardDown) { $script:fixtureDashboardPid = 0 }
  $plan = Read-Plan
  $failurePhase = 'TOPOLOGY_PRECHECK'
  $before = Get-Topology
  Assert-Topology $before -AllowDashboardDown:$Rollback
  if ($Precheck) {
    [ordered]@{ timestamp = [DateTimeOffset]::UtcNow.ToString('o'); mode = 'PRECHECK';
      result = 'PRECHECK_PASS'; manifest_sha256 = $plan.ManifestHash;
      candidate_commit = $plan.Commit; candidate_root = $plan.Candidate;
      file_count = $plan.Entries.Count;
      post_deploy_import_closure = $plan.Closure.post_deploy_import_closure;
      runtime_delivery_closure = $plan.Closure.runtime_delivery_closure;
      runtime_dependency_count = @($plan.Closure.dependencies).Count;
      files = @($plan.Entries | ForEach-Object { [ordered]@{ path = $_.Path;
        candidate_sha256 = $_.CandidateHash; production_preimage_sha256 = $_.PreimageHash } });
      dashboard_pid_before = $before.DashboardPid; dashboard_pid_after = $before.DashboardPid;
      native_pids_before = $before.NativePids; native_pids_after = $before.NativePids;
      listener_counts_before = $before.Counts; listener_counts_after = $before.Counts;
      health_before = $before.Health; health_after = $before.Health;
      rollback_performed = $false; final_state = 'UNCHANGED'; production_touched = $false } | ConvertTo-Json -Depth 8
    exit 0
  }
  if ($Deploy) {
    $failurePhase = 'STAGING'
    $directory = if ($ReceiptDirectory) { [IO.Path]::GetFullPath($ReceiptDirectory) } else {
      Join-Path $plan.Production '.local\ro-stack\dashboard\deploy-receipts' }
    if (-not $TestMode -and $directory -ine (Join-Path $plan.Production '.local\ro-stack\dashboard\deploy-receipts')) {
      throw 'RECEIPT_DIRECTORY_NOT_CANONICAL'
    }
    $runRoot = Join-Path $directory ("manifest-$([guid]::NewGuid().ToString('N'))")
    New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
    $productionTouched = $true
    Copy-Validated -Source $plan.ManifestPath -Target (Join-Path $runRoot 'manifest.json') -Expected $plan.ManifestHash
    foreach ($entry in $plan.Entries) {
      Copy-Validated -Source $entry.Source -Target (Join-Path $runRoot ('staged\' + $entry.Path.Replace('/', '\'))) -Expected $entry.CandidateHash
      if (-not $entry.PreimageAbsent) {
        Copy-Validated -Source $entry.Target -Target (Join-Path $runRoot ('backup\' + $entry.Path.Replace('/', '\'))) -Expected $entry.PreimageHash
      }
    }
    Suspend-WebWatchdog
    $productionTouched = $true
    $dashboardStopped = $true
    $failurePhase = 'DASHBOARD_STOP'
    Invoke-DashboardStop $before.DashboardPid
    $failurePhase = 'PREIMAGE_RECHECK'
    foreach ($entry in $plan.Entries) {
      if ($entry.PreimageAbsent) {
        if (Test-Path -LiteralPath $entry.Target) { throw "PREIMAGE_DRIFT_AFTER_STOP:$($entry.Path)" }
      } elseif ((Get-Sha256 $entry.Target) -ne $entry.PreimageHash) {
        throw "PREIMAGE_DRIFT_AFTER_STOP:$($entry.Path)"
      }
    }
    $index = 0
    $failurePhase = 'FILE_REPLACEMENT'
    foreach ($entry in $plan.Entries) {
      Assert-WithinRoot -Root $plan.Production -RelativePath $entry.Path | Out-Null
      $staged = Join-Path $runRoot ('staged\' + $entry.Path.Replace('/', '\'))
      if ($entry.PreimageAbsent) { Place-NewFileAtomic -Source $staged -Target $entry.Target }
      else { Replace-FileAtomic -Source $staged -Target $entry.Target }
      if ((Get-Sha256 $entry.Target) -ne $entry.CandidateHash) { throw "DEPLOYED_HASH_MISMATCH:$($entry.Path)" }
      $script:changedPaths += $entry.Path
      $index++
      if ($SimulateFailureAfter -eq $index) { throw 'SIMULATED_MID_DEPLOY_FAILURE' }
    }
    $failurePhase = 'DASHBOARD_START'
    Invoke-DashboardStart
    $failurePhase = 'POST_DEPLOY_TOPOLOGY'
    $after = Get-Topology
    Assert-Topology $after $before.NativePids
    if ($after.DashboardPid -eq $before.DashboardPid) { throw 'DASHBOARD_PID_UNCHANGED' }
    $receipt = [ordered]@{ timestamp = [DateTimeOffset]::UtcNow.ToString('o'); mode = 'DEPLOY';
      result = 'CANDIDATE_ACTIVE'; manifest_sha256 = $plan.ManifestHash; candidate_commit = $plan.Commit;
      candidate_root = $plan.Candidate;
      production_root = $plan.Production; test_mode = [bool]$TestMode;
      files_changed = @($plan.Entries | ForEach-Object { $_.Path });
      files = @($plan.Entries | ForEach-Object { [ordered]@{ path = $_.Path;
        production_preimage_sha256 = $_.PreimageHash; candidate_sha256 = $_.CandidateHash } });
      dashboard_pid_before = $before.DashboardPid; dashboard_pid_after = $after.DashboardPid;
      health_before = $before.Health; health_after = $after.Health;
      native_pids_before = $before.NativePids; native_pids_after = $after.NativePids;
      listener_counts_before = $before.Counts; listener_counts_after = $after.Counts;
      rollback_performed = $false; final_state = 'CANDIDATE_ACTIVE' }
    $failurePhase = 'FINALIZATION'
    Resume-WebWatchdog
    $receiptFile = Join-Path $runRoot 'deploy-receipt.json'
    Write-Receipt -Path $receiptFile -Value $receipt
    [ordered]@{ result = 'DEPLOY_PASS'; receipt = $receiptFile; runtime = $after } | ConvertTo-Json -Depth 8
    exit 0
  }
  if (-not $ReceiptPath -or -not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
    throw 'ROLLBACK_RECEIPT_REQUIRED'
  }
  $receiptFile = (Resolve-Path -LiteralPath $ReceiptPath).Path
  $runRoot = Split-Path -Parent $receiptFile
  $expectedReceipts = Join-Path $plan.Production '.local\ro-stack\dashboard\deploy-receipts'
  if ((Split-Path -Leaf $receiptFile) -ne 'deploy-receipt.json' -or
      -not (Split-Path -Leaf $runRoot).StartsWith('manifest-', [StringComparison]::Ordinal) -or
      (Split-Path -Parent $runRoot) -ine $expectedReceipts) {
    throw 'ROLLBACK_RECEIPT_PATH_INVALID'
  }
  $receipt = Get-Content -LiteralPath $receiptFile -Raw | ConvertFrom-Json
  if ($receipt.mode -ne 'DEPLOY' -or $receipt.result -ne 'CANDIDATE_ACTIVE' -or
      $receipt.manifest_sha256 -ne $plan.ManifestHash -or
      $receipt.candidate_commit -ne $plan.Commit -or
      $receipt.candidate_root -ine $plan.Candidate -or
      $receipt.production_root -ine $plan.Production -or
      [bool]$receipt.test_mode -ne [bool]$TestMode -or
      @($receipt.files).Count -ne $plan.Entries.Count) { throw 'ROLLBACK_RECEIPT_MISMATCH' }
  foreach ($entry in $plan.Entries) {
    $row = @($receipt.files | Where-Object { $_.path -eq $entry.Path })
    if ($row.Count -ne 1 -or $row[0].candidate_sha256 -ne $entry.CandidateHash -or
        $row[0].production_preimage_sha256 -ne $entry.PreimageHash) { throw 'ROLLBACK_FILE_RECEIPT_MISMATCH' }
    if ((Get-Sha256 $entry.Target) -ne $entry.CandidateHash) { throw "ROLLBACK_CURRENT_HASH_MISMATCH:$($entry.Path)" }
    if (-not $entry.PreimageAbsent) {
      $backup = Join-Path $runRoot ('backup\' + $entry.Path.Replace('/', '\'))
      if ((Get-Sha256 $backup) -ne $entry.PreimageHash) { throw "BACKUP_HASH_MISMATCH:$($entry.Path)" }
    }
  }
  Suspend-WebWatchdog
  $productionTouched = $true
  $dashboardStopped = $true
  $failurePhase = 'ROLLBACK_DASHBOARD_STOP'
  Invoke-DashboardStop $before.DashboardPid
  $failurePhase = 'ROLLBACK_CANDIDATE_RECHECK'
  foreach ($entry in $plan.Entries) {
    if ((Get-Sha256 $entry.Target) -ne $entry.CandidateHash) { throw "CANDIDATE_DRIFT_AFTER_STOP:$($entry.Path)" }
  }
  $failurePhase = 'ROLLBACK_RESTORE'
  Restore-All -Entries $plan.Entries -RunRoot $runRoot
  $failurePhase = 'ROLLBACK_DASHBOARD_START'
  Invoke-DashboardStart
  $failurePhase = 'ROLLBACK_FINALIZATION'
  $after = Get-Topology
  Assert-Topology $after $before.NativePids
  $rollbackReceipt = [ordered]@{ timestamp = [DateTimeOffset]::UtcNow.ToString('o'); mode = 'ROLLBACK';
    result = 'PREIMAGE_RESTORED'; manifest_sha256 = $plan.ManifestHash; candidate_commit = $plan.Commit;
    candidate_root = $plan.Candidate;
    production_root = $plan.Production; files_changed = @($plan.Entries | ForEach-Object { $_.Path });
    files = @($plan.Entries | ForEach-Object { [ordered]@{ path = $_.Path;
      production_preimage_sha256 = $_.PreimageHash; candidate_sha256 = $_.CandidateHash } });
    dashboard_pid_before = $before.DashboardPid; dashboard_pid_after = $after.DashboardPid;
    health_before = $before.Health; health_after = $after.Health;
    native_pids_before = $before.NativePids; native_pids_after = $after.NativePids;
    listener_counts_before = $before.Counts; listener_counts_after = $after.Counts;
    rollback_performed = $true; final_state = 'ORIGINAL_PREIMAGE' }
  Resume-WebWatchdog
  $rollbackReceiptFile = Join-Path $runRoot 'rollback-receipt.json'
  Write-Receipt -Path $rollbackReceiptFile -Value $rollbackReceipt
  [ordered]@{ result = 'ROLLBACK_PASS'; receipt = $rollbackReceiptFile; runtime = $after } | ConvertTo-Json -Depth 8
  exit 0
} catch {
  $failure = $_.Exception.Message
  $recovery = 'NOT_REQUIRED'
  $rollbackAttempted = $false
  if ($dashboardStopped -and $runRoot -and $plan) {
    $rollbackAttempted = $true
    try {
      Suspend-WebWatchdog
      $current = Get-Topology
      if ($current.DashboardPid -ne 0) { Invoke-DashboardStop $current.DashboardPid }
      Restore-All -Entries $plan.Entries -RunRoot $runRoot
      Invoke-DashboardStart
      Assert-Topology (Get-Topology) $before.NativePids
      $validation = Test-Preimages $plan.Entries
      if (-not $validation.pass) { throw 'AUTOMATIC_ROLLBACK_PREIMAGE_VALIDATION_FAILED' }
      $recovery = 'PREIMAGE_RESTORED'
    } catch { $recovery = "ROLLBACK_FAILED:$($_.Exception.Message)" }
  }
  $final = try { Get-Topology } catch { $null }
  $finalValidation = if ($plan) { Test-Preimages $plan.Entries } else { $null }
  $failureReceiptFile = $null
  $receiptError = $null
  if ($runRoot -and (Test-Path -LiteralPath $runRoot)) {
    $failureReceiptFile = Join-Path $runRoot "failure-$([guid]::NewGuid().ToString('N')).json"
    try { Write-Receipt -Path $failureReceiptFile -Value ([ordered]@{
      timestamp = [DateTimeOffset]::UtcNow.ToString('o'); mode = if ($Deploy) { 'DEPLOY' } else { 'ROLLBACK' };
      status = 'FAILED'; result = 'FAIL_CLOSED'; failure_phase = $failurePhase; failure_reason = $failure;
      manifest_hash = if ($plan) { $plan.ManifestHash } else { $null };
      manifest_sha256 = if ($plan) { $plan.ManifestHash } else { $null };
      candidate_commit = if ($plan) { $plan.Commit } else { $null };
      candidate_root = if ($plan) { $plan.Candidate } else { $null };
      files_mutated = @($script:changedPaths); files_changed = @($script:changedPaths);
      files_restored = @($script:restoredPaths);
      automatic_rollback_attempted = $rollbackAttempted;
      automatic_rollback_result = $recovery;
      final_preimage_validation = $finalValidation;
      files = if ($plan) { @($plan.Entries | ForEach-Object { [ordered]@{ path = $_.Path;
        production_preimage_sha256 = $_.PreimageHash; candidate_sha256 = $_.CandidateHash } }) } else { @() };
      dashboard_pid_before = if ($before) { $before.DashboardPid } else { $null };
      dashboard_pid_after = if ($final) { $final.DashboardPid } else { $null };
      health_before = if ($before) { $before.Health } else { $null };
      health_after = if ($final) { $final.Health } else { $null };
      native_pids_before = if ($before) { $before.NativePids } else { @() };
      native_pids_after = if ($final) { $final.NativePids } else { @() };
      listener_counts_before = if ($before) { $before.Counts } else { @() };
      listener_counts_after = if ($final) { $final.Counts } else { @() };
      rollback_performed = $recovery -eq 'PREIMAGE_RESTORED'; final_state = $recovery; error = $failure }) }
    catch { $receiptError = $_.Exception.Message; $failureReceiptFile = $null }
  }
  [ordered]@{ result = 'FAIL_CLOSED'; error = $failure; rollback = $recovery;
    failure_receipt = $failureReceiptFile; receipt_error = $receiptError;
    final_preimage_validation = $finalValidation;
    production_touched = $productionTouched } | ConvertTo-Json -Depth 5
  exit 1
} finally {
  Resume-WebWatchdog
}
