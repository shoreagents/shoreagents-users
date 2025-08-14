"use client"

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react'
import { useSocketTimer } from '@/hooks/use-socket-timer'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useActivity } from './activity-context'
import { useMeeting } from '@/contexts/meeting-context'

interface TimerContextType {
  timerData: any
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  error: string | null
  isAuthenticated: boolean
  liveActiveSeconds: number
  liveInactiveSeconds: number
  isInitialized: boolean
  isBreakActive: boolean
  breakStatus: any
  lastActivityState: boolean | null
  setActivityState: (isActive: boolean) => void
  updateTimerData: (activeSeconds: number, inactiveSeconds: number) => void
  refreshBreakStatus: () => Promise<void>
  shiftInfo: any
  timeUntilReset: number
  formattedTimeUntilReset: string
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [liveActiveSeconds, setLiveActiveSeconds] = useState(0)
  const [liveInactiveSeconds, setLiveInactiveSeconds] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastActivityState, setLastActivityState] = useState<boolean | null>(null)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [breakStatus, setBreakStatus] = useState<any>(null)
  const [shiftInfo, setShiftInfo] = useState<any>(null)
  const [timeUntilReset, setTimeUntilReset] = useState(0)
  const [formattedTimeUntilReset, setFormattedTimeUntilReset] = useState('')
  const { hasLoggedIn } = useActivity()
  const { isInMeeting } = useMeeting()

  // Get current user
  useEffect(() => {
    const user = getCurrentUser()
    if (user?.email !== currentUser?.email) {
      // User changed, reset timer state completely
      setLiveActiveSeconds(0)
      setLiveInactiveSeconds(0)
      setIsInitialized(false)
      setLastActivityState(null)
      console.log('User changed, resetting timer state for:', user?.email)
    }
    setCurrentUser(user)
  }, [currentUser?.email])

  // Reset timer state when user is null (logout)
  useEffect(() => {
    if (!currentUser?.email) {
      setLiveActiveSeconds(0)
      setLiveInactiveSeconds(0)
      setIsInitialized(false)
      setLastActivityState(null)
      setIsBreakActive(false)
      console.log('User logged out, resetting timer state')
    }
  }, [currentUser?.email])

  // Fetch break status from API - only when user changes
  useEffect(() => {
    const fetchBreakStatus = async () => {
      if (!currentUser?.id) return
      
      try {
        const response = await fetch(`/api/breaks/status?agent_user_id=${currentUser.id}`)
        const data = await response.json()
        
        if (data.success) {
          setIsBreakActive(data.status.is_on_break)
          setBreakStatus(data.status.active_break)
        }
      } catch (error) {
        console.error('Error fetching break status:', error)
      }
    }

    // Fetch immediately when user changes
    fetchBreakStatus()
    
    // No continuous polling - break status will be updated when user takes actions
    // The timer will continue running and only pause/resume based on current state
  }, [currentUser?.id])



  // Use the Socket.IO timer hook
  const { 
    timerData, 
    connectionStatus, 
    error, 
    setActivityState, 
    isAuthenticated,
    updateTimerData
  } = useSocketTimer(currentUser?.email || null)

  // Update live counters when timer data changes
  useEffect(() => {
    if (timerData && !isInitialized) {
      // Initialize with server data only
      setLiveActiveSeconds(timerData.activeSeconds || 0)
      setLiveInactiveSeconds(timerData.inactiveSeconds || 0)
      setLastActivityState(timerData.isActive)
      
      // Extract shift information
      if (timerData.shiftInfo) {
        setShiftInfo(timerData.shiftInfo)
        setTimeUntilReset(timerData.shiftInfo.timeUntilReset || 0)
        setFormattedTimeUntilReset(timerData.shiftInfo.formattedTimeUntilReset || '')
        console.log('⏰ Shift info loaded:', timerData.shiftInfo)
      }
      
      setIsInitialized(true)
      console.log('Timer initialized with server data:', timerData)
    } else if (timerData && isInitialized) {
      // After initialization, only update activity state, not the counters
      // This prevents flashing as the local counter continues running
      setLastActivityState(timerData.isActive)
      
      // Update shift information if it changes
      if (timerData.shiftInfo) {
        setShiftInfo(timerData.shiftInfo)
        setTimeUntilReset(timerData.shiftInfo.timeUntilReset || 0)
        setFormattedTimeUntilReset(timerData.shiftInfo.formattedTimeUntilReset || '')
      }
    }
  }, [timerData, isInitialized])

  // Force initialization after a timeout if timer data doesn't arrive
  useEffect(() => {
    if (currentUser?.email && !isInitialized && isAuthenticated) {
      const timeout = setTimeout(() => {
        if (!isInitialized) {
          console.log('Force initializing timer after timeout')
          setIsInitialized(true)
          setLastActivityState(false) // Default to inactive
        }
      }, 5000) // 5 second timeout

      return () => clearTimeout(timeout)
    }
  }, [currentUser?.email, isInitialized, isAuthenticated])

  // Real-time stopwatch effect - only when authenticated and logged in
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn) return

    // Start real-time counting immediately
    const interval = setInterval(() => {
      // Check if break is active and not paused (emergency pause)
      const isBreakPaused = breakStatus?.is_paused === true
      
      // Pause counting when on break AND break is not paused (emergency pause)
      if (isBreakActive && !isBreakPaused) {
        return // Don't increment counters when on break (but resume when paused)
      }
      
      // Pause counting when in a meeting
      if (isInMeeting) {
        return // Don't increment counters when in a meeting
      }
      
      // Use timerData.isActive if available, otherwise use lastActivityState
      const isActive = timerData ? timerData.isActive : lastActivityState
      
      if (isActive) {
        setLiveActiveSeconds(prev => prev + 1)
      } else {
        setLiveInactiveSeconds(prev => prev + 1)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerData?.isActive, lastActivityState, isAuthenticated, hasLoggedIn, isBreakActive, breakStatus?.is_paused, isInMeeting])

  // Real-time countdown timer for shift reset
  useEffect(() => {
    if (!shiftInfo || !isAuthenticated || !hasLoggedIn) return

    const countdownInterval = setInterval(() => {
      const currentTime = new Date()
      const nextResetTime = new Date(shiftInfo.nextResetTime)
      const timeRemaining = nextResetTime.getTime() - currentTime.getTime()
      
      if (timeRemaining <= 0) {
        // Reset time has passed, clear the countdown
        setTimeUntilReset(0)
        setFormattedTimeUntilReset('0s')
        console.log('⏰ Shift reset time has passed')
        // Notify other layers to force a reset sync
        window.dispatchEvent(new CustomEvent('shiftResetCountdownZero'))
      } else {
        // Update countdown
        setTimeUntilReset(timeRemaining)
        
        // Format the remaining time
        const seconds = Math.floor(timeRemaining / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)

        let formatted = ''
        if (days > 0) {
          formatted = `${days}d ${hours % 24}h ${minutes % 60}m`
        } else if (hours > 0) {
          formatted = `${hours}h ${minutes % 60}m`
        } else if (minutes > 0) {
          formatted = `${minutes}m ${seconds % 60}s`
        } else {
          formatted = `${seconds}s`
        }
        
        setFormattedTimeUntilReset(formatted)
      }
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [shiftInfo, isAuthenticated, hasLoggedIn])

  // Listen for shift reset events from server
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn) return

    const handleShiftReset = (event: CustomEvent) => {
      const resetData = event.detail
      console.log('🔄 Shift reset event received in timer context:', resetData)
      
      // Reset local timers to match server data
      setLiveActiveSeconds(resetData.activeSeconds || 0)
      setLiveInactiveSeconds(resetData.inactiveSeconds || 0)
      setLastActivityState(resetData.isActive)
      
      // Show notification to user about the reset
      if (resetData.resetReason === 'shift_change') {
        // You can add a toast notification here if you have a notification system
        console.log('⏰ Timer reset due to shift change')
      }
    }

    // Listen for shift reset events
    window.addEventListener('shiftReset', handleShiftReset as EventListener)

    return () => {
      window.removeEventListener('shiftReset', handleShiftReset as EventListener)
    }
  }, [isAuthenticated, hasLoggedIn])

  // Sync live timer values to Socket.IO server (less frequent to prevent flashing)
  useEffect(() => {
    if (timerData && isAuthenticated && hasLoggedIn) {
      const serverActive = timerData.activeSeconds || 0
      const serverInactive = timerData.inactiveSeconds || 0
      
      // Only sync if there's a significant difference (more than 5 seconds)
      // This prevents constant syncing that causes flashing
      if (Math.abs(liveActiveSeconds - serverActive) > 5 || Math.abs(liveInactiveSeconds - serverInactive) > 5) {
        updateTimerData(liveActiveSeconds, liveInactiveSeconds);
      }
    }
  }, [liveActiveSeconds, liveInactiveSeconds, timerData, updateTimerData, isAuthenticated, hasLoggedIn]);

  // Activity detection - use Electron activity tracking if available
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn) return

    // Check if we're in Electron environment
    if (window.electronAPI) {
      // Use Electron activity tracking
      const handleActivityUpdate = () => {
        setActivityState(true);
      };

      const handleInactivityAlert = () => {
        setActivityState(false);
      };

      const handleActivityReset = () => {
        setActivityState(true);
      };

      // Listen for Electron activity events
      if (window.electronAPI.receive) {
        window.electronAPI.receive('activity-update', handleActivityUpdate);
        window.electronAPI.receive('inactivity-alert', handleInactivityAlert);
        window.electronAPI.receive('activity-reset', handleActivityReset);
      }

      return () => {
        if (window.electronAPI && window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('activity-update');
          window.electronAPI.removeAllListeners('inactivity-alert');
          window.electronAPI.removeAllListeners('activity-reset');
        }
      };
    } else {
      // Fallback to browser-based activity detection
      let activityTimeout: NodeJS.Timeout
      let isCurrentlyActive = false

      const handleActivity = () => {
        if (!isCurrentlyActive) {
          isCurrentlyActive = true
          setActivityState(true)
        }
        
        // Clear existing timeout
        if (activityTimeout) {
          clearTimeout(activityTimeout)
        }
        
        // Set timeout for inactivity (30 seconds for faster response)
        activityTimeout = setTimeout(() => {
          isCurrentlyActive = false
          setActivityState(false)
        }, 30 * 1000) // 30 seconds instead of 5 minutes
      }

      // Add event listeners for activity detection
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
      
      events.forEach(event => {
        document.addEventListener(event, handleActivity, true)
      })

      // Initial activity state
      handleActivity()

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleActivity, true)
        })
        if (activityTimeout) {
          clearTimeout(activityTimeout)
        }
      }
    }
  }, [isAuthenticated, hasLoggedIn, setActivityState])

  const refreshBreakStatus = async () => {
    if (!currentUser?.id) return
    
    try {
      const response = await fetch(`/api/breaks/status?agent_user_id=${currentUser.id}`)
      const data = await response.json()
      
      if (data.success) {
        setIsBreakActive(data.status.is_on_break)
        setBreakStatus(data.status.active_break)
      }
    } catch (error) {
      console.error('Error refreshing break status:', error)
    }
  }

  const value = {
    timerData,
    connectionStatus,
    error,
    isAuthenticated,
    liveActiveSeconds,
    liveInactiveSeconds,
    isInitialized,
    isBreakActive,
    breakStatus,
    lastActivityState,
    setActivityState,
    updateTimerData,
    refreshBreakStatus,
    shiftInfo,
    timeUntilReset,
    formattedTimeUntilReset
  }

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
} 