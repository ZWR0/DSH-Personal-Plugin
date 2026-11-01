
@echo off
title DeepSeek Harness Web

REM Enter project directory
cd /d "D:\deepseek-harness"
if errorlevel 1 (
    echo Failed to enter project directory
    pause
    exit /b 1
)

REM Start DeepSeek Harness locally
echo Starting DeepSeek Harness Web...
pnpm dsh web --port 3080 --public-url https://msd.tail801f4c.ts.net/ --trusted-host msd.tail801f4c.ts.net

pause