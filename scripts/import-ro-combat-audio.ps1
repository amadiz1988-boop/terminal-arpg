param(
  [string]$ClientDir = 'C:\Program Files (x86)\Gravity\RagnarokOnline',
  [string]$GrfLibraryDir = "$env:LOCALAPPDATA\Temp\GRFEditor-src\GrfCL\Files"
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $ClientDir 'data0.grf'
$output = Join-Path $repo 'public\ro\client\sfx\official'
$manifestPath = Join-Path $output 'combat-manifest.json'

if (-not (Test-Path -LiteralPath $archive)) {
  throw "找不到官方客戶端封裝：$archive"
}
if (-not (Test-Path -LiteralPath (Join-Path $GrfLibraryDir 'GRF.dll'))) {
  throw "找不到唯讀 GRF 函式庫：$GrfLibraryDir"
}

Get-ChildItem -LiteralPath $GrfLibraryDir -Filter '*.dll' | ForEach-Object {
  try { [void][Reflection.Assembly]::LoadFrom($_.FullName) } catch {}
}

$entries = [ordered]@{
  '_attack_dagger.wav' = 'data\wav\_attack_dagger.wav'
  '_hit_dagger.wav' = 'data\wav\_hit_dagger.wav'
  '_attack_sword.wav' = 'data\wav\_attack_sword.wav'
  '_hit_sword.wav' = 'data\wav\_hit_sword.wav'
  '_attack_mace.wav' = 'data\wav\_attack_mace.wav'
  '_hit_mace.wav' = 'data\wav\_hit_mace.wav'
  '_attack_rod.wav' = 'data\wav\_attack_rod.wav'
  '_hit_rod.wav' = 'data\wav\_hit_rod.wav'
  '_attack_bow.wav' = 'data\wav\_attack_bow.wav'
  '_hit_arrow.wav' = 'data\wav\_hit_arrow.wav'
  '_attack_axe.wav' = 'data\wav\_attack_axe.wav'
  '_hit_axe.wav' = 'data\wav\_hit_axe.wav'
  '_hit_fist1.wav' = 'data\wav\_hit_fist1.wav'
  '_hit_fist2.wav' = 'data\wav\_hit_fist2.wav'
  '_hit_fist3.wav' = 'data\wav\_hit_fist3.wav'
  '_hit_fist4.wav' = 'data\wav\_hit_fist4.wav'
  'poring_attack.wav' = 'data\wav\poring_attack.wav'
  'poring_damage.wav' = 'data\wav\poring_damage.wav'
  'poring_die.wav' = 'data\wav\poring_die.wav'
  'lunatic_attack.wav' = 'data\wav\lunatic_attack.wav'
  'lunatic_die.wav' = 'data\wav\lunatic_die.wav'
  'fabre_attack.wav' = 'data\wav\fabre_attack.wav'
  'fabre_damage.wav' = 'data\wav\fabre_damage.wav'
  'fabre_die.wav' = 'data\wav\fabre_die.wav'
  'monster_insect.wav' = 'data\wav\monster_insect.wav'
  'monster_shell.wav' = 'data\wav\monster_shell.wav'
  'peco_egg_heartbeat.wav' = 'data\wav\peco_egg_heartbeat.wav'
  'pupa_die.wav' = 'data\wav\pupa_die.wav'
  'damage_male.wav' = 'data\wav\damage_male.wav'
  'die_male.wav' = 'data\wav\die_male.wav'
  'damage_novice_female.wav' = 'data\wav\damage_novice_female.wav'
  'die_novice_female.wav' = 'data\wav\die_novice_female.wav'
  'damage_swordman_female.wav' = 'data\wav\damage_swordman_female.wav'
  'die_swordman_female.wav' = 'data\wav\die_swordman_female.wav'
  'damage_magician_female.wav' = 'data\wav\damage_magician_female.wav'
  'die_magician_female.wav' = 'data\wav\die_magician_female.wav'
  'damage_archer_female.wav' = 'data\wav\damage_archer_female.wav'
  'die_archer_female.wav' = 'data\wav\die_archer_female.wav'
  'damage_acolyte_female.wav' = 'data\wav\damage_acolyte_female.wav'
  'die_acolyte_female.wav' = 'data\wav\die_acolyte_female.wav'
  'damage_merchant_female.wav' = 'data\wav\damage_merchant_female.wav'
  'die_merchant_female.wav' = 'data\wav\die_merchant_female.wav'
  'damage_thief_female.wav' = 'data\wav\damage_thief_female.wav'
  'die_thief_female.wav' = 'data\wav\die_thief_female.wav'
  'ui_confirm.wav' = 'data\wav\se_ding1.wav'
  'ui_cancel.wav' = 'data\wav\se_ding2.wav'
  'ui_tab.wav' = 'data\wav\se_turn_page01.wav'
  'ui_open.wav' = 'data\wav\se_top.wav'
  'ui_close.wav' = 'data\wav\se_top2.wav'
  'item_pickup.wav' = 'data\wav\effect\itempokjuk.wav'
  'item_drop.wav' = 'data\wav\effect\drop_effect_1.wav'
  'equip_item_01.wav' = 'data\wav\se_equip_item_01.wav'
  'equip_item_02.wav' = 'data\wav\se_equip_item_02.wav'
  'equip_item_03.wav' = 'data\wav\se_equip_item_03.wav'
  'equip_item_04.wav' = 'data\wav\se_equip_item_04.wav'
  'equip_item_05.wav' = 'data\wav\se_equip_item_05.wav'
  'equip_item_06.wav' = 'data\wav\se_equip_item_06.wav'
  'equip_item_07.wav' = 'data\wav\se_equip_item_07.wav'
  'item_drink_potion.wav' = 'data\wav\se_drink_potion.wav'
  'fly_wing.wav' = 'data\wav\effect\ef_teleportation.wav'
  'warp.wav' = 'data\wav\effect\warp.wav'
  'portal.wav' = 'data\wav\effect\ef_portal.wav'
  'heal.wav' = 'data\wav\effect\ef_healsp.wav'
  'level_up.wav' = 'data\wav\levelup.wav'
  'job_level_up.wav' = 'data\wav\effect\st_job_level_up.wav'
  'success.wav' = 'data\wav\effect\p_success.wav'
  'failure.wav' = 'data\wav\effect\p_failed.wav'
  'get_coin.wav' = 'data\wav\se_get_coin.wav'
}

New-Item -ItemType Directory -Force -Path $output | Out-Null
$grf = [GRF.Core.GrfHolder]::new($archive)
try {
  $manifest = @()
  foreach ($pair in $entries.GetEnumerator()) {
    $entry = $grf.FileTable[$pair.Value]
    if ($null -eq $entry) { throw "GRF 缺少官方音效：$($pair.Value)" }
    $target = Join-Path $output $pair.Key
    $bytes = $entry.GetDecompressedData()
    if ($bytes.Length -lt 12 -or [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF') {
      throw "官方音效格式驗證失敗：$($pair.Value)"
    }
    [IO.File]::WriteAllBytes($target, $bytes)
    $manifest += [ordered]@{
      output = "public/ro/client/sfx/official/$($pair.Key)"
      source = "data0.grf:$($pair.Value.Replace('\', '/'))"
      bytes = $bytes.Length
      sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
    }
  }
  [ordered]@{
    sourceArchive = 'data0.grf'
    archiveSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
    importedAt = (Get-Date).ToString('yyyy-MM-dd')
    files = $manifest
  } | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath $manifestPath
  Write-Output "RO_COMBAT_AUDIO_IMPORTED=$($manifest.Count)"
} finally {
  $grf.Dispose()
}
