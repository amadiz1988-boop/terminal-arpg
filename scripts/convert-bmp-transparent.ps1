[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$AssetFolder)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Get-ChildItem -LiteralPath $AssetFolder -Filter '*.bmp' -File | ForEach-Object {
  $source = [System.Drawing.Bitmap]::FromFile($_.FullName)
  try {
    $target = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      for ($y = 0; $y -lt $source.Height; $y++) {
        for ($x = 0; $x -lt $source.Width; $x++) {
          $pixel = $source.GetPixel($x, $y)
          if ($pixel.R -gt 245 -and $pixel.G -lt 12 -and $pixel.B -gt 245) {
            $target.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
          } else {
            $target.SetPixel($x, $y, $pixel)
          }
        }
      }
      $output = [IO.Path]::ChangeExtension($_.FullName, '.png')
      $target.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $target.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}
