"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

interface BreakInfo {
  id: BreakType
  name: string
  duration: number // in minutes
  startTime: string // 24-hour format
  endTime: string // 24-hour format
  icon: any
  description: string
  color: string
}

const breakTypes: BreakInfo[] = [
  {
    id: "Morning",
    name: "Morning Break",
    duration: 15,
    startTime: "06:00",
    endTime: "11:00",
    icon: Coffee,
    description: "Take a 15-minute morning break",
    color: "bg-orange-500"
  },
  {
    id: "Lunch",
    name: "Lunch Break",
    duration: 60,
    startTime: "11:00",
    endTime: "13:00",
    icon: Utensils,
    description: "Take a 1-hour lunch break",
    color: "bg-green-500"
  },
  {
    id: "Afternoon",
    name: "Afternoon Break",
    duration: 15,
    startTime: "12:00",
    endTime: "15:00",
    icon: Sun,
    description: "Take a 15-minute afternoon break",
    color: "bg-blue-500"
  }
]

export default function BreaksPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeBreak, setActiveBreak] = useState<BreakType | null>(null)
  const [breakStatus, setBreakStatus] = useState<DatabaseBreakStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { setBreakActive, isBreakActive, activeBreakId, isInitialized } = useBreak()

  // Load break status on mount and update periodically
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
            // Only set as active if break is NOT paused
            if (!status.active_break.is_paused) {
              setActiveBreak(status.active_break.break_type)
              setBreakActive(true, status.active_break.break_type.toLowerCase())
            } else {
              // Break is paused, show breaks list instead of timer
              setActiveBreak(null)
              setBreakActive(false)
              // Clear any conflicting localStorage
              localStorage.removeItem('currentBreak')

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
      } catch (error) {
        console.error('Error loading break status:', error)
        setError('Failed to load break status')
      } finally {
        setLoading(false)
      }
    }

    // Load immediately
    loadBreakStatus()

    // Update every 30 seconds for real-time data
    const interval = setInterval(loadBreakStatus, 30000)

    return () => clearInterval(interval)
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

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const isBreakTimeValid = (breakInfo: BreakInfo) => {
    const now = currentTime
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    return currentTimeStr >= breakInfo.startTime && currentTimeStr <= breakInfo.endTime
  }

  const isBreakAvailable = (breakId: BreakType) => {
    if (!breakStatus) return true
    
    // Check if this break type was already taken today
    const todayBreakCount = breakStatus.today_summary.breaks_by_type[breakId] || 0
    return todayBreakCount === 0
  }

  const handleStartBreak = async (breakId: BreakType) => {
    try {
      setLoading(true)
      setError(null)

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
        

        
        // Note: We don't refresh break status here to avoid conflicts
        // The timer will use the localStorage data and the database will be updated when break ends
        
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
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
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
    const breakInfo = breakTypes.find(b => b.id === activeBreak)!
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
            {breakTypes.map((breakInfo) => {
              const isValid = isBreakTimeValid(breakInfo)
              const isAvailable = isBreakAvailable(breakInfo.id)
              const isOnThisBreak = breakStatus?.is_on_break && breakStatus?.active_break?.break_type === breakInfo.id
              const isPausedThisBreak = isOnThisBreak && breakStatus?.active_break?.is_paused
              const todayCount = breakStatus?.today_summary.breaks_by_type[breakInfo.id] || 0
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
                    </div>

                    <Button 
                      onClick={() => isPausedThisBreak ? handleResumeBreak(breakInfo.id) : handleStartBreak(breakInfo.id)}
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



          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Break Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Break Times</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Morning Break: 6:00 AM - 11:00 AM (15 minutes)</li>
                    <li>• Lunch Break: 11:00 AM - 1:00 PM (1 hour)</li>
                    <li>• Afternoon Break: 12:00 PM - 3:00 PM (15 minutes)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Break Rules</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Each break can only be used once per day</li>
                    <li>• Breaks are automatically saved to database</li>
                    <li>• Breaks must be taken within valid time windows</li>
                    <li>• Break duration is automatically calculated</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 