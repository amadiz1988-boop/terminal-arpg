param(
  [string]$DatabasePassword = $env:MYSQL_PWD,
  [int]$DatabasePort = 3307
)

$ErrorActionPreference = 'Stop'
if (-not $DatabasePassword) { throw 'DB_PASSWORD_REQUIRED' }
$maria = 'C:\Program Files\MariaDB 12.3\bin\mariadb.exe'
if (-not (Test-Path -LiteralPath $maria)) { throw 'MARIADB_NOT_FOUND' }
$sqlRoot = Join-Path $PSScriptRoot '..\sql'
$db = 'test_pa_phase_' + ([guid]::NewGuid().ToString('N').Substring(0, 12))
$env:MYSQL_PWD = $DatabasePassword
$argsBase = @('--ssl=OFF', '--protocol=tcp', '-h', '127.0.0.1', '-P', "$DatabasePort", '-u', 'rathena_local', '-N', '-B')

function Sql([string]$query, [string]$target = '') {
  $args = $argsBase + @('-e', $query)
  if ($target) { $args += $target }
  $output = & $maria @args 2>&1
  if ($LASTEXITCODE -ne 0) { throw "SQL_FAILED $($output | Out-String)" }
  return ($output | Out-String).Trim()
}

$phases = @(
  'AUTO_FARM', 'DEAD', 'DEATH_RECOVERY_READY', 'DEATH_RETURN_IN_PROGRESS',
  'DEATH_RETURN_WAITING_COOLDOWN', 'DEATH_TOWN_MAINTENANCE', 'IDLE',
  'INV_MAINT_BLOCKED', 'INVENTORY_CAPACITY_BLOCKED', 'INVENTORY_MAINTENANCE',
  'NAVIGATING', 'RECOVERING', 'RECOVERY_BLOCKED', 'RELEASING', 'RESPAWNING',
  'RETURN_TO_FARM', 'SUPPLY', 'SUPPLY_HOME_REQUIRED',
  'DEATH_RETURN_INVALID_CONTEXT', 'DEATH_MAINTENANCE_SUPPLY_BLOCKED',
  'DEATH_MAINTENANCE_INVENTORY_UNSAFE', 'DEATH_MAINTENANCE_STORAGE_BLOCKED',
  'DEATH_MAINTENANCE_SELL_BLOCKED', 'DEATH_MAINTENANCE_INTENT_PERSIST_FAILED',
  'DEATH_MAINTENANCE_RESTART_RETRY_REQUIRED', 'DEATH_RETURN_BLOCKED',
  'DEATH_MAINTENANCE_UNAVAILABLE', 'DEATH_RETURN_BLOCKED_INSUFFICIENT_ZENY',
  'DEATH_RETURN_LIFECYCLE_CHANGED', 'DEATH_RETURN_TIMEOUT',
  'DEATH_RETURN_CLOCK_UNAVAILABLE', 'DEATH_RETURN_SAFE_LANDING_UNAVAILABLE',
  'DEATH_RETURN_TELEPORT_REJECTED', 'DEATH_RETURN_COOLDOWN_STORAGE_UNAVAILABLE',
  'DEATH_RETURN_RECEIPT_PERSIST_FAILED', 'DEATH_RETURN_FARM_RESUME_FAILED',
  'DEATH_RETURN_STATE_CONFIRM_FAILED'
)
$longest = $phases | Sort-Object Length -Descending | Select-Object -First 1
if ($longest.Length -gt 64) { throw "CANONICAL_PHASE_TOO_LONG $longest" }

try {
  Sql "CREATE DATABASE ``$db`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" | Out-Null
  foreach ($migration in @('006-persistent-agent-live-status.sql', '013-persistent-agent-runtime-phase-width.sql')) {
    if ($migration -eq '013-persistent-agent-runtime-phase-width.sql') {
      $before = Sql "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$db' AND TABLE_NAME='persistent_agent_live_status' AND COLUMN_NAME='runtime_phase'"
      if ($before -ne '24') { throw "OLD_WIDTH_WRONG $before" }
      Sql 'INSERT INTO persistent_agent_live_status (char_id,account_id,runtime_phase) VALUES (1,2,''IDLE'')' $db | Out-Null
    }
    $path = (Join-Path $sqlRoot $migration).Replace('\', '/')
    $output = & $maria @argsBase $db -e "source $path" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "MIGRATION_FAILED $migration $($output | Out-String)" }
  }
  $column = Sql "SELECT CONCAT(CHARACTER_MAXIMUM_LENGTH,'|',IS_NULLABLE,'|',COLUMN_DEFAULT,'|',CHARACTER_SET_NAME,'|',COLLATION_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$db' AND TABLE_NAME='persistent_agent_live_status' AND COLUMN_NAME='runtime_phase'"
  if ($column -ne "64|NO|'IDLE'|utf8mb4|utf8mb4_unicode_ci") { throw "NEW_COLUMN_WRONG $column" }
  if ((Sql 'SELECT runtime_phase FROM persistent_agent_live_status WHERE char_id=1' $db) -ne 'IDLE') { throw 'EXISTING_ROW_LOST' }
  foreach ($phase in $phases) {
    Sql "INSERT INTO persistent_agent_live_status (char_id,account_id,runtime_phase) VALUES (1,2,'$phase') ON DUPLICATE KEY UPDATE runtime_phase=VALUES(runtime_phase)" $db | Out-Null
    if ((Sql 'SELECT runtime_phase FROM persistent_agent_live_status WHERE char_id=1' $db) -ne $phase) { throw "PHASE_UPSERT_FAILED $phase" }
  }
  $overLimit = 'X' * 65
  $errorOutput = & $maria @argsBase $db -e "SET SESSION sql_mode='STRICT_ALL_TABLES'; UPDATE persistent_agent_live_status SET runtime_phase='$overLimit' WHERE char_id=1" 2>&1
  if ($LASTEXITCODE -eq 0) { throw 'OVER_LIMIT_ACCEPTED' }
  if ((Sql 'SELECT runtime_phase FROM persistent_agent_live_status WHERE char_id=1' $db) -ne $phases[-1]) { throw 'OVER_LIMIT_CHANGED_ROW' }
  Write-Output "RUNTIME_PHASE_MIGRATION_PASS old=24 new=64 rows_preserved=1 canonical_count=$($phases.Count) max_length=$($longest.Length) longest=$longest over_limit=rejected"
} finally {
  try { Sql "DROP DATABASE IF EXISTS ``$db``" | Out-Null } finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
}
