# Pure, side-effect-free helpers for the production runtime sentinel.
# Live process collection, termination and audit stay in runtime-sentinel.ps1.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-guard.lib.ps1')

# Decide which canonical-path process per server type survives, and which
# processes are unauthorized. Fail-safe: the process holding the canonical port
# on the canonical path is always the survivor; canonical-path-less groups are
# never killed (only non-canonical paths are always unauthorized).
function Get-RAthenaProcessDecision {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][array]$Servers = @(),
    [Parameter(Mandatory = $true)][string]$CanonicalRoot,
    [Parameter(Mandatory = $true)][hashtable]$CanonicalPorts,
    [Parameter(Mandatory = $true)][array]$ServerNames,
    [AllowEmptyCollection()][array]$CanonicalPids = @()
  )

  $survivors = @()
  $unauthorized = @()

  foreach ($name in $ServerNames) {
    $type = $name -replace '-server\.exe$', ''
    $canonicalPort = [int]$CanonicalPorts[$type]
    $group = @($Servers | Where-Object { $_.name -eq $name })
    if ($group.Count -eq 0) { continue }

    $canonicalPath = @($group | Where-Object { Test-RuntimePathCanonical -Path ([string]$_.path) -CanonicalRoot $CanonicalRoot })
    $nonCanonical = @($group | Where-Object { -not (Test-RuntimePathCanonical -Path ([string]$_.path) -CanonicalRoot $CanonicalRoot) })
    foreach ($proc in $nonCanonical) {
      $unauthorized += [pscustomobject]@{ pid = [int]$proc.pid; name = [string]$proc.name; reason = 'NON_CANONICAL_RUNTIME_PATH' }
    }
    if ($canonicalPath.Count -eq 0) { continue }

    $portHolder = @($canonicalPath | Where-Object { @($_.ports) -contains $canonicalPort } | Sort-Object { [int]$_.pid })
    $designated = @($canonicalPath | Where-Object { @($CanonicalPids) -contains [int]$_.pid } | Sort-Object { [int]$_.pid })
    if ($portHolder.Count -ge 1) { $survivor = $portHolder[0] }
    elseif ($designated.Count -ge 1) { $survivor = $designated[0] }
    else { $survivor = @($canonicalPath | Sort-Object { [int]$_.pid })[0] }

    $survivors += [int]$survivor.pid
    foreach ($proc in @($canonicalPath | Where-Object { [int]$_.pid -ne [int]$survivor.pid })) {
      $reason = if ($canonicalPath.Count -gt 1) { "UNAUTHORIZED_SECOND_$($type.ToUpper())" } else { 'UNAUTHORIZED_RUNTIME' }
      $unauthorized += [pscustomobject]@{ pid = [int]$proc.pid; name = [string]$proc.name; reason = $reason }
    }
  }

  return [pscustomobject]@{ survivors = $survivors; unauthorized = $unauthorized }
}

# Classify a live parent chain (nearest ancestor first) without treating a
# development tool as legitimacy. Tool ancestry is reportable, never a pass.
function Get-RuntimeParentChainClassification {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][array]$ParentNames = @()
  )
  $terminalTools = @('Code.exe', 'kilo.exe', 'cmd.exe', 'WindowsTerminal.exe', 'wt.exe')
  $names = @($ParentNames | Where-Object { $_ })
  $terminal = @($names | Where-Object { $terminalTools -contains $_ })
  $hasPowerShell = @($names | Where-Object { $_ -eq 'powershell.exe' }).Count -gt 0
  $mode = if ($terminal.Count -gt 0) { 'TERMINAL_ATTACHED' } elseif ($hasPowerShell) { 'POWERSHELL_PARENT' } elseif ($names.Count -gt 0) { 'NON_TERMINAL_PARENT' } else { 'DETACHED_OR_SERVICE' }
  return [pscustomobject]@{ mode = $mode; terminalAttached = ($terminal.Count -gt 0); parentChain = ($names -join '<') }
}
