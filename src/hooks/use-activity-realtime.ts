import { useState, useEffect, useRef } from 'react'

interface ActivityData {
  id: number
  user_id: number
  is_currently_active: boolean
  today_active_seconds: number
  today_inactive_seconds: number
  last_session_start: string | null
  created_at: string
  updated_at: string
}

interface RealtimeMessage {
  type: 'connected' | 'activity_change' | 'error'
  message?: string
  data?: {
    user_id: number
    is_currently_active: boolean
    today_active_seconds: number
    today_inactive_seconds: number
    last_session_start: string | null
    updated_at: string
  }
}

interface UseActivityRealtimeReturn {
  data: ActivityData | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: string | null
  error: string | null
}

export const useActivityRealtime = (email: string | null): UseActivityRealtimeReturn => {
  const [data, setData] = useState<ActivityData | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch initial data
  useEffect(() => {
    if (!email) {
      setConnectionStatus('disconnected')
      return
    }

    const fetchInitialData = async () => {
      try {
        const response = await fetch(`/api/activity?email=${encodeURIComponent(email)}`)
        if (response.ok) {
          const initialData = await response.json()
          setData(initialData)
        }
      } catch (error) {
        setError('Failed to fetch initial data')
      }
    }

    fetchInitialData()
  }, [email])

  // Set up real-time connection
  useEffect(() => {
    if (!email) {
      setConnectionStatus('disconnected')
      return
    }

    const setupConnection = () => {
      try {
        setConnectionStatus('connecting')
        setError(null)
        
        // Create EventSource for Server-Sent Events
        const eventSource = new EventSource(`/api/activity?email=${encodeURIComponent(email)}&realtime=true`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          setConnectionStatus('connected')
        }

        eventSource.onmessage = (event) => {
          try {
            const message: RealtimeMessage = JSON.parse(event.data);
            
            if (message.type === 'activity_change' && message.data) {
              // Update data with real-time changes
              setData(prevData => {
                if (!prevData) {
                  // If no previous data, create a minimal object with the update
                  return {
                    id: 0,
                    user_id: message.data!.user_id,
                    is_currently_active: message.data!.is_currently_active,
                    today_active_seconds: message.data!.today_active_seconds,
                    today_inactive_seconds: message.data!.today_inactive_seconds,
                    last_session_start: message.data!.last_session_start,
                    created_at: new Date().toISOString(),
                    updated_at: message.data!.updated_at
                  }
                }
                return {
                  ...prevData,
                  is_currently_active: message.data!.is_currently_active,
                  today_active_seconds: message.data!.today_active_seconds,
                  today_inactive_seconds: message.data!.today_inactive_seconds,
                  last_session_start: message.data!.last_session_start,
                  updated_at: message.data!.updated_at
                }
              })
              setLastUpdate(new Date().toLocaleString())
            } else if (message.type === 'connected') {
              // Connection established
            } else if (message.type === 'error') {
              setError(message.message || 'Unknown error')
              setConnectionStatus('error')
            }
          } catch (parseError) {
            setError('Failed to parse real-time message')
          }
        }

        eventSource.onerror = (event) => {
          setConnectionStatus('error')
          setError('Connection error')
        }
      } catch (setupError) {
        setConnectionStatus('error')
        setError('Failed to setup connection')
      }
    }

    setupConnection()

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnectionStatus('disconnected')
    }
  }, [email])

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return {
    data,
    connectionStatus,
    lastUpdate,
    error
  }
} 