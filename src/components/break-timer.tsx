"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Play, 
  Pause, 
  X, 
  Clock, 
  AlertTriangle,
} from "lucide-react"
import { useBreak } from "@/contexts/break-context"

import { getCurrentBreak } from "@/lib/break-manager"

// Check if running in Electron environment
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
}

interface BreakInfo {
  id: string
  name: string
  duration: number
  startTime: string
  endTime: string
  icon: any
  description: string
  color: string
}

interface BreakTimerProps {
  breakInfo: BreakInfo
  onEnd: () => void
  onPause: (timeRemainingSeconds: number) => void
  onResume: () => void
  isPaused: boolean
  savedTimeLeft?: number
  savedStartTime?: number
  savedPauseTime?: number
  emergencyPauseUsed?: boolean
}

export function BreakTimer({ breakInfo, onEnd, onPause, onResume, isPaused, savedTimeLeft, savedStartTime, savedPauseTime, emergencyPauseUsed }: BreakTimerProps) {
  const router = useRouter()
  
  // Calculate correct time remaining when resuming from pause or reload
  const calculateTimeLeft = () => {
    const now = Date.now()
    
    // Check if this is a resumed break from localStorage with saved timer state
    const currentBreak = getCurrentBreak()
    if (currentBreak && currentBreak.time_remaining_seconds && !currentBreak.is_paused) {
      // If we have a recent update, use the saved time remaining
      if (currentBreak.last_updated) {
        const timeSinceUpdate = Math.floor((now - currentBreak.last_updated) / 1000)
        const adjustedTimeLeft = Math.max(0, currentBreak.time_remaining_seconds - timeSinceUpdate)
        return adjustedTimeLeft
      }
      return currentBreak.time_remaining_seconds
    }
    
    // If we have saved time left from a currently paused break, use it
    if (savedTimeLeft && emergencyPauseUsed && isPaused) {
      return savedTimeLeft
    }
    
    // If we have a saved start time (break was active when app closed/reloaded)
    if (savedStartTime) {
      const elapsedSeconds = Math.floor((now - savedStartTime) / 1000)
      const totalDurationSeconds = breakInfo.duration * 60
      const timeLeft = Math.max(0, totalDurationSeconds - elapsedSeconds)
      return timeLeft
    }
    
    // Default to full duration for completely new breaks
    return breakInfo.duration * 60
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())
  const [isRunning, setIsRunning] = useState(true)
  const [hasPaused, setHasPaused] = useState(emergencyPauseUsed || false) // Use stored state or local state
  const [hasEnded, setHasEnded] = useState(false) // Track if end break was clicked
  const [showPauseWarning, setShowPauseWarning] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [startTime] = useState(savedStartTime || Date.now()) // Use saved start time or current time
  const [blackScreensActive, setBlackScreensActive] = useState(false)
  const [showFocusLossDialog, setShowFocusLossDialog] = useState(false)
  const [showEmergencyEscapeDialog, setShowEmergencyEscapeDialog] = useState(false)
  const Icon = breakInfo.icon
  const { setBreakActive } = useBreak()

  // Function to close black screen windows
  const handleCloseBlackScreens = useCallback(async () => {
    if (!isElectron()) return;
    
    try {
      if (window.electronAPI?.multiMonitor?.closeBlackScreens) {
        const result = await window.electronAPI.multiMonitor.closeBlackScreens();
        
        if (result?.success) {
          setBlackScreensActive(false);
        } else {
          console.warn('Failed to close black screen windows:', result?.error);
        }
      }
    } catch (error) {
      console.error('Error closing black screen windows:', error);
    }
  }, []);

  // Function to create black screen windows
  const handleCreateBlackScreens = useCallback(async () => {
    if (!isElectron()) return;
    
    try {
      if (window.electronAPI?.multiMonitor?.createBlackScreens) {
        const result = await window.electronAPI.multiMonitor.createBlackScreens();
        
        if (result?.success) {
          setBlackScreensActive(true);
        } else {
          console.warn('Failed to create black screen windows:', result?.error);
        }
      }
    } catch (error) {
      console.error('Error creating black screen windows:', error);
    }
  }, []);

  // Function to handle focus loss confirmation
  const handleFocusLossConfirm = useCallback(async () => {
    try {
      if ((window.electronAPI as any)?.breakMonitoring?.confirmEndDueToFocusLoss) {
        const result = await (window.electronAPI as any).breakMonitoring.confirmEndDueToFocusLoss();
        if (result?.success) {
          setBreakActive(false);
          onEnd();
          setShowFocusLossDialog(false);
        }
      }
    } catch (error) {
      console.error('Error ending break due to focus loss:', error);
    }
  }, [onEnd, setBreakActive]);

  const handleFocusLossCancel = useCallback(async () => {
    setShowFocusLossDialog(false);
    
    try {
      // Call the return-to-break method to set cooldown and force focus
      if ((window.electronAPI as any)?.breakMonitoring?.returnToBreak) {
        const result = await (window.electronAPI as any).breakMonitoring.returnToBreak();
        if (result?.success) {
          
          // Check if black screen windows were recreated
          if (result.blackScreens?.success) {
            setBlackScreensActive(true);
          } else {
            console.warn('Failed to recreate black screen windows:', result.blackScreens?.error);
          }
        }
      }
    } catch (error) {
      console.error('Error returning to break:', error);
    }
  }, []);

  // Ensure hasPaused is properly set from emergencyPauseUsed
  useEffect(() => {
    if (emergencyPauseUsed) {
      setHasPaused(true)
    }
  }, [emergencyPauseUsed])

  // Check initial black screen state when component mounts
  useEffect(() => {
    if (!isElectron()) return;
    
    // Check if black screens are currently active by looking at the current break state
    const checkInitialBlackScreenState = async () => {
      try {
        // If we're in a break and not paused, black screens should be active
        if (!isPaused && timeLeft > 0) {
          setBlackScreensActive(true);
        }
      } catch (error) {
        console.error('Error checking initial black screen state:', error);
      }
    };
    
    checkInitialBlackScreenState();
  }, [isPaused, timeLeft]);

  // Setup break focus monitoring
  useEffect(() => {
    if (!isElectron()) return;

    const handleBreakFocusLost = () => {
      setShowFocusLossDialog(true);
    };

    const handleBreakMinimized = () => {
      setShowFocusLossDialog(true);
    };

    const handleBreakHidden = () => {
      setShowFocusLossDialog(true);
    };

    // Listen for focus loss events from main process
    if (window.electronAPI?.receive) {
      window.electronAPI.receive('break-focus-lost', handleBreakFocusLost);
      window.electronAPI.receive('break-minimized', handleBreakMinimized);
      window.electronAPI.receive('break-hidden', handleBreakHidden);
      window.electronAPI.receive('emergency-escape-pressed', () => {
        setShowEmergencyEscapeDialog(true);
      });
    }

    // Note: Break monitoring is now set active by the main process after fullscreen transition
    // No need to set it active here anymore

    return () => {
      // Set break as inactive when component unmounts
      if ((window.electronAPI as any)?.breakMonitoring?.setActive) {
        (window.electronAPI as any).breakMonitoring.setActive(false);
      }
    };
  }, []);

  // Prevent page reload during active break
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning && !hasEnded && timeLeft > 0) {
        e.preventDefault()
        e.returnValue = 'You have an active break timer running. Are you sure you want to leave?'
        return 'You have an active break timer running. Are you sure you want to leave?'
      }
    }

    const handleVisibilityChange = () => {
      // Page hidden during active break - timer continues in background
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block most keyboard input when break timer is active
      if (isRunning && !hasEnded && timeLeft > 0) {
        // Block common system shortcuts and navigation keys
        if (e.key === 'F5' || 
            e.key === 'F11' || 
            e.key === 'F12' ||
            e.key === 'Escape' ||
            e.key === 'Meta' || // Windows key
            e.key === 'Super' || // Windows key (alternative)
            e.key === 'OS' || // Windows key (alternative)
            (e.ctrlKey && e.key === 'r') || 
            (e.ctrlKey && e.shiftKey && e.key === 'R') ||
            (e.ctrlKey && e.key === 'w') ||
            (e.ctrlKey && e.key === 'q') ||
            (e.altKey && e.key === 'Tab') ||
            (e.altKey && e.key === 'F4') ||
            (e.metaKey && e.key === 'Tab') ||
            (e.metaKey && e.key === 'w') ||
            (e.metaKey && e.key === 'q') ||
            (e.metaKey && e.key === 'Space') || // Windows + Space
            (e.metaKey && e.key === 'D') || // Windows + D (show desktop)
            (e.metaKey && e.key === 'E') || // Windows + E (explorer)
            (e.metaKey && e.key === 'R') || // Windows + R (run)
            (e.metaKey && e.key === 'L') || // Windows + L (lock)
            (e.metaKey && e.key === 'M') || // Windows + M (minimize all)
            (e.metaKey && e.key === 'Shift') || // Windows + Shift
            (e.metaKey && e.key === 'Tab') || // Windows + Tab
            e.key === 'Tab' ||
            e.key === ' ' ||
            e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
        
        // Block arrow keys and navigation keys
        if (e.key === 'ArrowUp' || 
            e.key === 'ArrowDown' || 
            e.key === 'ArrowLeft' || 
            e.key === 'ArrowRight' ||
            e.key === 'Home' ||
            e.key === 'End' ||
            e.key === 'PageUp' ||
            e.key === 'PageDown') {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
        
        // Block Windows key and any Meta key combinations
        if (e.metaKey || e.key === 'Meta' || e.key === 'Super' || e.key === 'OS') {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
        
        // Block Alt+Tab and other Alt combinations
        if (e.altKey && (e.key === 'Tab' || e.key === 'F4' || e.key === 'Enter')) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
        
        // Block most other keys (allow only essential ones for accessibility)
        const allowedKeys = [
          // Keep minimal keys for emergency situations
          'Escape' // Allow escape for emergency exit (though blocked above, this is a fallback)
        ]
        
        if (!allowedKeys.includes(e.key)) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
      }
    }



    const handleKeyUp = (e: KeyboardEvent) => {
      // Block keyup events for blocked keys
      if (isRunning && !hasEnded && timeLeft > 0) {
        if (e.key === 'F5' || 
            e.key === 'F11' || 
            e.key === 'F12' ||
            e.key === 'Escape' ||
            e.key === 'Meta' || // Windows key
            e.key === 'Super' || // Windows key (alternative)
            e.key === 'OS' || // Windows key (alternative)
            (e.ctrlKey && e.key === 'r') || 
            (e.ctrlKey && e.shiftKey && e.key === 'R') ||
            (e.ctrlKey && e.key === 'w') ||
            (e.ctrlKey && e.key === 'q') ||
            (e.altKey && e.key === 'Tab') ||
            (e.altKey && e.key === 'F4') ||
            (e.metaKey && e.key === 'Tab') ||
            (e.metaKey && e.key === 'w') ||
            (e.metaKey && e.key === 'q') ||
            (e.metaKey && e.key === 'Space') || // Windows + Space
            (e.metaKey && e.key === 'D') || // Windows + D (show desktop)
            (e.metaKey && e.key === 'E') || // Windows + E (explorer)
            (e.metaKey && e.key === 'R') || // Windows + R (run)
            (e.metaKey && e.key === 'L') || // Windows + L (lock)
            (e.metaKey && e.key === 'M') || // Windows + M (minimize all)
            (e.metaKey && e.key === 'Shift') || // Windows + Shift
            (e.metaKey && e.key === 'Tab') || // Windows + Tab
            e.key === 'Tab' ||
            e.key === ' ' ||
            e.key === 'Enter' ||
            e.key === 'ArrowUp' || 
            e.key === 'ArrowDown' || 
            e.key === 'ArrowLeft' || 
            e.key === 'ArrowRight' ||
            e.key === 'Home' ||
            e.key === 'End' ||
            e.key === 'PageUp' ||
            e.key === 'PageDown') {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
      }
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      // Block keypress events for blocked keys
      if (isRunning && !hasEnded && timeLeft > 0) {
        if (e.key === 'F5' || 
            e.key === 'F11' || 
            e.key === 'F12' ||
            e.key === 'Escape' ||
            e.key === 'Meta' || // Windows key
            e.key === 'Super' || // Windows key (alternative)
            e.key === 'OS' || // Windows key (alternative)
            (e.ctrlKey && e.key === 'r') || 
            (e.ctrlKey && e.shiftKey && e.key === 'R') ||
            (e.ctrlKey && e.key === 'w') ||
            (e.ctrlKey && e.key === 'q') ||
            (e.altKey && e.key === 'Tab') ||
            (e.altKey && e.key === 'F4') ||
            (e.metaKey && e.key === 'Tab') ||
            (e.metaKey && e.key === 'w') ||
            (e.metaKey && e.key === 'q') ||
            (e.metaKey && e.key === 'Space') || // Windows + Space
            (e.metaKey && e.key === 'D') || // Windows + D (show desktop)
            (e.metaKey && e.key === 'E') || // Windows + E (explorer)
            (e.metaKey && e.key === 'R') || // Windows + R (run)
            (e.metaKey && e.key === 'L') || // Windows + L (lock)
            (e.metaKey && e.key === 'M') || // Windows + M (minimize all)
            (e.metaKey && e.key === 'ArrowDown') || // Windows + M (minimize all)
            (e.metaKey && e.key === 'Shift') || // Windows + Shift
            (e.metaKey && e.key === 'Tab') || // Windows + Tab
            e.key === 'Tab' ||
            e.key === ' ' ||
            e.key === 'Enter' ||
            e.key === 'ArrowUp' || 
            e.key === 'ArrowDown' || 
            e.key === 'ArrowLeft' || 
            e.key === 'ArrowRight' ||
            e.key === 'Home' ||
            e.key === 'End' ||
            e.key === 'PageUp' ||
            e.key === 'PageDown') {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('keypress', handleKeyPress)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [isRunning, hasEnded, timeLeft])

  // Save timer state to localStorage periodically
  useEffect(() => {
    if (isRunning && !hasEnded && timeLeft > 0) {
      const saveTimerState = () => {
        const currentBreak = getCurrentBreak()
        if (currentBreak) {
          // Update the current break with current timer state
          const updatedBreak = {
            ...currentBreak,
            time_remaining_seconds: timeLeft,
            start_time: startTime,
            last_updated: Date.now()
          }
          localStorage.setItem('currentBreak', JSON.stringify(updatedBreak))
        }
      }

      // Save state every 5 seconds
      const interval = setInterval(saveTimerState, 5000)
      
      // Also save when component unmounts
      return () => {
        clearInterval(interval)
        saveTimerState()
      }
    }
  }, [isRunning, hasEnded, timeLeft, startTime])

  // Update timeLeft when resuming from pause with saved state
  useEffect(() => {
    if (savedTimeLeft && savedPauseTime && emergencyPauseUsed) {
      // Don't subtract time since pause - the timer should be frozen during pause
      setTimeLeft(savedTimeLeft)
    }
  }, [savedTimeLeft, savedPauseTime, emergencyPauseUsed])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = ((breakInfo.duration * 60 - timeLeft) / (breakInfo.duration * 60)) * 100

  // Timer effect
  useEffect(() => {
    if (!isRunning || isPaused) return

    const interval = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          setIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isPaused])

  // Handle pause button click
  const handlePause = useCallback(async () => {
    if (hasPaused) {
      setShowPauseWarning(true)
      setTimeout(() => setShowPauseWarning(false), 3000)
      return
    }

    setHasPaused(true)
    setIsRunning(false)
    
    try {
      // Close black screen windows when pausing
      if (isElectron()) {
        await handleCloseBlackScreens();
        
        // Disable break monitoring when pausing
        if ((window.electronAPI as any)?.breakMonitoring?.setActive) {
          await (window.electronAPI as any).breakMonitoring.setActive(false);
        }
      }
      
      // Call the database pause API - this should NOT end the break
      await onPause(timeLeft) // Pass remaining time in seconds to database
      
      
      // Return to breaks page WITHOUT ending the break session  
      // The break should remain active but paused in database
      router.push('/status/breaks') // Navigate specifically to breaks page
      
    } catch (error) {
      console.error('Failed to pause break:', error)
      // If pause fails, continue with break
      setHasPaused(false)
      setIsRunning(true)
    }
  }, [hasPaused, onPause, timeLeft, handleCloseBlackScreens, router])

  // Handle resume - this should restore the timer from where it was paused
  const handleResume = async () => {
    setIsRunning(true)
    onResume()
    
    // Recreate black screen windows when resuming
    if (isElectron()) {
      await handleCreateBlackScreens();
      
      // Re-enable break monitoring when resuming
      if ((window.electronAPI as any)?.breakMonitoring?.setActive) {
        await (window.electronAPI as any).breakMonitoring.setActive(true);
      }
    }
    
    // Don't clear the saved state - we want to restore from where it was paused
    // The useEffect above will handle updating timeLeft from saved state
  }

  // Enter fullscreen and manage multi-monitor when break starts (only in Electron)
  useEffect(() => {
    if (!isElectron()) return;

    const enterFullscreen = async () => {
      try {
        // Enable kiosk mode first
        if (window.electronAPI?.kioskMode?.enable) {
          await window.electronAPI.kioskMode.enable();
        }
        
        // Then enter fullscreen
        if (window.electronAPI?.fullscreen?.enter) {
          const result = await window.electronAPI.fullscreen.enter();
          
          // Check if black screen windows were created successfully
          if (result?.blackScreens?.success) {
            setBlackScreensActive(true);
          } else if (result?.blackScreens?.error) {
            console.warn('Black screen windows creation had issues:', result.blackScreens.error);
          }
        }
      } catch (error) {
        console.error('Failed to enter fullscreen:', error);
      }
    };

    // Enter fullscreen when component mounts (break is active)
    enterFullscreen();

    // Exit fullscreen when component unmounts
    return () => {
      const exitFullscreen = async () => {
        try {
          // Exit fullscreen first
          if (window.electronAPI?.fullscreen?.exit) {
            const result = await window.electronAPI.fullscreen.exit();
            
            // Check if black screen windows were closed successfully
            if (result?.blackScreens?.success) {
              setBlackScreensActive(false);
            } else if (result?.blackScreens?.error) {
              console.warn('Black screen windows closure had issues:', result.blackScreens.error);
            }
          }
          
          // Disable kiosk mode
          if (window.electronAPI?.kioskMode?.disable) {
            await window.electronAPI.kioskMode.disable();
          }
        } catch (error) {
          console.error('Failed to exit fullscreen:', error);
        }
      };
      exitFullscreen();
    };
  }, []);

  // Auto-end when timer reaches zero
  useEffect(() => {
    if (timeLeft === 0) {
      setTimeout(async () => {
        // Close black screen windows when break automatically ends
        if (isElectron()) {
          await handleCloseBlackScreens();
          
          // Disable break monitoring when break automatically ends
          if ((window.electronAPI as any)?.breakMonitoring?.setActive) {
            await (window.electronAPI as any).breakMonitoring.setActive(false);
          }
        }
        
        setBreakActive(false)
        onEnd()
      }, 2000) // Give user 2 seconds to see completion
    }
  }, [timeLeft, onEnd, setBreakActive, breakInfo.id, handleCloseBlackScreens])

  // Handle end break confirmation
  const handleEndBreak = () => {
    setShowEndConfirm(true)
  }

  // Confirm end break
  const confirmEndBreak = async () => {
    setHasEnded(true)
    setBreakActive(false)
    
    // Close black screen windows when ending break
    if (isElectron()) {
      await handleCloseBlackScreens();
      
      // Disable break monitoring when ending break
      if ((window.electronAPI as any)?.breakMonitoring?.setActive) {
        await (window.electronAPI as any).breakMonitoring.setActive(false);
      }
    }
    
    onEnd()
    setShowEndConfirm(false)
  }

  // Cancel end break
  const cancelEndBreak = () => {
    setShowEndConfirm(false)
  }



  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <div className="w-full h-full flex items-center justify-center">
        <Card className="border-2 border-primary/20 w-full h-full max-w-none max-h-none m-0 rounded-none">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/shoreagents-logo.png"
                alt="ShoreAgents"
                width={64}
                height={64}
                className="h-12 sm:h-16 object-contain"
                priority
              />
            </div>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className={`p-4 rounded-full ${breakInfo.color} text-white`}>
                <Icon className="h-12 w-12" />
              </div>
              <div>
                <CardTitle className="text-4xl sm:text-5xl font-bold leading-tight">{breakInfo.name}</CardTitle>
                <p className="text-lg text-muted-foreground">{breakInfo.description}</p>
              </div>
            </div>
            
            {isPaused && (
              <Badge variant="secondary" className="w-fit mx-auto mb-4">
                <Pause className="mr-2 h-4 w-4" />
                Paused - Emergency Break
              </Badge>
            )}
            

            

          </CardHeader>

          <CardContent className="space-y-8 flex-1 flex flex-col justify-center">
            {/* Timer Display */}
            <div className="text-center flex-1 flex flex-col justify-center">
              <div className="font-mono font-bold text-primary  text-[clamp(8rem,20vw,20rem)]">
                {formatTime(timeLeft)}
              </div>
              
              <div className="relative mb-6">
                <div className="w-full h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-200">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      progress >= 90 
                        ? 'bg-gradient-to-r from-green-400 to-green-500 animate-pulse shadow-lg shadow-green-200' 
                        : progress >= 75 
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 shadow-md shadow-yellow-200' 
                        : 'bg-gradient-to-r from-primary to-primary/80 shadow-sm shadow-primary/20'
                    }`}
                    style={{ 
                      width: `${progress}%`,
                      transition: 'width 1s ease-out, box-shadow 0.3s ease-out'
                    }}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-lg text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>
                  {Math.floor(progress)}% complete • {Math.floor(timeLeft / 60)}m {timeLeft % 60}s remaining
                </span>
              </div>
            </div>

            {showPauseWarning && (
              <div className="text-center p-6 bg-orange-50 border border-orange-200 rounded-lg mb-6">
                <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                <p className="text-orange-800 font-medium text-xl">Pause already used!</p>
                <p className="text-orange-600 text-lg">Only one pause attempt allowed per break.</p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-6 justify-center mb-8">
              {isPaused && !hasEnded ? (
                <Button onClick={handleResume} size="lg" className="flex-1 max-w-xs text-lg px-8 py-4">
                  <Play className="mr-3 h-6 w-6" />
                  Resume Break
                </Button>
              ) : (
                <Button 
                  onClick={handlePause} 
                  variant="outline" 
                  size="lg" 
                  className="flex-1 max-w-xs text-lg px-8 py-4"
                  disabled={hasPaused}
                >
                  <Pause className="mr-3 h-6 w-6" />
                  {hasPaused ? 'Emergency Pause Used' : 'Emergency Pause'}
                </Button>
              )}
              
              <Button 
                onClick={handleEndBreak} 
                variant="destructive" 
                size="lg" 
                className="flex-1 max-w-xs text-lg px-8 py-4"
                disabled={hasEnded}
              >
                <X className="mr-3 h-6 w-6" />
                {hasEnded ? 'Break Ended' : 'End Break'}
              </Button>
            </div>




            {/* Break Info */}
            <div className="text-center text-base text-muted-foreground">
              <p>This break will automatically end when the timer reaches zero.</p>
              {hasPaused && (
                <p className="mt-2 text-orange-600">
                  Emergency pause has been used for this break.
                </p>
              )}

            </div>
          </CardContent>
        </Card>
      </div>

      {/* End Break Confirmation Dialog */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              End Break Early?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to end this {breakInfo.name.toLowerCase()} early? 
              This action cannot be undone and the break will be marked as completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelEndBreak}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmEndBreak}>
              <X className="mr-2 h-4 w-4" />
              End Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Focus Loss Confirmation Dialog */}
      <Dialog open={showFocusLossDialog} onOpenChange={setShowFocusLossDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Break Interrupted
            </DialogTitle>
            <DialogDescription>
              You've switched away from your break timer or tried to create/switch virtual desktops. 
              This will end your current break session. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleFocusLossCancel}>
              Return to Break
            </Button>
            <Button variant="destructive" onClick={handleFocusLossConfirm}>
              <X className="mr-2 h-4 w-4" />
              End Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Escape Dialog */}
      <Dialog open={showEmergencyEscapeDialog} onOpenChange={setShowEmergencyEscapeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Emergency Exit Requested
            </DialogTitle>
            <DialogDescription>
              You've pressed the Escape key to request an emergency exit from kiosk mode. 
              This will end your current break session. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEmergencyEscapeDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={async () => {
              setShowEmergencyEscapeDialog(false);
              // Exit kiosk mode and end break
              if (isElectron()) {
                await handleCloseBlackScreens();
                if ((window.electronAPI as any)?.breakMonitoring?.setActive) {
                  await (window.electronAPI as any).breakMonitoring.setActive(false);
                }
              }
              setBreakActive(false);
              onEnd();
            }}>
              <X className="mr-2 h-4 w-4" />
              Emergency Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 