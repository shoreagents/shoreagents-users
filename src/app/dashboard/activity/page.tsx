"use client"

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useTimer } from '@/contexts/timer-context'
import { useMeeting } from '@/contexts/meeting-context'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Clock, RefreshCw, BarChart3, Loader2 } from 'lucide-react'
import WeeklyActivityDisplay from '@/components/weekly-activity-display'
import MonthlyActivityDisplay from '@/components/monthly-activity-display'
import ProductivityScoreDisplay from '@/components/productivity-score-display'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

// Activity data type based on the provided JSON structure
type ActivityData = {
  id: number | string
  user_id: number
  is_currently_active: boolean
  created_at: string
  updated_at: string
  today_active_seconds: number
  today_inactive_seconds: number
  last_session_start: string
  today_date: string
  status?: 'has_data' | 'rest_day' | 'not_yet'
}

export default function TestActivityPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)

  // Use the global timer context
  const { 
    timerData, 
    error, 
    liveActiveSeconds,
    liveInactiveSeconds
  } = useTimer()

  // Use meeting context instead of hook to prevent frequent API calls
  const { isInMeeting } = useMeeting()

  const handleGlobalRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  // Function to fetch last 7 days activity data
  const handleViewLast7Days = async () => {
    if (!currentUser?.id) {
      console.error('No current user found')
      return
    }

    setIsLoadingActivity(true)
    try {
      // Call the actual API endpoint
      const response = await fetch(`/api/activity/last-7-days?userId=${currentUser.id}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch activity data')
      }
      
      const rawData: ActivityData[] = result.data || []
      
      // Aggregate data by date to show one row per day
      const aggregatedData = rawData.reduce((acc, activity) => {
        // Extract just the date part (YYYY-MM-DD) from the today_date field
        const date = activity.today_date.split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            ...activity,
            total_active_seconds: 0,
            total_inactive_seconds: 0,
            record_count: 0
          }
        }
        
        acc[date].total_active_seconds += activity.today_active_seconds
        acc[date].total_inactive_seconds += activity.today_inactive_seconds
        acc[date].record_count += 1
        
        // Keep the most recent is_currently_active status and last_session_start
        if (new Date(activity.updated_at) > new Date(acc[date].updated_at)) {
          acc[date].is_currently_active = activity.is_currently_active
          acc[date].last_session_start = activity.last_session_start
          acc[date].updated_at = activity.updated_at
        }
        
        return acc
      }, {} as Record<string, ActivityData & { total_active_seconds: number; total_inactive_seconds: number; record_count: number }>)
      
      
      // Generate current week view (Monday to Sunday)
      // Use Philippines timezone to match the database
      const today = new Date()
      
      // Get Philippines time by adding 8 hours to UTC (Philippines is UTC+8)
      const philippinesTime = new Date(today.getTime() + (8 * 60 * 60 * 1000))
      
      
      // Calculate the start of the current week (Monday) using Philippines time
      const currentDay = philippinesTime.getDay() // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay // Go back to Monday
      const weekStart = new Date(philippinesTime)
      weekStart.setDate(philippinesTime.getDate() + mondayOffset)
      
      
      // Generate 7 days starting from Monday
      const weekData = []
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart)
        currentDate.setDate(weekStart.getDate() + i)
        const dateString = currentDate.toISOString().split('T')[0]
        
        const existingData = aggregatedData[dateString]
        // Compare only date parts using Philippines timezone
        const todayDateOnly = new Date(philippinesTime.getFullYear(), philippinesTime.getMonth(), philippinesTime.getDate())
        const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
        const isFuture = currentDateOnly > todayDateOnly
        
        // Check if this is a weekend day that should be REST DAY
        const dayOfWeek = currentDate.getDay() // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
        
        // Override logic: Weekends are always REST DAY, weekdays show actual data if available
        const hasData = !isWeekend && existingData && (existingData.total_active_seconds > 0 || existingData.total_inactive_seconds > 0)
        
        
        if (isWeekend) {
          // Weekend day - always REST DAY (past, present, or future)
          const restEntry = {
            id: `rest-${i}`,
            user_id: currentUser.id,
            is_currently_active: false,
            created_at: currentDate.toISOString(),
            updated_at: currentDate.toISOString(),
            today_active_seconds: 0,
            today_inactive_seconds: 0,
            last_session_start: currentDate.toISOString(),
            today_date: dateString,
            status: 'rest_day' as const
          }
          weekData.push(restEntry)
        } else if (isFuture) {
          // Future weekday - show "not yet"
          const futureEntry = {
            id: `future-${i}`,
            user_id: currentUser.id,
            is_currently_active: false,
            created_at: currentDate.toISOString(),
            updated_at: currentDate.toISOString(),
            today_active_seconds: 0,
            today_inactive_seconds: 0,
            last_session_start: currentDate.toISOString(),
            today_date: dateString,
            status: 'not_yet' as const
          }
          weekData.push(futureEntry)
        } else if (hasData) {
          // Day with data
          const dataEntry = {
            ...existingData,
            id: `data-${i}`, // Ensure unique string ID
            today_date: dateString, // Use clean date format
            today_active_seconds: existingData.total_active_seconds,
            today_inactive_seconds: existingData.total_inactive_seconds,
            status: 'has_data' as const
          }
          weekData.push(dataEntry)
        } else {
          // Past weekday with no data - show "REST DAY"
          const restEntry = {
            id: `rest-${i}`,
            user_id: currentUser.id,
            is_currently_active: false,
            created_at: currentDate.toISOString(),
            updated_at: currentDate.toISOString(),
            today_active_seconds: 0,
            today_inactive_seconds: 0,
            last_session_start: currentDate.toISOString(),
            today_date: dateString,
            status: 'rest_day' as const
          }
          weekData.push(restEntry)
        }
      }
      
      // Ensure data is sorted by date (Monday to Sunday)
      const sortedWeekData = weekData.sort((a, b) => {
        return new Date(a.today_date).getTime() - new Date(b.today_date).getTime()
      })
      
      setActivityData(sortedWeekData)
      setShowActivityDialog(true)
    } catch (error) {
      console.error('Error fetching activity data:', error)
      // You could add a toast notification here to show the error to the user
    } finally {
      setIsLoadingActivity(false)
    }
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
        <div className="flex flex-1 flex-col gap-8 p-8 pt-4 min-h-screen bg-background dark:bg-background">
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
                variant="ghost" 
                size="sm"
                className="flex items-center gap-2 hover:!bg-transparent dark:hover:text-white hover:text-black "
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
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="text-lg font-bold">
                      {currentUser?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
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
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">Today Activity</div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleViewLast7Days}
                    disabled={isLoadingActivity}
                    variant="ghost" 
                    size="sm"
                    className="flex items-center gap-2 bg-transparent hover:!bg-transparent dark:hover:text-white hover:text-black "
                  >
                    {isLoadingActivity ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        View This Week
                      </>
                    )}
                  </Button>
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
            
            {/* Weekly and Monthly Activity Tracking in Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Weekly Activity Tracking */}
              <div>
                <WeeklyActivityDisplay key={`weekly-${refreshKey}`} currentUser={currentUser} />
              </div>

              {/* Monthly Activity Tracking */}
              <div>
                <MonthlyActivityDisplay key={`monthly-${refreshKey}`} currentUser={currentUser} />
              </div>
            </div>

            {/* Productivity Score Tracking */}
            <div>
              <ProductivityScoreDisplay key={`productivity-${refreshKey}`} currentUser={currentUser} />
            </div>
          </div>
        </div>

        {/* Activity Summary Dialog */}
        <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
          <DialogContent className="max-w-6xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                My Activity Summary Report 
              </DialogTitle>
              <DialogDescription>
                Complete week view showing Monday to Sunday with activity data
              </DialogDescription>
            </DialogHeader>
            
            {isLoadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading activity data...</span>
                </div>
              </div>
            ) : activityData.length > 0 ? (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Date</TableHead>
                      <TableHead className="w-[100px]">Day</TableHead>
                      <TableHead className="w-[120px]">Active Time</TableHead>
                      <TableHead className="w-[120px]">Inactive Time</TableHead>
                      <TableHead className="w-[120px]">Total Time</TableHead>
                      <TableHead className="w-[120px]">Productivity Score</TableHead>
                      <TableHead className="w-[150px]">Last Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityData.map((activity) => {
                      const totalSeconds = activity.today_active_seconds + activity.today_inactive_seconds
                      const productivityScore = calculateProductivityPoints(activity.today_active_seconds, activity.today_inactive_seconds)
                      
                      const isRestDay = activity.status === 'rest_day'
                      const isNotYet = activity.status === 'not_yet'
                      const hasData = activity.status === 'has_data'
                      
                      return (
                        <TableRow key={activity.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="font-medium text-sm">
                              {new Date(activity.today_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-muted-foreground">
                              {new Date(activity.today_date).toLocaleDateString('en-US', {
                                weekday: 'short'
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {isRestDay ? (
                              <div className="font-medium text-orange-600 italic">
                                REST DAY
                              </div>
                            ) : isNotYet ? (
                              <div className="font-medium text-gray-500 italic">
                                not yet
                              </div>
                            ) : (
                              <div className="font-medium text-green-600">
                                {formatTime(activity.today_active_seconds)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isRestDay ? (
                              <div className="font-medium text-orange-600 italic">
                                REST DAY
                              </div>
                            ) : isNotYet ? (
                              <div className="font-medium text-gray-500 italic">
                                not yet
                              </div>
                            ) : (
                              <div className="font-medium text-red-600">
                                {formatTime(activity.today_inactive_seconds)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isRestDay ? (
                              <div className="font-medium text-orange-600 italic">
                                REST DAY
                              </div>
                            ) : isNotYet ? (
                              <div className="font-medium text-gray-500 italic">
                                not yet
                              </div>
                            ) : (
                              <div className="font-medium">
                                {formatTime(totalSeconds)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isRestDay ? (
                              <div className="font-medium text-orange-600 italic">
                                REST DAY
                              </div>
                            ) : isNotYet ? (
                              <div className="font-medium text-gray-500 italic">
                                not yet
                              </div>
                            ) : (
                              <div className="font-medium text-purple-600">
                                {productivityScore.toFixed(1)} pts
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isRestDay ? (
                              <div className="font-medium text-orange-600 italic">
                                REST DAY
                              </div>
                            ) : isNotYet ? (
                              <div className="font-medium text-gray-500 italic">
                                not yet
                              </div>
                            ) : (
                              new Date(activity.last_session_start).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-medium text-lg mb-2">No Activity Data</h4>
                <p className="text-sm text-muted-foreground">
                  No activity data found for the last 7 days.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
} 