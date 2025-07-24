"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  CheckCircle
} from "lucide-react"
import { useBreak } from "@/contexts/break-context"

import { getCurrentBreak } from "@/lib/break-manager"

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
  const Icon = breakInfo.icon
  const { setBreakActive } = useBreak()

  // Ensure hasPaused is properly set from emergencyPauseUsed
  useEffect(() => {
    if (emergencyPauseUsed) {
      setHasPaused(true)
    }
  }, [emergencyPauseUsed])

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
      // Prevent F5, Ctrl+R, Ctrl+Shift+R (hard refresh) silently
      if (isRunning && !hasEnded && timeLeft > 0) {
        if (e.key === 'F5' || 
            (e.ctrlKey && e.key === 'r') || 
            (e.ctrlKey && e.shiftKey && e.key === 'R')) {
          e.preventDefault()
          e.stopPropagation()
          return false
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('keydown', handleKeyDown)
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
      // Call the database pause API - this should NOT end the break
      await onPause(timeLeft) // Pass remaining time in seconds to database
      
      // Pause break via API
      const pauseTime = Date.now()
      
      // Return to breaks page WITHOUT ending the break session  
      // The break should remain active but paused in database
      router.push('/breaks') // Navigate specifically to breaks page
      
    } catch (error) {
      console.error('Failed to pause break:', error)
      // If pause fails, continue with break
      setHasPaused(false)
      setIsRunning(true)
    }
  }, [hasPaused, onPause, breakInfo.id, timeLeft, startTime])

  // Handle resume - this should restore the timer from where it was paused
  const handleResume = () => {
    setIsRunning(true)
    onResume()
    // Don't clear the saved state - we want to restore from where it was paused
    // The useEffect above will handle updating timeLeft from saved state
  }

  // Auto-end when timer reaches zero
  useEffect(() => {
    if (timeLeft === 0) {
      setTimeout(() => {
        setBreakActive(false)
        onEnd()
      }, 2000) // Give user 2 seconds to see completion
    }
  }, [timeLeft, onEnd, setBreakActive, breakInfo.id])

  // Handle end break confirmation
  const handleEndBreak = () => {
    setShowEndConfirm(true)
  }

  // Confirm end break
  const confirmEndBreak = () => {
    setHasEnded(true)
    setBreakActive(false)
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
          <CardHeader className="text-center pb-6 pt-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={`p-3 rounded-full ${breakInfo.color} text-white`}>
                <Icon className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-3xl">{breakInfo.name}</CardTitle>
                <p className="text-muted-foreground">{breakInfo.description}</p>
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
              <div className="text-[12rem] font-mono font-bold text-primary mb-8">
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

            {/* Status Messages */}
            {timeLeft === 0 && (
              <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg mb-6">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-green-800 font-medium text-xl">Break completed!</p>
                <p className="text-green-600 text-lg">Returning to dashboard...</p>
              </div>
            )}

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
    </div>
  )
} 