"use client"

import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getCurrentSessionStatus, trackUserActivity } from '@/lib/activity-storage'

export function useActivityStatus() {
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkActivityStatus = useCallback(() => {
    try {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        const sessionStatus = getCurrentSessionStatus(currentUser.email)
        
        // User is active if they have an active session (not break, inactive, or none)
        const active = sessionStatus?.type === 'active'
        setIsActive(active)
      } else {
        setIsActive(false)
      }
    } catch (error) {
      console.error('Error checking activity status:', error)
      setIsActive(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check immediately
    checkActivityStatus()

    // Check every 500ms for real-time updates
    const interval = setInterval(checkActivityStatus, 500)

    // Add event listeners for real-time activity detection
    const handleActivity = () => {
      const currentUser = getCurrentUser()
      if (currentUser?.email) {
        // Track activity immediately
        trackUserActivity(currentUser.email)
        // Check status after a brief delay
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
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const currentUser = getCurrentUser()
        if (currentUser?.email) {
          trackUserActivity(currentUser.email)
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