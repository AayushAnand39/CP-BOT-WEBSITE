@echo off
setlocal
cd /d "%~dp0"
title CP Bot Backend Launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1" %*
if errorlevel 1 (
    echo.
    echo Backend startup failed. See the error above.
    pause
)
