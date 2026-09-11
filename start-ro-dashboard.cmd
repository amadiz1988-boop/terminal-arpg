@echo off
setlocal
start "鬼島傳說" /min node "%~dp0ops\ro-stack\dashboard.mjs"
start "" "http://127.0.0.1:8788"
