param(
  [string]$ClientDir = 'C:\Program Files (x86)\Gravity\RagnarokOnline',
  [string]$GrfLibraryDir = "$env:LOCALAPPDATA\Temp\GRFEditor-src\GrfCL\Files",
  [string]$OutDir = (Join-Path (Get-Location) 'tmp\ro-showcase-bodies')
)

$ErrorActionPreference = 'Stop'
$archive = Join-Path $ClientDir 'data0.grf'
if (-not (Test-Path -LiteralPath $archive)) {
  throw "Official client data0.grf was not found: $archive"
}
if (-not (Test-Path -LiteralPath $GrfLibraryDir)) {
  throw "GrfCL library directory was not found: $GrfLibraryDir"
}

Get-ChildItem -LiteralPath $GrfLibraryDir -Filter '*.dll' | ForEach-Object {
  try { [void][Reflection.Assembly]::LoadFrom($_.FullName) } catch {}
}
$encodingType = [AppDomain]::CurrentDomain.GetAssemblies() |
  ForEach-Object { $_.GetType('Utilities.Services.EncodingService', $false) } |
  Where-Object { $null -ne $_ } |
  Select-Object -First 1
if ($null -eq $encodingType) {
  throw 'GrfCL EncodingService could not be loaded'
}
$displayEncoding = $encodingType.GetProperty(
  'DisplayEncoding',
  [Reflection.BindingFlags]'Public,Static'
)
$displayEncoding.SetValue($null, [Text.Encoding]::GetEncoding(949), $null)

function Decode-Cp949([string]$hex) {
  $bytes = [byte[]]::new($hex.Length / 2)
  for ($index = 0; $index -lt $bytes.Length; $index += 1) {
    $bytes[$index] = [Convert]::ToByte($hex.Substring($index * 2, 2), 16)
  }
  return [Text.Encoding]::GetEncoding(949).GetString($bytes)
}

$jobs = [ordered]@{
  novice = 'c3cabab8c0da'
  swordsman = 'b0cbbbe7'
  mage = 'b8b6b9fdbbe7'
  archer = 'b1c3bcf6'
  acolyte = 'bcbac1f7c0da'
  merchant = 'bbf3c0ce'
  thief = 'b5b5b5cf'
  taekwon = 'c5c2b1c7bcd2b3e2'
  supernovice = 'bdb4c6dbb3ebbaf1bdba'
  gunslinger = 'b0c7b3ca'
  ninja = 'b4d1c0da'
}
$sexes = [ordered]@{
  male = 'b3b2'
  female = 'bfa9'
}
$human = Decode-Cp949 'c0ceb0a3c1b7'
$body = Decode-Cp949 'b8f6c5eb'

$grf = [GRF.Core.GrfHolder]::new($archive)
try {
  foreach ($sex in $sexes.GetEnumerator()) {
    $sourceSex = Decode-Cp949 $sex.Value
    $targetDir = Join-Path $OutDir $sex.Key
    [void](New-Item -ItemType Directory -Force -Path $targetDir)
    foreach ($job in $jobs.GetEnumerator()) {
      $sourceJob = Decode-Cp949 $job.Value
      foreach ($extension in @('act', 'spr')) {
        $source = "data\sprite\$human\$body\$sourceSex\$($sourceJob)_$sourceSex.$extension"
        $entry = $grf.FileTable[$source]
        if ($null -eq $entry) {
          throw "Official GRF entry is missing: $source"
        }
        $target = Join-Path $targetDir "$($job.Key).$extension"
        [IO.File]::WriteAllBytes($target, [byte[]]$entry.GetDecompressedData())
      }
    }
  }
} finally {
  $grf.Close()
}

Write-Output "RO_SHOWCASE_BODIES_EXTRACTED jobs=$($jobs.Count) sexes=$($sexes.Count) output=$OutDir"
