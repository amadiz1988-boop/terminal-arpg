[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$MapListPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [Parameter(Mandatory = $true)][string]$MetadataPath,
  [string]$ClientDir = 'C:\Program Files (x86)\Gravity\RagnarokOnline',
  [string]$GrfLibraryDir = "$env:LOCALAPPDATA\Temp\GRFEditor-src\GrfCL\Files"
)

$ErrorActionPreference = 'Stop'
$grfDll = Join-Path $GrfLibraryDir 'GRF.dll'
if (-not (Test-Path -LiteralPath $grfDll)) { throw "Missing GRF library: $GrfLibraryDir" }
Get-ChildItem -LiteralPath $GrfLibraryDir -Filter '*.dll' | ForEach-Object {
  try { [void][Reflection.Assembly]::LoadFrom($_.FullName) } catch {}
}
$encodingType = [AppDomain]::CurrentDomain.GetAssemblies() |
  ForEach-Object { $_.GetType('Utilities.Services.EncodingService', $false) } |
  Where-Object { $null -ne $_ } |
  Select-Object -First 1
if ($null -eq $encodingType) { throw 'Unable to load GrfCL EncodingService' }
$encodingType.GetProperty('DisplayEncoding', [Reflection.BindingFlags]'Public,Static').SetValue(
  $null,
  [Text.Encoding]::GetEncoding(949),
  $null
)

$requested = Get-Content -LiteralPath $MapListPath -Raw -Encoding UTF8 | ConvertFrom-Json
$wanted = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($map in $requested) { [void]$wanted.Add([string]$map) }
[void](New-Item -ItemType Directory -Force -Path $OutDir)
$found = @{}

foreach ($archiveName in @('data.grf', 'data0.grf', 'event.grf')) {
  $archive = Join-Path $ClientDir $archiveName
  if (-not (Test-Path -LiteralPath $archive)) { continue }
  $grf = [GRF.Core.GrfHolder]::new($archive)
  try {
    foreach ($entry in $grf.FileTable) {
      $fileName = [string]$entry.FileName
      if (-not $fileName.EndsWith('.bmp', [StringComparison]::OrdinalIgnoreCase)) { continue }
      $map = [IO.Path]::GetFileNameWithoutExtension($fileName)
      if (-not $wanted.Contains($map) -or $found.ContainsKey($map)) { continue }
      if ([string]$entry.RelativePath -notmatch '[\\/]map[\\/]') { continue }
      $target = Join-Path $OutDir ($map.ToLowerInvariant() + '.bmp')
      [IO.File]::WriteAllBytes($target, [byte[]]$entry.GetDecompressedData())
      $found[$map] = [ordered]@{
        map = $map.ToLowerInvariant()
        archiveName = $archiveName
        relativePath = ([string]$entry.RelativePath).Replace('\', '/')
        extractedPath = $target
      }
    }
  } finally {
    $grf.Close()
  }
}

$result = @($found.Values | Sort-Object map)
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $MetadataPath -Encoding UTF8
Write-Output ("Extracted {0} original minimaps" -f $result.Count)
