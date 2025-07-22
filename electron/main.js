const { app, BrowserWindow, Menu, Tray, shell, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';
const ActivityTracker = require('./activity-tracker');

// Keep a global reference of the window object
let mainWindow;
let activityTracker;
let inactivityNotification = null;
let tray = null;
let isQuitting = false;
let notificationBadgeCount = 0;
let systemNotifications = [];

// Function to create a red badge with count
function createBadgeImage(count) {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, 32, 32);
    
    // Draw red circle background
    ctx.fillStyle = '#ef4444'; // Red color
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, 2 * Math.PI);
    ctx.fill();
    
    // Remove white border - no stroke needed
    
    // Draw count text with better font settings
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial, sans-serif'; // Increased font size and added fallback
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    const countText = count > 99 ? '99+' : count.toString();
    ctx.fillText(countText, 16, 16);
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Canvas not available, using fallback:', error);
    return null;
  }
}

// Function to save badge image to temp file
function saveBadgeImage(count) {
  try {
    const badgeBuffer = createBadgeImage(count);
    if (!badgeBuffer) {
      return null;
    }
    
    const badgePath = path.join(__dirname, `../temp/badge-${count}.png`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(badgePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(badgePath, badgeBuffer);
    return badgePath;
  } catch (error) {
    console.error('Error creating badge image:', error);
    return null;
  }
}

// Function to get a simple red dot badge (fallback)
function getSimpleBadgePath() {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(16, 16); // Smaller size for dot
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, 16, 16);
    
    // Draw red circle background (no border)
    ctx.fillStyle = '#ef4444'; // Red color
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    const badgePath = path.join(__dirname, '../temp/red-dot.png');
    
    // Ensure temp directory exists
    const tempDir = path.dirname(badgePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(badgePath, canvas.toBuffer('image/png'));
    return badgePath;
  } catch (error) {
    console.error('Error creating simple badge:', error);
    return null;
  }
}

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

// Function to update badge count on app icon and tray
async function updateBadgeCount(count) {
  // Get the actual notification count from the app
  const actualCount = await getActualNotificationCount();
  const finalCount = actualCount > 0 ? actualCount : count;
  
  notificationBadgeCount = finalCount;
  
  // Update app icon badge (Windows)
  if (mainWindow && process.platform === 'win32') {
    if (finalCount > 0) {
      try {
        // Create and use red badge with count
        const badgePath = saveBadgeImage(finalCount);
        if (badgePath) {
          mainWindow.setOverlayIcon(badgePath, `${finalCount} notifications`);
        } else {
          // Fallback to simple red dot
          const simpleBadgePath = getSimpleBadgePath();
          if (simpleBadgePath) {
            mainWindow.setOverlayIcon(simpleBadgePath, `${finalCount} notifications`);
          } else {
            // Final fallback to favicon
            const overlayIconPath = path.join(__dirname, '../src/app/favicon.ico');
            mainWindow.setOverlayIcon(overlayIconPath, `${finalCount} notifications`);
          }
        }
      } catch (error) {
        console.error('Error setting overlay icon:', error);
        // Fallback to favicon
        const overlayIconPath = path.join(__dirname, '../src/app/favicon.ico');
        mainWindow.setOverlayIcon(overlayIconPath, `${finalCount} notifications`);
      }
      
      // Also set the dock badge count (macOS) and taskbar badge (Windows)
      if (process.platform === 'darwin') {
        app.setBadgeCount(finalCount);
      }
    } else {
      mainWindow.setOverlayIcon(null, '');
      if (process.platform === 'darwin') {
        app.setBadgeCount(0);
      }
    }
  }
  
  // Update tray with actual notification count
  await updateTrayWithActualCount();
  
  // Update tray menu to show notification count
  updateTrayMenu();
}

// Function to show system-wide notification
function showSystemNotification(notificationData) {
  if (!Notification.isSupported()) {
    console.log('System notifications not supported');
    return;
  }
  
  // Use favicon for notifications
  const notificationIcon = path.join(__dirname, '../src/app/favicon.ico');
  
  const notification = new Notification({
    title: notificationData.title || 'ShoreAgents Dashboard',
    body: notificationData.message || 'You have a new notification',
    icon: notificationIcon,
    silent: false,
    timeoutType: 'default'
  });
  
  // Store notification data for click handling
  const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  systemNotifications.push({
    id: notificationId,
    data: notificationData,
    notification: notification
  });
  
  // Handle notification click
  notification.on('click', () => {
    handleNotificationClick(notificationId);
  });
  
  // Handle notification close
  notification.on('close', () => {
    // Remove from system notifications array
    systemNotifications = systemNotifications.filter(n => n.id !== notificationId);
  });
  
  notification.show();
  
  // Update badge count
  const currentCount = systemNotifications.length;
  updateBadgeCount(currentCount);
  
  return notificationId;
}

// Function to handle notification clicks
function handleNotificationClick(notificationId) {
  const notification = systemNotifications.find(n => n.id === notificationId);
  if (!notification) return;
  
  // Show main window if hidden
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    
    // Mark notification as read in the app using the original notification ID
    if (notification.data.id) {
      // Extract the original notification ID from the system notification ID
      const originalNotificationId = notification.data.id.replace('system_', '');
      mainWindow.webContents.send('mark-notification-read', originalNotificationId);
    }
    
    // Navigate based on whether there's an action URL
    if (notification.data.actionUrl) {
      // If there's an action URL, go directly to that content
      mainWindow.webContents.send('navigate-to', notification.data.actionUrl);
    } else {
      // If no action URL, go to notifications page
      setTimeout(() => {
        mainWindow.webContents.send('navigate-to', '/notifications');
        
        // Send the notification ID to highlight the specific notification
        if (notification.data.id) {
          const originalNotificationId = notification.data.id.replace('system_', '');
          mainWindow.webContents.send('highlight-notification', originalNotificationId);
        }
      }, 100);
    }
  }
  
  // Remove from system notifications
  systemNotifications = systemNotifications.filter(n => n.id !== notificationId);
  
  // Update badge count immediately
  updateBadgeCount(systemNotifications.length);
  
  // Also trigger a notification update event to refresh the app UI
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notifications-updated');
  }
}

// Function to clear all system notifications
function clearAllSystemNotifications() {
  systemNotifications.forEach(n => {
    if (n.notification) {
      n.notification.close();
    }
  });
  systemNotifications = [];
  updateBadgeCount(0);
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
      path.join(__dirname, '../src/app/favicon.ico')
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
          path.join(__dirname, '../src/app/favicon.ico')
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

// IPC handlers for system notifications
ipcMain.handle('show-system-notification', async (event, notificationData) => {
  try {
    const notificationId = showSystemNotification(notificationData);
    return { success: true, notificationId };
  } catch (error) {
    console.error('Error showing system notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-system-notifications', async (event) => {
  try {
    clearAllSystemNotifications();
    return { success: true };
  } catch (error) {
    console.error('Error clearing system notifications:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-notification-count', async (event) => {
  return { count: systemNotifications.length };
});

// Handle notification count changes from renderer
ipcMain.on('notification-count-changed', async (event, data) => {
  try {
    const count = data.count || 0;
    console.log('Notification count changed:', count);
    
    // Update the system tray badge with the new count
    await updateTrayWithActualCount();
    
    // Also update the app icon badge
    await updateBadgeCount(count);
  } catch (error) {
    console.error('Error handling notification count change:', error);
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
    icon: path.join(__dirname, '../src/app/favicon.ico'),
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

    // Update tray menu after window is ready and can access localStorage
    setTimeout(updateTrayMenu, 1000);
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

  // Handle window close - minimize to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show tray notification on first minimize
      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          iconType: 'info',
          title: 'ShoreAgents Dashboard',
          content: 'App was minimized to tray. Activity tracking continues in background.'
        });
      }
    }
  });
}

// Create system tray
function createTray() {
  // Create initial tray icon with no notifications
  const initialTrayIconPath = createTrayIconWithIndicator(0);
  const trayIconPath = initialTrayIconPath || path.join(__dirname, '../src/app/favicon.ico');
  
  tray = new Tray(trayIconPath);
  
  // Initial context menu
  updateTrayMenu();
  
  tray.setToolTip('ShoreAgents Dashboard');
  
  // Set up periodic check for notification count sync
  setInterval(async () => {
    if (tray && mainWindow && !mainWindow.isDestroyed()) {
      await updateTrayWithActualCount();
    }
  }, 10000); // Check every 10 seconds
  
  // Single click to show window (more convenient)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  // Double click also works as backup
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Function to create a tray icon with red indicator
function createTrayIconWithIndicator(count) {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    
    // Create a simple icon that looks like the favicon
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, 32, 32);
    
    // Draw a simple icon that resembles the favicon (Next.js logo style)
    ctx.fillStyle = '#000000'; // Black background
    ctx.fillRect(0, 0, 32, 32);
    
    // Draw the Next.js "N" shape in white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 8, 4, 16); // Left vertical line
    ctx.fillRect(12, 8, 4, 4); // Top horizontal line
    ctx.fillRect(16, 12, 4, 4); // Middle horizontal line
    ctx.fillRect(20, 16, 4, 4); // Bottom horizontal line
    ctx.fillRect(24, 20, 4, 4); // Right vertical line
    
    // Add red badge with count if there are notifications
    if (count > 0) {
      // Draw red circle background
      ctx.fillStyle = '#ef4444'; // Red color
      ctx.beginPath();
      ctx.arc(26, 6, 8, 0, 2 * Math.PI); // Top-right corner, larger size
      ctx.fill();
      
      // Draw count text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const countText = count > 99 ? '99+' : count.toString();
      ctx.fillText(countText, 26, 6);
    }
    
    const trayIconPath = path.join(__dirname, `../temp/tray-icon-${count}.png`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(trayIconPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(trayIconPath, canvas.toBuffer('image/png'));
    return trayIconPath;
  } catch (error) {
    console.error('Error creating tray icon with indicator:', error);
    return null;
  }
}

// Function to update tray with red indicator
function updateTrayWithRedIndicator(count) {
  if (!tray) return;
  
  try {
    // Create tray icon with red indicator
    const trayIconPath = createTrayIconWithIndicator(count);
    if (trayIconPath) {
      tray.setImage(trayIconPath);
    }
    
    // Update tooltip
    const baseTooltip = 'ShoreAgents Dashboard';
    const tooltip = count > 0 ? `${baseTooltip} (${count} notifications)` : baseTooltip;
    tray.setToolTip(tooltip);
  } catch (error) {
    console.error('Error updating tray with red indicator:', error);
  }
}

// Function to get actual notification count from app
async function getActualNotificationCount() {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      // Get the actual unread notification count from the app
      const result = await mainWindow.webContents.executeJavaScript(`
        (() => {
          try {
            // Import the notification service functions
            const { getUnreadCount } = require('./lib/notification-service');
            return getUnreadCount();
          } catch (error) {
            // Fallback to localStorage check
            try {
              const user = JSON.parse(localStorage.getItem('shoreagents-auth'))?.user;
              if (!user) return 0;
              
              const key = 'shoreagents-notifications-' + user.email;
              const stored = localStorage.getItem(key);
              if (!stored) return 0;
              
              const data = JSON.parse(stored);
              return data.notifications ? data.notifications.filter(n => !n.read).length : 0;
            } catch {
              return 0;
            }
          }
        })()
      `);
      return result || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting actual notification count:', error);
    return 0;
  }
}

// Function to update tray with actual notification count
async function updateTrayWithActualCount() {
  if (!tray) return;
  
  try {
    // Get the actual notification count from the app
    const actualCount = await getActualNotificationCount();
    
    // Create tray icon with the actual count
    const trayIconPath = createTrayIconWithIndicator(actualCount);
    if (trayIconPath) {
      tray.setImage(trayIconPath);
    }
    
    // Update tooltip with actual count
    const baseTooltip = 'ShoreAgents Dashboard';
    const tooltip = actualCount > 0 ? `${baseTooltip} (${actualCount} notifications)` : baseTooltip;
    tray.setToolTip(tooltip);
    
    // Update the global notification count
    notificationBadgeCount = actualCount;
  } catch (error) {
    console.error('Error updating tray with actual count:', error);
  }
}

// Check if user is logged in by examining localStorage
async function checkUserLoggedIn() {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      // Wait for the web contents to be ready
      if (!mainWindow.webContents.isLoading()) {
        // Get authentication state from renderer process (using actual auth storage)
        const result = await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              const authData = localStorage.getItem('shoreagents-auth');
              if (!authData) {
                return { isLoggedIn: false, userEmail: null };
              }
              
              const parsed = JSON.parse(authData);
              const isAuthenticated = parsed.isAuthenticated === true;
              const userEmail = parsed.user?.email || null;
              
              return {
                isLoggedIn: isAuthenticated && userEmail,
                userEmail: userEmail
              };
            } catch (error) {
              return { isLoggedIn: false, userEmail: null };
            }
          })()
        `);
        return result;
      }
    }
    return { isLoggedIn: false, userEmail: null };
  } catch (error) {
    console.error('Error checking login state:', error);
    return { isLoggedIn: false, userEmail: null };
  }
}

// Update tray menu based on authentication state
async function updateTrayMenu() {
  try {
    if (!tray || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    
    const authState = await checkUserLoggedIn();
    const isLoggedIn = authState.isLoggedIn;
  
  const baseMenuItems = [
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }
  ];
  
  // Add notification count if there are notifications
  if (notificationBadgeCount > 0) {
    baseMenuItems.push({
      label: `${notificationBadgeCount} notification${notificationBadgeCount > 1 ? 's' : ''}`,
      enabled: false
    });
    
    baseMenuItems.push({
      label: 'View All Notifications',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/notifications');
        }
      }
    });
    
    baseMenuItems.push({
      label: 'Clear All Notifications',
      click: () => {
        clearAllSystemNotifications();
      }
    });
    
    baseMenuItems.push({ type: 'separator' });
  }
  
  // Add navigation options only if logged in
  if (isLoggedIn) {
    baseMenuItems.push(
      {
        label: 'Dashboard',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/dashboard');
          }
        }
      },
      {
        label: 'Activity',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/dashboard/activity');
          }
        }
      },
      {
        label: 'Notifications',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/notifications');
          }
        }
      }
    );
  }
  
  // Add separator
  baseMenuItems.push({ type: 'separator' });
  
  // Add appropriate quit option based on login state
  if (isLoggedIn) {
    baseMenuItems.push({
      label: 'Logout & Quit',
      click: async () => {
        await handleLogoutAndQuit();
      }
    });
    
    // Update tooltip to show tracking is active
    const baseTooltip = 'ShoreAgents Dashboard - Activity Tracking Active';
    const tooltip = notificationBadgeCount > 0 
      ? `${baseTooltip} (${notificationBadgeCount} notifications)`
      : baseTooltip;
    tray.setToolTip(tooltip);
  } else {
    baseMenuItems.push({
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    });
    
    // Update tooltip to show no tracking
    const baseTooltip = 'ShoreAgents Dashboard';
    const tooltip = notificationBadgeCount > 0 
      ? `${baseTooltip} (${notificationBadgeCount} notifications)`
      : baseTooltip;
    tray.setToolTip(baseTooltip);
  }
  
  const contextMenu = Menu.buildFromTemplate(baseMenuItems);
  tray.setContextMenu(contextMenu);
  } catch (error) {
    console.error('Error updating tray menu:', error);
  }
}

// Handle logout and quit with confirmation dialog
async function handleLogoutAndQuit() {
  try {
    // Show confirmation dialog
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Logout & Quit', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Confirm Logout',
      message: 'Logout and quit ShoreAgents Dashboard?',
      detail: 'This will stop activity tracking and log you out. Are you sure?',
      icon: path.join(__dirname, '../src/app/favicon.ico')
    });
    
    if (result.response === 0) { // User clicked "Logout & Quit"
      // Notify renderer to logout first
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('force-logout-before-quit');
        
        // Wait a bit for logout to complete
        setTimeout(() => {
          isQuitting = true;
          app.quit();
        }, 1000);
      } else {
        isQuitting = true;
        app.quit();
      }
    }
  } catch (error) {
    console.error('Error in handleLogoutAndQuit:', error);
    // Fallback: just quit
    isQuitting = true;
    app.quit();
  }
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
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit on window-all-closed when we have system tray
  // App will continue running in background
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

// Handle app quit event
app.on('before-quit', () => {
  isQuitting = true;
  
  // Clean up tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
  
  // Mark user as logged out before app quits
  if (mainWindow && !mainWindow.isDestroyed()) {
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

// IPC handlers for logout functionality
ipcMain.handle('confirm-logout-and-quit', async () => {
  try {
    await handleLogoutAndQuit();
    return { success: true };
  } catch (error) {
    console.error('Error in confirm-logout-and-quit:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logout-completed', () => {
  // Update tray menu to show "Quit" instead of "Logout & Quit"
  updateTrayMenu();
  // Logout is done, now we can safely quit
  setTimeout(() => {
    isQuitting = true;
    app.quit();
  }, 500);
  return { success: true };
});

// Handle login state changes
ipcMain.handle('user-logged-in', async () => {
  try {
    await updateTrayMenu();
    return { success: true };
  } catch (error) {
    console.error('Error in user-logged-in handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('user-logged-out', async () => {
  try {
    await updateTrayMenu();
    return { success: true };
  } catch (error) {
    console.error('Error in user-logged-out handler:', error);
    return { success: false, error: error.message };
  }
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
      console.log('Main process: Attempting to stop activity tracking...');
      
      // Check current state before stopping
      const wasTracking = activityTracker.isTracking;
      console.log(`Main process: Current tracking state: ${wasTracking}`);
      
      // Call the stop method
      activityTracker.stopTracking();
      
      // Additional manual cleanup to ensure everything stops
      let cleanupResults = {
        activityCheckInterval: false,
        systemIdleCheckInterval: false,
        mouseTrackingInterval: false,
        trackingState: false
      };
      
      try {
        if (activityTracker.activityCheckInterval) {
          clearInterval(activityTracker.activityCheckInterval);
          activityTracker.activityCheckInterval = null;
          cleanupResults.activityCheckInterval = true;
        }
        if (activityTracker.systemIdleCheckInterval) {
          clearInterval(activityTracker.systemIdleCheckInterval);
          activityTracker.systemIdleCheckInterval = null;
          cleanupResults.systemIdleCheckInterval = true;
        }
        if (activityTracker.mouseTrackingInterval) {
          clearInterval(activityTracker.mouseTrackingInterval);
          activityTracker.mouseTrackingInterval = null;
          cleanupResults.mouseTrackingInterval = true;
        }
        
        // Force set tracking state
        activityTracker.isTracking = false;
        cleanupResults.trackingState = true;
        
        console.log('Main process: Stop completed successfully');
        console.log(`Main process: Final tracking state: ${activityTracker.isTracking}`);
        console.log('Main process: Cleanup results:', cleanupResults);
        
      } catch (cleanupError) {
        console.error('Main process: Enhanced cleanup had issues:', cleanupError);
        return { success: false, error: `Cleanup failed: ${cleanupError.message}` };
      }
      
      return { 
        success: true, 
        wasTracking, 
        finalState: activityTracker.isTracking,
        cleanupResults 
      };
    }
    console.error('Main process: Activity tracker not initialized');
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
      icon: data.icon || path.join(__dirname, '../src/app/favicon.ico'),
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