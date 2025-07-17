const { app, BrowserWindow, Menu, shell, ipcMain, Notification } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const ActivityTracker = require('./activity-tracker');

// Keep a global reference of the window object
let mainWindow;
let activityTracker;
let inactivityNotification = null;

// Function to play notification sound
function playNotificationSound() {
  try {
    // Use Windows default notification sound via PowerShell
    const { exec } = require('child_process');
    exec('powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(\' \', \' \', 0, 64) | Out-Null"', (error) => {
      if (error) {
        // Fallback to simple beep
        exec('powershell -command "[console]::beep(800,200)"', (error2) => {
          if (error2) {
            console.log('Could not play notification sound');
          }
        });
      }
    });
  } catch (error) {
    console.log('Could not play custom notification sound');
  }
}

// Function to ensure notification sound plays consistently
function createNotificationWithSound(title, body, icon) {
  return new Promise((resolve) => {
    const notification = new Notification({
      title: title,
      body: body,
      icon: icon,
      silent: false, // Use native Windows notification sound
      timeoutType: 'never'
    });

    // Show notification
    notification.show();
    
    // Ensure sound plays by showing again after a small delay
    setTimeout(() => {
      notification.show();
      resolve(notification);
    }, 50);
  });
}

// IPC handlers for inactivity notifications
ipcMain.handle('show-inactivity-notification', async (event, data) => {
  try {
    // Close existing notification if any
    if (inactivityNotification) {
      inactivityNotification.close();
      inactivityNotification = null;
    }

    // Start counting from 0 seconds when dialog appears
    const timeText = "0s";

    // Create new notification with reliable sound
    inactivityNotification = await createNotificationWithSound(
      'Inactivity Detected',
      `You've been inactive for ${timeText}. Move your mouse to resume.`,
      path.join(__dirname, '../public/next.svg')
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error showing inactivity notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-inactivity-notification', async (event, data) => {
  try {
    if (inactivityNotification) {
      // Close the current notification
      inactivityNotification.close();
      inactivityNotification = null;
      
      // Small delay to ensure proper cleanup
      setTimeout(async () => {
        // Format time properly - start from 0 seconds and count up
        const seconds = Math.floor(data.inactiveTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const timeText = minutes > 0 
          ? `${minutes}m ${remainingSeconds}s` 
          : `${seconds}s`;

        // Create a new notification with reliable sound
        inactivityNotification = await createNotificationWithSound(
          'Inactivity Detected',
          `You've been inactive for ${timeText}. Move your mouse to resume.`,
          path.join(__dirname, '../public/next.svg')
        );
      }, 100); // Increased delay for better cleanup
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating inactivity notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-inactivity-notification', (event) => {
  try {
    if (inactivityNotification) {
      inactivityNotification.close();
      inactivityNotification = null;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error closing inactivity notification:', error);
    return { success: false, error: error.message };
  }
});

function createWindow() {
  // Create the browser window
  const preloadPath = path.resolve(__dirname, 'preload.js');
  console.log('Preload script path:', preloadPath);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath,
      webSecurity: true
    },
    icon: path.join(__dirname, '../public/next.svg'),
    show: false, // Don't show until ready
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Load the app - always use the Next.js server
  const serverUrl = 'http://localhost:3000';
  mainWindow.loadURL(serverUrl);
  
  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize activity tracker after window is ready
    try {
      activityTracker = new ActivityTracker(mainWindow);
      console.log('Activity tracker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize activity tracker:', error);
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    if (activityTracker) {
      activityTracker.cleanup();
      activityTracker = null;
    }
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Create menu template
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Ticket',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('new-ticket');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ShoreAgents Dashboard',
          click: () => {
            // Show about dialog
            require('electron').dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ShoreAgents Dashboard',
              message: 'ShoreAgents Dashboard',
              detail: 'Version 0.1.0\nA desktop application for managing support tickets.'
            });
          }
        }
      ]
    }
  ];

  // Add macOS specific menu items
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Mark user as logged out when all windows are closed
  if (mainWindow) {
    mainWindow.webContents.send('app-closing');
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit event
app.on('before-quit', () => {
  // Mark user as logged out before app quits
  if (mainWindow) {
    mainWindow.webContents.send('app-closing');
  }
});

// Handle app quit event
app.on('quit', () => {
  // Mark user as logged out when app quits
  if (mainWindow) {
    mainWindow.webContents.send('app-closing');
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// IPC handlers for activity tracking
ipcMain.handle('start-activity-tracking', () => {
  try {
    if (activityTracker) {
      activityTracker.startTracking();
      return { success: true };
    }
    return { success: false, error: 'Activity tracker not initialized' };
  } catch (error) {
    console.error('Error in start-activity-tracking:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-activity-tracking', () => {
  try {
    if (activityTracker) {
      activityTracker.stopTracking();
      return { success: true };
    }
    return { success: false, error: 'Activity tracker not initialized' };
  } catch (error) {
    console.error('Error in stop-activity-tracking:', error);
    return { success: false, error: error.message };
  }
});

// Reset activity functionality removed to prevent cheating
// Activity will naturally reset when user becomes active

ipcMain.handle('set-inactivity-threshold', (event, threshold) => {
  try {
    if (activityTracker) {
      activityTracker.setInactivityThreshold(threshold);
      return { success: true };
    }
    return { success: false, error: 'Activity tracker not initialized' };
  } catch (error) {
    console.error('Error in set-inactivity-threshold:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-activity-status', () => {
  try {
    if (activityTracker) {
      return activityTracker.getCurrentActivity();
    }
    return { error: 'Activity tracker not initialized' };
  } catch (error) {
    console.error('Error in get-activity-status:', error);
    return { error: error.message };
  }
});

ipcMain.handle('pause-activity-tracking', () => {
  try {
    if (activityTracker) {
      activityTracker.pauseTracking();
      return { success: true };
    }
    return { success: false, error: 'Activity tracker not initialized' };
  } catch (error) {
    console.error('Error in pause-activity-tracking:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resume-activity-tracking', () => {
  try {
    if (activityTracker) {
      activityTracker.resumeTracking();
      return { success: true };
    }
    return { success: false, error: 'Activity tracker not initialized' };
  } catch (error) {
    console.error('Error in resume-activity-tracking:', error);
    return { success: false, error: error.message };
  }
});

// Handle system notifications
ipcMain.on('show-notification', (event, data) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: data.title || 'ShoreAgents Dashboard',
      body: data.body || 'Notification',
      icon: data.icon || path.join(__dirname, '../public/next.svg'),
      silent: false
    });
    
    notification.show();
  }
});

// App event handlers for proper cleanup
app.on('before-quit', () => {
  console.log('App before-quit event - cleaning up activity tracker');
  if (activityTracker) {
    activityTracker.cleanup();
    activityTracker = null;
  }
  
  // Notify renderer about app closing
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-closing');
  }
});

app.on('window-all-closed', () => {
  console.log('All windows closed - cleaning up activity tracker');
  if (activityTracker) {
    activityTracker.cleanup();
    activityTracker = null;
  }
  
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle system suspend/resume events
app.on('before-suspend', () => {
  console.log('System going to sleep - activity tracker will pause automatically');
});

app.on('suspend', () => {
  console.log('System suspended - activity tracker paused');
});

app.on('resume', () => {
  console.log('System resumed - activity tracker will resume automatically');
}); 