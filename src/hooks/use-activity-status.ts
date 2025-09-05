"use client"

import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useTimer } from '@/contexts/timer-context'
import { useMeetingStatusContext } from '@/hooks/use-meeting-status-context'
import { parseShiftTime } from '@/lib/shift-utils'

export function useActivityStatus() {
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { isInitialized, isBreakActive, timerData, lastActivityState, breakStatus, shiftInfo } = useTimer()
  const { isInMeeting } = useMeetingStatusContext()

  // Check if shift has ended
  const isShiftEnded = useCallback(() => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return false

      // Get current Philippines time
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      
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
      return false
    }
  }, [shiftInfo?.time])

  const checkActivityStatus = useCallback(() => {
    try {
      const currentUser = getCurrentUser()
      if (currentUser?.email && isInitialized) {
        // Check if shift has ended first - this overrides everything
        const shiftEnded = isShiftEnded()
        if (shiftEnded) {
          setIsActive(false)
          setIsLoading(false)
          return
        }

        // IMPROVED ACTIVITY STATUS DETERMINATION
        // Use database-driven activity status from timer context with better validation
        
        // Primary source: server activity state
        const serverActivityState = timerData?.isActive
        
        // Secondary source: local activity state
        const localActivityState = lastActivityState
        
        // Determine if user is on break
        const isOnBreak = isBreakActive === true
        
        // Check if break is paused (emergency pause)
        // When break is paused, user should be considered active since they're working
        const isBreakPaused = breakStatus?.is_paused === true
        
        // IMPROVED LOGIC: Trust server state over local state when available
        let isActive = false
        
        if (serverActivityState !== undefined) {
          // Server has explicit state - trust it as primary source
          isActive = serverActivityState
          
          // Server state differs from local state - using server state
        } else if (localActivityState !== null) {
          // Fall back to local state if server state unavailable
          isActive = localActivityState
        } else {
          // No state available - default to active to prevent false inactive
          isActive = true
        }
        
        // Apply break and meeting logic
        if (isOnBreak && !isBreakPaused) {
          // User is on break and break is not paused - consider inactive
          isActive = false
        } else if (isOnBreak && isBreakPaused) {
          // User is on break but it's paused (emergency pause) - consider active
          isActive = true
        }
        
        // Meeting status overrides activity
        if (isInMeeting) {
          isActive = false
        }
        
        // Final validation: if we're about to set inactive, double-check
        if (!isActive) {
          // Additional validation for inactive state
          const inactiveValidation = validateInactiveState(serverActivityState, localActivityState, isOnBreak, isInMeeting)
          if (!inactiveValidation) {
            isActive = true
          }
        }
        
        setIsActive(isActive)
      } else {
        setIsActive(false)
      }
    } catch (error) {
      console.error('Error checking activity status:', error)
      // On error, default to active to prevent false inactive
      setIsActive(true)
    } finally {
      setIsLoading(false)
    }
  }, [isInitialized, isBreakActive, isInMeeting, timerData?.isActive, breakStatus?.is_paused, lastActivityState, isShiftEnded])

  // Helper function to validate inactive state
  const validateInactiveState = useCallback((
    serverActivityState: boolean | undefined, 
    localActivityState: boolean | null, 
    isOnBreak: boolean, 
    isInMeeting: boolean
  ): boolean => {
    // If server explicitly says inactive, trust it
    if (serverActivityState === false) {
      return true
    }
    
    // If local state says inactive but server says active, don't trust local
    if (localActivityState === false && serverActivityState === true) {
      return false
    }
    
    // If we have conflicting information, be conservative
    if (localActivityState !== null && serverActivityState !== undefined && localActivityState !== serverActivityState) {
      return false
    }
    
    // Only trust inactive if we have consistent inactive state
    return localActivityState === false
  }, [])

  useEffect(() => {
    // Check immediately
    checkActivityStatus()

    // Check every 500ms for real-time updates
    const interval = setInterval(checkActivityStatus, 500)

    // Add event listeners for real-time activity detection
    const handleActivity = async () => {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // TODO: Replace with database-driven activity tracking
        // For now, just check status after a brief delay
        setTimeout(checkActivityStatus, 50)
      }
    }

    // Listen for user activity events
    window.addEventListener('mousemove', handleActivity, { passive: true })
    window.addEventListener('mousedown', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('scroll', handleActivity, { passive: true })
    window.addEventListener('click', handleActivity, { passive: true })
    window.addEventListener('touchstart', handleActivity, { passive: true })

    // Listen for visibility changes (tab switching)
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const currentUser = getCurrentUser()
        if (currentUser?.email) {
          // TODO: Replace with database-driven activity tracking
          setTimeout(checkActivityStatus, 50)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for focus events
    window.addEventListener('focus', handleActivity)
    window.addEventListener('blur', handleActivity)

    // Listen for custom activity update events
    const handleActivityUpdate = (event: CustomEvent) => {
      const currentUser = getCurrentUser()
      if (currentUser?.email && event.detail.userId === currentUser.email) {
        setTimeout(checkActivityStatus, 50)
      }
    }
    window.addEventListener('userActivityUpdate', handleActivityUpdate as EventListener)

    return () => {
      clearInterval(interval)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleActivity)
      window.removeEventListener('blur', handleActivity)
      window.removeEventListener('userActivityUpdate', handleActivityUpdate as EventListener)
    }
  }, [checkActivityStatus])

  return { isActive, isLoading, isShiftEnded: isShiftEnded() }
} 