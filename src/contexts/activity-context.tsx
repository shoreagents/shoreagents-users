"use client"

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react'
import { useActivityTracking } from '@/hooks/use-activity-tracking'
import { InactivityDialog } from '@/components/inactivity-dialog'
import { getCurrentUser } from '@/lib/ticket-utils'
import { initializeUserActivity, markUserAsLoggedOut, markUserAsAppClosed, pauseActivityForBreak, resumeActivityFromBreak, cleanupDuplicateSessions } from '@/lib/activity-storage'
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
    const currentUser = getCurrentUser()
    if (currentUser) {
      // Initialize user activity data
      initializeUserActivity(currentUser.email)
      
      // Only set hasLoggedIn if we're not on the login page
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
          pauseActivityForBreak(currentUser.email)
          pauseTracking()
        } else {
          // Resume activity tracking when break ends
          resumeActivityFromBreak(currentUser.email)
          resumeTracking()
        }
      }
    }
  }, [isBreakActive, hasLoggedIn, pauseTracking, resumeTracking])

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
        markUserAsAppClosed(currentUser.email)
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
        markUserAsAppClosed(currentUser.email)
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
          cleanupDuplicateSessions(currentUser.email)
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

  // Handle inactivity timeout - just close dialog without resetting
  const handleInactivityTimeout = useCallback(async () => {
    try {
      // Just close the dialog - activity will naturally reset when user becomes active
      setShowInactivityDialog(false)
    } catch (error) {
      console.error('Error during inactivity timeout:', error)
    }
  }, [setShowInactivityDialog])

  const setUserLoggedIn = useCallback(() => {
    console.log('User logging in - will start activity tracking')
    
    // Clear any stale session data when logging in
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      // Initialize fresh activity data to prevent timing overlaps
      initializeUserActivity(currentUser.email)
    }
    
    setHasLoggedIn(true)
  }, [])

  const setUserLoggedOut = useCallback(async () => {
    // FIRST: Check current status before stopping
    try {
      if (window.electronAPI?.activityTracking?.getStatus) {
        const status = await window.electronAPI.activityTracking.getStatus();
        console.log('🔍 Activity status before logout:', status);
      }
    } catch (error) {
      console.error('Error getting activity status:', error);
    }
    
    // SECOND: Stop activity tracking immediately to prevent any more activity updates
    try {
      await stopTracking()
    } catch (error) {
      console.error('Error stopping tracking before logout:', error)
    }
    
    // SECOND: Mark user as logged out (this will end the session)
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      markUserAsLoggedOut(currentUser.email)
    }
    
    // THIRD: Also force logout for ALL activity data in localStorage
    const allKeys = Object.keys(localStorage)
    const activityKeys = allKeys.filter(key => key.startsWith('shoreagents-activity-'))
    activityKeys.forEach(key => {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const parsed = JSON.parse(data)
          if (parsed.isCurrentlyActive || !parsed.isLoggedOut) {
            console.log(`🔴 Force ending session for key: ${key}`)
            const now = Date.now()
            
            // End any active session
            if (parsed.currentSessionStart && parsed.currentSessionStart > 0) {
              const duration = now - parsed.currentSessionStart
              parsed.totalActiveTime += duration
              
              // End last session
              if (parsed.activitySessions && parsed.activitySessions.length > 0) {
                const lastSession = parsed.activitySessions[parsed.activitySessions.length - 1]
                if (lastSession && !lastSession.endTime) {
                  lastSession.endTime = now
                  lastSession.duration = duration
                  lastSession.endReason = 'logout'
                }
              }
            }
            
            // Force logout state
            parsed.isCurrentlyActive = false
            parsed.currentSessionStart = 0
            parsed.isLoggedOut = true
            parsed.lastLogoutTime = now
            parsed.isInBreak = false
            
            localStorage.setItem(key, JSON.stringify(parsed))
          }
        }
      } catch (error) {
        console.error('Error force ending session:', error)
      }
    })
    
    setHasLoggedIn(false)
    
    // THIRD: Additional safety stops to ensure tracking stays off
    const stopAttempts = [
      () => stopTracking(),
      () => stopTracking()
    ]
    
    for (let i = 0; i < stopAttempts.length; i++) {
      try {
        await stopAttempts[i]()
      } catch (error) {
        console.error(`Safety stop attempt ${i + 1} failed:`, error)
      }
      
      // Small delay between attempts
      if (i < stopAttempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
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