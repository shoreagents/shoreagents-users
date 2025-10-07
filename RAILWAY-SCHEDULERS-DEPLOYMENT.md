# Railway Schedulers Deployment Guide

This guide explains how to deploy the ShoreAgents schedulers to Railway as a separate service.

## 🚀 Quick Deployment

### Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Create a new Railway project for schedulers**:
   ```bash
   railway new
   # Name it: shoreagents-schedulers
   ```

4. **Deploy the schedulers**:
   ```bash
   railway up
   ```

### Option 2: Using Railway Dashboard

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Create New Project**: Click "New Project"
3. **Connect GitHub Repository**: Select your repository
4. **Configure Service**:
   - **Root Directory**: Leave empty (uses project root)
   - **Build Command**: `npm install`
   - **Start Command**: `bash scripts/railway-schedulers-start.sh`
   - **Dockerfile**: `Dockerfile.schedulers`

## 📋 Configuration Files

The following files are needed for Railway deployment:

- `ecosystem.railway.schedulers.config.js` - PM2 configuration for Railway
- `scripts/railway-schedulers-start.sh` - Startup script
- `schedulers-package.json` - Dependencies for schedulers
- `railway.schedulers.json` - Railway configuration
- `Dockerfile.schedulers` - Docker configuration

## 🔧 Environment Variables

Make sure these environment variables are set in Railway:

- `DATABASE_URL` - Your PostgreSQL connection string
- `REDIS_URL` - Your Redis connection string (optional)
- `NODE_ENV=production`

## 📊 Monitoring

### Check Scheduler Status
```bash
# View logs
railway logs

# Connect to the service
railway shell

# Check PM2 status (inside the container)
pm2 status
pm2 logs
```

### Railway Dashboard
- Go to your project dashboard
- Click on the schedulers service
- View logs, metrics, and status

## 🔄 Deployment Process

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add Railway schedulers deployment"
   git push origin main
   ```

2. **Railway Auto-Deploy**:
   - Railway will automatically detect changes
   - Build and deploy the schedulers service
   - Start all 5 schedulers with PM2

## 📈 Scheduler Services

The following schedulers will run on Railway:

1. **break-reminder-scheduler** - Sends break notifications every 30 seconds
2. **task-notification-scheduler** - Handles task notifications every 5 minutes
3. **meeting-scheduler** - Manages meeting notifications
4. **event-reminder-scheduler** - Handles event reminders
5. **announcement-scheduler** - Manages announcements

## 🛠️ Troubleshooting

### Common Issues

1. **Schedulers not starting**:
   - Check Railway logs: `railway logs`
   - Verify environment variables are set
   - Check PM2 status: `railway shell` then `pm2 status`

2. **Database connection issues**:
   - Verify `DATABASE_URL` is correct
   - Check if database is accessible from Railway

3. **Memory issues**:
   - Schedulers are configured with 256MB memory limit
   - Railway will restart if memory limit is exceeded

### Debug Commands

```bash
# Connect to Railway service
railway shell

# Check PM2 status
pm2 status

# View specific scheduler logs
pm2 logs break-reminder-scheduler

# Restart all schedulers
pm2 restart all

# Check system resources
pm2 monit
```

## 💰 Cost Considerations

- **Railway Free Tier**: 500 hours/month
- **Schedulers Service**: Runs 24/7 (730 hours/month)
- **Recommendation**: Consider Railway Pro plan for production

## 🔄 Updates and Maintenance

### Updating Schedulers
1. Make changes to scheduler files
2. Push to GitHub
3. Railway auto-deploys the changes
4. PM2 automatically restarts schedulers

### Stopping Local Schedulers
Once Railway schedulers are running, stop local PM2 processes:
```bash
pm2 stop all
pm2 delete all
```

## ✅ Verification

After deployment, verify everything is working:

1. **Check Railway Dashboard**: Service should be running
2. **View Logs**: Should see scheduler startup messages
3. **Test Notifications**: Break reminders should work
4. **Monitor PM2**: All 5 schedulers should be online

## 🎯 Next Steps

1. Deploy to Railway using the steps above
2. Test the schedulers are working
3. Stop local PM2 schedulers
4. Monitor Railway logs for any issues
5. Set up monitoring alerts if needed

Your schedulers will now run 24/7 on Railway! 🚀
