$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$helper = Join-Path $root 'ops\ro-stack\graceful-console-signal.ps1'
$audit = Join-Path $root ('.local\ro-stack\audits\graceful-console-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $audit | Out-Null
$sourcePath = Join-Path $audit 'GracefulTarget.cs'
$exe = Join-Path $audit 'GracefulTarget.exe'
$ready = Join-Path $audit 'ready.txt'
$marker = Join-Path $audit 'clean-exit.txt'
$stdout = Join-Path $audit 'stdout.log'
$stderr = Join-Path $audit 'stderr.log'
$source = @'
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
public static class GracefulTarget {
  private static volatile bool stop;
  public static int Main(string[] args) {
    var listener = new TcpListener(IPAddress.Loopback, 0);
    listener.Start();
    Console.CancelKeyPress += (sender, eventArgs) => { eventArgs.Cancel = true; stop = true; };
    File.WriteAllText(args[0], ((IPEndPoint)listener.LocalEndpoint).Port.ToString());
    while (!stop) Thread.Sleep(50);
    listener.Stop();
    File.WriteAllText(args[1], "CLEAN_EXIT");
    return 0;
  }
}
'@
[IO.File]::WriteAllText($sourcePath, $source, [Text.UTF8Encoding]::new($false))
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'CSC_MISSING' }
& $compiler /nologo /target:exe ("/out:$exe") $sourcePath
if ($LASTEXITCODE -ne 0) { throw 'GRACEFUL_TARGET_BUILD_FAILED' }
$target = Start-Process -FilePath $exe -ArgumentList @($ready, $marker) -WorkingDirectory $audit -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
try {
  $deadline = (Get-Date).AddSeconds(10)
  while (-not (Test-Path -LiteralPath $ready) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 100
  }
  if (-not (Test-Path -LiteralPath $ready)) { throw 'GRACEFUL_TARGET_NOT_READY' }
  $port = [int](Get-Content -LiteralPath $ready -Raw)
  if (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -ne 1) {
    throw 'GRACEFUL_TARGET_PORT_NOT_LISTENING'
  }
  $deniedArgs = @{
    FilePath = 'powershell.exe'
    ArgumentList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $helper,
      '-TargetPid', $target.Id, '-ExpectedPath', ($exe + '.wrong'))
    WindowStyle = 'Hidden'
    RedirectStandardOutput = Join-Path $audit 'denied.stdout.log'
    RedirectStandardError = Join-Path $audit 'denied.stderr.log'
    Wait = $true
    PassThru = $true
  }
  $denied = Start-Process @deniedArgs
  if ($denied.ExitCode -eq 0 -or -not (Get-Process -Id $target.Id -ErrorAction SilentlyContinue)) {
    throw 'GRACEFUL_SIGNAL_IDENTITY_GUARD_FAILED'
  }
  $approvedOut = Join-Path $audit 'approved.stdout.log'
  $approvedErr = Join-Path $audit 'approved.stderr.log'
  $approvedArgs = @{
    FilePath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
    ArgumentList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      ('"{0}"' -f $helper), '-TargetPid', [string]$target.Id,
      '-ExpectedPath', ('"{0}"' -f $exe))
    WindowStyle = 'Hidden'
    RedirectStandardOutput = $approvedOut
    RedirectStandardError = $approvedErr
    Wait = $true
    PassThru = $true
  }
  $approved = Start-Process @approvedArgs
  if ($approved.ExitCode -ne 0 -or (Get-Content -LiteralPath $approvedOut -Raw) -notmatch 'GRACEFUL_SIGNAL_SENT') {
    throw 'GRACEFUL_SIGNAL_FAILED'
  }
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Process -Id $target.Id -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 100
  }
  if (Get-Process -Id $target.Id -ErrorAction SilentlyContinue) { throw 'GRACEFUL_TARGET_DID_NOT_EXIT' }
  if ((Get-Content -LiteralPath $marker -Raw) -ne 'CLEAN_EXIT') { throw 'GRACEFUL_TARGET_DID_NOT_CLEAN_UP' }
  if (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -ne 0) {
    throw 'GRACEFUL_TARGET_PORT_NOT_RELEASED'
  }
  Write-Output 'GRACEFUL_CONSOLE_SIGNAL_PASS clean_exit=1 port_released=1 identity_guard=1'
} finally {
  if (Get-Process -Id $target.Id -ErrorAction SilentlyContinue) {
    Stop-Process -Id $target.Id -Force
  }
}
