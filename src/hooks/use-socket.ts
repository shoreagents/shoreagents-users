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
      
      // Dispatch connection event for UI updates
      const event = new CustomEvent('socket-connected', { 
        detail: { 
          timestamp: new Date().toISOString() 
        } 
      });
      window.dispatchEvent(event);
    })

    setSocket(newSocket)

    // Listen for logout events to disconnect socket
    const handleLogout = () => {
      console.log('🚪 Logout detected - disconnecting socket')
      if (newSocket && newSocket.connected) {
        // Emit logout event to socket server
        newSocket.emit('logout')
        
        // Wait for server to process logout before disconnecting
        setTimeout(() => {
          if (newSocket && newSocket.connected) {
            console.log('🔌 Disconnecting socket after logout processing')
            newSocket.disconnect()
          }
        }, 300) // Wait 300ms for server to process logout
      } else {
        console.log('⚠️ Socket not connected during logout - cannot send logout event')
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
    
    // Listen for login events to mark user as online
    const handleLogin = (event: Event) => {
      console.log('🚪 Login detected - marking user as online')
      if (newSocket && newSocket.connected) {
        const customEvent = event as CustomEvent
        const email = customEvent.detail.email || customEvent.detail.user?.email
        if (email) {
          // Emit login event to socket server
          newSocket.emit('user-login', email)
        }
      }
    }

    // Listen for custom logout events to emit socket logout
    const handleCustomLogout = (event: Event) => {
      console.log('🚪 Custom logout detected - notifying socket server')
      if (newSocket && newSocket.connected) {
        const customEvent = event as CustomEvent
        const email = customEvent.detail.email
        if (email) {
          // Emit logout event to socket server
          newSocket.emit('user-logout', email)
        }
      }
    }
    
    // Listen for login events
    window.addEventListener('user-login', handleLogin)
    
    // Listen for custom logout events
    window.addEventListener('user-logout', handleCustomLogout)
    
    // Listen for productivity updates
    window.addEventListener('productivity-update', handleProductivityUpdate)

    // Cleanup
    return () => {
      window.removeEventListener('user-logout', handleLogout)
      window.removeEventListener('user-login', handleLogin)
      window.removeEventListener('user-logout', handleCustomLogout)
      window.removeEventListener('productivity-update', handleProductivityUpdate)
      newSocket.disconnect()
    }
  }, [])

  return { socket, isConnected }
}
