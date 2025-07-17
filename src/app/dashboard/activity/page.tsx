"use client"

import { useState, useEffect, useMemo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Activity, Clock, MousePointer, TrendingUp, TrendingDown } from "lucide-react"
import { getCurrentUser } from "@/lib/ticket-utils"
import { getActivitySummary, getUserActivityData, getCurrentSessionStatus, cleanupDuplicateSessions } from "@/lib/activity-storage"
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
}

export default function ActivityPage() {
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null)
  const [activitySessions, setActivitySessions] = useState<ActivitySession[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')
  const [currentSessionStatus, setCurrentSessionStatus] = useState<any>(null)

  useEffect(() => {
    const loadActivityData = () => {
      const currentUser = getCurrentUser()
      if (currentUser) {
        // First clean up any incomplete sessions
        cleanupDuplicateSessions(currentUser.email);
        
        const stats = getActivitySummary(currentUser.email)
        const fullData = getUserActivityData(currentUser.email)
        const sessionStatus = getCurrentSessionStatus(currentUser.email)
        
        setActivityStats(stats)
        setActivitySessions(fullData?.activitySessions || [])
        setCurrentSessionStatus(sessionStatus)
        setLastUpdateTime(new Date().toLocaleTimeString())
      }
      setLoading(false)
    }

    loadActivityData()
    
    // Refresh data every 3 seconds for real-time updates
    const interval = setInterval(loadActivityData, 3000)
    
    return () => clearInterval(interval)
  }, [])

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
    if (!activityStats) return 0
    
    const totalTime = activityStats.totalActiveTime + activityStats.totalInactiveTime
    return totalTime > 0 ? (activityStats.totalActiveTime / totalTime) * 100 : 0
  }

  // Generate chart data from activity sessions
  const generateChartData = useMemo(() => {
    if (!activitySessions.length) return []
    
    const now = Date.now()
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - (6 - i) * 24 * 60 * 60 * 1000)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
      
      const daySessions = activitySessions.filter(session => 
        session.startTime >= startOfDay && session.startTime <= endOfDay
      )
      
      const activeTime = daySessions
        .filter(s => s.type === 'active' && s.duration)
        .reduce((total, s) => total + (s.duration || 0), 0)
      
      const inactiveTime = daySessions
        .filter(s => s.type === 'inactive' && s.duration)
        .reduce((total, s) => total + (s.duration || 0), 0)
      
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        active: Math.round(activeTime / 1000 / 60), // Convert to minutes
        inactive: Math.round(inactiveTime / 1000 / 60), // Convert to minutes
        activeSessions: daySessions.filter(s => s.type === 'active').length,
        inactiveSessions: daySessions.filter(s => s.type === 'inactive').length
      }
    })
    
    return last7Days
  }, [activitySessions])

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
              <h1 className="text-3xl font-bold tracking-tight">Activity Dashboard</h1>
              <p className="text-muted-foreground">
                Track your activity and inactivity patterns
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
              <Badge variant="secondary" className="text-sm">
                Updated: {lastUpdateTime}
              </Badge>
            </div>
          </div>

      {/* Activity Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(activityStats.totalActiveTime)}</div>
            <p className="text-xs text-muted-foreground">
              {activityPercentage.toFixed(1)}% of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inactive Time</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(activityStats.totalInactiveTime)}</div>
            <p className="text-xs text-muted-foreground">
              {(100 - activityPercentage).toFixed(1)}% of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Session</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentSessionStatus?.type === 'break' ? 'On Break' : formatDuration(currentSessionDuration)}
            </div>
            <p className="text-xs text-muted-foreground">
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
            <div className="text-2xl font-bold">{activityStats.totalInactivityAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {activityStats.todayInactiveSessions} inactive sessions today
            </p>
          </CardContent>
        </Card>
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
                {activityStats.totalActiveTime + activityStats.totalInactiveTime > 0 
                  ? Math.round((activityStats.totalActiveTime / (activityStats.totalActiveTime + activityStats.totalInactiveTime)) * 100)
                  : 0}%
              </span>
            </div>
            <Progress 
              value={activityStats.totalActiveTime + activityStats.totalInactiveTime > 0 
                ? (activityStats.totalActiveTime / (activityStats.totalActiveTime + activityStats.totalInactiveTime)) * 100
                : 0
              } 
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
          <CardTitle>Activity Trend</CardTitle>
          <CardDescription>
            Daily active and inactive time over the last 7 days (in minutes)
          </CardDescription>
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
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium mb-2">{label}</p>
                            <div className="space-y-1">
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-sm">
                                    {entry.name}: {entry.value} min
                                  </span>
                                </div>
                              ))}
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
                    dot={{ r: 4 }} 
                    name="Active Time"
                    connectNulls={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="inactive" 
                    stroke="#f97316" 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
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
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activitySessions.slice(-15).reverse().map((session, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
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
        </CardContent>
      </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 