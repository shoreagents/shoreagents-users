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
  
  // Note: Event checking is now handled in the events context
  // to avoid circular dependency between contexts
  
  
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
      }, 500) // OPTIMIZED: Reduced debounce time to 500ms for better responsiveness
    }

    // Consolidated socket event handler to prevent multiple refreshes
    const handleSocketEvent = (eventType: string, data: any) => {
      // Only refresh once per event, not per handler
      debouncedRefresh()
    }

    // Add event listeners - all use the same handler to prevent duplicate refreshes
    socket.on('meeting-status-update', (data) => handleSocketEvent('meeting-status-update', data))
    socket.on('meetings-updated', (data) => handleSocketEvent('meetings-updated', data))
    socket.on('meeting_started', (data) => handleSocketEvent('meeting_started', data))
    socket.on('meeting_ended', (data) => handleSocketEvent('meeting_ended', data))
    socket.on('meeting-update', (data) => handleSocketEvent('meeting-update', data))
    socket.on('agent-status-update', (data) => handleSocketEvent('agent-status-update', data))

    return () => {
      // Clear any pending refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      
      // Remove event listeners
      socket.off('meeting-status-update')
      socket.off('meetings-updated')
      socket.off('meeting_started')
      socket.off('meeting_ended')
      socket.off('meeting-update')
      socket.off('agent-status-update')
    }
  }, [socket, isConnected, refreshMeetings])

  // Emit meeting status updates when status changes
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit current meeting status
    socket.emit('updateMeetingStatus', isInMeeting)
  }, [socket, isConnected, isInMeeting])

  const startNewMeeting = async (title: string, description?: string, scheduledTime?: string) => {
    try {
      const result = await createMeeting({
        title,
        description: description || '',
        type: 'video',
        scheduledTime
      })
      
      // Only use refreshMeetings() - it already handles cache invalidation
      // Remove duplicate queryClient.invalidateQueries() call
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
      
      // Only use refreshMeetings() - it already handles cache invalidation
      // Remove duplicate queryClient.invalidateQueries() call
      refreshMeetings()
      
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