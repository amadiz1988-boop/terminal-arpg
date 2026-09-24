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
  RUNTIME_GENERATION = $incident.runtimeGenerationId
  FIRST_EXIT_SERVICE = $incident.firstExitService
  EXIT_CODE = $incident.firstExitCode
  EXIT_CLASSIFICATION = $incident.exitClassification
  EXIT_ORDER = (@($incident.exitOrder | ForEach-Object { '{0}:{1}:{2}' -f $_.exitOrder, $_.service, $_.pid }) -join ',')
  DUMP = $incident.crashDump.created
  WINDOWS_EVENT = $incident.windowsEvidence.matchCount
  ONLINE_PLAYERS = if ($null -eq $incident.onlinePlayerCount) { 'UNAVAILABLE' } else { $incident.onlinePlayerCount }
  ONLINE_CHARACTERS = if ($null -eq $incident.onlineCharacterCount) { 'UNAVAILABLE' } else { $incident.onlineCharacterCount }
  PA_RESIDENTS = if ($null -eq $incident.persistentAgentResidentCount) { 'UNAVAILABLE' } else { $incident.persistentAgentResidentCount }
  PA_MODE_COUNTS = if ($null -eq $incident.persistentAgentModeCounts) { 'UNAVAILABLE' } else { ($incident.persistentAgentModeCounts | ConvertTo-Json -Compress) }
  ACTIVE_FARM = if ($null -eq $incident.activeFarmCount) { 'UNAVAILABLE' } else { $incident.activeFarmCount }
  ACTIVE_JOURNEY = if ($null -eq $incident.activeJourneyCount) { 'UNAVAILABLE' } else { $incident.activeJourneyCount }
  ACTIVE_QUEST = if ($null -eq $incident.activeQuestCount) { 'UNAVAILABLE' } else { $incident.activeQuestCount }
  RECOVERY_RESULT = $incident.recoveryResult
  ROOT_CAUSE_STATUS = $incident.rootCauseStatus
  BUNDLE = $latest[0].FullName
} | Format-List
