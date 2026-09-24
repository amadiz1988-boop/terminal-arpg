[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceCommit,
  [Parameter(Mandatory = $true)]
  [string[]]$AuthorizedPaths,
  [Parameter(Mandatory = $true)]
  [string]$ProductionRoot,
  [switch]$Precheck,
  [switch]$Deploy,
  [string]$ReceiptPath,
  [string]$StagingRoot,
  [switch]$TestMode,
  [switch]$SkipRestart,
  [switch]$SimulateRestartFailure,
  [int]$SimulateStageFailureAfter = 0,
  [string]$SimulateReceiptMissingField,
  [string]$RestartTaskName = 'GhostIslandRO-CanonicalDashboard'
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$canonicalProductionRoot = 'C:\Users\Administrator\ghost-island-production\ro-stack'
$allowedPaths = @(
  'ops/ro-stack/dashboard.mjs',
  'ops/ro-stack/persistent-agent/admin-fixture-navigation.mjs'
)
$runRoot = $null
$changedEntries = @()
$restartStarted = $false

function Invoke-NativeBytes {
  param(
    [Parameter(Mandatory = $true)][string]$FileName,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$WorkingDirectory = $sourceRoot
  )
  $info = [System.Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $FileName
  $info.WorkingDirectory = $WorkingDirectory
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in $Arguments) { [void]$info.ArgumentList.Add($argument) }
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $info
  if (-not $process.Start()) { throw "PROCESS_START_FAILED:$FileName" }
  $output = [System.IO.MemoryStream]::new()
  $errorTask = $process.StandardError.ReadToEndAsync()
  $process.StandardOutput.BaseStream.CopyTo($output)
  $errorText = $errorTask.GetAwaiter().GetResult()
  $process.WaitForExit()
  [pscustomobject]@{
    ExitCode = $process.ExitCode
    Bytes = $output.ToArray()
    Text = [System.Text.Encoding]::UTF8.GetString($output.ToArray())
    Error = $errorText
  }
}

function Invoke-GitText {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  $result = Invoke-NativeBytes -FileName 'git' -Arguments $Arguments
  if ($result.ExitCode -ne 0) {
    throw "GIT_FAILED:$($Arguments -join ' '):$($result.Error.Trim())"
  }
  return $result.Text.TrimEnd("`r", "`n")
}

function Get-GitBlobHashFromBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($Bytes.Length)`0")
  $buffer = [byte[]]::new($header.Length + $Bytes.Length)
  [System.Buffer]::BlockCopy($header, 0, $buffer, 0, $header.Length)
  [System.Buffer]::BlockCopy($Bytes, 0, $buffer, $header.Length, $Bytes.Length)
  $digest = [System.Security.Cryptography.SHA1]::Create().ComputeHash($buffer)
  return (($digest | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Get-Sha256FromBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  $digest = [System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)
  return (($digest | ForEach-Object { $_.ToString('x2') }) -join '').ToUpperInvariant()
}

function Get-GitBlob {
  param(
    [Parameter(Mandatory = $true)][string]$Commit,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $hashResult = Invoke-NativeBytes -FileName 'git' -Arguments @('rev-parse', '--verify', "${Commit}:$Path")
  if ($hashResult.ExitCode -ne 0) { return $null }
  $hash = $hashResult.Text.Trim()
  $blobResult = Invoke-NativeBytes -FileName 'git' -Arguments @('cat-file', 'blob', $hash)
  if ($blobResult.ExitCode -ne 0) {
    throw "GIT_BLOB_READ_FAILED:$Commit`:${Path}:$($blobResult.Error.Trim())"
  }
  return [pscustomobject]@{ Hash = $hash; Bytes = $blobResult.Bytes }
}

function Normalize-AuthorizedPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $normalized = $Path.Trim().Replace('\', '/')
  if ($normalized.StartsWith('/') -or $normalized.Contains('../') -or $normalized.Contains('/./')) {
    throw "UNAUTHORIZED_PATH:$Path"
  }
  if ($allowedPaths -notcontains $normalized) { throw "UNAUTHORIZED_PATH:$Path" }
  return $normalized
}

function Resolve-DeploymentInputs {
  if ($Precheck -eq $Deploy) { throw 'SELECT_EXACTLY_ONE_OF_PRECHECK_OR_DEPLOY' }
  $commit = Invoke-GitText @('rev-parse', '--verify', "$SourceCommit^{commit}")
  $parent = Invoke-GitText @('rev-parse', '--verify', "$commit^")
  $requestedPaths = @($AuthorizedPaths | ForEach-Object { $_ -split ',' })
  $normalizedPaths = @($requestedPaths | Where-Object { $_.Trim() } | ForEach-Object { Normalize-AuthorizedPath $_ })
  if ($normalizedPaths.Count -eq 0) { throw 'AUTHORIZED_PATHS_REQUIRED' }
  if (@($normalizedPaths | Sort-Object -Unique).Count -ne $normalizedPaths.Count) {
    throw 'DUPLICATE_AUTHORIZED_PATH'
  }
  $production = (Resolve-Path -LiteralPath $ProductionRoot -ErrorAction Stop).Path
  if (-not (Test-Path -LiteralPath $production -PathType Container)) {
    throw 'PRODUCTION_ROOT_INVALID'
  }
  if ($Deploy -and -not $TestMode -and $production.TrimEnd('\') -ne $canonicalProductionRoot.TrimEnd('\')) {
    throw 'PRODUCTION_ROOT_NOT_CANONICAL'
  }
  if (($SkipRestart -or $SimulateRestartFailure -or $SimulateStageFailureAfter -gt 0) -and -not $TestMode) {
    throw 'TEST_ONLY_SWITCH_REQUIRES_TEST_MODE'
  }
  if ($SimulateReceiptMissingField -and -not $TestMode) {
    throw 'TEST_ONLY_SWITCH_REQUIRES_TEST_MODE'
  }
  if ($TestMode -and $production.TrimEnd('\') -eq $canonicalProductionRoot.TrimEnd('\')) {
    throw 'TEST_MODE_CANNOT_TARGET_CANONICAL_PRODUCTION'
  }
  return [pscustomobject]@{
    Commit = $commit
    Parent = $parent
    Paths = $normalizedPaths
    Production = $production
  }
}

function New-StagingPath {
  param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$RelativePath)
  $path = Join-Path $Root ($RelativePath.Replace('/', '\'))
  $directory = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  return $path
}

function Apply-CommittedDelta {
  param(
    [Parameter(Mandatory = $true)][string]$StagedRoot,
    [Parameter(Mandatory = $true)][string]$PatchPath
  )
  $check = Invoke-NativeBytes -FileName 'git' -Arguments @('-C', $StagedRoot, 'apply', '--check', '--whitespace=nowarn', $PatchPath)
  if ($check.ExitCode -ne 0) {
    throw "DEPLOY_PREIMAGE_CONFLICT:$($check.Error.Trim())"
  }
  $apply = Invoke-NativeBytes -FileName 'git' -Arguments @('-C', $StagedRoot, 'apply', '--whitespace=nowarn', $PatchPath)
  if ($apply.ExitCode -ne 0) {
    throw "DEPLOY_DELTA_APPLY_FAILED:$($apply.Error.Trim())"
  }
}

function New-DeploymentPlan {
  param([Parameter(Mandatory = $true)]$Inputs)
  $run = if ($StagingRoot) { (Resolve-Path -LiteralPath $StagingRoot -ErrorAction Stop).Path } else { [System.IO.Path]::GetTempPath() }
  $script:runRoot = Join-Path $run "ghost-island-dashboard-deploy-$([guid]::NewGuid().ToString('N'))"
  $stagedRoot = Join-Path $runRoot 'staged'
  $backupRoot = Join-Path $runRoot 'backup'
  New-Item -ItemType Directory -Force -Path $stagedRoot, $backupRoot | Out-Null
  $entries = [System.Collections.Generic.List[object]]::new()
  $conflicts = [System.Collections.Generic.List[string]]::new()
  $index = 0
  foreach ($relativePath in $Inputs.Paths) {
    $index++
    if ($SimulateStageFailureAfter -gt 0 -and $index -gt $SimulateStageFailureAfter) {
      throw "SIMULATED_PARTIAL_STAGING_FAILURE:$relativePath"
    }
    $productionPath = Join-Path $Inputs.Production ($relativePath.Replace('/', '\'))
    $stagedPath = New-StagingPath -Root $stagedRoot -RelativePath $relativePath
    $backupPath = New-StagingPath -Root $backupRoot -RelativePath $relativePath
    $targetBlob = Get-GitBlob -Commit $Inputs.Commit -Path $relativePath
    if ($null -eq $targetBlob) { throw "COMMITTED_TARGET_MISSING:$relativePath" }
    $parentBlob = Get-GitBlob -Commit $Inputs.Parent -Path $relativePath
    $exists = Test-Path -LiteralPath $productionPath -PathType Leaf
    $preBytes = if ($exists) { [System.IO.File]::ReadAllBytes($productionPath) } else { $null }
    $preSha256 = if ($exists) { Get-Sha256FromBytes $preBytes } else { $null }
    $mode = 'EXACT_BLOB'
    $wasPresent = $exists
    try {
      if ($null -eq $parentBlob) {
        if ($exists) { throw "TARGET_PATH_COLLISION:$relativePath" }
        [System.IO.File]::WriteAllBytes($stagedPath, $targetBlob.Bytes)
      } else {
        if (-not $exists) { throw "DEPLOY_PREIMAGE_MISSING:$relativePath" }
        if ((Get-GitBlobHashFromBytes $preBytes) -eq $parentBlob.Hash) {
          [System.IO.File]::WriteAllBytes($stagedPath, $targetBlob.Bytes)
        } else {
          $mode = 'VERIFIED_COMMIT_DELTA'
          [System.IO.File]::WriteAllBytes($stagedPath, $preBytes)
          $patchResult = Invoke-NativeBytes -FileName 'git' -Arguments @('diff', '--binary', '--no-ext-diff', $Inputs.Parent, $Inputs.Commit, '--', $relativePath)
          if ($patchResult.ExitCode -ne 0) { throw "GIT_DELTA_READ_FAILED:$($patchResult.Error.Trim())" }
          $patchBytes = $patchResult.Bytes
          $patchPath = Join-Path $runRoot 'committed-delta.patch'
          [System.IO.File]::WriteAllBytes($patchPath, $patchBytes)
          Apply-CommittedDelta -StagedRoot $stagedRoot -PatchPath $patchPath
        }
      }
      $stagedBytes = [System.IO.File]::ReadAllBytes($stagedPath)
      $entry = [pscustomobject]@{
        Path = $relativePath
        ProductionPath = $productionPath
        StagedPath = $stagedPath
        BackupPath = $backupPath
        WasPresent = $wasPresent
        ProductionPreHash = if ($exists) { $preSha256 } else { 'ABSENT' }
        CommitParentHash = if ($parentBlob) { $parentBlob.Hash } else { 'ABSENT' }
        CommitTargetHash = $targetBlob.Hash
        StagedHash = Get-Sha256FromBytes $stagedBytes
        StagedGitBlobHash = Get-GitBlobHashFromBytes $stagedBytes
        DeploymentMode = $mode
      }
      $entries.Add($entry)
    } catch {
      $conflicts.Add($_.Exception.Message)
    }
  }
  $safe = $conflicts.Count -eq 0 -and $entries.Count -eq $Inputs.Paths.Count
  [pscustomobject]@{
    Safe = $safe
    Conflicts = @($conflicts)
    Entries = @($entries)
    RunRoot = $runRoot
    StagedRoot = $stagedRoot
    BackupRoot = $backupRoot
    SourceCommit = $Inputs.Commit
    SourceParent = $Inputs.Parent
    ProductionRoot = $Inputs.Production
  }
}

function Get-RuntimeInvariant {
  $counts = @{}
  foreach ($port in @(6901, 6122, 5122, 8788)) {
    $counts[[string]$port] = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count
  }
  $openKore = @(Get-Process -Name start -ErrorAction SilentlyContinue).Count
  $health = $null
  try { $health = (Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 3).ok } catch { $health = $false }
  [pscustomobject]@{ Counts = $counts; OpenKore = $openKore; Health = [bool]$health }
}

function Assert-RuntimeInvariant {
  $state = Get-RuntimeInvariant
  foreach ($port in @('6901', '6122', '5122', '8788')) {
    if ([int]$state.Counts[$port] -ne 1) { throw "SINGLE_RUNTIME_INVARIANT_FAILED:$port=$($state.Counts[$port])" }
  }
  if ($state.OpenKore -ne 0) { throw "OPENKORE_INVARIANT_FAILED:$($state.OpenKore)" }
  if (-not $state.Health) { throw 'DASHBOARD_HEALTH_FAILED' }
  return $state
}

function Replace-FileAtomic {
  param([Parameter(Mandatory = $true)][string]$Source, [Parameter(Mandatory = $true)][string]$Target)
  $temporary = "$Target.deploy-$([guid]::NewGuid().ToString('N')).tmp"
  [System.IO.File]::WriteAllBytes($temporary, [System.IO.File]::ReadAllBytes($Source))
  try {
    if (Test-Path -LiteralPath $Target -PathType Leaf) {
      try { [System.IO.File]::Replace($temporary, $Target, $null, $true) }
      catch { [System.IO.File]::Move($temporary, $Target, $true) }
    } else {
      [System.IO.File]::Move($temporary, $Target)
    }
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue }
  }
}

function Save-RollbackBytes {
  param([Parameter(Mandatory = $true)]$Plan)
  foreach ($entry in $Plan.Entries) {
    if ($entry.WasPresent) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $entry.BackupPath) | Out-Null
      [System.IO.File]::WriteAllBytes($entry.BackupPath, [System.IO.File]::ReadAllBytes($entry.ProductionPath))
    }
  }
}

function Restore-RollbackBytes {
  param([Parameter(Mandatory = $true)]$Plan)
  foreach ($entry in $Plan.Entries) {
    if ($entry.WasPresent) {
      Replace-FileAtomic -Source $entry.BackupPath -Target $entry.ProductionPath
    } elseif (Test-Path -LiteralPath $entry.ProductionPath) {
      Remove-Item -LiteralPath $entry.ProductionPath -Force
    }
  }
}

function Invoke-DashboardOnlyRestart {
  param([Parameter(Mandatory = $true)][string]$Production)
  $service = Join-Path $Production 'ops\ro-stack\dashboard-service.ps1'
  if (-not (Test-Path -LiteralPath $service -PathType Leaf)) { throw 'DASHBOARD_ONLY_RESTART_UNAVAILABLE' }
  & pwsh -NoProfile -File $service -Action stop | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "DASHBOARD_STOP_FAILED:$LASTEXITCODE" }
  Start-ScheduledTask -TaskName $RestartTaskName
  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 250
    try {
      $health = Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 2
      if ($health.ok) { break }
    } catch {}
  } while ((Get-Date) -lt $deadline)
  Assert-RuntimeInvariant | Out-Null
  return 'PASS'
}

function Test-ReceiptCompleteness {
  param(
    [Parameter(Mandatory = $true)]$Receipt,
    [switch]$DryRun
  )
  foreach ($name in @('SOURCE_COMMIT', 'SOURCE_PARENT', 'AUTHORIZED_PATHS', 'FILES', 'restart_result', 'health_after')) {
    $value = $Receipt.$name
    if ($null -eq $value -or ([string]$value).Trim().Length -eq 0) { return $false }
  }
  if (@($Receipt.AUTHORIZED_PATHS).Count -eq 0 -or @($Receipt.FILES).Count -eq 0) { return $false }
  if ($DryRun -and ($Receipt.restart_result -ne 'NOT_RUN' -or $Receipt.health_after -ne 'NOT_RUN')) { return $false }
  foreach ($file in @($Receipt.FILES)) {
    foreach ($name in @('path', 'production_pre_hash', 'commit_parent_hash', 'commit_target_hash', 'staged_hash', 'deployment_mode', 'production_post_hash')) {
      $value = $file.$name
      if ($null -eq $value -or ([string]$value).Trim().Length -eq 0) { return $false }
    }
    if ($DryRun -and $file.production_post_hash -ne 'NOT_APPLIED') { return $false }
  }
  return $true
}

function Convert-PlanSummary {
  param([Parameter(Mandatory = $true)]$Plan, [string]$Result = 'PRECHECK')
  $pre = [ordered]@{}
  $staged = [ordered]@{}
  foreach ($entry in $Plan.Entries) {
    $pre[$entry.Path] = $entry.ProductionPreHash
    $staged[$entry.Path] = $entry.StagedHash
  }
  $files = @($Plan.Entries | ForEach-Object { [ordered]@{
    path = $_.Path
    production_pre_hash = $_.ProductionPreHash
    commit_parent_hash = $_.CommitParentHash
    commit_target_hash = $_.CommitTargetHash
    staged_hash = $_.StagedHash
    deployment_mode = $_.DeploymentMode
    production_post_hash = 'NOT_APPLIED'
  } })
  $summary = [ordered]@{
    RESULT = $Result
    SAFE_TO_DEPLOY = if ($Plan.Safe) { 'YES' } else { 'NO' }
    CONFLICTS = @($Plan.Conflicts)
    SOURCE_COMMIT = $Plan.SourceCommit
    SOURCE_PARENT = $Plan.SourceParent
    AUTHORIZED_PATHS = @($Plan.Entries | ForEach-Object { $_.Path })
    FILES = $files
    FILE_PATHS = @($Plan.Entries | ForEach-Object { $_.Path })
    PRE_HASHES = $pre
    STAGED_HASHES = $staged
    DEPLOYMENT_MODES = @($Plan.Entries | ForEach-Object { [ordered]@{ Path = $_.Path; Mode = $_.DeploymentMode } })
    STAGING_ROOT = $Plan.RunRoot
    restart_result = 'NOT_RUN'
    health_after = 'NOT_RUN'
  }
  if ($SimulateReceiptMissingField) {
    switch ($SimulateReceiptMissingField) {
      'SOURCE_COMMIT' { $summary.Remove('SOURCE_COMMIT') }
      'SOURCE_PARENT' { $summary.Remove('SOURCE_PARENT') }
      'AUTHORIZED_PATHS' { $summary.Remove('AUTHORIZED_PATHS') }
      'restart_result' { $summary.Remove('restart_result') }
      'health_after' { $summary.Remove('health_after') }
      'path' { $files[0].Remove('path') }
      'production_pre_hash' { $files[0].Remove('production_pre_hash') }
      'commit_parent_hash' { $files[0].Remove('commit_parent_hash') }
      'commit_target_hash' { $files[0].Remove('commit_target_hash') }
      'staged_hash' { $files[0].Remove('staged_hash') }
      'deployment_mode' { $files[0].Remove('deployment_mode') }
      'production_post_hash' { $files[0].Remove('production_post_hash') }
      default { throw "UNSUPPORTED_RECEIPT_TEST_FIELD:$SimulateReceiptMissingField" }
    }
  }
  $summary.RECEIPT_COMPLETE = if (Test-ReceiptCompleteness -Receipt ([pscustomobject]$summary) -DryRun) { 'YES' } else { 'NO' }
  return $summary
}

try {
  if (-not $Precheck -and -not $Deploy) { throw 'SELECT_PRECHECK_OR_DEPLOY' }
  $inputs = Resolve-DeploymentInputs
  $plan = New-DeploymentPlan -Inputs $inputs
  $summary = Convert-PlanSummary -Plan $plan
  if (-not $plan.Safe) {
    $summary | ConvertTo-Json -Depth 8
    exit 1
  }
  if ($summary.RECEIPT_COMPLETE -ne 'YES') {
    $summary.RESULT = 'RECEIPT_INCOMPLETE'
    $summary.SAFE_TO_DEPLOY = 'NO'
    $summary.RECEIPT_COMPLETE = 'NO'
    $summary | ConvertTo-Json -Depth 10
    exit 1
  }
  if ($Precheck) {
    $summary | ConvertTo-Json -Depth 8
    exit 0
  }
  Save-RollbackBytes -Plan $plan
  foreach ($entry in $plan.Entries) {
    Replace-FileAtomic -Source $entry.StagedPath -Target $entry.ProductionPath
    $script:changedEntries += $entry
  }
  if ($SimulateRestartFailure) {
    $restartStarted = $true
    throw 'SIMULATED_RESTART_FAILURE'
  }
  $restartResult = if ($SkipRestart) { 'SKIPPED_TEST_MODE' } else { $restartStarted = $true; Invoke-DashboardOnlyRestart -Production $inputs.Production }
  $postRuntime = if ($SkipRestart) { Get-RuntimeInvariant } else { Assert-RuntimeInvariant }
  $postHashes = [ordered]@{}
  foreach ($entry in $plan.Entries) {
    $postHashes[$entry.Path] = Get-Sha256FromBytes ([System.IO.File]::ReadAllBytes($entry.ProductionPath))
  }
  $receipt = [ordered]@{
    DEPLOY_ID = "dashboard-$([guid]::NewGuid().ToString('N'))"
    SOURCE_COMMIT = $plan.SourceCommit
    SOURCE_PARENT = $plan.SourceParent
    TIMESTAMP = [DateTimeOffset]::UtcNow.ToString('o')
    AUTHORIZED_PATHS = @($plan.Entries | ForEach-Object { $_.Path })
    FILES = @($plan.Entries | ForEach-Object { [ordered]@{
      path = $_.Path
      production_pre_hash = $_.ProductionPreHash
      commit_parent_hash = $_.CommitParentHash
      commit_target_hash = $_.CommitTargetHash
      staged_hash = $_.StagedHash
      production_post_hash = $postHashes[$_.Path]
      deployment_mode = $_.DeploymentMode
    } })
    restart_result = $restartResult
    health_after = [bool]$postRuntime.Health
    health_result = [bool]$postRuntime.Health
    runtime = $postRuntime
  }
  if (-not (Test-ReceiptCompleteness -Receipt ([pscustomobject]$receipt))) {
    throw 'RECEIPT_INCOMPLETE'
  }
  $receipt.RECEIPT_COMPLETE = 'YES'
  $receiptTarget = if ($ReceiptPath) { $ReceiptPath } else { Join-Path $inputs.Production '.local\ro-stack\dashboard\deploy-receipts\latest.json' }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $receiptTarget) | Out-Null
  $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $receiptTarget -Encoding utf8
  [ordered]@{ RESULT = 'DEPLOY_PASS'; RECEIPT = $receiptTarget; PRODUCTION_POST_HASHES = $postHashes; RESTART = $restartResult; RUNTIME = $postRuntime } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  $errorMessage = $_.Exception.Message
  if ($changedEntries.Count -gt 0) {
    try { Restore-RollbackBytes -Plan $plan } catch { $errorMessage = "$errorMessage;ROLLBACK_FAILED:$($_.Exception.Message)" }
  }
  [ordered]@{
    RESULT = 'DEPLOY_FAIL_CLOSED'
    SAFE_TO_DEPLOY = 'NO'
    ERROR = $errorMessage
    ROLLBACK = if ($changedEntries.Count -gt 0) { 'ATTEMPTED' } else { 'NOT_REQUIRED' }
    PRODUCTION_TOUCHED = if ($changedEntries.Count -gt 0) { 'ROLLED_BACK' } else { 'NO' }
  } | ConvertTo-Json -Depth 8
  exit 1
}
