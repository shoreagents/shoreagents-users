"use client"

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useTimer } from '@/contexts/timer-context'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, Pause, Clock, RotateCcw, Minimize2, ArrowDown } from 'lucide-react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { usePathname } from 'next/navigation'
import { useMeeting } from '@/contexts/meeting-context'
import { useEventsContext } from '@/contexts/events-context'
import { useHealth } from '@/contexts/health-context'
import { useRestroom } from '@/contexts/restroom-context'
import { useShiftResetTimer } from '@/hooks/use-shift-reset-timer'
import { parseShiftTime } from '@/lib/shift-utils'
import { useLoading } from '@/contexts/loading-context'

export const GlobalTimerDisplay = React.memo(function GlobalTimerDisplay() {
  const [isVisible, setIsVisible] = useState(true)
  const pathname = usePathname()
  const { isLoading } = useLoading()
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
  const { isInEvent, currentEvent } = useEventsContext()
  const { isGoingToClinic, isInClinic } = useHealth()
  const { isInRestroom } = useRestroom()
  
  const { 
    timeUntilResetFormatted, 
    resetType, 
    isLoading: isShiftLoading,
    error: shiftError
  } = useShiftResetTimer()

  // Note: Removed unused nowTick state that was causing unnecessary re-renders

  // Persist expand/collapse state in localStorage
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem('sa-global-timer-visible')
      if (stored !== null) {
        setIsVisible( stored === 'true')
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem('sa-global-timer-visible', isVisible ? 'true' : 'false')
    } catch {}
  }, [isVisible])

  // Utility function to format seconds into readable time - OPTIMIZED: Memoized
  const formatTime = useCallback((seconds: number) => {
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
  }, [])

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

  // Add a state to track current time for real-time updates
  const [currentTime, setCurrentTime] = useState(() => new Date())

  // Update current time every second for real-time shift state calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Check if shift has ended - Updated to use real-time current time
  const shiftEnded = useMemo(() => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return false

      // Get current Philippines time - more reliable conversion
      const nowUTC = new Date(currentTime)
      const nowPH = new Date(nowUTC.getTime() + (8 * 60 * 60 * 1000)) // UTC+8 for Philippines
      
      // Parse shift time to get dynamic start/end times
      if (shiftInfo?.time) {
        const parsed = parseShiftTime(shiftInfo.time, nowPH)
        if (parsed?.endTime) {
          return nowPH > parsed.endTime
        }
      }

      // If no shift time available, return false (don't assume shift has ended)
      return false
    } catch (error) {
      console.error('Error in shift end calculation:', error)
      return false
    }
  }, [shiftInfo?.time, currentTime]) // Now includes currentTime for real-time updates
  
  // Check if shift hasn't started yet - Updated to use real-time current time
  const shiftNotStarted = useMemo(() => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return false

      // Get current Philippines time - more reliable conversion
      const nowUTC = new Date(currentTime)
      const nowPH = new Date(nowUTC.getTime() + (8 * 60 * 60 * 1000)) // UTC+8 for Philippines
      
      // Parse shift time to get dynamic start/end times
      if (shiftInfo?.time) {
        const parsed = parseShiftTime(shiftInfo.time, nowPH)
        if (parsed?.startTime) {
          return nowPH < parsed.startTime
        }
      }

      // If no shift time available, return false (don't assume shift hasn't started)
      return false
    } catch (error) {
      console.error('Error in shift start calculation:', error)
      return false
    }
  }, [shiftInfo?.time, currentTime]) // Now includes currentTime for real-time updates
  
  // Debug logging for shift end state
  useEffect(() => {
    // Shift end check - no logging needed
  }, [shiftEnded, shiftInfo, liveActiveSeconds, liveInactiveSeconds])

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
  
  // Debug logging for authentication check
  // Removed console logs
  
  // Don't show timer on login page, if not authenticated, or during loading
  if (pathname === '/login' || pathname === '/' || !isAuthenticated || !currentUser || isLoading) {
    // Removed console logs
    return null
  }

  return (
    <>
      {/* Timer Display - Conditionally visible */}
      {isVisible && (
        <div className="fixed bottom-4 right-4 bg-card text-foreground rounded-lg shadow-lg border border-border p-4 min-w-[300px] z-50" data-activity-timer>
          {/* Toggle Button - Integrated with card */}
          <div className="absolute -top-2 -right-2 z-10">
            <Button
              onClick={() => setIsVisible(false)}
              variant="outline"
              size="sm"
              className="backdrop-blur-sm shadow-lg border rounded-full w-8 h-8 p-0 bg-card border-border text-foreground hover:bg-muted"
              title="Collapse Timer"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          {connectionStatus === 'connecting' && (
            <div className="absolute inset-0 bg-background/90 rounded-lg flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
                Reconnecting...
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 relative">
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:!bg-transparent hover:scale-110 dark:hover:text-white hover:text-black absolute -top-5 -left-5 "
                title="Minimize Timer"
              >
                <Minimize2 className="h-3 w-3 -rotate-90" />
              </Button>
              <h3 className="text-sm font-semibold">Activity Timer</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></span>
              <span className="text-xs text-muted-foreground">{getConnectionStatusText()}</span>
            </div>
          </div>

          {timerData ? (
            <div className="space-y-2">
              {/* Shift State Banners */}
              {shiftNotStarted && (
                <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded p-2 text-center">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Shift Not Started Yet - Timer Paused
                  </div>
                </div>
              )}
              
              {shiftEnded && (
                <div className="bg-gray-100 dark:bg-gray-900/20 border border-gray-300 dark:border-gray-700 rounded p-2 text-center">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Shift Has Ended - Timer Reset to 0s
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                 <span className="text-xs text-muted-foreground">Status:</span>
                                   <span className={`px-2 py-1 rounded text-xs font-medium ${
                    shiftEnded
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-300'
                      : shiftNotStarted
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300'
                      : isInEvent
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300'
                      : isInMeeting
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300'
                      : isGoingToClinic
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/20 dark:text-orange-300'
                      : isInClinic
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300'
                      : isInRestroom
                      ? 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-300'
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
                      : shiftNotStarted
                      ? 'Shift Not Started'
                      : isInEvent
                      ? `In Event`
                      : isInMeeting
                      ? 'In Meeting'
                      : isGoingToClinic
                      ? 'Going to Clinic'
                      : isInClinic
                      ? 'In Clinic'
                      : isInRestroom
                      ? 'In Restroom'
                      : isBreakActive && breakStatus?.is_paused
                      ? 'Emergency Pause'
                      : isBreakActive 
                      ? (breakStatus?.break_type ? `${breakStatus.break_type} Break` : 'On Break')
                      : (timerData.isActive ? 'Active' : 'Inactive')
                    }
                  </span>
               </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className={`p-2 rounded ${shiftEnded || shiftNotStarted ? 'bg-gray-100 dark:bg-gray-900/20' : isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom ? 'bg-muted' : 'bg-green-50 dark:bg-green-950/20'}`}>
                   <div className={`text-xs font-medium ${shiftEnded || shiftNotStarted ? 'text-gray-600 dark:text-gray-400' : isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom ? 'text-muted-foreground' : 'text-green-700 dark:text-green-400'}`}>
                     Active
                   </div>
                   <div className={`text-lg font-bold ${shiftEnded || shiftNotStarted ? 'text-gray-500 dark:text-gray-400' : isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom ? 'text-muted-foreground' : 'text-green-600 dark:text-green-400'}`}>
                     {shiftEnded || shiftNotStarted ? '0s' : formatTime(liveActiveSeconds)}
                   </div>
                                       {(shiftEnded || shiftNotStarted) ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        {shiftEnded ? 'Shift Ended' : 'Shift Not Started'}
                      </div>
                    ) : timerData.isActive && !isBreakActive && !isInMeeting && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom && !shiftEnded && !shiftNotStarted && (
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                        Counting...
                      </div>
                    )}
                    {isInEvent && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-purple-500 rounded-full animate-pulse"></span>
                        In Event
                      </div>
                    )}
                    {!isInEvent && isInMeeting && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse"></span>
                        In Meeting
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && isBreakActive && !breakStatus?.is_paused && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        On Break
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && isBreakActive && breakStatus?.is_paused && (
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                        Emergency Pause - Counting
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && !isBreakActive && isGoingToClinic && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></span>
                        Going to Clinic
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && !isBreakActive && !isGoingToClinic && isInClinic && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
                        In Clinic
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && !isBreakActive && !isGoingToClinic && !isInClinic && isInRestroom && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        In Restroom
                      </div>
                    )}
                 </div>
                 
                 <div className={`p-2 rounded ${shiftEnded || shiftNotStarted ? 'bg-gray-100 dark:bg-gray-900/20' : isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom ? 'bg-muted' : 'bg-red-50 dark:bg-red-950/20'}`}>
                   <div className={`text-xs font-medium ${shiftEnded || shiftNotStarted ? 'text-gray-600 dark:text-gray-400' : isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom ? 'text-muted-foreground' : 'text-red-700 dark:text-red-400'}`}>
                     Inactive
                   </div>
                   <div className={`text-lg font-bold ${shiftEnded || shiftNotStarted ? 'text-gray-500 dark:text-gray-400' : isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'}`}>
                     {shiftEnded || shiftNotStarted ? '0s' : formatTime(liveInactiveSeconds)}
                   </div>
                                       {(shiftEnded || shiftNotStarted) ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        {shiftEnded ? 'Shift Ended' : 'Shift Not Started'}
                      </div>
                    ) : !timerData.isActive && !isBreakActive && !isInMeeting && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom && !shiftEnded && !shiftNotStarted && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Counting...
                      </div>
                    )}
                    {isInEvent && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-purple-500 rounded-full animate-pulse"></span>
                        In Event
                      </div>
                    )}
                    {!isInEvent && isInMeeting && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse"></span>
                        In Meeting
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && isBreakActive && !breakStatus?.is_paused && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        On Break
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && isBreakActive && breakStatus?.is_paused && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Emergency Pause - Counting
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && !isBreakActive && isGoingToClinic && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></span>
                        Going to Clinic
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && !isBreakActive && !isGoingToClinic && isInClinic && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
                        In Clinic
                      </div>
                    )}
                    {!isInEvent && !isInMeeting && !isBreakActive && !isGoingToClinic && !isInClinic && isInRestroom && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        In Restroom
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

      {/* Floating Toggle Button - Only visible when timer is collapsed */}
      {!isVisible && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsVisible(true)}
            variant="outline"
            size="sm"
            className={`backdrop-blur-sm shadow-lg border rounded-full w-10 h-10 p-0 ${
              isEmergencyPaused
                ? 'bg-green-100 dark:bg-green-950/20 border-green-300 dark:border-green-900/40'
                : isInEvent
                  ? 'bg-purple-100 dark:bg-purple-950/20 border-purple-300 dark:border-purple-900/40'
                  : isBreakActive
                    ? 'bg-yellow-100 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-900/40'
                    : timerData?.isActive
                      ? 'bg-green-100 dark:bg-green-950/20 border-green-300 dark:border-green-900/40'
                      : 'bg-red-100 dark:bg-red-950/20 border-red-300 dark:border-red-900/40'
            }`}
            title="Expand Timer"
          >
            <div className="relative">
              <ChevronUp className="w-4 h-4" />
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                isEmergencyPaused
                  ? 'bg-green-500'
                  : isInEvent
                    ? 'bg-purple-500'
                  : isBreakActive 
                    ? 'bg-yellow-500' 
                    : timerData?.isActive 
                      ? 'bg-green-500' 
                      : 'bg-red-500'
              } animate-pulse`}></div>
            </div>
          </Button>
        </div>
      )}
    </>
  )
}) 

