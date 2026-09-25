$ErrorActionPreference = 'Stop'
$launcher = Join-Path (Split-Path -Parent $PSScriptRoot) 'ro-stack.ps1'
$source = [IO.File]::ReadAllText($launcher).Replace("`r`n", "`n")
$patterns = @(
  '(?m)^  \$m1SupplyLivePreflightMigration = .*\n',
  '(?m)^  Invoke-MariaDb \$DatabaseRootPassword "source \$m1SupplyLivePreflightMigration" \$config.MainDatabase\n',
  '(?m)^      \$previousAgentM1SupplyEnabled = \$env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED\n',
  '(?m)^        if \(\$config.ContainsKey\(''PersistentAgentM1SupplyEnabled''\).*\n',
  '(?m)^        \$env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED = .*\n',
  '(?m)^          if \(\$null -eq \$previousAgentM1SupplyEnabled\).*\n'
)
$baseline = $source
foreach ($pattern in $patterns) {
  $hits = [regex]::Matches($baseline, $pattern)
  if ($hits.Count -ne 1) { throw "M1_LAUNCHER_DELTA_NOT_EXACT:${pattern}:$($hits.Count)" }
  $baseline = [regex]::Replace($baseline, $pattern, '')
}
$sha = [Security.Cryptography.SHA256]::Create()
try {
  $actual = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($baseline))).Replace('-', '')
} finally { $sha.Dispose() }
if ($actual -ne 'EE6B81E2C0AF6586D890A0296C822152B82256FC342C7198DAE433BFBFA85314') {
  throw "PRODUCTION_LAUNCHER_BASELINE_CHANGED:$actual"
}
Write-Host 'PASS production launcher capability baseline, startup arguments, SP, fixture, lifecycle and unknown-key policy unchanged'

$guardLine = @($source -split "`n" | Where-Object { $_ -match '^        if \(\$config.ContainsKey\(''PersistentAgentM1SupplyEnabled''\)' })
$projectLine = @($source -split "`n" | Where-Object { $_ -match '^        \$env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED = ' })
if ($guardLine.Count -ne 1 -or $projectLine.Count -ne 1) { throw 'M1_PROJECTION_NOT_UNIQUE' }
$guard = [scriptblock]::Create($guardLine[0])
$project = [scriptblock]::Create($projectLine[0])
$previous = $env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED
try {
  foreach ($case in @(
    @{ name = 'absent'; config = @{}; expected = '0' },
    @{ name = 'false'; config = @{ PersistentAgentM1SupplyEnabled = $false }; expected = '0' },
    @{ name = 'true'; config = @{ PersistentAgentM1SupplyEnabled = $true }; expected = '1' }
  )) {
    $config = $case.config
    & $guard
    & $project
    if ($env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED -ne $case.expected) { throw "M1_PROJECTION_WRONG:$($case.name)" }
    Write-Host "PASS M1 projection $($case.name)=$($case.expected)"
  }
  $config = @{ PersistentAgentM1SupplyEnabled = 'true' }
  $rejected = $false
  try { & $guard } catch { $rejected = $_.Exception.Message -eq 'PERSISTENT_AGENT_M1_SUPPLY_CONFIG_INVALID' }
  if (-not $rejected) { throw 'INVALID_M1_SUPPLY_CONFIG_ACCEPTED' }
  Write-Host 'PASS invalid M1 Supply config rejected'
} finally {
  if ($null -eq $previous) { Remove-Item Env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED -ErrorAction SilentlyContinue }
  else { $env:PERSISTENT_AGENT_M1_SUPPLY_ENABLED = $previous }
}
Write-Host 'M1_SUPPLY_LAUNCHER_PROJECTION_TESTS = PASS (5)'
