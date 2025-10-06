# ShoreAgents Socket Server Startup Script for Windows PowerShell
# This script sets up and starts the socket server with PM2

Write-Host "🚀 Starting ShoreAgents Socket Server Setup..." -ForegroundColor Blue

# Function to print colored output
function Write-Status {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if PM2 is installed
try {
    $pm2Version = pm2 --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "PM2 not found"
    }
    Write-Success "PM2 is already installed (version: $pm2Version)"
} catch {
    Write-Status "PM2 is not installed. Installing PM2..."
    try {
        npm install -g pm2
        if ($LASTEXITCODE -eq 0) {
            Write-Success "PM2 installed successfully"
        } else {
            throw "Failed to install PM2"
        }
    } catch {
        Write-Error "Failed to install PM2: $_"
        exit 1
    }
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Success "Node.js is installed (version: $nodeVersion)"
} catch {
    Write-Error "Node.js is not installed"
    exit 1
}

# Create logs directory
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Success "Created logs directory"
}

# Check if ecosystem.config.js exists
if (!(Test-Path "ecosystem.config.js")) {
    Write-Error "ecosystem.config.js not found. Please ensure it exists in the project root."
    exit 1
}

# Stop any existing PM2 processes for this app
Write-Status "Stopping any existing socket server processes..."
pm2 stop shoreagents-socket-server 2>$null
pm2 delete shoreagents-socket-server 2>$null

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Status "Installing dependencies..."
    try {
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Dependencies installed successfully"
        } else {
            throw "Failed to install dependencies"
        }
    } catch {
        Write-Error "Failed to install dependencies: $_"
        exit 1
    }
}

# Start the socket server with PM2
Write-Status "Starting socket server with PM2..."
try {
    pm2 start ecosystem.config.js --env production
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Socket server started successfully!"
        
        # Show status
        Write-Status "Current PM2 status:"
        pm2 status
        
        # Setup task scheduler for daily reset
        Write-Status "Setting up daily reset task scheduler..."
        
        # Create a PowerShell script for daily reset
        $dailyResetScript = @"
# Daily reset for ShoreAgents Socket Server
# Runs at 2:00 AM daily

`$logFile = "logs\daily-reset.log"
Add-Content -Path `$logFile -Value "`$(Get-Date): Starting daily socket server reset"

# Reset metrics
try {
    Invoke-RestMethod -Uri "http://localhost:3004/reset-metrics" -Method POST
    Add-Content -Path `$logFile -Value "`$(Get-Date): Metrics reset completed"
} catch {
    Add-Content -Path `$logFile -Value "`$(Get-Date): Metrics reset failed: `$(`$_.Exception.Message)"
}

# Restart PM2 process
pm2 restart shoreagents-socket-server
Add-Content -Path `$logFile -Value "`$(Get-Date): Daily reset completed"
"@
        
        $dailyResetScript | Out-File -FilePath "scripts\daily-reset.ps1" -Encoding UTF8
        Write-Success "Daily reset PowerShell script created: scripts\daily-reset.ps1"
        
        Write-Host ""
        Write-Warning "To setup daily reset task scheduler, run as Administrator:"
        Write-Host "schtasks /create /tn `"ShoreAgents Daily Reset`" /tr `"powershell.exe -File %CD%\scripts\daily-reset.ps1`" /sc daily /st 02:00 /f" -ForegroundColor Yellow
        Write-Host ""
        
        # Save PM2 configuration
        pm2 save
        Write-Success "PM2 configuration saved"
        
        Write-Success "Setup completed! Socket server is running."
        Write-Host ""
        Write-Status "Useful commands:"
        Write-Host "  npm run pm2:status                    - Check server status" -ForegroundColor Cyan
        Write-Host "  npm run pm2:logs                      - View logs" -ForegroundColor Cyan
        Write-Host "  npm run pm2:restart                   - Restart server" -ForegroundColor Cyan
        Write-Host "  npm run pm2:stop                      - Stop server" -ForegroundColor Cyan
        Write-Host "  npm run pm2:monitor                   - Open monitoring dashboard" -ForegroundColor Cyan
        Write-Host "  curl http://localhost:3004/health     - Check health status" -ForegroundColor Cyan
        Write-Host "  curl http://localhost:3004/metrics    - View metrics" -ForegroundColor Cyan
        Write-Host ""
        
    } else {
        throw "Failed to start socket server"
    }
} catch {
    Write-Error "Failed to start socket server: $_"
    exit 1
}
