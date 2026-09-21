[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$guardPath = Join-Path $repoRoot 'ops\ro-stack\runtime-guard.ps1'
$libPath = Join-Path $repoRoot 'ops\ro-stack\runtime-guard.lib.ps1'
$serverNames = @('login-server.exe', 'char-server.exe', 'map-server.exe')
$retiredPorts = @(6902, 6123, 5123, 8792, 6904, 6124, 5124, 6905, 6125, 5125)
$canonicalRoot = 'C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\rathena'

. $libPath

$tests = @()
function Add-Result([string]$name, [bool]$passed, [string]$detail = '') {
  $script:tests += [pscustomobject]@{ name = $name; status = $(if ($passed) { 'PASS' } else { 'FAIL' }); detail = $detail }
}

function Invoke-Guard([string]$slot, [string]$action) {
  $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $guardPath -Slot $slot -Action $action 2>&1 | Out-String
  return [pscustomobject]@{ output = $output.Trim(); exit = $LASTEXITCODE }
}

function Server([int]$processId, [string]$name, [string]$path) {
  return [pscustomobject]@{ pid = $processId; name = $name; path = $path }
}
function Listener([int]$port, [int]$processId) {
  return [pscustomobject]@{ LocalPort = $port; OwningProcess = $processId }
}
function Violations($servers, $listeners) {
  return @(Get-RAthenaRuntimeViolations -Servers $servers -Listeners $listeners -CanonicalRoot $canonicalRoot -RetiredPorts $retiredPorts -ServerNames $serverNames)
}

$cleanServers = @(
  (Server 1 'login-server.exe' (Join-Path $canonicalRoot 'login-server.exe')),
  (Server 2 'char-server.exe' (Join-Path $canonicalRoot 'char-server.exe')),
  (Server 3 'map-server.exe' (Join-Path $canonicalRoot 'map-server.exe'))
)
$cleanListeners = @((Listener 6901 1), (Listener 6122 2), (Listener 5122 3))

$result = Violations $cleanServers $cleanListeners
Add-Result 'canonical single runtime has no violations' ($result.Count -eq 0) ($result -join '; ')

$duplicate = Violations ($cleanServers + (Server 4 'map-server.exe' (Join-Path $canonicalRoot 'map-server.exe'))) $cleanListeners
Add-Result 'duplicate map-server.exe is flagged' ([bool]($duplicate -match 'duplicate_map-server\.exe_count=2')) ($duplicate -join '; ')

$foreign = Violations @((Server 1 'login-server.exe' (Join-Path $canonicalRoot 'login-server.exe')), (Server 9 'map-server.exe' 'C:\tmp\.tmp-retired-runtime\rathena\map-server.exe')) @((Listener 6901 1), (Listener 5122 9))
Add-Result 'non-canonical runtime path is flagged' ([bool]($foreign -match 'non_canonical_runtime')) ($foreign -join '; ')

$retiredPort = Violations $cleanServers ($cleanListeners + (Listener 6124 77))
Add-Result 'retired port listener is flagged' ([bool]($retiredPort -match 'retired_port_listener port=6124 pid=77')) ($retiredPort -join '; ')

foreach ($slot in @('A', 'B', 'B2', 'C', 'Retired-B')) {
  $probe = Invoke-Guard $slot 'Validate'
  $ok = ($probe.exit -eq 4) -and ($probe.output -match 'UNAUTHORIZED_RATHENA_RUNTIME')
  Add-Result "retired slot $slot is denied with UNAUTHORIZED_RATHENA_RUNTIME" $ok "exit=$($probe.exit) out=$($probe.output)"
}

$canonicalProbe = Invoke-Guard 'Production' 'Guard'
Add-Result 'canonical Production guard passes' (($canonicalProbe.exit -eq 0) -and ($canonicalProbe.output -match 'RUNTIME_GUARD_OK')) "exit=$($canonicalProbe.exit) out=$($canonicalProbe.output)"

$guardSource = Get-Content $guardPath -Raw
$retiredRootsGone = -not (($guardSource -match 'test_web_core_a') -or ($guardSource -match '\.tmp-web-core-a-runtime') -or ($guardSource -match 'test_pa_reclaim'))
Add-Result 'guard source no longer authorizes retired A/B/B2 roots' $retiredRootsGone ''
$tokenPresent = ($guardSource -match 'UNAUTHORIZED_RATHENA_RUNTIME') -and ($guardSource -match 'retiredPorts')
Add-Result 'guard source carries the single-runtime policy token' $tokenPresent ''

$failed = @($tests | Where-Object { $_.status -eq 'FAIL' })
[pscustomobject]@{
  result = if ($failed.Count) { 'SINGLE_RUNTIME_GUARD_TEST_FAIL' } else { 'SINGLE_RUNTIME_GUARD_TEST_PASS' }
  total = $tests.Count
  failed = $failed.Count
  tests = $tests
} | ConvertTo-Json -Depth 5

if ($failed.Count) { exit 1 }
