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
  X
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
import { endMeeting } from "@/lib/meeting-utils"
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoEnding, setAutoEnding] = useState(false)
  const [showMeetingEndDialog, setShowMeetingEndDialog] = useState(false)
  const [pendingBreakId, setPendingBreakId] = useState<BreakType | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [availableBreaks, setAvailableBreaks] = useState<BreakInfo[]>([])
  const { setBreakActive, isBreakActive, activeBreakId, isInitialized } = useBreak()
  const { isBreakActive: timerBreakActive, breakStatus: timerBreakStatus, refreshBreakStatus } = useTimer()
  const { isInMeeting, currentMeeting } = useMeeting()

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
            if (breakInfo && userProfile && !isBreakTimeValid(breakInfo, userProfile as ShiftInfo, currentTime)) {
              console.log(`⏰ Auto-ending ${breakInfo.name} on page load - outside valid time window (${breakInfo.startTime} - ${breakInfo.endTime})`)
              
              setAutoEnding(true)
              try {
                // End the break automatically
                const endResult = await endBreak()
                
                if (endResult.success) {
                  console.log(`✅ Auto-ended ${breakInfo.name} successfully on page load`)
                  
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
                } else {
                  console.log(`⚠️ Auto-end failed for ${breakInfo.name} on page load:`, endResult.message)
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
              console.log('🔄 Restored paused break to localStorage for resume functionality')
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
  }, [setBreakActive])

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

  // Update current time every second for real-time validation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000) // Check every second instead of every minute

    return () => clearInterval(interval)
  }, [])

  // Auto-end breaks that are outside their valid time window
  useEffect(() => {
    const checkAndEndInvalidBreaks = async () => {
      // Check if we have an active break (including paused breaks)
      if (!breakStatus?.active_break) return

      const currentBreak = breakStatus.active_break
      const breakInfo = availableBreaks.find(b => b.id === currentBreak.break_type)
      
      if (!breakInfo || !userProfile) return

      // Check if current time is outside the valid time window
      if (!isBreakTimeValid(breakInfo, userProfile as ShiftInfo, currentTime)) {
        console.log(`⏰ Auto-ending ${breakInfo.name} - outside valid time window (${breakInfo.startTime} - ${breakInfo.endTime})`)
        
        setAutoEnding(true)
        try {
          // End the break automatically
          const result = await endBreak()
          
          if (result.success) {
            console.log(`✅ Auto-ended ${breakInfo.name} successfully`)
            
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
          } else {
            console.log(`⚠️ Auto-end failed for ${breakInfo.name}:`, result.message)
          }
        } catch (error) {
          console.error(`❌ Error auto-ending ${breakInfo.name}:`, error)
        } finally {
          setAutoEnding(false)
        }
      }
    }

    // Check immediately when component mounts or when break status changes
    checkAndEndInvalidBreaks()

    // Set up interval to check every 5 seconds for more responsive auto-end
    const interval = setInterval(checkAndEndInvalidBreaks, 5000)

    return () => clearInterval(interval)
  }, [breakStatus, currentTime, setBreakActive, refreshBreakStatus])

  // Real-time validation when current time changes
  useEffect(() => {
    if (breakStatus?.active_break) {
      const currentBreak = breakStatus.active_break
      const breakInfo = availableBreaks.find(b => b.id === currentBreak.break_type)
      
      if (breakInfo && userProfile && !isBreakTimeValid(breakInfo, userProfile as ShiftInfo, currentTime)) {
        console.log(`⏰ Real-time auto-ending ${breakInfo.name} - outside valid time window (${breakInfo.startTime} - ${breakInfo.endTime})`)
        
        setAutoEnding(true)
        endBreak().then(result => {
          if (result.success) {
            console.log(`✅ Real-time auto-ended ${breakInfo.name} successfully`)
            
            // Clear break state
            setActiveBreak(null)
            setBreakActive(false)
            localStorage.removeItem('currentBreak')
            
            // Refresh break status
            getBreakStatus().then(({ success, status }) => {
              if (success && status) {
                setBreakStatus(status)
              }
            })
            
            // Refresh timer context
            refreshBreakStatus()
          } else {
            console.log(`⚠️ Real-time auto-end failed for ${breakInfo.name}:`, result.message)
          }
        }).catch(error => {
          console.error(`❌ Error real-time auto-ending ${breakInfo.name}:`, error)
        }).finally(() => {
          setAutoEnding(false)
        })
      }
    }
  }, [currentTime, breakStatus, setBreakActive, refreshBreakStatus])



  const isBreakAvailable = (breakId: BreakType) => {
    if (!breakStatus) return true
    
    // Use the break_availability field from the API response
    // Handle new break types that might not exist in the API response yet
    return breakStatus.today_summary.break_availability[breakId as keyof typeof breakStatus.today_summary.break_availability] ?? true
  }

  const handleStartBreak = async (breakId: BreakType) => {
    try {
      setLoading(true)
      setError(null)

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
        setBreakActive(true, breakId.toLowerCase())
        
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
      setLoading(false)
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
      
      // Now start the break
      const result = await startBreak(pendingBreakId)
      
      if (result.success && result.breakSession) {
        setActiveBreak(pendingBreakId)
        setBreakActive(true, pendingBreakId.toLowerCase())
        
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
      
      // Close dialog and clear pending state
      setShowMeetingEndDialog(false)
      setPendingBreakId(null)
      
    } catch (error) {
      console.error('Error ending meeting and starting break:', error)
      setError('Failed to end meeting and start break')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelBreakStart = () => {
    setShowMeetingEndDialog(false)
    setPendingBreakId(null)
    setLoading(false)
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
      setLoading(true)
      setError(null)



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
        

        
        // Refresh timer context break status
        await refreshBreakStatus()
        
      } else {

        setError(result.message || 'Failed to resume break')
      }
    } catch (error) {
      console.error('❌ Error resuming break:', error)
      setError('Failed to resume break session')
    } finally {
      setLoading(false)
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
    const breakInfo = availableBreaks.find(b => b.id === activeBreak)!
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
                      disabled={isDisabled}
                      className="w-full"
                      size="lg"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {loading ? (isPausedThisBreak ? 'Resuming...' : 'Starting...') : 
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
                    <h4 className="font-medium">Recent Break Sessions</h4>
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
                          {[...(breakHistory.completed_breaks || []), ...(breakHistory.active_breaks || [])]
                            .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                            .slice(0, 10) // Show only last 10 sessions
                            .map((breakSession: any) => {
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
                            })}
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
              End Meeting to Start Break?
            </DialogTitle>
            <DialogDescription>
              You're currently in a meeting "{currentMeeting?.title || 'Untitled Meeting'}". 
              To start your {pendingBreakId} break, you'll need to end the meeting first.
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
              {loading ? 'Processing...' : 'End Meeting & Start Break'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
} 