@echo off
setlocal
cd /d "%~dp0"

call start-local-playable.cmd
if errorlevel 1 goto :failed

echo.
echo Creating the temporary HTTPS multiplayer entrance...
for /f "usebackq delims=" %%U in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\demo-tunnel.ps1" start`) do set "DEMO_URL=%%U"
if not defined DEMO_URL goto :failed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "ops\ro-stack\demo-watchdog.ps1" start
if errorlevel 1 goto :failed

echo.
echo Friends Alpha is ready:
echo %DEMO_URL%
echo.
echo Keep this window and computer running during the test.
pause
exit /b 0

:failed
echo Friends Alpha failed to start. Check the local server health first.
pause
exit /b 1
