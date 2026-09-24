$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Administrator\ghost-island-production\ro-stack'
$all = @(Get-CimInstance Win32_Process)
$services = @{}
foreach ($pair in @(@('login',6901),@('char',6122),@('map',5122),@('dashboard',8788))) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $pair[1])
  if ($listeners.Count -ne 1) { throw "LISTENER_COUNT_INVALID:$($pair[0])" }
  $process = @($all | Where-Object ProcessId -eq $listeners[0].OwningProcess)
  if ($process.Count -ne 1) { throw 'PROCESS_IDENTITY_MISSING' }
  if ($pair[0] -eq 'dashboard') {
    if ($process[0].Name -ne 'node.exe' -or $process[0].CommandLine -notlike "*$root*ops*ro-stack*dashboard.mjs*") { throw 'DASHBOARD_IDENTITY_MISMATCH' }
  } else {
    $expected = Join-Path $root ".local\ro-stack\rathena\$($pair[0])-server.exe"
    if ($process[0].ExecutablePath -ine $expected -or @($all | Where-Object Name -eq "$($pair[0])-server.exe").Count -ne 1) { throw 'NATIVE_IDENTITY_MISMATCH' }
  }
  $services[$pair[0]] = @{ pid=[int]$process[0].ProcessId; port=[int]$pair[1]; executable=$process[0].ExecutablePath; started_at=$process[0].CreationDate.ToUniversalTime().ToString('o') }
}
$openkore = @($all | Where-Object { $_.Name -match '^(openkore|wxstart|start)\.exe$' -or ($_.Name -match '^(perl|perl5.*)\.exe$' -and $_.CommandLine -match 'openkore|openkore\.pl') }).Count
if ($openkore -ne 0) { throw 'OPENKORE_RUNTIME_PRESENT' }
$database = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $root '.local\ro-stack\rathena\conf\import\inter_conf.txt')) {
  if ($line -match '^\s*((login|char|map)_server_(ip|port|db))\s*:\s*([^\s]+)') { $database[$Matches[1]]=$Matches[4] }
}
foreach ($service in @('login','char','map')) {
  if ($database["${service}_server_ip"] -ne '127.0.0.1' -or $database["${service}_server_port"] -ne '3307' -or $database["${service}_server_db"] -ne 'ragnarok') { throw 'DATABASE_TARGET_MISMATCH' }
}
$db = @(Get-NetTCPConnection -State Listen -LocalPort 3307)
if ($db.Count -lt 1 -or @($db.OwningProcess | Select-Object -Unique).Count -ne 1) { throw 'DATABASE_LISTENER_INVALID' }
$attachment = Get-Content -LiteralPath (Join-Path $root '.local\ro-stack\procdump-attachment-state.json') -Raw | ConvertFrom-Json
$observer = @($all | Where-Object { $_.ProcessId -eq $attachment.procdumpProcessId -and $_.Name -eq 'procdump64.exe' })
if ($attachment.mapPid -ne $services.map.pid -or $attachment.procdumpAttachedPid -ne $services.map.pid -or $attachment.procdumpAttachStatus -ne 'ATTACHED' -or $observer.Count -ne 1) { throw 'PROCDUMP_ATTACHMENT_INVALID' }
@{ observed_at=[DateTimeOffset]::UtcNow.ToString('o'); services=$services; openkore_runtime_count=$openkore; database_target='127.0.0.1:3307/ragnarok'; database_pid=[int]$db[0].OwningProcess; procdump_pid=[int]$observer[0].ProcessId; procdump_map_pid=$services.map.pid } | ConvertTo-Json -Depth 6 -Compress
