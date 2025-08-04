# Socket.IO Server Setup

## 🚀 Quick Start

### Option 1: Start Everything Together (Recommended)
```bash
npm run start-with-electron
```

### Option 2: Start Servers Only
```bash
npm run start-servers
```

### Option 3: Start Servers Separately

**Terminal 1 - Socket.IO Server (Port 3001):**
```bash
npm run socket
```

**Terminal 2 - Next.js App (Port 3000):**
```bash
npm run dev
```

### Option 4: Start Electron App (Alternative)
```bash
npm run dev-electron
```



## 🔧 What's Fixed

### ✅ **Socket.IO Server (Port 3001)**
- ✅ Fixed port configuration to use 3001
- ✅ Enhanced connection tracking per user
- ✅ Better timer data persistence (60 seconds)
- ✅ Improved logging for debugging
- ✅ Better reconnection handling

### ✅ **Client Connection (Port 3001)**
- ✅ Fixed client to connect to correct port
- ✅ Enhanced reconnection options
- ✅ Better error handling
- ✅ Improved logging

### ✅ **Timer Persistence**
- ✅ Timer data preserved during logout/login
- ✅ Automatic page reload after login for proper timer initialization
- ✅ Seamless user session handling

## 🎯 How It Works Now

1. **Start Everything**: Run `npm run start-with-electron`
2. **Login**: Timer connects immediately (with automatic page reload)
3. **Logout**: Timer data preserved for 60 seconds
4. **Login Again**: Timer works with automatic page reload
5. **Navigation**: Timer persists across all pages

## 🔍 Debugging

Check the console logs:
- **Socket.IO Server**: Shows connection/disconnection events
- **Client**: Shows authentication and timer updates
- **Both**: Show detailed user tracking

## 🚨 Troubleshooting

If timer still doesn't work after login:
1. Check if Socket.IO server is running on port 3001
2. Check browser console for connection errors
3. Restart everything with `npm run start-with-electron`

### 🔄 **Automatic Page Reload**
- **After Login**: Page automatically reloads after 1 second to ensure timer initialization
- **After Logout**: Page reloads to clear session data properly
- **Console Logs**: Look for "🔄 Reloading page after login" message
- **Timing**: 1-second delay ensures all authentication data is stored before reload 