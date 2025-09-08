"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useEvents, useMarkAsGoing, useMarkAsBack, type Event } from '@/hooks/use-events'
import { getCurrentUserInfo } from '@/lib/user-profiles'

interface EventsContextType {
  // Event state
  currentEvent: Event | null
  isInEvent: boolean
  hasLeftEvent: boolean
  
  // Event actions
  joinEvent: (eventId: number) => Promise<void>
  leaveEvent: (eventId: number) => Promise<void>
  
  // Event data
  events: Event[]
  isLoading: boolean
  
  // Event status helpers
  getEventStatus: (eventId: number) => 'not_joined' | 'joined' | 'left'
  isEventJoinable: (event: Event) => boolean
  isEventLeavable: (event: Event) => boolean
}

const EventsContext = createContext<EventsContextType | undefined>(undefined)

interface EventsProviderProps {
  children: ReactNode
}

export function EventsProvider({ children }: EventsProviderProps) {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null)
  const [isInEvent, setIsInEvent] = useState(false)
  const [hasLeftEvent, setHasLeftEvent] = useState(false)

  const currentUser = getCurrentUserInfo()
  
  // React Query hooks
  const { events, isLoading, triggerRealtimeUpdate } = useEvents()
  const markAsGoingMutation = useMarkAsGoing()
  const markAsBackMutation = useMarkAsBack()

  // Update current event state when events data changes
  useEffect(() => {
    if (!events || events.length === 0) {
      setCurrentEvent(null)
      setIsInEvent(false)
      setHasLeftEvent(false)
      return
    }

    // Find events that are started today (status = 'today')
    const todayEvents = events.filter(event => 
      event.status === 'today'
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
  }, [events])

  // Join event function
  const joinEvent = async (eventId: number) => {
    try {
      await markAsGoingMutation.mutateAsync(eventId)
      // State will be updated via the useEffect when events data refreshes
    } catch (error) {
      console.error('Failed to join event:', error)
      throw error
    }
  }

  // Leave event function
  const leaveEvent = async (eventId: number) => {
    try {
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

  // Check if event is joinable
  const isEventJoinable = (event: Event): boolean => {
    if (!event) return false
    if (event.status === 'cancelled' || event.status === 'ended') return false
    if (event.is_going) return false // Already joined
    if (event.is_back) return false // Already left
    
    // Check if event is in the future
    const currentTime = new Date()
    const philippinesTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    const today = philippinesTime.toISOString().split('T')[0]
    
    const eventDate = typeof event.event_date === 'string' && event.event_date.includes('T')
      ? event.event_date.split('T')[0]
      : event.event_date.toString()
    
    return eventDate <= today
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
    const today = philippinesTime.toISOString().split('T')[0]
    
    const eventDate = typeof event.event_date === 'string' && event.event_date.includes('T')
      ? event.event_date.split('T')[0]
      : event.event_date.toString()
    
    return eventDate <= today
  }

  const value: EventsContextType = {
    currentEvent,
    isInEvent,
    hasLeftEvent,
    joinEvent,
    leaveEvent,
    events,
    isLoading,
    getEventStatus,
    isEventJoinable,
    isEventLeavable
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
