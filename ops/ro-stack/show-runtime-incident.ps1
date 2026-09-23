[CmdletBinding()]
param(
  [string]$RuntimeRoot = 'C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack'
)

$ErrorActionPreference = 'Stop'
$root = Join-Path $RuntimeRoot 'runtime-incidents'
$latest = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
  Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'incident.json') } |
  Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1)
if (-not $latest) { Write-Output 'NO_RUNTIME_INCIDENT_BUNDLE'; exit 0 }
$incident = Get-Content -LiteralPath (Join-Path $latest[0].FullName 'incident.json') -Raw | ConvertFrom-Json
[pscustomobject]@{
  INCIDENT_ID = $incident.incidentId
  TIME = $incident.firstExitAt
  FIRST_EXIT_SERVICE = $incident.firstExitService
  EXIT_CODE = $incident.firstExitCode
  EXIT_CLASSIFICATION = $incident.exitClassification
  DUMP = $incident.crashDump.created
  WINDOWS_EVENT = $incident.windowsEvidence.matchCount
  AFFECTED_PLAYERS = if ($null -eq $incident.onlinePlayerCount) { 'UNAVAILABLE' } else { $incident.onlinePlayerCount }
  RECOVERY_RESULT = $incident.recoveryResult
  ROOT_CAUSE_STATUS = $incident.rootCauseStatus
  BUNDLE = $latest[0].FullName
} | Format-List
