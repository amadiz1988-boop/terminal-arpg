[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$toolPath = Join-Path $sourceRoot 'ops\ro-stack\deploy-dashboard-checkpoint.ps1'
$commit = '0234df429099a8bab5f7882b149fd963a28aa6a9'
$parent = (git -C $sourceRoot rev-parse "$commit^").Trim()
$dashboardPath = 'ops/ro-stack/dashboard.mjs'
$modulePath = 'ops/ro-stack/persistent-agent/admin-fixture-navigation.mjs'
$authorized = @($dashboardPath, $modulePath)
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dashboard-checkpoint-test-$([guid]::NewGuid().ToString('N'))"
$tests = [System.Collections.Generic.List[object]]::new()

function Invoke-NativeBytes {
  param([string]$FileName, [string[]]$Arguments, [string]$WorkingDirectory = $sourceRoot)
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
  [void]$process.Start()
  $output = [System.IO.MemoryStream]::new()
  $process.StandardOutput.BaseStream.CopyTo($output)
  $errorText = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  [pscustomobject]@{ ExitCode = $process.ExitCode; Bytes = $output.ToArray(); Text = [System.Text.Encoding]::UTF8.GetString($output.ToArray()); Error = $errorText }
}

function Get-BlobBytes([string]$Commitish, [string]$Path) {
  $hash = (git -C $sourceRoot rev-parse --verify "${Commitish}:$Path" 2>$null).Trim()
  $result = Invoke-NativeBytes -FileName 'git' -Arguments @('cat-file', 'blob', $hash)
  if ($result.ExitCode -ne 0) { throw "Unable to read blob $Commitish`:$Path" }
  return $result.Bytes
}

function Get-Sha256([byte[]]$Bytes) {
  $digest = [System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)
  return (($digest | ForEach-Object { $_.ToString('x2') }) -join '').ToUpperInvariant()
}

function New-Fixture([string]$Name, [byte[]]$DashboardBytes, [byte[]]$ModuleBytes = $null) {
  $root = Join-Path $testRoot $Name
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'ops\ro-stack\persistent-agent') | Out-Null
  [System.IO.File]::WriteAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs'), $DashboardBytes)
  if ($null -ne $ModuleBytes) {
    [System.IO.File]::WriteAllBytes((Join-Path $root 'ops\ro-stack\persistent-agent\admin-fixture-navigation.mjs'), $ModuleBytes)
  }
  return $root
}

function Invoke-Tool([string]$Root, [string[]]$Extra, [string[]]$Paths = $authorized) {
  $arguments = @('-NoProfile', '-File', $toolPath, '-SourceCommit', $commit, '-AuthorizedPaths', ($Paths -join ','), '-ProductionRoot', $Root) + $Extra
  $output = @(& pwsh @arguments 2>&1 | ForEach-Object { $_.ToString() })
  [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output = ($output -join "`n")
    Json = if ($output.Count) { try { $output -join "`n" | ConvertFrom-Json } catch { $null } } else { $null }
  }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Run-Test([string]$Name, [scriptblock]$Body) {
  try { & $Body; $tests.Add([pscustomobject]@{ name = $Name; status = 'PASS' }) }
  catch { $tests.Add([pscustomobject]@{ name = $Name; status = 'FAIL'; error = $_.Exception.Message }) }
}

$parentDashboard = Get-BlobBytes $parent $dashboardPath
$targetModule = Get-BlobBytes $commit $modulePath
$targetDashboard = Get-BlobBytes $commit $dashboardPath

try {
  Run-Test 'parent preimage builds exact committed result' {
    $root = New-Fixture 'parent-exact' $parentDashboard
    $pre = Invoke-Tool -Root $root -Extra @('-Precheck')
    Assert-True ($pre.ExitCode -eq 0) $pre.Output
    Assert-True ($pre.Json.SAFE_TO_DEPLOY -eq 'YES') 'parent preimage was not safe'
    $deploy = Invoke-Tool -Root $root -Extra @('-Deploy', '-TestMode', '-SkipRestart')
    Assert-True ($deploy.ExitCode -eq 0) $deploy.Output
    Assert-True ((Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))) -eq (Get-Sha256 $targetDashboard)) 'dashboard target differs'
  }

  Run-Test 'unrelated production change outside delta is preserved' {
    $bytes = [byte[]]($parentDashboard + [Text.Encoding]::UTF8.GetBytes("`r`n// SAFE_UNRELATED_PRODUCTION_LINE`r`n"))
    $root = New-Fixture 'unrelated-change' $bytes
    $deploy = Invoke-Tool -Root $root -Extra @('-Deploy', '-TestMode', '-SkipRestart')
    Assert-True ($deploy.ExitCode -eq 0) $deploy.Output
    $text = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))
    Assert-True ($text.Contains('SAFE_UNRELATED_PRODUCTION_LINE')) 'unrelated production content was lost'
    Assert-True ($text.Contains('PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER')) 'committed delta was not applied'
  }

  Run-Test 'conflict inside committed preimage fails closed' {
    $text = [Text.Encoding]::UTF8.GetString($parentDashboard).Replace('const execFileAsync = promisify(execFile);', 'const execFileAsync = promisify(execFile); // CONFLICT')
    $root = New-Fixture 'preimage-conflict' ([Text.Encoding]::UTF8.GetBytes($text))
    $before = Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))
    $pre = Invoke-Tool -Root $root -Extra @('-Precheck')
    Assert-True ($pre.ExitCode -ne 0) 'preimage conflict unexpectedly passed'
    Assert-True ($pre.Json.SAFE_TO_DEPLOY -eq 'NO') 'conflict did not report SAFE_TO_DEPLOY=NO'
    Assert-True ((Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))) -eq $before) 'conflict mutated production fixture'
  }

  Run-Test 'new target file absent passes' {
    $root = New-Fixture 'new-file-absent' $parentDashboard
    $pre = Invoke-Tool -Root $root -Extra @('-Precheck')
    Assert-True ($pre.ExitCode -eq 0) $pre.Output
    Assert-True ($pre.Json.SAFE_TO_DEPLOY -eq 'YES') 'absent new file was not safe'
  }

  Run-Test 'unexpected new target collision fails closed' {
    $root = New-Fixture 'new-file-collision' $parentDashboard ([Text.Encoding]::UTF8.GetBytes('unknown production source'))
    $pre = Invoke-Tool $root @('-Precheck')
    Assert-True ($pre.ExitCode -ne 0) 'new file collision unexpectedly passed'
    Assert-True ([bool]($pre.Json.CONFLICTS -match 'TARGET_PATH_COLLISION')) 'collision reason missing'
  }

  Run-Test 'dirty working tree cannot become deployment input' {
    $workingTreeHash = (git -C $sourceRoot hash-object --no-filters -- ops/ro-stack/dashboard.mjs).Trim()
    $targetHash = (git -C $sourceRoot rev-parse "$commit`:$dashboardPath").Trim()
    Assert-True ($workingTreeHash -ne $targetHash) 'working tree unexpectedly equals target blob'
    $root = New-Fixture 'dirty-source-isolation' $parentDashboard
    $deploy = Invoke-Tool -Root $root -Extra @('-Deploy', '-TestMode', '-SkipRestart')
    Assert-True ($deploy.ExitCode -eq 0) $deploy.Output
    Assert-True ((Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))) -eq (Get-Sha256 $targetDashboard)) 'deployment used dirty bytes'
  }

  Run-Test 'unauthorized path is rejected' {
    $root = New-Fixture 'unauthorized-path' $parentDashboard
    $pre = Invoke-Tool -Root $root -Extra @('-Precheck') -Paths @('ops/ro-stack/dashboard-service.ps1')
    Assert-True ($pre.ExitCode -ne 0) 'unauthorized path unexpectedly passed'
    Assert-True ($pre.Json.ERROR -match 'UNAUTHORIZED_PATH') 'unauthorized path reason missing'
  }

  Run-Test 'partial staging failure leaves production unchanged' {
    $root = New-Fixture 'partial-stage-failure' $parentDashboard
    $before = Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))
    $pre = Invoke-Tool -Root $root -Extra @('-Precheck', '-TestMode', '-SimulateStageFailureAfter', '1')
    Assert-True ($pre.ExitCode -ne 0) 'partial staging failure unexpectedly passed'
    Assert-True ((Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))) -eq $before) 'partial staging mutated production fixture'
  }

  Run-Test 'restart failure rolls back exact deployed files' {
    $root = New-Fixture 'restart-failure' $parentDashboard
    $before = Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))
    $deploy = Invoke-Tool -Root $root -Extra @('-Deploy', '-TestMode', '-SimulateRestartFailure')
    Assert-True ($deploy.ExitCode -ne 0) 'restart failure unexpectedly passed'
    Assert-True ((Get-Sha256 ([IO.File]::ReadAllBytes((Join-Path $root 'ops\ro-stack\dashboard.mjs')))) -eq $before) 'dashboard rollback hash mismatch'
    Assert-True (-not (Test-Path (Join-Path $root 'ops\ro-stack\persistent-agent\admin-fixture-navigation.mjs'))) 'new file rollback failed'
  }

  Run-Test 'receipt records deterministic source and post hashes' {
    $root = New-Fixture 'receipt' $parentDashboard
    $receipt = Join-Path $root 'receipt.json'
    $deploy = Invoke-Tool -Root $root -Extra @('-Deploy', '-TestMode', '-SkipRestart', '-ReceiptPath', $receipt)
    Assert-True ($deploy.ExitCode -eq 0) $deploy.Output
    $record = Get-Content -Raw $receipt | ConvertFrom-Json
    Assert-True ($record.SOURCE_COMMIT -eq $commit) 'receipt source commit mismatch'
    Assert-True ($record.SOURCE_PARENT -eq $parent) 'receipt source parent mismatch'
    Assert-True ($record.AUTHORIZED_PATHS.Count -eq 2) 'receipt authorized paths mismatch'
    Assert-True ($record.FILES.Count -eq 2) 'receipt file count mismatch'
    Assert-True ([bool]$record.FILES[0].production_post_hash) 'receipt post hash missing'
  }
} finally {
  if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}

$failed = @($tests | Where-Object status -eq 'FAIL')
$tests | ForEach-Object {
  if ($_.status -eq 'PASS') { Write-Output "PASS  $($_.name)" }
  else { Write-Output "FAIL  $($_.name): $($_.error)" }
}
Write-Output ("`n{0}/{1} dashboard checkpoint deployment checks passed" -f ($tests.Count - $failed.Count), $tests.Count)
if ($failed.Count) { exit 1 }
