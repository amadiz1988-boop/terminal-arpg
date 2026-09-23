[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\runtime-incident.lib.ps1')

# Synthetic identities only. No rAthena process is started or stopped.
$script:mockListeners = @()
function Get-NetTCPConnection { @($script:mockListeners) }
$script:mockWinEvents = @()
function Get-WinEvent { @($script:mockWinEvents) }

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('ro-incident-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$count = 0
function Check([bool]$condition, [string]$label) {
  if (-not $condition) { throw "FAIL $label" }
  $script:count++
}
function New-Fixture([string]$name) {
  $root = Join-Path $testRoot $name
  New-Item -ItemType Directory -Path (Join-Path $root 'logs') -Force | Out-Null
  $start = [DateTimeOffset]::UtcNow.AddMinutes(-1).ToString('o')
  $entries = @()
  $live = @()
  foreach ($pair in @(@('login', 101), @('char', 102), @('map', 103))) {
    $service = $pair[0]; $id = $pair[1]
    $path = Join-Path $root "$service-server.exe"
    $out = Join-Path $root "logs\$service.out.log"
    "ready`nAuthorization: Bearer secret-value`n" | Set-Content -LiteralPath $out
    $entries += [pscustomobject]@{ name = $service; id = $id; path = $path; stdout = $out; stderr = '' }
    $live += [pscustomobject]@{ name = "$service-server.exe"; pid = $id; path = $path; start = $start }
  }
  Write-IncidentJson (Join-Path $root 'state.json') ([pscustomobject]@{ startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); processes = $entries })
  return [pscustomobject]@{ root = $root; live = $live }
}
function Latest($fixture) {
  $folder = @(Get-ChildItem -LiteralPath (Join-Path $fixture.root 'runtime-incidents') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (-not $folder) { return $null }
  return Read-IncidentJson (Join-Path $folder[0].FullName 'incident.json')
}

try {
  $when = [DateTimeOffset]::UtcNow
  $one = New-Fixture 'map-first'
  Invoke-RuntimeIncidentTick $one.root $one.live @()
  $mapEvent = [pscustomobject]@{ name = 'map-server.exe'; pid = 103; at = $when.ToString('o'); exitCode = 3221225477 }
  Invoke-RuntimeIncidentTick $one.root @($one.live | Where-Object pid -ne 103) @($mapEvent)
  $incident = Latest $one
  Check ($incident.firstExitService -eq 'map') 'map first exit'
  Check ($incident.firstExitCode -eq 3221225477) 'event exit code'
  Check ($incident.exitClassification -eq 'UNKNOWN') 'nonzero code does not prove crash'
  Check ($incident.exitOrder.Count -eq 1) 'first timeline entry'
  $properties = @('map-server.exe', '', '', 'fault.dll', '', '', '0xc0000005') | ForEach-Object { [pscustomobject]@{ Value = $_ } }
  $script:mockWinEvents = @([pscustomobject]@{ Id = 1000; Message = 'Faulting application name: map-server.exe'; TimeCreated = [DateTime]::UtcNow; ProviderName = 'Application Error'; Properties = $properties })
  Invoke-RuntimeIncidentTick $one.root @($one.live | Where-Object pid -ne 103) @()
  Check ((Latest $one).exitClassification -eq 'PROCESS_CRASH') 'late Windows event upgrades crash classification'
  Check ((Latest $one).windowsEvidence.exceptionCode -eq '0xc0000005') 'fault exception captured'
  $summary = & (Join-Path $PSScriptRoot '..\show-runtime-incident.ps1') -RuntimeRoot $one.root | Out-String
  Check ($summary -match [regex]::Escape($incident.incidentId) -and $summary -match 'FIRST_EXIT_SERVICE') 'operator latest summary'
  $charEvent = [pscustomobject]@{ name = 'char-server.exe'; pid = 102; at = $when.AddMilliseconds(307).ToString('o'); exitCode = 0 }
  $loginEvent = [pscustomobject]@{ name = 'login-server.exe'; pid = 101; at = $when.AddMilliseconds(418).ToString('o'); exitCode = 0 }
  Invoke-RuntimeIncidentTick $one.root @() @($charEvent, $loginEvent)
  $cascade = Latest $one
  Check (($cascade.exitOrder | ForEach-Object service) -join ',' -eq 'map,char,login') 'three process ordering'
  Check ($cascade.exitOrder[1].exitTimeDeltaMs -eq 307 -and $cascade.exitOrder[2].exitTimeDeltaMs -eq 418) 'exit time deltas'
  Check ($cascade.incidentId -eq $incident.incidentId) 'cascade same incident'
  Invoke-RuntimeIncidentTick $one.root @() @()
  Check (@(Get-ChildItem -LiteralPath (Join-Path $one.root 'runtime-incidents') -Directory).Count -eq 1) 'duplicate suppression'
  $tailFile = @(Get-ChildItem -LiteralPath (Join-Path $one.root 'runtime-incidents') -Directory | Select-Object -First 1)[0]
  $tail = Get-Content -LiteralPath (Join-Path $tailFile.FullName 'map-stdout-tail.log') -Raw
  Check ($tail -match '\[REDACTED\]' -and $tail -notmatch 'secret-value') 'log redaction'
  $script:mockWinEvents = @()
  $sensitive = Protect-IncidentText '"token":"json-secret" --password cli-secret Bearer bearer-secret'
  Check ($sensitive -notmatch 'json-secret|cli-secret|bearer-secret') 'structured and cli redaction'

  $nextState = Read-IncidentJson (Join-Path $one.root 'state.json')
  $nextState.startedAt = [long]$nextState.startedAt + 1
  Write-IncidentJson (Join-Path $one.root 'state.json') $nextState
  $script:mockListeners = @(
    [pscustomobject]@{ LocalPort = 6901; OwningProcess = 101 },
    [pscustomobject]@{ LocalPort = 6122; OwningProcess = 102 },
    [pscustomobject]@{ LocalPort = 5122; OwningProcess = 103 }
  )
  Invoke-RuntimeIncidentTick $one.root $one.live @()
  Check ((Latest $one).recoveryResult -eq 'RUNTIME_PORTS_HEALTHY') 'observed recovery health'
  $script:mockListeners = @()

  $simultaneous = New-Fixture 'simultaneous'
  Invoke-RuntimeIncidentTick $simultaneous.root @() @()
  Check ((Latest $simultaneous).firstExitService -eq 'UNDETERMINED') 'poll only tie stays undetermined'
  Check ((Latest $simultaneous).exitOrder.Count -eq 3) 'stale state captures all missing'

  $graceful = New-Fixture 'graceful'
  Invoke-RuntimeIncidentTick $graceful.root $graceful.live @()
  Write-IncidentJson (Join-Path $graceful.root 'lifecycle.lock') ([pscustomobject]@{ mode = 'STOPPING'; pid = $PID })
  Invoke-RuntimeIncidentTick $graceful.root @() @()
  Check ($null -eq (Latest $graceful)) 'graceful stop no incident'

  $mixed = New-Fixture 'graceful-then-unexpected'
  Invoke-RuntimeIncidentTick $mixed.root $mixed.live @()
  ('{0} run=fixture STOP pid=103' -f ([DateTimeOffset]::UtcNow.ToString('o'))) | Set-Content -LiteralPath (Join-Path $mixed.root 'logs\map-launch-telemetry.log')
  Invoke-RuntimeIncidentTick $mixed.root @($mixed.live | Where-Object pid -ne 103) @()
  Check ($null -eq (Latest $mixed)) 'launcher stop alone no incident'
  Invoke-RuntimeIncidentTick $mixed.root @($mixed.live | Where-Object { $_.pid -in @(101) }) @()
  Check ((Latest $mixed).firstExitService -eq 'char') 'first unexpected excludes graceful predecessor'

  $sentinel = New-Fixture 'sentinel'
  Invoke-RuntimeIncidentTick $sentinel.root $sentinel.live @()
  ('{"timestamp":"' + ([DateTimeOffset]::UtcNow.ToString('o')) + '","action":"TERMINATE","pid":103}') | Set-Content -LiteralPath (Join-Path $sentinel.root 'sentinel-audit.log')
  Invoke-RuntimeIncidentTick $sentinel.root @($sentinel.live | Where-Object pid -ne 103) @()
  Check ((Latest $sentinel).exitClassification -eq 'SENTINEL_TERMINATION') 'sentinel action correlation'

  $retention = New-Fixture 'retention'
  $incidentRoot = Join-Path $retention.root 'runtime-incidents'
  $old = Join-Path $incidentRoot 'old'
  New-Item -ItemType Directory -Force -Path $old | Out-Null
  '{}' | Set-Content -LiteralPath (Join-Path $old 'incident.json')
  (Get-Item -LiteralPath $old).LastWriteTimeUtc = [DateTime]::UtcNow.AddDays(-35)
  Invoke-IncidentRetention $incidentRoot
  Check (-not (Test-Path -LiteralPath $old)) 'age retention'
  $capture = Join-Path $retention.root 'crash-capture'
  New-Item -ItemType Directory -Path $capture | Out-Null
  $currentDump = Join-Path $capture 'current.dmp'
  [IO.File]::WriteAllBytes($currentDump, [byte[]]@(4, 5, 6))
  $references = @(Get-IncidentDumpReferences $capture ([DateTimeOffset]::UtcNow))
  Check ($references.Count -eq 1 -and $references[0].size -eq 3 -and $references[0].sha256.Length -eq 64) 'dump reference hash and size'
  $dump = Join-Path $capture 'old.dmp'
  [IO.File]::WriteAllBytes($dump, [byte[]]@(1, 2, 3))
  (Get-Item -LiteralPath $dump).LastWriteTimeUtc = [DateTime]::UtcNow.AddDays(-35)
  Invoke-IncidentDumpRetention $capture
  Check (-not (Test-Path -LiteralPath $dump)) 'old dump removed'
  Check (Test-Path -LiteralPath $currentDump) 'current dump retained'
  Check ((Get-Content -LiteralPath (Join-Path $capture 'dump-retention-ledger.jsonl') -Raw) -match 'sha256') 'dump hash ledger retained'

  Write-Output "RUNTIME_INCIDENT_TEST_PASS count=$count"
} finally {
  $resolved = [IO.Path]::GetFullPath($testRoot)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -and $resolved -ne $temp) {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  }
}
