# Daily reset for ShoreAgents Socket Server
# Runs at 2:00 AM daily

$logFile = "logs\daily-reset.log"
Add-Content -Path $logFile -Value "$(Get-Date): Starting daily socket server reset"

# Reset metrics
try {
    Invoke-RestMethod -Uri "http://localhost:3004/reset-metrics" -Method POST
    Add-Content -Path $logFile -Value "$(Get-Date): Metrics reset completed"
} catch {
    Add-Content -Path $logFile -Value "$(Get-Date): Metrics reset failed: $($_.Exception.Message)"
}

# Restart PM2 process
pm2 restart shoreagents-socket-server
Add-Content -Path $logFile -Value "$(Get-Date): Daily reset completed"
