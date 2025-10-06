# ShoreAgents Socket Server - PM2 Setup Guide

This guide explains how to set up and manage the ShoreAgents Socket Server using PM2 for 24/7 operation with auto-restart capabilities and daily maintenance.

## 🚀 Quick Start

### 1. Install PM2 (if not already installed)
```bash
npm install -g pm2
```

### 2. Setup and Start the Socket Server

#### Windows:
```cmd
# Option 1: Use the automated batch script
npm run socket:setup

# Option 2: Use PowerShell script (recommended)
npm run socket:setup-ps

# Option 3: Manual setup
scripts\start-socket-server.bat
```

#### Linux/macOS:
```bash
# Option 1: Use the automated setup script
npm run socket:setup-unix

# Option 2: Manual setup
chmod +x scripts/start-socket-server.sh
./scripts/start-socket-server.sh
```

### 3. Verify the Server is Running
```bash
npm run pm2:status
```

## 📋 Available Commands

### PM2 Management Commands
```bash
# Start the socket server
npm run pm2:start

# Stop the socket server
npm run pm2:stop

# Restart the socket server
npm run pm2:restart

# Reload the socket server (zero-downtime)
npm run pm2:reload

# Check server status
npm run pm2:status

# View server logs
npm run pm2:logs

# View last 100 lines of logs
npm run pm2:logs 100

# Open PM2 monitoring dashboard
npm run pm2:monitor

# Reset connection metrics
npm run pm2:reset-metrics

# Setup daily reset cron job
npm run pm2:setup-cron

# Clean up PM2 processes and logs
npm run pm2:cleanup
```

### Direct PM2 Commands
```bash
# Check all PM2 processes
pm2 status

# View logs in real-time
pm2 logs shoreagents-socket-server

# Restart specific process
pm2 restart shoreagents-socket-server

# Stop specific process
pm2 stop shoreagents-socket-server

# Delete process from PM2
pm2 delete shoreagents-socket-server

# Save current PM2 configuration
pm2 save

# Reload PM2 configuration
pm2 reload ecosystem.config.js
```

## 🔧 Configuration

### PM2 Configuration (ecosystem.config.js)
The socket server is configured with the following features:

- **Auto-restart**: Automatically restarts on crashes
- **Memory limit**: Restarts if memory usage exceeds 800MB
- **Daily restart**: Automatic restart at 2:00 AM daily
- **Health monitoring**: Built-in health checks
- **Log rotation**: Automatic log management
- **Error handling**: Exponential backoff on failures

### Key Configuration Settings
```javascript
{
  name: 'shoreagents-socket-server',
  script: 'socket-server.js',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  max_memory_restart: '800M',
  cron_restart: '0 2 * * *', // Daily at 2 AM
  min_uptime: '10s',
  max_restarts: 10,
  restart_delay: 4000
}
```

## 🏥 Health Monitoring

### Health Check Endpoint
```bash
# Check server health
curl http://localhost:3004/health

# Expected response for healthy server
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 150,
    "total": 512,
    "external": 25
  },
  "connections": {
    "active": 5,
    "total": 100
  },
  "errors": 0,
  "circuitBreaker": {
    "isOpen": false,
    "errorCount": 0
  }
}
```

### Metrics Endpoint
```bash
# View detailed metrics
curl http://localhost:3004/metrics
```

## 🔄 Daily Maintenance

### Automatic Daily Reset
The server performs automatic daily maintenance including:

1. **Connection metrics reset** - Clears old connection data
2. **Memory cleanup** - Removes stale user data
3. **Database cleanup** - Removes old socket connections
4. **Circuit breaker reset** - Resets error counters
5. **Garbage collection** - Forces memory cleanup

### Manual Reset Commands
```bash
# Reset connection metrics only
curl -X POST http://localhost:3004/reset-metrics

# Trigger full daily reset
curl -X POST http://localhost:3004/daily-reset
```

## 📊 Monitoring and Logs

### Log Files
- **Combined logs**: `./logs/socket-server-combined.log`
- **Output logs**: `./logs/socket-server-out.log`
- **Error logs**: `./logs/socket-server-error.log`
- **Daily reset logs**: `/var/log/shoreagents-socket-reset.log`

### Log Rotation
PM2 automatically manages log rotation. Logs are rotated when they reach 10MB.

### Real-time Monitoring
```bash
# Open PM2 monitoring dashboard
npm run pm2:monitor

# Or use PM2 directly
pm2 monit
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Server Won't Start
```bash
# Check PM2 logs
pm2 logs shoreagents-socket-server

# Check if port is in use
netstat -tulpn | grep :3004

# Kill process using port 3004
sudo fuser -k 3004/tcp
```

#### 2. High Memory Usage
```bash
# Check memory usage
npm run pm2:status

# Force garbage collection
curl -X POST http://localhost:3004/daily-reset

# Restart server
npm run pm2:restart
```

#### 3. Connection Issues
```bash
# Check health status
curl http://localhost:3004/health

# Reset metrics
npm run pm2:reset-metrics

# Check logs for errors
npm run pm2:logs
```

#### 4. PM2 Process Not Found
```bash
# List all PM2 processes
pm2 list

# If process is missing, restart it
npm run pm2:start
```

### Debug Mode
```bash
# Start in debug mode
pm2 start ecosystem.config.js --env development

# View debug logs
pm2 logs shoreagents-socket-server
```

## 🔐 Security Considerations

### Firewall Configuration
```bash
# Allow port 3004 (if using firewall)
sudo ufw allow 3004

# Check if port is accessible
telnet localhost 3004
```

### Process Permissions
```bash
# Ensure PM2 has proper permissions
sudo chown -R $USER:$USER ~/.pm2
```

## 📈 Performance Optimization

### Memory Optimization
- Server automatically restarts at 800MB memory usage
- Daily reset clears stale data
- Garbage collection runs automatically

### Connection Optimization
- Ping timeout: 2 minutes
- Ping interval: 30 seconds
- Max disconnection duration: 2 minutes
- Connection pooling with limits

### Database Optimization
- Automatic cleanup of stale connections
- Connection pooling with PostgreSQL
- Query optimization for user lookups

## 🚀 Production Deployment

### 1. Setup PM2 Startup
```bash
# Generate startup script
pm2 startup

# Follow the instructions to enable PM2 on boot
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 2. Save PM2 Configuration
```bash
# Save current PM2 processes
pm2 save

# This will restore processes on system reboot
```

### 3. Monitor in Production
```bash
# Setup monitoring alerts
npm run pm2:monitor

# Check health regularly
curl http://localhost:3004/health
```

## 📞 Support

If you encounter issues:

1. Check the logs: `npm run pm2:logs`
2. Check server health: `curl http://localhost:3004/health`
3. Restart the server: `npm run pm2:restart`
4. Reset metrics: `npm run pm2:reset-metrics`
5. Check PM2 status: `npm run pm2:status`

For persistent issues, check the error logs and consider restarting the entire PM2 daemon:
```bash
pm2 kill
pm2 start ecosystem.config.js
```
