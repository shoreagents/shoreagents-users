"use client"

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react'
import { useActivityTracking } from '@/hooks/use-activity-tracking'
import { InactivityDialog } from '@/components/inactivity-dialog'
import { getCurrentUser } from '@/lib/ticket-utils'
import { initializeUserActivity, markUserAsLoggedOut, pauseActivityForBreak, resumeActivityFromBreak, cleanupDuplicateSessions } from '@/lib/activity-storage'
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
      if (window.location.pathname !== '/') {
        setHasLoggedIn(true)
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

  // Stop tracking when user logs out
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser && isTracking) {
      stopTracking()
      setHasLoggedIn(false)
    }
  }, [isTracking, stopTracking])

  // Listen for app closing event
  useEffect(() => {
    const handleAppClosing = () => {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Mark user as logged out when app closes
        markUserAsLoggedOut(currentUser.email)
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
        // Mark user as logged out when page unloads
        markUserAsLoggedOut(currentUser.email)
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
    setHasLoggedIn(true)
  }, [])

  const setUserLoggedOut = useCallback(async () => {
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      markUserAsLoggedOut(currentUser.email)
    }
    setHasLoggedIn(false)
    stopTracking()
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