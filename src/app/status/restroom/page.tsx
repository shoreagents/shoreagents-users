"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Toilet, CheckCircle, XCircle, Clock, BarChart3 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useRestroom } from "@/contexts/restroom-context"
import { useEventsContext } from '@/contexts/events-context'
import { useHealth } from '@/contexts/health-context'
import { useMeeting } from '@/contexts/meeting-context'
import { useBreak } from '@/contexts/break-context'
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function RestroomPage() {
  const { 
    isInRestroom, 
    restroomCount, 
    dailyRestroomCount, 
    restroomStatus, 
    isLoading, 
    isUpdating, 
    error, 
    updateRestroomStatus,
    fetchRestroomStatus
  } = useRestroom()
  
  // Get agent state contexts
  const { isInEvent } = useEventsContext()
  const { isGoingToClinic, isInClinic } = useHealth()
  const { isInMeeting } = useMeeting()
  const { isBreakActive } = useBreak()

  // Check if restroom should be disabled
  const shouldDisableRestroom = isInEvent || isGoingToClinic || isInClinic || isInMeeting || isBreakActive

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="p-6 space-y-6">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>

            {/* Button Skeleton */}
            <div className="flex justify-center">
              <Skeleton className="h-24 w-full" />
            </div>

            {/* Cards Skeleton */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tips Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="mx-auto p-6 space-y-6">
      {/* Header with Quick Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Toilet className="h-8 w-8 text-blue-600" />
            Restroom Break
          </h1>
          <p className="text-muted-foreground">
            Quick access to manage your restroom availability
          </p>
        </div>
        
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single Toggle Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => updateRestroomStatus(!isInRestroom)}
          disabled={isUpdating || shouldDisableRestroom}
          variant={isInRestroom ? "destructive" : "default"}
          size="lg"
          className="h-24 w-full text-xl font-bold"
        >
          {isUpdating ? (
            <Loader2 className="h-8 w-8 animate-spin mr-4" />
          ) : isInRestroom ? (
            <CheckCircle className="h-8 w-8 mr-4" />
          ) : (
            <Toilet className="h-8 w-8 mr-4" />
          )}
          {isInRestroom ? 'Finish Restroom' : 'Take Restroom'}
        </Button>
      </div>

      {/* Disabled message */}
      {shouldDisableRestroom && (
        <div className="text-center text-muted-foreground text-sm mt-4">
          {isInEvent && "Restroom is disabled while in an event/activity"}
          {isGoingToClinic && "Restroom is disabled while going to clinic"}
          {isInClinic && "Restroom is disabled while in clinic"}
          {isInMeeting && "Restroom is disabled while in a meeting"}
          {isBreakActive && "Restroom is disabled while on break"}
        </div>
      )}


      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Status
            </CardTitle>
            <CardDescription>
              Your current restroom availability status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              {restroomStatus ? (
                <div className="space-y-3">
                  <div className={`text-3xl font-bold ${isInRestroom ? 'text-red-600' : 'text-green-600'}`}>
                    {isInRestroom ? 'In Restroom' : 'Available'}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No status recorded</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Today's Stats
            </CardTitle>
            <CardDescription>
              Your restroom visit statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              {restroomStatus ? (
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-blue-600">
                    {dailyRestroomCount}
                  </div>
                  <div className="text-lg text-muted-foreground">
                    visit{dailyRestroomCount !== 1 ? 's' : ''} today
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dailyRestroomCount === 0 ? 'No visits yet' : 
                     dailyRestroomCount < 3 ? 'Good frequency' : 
                     dailyRestroomCount < 6 ? 'Moderate usage' : 'High frequency'}
                  </div>
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Total: {restroomCount} visits
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quick Tips
          </CardTitle>
          <CardDescription>
            Best practices for restroom breaks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium text-blue-900 dark:text-blue-100">Quick Access</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Use the large buttons above for instant status updates
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <Clock className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium text-green-900 dark:text-green-100">Stay Hydrated</div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Regular breaks help maintain productivity and health
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
