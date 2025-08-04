"use client"

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useTimer } from '@/contexts/timer-context'
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

  // Format date to readable format


  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-8 p-8 pt-4 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Activity Dashboard
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Real-time productivity tracking with live analytics
              </p>
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
            <Card className="lg:col-span-1 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
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
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">Status</span>
              </div>
                    <Badge variant="outline" className="border-green-200 text-green-700">
                      Online
                    </Badge>
                  </div>
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
            <Card className="lg:col-span-2 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
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
                        variant={timerData.isActive ? "default" : "secondary"}
                        className={timerData.isActive ? "bg-green-500 hover:bg-green-600" : ""}
                      >
                        {timerData.isActive ? '🟢 Active' : '⚪ Inactive'}
                      </Badge>
          </div>
          
                    {/* Timer Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-700">Active Time</span>
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatTime(liveActiveSeconds)}
            </div>
          </div>
                      
                      <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-red-700">Inactive Time</span>
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  </div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatTime(liveInactiveSeconds)}
            </div>
            </div>
          </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Productivity Ratio</span>
                        <span className="font-medium">
                          {liveActiveSeconds + liveInactiveSeconds > 0 
                            ? Math.round((liveActiveSeconds / (liveActiveSeconds + liveInactiveSeconds)) * 100)
                            : 0}%
                                  </span>
                                </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${liveActiveSeconds + liveInactiveSeconds > 0 
                              ? (liveActiveSeconds / (liveActiveSeconds + liveInactiveSeconds)) * 100 
                              : 0}%` 
                          }}
                        ></div>
                            </div>
                          </div>
            </div>
          ) : (
                  <div className="flex items-center justify-center py-12">
              <div className="text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-6 h-6 text-gray-400" />
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
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Activity Analytics</h2>
              <p className="text-gray-600">Track your productivity across different time periods</p>
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