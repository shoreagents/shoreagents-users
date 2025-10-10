"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useActivityTracking } from '@/hooks/use-activity-tracking'
import { InactivityDialog } from '@/components/inactivity-dialog'
import { InactivityDialog60s } from '@/components/inactivity-dialog-60s'
import { useRouter } from 'next/navigation'
import { useBreak } from './break-context'
import { useMeeting } from './meeting-context'
import { useTimer } from './timer-context'
import { useAuth } from './auth-context'
import { useEventsContext } from './events-context'
import { useHealth } from './health-context'
import { useRestroom } from './restroom-context'
import { isWithinShiftHours, parseShiftTime } from '@/lib/shift-utils'


interface ActivityContextType {
  isTracking: boolean
  hasLoggedIn: boolean
  startTracking: () => Promise<void>
  stopTracking: () => Promise<void>
  pauseTracking: () => Promise<void>
  resumeTracking: () => Promise<void>
  setInactivityThreshold: (threshold: number) => Promise<void>
  getActivityStatus: () => Promise<any>
  setUserLoggedIn: () => void
  setUserLoggedOut: () => void
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined)

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [notificationShown, setNotificationShown] = useState(false)
  const [isDialogPaused, setIsDialogPaused] = useState(false)
  const [show60sDialog, setShow60sDialog] = useState(false)
  const [hasShown60sDialog, setHasShown60sDialog] = useState(false)
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const notificationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isDialogPausedRef = useRef(false)
  
  const { isBreakActive } = useBreak()
  const { isInMeeting } = useMeeting()
  const { shiftInfo, setActivityState } = useTimer()
  const { hasLoggedIn, setUserLoggedIn, setUserLoggedOut } = useAuth()
  const { isInEvent } = useEventsContext()
  const { isGoingToClinic, isInClinic } = useHealth()
  const { isInRestroom } = useRestroom()
  const {
    isTracking,
    showInactivityDialog,
    inactivityData,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setInactivityThreshold,
    getActivityStatus,
    setShowInactivityDialog
  } = useActivityTracking(setActivityState)
  
  const setShowInactivityDialogRef = useRef(setShowInactivityDialog)
  
  // Update ref when setShowInactivityDialog changes
  useEffect(() => {
    setShowInactivityDialogRef.current = setShowInactivityDialog
  }, [setShowInactivityDialog])

  // Helper function to check if shift has ended - always re-parse to use updated logic
  const checkIfShiftEnded = useCallback((shiftInfo: any) => {
    try {
      if (!shiftInfo?.time) return false
      
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      // Always re-parse shift time to use updated parseShiftTime logic
      const parsed = parseShiftTime(shiftInfo.time, nowPH)
      
      if (parsed?.endTime) {
        return nowPH > parsed.endTime
      }
      
      return false
    } catch (error) {
      return false
    }
  }, [])

  // Helper function to check if shift has not started - always re-parse to use updated logic
  const checkIfShiftNotStarted = useCallback((shiftInfo: any) => {
    try {
      if (!shiftInfo?.time) return false
      
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      // Always re-parse shift time to use updated parseShiftTime logic
      const parsed = parseShiftTime(shiftInfo.time, nowPH)
      
      if (parsed?.startTime) {
        return nowPH < parsed.startTime
      }
      
      return false
    } catch (error) {
      return false
    }
  }, [])

  // Initialize user activity data when logged in
  useEffect(() => {
    if (hasLoggedIn) {
      const currentUser = getCurrentUser()
      if (currentUser) {
        // Initialize user activity data
        try {
          // TODO: Replace with database-driven activity initialization
          // await initializeUserActivity(currentUser.email)
        } catch (error) {
          console.error('Failed to initialize user activity:', error)
        }
      }
    } else {
      // No user logged in, ensure tracking is stopped
      if (isTracking) {
        stopTracking()
      }
    }
  }, [hasLoggedIn, isTracking, stopTracking])

  // Handle shift reset events to restart activity tracking
  useEffect(() => {
    const handleShiftReset = (event: CustomEvent) => {
      const { resetData, isActive } = event.detail
      
      console.log('Shift reset detected in activity context:', { resetData, isActive })
      
      // If user should be active after shift reset, restart activity tracking
      if (isActive && hasLoggedIn) {
        console.log('Restarting activity tracking after shift reset')
        
        // Always stop tracking first to ensure clean restart
        if (isTracking) {
          stopTracking()
        }
        
        // Set inactivity threshold
        const inactivityThreshold = 30000
        setInactivityThreshold(inactivityThreshold)
        
        // Start tracking after a short delay to ensure clean restart
        setTimeout(() => {
          startTracking()
        }, 100)
      }
    }

    // Listen for shift reset events
    window.addEventListener('shift-reset-detected', handleShiftReset as EventListener)
    
    return () => {
      window.removeEventListener('shift-reset-detected', handleShiftReset as EventListener)
    }
  }, [hasLoggedIn, isTracking, startTracking, stopTracking, setInactivityThreshold])

  // Start tracking only when user has logged in, no break is active, not in a meeting, and within shift hours
  useEffect(() => {
    const isWithinShift = isWithinShiftHours(shiftInfo)
    const isShiftEnded = checkIfShiftEnded(shiftInfo)
    const isShiftNotStarted = checkIfShiftNotStarted(shiftInfo)
   
   
    // Only start tracking if shift is active (not ended and not started) and not in health check or restroom
    if (hasLoggedIn && !isTracking && !isBreakActive && !isInMeeting && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom && isWithinShift && !isShiftEnded && !isShiftNotStarted && window.location.pathname !== '/') {
      // Set inactivity threshold from environment variable or default to 30 seconds (30000ms)
      const inactivityThreshold = 30000
      setInactivityThreshold(inactivityThreshold)
      startTracking()
    }
  }, [hasLoggedIn, isTracking, isBreakActive, isInMeeting, isInEvent, isGoingToClinic, isInClinic, isInRestroom, shiftInfo, startTracking, setInactivityThreshold, checkIfShiftEnded, checkIfShiftNotStarted])

  // Pause/resume activity tracking based on various status conditions
  useEffect(() => {
    if (!hasLoggedIn) return

    const currentUser = getCurrentUser()
    if (!currentUser?.email) return

    // Check if any status requires pausing activity tracking
    const shouldPause = isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom

    if (shouldPause) {
      // Pause activity tracking when any status is active
      // TODO: Replace with database-driven activity pausing
      pauseTracking()
    } else {
      // Resume activity tracking when all statuses are inactive
      // TODO: Replace with database-driven activity resuming
      resumeTracking()
    }
  }, [
    hasLoggedIn, 
    isBreakActive, 
    isInMeeting, 
    isInEvent, 
    isGoingToClinic, 
    isInClinic, 
    isInRestroom, 
    pauseTracking, 
    resumeTracking
  ])

  // Pause tracking when outside shift hours, resume when within shift hours
  useEffect(() => {
    if (hasLoggedIn) {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        const isWithinShift = isWithinShiftHours(shiftInfo)
        const isShiftEnded = checkIfShiftEnded(shiftInfo)
        const isShiftNotStarted = checkIfShiftNotStarted(shiftInfo)
        
        
        // Pause tracking if outside shift hours, shift has ended, or shift hasn't started
        if (!isWithinShift || isShiftEnded || isShiftNotStarted) {
          // Pause activity tracking when outside shift hours or shift is not active
          // TODO: Replace with database-driven activity pausing
          // pauseActivityForShift(currentUser.email)
          pauseTracking()
        } else {
          // Resume activity tracking when within shift hours and shift is active
          // TODO: Replace with database-driven activity resuming
          // resumeActivityFromShift(currentUser.email)
          resumeTracking()
        }
      }
    }
  }, [shiftInfo, hasLoggedIn, pauseTracking, resumeTracking, checkIfShiftEnded, checkIfShiftNotStarted, isTracking])

  // Meeting status will be handled by individual components that need it
  // This prevents circular dependency with MeetingProvider

  // Monitor authentication state changes and stop tracking when logged out
  useEffect(() => {
    if (!hasLoggedIn && isTracking) {
      // User logged out - IMMEDIATELY stop all tracking
      try {
        stopTracking()
        stopTracking() // Double stop
        stopTracking() // Triple stop for safety
      } catch (error) {
        console.error('Error in aggressive stop:', error)
      }
      
      // Activity tracking is now database-driven, no localStorage cleanup needed
    }
  }, [hasLoggedIn, isTracking, stopTracking])

  // Listen for app closing event
  useEffect(() => {
    const handleAppClosing = () => {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Mark user session as ended due to app closing
        // TODO: Replace with database-driven app closing
        // markUserAsAppClosed(currentUser.email)
        stopTracking()
      }
    }

    // Listen for app closing event from Electron
    if (window.electronAPI?.receive) {
      window.electronAPI.receive('app-closing', handleAppClosing)
    }

    // Also listen for page unload (browser close/refresh)
    const handlePageUnload = () => {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Mark user session as ended due to page unload
        // TODO: Replace with database-driven app closing
        // markUserAsAppClosed(currentUser.email)
      }
    }

    window.addEventListener('beforeunload', handlePageUnload)

    return () => {
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners('app-closing')
      }
      window.removeEventListener('beforeunload', handlePageUnload)
    }
  }, [stopTracking])

  // Periodic cleanup of duplicate sessions - OPTIMIZED: Reduced frequency
  useEffect(() => {
    if (hasLoggedIn) {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Clean up duplicate sessions every 2 minutes - OPTIMIZED: Reduced frequency
        const cleanupInterval = setInterval(() => {
          // TODO: Replace with database-driven cleanup
          // cleanupDuplicateSessions(currentUser.email)
        }, 120000) // OPTIMIZED: 2 minutes instead of 30 seconds
        
        return () => clearInterval(cleanupInterval)
      }
    }
  }, [hasLoggedIn])

  // CRITICAL: Periodic check to restart tracking when shift starts
  // This fixes the issue where tracking stops before shift start and doesn't restart
  useEffect(() => {
    if (!hasLoggedIn) return

    const checkShiftStart = () => {
      const isWithinShift = isWithinShiftHours(shiftInfo)
      const isShiftEnded = checkIfShiftEnded(shiftInfo)
      const isShiftNotStarted = checkIfShiftNotStarted(shiftInfo)
      

      // If shift has started and we're not tracking, start tracking
      if (isWithinShift && !isShiftEnded && !isShiftNotStarted && !isTracking && !isBreakActive && !isInMeeting && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom && window.location.pathname !== '/') {
        const inactivityThreshold = 30000
        setInactivityThreshold(inactivityThreshold)
        startTracking()
      }
    }

    // Check every 10 seconds for shift start
    const shiftCheckInterval = setInterval(checkShiftStart, 10000)
    
    // Also check immediately
    checkShiftStart()

    return () => clearInterval(shiftCheckInterval)
  }, [hasLoggedIn, isTracking, isBreakActive, isInMeeting, isInEvent, isGoingToClinic, isInClinic, isInRestroom, shiftInfo, startTracking, setInactivityThreshold, checkIfShiftEnded, checkIfShiftNotStarted])

  // Show system notification when inactivity dialog appears (but not during meetings or outside shift hours)
  useEffect(() => {
    const isWithinShift = isWithinShiftHours(shiftInfo)
    const isShiftEnded = checkIfShiftEnded(shiftInfo)
    const isShiftNotStarted = checkIfShiftNotStarted(shiftInfo)
    
    if (showInactivityDialog && !notificationShown && inactivityData && !isInMeeting && !isInEvent && !isBreakActive && !isInRestroom && !isGoingToClinic && !isInClinic && isWithinShift && !isShiftEnded && !isShiftNotStarted) {
      // Show system notification
      if (window.electronAPI?.inactivityNotifications) {
        window.electronAPI.inactivityNotifications.show({
          inactiveTime: 30000 // Start with 30 seconds
        }).then((result) => {
          if (result.success) {
            setNotificationShown(true)
            
            // Start updating notification every 3 seconds with dynamic time
            let currentInactiveTime = 30000; // Start from 30 seconds (30 * 1000ms)
            let lastPausedState = false; // Track previous paused state
            
            notificationUpdateIntervalRef.current = setInterval(() => {
              // Check if still in any status that should pause inactivity - if so, stop updating and close notification
              if (isInMeeting || isInEvent || isBreakActive || isInRestroom || isGoingToClinic || isInClinic) {
                if (notificationUpdateIntervalRef.current) {
                  clearInterval(notificationUpdateIntervalRef.current)
                  notificationUpdateIntervalRef.current = null
                }
                // Close the notification if in any status
                if (window.electronAPI?.inactivityNotifications) {
                  window.electronAPI.inactivityNotifications.close()
                }
                setNotificationShown(false)
                return
              }
              
              // Check if dialog timer is paused (user is active) - if so, skip update
              if (isDialogPausedRef.current) {
                lastPausedState = true; // Remember we were paused
                return // Skip notification update when dialog timer is paused
              }
              
              // If we were paused and now we're not paused, reset the timer
              if (lastPausedState && !isDialogPausedRef.current) {
                currentInactiveTime = 30000; // Reset to 30 seconds when resuming from pause
                lastPausedState = false;
              }
              
              // Increment the inactive time by 3 seconds
              currentInactiveTime += 3000;
              if (window.electronAPI?.inactivityNotifications) {
                window.electronAPI.inactivityNotifications.update({
                  inactiveTime: currentInactiveTime,
                  skipUpdate: isInMeeting || isInEvent || isBreakActive || isInRestroom || isGoingToClinic || isInClinic || isDialogPausedRef.current // Skip update if in any status or dialog is paused
                })
              }
            }, 3000) // Update every 3 seconds
          }
        }).catch((error) => {
          console.error('Error showing inactivity notification:', error)
        })
      }
    }
  }, [showInactivityDialog, notificationShown, inactivityData, isInMeeting, isInEvent, isBreakActive, isInRestroom, isGoingToClinic, isInClinic, checkIfShiftEnded, checkIfShiftNotStarted, shiftInfo, isDialogPaused])

  // Close inactivity dialog and notification when any status starts
  useEffect(() => {
    if (isInMeeting || isInEvent || isBreakActive || isInRestroom || isGoingToClinic || isInClinic) {
      // Close the inactivity dialog immediately when any status starts
      setShowInactivityDialog(false)
      
      // Clear notification update interval
      if (notificationUpdateIntervalRef.current) {
        clearInterval(notificationUpdateIntervalRef.current)
        notificationUpdateIntervalRef.current = null
      }
      
      // Close system notification
      if (window.electronAPI?.inactivityNotifications && notificationShown) {
        window.electronAPI.inactivityNotifications.close().then(() => {
          setNotificationShown(false)
        }).catch((error) => {
          console.error('Error closing inactivity notification:', error)
          setNotificationShown(false)
        })
      }
      
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
        notificationTimeoutRef.current = null
      }
    }
  }, [isInMeeting, isInEvent, isBreakActive, isInRestroom, isGoingToClinic, isInClinic, notificationShown, setShowInactivityDialog])

  // Reset notification flag when dialog closes
  useEffect(() => {
    if (!showInactivityDialog) {
      // Clear notification update interval
      if (notificationUpdateIntervalRef.current) {
        clearInterval(notificationUpdateIntervalRef.current)
        notificationUpdateIntervalRef.current = null
      }
      
      // Close system notification
      if (window.electronAPI?.inactivityNotifications && notificationShown) {
        window.electronAPI.inactivityNotifications.close().then(() => {
          setNotificationShown(false)
        }).catch((error) => {
          console.error('Error closing inactivity notification:', error)
          setNotificationShown(false)
        })
      }
      
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
        notificationTimeoutRef.current = null
      }
    }
  }, [showInactivityDialog, notificationShown])

  const handleCloseDialog = useCallback(() => {
    setShowInactivityDialog(false)
  }, [setShowInactivityDialog])

  const handleDialogPausedStateChange = useCallback((isPaused: boolean) => {
    setIsDialogPaused(isPaused)
    isDialogPausedRef.current = isPaused
  }, [])

  const handleShow60sDialog = useCallback(() => {
    setShow60sDialog(true)
    setHasShown60sDialog(true) // Mark that we've shown the 60s dialog
    setShowInactivityDialogRef.current(false) // Close the first dialog
  }, [])

  const handleClose60sDialog = useCallback(() => {
    setShow60sDialog(false)
  }, [])

  const handleResetFrom60sDialog = useCallback(() => {
    setShow60sDialog(false)
    setHasShown60sDialog(false) // Reset the flag when user responds
    setShowInactivityDialogRef.current(false)
  }, [])

  const handleResetActivity = useCallback(async () => {
    // Instead of allowing manual reset, just close the dialog
    // Activity will naturally reset when user actually becomes active
    setShowInactivityDialog(false)
    setHasShown60sDialog(false) // Reset the flag when user becomes active
    
    // Reset notification flag
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
      notificationTimeoutRef.current = null
    }
    setNotificationShown(false)
  }, [setShowInactivityDialog])

  // Handle inactivity timeout - force save and reload before logout
  const handleInactivityTimeout = useCallback(async () => {
    try {
      // Get current user before clearing auth
      const currentUser = getCurrentUser()
      
      // Force save all activity data and reload page before logout
      if (currentUser?.email) {
        // TODO: Replace with database-driven save and reload
        // forceSaveAndReload(currentUser.email)
        return // The page will reload, so don't continue with logout
      }
      
      // Fallback: Just close the dialog - activity will naturally reset when user becomes active
      setShowInactivityDialog(false)
    } catch (error) {
      console.error('Error during inactivity timeout:', error)
      // Fallback: Just close the dialog
      setShowInactivityDialog(false)
    }
  }, [setShowInactivityDialog])

  // These functions are now handled by the auth context
  // We keep them here for backward compatibility but they delegate to the auth context
  const handleUserLoggedIn = useCallback(() => {
    setUserLoggedIn()
  }, [setUserLoggedIn])

  const handleUserLoggedOut = useCallback(async () => {
    // FIRST: Stop activity tracking immediately to prevent any more activity updates
    try {
      await stopTracking()
    } catch (error) {
      console.error('Error stopping tracking before logout:', error)
    }
    
    // Activity tracking is now database-driven, no localStorage cleanup needed
    
    // THIRD: Set logged out state via auth context
    setUserLoggedOut()
  }, [stopTracking, setUserLoggedOut])

  const value = {
    isTracking,
    hasLoggedIn,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setInactivityThreshold,
    getActivityStatus,
    setUserLoggedIn: handleUserLoggedIn,
    setUserLoggedOut: handleUserLoggedOut
  }

  return (
    <ActivityContext.Provider value={value}>
      {children}
      <InactivityDialog
        open={showInactivityDialog && !hasShown60sDialog && !isInMeeting && !isInEvent && !isBreakActive && !isInRestroom && !isGoingToClinic && !isInClinic && isWithinShiftHours(shiftInfo) && !checkIfShiftEnded(shiftInfo) && !checkIfShiftNotStarted(shiftInfo)}
        onClose={handleCloseDialog}
        onReset={handleResetActivity}
        onAutoLogout={handleInactivityTimeout}
        inactiveTime={inactivityData?.inactiveTime || 0}
        threshold={inactivityData?.threshold || (process.env.NEXT_PUBLIC_INACTIVITY_THRESHOLD ? parseInt(process.env.NEXT_PUBLIC_INACTIVITY_THRESHOLD, 10) : 30000)}
        onPausedStateChange={handleDialogPausedStateChange}
        onShow60sDialog={handleShow60sDialog}
      />
      <InactivityDialog60s
        open={show60sDialog && !isInMeeting && !isInEvent && !isBreakActive && !isInRestroom && !isGoingToClinic && !isInClinic && isWithinShiftHours(shiftInfo) && !checkIfShiftEnded(shiftInfo) && !checkIfShiftNotStarted(shiftInfo)}
        onClose={handleClose60sDialog}
        onReset={handleResetFrom60sDialog}
        onAutoLogout={handleInactivityTimeout}
        onPausedStateChange={handleDialogPausedStateChange}
        inactiveTime={inactivityData?.inactiveTime || 0}
        threshold={inactivityData?.threshold || (process.env.NEXT_PUBLIC_INACTIVITY_THRESHOLD ? parseInt(process.env.NEXT_PUBLIC_INACTIVITY_THRESHOLD, 10) : 30000)}
      />
    </ActivityContext.Provider>
  )
}

export function useActivity() {
  const context = useContext(ActivityContext)
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider')
  }
  return context
} 