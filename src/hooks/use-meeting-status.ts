"use client"

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { getCurrentUser } from '@/lib/ticket-utils'
import { getMeetingStatus } from '@/lib/meeting-utils'

export function useMeetingStatus() {
  const [isInMeeting, setIsInMeeting] = useState(false)
  const [currentMeeting, setCurrentMeeting] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  const socketRef = useRef<Socket | null>(null)

  const checkMeetingStatus = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser?.id) {
        setIsInMeeting(false)
        setCurrentMeeting(null)
        setIsLoading(false)
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

    // Disconnect existing socket if email changed
    if (socketRef.current) {
      console.log('Disconnecting existing socket for new user:', email)
      try {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
      } catch (error) {
        console.warn('Error disconnecting existing socket:', error)
      }
      socketRef.current = null
    }

    // Add a small delay to avoid rapid reconnections during React development mode
    const connectionTimeout = setTimeout(() => {
      if (!isActive.current) return

      setConnectionStatus('connecting')
      
      // Connect to Socket.IO server with safer connection options
      const socket = io('http://localhost:3001', {
        reconnection: true,
        reconnectionAttempts: 3, // Further reduced attempts
        reconnectionDelay: 2000, // Longer delay
        reconnectionDelayMax: 10000,
        timeout: 10000, // Longer timeout
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
        console.error('Socket.IO connection error:', error)
        setConnectionStatus('error')
      })

      socket.on('reconnect', (attemptNumber) => {
        if (!isActive.current) return
        setConnectionStatus('connected')
        socket.emit('authenticate', email)
      })

      // Listen for meeting status updates from Socket.IO server
      socket.on('meeting-status-update', (data: { isInMeeting: boolean }) => {
        if (!isActive.current) return
        setIsInMeeting(data.isInMeeting)
        
        // Update current meeting data if status changed
        if (data.isInMeeting) {
          checkMeetingStatus()
        }
      })
    }, 100) // Small delay to avoid rapid reconnections

    return () => {
      // Mark effect as inactive
      isActive.current = false
      
      // Clear the connection timeout
      clearTimeout(connectionTimeout)
      
      if (socketRef.current) {
        try {
          // Remove all listeners before disconnecting to prevent errors
          socketRef.current.removeAllListeners()
          socketRef.current.disconnect()
        } catch (error) {
          console.warn('Error during socket cleanup:', error)
        } finally {
          socketRef.current = null
        }
      }
      
      // Clean up global socket reference
      if (typeof window !== 'undefined') {
        (window as any).meetingSocket = null
      }
    }
  }, [])

  return {
    isInMeeting,
    currentMeeting,
    isLoading,
    checkMeetingStatus,
    connectionStatus
  }
} 