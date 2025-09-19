const { app, BrowserWindow, Menu, Tray, shell, ipcMain, Notification, dialog, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';
// Optional sound library (not required at runtime if unavailable)
let soundPlay = null;
try {
  soundPlay = require('sound-play');
} catch (_) {
  soundPlay = null;
}
const ActivityTracker = require('./activity-tracker');

// Global variables for black screen windows
let blackScreenWindows = [];

// Global variables for break monitoring
let breakActive = false;
let breakWindowId = null;
let focusLossCooldown = false;
let focusLossCooldownTimeout = null;
let focusMonitoringSetup = false; // Flag to prevent multiple setup calls

// Function to create black screen windows on secondary monitors
function createBlackScreenWindows() {
  try {
    // Get all displays
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    // Close any existing black screen windows
    closeBlackScreenWindows();
    
    // Create black screen windows on secondary monitors
    displays.forEach((display, index) => {
      if (display.id !== primaryDisplay.id) {
        const blackWindow = new BrowserWindow({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
          fullscreen: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          frame: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true
          },
          show: false
        });
        
        // Load a completely minimal black HTML page
        blackWindow.loadURL(`data:text/html,
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Break Time</title>
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  border: 0;
                  outline: 0;
                  background: #000000 !important;
                  color: #000000 !important;
                }
                html, body {
                  width: 100vw;
                  height: 100vh;
                  overflow: hidden;
                  background: #000000 !important;
                  user-select: none;
                  -webkit-user-select: none;
                  -moz-user-select: none;
                  -ms-user-select: none;
                  cursor: none;
                  /* Force full coverage including taskbar area */
                  position: fixed;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  z-index: 2147483647; /* Maximum z-index */
                }
                .break-indicator {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  color: #ffffff !important;
                  font-family: Arial, sans-serif;
                  font-size: 24px;
                  opacity: 0.3;
                  pointer-events: none;
                  z-index: 9999;
                  background: transparent !important;
                }
                /* Additional overlay to ensure taskbar is covered */
                .taskbar-cover {
                  position: fixed;
                  bottom: 0;
                  left: 0;
                  right: 0;
                  height: 50px; /* Cover taskbar height */
                  background: #000000 !important;
                  z-index: 2147483646; /* Just below body */
                }
              </style>
            </head>
            <body>
              <div class="break-indicator">Break Time</div>
              <div class="taskbar-cover"></div>
            </body>
          </html>
        `);
        
        // Allow mouse events but prevent keyboard interaction
        blackWindow.setIgnoreMouseEvents(false);
        blackWindow.setFocusable(false);
        
        // Set window properties to prevent keyboard interaction
        blackWindow.setClosable(false);
        blackWindow.setMinimizable(false);
        blackWindow.setMaximizable(false);
        blackWindow.setResizable(false);
        
        // Completely disable keyboard shortcuts, menu, and system interactions
        blackWindow.setMenu(null);
        blackWindow.setAutoHideMenuBar(true);
        
        // Prevent any system-level keyboard shortcuts
        blackWindow.setAlwaysOnTop(true, 'screen-saver');
        blackWindow.setSkipTaskbar(true);
        
        // Set maximum window level to ensure it covers everything including taskbar
        blackWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        
        // Force the window to be the topmost possible
        blackWindow.moveTop();
        
        // Block ALL keyboard input completely at multiple levels
        blackWindow.webContents.on('before-input-event', (event) => {
          // Block every single keyboard input (F11, Alt+F4, Ctrl+W, etc.)
          if (event.type === 'keyDown' || event.type === 'keyUp') {
            event.preventDefault();
            return false;
          }
        });
        
        // Block all keyboard events
        blackWindow.webContents.on('keydown', (event) => {
          event.preventDefault();
          return false;
        });
        
        blackWindow.webContents.on('keyup', (event) => {
          event.preventDefault();
          return false;
        });
        
        // Block keyboard shortcuts at the system level
        blackWindow.webContents.on('before-input-event', (event) => {
          // Block all possible keyboard combinations
          if (event.type === 'keyDown') {
            // Block F11, Alt+F4, Ctrl+W, Ctrl+Q, etc.
            if (event.key === 'F11' || event.key === 'F12' || 
                event.control || event.alt || event.meta || event.shift) {
              event.preventDefault();
              return false;
            }
          }
        });
        
        // Block system keyboard shortcuts and ensure no focus
        blackWindow.on('focus', () => {
          blackWindow.setFocusable(false);
        });
        
        // Additional window-level keyboard blocking
        blackWindow.on('keydown', (event) => {
          event.preventDefault();
          return false;
        });
        
        blackWindow.on('keyup', (event) => {
          event.preventDefault();
          return false;
        });
        
        // Block all possible keyboard shortcuts
        blackWindow.on('blur', () => {
          // Prevent window from losing focus to other windows
          blackWindow.focus();
        });
        
        // Block mouse events that could be used to interact with other windows
        blackWindow.on('mouse-enter', () => {
          // Keep focus on this window
          blackWindow.focus();
        });
        
        // Block any attempt to move or resize the window
        blackWindow.on('moved', () => {
          // Prevent window from being moved
          const display = screen.getDisplayNearestPoint(blackWindow.getBounds());
          if (display && display.id !== screen.getPrimaryDisplay().id) {
            blackWindow.setBounds(display.bounds);
          }
        });
        
        blackWindow.on('resize', () => {
          // Prevent window from being resized
          const display = screen.getDisplayNearestPoint(blackWindow.getBounds());
          if (display && display.id !== screen.getPrimaryDisplay().id) {
            blackWindow.setBounds(display.bounds);
          }
        });
        
        // Block context menu
        blackWindow.webContents.on('context-menu', (event) => {
          event.preventDefault();
        });
        
        // Block new window creation
        blackWindow.webContents.setWindowOpenHandler(() => {
          return { action: 'deny' };
        });
        
        // Block navigation
        blackWindow.webContents.on('will-navigate', (event) => {
          event.preventDefault();
        });
        
        // Block window movement and resizing
        blackWindow.on('moved', (event) => {
          // Prevent window from being moved
          const display = screen.getDisplayNearestPoint(blackWindow.getBounds());
          if (display && display.id !== screen.getPrimaryDisplay().id) {
            blackWindow.setBounds(display.bounds);
          }
        });
        
        blackWindow.on('resize', (event) => {
          // Prevent window from being resized
          const display = screen.getDisplayNearestPoint(blackWindow.getBounds());
          if (display && display.id !== screen.getPrimaryDisplay().id) {
            blackWindow.setBounds(display.bounds);
          }
        });
        
        // Store references to event handlers so we can remove them later
        const closeHandler = (event) => {
          event.preventDefault();
          return false;
        };
        
        const minimizeHandler = (event) => {
          event.preventDefault();
          blackWindow.show();
          return false;
        };
        
        const maximizeHandler = (event) => {
          event.preventDefault();
          return false;
        };
        
        const restoreHandler = (event) => {
          event.preventDefault();
          return false;
        };
        
        const hideHandler = (event) => {
          event.preventDefault();
          blackWindow.show();
          return false;
        };
        
        // Block window close attempts and prevent any system shortcuts
        blackWindow.on('close', closeHandler);
        
        // Block minimize, maximize, and restore events
        blackWindow.on('minimize', minimizeHandler);
        
        blackWindow.on('maximize', maximizeHandler);
        
        blackWindow.on('restore', restoreHandler);
        
        // Block any attempt to close the window
        blackWindow.on('closed', () => {
          // This should never happen, but just in case
          console.warn('Black screen window was closed unexpectedly');
        });
        
        // Prevent window from being hidden
        blackWindow.on('hide', hideHandler);
        
        // Store the event handlers for later removal
        blackWindow._eventHandlers = {
          close: closeHandler,
          minimize: minimizeHandler,
          maximize: maximizeHandler,
          restore: restoreHandler,
          hide: hideHandler
        };
        
        // Set window background color as additional fallback
        blackWindow.setBackgroundColor('#000000');
        
        // Show the window
        blackWindow.show();
        
        // Store reference
        blackScreenWindows.push(blackWindow);
        
      }
    });
    
    // Add a small delay and then ensure main window has focus
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
    }, 500);
    
    return { success: true, count: blackScreenWindows.length };
  } catch (error) {
    console.error('Error creating black screen windows:', error);
    return { success: false, error: error.message };
  }
}

// Function to close all black screen windows
function closeBlackScreenWindows() {
  try {
    
    blackScreenWindows.forEach((window, index) => {
      if (window && !window.isDestroyed()) {
        // Force close by removing specific event listeners and destroying the window
        try {
          // Remove specific event handlers that prevent closing
          if (window._eventHandlers) {
            window.removeListener('close', window._eventHandlers.close);
            window.removeListener('minimize', window._eventHandlers.minimize);
            window.removeListener('maximize', window._eventHandlers.maximize);
            window.removeListener('restore', window._eventHandlers.restore);
            window.removeListener('hide', window._eventHandlers.hide);
          }
          
          // Force destroy the window
          window.destroy();
        } catch (windowError) {
          console.warn(`Error destroying window ${window.id}:`, windowError);
          // Fallback: try to close normally
          try {
            window.close();
          } catch (closeError) {
            console.warn(`Error closing window ${window.id}:`, closeError);
          }
        }
      }
    });
    
    blackScreenWindows = [];
    return { success: true };
  } catch (error) {
    console.error('Error closing black screen windows:', error);
    return { success: false, error: error.message };
  }
}

// Function to get monitor information
function getMonitorInfo() {
  try {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    return {
      success: true,
      displays: displays.map(display => ({
        id: display.id,
        isPrimary: display.id === primaryDisplay.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor
      })),
      primaryDisplay: {
        id: primaryDisplay.id,
        bounds: primaryDisplay.bounds,
        workArea: primaryDisplay.workArea,
        scaleFactor: primaryDisplay.scaleFactor
      }
    };
  } catch (error) {
    console.error('Error getting monitor info:', error);
    return { success: false, error: error.message };
  }
}

// Function to setup break focus monitoring
function setupBreakFocusMonitoring() {
  try {
    // Check if monitoring is already set up
    if (focusMonitoringSetup) {
      return { success: true, alreadySetup: true };
    }
    
    focusMonitoringSetup = true;
    
    // Enable kiosk mode on main window
    if (mainWindow) {
      // Set kiosk mode to prevent taskbar access
      mainWindow.setKiosk(true);
      
      // Set always on top with highest priority
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // Hide menu bar completely
      mainWindow.setMenuBarVisibility(false);
      mainWindow.setAutoHideMenuBar(true);
      
      // Disable window controls
      mainWindow.setClosable(false);
      mainWindow.setMinimizable(false);
      mainWindow.setMaximizable(false);
      mainWindow.setResizable(false);
      
      // Windows-specific: Block virtual desktop creation at system level
      if (process.platform === 'win32') {
        try {
          // Use Windows API to disable virtual desktop switching
          const { exec } = require('child_process');
          
                  // Disable Windows+Tab (Task View)
        exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableTaskView" /t REG_DWORD /d 0 /f', (error) => {
          if (error) {
            console.warn('Could not disable Task View via registry (may require admin):', error.message);
          }
        });
        
        // Disable virtual desktop creation
        exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableVirtualDesktop" /t REG_DWORD /d 0 /f', (error) => {
          if (error) {
            console.warn('Could not disable virtual desktops via registry (may require admin):', error.message);
          }
        });
        
        // Disable taskbar grouping and switching
        exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "TaskbarGrouping" /t REG_DWORD /d 0 /f', (error) => {
          if (error) {
            console.warn('Could not disable taskbar grouping via registry:', error.message);
          }
        });
        
        // Disable taskbar previews
        exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableTaskbarThumbnails" /t REG_DWORD /d 0 /f', (error) => {
          if (error) {
            console.warn('Could not disable taskbar thumbnails via registry:', error.message);
          }
        });
        
        // Hide taskbar on secondary monitors during break
        exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "MultiTaskbarAltTab" /t REG_DWORD /d 0 /f', (error) => {
          if (error) {
            console.warn('Could not disable multi-taskbar via registry:', error.message);
          }
        });
        
        // Hide taskbar completely on secondary monitors
        exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "ShowTaskbarOnSecondaryDisplays" /t REG_DWORD /d 0 /f', (error) => {
          if (error) {
            console.warn('Could not hide taskbar on secondary displays via registry:', error.message);
          }
        });
          
        } catch (registryError) {
          console.warn('Registry modification not available:', registryError.message);
        }
      }
    }
    
    // Monitor when main window loses focus
    if (mainWindow) {
      mainWindow.on('blur', () => {
        if (breakActive && !focusLossCooldown) {
          mainWindow.webContents.send('break-focus-lost');
          // DON'T close black screens here - just show dialog
        }
      });
      
      mainWindow.on('minimize', () => {
        if (breakActive && !focusLossCooldown) {
          mainWindow.webContents.send('break-minimized');
          // DON'T close black screens here - just show dialog
        }
      });
      
      mainWindow.on('hide', () => {
        if (breakActive && !focusLossCooldown) {
          mainWindow.webContents.send('break-hidden');
          // DON'T close black screens here - just show dialog
        }
      });
      
      // Store break window reference
      breakWindowId = mainWindow.id;
    }
    
    // Monitor when other windows gain focus
    app.on('browser-window-focus', (event, focusedWindow) => {
      if (breakActive && !focusLossCooldown && focusedWindow && focusedWindow.id !== breakWindowId) {
        mainWindow.webContents.send('break-focus-lost');
        // DON'T close black screens here - just show dialog
      }
    });
    
    // Register global shortcuts to block virtual desktop creation and switching
    try {
      // Block Windows+Tab (Task View) - MORE AGGRESSIVE
      globalShortcut.register('Meta+Tab', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block Windows+Ctrl+D (Create new virtual desktop) - MORE AGGRESSIVE
      globalShortcut.register('Meta+Ctrl+D', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block Windows+Ctrl+Left/Right (Switch between virtual desktops) - MORE AGGRESSIVE
      globalShortcut.register('Meta+Ctrl+Left', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      globalShortcut.register('Meta+Ctrl+Right', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block Windows+Ctrl+F4 (Close virtual desktop) - MORE AGGRESSIVE
      globalShortcut.register('Meta+Ctrl+F4', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block Alt+Tab (switch between applications)
      globalShortcut.register('Alt+Tab', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block F11 (fullscreen toggle)
      globalShortcut.register('F11', () => {
        if (breakActive) {
          return false;
        }
        return true;
      });
      
      // Block Windows key and taskbar access - FIXED VERSION
      globalShortcut.register('Meta', () => {
        if (breakActive) {
          // Force focus back to main window immediately
          if (mainWindow) {
            mainWindow.focus();
            // Ensure it's still in fullscreen and kiosk mode
            if (!mainWindow.isFullScreen()) {
              mainWindow.setFullScreen(true);
            }
            if (!mainWindow.isKiosk()) {
              mainWindow.setKiosk(true);
            }
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block Ctrl+Esc (Start menu)
      globalShortcut.register('Ctrl+Escape', () => {
        if (breakActive) {
          return false;
        }
        return true;
      });
      
      // Block Windows+Space (input method)
      globalShortcut.register('Meta+Space', () => {
        if (breakActive) {
          return false;
        }
        return true;
      });
      
      // Block Windows+D (show desktop)
      globalShortcut.register('Meta+D', () => {
        if (breakActive) {
          return false;
        }
        return true;
      });
      
      // Block Windows+M (minimize all)
      globalShortcut.register('Meta+M', () => {
        if (breakActive) {
          return false;
        }
        return true;
      });
      
      // ADDITIONAL VIRTUAL DESKTOP BLOCKING
      // Block Windows+Ctrl+Shift+D (Create new virtual desktop alternative)
      globalShortcut.register('Meta+Ctrl+Shift+D', () => {
        if (breakActive) {
          if (mainWindow) {
            mainWindow.focus();
            if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
            if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // Block Windows+Ctrl+Shift+Left/Right (Alternative desktop switching)
      globalShortcut.register('Meta+Ctrl+Shift+Left', () => {
        if (breakActive) {
          if (mainWindow) {
            mainWindow.focus();
            if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
            if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      globalShortcut.register('Meta+Ctrl+Shift+Right', () => {
        if (breakActive) {
          if (mainWindow) {
            mainWindow.focus();
            if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
            if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
          }
          mainWindow.webContents.send('break-focus-lost');
          return false;
        }
        return true;
      });
      
      // BLOCK ALL POSSIBLE VIRTUAL DESKTOP COMBINATIONS
      // Block any Meta key combination that might create/switch desktops
      const metaCombinations = [
        'Meta+1', 'Meta+2', 'Meta+3', 'Meta+4', 'Meta+5', 'Meta+6', 'Meta+7', 'Meta+8', 'Meta+9',
        'Meta+Shift+1', 'Meta+Shift+2', 'Meta+Shift+3', 'Meta+Shift+4', 'Meta+Shift+5',
        'Meta+Ctrl+1', 'Meta+Ctrl+2', 'Meta+Ctrl+3', 'Meta+Ctrl+4', 'Meta+Ctrl+5',
        'Meta+Alt+1', 'Meta+Alt+2', 'Meta+Alt+3', 'Meta+Alt+4', 'Meta+Alt+5'
      ];
      
      metaCombinations.forEach(combo => {
        try {
          globalShortcut.register(combo, () => {
            if (breakActive) {
              if (mainWindow) {
                mainWindow.focus();
                if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
                if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
              }
              mainWindow.webContents.send('break-focus-lost');
              return false;
            }
            return true;
          });
        } catch (error) {
          // Some combinations might not be valid, ignore errors
        }
      });
      
    } catch (shortcutError) {
      console.warn('Some virtual desktop shortcuts could not be blocked:', shortcutError.message);
    }
    
    
    // Set up periodic focus check to catch any attempts to switch away
    if (breakActive) {
      const focusCheckInterval = setInterval(() => {
        if (!breakActive) {
          clearInterval(focusCheckInterval);
          return;
        }
        
        // Check if main window is still focused
        if (mainWindow && !mainWindow.isFocused() && !focusLossCooldown) {
          mainWindow.webContents.send('break-focus-lost');
          // DON'T close black screens here - just show dialog
        }
        
        // Ensure kiosk mode and fullscreen are still active
        if (mainWindow) {
          if (!mainWindow.isKiosk()) {
            mainWindow.setKiosk(true);
          }
          if (!mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(true);
          }
          if (!mainWindow.isFocused()) {
            mainWindow.focus();
          }
        }
        
        // Ensure black screen windows are still active on secondary monitors
        if (blackScreenWindows.length === 0) {
          const blackScreenResult = createBlackScreenWindows();
          if (blackScreenResult.success) {
          }
        }
        
        // Ensure black screen windows stay on top and cover taskbar
        blackScreenWindows.forEach((window, index) => {
          if (window && !window.isDestroyed()) {
            try {
              // Force window to stay on top
              window.setAlwaysOnTop(true, 'screen-saver', 1);
              window.moveTop();
              
              // Ensure it's still fullscreen
              if (!window.isFullScreen()) {
                window.setFullScreen(true);
              }
              
              // Force bounds to cover entire monitor including taskbar
              const display = screen.getDisplayNearestPoint(window.getBounds());
              if (display) {
                const bounds = display.bounds;
                // Extend height to ensure taskbar is covered
                const extendedBounds = {
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height + 50 // Extra height to cover taskbar
                };
                window.setBounds(extendedBounds);
              }
            } catch (error) {
              console.warn(`Error maintaining black screen window ${index}:`, error.message);
            }
          }
        });
      }, 1000); // Check every 1 second (more aggressive)
      
      // Store the interval for cleanup
      mainWindow._focusCheckInterval = focusCheckInterval;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error setting up break focus monitoring:', error);
    return { success: false, error: error.message };
  }
}

// Function to set break active state
function setBreakActiveState(active) {
  breakActive = active; 
  
  if (active) {
    // Add a delay to prevent focus monitoring from triggering during fullscreen transition
    setTimeout(() => {
      if (breakActive) { // Double-check that break is still active
        // Additional check: ensure window is stable in fullscreen mode and has focus
        if (mainWindow && mainWindow.isFullScreen() && mainWindow.isFocused()) {
          setupBreakFocusMonitoring();
          
          // Ensure black screen windows are active on secondary monitors
          if (blackScreenWindows.length === 0) {
            const blackScreenResult = createBlackScreenWindows();
            if (blackScreenResult.success) {
            }
          }
        } else {
          // Wait another second if not yet ready
          setTimeout(() => {
            if (breakActive && mainWindow && mainWindow.isFullScreen() && mainWindow.isFocused()) {
              setupBreakFocusMonitoring();
              
              // Ensure black screen windows are active on secondary monitors
              if (blackScreenWindows.length === 0) {
                const blackScreenResult = createBlackScreenWindows();
                if (blackScreenResult.success) {
                }
              }
            } else {
              setupBreakFocusMonitoring();
            }
          }, 1000);
        }
      }
    }, 2000); // 2 second delay
  } else {
    // Unregister global shortcuts when break becomes inactive
    try {
      globalShortcut.unregisterAll();
    } catch (shortcutError) {
      console.warn('Error unregistering global shortcuts:', shortcutError.message);
    }
    
    // Clear focus check interval
    if (mainWindow && mainWindow._focusCheckInterval) {
      clearInterval(mainWindow._focusCheckInterval);
      mainWindow._focusCheckInterval = null;
    }
    
    // Reset focus monitoring setup flag
    focusMonitoringSetup = false;
  }
  
  return { success: true, breakActive: active };
}

// Function to get break active state
function getBreakActiveState() {
  return { success: true, breakActive: breakActive };
}

// Function to restore window to normal state
function restoreWindowToNormalState() {
  try {
    if (mainWindow) {
      // Exit kiosk mode first
      mainWindow.setKiosk(false);
      
      // Exit fullscreen
      mainWindow.setFullScreen(false);
      
      // Restore normal window size and position
      mainWindow.setBounds({
        x: mainWindow.getBounds().x,
        y: mainWindow.getBounds().y,
        width: 1200,
        height: 800
      });
      
      // Show menu bar
      mainWindow.setMenuBarVisibility(true);
      
      // Remove always on top on Windows
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(false);
      }
      
      // Re-enable window controls
      mainWindow.setClosable(true);
      mainWindow.setMinimizable(true);
      mainWindow.setMaximizable(true);
      mainWindow.setResizable(true);
      
      // Windows-specific: Restore virtual desktop functionality
      if (process.platform === 'win32') {
        try {
          const { exec } = require('child_process');
          
          // Re-enable Windows+Tab (Task View)
          exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableTaskView" /t REG_DWORD /d 1 /f', (error) => {
            if (error) {
              console.warn('Could not re-enable Task View via registry:', error.message);
            }
          });
          
          // Re-enable virtual desktop creation
          exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableVirtualDesktop" /t REG_DWORD /d 1 /f', (error) => {
            if (error) {
              console.warn('Could not re-enable virtual desktops via registry:', error.message);
            }
          });
          
          // Re-enable taskbar grouping and switching
          exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "TaskbarGrouping" /t REG_DWORD /d 1 /f', (error) => {
            if (error) {
              console.warn('Could not re-enable taskbar grouping via registry:', error.message);
            }
          });
          
          // Re-enable taskbar previews
          exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableTaskbarThumbnails" /t REG_DWORD /d 1 /f', (error) => {
            if (error) {
              console.warn('Could not re-enable taskbar thumbnails via registry:', error.message);
            }
          });
          
          // Re-enable multi-taskbar on secondary monitors
          exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Advanced" /v "MultiTaskbarAltTab" /t REG_DWORD /d 1 /f', (error) => {
            if (error) {
              console.warn('Could not re-enable multi-taskbar via registry:', error.message);
            }
          });
          
          // Re-enable taskbar on secondary displays
          exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "ShowTaskbarOnSecondaryDisplays" /t REG_DWORD /d 1 /f', (error) => {
            if (error) {
              console.warn('Could not re-enable taskbar on secondary displays via registry:', error.message);
            }
          });
          
        } catch (registryError) {
          console.warn('Registry restoration not available:', registryError.message);
        }
      }
      
      // Ensure window is visible and focused
      mainWindow.show();
      mainWindow.focus();
      
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error restoring window to normal state:', error);
    return { success: false, error: error.message };
  }
}

// Keep a global reference of the window object
let mainWindow;
let activityTracker;
let inactivityNotification = null;
let tray = null;
let isQuitting = false;
let notificationBadgeCount = 0;
let systemNotifications = [];
// Attempt to play a custom notification sound from /public
function getSoundPath(type = 'main') {
  try {
    const candidates = type === 'inactivity'
      ? [
          path.join(__dirname, '../public/notification.mp3'),
          path.join(__dirname, '../public/notification.wav'),
        ]
      : [
          path.join(__dirname, '../public/system.mp3'),
          path.join(__dirname, '../public/system.wav'),
          // Fallback to notification.* if system.* not found
          path.join(__dirname, '../public/notification.mp3'),
          path.join(__dirname, '../public/notification.wav'),
        ]

    return candidates.find(p => fs.existsSync(p)) || null
  } catch {
    return null
  }
}

function hasCustomSoundAvailable(type = 'main') {
  const p = getSoundPath(type)
  return !!(p && soundPlay && typeof soundPlay.play === 'function')
}

function playCustomNotificationSound(type = 'main') {
  try {
    const soundPath = getSoundPath(type)
    if (soundPath && soundPlay && typeof soundPlay.play === 'function') {
      // Fire and forget; do not await to keep UI responsive
      soundPlay.play(soundPath).catch(() => {
        // Fallback to system beep if playback fails
        try { shell.beep(); } catch {}
      });
    } else {
      // No file or library available; fallback to system beep
      try { shell.beep(); } catch {}
    }
  } catch {
    try { shell.beep(); } catch {}
  }
}


// Function to create a red badge with count
async function createBadgeImage(count) {
  try {
    const sharp = require('sharp');
    
    // Create a 24x24 red circle with white text
    const countText = count > 9 ? '9+' : count.toString();
    
    // Create SVG for the badge
    const svg = `
      <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="#ffffff" stroke-width="1"/>
        <text x="12" y="12" text-anchor="middle" dominant-baseline="middle" 
              font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white">${countText}</text>
      </svg>
    `;
    
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    return buffer;
  } catch (error) {
    console.error('Sharp not available, using fallback:', error);
    return null;
  }
}

// Function to save badge image to temp file
async function saveBadgeImage(count) {
  try {
    const badgeBuffer = await createBadgeImage(count);
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
async function getSimpleBadgePath() {
  try {
    const sharp = require('sharp');
    
    // Create SVG for simple red dot
    const svg = `
      <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" fill="#dc2626" stroke="#ffffff" stroke-width="1"/>
      </svg>
    `;
    
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    const badgePath = path.join(__dirname, '../temp/red-dot.png');
    
    // Ensure temp directory exists
    const tempDir = path.dirname(badgePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(badgePath, buffer);
    return badgePath;
  } catch (error) {
    console.error('Error creating simple badge:', error);
    return null;
  }
}

// Function to ensure notification sound plays consistently
function createNotificationWithSound(title, body, icon, type = 'main') {
  return new Promise((resolve) => {
    const useCustom = hasCustomSoundAvailable(type);
    const notification = new Notification({
      title: title,
      body: body,
      icon: icon,
      silent: useCustom, // Mute OS sound if we play our own
      timeoutType: 'never'
    });

    // Show notification
    notification.show();
    // Also play custom sound if available
    if (useCustom) {
      playCustomNotificationSound(type);
    }
    resolve(notification);
  });
}

// Function to update badge count on app icon and tray
async function updateBadgeCount(count) {
  // Use the count passed from the renderer process directly
  // This is more reliable than trying to get it from the browser context
  const finalCount = count || 0;
  
  notificationBadgeCount = finalCount;
  
  // Update app icon badge (Windows)
  if (mainWindow && process.platform === 'win32') {
    if (finalCount > 0) {
      try {
        // Force create and use our custom red badge with count
        const badgePath = await saveBadgeImage(finalCount);
        
        if (badgePath && fs.existsSync(badgePath)) {
          // Use our custom red badge image with count
          mainWindow.setOverlayIcon(badgePath, `${finalCount} notifications`);
        } else {
          // If custom badge creation fails, try simple red dot
          const simpleBadgePath = await getSimpleBadgePath();
          
          if (simpleBadgePath && fs.existsSync(simpleBadgePath)) {
            mainWindow.setOverlayIcon(simpleBadgePath, `${finalCount} notifications`);
          } 
        }
        
      } catch (error) {
        console.error('Error setting Windows badge:', error);
      }
    } else {
      try {
        // Clear the overlay icon completely
        mainWindow.setOverlayIcon(null, '');
      } catch (error) {
        console.error('Error clearing Windows badge:', error);
      }
    }
  } else if (process.platform === 'darwin') {
    // macOS badge - show actual count
    try {
      app.setBadgeCount(finalCount);
    } catch (error) {
      console.error('Error setting macOS badge:', error);
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
    return;
  }
  
  // Use ShoreAgents logo for notifications
  const notificationIcon = path.join(__dirname, '../public/ShoreAgents-Logo-only.png');
  
  const useCustom = hasCustomSoundAvailable('main');
  const notification = new Notification({
    title: notificationData.title || 'ShoreAgents Dashboard',
    body: notificationData.message || 'You have a new notification',
    icon: notificationIcon,
    silent: useCustom,
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
  // Play custom sound if available
  if (useCustom) {
    playCustomNotificationSound('main');
  }
  
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
      path.join(__dirname, '../public/ShoreAgents-Logo-only.png'),
      'inactivity'
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error showing inactivity notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-inactivity-notification', async (event, data) => {
  try {
    // Check if we should skip notification update (e.g., if in meeting)
    if (data.skipUpdate) {
      return { success: true };
    }
    
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
          path.join(__dirname, '../public/ShoreAgents-Logo-only.png'),
          'inactivity'
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
    
    // Update the notification badge count immediately
    notificationBadgeCount = count;
    
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
    icon: path.join(__dirname, '../public/ShoreAgents-Logo-only.png'),
    show: false, // Don't show until ready
    titleBarStyle: 'hidden',
    frame: false,
    autoHideMenuBar: true
  });

  // Load the app - always use the Next.js server
  const serverUrl = process.env.ELECTRON_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';
  mainWindow.loadURL(serverUrl);
  
  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Add keyboard shortcuts for DevTools and other common shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Ctrl+Shift+I for DevTools
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      event.preventDefault();
    }
    
    // F12 for DevTools (alternative)
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      event.preventDefault();
    }

    // Ctrl+R for reload (only in development)
    if (isDev && input.control && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }

    // Ctrl+Shift+R for hard reload (only in development)
    if (isDev && input.control && input.shift && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reloadIgnoringCache();
      event.preventDefault();
    }

    // Ctrl+Plus/Minus for zoom (only in development)
    if (isDev && input.control && (input.key === '+' || input.key === '=')) {
      const currentZoom = mainWindow.webContents.getZoomFactor();
      mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
      event.preventDefault();
    }

    if (isDev && input.control && input.key === '-') {
      const currentZoom = mainWindow.webContents.getZoomFactor();
      mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
      event.preventDefault();
    }

    // Ctrl+0 to reset zoom (only in development)
    if (isDev && input.control && input.key === '0') {
      mainWindow.webContents.setZoomFactor(1.0);
      event.preventDefault();
    }
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize activity tracker after window is ready
    try {
      activityTracker = new ActivityTracker(mainWindow);
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
  
  // Handle window focus - clear notifications if user is not authenticated
  mainWindow.on('focus', async () => {
    try {
      const authState = await checkUserLoggedIn();
      if (!authState.isLoggedIn && notificationBadgeCount > 0) {
        clearAllSystemNotifications();
        notificationBadgeCount = 0;
        
        // Clear app icon badge (Windows)
        if (process.platform === 'win32') {
          mainWindow.setOverlayIcon(null, '');
        }
        
        // Clear dock badge (macOS)
        if (process.platform === 'darwin') {
          app.setBadgeCount(0);
        }
        
        // Update tray icon
        if (tray) {
          const noNotificationIconPath = createTrayIconWithIndicator(0);
          if (noNotificationIconPath) {
            tray.setImage(noNotificationIconPath);
          }
          tray.setToolTip('ShoreAgents Dashboard');
        }
      }
    } catch (error) {
      console.error('Error checking auth state on window focus:', error);
    }
  });
}

// Create system tray
async function createTray() {
  // Create initial tray icon with no notifications
  const initialTrayIconPath = await createTrayIconWithIndicator(0);
  const trayIconPath = initialTrayIconPath || path.join(__dirname, '../public/ShoreAgents-Logo-only.png');
  
  tray = new Tray(trayIconPath);
  
  // Initial context menu
  updateTrayMenu();
  
  tray.setToolTip('ShoreAgents Dashboard');
  
  // Set up periodic check for notification count sync and auth state
  setInterval(async () => {
    if (tray && mainWindow && !mainWindow.isDestroyed()) {
      // Check authentication state and clear notifications if not logged in
      const authState = await checkUserLoggedIn();
      if (!authState.isLoggedIn && notificationBadgeCount > 0) {
        clearAllSystemNotifications();
        notificationBadgeCount = 0;
        
        // Clear app icon badge (Windows)
        if (mainWindow && process.platform === 'win32') {
          mainWindow.setOverlayIcon(null, '');
        }
        
        // Clear dock badge (macOS)
        if (process.platform === 'darwin') {
          app.setBadgeCount(0);
        }
        
        // Update tray icon
        const noNotificationIconPath = createTrayIconWithIndicator(0);
        if (noNotificationIconPath) {
          tray.setImage(noNotificationIconPath);
        }
        tray.setToolTip('ShoreAgents Dashboard');
      }
      
      // Update notification count
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
async function createTrayIconWithIndicator(count) {
  try {
    const sharp = require('sharp');
    
    // Load the ShoreAgents logo
    const logoPath = path.join(__dirname, '../public/ShoreAgents-Logo-only.png');
    
    if (!fs.existsSync(logoPath)) {
      console.error('ShoreAgents logo not found at:', logoPath);
      return null;
    }
    
    // Load and resize the logo to 32x32 for tray icon
    const logoBuffer = await sharp(logoPath)
      .resize(32, 32)
      .png()
      .toBuffer();
    
    // If there are notifications, add a red dot overlay
    if (count > 0) {
      // Create a red dot overlay (bigger size)
      const redDotSvg = `
        <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="26" cy="6" r="8" fill="#ef4444" stroke="#ffffff" stroke-width="1"/>
        </svg>
      `;
      
      const redDotBuffer = await sharp(Buffer.from(redDotSvg))
        .png()
        .toBuffer();
      
      // Composite the red dot over the logo
      const finalBuffer = await sharp(logoBuffer)
        .composite([{ input: redDotBuffer, blend: 'over' }])
        .png()
        .toBuffer();
      
      const trayIconPath = path.join(__dirname, `../temp/tray-icon-${count}.png`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(trayIconPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(trayIconPath, finalBuffer);
      return trayIconPath;
    } else {
      // No notifications, just use the logo
      const trayIconPath = path.join(__dirname, `../temp/tray-icon-${count}.png`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(trayIconPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(trayIconPath, logoBuffer);
      return trayIconPath;
    }
  } catch (error) {
    console.error('Error creating tray icon with indicator:', error);
    return null;
  }
}

// Function to update tray with red indicator
async function updateTrayWithRedIndicator(count) {
  if (!tray) return;
  
  try {
    // Create tray icon with red indicator
    const trayIconPath = await createTrayIconWithIndicator(count);
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
            // Check if we have the notification service available in the global scope
            if (typeof window !== 'undefined' && window.getUnreadCount) {
              return window.getUnreadCount();
            }
            
            // Fallback to localStorage check
            const user = JSON.parse(localStorage.getItem('shoreagents-auth') || '{}')?.user;
            if (!user) return 0;
            
            const key = 'shoreagents-notifications-' + user.email;
            const stored = localStorage.getItem(key);
            if (!stored) return 0;
            
            const data = JSON.parse(stored);
            return data.notifications ? data.notifications.filter(n => !n.read).length : 0;
          } catch (error) {
            console.error('Error getting notification count from browser:', error);
            return 0;
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
    // Use the stored notification count instead of trying to get it from browser
    const actualCount = notificationBadgeCount || 0;
    
    // Create tray icon with the actual count
    const trayIconPath = await createTrayIconWithIndicator(actualCount);
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

// Check if user is currently on break
async function checkUserOnBreak() {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      // Wait for the web contents to be ready
      if (!mainWindow.webContents.isLoading()) {
        // Get break state from renderer process
        const result = await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              // Check if there's an active break in localStorage
              const currentBreak = localStorage.getItem('currentBreak');
              if (currentBreak) {
                const breakData = JSON.parse(currentBreak);
                return {
                  isOnBreak: true,
                  breakType: breakData.break_type,
                  timeRemaining: breakData.time_remaining_seconds
                };
              }
              
              // Also check if break is active in the app state
              const breakActive = localStorage.getItem('shoreagents-break-active');
              if (breakActive === 'true') {
                return {
                  isOnBreak: true,
                  breakType: 'Active Break',
                  timeRemaining: null
                };
              }
              
              return { isOnBreak: false, breakType: null, timeRemaining: null };
            } catch (error) {
              return { isOnBreak: false, breakType: null, timeRemaining: null };
            }
          })()
        `);
        return result;
      }
    }
    return { isOnBreak: false, breakType: null, timeRemaining: null };
  } catch (error) {
    console.error('Error checking break state:', error);
    return { isOnBreak: false, breakType: null, timeRemaining: null };
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
    const breakState = await checkUserOnBreak();
    const isOnBreak = breakState.isOnBreak;
    
    // If user is not logged in, clear all notifications and badge count
    if (!isLoggedIn && notificationBadgeCount > 0) {
      clearAllSystemNotifications();
      notificationBadgeCount = 0;
      
      // Clear app icon badge (Windows)
      if (mainWindow && process.platform === 'win32') {
        mainWindow.setOverlayIcon(null, '');
      }
      
      // Clear dock badge (macOS)
      if (process.platform === 'darwin') {
        app.setBadgeCount(0);
      }
      
      // Update tray icon to remove notification indicator
      if (tray) {
        const initialTrayIconPath = createTrayIconWithIndicator(0);
        if (initialTrayIconPath) {
          tray.setImage(initialTrayIconPath);
        }
        tray.setToolTip('ShoreAgents Dashboard');
      }
    }
  
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
  }
  
  // Always add clear all notifications option (even if no notifications)
  baseMenuItems.push({
    label: 'Clear All Notifications',
    click: () => {
      // Clear system notifications (OS-level)
      clearAllSystemNotifications();
      
      // Also trigger frontend to clear application notifications
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clear-all-notifications');
      } 
    }
  });
  
  if (notificationBadgeCount > 0) {
    baseMenuItems.push({ type: 'separator' });
  }
  
  // Add navigation options only if logged in
  if (isLoggedIn) {
    // Add break status if user is on break
    if (isOnBreak) {
      const timeText = breakState.timeRemaining 
        ? `${Math.floor(breakState.timeRemaining / 60)}m ${breakState.timeRemaining % 60}s remaining`
        : '';
      baseMenuItems.push({
        label: `On ${breakState.breakType} Break${timeText ? ` - ${timeText}` : ''}`,
        enabled: false
      });
      baseMenuItems.push({
        label: 'Show Break Timer',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/breaks');
          }
        }
      });
      baseMenuItems.push({ type: 'separator' });
    }
    
    baseMenuItems.push(
      {
        label: 'Dashboard',
        enabled: !isOnBreak, // Disable when on break
        click: () => {
          if (mainWindow && !isOnBreak) {
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
        enabled: !isOnBreak, // Disable when on break
        click: () => {
          if (mainWindow && !isOnBreak) {
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
        enabled: !isOnBreak, // Disable when on break
        click: () => {
          if (mainWindow && !isOnBreak) {
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
      label: 'Logout && Quit',
      click: async () => {
        await handleLogoutAndQuit();
      }
    });
    
      // Update tooltip to show tracking is active and break status
      let baseTooltip = 'ShoreAgents Dashboard';
      if (isOnBreak) {
        const timeText = breakState.timeRemaining 
          ? `${Math.floor(breakState.timeRemaining / 60)}m ${breakState.timeRemaining % 60}s remaining`
          : '';
        baseTooltip = `ShoreAgents Dashboard - On ${breakState.breakType} Break${timeText ? ` (${timeText})` : ''}`;
      }
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
      buttons: ['Logout && Quit', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Confirm Logout',
      message: 'Logout and quit ShoreAgents Dashboard?',
      detail: 'This will stop activity tracking and log you out. Are you sure?',
      icon: path.join(__dirname, '../public/ShoreAgents-Logo-only.png')
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
app.whenReady().then(async () => {
  createWindow();
  // Remove menu completely
  Menu.setApplicationMenu(null);
  await createTray();
  
  // Check authentication state on app start and clear notifications if not logged in
  setTimeout(async () => {
    try {
      const authState = await checkUserLoggedIn();
      if (!authState.isLoggedIn && notificationBadgeCount > 0) {
        clearAllSystemNotifications();
        notificationBadgeCount = 0;
        
        // Clear app icon badge (Windows)
        if (mainWindow && process.platform === 'win32') {
          mainWindow.setOverlayIcon(null, '');
        }
        
        // Clear dock badge (macOS)
        if (process.platform === 'darwin') {
          app.setBadgeCount(0);
        }
        
        // Update tray icon
        if (tray) {
          const noNotificationIconPath = createTrayIconWithIndicator(0);
          if (noNotificationIconPath) {
            tray.setImage(noNotificationIconPath);
          }
          tray.setToolTip('ShoreAgents Dashboard');
        }
      }
    } catch (error) {
      console.error('Error checking auth state on app start:', error);
    }
  }, 2000); // Wait 2 seconds for window to be ready

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
  
  // Close black screen windows
  closeBlackScreenWindows();
  
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
  
  // Stop activity tracking on logout completion
  if (activityTracker) {
    activityTracker.stopTracking();
  }
  
  // Clear all system notifications
  clearAllSystemNotifications();
  
  // Reset notification badge count
  notificationBadgeCount = 0;
  
  // Clear app icon badge (Windows)
  if (mainWindow && process.platform === 'win32') {
    mainWindow.setOverlayIcon(null, '');
  }
  
  // Clear dock badge (macOS)
  if (process.platform === 'darwin') {
    app.setBadgeCount(0);
  }
  
  // Update tray icon to remove notification indicator
  if (tray) {
    const initialTrayIconPath = createTrayIconWithIndicator(0);
    if (initialTrayIconPath) {
      tray.setImage(initialTrayIconPath);
    }
    tray.setToolTip('ShoreAgents Dashboard');
  }
  
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
    // Stop activity tracking on logout
    if (activityTracker) {
      activityTracker.stopTracking();
    }
    
    // Clear all system notifications
    clearAllSystemNotifications();
    
    // Reset notification badge count
    notificationBadgeCount = 0;
    
    // Clear app icon badge (Windows)
    if (mainWindow && process.platform === 'win32') {
      mainWindow.setOverlayIcon(null, '');
    }
    
    // Clear dock badge (macOS)
    if (process.platform === 'darwin') {
      app.setBadgeCount(0);
    }
    
    // Update tray icon to remove notification indicator
    if (tray) {
      const initialTrayIconPath = createTrayIconWithIndicator(0);
      if (initialTrayIconPath) {
        tray.setImage(initialTrayIconPath);
      }
      tray.setToolTip('ShoreAgents Dashboard');
    }
    
    // Update tray menu
    await updateTrayMenu();
    
    return { success: true };
  } catch (error) {
    console.error('Error in user-logged-out handler:', error);
    return { success: false, error: error.message };
  }
});

// Secure credential storage using Electron's safeStorage
ipcMain.handle('store-credentials', async (event, { email, password }) => {
  try {
    const { safeStorage } = require('electron');
    
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Safe storage encryption not available, falling back to localStorage');
      return { success: false, error: 'Encryption not available' };
    }
    
    // Encrypt the password using the system keychain
    const encryptedPassword = safeStorage.encryptString(password);
    
    // Store encrypted credentials in app data directory
    const userDataPath = app.getPath('userData');
    const credentialsPath = path.join(userDataPath, 'secure-credentials.json');
    
    const credentials = {
      email,
      encryptedPassword: encryptedPassword.toString('base64'),
      timestamp: Date.now(),
      version: '1.0'
    };
    
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    
    return { success: true };
  } catch (error) {
    console.error('Error storing credentials:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-credentials', async (event) => {
  try {
    const { safeStorage } = require('electron');
    
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Safe storage encryption not available');
      return { success: false, error: 'Encryption not available' };
    }
    
    // Read encrypted credentials from app data directory
    const userDataPath = app.getPath('userData');
    const credentialsPath = path.join(userDataPath, 'secure-credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
      return { success: false, error: 'No credentials found' };
    }
    
    const credentialsData = fs.readFileSync(credentialsPath, 'utf8');
    const credentials = JSON.parse(credentialsData);
    
    // Decrypt the password
    const encryptedPassword = Buffer.from(credentials.encryptedPassword, 'base64');
    const decryptedPassword = safeStorage.decryptString(encryptedPassword);
    
    return {
      success: true,
      credentials: {
        email: credentials.email,
        password: decryptedPassword,
        timestamp: credentials.timestamp,
        version: credentials.version
      }
    };
  } catch (error) {
    console.error('Error getting credentials:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-credentials', async (event) => {
  try {
    const userDataPath = app.getPath('userData');
    const credentialsPath = path.join(userDataPath, 'secure-credentials.json');
    
    if (fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error clearing credentials:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for fullscreen functionality
ipcMain.handle('enter-fullscreen', () => {
  try {
    if (mainWindow) {
      // Hide menu bar and enter fullscreen
      mainWindow.setMenuBarVisibility(false);
      mainWindow.setFullScreen(true);
      
      // On Windows, also hide the taskbar by setting always on top
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      
      // Create black screen windows on secondary monitors FIRST
      const blackScreenResult = createBlackScreenWindows();
      
      // Wait a moment for black screens to stabilize, then set break active
      setTimeout(() => {
        setBreakActiveState(true);
      }, 1000);
      
      return { success: true, blackScreens: blackScreenResult };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error entering fullscreen:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('exit-fullscreen', () => {
  try {
    if (mainWindow) {
      // Restore window to normal state
      restoreWindowToNormalState();
      
      // Close black screen windows on secondary monitors
      const blackScreenResult = closeBlackScreenWindows();
      
      return { success: true, blackScreens: blackScreenResult };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error exiting fullscreen:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for multi-monitor management
ipcMain.handle('create-black-screens', () => {
  try {
    return createBlackScreenWindows();
  } catch (error) {
    console.error('Error in create-black-screens:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-black-screens', () => {
  try {
    return closeBlackScreenWindows();
  } catch (error) {
    console.error('Error in close-black-screens:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-monitor-info', () => {
  try {
    return getMonitorInfo();
  } catch (error) {
    console.error('Error in get-monitor-info:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for break monitoring
ipcMain.handle('set-break-active', (event, active) => {
  try {
    return setBreakActiveState(active);
  } catch (error) {
    console.error('Error in set-break-active:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to enable/disable kiosk mode
ipcMain.handle('set-kiosk-mode', (event, enabled) => {
  try {
    if (mainWindow) {
      if (enabled) {
        // Enable kiosk mode
        mainWindow.setKiosk(true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.setMenuBarVisibility(false);
        mainWindow.setAutoHideMenuBar(true);
        mainWindow.setClosable(false);
        mainWindow.setMinimizable(false);
        mainWindow.setMaximizable(false);
        mainWindow.setResizable(false);
      } else {
        // Disable kiosk mode
        mainWindow.setKiosk(false);
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setMenuBarVisibility(true);
        mainWindow.setAutoHideMenuBar(false);
        mainWindow.setClosable(true);
        mainWindow.setMinimizable(true);
        mainWindow.setMaximizable(true);
        mainWindow.setResizable(true);
      }
      return { success: true, kioskMode: enabled };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error setting kiosk mode:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-break-active', () => {
  try {
    return getBreakActiveState();
  } catch (error) {
    console.error('Error in get-break-active:', error);
    return { success: false, error: error.message };
  }
});

// Handle when user confirms they want to end break
ipcMain.handle('confirm-break-end-due-to-focus-loss', () => {
  try {
    if (breakActive) {
      // Close black screen windows
      const blackScreenResult = closeBlackScreenWindows();
      
      // Exit fullscreen and restore normal window state
      restoreWindowToNormalState();
      
      // Reset break state
      breakActive = false;
      
      return { success: true, blackScreens: blackScreenResult };
    }
    return { success: false, error: 'Break not active' };
  } catch (error) {
    console.error('Error in confirm-break-end-due-to-focus-loss:', error);
    return { success: false, error: error.message };
  }
});

// Handle when user wants to return to break (set cooldown)
ipcMain.handle('return-to-break', () => {
  try {
    if (breakActive) {
      // Set cooldown to prevent immediate re-triggering
      focusLossCooldown = true;
      
      // Clear any existing timeout
      if (focusLossCooldownTimeout) {
        clearTimeout(focusLossCooldownTimeout);
      }
      
      // Set cooldown for 3 seconds
      focusLossCooldownTimeout = setTimeout(() => {
        focusLossCooldown = false;
      }, 3000);
      
      // Force focus back to main window without changing window state
      if (mainWindow) {
        // Just focus the window without changing alwaysOnTop
        mainWindow.focus();
        
        // Ensure it's still in fullscreen and kiosk mode
        if (!mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(true);
        }
        if (!mainWindow.isKiosk()) {
          mainWindow.setKiosk(true);
        }
        
        // Ensure menu bar is hidden
        mainWindow.setMenuBarVisibility(false);
      }
      
      // RECREATE BLACK SCREEN WINDOWS ON SECONDARY MONITORS
      const blackScreenResult = createBlackScreenWindows();
      if (blackScreenResult.success) {
      } else {
        console.warn('Failed to recreate black screen windows:', blackScreenResult.error);
      }
      
      return { success: true, blackScreens: blackScreenResult };
    }
    return { success: false, error: 'Break not active' };
  } catch (error) {
    console.error('Error in return-to-break:', error);
    return { success: false, error: error.message };
  }
});

// Handle emergency escape from kiosk mode
ipcMain.handle('emergency-escape', () => {
  try {
    if (breakActive) {
      
      // Close black screen windows
      const blackScreenResult = closeBlackScreenWindows();
      
      // Exit kiosk mode and fullscreen
      restoreWindowToNormalState();
      
      // Reset break state
      breakActive = false;
      
      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('emergency-escape-pressed');
      }
      
      return { success: true, blackScreens: blackScreenResult };
    }
    return { success: false, error: 'Break not active' };
  } catch (error) {
    console.error('Error in emergency-escape:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for window controls
ipcMain.handle('window-minimize', () => {
  try {
    if (mainWindow) {
      mainWindow.minimize()
      return { success: true }
    }
    return { success: false, error: 'Main window not available' }
  } catch (error) {
    console.error('Error minimizing window:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('window-maximize', () => {
  try {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
      return { success: true, isMaximized: mainWindow.isMaximized() }
    }
    return { success: false, error: 'Main window not available' }
  } catch (error) {
    console.error('Error maximizing window:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('window-close', () => {
  try {
    if (mainWindow) {
      mainWindow.close()
      return { success: true }
    }
    return { success: false, error: 'Main window not available' }
  } catch (error) {
    console.error('Error closing window:', error)
    return { success: false, error: error.message }
  }
})

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
      
      // Check current state before stopping
      const wasTracking = activityTracker.isTracking;
      
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
    const useCustom = hasCustomSoundAvailable();
    const notification = new Notification({
      title: data.title || 'ShoreAgents Dashboard',
      body: data.body || 'Notification',
      icon: data.icon || path.join(__dirname, '../public/ShoreAgents-Logo-only.png'),
      silent: useCustom
    });
    
    notification.show();
    if (useCustom) {
      playCustomNotificationSound();
    }
  }
});

// App event handlers for proper cleanup
app.on('before-quit', () => {
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
});

app.on('suspend', () => {
});

app.on('resume', () => {
}); 