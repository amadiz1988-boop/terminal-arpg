# Pure, side-effect-free helpers for the single-runtime policy guard.
# Kept separate so both the admission guard and its tests share one decision surface.

function Test-RuntimePathCanonical {
  param([string]$Path, [string]$CanonicalRoot)
  if (-not $Path -or -not $CanonicalRoot) { return $false }
  return $Path.ToLower().StartsWith($CanonicalRoot.ToLower())
}

function Get-RAthenaRuntimeViolations {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][array]$Servers = @(),
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][array]$Listeners = @(),
    [Parameter(Mandatory = $true)][string]$CanonicalRoot,
    [Parameter(Mandatory = $true)][array]$RetiredPorts = @(),
    [Parameter(Mandatory = $true)][array]$ServerNames = @()
  )
  $violations = @()
  foreach ($name in $ServerNames) {
    $count = @($Servers | Where-Object { $_.name -eq $name }).Count
    if ($count -gt 1) { $violations += "duplicate_${name}_count=$count" }
  }
  foreach ($server in $Servers) {
    if (-not (Test-RuntimePathCanonical -Path ([string]$server.path) -CanonicalRoot $CanonicalRoot)) {
      $violations += "non_canonical_runtime pid=$($server.pid) name=$($server.name) path=$($server.path)"
    }
  }
  foreach ($retiredPort in $RetiredPorts) {
    $owner = @($Listeners | Where-Object { [int]$_.LocalPort -eq [int]$retiredPort } | Select-Object -First 1 -ExpandProperty OwningProcess)
    if ($owner) { $violations += "retired_port_listener port=$retiredPort pid=$owner" }
  }
  return [string[]]$violations
}
