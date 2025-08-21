"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSocket } from '@/hooks/use-socket'

interface OnlineStatus {
  [email: string]: {
    isOnline: boolean
    lastSeen: Date
    status: 'online' | 'offline' | 'away' | 'connecting'
  }
}

interface OnlineStatusContextType {
  onlineStatus: OnlineStatus
  updateUserStatus: (email: string, status: 'online' | 'offline' | 'away' | 'connecting') => void
  isUserOnline: (email: string) => boolean
  getUserStatus: (email: string) => 'online' | 'offline' | 'away' | 'connecting'
}

const OnlineStatusContext = createContext<OnlineStatusContextType | undefined>(undefined)

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>({})
  const { socket, isConnected } = useSocket()

  // Update user status
  const updateUserStatus = useCallback((email: string, status: 'online' | 'offline' | 'away' | 'connecting') => {
    setOnlineStatus(prev => ({
      ...prev,
      [email]: {
        isOnline: status === 'online',
        lastSeen: new Date(),
        status
      }
    }))
  }, [])

  // Check if user is online
  const isUserOnline = (email: string): boolean => {
    return onlineStatus[email]?.isOnline || false
  }

  // Get user status
  const getUserStatus = (email: string): 'online' | 'offline' | 'away' | 'connecting' => {
    return onlineStatus[email]?.status || 'offline'
  }

  useEffect(() => {
    if (!socket || !isConnected) return

    // Listen for user online status updates
    const handleUserOnline = (data: { email: string; status: 'online' | 'offline' | 'away' | 'connecting' }) => {
      updateUserStatus(data.email, data.status)
    }

    // Listen for bulk online status update
    const handleOnlineStatusUpdate = (data: { users: Array<{ email: string; status: 'online' | 'offline' | 'away' | 'connecting' }> }) => {
      const newStatus: OnlineStatus = {}
      data.users.forEach(user => {
        newStatus[user.email] = {
          isOnline: user.status === 'online',
          lastSeen: new Date(),
          status: user.status
        }
      })
      setOnlineStatus(newStatus)
    }

    // Listen for user away status (inactive for 5+ minutes)
    const handleUserAway = (data: { email: string }) => {
      updateUserStatus(data.email, 'away')
    }

    // Listen for user back online
    const handleUserBackOnline = (data: { email: string }) => {
      updateUserStatus(data.email, 'online')
    }

    // Socket event listeners
    socket.on('user-online-status', handleUserOnline)
    socket.on('online-status-update', handleOnlineStatusUpdate)
    socket.on('user-away', handleUserAway)
    socket.on('user-back-online', handleUserBackOnline)

    // Request initial online status
    socket.emit('request-online-status')

    // Cleanup
    return () => {
      socket.off('user-online-status', handleUserOnline)
      socket.off('online-status-update', handleOnlineStatusUpdate)
      socket.off('user-away', handleUserAway)
      socket.off('user-back-online', handleUserBackOnline)
    }
  }, [socket, isConnected])

  // Handle logout to clear online status
  useEffect(() => {
    const handleLogout = () => {
      console.log('🚪 Logout detected - clearing online status')
      setOnlineStatus({})
    }

    // Listen for logout events
    window.addEventListener('user-logout', handleLogout)

    // Cleanup
    return () => {
      window.removeEventListener('user-logout', handleLogout)
    }
  }, [])

  // Check for existing authenticated session on mount
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const authData = localStorage.getItem('shoreagents-auth')
        if (authData) {
          const auth = JSON.parse(authData)
          if (auth.isAuthenticated && auth.user?.email) {
            console.log('🔍 Found existing authenticated session, marking user as online')
            
            // Mark user as online if they have valid auth
            updateUserStatus(auth.user.email, 'online')
          }
        }
      } catch (error) {
        console.log('Session check failed:', error)
      }
    }

    // Check immediately
    checkExistingSession()
    
    // Also check after a short delay to ensure socket is connected
    const timeoutId = setTimeout(checkExistingSession, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [updateUserStatus])

  // Auto-mark users as away after 5 minutes of inactivity
  // REMOVED: This was causing duplicate away checking with the socket server
  // The socket server already handles away status monitoring
  // useEffect(() => {
  //   const awayCheckInterval = setInterval(() => {
  //     const now = new Date()
  //     setOnlineStatus(prev => {
  //       const updated: OnlineStatus = {}
  //       let hasChanges = false

  //       Object.entries(prev).forEach(([email, status]) => {
  //         if (status.status === 'online') {
  //           const timeSinceLastSeen = now.getTime() - status.lastSeen.getTime()
  //           const fiveMinutes = 5 * 60 * 1000 // 5 minutes in milliseconds
  //           
  //           if (timeSinceLastSeen > fiveMinutes) {
  //             updated[email] = { ...status, status: 'away', isOnline: false }
  //             hasChanges = true
  //           } else {
  //             updated[email] = status
  //           }
  //         } else {
  //           updated[email] = status
  //         }
  //       })

  //       return hasChanges ? updated : prev
  //     })
  //   }, 30000) // Check every 30 seconds

  //   return () => clearInterval(awayCheckInterval)
  // }, [])

  const value: OnlineStatusContextType = {
    onlineStatus,
    updateUserStatus,
    isUserOnline,
    getUserStatus
  }

  return (
    <OnlineStatusContext.Provider value={value}>
      {children}
    </OnlineStatusContext.Provider>
  )
}

export function useOnlineStatus() {
  const context = useContext(OnlineStatusContext)
  if (context === undefined) {
    throw new Error('useOnlineStatus must be used within an OnlineStatusProvider')
  }
  return context
}
