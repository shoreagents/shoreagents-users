"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Coffee, 
  Utensils, 
  Sun, 
  Clock, 
  Play, 
  Pause, 
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw
} from "lucide-react"
import { BreakTimer } from "@/components/break-timer"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { 
  startBreak, 
  endBreak, 
  pauseBreak,
  resumeBreak,
  getCurrentBreak, 
  getBreakStatus, 
  getBreakHistory,
  getCurrentBreakDuration,
  type BreakType,
  type BreakStatus as DatabaseBreakStatus
} from "@/lib/break-manager"
import { getCurrentUserInfo } from "@/lib/user-profiles"
import { useBreak } from "@/contexts/break-context"
import { useTimer } from "@/contexts/timer-context"
import { useMeeting } from "@/contexts/meeting-context"
import { useEventsContext } from "@/contexts/events-context"
import { useRestroom } from "@/contexts/restroom-context"

import { endMeeting } from "@/lib/meeting-utils"

// Helper function to get event type display name
const getEventTypeDisplayName = (eventType: string) => {
  switch (eventType) {
    case 'activity':
      return 'Activity'
    case 'event':
    default:
      return 'Event'
  }
}
import { 
  getBreaksForShift, 
  getBreakTitle, 
  isBreakTimeValid, 
  getNextBreakTime,
  type ShiftInfo,
  type BreakInfo
} from "@/lib/shift-break-utils"

interface UserProfile {
  shift_period?: string
  shift_schedule?: string
  shift_time?: string
}

export default function BreaksPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeBreak, setActiveBreak] = useState<BreakType | null>(null)
  const [breakStatus, setBreakStatus] = useState<DatabaseBreakStatus | null>(null)
  const [breakHistory, setBreakHistory] = useState<any>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [breakLoadingStates, setBreakLoadingStates] = useState<Record<BreakType, boolean>>({
    Morning: false,
    Lunch: false,
    Afternoon: false,
    NightFirst: false,
    NightMeal: false,
    NightSecond: false
  })
  const [error, setError] = useState<string | null>(null)
  const [autoEnding, setAutoEnding] = useState(false)
  const [showMeetingEndDialog, setShowMeetingEndDialog] = useState(false)
  const [showEventLeaveDialog, setShowEventLeaveDialog] = useState(false)
  const [showRestroomEndDialog, setShowRestroomEndDialog] = useState(false)
  const [pendingBreakId, setPendingBreakId] = useState<BreakType | null>(null)
  const [isLeavingEvent, setIsLeavingEvent] = useState(false)
  const [isEndingRestroom, setIsEndingRestroom] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [availableBreaks, setAvailableBreaks] = useState<BreakInfo[]>([])
  const { setBreakActive, setBreakActiveAfterEventLeave, isBreakActive, activeBreakId, isInitialized, canStartBreak, breakBlockedReason } = useBreak()
  const { isBreakActive: timerBreakActive, breakStatus: timerBreakStatus, refreshBreakStatus } = useTimer()
  const { isInMeeting, currentMeeting } = useMeeting()
  const { isInEvent, currentEvent, leaveEvent } = useEventsContext()
  const { isInRestroom, updateRestroomStatus } = useRestroom()

  // Load user profile and generate available breaks
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const currentUser = getCurrentUserInfo()
        if (!currentUser?.email) return

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
          const shiftInfo: ShiftInfo = {
            shift_period: profile.shift_period || '',
            shift_schedule: profile.shift_schedule || '',
            shift_time: profile.shift_time || ''
          }
          
          const breaks = getBreaksForShift(shiftInfo)
          setAvailableBreaks(breaks)
        }
      } catch (error) {
        console.error('Error loading user profile:', error)
      }
    }

    loadUserProfile()
  }, [])

  // Use timer context data and only poll for detailed break status when needed
  useEffect(() => {
    const loadBreakStatus = async () => {
      try {
        const currentUser = getCurrentUserInfo()
        if (!currentUser?.id) {
          setError('User not authenticated')
          setLoading(false)
          return
        }

        const { success, status, message } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
          
          // Sync with existing localStorage system for compatibility
          if (status.is_on_break && status.active_break) {
            // Check if the active break is outside its valid time window
            const breakInfo = availableBreaks.find(b => b.id === status.active_break?.break_type)
            if (breakInfo && userProfile && !isBreakTimeValid(breakInfo, userProfile as ShiftInfo, new Date())) {
              
              setAutoEnding(true)
              try {
                // End the break automatically
                const endResult = await endBreak()
                
                if (endResult.success) {
                  // Clear break state
                  setActiveBreak(null)
                  setBreakActive(false)
                  localStorage.removeItem('currentBreak')
                  
                  // Refresh break status after auto-ending
                  const { success: refreshSuccess, status: refreshStatus } = await getBreakStatus()
                  if (refreshSuccess && refreshStatus) {
                    setBreakStatus(refreshStatus)
                  }
                  
                  // Refresh timer context
                  await refreshBreakStatus()
                  return // Exit early since we've handled the break
                } 
              } catch (error) {
                console.error(`❌ Error auto-ending ${breakInfo.name} on page load:`, error)
              } finally {
                setAutoEnding(false)
              }
            }
            
            // Only set as active if break is NOT paused and still valid
            if (!status.active_break.is_paused) {
              setActiveBreak(status.active_break.break_type)
              setBreakActive(true, status.active_break.break_type.toLowerCase())
            } else {
              // Break is paused, show breaks list instead of timer
              setActiveBreak(null)
              setBreakActive(false)
              
              // Restore paused break to localStorage for resume functionality
              const pausedBreak = {
                id: status.active_break.id,
                break_type: status.active_break.break_type,
                start_time: status.active_break.start_time,
                agent_user_id: status.active_break.agent_user_id,
                is_paused: true,
                pause_time: status.active_break.pause_time,
                time_remaining_at_pause: status.active_break.time_remaining_at_pause,
                pause_used: true
              }
              localStorage.setItem('currentBreak', JSON.stringify(pausedBreak))
            }
          } else {
            // No active break found - clear all break state
            setActiveBreak(null)
            setBreakActive(false)
            localStorage.removeItem('currentBreak')
          }
        } else {
          // If API fails, check localStorage for any stale data and clear it
          const currentBreak = localStorage.getItem('currentBreak')
          if (currentBreak) {
            try {
              const breakData = JSON.parse(currentBreak)
              // If the break looks like it should be finished, clear it
              if (breakData.time_remaining_seconds && breakData.time_remaining_seconds <= 0) {
                localStorage.removeItem('currentBreak')
                setActiveBreak(null)
                setBreakActive(false)
              }
            } catch (e) {
              // Invalid localStorage data, clear it
              localStorage.removeItem('currentBreak')
              setActiveBreak(null)
              setBreakActive(false)
            }
          }
          
          // Only show error if it's not just "No active break session found"
          if (message && !message.toLowerCase().includes('no active break session')) {
            setError(message || 'Failed to load break status')
          } else {
            setError(null) // Clear any previous errors
          }
        }

        // Get break history (last 7 days)
        try {
          // Initial: load recent history window only
          const { success: historySuccess, data: historyData } = await getBreakHistory(7, true)
          if (historySuccess && historyData) {
            setBreakHistory(historyData)
          }
        } catch (historyError) {
          console.error('Error loading break history:', historyError)
          // Don't fail the entire load if history fails
        }
      } catch (error) {
        console.error('Error loading break status:', error)
        setError('Failed to load break status')
      } finally {
        setLoading(false)
      }
    }

    // Load immediately
    loadBreakStatus()

    // No continuous polling - break status will be updated when user takes actions
    // The page will refresh break status when user interacts with break buttons
  }, [setBreakActive, availableBreaks, refreshBreakStatus, userProfile])

  // Check localStorage for active break (fallback for compatibility)
  useEffect(() => {
          const checkLocalStorage = () => {
        const currentBreak = getCurrentBreak()
        
        if (currentBreak && !activeBreak) {
          // Only set as active if not paused
          if (!currentBreak.is_paused) {
            setActiveBreak(currentBreak.break_type)
            setBreakActive(true, currentBreak.break_type.toLowerCase())
          }
        }
      }

    checkLocalStorage()
  }, [activeBreak, setBreakActive])

  // Update current time every second and check for invalid breaks
  useEffect(() => {
    const checkAndEndInvalidBreaks = async () => {
      // Check if we have an active break (including paused breaks)
      if (!breakStatus?.active_break) return

      const currentBreak = breakStatus.active_break
      const breakInfo = availableBreaks.find(b => b.id === currentBreak.break_type)
      
      if (!breakInfo || !userProfile) return

      // Check if current time is outside the valid time window
      if (!isBreakTimeValid(breakInfo, userProfile as ShiftInfo, new Date())) {
        console.log(`⏰ Auto-ending ${breakInfo.name} - outside valid time window`)
        
        setAutoEnding(true)
        try {
          // End the break automatically
          const result = await endBreak()
          
          if (result.success) {
            console.log(`✅ Successfully auto-ended ${breakInfo.name}`)
            
            // Clear break state
            setActiveBreak(null)
            setBreakActive(false)
            localStorage.removeItem('currentBreak')
            
            // Refresh break status
            const { success, status } = await getBreakStatus()
            if (success && status) {
              setBreakStatus(status)
            }
            
            // Refresh timer context
            await refreshBreakStatus()
          }
        } catch (error) {
          console.error(`❌ Error auto-ending ${breakInfo.name}:`, error)
        } finally {
          setAutoEnding(false)
        }
      }
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date())
      // Check for invalid breaks every second
      checkAndEndInvalidBreaks()
    }, 1000) // Check every second

    return () => clearInterval(interval)
  }, [breakStatus, setBreakActive, refreshBreakStatus, availableBreaks, userProfile])

  // Cleanup black screens when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      // Close black screens when leaving the break page
      if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
        window.electronAPI.multiMonitor.closeBlackScreens().catch(error => {
          console.warn('Failed to close black screens on cleanup:', error)
        })
      }
    }
  }, [])

  const isBreakAvailable = (breakId: BreakType) => {
    if (!breakStatus) return true
    
    // Use the break_availability field from the API response
    // Handle new break types that might not exist in the API response yet
    return breakStatus.today_summary.break_availability[breakId as keyof typeof breakStatus.today_summary.break_availability] ?? true
  }

  const handleStartBreak = async (breakId: BreakType) => {
    try {
      setBreakLoadingStates(prev => ({ ...prev, [breakId]: true }))
      setError(null)

      // Check if break is blocked by event
      if (!canStartBreak) {
        // Show dialog asking if they want to leave the event first
        setPendingBreakId(breakId)
        setShowEventLeaveDialog(true)
        setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
        return
      }

      // Check if agent is in restroom before starting break
      if (isInRestroom) {
        // Show dialog asking if they want to end restroom first
        setPendingBreakId(breakId)
        setShowRestroomEndDialog(true)
        setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
        return
      }

      // Check if agent is in a meeting before starting break
      if (isInMeeting && currentMeeting) {
        // Show dialog asking if they want to end the meeting first
        setPendingBreakId(breakId)
        setShowMeetingEndDialog(true)
        setLoading(false)
        return
      }

      // Call database API to start break
      const result = await startBreak(breakId)
      
      if (result.success && result.breakSession) {
        setActiveBreak(breakId)
        try {
          setBreakActive(true, breakId.toLowerCase())
        } catch (error) {
          // Handle event blocking error
          if (error instanceof Error && error.message.includes('Cannot start break while in event')) {
            setError(error.message)
            setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
            return
          }
          throw error // Re-throw if it's not an event blocking error
        }
        
        // Start black screens on secondary monitors for break
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.createBlackScreens()
          } catch (error) {
            console.warn('Failed to create black screens:', error)
          }
        }
        
        // Refresh break status after starting
        const { success, status } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()


      } else {
        setError(result.message || 'Failed to start break')
      }
    } catch (error) {
      console.error('Error starting break:', error)
      setError('Failed to start break session')
    } finally {
      setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
    }
  }

  const handleEndMeetingAndStartBreak = async () => {
    try {
      if (!currentMeeting || !pendingBreakId) return

      setLoading(true)
      setError(null)
      
      // End the current meeting
      await endMeeting(currentMeeting.id)
      
      // Wait a moment for meeting status to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if agent is in restroom after ending meeting
      if (isInRestroom) {
        // Show dialog asking if they want to end restroom first
        setShowMeetingEndDialog(false) // Close meeting dialog
        setShowRestroomEndDialog(true) // Show restroom dialog
        setLoading(false)
        return
      }
      
      // Check if we're resuming a paused break or starting a new one
      const currentBreak = getCurrentBreak()
      const isResuming = currentBreak && currentBreak.is_paused
      
      let result
      if (isResuming) {
        // Resume the paused break
        result = await resumeBreak()
      } else {
        // Start a new break
        result = await startBreak(pendingBreakId)
      }
      
      if (result.success && result.breakSession) {
        if (isResuming) {
          // Update localStorage with resumed break info for timer
          const resumedBreak = {
            id: result.breakSession.id,
            break_type: pendingBreakId,
            start_time: result.breakSession.start_time,
            agent_user_id: result.breakSession.agent_user_id,
            is_paused: false,
            pause_used: true,
            time_remaining_seconds: result.breakSession.time_remaining_seconds
          }
          
          localStorage.setItem('currentBreak', JSON.stringify(resumedBreak))
        }
        
        setActiveBreak(pendingBreakId)
        setBreakActive(true, pendingBreakId.toLowerCase())
        
        // Start black screens on secondary monitors for break
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.createBlackScreens()
          } catch (error) {
            console.warn('Failed to create black screens:', error)
          }
        }
        
        // Refresh break status after starting/resuming
        const { success, status } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()
      } else {
        setError(result.message || `Failed to ${isResuming ? 'resume' : 'start'} break`)
      }
      
      // Close dialog and clear pending state
      setShowMeetingEndDialog(false)
      setPendingBreakId(null)
      
    } catch (error) {
      console.error('Error ending meeting and starting/resuming break:', error)
      setError('Failed to end meeting and start/resume break')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveEventAndStartBreak = async () => {
    try {
      if (!currentEvent || !pendingBreakId) return

      setIsLeavingEvent(true)
      setError(null)
      
      // Leave the current event
      await leaveEvent(currentEvent.event_id)
      
      // Wait a moment for event status to update
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check if agent is in restroom after leaving event
      if (isInRestroom) {
        // Show dialog asking if they want to end restroom first
        setShowEventLeaveDialog(false) // Close event dialog
        setShowRestroomEndDialog(true) // Show restroom dialog
        setIsLeavingEvent(false)
        return
      }
      
      // Check if this is a resume operation (check if there's a paused break)
      const currentBreak = getCurrentBreak()
      const isResumeOperation = currentBreak && currentBreak.is_paused
      
      let result
      if (isResumeOperation) {
        // Resume the break
        result = await resumeBreak()
      } else {
        // Start a new break
        result = await startBreak(pendingBreakId)
      }
      
      if (result.success && result.breakSession) {
        setActiveBreak(pendingBreakId)
        setBreakActiveAfterEventLeave(true, pendingBreakId.toLowerCase())
        
        // If resuming, update localStorage with resumed break info
        if (isResumeOperation) {
          const resumedBreak = {
            id: result.breakSession.id,
            break_type: pendingBreakId,
            start_time: result.breakSession.start_time,
            agent_user_id: result.breakSession.agent_user_id,
            is_paused: false,
            pause_used: true,
            time_remaining_seconds: result.breakSession.time_remaining_seconds
          }
          localStorage.setItem('currentBreak', JSON.stringify(resumedBreak))
        }
        
        // Start black screens on secondary monitors for break
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.createBlackScreens()
          } catch (error) {
            console.warn('Failed to create black screens:', error)
          }
        }
        
        // Refresh break status after starting/resuming
        const { success, status } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()
      } else {
        setError(result.message || `Failed to ${isResumeOperation ? 'resume' : 'start'} break`)
      }
      
      // Close dialog and clear pending state
      setShowEventLeaveDialog(false)
      setPendingBreakId(null)
      
    } catch (error) {
      console.error('Error leaving event and starting/resuming break:', error)
      setError('Failed to leave event and start/resume break')
    } finally {
      setIsLeavingEvent(false)
    }
  }

  const handleCancelBreakStart = () => {
    setShowMeetingEndDialog(false)
    setPendingBreakId(null)
    setLoading(false)
  }

  const handleCancelEventLeave = () => {
    setShowEventLeaveDialog(false)
    setPendingBreakId(null)
  }

  const handleEndRestroomAndStartBreak = async () => {
    try {
      if (!pendingBreakId) return

      setIsEndingRestroom(true)
      setError(null)
      
      // End the restroom session
      await updateRestroomStatus(false)
      
      // Wait a moment for restroom status to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if we're resuming a paused break or starting a new one
      const currentBreak = getCurrentBreak()
      const isResuming = currentBreak && currentBreak.is_paused
      
      let result
      if (isResuming) {
        // Resume the paused break
        result = await resumeBreak()
      } else {
        // Start a new break
        result = await startBreak(pendingBreakId)
      }
      
      if (result.success && result.breakSession) {
        if (isResuming) {
          // Update localStorage with resumed break info for timer
          const resumedBreak = {
            id: result.breakSession.id,
            break_type: pendingBreakId,
            start_time: result.breakSession.start_time,
            agent_user_id: result.breakSession.agent_user_id,
            is_paused: false,
            pause_used: true,
            time_remaining_seconds: result.breakSession.time_remaining_seconds
          }
          
          localStorage.setItem('currentBreak', JSON.stringify(resumedBreak))
        }
        
        setActiveBreak(pendingBreakId)
        setBreakActive(true, pendingBreakId.toLowerCase())
        
        // Start black screens on secondary monitors for break
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.createBlackScreens()
          } catch (error) {
            console.warn('Failed to create black screens:', error)
          }
        }
        
        // Refresh break status after starting/resuming
        const { success, status } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()
      } else {
        setError(result.message || `Failed to ${isResuming ? 'resume' : 'start'} break`)
      }
      
      // Close dialog and clear pending state
      setShowRestroomEndDialog(false)
      setPendingBreakId(null)
      
    } catch (error) {
      console.error('Error ending restroom and starting/resuming break:', error)
      setError('Failed to end restroom and start/resume break')
    } finally {
      setIsEndingRestroom(false)
    }
  }

  const handleCancelRestroomEnd = () => {
    setShowRestroomEndDialog(false)
    setPendingBreakId(null)
  }

  const handleEndBreak = async () => {
    try {
      setLoading(true)
      setError(null)

      // Call database API to end break
      const result = await endBreak()
      
      if (result.success) {
        // Clear break state immediately
        setActiveBreak(null)
        setBreakActive(false)
        localStorage.removeItem('currentBreak')
        
        // Close black screens on secondary monitors when break ends
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.closeBlackScreens()
          } catch (error) {
            console.warn('Failed to close black screens:', error)
          }
        }
        
        // Refresh break status after ending
        const { success, status } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()

      } else {
        // If end break fails, check if it's because break is already ended
        if (result.message && result.message.toLowerCase().includes('no active break')) {
          // Break is already ended, just clear local state
          setActiveBreak(null)
          setBreakActive(false)
          localStorage.removeItem('currentBreak')
          setError(null)
        } else {
          setError(result.message || 'Failed to end break')
        }
      }
    } catch (error) {
      console.error('Error ending break:', error)
      
      // Check if it's a "no active break" error and handle gracefully
      if (error instanceof Error && error.message.toLowerCase().includes('no active break')) {
        setActiveBreak(null)
        setBreakActive(false)
        localStorage.removeItem('currentBreak')
        setError(null)
      } else {
        setError('Failed to end break session')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePauseBreak = async (timeRemainingSeconds: number) => {
    try {
      setLoading(true)
      setError(null)

      // Call database API to pause break
      const result = await pauseBreak(timeRemainingSeconds)
      
      if (result.success) {
        setActiveBreak(null)
        setBreakActive(false)
        
        // Close black screens on secondary monitors when break is paused
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.closeBlackScreens()
          } catch (error) {
            console.warn('Failed to close black screens:', error)
          }
        }
        
        // Refresh break status after pausing
        const { success, status } = await getBreakStatus()
        if (success && status) {
          setBreakStatus(status)
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()


      } else {
        setError(result.message || 'Failed to pause break')
      }
    } catch (error) {
      console.error('Error pausing break:', error)
      setError('Failed to pause break session')
    } finally {
      setLoading(false)
    }
  }

  const handleResumeBreak = async (breakId: BreakType) => {
    try {
      setBreakLoadingStates(prev => ({ ...prev, [breakId]: true }))
      setError(null)

      // Check if break is blocked by event
      if (!canStartBreak) {
        // Show dialog asking if they want to leave the event first
        setPendingBreakId(breakId)
        setShowEventLeaveDialog(true)
        setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
        return
      }

      // Check if agent is in restroom before resuming break
      if (isInRestroom) {
        // Show dialog asking if they want to end restroom first
        setPendingBreakId(breakId)
        setShowRestroomEndDialog(true)
        setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
        return
      }

      // Check if agent is in a meeting before resuming break
      if (isInMeeting && currentMeeting) {
        // Show dialog asking if they want to end the meeting first
        setPendingBreakId(breakId)
        setShowMeetingEndDialog(true)
        setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
        return
      }

      // Call database API to resume break
      const result = await resumeBreak()
      
      if (result.success && result.breakSession) {

        
        // Update localStorage with resumed break info for timer
        const resumedBreak = {
          id: result.breakSession.id,
          break_type: breakId,
          start_time: result.breakSession.start_time,
          agent_user_id: result.breakSession.agent_user_id,
          is_paused: false,
          pause_used: true,
          time_remaining_seconds: result.breakSession.time_remaining_seconds
        }
        
        localStorage.setItem('currentBreak', JSON.stringify(resumedBreak))
        
        // Set break as active to show timer
        setActiveBreak(breakId)
        setBreakActive(true, breakId.toLowerCase())
        
        // Start black screens on secondary monitors when break is resumed
        if (typeof window !== 'undefined' && window.electronAPI?.multiMonitor) {
          try {
            await window.electronAPI.multiMonitor.createBlackScreens()
          } catch (error) {
            console.warn('Failed to create black screens:', error)
          }
        }
        
        // Refresh timer context break status
        await refreshBreakStatus()
        
      } else {

        setError(result.message || 'Failed to resume break')
      }
    } catch (error) {
      console.error('❌ Error resuming break:', error)
      setError('Failed to resume break session')
    } finally {
      setBreakLoadingStates(prev => ({ ...prev, [breakId]: false }))
    }
  }

  const refreshBreakHistory = async () => {
    try {
      setLoadingHistory(true)
      const days = showAllHistory ? 90 : 7
      const { success, data } = await getBreakHistory(days, true)
      if (success && data) {
        setBreakHistory(data)
      }
    } catch (error) {
      console.error('Error refreshing break history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatTime = (timeStr: string) => {
    // Handle datetime strings (from database) or time strings (from break config)
    if (timeStr.includes('T') || timeStr.includes('-')) {
      // It's a datetime string from database
      const date = new Date(timeStr)
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    } else {
      // It's a time string from break config (HH:MM format)
      const [hours, minutes] = timeStr.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minutes} ${ampm}`
    }
  }

  if (loading && !breakStatus) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading break status...</p>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-destructive" />
                <p className="text-destructive font-medium">Error loading break status</p>
                <p className="text-muted-foreground text-sm">{error}</p>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (activeBreak) {
    const breakInfo = availableBreaks.find(b => b.id === activeBreak)
    
    // If breakInfo is not found, show error or fallback
    if (!breakInfo) {
      return (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-destructive" />
                  <p className="text-destructive font-medium">Break configuration not found</p>
                  <p className="text-muted-foreground text-sm">Unable to find break configuration for: {activeBreak}</p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="outline" 
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      )
    }
    
    const currentBreak = getCurrentBreak()
    const isResumedBreak = currentBreak && currentBreak.pause_used
    
    return (
      <BreakTimer
        breakInfo={{
          ...breakInfo,
          id: breakInfo.id.toLowerCase() // Convert for compatibility with existing BreakTimer
        }}
        onEnd={handleEndBreak}
        onPause={handlePauseBreak}
        onResume={() => handleResumeBreak(activeBreak)}
        isPaused={false} 
        emergencyPauseUsed={isResumedBreak || false} // Disable pause if already used
        savedTimeLeft={currentBreak?.time_remaining_seconds}
      />
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Break Management</h1>
              <p className="text-muted-foreground">Manage your work breaks and rest periods</p>
            </div>
            <div className="flex items-center gap-4">
              {breakStatus && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Today's breaks:</p>
                  <p className="font-medium">
                    {breakStatus.today_summary.completed_breaks} completed • {breakStatus.today_summary.total_minutes}m total
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {availableBreaks.map((breakInfo) => {
              const isValid = userProfile ? isBreakTimeValid(breakInfo, userProfile as ShiftInfo, currentTime) : false
              const isAvailable = isBreakAvailable(breakInfo.id as BreakType)
              const isOnThisBreak = breakStatus?.is_on_break && breakStatus?.active_break?.break_type === breakInfo.id
              const isPausedThisBreak = isOnThisBreak && breakStatus?.active_break?.is_paused
              const todayCount = breakStatus?.today_summary.breaks_by_type[breakInfo.id as keyof typeof breakStatus.today_summary.breaks_by_type] || 0
              const isDisabled = !isValid || (!isAvailable && !isOnThisBreak && !isPausedThisBreak) || loading
              const Icon = breakInfo.icon

              return (
                <Card key={breakInfo.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${breakInfo.color} text-white`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{breakInfo.name}</CardTitle>
                          <CardDescription>{breakInfo.description}</CardDescription>
                        </div>
                      </div>
                      {!isAvailable && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Used ({todayCount})
                        </Badge>
                      )}
                      {isOnThisBreak && !isPausedThisBreak && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                      {isPausedThisBreak && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Pause className="h-3 w-3" />
                          Paused
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <p className="font-medium">{breakInfo.duration} minutes</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valid Time:</span>
                        <p className="font-medium">
                          {formatTime(breakInfo.startTime)} - {formatTime(breakInfo.endTime)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {!isValid && (
                        <div className="flex items-center gap-2 text-sm text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Not available at this time</span>
                        </div>
                      )}
                      
                      {!isAvailable && !isOnThisBreak && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <X className="h-4 w-4" />
                          <span>Break already used today</span>
                        </div>
                      )}

                      {isOnThisBreak && !isPausedThisBreak && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Clock className="h-4 w-4" />
                          <span>Currently on this break</span>
                        </div>
                      )}

                      {isPausedThisBreak && (
                        <div className="flex items-center gap-2 text-sm text-orange-600">
                          <Pause className="h-4 w-4" />
                          <span>Break paused - {breakStatus?.active_break?.time_remaining_at_pause ? Math.floor(breakStatus.active_break.time_remaining_at_pause / 60) : 0}m {breakStatus?.active_break?.time_remaining_at_pause ? breakStatus.active_break.time_remaining_at_pause % 60 : 0}s remaining</span>
                        </div>
                      )}
                      
                      {isPausedThisBreak && !isValid && (
                        <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Break will auto-end - outside valid time window</span>
                        </div>
                      )}
                      
                      {autoEnding && isPausedThisBreak && !isValid && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                          <Clock className="h-4 w-4 animate-spin" />
                          <span>Auto-ending break...</span>
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={() => isPausedThisBreak ? handleResumeBreak(breakInfo.id as BreakType) : handleStartBreak(breakInfo.id as BreakType)}
                      disabled={isDisabled || breakLoadingStates[breakInfo.id as BreakType]}
                      className="w-full"
                      size="lg"
                    >
                      {breakLoadingStates[breakInfo.id as BreakType] ? (
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {breakLoadingStates[breakInfo.id as BreakType] ? (isPausedThisBreak ? 'Resuming...' : 'Starting...') : 
                       isPausedThisBreak ? `Resume ${breakInfo.name}` : `Start ${breakInfo.name}`}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Break History Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Break History
              </CardTitle>
              <CardDescription>
                Your recent break sessions and usage statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {breakHistory ? (
                <div className="space-y-4">
                  {/* Summary Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{breakHistory.summary.total_sessions}</div>
                      <div className="text-sm text-muted-foreground">Total Sessions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{breakHistory.summary.completed_sessions}</div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {breakHistory.summary.total_time ? 
                          (breakHistory.summary.total_time >= 60 ? 
                            `${Math.floor(breakHistory.summary.total_time / 60)}h ${breakHistory.summary.total_time % 60}m` : 
                            `${breakHistory.summary.total_time}m`
                          ) : '0m'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">Total Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{breakHistory.summary.today_sessions}</div>
                      <div className="text-sm text-muted-foreground">Today</div>
                    </div>
                  </div>



                  {/* Break History Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{showAllHistory ? 'All Break Sessions' : 'Recent Break Sessions'}</h4>
                      {breakHistory && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingHistory}
                            onClick={refreshBreakHistory}
                            className="flex items-center gap-2"
                          >
                            <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                            {loadingHistory ? 'Refreshing...' : 'Refresh'}
                          </Button>
                          {!showAllHistory ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={loadingHistory}
                              onClick={async () => {
                                try {
                                  setLoadingHistory(true)
                                  // Fetch a wider window for full history (last 90 days)
                                  const { success, data } = await getBreakHistory(90, true)
                                  if (success && data) {
                                    setBreakHistory(data)
                                    setShowAllHistory(true)
                                  }
                                } finally {
                                  setLoadingHistory(false)
                                }
                              }}
                            >
                              {loadingHistory ? 'Loading…' : 'View all history'}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={loadingHistory}
                              onClick={async () => {
                                setShowAllHistory(false)
                                await refreshBreakHistory()
                              }}
                            >
                              {loadingHistory ? 'Loading…' : 'Show recent only'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Type</th>
                            <th className="text-left p-3 text-sm font-medium">Date</th>
                            <th className="text-left p-3 text-sm font-medium">Start Time</th>
                            <th className="text-left p-3 text-sm font-medium">End Time</th>
                            <th className="text-left p-3 text-sm font-medium">Duration</th>
                            <th className="text-left p-3 text-sm font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(() => {
                            const sessions = [...(breakHistory.completed_breaks || []), ...(breakHistory.active_breaks || [])]
                              .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                            const display = showAllHistory ? sessions : sessions.slice(0, 3)
                            return display.map((breakSession: any) => {
                              const breakInfo = availableBreaks.find(b => b.id === breakSession.break_type)
                              const Icon = breakInfo?.icon || Clock
                              const sessionDate = new Date(breakSession.start_time)
                              const isToday = sessionDate.toDateString() === new Date().toDateString()
                              
                              return (
                                <tr key={breakSession.id} className="hover:bg-muted/30">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{breakSession.break_type}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {isToday ? 'Today' : sessionDate.toLocaleDateString()}
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {formatTime(breakSession.start_time)}
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {breakSession.end_time ? formatTime(breakSession.end_time) : 'Active'}
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {breakSession.duration_minutes ? `${breakSession.duration_minutes}m` : '-'}
                                  </td>
                                  <td className="p-3">
                                    <Badge 
                                      variant={breakSession.end_time ? 'default' : 'secondary'}
                                      className={breakSession.end_time ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
                                    >
                                      {breakSession.end_time ? 'Completed' : 'Active'}
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            })
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No break history</h3>
                  <p className="text-gray-600">Start taking breaks to see your history here</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </SidebarInset>

      {/* Meeting End Dialog */}
      <Dialog open={showMeetingEndDialog} onOpenChange={setShowMeetingEndDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              End Meeting to {getCurrentBreak()?.is_paused ? 'Resume' : 'Start'} Break?
            </DialogTitle>
            <DialogDescription>
              You're currently in a meeting "{currentMeeting?.title || 'Untitled Meeting'}". 
              To {getCurrentBreak()?.is_paused ? 'resume' : 'start'} your {pendingBreakId} break, you'll need to end the meeting first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={handleCancelBreakStart}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEndMeetingAndStartBreak}
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {loading ? 'Processing...' : `End Meeting & ${getCurrentBreak()?.is_paused ? 'Resume' : 'Start'} Break`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Leave Dialog */}
      <Dialog open={showEventLeaveDialog} onOpenChange={setShowEventLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Leave {getEventTypeDisplayName(currentEvent?.event_type || 'event')} to {getCurrentBreak()?.is_paused ? 'Resume' : 'Start'} Break?
            </DialogTitle>
            <DialogDescription>
              You're currently in an {getEventTypeDisplayName(currentEvent?.event_type || 'event').toLowerCase()} "{currentEvent?.title || 'Unknown Event'}". 
              To {getCurrentBreak()?.is_paused ? 'resume' : 'start'} your {pendingBreakId} break, you'll need to leave the {getEventTypeDisplayName(currentEvent?.event_type || 'event').toLowerCase()} first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={handleCancelEventLeave}
              disabled={isLeavingEvent}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleLeaveEventAndStartBreak}
              disabled={isLeavingEvent}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isLeavingEvent ? 'Processing...' : `Leave ${getEventTypeDisplayName(currentEvent?.event_type || 'event')} & ${getCurrentBreak()?.is_paused ? 'Resume' : 'Start'} Break`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restroom End Dialog */}
      <Dialog open={showRestroomEndDialog} onOpenChange={setShowRestroomEndDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              End Restroom to {getCurrentBreak()?.is_paused ? 'Resume' : 'Start'} Break?
            </DialogTitle>
            <DialogDescription>
              You're currently in the restroom. 
              To {getCurrentBreak()?.is_paused ? 'resume' : 'start'} your {pendingBreakId} break, you'll need to end your restroom session first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={handleCancelRestroomEnd}
              disabled={isEndingRestroom}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEndRestroomAndStartBreak}
              disabled={isEndingRestroom}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isEndingRestroom ? 'Processing...' : `End Restroom & ${getCurrentBreak()?.is_paused ? 'Resume' : 'Start'} Break`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
} 