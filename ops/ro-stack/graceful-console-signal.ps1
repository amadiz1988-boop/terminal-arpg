[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 2147483647)][int]$TargetPid,
  [Parameter(Mandatory = $true)][string]$ExpectedPath
)

$ErrorActionPreference = 'Stop'
$target = Get-CimInstance Win32_Process -Filter "ProcessId=$TargetPid"
if (-not $target -or -not $target.ExecutablePath -or
    [IO.Path]::GetFullPath([string]$target.ExecutablePath) -ine [IO.Path]::GetFullPath($ExpectedPath)) {
  throw 'GRACEFUL_SIGNAL_TARGET_IDENTITY_MISMATCH'
}

# Start this helper as a child process. It detaches from the launcher's console,
# joins the target's console and sends Ctrl+C. rAthena's SIGINT handler then
# enters its normal shutdown path, including Persistent Agent shutdown hooks.
$source = @'
using System;
using System.Runtime.InteropServices;
public static class GracefulConsoleSignal {
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool AttachConsole(uint processId);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool GenerateConsoleCtrlEvent(uint eventType, uint processGroupId);
}
'@
Add-Type -TypeDefinition $source
[GracefulConsoleSignal]::FreeConsole() | Out-Null
if (-not [GracefulConsoleSignal]::AttachConsole([uint32]$TargetPid)) {
  throw ('GRACEFUL_SIGNAL_ATTACH_FAILED:{0}' -f [Runtime.InteropServices.Marshal]::GetLastWin32Error())
}
try {
  if (-not [GracefulConsoleSignal]::SetConsoleCtrlHandler([IntPtr]::Zero, $true)) {
    throw 'GRACEFUL_SIGNAL_SELF_GUARD_FAILED'
  }
  if (-not [GracefulConsoleSignal]::GenerateConsoleCtrlEvent(0, 0)) {
    throw ('GRACEFUL_SIGNAL_SEND_FAILED:{0}' -f [Runtime.InteropServices.Marshal]::GetLastWin32Error())
  }
} finally {
  [GracefulConsoleSignal]::FreeConsole() | Out-Null
}
Write-Output "GRACEFUL_SIGNAL_SENT pid=$TargetPid"
