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
    this.systemIdleThreshold = 30000; // 1 minute system idle threshold
    this.systemIdleCheckInterval = null;
    
    // Bind methods
    this.handleSystemSuspend = this.handleSystemSuspend.bind(this);
    this.handleSystemResume = this.handleSystemResume.bind(this);
    this.setupPowerMonitoring();
  }

  setupPowerMonitoring() {
    try {
      // Listen for system suspend/resume events
      powerMonitor.on('suspend', this.handleSystemSuspend);
      powerMonitor.on('resume', this.handleSystemResume);
      powerMonitor.on('lock-screen', this.handleSystemSuspend);
      powerMonitor.on('unlock-screen', this.handleSystemResume);
      
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

  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.lastActivityTime = Date.now();
    this.isSystemSuspended = false;
    
    // Start checking for inactivity
    this.activityCheckInterval = setInterval(() => {
      this.checkInactivity();
    }, 1000); // Check every second (renderer expects ~30s consistency)
    
    // Start system idle checking
    this.systemIdleCheckInterval = setInterval(() => {
      this.checkSystemIdle();
    }, 1000); // Check every 5 seconds
    
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
    
    if (this.systemIdleCheckInterval) {
      clearInterval(this.systemIdleCheckInterval);
      this.systemIdleCheckInterval = null;
      cleanupCount++;
    }
    
    this.pauseMouseTracking();
  }

  startMouseTracking() {
    if (this.mouseTrackingInterval || this.isSystemSuspended) return;
    
    console.log('ActivityTracker: Starting mouse tracking');
    
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
          console.log('ActivityTracker: Mouse moved, updating activity');
          this.updateActivity();
          this.mousePosition = newPosition;
        }
      } catch (error) {
        // Silently handle errors (screen might be locked)
        if (!this.isSystemSuspended) {
          console.warn('Error getting cursor position:', error.message);
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

  checkSystemIdle() {
    if (!this.isTracking || this.isSystemSuspended) return;
    
    try {
      // Get system idle time using powerMonitor
      const systemIdleTime = powerMonitor.getSystemIdleTime() * 1000; // Convert to milliseconds
      
      // If system has been idle for longer than our threshold, don't record activity
      if (systemIdleTime > this.systemIdleThreshold) {
        // System is idle, pause mouse tracking to prevent false activity
        this.pauseMouseTracking();
      } else if (!this.mouseTrackingInterval) {
        // System is active again, resume mouse tracking
        this.startMouseTracking();
        // Update activity time since system is active
        this.lastActivityTime = Date.now();
        this.updateActivity();
      }
    } catch (error) {
      console.warn('Error checking system idle time:', error.message);
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
    
    // Debug logging every 10 seconds
    if (Math.floor(timeSinceLastActivity / 10000) * 10000 === timeSinceLastActivity) {
      console.log(`ActivityTracker: Checking inactivity - ${timeSinceLastActivity}ms since last activity (threshold: ${this.inactivityThreshold}ms)`);
    }
    
    // Prefer our own high-frequency tracker for consistent thresholding.
    // Use system idle time only as additional context, not as a hard gate.
    let systemIdleTime = null;
    try {
      systemIdleTime = powerMonitor.getSystemIdleTime() * 1000;
    } catch (_) {}

    if (timeSinceLastActivity >= this.inactivityThreshold) {
      console.log('ActivityTracker: Inactivity threshold reached, showing dialog');
      this.showInactivityWindow();
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('inactivity-alert', {
            inactiveTime: timeSinceLastActivity,
            threshold: this.inactivityThreshold,
            systemIdleTime: systemIdleTime,
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
    // Also update system idle threshold to be double the inactivity threshold
    this.systemIdleThreshold = Math.max(threshold * 2, 60000); // Minimum 1 minute
  }

  pauseTracking() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    
    if (this.systemIdleCheckInterval) {
      clearInterval(this.systemIdleCheckInterval);
      this.systemIdleCheckInterval = null;
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
    
    // Start system idle checking
    this.systemIdleCheckInterval = setInterval(() => {
      this.checkSystemIdle();
    }, 1000); // Check every 5 seconds
    
    // Start mouse tracking if system is not suspended
    if (!this.isSystemSuspended) {
      this.startMouseTracking();
    }
    
  }

  getCurrentActivity() {
    let systemIdleTime = null;
    try {
      systemIdleTime = powerMonitor.getSystemIdleTime() * 1000;
    } catch (error) {
      // System idle time not available
    }
    
    return {
      lastActivityTime: this.lastActivityTime,
      isTracking: this.isTracking,
      mousePosition: this.mousePosition,
      timeSinceLastActivity: Date.now() - this.lastActivityTime,
      isSystemSuspended: this.isSystemSuspended,
      systemIdleTime: systemIdleTime
    };
  }

  cleanup() {
    try {
      powerMonitor.off('suspend', this.handleSystemSuspend);
      powerMonitor.off('resume', this.handleSystemResume);
      powerMonitor.off('lock-screen', this.handleSystemSuspend);
      powerMonitor.off('unlock-screen', this.handleSystemResume);
    } catch (error) {
      console.error('Error cleaning up power monitoring:', error);
    }
    
    this.stopTracking();
  }
}

module.exports = ActivityTracker; 