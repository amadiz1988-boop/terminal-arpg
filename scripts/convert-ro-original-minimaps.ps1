[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ExtractionMetadataPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [Parameter(Mandatory = $true)][string]$ConversionMetadataPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
[void](New-Item -ItemType Directory -Force -Path $OutDir)
$records = @(Get-Content -LiteralPath $ExtractionMetadataPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$converted = foreach ($record in $records) {
  $bitmap = [Drawing.Bitmap]::FromFile([string]$record.extractedPath)
  try {
    $bitmap.MakeTransparent([Drawing.Color]::FromArgb(255, 0, 255))
    $target = Join-Path $OutDir (([string]$record.map) + '.png')
    $bitmap.Save($target, [Drawing.Imaging.ImageFormat]::Png)
    [ordered]@{
      map = [string]$record.map
      width = [int]$bitmap.Width
      height = [int]$bitmap.Height
      outputPath = $target
    }
  } finally {
    $bitmap.Dispose()
  }
}
$converted | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ConversionMetadataPath -Encoding UTF8
Write-Output ("Converted {0} original minimaps" -f $converted.Count)
