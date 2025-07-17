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
import { getBreakHistory, updateBreakStatus, saveBreakTimerState, clearBreakTimerState } from "@/lib/break-storage"
import { useBreak } from "@/contexts/break-context"

interface BreakInfo {
  id: string
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
    id: "morning",
    name: "Morning Break",
    duration: 15,
    startTime: "06:00",
    endTime: "11:00",
    icon: Coffee,
    description: "Take a 15-minute morning break",
    color: "bg-orange-500"
  },
  {
    id: "lunch",
    name: "Lunch Break",
    duration: 60,
    startTime: "11:00",
    endTime: "13:00",
    icon: Utensils,
    description: "Take a 1-hour lunch break",
    color: "bg-green-500"
  },
  {
    id: "afternoon",
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
  const [activeBreak, setActiveBreak] = useState<string | null>(null)
  const [breakHistory, setBreakHistory] = useState<Record<string, { used: boolean; paused: boolean; timeLeft?: number; startTime?: number; pauseTime?: number; emergencyPauseUsed?: boolean }>>({
    morning: { used: false, paused: false },
    lunch: { used: false, paused: false },
    afternoon: { used: false, paused: false }
  })
  const { setBreakActive } = useBreak()

  // Load break history on mount and update every 5 seconds for real-time data
  useEffect(() => {
    const loadBreakHistory = () => {
      const history = getBreakHistory()
      setBreakHistory(history)
    }

    // Load immediately
    loadBreakHistory()

    // Update every 5 seconds for real-time data
    const interval = setInterval(loadBreakHistory, 5000)

    return () => clearInterval(interval)
  }, [])

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const isBreakTimeValid = (breakInfo: BreakInfo) => {
    const now = currentTime
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    return currentTimeStr >= breakInfo.startTime && currentTimeStr <= breakInfo.endTime
  }

  const isBreakAvailable = (breakId: string) => {
    return !breakHistory[breakId].used || breakHistory[breakId].paused
  }

  const handleStartBreak = (breakId: string) => {
    setActiveBreak(breakId)
    setBreakActive(true, breakId)
    
    // If resuming a paused break, don't mark it as used again
    if (!breakHistory[breakId].used) {
      const newHistory = {
        ...breakHistory,
        [breakId]: { ...breakHistory[breakId], used: true }
      }
      setBreakHistory(newHistory)
      updateBreakStatus(breakId, { used: true })
    }
  }

  const handleEndBreak = () => {
    setActiveBreak(null)
    setBreakActive(false)
  }

  const handlePauseBreak = (breakId: string) => {
    const newHistory = {
      ...breakHistory,
      [breakId]: { ...breakHistory[breakId], paused: true }
    }
    setBreakHistory(newHistory)
    updateBreakStatus(breakId, { paused: true })
  }

  const handleResumeBreak = (breakId: string) => {
    // Clear the paused state but keep the saved timer data
    const newHistory = {
      ...breakHistory,
      [breakId]: { 
        ...breakHistory[breakId], 
        paused: false
        // Don't clear timeLeft, startTime, pauseTime, or emergencyPauseUsed
        // We want to restore the timer from where it was paused
      }
    }
    setBreakHistory(newHistory)
    updateBreakStatus(breakId, { 
      paused: false
      // Don't clear the saved timer state
    })
    
    // Don't clear the saved timer state - we want to restore from where it was paused
    // clearBreakTimerState(breakId)
    
    // Start the break immediately - timer will be restored from saved state
    setActiveBreak(breakId)
    setBreakActive(true, breakId)
  }

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  if (activeBreak) {
    const breakInfo = breakTypes.find(b => b.id === activeBreak)!
    
    return (
      <BreakTimer
        breakInfo={breakInfo}
        onEnd={handleEndBreak}
        onPause={() => handlePauseBreak(activeBreak)}
        onResume={() => handleResumeBreak(activeBreak)}
        isPaused={breakHistory[activeBreak].paused}
        savedTimeLeft={breakHistory[activeBreak].timeLeft}
        savedStartTime={breakHistory[activeBreak].startTime}
        savedPauseTime={breakHistory[activeBreak].pauseTime}
        emergencyPauseUsed={breakHistory[activeBreak].emergencyPauseUsed}
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

          <div className="grid gap-6 md:grid-cols-3">
            {breakTypes.map((breakInfo) => {
              const isValid = isBreakTimeValid(breakInfo)
              const isAvailable = isBreakAvailable(breakInfo.id)
              const isPaused = breakHistory[breakInfo.id].paused
              const isDisabled = !isValid || (!isAvailable && !isPaused)
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
                          {breakHistory[breakInfo.id].paused ? (
                            <>
                              <Pause className="h-3 w-3" />
                              Paused
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Used
                            </>
                          )}
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
                      
                      {!isAvailable && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {breakHistory[breakInfo.id].paused ? (
                            <>
                              <Pause className="h-4 w-4" />
                              <span>Break paused - Emergency pause used</span>
                            </>
                          ) : (
                            <>
                              <X className="h-4 w-4" />
                              <span>Break already used today</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={() => breakHistory[breakInfo.id].paused ? handleResumeBreak(breakInfo.id) : handleStartBreak(breakInfo.id)}
                      disabled={isDisabled}
                      className="w-full"
                      size="lg"
                    >
                      {breakHistory[breakInfo.id].paused ? (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Resume {breakInfo.name}
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Start {breakInfo.name}
                        </>
                      )}
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
                    <li>• Emergency pause temporarily pauses the break timer</li>
                    <li>• Breaks must be taken within valid time windows</li>
                    <li>• Timer continues even if window is minimized</li>
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