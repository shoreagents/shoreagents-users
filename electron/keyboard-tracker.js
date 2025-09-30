const { ipcMain } = require('electron');
const { uIOhook } = require('uiohook-napi');

class KeyboardTracker {
  constructor(activityTracker = null) {
    this.isTracking = false;
    this.keyPressHistory = [];
    this.maxHistorySize = 1000; // Limit history to prevent memory issues
    this.keyListener = null;
    this.lastKeyPress = {}; // Track last key press to prevent duplicates
    this.pressedKeys = new Set(); // Track currently pressed keys
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
    // No IPC handlers needed since keyboard tracking is only used internally
    // for activity monitoring, not exposed to the frontend
  }

  startTracking() {
    // Always start tracking when the app starts
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;
    this.keyPressHistory = [];

    // Register key listeners
    this.registerKeyListeners();
    
    // If keyboard listener failed to initialize, log a warning but continue
    if (!this.keyListener) {
      console.warn('Keyboard listener failed to initialize. Keyboard tracking will be limited.');
    }
  }

  stopTracking() {
    // Don't actually stop tracking, just clear history
    this.keyPressHistory = [];
    this.keyPressPatterns = []; // Reset pattern analysis
    this.lastKeyPress = {}; // Clear last key press tracking
    this.pressedKeys.clear(); // Clear pressed keys
  }

  registerKeyListeners() {
    try {
      // Stop existing listener if any
      if (this.keyListener) {
        uIOhook.stop();
        this.keyListener = null;
      }
      
      // Define the allowed keys
      const allowedKeys = ['A', 'E', 'I', 'O', 'U', 'C', 'Backspace'];
      
      // Start the listener with error handling
      try {
        uIOhook.start();
        this.keyListener = true; // Mark as active
      } catch (startError) {
        console.error('Failed to start global keyboard listener:', startError);
        // If we can't start the listener, we'll fall back to a mock implementation
        this.keyListener = null;
        return;
      }
      
      // Listen for key down events
      uIOhook.on('keydown', (e) => {
        try {
          // Only process key down events to avoid duplicates
          if (this.isTracking && this.isAllowedKey(e.keycode)) {
            const keyId = `${e.keycode}-${e.ctrlKey}-${e.altKey}-${e.shiftKey}-${e.metaKey}`;
            
            // Check if this key combination is already being pressed
            if (this.pressedKeys.has(keyId)) {
              return;
            }
            
            // Mark key as pressed
            this.pressedKeys.add(keyId);
            
            // Map the keycode to our format
            const keyMappings = {
              30: 'A',    // KeyA
              18: 'E',    // KeyE
              23: 'I',    // KeyI
              24: 'O',    // KeyO
              22: 'U',    // KeyU
              46: 'C',    // KeyC
              14: 'Backspace' // Backspace
            };
            
            const keyName = keyMappings[e.keycode] || 'Unknown';
            const modifiers = {
              ctrl: e.ctrlKey || false,
              alt: e.altKey || false,
              shift: e.shiftKey || false,
              meta: e.metaKey || false
            };
            
            this.handleKeyPress(keyName, keyName, modifiers.ctrl, modifiers.alt, modifiers.shift, modifiers.meta);
          }
        } catch (listenerError) {
          console.error('Error in keyboard listener callback:', listenerError);
        }
      });
      
      // Listen for key up events to clear pressed state
      uIOhook.on('keyup', (e) => {
        try {
          if (this.isTracking && this.isAllowedKey(e.keycode)) {
            const keyId = `${e.keycode}-${e.ctrlKey}-${e.altKey}-${e.shiftKey}-${e.metaKey}`;
            this.pressedKeys.delete(keyId);
          }
        } catch (listenerError) {
          console.error('Error in keyboard up listener callback:', listenerError);
        }
      });
      
    } catch (error) {
      console.error('Error starting global keyboard listener:', error);
      // Set keyListener to null to indicate failure
      this.keyListener = null;
    }
  }

  isAllowedKey(keycode) {
    // Define allowed keycodes for uiohook-napi
    const allowedKeycodes = {
      30: 'A',    // KeyA
      18: 'E',    // KeyE
      23: 'I',    // KeyI
      24: 'O',    // KeyO
      22: 'U',    // KeyU
      46: 'C',    // KeyC
      14: 'Backspace' // Backspace
    };
    
    return allowedKeycodes.hasOwnProperty(keycode);
  }

  unregisterKeyListeners() {
    try {
      if (this.keyListener) {
        uIOhook.stop();
        this.keyListener = null;
        // Clear any remaining pressed keys
        this.lastKeyPress = {};
        this.pressedKeys.clear();
      }
    } catch (error) {
      console.error('Error stopping global keyboard listener:', error);
    }
  }

  handleKeyPress(key, code, ctrl, alt, shift, meta) {
    if (!this.isTracking) return;

    const now = Date.now();
    const keyId = `${key}-${ctrl}-${alt}-${shift}-${meta}`;
    
    // Enhanced debounce: ignore if same key pressed within 200ms
    if (this.lastKeyPress[keyId] && (now - this.lastKeyPress[keyId]) < 200) {
      return;
    }
    
    this.lastKeyPress[keyId] = now;

    // Clean up old key press records to prevent memory leaks
    const cleanupThreshold = 5000; // 5 seconds
    Object.keys(this.lastKeyPress).forEach(id => {
      if (now - this.lastKeyPress[id] > cleanupThreshold) {
        delete this.lastKeyPress[id];
      }
    });

    // Additional duplicate check: look at recent history
    const recentThreshold = 300; // 300ms
    const recentKeyPress = this.keyPressHistory
      .slice(-5) // Check last 5 key presses
      .find(kp => 
        kp.key === key && 
        kp.modifiers.ctrl === ctrl && 
        kp.modifiers.alt === alt && 
        kp.modifiers.shift === shift && 
        kp.modifiers.meta === meta && 
        (now - kp.timestamp) < recentThreshold
      );
    
    if (recentKeyPress) {
      return;
    }

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

    // Keyboard tracking is now only used for internal activity monitoring

    // Only update activity if it's valid (anti-cheat check)
    if (this.isValidActivity(key)) {
      if (this.activityTracker && typeof this.activityTracker.updateActivity === 'function') {
        this.activityTracker.updateActivity();
        this.lastActivityUpdate = now;
      }
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
    this.pressedKeys.clear();
    
    // Ensure uiohook is stopped
    try {
      uIOhook.stop();
    } catch (error) {
      console.error('Error stopping uiohook during cleanup:', error);
    }
  }
}

module.exports = KeyboardTracker;
