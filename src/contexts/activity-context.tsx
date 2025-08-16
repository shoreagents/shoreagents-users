"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useActivityTracking } from '@/hooks/use-activity-tracking'
import { InactivityDialog } from '@/components/inactivity-dialog'
// import { initializeUserActivity, markUserAsLoggedOut, markUserAsAppClosed, pauseActivityForBreak, resumeActivityFromBreak, cleanupDuplicateSessions, forceSaveAndReload } from '@/lib/activity-storage'
import { useRouter } from 'next/navigation'
import { useBreak } from './break-context'


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
  const [hasLoggedIn, setHasLoggedIn] = useState(false)
  const [notificationShown, setNotificationShown] = useState(false)
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const notificationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { isBreakActive } = useBreak()
  // Removed useMeeting dependency to fix circular dependency
  // Meeting status will be handled by individual components that need it
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
  } = useActivityTracking()

  // Check for existing login on mount - but don't auto-start tracking
  useEffect(() => {
    const checkInitialAuth = async () => {
      const currentUser = getCurrentUser()
      if (currentUser) {
        // Initialize user activity data
        try {
          // TODO: Replace with database-driven activity initialization
          // await initializeUserActivity(currentUser.email)
        } catch (error) {
          console.error('Failed to initialize user activity:', error)
        }
        
        // Only set hasLoggedIn if we're not on the login page or root page
        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
          setHasLoggedIn(true)
        }
      } else {
        // No user logged in, ensure tracking is stopped
        setHasLoggedIn(false)
        if (isTracking) {
          stopTracking()
        }
      }
    }
    
    // Add a small delay to ensure all contexts are properly initialized
    const timeoutId = setTimeout(checkInitialAuth, 200)
    
    return () => clearTimeout(timeoutId)
  }, [])

  // Start tracking only when user has logged in and no break is active
  useEffect(() => {
    if (hasLoggedIn && !isTracking && !isBreakActive && window.location.pathname !== '/') {
      // Set inactivity threshold to 30 seconds (30000ms)
      setInactivityThreshold(30000)
      startTracking()
    }
  }, [hasLoggedIn, isTracking, isBreakActive, startTracking, setInactivityThreshold])

  // Pause tracking when break becomes active, resume when break ends
  useEffect(() => {
    if (hasLoggedIn) {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        if (isBreakActive) {
          // Pause activity tracking when break starts
          // TODO: Replace with database-driven activity pausing
          // pauseActivityForBreak(currentUser.email)
          pauseTracking()
        } else {
          // Resume activity tracking when break ends
          // TODO: Replace with database-driven activity resuming
          // resumeActivityFromBreak(currentUser.email)
          resumeTracking()
        }
      }
    }
  }, [isBreakActive, hasLoggedIn, pauseTracking, resumeTracking])

  // Meeting status will be handled by individual components that need it
  // This prevents circular dependency with MeetingProvider

    // Monitor authentication state continuously with enhanced stopping
  useEffect(() => {
    const checkAuthStatus = async () => {
      const currentUser = getCurrentUser()
      const isOnLoginPage = window.location.pathname === '/' || window.location.pathname === '/login'
      
      if (!currentUser) {
        // User is not logged in - IMMEDIATELY stop all tracking
        if (hasLoggedIn || isTracking) {
          setHasLoggedIn(false)
          
          // Aggressive immediate stop
          try {
            await stopTracking()
            await stopTracking() // Double stop
            await stopTracking() // Triple stop for safety
          } catch (error) {
            console.error('Error in aggressive stop:', error)
          }
          
          // Mark any active session as ended due to logout
          const authData = localStorage.getItem("shoreagents-auth")
          if (!authData) {
            // No auth data means user logged out, find last known user and end their session
            const allKeys = Object.keys(localStorage)
            const activityKeys = allKeys.filter(key => key.startsWith('shoreagents-activity-'))
            
            activityKeys.forEach(key => {
              const userData = localStorage.getItem(key)
              if (userData) {
                try {
                  const parsed = JSON.parse(userData)
                  if (parsed.isCurrentlyActive && parsed.currentSessionStart) {
                    const now = Date.now()
                    const activeDuration = now - parsed.currentSessionStart
                    parsed.totalActiveTime += activeDuration
                    
                    // End the session
                    if (parsed.activitySessions && parsed.activitySessions.length > 0) {
                      const lastSession = parsed.activitySessions[parsed.activitySessions.length - 1]
                      if (lastSession && lastSession.type === 'active' && !lastSession.endTime) {
                        lastSession.endTime = now
                        lastSession.duration = activeDuration
                        lastSession.endReason = 'logout'
                      }
                    }
                    
                    parsed.isCurrentlyActive = false
                    parsed.currentSessionStart = 0
                    parsed.lastActivityTime = now
                    localStorage.setItem(key, JSON.stringify(parsed))
                  }
                } catch (error) {
                  console.error('Error cleaning up activity data:', error)
                }
              }
            })
          }
        }
      } else {
        // User is logged in
        if (!hasLoggedIn && !isOnLoginPage) {
          setHasLoggedIn(true)
        }
      }
    }

    // Check auth status immediately
    checkAuthStatus()

    // Set up an interval to check auth status more frequently
    const authCheckInterval = setInterval(checkAuthStatus, 1000) // Check every 1 second

    return () => clearInterval(authCheckInterval)
  }, [hasLoggedIn, isTracking, stopTracking])

  // Listen for app closing event
  useEffect(() => {
    const handleAppClosing = () => {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Mark user session as ended due to app closing
        // TODO: Replace with database-driven app closing
        // markUserAsAppClosed(currentUser.email)
        setHasLoggedIn(false)
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

  // Periodic cleanup of duplicate sessions
  useEffect(() => {
    if (hasLoggedIn) {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Clean up duplicate sessions every 30onds
        const cleanupInterval = setInterval(() => {
          // TODO: Replace with database-driven cleanup
          // cleanupDuplicateSessions(currentUser.email)
        }, 30000) // 30 seconds
        
        return () => clearInterval(cleanupInterval)
      }
    }
  }, [hasLoggedIn])

  // Show system notification when inactivity dialog appears
  useEffect(() => {
    if (showInactivityDialog && !notificationShown && inactivityData) {
      // Show system notification
      if (window.electronAPI?.inactivityNotifications) {
        window.electronAPI.inactivityNotifications.show({
          inactiveTime: 0 // Start with 0 seconds
        }).then((result) => {
          if (result.success) {
            setNotificationShown(true)
            
            // Start updating notification every 3 seconds with dynamic time
            let currentInactiveTime = 0; // Start from 0 seconds
            notificationUpdateIntervalRef.current = setInterval(() => {
              // Increment the inactive time by 3 seconds
              currentInactiveTime += 3000;
              if (window.electronAPI?.inactivityNotifications) {
                window.electronAPI.inactivityNotifications.update({
                  inactiveTime: currentInactiveTime
                })
              }
            }, 3000) // Update every 3 seconds
          }
        }).catch((error) => {
          console.error('Error showing inactivity notification:', error)
        })
      }
    }
  }, [showInactivityDialog, notificationShown, inactivityData])

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

  const handleResetActivity = useCallback(async () => {
    // Instead of allowing manual reset, just close the dialog
    // Activity will naturally reset when user actually becomes active
    setShowInactivityDialog(false)
    
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

  const setUserLoggedIn = useCallback(() => {
    console.log('User logging in - will start activity tracking')
    
    // Clear any stale session data when logging in
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      // Initialize fresh activity data to prevent timing overlaps
      // TODO: Replace with database-driven activity initialization
      // initializeUserActivity(currentUser.email)
    }
    
    setHasLoggedIn(true)
    
    // Add a small delay to ensure authentication data is stored, then reload the page
    // This ensures the timer initializes properly after login
    setTimeout(() => {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        console.log('🔄 Reloading page after login to ensure timer initialization')
        window.location.reload()
      }
    }, 1000) // 1 second delay to ensure all data is stored
  }, [])

  const setUserLoggedOut = useCallback(async () => {
    console.log('🔄 User logging out - stopping activity tracking')
    
    // FIRST: Stop activity tracking immediately to prevent any more activity updates
    try {
      await stopTracking()
      console.log('✅ Activity tracking stopped successfully')
    } catch (error) {
      console.error('Error stopping tracking before logout:', error)
    }
    
    // SECOND: Clear any remaining localStorage activity data
    const allKeys = Object.keys(localStorage)
    const activityKeys = allKeys.filter(key => key.startsWith('shoreagents-activity-'))
    activityKeys.forEach(key => {
      try {
        localStorage.removeItem(key)
        console.log(`🗑️ Removed activity data: ${key}`)
      } catch (error) {
        console.error('Error removing activity data:', error)
      }
    })
    
    // THIRD: Set logged out state
    setHasLoggedIn(false)
    console.log('✅ User logged out successfully')
  }, [stopTracking])

  const value = {
    isTracking,
    hasLoggedIn,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setInactivityThreshold,
    getActivityStatus,
    setUserLoggedIn,
    setUserLoggedOut
  }

  return (
    <ActivityContext.Provider value={value}>
      {children}
      <InactivityDialog
        open={showInactivityDialog}
        onClose={handleCloseDialog}
        onReset={handleResetActivity}
        onAutoLogout={handleInactivityTimeout}
        inactiveTime={inactivityData?.inactiveTime || 0}
        threshold={inactivityData?.threshold || 30000}
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