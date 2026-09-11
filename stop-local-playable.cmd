@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\demo-watchdog.ps1" stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\demo-tunnel.ps1" stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\dashboard-service.ps1" stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\stop-all-openkore.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\ro-stack.ps1" stop
echo Local playable RO services stopped.
pause
