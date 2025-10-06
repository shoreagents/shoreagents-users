@echo off
REM ShoreAgents Socket Server Startup Script for Windows
REM This script sets up and starts the socket server with PM2

echo 🚀 Starting ShoreAgents Socket Server Setup...

REM Check if PM2 is installed
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PM2 is not installed. Installing PM2...
    npm install -g pm2
    if %errorlevel% neq 0 (
        echo ❌ Failed to install PM2
        exit /b 1
    )
    echo ✅ PM2 installed successfully
) else (
    echo ✅ PM2 is already installed
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    exit /b 1
)

REM Create logs directory
if not exist "logs" (
    mkdir logs
    echo ✅ Created logs directory
)

REM Check if ecosystem.config.js exists
if not exist "ecosystem.config.js" (
    echo ❌ ecosystem.config.js not found. Please ensure it exists in the project root.
    exit /b 1
)

REM Stop any existing PM2 processes for this app
echo 📋 Stopping any existing socket server processes...
pm2 stop shoreagents-socket-server >nul 2>&1
pm2 delete shoreagents-socket-server >nul 2>&1

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
)

REM Start the socket server with PM2
echo 🚀 Starting socket server with PM2...
pm2 start ecosystem.config.js --env production

if %errorlevel% equ 0 (
    echo ✅ Socket server started successfully!
    
    REM Show status
    echo 📊 Current PM2 status:
    pm2 status
    
    REM Setup task scheduler for daily reset (Windows equivalent of cron)
    echo ⏰ Setting up daily reset task scheduler...
    
    REM Create a PowerShell script for daily reset
    echo # Daily reset for ShoreAgents Socket Server > scripts\daily-reset.ps1
    echo # Runs at 2:00 AM daily >> scripts\daily-reset.ps1
    echo. >> scripts\daily-reset.ps1
    echo $logFile = "logs\daily-reset.log" >> scripts\daily-reset.ps1
    echo Add-Content -Path $logFile -Value "$(Get-Date): Starting daily socket server reset" >> scripts\daily-reset.ps1
    echo. >> scripts\daily-reset.ps1
    echo # Reset metrics >> scripts\daily-reset.ps1
    echo try { >> scripts\daily-reset.ps1
    echo     Invoke-RestMethod -Uri "http://localhost:3004/reset-metrics" -Method POST >> scripts\daily-reset.ps1
    echo     Add-Content -Path $logFile -Value "$(Get-Date): Metrics reset completed" >> scripts\daily-reset.ps1
    echo } catch { >> scripts\daily-reset.ps1
    echo     Add-Content -Path $logFile -Value "$(Get-Date): Metrics reset failed: $($_.Exception.Message)" >> scripts\daily-reset.ps1
    echo } >> scripts\daily-reset.ps1
    echo. >> scripts\daily-reset.ps1
    echo # Restart PM2 process >> scripts\daily-reset.ps1
    echo pm2 restart shoreagents-socket-server >> scripts\daily-reset.ps1
    echo Add-Content -Path $logFile -Value "$(Get-Date): Daily reset completed" >> scripts\daily-reset.ps1
    
    echo ✅ Daily reset PowerShell script created: scripts\daily-reset.ps1
    echo.
    echo 📝 To setup daily reset task scheduler, run as Administrator:
    echo schtasks /create /tn "ShoreAgents Daily Reset" /tr "powershell.exe -File %CD%\scripts\daily-reset.ps1" /sc daily /st 02:00 /f
    echo.
    
    REM Save PM2 configuration
    pm2 save
    echo ✅ PM2 configuration saved
    
    echo ✅ Setup completed! Socket server is running.
    echo.
    echo 📋 Useful commands:
    echo   npm run pm2:status                    - Check server status
    echo   npm run pm2:logs                      - View logs
    echo   npm run pm2:restart                   - Restart server
    echo   npm run pm2:stop                      - Stop server
    echo   npm run pm2:monitor                   - Open monitoring dashboard
    echo   curl http://localhost:3004/health     - Check health status
    echo   curl http://localhost:3004/metrics    - View metrics
    echo.
    
) else (
    echo ❌ Failed to start socket server
    exit /b 1
)
