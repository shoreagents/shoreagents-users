#!/bin/bash

# Railway PM2 Startup Script
# This script properly initializes PM2 in a container environment

echo "🚀 Starting ShoreAgents Socket Server with PM2..."

# Set PM2 home directory
export PM2_HOME=/app/.pm2

# Create PM2 directory if it doesn't exist
mkdir -p $PM2_HOME

# Set proper permissions
chmod 755 $PM2_HOME

# Initialize PM2 configuration
echo "📋 Initializing PM2 configuration..."

# Create a minimal PM2 config if it doesn't exist
if [ ! -f "$PM2_HOME/module_conf.json" ]; then
    echo '{}' > $PM2_HOME/module_conf.json
fi

# Start the application with PM2 runtime (no daemon mode)
echo "🚀 Starting socket server with PM2 runtime..."
exec pm2-runtime start ecosystem.railway.config.js --env production
