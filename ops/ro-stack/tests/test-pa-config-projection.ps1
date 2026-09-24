<#
  Regression test: stack.config.psd1 -> ro-stack.ps1 -> exact env projection.

  1. Extracts the canonical projection lines from ro-stack.ps1 (the $env:PERSISTENT_AGENT_*
     assignments whose right-hand side reads $config.).
  2. Proves a 1:1 config-key <-> env-key bijection with no duplicates.
  3. Executes the extracted projection lines against the real stack.config.psd1 (fail-closed
     defaults) and against a synthetic canary profile, then asserts the exact env values.

  Read-only: does not touch production DB, servers or service state.
#>
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$stackRoot = Split-Path -Parent $scriptRoot
$configPath = Join-Path $stackRoot 'stack.config.psd1'
$stackScript = Join-Path $stackRoot 'ro-stack.ps1'
$dashboardScript = Join-Path $stackRoot 'dashboard-service.ps1'

$failures = New-Object System.Collections.Generic.List[string]
function Assert-Equal($label, $expected, $actual) {
  if ([string]$expected -ne [string]$actual) {
    $failures.Add("$label expected=[$expected] actual=[$actual]") | Out-Null
    Write-Host "FAIL $label expected=[$expected] actual=[$actual]"
  } else {
    Write-Host "PASS $label = [$actual]"
  }
}

# --- 1. Extract projection lines ---
$lines = Get-Content -LiteralPath $stackScript
$projection = [ordered]@{}
$pattern = '^\s*\$env:(PERSISTENT_AGENT_[A-Z0-9_]+)\s*=\s*(.+)$'
foreach ($line in $lines) {
  if ($line -match '\$config\.' -and $line -match $pattern) {
    $env = $Matches[1]
    $rhs = $Matches[2].Trim()
    if ($projection.Contains($env)) { $failures.Add("DUPLICATE_ENV_KEY $env") | Out-Null }
    $projection[$env] = $rhs
  }
}
Write-Host "projection entries = $($projection.Count)"

# --- 2. Authorized 1:1 mappings (config key -> env key) ---
$authorized = [ordered]@{
  PersistentAgentServiceEnabled                = 'PERSISTENT_AGENT_SERVICE_ENABLED'
  PersistentAgentServiceMapAllowlist           = 'PERSISTENT_AGENT_SERVICE_MAPS'
  PersistentAgentServiceNpcAllowlist           = 'PERSISTENT_AGENT_SERVICE_NPCS'
  PersistentAgentServiceItemAllowlist          = 'PERSISTENT_AGENT_SERVICE_ITEMS'
  PersistentAgentServiceDestinationAllowlist   = 'PERSISTENT_AGENT_SERVICE_DESTINATIONS'
  PersistentAgentSupplyEnabled                 = 'PERSISTENT_AGENT_SUPPLY_ENABLED'
  PersistentAgentSupplyItem                    = 'PERSISTENT_AGENT_SUPPLY_ITEM'
  PersistentAgentSupplyMin                     = 'PERSISTENT_AGENT_SUPPLY_MIN'
  PersistentAgentSupplyTarget                  = 'PERSISTENT_AGENT_SUPPLY_TARGET'
  PersistentAgentSupplyNpc                     = 'PERSISTENT_AGENT_SUPPLY_NPC'
  PersistentAgentSupplyGraceMilliseconds       = 'PERSISTENT_AGENT_SUPPLY_GRACE_MS'
  PersistentAgentSupplyMaxRetries              = 'PERSISTENT_AGENT_SUPPLY_MAX_RETRIES'
  PersistentAgentM1SupplyEnabled               = 'PERSISTENT_AGENT_M1_SUPPLY_ENABLED'
  PersistentAgentRouteDeath                    = 'PERSISTENT_AGENT_ROUTE_DEATH'
  PersistentAgentRouteSupplyOut                = 'PERSISTENT_AGENT_ROUTE_SUPPLY_OUT'
  PersistentAgentRouteSupplyBack               = 'PERSISTENT_AGENT_ROUTE_SUPPLY_BACK'
  PersistentAgentLiveStatusEnabled             = 'PERSISTENT_AGENT_LIVE_STATUS_ENABLED'
  PersistentAgentLiveStatusExportMilliseconds  = 'PERSISTENT_AGENT_LIVE_STATUS_EXPORT_MS'
  PersistentAgentHuntRelocationItems           = 'PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS'
}
$config = Import-PowerShellDataFile -LiteralPath $configPath
foreach ($ck in $authorized.Keys) {
  if (-not $config.ContainsKey($ck)) { $failures.Add("CONFIG_KEY_MISSING $ck") | Out-Null }
  $ek = $authorized[$ck]
  if (-not $projection.Contains($ek)) { $failures.Add("ENV_KEY_NOT_PROJECTED $ek") | Out-Null }
  elseif ($projection[$ek] -notmatch [regex]::Escape("`$config.$ck")) {
    $failures.Add("ENV_KEY_SOURCES_WRONG_CONFIG_KEY $ek -> $($projection[$ek])") | Out-Null
  }
}
Write-Host "authorized mappings checked = $($authorized.Count)"

# --- 3. Dynamic execution of the real projection lines ---
function Invoke-Projection {
  param([string]$Label, [string[]]$Overrides)
  $runner = Join-Path $env:TEMP "pa-projection-$Label.ps1"
  $body = New-Object System.Collections.Generic.List[string]
  $body.Add("`$config = Import-PowerShellDataFile -LiteralPath '$configPath'")
  foreach ($o in $Overrides) { $body.Add($o) }
  foreach ($env in $projection.Keys) { $body.Add("`$env:$env = $($projection[$env])") }
  $body.Add("foreach (`$n in @($(($projection.Keys | ForEach-Object { "'$_'" }) -join ','))) { 'R|' + `$n + '=' + [Environment]::GetEnvironmentVariable(`$n) }")
  [IO.File]::WriteAllLines($runner, $body)
  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $runner 2>&1
  Remove-Item -LiteralPath $runner -Force -ErrorAction SilentlyContinue
  $map = @{}
  foreach ($row in $out) { if ($row -match '^R\|([^=]+)=(.*)$') { $map[$Matches[1]] = $Matches[2] } }
  return $map
}

# 3a. Canonical production profile.
$defaultMap = Invoke-Projection -Label 'default' -Overrides @()
Assert-Equal 'canonical SERVICE_ENABLED'      '1'  $defaultMap['PERSISTENT_AGENT_SERVICE_ENABLED']
Assert-Equal 'canonical SERVICE_MAPS'         'prt_fild05,prt_in,geffen_in,izlude_in,payon,alberta_in,cmd_in01,aldeba_in,prontera,geffen,izlude,alberta,comodo,aldebaran' $defaultMap['PERSISTENT_AGENT_SERVICE_MAPS']
Assert-Equal 'canonical SERVICE_NPCS'         'Tool Dealer#Extended_Prt,Tool Dealer#Extended_Prt1,Tool Dealer#Extended_Gef,Tool Dealer#iz,Tool Dealer#pay3,Tool Dealer#Extended_Alb2,Tool Dealer#Extended_Cmd,Tool Dealer#Extended_Alde,kaf_prontera2,kaf_geffen,Kafra Employee#iz,kaf_payon,kaf_alberta2,kaf_comodo,kaf_aldebaran' $defaultMap['PERSISTENT_AGENT_SERVICE_NPCS']
Assert-Equal 'canonical SERVICE_ITEMS'        '501' $defaultMap['PERSISTENT_AGENT_SERVICE_ITEMS']
Assert-Equal 'canonical SERVICE_DESTINATIONS' ''   $defaultMap['PERSISTENT_AGENT_SERVICE_DESTINATIONS']
Assert-Equal 'canonical SUPPLY_ENABLED'       '1'  $defaultMap['PERSISTENT_AGENT_SUPPLY_ENABLED']
Assert-Equal 'canonical SUPPLY_ITEM'          '501' $defaultMap['PERSISTENT_AGENT_SUPPLY_ITEM']
Assert-Equal 'canonical SUPPLY_GRACE_MS'      '3000' $defaultMap['PERSISTENT_AGENT_SUPPLY_GRACE_MS']
Assert-Equal 'canonical M1_SUPPLY_ENABLED'     '0' $defaultMap['PERSISTENT_AGENT_M1_SUPPLY_ENABLED']
Assert-Equal 'canonical ROUTE_DEATH'          '[{"map":"pay_arche","x":36,"y":131,"portalTo":"pay_dun00"},{"map":"pay_dun00","x":73,"y":78}]' $defaultMap['PERSISTENT_AGENT_ROUTE_DEATH']
Assert-Equal 'canonical LIVE_STATUS_ENABLED'  '1'  $defaultMap['PERSISTENT_AGENT_LIVE_STATUS_ENABLED']
Assert-Equal 'canonical HUNT_RELOCATION_ITEMS' '601' $defaultMap['PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS']

# 3b. Canary profile values.
$canaryRun = @(
  "`$config.PersistentAgentSupplyEnabled = `$true"
  "`$config.PersistentAgentSupplyItem = 501"
  "`$config.PersistentAgentSupplyMin = 5"
  "`$config.PersistentAgentSupplyTarget = 15"
  "`$config.PersistentAgentSupplyNpc = 'Tool Dealer#Extended_Prt'"
  "`$config.PersistentAgentSupplyGraceMilliseconds = 3000"
  "`$config.PersistentAgentSupplyMaxRetries = 3"
  "`$config.PersistentAgentM1SupplyEnabled = `$true"
  "`$config.PersistentAgentRouteDeath = 'ROUTE_DEATH_JSON'"
  "`$config.PersistentAgentRouteSupplyOut = 'ROUTE_OUT'"
  "`$config.PersistentAgentRouteSupplyBack = 'ROUTE_BACK'"
  "`$config.PersistentAgentLiveStatusEnabled = `$true"
  "`$config.PersistentAgentLiveStatusExportMilliseconds = 500"
  "`$config.PersistentAgentHuntRelocationItems = @(601)"
)
$canary = Invoke-Projection -Label 'canary' -Overrides $canaryRun
Assert-Equal 'canary SUPPLY_ENABLED'        '1' $canary['PERSISTENT_AGENT_SUPPLY_ENABLED']
Assert-Equal 'canary SUPPLY_ITEM'           '501' $canary['PERSISTENT_AGENT_SUPPLY_ITEM']
Assert-Equal 'canary SUPPLY_NPC'            'Tool Dealer#Extended_Prt' $canary['PERSISTENT_AGENT_SUPPLY_NPC']
Assert-Equal 'canary SUPPLY_GRACE_MS'       '3000' $canary['PERSISTENT_AGENT_SUPPLY_GRACE_MS']
Assert-Equal 'canary M1_SUPPLY_ENABLED'      '1' $canary['PERSISTENT_AGENT_M1_SUPPLY_ENABLED']
Assert-Equal 'canary ROUTE_DEATH'           'ROUTE_DEATH_JSON' $canary['PERSISTENT_AGENT_ROUTE_DEATH']
Assert-Equal 'canary LIVE_STATUS_ENABLED'   '1' $canary['PERSISTENT_AGENT_LIVE_STATUS_ENABLED']
Assert-Equal 'canary LIVE_STATUS_EXPORT_MS' '500' $canary['PERSISTENT_AGENT_LIVE_STATUS_EXPORT_MS']
Assert-Equal 'canary HUNT_RELOCATION_ITEMS' '601' $canary['PERSISTENT_AGENT_HUNT_RELOCATION_ITEMS']

# The Dashboard launcher projects the matching default-off Web gate to its child process.
$dashboardSource = Get-Content -LiteralPath $dashboardScript -Raw
Assert-Equal 'canonical WEB_M1_SUPPLY_ENABLED' 'False' $config.WebNativeSupplyPolicyEnabled
if ($dashboardSource -notmatch [regex]::Escape('$env:PA_NATIVE_SUPPLY_POLICY_ENABLED=if($stackConfig.WebNativeSupplyPolicyEnabled)')) {
  $failures.Add('WEB_M1_SUPPLY_GATE_NOT_PROJECTED') | Out-Null
}
if ($dashboardSource -notmatch 'Start-Process[\s\S]*?PA_NATIVE_SUPPLY_POLICY_ENABLED=\$previousNativeSupplyPolicy') {
  $failures.Add('WEB_M1_SUPPLY_GATE_NOT_RESTORED') | Out-Null
}

# --- 4. No unmapped $config.PersistentAgent* projection target ---
foreach ($env in $projection.Keys) {
  if ($projection[$env] -match '\$config\.(PersistentAgent[A-Za-z0-9]+)') {
    $ck = $Matches[1]
    if (-not (($authorized.Values -contains $env)) -and -not $config.ContainsKey($ck)) {
      $failures.Add("PROJECTION_CONFIG_KEY_NOT_IN_CONFIG $env -> $ck") | Out-Null
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Host "PA_CONFIG_PROJECTION_TEST = FAIL ($($failures.Count))"
  $failures | ForEach-Object { Write-Host " - $_" }
  exit 1
}
Write-Host 'PA_CONFIG_PROJECTION_TEST = PASS'
exit 0
