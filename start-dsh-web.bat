@echo off
setlocal
chcp 65001 >nul
title DeepSeek Harness - Local Web UI
cd /d "D:\deepseek-harness"
if errorlevel 1 (
  echo ERROR: DSH directory not found: D:\deepseek-harness
  pause
  exit /b 1
)
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: pnpm.cmd was not found in PATH.
  pause
  exit /b 1
)
echo Starting local DSH UI: http://127.0.0.1:3080/
echo Use the sign-in link printed below if a token is required.
call pnpm.cmd dsh web --host 127.0.0.1 --port 3080 --public-url http://127.0.0.1:3080/
set "DSH_EXIT=%ERRORLEVEL%"
if not "%DSH_EXIT%"=="0" pause
exit /b %DSH_EXIT%
