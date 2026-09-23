[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$tool = (Resolve-Path (Join-Path $PSScriptRoot '..\deploy-dashboard-manifest.ps1')).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "manifest-tool-test-$([guid]::NewGuid().ToString('N'))"
$paths = @(
  'ops/ro-stack/dashboard.mjs',
  'ops/ro-stack/dashboard/app.js',
  'ops/ro-stack/web-experience/production-telemetry.mjs'
)
$checks = [Collections.Generic.List[object]]::new()

function Assert([bool]$Condition, [string]$Reason) {
  if (-not $Condition) { throw $Reason }
}

function New-Fixture([string]$Name) {
  $root = Join-Path $testRoot $Name
  $candidate = Join-Path $root 'candidate'
  $production = Join-Path $root 'production'
  $files = @()
  foreach ($path in $paths) {
    $source = Join-Path $candidate ($path.Replace('/', '\'))
    $target = Join-Path $production ($path.Replace('/', '\'))
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $source), (Split-Path -Parent $target) | Out-Null
    [IO.File]::WriteAllText($source, "export const fixture = 'candidate:$Name`:$path';")
    [IO.File]::WriteAllText($target, "export const fixture = 'preimage:$Name`:$path';")
    $files += [ordered]@{
      path = $path
      candidate_sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
      production_preimage_sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    }
  }
  $unlisted = Join-Path $production 'ops\ro-stack\dashboard\untouched.css'
  [IO.File]::WriteAllText($unlisted, 'keep-this-exact')
  $manifest = Join-Path $root 'manifest.json'
  [ordered]@{
    candidate_commit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    candidate_root = $candidate
    production_root = $production
    files = $files
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding utf8
  return [pscustomobject]@{
    Root = $root; Candidate = $candidate; Production = $production
    Manifest = $manifest; Files = $files; Unlisted = $unlisted
  }
}

function Invoke-Tool($Fixture, [string[]]$Arguments) {
  $output = @(& pwsh -NoProfile -File $tool -Manifest $Fixture.Manifest -ProductionRoot $Fixture.Production -TestMode @Arguments 2>&1)
  $code = $LASTEXITCODE
  $json = try { ($output -join "`n") | ConvertFrom-Json } catch { $null }
  return [pscustomobject]@{ ExitCode = $code; Json = $json; Output = $output -join "`n" }
}

function Add-NewDependency($Fixture, [bool]$IncludeInManifest) {
  $relative = 'ops/ro-stack/persistent-agent/fixture-dependency.mjs'
  $source = Join-Path $Fixture.Candidate ($relative.Replace('/', '\'))
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $source) | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $Fixture.Production 'ops\ro-stack\persistent-agent') | Out-Null
  [IO.File]::WriteAllText($source, "export const dependency = true;")
  $entry = Join-Path $Fixture.Candidate 'ops\ro-stack\dashboard.mjs'
  [IO.File]::WriteAllText($entry, "import { dependency } from './persistent-agent/fixture-dependency.mjs';`nexport const fixture = dependency;")
  $manifest = Get-Content -LiteralPath $Fixture.Manifest -Raw | ConvertFrom-Json
  $manifest.files[0].candidate_sha256 = (Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash
  if ($IncludeInManifest) {
    $manifest.files += [pscustomobject]@{
      path = $relative
      candidate_sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
      production_preimage = 'ABSENT'
    }
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Fixture.Manifest -Encoding utf8
  return $relative
}

function Set-ManifestFileCount($Fixture, [int]$Count) {
  $manifest = Get-Content -LiteralPath $Fixture.Manifest -Raw | ConvertFrom-Json
  for ($index = $manifest.files.Count; $index -lt $Count; $index++) {
    $relative = 'ops/ro-stack/dashboard/capacity-{0:D3}.js' -f $index
    $source = Join-Path $Fixture.Candidate ($relative.Replace('/', '\'))
    $target = Join-Path $Fixture.Production ($relative.Replace('/', '\'))
    [IO.File]::WriteAllText($source, "export const fixture = $index;")
    [IO.File]::WriteAllText($target, "export const fixture = -$index;")
    $manifest.files += [pscustomobject]@{
      path = $relative
      candidate_sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
      production_preimage_sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    }
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Fixture.Manifest -Encoding utf8
  $Fixture.Files = @($manifest.files)
}

function Assert-Preimage($Fixture) {
  foreach ($file in $Fixture.Files) {
    $target = Join-Path $Fixture.Production ($file.path.Replace('/', '\'))
    Assert ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $file.production_preimage_sha256) "preimage drift: $($file.path)"
  }
  Assert ([IO.File]::ReadAllText($Fixture.Unlisted) -eq 'keep-this-exact') 'unlisted file changed'
}

function Run-Test([string]$Name, [scriptblock]$Body) {
  try { & $Body; $checks.Add([pscustomobject]@{ name = $Name; status = 'PASS' }) }
  catch { $checks.Add([pscustomobject]@{ name = $Name; status = 'FAIL'; reason = $_.Exception.Message }) }
}

try {
  Run-Test 'valid precheck is read-only' {
    $f = New-Fixture 'precheck'
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -eq 0 -and $r.Json.result -eq 'PRECHECK_PASS') $r.Output
    Assert ($r.Json.file_count -eq 3 -and -not $r.Json.production_touched) 'precheck receipt invalid'
    Assert ($r.Json.candidate_root -ceq $f.Candidate) 'precheck candidate root differs from manifest source'
    Assert-Preimage $f
  }
  Run-Test 'bad production preimage fails closed' {
    $f = New-Fixture 'bad-preimage'
    [IO.File]::AppendAllText((Join-Path $f.Production ($paths[0].Replace('/', '\'))), 'changed')
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -ne 0 -and $r.Json.error -match 'CURRENT_HASH_MISMATCH') $r.Output
  }
  Run-Test 'bad candidate hash fails closed' {
    $f = New-Fixture 'bad-candidate'
    [IO.File]::AppendAllText((Join-Path $f.Candidate ($paths[0].Replace('/', '\'))), 'changed')
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -ne 0 -and $r.Json.error -match 'CANDIDATE_HASH_MISMATCH') $r.Output
    Assert-Preimage $f
  }
  Run-Test 'unauthorized path fails closed' {
    $f = New-Fixture 'unauthorized'
    $m = Get-Content -LiteralPath $f.Manifest -Raw | ConvertFrom-Json
    $m.files[0].path = 'ops/ro-stack/ro-stack.ps1'
    $m | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $f.Manifest -Encoding utf8
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -ne 0 -and $r.Json.error -match 'UNAUTHORIZED_WEB_PATH') $r.Output
    Assert-Preimage $f
  }
  Run-Test 'mid-deploy failure restores every preimage' {
    $f = New-Fixture 'mid-failure'
    $r = Invoke-Tool $f @('-Deploy', '-SimulateFailureAfter', '1')
    Assert ($r.ExitCode -ne 0 -and $r.Json.rollback -eq 'PREIMAGE_RESTORED') $r.Output
    Assert ($r.Json.failure_receipt -and (Test-Path -LiteralPath $r.Json.failure_receipt)) 'failure receipt path not returned'
    Assert-Preimage $f
    $failures = @(Get-ChildItem -LiteralPath (Join-Path $f.Production '.local\ro-stack\dashboard\deploy-receipts') -Recurse -File -Filter 'failure-*.json')
    Assert ($failures.Count -eq 1) 'failure receipt missing'
    $failureReceipt = Get-Content -LiteralPath $failures[0].FullName -Raw | ConvertFrom-Json
    Assert ($failureReceipt.candidate_root -ceq $f.Candidate) 'failure receipt candidate root differs from manifest source'
    Assert ($failureReceipt.status -eq 'FAILED' -and $failureReceipt.failure_phase -eq 'FILE_REPLACEMENT') 'failure phase missing'
    Assert ($failureReceipt.automatic_rollback_attempted -and $failureReceipt.final_preimage_validation.pass) 'automatic rollback proof missing'
  }
  Run-Test 'successful deploy and full rollback preserve unlisted files' {
    $f = New-Fixture 'full-cycle'
    $deploy = Invoke-Tool $f @('-Deploy')
    Assert ($deploy.ExitCode -eq 0 -and $deploy.Json.result -eq 'DEPLOY_PASS') $deploy.Output
    $receipt = Get-Content -LiteralPath $deploy.Json.receipt -Raw | ConvertFrom-Json
    Assert ($receipt.mode -eq 'DEPLOY' -and $receipt.files.Count -eq 3) 'deploy receipt incomplete'
    Assert ($receipt.candidate_root -ceq $f.Candidate) 'deploy receipt candidate root differs from manifest source'
    Assert ($receipt.dashboard_pid_before -ne $receipt.dashboard_pid_after) 'dashboard PID did not change'
    foreach ($file in $f.Files) {
      $target = Join-Path $f.Production ($file.path.Replace('/', '\'))
      Assert ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $file.candidate_sha256) "candidate hash mismatch: $($file.path)"
      $source = Join-Path $f.Candidate ($file.path.Replace('/', '\'))
      Remove-Item -LiteralPath $source -Force
    }
    Assert ([IO.File]::ReadAllText($f.Unlisted) -eq 'keep-this-exact') 'unlisted file changed during deploy'
    $output = @(& pwsh -NoProfile -File $tool -ProductionRoot $f.Production -TestMode -Rollback -ReceiptPath $deploy.Json.receipt 2>&1)
    $rollback = [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output -join "`n";
      Json = try { ($output -join "`n") | ConvertFrom-Json } catch { $null } }
    Assert ($rollback.ExitCode -eq 0 -and $rollback.Json.result -eq 'ROLLBACK_PASS') $rollback.Output
    $rollbackReceipt = Get-Content -LiteralPath $rollback.Json.receipt -Raw | ConvertFrom-Json
    Assert ($rollbackReceipt.rollback_performed -and $rollbackReceipt.final_state -eq 'ORIGINAL_PREIMAGE') 'rollback receipt incomplete'
    Assert ($rollbackReceipt.candidate_root -ceq $f.Candidate) 'rollback receipt candidate root differs from manifest source'
    Assert-Preimage $f
  }
  Run-Test '256 explicit files pass precheck without mutation' {
    $f = New-Fixture 'capacity-256'
    Set-ManifestFileCount $f 256
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -eq 0 -and $r.Json.result -eq 'PRECHECK_PASS') $r.Output
    Assert ($r.Json.file_count -eq 256 -and -not $r.Json.production_touched) 'capacity precheck receipt invalid'
    Assert-Preimage $f
  }
  Run-Test '257 explicit files fail bounded manifest gate' {
    $f = New-Fixture 'capacity-257'
    Set-ManifestFileCount $f 257
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -ne 0 -and $r.Json.error -eq 'MANIFEST_FILE_COUNT_OUT_OF_BOUNDS') $r.Output
    Assert (-not $r.Json.production_touched) 'out-of-bounds precheck mutated Production fixture'
    Assert-Preimage $f
  }
  Run-Test 'rollback rejects receipt candidate root mismatch' {
    $f = New-Fixture 'root-mismatch'
    $deploy = Invoke-Tool $f @('-Deploy')
    Assert ($deploy.ExitCode -eq 0 -and $deploy.Json.result -eq 'DEPLOY_PASS') $deploy.Output
    $receipt = Get-Content -LiteralPath $deploy.Json.receipt -Raw | ConvertFrom-Json
    $receipt.candidate_root = Join-Path $f.Root 'other-candidate'
    $receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $deploy.Json.receipt -Encoding utf8
    $output = @(& pwsh -NoProfile -File $tool -ProductionRoot $f.Production -TestMode -Rollback -ReceiptPath $deploy.Json.receipt 2>&1)
    $result = try { ($output -join "`n") | ConvertFrom-Json } catch { $null }
    Assert ($LASTEXITCODE -ne 0 -and $result.error -eq 'ROLLBACK_RECEIPT_MISMATCH') ($output -join "`n")
    foreach ($file in $f.Files) {
      $target = Join-Path $f.Production ($file.path.Replace('/', '\'))
      Assert ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $file.candidate_sha256) "candidate file changed after refused rollback: $($file.path)"
    }
  }
  Run-Test 'rollback succeeds with candidate Dashboard down' {
    $f = New-Fixture 'down-rollback'
    $deploy = Invoke-Tool $f @('-Deploy')
    Assert ($deploy.ExitCode -eq 0 -and $deploy.Json.result -eq 'DEPLOY_PASS') $deploy.Output
    $output = @(& pwsh -NoProfile -File $tool -ProductionRoot $f.Production -TestMode -Rollback -SimulateDashboardDown -ReceiptPath $deploy.Json.receipt 2>&1)
    $code = $LASTEXITCODE
    $rollback = try { ($output -join "`n") | ConvertFrom-Json } catch { $null }
    Assert ($code -eq 0 -and $rollback.result -eq 'ROLLBACK_PASS') ($output -join "`n")
    Assert ($rollback.runtime.Counts[3] -eq 1 -and $rollback.runtime.Health) 'Dashboard was not restored'
    Assert-Preimage $f
  }
  Run-Test 'missing imported module rejects precheck before mutation' {
    $f = New-Fixture 'missing-import'
    $dependency = Add-NewDependency $f $false
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -ne 0 -and $r.Json.error -match 'DEPLOYMENT_RUNTIME_CLOSURE_FAILED') $r.Output
    Assert (-not $r.Json.production_touched) 'precheck mutated Production fixture'
    Assert (-not (Test-Path -LiteralPath (Join-Path $f.Production $dependency))) 'missing dependency appeared in Production fixture'
    Assert-Preimage $f
  }
  Run-Test 'new dependency deploys and explicit rollback removes only listed new file' {
    $f = New-Fixture 'new-dependency'
    $dependency = Add-NewDependency $f $true
    $precheck = Invoke-Tool $f @('-Precheck')
    Assert ($precheck.ExitCode -eq 0 -and $precheck.Json.post_deploy_import_closure) $precheck.Output
    $deploy = Invoke-Tool $f @('-Deploy')
    Assert ($deploy.ExitCode -eq 0 -and $deploy.Json.result -eq 'DEPLOY_PASS') $deploy.Output
    Assert (Test-Path -LiteralPath (Join-Path $f.Production $dependency)) 'new dependency not delivered'
    $output = @(& pwsh -NoProfile -File $tool -ProductionRoot $f.Production -TestMode -Rollback -ReceiptPath $deploy.Json.receipt 2>&1)
    $rollback = try { ($output -join "`n") | ConvertFrom-Json } catch { $null }
    Assert ($LASTEXITCODE -eq 0 -and $rollback.result -eq 'ROLLBACK_PASS') ($output -join "`n")
    Assert (-not (Test-Path -LiteralPath (Join-Path $f.Production $dependency))) 'new dependency remained after rollback'
    Assert-Preimage $f
  }
  Run-Test 'failed start writes bounded failure receipt and removes new file' {
    $f = New-Fixture 'failed-start'
    $dependency = Add-NewDependency $f $true
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-Tool $f @('-Deploy', '-SimulateStartFailure')
    $watch.Stop()
    Assert ($r.ExitCode -ne 0 -and $watch.Elapsed.TotalSeconds -lt 30) $r.Output
    Assert ($r.Json.failure_receipt -and (Test-Path -LiteralPath $r.Json.failure_receipt)) 'failed start receipt path not returned'
    $failures = @(Get-ChildItem -LiteralPath (Join-Path $f.Production '.local\ro-stack\dashboard\deploy-receipts') -Recurse -File -Filter 'failure-*.json')
    Assert ($failures.Count -eq 1) 'failure receipt missing'
    $receipt = Get-Content -LiteralPath $failures[0].FullName -Raw | ConvertFrom-Json
    Assert ($receipt.status -eq 'FAILED' -and $receipt.failure_phase -eq 'DASHBOARD_START') 'failure receipt phase invalid'
    Assert ($receipt.candidate_root -ceq $f.Candidate -and $receipt.manifest_hash) 'failure provenance incomplete'
    Assert ($receipt.automatic_rollback_result -eq 'PREIMAGE_RESTORED' -and $receipt.final_preimage_validation.pass) 'automatic rollback proof missing'
    Assert (-not (Test-Path -LiteralPath (Join-Path $f.Production $dependency))) 'new dependency remained after failed deploy'
    Assert-Preimage $f
  }
  Run-Test 'occupied new-file target is rejected before mutation' {
    $f = New-Fixture 'occupied-target'
    $dependency = Add-NewDependency $f $true
    $target = Join-Path $f.Production $dependency
    [IO.File]::WriteAllText($target, 'unlisted-owner')
    $r = Invoke-Tool $f @('-Precheck')
    Assert ($r.ExitCode -ne 0 -and $r.Json.error -match 'TARGET_EXPECTED_ABSENT') $r.Output
    Assert ([IO.File]::ReadAllText($target) -eq 'unlisted-owner') 'occupied target changed'
    Assert-Preimage $f
  }
  Run-Test 'rollback refuses changed new file without deleting it' {
    $f = New-Fixture 'new-file-drift'
    $dependency = Add-NewDependency $f $true
    $deploy = Invoke-Tool $f @('-Deploy')
    Assert ($deploy.ExitCode -eq 0 -and $deploy.Json.result -eq 'DEPLOY_PASS') $deploy.Output
    $target = Join-Path $f.Production $dependency
    [IO.File]::WriteAllText($target, 'changed-after-deploy')
    $output = @(& pwsh -NoProfile -File $tool -ProductionRoot $f.Production -TestMode -Rollback -ReceiptPath $deploy.Json.receipt 2>&1)
    $rollback = try { ($output -join "`n") | ConvertFrom-Json } catch { $null }
    Assert ($LASTEXITCODE -ne 0 -and $rollback.error -match 'CURRENT_HASH_MISMATCH') ($output -join "`n")
    Assert ([IO.File]::ReadAllText($target) -eq 'changed-after-deploy') 'unknown changed file deleted'
    Assert ([IO.File]::ReadAllText($f.Unlisted) -eq 'keep-this-exact') 'unlisted file changed'
  }
} finally {
  $resolved = [IO.Path]::GetFullPath($testRoot)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path -Leaf $resolved) -notlike 'manifest-tool-test-*') {
    throw 'UNSAFE_TEST_CLEANUP_TARGET'
  }
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}

$failed = @($checks | Where-Object status -eq 'FAIL')
$checks | ForEach-Object { if ($_.status -eq 'PASS') { "PASS $($_.name)" } else { "FAIL $($_.name): $($_.reason)" } }
"$($checks.Count - $failed.Count)/$($checks.Count) manifest deployment checks passed"
if ($failed.Count) { exit 1 }
