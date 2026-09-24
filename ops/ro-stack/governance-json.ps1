# Canonical governance JSON I/O for deployment tooling.
# Compatible with Windows PowerShell 5.1 and PowerShell 7. Governance JSON is
# UTF-8 without BOM, the same bytes Node's JSON writers produce. A BOM, invalid
# UTF-8, empty input, or malformed JSON fails closed; no code page fallback.

function Get-GovernanceUtf8Encoding {
  # encoderShouldEmitUTF8Identifier = false, throwOnInvalidBytes = true
  return New-Object System.Text.UTF8Encoding -ArgumentList $false, $true
}

function ConvertFrom-GovernanceJsonBytes([byte[]]$Bytes) {
  if ($null -eq $Bytes -or $Bytes.Length -eq 0) { throw 'GOVERNANCE_JSON_EMPTY' }
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    throw 'GOVERNANCE_JSON_BOM_FORBIDDEN'
  }
  $text = $null
  try { $text = (Get-GovernanceUtf8Encoding).GetString($Bytes) } catch { throw 'GOVERNANCE_JSON_UTF8_INVALID' }
  if ([string]::IsNullOrWhiteSpace($text)) { throw 'GOVERNANCE_JSON_EMPTY' }
  $value = $null
  try { $value = ConvertFrom-Json -InputObject $text -ErrorAction Stop } catch { throw 'GOVERNANCE_JSON_INVALID' }
  if ($null -eq $value) { throw 'GOVERNANCE_JSON_INVALID' }
  return $value
}

function Read-GovernanceJson([string]$Path) {
  if (-not $Path -or -not [IO.Path]::IsPathRooted($Path) -or
      -not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'GOVERNANCE_JSON_MISSING' }
  return ConvertFrom-GovernanceJsonBytes ([IO.File]::ReadAllBytes($Path))
}

function ConvertTo-GovernanceJsonBytes($Value, [int]$Depth = 12, [switch]$Compress) {
  $json = if ($Compress) { ConvertTo-Json -InputObject $Value -Depth $Depth -Compress }
    else { ConvertTo-Json -InputObject $Value -Depth $Depth }
  return ,((Get-GovernanceUtf8Encoding).GetBytes([string]$json))
}

function Write-GovernanceJson([string]$Path, $Value, [switch]$CreateNew, [int]$Depth = 12) {
  if (-not $Path -or -not [IO.Path]::IsPathRooted($Path)) { throw 'GOVERNANCE_JSON_PATH_INVALID' }
  $bytes = ConvertTo-GovernanceJsonBytes $Value $Depth
  if ($CreateNew) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    return
  }
  $temporary = '{0}.{1}.tmp' -f $Path, [guid]::NewGuid().ToString('N')
  $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
  try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

# Machine-read stdout is written as UTF-8 bytes, independent of the console
# code page PowerShell 5.1 uses for redirected output.
function Write-GovernanceJsonStdout($Value, [int]$Depth = 12) {
  $bytes = ConvertTo-GovernanceJsonBytes $Value $Depth -Compress
  $stdout = [Console]::OpenStandardOutput()
  $stdout.Write($bytes, 0, $bytes.Length)
  $stdout.WriteByte(10)
  $stdout.Flush()
}
