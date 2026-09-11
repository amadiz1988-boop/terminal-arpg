@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\ro-stack.ps1" health >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\ro-stack.ps1" start
  if errorlevel 1 goto :failed
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\dashboard-service.ps1" start
if errorlevel 1 goto :failed

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8788/"
echo Local playable RO is ready: http://127.0.0.1:8788/
exit /b 0

:failed
echo Failed to start the local RO stack. Run health-local-ro.cmd for details.
exit /b 1
