const { contextBridge, ipcRenderer } = require('electron');

try {
  // Expose protected methods that allow the renderer process to use
  // the ipcRenderer without exposing the entire object
  contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  send: (channel, data) => {
    // Whitelist channels
    const validChannels = ['new-ticket', 'save-ticket', 'load-tickets', 'show-notification', 'notification-count-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // Receive messages from main process
  receive: (channel, func) => {
    const validChannels = ['new-ticket', 'ticket-saved', 'tickets-loaded', 'activity-update', 'inactivity-alert', 'activity-reset', 'app-closing', 'system-suspend', 'system-resume', 'force-logout-before-quit', 'navigate-to', 'mark-notification-read', 'notifications-updated', 'highlight-notification'];
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
    const validChannels = ['new-ticket', 'ticket-saved', 'tickets-loaded', 'activity-update', 'inactivity-alert', 'activity-reset', 'app-closing', 'force-logout-before-quit', 'navigate-to', 'mark-notification-read', 'notifications-updated', 'highlight-notification'];
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

  // Logout and quit methods
  app: {
    confirmLogoutAndQuit: () => ipcRenderer.invoke('confirm-logout-and-quit'),
    logoutCompleted: () => ipcRenderer.invoke('logout-completed'),
    userLoggedIn: () => ipcRenderer.invoke('user-logged-in'),
    userLoggedOut: () => ipcRenderer.invoke('user-logged-out')
  },
  
  // Get app version
  getVersion: () => process.versions.electron,
  
  // Platform info
  platform: process.platform
  });
  
  console.log('electronAPI exposed successfully');
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
  
  console.log('electronAPI exposed:', !!window.electronAPI);
}); 