"use client"

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useTimer } from '@/contexts/timer-context'
import { useMeeting } from '@/contexts/meeting-context'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Database, TrendingUp, RefreshCw } from 'lucide-react'
import WeeklyActivityDisplay from '@/components/weekly-activity-display'
import MonthlyActivityDisplay from '@/components/monthly-activity-display'
import ProductivityScoreDisplay from '@/components/productivity-score-display'
import { Button } from '@/components/ui/button'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

export default function TestActivityPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Use the global timer context
  const { 
    timerData, 
    error, 
    setActivityState, 
    isAuthenticated,
    updateTimerData,
    liveActiveSeconds,
    liveInactiveSeconds
  } = useTimer()

  // Use meeting context instead of hook to prevent frequent API calls
  const { isInMeeting, currentMeeting } = useMeeting()

  const handleGlobalRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  // Format seconds to readable time (e.g., 8h 1m 30s)
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    let result = ''
    if (hours > 0) {
      result += `${hours}h `
    }
    if (minutes > 0 || hours > 0) {
      result += `${minutes}m `
    }
    result += `${remainingSeconds}s`
    
    return result.trim()
  }

  // Calculate productivity points based on new system
  const calculateProductivityPoints = (activeSeconds: number, inactiveSeconds: number) => {
    const activePoints = activeSeconds / 3600
    const inactivePoints = inactiveSeconds / 3600
    const totalPoints = activePoints - inactivePoints
    return Math.max(0, totalPoints)
  }

  const currentProductivityPoints = calculateProductivityPoints(liveActiveSeconds, liveInactiveSeconds)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-8 p-8 pt-4 min-h-screen bg-background dark:bg-background relative">
          <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Activity Dashboard</h1>
                <p className="text-muted-foreground">Real-time productivity tracking with point-based scoring system</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <Button 
                onClick={handleGlobalRefresh}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh All
              </Button>
            </div>
          </div>

          {/* User Info & Timer Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Profile Card */}
            <Card className="lg:col-span-1 shadow-lg border border-border/50 bg-card/90 backdrop-blur-sm dark:bg-card/90">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {currentUser?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold">{currentUser?.name || 'User'}</div>
                  <div className="text-sm text-muted-foreground">{currentUser?.email || 'user@example.com'}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 dark:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">Status</span>
                    </div>
                    <Badge variant="outline" className="border-green-200 text-green-700">
                      Online
                    </Badge>
                  </div>
                  
                  {/* Meeting Status Indicator */}
                  {isInMeeting && (
                     <div className="flex items-center justify-between p-3 rounded-lg border dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-950/20">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-yellow-700">Meeting</span>
                      </div>
                      <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
                        🔇 In Meeting
                      </Badge>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-red-700">Error: {error}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live Timer Card */}
            <Card className="lg:col-span-2 shadow-lg border border-border/50 bg-card/90 backdrop-blur-sm dark:bg-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-bold">Live Activity Timer</div>
                    <div className="text-sm text-muted-foreground">Real-time tracking</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timerData ? (
                  <div className="space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Current Status</span>
                      <Badge 
                        variant={isInMeeting ? "outline" : (timerData.isActive ? "default" : "secondary")}
                        className={
                          isInMeeting 
                            ? "border-yellow-300 text-yellow-700 bg-yellow-50" 
                            : (timerData.isActive ? "bg-green-500 hover:bg-green-600" : "")
                        }
                      >
                        {isInMeeting ? '🔇 In Meeting' : (timerData.isActive ? '🟢 Active' : '⚪ Inactive')}
                      </Badge>
                    </div>
                    
                    {/* Meeting Notice */}
                    {isInMeeting && (
                      <div className="p-4 rounded-lg border dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-950/20">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">🔇</span>
                          </div>
                          <div>
                            <p className="font-medium text-yellow-800">Activity Tracking Paused</p>
                            <p className="text-sm text-yellow-700">Timer is paused while you're in a meeting</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timer Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-6 rounded-xl border ${isInMeeting ? 'bg-muted/30 border-border/50 opacity-60' : 'bg-muted/20 dark:bg-emerald-950/20 border-green-200 dark:border-emerald-900/40'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${isInMeeting ? 'text-gray-500' : 'text-green-700'}`}>Active Time</span>
                          <div className={`w-3 h-3 rounded-full ${isInMeeting ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`}></div>
                        </div>
                        <div className={`text-2xl font-bold ${isInMeeting ? 'text-muted-foreground' : 'text-green-600'}`}>
                          {formatTime(liveActiveSeconds)}
                        </div>
                      </div>
                      
                      <div className={`p-6 rounded-xl border ${isInMeeting ? 'bg-muted/30 border-border/50 opacity-60' : 'bg-muted/20 dark:bg-rose-950/20 border-red-200 dark:border-rose-900/40'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${isInMeeting ? 'text-gray-500' : 'text-red-700'}`}>Inactive Time</span>
                          <div className={`w-3 h-3 rounded-full ${isInMeeting ? 'bg-gray-400' : 'bg-red-500'}`}></div>
                        </div>
                        <div className={`text-2xl font-bold ${isInMeeting ? 'text-muted-foreground' : 'text-red-600'}`}>
                          {formatTime(liveInactiveSeconds)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className={`space-y-2 ${isInMeeting ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {isInMeeting ? 'Productivity Ratio (Paused)' : 'Productivity Ratio'}
                        </span>
                        <span className="font-medium">
                          {liveActiveSeconds + liveInactiveSeconds > 0 
                            ? Math.round((liveActiveSeconds / (liveActiveSeconds + liveInactiveSeconds)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${isInMeeting ? 'bg-gray-400' : 'bg-gradient-to-r from-green-500 to-emerald-600'}`}
                          style={{ 
                            width: `${liveActiveSeconds + liveInactiveSeconds > 0 
                              ? (liveActiveSeconds / (liveActiveSeconds + liveInactiveSeconds)) * 100 
                              : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Productivity Points Display */}
                      <div className={`p-4 rounded-lg border ${isInMeeting ? 'bg-muted/30 border-border/50 opacity-60' : 'bg-muted/20 dark:bg-violet-950/20 border-purple-200 dark:border-violet-900/40'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isInMeeting ? 'text-gray-500' : 'text-purple-700'}`}>
                          Productivity Points
                        </span>
                        <div className={`w-3 h-3 rounded-full ${isInMeeting ? 'bg-gray-400' : 'bg-purple-500 animate-pulse'}`}></div>
                      </div>
                      <div className={`text-2xl font-bold ${isInMeeting ? 'text-muted-foreground' : 'text-purple-600'}`}>
                        {currentProductivityPoints.toFixed(1)} pts
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        +{(liveActiveSeconds / 3600).toFixed(1)} active - {(liveInactiveSeconds / 3600).toFixed(1)} inactive
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-gray-500 font-medium">Initializing timer...</p>
                      <p className="text-sm text-gray-400 mt-1">Please wait a moment</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Analytics Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Activity Analytics</h2>
              <p className="text-muted-foreground">Track your productivity points across different time periods</p>
            </div>
            
            {/* Weekly Activity Tracking */}
            <div className="transform hover:scale-[1.02] transition-all duration-300">
              <WeeklyActivityDisplay key={`weekly-${refreshKey}`} currentUser={currentUser} />
            </div>

            {/* Monthly Activity Tracking */}
            <div className="transform hover:scale-[1.02] transition-all duration-300">
              <MonthlyActivityDisplay key={`monthly-${refreshKey}`} currentUser={currentUser} />
            </div>

            {/* Productivity Score Tracking */}
            <div className="transform hover:scale-[1.02] transition-all duration-300">
              <ProductivityScoreDisplay key={`productivity-${refreshKey}`} currentUser={currentUser} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 