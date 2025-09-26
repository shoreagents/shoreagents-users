const { ipcMain } = require('electron');
const { GlobalKeyboardListener } = require('node-global-key-listener');

class KeyboardTracker {
  constructor(activityTracker = null) {
    this.isTracking = false;
    this.keyPressHistory = [];
    this.maxHistorySize = 1000; // Limit history to prevent memory issues
    this.keyListener = null;
    this.lastKeyPress = {}; // Track last key press to prevent duplicates
    this.activityTracker = activityTracker; // Reference to activity tracker
    
    // Anti-cheat measures
    this.keyPressPatterns = []; // Track recent key press patterns
    this.maxPatternHistory = 20; // Keep last 20 key presses for pattern analysis
    this.spamThreshold = 0.8; // If 80% of recent keys are the same, consider it spam
    this.minKeyVariety = 3; // Require at least 3 different keys in recent history
    this.lastActivityUpdate = 0; // Track when we last updated activity
    this.activityCooldown = 5000; // Only update activity every 5 seconds max
    
    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    // Start keyboard tracking
    ipcMain.handle('start-keyboard-tracking', () => {
      try {
        this.startTracking();
        return { success: true, message: 'Keyboard tracking started' };
      } catch (error) {
        console.error('Error starting keyboard tracking:', error);
        return { success: false, message: error.message };
      }
    });

    // Stop keyboard tracking
    ipcMain.handle('stop-keyboard-tracking', () => {
      try {
        this.stopTracking();
        return { success: true, message: 'Keyboard tracking stopped' };
      } catch (error) {
        console.error('Error stopping keyboard tracking:', error);
        return { success: false, message: error.message };
      }
    });

    // Check if tracking is active
    ipcMain.handle('is-keyboard-tracking', () => {
      return this.isTracking;
    });

    // Clear keyboard history
    ipcMain.handle('clear-keyboard-history', () => {
      try {
        this.keyPressHistory = [];
        return { success: true, message: 'Keyboard history cleared' };
      } catch (error) {
        console.error('Error clearing keyboard history:', error);
        return { success: false, message: error.message };
      }
    });
  }

  startTracking() {
    // Always start tracking when the app starts
    if (this.isTracking) {
      console.log('Keyboard tracking is already active');
      return;
    }

    console.log('Starting keyboard tracking...');
    this.isTracking = true;
    this.keyPressHistory = [];

    // Register key listeners
    this.registerKeyListeners();
  }

  stopTracking() {
    // Don't actually stop tracking, just clear history
    this.keyPressHistory = [];
    this.keyPressPatterns = []; // Reset pattern analysis
  }

  registerKeyListeners() {
    try {
      // Stop existing listener if any
      if (this.keyListener) {
        this.keyListener.stop();
        this.keyListener = null;
      }
      
      // Create a new global keyboard listener
      this.keyListener = new GlobalKeyboardListener();
      
      // Define the allowed keys
      const allowedKeys = ['A', 'E', 'I', 'O', 'U', 'C', 'Backspace'];
      
      // Start the listener
      this.keyListener.start();
      
      // Listen for key events
      this.keyListener.addListener((e, down) => {
        // Check if the specific key is being pressed down (not released)
        const isKeyDown = down && down[e.name] === true;
        
        // Only process key down events to avoid duplicates
        if (this.isTracking && isKeyDown && this.isAllowedKey(e.name)) {
          // Map the key name to our format
          const keyMappings = {
            'KeyA': 'A',
            'KeyE': 'E', 
            'KeyI': 'I',
            'KeyO': 'O',
            'KeyU': 'U',
            'KeyC': 'C',
            'Backspace': 'Backspace',
            'BACKSPACE': 'Backspace'
          };
          
          const keyName = keyMappings[e.name] || e.name;
          const modifiers = {
            ctrl: e.ctrlKey || false,
            alt: e.altKey || false,
            shift: e.shiftKey || false,
            meta: e.metaKey || false
          };
          
          this.handleKeyPress(keyName, keyName, modifiers.ctrl, modifiers.alt, modifiers.shift, modifiers.meta);
        }
      });
      
    } catch (error) {
      console.error('Error starting global keyboard listener:', error);
    }
  }

  isAllowedKey(key) {
    const allowedKeys = ['A', 'E', 'I', 'O', 'U', 'C', 'Backspace'];
    // Handle different key name formats that the library might use
    const keyMappings = {
      'KeyA': 'A',
      'KeyE': 'E', 
      'KeyI': 'I',
      'KeyO': 'O',
      'KeyU': 'U',
      'KeyC': 'C',
      'Backspace': 'Backspace',
      'BACKSPACE': 'Backspace'
    };
    
    const mappedKey = keyMappings[key] || key;
    return allowedKeys.includes(mappedKey);
  }

  unregisterKeyListeners() {
    try {
      if (this.keyListener) {
        this.keyListener.stop();
        this.keyListener = null;
      }
    } catch (error) {
      console.error('Error stopping global keyboard listener:', error);
    }
  }

  handleKeyPress(key, code, ctrl, alt, shift, meta) {
    if (!this.isTracking) return;

    const now = Date.now();
    const keyId = `${key}-${ctrl}-${alt}-${shift}-${meta}`;
    
    // Debounce: ignore if same key pressed within 50ms
    if (this.lastKeyPress[keyId] && (now - this.lastKeyPress[keyId]) < 50) {
      return;
    }
    
    this.lastKeyPress[keyId] = now;

    // Always track the key press for display purposes
    const keyPress = {
      key: key,
      code: code,
      timestamp: now,
      modifiers: {
        ctrl: ctrl,
        alt: alt,
        shift: shift,
        meta: meta
      }
    };

    // Add to history
    this.keyPressHistory.push(keyPress);

    // Limit history size
    if (this.keyPressHistory.length > this.maxHistorySize) {
      this.keyPressHistory = this.keyPressHistory.slice(-this.maxHistorySize);
    }

    // Send to renderer process
    this.sendKeyPressToRenderer(keyPress);

    // Only update activity if it's valid (anti-cheat check)
    if (this.isValidActivity(key)) {
      if (this.activityTracker && typeof this.activityTracker.updateActivity === 'function') {
        this.activityTracker.updateActivity();
        this.lastActivityUpdate = now;
      }
    }
  }

  sendKeyPressToRenderer(keyPress) {
    // Get the main window and send the key press event
    const { BrowserWindow } = require('electron');
    
    // Get all windows and find the main one
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows.find(window => !window.isDestroyed());
    
    if (mainWindow) {
      mainWindow.webContents.send('key-press', keyPress);
    }
  }

  // Get current tracking status
  getStatus() {
    return {
      isTracking: this.isTracking,
      historySize: this.keyPressHistory.length,
      maxHistorySize: this.maxHistorySize
    };
  }

  // Get key press history
  getHistory() {
    return this.keyPressHistory;
  }

  // Set activity tracker reference
  setActivityTracker(activityTracker) {
    this.activityTracker = activityTracker;
  }

  // Check if the recent key press pattern indicates spam
  isSpamPattern(key) {
    // Add current key to pattern history
    this.keyPressPatterns.push(key);
    
    // Keep only recent history
    if (this.keyPressPatterns.length > this.maxPatternHistory) {
      this.keyPressPatterns = this.keyPressPatterns.slice(-this.maxPatternHistory);
    }
    
    // Need at least 5 key presses to analyze pattern
    if (this.keyPressPatterns.length < 5) {
      return false;
    }
    
    // Count frequency of each key
    const keyCounts = {};
    this.keyPressPatterns.forEach(k => {
      keyCounts[k] = (keyCounts[k] || 0) + 1;
    });
    
    // Check if any single key dominates (spam threshold)
    const totalKeys = this.keyPressPatterns.length;
    const maxCount = Math.max(...Object.values(keyCounts));
    const maxPercentage = maxCount / totalKeys;
    
    // Check key variety
    const uniqueKeys = Object.keys(keyCounts).length;
    
    // Consider it spam if:
    // 1. One key represents more than 80% of recent presses, OR
    // 2. Less than 3 different keys in recent history
    const isSpam = maxPercentage > this.spamThreshold || uniqueKeys < this.minKeyVariety;
    
    return isSpam;
  }

  // Check if enough time has passed since last activity update
  canUpdateActivity() {
    const now = Date.now();
    return (now - this.lastActivityUpdate) >= this.activityCooldown;
  }

  // Validate if the key press represents meaningful activity
  isValidActivity(key) {
    // Check for spam patterns
    if (this.isSpamPattern(key)) {
      return false;
    }
    
    // Check cooldown
    if (!this.canUpdateActivity()) {
      return false;
    }
    
    return true;
  }

  // Cleanup method
  cleanup() {
    this.stopTracking();
    this.unregisterKeyListeners();
    this.keyPressHistory = [];
    this.keyPressPatterns = [];
  }
}

module.exports = KeyboardTracker;
