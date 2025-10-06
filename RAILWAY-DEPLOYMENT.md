# Railway Deployment with PM2

This guide explains how the ShoreAgents Socket Server is deployed to Railway with PM2 for enhanced process management and reliability.

## 🚀 Railway Deployment Status

**Yes, PM2 is now included in your Railway deployment!** When you `git push` to GitHub, the new PM2 configuration will be automatically deployed.

## 📋 What's Included in Railway Deployment

### Files Updated for Railway:
- ✅ `Dockerfile.socket` - Updated to install and use PM2
- ✅ `railway.json` - Updated to use PM2 runtime
- ✅ `ecosystem.railway.config.js` - Railway-optimized PM2 configuration
- ✅ `ecosystem.config.js` - Standard PM2 configuration (for local dev)

### Railway-Specific Features:
- **PM2 Runtime**: Uses `pm2-runtime` for containerized environments
- **Memory Optimization**: 512MB limit (optimized for Railway)
- **Auto-restart**: Built-in process management
- **Health Monitoring**: Integrated with Railway's health checks
- **Logging**: Optimized for Railway's log aggregation

## 🔄 Deployment Process

### 1. Automatic Deployment
When you push to GitHub:
```bash
git add .
git commit -m "Add PM2 support for Railway deployment"
git push origin main
```

Railway will automatically:
1. Build the Docker image with PM2
2. Deploy using the Railway-optimized configuration
3. Start the socket server with PM2 process management

### 2. Manual Deployment (if needed)
```bash
# Check Railway status
railway status

# View logs
railway logs

# Restart service
railway restart
```

## ⚙️ Railway Configuration Details

### PM2 Configuration (`ecosystem.railway.config.js`):
```javascript
{
  name: 'shoreagents-socket-server',
  script: 'socket-server.js',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  max_memory_restart: '512M', // Railway-optimized
  min_uptime: '5s',
  max_restarts: 5,
  restart_delay: 2000
}
```

### Key Railway Optimizations:
- **Memory Limit**: 512MB (Railway-friendly)
- **Faster Restart**: 2s delay vs 4s locally
- **Logging**: Direct to stdout/stderr for Railway
- **Health Checks**: Integrated with Railway monitoring
- **No Cron Jobs**: Railway handles scheduling

## 🏥 Health Monitoring

### Railway Health Checks:
- **Endpoint**: `https://your-app.railway.app/health`
- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Retries**: 3 attempts

### PM2 Health Monitoring:
- **Process Management**: Auto-restart on crashes
- **Memory Monitoring**: Restart at 512MB
- **Error Handling**: Exponential backoff
- **Logging**: Real-time log streaming

## 📊 Monitoring Commands

### Railway CLI:
```bash
# Check service status
railway status

# View real-time logs
railway logs --follow

# Check service health
railway run curl https://your-app.railway.app/health

# Restart service
railway restart
```

### Direct API Calls:
```bash
# Health check
curl https://your-app.railway.app/health

# Metrics
curl https://your-app.railway.app/metrics

# Reset metrics
curl -X POST https://your-app.railway.app/reset-metrics
```

## 🔄 Daily Reset in Railway

### Automatic Daily Reset:
The socket server includes daily reset functionality that:
- Clears connection metrics
- Removes stale user data
- Performs memory cleanup
- Resets circuit breakers

### Manual Reset:
```bash
# Trigger daily reset
curl -X POST https://your-app.railway.app/daily-reset

# Reset metrics only
curl -X POST https://your-app.railway.app/reset-metrics
```

## 🚨 Troubleshooting

### Common Issues:

#### 1. Service Won't Start
```bash
# Check Railway logs
railway logs

# Check if PM2 is running
railway run pm2 status
```

#### 2. Memory Issues
```bash
# Check memory usage
railway run pm2 monit

# Restart service
railway restart
```

#### 3. Connection Issues
```bash
# Check health endpoint
curl https://your-app.railway.app/health

# Check metrics
curl https://your-app.railway.app/metrics
```

### Debug Mode:
```bash
# Access Railway shell
railway shell

# Check PM2 processes
pm2 status

# View PM2 logs
pm2 logs

# Restart PM2
pm2 restart all
```

## 📈 Performance Benefits

### With PM2 in Railway:
- ✅ **Auto-restart** on crashes
- ✅ **Memory management** (512MB limit)
- ✅ **Process monitoring** and health checks
- ✅ **Graceful shutdowns** and restarts
- ✅ **Log management** and rotation
- ✅ **Error recovery** with exponential backoff
- ✅ **Daily maintenance** and cleanup

### Without PM2 (old setup):
- ❌ Single process (no auto-restart)
- ❌ No memory management
- ❌ No process monitoring
- ❌ Manual restart required on crashes

## 🔐 Environment Variables

Railway automatically provides:
- `PORT` - Railway-assigned port
- `NODE_ENV` - Set to 'production'
- `RAILWAY_ENVIRONMENT` - Railway environment name

Your socket server will use these automatically.

## 📝 Deployment Checklist

Before pushing to GitHub:
- [ ] `Dockerfile.socket` includes PM2
- [ ] `railway.json` uses PM2 runtime
- [ ] `ecosystem.railway.config.js` is optimized
- [ ] All files are committed
- [ ] Railway service is connected to GitHub

After deployment:
- [ ] Check Railway logs for PM2 startup
- [ ] Verify health endpoint responds
- [ ] Test socket connections
- [ ] Monitor memory usage
- [ ] Set up alerts if needed

## 🎯 Next Steps

1. **Push to GitHub**: Your changes will auto-deploy
2. **Monitor Deployment**: Check Railway logs
3. **Test Health Endpoint**: Verify PM2 is running
4. **Set Up Alerts**: Configure Railway notifications
5. **Monitor Performance**: Use Railway metrics dashboard

Your socket server will now run with PM2 process management in Railway, providing better reliability, auto-restart capabilities, and daily maintenance!
