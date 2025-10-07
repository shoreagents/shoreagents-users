#!/bin/bash

# Railway Schedulers Startup Script
# This script starts all schedulers with PM2 in a Railway container

echo "🚀 Starting ShoreAgents Schedulers with PM2 on Railway..."

# Set PM2 home directory
export PM2_HOME=/app/.pm2

# Create PM2 directory if it doesn't exist
mkdir -p $PM2_HOME

# Set proper permissions
chmod 755 $PM2_HOME

# Initialize PM2 configuration
echo "📋 Initializing PM2 configuration for schedulers..."

# Create a minimal PM2 config if it doesn't exist
if [ ! -f "$PM2_HOME/module_conf.json" ]; then
    echo '{}' > $PM2_HOME/module_conf.json
fi

# Start the schedulers with PM2 runtime (no daemon mode)
echo "🚀 Starting schedulers with PM2 runtime..."
exec pm2-runtime start ecosystem.railway.schedulers.config.js --env production
