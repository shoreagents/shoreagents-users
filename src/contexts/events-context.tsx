"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useEvents, useMarkAsGoing, useMarkAsBack, type Event } from '@/hooks/use-events'
import { getCurrentUserInfo } from '@/lib/user-profiles'
import { useMeeting } from './meeting-context'
import { useSocket } from './socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'
import { parseShiftTime } from '@/lib/shift-utils'
import { useProfileContext } from './profile-context'

interface EventsContextType {
  // Event state
  currentEvent: Event | null
  isInEvent: boolean
  hasLeftEvent: boolean
  
  // Event actions
  joinEvent: (eventId: number) => Promise<void>
  joinEventAfterMeetingEnd: (eventId: number) => Promise<void>
  leaveEvent: (eventId: number) => Promise<void>
  
  // Event data
  events: Event[]
  isLoading: boolean
  
  // Global loading states
  isJoiningEvent: boolean
  isLeavingEvent: boolean
  
  // Event status helpers
  getEventStatus: (eventId: number) => 'not_joined' | 'joined' | 'left'
  isEventJoinable: (event: Event) => boolean
  isEventLeavable: (event: Event) => boolean
  isEventJoinBlockedByMeeting: (event: Event) => boolean
  
  // Meeting blocking
  isInMeeting: boolean
  eventBlockedReason: string | null
  
  // Meeting creation blocking
  canCreateMeeting: boolean
  meetingBlockedReason: string | null
  
  // Shift end detection
  isShiftEnded: boolean
  isEventJoinBlockedByShiftEnd: (event: Event) => boolean
}

const EventsContext = createContext<EventsContextType | undefined>(undefined)

interface EventsProviderProps {
  children: ReactNode
}

export function EventsProvider({ children }: EventsProviderProps) {
  const { profile } = useProfileContext()
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null)
  const [isInEvent, setIsInEvent] = useState(false)
  const [hasLeftEvent, setHasLeftEvent] = useState(false)
  const [isJoiningEvent, setIsJoiningEvent] = useState(false)
  const [isLeavingEvent, setIsLeavingEvent] = useState(false)
  const [isShiftEnded, setIsShiftEnded] = useState(false)

  const currentUser = getCurrentUserInfo()
  
  // Get meeting status to prevent joining events while in a meeting
  const { isInMeeting } = useMeeting()
  
  // Socket context for real-time updates
  const { socket, isConnected } = useSocket()
  
  // React Query hooks
  const { events, isLoading, triggerRealtimeUpdate } = useEvents()
  const markAsGoingMutation = useMarkAsGoing()
  const markAsBackMutation = useMarkAsBack()

  // Helper function to check if an event has actually started
  const hasEventStarted = useCallback((event: Event): boolean => {
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

  // Update current event state when events data changes
  useEffect(() => {
    if (!events || events.length === 0) {
      setCurrentEvent(null)
      setIsInEvent(false)
      setHasLeftEvent(false)
      return
    }

    // Find events that are started today (status = 'today') AND have actually started
    const todayEvents = events.filter(event => 
      event.status === 'today' && hasEventStarted(event)
    )

    if (todayEvents.length === 0) {
      setCurrentEvent(null)
      setIsInEvent(false)
      setHasLeftEvent(false)
      return
    }

    // Find if user is currently in any of today's events
    const activeEvent = todayEvents.find(event => 
      event.is_going && !event.is_back
    )

    if (activeEvent) {
      setCurrentEvent(activeEvent)
      setIsInEvent(true)
      setHasLeftEvent(false)
    } else {
      // Check if user has left any recent event from today
      const leftEvent = todayEvents.find(event => 
        event.is_back && event.back_at &&
        new Date(event.back_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
      )
      
      if (leftEvent) {
        // Don't show the indicator if user has left the event
        setCurrentEvent(null)
        setIsInEvent(false)
        setHasLeftEvent(false)
      } else {
        // Show the first event of today even if user hasn't joined yet
        setCurrentEvent(todayEvents[0])
        setIsInEvent(false)
        setHasLeftEvent(false)
      }
    }
  }, [events, hasEventStarted])

  // Set up a timer to check periodically if an event has started (for real-time updates)
  useEffect(() => {
    if (!events || events.length === 0) return

    // Check immediately
    const checkForStartedEvents = () => {
      const todayEvents = events.filter(event => 
        event.status === 'today' && hasEventStarted(event)
      )

      if (todayEvents.length > 0) {
        // Find if user is currently in any of today's events
        const activeEvent = todayEvents.find(event => 
          event.is_going && !event.is_back
        )

        if (activeEvent) {
          setCurrentEvent(activeEvent)
          setIsInEvent(true)
          setHasLeftEvent(false)
        } else {
          // Check if user has left any recent event from today
          const leftEvent = todayEvents.find(event => 
            event.is_back && event.back_at &&
            new Date(event.back_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
          )
          
          if (leftEvent) {
            // Don't show the indicator if user has left the event
            setCurrentEvent(null)
            setIsInEvent(false)
            setHasLeftEvent(false)
          } else {
            // Show the first event of today even if user hasn't joined yet
            setCurrentEvent(todayEvents[0])
            setIsInEvent(false)
            setHasLeftEvent(false)
          }
        }
      } else {
        setCurrentEvent(null)
        setIsInEvent(false)
        setHasLeftEvent(false)
      }
    }

    // Check immediately
    checkForStartedEvents()

    // Set up interval to check every 1 second for immediate updates
    const interval = setInterval(checkForStartedEvents, 1000)

    return () => clearInterval(interval)
  }, [events, hasEventStarted])

  // Join event function
  const joinEvent = async (eventId: number) => {
    // Check if join is blocked by shift end before making API call
    if (isShiftEnded) {
      const error = new Error('Cannot join event - shift has ended')
      throw error
    }

    // Check if join is blocked by meeting before making API call
    if (isInMeeting) {
      const error = new Error('Cannot join event while in a meeting. Please end your meeting first.')
      throw error
    }

    try {
      setIsJoiningEvent(true)
      await markAsGoingMutation.mutateAsync(eventId)
      // State will be updated via the useEffect when events data refreshes
    } catch (error) {
      // Don't log meeting conflict errors as they're handled in the UI
      if (error instanceof Error && !error.message.includes('Cannot join event while in a meeting') && !error.message.includes('Cannot join event - shift has ended')) {
        console.error('Failed to join event:', error)
      }
      throw error
    } finally {
      setIsJoiningEvent(false)
    }
  }

  // Join event function that bypasses meeting check (for use after ending a meeting)
  const joinEventAfterMeetingEnd = async (eventId: number) => {
    // Still check for shift end even when bypassing meeting check
    if (isShiftEnded) {
      const error = new Error('Cannot join event - shift has ended')
      throw error
    }

    try {
      setIsJoiningEvent(true)
      await markAsGoingMutation.mutateAsync(eventId)
      // State will be updated via the useEffect when events data refreshes
    } catch (error) {
      console.error('Failed to join event after meeting end:', error)
      throw error
    } finally {
      setIsJoiningEvent(false)
    }
  }

  // Leave event function
  const leaveEvent = async (eventId: number) => {
    try {
      setIsLeavingEvent(true)
      await markAsBackMutation.mutateAsync(eventId)
      // State will be updated via the useEffect when events data refreshes
      
      // Trigger a custom event to refresh meeting data
      // This helps ensure meetings start immediately after leaving an event
      window.dispatchEvent(new CustomEvent('event-left', { 
        detail: { eventId, timestamp: Date.now() } 
      }))
    } catch (error) {
      console.error('Failed to leave event:', error)
      throw error
    } finally {
      setIsLeavingEvent(false)
    }
  }

  // Get event status for a specific event
  const getEventStatus = (eventId: number): 'not_joined' | 'joined' | 'left' => {
    const event = events.find(e => e.event_id === eventId)
    if (!event) return 'not_joined'
    
    if (event.is_going && !event.is_back) return 'joined'
    if (event.is_back) return 'left'
    return 'not_joined'
  }

  // Check if event is joinable (always show button, but may be disabled)
  const isEventJoinable = (event: Event): boolean => {
    if (!event) return false
    if (event.status === 'cancelled' || event.status === 'ended') return false
    if (event.is_going) return false // Already joined
    if (event.is_back) return false // Already left
    
    // Check if event is in the future
    const currentTime = new Date()
    const philippinesTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    
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
    
    return eventDate <= today
  }

  // Check if event join is blocked by meeting (for showing dialog)
  const isEventJoinBlockedByMeeting = (event: Event): boolean => {
    if (!event) return false
    return isInMeeting
  }

  // Check if event is leavable
  const isEventLeavable = (event: Event): boolean => {
    if (!event) return false
    if (event.status === 'cancelled' || event.status === 'ended') return false
    if (!event.is_going) return false // Not joined
    if (event.is_back) return false // Already left
    
    // Check if event is in the future
    const currentTime = new Date()
    const philippinesTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    
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
    
    return eventDate <= today
  }

  // Emit event status updates when status changes
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit current event status
    socket.emit('updateEventStatus', isInEvent, currentEvent)
  }, [socket, isConnected, isInEvent, currentEvent])

  // Check if shift has ended
  const checkShiftEndStatus = useCallback(async () => {
    try {
      if (!profile?.shift_time) return false

      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      const shiftParsed = parseShiftTime(profile.shift_time, nowPH)
      
      const shiftHasEnded = !!(shiftParsed?.endTime && nowPH > shiftParsed.endTime)
      setIsShiftEnded(shiftHasEnded)
      return shiftHasEnded
    } catch (error) {
      console.error('Error checking shift end status:', error)
    }
    return false
  }, [profile?.shift_time])

  // Check if event join is blocked by shift end
  const isEventJoinBlockedByShiftEnd = (event: Event): boolean => {
    if (!event) return false
    return isShiftEnded
  }

  // Leave event when shift ends
  const leaveEventOnShiftEnd = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    // Only leave if currently in event
    if (!isInEvent || !currentEvent) return

    try {
      // Leave the current event
      await markAsBackMutation.mutateAsync(currentEvent.event_id)
      
      // Trigger a custom event to refresh meeting data
      window.dispatchEvent(new CustomEvent('event-left', { 
        detail: { eventId: currentEvent.event_id, timestamp: Date.now() } 
      }))
    } catch (err) {
      console.error('Error leaving event on shift end:', err)
    }
  }, [isInEvent, currentEvent, markAsBackMutation])

  // Check if shift has ended and leave event if needed
  const checkShiftEndAndLeaveEvent = useCallback(async () => {
    if (!isInEvent || !currentEvent || !profile?.shift_time) return

    try {
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      const shiftParsed = parseShiftTime(profile.shift_time, nowPH)
      
      if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
        await leaveEventOnShiftEnd()
      }
    } catch (error) {
      console.error('Error checking shift end for event leave:', error)
    }
  }, [isInEvent, currentEvent, profile?.shift_time, leaveEventOnShiftEnd])

  // Initialize shift end check on mount
  useEffect(() => {
    const user = getCurrentUser()
    if (user?.email) {
      checkShiftEndStatus()
    }
  }, [checkShiftEndStatus])

  // Check shift end status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkShiftEndStatus()
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [checkShiftEndStatus])

  // Check for shift end immediately when event status is loaded
  useEffect(() => {
    if (!isInEvent || !currentEvent) return

    const checkShiftEndOnLoad = async () => {
      try {
        await checkShiftEndAndLeaveEvent()
      } catch (error) {
        console.error('Error in immediate shift end check for event:', error)
      }
    }

    // Run check after a short delay to ensure event status is fully loaded
    const timeoutId = setTimeout(checkShiftEndOnLoad, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [isInEvent, currentEvent, checkShiftEndAndLeaveEvent])

  // Periodic check for shift end to automatically leave event
  useEffect(() => {
    if (!isInEvent || !currentEvent) return

    // Check immediately when component mounts and user is in event
    const checkImmediately = async () => {
      try {
        await checkShiftEndAndLeaveEvent()
      } catch (error) {
        console.error('Error in immediate shift end check for event:', error)
      }
    }

    // Run check immediately
    checkImmediately()

    // Then check every 30 seconds for more responsive detection
    const interval = setInterval(async () => {
      try {
        await checkShiftEndAndLeaveEvent()
      } catch (error) {
        console.error('Error in periodic shift end check for event:', error)
      }
    }, 30000) // Check every 30 seconds for faster response

    return () => clearInterval(interval)
  }, [isInEvent, currentEvent, checkShiftEndAndLeaveEvent])

  // Also listen for shift end events from other parts of the app
  useEffect(() => {
    const handleShiftEnd = () => {
      if (isInEvent && currentEvent) {
        leaveEventOnShiftEnd()
      }
    }

    // Listen for custom shift end events
    window.addEventListener('shift-ended', handleShiftEnd)
    
    return () => {
      window.removeEventListener('shift-ended', handleShiftEnd)
    }
  }, [isInEvent, currentEvent, leaveEventOnShiftEnd])

  // Determine if event joining is blocked by meeting
  const eventBlockedReason = isInMeeting ? 'Cannot join event while in a meeting. Please end the meeting first.' : null
  
  // Determine if meeting creation is blocked by event
  const canCreateMeeting = !isInEvent
  const meetingBlockedReason = isInEvent ? `Cannot create meeting while in event: ${currentEvent?.title || 'Unknown Event'}. Please leave the event first.` : null

  const value: EventsContextType = {
    currentEvent,
    isInEvent,
    hasLeftEvent,
    joinEvent,
    joinEventAfterMeetingEnd,
    leaveEvent,
    events,
    isLoading,
    isJoiningEvent,
    isLeavingEvent,
    getEventStatus,
    isEventJoinable,
    isEventLeavable,
    isEventJoinBlockedByMeeting,
    isInMeeting,
    eventBlockedReason,
    canCreateMeeting,
    meetingBlockedReason,
    isShiftEnded,
    isEventJoinBlockedByShiftEnd
  }

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  )
}

export function useEventsContext() {
  const context = useContext(EventsContext)
  if (context === undefined) {
    throw new Error('useEventsContext must be used within an EventsProvider')
  }
  return context
}
