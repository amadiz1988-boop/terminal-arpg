param(
  [string]$ClientDir = 'C:\Program Files (x86)\Gravity\RagnarokOnline',
  [string]$GrfLibraryDir = "$env:LOCALAPPDATA\Temp\GRFEditor-src\GrfCL\Files",
  [string]$OutDir = (Join-Path (Get-Location) 'tmp\ro-pad-pets')
)

$ErrorActionPreference = 'Stop'
$archive = Join-Path $ClientDir 'data0.grf'
$expectedHash = '913402ACE1D3C67818B4F070650A07EB157A6D62DF9E394D596D59B4C7E6678A'
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw "官方 Client 缺少 $archive" }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) {
  throw 'data0.grf 版本雜湊不符；請重新盤點素材後再轉換'
}
if (-not (Test-Path -LiteralPath (Join-Path $GrfLibraryDir 'GRF.dll') -PathType Leaf)) {
  throw "GrfCL 缺少 $GrfLibraryDir"
}
Get-ChildItem -LiteralPath $GrfLibraryDir -Filter '*.dll' | ForEach-Object {
  try { [void][Reflection.Assembly]::LoadFrom($_.FullName) } catch {}
}
$encodingType = [AppDomain]::CurrentDomain.GetAssemblies() |
  ForEach-Object { $_.GetType('Utilities.Services.EncodingService', $false) } |
  Where-Object { $null -ne $_ } |
  Select-Object -First 1
if ($null -eq $encodingType) { throw '無法載入 GrfCL EncodingService' }
$encodingType.GetProperty('DisplayEncoding', [Reflection.BindingFlags]'Public,Static').SetValue(
  $null, [Text.Encoding]::GetEncoding(949), $null
)

[void](New-Item -ItemType Directory -Force -Path $OutDir)
$grf = [GRF.Core.GrfHolder]::new($archive)
try {
  foreach ($extension in @('act', 'spr')) {
    $source = "data\sprite\npc\4_pd_tamadora.$extension"
    $entry = $grf.FileTable[$source]
    if ($null -eq $entry) { throw "來源缺少 $source" }
    [IO.File]::WriteAllBytes(
      (Join-Path $OutDir "4_pd_tamadora.$extension"),
      [byte[]]$entry.GetDecompressedData()
    )
  }
} finally {
  $grf.Close()
}
Write-Output "RO_PAD_PETS_EXTRACTED output=$OutDir"
