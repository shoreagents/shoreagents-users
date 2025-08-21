"use client"

import { useEffect, useCallback } from 'react'
import { useSocket } from '@/hooks/use-socket'

export function useActivityTracker() {
  const { socket, isConnected } = useSocket()

  // Track user activity to prevent away status
  const trackActivity = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('user-activity')
    }
  }, [socket, isConnected])

  useEffect(() => {
    if (!isConnected) return

    // Track activity on various user interactions
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focus'
    ]

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true })
    })

    // Track activity on window focus
    const handleWindowFocus = () => trackActivity()
    window.addEventListener('focus', handleWindowFocus)

    // Track activity on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        trackActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity)
      })
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isConnected, trackActivity])

  // Track activity manually (can be called from components)
  return { trackActivity }
}
