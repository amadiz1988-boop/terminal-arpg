[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$IdsCsv)
$ErrorActionPreference = 'Stop'
if ($IdsCsv -notmatch '^[1-9][0-9]*(,[1-9][0-9]*){0,3}$') { throw 'INVALID_IDS' }
$ids = @($IdsCsv.Split(',') | ForEach-Object { [int]$_ })
$rows = @()
foreach ($trackedId in $ids) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$trackedId" -ErrorAction Stop
  if ($null -ne $process) {
    $rows += [pscustomobject]@{
      pid = [int]$process.ProcessId
      path = [string]$process.ExecutablePath
      name = [string]$process.Name
      startedAt = ([DateTimeOffset]$process.CreationDate).ToUniversalTime().ToString('o')
    }
  }
}
ConvertTo-Json -InputObject @($rows) -Compress -Depth 3
