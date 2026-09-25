[CmdletBinding()]
param(
  [string]$Checkout = '',
  [string]$KafraSource = $env:RO_KAFRA_SOURCE_DIR,
  [string]$ClientDir = $env:RO_CLIENT_DIR,
  [string]$GrfLibraryDir = $env:RO_GRF_LIBRARY_DIR
)
# Materializes private preview art for the town-service prototype into
# git-ignored folders. Every source byte is hash-checked against the tracked
# manifests first; any mismatch aborts before output is written.
$ErrorActionPreference = 'Stop'
if (-not $KafraSource -or -not $ClientDir -or -not $GrfLibraryDir) {
  throw 'Specify KafraSource, ClientDir, and GrfLibraryDir (or their RO_* environment variables).'
}
if (-not $Checkout) { $Checkout = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }
$dashboard = Join-Path $Checkout 'ops\ro-stack\dashboard'
$kafraManifest = Get-Content -LiteralPath (Join-Path $dashboard 'kafra-themes-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$clientManifest = Get-Content -LiteralPath (Join-Path $dashboard 'town-service-assets.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$converter = Join-Path $Checkout 'scripts\convert-bmp-transparent.ps1'
$staging = Join-Path ([IO.Path]::GetTempPath()) ('town-service-assets-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Force -Path $staging)

function Sha256([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

# 1. Kafra themes from the user-authorized directory.
$kafraJobs = @()
foreach ($theme in $kafraManifest.themes) {
  $themeStage = Join-Path $staging ('kafra-' + $theme.id)
  [void](New-Item -ItemType Directory -Force -Path $themeStage)
  foreach ($image in $theme.images) {
    $source = Join-Path (Join-Path $KafraSource $theme.id) $image.sourceFile
    $bytes = [IO.File]::ReadAllBytes($source)
    if ((Sha256 $bytes) -ne $image.sourceSha256) { throw "Kafra source hash mismatch: $($theme.id)/$($image.sourceFile)" }
    [IO.File]::WriteAllBytes((Join-Path $themeStage $image.sourceFile), $bytes)
  }
  $kafraJobs += [pscustomobject]@{ Stage = $themeStage; Target = Join-Path $dashboard ('assets\kafra-themes\' + $theme.id) }
}

# 2. Original client files, read-only through GrfCL.
$grfDll = Join-Path $GrfLibraryDir 'GRF.dll'
if (-not (Test-Path -LiteralPath $grfDll)) { throw "Missing GRF library: $GrfLibraryDir" }
Get-ChildItem -LiteralPath $GrfLibraryDir -Filter '*.dll' | ForEach-Object { try { [void][Reflection.Assembly]::LoadFrom($_.FullName) } catch {} }
$encodingType = [AppDomain]::CurrentDomain.GetAssemblies() | ForEach-Object { $_.GetType('Utilities.Services.EncodingService', $false) } | Where-Object { $null -ne $_ } | Select-Object -First 1
if ($null -eq $encodingType) { throw 'Unable to load GrfCL EncodingService' }
$encodingType.GetProperty('DisplayEncoding', [Reflection.BindingFlags]'Public,Static').SetValue($null, [Text.Encoding]::GetEncoding(949), $null)
$clientStage = Join-Path $staging 'client'
[void](New-Item -ItemType Directory -Force -Path $clientStage)
$wanted = @{}
foreach ($asset in $clientManifest.assets) {
  $wanted[('data\texture\' + $clientManifest.sourceRoot.Replace('/', '\').Replace('data\texture\', '') + '\' + $asset.sourcePath.Replace('/', '\')).ToLowerInvariant()] = $asset
}
$archive = Join-Path $ClientDir $clientManifest.sourceArchive
$grf = [GRF.Core.GrfHolder]::new($archive)
try {
  foreach ($entry in $grf.FileTable) {
    $key = ([string]$entry.RelativePath).ToLowerInvariant()
    if (-not $wanted.ContainsKey($key)) { continue }
    $asset = $wanted[$key]
    $bytes = [byte[]]$entry.GetDecompressedData()
    if ((Sha256 $bytes) -ne $asset.sourceSha256) { throw "Client source hash mismatch: $($asset.sourcePath)" }
    [IO.File]::WriteAllBytes((Join-Path $clientStage ($asset.id + '.bmp')), $bytes)
    $wanted.Remove($key)
  }
} finally { $grf.Close() }
if ($wanted.Count) { throw ('Client assets missing: ' + (($wanted.Values | ForEach-Object { $_.sourcePath }) -join ', ')) }

# 3. Convert and place.
$jobs = $kafraJobs + [pscustomobject]@{ Stage = $clientStage; Target = Join-Path $Checkout ('public' + $clientManifest.webRoot.Replace('/', '\')) }
$written = 0
foreach ($job in $jobs) {
  & $converter -AssetFolder $job.Stage
  [void](New-Item -ItemType Directory -Force -Path $job.Target)
  Get-ChildItem -LiteralPath $job.Stage -Filter '*.png' -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $job.Target $_.Name) -Force
    $written += 1
  }
}
[pscustomobject]@{ result = 'TOWN_SERVICE_PREVIEW_ASSETS_READY'; files = $written; staging = $staging } | ConvertTo-Json -Compress
