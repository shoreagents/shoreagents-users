"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEventsContext } from '@/contexts/events-context'
import { useMeeting } from '@/contexts/meeting-context'
import { useSocket } from '@/contexts/socket-context'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Calendar, 
  Clock,
  Users,
  MapPin,
  Move,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Square
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalEventIndicatorProps {
  className?: string
}

export const GlobalEventIndicator = React.memo(function GlobalEventIndicator({ className }: GlobalEventIndicatorProps) {
  const {
    currentEvent,
    isInEvent,
    joinEvent,
    joinEventAfterMeetingEnd,
    leaveEvent,
    isEventJoinable,
    isEventLeavable,
    isEventJoinBlockedByMeeting
  } = useEventsContext()
  
  const { endCurrentMeeting, currentMeeting } = useMeeting()
  const { socket, isConnected } = useSocket()
  
  const [isVisible, setIsVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 24, y: 100 }) // Default position below meeting indicator
  const [isMinimized, setIsMinimized] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [showMeetingBlockedDialog, setShowMeetingBlockedDialog] = useState(false)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Save position to localStorage whenever it changes
  const savePosition = useCallback((newPosition: { x: number; y: number }) => {
    try {
      localStorage.setItem('event-indicator-position', JSON.stringify(newPosition))
    } catch (error) {
      console.warn('Failed to save event indicator position:', error)
    }
  }, [])

  // Load position from localStorage on component mount
  useEffect(() => {
    try {
      const savedPosition = localStorage.getItem('event-indicator-position')
      if (savedPosition) {
        const parsedPosition = JSON.parse(savedPosition)
        if (parsedPosition && typeof parsedPosition.x === 'number' && typeof parsedPosition.y === 'number') {
          setPosition(parsedPosition)
        }
      }
    } catch (error) {
      console.warn('Failed to load event indicator position:', error)
    }
  }, [])

  // Check if event has actually started based on current time
  const hasEventStarted = useCallback((event: any) => {
    if (!event || !event.start_time) return false
    
    try {
      const now = new Date()
      const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
      const currentTime = philippinesTime.toTimeString().split(' ')[0] // Get HH:MM:SS format
      
      // Compare time strings directly
      return currentTime >= event.start_time
    } catch {
      return false
    }
  }, [])

  // Show indicator when there's an active event (started today) AND it has actually started
  useEffect(() => {
    if (currentEvent && hasEventStarted(currentEvent)) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [currentEvent, hasEventStarted])

  // Listen for real-time socket events to update immediately
  useEffect(() => {
    if (!socket || !isConnected) return
    const handleEventChange = (data: any) => {
      // Force a refresh of the events context
      if (currentEvent && hasEventStarted(currentEvent)) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    const handleEventUpdated = (data: any) => {
      // Force a refresh of the events context
      if (currentEvent && hasEventStarted(currentEvent)) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    // Listen for socket events
    socket.on('event-change', handleEventChange)
    socket.on('event-updated', handleEventUpdated)

    return () => {
      socket.off('event-change', handleEventChange)
      socket.off('event-updated', handleEventUpdated)
    }
  }, [socket, isConnected, currentEvent, hasEventStarted])

  // Set up a timer to check periodically if an event has started (fallback)
  useEffect(() => {
    if (!currentEvent) return

    // Check immediately
    if (hasEventStarted(currentEvent)) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }

    // Set up interval to check every 1 second for immediate updates
    const interval = setInterval(() => {
      if (currentEvent && hasEventStarted(currentEvent)) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }, 1000) // Check every 1 second for immediate updates

    return () => clearInterval(interval)
  }, [currentEvent, hasEventStarted])

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow dragging from anywhere in the header area
    const target = e.target as HTMLElement
    if (target.closest('button')) return // Don't drag if clicking on buttons
    
    setIsDragging(true)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Handle drag move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    }
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 300)
    const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 200)
    
    newPosition.x = Math.max(0, Math.min(newPosition.x, maxX))
    newPosition.y = Math.max(0, Math.min(newPosition.y, maxY))
    
    setPosition(newPosition)
    savePosition(newPosition)
  }, [isDragging, dragOffset, savePosition])

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Handle join event
  const handleJoinEvent = async () => {
    if (!currentEvent || isJoining) return
    
    try {
      setIsJoining(true)
      await joinEvent(currentEvent.event_id)
    } catch (error) {
      // Check if error is due to meeting conflict
      if (error instanceof Error && error.message.includes('Cannot join event while in a meeting')) {
        setShowMeetingBlockedDialog(true)
      } else {
        console.error('Failed to join event:', error)
      }
    } finally {
      setIsJoining(false)
    }
  }

  // Handle leave event
  const handleLeaveEvent = async () => {
    if (!currentEvent || isLeaving) return
    try {
      setIsLeaving(true)
      await leaveEvent(currentEvent.event_id)
    } catch (error) {
      console.error('Failed to leave event:', error)
    } finally {
      setIsLeaving(false)
    }
  }

  // Handle end meeting and join event
  const handleEndMeetingAndJoin = async () => {
    if (!currentMeeting || isEndingMeeting) return
    try {
      setIsEndingMeeting(true)
      await endCurrentMeeting(currentMeeting.id)
      setShowMeetingBlockedDialog(false)
      
      // After ending meeting, try to join the event using the bypass function
      if (currentEvent) {
        await joinEventAfterMeetingEnd(currentEvent.event_id)
      }
    } catch (error) {
      console.error('Failed to end meeting:', error)
    } finally {
      setIsEndingMeeting(false)
    }
  }

  // Get event type color
  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'activity':
        return 'bg-green-500'
      case 'event':
      default:
        return 'bg-blue-500'
    }
  }

  // Get event type icon
  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'activity':
        return <Users className="h-4 w-4" />
      case 'event':
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  // Get event type display name
  const getEventTypeDisplayName = (eventType: string) => {
    switch (eventType) {
      case 'activity':
        return 'Activity'
      case 'event':
      default:
        return 'Event'
    }
  }

  // Format time
  const formatTime = (timeString: string) => {
    try {
      const time = new Date(`2000-01-01T${timeString}`)
      return time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    } catch {
      return timeString
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  if (!isVisible || !currentEvent) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 select-none",
        isDragging && "cursor-grabbing",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s ease-in-out'
      }}
    >
      <div className={cn(
        "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
        "backdrop-blur-sm bg-white/95 dark:bg-gray-800/95",
        "min-w-[240px] max-w-[280px]",
        isMinimized ? "h-12" : "h-auto"
      )}>
        {/* Header with brand gradient background */}
        <div 
          className="relative bg-gradient-to-r from-primary to-secondary dark:from-primary dark:to-secondary rounded-t-xl p-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg text-white shadow-md",
                "bg-white/20 backdrop-blur-sm border border-white/30",
                getEventTypeColor(currentEvent.event_type || 'event')
              )}>
                {getEventTypeIcon(currentEvent.event_type || 'event')}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  {isInEvent ? `In ${getEventTypeDisplayName(currentEvent.event_type || 'event')}` : `${getEventTypeDisplayName(currentEvent.event_type || 'event')} Started`}
                </h3>
                <p className="text-white/80 text-xs font-medium">
                  {getEventTypeDisplayName(currentEvent.event_type || 'event')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMinimized(!isMinimized)
                }}
              >
                {isMinimized ? <Calendar className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          
          {/* Drag handle - more prominent */}
          <div className="absolute top-1 right-8 opacity-40 hover:opacity-80 transition-opacity cursor-grab">
            <Move className="h-3 w-3 text-white" />
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Content area */}
            <div className="p-2">
              {/* Event Details - Simplified */}
              <div className="space-y-1.5">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                    {currentEvent.title}
                  </h4>
                </div>

                {/* Event Info - Minimal */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(currentEvent.start_time)}</span>
                  </div>
                  
                  {currentEvent.location && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{currentEvent.location}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-2">
                  {isInEvent && isEventLeavable(currentEvent) && (
                    <Button
                      onClick={handleLeaveEvent}
                      size="sm"
                      variant="destructive"
                      className="flex-1 text-xs"
                      disabled={isLeaving}
                    >
                      {isLeaving ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {isLeaving ? 'Leaving...' : 'Leave'}
                    </Button>
                  )}
                  
                  {!isInEvent && isEventJoinable(currentEvent) && (
                    <Button
                      onClick={handleJoinEvent}
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={isJoining}
                    >
                      {isJoining ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Calendar className="h-3 w-3 mr-1" />
                      )}
                      {isJoining ? 'Joining...' : 'Join'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Meeting Blocked Dialog */}
      <Dialog open={showMeetingBlockedDialog} onOpenChange={setShowMeetingBlockedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Cannot Join Event
            </DialogTitle>
            <DialogDescription>
              You cannot join the event while you are currently in a meeting. Please end your meeting first before joining the event.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button 
              onClick={() => setShowMeetingBlockedDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEndMeetingAndJoin}
              variant="destructive"
              disabled={isEndingMeeting || !currentMeeting}
            >
              {isEndingMeeting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ending Meeting...
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  End Meeting & Join Event
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
