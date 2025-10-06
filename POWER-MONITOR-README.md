# Power Monitor Support for Sleep/Resume

This document describes the power monitor functionality implemented to handle socket disconnections when the PC goes to sleep.

## Overview

When a computer goes to sleep, network connections (including WebSocket connections) are typically closed by the operating system. This causes users to appear as "disconnected" in the socket server. The power monitor implementation automatically handles reconnection when the system resumes from sleep.

## Implementation Details

### 1. Electron Main Process (`electron/main.js`)

Added power monitor event listeners in the main process:

```javascript
const { powerMonitor } = require('electron');

function setupPowerMonitor() {
  // Handle system suspend (sleep)
  powerMonitor.on('suspend', () => {
    console.log('💤 System is going to sleep - notifying renderer process');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-suspend');
    }
  });

  // Handle system resume (wake from sleep)
  powerMonitor.on('resume', () => {
    console.log('🌅 System resumed from sleep - notifying renderer process');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-resume');
    }
  });

  // Handle system lock (screen lock)
  powerMonitor.on('lock-screen', () => {
    console.log('🔒 System screen locked - notifying renderer process');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-lock');
    }
  });

  // Handle system unlock (screen unlock)
  powerMonitor.on('unlock-screen', () => {
    console.log('🔓 System screen unlocked - notifying renderer process');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-unlock');
    }
  });

  // Handle system shutdown
  powerMonitor.on('shutdown', () => {
    console.log('🔄 System is shutting down - notifying renderer process');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-shutdown');
    }
  });
}
```

### 2. Preload Script (`electron/preload.js`)

Updated the preload script to include power monitor events in the valid channels:

```javascript
const validChannels = [
  // ... existing channels ...
  'system-suspend', 
  'system-resume', 
  'system-lock', 
  'system-unlock', 
  'system-shutdown',
  // ... other channels ...
];
```

### 3. Socket Context (`src/contexts/socket-context.tsx`)

Added power monitor event handlers in the socket context to handle reconnection:

```javascript
// Handle power monitor events for sleep/resume
const handleSystemSuspend = () => {
  console.log('💤 System going to sleep - socket will be disconnected');
  // Don't disconnect immediately, let the natural disconnect happen
  // The socket will automatically reconnect when the system resumes
}

const handleSystemResume = () => {
  console.log('🌅 System resumed from sleep - checking socket connection');
  // Check if socket is still connected, if not, reconnect
  if (!socketRef.current || !socketRef.current.connected) {
    console.log('🔄 Socket disconnected during sleep, reconnecting...');
    connect();
  } else {
    console.log('✅ Socket still connected after resume');
  }
}

const handleSystemLock = () => {
  console.log('🔒 System screen locked');
  // No action needed for screen lock
}

const handleSystemUnlock = () => {
  console.log('🔓 System screen unlocked');
  // Check socket connection after unlock
  if (!socketRef.current || !socketRef.current.connected) {
    console.log('🔄 Socket disconnected during lock, reconnecting...');
    connect();
  }
}
```

## How It Works

1. **Sleep Detection**: When the system goes to sleep, the `suspend` event is triggered
2. **Natural Disconnect**: The WebSocket connection is naturally closed by the OS
3. **Resume Detection**: When the system resumes, the `resume` event is triggered
4. **Connection Check**: The socket context checks if the connection is still active
5. **Auto-Reconnect**: If disconnected, it automatically attempts to reconnect
6. **User Status**: The user appears as "online" again in the socket server

## Supported Events

- **`suspend`**: System going to sleep
- **`resume`**: System resuming from sleep
- **`lock-screen`**: System screen locked
- **`unlock-screen`**: System screen unlocked
- **`shutdown`**: System shutting down

## Testing

Use the provided test script to verify power monitor functionality:

```bash
node test-power-monitor.js
```

Then test by:
1. Putting your computer to sleep
2. Waking it up
3. Locking/unlocking the screen

## Benefits

- **Seamless Experience**: Users don't appear as "disconnected" when they wake up
- **Automatic Recovery**: No manual intervention required
- **Real-time Status**: Accurate online/offline status in the dashboard
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Notes

- The implementation uses Electron's built-in `powerMonitor` API
- Socket reconnection is handled gracefully with existing reconnection logic
- No additional dependencies required
- Compatible with existing socket server infrastructure
