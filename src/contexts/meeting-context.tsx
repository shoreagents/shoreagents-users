"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getMeetingStatus, createMeeting, type Meeting } from '@/lib/meeting-utils'
import { useMeetings, useMeetingStatus, useRefreshMeetings } from '@/hooks/use-meetings'
import { useSocket } from '@/contexts/socket-context'


interface MeetingContextType {
  // Meeting state
  isInMeeting: boolean
  currentMeeting: Meeting | null
  meetings: Meeting[]
  isLoading: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  
  // Meeting actions
  startNewMeeting: (title: string, description?: string, scheduledTime?: string) => Promise<{ success: boolean; message?: string }>
  endCurrentMeeting: () => Promise<{ success: boolean; message?: string }>
  refreshMeetings: () => Promise<void>
  
  // Real-time updates
  lastUpdated: Date | null
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined)

interface MeetingProviderProps {
  children: ReactNode
}

export function MeetingProvider({ children }: MeetingProviderProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Use shared socket context
  const { socket, isConnected } = useSocket()
  
  // Use React-Query hooks for data fetching
  const { 
    data: meetingsData, 
    isLoading: meetingsLoading, 
    error: meetingsError,
    refetch: refetchMeetings
  } = useMeetings(7)
  
  const { 
    data: statusData, 
    isLoading: statusLoading,
    error: statusError 
  } = useMeetingStatus(7)
  
  // Use the proper refresh hook that invalidates cache
  const refreshMeetings = useRefreshMeetings()
  
  // Extract data from react-query and ensure compatibility
  const meetings = (meetingsData?.meetings || []).map(meeting => ({
    ...meeting,
    is_in_meeting: meeting.status === 'in-progress'
  }))
  const isInMeeting = statusData?.isInMeeting || false
  const currentMeeting = statusData?.activeMeeting || null
  // Only show loading if we're actually loading and don't have any data yet
  // This prevents unnecessary loading states when there are no meetings
  const isLoading = (meetingsLoading || statusLoading) && !meetingsData && !statusData
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Listen for socket events using shared socket context
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) {
      console.log('No user email available for Meeting Socket.IO connection')
      return
    }

    // Store socket globally for meeting utils to access
    if (typeof window !== 'undefined') {
      (window as any).meetingSocket = socket
    }

    // Listen for meeting status updates from Socket.IO server
    const handleMeetingStatusUpdate = (data: { isInMeeting: boolean; activeMeeting?: Meeting }) => {
      console.log('Meeting status update received:', data)
      setLastUpdated(new Date())
      refreshMeetings() // Use proper cache invalidation
    }

    // Listen for meeting data updates
    const handleMeetingsUpdated = () => {
      console.log('Meetings updated event received')
      setLastUpdated(new Date())
      refreshMeetings() // Use proper cache invalidation
    }

    // Listen for real-time meeting status changes
    const handleMeetingStarted = (data: any) => {
      console.log('Meeting started event received:', data)
      setLastUpdated(new Date())
      refreshMeetings() // Use proper cache invalidation
    }

    const handleMeetingEnded = (data: any) => {
      console.log('Meeting ended event received:', data)
      setLastUpdated(new Date())
      refreshMeetings() // Use proper cache invalidation
    }

    const handleMeetingUpdate = (data: any) => {
      console.log('Meeting update event received:', data)
      setLastUpdated(new Date())
      refreshMeetings() // Use proper cache invalidation
    }

    // Listen for agent status updates
    const handleAgentStatusUpdate = (data: any) => {
      console.log('Agent status update received:', data)
      setLastUpdated(new Date())
      refreshMeetings() // Use proper cache invalidation
    }

    // Add event listeners
    socket.on('meeting-status-update', handleMeetingStatusUpdate)
    socket.on('meetings-updated', handleMeetingsUpdated)
    socket.on('meeting_started', handleMeetingStarted)
    socket.on('meeting_ended', handleMeetingEnded)
    socket.on('meeting-update', handleMeetingUpdate)
    socket.on('agent-status-update', handleAgentStatusUpdate)

    return () => {
      // Remove event listeners
      socket.off('meeting-status-update', handleMeetingStatusUpdate)
      socket.off('meetings-updated', handleMeetingsUpdated)
      socket.off('meeting_started', handleMeetingStarted)
      socket.off('meeting_ended', handleMeetingEnded)
      socket.off('meeting-update', handleMeetingUpdate)
      socket.off('agent-status-update', handleAgentStatusUpdate)
    }
  }, [socket, isConnected, refetchMeetings])

  const startNewMeeting = async (title: string, description?: string, scheduledTime?: string) => {
    try {
      const result = await createMeeting({
        title,
        description: description || '',
        type: 'video',
        scheduledTime
      })
      
      // Refresh meetings after creating a new one
      refetchMeetings()
      
      return { success: true, message: 'Meeting created successfully' }
    } catch (error) {
      console.error('Error starting new meeting:', error)
      return { success: false, message: 'Failed to start meeting' }
    }
  }

  const endCurrentMeeting = async () => {
    try {
      if (!currentMeeting) {
        return { success: false, message: 'No active meeting to end' }
      }

      const { endMeeting } = await import('@/lib/meeting-utils')
      const currentUser = getCurrentUser()
      await endMeeting(currentMeeting.id, currentUser?.id)
      
      // Refresh meetings after ending one
      refetchMeetings()
      
      return { success: true, message: 'Meeting ended successfully' }
    } catch (error) {
      console.error('Error ending current meeting:', error)
      return { success: false, message: 'Failed to end meeting' }
    }
  }

  const refreshMeetingsContext = async () => {
    refreshMeetings() // Use the proper cache invalidation function
    setLastUpdated(new Date())
  }

  const value: MeetingContextType = {
    isInMeeting,
    currentMeeting,
    meetings,
    isLoading,
    connectionStatus: isConnected ? 'connected' : 'disconnected',
    startNewMeeting,
    endCurrentMeeting,
    refreshMeetings: refreshMeetingsContext,
    lastUpdated
  }

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  )
}

export function useMeeting() {
  const context = useContext(MeetingContext)
  if (context === undefined) {
    throw new Error('useMeeting must be used within a MeetingProvider')
  }
  return context
}