# Harmless long-lived fixture service: loopback listener plus continuous output.
param([string]$Mode, [int]$Port)
if ($Mode -eq 'exit-fail') { [Console]::Error.WriteLine('fixture fatal'); exit 3 }
$listener = $null
if ($Mode -ne 'never-ready') {
  $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
  $listener.Start()
}
for ($i = 0; $i -lt 60; $i++) {
  if ($Mode -ne 'alive-stderr') { [Console]::Out.WriteLine('tick ' + $i); [Console]::Out.Flush() }
  if ($Mode -ne 'alive-stdout') { [Console]::Error.WriteLine('err ' + $i); [Console]::Error.Flush() }
  Start-Sleep -Seconds 1
}
