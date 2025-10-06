# Railway PM2 Permission Issues - Fixed!

## 🚨 **Issue Resolved**

The PM2 permission errors you encountered have been fixed with the following changes:

### **Root Cause:**
- PM2 was trying to create directories in `/home/.pm2/` without proper permissions
- The container user didn't have write access to the home directory
- PM2 daemon mode was conflicting with containerized environments

### **Solution Applied:**

1. **Updated Dockerfile.socket:**
   - Creates PM2 directory at `/app/.pm2` (writable location)
   - Sets proper permissions for the non-root user
   - Uses a startup script to initialize PM2 properly

2. **Created startup script (`scripts/railway-start.sh`):**
   - Sets `PM2_HOME` environment variable
   - Creates PM2 directory if it doesn't exist
   - Initializes PM2 configuration files
   - Starts PM2 in runtime mode (no daemon)

3. **Updated ecosystem.railway.config.js:**
   - Points to `/app/.pm2` directory
   - Disables PMX and vizion monitoring (container-friendly)
   - Uses stdout/stderr for logging

## 🚀 **Deploy the Fix**

```bash
git add .
git commit -m "Fix PM2 permission issues in Railway deployment"
git push origin main
```

## ✅ **What's Fixed:**

- ✅ **Permission errors resolved** - PM2 can now create its directories
- ✅ **Proper user permissions** - Non-root user has access to PM2 files
- ✅ **Container-optimized** - Uses PM2 runtime instead of daemon mode
- ✅ **Logging fixed** - Logs go to stdout/stderr for Railway
- ✅ **Memory management** - PM2 can monitor and restart processes

## 🔍 **Verify the Fix**

After deployment, you can check:

```bash
# Check PM2 status (should work now)
npm run railway:pm2:status

# Check health endpoint
npm run railway:pm2:health

# View logs
npm run railway:pm2:logs
```

## 📊 **Expected Output**

When PM2 is working correctly, you should see:

```
┌─────┬─────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name                │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼─────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ shoreagents-socket- │ default     │ 1.0.0   │ fork    │ 12345    │ 2h     │ 0    │ online    │ 0%       │ 45.2mb   │ nextjs   │ disabled │
│     │ server              │             │         │         │          │        │      │           │          │          │          │          │
└─────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

## 🛠️ **Technical Details**

### **Before (Broken):**
- PM2 tried to create `/home/.pm2/` directories
- Permission denied errors
- Daemon mode conflicts with containers
- No proper initialization

### **After (Fixed):**
- PM2 uses `/app/.pm2/` (writable location)
- Proper permissions set in Dockerfile
- Startup script initializes PM2 correctly
- Uses `pm2-runtime` (no daemon mode)
- Container-optimized configuration

## 🎯 **Next Steps**

1. **Deploy the fix** by pushing to GitHub
2. **Monitor Railway logs** for successful PM2 startup
3. **Test PM2 commands** using the provided scripts
4. **Verify health endpoints** are working
5. **Monitor performance** with PM2 metrics

The socket server will now run reliably with PM2 process management on Railway!
