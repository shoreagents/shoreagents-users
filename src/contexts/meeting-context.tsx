"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getMeetingStatus, createMeeting, endMeeting, type Meeting } from '@/lib/meeting-utils'
import { useMeetings, useMeetingStatus, useRefreshMeetings, meetingKeys } from '@/hooks/use-meetings'
import { useSocket } from '@/contexts/socket-context'
import { useQueryClient } from '@tanstack/react-query'
import { parseShiftTime } from '@/lib/shift-utils'
import { useProfileContext } from './profile-context'


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
  
  // Shift end detection
  isShiftEnded: boolean
  endMeetingOnShiftEnd: () => Promise<void>
  forceEndMeeting: () => Promise<void>
  
  // Real-time updates
  lastUpdated: Date | null
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined)

interface MeetingProviderProps {
  children: ReactNode
}

export function MeetingProvider({ children }: MeetingProviderProps) {
  const { profile } = useProfileContext()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isShiftEnded, setIsShiftEnded] = useState(false)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const lastEndAttemptRef = useRef<number>(0)
  
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

  const startNewMeeting = useCallback(async (title: string, description?: string, scheduledTime?: string) => {
    try {
      // Check if shift has ended before allowing meeting creation
      if (isShiftEnded) {
        return { success: false, message: 'Cannot create meeting - shift has ended' }
      }

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
  }, [isShiftEnded, refreshMeetings])

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

  // End meeting when shift ends
  const endMeetingOnShiftEnd = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    // Only end if currently in meeting and not already ending
    if (!isInMeeting || !currentMeeting || isEndingMeeting) return

    // Debounce: prevent calls within 5 seconds of each other
    const now = Date.now()
    if (now - lastEndAttemptRef.current < 5000) {
      return
    }
    lastEndAttemptRef.current = now

    // Set flag to prevent duplicate attempts
    setIsEndingMeeting(true)

    try {
      // End the current meeting
      await endMeeting(currentMeeting.id, user.id)
      
      // Refresh the meeting status
      setTimeout(() => {
        refreshMeetings()
      }, 1000)
    } catch (err) {
      // Only log error if it's not about meeting not existing
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (!errorMessage.includes('Meeting may not exist') && !errorMessage.includes('not in progress')) {
        console.error('Error ending meeting on shift end:', err)
      }
      
      // If meeting doesn't exist or not in progress, it's already ended
      // Refresh status to update UI
      if (errorMessage.includes('Meeting may not exist') || errorMessage.includes('not in progress')) {
        setTimeout(() => {
          refreshMeetings()
        }, 500)
      }
    } finally {
      // Reset flag after attempt
      setIsEndingMeeting(false)
    }
  }, [isInMeeting, currentMeeting, isEndingMeeting, refreshMeetings])

  // Check if shift has ended and end meeting if needed
  const checkShiftEndAndEndMeeting = useCallback(async () => {
    if (!isInMeeting || !currentMeeting || isEndingMeeting || !profile?.shift_time) return

    try {
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      const shiftParsed = parseShiftTime(profile.shift_time, nowPH)
      
      if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
        await endMeetingOnShiftEnd()
      }
    } catch (error) {
      console.error('Error checking shift end for meeting end:', error)
    }
  }, [isInMeeting, currentMeeting, isEndingMeeting, profile?.shift_time, endMeetingOnShiftEnd])

  // Force end meeting (for manual use)
  const forceEndMeeting = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    if (!isInMeeting || !currentMeeting || isEndingMeeting) return

    setIsEndingMeeting(true)

    try {
      await endMeeting(currentMeeting.id, user.id)
      refreshMeetings()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (!errorMessage.includes('Meeting may not exist') && !errorMessage.includes('not in progress')) {
        console.error('Error force ending meeting:', err)
      }
    } finally {
      setIsEndingMeeting(false)
    }
  }, [isInMeeting, currentMeeting, isEndingMeeting, refreshMeetings])

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

  // Check for shift end immediately when meeting status is loaded
  useEffect(() => {
    if (!isInMeeting || !currentMeeting || isEndingMeeting) return

    const checkShiftEndOnLoad = async () => {
      try {
        await checkShiftEndAndEndMeeting()
      } catch (error) {
        console.error('Error in immediate shift end check for meeting:', error)
      }
    }

    // Run check after a short delay to ensure meeting status is fully loaded
    const timeoutId = setTimeout(checkShiftEndOnLoad, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [isInMeeting, currentMeeting, isEndingMeeting, checkShiftEndAndEndMeeting])

  // Periodic check for shift end to automatically end meeting
  useEffect(() => {
    if (!isInMeeting || !currentMeeting || isEndingMeeting) return

    // Check immediately when component mounts and user is in meeting
    const checkImmediately = async () => {
      try {
        await checkShiftEndAndEndMeeting()
      } catch (error) {
        console.error('Error in immediate shift end check for meeting:', error)
      }
    }

    // Run check immediately
    checkImmediately()

    // Then check every 30 seconds for more responsive detection
    const interval = setInterval(async () => {
      try {
        await checkShiftEndAndEndMeeting()
      } catch (error) {
        console.error('Error in periodic shift end check for meeting:', error)
      }
    }, 30000) // Check every 30 seconds for faster response

    return () => clearInterval(interval)
  }, [isInMeeting, currentMeeting, isEndingMeeting, checkShiftEndAndEndMeeting])

  // Also listen for shift end events from other parts of the app
  useEffect(() => {
    const handleShiftEnd = () => {
      if (isInMeeting && currentMeeting && !isEndingMeeting) {
        endMeetingOnShiftEnd()
      }
    }

    // Listen for custom shift end events
    window.addEventListener('shift-ended', handleShiftEnd)
    
    return () => {
      window.removeEventListener('shift-ended', handleShiftEnd)
    }
  }, [isInMeeting, currentMeeting, isEndingMeeting, endMeetingOnShiftEnd])

  // Expose functions globally for debugging/manual use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).forceEndMeeting = forceEndMeeting
    }
  }, [forceEndMeeting])

  const value: MeetingContextType = {
    isInMeeting,
    currentMeeting,
    meetings,
    isLoading,
    connectionStatus: isConnected ? 'connected' : 'disconnected',
    startNewMeeting,
    endCurrentMeeting,
    refreshMeetings: refreshMeetingsContext,
    isShiftEnded,
    endMeetingOnShiftEnd,
    forceEndMeeting,
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