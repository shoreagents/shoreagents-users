"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getMeetingStatus, createMeeting, type Meeting } from '@/lib/meeting-utils'
import { useMeetings, useMeetingStatus } from '@/hooks/use-meetings'
import { initializeMeetingScheduler, stopMeetingScheduler } from '@/lib/meeting-scheduler'

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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
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
  
  // Extract data from react-query and ensure compatibility
  const meetings = (meetingsData?.meetings || []).map(meeting => ({
    ...meeting,
    is_in_meeting: meeting.status === 'in-progress'
  }))
  const isInMeeting = statusData?.isInMeeting || false
  const currentMeeting = statusData?.activeMeeting || null
  const isLoading = meetingsLoading || statusLoading
  
  const socketRef = useRef<Socket | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Socket.IO connection for real-time updates
  useEffect(() => {
    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) {
      console.log('No user email available for Meeting Socket.IO connection')
      return
    }

    // Initialize meeting scheduler for automatic meeting starts
    initializeMeetingScheduler()

    // Use a ref to track if this effect is still active
    const isActive = { current: true }

    // Add a small delay to avoid rapid reconnections during React development mode
    const connectionTimeout = setTimeout(() => {
      if (!isActive.current) return

      setConnectionStatus('connecting')
      
      // Connect to Socket.IO server
      
      const socketServerUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3001') as string
        const socket = io(socketServerUrl, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
        forceNew: false,
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true
      })
      
      if (!isActive.current) {
        socket.disconnect()
        return
      }
      
      socketRef.current = socket
      
      // Store socket globally for meeting utils to access
      if (typeof window !== 'undefined') {
        (window as any).meetingSocket = socket
      }

      // Handle connection events
      socket.on('connect', () => {
        if (!isActive.current) return
        setConnectionStatus('connected')
        socket.emit('authenticate', email)
      })

      socket.on('disconnect', (reason) => {
        if (!isActive.current) return
        setConnectionStatus('disconnected')
      })

      socket.on('connect_error', (error) => {
        if (!isActive.current) return
        console.error('Meeting Socket.IO connection error:', error)
        setConnectionStatus('error')
      })

      socket.on('reconnect', (attemptNumber) => {
        if (!isActive.current) return
        setConnectionStatus('connected')
        socket.emit('authenticate', email)
      })

      // Listen for meeting status updates from Socket.IO server
      socket.on('meeting-status-update', (data: { isInMeeting: boolean; activeMeeting?: Meeting }) => {
        if (!isActive.current) return
        setLastUpdated(new Date())
        
        // Refresh data when status changes
        refetchMeetings()
      })

      // Listen for meeting data updates
      socket.on('meetings-updated', () => {
        if (!isActive.current) return
        refetchMeetings()
      })
    }, 100) // Small delay to avoid rapid reconnections

    // Initial data fetch is handled by React-Query hooks
    // No need for manual fetching

    return () => {
      // Mark effect as inactive
      isActive.current = false
      
      // Clear the connection timeout
      clearTimeout(connectionTimeout)
      
      // Clear any pending refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners()
          socketRef.current.disconnect()
        } catch (error) {
          console.warn('Error during meeting socket cleanup:', error)
        } finally {
          socketRef.current = null
        }
      }
      
      // Clean up global socket reference
      if (typeof window !== 'undefined') {
        (window as any).meetingSocket = null
      }

      // Stop meeting scheduler
      stopMeetingScheduler()
    }
  }, []) // Empty dependency array to run only once

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
      await endMeeting(currentMeeting.id)
      
      // Refresh meetings after ending one
      refetchMeetings()
      
      return { success: true, message: 'Meeting ended successfully' }
    } catch (error) {
      console.error('Error ending current meeting:', error)
      return { success: false, message: 'Failed to end meeting' }
    }
  }

  const refreshMeetings = async () => {
    await refetchMeetings()
    setLastUpdated(new Date())
  }

  const value: MeetingContextType = {
    isInMeeting,
    currentMeeting,
    meetings,
    isLoading,
    connectionStatus,
    startNewMeeting,
    endCurrentMeeting,
    refreshMeetings,
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