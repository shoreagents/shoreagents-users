"use client"

import { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/contexts/socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getMeetingStatus } from '@/lib/meeting-utils'

export function useMeetingStatusContext() {
  const { socket, isConnected } = useSocket()
  const [isInMeeting, setIsInMeeting] = useState(false)
  const [currentMeeting, setCurrentMeeting] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  const checkMeetingStatus = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser?.id) {
        setIsInMeeting(false)
        setCurrentMeeting(null)
        setIsLoading(false)
        return
      }

      // Only check meeting status if we're not already sure the user is not in a meeting
      // This prevents unnecessary API calls when we know the user is not in a meeting
      if (!isInMeeting && !isLoading) {
        return
      }

      const meetingStatus = await getMeetingStatus()
      setIsInMeeting(meetingStatus.isInMeeting || false)
      setCurrentMeeting(meetingStatus.activeMeeting || null)
    } catch (error) {
      console.error('Error checking meeting status:', error)
      setIsInMeeting(false)
      setCurrentMeeting(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial check
    checkMeetingStatus()
    
    // Get current user email for Socket.IO connection
    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) {
      console.log('No user email available for Socket.IO connection')
      return
    }

    // Use a ref to track if this effect is still active
    const isActive = { current: true }

    // Update connection status based on socket state
    if (socket && isConnected) {
      setConnectionStatus('connected')
      
      // Store socket globally for meeting utils to access (use the shared socket from context)
      if (typeof window !== 'undefined') {
        (window as any).meetingSocket = socket
      }
    } else {
      setConnectionStatus('disconnected')
    }

    // Set up socket event listeners when socket is available
    if (!socket || !email) return

    // Listen for meeting status updates
    const handleMeetingUpdate = (data: any) => {
      if (data.email === email) {
        console.log('Meeting update received:', data)
        
        if (data.type === 'meeting_started') {
          setIsInMeeting(true)
          setCurrentMeeting(data.meeting)
        } else if (data.type === 'meeting_ended') {
          setIsInMeeting(false)
          setCurrentMeeting(null)
        } else if (data.type === 'meeting_updated' || data.type === 'meeting-update') {
          setCurrentMeeting(data.meeting)
          // Update isInMeeting status based on the meeting data
          if (data.meeting && typeof data.meeting.is_in_meeting !== 'undefined') {
            setIsInMeeting(data.meeting.is_in_meeting)
          }
        }
      }
    }

    // Listen for meeting events
    socket.on('meeting-update', handleMeetingUpdate)
    socket.on('meeting_started', handleMeetingUpdate)
    socket.on('meeting_ended', handleMeetingUpdate)
    
    // Listen for agent status updates
    const handleAgentStatusUpdate = (data: any) => {
      if (data.email === email) {
        console.log('Agent status update received:', data)
        setIsInMeeting(data.isInMeeting || false)
        if (!data.isInMeeting) {
          setCurrentMeeting(null)
        }
      }
    }
    socket.on('agent-status-update', handleAgentStatusUpdate)

    // Clean up event listeners
    return () => {
      if (socket) {
        socket.off('meeting-update', handleMeetingUpdate)
        socket.off('meeting_started', handleMeetingUpdate)
        socket.off('meeting_ended', handleMeetingUpdate)
        socket.off('agent-status-update', handleAgentStatusUpdate)
      }
    }
  }, [socket, isConnected])

  // Check meeting status periodically - ONLY when user is in a meeting
  useEffect(() => {
    // Only poll if user is currently in a meeting
    if (!isInMeeting) {
      return
    }
    
    const interval = setInterval(checkMeetingStatus, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [isInMeeting])

  return {
    isInMeeting,
    currentMeeting,
    isLoading,
    connectionStatus,
    checkMeetingStatus
  }
}
