# Windows PowerShell 5.1 probe for the governance UTF-8 suite. Loads only the
# shared JSON functions and single function ASTs from deployment tools; no
# Production path, process, lease or runtime action is reachable from here.
param(
  [Parameter(Mandatory=$true)][string]$Case,
  [string]$Path, [string]$RuntimeRoot, [string]$Owner, [string]$LeaseId, [int]$CodePage = 0
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\governance-json.ps1')
function Import-ToolFunction([string]$File, [string]$Name) {
  $tokens = $null; $errors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $File), [ref]$tokens, [ref]$errors)
  if ($errors.Count) { throw 'TOOL_PARSE_FAILED' }
  $node = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $Name }, $true)
  if (-not $node) { throw 'TOOL_FUNCTION_MISSING' }
  return $node.Extent.Text
}
$result = [ordered]@{ ok = $true; ps_major = $PSVersionTable.PSVersion.Major }
try {
  switch ($Case) {
    'lease' {
      . ([scriptblock]::Create((Import-ToolFunction '..\native-runtime-adapter.ps1' 'Assert-NativeLeaseOwned')))
      Assert-NativeLeaseOwned $RuntimeRoot $Owner $LeaseId
      $result.owner = [string](Read-GovernanceJson (Join-Path $RuntimeRoot 'production-deployment-lease\lease.json')).owner_task_id
    }
    'legacy-lease' {
      # Reader before this fix: implicit Get-Content decoding, then the same compare.
      $lease = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
      $result.owner = [string]$lease.owner_task_id
      $result.owner_matches = -not ($lease.owner_task_id -ne $Owner)
    }
    'read' { $result.value = Read-GovernanceJson $Path }
    'write-receipt' {
      . ([scriptblock]::Create((Import-ToolFunction '..\deploy-dashboard-manifest.ps1' 'Write-Receipt')))
      Write-Receipt -Path $Path -Value ([ordered]@{ mode = 'DEPLOY'; owner_task_id = $Owner; lease_id = $LeaseId })
    }
    'write-incident' {
      . (Join-Path $PSScriptRoot '..\runtime-incident.lib.ps1')
      Write-IncidentJson $Path ([ordered]@{ procdumpAttachStatus = 'ATTACHED'; note = $Owner })
    }
    'read-incident' {
      . (Join-Path $PSScriptRoot '..\runtime-incident.lib.ps1')
      $value = Read-IncidentJson $Path
      $result.is_null = $null -eq $value
      if ($value) { $result.value = $value }
    }
    'write-codepage' {
      $bytes = [Text.Encoding]::GetEncoding($CodePage).GetBytes(('{"owner_task_id":"' + $Owner + '"}'))
      [IO.File]::WriteAllBytes($Path, $bytes)
    }
    'echo' { $result.owner = $Owner }
    default { throw 'UNKNOWN_CASE' }
  }
} catch {
  $result.ok = $false
  $result.error = $_.Exception.Message
}
Write-GovernanceJsonStdout $result
