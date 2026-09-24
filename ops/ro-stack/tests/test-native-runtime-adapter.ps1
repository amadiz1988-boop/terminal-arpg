$ErrorActionPreference='Stop'
# Load only the snapshot function AST. The adapter's top-level CLI, Production
# filesystem, process APIs, and every lifecycle action are excluded.
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..\native-runtime-adapter.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'ADAPTER_PARSE_FAILED'}
$function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-Snapshot'},$true)
Invoke-Expression $function.Extent.Text
. (Join-Path $PSScriptRoot '..\procdump-process-identity.ps1')
$runtime=Join-Path $env:TEMP 'native-adapter-fixture'
$native=Join-Path $runtime 'rathena'
$script:fixtureCount=1
$script:wrongMap=$false
$script:ports=@(6901,6122,5122,8788,3307)
$script:started=[DateTime]::Parse('2026-01-01T00:00:00Z').ToUniversalTime()
$script:receiptStarted=$script:started
$approved='C:\Users\Administrator\AppData\Local\Microsoft\Sysinternals\ProcDump-12.01\procdump64.exe'
$filter='*C0000005*,*C000008D*,*C000008E*,*C000008F*,*C0000090*,*C0000091*,*C0000092*,*C0000093*,*C0000094*,*C0000095*'
function Get-CimInstance {
  foreach($pair in @(@('login',11),@('char',12),@('map',13))){
    [pscustomobject]@{Name=$pair[0]+'-server.exe';ProcessId=$pair[1];ExecutablePath=(Join-Path $native ($pair[0]+'-server.exe'));CommandLine='fixture'}
  }
  if($script:fixtureCount -eq 2){[pscustomobject]@{Name='map-server.exe';ProcessId=99;ExecutablePath=(Join-Path $native 'map-server.exe');CommandLine='fixture'}}
  [pscustomobject]@{Name='procdump64.exe';ProcessId=20;ExecutablePath=$approved;CommandLine=('"'+$approved+'" -ma -n 2 -e 1 -f '+$filter+' 13 fixture')}
}
function Get-NetTCPConnection {
  $i=11;foreach($port in $script:ports){[pscustomobject]@{LocalPort=$port;OwningProcess=$i};$i++}
}
function Test-Path {return $true}
function Get-Content {
  @{mapPid=$(if($script:wrongMap){99}else{13});procdumpAttachedPid=13;procdumpAttachStatus='ATTACHED';procdumpProcessId=20;mapProcessStartTime=$script:receiptStarted.ToString('o');mapBinaryPath=(Join-Path $native 'map-server.exe')} | ConvertTo-Json
}
function Get-FileHash {[pscustomobject]@{Hash='D1FC99AE304BD1D2BF28ABEB62531DA959E2431916194981B88C958FD713A8E6'}}
function Get-Process {[pscustomobject]@{Id=13;StartTime=$script:started;HasExited=$false}}
$snapshot=Get-Snapshot
if(-not $snapshot.pass -or $snapshot.counts.map -ne 1 -or -not $snapshot.procdump_receipt -or
    $snapshot.procdump_process_identity.PROCESS_IDENTITY_MATCH -ne 'YES'){throw 'VALID_SNAPSHOT_REJECTED'}
Write-Output 'PASS fixture snapshot validates one canonical runtime and ProcDump'
$script:receiptStarted=$script:started.AddTicks(-1)
$oneTick=Get-Snapshot
if(-not $oneTick.procdump_receipt -or $oneTick.procdump_process_identity.start_time_delta_ticks -ne 1){throw 'ONE_TICK_RECEIPT_REJECTED'}
Write-Output 'PASS one-tick receipt survives JSON reader and Native snapshot'
$script:receiptStarted=$script:started.AddTicks(-2)
$twoTicks=Get-Snapshot
if($twoTicks.procdump_receipt -or $twoTicks.procdump_process_identity.reason -ne 'START_TIME_DELTA_EXCEEDED'){throw 'TWO_TICK_RECEIPT_ACCEPTED'}
Write-Output 'PASS two-tick receipt fails closed in Native snapshot'
$script:receiptStarted=$script:started
$script:fixtureCount=2
if((Get-Snapshot).pass){throw 'SECOND_STACK_ACCEPTED'}
Write-Output 'PASS fixture duplicate map is rejected'
$script:fixtureCount=1;$script:wrongMap=$true
if((Get-Snapshot).procdump_receipt){throw 'WRONG_MAP_CAPTURE_ACCEPTED'}
Write-Output 'PASS fixture stale ProcDump map is rejected'
Write-Output 'NATIVE_RUNTIME_ADAPTER_TEST_COUNT=5'
