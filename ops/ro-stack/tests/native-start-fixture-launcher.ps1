# Fixture launcher mirroring Start-Stack: Start-Process with file redirection,
# tracked state, single-runtime refusal and a bounded readiness wait.
param([string]$Action)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$state = Join-Path $root 'state.json'
if (Test-Path -LiteralPath $state) { throw 'A runtime state already exists. Run health or stop first.' }
$mode = ([IO.File]::ReadAllText((Join-Path $root 'mode.txt'))).Trim()
if ($mode -eq 'hang') { Start-Sleep -Seconds 40; exit 0 }
$port = [int]([IO.File]::ReadAllText((Join-Path $root 'port.txt')).Trim())
$process = Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'service.ps1'),'-Mode',$mode,'-Port',$port) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'logs\service.out.log') -RedirectStandardError (Join-Path $root 'logs\service.err.log') -PassThru
[IO.File]::WriteAllText($state, ('{"processes":[{"name":"map","id":' + $process.Id + '}]}'))
$deadline = [DateTime]::UtcNow.AddSeconds(8)
while ([DateTime]::UtcNow -lt $deadline) {
  if ($process.HasExited) { Remove-Item -LiteralPath $state; throw 'SERVICE_EXITED_BEFORE_READY' }
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); Write-Host ('service ready pid=' + $process.Id); exit 0 } catch { } finally { $client.Dispose() }
  Start-Sleep -Milliseconds 200
}
Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $state
throw 'SERVICE_NOT_READY'
