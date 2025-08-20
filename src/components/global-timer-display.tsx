"use client"

import { useEffect, useState } from 'react'
import { useTimer } from '@/contexts/timer-context'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, Pause, Clock, RotateCcw } from 'lucide-react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { usePathname } from 'next/navigation'
import { useMeeting } from '@/contexts/meeting-context'
import { useShiftResetTimer } from '@/hooks/use-shift-reset-timer'
import { parseShiftTime } from '@/lib/shift-utils'

export function GlobalTimerDisplay() {
  const [isVisible, setIsVisible] = useState(true)
  const pathname = usePathname()
  const { 
    timerData, 
    connectionStatus, 
    error, 
    isAuthenticated,
    liveActiveSeconds,
    liveInactiveSeconds,
    isBreakActive,
    breakStatus,
    shiftInfo
  } = useTimer()
  const { isInMeeting } = useMeeting()
  const { 
    timeUntilResetFormatted, 
    resetType, 
    isLoading: isShiftLoading,
    error: shiftError
  } = useShiftResetTimer()

  // Persist expand/collapse state in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sa-global-timer-visible')
      if (stored !== null) {
        setIsVisible( stored === 'true')
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sa-global-timer-visible', isVisible ? 'true' : 'false')
    } catch {}
  }, [isVisible])

  // Utility function to format seconds into readable time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  // Check if shift has ended
  const isShiftEnded = () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return false

      // Get current Philippines time
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      
      // Check if we have shift info from timer context
      if (shiftInfo?.endTime) {
        const shiftEndDate = new Date(shiftInfo.endTime)
        return nowPH > shiftEndDate
      }

      // Fallback: try to parse from shift time string if available
      if (shiftInfo?.time) {
        const parsed = parseShiftTime(shiftInfo.time, nowPH)
        if (parsed?.endTime) {
          return nowPH > parsed.endTime
        }
      }

      return false
    } catch (error) {
      return false
    }
  }

  const shiftEnded = isShiftEnded()

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return 'Error'
      default:
        return 'Disconnected'
    }
  }

  // Check if user is authenticated and logged in
  const currentUser = getCurrentUser()
  const isEmergencyPaused = !!(isBreakActive && breakStatus?.is_paused)
  
  // Don't show timer on login page or if not authenticated
  if (pathname === '/login' || pathname === '/' || !isAuthenticated || !currentUser) {
    return null
  }

  return (
    <>
      {/* Toggle Button - Always visible */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          size="sm"
          className={`backdrop-blur-sm shadow-lg border rounded-full w-10 h-10 p-0 ${
            isVisible
              ? 'bg-card border-border text-foreground'
              : isEmergencyPaused
                ? 'bg-green-100 dark:bg-green-950/20 border-green-300 dark:border-green-900/40'
                : isBreakActive
                  ? 'bg-yellow-100 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-900/40'
                  : timerData?.isActive
                    ? 'bg-green-100 dark:bg-green-950/20 border-green-300 dark:border-green-900/40'
                    : 'bg-red-100 dark:bg-red-950/20 border-red-300 dark:border-red-900/40'
          }`}
          title={isVisible ? "Collapse Timer" : "Expand Timer"}
        >
          {isVisible ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
                         <div className="relative">
               <ChevronUp className="w-4 h-4" />
               <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                 isEmergencyPaused
                   ? 'bg-green-500'
                   : isBreakActive 
                     ? 'bg-yellow-500' 
                     : timerData?.isActive 
                       ? 'bg-green-500' 
                       : 'bg-red-500'
               } animate-pulse`}></div>
             </div>
          )}
        </Button>
      </div>

      {/* Timer Display - Conditionally visible */}
      {isVisible && (
        <div className="fixed bottom-4 right-16 bg-card text-foreground rounded-lg shadow-lg border border-border p-4 min-w-[300px] z-50">
          {connectionStatus === 'connecting' && (
            <div className="absolute inset-0 bg-background/90 rounded-lg flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
                Reconnecting...
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Global Activity Timer</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></span>
              <span className="text-xs text-muted-foreground">{getConnectionStatusText()}</span>
            </div>
          </div>

          {timerData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <span className="text-xs text-muted-foreground">Status:</span>
                                   <span className={`px-2 py-1 rounded text-xs font-medium ${
                    shiftEnded
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-300'
                      : isInMeeting
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300'
                      : isBreakActive && breakStatus?.is_paused
                      ? 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-300'
                      : isBreakActive
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300'
                      : timerData.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-300'
                  }`}>
                    {shiftEnded
                      ? 'Shift Ended'
                      : isInMeeting
                      ? 'In Meeting'
                      : isBreakActive && breakStatus?.is_paused
                      ? 'Emergency Pause'
                      : isBreakActive 
                      ? (breakStatus?.break_type ? `${breakStatus.break_type} Break` : 'On Break')
                      : (timerData.isActive ? 'Active' : 'Inactive')
                    }
                  </span>
               </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className={`p-2 rounded ${isBreakActive || isInMeeting ? 'bg-muted' : 'bg-green-50 dark:bg-green-950/20'}`}>
                   <div className={`text-xs font-medium ${isBreakActive || isInMeeting ? 'text-muted-foreground' : 'text-green-700 dark:text-green-400'}`}>
                     Active
                   </div>
                   <div className={`text-lg font-bold ${isBreakActive || isInMeeting ? 'text-muted-foreground' : 'text-green-600 dark:text-green-400'}`}>
                     {formatTime(liveActiveSeconds)}
                   </div>
                                       {shiftEnded ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        Shift Ended
                      </div>
                    ) : timerData.isActive && !isBreakActive && !isInMeeting && (
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                        Counting...
                      </div>
                    )}
                    {isBreakActive && !breakStatus?.is_paused && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        On Break
                      </div>
                    )}
                    {isBreakActive && breakStatus?.is_paused && (
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                        Emergency Pause - Counting
                      </div>
                    )}
                    {isInMeeting && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        In Meeting
                      </div>
                    )}
                 </div>
                 
                 <div className={`p-2 rounded ${isBreakActive || isInMeeting ? 'bg-muted' : 'bg-red-50 dark:bg-red-950/20'}`}>
                   <div className={`text-xs font-medium ${isBreakActive || isInMeeting ? 'text-muted-foreground' : 'text-red-700 dark:text-red-400'}`}>
                     Inactive
                   </div>
                   <div className={`text-lg font-bold ${isBreakActive || isInMeeting ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'}`}>
                     {formatTime(liveInactiveSeconds)}
                   </div>
                                       {shiftEnded ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        Shift Ended
                      </div>
                    ) : !timerData.isActive && !isBreakActive && !isInMeeting && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Counting...
                      </div>
                    )}
                    {isBreakActive && !breakStatus?.is_paused && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        On Break
                      </div>
                    )}
                    {isBreakActive && breakStatus?.is_paused && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Emergency Pause - Counting
                      </div>
                    )}
                    {isInMeeting && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        In Meeting
                      </div>
                    )}
                 </div>
               </div>
               
               {/* Reset Countdown */}
               <div className="pt-2 border-t border-border">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <RotateCcw className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Timer Reset</span>
                   </div>
                   <div className="text-right">
                     {isShiftLoading ? (
                        <div className="text-xs text-muted-foreground">Loading...</div>
                     ) : shiftError ? (
                        <div className="text-xs text-destructive">Error</div>
                     ) : (
                       <>
                          <div className="text-xs font-medium">
                           {timeUntilResetFormatted}
                         </div>
                          <div className="text-xs text-muted-foreground">
                           {resetType}
                         </div>
                       </>
                     )}
                   </div>
                 </div>
               </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading timer data...</div>
          )}

          {error && (
            <div className="mt-2 text-xs text-destructive">
              Error: {error}
            </div>
          )}
        </div>
      )}
    </>
  )
} 

