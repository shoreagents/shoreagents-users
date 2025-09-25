# Vercel Webhook Configuration for Real-time Updates

## 🚀 Setting up Automatic Update Notifications

### 1. **Vercel Environment Variables**
Add these to your Vercel project settings:

```bash
BUILD_TIME=# This will be set automatically by Vercel
SOCKET_SERVER_URL=your-socket-server-url
```

### 2. **Vercel Webhook Configuration**
In your Vercel project settings, add a webhook that calls your update endpoint:

**Webhook URL:** `https://your-app.vercel.app/api/trigger-update`
**Events:** `deployment.succeeded`
**Method:** `POST`

### 3. **Build Script Enhancement**
Add this to your `package.json` scripts:

```json
{
  "scripts": {
    "build": "BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) next build",
    "postbuild": "curl -X POST https://your-app.vercel.app/api/trigger-update"
  }
}
```

### 4. **Alternative: GitHub Actions**
Create `.github/workflows/notify-update.yml`:

```yaml
name: Notify Update
on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Update
        run: |
          curl -X POST https://your-app.vercel.app/api/trigger-update
```

## 🔄 How It Works

1. **You push to GitHub**
2. **Vercel builds and deploys**
3. **Webhook calls `/api/trigger-update`**
4. **Socket server broadcasts update to all connected users**
5. **Users see update notification immediately**
6. **Desktop app users click "Restart Now" to get latest version**

## 📱 User Experience

### **Web Users (Browser)**
- ✅ Automatic updates via Vercel
- ✅ Real-time notification when update is available
- ✅ No action required

### **Desktop App Users (.exe)**
- ✅ Real-time notification when update is available
- ✅ Click "Restart Now" to download and install latest version
- ✅ Seamless update experience

## 🛠️ Testing

1. **Test the webhook locally:**
   ```bash
   curl -X POST http://localhost:3000/api/trigger-update
   ```

2. **Test with socket server:**
   - Start socket server
   - Open dashboard
   - Click "Trigger Test Update"
   - See immediate notification

## 📋 Production Checklist

- [ ] Set up Vercel webhook
- [ ] Configure BUILD_TIME environment variable
- [ ] Test webhook with actual deployment
- [ ] Verify socket server is running
- [ ] Test with multiple users
- [ ] Monitor update notifications
