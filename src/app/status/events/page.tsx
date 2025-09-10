"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Square,
  RefreshCw
} from "lucide-react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCurrentUserInfo } from "@/lib/user-profiles"
import { useEventsContext } from "@/contexts/events-context"
import { useMeeting } from "@/contexts/meeting-context"
import { 
  type Event 
} from "@/hooks/use-events"



const statusColors = {
  upcoming: 'bg-blue-100 text-blue-800',
  today: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  ended: 'bg-gray-100 text-gray-800'
}

const statusIcons = {
  upcoming: Clock,
  today: Play,
  cancelled: XCircle,
  ended: CheckCircle
}

const eventTypeColors = {
  event: 'bg-blue-100 text-blue-800',
  activity: 'bg-green-100 text-green-800'
}

const eventTypeIcons = {
  event: Calendar,
  activity: Users
}

// Helper function to get event type display name
const getEventTypeDisplayName = (eventType: string) => {
  switch (eventType) {
    case 'activity':
      return 'Activity'
    case 'event':
    default:
      return 'Event'
  }
}

export default function EventsPage() {
  // URL parameters
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const eventIdParam = searchParams.get('eventId')
  
  // Dialog state
  const [showMeetingBlockedDialog, setShowMeetingBlockedDialog] = useState(false)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const [pendingEventId, setPendingEventId] = useState<number | null>(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>('today')
  const [highlightedEventId, setHighlightedEventId] = useState<number | null>(null)
  
  // Events context
  const { 
    events, 
    isLoading, 
    joinEvent, 
    joinEventAfterMeetingEnd,
    leaveEvent, 
    getEventStatus, 
    isEventJoinable, 
    isEventLeavable,
    isInMeeting,
    eventBlockedReason
  } = useEventsContext()
  
  // Meeting context
  const { endCurrentMeeting, currentMeeting } = useMeeting()
  
  // Initialize state from URL parameters
  useEffect(() => {
    if (tabParam && ['today', 'upcoming', 'cancelled', 'ended'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
    
    if (eventIdParam) {
      const eventId = parseInt(eventIdParam)
      if (!isNaN(eventId)) {
        setHighlightedEventId(eventId)
      }
    }
  }, []) // Run only once on mount
  
  // Handle URL parameter changes
  useEffect(() => {
    if (tabParam && ['today', 'upcoming', 'cancelled', 'ended'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  // Force activeTab to match URL parameter when it changes
  useEffect(() => {
    if (tabParam && ['today', 'upcoming', 'cancelled', 'ended'].includes(tabParam)) {
      if (activeTab !== tabParam) {
        setActiveTab(tabParam)
      }
    }
  }, [tabParam, activeTab])
  
  // Handle eventId parameter changes
  useEffect(() => {
    if (eventIdParam) {
      const eventId = parseInt(eventIdParam)
      if (!isNaN(eventId)) {
        setHighlightedEventId(eventId)
      }
    } else {
      setHighlightedEventId(null)
    }
  }, [eventIdParam])
  
  // Handle event highlighting with Framer Motion
  useEffect(() => {
    if (highlightedEventId && events.length > 0) {
      
      // Wait for events to load and then scroll to the highlighted event
      setTimeout(() => {
        const eventElement = document.getElementById(`event-${highlightedEventId}`)
        
        if (eventElement) {
          eventElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          })
          
          // Clear highlight after 2 seconds with smooth fade out
          setTimeout(() => {
            setHighlightedEventId(null)
          }, 2000)
        } else {
          setTimeout(() => {
            const retryElement = document.getElementById(`event-${highlightedEventId}`)
            if (retryElement) {
              retryElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              })
              
              // Clear highlight after 2 seconds
              setTimeout(() => {
                setHighlightedEventId(null)
              }, 2000)
            }
          }, 1000)
        }
      }, 1000) // Increased from 500ms to 1000ms
    }
  }, [highlightedEventId, events])

  // Handle going to event
  const handleGoing = async (eventId: number) => {
    try {
      await joinEvent(eventId)
    } catch (error) {
      // Check if error is due to meeting conflict
      if (error instanceof Error && error.message.includes('Cannot join event while in a meeting')) {
        setPendingEventId(eventId)
        setShowMeetingBlockedDialog(true)
      } else {
        console.error('Failed to join event:', error)
      }
    }
  }

  // Handle end meeting and join event
  const handleEndMeetingAndJoin = async () => {
    if (!currentMeeting || isEndingMeeting || !pendingEventId) return
    try {
      setIsEndingMeeting(true)
      await endCurrentMeeting(currentMeeting.id)
      setShowMeetingBlockedDialog(false)
      
      // After ending meeting, try to join the pending event using the bypass function
      await joinEventAfterMeetingEnd(pendingEventId)
    } catch (error) {
      console.error('Failed to end meeting:', error)
    } finally {
      setIsEndingMeeting(false)
      setPendingEventId(null)
    }
  }

  // Handle coming back from event
  const handleBack = async (eventId: number) => {
    try {
      await leaveEvent(eventId)
    } catch (error) {
      console.error('Failed to leave event:', error)
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Format time for display
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Helper function to check if event is today but hasn't started yet
  const isEventNotStarted = (event: Event) => {
    // Get current time in Philippines timezone
    const now = new Date()
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    
    // Get today's date in YYYY-MM-DD format
    const today = philippinesTime.getFullYear() + '-' + 
                  String(philippinesTime.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(philippinesTime.getDate()).padStart(2, '0')
    
    // Extract date part from event_date (handle both date strings and ISO timestamps)
    let eventDate: string
    if (typeof event.event_date === 'string') {
      eventDate = event.event_date.includes('T') 
        ? event.event_date.split('T')[0] 
        : event.event_date
    } else {
      // It's a Date object - convert to Philippines timezone first
      const eventDateInPH = new Date((event.event_date as any).toLocaleString("en-US", {timeZone: "Asia/Manila"}))
      eventDate = eventDateInPH.getFullYear() + '-' + 
                  String(eventDateInPH.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(eventDateInPH.getDate()).padStart(2, '0')
    }
    
    // Only check if event is today
    if (eventDate !== today) {
      return false
    }
    
    // Create date objects for proper time comparison
    const currentHours = philippinesTime.getHours()
    const currentMinutes = philippinesTime.getMinutes()
    const currentSeconds = philippinesTime.getSeconds()
    
    // Parse event start time
    const [startHours, startMinutes, startSeconds] = event.start_time.split(':').map(Number)
    
    // Convert to total seconds for comparison
    const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds
    const startTotalSeconds = startHours * 3600 + startMinutes * 60 + (startSeconds || 0)
    
    return startTotalSeconds > currentTotalSeconds
  }

  // Helper function to check if event is in the future
  const isEventInFuture = (event: Event) => {
    // Get current time in Philippines timezone
    const now = new Date()
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    
    // Get today's date in YYYY-MM-DD format
    const today = philippinesTime.getFullYear() + '-' + 
                  String(philippinesTime.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(philippinesTime.getDate()).padStart(2, '0')
    
    // Extract date part from event_date (handle both date strings and ISO timestamps)
    let eventDate: string
    if (typeof event.event_date === 'string') {
      eventDate = event.event_date.includes('T') 
        ? event.event_date.split('T')[0] 
        : event.event_date
    } else {
      // It's a Date object - convert to Philippines timezone first
      const eventDateInPH = new Date((event.event_date as any).toLocaleString("en-US", {timeZone: "Asia/Manila"}))
      eventDate = eventDateInPH.getFullYear() + '-' + 
                  String(eventDateInPH.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(eventDateInPH.getDate()).padStart(2, '0')
    }
    
    return eventDate > today
  }

  // Filter events by status
  const upcomingEvents = events.filter(event => event.status === 'upcoming')
  const todayEvents = events.filter(event => event.status === 'today')
  const cancelledEvents = events.filter(event => event.status === 'cancelled')
  const endedEvents = events.filter(event => event.status === 'ended')

  // Event card component
  const EventCard = ({ event }: { event: Event }) => {
    const StatusIcon = statusIcons[event.status]
    const EventTypeIcon = eventTypeIcons[event.event_type || 'event']
    const isHighlighted = highlightedEventId === event.event_id
    
    return (
      <motion.div
        id={`event-${event.event_id}`}
        className="rounded-lg h-full"
        initial={false}
        animate={isHighlighted ? {
          scale: 1.05,
          boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.5)",
        } : {
          scale: 1,
          boxShadow: "0 0 0 0px rgba(59, 130, 246, 0)",
        }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 25,
          duration: 0.4,
          // Add different transitions for different properties
          scale: {
            type: "spring",
            stiffness: 200,
            damping: 25,
            duration: 0.4
          },
          boxShadow: {
            type: "tween",
            duration: 0.3,
            ease: "easeInOut"
          }
        }}
      >
        <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight">{event.title}</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Created by {event.created_by_name}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge className={`${eventTypeColors[event.event_type || 'event']} text-xs`}>
                <EventTypeIcon className="w-3 h-3 mr-1" />
                {getEventTypeDisplayName(event.event_type || 'event')}
              </Badge>
              <Badge className={`${statusColors[event.status]} text-xs`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col">
          <div className="space-y-2 flex-1 flex flex-col">
            {event.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
            )}
            
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs">{formatDate(event.event_date)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs">
                  {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </span>
              </div>
              
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs truncate">{event.location}</span>
                </div>
              )}
            </div>

            {/* User actions */}
            <div className="flex gap-2 pt-2 border-t">
              {/* Show Join button if event is joinable and not a 'today' event that hasn't started */}
              {isEventJoinable(event) && !(event.status === 'today' && isEventNotStarted(event)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGoing(event.event_id)}
                  disabled={isEventNotStarted(event)}
                  className="text-xs h-7 px-2"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Join {getEventTypeDisplayName(event.event_type || 'event')}
                </Button>
              )}
              
              {/* Show disabled join button with meeting blocking message */}
              {!isEventJoinable(event) && event.status !== 'cancelled' && event.status !== 'ended' && 
               !event.is_going && !event.is_back && isInMeeting && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="text-xs h-7 px-2 opacity-50"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Join {getEventTypeDisplayName(event.event_type || 'event')}
                </Button>
              )}
              
              {/* Show Leave button if event is leavable and not a 'today' event that hasn't started */}
              {isEventLeavable(event) && !(event.status === 'today' && isEventNotStarted(event)) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBack(event.event_id)}
                  disabled={isEventNotStarted(event)}
                  className="text-xs h-7 px-2"
                >
                  <Square className="w-3 h-3 mr-1" />
                  Leave {getEventTypeDisplayName(event.event_type || 'event')}
                </Button>
              )}
            </div>

            {/* Status messages - prioritize cancelled/ended over other statuses */}
            {event.status === 'cancelled' && (
              <p className="text-xs text-red-600 mt-1">
                This {getEventTypeDisplayName(event.event_type || 'event').toLowerCase()} has been cancelled
              </p>
            )}
            {event.status === 'ended' && (
              <p className="text-xs text-gray-600 mt-1">
                This {getEventTypeDisplayName(event.event_type || 'event').toLowerCase()} has ended
              </p>
            )}
            {event.status !== 'cancelled' && event.status !== 'ended' && isEventNotStarted(event) && !isEventInFuture(event) && (
              <p className="text-xs text-amber-600 mt-1">
                {getEventTypeDisplayName(event.event_type || 'event')} hasn't started yet - starts at {formatTime(event.start_time)}
              </p>
            )}
            {event.status !== 'cancelled' && event.status !== 'ended' && isEventInFuture(event) && (
              <p className="text-xs text-blue-600 mt-1">
                {getEventTypeDisplayName(event.event_type || 'event')} is scheduled for {formatDate(event.event_date)} - join when it starts
              </p>
            )}
            {getEventStatus(event.event_id) === 'joined' && event.going_at && (
              <p className="text-xs text-green-600 mt-1">
                You're currently in this {getEventTypeDisplayName(event.event_type || 'event').toLowerCase()} - joined at {new Date(event.going_at).toLocaleString()}
              </p>
            )}
            {!isEventJoinable(event) && event.status !== 'cancelled' && event.status !== 'ended' && 
             !event.is_going && !event.is_back && isInMeeting && (
              <p className="text-xs text-orange-600 mt-1">
                Cannot join {getEventTypeDisplayName(event.event_type || 'event').toLowerCase()} while in a meeting. Please end the meeting first.
              </p>
            )}
            {getEventStatus(event.event_id) === 'left' && event.back_at && (
              <p className="text-xs text-gray-600 mt-1">
                You left this event at {new Date(event.back_at).toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      </motion.div>
    )
  }

  // Loading skeleton
  const EventSkeleton = () => (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  )


  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen">
        <AppHeader />
        <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-3xl font-bold">Events & Activities</h1>
              <p className="text-muted-foreground">
                View and join company events and activities
              </p>
            </div>
          </div>

          {/* Events Tabs */}
          <Tabs 
            key={`${activeTab}-${highlightedEventId}`}
            value={activeTab} 
            onValueChange={(value) => {
              setActiveTab(value)
              // Update URL to match the tab change
              const newUrl = new URL(window.location.href)
              newUrl.searchParams.set('tab', value)
              newUrl.searchParams.delete('eventId') // Clear eventId when changing tabs
              window.history.replaceState({}, '', newUrl.toString())
            }} 
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="today">
                Today ({todayEvents.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming ({upcomingEvents.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelled ({cancelledEvents.length})
              </TabsTrigger>
              <TabsTrigger value="ended">
                Ended ({endedEvents.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <div className="p-4">
                <TabsContent value="today" className="space-y-4">
                  {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <EventSkeleton key={i} />)}
                    </div>
                  ) : todayEvents.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {todayEvents.map(event => <EventCard key={event.event_id} event={event} />)}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No events today</h3>
                        <p className="text-muted-foreground text-center">
                          There are no events scheduled for today.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="upcoming" className="space-y-4">
                  {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <EventSkeleton key={i} />)}
                    </div>
                  ) : upcomingEvents.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {upcomingEvents.map(event => <EventCard key={event.event_id} event={event} />)}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
                        <p className="text-muted-foreground text-center">
                          There are no upcoming events scheduled at the moment.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="cancelled" className="space-y-4">
                  {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <EventSkeleton key={i} />)}
                    </div>
                  ) : cancelledEvents.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {cancelledEvents.map(event => <EventCard key={event.event_id} event={event} />)}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <XCircle className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No cancelled events</h3>
                        <p className="text-muted-foreground text-center">
                          There are no cancelled events.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="ended" className="space-y-4">
                  {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <EventSkeleton key={i} />)}
                    </div>
                  ) : endedEvents.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {endedEvents.map(event => <EventCard key={event.event_id} event={event} />)}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <CheckCircle className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No ended events</h3>
                        <p className="text-muted-foreground text-center">
                          There are no ended events.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SidebarInset>

      {/* Meeting Blocked Dialog */}
      <Dialog open={showMeetingBlockedDialog} onOpenChange={setShowMeetingBlockedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cannot Join Event
            </DialogTitle>
            <DialogDescription>
              You cannot join the event while you are currently in a meeting. Please end your meeting first before joining the event.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button 
              onClick={() => {
                setShowMeetingBlockedDialog(false)
                setPendingEventId(null)
              }}
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
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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

    </SidebarProvider>
  )
}
