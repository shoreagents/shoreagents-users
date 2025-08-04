import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface TimerData {
  isActive: boolean
  activeSeconds: number
  inactiveSeconds: number
  sessionStart: string | null
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
      console.log('Disconnecting existing socket for new user:', email)
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setConnectionStatus('connecting')
    console.log('Connecting Socket.IO for user:', email)

    // Connect to Socket.IO server with reconnection options
    const socket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
      forceNew: true,
      transports: ['websocket', 'polling']
    })
    socketRef.current = socket

    // Handle connection events
    socket.on('connect', () => {
      console.log('Socket.IO connected for user:', email)
      setConnectionStatus('connected')
      setError(null)
      
      // Authenticate with the server
      console.log('Authenticating with server for user:', email)
      socket.emit('authenticate', email)
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected for user:', email, 'Reason:', reason)
      setConnectionStatus('disconnected')
    })

    socket.on('connect_error', (error) => {
      console.log('Socket.IO connection error for user:', email, error)
      setConnectionStatus('error')
      setError('Connection failed')
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket.IO reconnected for user:', email, 'Attempt:', attemptNumber)
      setConnectionStatus('connected')
      setError(null)
      
      // Re-authenticate after reconnection
      console.log('Re-authenticating after reconnect for user:', email)
      socket.emit('authenticate', email)
    })

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket.IO reconnection attempt for user:', email, 'Attempt:', attemptNumber)
      setConnectionStatus('connecting')
    })

    socket.on('reconnect_error', (error) => {
      console.log('Socket.IO reconnection error for user:', email, error)
      setConnectionStatus('error')
      setError('Reconnection failed')
    })

    // Handle authentication response
    socket.on('authenticated', (data: TimerData) => {
      console.log('Socket.IO authenticated for user:', email, 'Data:', data)
      setTimerData(data)
      setIsAuthenticated(true)
      lastActivityStateRef.current = data.isActive
    })

    // Handle activity updates from server
    socket.on('activityUpdated', (data: TimerData) => {
      setTimerData(data)
    })

    // Handle timer updates from server
    socket.on('timerUpdated', (data: TimerData) => {
      setTimerData(data)
    })

    // Handle errors
    socket.on('error', (errorData: { message: string }) => {
      setError(errorData.message);
      setConnectionStatus('error');
    })

    return () => {
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
        timerUpdateIntervalRef.current = null
      }
      if (socket) {
        socket.disconnect()
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
        socketRef.current.disconnect()
        socketRef.current = null
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

  // Periodic timer updates (every 5 seconds)
  useEffect(() => {
    if (!isAuthenticated || !socketRef.current) return

    timerUpdateIntervalRef.current = setInterval(() => {
      if (timerData && socketRef.current) {
        socketRef.current.emit('timerUpdate', {
          activeSeconds: timerData.activeSeconds,
          inactiveSeconds: timerData.inactiveSeconds
        })
      }
    }, 5000) // 5 seconds

    return () => {
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
      }
    }
  }, [isAuthenticated, timerData])

  return {
    timerData,
    connectionStatus,
    error,
    setActivityState,
    isAuthenticated,
    updateTimerData
  }
} 