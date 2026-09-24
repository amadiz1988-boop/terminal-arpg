[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\runtime-incident.lib.ps1')
. (Join-Path $PSScriptRoot '..\runtime-procdump-sidecar.lib.ps1')
$root = Join-Path ([IO.Path]::GetTempPath()) ('ro-procdump-test-' + [guid]::NewGuid().ToString('N'))
$runtimeRoot = Join-Path $root 'runtime'
$canonicalRoot = 'C:\canonical\rathena'
$script:sidecars = @()
$script:attachCount = 0
$script:failAttach = $false
$script:emitAttachOutput = $true
$count = 0
function Check([bool]$condition, [string]$label) { if (-not $condition) { throw "FAIL $label" }; $script:count++ }
function Get-CimInstance {
  param($ClassName, $Filter, $ErrorAction)
  if ($Filter -match 'ProcessId=(\d+)') { return [pscustomobject]@{ ExecutablePath = (Join-Path $canonicalRoot 'map-server.exe') } }
  if ($Filter -match 'perl.exe') { return @() }
  return @($script:sidecars)
}
function Get-NetTCPConnection {
  param($State, $LocalPort, $ErrorAction)
  $entries = (Read-IncidentJson (Join-Path $runtimeRoot 'state.json')).processes
  $name = @{ 6901 = 'login'; 6122 = 'char'; 5122 = 'map' }[[int]$LocalPort]
  return @([pscustomobject]@{ OwningProcess = [int](@($entries | Where-Object name -eq $name)[0].id) })
}
function Invoke-RestMethod { return [pscustomobject]@{ ok = $true } }
function Test-Path {
  param($LiteralPath, $PathType)
  if ($PathType -eq 'Container' -and ($LiteralPath -eq $script:approvedProcDumpPath -or
      $LiteralPath -eq (Join-Path $canonicalRoot 'map-server.exe'))) { return $false }
  if ($LiteralPath -eq $script:approvedProcDumpPath -or $LiteralPath -eq (Join-Path $canonicalRoot 'map-server.exe')) { return $true }
  return Microsoft.PowerShell.Management\Test-Path -LiteralPath $LiteralPath
}
function Get-MockedFileHash {
  param($LiteralPath, $Algorithm)
  if ($LiteralPath -eq $script:approvedProcDumpPath) { return [pscustomobject]@{ Hash = $script:approvedProcDumpHash } }
  if ($LiteralPath -eq (Join-Path $canonicalRoot 'map-server.exe')) { return [pscustomobject]@{ Hash = ('A' * 64) } }
  return Microsoft.PowerShell.Utility\Get-FileHash -LiteralPath $LiteralPath -Algorithm $Algorithm
}
Set-Alias -Name Get-FileHash -Value Get-MockedFileHash -Scope Script
function Start-Process {
  param($FilePath, $ArgumentList, $WindowStyle, $RedirectStandardOutput, $RedirectStandardError, [switch]$PassThru)
  $script:attachCount++
  if ($script:failAttach) { throw 'SYNTHETIC_ATTACH_FAILURE' }
  $id = 40000 + $script:attachCount
  $mapPid = [int]$ArgumentList[-2]
  $folder = [string]$ArgumentList[-1]
  $filterLines = @($script:approvedProcDumpFilter.Split(',') | ForEach-Object { "                       $_" }) -join "`n"
  if ($script:emitAttachOutput) {
    "Process: map-server.exe ($mapPid)`nProcess image: $(Join-Path $canonicalRoot 'map-server.exe')`nException monitor: First Chance+Unhandled`n$filterLines`nNumber of dumps: 2`nDump folder: $folder" | Set-Content -LiteralPath $RedirectStandardOutput -Encoding Unicode
  }
  $script:sidecars += [pscustomobject]@{
    ProcessId = $id; ExecutablePath = $script:approvedProcDumpPath
    CommandLine = ('"{0}" {1}' -f $script:approvedProcDumpPath, ($ArgumentList -join ' '))
  }
  return [pscustomobject]@{ Id = $id; HasExited = $false }
}
function State([int]$mapPid, [long]$generation) {
  return [pscustomobject]@{ startedAt = $generation; processes = @(
    [pscustomobject]@{ name = 'login'; id = 101; path = (Join-Path $canonicalRoot 'login-server.exe') },
    [pscustomobject]@{ name = 'char'; id = 102; path = (Join-Path $canonicalRoot 'char-server.exe') },
    [pscustomobject]@{ name = 'map'; id = $mapPid; path = (Join-Path $canonicalRoot 'map-server.exe') }
  ) }
}
function Server([int]$mapPid, [string]$path) {
  return [pscustomobject]@{ name = 'map-server.exe'; pid = $mapPid; path = $path; start = '2026-09-23T00:00:00Z'; ports = @(5122) }
}
$guard = [pscustomobject]@{ unauthorized = @(); survivors = @(103, 104, 105, 107) }
try {
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  $mapPath = Join-Path $canonicalRoot 'map-server.exe'
  $live = @(Server 103 $mapPath)
  Write-IncidentJson (Join-Path $runtimeRoot 'state.json') (State 103 1000)
  $first = Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot $live $guard $true
  Check ($first.procdumpAttachStatus -eq 'ATTACHED' -and $first.procdumpAttachedPid -eq 103) 'first canonical attach'
  $second = Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot $live $guard $true
  Check ($script:attachCount -eq 1 -and $second.procdumpProcessId -eq $first.procdumpProcessId) 'same PID no duplicate'
  Write-IncidentJson (Join-Path $runtimeRoot 'state.json') (State 104 1001)
  $live = @(Server 104 $mapPath)
  $replacement = Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot $live $guard $true
  Check ($replacement.procdumpAttachedPid -eq 104 -and $script:attachCount -eq 2) 'new generation reattached once'
  Check ($replacement.previous.mapPid -eq 103 -and $replacement.runtimeGenerationId -eq 'ro-1001') 'previous generation retained'
  [void](Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot $live $guard $true)
  Check ($script:attachCount -eq 2) 'replacement PID no duplicate'
  $invalid = Get-MapProcDumpDecision (State 105 1002) @((Server 105 'C:\unauthorized\map-server.exe')) $guard @() $canonicalRoot $runtimeRoot
  Check ($invalid.status -eq 'MAP_PROCDUMP_REATTACH_BLOCKED') 'noncanonical PID denied'
  $blind = Get-MapProcDumpDecision (State 105 1002) @((Server 105 $mapPath)) $guard @([pscustomobject]@{ ProcessId = 999; ExecutablePath = $script:approvedProcDumpPath; CommandLine = $null }) $canonicalRoot $runtimeRoot
  Check ($blind.status -eq 'MAP_PROCDUMP_REATTACH_BLOCKED' -and $blind.reason -eq 'SIDECAR_INVENTORY_INCOMPLETE') 'incomplete sidecar inventory denied'
  Check (-not (Test-MapProcDumpOutput 'bad output' 105 $mapPath 'C:\dump')) 'unverified ProcDump output denied'
  $duplicate = Get-MapProcDumpDecision (State 105 1002) @((Server 105 $mapPath), (Server 106 $mapPath)) $guard @() $canonicalRoot $runtimeRoot
  Check ($duplicate.status -eq 'MAP_PROCDUMP_REATTACH_BLOCKED') 'second map denied'
  Write-IncidentJson (Join-Path $runtimeRoot 'state.json') (State 105 1002)
  $script:failAttach = $true
  $failed = Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot @((Server 105 $mapPath)) $guard $true
  Check ($failed.procdumpAttachStatus -eq 'FAILED' -and $failed.mapRuntimeUnaffected -eq 'YES') 'attach failure does not affect map'
  Check ((Get-MapProcDumpDecision (State 105 1002) @((Server 105 $mapPath)) $guard @() $canonicalRoot $runtimeRoot).status -eq 'ATTACH') 'failure permits bounded retry'
  Write-IncidentJson (Join-Path $runtimeRoot 'state.json') (State 107 1003)
  $script:failAttach = $false
  $script:emitAttachOutput = $false
  $silent = Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot @((Server 107 $mapPath)) $guard $true
  Check ($silent.procdumpAttachStatus -eq 'FAILED' -and $silent.procdumpAttachError -eq 'PROCDUMP_OUTPUT_UNVERIFIED') 'live sidecar without attach output is not confirmed'
  $unchanged = Invoke-MapProcDumpTick $runtimeRoot $canonicalRoot @((Server 107 $mapPath)) $guard $true
  Check ($unchanged.procdumpAttachStatus -eq 'FAILED' -and $unchanged.procdumpAttachedPid -eq $null) 'unverified sidecar cannot self-confirm'
  Write-Output "RUNTIME_PROCDUMP_TEST_PASS count=$count"
} finally {
  $resolved = [IO.Path]::GetFullPath($root)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -and $resolved -ne $temp) { Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue }
}
