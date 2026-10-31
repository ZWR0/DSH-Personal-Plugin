@echo off
setlocal
chcp 65001 >nul
title DeepSeek Harness - Web Launcher
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dsh-web.ps1"
set "DSH_LAUNCH_EXIT=%ERRORLEVEL%"
if not "%DSH_LAUNCH_EXIT%"=="0" pause
exit /b %DSH_LAUNCH_EXIT%