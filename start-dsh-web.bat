@echo off
setlocal
chcp 65001 >nul
title DeepSeek Harness - Tailscale HTTPS
call "%~dp0小说\vpn-launcher\start-dsh-web.bat" %*
exit /b %ERRORLEVEL%