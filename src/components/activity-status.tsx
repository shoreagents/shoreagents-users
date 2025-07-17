"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, Moon, Sun, MousePointer, Clock } from 'lucide-react'

interface ActivityStatus {
  lastActivityTime: number
  isTracking: boolean
  mousePosition: { x: number; y: number }
  timeSinceLastActivity: number
  isSystemSuspended: boolean
  systemIdleTime: number | null
}

export function ActivityStatus() {
  const [status, setStatus] = useState<ActivityStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    const updateStatus = async () => {
      if (window.electronAPI?.activityTracking?.getStatus) {
        try {
          const activityStatus = await window.electronAPI.activityTracking.getStatus()
          setStatus(activityStatus)
          setLastUpdate(new Date())
        } catch (error) {
          console.error('Error getting activity status:', error)
        }
      }
    }

    // Update immediately
    updateStatus()

    // Update every 2 seconds
    const interval = setInterval(updateStatus, 2000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }



  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Monitor
          </CardTitle>
          <CardDescription>Loading activity status...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Monitor
          {status.isSystemSuspended ? (
            <Moon className="h-4 w-4 text-blue-500" />
          ) : (
            <Sun className="h-4 w-4 text-yellow-500" />
          )}
        </CardTitle>
        <CardDescription>
          Real-time activity tracking status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tracking Status:</span>
              <Badge variant={status.isTracking ? "default" : "secondary"}>
                {status.isTracking ? "Active" : "Stopped"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Status:</span>
              <Badge variant={status.isSystemSuspended ? "destructive" : "default"}>
                {status.isSystemSuspended ? "Suspended" : "Active"}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Activity:</span>
              <span className="text-sm text-muted-foreground">
                {formatTime(status.timeSinceLastActivity)} ago
              </span>
            </div>
            
            {status.systemIdleTime !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">System Idle:</span>
                <span className="text-sm text-muted-foreground">
                  {formatTime(status.systemIdleTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MousePointer className="h-4 w-4" />
            <span className="text-sm font-medium">Mouse Position:</span>
            <span className="text-sm text-muted-foreground">
              x: {status.mousePosition.x}, y: {status.mousePosition.y}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Last Update:</span>
            <span className="text-sm text-muted-foreground">
              {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
          >
            Refresh Status
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Activity tracking detects system sleep/wake cycles</p>
          <p>• Mouse tracking pauses during system idle or suspend</p>
          <p>• Manual activity resets disabled to prevent cheating</p>
          <p>• Activity resumes naturally when user becomes active</p>
          <p>• System idle time prevents false activity recording</p>
          <p>• Sleep time is NOT counted as active or inactive time</p>
        </div>
      </CardContent>
    </Card>
  )
} 