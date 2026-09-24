# Windows PowerShell 5.1 probe with the native-runtime-adapter parameter
# contract. It runs the adapter's real Invoke-BoundedLauncher against an
# isolated fixture launcher; no Production path or canonical runtime is used.
param([string]$Action, [string]$ProductionRoot, [string]$Owner, [string]$LeaseId)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\governance-json.ps1')
if (-not (Get-Command Get-FileHash -ErrorAction SilentlyContinue)) { throw 'POWERSHELL_MODULE_PATH_INVALID' }
$lease = Read-GovernanceJson (Join-Path $ProductionRoot 'lease.json')
if (-not [string]::Equals([string]$lease.owner_task_id, $Owner, [StringComparison]::Ordinal) -or
    -not [string]::Equals([string]$lease.lease_id, $LeaseId, [StringComparison]::Ordinal)) { throw 'NATIVE_LEASE_NOT_OWNED' }
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..\native-runtime-adapter.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'ADAPTER_PARSE_FAILED' }
$node = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-BoundedLauncher' }, $true)
. ([scriptblock]::Create($node.Extent.Text))
$timeout = if ($env:FIXTURE_LAUNCHER_TIMEOUT) { [int]$env:FIXTURE_LAUNCHER_TIMEOUT } else { 150 }
$launch = Invoke-BoundedLauncher (Join-Path $ProductionRoot 'launcher.ps1') $Action (Join-Path $ProductionRoot 'logs') $timeout
if ($launch.exit_code -ne 0) { throw 'EXISTING_LIFECYCLE_FAILED' }
