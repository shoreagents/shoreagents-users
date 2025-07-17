"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Play, 
  Pause, 
  X, 
  Clock, 
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { useBreak } from "@/contexts/break-context"
import { saveBreakTimerState, clearBreakTimerState } from "@/lib/break-storage"

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
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  savedTimeLeft?: number
  savedStartTime?: number
  savedPauseTime?: number
  emergencyPauseUsed?: boolean
}

export function BreakTimer({ breakInfo, onEnd, onPause, onResume, isPaused, savedTimeLeft, savedStartTime, savedPauseTime, emergencyPauseUsed }: BreakTimerProps) {
  // Calculate correct time remaining when resuming from pause
  const calculateTimeLeft = () => {
    // Use saved state if we're resuming a paused break
    if (savedTimeLeft && savedPauseTime && emergencyPauseUsed) {
      // Don't subtract time since pause - the timer should be frozen during pause
      return savedTimeLeft
    }
    return breakInfo.duration * 60 // Default to full duration for new breaks
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())
  const [isRunning, setIsRunning] = useState(true)
  const [hasPaused, setHasPaused] = useState(emergencyPauseUsed || false) // Use stored state or local state
  const [hasEnded, setHasEnded] = useState(false) // Track if end break was clicked
  const [showPauseWarning, setShowPauseWarning] = useState(false)
  const [startTime] = useState(savedStartTime || Date.now()) // Use saved start time or current time
  const Icon = breakInfo.icon
  const { setBreakActive } = useBreak()

  // Ensure hasPaused is properly set from emergencyPauseUsed
  useEffect(() => {
    if (emergencyPauseUsed) {
      setHasPaused(true)
    }
  }, [emergencyPauseUsed])

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
      setTimeLeft((prev) => {
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
  const handlePause = useCallback(() => {
    if (hasPaused) {
      setShowPauseWarning(true)
      setTimeout(() => setShowPauseWarning(false), 3000)
      return
    }

    setHasPaused(true)
    setIsRunning(false)
    onPause()
    // Save timer state with exact pause time
    const pauseTime = Date.now()
    saveBreakTimerState(breakInfo.id, timeLeft, startTime, pauseTime)
    // Return to breaks page when emergency pause is used
    onEnd()
  }, [hasPaused, onPause, onEnd, breakInfo.id, timeLeft, startTime])

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
        // Clear saved timer state when break ends naturally
        clearBreakTimerState(breakInfo.id)
        onEnd()
      }, 2000) // Give user 2 seconds to see completion
    }
  }, [timeLeft, onEnd, setBreakActive, breakInfo.id])

  // Handle end break
  const handleEndBreak = () => {
    setHasEnded(true)
    setBreakActive(false)
    // Clear saved timer state when break ends manually
    clearBreakTimerState(breakInfo.id)
    onEnd()
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
              
              <Progress value={progress} className="h-4 mb-6" />
              
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
    </div>
  )
} 