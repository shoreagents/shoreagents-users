const { screen, powerMonitor } = require('electron');

class ActivityTracker {
  constructor(mainWindow) {
    if (!mainWindow) {
      throw new Error('MainWindow is required for ActivityTracker');
    }
    this.mainWindow = mainWindow;
    this.lastActivityTime = Date.now();
    this.inactivityThreshold = 30000; // 30 seconds threshold
    this.isTracking = false;
    this.activityCheckInterval = null;
    this.mousePosition = { x: 0, y: 0 };
    this.mouseTrackingInterval = null;
    this.isSystemSuspended = false;
    
    // Bind methods
    this.handleSystemSuspend = this.handleSystemSuspend.bind(this);
    this.handleSystemResume = this.handleSystemResume.bind(this);
    this.handleSystemLock = this.handleSystemLock.bind(this);
    this.handleSystemUnlock = this.handleSystemUnlock.bind(this);
    this.setupPowerMonitoring();
  }

  setupPowerMonitoring() {
    try {
      // Listen for system suspend/resume events
      powerMonitor.on('suspend', this.handleSystemSuspend);
      powerMonitor.on('resume', this.handleSystemResume);
      powerMonitor.on('lock-screen', this.handleSystemLock);
      powerMonitor.on('unlock-screen', this.handleSystemUnlock);
      
    } catch (error) {
      console.error('Error setting up power monitoring:', error);
    }
  }

  handleSystemSuspend() {
    this.isSystemSuspended = true;
    this.pauseMouseTracking();
    
    // Notify renderer about system suspend
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('system-suspend');
      }
    } catch (error) {
      console.error('Error sending system suspend notification:', error);
    }
  }

  handleSystemResume() {
    this.isSystemSuspended = false;
    if (this.isTracking) {
      this.startMouseTracking();
      // Reset activity time on resume to avoid false inactivity
      this.lastActivityTime = Date.now();
      this.updateActivity();
    }
    
    // Notify renderer about system resume
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('system-resume');
      }
    } catch (error) {
      console.error('Error sending system resume notification:', error);
    }
  }

  handleSystemLock() {
    this.isSystemSuspended = true;
    this.pauseMouseTracking();
    
    // Notify renderer about system lock
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('system-lock');
      }
    } catch (error) {
      console.error('Error sending system lock notification:', error);
    }
  }

  handleSystemUnlock() {
    this.isSystemSuspended = false;
    if (this.isTracking) {
      this.startMouseTracking();
      // Reset activity time on unlock to avoid false inactivity
      this.lastActivityTime = Date.now();
      this.updateActivity();
    }
    
    // Notify renderer about system unlock
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('system-unlock');
      }
    } catch (error) {
      console.error('Error sending system unlock notification:', error);
    }
  }

  startTracking() {
    if (this.isTracking) {
      return;
    }
    
    this.isTracking = true;
    this.lastActivityTime = Date.now();
    this.isSystemSuspended = false;
    
    // Start checking for inactivity
    this.activityCheckInterval = setInterval(() => {
      this.checkInactivity();
    }, 1000); // Check every second (renderer expects ~30s consistency)
    
    // Start mouse tracking
    this.startMouseTracking();
  }

  stopTracking() {
    if (!this.isTracking) {
      return;
    }
    
    this.isTracking = false;
    
    let cleanupCount = 0;
    
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
      cleanupCount++;
    }
    
    
    this.pauseMouseTracking();
    
  }

  startMouseTracking() {
    if (this.mouseTrackingInterval || this.isSystemSuspended) {
      return;
    }
    
    // Track mouse movement every 200ms (more frequent for faster response)
    this.mouseTrackingInterval = setInterval(() => {
      if (!this.isTracking || this.isSystemSuspended) return;
      
      try {
        const point = screen.getCursorScreenPoint();
        const newPosition = { x: point.x, y: point.y };
        
        // Check if mouse has moved (reduced threshold to 2 pixels for faster response)
        const distance = Math.sqrt(
          Math.pow(newPosition.x - this.mousePosition.x, 2) + 
          Math.pow(newPosition.y - this.mousePosition.y, 2)
        );
        
        if (distance >= 2) {
          this.updateActivity();
          this.mousePosition = newPosition;
        }
      } catch (error) {
        // Silently handle errors (screen might be locked)
        if (!this.isSystemSuspended) {
          console.warn('💥 [ELECTRON-MOUSE-DEBUG] Error getting cursor position:', error.message);
        }
      }
    }, 200); // Check every 200ms (faster response)
    
  }

  pauseMouseTracking() {
    if (this.mouseTrackingInterval) {
      clearInterval(this.mouseTrackingInterval);
      this.mouseTrackingInterval = null;
    } 
  }


  updateActivity() {
    if (this.isSystemSuspended) return;
    
    const currentTime = Date.now();
    this.lastActivityTime = currentTime;
    
    // Send activity update to renderer
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('activity-update', {
          timestamp: this.lastActivityTime,
          position: this.mousePosition,
          systemSuspended: this.isSystemSuspended
        });
      }
    } catch (error) {
      console.error('Error sending activity update:', error);
    }
  }

  checkInactivity() {
    if (!this.isTracking || this.isSystemSuspended) return;
    
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - this.lastActivityTime;
    
    if (timeSinceLastActivity >= this.inactivityThreshold) {
      this.showInactivityWindow();
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('inactivity-alert', {
            inactiveTime: timeSinceLastActivity,
            threshold: this.inactivityThreshold,
          });
        }
      } catch (error) {
        console.error('Error sending inactivity alert:', error);
      }
    }
  }

  resetActivity() {
    if (this.isSystemSuspended) return;
    
    this.lastActivityTime = Date.now();
    
    // Restart mouse tracking if it was paused
    if (!this.mouseTrackingInterval && this.isTracking) {
      this.startMouseTracking();
    }
    
    // Send reset confirmation to renderer
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('activity-reset', {
          timestamp: this.lastActivityTime
        });
      }
    } catch (error) {
      console.error('Error sending activity reset:', error);
    }
  }

  showInactivityWindow() {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Show the window if it's hidden
        if (!this.mainWindow.isVisible()) {
          this.mainWindow.show();
        }
        
        // Restore the window if it's minimized
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        
        // Bring the window to the front and focus it
        this.mainWindow.focus();
        this.mainWindow.setAlwaysOnTop(true);
        
        // Remove always on top after a short delay to avoid being too intrusive
        setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.setAlwaysOnTop(false);
          }
        }, 3000); // Remove always on top after 3 seconds
        
      }
    } catch (error) {
      console.error('Error showing inactivity window:', error);
    }
  }

  setInactivityThreshold(threshold) {
    this.inactivityThreshold = threshold;
  }

  pauseTracking() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    
    
    this.pauseMouseTracking();
    
  }

  resumeTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.lastActivityTime = Date.now();
    
    // Start checking for inactivity
    this.activityCheckInterval = setInterval(() => {
      this.checkInactivity();
    }, 1000); // Check every second
    
    // Start mouse tracking if system is not suspended
    if (!this.isSystemSuspended) {
      this.startMouseTracking();
    }
    
  }

  getCurrentActivity() {
    return {
      lastActivityTime: this.lastActivityTime,
      isTracking: this.isTracking,
      mousePosition: this.mousePosition,
      timeSinceLastActivity: Date.now() - this.lastActivityTime,
      isSystemSuspended: this.isSystemSuspended
    };
  }

  cleanup() {
    try {
      powerMonitor.off('suspend', this.handleSystemSuspend);
      powerMonitor.off('resume', this.handleSystemResume);
      powerMonitor.off('lock-screen', this.handleSystemLock);
      powerMonitor.off('unlock-screen', this.handleSystemUnlock);
    } catch (error) {
      console.error('Error cleaning up power monitoring:', error);
    }
    
    this.stopTracking();
  }
}

module.exports = ActivityTracker; 
