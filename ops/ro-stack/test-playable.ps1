[CmdletBinding()]
param([int]$WaitSeconds = 90)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

& (Join-Path $PSScriptRoot 'ro-stack.ps1') health
if ($LASTEXITCODE -ne 0) { throw 'RO stack health check failed.' }

& node --check (Join-Path $PSScriptRoot 'dashboard.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Dashboard syntax check failed.' }
& node --check (Join-Path $PSScriptRoot 'dashboard\app.js')
if ($LASTEXITCODE -ne 0) { throw 'Dashboard client syntax check failed.' }

$page = Invoke-WebRequest 'http://127.0.0.1:8788/' -UseBasicParsing -TimeoutSec 3
if ($page.StatusCode -ne 200) { throw 'Dashboard did not return HTTP 200.' }
foreach ($requiredMarker in @('id="loginForm"', 'class="classic-logo"', 'id="characterForm"', 'id="createPaperdoll"', 'id="start"', 'id="stop"', 'id="log"', 'id="lootSummary"', 'id="equipment"', 'id="paperdollBody"', 'id="inventoryList"', 'data-inventory="consumable"', 'id="stats"', 'id="resetStats"', 'id="derivedStats"', 'id="bgm"', 'id="authMusicVolume"', 'id="musicVolume"', 'id="soundVolume"')) {
  if ($page.Content -notlike "*$requiredMarker*") { throw "Dashboard is missing: $requiredMarker" }
}

foreach ($asset in @('novice-male.png', 'novice-female.png')) {
  $path = Join-Path $projectRoot "public\ro\client\paperdoll\$asset"
  if (-not (Test-Path -LiteralPath $path)) { throw "Paper doll asset is missing: $asset" }
}
$iconCount = @(Get-ChildItem (Join-Path $projectRoot 'public\ro\client\items') -Filter '*.png' -File).Count
if ($iconCount -lt 21) { throw "Transparent item icon set is incomplete: $iconCount/21" }
$skinCount = @(Get-ChildItem (Join-Path $projectRoot 'public\ro\client\skin\default') -Filter '*.png' -File).Count
if ($skinCount -lt 101) { throw "Official Default Skin set is incomplete: $skinCount/101" }
foreach ($asset in @('01-title.mp3', '08-prontera.mp3', '12-streamside.mp3')) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "public\ro\client\bgm\$asset"))) { throw "BGM asset is missing: $asset" }
}
foreach ($asset in @('attack.wav', 'hurt.wav', 'defeat.wav')) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "public\ro\client\sfx\$asset"))) { throw "Combat SFX asset is missing: $asset" }
}

$paperdollResponse = Invoke-WebRequest 'http://127.0.0.1:8788/ro/client/paperdoll/novice-male.png' -UseBasicParsing -TimeoutSec 3
if ($paperdollResponse.StatusCode -ne 200 -or $paperdollResponse.Headers.'Content-Type' -notlike 'image/png*') { throw 'Paper doll HTTP asset route failed.' }
$iconResponse = Invoke-WebRequest 'http://127.0.0.1:8788/ro/client/items/Jellopy.png' -UseBasicParsing -TimeoutSec 3
if ($iconResponse.StatusCode -ne 200 -or $iconResponse.Headers.'Content-Type' -notlike 'image/png*') { throw 'Item icon HTTP asset route failed.' }
$musicResponse = Invoke-WebRequest 'http://127.0.0.1:8788/ro/client/bgm/01-title.mp3' -UseBasicParsing -TimeoutSec 3
if ($musicResponse.StatusCode -ne 200 -or $musicResponse.Headers.'Content-Type' -notlike 'audio/mpeg*') { throw 'BGM HTTP asset route failed.' }
$soundResponse = Invoke-WebRequest 'http://127.0.0.1:8788/ro/client/sfx/attack.wav' -UseBasicParsing -TimeoutSec 3
if ($soundResponse.StatusCode -ne 200 -or $soundResponse.Headers.'Content-Type' -notlike 'audio/wav*') { throw 'Combat SFX HTTP asset route failed.' }

$previousOrigin = $env:RO_DEMO_ORIGIN
$env:RO_DEMO_ORIGIN = 'http://127.0.0.1:8788'
try {
  & node (Join-Path $projectRoot 'scripts\test-multiplayer-demo.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Multiplayer demo gate failed.' }
} finally {
  $env:RO_DEMO_ORIGIN = $previousOrigin
}
