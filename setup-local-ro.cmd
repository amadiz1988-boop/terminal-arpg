@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ops\ro-stack\ro-stack.ps1" setup
pause
