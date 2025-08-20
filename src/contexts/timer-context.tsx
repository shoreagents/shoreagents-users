"use client"

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react'
import { useSocketTimer } from '@/hooks/use-socket-timer'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useActivity } from './activity-context'
import { useMeeting } from '@/contexts/meeting-context'
import { isBreakTimeValid, getBreaksForShift } from '@/lib/shift-break-utils'
import { parseShiftTime } from '@/lib/shift-utils'

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
  const [userProfile, setUserProfile] = useState<any>(null)
  const [availableBreaks, setAvailableBreaks] = useState<any[]>([])
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

  // Load user profile and generate available breaks for background auto-ending
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!currentUser?.email) return
      
      try {
        const response = await fetch(`/api/profile/?email=${encodeURIComponent(currentUser.email)}`)
        const data = await response.json()
        
        if (data.success && data.profile) {
          const profile = data.profile
          setUserProfile({
            shift_period: profile.shift_period,
            shift_schedule: profile.shift_schedule,
            shift_time: profile.shift_time
          })

          // Generate available breaks based on shift
          const shiftInfo = {
            shift_period: profile.shift_period || '',
            shift_schedule: profile.shift_schedule || '',
            shift_time: profile.shift_time || ''
          }
          
          const breaks = getBreaksForShift(shiftInfo)
          setAvailableBreaks(breaks)
        }
      } catch (error) {
        console.error('Error loading user profile for background auto-ending:', error)
      }
    }

    loadUserProfile()
  }, [currentUser?.email])

  // Request notification permissions for break auto-ending notifications
  useEffect(() => {
    if (currentUser?.email && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('✅ Notification permission granted for break auto-ending alerts')
          } else {
            console.log('❌ Notification permission denied for break auto-ending alerts')
          }
        })
      }
    }
  }, [currentUser?.email])

  /**
   * Background Service: Auto-End Invalid Paused Breaks
   * 
   * This service runs globally across all pages and automatically ends breaks that are:
   * 1. Currently paused (not active)
   * 2. Outside their valid time window
   * 
   * It runs every 10 seconds to ensure responsive auto-ending even when the agent
   * is not on the break page. This prevents agents from having indefinitely
   * paused breaks that accumulate time outside their scheduled break windows.
   * 
   * The service also sends notifications to inform the agent about auto-ended breaks.
   */
  useEffect(() => {
    if (!currentUser?.id || !breakStatus?.active_break || !userProfile || availableBreaks.length === 0) {
      return
    }

    const checkAndEndInvalidBreaks = async () => {
      try {
        const currentBreak = breakStatus.active_break
        const breakInfo = availableBreaks.find(b => b.id === currentBreak.break_type)
        
        if (!breakInfo) return

        // Only auto-end paused breaks that are outside their valid time window
        // Active breaks should continue running even if outside the time window
        if (currentBreak.is_paused && !isBreakTimeValid(breakInfo, userProfile, new Date())) {
          console.log(`⏰ Background auto-ending paused ${breakInfo.name} - outside valid time window (${breakInfo.startTime} - ${breakInfo.endTime})`)
          
          try {
            // End the break automatically via API
            const response = await fetch('/api/breaks/end', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_user_id: currentUser.id
              })
            })
            
            const result = await response.json()
            
            if (result.success) {
              console.log(`✅ Background auto-ended paused ${breakInfo.name} successfully`)
              
              // Update local state
              setIsBreakActive(false)
              setBreakStatus(null)
              
              // Clear any localStorage break data
              if (typeof window !== 'undefined') {
                localStorage.removeItem('currentBreak')
              }
              
              // Show notification to user about auto-ended break
              if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                  new Notification('Break Auto-Ended', {
                    body: `Your paused ${breakInfo.name} break was automatically ended because it was outside the valid time window (${breakInfo.startTime} - ${breakInfo.endTime}).`,
                    icon: '/shoreagents-logo.png',
                    tag: 'break-auto-ended',
                    requireInteraction: false
                  })
                }
              }
              
              // Also show a browser alert if notifications are not available
              if (typeof window !== 'undefined' && (!('Notification' in window) || Notification.permission !== 'granted')) {
                alert(`Your paused ${breakInfo.name} break was automatically ended because it was outside the valid time window.`)
              }
              
              // Refresh break status to ensure consistency
              await refreshBreakStatus()
            } else {
              console.log(`⚠️ Background auto-end failed for ${breakInfo.name}:`, result.error)
            }
          } catch (error) {
            console.error(`❌ Error in background auto-ending ${breakInfo.name}:`, error)
          }
        }
      } catch (error) {
        console.error('Error in background break validation:', error)
      }
    }

    // Check immediately when break status changes
    checkAndEndInvalidBreaks()

    // Set up interval to check every 10 seconds for more responsive background auto-ending
    const interval = setInterval(() => {
      console.log(`🔍 Background checking break validity for ${breakStatus.active_break.break_type}...`)
      checkAndEndInvalidBreaks()
    }, 10000)

    return () => clearInterval(interval)
  }, [currentUser?.id, breakStatus?.active_break, userProfile, availableBreaks])

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
      // Guard: do not count before shift start or after shift end (Philippines time)
      try {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        let shiftStartDate: Date | null = null
        let shiftEndDate: Date | null = null
        
        if (shiftInfo?.startTime && shiftInfo?.endTime) {
          shiftStartDate = new Date(shiftInfo.startTime)
          shiftEndDate = new Date(shiftInfo.endTime)
        } else if (userProfile?.shift_time) {
          const parsed = parseShiftTime(userProfile.shift_time, nowPH)
          if (parsed?.startTime && parsed?.endTime) {
            shiftStartDate = parsed.startTime
            shiftEndDate = parsed.endTime
          }
        }
        
        // Stop counting before shift start
        if (shiftStartDate && nowPH < shiftStartDate) {
          return // Skip counting until shift start
        }
        
        // Stop counting after shift end
        if (shiftEndDate && nowPH > shiftEndDate) {
          return // Skip counting after shift end
        }
      } catch (_) {
        // ignore guard errors; fallback to counting rules below
      }

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
      
      // IMPROVED ACTIVITY STATE DETERMINATION
      // Priority order: server state > local state > fallback
      let isActive = false
      
      if (timerData && timerData.isActive !== undefined) {
        // Use server state as primary source of truth
        isActive = timerData.isActive
      } else if (lastActivityState !== null) {
        // Fall back to local state if server state unavailable
        isActive = lastActivityState
      } else {
        // Default fallback: assume active if we can't determine
        // This prevents false inactive counting
        isActive = true
        console.log('⚠️ Activity state unclear, defaulting to active to prevent false inactive counting')
      }
      
      // ADDITIONAL SAFETY CHECKS
      // If we have recent activity data from server, trust it more than local state
      if (timerData && timerData.activeSeconds !== undefined && timerData.inactiveSeconds !== undefined) {
        // Server has recent data - use server's activity state
        isActive = timerData.isActive
      }
      
      // Log activity state changes for debugging
      if (isActive !== lastActivityState) {
        console.log(`🔄 Activity state changed: ${lastActivityState} → ${isActive} (Server: ${timerData?.isActive}, Local: ${lastActivityState})`)
      }
      
      // Update counters based on determined activity state
      if (isActive) {
        setLiveActiveSeconds(prev => prev + 1)
      } else {
        // Only count inactive time if we're confident the user is actually inactive
        // Add additional validation to prevent false inactive counting
        const shouldCountInactive = validateInactiveState(timerData, lastActivityState)
        
        if (shouldCountInactive) {
          setLiveInactiveSeconds(prev => prev + 1)
        } else {
          // If we can't validate inactive state, default to active to prevent false counting
          console.log('⚠️ Inactive state validation failed, defaulting to active counting')
          setLiveActiveSeconds(prev => prev + 1)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerData?.isActive, lastActivityState, isAuthenticated, hasLoggedIn, isBreakActive, breakStatus?.is_paused, isInMeeting, shiftInfo, userProfile])

  // Helper function to validate if we should actually count inactive time
  const validateInactiveState = useCallback((timerData: any, lastActivityState: boolean | null): boolean => {
    // If server explicitly says inactive, trust it
    if (timerData && timerData.isActive === false) {
      return true
    }
    
    // If local state says inactive but we have recent server data that says active
    if (lastActivityState === false && timerData && timerData.isActive === true) {
      console.log('🔄 Local inactive state overridden by server active state')
      return false
    }
    
    // If we have no clear indication, be conservative and don't count inactive
    if (lastActivityState === null && !timerData) {
      return false
    }
    
    // Only count inactive if we have a clear, consistent inactive state
    return lastActivityState === false
  }, [])

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
      // Guard: do not sync timer data before shift start or after shift end (Philippines time)
      try {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        let shiftStartDate: Date | null = null
        let shiftEndDate: Date | null = null
        
        if (shiftInfo?.startTime && shiftInfo?.endTime) {
          shiftStartDate = new Date(shiftInfo.startTime)
          shiftEndDate = new Date(shiftInfo.endTime)
        } else if (userProfile?.shift_time) {
          const parsed = parseShiftTime(userProfile.shift_time, nowPH)
          if (parsed?.startTime && parsed?.endTime) {
            shiftStartDate = parsed.startTime
            shiftEndDate = parsed.endTime
          }
        }
        
        // Stop syncing before shift start
        if (shiftStartDate && nowPH < shiftStartDate) {
          return // Skip syncing until shift start
        }
        
        // Stop syncing after shift end
        if (shiftEndDate && nowPH > shiftEndDate) {
          return // Skip syncing after shift end
        }
      } catch (_) {
        // ignore guard errors; fallback to sync logic below
      }

      const serverActive = timerData.activeSeconds || 0
      const serverInactive = timerData.inactiveSeconds || 0
      
      // Only sync if there's a significant difference (more than 5 seconds)
      // This prevents constant syncing that causes flashing
      if (Math.abs(liveActiveSeconds - serverActive) > 5 || Math.abs(liveInactiveSeconds - serverInactive) > 5) {
        updateTimerData(liveActiveSeconds, liveInactiveSeconds);
      }
    }
  }, [liveActiveSeconds, liveInactiveSeconds, timerData, updateTimerData, isAuthenticated, hasLoggedIn, shiftInfo, userProfile]);

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