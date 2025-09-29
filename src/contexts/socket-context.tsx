"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const isConnectingRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  
  // Debug: Track how many times this provider is mounted
  const mountCountRef = useRef(0)
  mountCountRef.current++
  
  // Check if this provider should be active (but don't return early)
  const [isActiveProvider, setIsActiveProvider] = useState(false)
  
  useEffect(() => {
    // Check if another provider is already mounted
    if (typeof window !== 'undefined') {
      if ((window as any)._saProviderMounted) {
        setIsActiveProvider(false)
      } else {
        ;(window as any)._saProviderMounted = true
        setIsActiveProvider(true)
      }
    } else {
      setIsActiveProvider(true)
    }
  }, [])

  const connect = useCallback(() => {
    if (!isActiveProvider) {
      return
    }
    
    if (isConnectingRef.current || (socketRef.current && socketRef.current.connected)) {
      return
    }

    // Get user email from auth
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) {
      return
    }

    let authToken: any
    try {
      authToken = JSON.parse(authData)
    } catch {
      return
    }

    const email = authToken?.user?.email
    if (!email) {
      return
    }

    // Check if there's already a global socket instance
    if (typeof window !== 'undefined' && (window as any)._saSocket && (window as any)._saSocket.connected) {
      socketRef.current = (window as any)._saSocket
      setSocket((window as any)._saSocket)
      setIsConnected(true)
      return
    }

    isConnectingRef.current = true

    // Connect to Socket.IO server
    const socketServerUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3004') as string
    const newSocket = io(socketServerUrl, {
      reconnection: true,
      reconnectionAttempts: 5, // Increased from 3
      reconnectionDelay: 1000, // Start with 1s delay
      reconnectionDelayMax: 10000, // Max 10s delay
      timeout: 20000, // Increased from 10s to match server pingTimeout
      transports: ['websocket', 'polling'],
      upgrade: true, // Allow transport upgrades
      rememberUpgrade: true // Remember successful transport
    })

    // Handle connection events
    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id)
      setIsConnected(true)
      isConnectingRef.current = false
      
      // Store socket globally to prevent multiple connections
      if (typeof window !== 'undefined') {
        (window as any)._saSocket = newSocket
      }
      
      // Authenticate with the server
      newSocket.emit('authenticate', { email })
    })

    // Handle ping/pong for connection health monitoring
    newSocket.on('ping', () => {
      newSocket.emit('pong')
    })

    newSocket.on('pong', () => {
      // Connection is healthy
    })

    // Heartbeat mechanism for active connection monitoring
    newSocket.on('heartbeat-ack', () => {
      // Server acknowledged our heartbeat
    })

    // Send periodic heartbeats to server
    const heartbeatInterval = setInterval(() => {
      if (newSocket && newSocket.connected) {
        newSocket.emit('heartbeat')
      }
    }, 30000) // Every 30 seconds

    // Clean up heartbeat interval on disconnect
    newSocket.on('disconnect', () => {
      clearInterval(heartbeatInterval)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason)
      setIsConnected(false)
      isConnectingRef.current = false
      
      // If it's a ping timeout, try to reconnect immediately
      if (reason === 'ping timeout') {
        console.log('🔄 Ping timeout detected, attempting reconnection...')
        setTimeout(() => {
          if (!newSocket.connected) {
            newSocket.connect()
          }
        }, 1000)
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message)
      setIsConnected(false)
      isConnectingRef.current = false
    })

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts')
      setIsConnected(true)
    })

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Socket reconnection attempt', attemptNumber)
    })

    newSocket.on('reconnect_error', (error) => {
      console.error('🔌 Socket reconnection error:', error.message)
    })

    newSocket.on('reconnect_failed', () => {
      console.error('🔌 Socket reconnection failed after all attempts')
      setIsConnected(false)
    })

    newSocket.on('authenticated', (data) => {
      
      // Dispatch connection event for UI updates
      const event = new CustomEvent('socket-connected', { 
        detail: { 
          timestamp: new Date().toISOString() 
        } 
      });
      window.dispatchEvent(event);
    })

    socketRef.current = newSocket
    setSocket(newSocket)
  }, [isActiveProvider])

  const disconnect = useCallback(() => {
    // Only disconnect if this is the active provider
    if (!isActiveProvider) {
      return
    }
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
      isConnectingRef.current = false
      
      // Remove global reference
      if (typeof window !== 'undefined') {
        (window as any)._saSocket = null
      }
    }
  }, [isActiveProvider])

  useEffect(() => {
    // Connect when component mounts and becomes active
    if (isActiveProvider && (!socketRef.current || !socketRef.current.connected)) {
      connect()
    } 
    
    // Cleanup when provider unmounts
    return () => {
      if (isActiveProvider && typeof window !== 'undefined') {
        (window as any)._saProviderMounted = false
      }
    }
  }, [isActiveProvider, connect])

  useEffect(() => {
    // Listen for logout events to disconnect socket
    const handleLogout = () => {
      if (socketRef.current && socketRef.current.connected) {
        // Emit logout event to socket server
        socketRef.current.emit('logout')
        
        // Wait for server to process logout before disconnecting
        setTimeout(() => {
          if (socketRef.current && socketRef.current.connected) {
            disconnect()
          }
        }, 300) // Wait 300ms for server to process logout
      }
    }

    // Listen for productivity updates to sync with socket server
    const handleProductivityUpdate = (event: Event) => {
      if (socketRef.current && socketRef.current.connected) {
        const customEvent = event as CustomEvent
        // Emit productivity update to socket server
        socketRef.current.emit('productivity-update', {
          email: customEvent.detail.email,
          userId: customEvent.detail.userId,
          productivityScore: customEvent.detail.productivityScore,
          totalActiveTime: customEvent.detail.totalActiveTime,
          totalInactiveTime: customEvent.detail.totalInactiveTime,
          timestamp: customEvent.detail.timestamp
        })
      }
    }

    // Listen for login events to mark user as online
    const handleLogin = (event: Event) => {
      if (socketRef.current && socketRef.current.connected) {
        const customEvent = event as CustomEvent
        const email = customEvent.detail.email || customEvent.detail.user?.email
        if (email) {
          // Emit login event to socket server
          socketRef.current.emit('user-login', email)
        }
      }
    }

    // Listen for custom logout events to emit socket logout
    const handleCustomLogout = (event: Event) => {
      if (socketRef.current && socketRef.current.connected) {
        const customEvent = event as CustomEvent
        const email = customEvent.detail.email
        if (email) {
          // Emit logout event to socket server
          socketRef.current.emit('user-logout', email)
        }
      }
    }

    // Add event listeners
    window.addEventListener('user-logout', handleLogout)
    window.addEventListener('user-login', handleLogin)
    window.addEventListener('user-logout', handleCustomLogout)
    window.addEventListener('productivity-update', handleProductivityUpdate)

    // Cleanup
    return () => {
      window.removeEventListener('user-logout', handleLogout)
      window.removeEventListener('user-login', handleLogin)
      window.removeEventListener('user-logout', handleCustomLogout)
      window.removeEventListener('productivity-update', handleProductivityUpdate)
      
      // Don't disconnect on unmount - let the context handle it
      // This prevents issues with React HMR and component remounting
    }
  }, [disconnect])

  const value: SocketContextType = {
    socket,
    isConnected,
    connect,
    disconnect
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
