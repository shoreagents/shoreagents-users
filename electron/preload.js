const { contextBridge, ipcRenderer } = require('electron');

try {
  // Expose protected methods that allow the renderer process to use
  // the ipcRenderer without exposing the entire object
  contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  send: (channel, data) => {
    // Whitelist channels
    const validChannels = ['new-ticket', 'save-ticket', 'load-tickets', 'show-notification', 'notification-count-changed', 'enter-fullscreen', 'exit-fullscreen', 'create-black-screens', 'close-black-screens', 'get-monitor-info'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // Receive messages from main process
  receive: (channel, func) => {
    const validChannels = ['new-ticket', 'ticket-saved', 'tickets-loaded', 'activity-update', 'inactivity-alert', 'activity-reset', 'app-closing', 'system-suspend', 'system-resume', 'system-lock', 'system-unlock', 'system-shutdown', 'force-logout-before-quit', 'force-logout', 'navigate-to', 'mark-notification-read', 'notifications-updated', 'highlight-notification', 'break-focus-lost', 'break-minimized', 'break-hidden', 'emergency-escape-pressed'];
    if (validChannels.includes(channel)) {
      try {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => {
          try {
            func(...args);
          } catch (error) {
            console.error(`Error in ${channel} handler:`, error);
          }
        });
      } catch (error) {
        console.error(`Error setting up ${channel} listener:`, error);
      }
    }
  },
  
  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    const validChannels = ['new-ticket', 'ticket-saved', 'tickets-loaded', 'activity-update', 'inactivity-alert', 'activity-reset', 'app-closing', 'system-suspend', 'system-resume', 'system-lock', 'system-unlock', 'system-shutdown', 'force-logout-before-quit', 'force-logout', 'navigate-to', 'mark-notification-read', 'notifications-updated', 'highlight-notification', 'break-focus-lost', 'break-minimized', 'break-hidden', 'emergency-escape-pressed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Activity tracking methods
  activityTracking: {
    start: () => ipcRenderer.invoke('start-activity-tracking'),
    stop: () => ipcRenderer.invoke('stop-activity-tracking'),
    pause: () => ipcRenderer.invoke('pause-activity-tracking'),
    resume: () => ipcRenderer.invoke('resume-activity-tracking'),
    reset: () => ipcRenderer.invoke('reset-activity'),
    setThreshold: (threshold) => ipcRenderer.invoke('set-inactivity-threshold', threshold),
    getStatus: () => ipcRenderer.invoke('get-activity-status')
  },


  // Inactivity notification methods
  inactivityNotifications: {
    show: (data) => ipcRenderer.invoke('show-inactivity-notification', data),
    update: (data) => ipcRenderer.invoke('update-inactivity-notification', data),
    close: () => ipcRenderer.invoke('close-inactivity-notification')
  },

  // System notification methods
  systemNotifications: {
    show: (notificationData) => ipcRenderer.invoke('show-system-notification', notificationData),
    clear: () => ipcRenderer.invoke('clear-system-notifications'),
    getCount: () => ipcRenderer.invoke('get-notification-count')
  },

  // Listen for clear all notifications from system tray
  onClearAllNotifications: (callback) => {
    ipcRenderer.on('clear-all-notifications', callback);
  },


  // Logout and quit methods
  app: {
    confirmLogoutAndQuit: () => ipcRenderer.invoke('confirm-logout-and-quit'),
    logoutCompleted: () => ipcRenderer.invoke('logout-completed'),
    userLoggedIn: () => ipcRenderer.invoke('user-logged-in'),
    userLoggedOut: () => ipcRenderer.invoke('user-logged-out'),
    quit: () => ipcRenderer.invoke('app-quit')
  },

  // Secure credential storage methods
  secureCredentials: {
    store: (email, password) => ipcRenderer.invoke('store-credentials', { email, password }),
    get: () => ipcRenderer.invoke('get-credentials'),
    clear: () => ipcRenderer.invoke('clear-credentials')
  },
  
  // Fullscreen methods
  fullscreen: {
    enter: () => ipcRenderer.invoke('enter-fullscreen'),
    exit: () => ipcRenderer.invoke('exit-fullscreen')
  },
  
  // Multi-monitor management methods
  multiMonitor: {
    createBlackScreens: () => ipcRenderer.invoke('create-black-screens'),
    closeBlackScreens: () => ipcRenderer.invoke('close-black-screens'),
    getMonitorInfo: () => ipcRenderer.invoke('get-monitor-info'),
  },
  
  // Break monitoring methods
  breakMonitoring: {
    setActive: (active) => ipcRenderer.invoke('set-break-active', active),
    getActive: () => ipcRenderer.invoke('get-break-active'),
    confirmEndDueToFocusLoss: () => ipcRenderer.invoke('confirm-break-end-due-to-focus-loss'),
    returnToBreak: () => ipcRenderer.invoke('return-to-break'),
    emergencyEscape: () => ipcRenderer.invoke('emergency-escape'),
    cleanupKeyboardShortcuts: () => ipcRenderer.invoke('cleanup-keyboard-shortcuts')
  },
  
  // Kiosk mode methods
  kioskMode: {
    enable: () => ipcRenderer.invoke('set-kiosk-mode', true),
    disable: () => ipcRenderer.invoke('set-kiosk-mode', false),
    setActive: (enabled) => ipcRenderer.invoke('set-kiosk-mode', enabled)
  },
  
  
  // Window control methods
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  startDrag: () => ipcRenderer.invoke('window-start-drag'),
  
  // Get app version
  getVersion: () => process.versions.electron,
  
  // Platform info
  platform: process.platform,
  
  });
  
} catch (error) {
  console.error('Error in preload script:', error);
}

// Handle window controls
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
  
}); 