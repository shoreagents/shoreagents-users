"use client"

import { useState, useEffect, useMemo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, Clock, MousePointer, TrendingUp, TrendingDown } from "lucide-react"
import { getCurrentUser } from "@/lib/ticket-utils"
import { getActivitySummary, getUserActivityData, getCurrentSessionStatus, cleanupDuplicateSessions, getHourlyDataForPeriod, getDailySummariesForPeriod, getTodaysActivitySummary, getMonthlyTotalsSummary, type HourlyActivityData } from "@/lib/activity-storage"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface ActivityStats {
  totalActiveTime: number
  totalInactiveTime: number
  totalInactivityAlerts: number
  todayActiveTime: number
  todayInactiveTime: number
  todayActiveSessions: number
  todayInactiveSessions: number
  lastActivity: string
  isCurrentlyActive: boolean
}

interface ActivitySession {
  userId: string
  startTime: number
  endTime?: number
  type: 'active' | 'inactive' | 'break'
  duration?: number
  endReason?: 'logout' | 'inactivity' | 'break' | 'natural' | 'app-close'
}

export default function ActivityPage() {
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null)
  const [activitySessions, setActivitySessions] = useState<ActivitySession[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')
  const [currentSessionStatus, setCurrentSessionStatus] = useState<any>(null)
  const [timePeriod, setTimePeriod] = useState<'today' | '24hours' | '7days' | '30days'>('today')
  const [hourlyData, setHourlyData] = useState<HourlyActivityData[]>([])
  const [todaysActivity, setTodaysActivity] = useState<any>(null)
  const [monthlyTotals, setMonthlyTotals] = useState<any>(null)

  useEffect(() => {
    const loadActivityData = () => {
      const currentUser = getCurrentUser()
      if (currentUser) {
        // First clean up any incomplete sessions
        cleanupDuplicateSessions(currentUser.email);
        
        const stats = getActivitySummary(currentUser.email)
        const fullData = getUserActivityData(currentUser.email)
        const sessionStatus = getCurrentSessionStatus(currentUser.email)
        const hourlyDataForPeriod = getHourlyDataForPeriod(currentUser.email, timePeriod)
        const todaysData = getTodaysActivitySummary(currentUser.email)
        const monthlyData = getMonthlyTotalsSummary(currentUser.email)
        
        setActivityStats(stats)
        setActivitySessions(fullData?.activitySessions || [])
        setCurrentSessionStatus(sessionStatus)
        setHourlyData(hourlyDataForPeriod)
        setTodaysActivity(todaysData)
        setMonthlyTotals(monthlyData)
        setLastUpdateTime(new Date().toLocaleTimeString())
      }
      setLoading(false)
    }

    loadActivityData()
    
    // Refresh data every 1 second for real-time chart updates
    const interval = setInterval(loadActivityData, 1000)
    
    return () => clearInterval(interval)
  }, [timePeriod])

  // Real-time current session duration update
  const [currentSessionDuration, setCurrentSessionDuration] = useState<number>(0)
  
  useEffect(() => {
    if (currentSessionStatus?.startTime && currentSessionStatus?.type !== 'break') {
      const updateCurrentSession = () => {
        const now = Date.now()
        const duration = now - currentSessionStatus.startTime
        setCurrentSessionDuration(duration)
      }
      
      updateCurrentSession() // Update immediately
      const interval = setInterval(updateCurrentSession, 1000) // Update every second
      
      return () => clearInterval(interval)
    } else {
      setCurrentSessionDuration(0)
    }
  }, [currentSessionStatus])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const getActivityPercentage = () => {
    if (!monthlyTotals) return 0
    
    const totalTime = monthlyTotals.totalActiveTime + monthlyTotals.totalInactiveTime
    return totalTime > 0 ? (monthlyTotals.totalActiveTime / totalTime) * 100 : 0
  }

    // Generate chart data using cumulative totals that match the summary cards
  const generateChartData = useMemo(() => {
    if (timePeriod === 'today') {
      // For today view, show cumulative totals throughout the day
      const now = Date.now()
      const today = new Date()
      const currentHour = today.getHours()
      const todayDateString = today.toISOString().split('T')[0]
      
      // Get today's hourly data
      const todayHourlyData = hourlyData.filter(h => h.date === todayDateString)
      
      // Pre-calculate cumulative totals for all hours
      const cumulativeData: { [hour: number]: { activeTime: number; inactiveTime: number } } = {}
      let runningActiveTime = 0
      let runningInactiveTime = 0
      
      // Build cumulative data hour by hour using hourly data
      for (let h = 0; h <= currentHour; h++) {
        const hourData = todayHourlyData.find(hd => hd.hour === h)
        
        if (hourData) {
          runningActiveTime += hourData.activeTime
          runningInactiveTime += hourData.inactiveTime
        }
        
        cumulativeData[h] = {
          activeTime: runningActiveTime,
          inactiveTime: runningInactiveTime
        }
      }
      
      // For the current hour, override with real-time totals from activity summary (cards)
      // This ensures perfect sync between chart and cards
      if (currentSessionStatus && currentSessionStatus.type !== 'none' && currentSessionDuration > 0) {
        const currentUser = getCurrentUser()
        const realtimeStats = currentUser ? getActivitySummary(currentUser.email) : null
        
        if (realtimeStats) {
          // Use the exact same totals as the cards for perfect real-time sync
          cumulativeData[currentHour] = {
            activeTime: realtimeStats.totalActiveTime,
            inactiveTime: realtimeStats.totalInactiveTime
          }
        } else {
          // Fallback: add current session time to the running totals
          if (currentSessionStatus.type === 'active') {
            // Only active sessions count as active time (breaks don't accumulate time)
            cumulativeData[currentHour].activeTime += currentSessionDuration
          } else if (currentSessionStatus.type === 'inactive') {
            cumulativeData[currentHour].inactiveTime += currentSessionDuration
          }
          // Break sessions don't add any time (they're paused)
        }
      }
      
      // Generate 24 hours for today with proper cumulative data
      return Array.from({ length: 24 }, (_, hour) => {
        const isCurrentHour = hour === currentHour
        const isPastHour = hour < currentHour
        const isFutureHour = hour > currentHour
        
        // Get cumulative totals up to this hour
        const cumulativeActiveTime = cumulativeData[hour]?.activeTime || 0
        const cumulativeInactiveTime = cumulativeData[hour]?.inactiveTime || 0
        
        // Format hour for display
        const hourDisplay = hour === 0 ? '12 AM' : 
                           hour < 12 ? `${hour} AM` : 
                           hour === 12 ? '12 PM' : 
                           `${hour - 12} PM`
      
      return {
          date: hourDisplay,
          hour: hour,
          active: Math.floor(cumulativeActiveTime / 1000 / 60), // Cumulative total in minutes
          inactive: Math.floor(cumulativeInactiveTime / 1000 / 60), // Cumulative total in minutes
          activeSessions: 0, // Not applicable for cumulative view
          inactiveSessions: 0, // Not applicable for cumulative view
          isCurrentHour: isCurrentHour,
          isPastHour: isPastHour,
          isFutureHour: isFutureHour,
          hasLiveData: isCurrentHour && currentSessionStatus
        }
      })
    } else if (timePeriod === '24hours') {
      // For 24-hour view, show cumulative totals over the last 24 hours
      const now = Date.now()
      const today = new Date()
      const currentHour = today.getHours()
      
      // Get last 24 hours of data
      const twentyFourHoursData = hourlyData
      
      // Pre-calculate cumulative totals for all 24 hours
      const cumulativeData: { [index: number]: { activeTime: number; inactiveTime: number } } = {}
      let runningActiveTime = 0
      let runningInactiveTime = 0
      
      // Build cumulative data hour by hour (chronological order)
      for (let index = 0; index < 24; index++) {
        const hoursBack = 23 - index
        const targetTime = now - (hoursBack * 60 * 60 * 1000)
        const targetDate = new Date(targetTime)
        const targetHour = targetDate.getHours()
        const targetDateString = targetDate.toISOString().split('T')[0]
        
        const isCurrentHour = hoursBack === 0
        
        // Find actual data for this hour
        const hourData = twentyFourHoursData.find(h => 
          h.hour === targetHour && h.date === targetDateString
        )
        
        if (hourData) {
          runningActiveTime += hourData.activeTime
          runningInactiveTime += hourData.inactiveTime
        }
        
        // For current hour, add ongoing session time
        if (isCurrentHour && currentSessionStatus && currentSessionStatus.type !== 'none' && currentSessionDuration > 0) {
          if (currentSessionStatus.type === 'active') {
            runningActiveTime += currentSessionDuration
          } else if (currentSessionStatus.type === 'inactive') {
            runningInactiveTime += currentSessionDuration
          }
        }
        
        cumulativeData[index] = {
          activeTime: runningActiveTime,
          inactiveTime: runningInactiveTime
        }
      }
      
      // Generate 24 hours for the last 24 hours with proper cumulative data
      return Array.from({ length: 24 }, (_, index) => {
        // Calculate the actual hour this index represents (going back in time)
        const hoursBack = 23 - index
        const targetTime = now - (hoursBack * 60 * 60 * 1000)
        const targetDate = new Date(targetTime)
        const targetHour = targetDate.getHours()
        const targetDateString = targetDate.toISOString().split('T')[0]
        
        const isCurrentHour = hoursBack === 0
        const isPastHour = hoursBack > 0
        const isFutureHour = false // No future hours in 24-hour rolling view
        
        // Get cumulative totals up to this hour
        const cumulativeActiveTime = cumulativeData[index]?.activeTime || 0
        const cumulativeInactiveTime = cumulativeData[index]?.inactiveTime || 0
        
        // Format hour for display
        const hourDisplay = targetHour === 0 ? '12 AM' : 
                           targetHour < 12 ? `${targetHour} AM` : 
                           targetHour === 12 ? '12 PM' : 
                           `${targetHour - 12} PM`
        
        return {
          date: hourDisplay,
          hour: targetHour,
          active: Math.floor(cumulativeActiveTime / 1000 / 60), // Cumulative total in minutes
          inactive: Math.floor(cumulativeInactiveTime / 1000 / 60), // Cumulative total in minutes
          activeSessions: 0, // Not applicable for cumulative view
          inactiveSessions: 0, // Not applicable for cumulative view
          isCurrentHour: isCurrentHour,
          isPastHour: isPastHour,
          isFutureHour: isFutureHour,
          hasLiveData: isCurrentHour && currentSessionStatus
        }
      })
    } else {
      // For other periods (7d, 30d), show 24-hour periods
      const now = Date.now()
      const periodsBack = timePeriod === '7days' ? 7 : 30
      
      // Generate array of 24-hour periods
      const periodData = []
      for (let i = periodsBack - 1; i >= 0; i--) {
        const periodEnd = now - (i * 24 * 60 * 60 * 1000)
        const periodStart = periodEnd - (24 * 60 * 60 * 1000)
        
        // Get hourly data for this 24-hour period
        const periodHourlyData = hourlyData.filter(h => 
          h.timestamp >= periodStart && h.timestamp < periodEnd
        )
        
        const totalActiveTime = periodHourlyData.reduce((sum, h) => sum + h.activeTime, 0)
        const totalInactiveTime = periodHourlyData.reduce((sum, h) => sum + h.inactiveTime, 0)
        const totalActiveSessions = periodHourlyData.reduce((sum, h) => sum + h.activeSessions, 0)
        const totalInactiveSessions = periodHourlyData.reduce((sum, h) => sum + h.inactiveSessions, 0)
        
        // Check if this is the current 24-hour period
        const isCurrentPeriod = i === 0
        let finalActiveTime = totalActiveTime
        let finalInactiveTime = totalInactiveTime
        
        if (isCurrentPeriod && currentSessionStatus && currentSessionDuration > 0) {
          if (currentSessionStatus.type === 'active') {
            finalActiveTime += currentSessionDuration
          } else if (currentSessionStatus.type === 'inactive') {
            finalInactiveTime += currentSessionDuration
          }
        }
        
        // Format the period label
        const periodLabel = i === 0 ? 'Now' : 
                           i === 1 ? '1d ago' :
                           `${i}d ago`
        
        periodData.push({
          date: periodLabel,
          hour: 0, // Not applicable for period view
          active: Math.floor(finalActiveTime / 1000 / 60), // Convert to minutes (no rounding up)
          inactive: Math.floor(finalInactiveTime / 1000 / 60), // Convert to minutes (no rounding up)
          activeSessions: totalActiveSessions,
          inactiveSessions: totalInactiveSessions,
          isCurrentHour: false,
          isPastHour: i > 0,
          isFutureHour: false,
          hasLiveData: isCurrentPeriod && currentSessionStatus
        })
      }
      
      return periodData
    }
  }, [hourlyData, timePeriod, currentSessionStatus, currentSessionDuration])

  const formatDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex-1 flex flex-col gap-6 p-6 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Activity Dashboard</h1>
                <p className="text-muted-foreground">
                  Track your activity and inactivity patterns
                </p>
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-4 w-4 bg-muted rounded"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!activityStats) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex-1 flex flex-col gap-6 p-6 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Activity Dashboard</h1>
                <p className="text-muted-foreground">
                  Track your activity and inactivity patterns
                </p>
              </div>
            </div>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity data available</p>
                  <p className="text-sm">Start using the application to see your activity statistics</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const activityPercentage = getActivityPercentage()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex-1 flex flex-col gap-6 p-6 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                Activity Dashboard
                <div className="flex items-center gap-1 text-sm font-normal">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-600 text-base">Real-time</span>
                </div>
              </h1>
              <p className="text-muted-foreground">
                Track your activity and inactivity patterns with live updates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={
                currentSessionStatus?.type === 'break' ? "secondary" :
                currentSessionStatus?.type === 'active' ? "default" : "secondary"
              } className="text-sm">
                {currentSessionStatus?.type === 'active' ? 'Active Session' :
                 currentSessionStatus?.type === 'inactive' ? 'Inactive Session' :
                 currentSessionStatus?.type === 'break' ? 'Break Session' :
                 'No Session'}
              </Badge>
              <Badge variant="secondary" className="text-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                Live: {lastUpdateTime}
              </Badge>
            </div>
          </div>

      {/* Activity Overview Cards */}
      <div className="space-y-6">
        {/* Monthly Total Cards Section */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Monthly Totals
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
                <div className="text-3xl font-bold text-green-600">{formatDuration(monthlyTotals?.totalActiveTime || 0)}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Since {monthlyTotals?.startDate || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inactive Time</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
                <div className="text-3xl font-bold text-orange-600">{formatDuration(monthlyTotals?.totalInactiveTime || 0)}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Since {monthlyTotals?.startDate || 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Today's Activity Cards Section */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Today's Activity
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today Active</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{formatDuration(todaysActivity?.todayActiveTime || 0)}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Resets daily at midnight
            </p>
          </CardContent>
        </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today Inactive</CardTitle>
                <MousePointer className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{formatDuration(todaysActivity?.todayInactiveTime || 0)}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Resets daily at midnight
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Session & Status Cards Section */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            Current Status
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Session</CardTitle>
                <Clock className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
                <div className="text-3xl font-bold text-indigo-600">
              {currentSessionStatus?.type === 'break' ? 'On Break' : formatDuration(currentSessionDuration)}
            </div>
                <p className="text-sm text-muted-foreground mt-1">
              {currentSessionStatus?.type === 'active' ? 'Active Session Ongoing' :
               currentSessionStatus?.type === 'inactive' ? 'Inactive Session' :
               currentSessionStatus?.type === 'break' ? 'Break Session' :
               'No Active Session'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivity Alerts</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
                <div className="text-3xl font-bold text-red-600">{activityStats.totalInactivityAlerts}</div>
                <p className="text-sm text-muted-foreground mt-1">
              {activityStats.todayInactiveSessions} inactive sessions today
            </p>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>

      {/* Activity Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Overview</CardTitle>
          <CardDescription>
            Your productivity score based on active vs inactive time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Productivity Score</span>
              <span className="font-medium">
                {getActivityPercentage().toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={getActivityPercentage()} 
              className="w-full" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Active: {formatDuration(activityStats.totalActiveTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>Inactive: {formatDuration(activityStats.totalInactiveTime)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Activity Trend
                {generateChartData.some(d => d.hasLiveData) && (
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 font-medium">Live</span>
                  </div>
                )}
              </CardTitle>
          <CardDescription>
                {timePeriod === 'today' 
                  ? `Hourly breakdown for today (${new Date().toLocaleDateString()}) in minutes`
                  : timePeriod === '24hours'
                  ? 'Rolling 24-hour periods in minutes'
                  : timePeriod === '7days'
                  ? '7 rolling 24-hour periods (168 hours total) in minutes'
                  : '30 rolling 24-hour periods (720 hours total) in minutes'
                }
                {generateChartData.some(d => d.hasLiveData) && (
                  <span className="text-green-600"> • Real-time updates</span>
                )}
          </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Time Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="24hours">Last 24 Hours</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {generateChartData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generateChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const dataPoint = generateChartData.find(d => d.date === label);
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium">{label}</p>
                              {dataPoint?.hasLiveData && (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs text-green-600 font-medium">Live Data</span>
                                </div>
                              )}
                              {dataPoint?.isFutureHour && (
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Future</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-sm">
                                    {entry.name}: {entry.value} min
                                    {dataPoint?.hasLiveData && entry.dataKey === currentSessionStatus?.type && (
                                      <span className="text-green-600 ml-1">⚡</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                              {dataPoint && (
                                <div className="text-xs text-muted-foreground mt-2 pt-1 border-t">
                                  Sessions: {dataPoint.activeSessions + dataPoint.inactiveSessions}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="active" 
                    stroke="#22c55e" 
                    strokeWidth={2} 
                    dot={(props) => {
                      const dataPoint = generateChartData[props.index];
                      if (dataPoint?.hasLiveData) {
                        return (
                          <circle 
                            key={`active-${props.index}`}
                            cx={props.cx} 
                            cy={props.cy} 
                            r={6} 
                            fill="#22c55e"
                            stroke="#ffffff"
                            strokeWidth={2}
                            className="animate-pulse"
                          />
                        );
                      }
                      if (dataPoint?.isFutureHour) {
                        return (
                          <circle 
                            key={`active-${props.index}`}
                            cx={props.cx} 
                            cy={props.cy} 
                            r={3} 
                            fill="#22c55e"
                            opacity={0.3}
                          />
                        );
                      }
                      return <circle key={`active-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill="#22c55e" />;
                    }}
                    name="Active Time"
                    connectNulls={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="inactive" 
                    stroke="#f97316" 
                    strokeWidth={2} 
                    dot={(props) => {
                      const dataPoint = generateChartData[props.index];
                      if (dataPoint?.hasLiveData) {
                        return (
                          <circle 
                            key={`inactive-${props.index}`}
                            cx={props.cx} 
                            cy={props.cy} 
                            r={6} 
                            fill="#f97316"
                            stroke="#ffffff"
                            strokeWidth={2}
                            className="animate-pulse"
                          />
                        );
                      }
                      if (dataPoint?.isFutureHour) {
                        return (
                          <circle 
                            key={`inactive-${props.index}`}
                            cx={props.cx} 
                            cy={props.cy} 
                            r={3} 
                            fill="#f97316"
                            opacity={0.3}
                          />
                        );
                      }
                      return <circle key={`inactive-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill="#f97316" />;
                    }}
                    name="Inactive Time"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity data for chart</p>
                <p className="text-sm">Use the application to generate activity data</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Sessions</CardTitle>
          <CardDescription>
            Your latest active and inactive sessions ({activitySessions.length} total sessions)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full rounded-md border p-4">
            <div className="space-y-4">
            {activitySessions.slice(-15).reverse().map((session, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-card/50 hover:bg-card transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    session.type === 'active' ? 'bg-green-500' : 
                    session.type === 'inactive' ? 'bg-orange-500' : 
                    'bg-yellow-500'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium">
                      {session.type === 'active' ? 'Active Session' : 
                       session.type === 'inactive' ? 'Inactive Session' : 
                       'Break Session'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started: {formatTime(session.startTime)}
                    </p>
                    {session.endTime && (
                      <p className="text-xs text-muted-foreground">
                        Ended: {formatTime(session.endTime)}
                          {session.endReason && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                              session.endReason === 'logout' ? 'bg-red-100 text-red-700' :
                              session.endReason === 'inactivity' ? 'bg-orange-100 text-orange-700' :
                              session.endReason === 'break' ? 'bg-yellow-100 text-yellow-700' :
                              session.endReason === 'app-close' ? 'bg-gray-100 text-gray-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {session.endReason === 'logout' ? 'User Logout' :
                               session.endReason === 'inactivity' ? 'Inactivity' :
                               session.endReason === 'break' ? 'Break Started' :
                               session.endReason === 'app-close' ? 'App Closed' :
                               'User Active'}
                            </span>
                          )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {session.type === 'break' ? 'On Break' :
                     session.duration ? formatDuration(session.duration) : 
                     session.endTime ? 'Completed' : 'Ongoing'}
                  </p>
                  {!session.endTime && session.type !== 'break' && (
                    <p className="text-xs text-orange-500">
                      In Progress
                    </p>
                  )}
                </div>
              </div>
            ))}
            {activitySessions.length === 0 && (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No activity sessions yet</p>
                <p className="text-sm text-muted-foreground">Start using the application to see your activity history</p>
              </div>
            )}
          </div>
          </ScrollArea>
        </CardContent>
      </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 