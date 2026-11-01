@echo off
title DeepSeek Harness Web

cd /d "D:\deepseek-harness"
if errorlevel 1 exit /b 1

REM Start Tailscale HTTPS proxy
tailscale serve --bg 3080
if errorlevel 1 (
    echo Failed to start Tailscale Serve
    pause
    exit /b 1
)

REM Start DeepSeek Harness
pnpm dsh web --port 3080 --trusted-host msd.tail801f4c.ts.net --public-url https://msd.tail801f4c.ts.net/

pause