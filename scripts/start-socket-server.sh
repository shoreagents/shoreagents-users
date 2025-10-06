#!/bin/bash

# ShoreAgents Socket Server Startup Script
# This script sets up and starts the socket server with PM2

set -e

echo "🚀 Starting ShoreAgents Socket Server Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Installing PM2..."
    npm install -g pm2
    if [ $? -eq 0 ]; then
        print_success "PM2 installed successfully"
    else
        print_error "Failed to install PM2"
        exit 1
    fi
else
    print_success "PM2 is already installed"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    print_success "Created logs directory"
fi

# Check if ecosystem.config.js exists
if [ ! -f "ecosystem.config.js" ]; then
    print_error "ecosystem.config.js not found. Please ensure it exists in the project root."
    exit 1
fi

# Stop any existing PM2 processes for this app
print_status "Stopping any existing socket server processes..."
pm2 stop shoreagents-socket-server 2>/dev/null || true
pm2 delete shoreagents-socket-server 2>/dev/null || true

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
fi

# Start the socket server with PM2
print_status "Starting socket server with PM2..."
pm2 start ecosystem.config.js --env production

if [ $? -eq 0 ]; then
    print_success "Socket server started successfully!"
    
    # Show status
    print_status "Current PM2 status:"
    pm2 status
    
    # Setup cron job for daily reset
    print_status "Setting up daily reset cron job..."
    CRON_SCRIPT="/tmp/shoreagents-daily-reset.sh"
    
    cat > "$CRON_SCRIPT" << 'EOF'
#!/bin/bash
# Daily reset for ShoreAgents Socket Server
# Runs at 2:00 AM daily

echo "$(date): Starting daily socket server reset" >> /var/log/shoreagents-socket-reset.log

# Reset metrics
curl -X POST http://localhost:3004/reset-metrics >> /var/log/shoreagents-socket-reset.log 2>&1

# Restart PM2 process
pm2 restart shoreagents-socket-server >> /var/log/shoreagents-socket-reset.log 2>&1

echo "$(date): Daily reset completed" >> /var/log/shoreagents-socket-reset.log
EOF

    chmod +x "$CRON_SCRIPT"
    
    # Add to crontab if not already present
    if ! crontab -l 2>/dev/null | grep -q "shoreagents-daily-reset"; then
        (crontab -l 2>/dev/null; echo "0 2 * * * $CRON_SCRIPT") | crontab -
        print_success "Daily reset cron job added (runs at 2:00 AM)"
    else
        print_warning "Daily reset cron job already exists"
    fi
    
    # Save PM2 configuration
    pm2 save
    print_success "PM2 configuration saved"
    
    # Setup PM2 startup script
    pm2 startup
    print_warning "Please run the command shown above to enable PM2 startup on boot"
    
    print_success "Setup completed! Socket server is running."
    print_status "Useful commands:"
    echo "  pm2 status                    - Check server status"
    echo "  pm2 logs shoreagents-socket-server - View logs"
    echo "  pm2 restart shoreagents-socket-server - Restart server"
    echo "  pm2 stop shoreagents-socket-server - Stop server"
    echo "  pm2 monit                     - Open monitoring dashboard"
    echo "  curl http://localhost:3004/health - Check health status"
    echo "  curl http://localhost:3004/metrics - View metrics"
    
else
    print_error "Failed to start socket server"
    exit 1
fi
