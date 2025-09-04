"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getMeetingStatus, createMeeting, endMeeting, type Meeting } from '@/lib/meeting-utils'
import { useMeetings, useMeetingStatus, useRefreshMeetings, meetingKeys } from '@/hooks/use-meetings'
import { useSocket } from '@/contexts/socket-context'
import { useQueryClient } from '@tanstack/react-query'


interface MeetingContextType {
  // Meeting state
  isInMeeting: boolean
  currentMeeting: Meeting | null
  meetings: Meeting[]
  isLoading: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  
  // Meeting actions
  startNewMeeting: (title: string, description?: string, scheduledTime?: string) => Promise<{ success: boolean; message?: string }>
  endCurrentMeeting: (meetingId?: number) => Promise<{ success: boolean; message?: string }>
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
  
  // Get query client for cache invalidation
  const queryClient = useQueryClient()
  
  
  // Use the proper refresh hook that invalidates cache
  const refreshMeetings = useRefreshMeetings()
  
  // Get actual meeting status data for the context
  // Use longer stale time to reduce redundant API calls
  const { data: statusData, isLoading: statusLoading } = useMeetingStatus(7)
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings(7, 10, 0)
  
  // Provide actual data instead of hardcoded empty values
  const meetings: Meeting[] = meetingsData?.meetings || []
  const isInMeeting = statusData?.isInMeeting || false
  const currentMeeting = statusData?.activeMeeting || null
  const isLoading = statusLoading || meetingsLoading
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Listen for socket events using shared socket context
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) {
      return
    }

    // Store socket globally for meeting utils to access
    if (typeof window !== 'undefined') {
      (window as any).meetingSocket = socket
    }

    // Debounced refresh function to prevent multiple rapid API calls
    const debouncedRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshMeetings()
        setLastUpdated(new Date())
      }, 200) // Increased debounce time to 200ms
    }

    // Listen for meeting status updates from Socket.IO server
    const handleMeetingStatusUpdate = (data: { isInMeeting: boolean; activeMeeting?: Meeting }) => {
      debouncedRefresh()
    }

    // Listen for meeting data updates
    const handleMeetingsUpdated = () => {
      debouncedRefresh()
    }

    // Listen for real-time meeting status changes
    const handleMeetingStarted = (data: any) => {
      debouncedRefresh()
    }

    const handleMeetingEnded = (data: any) => {
      debouncedRefresh()
    }

    const handleMeetingUpdate = (data: any) => {
      debouncedRefresh()
    }

    // Listen for agent status updates
    const handleAgentStatusUpdate = (data: any) => {
      debouncedRefresh()
    }

    // Add event listeners
    socket.on('meeting-status-update', handleMeetingStatusUpdate)
    socket.on('meetings-updated', handleMeetingsUpdated)
    socket.on('meeting_started', handleMeetingStarted)
    socket.on('meeting_ended', handleMeetingEnded)
    socket.on('meeting-update', handleMeetingUpdate)
    socket.on('agent-status-update', handleAgentStatusUpdate)

    return () => {
      // Clear any pending refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      
      // Remove event listeners
      socket.off('meeting-status-update', handleMeetingStatusUpdate)
      socket.off('meetings-updated', handleMeetingsUpdated)
      socket.off('meeting_started', handleMeetingStarted)
      socket.off('meeting_ended', handleMeetingEnded)
      socket.off('meeting-update', handleMeetingUpdate)
      socket.off('agent-status-update', handleAgentStatusUpdate)
    }
  }, [socket, isConnected, refreshMeetings])

  const startNewMeeting = async (title: string, description?: string, scheduledTime?: string) => {
    try {
      const result = await createMeeting({
        title,
        description: description || '',
        type: 'video',
        scheduledTime
      })
      
      // Invalidate all meeting-related queries to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: meetingKeys.all })
      
      // Also refresh the current context's meetings
      refreshMeetings()
      
      return { success: true, message: 'Meeting created successfully' }
    } catch (error) {
      console.error('Error starting new meeting:', error)
      return { success: false, message: 'Failed to start meeting' }
    }
  }

  const endCurrentMeeting = async (meetingId?: number) => {
    try {
      if (!meetingId) {
        return { success: false, message: 'No meeting ID provided' }
      }

      const currentUser = getCurrentUser()
      await endMeeting(meetingId, currentUser?.id)
      
      // Invalidate meeting-related queries to ensure UI updates
      // Use more targeted invalidation to prevent spam
      queryClient.invalidateQueries({ 
        queryKey: meetingKeys.all,
        exact: false,
        refetchType: 'active' // Only refetch active queries, not background ones
      })
      
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