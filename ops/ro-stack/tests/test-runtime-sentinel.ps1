[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$sentinelPath = Join-Path $repoRoot 'ops\ro-stack\runtime-sentinel.ps1'
$libPath = Join-Path $repoRoot 'ops\ro-stack\runtime-sentinel.lib.ps1'
$canonicalRoot = 'C:\canonical\rathena'
$canonicalPorts = @{ login = 6901; char = 6122; map = 5122 }
$serverNames = @('login-server.exe', 'char-server.exe', 'map-server.exe')

. $libPath

$tests = @()
function Add-Result([string]$name, [bool]$passed, [string]$detail = '') {
  $script:tests += [pscustomobject]@{ name = $name; status = $(if ($passed) { 'PASS' } else { 'FAIL' }); detail = $detail }
}
function Server([int]$processId, [string]$name, [string]$path, [int[]]$ports = @()) {
  return [pscustomobject]@{ pid = $processId; name = $name; path = $path; ports = $ports }
}
function PortPath([string]$file) { return (Join-Path $canonicalRoot $file) }
function Decide($servers, $designated = @()) {
  return Get-RAthenaProcessDecision -Servers $servers -CanonicalRoot $canonicalRoot -CanonicalPorts $canonicalPorts -ServerNames $serverNames -CanonicalPids $designated
}

$clean = @(
  (Server 1 'login-server.exe' (PortPath 'login-server.exe') @(6901)),
  (Server 2 'char-server.exe' (PortPath 'char-server.exe') @(6122)),
  (Server 3 'map-server.exe' (PortPath 'map-server.exe') @(5122))
)
$cleanDecision = Decide $clean
Add-Result 'clean canonical 1/1/1 has no unauthorized' ($cleanDecision.unauthorized.Count -eq 0 -and $cleanDecision.survivors.Count -eq 3) "unauth=$($cleanDecision.unauthorized.Count) survivors=$($cleanDecision.survivors -join ',')"

$secondCanonical = $clean + (Server 4 'map-server.exe' (PortPath 'map-server.exe') @())
$dupDecision = Decide $secondCanonical
$dupUnauth = @($dupDecision.unauthorized)
Add-Result 'second canonical map is unauthorized UNAUTHORIZED_SECOND_MAP' ([bool]($dupUnauth | Where-Object { $_.reason -eq 'UNAUTHORIZED_SECOND_MAP' -and $_.pid -eq 4 })) ($dupUnauth | ConvertTo-Json -Compress)
Add-Result 'port-holding canonical map is the survivor' ($dupDecision.survivors -contains 3 -and -not ($dupDecision.survivors -contains 4)) "survivors=$($dupDecision.survivors -join ',')"

$nonCanonicalOnly = @((Server 9 'map-server.exe' 'C:\tmp\.tmp-retired-runtime\rathena\map-server.exe' @()))
$nonCanonDecision = Decide $nonCanonicalOnly
$ncUnauth = @($nonCanonDecision.unauthorized)
Add-Result 'non-canonical path is unauthorized and never a survivor' ([bool]($ncUnauth | Where-Object { $_.reason -eq 'NON_CANONICAL_RUNTIME_PATH' -and $_.pid -eq 9 }) -and -not ($nonCanonDecision.survivors -contains 9)) "unauth=$($ncUnauth | ConvertTo-Json -Compress)"

$mixed = $clean + (Server 10 'map-server.exe' 'C:\tmp\.tmp-x\rathena\map-server.exe' @())
$mixedDecision = Decide $mixed
Add-Result 'canonical survives while non-canonical duplicate is unauthorized' (($mixedDecision.survivors -contains 3) -and [bool](@($mixedDecision.unauthorized) | Where-Object { $_.pid -eq 10 -and $_.reason -eq 'NON_CANONICAL_RUNTIME_PATH' })) "survivors=$($mixedDecision.survivors -join ',')"

$designatedDecision = Decide ($clean + (Server 5 'login-server.exe' (PortPath 'login-server.exe') @())) @(1)
Add-Result 'designated canonical PID wins over newer canonical-path duplicate' ([bool](($designatedDecision.survivors -contains 1) -and (@($designatedDecision.unauthorized) | Where-Object { $_.pid -eq 5 -and $_.reason -eq 'UNAUTHORIZED_SECOND_LOGIN' }))) "survivors=$($designatedDecision.survivors -join ',')"

$chainTerminal = Get-RuntimeParentChainClassification -ParentNames @('powershell.exe', 'Code.exe')
Add-Result 'Code.exe parent is TERMINAL_ATTACHED' ($chainTerminal.mode -eq 'TERMINAL_ATTACHED' -and $chainTerminal.terminalAttached) $chainTerminal.mode
$chainHiddenPs = Get-RuntimeParentChainClassification -ParentNames @('powershell.exe')
Add-Result 'powershell-only parent is POWERSHELL_PARENT' ($chainHiddenPs.mode -eq 'POWERSHELL_PARENT' -and -not $chainHiddenPs.terminalAttached) $chainHiddenPs.mode
$chainDetached = Get-RuntimeParentChainClassification -ParentNames @()
Add-Result 'empty parent chain is DETACHED_OR_SERVICE' ($chainDetached.mode -eq 'DETACHED_OR_SERVICE') $chainDetached.mode

$sentinelSource = Get-Content $sentinelPath -Raw
Add-Result 'sentinel does not scan disk recursively' (-not ($sentinelSource -match 'Get-ChildItem\s+-Recurse')) ''
Add-Result 'sentinel carries the single-runtime token and cloudflared audit' (($sentinelSource -match 'UNAUTHORIZED_RATHENA_RUNTIME') -and ($sentinelSource -match 'CLOUDFLARED_MANAGEMENT_MODE') -and ($sentinelSource -match 'never.*kill' -or $sentinelSource -match 'survivors -contains')) ''

$failed = @($tests | Where-Object { $_.status -eq 'FAIL' })
[pscustomobject]@{
  result = if ($failed.Count) { 'RUNTIME_SENTINEL_TEST_FAIL' } else { 'RUNTIME_SENTINEL_TEST_PASS' }
  total = $tests.Count
  failed = $failed.Count
  tests = $tests
} | ConvertTo-Json -Depth 5

if ($failed.Count) { exit 1 }
