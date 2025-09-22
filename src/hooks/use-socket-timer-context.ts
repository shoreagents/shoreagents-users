import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '@/contexts/socket-context'

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

interface UseSocketTimerContextReturn {
  timerData: TimerData | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  error: string | null
  setActivityState: (isActive: boolean) => void
  isAuthenticated: boolean
  updateTimerData: (activeSeconds: number, inactiveSeconds: number) => void
}

export const useSocketTimerContext = (email: string | null): UseSocketTimerContextReturn => {
  const { socket, isConnected } = useSocket()
  const [timerData, setTimerData] = useState<TimerData | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  const lastActivityStateRef = useRef<boolean | null>(null)
  const timerUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Update connection status based on socket state
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected')
      setError(null)
    } else {
      setConnectionStatus('disconnected')
    }
  }, [isConnected])

  // Reset state when email changes (user logout/login)
  useEffect(() => {
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
      return
    }
  }, [email])

  // Set up socket event listeners when socket is available
  useEffect(() => {
    if (!socket || !email) return

    // Set up socket event listeners for user

    // Set up timer update event listener
    const handleTimerUpdate = (data: any) => {
      if (data.email === email) {
        setTimerData({
          isActive: data.isActive,
          activeSeconds: data.activeSeconds || 0,
          inactiveSeconds: data.inactiveSeconds || 0,
          sessionStart: data.sessionStart,
          email: data.email,
          userId: data.userId,
          shiftInfo: data.shiftInfo
        })
      }
    }

    // Set up authentication event listener
    const handleAuthenticated = (data: any) => {
      if (data.email === email) {
        setIsAuthenticated(true)
        setError(null)
        
        // CRITICAL: Initialize timer data from authentication response
        // This ensures the timer starts immediately after authentication
        setTimerData({
          isActive: data.isActive || false,
          activeSeconds: data.activeSeconds || 0,
          inactiveSeconds: data.inactiveSeconds || 0,
          sessionStart: data.sessionStart,
          email: data.email,
          userId: data.userId,
          shiftInfo: data.shiftInfo
        })
        
        console.log('🔐 Timer initialized from authentication:', {
          isActive: data.isActive,
          activeSeconds: data.activeSeconds,
          inactiveSeconds: data.inactiveSeconds,
          email: data.email
        })
      }
    }

    // Set up error event listener
    const handleError = (errorData: any) => {
      if (errorData.email === email) {
        setError(errorData.message || 'Socket error occurred')
        setConnectionStatus('error')
      }
    }

    // Set up shift reset event listener
    const handleShiftReset = (data: any) => {
      if (data.email === email) {
        // Reset local timer state when shift resets
        setTimerData(prev => prev ? {
          ...prev,
          activeSeconds: 0,
          inactiveSeconds: 0,
          isActive: false
        } : null)
      }
    }

    // Add event listeners
    socket.on('timerUpdated', handleTimerUpdate)
    socket.on('authenticated', handleAuthenticated)
    socket.on('error', handleError)
    socket.on('shiftReset', handleShiftReset)

    // Clean up event listeners
    return () => {
      socket.off('timerUpdated', handleTimerUpdate)
      socket.off('authenticated', handleAuthenticated)
      socket.off('error', handleError)
      socket.off('shiftReset', handleShiftReset)
    }
  }, [socket, email])

  // Set activity state
  const setActivityState = useCallback((isActive: boolean) => {
    if (!socket || !email) return

    // Only emit if state actually changed
    if (lastActivityStateRef.current !== isActive) {
      lastActivityStateRef.current = isActive
      
      // IMMEDIATELY update local state for instant timer response
      setTimerData(prev => prev ? {
        ...prev,
        isActive: isActive
      } : {
        isActive: isActive,
        activeSeconds: 0,
        inactiveSeconds: 0,
        sessionStart: null,
        email: email
      })
      
      // Emit to server for persistence
      socket.emit('activityChange', isActive)
    }
  }, [socket, email])

  // Update timer data
  const updateTimerData = useCallback((activeSeconds: number, inactiveSeconds: number) => {
    if (!socket || !email) return

    socket.emit('timerUpdate', {
      email,
      activeSeconds,
      inactiveSeconds,
      timestamp: new Date().toISOString()
    })
  }, [socket, email])

  // Start timer update interval when authenticated
  useEffect(() => {
    if (!isAuthenticated || !email) return

    // Start real-time counting
    const interval = setInterval(() => {
      // This will be handled by the socket server now
      // The frontend just needs to listen for updates
    }, 1000)

    timerUpdateIntervalRef.current = interval

    return () => {
      if (timerUpdateIntervalRef.current) {
        clearInterval(timerUpdateIntervalRef.current)
        timerUpdateIntervalRef.current = null
      }
    }
  }, [isAuthenticated, email])

  return {
    timerData,
    connectionStatus,
    error,
    setActivityState,
    isAuthenticated,
    updateTimerData
  }
}
