import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface TimerData {
  isActive: boolean
  activeSeconds: number
  inactiveSeconds: number
  sessionStart: string | null
  email?: string
  userId?: number
  shiftInfo?: {
    period: string
    schedule: string
    time: string
    timeUntilReset: number
    formattedTimeUntilReset: string
    nextResetTime: string
  }
}

interface UseSocketTimerReturn {
  timerData: TimerData | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  error: string | null
  setActivityState: (isActive: boolean) => void
  isAuthenticated: boolean
  updateTimerData: (activeSeconds: number, inactiveSeconds: number) => void
}

export const useSocketTimer = (email: string | null): UseSocketTimerReturn => {
  const [timerData, setTimerData] = useState<TimerData | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  const socketRef = useRef<Socket | null>(null)
  const lastActivityStateRef = useRef<boolean | null>(null)
  const timerUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastServerShiftIdRef = useRef<string | null>(null)
  const lastServerResetAtRef = useRef<number | null>(null)

  // Initialize Socket.IO connection
  useEffect(() => {
    // Reset state when email changes (user logout/login)
    if (!email) {
      setTimerData(null)
      setConnectionStatus('disconnected')
      setError(null)
      setIsAuthenticated(false)
      lastActivityStateRef.current = null
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
        timerUpdateIntervalRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // Disconnect existing socket if email changed
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setConnectionStatus('connecting')

    // Use a ref to track if this effect is still active
    const isActive = { current: true }

    // Add a small delay to avoid rapid reconnections during React development mode
    const connectionTimeout = setTimeout(() => {
      if (!isActive.current) return

      // Connect to Socket.IO server with safer connection options
      const socketServerUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3004') as string
      const socket = io(socketServerUrl, {
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

      // Handle connection events
      socket.on('connect', () => {
        if (!isActive.current) return
        setConnectionStatus('connected')
        setError(null)
        
        // Authenticate with the server
        socket.emit('authenticate', email)
      })

      socket.on('disconnect', (reason) => {
        if (!isActive.current) return
        setConnectionStatus('disconnected')
      })

      socket.on('connect_error', (error) => {
        if (!isActive.current) return
        setConnectionStatus('error')
        setError('Connection failed')
      })

      socket.on('reconnect', (attemptNumber) => {
        if (!isActive.current) return
        setConnectionStatus('connected')
        setError(null)
        
        // Re-authenticate after reconnection
        socket.emit('authenticate', email)
      })

      socket.on('reconnect_attempt', (attemptNumber) => {
        if (!isActive.current) return
        setConnectionStatus('connecting')
      })

      socket.on('reconnect_error', (error) => {
        if (!isActive.current) return
        setConnectionStatus('error')
        setError('Reconnection failed')
      })

      // Expose socket globally for other hooks (e.g., comments)
      ;(window as any)._saSocket = socket
      try { window.dispatchEvent(new Event('sa-socket-ready')) } catch {}

      // Handle authentication response
      socket.on('authenticated', (data: TimerData) => {
        if (!isActive.current) return
        
        // Validate that authentication data is for the current user
        if (data && data.email && email && data.email !== email) {
          console.warn(`Authentication data received for wrong user: expected ${email}, got ${data.email}`)
          return
        }
        
        console.log('Socket.IO authenticated for user:', email, 'Data:', data)
        setTimerData(data)
        setIsAuthenticated(true)
        lastActivityStateRef.current = data.isActive
      })

      // Handle activity updates from server
      socket.on('activityUpdated', (data: TimerData) => {
        if (!isActive.current) return
        
        // Validate that activity data is for the current user
        if (data && data.email && email && data.email !== email) {
          console.warn(`Activity data received for wrong user: expected ${email}, got ${data.email}`)
          return
        }
        
        setTimerData(data)
      })

      // Handle timer updates from server
      socket.on('timerUpdated', (data: TimerData) => {
        if (!isActive.current) return
        
        // Validate that timer data is for the current user
        if (data && data.email && email && data.email !== email) {
          console.warn(`Timer data received for wrong user: expected ${email}, got ${data.email}`)
          return
        }
        
        // Only update if we have new, valid data
        if (data && typeof data.isActive === 'boolean') {
          // Update timer data
          setTimerData(data)
          
          // Update local activity state reference
          lastActivityStateRef.current = data.isActive
          
          // Emit custom event for other components
          window.dispatchEvent(new CustomEvent('serverActivityUpdate', { 
            detail: { isActive: data.isActive, timestamp: Date.now() }
          }))
        } else {
          console.warn('Received invalid timer data from server:', data)
        }
      })

      // Handle shift reset events from server
      socket.on('shiftReset', (data: TimerData & { resetReason?: string, shiftId?: string }) => {
        if (!isActive.current) return
        
        // Validate that shift reset data is for the current user
        if (data && data.email && email && data.email !== email) {
          console.warn(`Shift reset data received for wrong user: expected ${email}, got ${data.email}`)
          return
        }
        // Force update timer data immediately
        setTimerData(data)
        
        // Record server reset to avoid client forcing a duplicate reset for the same shift
        if (data && (data as any).shiftId) {
          lastServerShiftIdRef.current = (data as any).shiftId as string
        }
        lastServerResetAtRef.current = Date.now()
        
        // Emit a custom event to notify other components about the shift reset
        const eventData = { ...data, resetReason: data.resetReason || 'shift_change' }
        window.dispatchEvent(new CustomEvent('shiftReset', { 
          detail: eventData
        }))
        
      })

      // When client-side countdown detects 0s, ask server to force a reset write
      window.addEventListener('shiftResetCountdownZero', () => {
        try {
          // Guard: if we recently received a server-driven reset (within 2 minutes), skip
          if (lastServerResetAtRef.current && (Date.now() - lastServerResetAtRef.current) < 120000) {
            return
          }
          // Guard: if we have a shiftId from server and timerData has shiftInfo, avoid duplicate for same shift period
          // Note: shiftId derivation on client is not available; rely on time-based guard above primarily.
          socket.emit('forceShiftReset')
        } catch {}
      })

      // Handle errors
      socket.on('error', (errorData: { message: string }) => {
        if (!isActive.current) return
        setError(errorData.message);
        setConnectionStatus('error');
      })
    }, 100) // Small delay to avoid rapid reconnections

    return () => {
      // Mark effect as inactive
      isActive.current = false
      
      // Clear the connection timeout
      clearTimeout(connectionTimeout)
      
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
        timerUpdateIntervalRef.current = null
      }
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners()
          socketRef.current.disconnect()
        } catch (error) {
          console.warn('Error during socket cleanup:', error)
        }
      }
    }
  }, [email])

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
        timerUpdateIntervalRef.current = null
      }
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners()
          socketRef.current.disconnect()
        } catch (error) {
          console.warn('Error during socket cleanup on unmount:', error)
        } finally {
          socketRef.current = null
        }
      }
    }
  }, [])

  // Set activity state
  const setActivityState = useCallback(async (isActive: boolean) => {
    if (!email || !socketRef.current || lastActivityStateRef.current === isActive) return

    try {
      socketRef.current.emit('activityChange', isActive)
      lastActivityStateRef.current = isActive
    } catch (error) {
      console.error('Failed to send activity state:', error)
    }
  }, [email])

  // Update timer data with external values
  const updateTimerData = useCallback((activeSeconds: number, inactiveSeconds: number) => {
    if (!socketRef.current) return

    socketRef.current.emit('timerUpdate', { activeSeconds, inactiveSeconds })
  }, [])

  // Periodic timer updates (every 15 seconds to prevent race conditions)
  useEffect(() => {
    if (!isAuthenticated || !socketRef.current) return

    timerUpdateIntervalRef.current = setInterval(() => {
      if (timerData && socketRef.current) {
        // IMPROVED TIMER SYNC: Only sync if we have valid data
        const hasValidData = typeof timerData.activeSeconds === 'number' && 
                           typeof timerData.inactiveSeconds === 'number' &&
                           typeof timerData.isActive === 'boolean'
        
        if (hasValidData) {
          // Send timer update to server
          socketRef.current.emit('timerUpdate', {
            activeSeconds: timerData.activeSeconds,
            inactiveSeconds: timerData.inactiveSeconds
          })
          
          // Also sync activity state if it changed
          if (lastActivityStateRef.current !== timerData.isActive) {
            lastActivityStateRef.current = timerData.isActive
          }
        } else {
          console.warn('Skipping timer sync - invalid data:', timerData)
        }
      }
    }, 15000) // 15 seconds (reduced frequency)

    return () => {
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
      }
    }
  }, [isAuthenticated, timerData])

  // REMOVED: Fallback timer sync that was bypassing authentication
  // This was causing timer updates to be sent before authentication completed

  return {
    timerData,
    connectionStatus,
    error,
    setActivityState,
    isAuthenticated,
    updateTimerData
  }
} 


