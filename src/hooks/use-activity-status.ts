"use client"

import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useTimer } from '@/contexts/timer-context'

export function useActivityStatus() {
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { isInitialized, isBreakActive, timerData, lastActivityState } = useTimer()

  const checkActivityStatus = useCallback(() => {
    try {
      const currentUser = getCurrentUser()
      if (currentUser?.email && isInitialized) {
        // Use database-driven activity status from timer context
        // User is active if they have recent activity and are not on break
        const hasRecentActivity = timerData?.isActive === true || lastActivityState === true
        const isOnBreak = isBreakActive === true
        

        
        setIsActive(hasRecentActivity && !isOnBreak)
      } else {
        setIsActive(false)
      }
    } catch (error) {
      console.error('Error checking activity status:', error)
      setIsActive(false)
    } finally {
      setIsLoading(false)
    }
  }, [isInitialized, isBreakActive, timerData?.isActive, lastActivityState])

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

  return { isActive, isLoading }
} 