"use client"

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Get user email from auth
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) return

    let authToken: any
    try {
      authToken = JSON.parse(authData)
    } catch {
      return
    }

    const email = authToken?.user?.email
    if (!email) return

    // Connect to Socket.IO server
    const socketServerUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3001') as string
    const newSocket = io(socketServerUrl, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    })

    // Handle connection events
    newSocket.on('connect', () => {
      console.log('Socket connected for activity tracking')
      setIsConnected(true)
      
      // Authenticate with the server
      newSocket.emit('authenticate', { email })
    })

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    newSocket.on('authenticated', () => {
      console.log('Socket authenticated for activity tracking')
      
      // After authentication, check if user should be marked as online
      try {
        const authData = localStorage.getItem("shoreagents-auth")
        if (authData) {
          const auth = JSON.parse(authData)
          if (auth.isAuthenticated && auth.user?.email) {
            console.log('🔍 Socket authenticated - checking user session status')
            
            // Emit a session check to the server
            newSocket.emit('check-session-status', { 
              email: auth.user.email,
              userId: auth.user.id
            })
          }
        }
      } catch (error) {
        console.log('Session status check failed:', error)
      }
    })

    setSocket(newSocket)

    // Listen for logout events to disconnect socket
    const handleLogout = () => {
      console.log('🚪 Logout detected - disconnecting socket')
      if (newSocket && newSocket.connected) {
        // Emit logout event to socket server
        newSocket.emit('logout')
        
        // Wait a bit for the event to be processed, then disconnect
        setTimeout(() => {
          newSocket.disconnect()
        }, 100)
      }
    }

    // Listen for login events to mark user as online
    const handleLogin = (event: Event) => {
      console.log('🚪 Login detected - marking user as online')
      if (newSocket && newSocket.connected) {
        const customEvent = event as CustomEvent
        // Emit login event to socket server
        newSocket.emit('login', { 
          user: customEvent.detail.user,
          timestamp: customEvent.detail.timestamp,
          reason: customEvent.detail.reason
        })
      }
    }

    // Listen for productivity updates to sync with socket server
    const handleProductivityUpdate = (event: Event) => {
      console.log('📊 Productivity update detected - syncing with socket server')
      if (newSocket && newSocket.connected) {
        const customEvent = event as CustomEvent
        // Emit productivity update to socket server
        newSocket.emit('productivity-update', {
          email: customEvent.detail.email,
          userId: customEvent.detail.userId,
          productivityScore: customEvent.detail.productivityScore,
          totalActiveTime: customEvent.detail.totalActiveTime,
          totalInactiveTime: customEvent.detail.totalInactiveTime,
          timestamp: customEvent.detail.timestamp
        })
      }
    }

    // Listen for logout events
    window.addEventListener('user-logout', handleLogout)
    
    // Listen for login events
    window.addEventListener('user-login', handleLogin)
    
    // Listen for productivity updates
    window.addEventListener('productivity-update', handleProductivityUpdate)

    // Cleanup
    return () => {
      window.removeEventListener('user-logout', handleLogout)
      window.removeEventListener('user-login', handleLogin)
      window.removeEventListener('productivity-update', handleProductivityUpdate)
      newSocket.disconnect()
    }
  }, [])

  return { socket, isConnected }
}
