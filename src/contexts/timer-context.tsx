"use client"

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react'
import { useSocketTimerContext } from '@/hooks/use-socket-timer-context'
import { useSocket } from '@/contexts/socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useAuth } from './auth-context'
import { useMeeting } from '@/contexts/meeting-context'
import { useEventsContext } from './events-context'
import { useHealth } from './health-context'
import { useRestroom } from './restroom-context'
import { useProfileContext } from './profile-context'
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
  
  // Real-time activity data
  realtimeActivityData: any
  lastRealtimeUpdate: Date | null
  isRealtimeConnected: boolean
  refreshRealtimeData: () => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { profile, isLoading: profileLoading } = useProfileContext()
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
  
  // CRITICAL: Prevent timer value conflicts during resets
  const [isResetting, setIsResetting] = useState(false)
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Track when a meeting just ended to force active state
  const meetingJustEndedRef = useRef(false)
  
  // Track system lock state to prevent inactive timer counting during lock
  const [isSystemLocked, setIsSystemLocked] = useState(false)
  
  // Real-time activity data state
  const [realtimeActivityData, setRealtimeActivityData] = useState<any>(null)
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  
  const { hasLoggedIn } = useAuth()
  const { isInMeeting } = useMeeting()
  const { isInEvent } = useEventsContext()
  const { isGoingToClinic, isInClinic } = useHealth()
  const { isInRestroom } = useRestroom()

  // Helper functions
  const refreshBreakStatus = useCallback(async () => {
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
  }, [currentUser?.id])

  // Refresh real-time activity data
  const refreshRealtimeData = useCallback(async () => {
    if (!currentUser?.id) return

    try {
      const response = await fetch(`/api/activity?userId=${currentUser.id}`)
      if (response.ok) {
        const data = await response.json()
        setRealtimeActivityData(data)
        setLastRealtimeUpdate(new Date())
        setIsRealtimeConnected(true)
        
        // Update live counters
        setLiveActiveSeconds(data.today_active_seconds || 0)
        setLiveInactiveSeconds(data.today_inactive_seconds || 0)
      }
    } catch (error) {
      console.error('Error refreshing real-time activity data:', error)
      setIsRealtimeConnected(false)
    }
  }, [currentUser?.id])

  // Helper function to validate if we should actually count inactive time
  const validateInactiveState = useCallback((timerData: any, lastActivityState: boolean | null): boolean => {
    // PRIORITY 1: If local state explicitly says inactive, trust it (from inactivity detection)
    if (lastActivityState === false) {
      return true
    }
    
    // PRIORITY 2: If server explicitly says inactive, trust it
    if (timerData && timerData.isActive === false) {
      return true
    }
    
    // PRIORITY 3: If local state says active, don't count inactive
    if (lastActivityState === true) {
      return false
    }
    
    // If we have no clear indication, be conservative and don't count inactive
    if (lastActivityState === null && !timerData) {
      return false
    }
    
    // MEETING END RESUME: Prevent inactive counting when meeting just ended
    // This ensures the timer resumes active counting after meetings end
    if (!isInMeeting && !isBreakActive && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom) {
      // If meeting just ended, prevent inactive counting
      if (meetingJustEndedRef.current) {
        return false
      }
      // Normal case: allow inactive counting if explicitly set
    }
    
    // Default: don't count inactive unless explicitly set
    return false
  }, [isInMeeting, isBreakActive, isInEvent, isGoingToClinic, isInClinic, isInRestroom])

  // Get current user
  useEffect(() => {
    const user = getCurrentUser()
    if (user?.email !== currentUser?.email) {
      // User changed, reset timer state completely
      setLiveActiveSeconds(0)
      setLiveInactiveSeconds(0)
      setIsInitialized(false)
      setLastActivityState(null)
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
    }
  }, [currentUser?.email])

  // Load user profile and generate available breaks for background auto-ending
  useEffect(() => {
    if (!profile) return
    
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
  }, [profile])

  // Request notification permissions for break auto-ending notifications
  useEffect(() => {
    if (currentUser?.email && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
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
              
              // Update local state
              setIsBreakActive(false)
              setBreakStatus(null)
              
              // Clear any localStorage break data
              if (typeof window !== 'undefined') {
                localStorage.removeItem('currentBreak')
              }
              
              // Show notification to user about auto-ended break
              if (typeof window !== 'undefined' && window.electronAPI?.systemNotifications) {
                window.electronAPI.systemNotifications.show({
                  title: 'Break Auto-Ended',
                  message: `Your paused ${breakInfo.name} break was automatically ended because it was outside the valid time window (${breakInfo.startTime} - ${breakInfo.endTime}).`,
                  id: `break-auto-ended-${Date.now()}`
                }).catch((error) => {
                  console.error('Error showing break auto-ended notification:', error)
                })
              } else if (typeof window !== 'undefined' && 'Notification' in window) {
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
            } 
          } catch (error) {
            console.error(`Error in background auto-ending ${breakInfo.name}:`, error)
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
      checkAndEndInvalidBreaks()
    }, 10000)

    return () => clearInterval(interval)
  }, [currentUser?.id, breakStatus?.active_break, userProfile, availableBreaks, refreshBreakStatus])

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
  } = useSocketTimerContext(currentUser?.email || null)
  
  const { socket } = useSocket()

  // Real-time activity data listener
  useEffect(() => {
    if (!currentUser?.id || !isAuthenticated) return
    // Note: Initial data will be fetched when the component mounts
    
    // Listen for real-time activity data updates from the socket
    const handleActivityDataUpdate = (update: any) => {
      if (update.user_id === currentUser.id) {
        setRealtimeActivityData(update.data)
        setLastRealtimeUpdate(new Date())
        setIsRealtimeConnected(true)
        
        // Handle different types of updates
        if (update.action === 'INSERT') {
          // New row created (e.g., new day, new shift) - fetch fresh data
          refreshRealtimeData()
        } else if (update.action === 'UPDATE') {
          // Existing row updated - update live counters with real-time data
          if (update.data.today_active_seconds !== undefined) {
            setLiveActiveSeconds(update.data.today_active_seconds)
          }
          if (update.data.today_inactive_seconds !== undefined) {
            setLiveInactiveSeconds(update.data.today_inactive_seconds)
          }
        }
      }
    }

    // Set up socket listener if available
    if (typeof window !== 'undefined' && (window as any).socket) {
      const socket = (window as any).socket
      
      socket.on('activity-data-updated', handleActivityDataUpdate)
      socket.on('connect', () => {
        setIsRealtimeConnected(true)
      })
      socket.on('disconnect', () => {
        setIsRealtimeConnected(false)
      })

      return () => {
        socket.off('activity-data-updated', handleActivityDataUpdate)
        socket.off('connect')
        socket.off('disconnect')
      }
    }
  }, [currentUser?.id, isAuthenticated, refreshRealtimeData])

  // Fetch initial activity data when component mounts
  useEffect(() => {
    if (currentUser?.id && isAuthenticated) {
      refreshRealtimeData()
    }
  }, [currentUser?.id, isAuthenticated, refreshRealtimeData])

  // Update live counters when timer data changes from socket
  useEffect(() => {
    // Validate that timer data is for the current user
    if (timerData && timerData.email && currentUser?.email && timerData.email !== currentUser.email) {
      console.warn(`Timer data received for wrong user: expected ${currentUser.email}, got ${timerData.email}`)
      return
    }
    
    // Only process socket timer data if we haven't already initialized from direct API fetch
    if (timerData && !isInitialized) {
      // Initialize with server data (now includes proper database hydration)
      setLiveActiveSeconds(timerData.activeSeconds || 0)
      setLiveInactiveSeconds(timerData.inactiveSeconds || 0)
      setLastActivityState(timerData.isActive)
      
      // Extract shift information
      if (timerData.shiftInfo) {
        setShiftInfo(timerData.shiftInfo)
        setTimeUntilReset(timerData.shiftInfo.timeUntilReset || 0)
        setFormattedTimeUntilReset(timerData.shiftInfo.formattedTimeUntilReset || '')
      }
      
      setIsInitialized(true)
    } else if (timerData && isInitialized) {
      // After initialization, accept counter updates from server if they're significantly higher
      // This allows for database hydration updates and server corrections
      const serverActive = timerData.activeSeconds || 0
      const serverInactive = timerData.inactiveSeconds || 0
      
      // Update counters if server values are significantly higher (database sync)
      if (serverActive > liveActiveSeconds && (serverActive - liveActiveSeconds) > 5) {
        setLiveActiveSeconds(serverActive)
      }
      
      if (serverInactive > liveInactiveSeconds && (serverInactive - liveInactiveSeconds) > 5) {
        setLiveInactiveSeconds(serverInactive)
      }
      
      // Always update activity state
      setLastActivityState(timerData.isActive)
      
      // Update shift information if it changes
      if (timerData.shiftInfo) {
        setShiftInfo(timerData.shiftInfo)
        setTimeUntilReset(timerData.shiftInfo.timeUntilReset || 0)
        setFormattedTimeUntilReset(timerData.shiftInfo.formattedTimeUntilReset || '')
      }
    }
  }, [timerData, isInitialized, liveActiveSeconds, liveInactiveSeconds, currentUser?.email])

  // Force initialization after a timeout if timer data doesn't arrive
  useEffect(() => {
    if (currentUser?.email && !isInitialized && isAuthenticated) {
      const timeout = setTimeout(() => {
        if (!isInitialized) {
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

    // Start real-time counting immediately - Changed back to 1s intervals for real-time updates
    const interval = setInterval(() => {
      // Guard: do not count before shift start or after shift end (Philippines time)
      try {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        let shiftStartDate: Date | null = null
        let shiftEndDate: Date | null = null
        
        if (userProfile?.shift_time) {
          // Always use the proper parseShiftTime function for consistent parsing
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
          // Automatically set user to inactive when shift ends
          // This will be handled by the activity state determination below
          return // Skip counting after shift end
        }
        
        // Within shift hours - no logging needed
      } catch (error) {
        console.error('Error in shift time validation:', error)
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
      
      // Pause counting when in an event
      if (isInEvent) {
        return // Don't increment counters when in an event
      }
      
      // Pause counting when going to clinic or in clinic
      if (isGoingToClinic || isInClinic) {
        return // Don't increment counters when in health check
      }
      
      // Pause counting when in restroom
      if (isInRestroom) {
        return // Don't increment counters when in restroom
      }
      
      // CRITICAL: Check if shift has ended BEFORE determining activity state
      // This ensures the timer stops immediately when shift ends
      try {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        let shiftEndDate: Date | null = null
        
        if (userProfile?.shift_time) {
          const parsed = parseShiftTime(userProfile.shift_time, nowPH)
          if (parsed?.endTime) {
            shiftEndDate = parsed.endTime
          }
        }
        
        // If shift has ended, stop counting entirely
        if (shiftEndDate && nowPH > shiftEndDate) {
          // Set user to inactive when shift ends
          setActivityState(false);
          // Update database immediately when shift ends
          updateTimerData(liveActiveSeconds, liveInactiveSeconds);
          
          // Dispatch shift end event for restroom auto-reset
          try {
            const event = new CustomEvent('shift-ended', {
              detail: {
                timestamp: new Date().toISOString(),
                shiftEndTime: shiftEndDate.toISOString()
              }
            });
            window.dispatchEvent(event);
          } catch (error) {
            console.error('Error dispatching shift end event:', error);
          }
          
          return // CRITICAL: Stop counting after shift end
        }
      } catch (error) {
        // Ignore errors in shift end check
      }

      // IMPROVED ACTIVITY STATE DETERMINATION
      // Priority order: local activity state > server state > fallback
      let isActive = false
      
      // PRIORITY 1: If we have recent local activity, trust it over server state
      if (lastActivityState === true) {
        isActive = true
      } else if (timerData && timerData.isActive !== undefined) {
        // PRIORITY 2: Use server state if no recent local activity
        isActive = timerData.isActive
      } else if (lastActivityState === false) {
        // PRIORITY 3: Use local inactive state if no server data
        isActive = false
      } else {
        // PRIORITY 4: Default fallback: assume active if we can't determine
        // This prevents false inactive counting
        isActive = true
      }
      
      // ADDITIONAL SAFETY CHECKS
      // If we have recent activity data from server, trust it more than local state
      // BUT: Don't override local state if it was explicitly set by inactivity detection
      if (timerData && timerData.activeSeconds !== undefined && timerData.inactiveSeconds !== undefined) {
        // Only use server state if local state is null/undefined (not explicitly set)
        // This allows inactivity detection to work properly
        if (lastActivityState === null) {
          isActive = timerData.isActive
        }
      }
      
      // MEETING END RESUME LOGIC
      // If we just ended a meeting and no other status is active, FORCE active state
      // This prevents the timer from staying inactive after meetings end
      if (!isInMeeting && !isBreakActive && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom) {
        // If meeting just ended, FORCE active state regardless of current state
        if (meetingJustEndedRef.current) {
          isActive = true
        } else {
          // Normal case: use existing logic
          if (lastActivityState !== false) {
            isActive = true
          }
        }
      }
      
      // Activity state determined - no logging needed
      
      
      // Update counters based on determined activity state - Changed back to 1 second increments
      if (isActive) {
        setLiveActiveSeconds(prev => {
          const newValue = prev + 1 // Changed back to 1 second increments for real-time updates
          return newValue
        })
      } else {
        // Only count inactive time if we're confident the user is actually inactive
        // Add additional validation to prevent false inactive counting
        const shouldCountInactive = validateInactiveState(timerData, lastActivityState)
        
        if (shouldCountInactive) {
          setLiveInactiveSeconds(prev => {
            const newValue = prev + 1 // Changed back to 1 second increments for real-time updates
            return newValue
          })
        } else {
          // If we can't validate inactive state, default to active to prevent false counting
          setLiveActiveSeconds(prev => prev + 1) // Changed back to 1 second increments for real-time updates
        }
      }
    }, 1000) // Changed back to 1000ms (1 second) for real-time updates

    return () => clearInterval(interval)
  }, [timerData?.isActive, lastActivityState, isAuthenticated, hasLoggedIn, isBreakActive, breakStatus?.is_paused, isInMeeting, isInEvent, isGoingToClinic, isInClinic, isInRestroom, shiftInfo, userProfile, liveActiveSeconds, liveInactiveSeconds, setActivityState, updateTimerData, validateInactiveState, timerData, isSystemLocked])


  // Real-time countdown timer for shift reset
  useEffect(() => {
    if (!shiftInfo || !isAuthenticated || !hasLoggedIn) return

    let hasDispatchedReset = false // Track if we've already dispatched the reset event

    const countdownInterval = setInterval(() => {
      const currentTime = new Date()
      const nextResetTime = new Date(shiftInfo.nextResetTime)
      const timeRemaining = nextResetTime.getTime() - currentTime.getTime()
      
      if (timeRemaining <= 0) {
        // Reset time has passed, clear the countdown
        setTimeUntilReset(0)
        setFormattedTimeUntilReset('0s')
        
        // Only dispatch the reset event ONCE when we first reach zero
        if (!hasDispatchedReset) {
          hasDispatchedReset = true
          window.dispatchEvent(new CustomEvent('shiftResetCountdownZero'))
        }
      } else {
        // Reset the flag when we're no longer at zero
        hasDispatchedReset = false
        
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

  // Cleanup reset timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  // Handle shift reset events from Socket.IO
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn || !socket) {
      return
    }

    const handleShiftReset = (resetData: any) => {
      // Prevent multiple reset sources from fighting over timer values
      if (isResetting) {
        return
      }
      
      setIsResetting(true)
      
      // Clear any existing reset timeout
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
      
      // Reset local timers to match server data
      setLiveActiveSeconds(resetData.activeSeconds || 0)
      setLiveInactiveSeconds(resetData.inactiveSeconds || 0)
      setLastActivityState(resetData.isActive)
      
      // CRITICAL: Reset activity state to ensure tracking resumes
      if (resetData.isActive !== undefined) {
        setActivityState(resetData.isActive)
      }
      
      // Force activity tracking to resume if user should be active
      if (resetData.isActive) {
        // Trigger a small activity to wake up the tracking
        setTimeout(() => {
          setActivityState(true)
        }, 100)
      }
      
      // CRITICAL: Dispatch shift reset event to restart activity tracking
      // This ensures inactivity detection is properly reinitialized
      try {
        const event = new CustomEvent('shift-reset-detected', {
          detail: {
            resetData,
            timestamp: new Date().toISOString(),
            isActive: resetData.isActive
          }
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Error dispatching shift reset event:', error);
      }
      
      // Allow timer updates again after a short delay
      resetTimeoutRef.current = setTimeout(() => {
        setIsResetting(false)
      }, 2000) // 2 second lock to prevent conflicts
    }

    const handleTimerUpdated = (timerData: any) => {
      // CRITICAL: Always allow server reset events (when both values are 0)
      const isServerReset = timerData.activeSeconds === 0 && timerData.inactiveSeconds === 0
      
      // Only block non-reset updates during reset to prevent conflicts
      if (isResetting && !isServerReset) {
        return
      }
      
      // Update local timers to match server data
      setLiveActiveSeconds(timerData.activeSeconds || 0)
      setLiveInactiveSeconds(timerData.inactiveSeconds || 0)
      setLastActivityState(timerData.isActive)
      
      // CRITICAL: Update activity state to ensure tracking continues
      if (timerData.isActive !== undefined) {
        setActivityState(timerData.isActive)
      }
    }

    // Listen for Socket.IO events
    socket.on('shiftReset', handleShiftReset)
    socket.on('timerUpdated', handleTimerUpdated)
    
    return () => {
      socket.off('shiftReset', handleShiftReset)
      socket.off('timerUpdated', handleTimerUpdated)
      socket.offAny()
    }
  }, [isAuthenticated, hasLoggedIn, socket, isResetting, timerData, setActivityState])

  // Handle shift reset countdown reaching zero (fallback for manual reset)
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn) return

    const handleShiftResetCountdownZero = () => {
      // Prevent multiple reset sources from fighting over timer values
      if (isResetting) {
        return
      }
      
      // Check if we already have recent server data (server might have already reset)
      if (timerData && timerData.activeSeconds === 0 && timerData.inactiveSeconds === 0) {
        return
      }
      
      setIsResetting(true)
      
      // Clear any existing reset timeout
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
      
      // Reset local timers to 0 when countdown reaches zero
      setLiveActiveSeconds(0)
      setLiveInactiveSeconds(0)
      
      
      // Allow timer updates again after a short delay
      resetTimeoutRef.current = setTimeout(() => {
        setIsResetting(false)
      }, 2000) // 2 second lock to prevent conflicts
    }

    // Listen for custom DOM event (fallback)
    window.addEventListener('shiftResetCountdownZero', handleShiftResetCountdownZero)

    return () => {
      window.removeEventListener('shiftResetCountdownZero', handleShiftResetCountdownZero)
    }
  }, [isAuthenticated, hasLoggedIn, isResetting, timerData])

  // Sync live timer values to Socket.IO server (less frequent to prevent flashing)
  useEffect(() => {
    if (timerData && isAuthenticated && hasLoggedIn) {
      // Guard: do not sync timer data before shift start or after shift end (Philippines time)
      try {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        let shiftStartDate: Date | null = null
        let shiftEndDate: Date | null = null
        
        if (userProfile?.shift_time) {
          const parsed = parseShiftTime(userProfile.shift_time, nowPH)
          if (parsed?.startTime && parsed?.endTime) {
            if (parsed.isNightShift && nowPH < parsed.startTime) {
              // Anchor night shift to previous day when before today's start
              const adjustedStart = new Date(parsed.startTime)
              adjustedStart.setDate(adjustedStart.getDate() - 1)
              const adjustedEnd = new Date(parsed.endTime)
              adjustedEnd.setDate(adjustedEnd.getDate() - 1)
              shiftStartDate = adjustedStart
              shiftEndDate = adjustedEnd
            } else {
              shiftStartDate = parsed.startTime
              shiftEndDate = parsed.endTime
            }
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
      
      // Sync if there's a difference (reduced from 5 seconds to 1 second for more frequent updates)
      // This ensures the database gets updated regularly
      if (Math.abs(liveActiveSeconds - serverActive) > 1 || Math.abs(liveInactiveSeconds - serverInactive) > 1) {
        updateTimerData(liveActiveSeconds, liveInactiveSeconds);
      }
    }
  }, [liveActiveSeconds, liveInactiveSeconds, timerData, updateTimerData, isAuthenticated, hasLoggedIn, shiftInfo, userProfile]);

  // Force periodic sync to database every 30 seconds to ensure data is saved - OPTIMIZED: Reduced frequency
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn || !timerData) return

    const periodicSync = setInterval(() => {
      // Guard: do not sync timer data before shift start or after shift end (Philippines time)
      try {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        let shiftStartDate: Date | null = null
        let shiftEndDate: Date | null = null
        
        if (userProfile?.shift_time) {
          const parsed = parseShiftTime(userProfile.shift_time, nowPH)
          if (parsed?.startTime && parsed?.endTime) {
            if (parsed.isNightShift && nowPH < parsed.startTime) {
              // Anchor night shift to previous day when before today's start
              const adjustedStart = new Date(parsed.startTime)
              adjustedStart.setDate(adjustedStart.getDate() - 1)
              const adjustedEnd = new Date(parsed.endTime)
              adjustedEnd.setDate(adjustedEnd.getDate() - 1)
              shiftStartDate = adjustedStart
              shiftEndDate = adjustedEnd
            } else {
              shiftStartDate = parsed.startTime
              shiftEndDate = parsed.endTime
            }
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

      // Force sync current timer values to database
      updateTimerData(liveActiveSeconds, liveInactiveSeconds);
    }, 30000); // OPTIMIZED: Every 30 seconds instead of 10

    return () => clearInterval(periodicSync);
  }, [isAuthenticated, hasLoggedIn, timerData, liveActiveSeconds, liveInactiveSeconds, updateTimerData, shiftInfo, userProfile]);

  // Handle meeting end transitions - resume active counting when meeting ends
  useEffect(() => {
    if (!isAuthenticated || !hasLoggedIn) return
    
    // If we just ended a meeting (isInMeeting changed from true to false)
    // and no other status is active, FORCE resume active counting
    if (!isInMeeting && !isBreakActive && !isInEvent && !isGoingToClinic && !isInClinic && !isInRestroom) {
      // Set flag to indicate meeting just ended
      meetingJustEndedRef.current = true
      
      // FORCE active state when meeting ends - this overrides any previous inactive state
      // This ensures the timer resumes active counting after meetings end
      setActivityState(true)
      
      // Clear the flag after a short delay to allow normal inactivity detection to resume
      setTimeout(() => {
        meetingJustEndedRef.current = false
      }, 5000) // 5 seconds grace period
    }
  }, [isInMeeting, isBreakActive, isInEvent, isGoingToClinic, isInClinic, isInRestroom, isAuthenticated, hasLoggedIn, setActivityState])

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

      // Handle system lock events
      const handleSystemLock = () => {
        setIsSystemLocked(true);
        setActivityState(false, true); // true = isSystemEvent
      };

      const handleSystemUnlock = () => {
        setIsSystemLocked(false);
        setActivityState(true, true); // true = isSystemEvent
      };

      // Handle system suspend/resume events
      const handleSystemSuspend = () => {
        setIsSystemLocked(true);
        setActivityState(false, true); // true = isSystemEvent
      };

      const handleSystemResume = () => {
        setIsSystemLocked(false);
        setActivityState(true, true); // true = isSystemEvent
      };

      // Listen for Electron activity events
      if (window.electronAPI.receive) {
        window.electronAPI.receive('activity-update', handleActivityUpdate);
        window.electronAPI.receive('inactivity-alert', handleInactivityAlert);
        window.electronAPI.receive('activity-reset', handleActivityReset);
        window.electronAPI.receive('system-lock', handleSystemLock);
        window.electronAPI.receive('system-unlock', handleSystemUnlock);
        window.electronAPI.receive('system-suspend', handleSystemSuspend);
        window.electronAPI.receive('system-resume', handleSystemResume);
      }

      return () => {
        if (window.electronAPI && window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('activity-update');
          window.electronAPI.removeAllListeners('inactivity-alert');
          window.electronAPI.removeAllListeners('activity-reset');
          window.electronAPI.removeAllListeners('system-lock');
          window.electronAPI.removeAllListeners('system-unlock');
          window.electronAPI.removeAllListeners('system-suspend');
          window.electronAPI.removeAllListeners('system-resume');
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

  // Manual test function to check socket events
  const testSocketEvents = useCallback(() => {
    if (!socket) {
      return
    }
    // Test emitting a test event
    socket.emit('test-event', { message: 'Testing socket connection' })
    
    
  }, [socket])

  // Expose test function for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).testSocketEvents = testSocketEvents;
      (window as any).checkSocketStatus = () => {
        if (!socket) {
          return false
        }
        return socket.connected
      }
    }
  }, [testSocketEvents, socket])

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
    formattedTimeUntilReset,
    
    // Real-time activity data
    realtimeActivityData,
    lastRealtimeUpdate,
    isRealtimeConnected,
    refreshRealtimeData
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


