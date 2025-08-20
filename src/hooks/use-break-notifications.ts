"use client"

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface BreakStatus {
  currentTime: string
  breaks: {
    [key: string]: {
      id: string
      name: string
      duration: number
      startTime: string
      endTime: string
      timing: {
        isAvailable: boolean
        isExpiringSoon: boolean
        isFinalWarning: boolean
        timeUntilExpiry: number
        nextNotificationTime: string | null
      }
      isAvailable: boolean
      isExpiringSoon: boolean
      isFinalWarning: boolean
      timeUntilExpiry: number
    }
  }
}

export function useBreakNotifications(email: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [breakStatus, setBreakStatus] = useState<BreakStatus | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!email) return

    const socketServerUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3001') as string
    const socket = io(socketServerUrl, {
      reconnection: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to break notification socket')
      setIsConnected(true)
      setError(null)
      
      // Authenticate with the socket server
      socket.emit('authenticate', { email })
      
      // Request break notifications to start
      socket.emit('request-break-notifications')
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from break notification socket')
      setIsConnected(false)
    })

    socket.on('break-notifications-started', (data) => {
      console.log('Break notifications started:', data.message)
      
      // Request initial break status
      socket.emit('check-break-status')
    })

    socket.on('break-status-update', (status: BreakStatus) => {
      console.log('Break status update received:', status)
      setBreakStatus(status)
    })

    socket.on('error', (errorData) => {
      console.error('Socket error:', errorData)
      setError(errorData.message)
    })

    // Listen for break notifications from the existing notification system
    socket.on('db-notification', (notification) => {
      if (notification.category === 'break') {
        console.log('Break notification received:', notification)
        
        // You can handle break-specific notifications here
        // For example, show a toast, play a sound, etc.
        
        // The existing notification system will handle displaying it
      }
    })

    return () => {
      try {
        socket.off('break-notifications-started')
        socket.off('break-status-update')
        socket.off('error')
        socket.off('db-notification')
        socket.disconnect()
      } catch {}
      socketRef.current = null
    }
  }, [email])

  // Function to manually check break status
  const checkBreakStatus = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('check-break-status')
    }
  }

  // Function to get formatted time until expiry
  const getTimeUntilExpiry = (minutes: number): string => {
    if (minutes <= 0) return 'Expired'
    
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  // Function to get break status summary
  const getBreakSummary = () => {
    if (!breakStatus?.breaks) return null
    
    const summary = {
      available: [] as string[],
      expiringSoon: [] as string[],
      finalWarning: [] as string[],
      expired: [] as string[]
    }
    
    Object.entries(breakStatus.breaks).forEach(([breakType, breakInfo]) => {
      if (breakInfo.isAvailable) {
        if (breakInfo.isFinalWarning) {
          summary.finalWarning.push(breakType)
        } else if (breakInfo.isExpiringSoon) {
          summary.expiringSoon.push(breakType)
        } else {
          summary.available.push(breakType)
        }
      } else {
        summary.expired.push(breakType)
      }
    })
    
    return summary
  }

  return {
    breakStatus,
    isConnected,
    error,
    checkBreakStatus,
    getTimeUntilExpiry,
    getBreakSummary
  }
}
