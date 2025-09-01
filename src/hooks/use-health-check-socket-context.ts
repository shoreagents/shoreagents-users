import { useEffect, useRef, useState, useCallback } from 'react'
import { useSocket } from '@/contexts/socket-context'

export interface HealthCheckRequest {
  id: number
  user_id: number
  nurse_id?: number
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  complaint: string
  symptoms?: string
  request_time: string
  approved_time?: string
  completed_time?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface HealthCheckRecord {
  id: number
  request_id?: number
  user_id: number
  nurse_id: number
  visit_date: string
  visit_time: string
  chief_complaint: string
  diagnosis?: string
  treatment_plan?: string
  medicines_issued?: string
  supplies_issued?: string
  follow_up_required: boolean
  follow_up_date?: string
  follow_up_notes?: string
  created_at: string
  updated_at: string
  user_email?: string
  user_first_name?: string
  user_middle_name?: string
  user_last_name?: string
  nurse_email?: string
  nurse_first_name?: string
  nurse_middle_name?: string
  nurse_last_name?: string
}

export interface HealthCheckNotification {
  id: number
  request_id?: number
  user_id: number
  nurse_id?: number
  type: 'request_created' | 'request_approved' | 'request_rejected' | 'request_completed' | 'nurse_assigned' | 'reminder'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface NurseAvailability {
  id: number
  nurse_id: number
  day_of_week: number
  shift_start: string
  shift_end: string
  is_available: boolean
  break_start?: string
  break_end?: string
  nurse_email?: string
  nurse_role?: string
  nurse_first_name?: string
  nurse_middle_name?: string
  nurse_last_name?: string
}

export function useHealthCheckSocketContext(email: string | null) {
  const { socket, isConnected } = useSocket()
  const [requests, setRequests] = useState<HealthCheckRequest[]>([])
  const [records, setRecords] = useState<HealthCheckRecord[]>([])
  const [notifications, setNotifications] = useState<HealthCheckNotification[]>([])
  const [availability, setAvailability] = useState<NurseAvailability[]>([])

  // Set up socket event listeners when socket is available
  useEffect(() => {
    if (!socket || !email) return

    // Listen for health check updates
    const handleHealthCheckUpdate = (data: any) => {
      if (data.email === email) {
        // Handle different types of updates
        if (data.type === 'request_update') {
          setRequests(prev => {
            const existing = prev.find(r => r.id === data.request.id)
            if (existing) {
              return prev.map(r => r.id === data.request.id ? data.request : r)
            } else {
              return [...prev, data.request]
            }
          })
        } else if (data.type === 'record_update') {
          setRecords(prev => {
            const existing = prev.find(r => r.id === data.record.id)
            if (existing) {
              return prev.map(r => r.id === data.record.id ? data.record : r)
            } else {
              return [...prev, data.record]
            }
          })
        } else if (data.type === 'notification_update') {
          setNotifications(prev => {
            const existing = prev.find(n => n.id === data.notification.id)
            if (existing) {
              return prev.map(n => n.id === data.notification.id ? data.notification : n)
            } else {
              return [...prev, data.notification]
            }
          })
        } else if (data.type === 'availability_update') {
          setAvailability(prev => {
            const existing = prev.find(a => a.id === data.availability.id)
            if (existing) {
              return prev.map(a => a.id === data.availability.id ? data.availability : a)
            } else {
              return [...prev, data.availability]
            }
          })
        }
      }
    }

    // Listen for health check events
    socket.on('health-check-update', handleHealthCheckUpdate)

    // Clean up event listeners
    return () => {
      socket.off('health-check-update', handleHealthCheckUpdate)
    }
  }, [socket, email])

  // Fetch records from API
  const fetchRecords = useCallback(async (userId: number, limit: number = 10, offset: number = 0) => {
    try {
      const response = await fetch(`/api/health-check/records?user_id=${userId}&limit=${limit}&offset=${offset}`)
      const data = await response.json()
      
      if (data.success) {
        setRecords(data.records || [])
      }
    } catch (error) {
      console.error('Error fetching health check records:', error)
    }
  }, [])

  // Fetch availability from API
  const fetchAvailability = useCallback(async (nurseId: number) => {
    try {
      const response = await fetch(`/api/health-check/availability?nurse_id=${nurseId}`)
      const data = await response.json()
      
      if (data.success) {
        setAvailability(data.availability || [])
      }
    } catch (error) {
      console.error('Error fetching nurse availability:', error)
    }
  }, [])

  // Create health check request
  const createRequest = useCallback(async (requestData: {
    user_id: number
    complaint: string
    symptoms?: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
  }) => {
    try {
      const response = await fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Add new request to local state
        setRequests(prev => [...prev, data.request])
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('health-check-request-created', {
            email,
            request: data.request
          })
        }
        
        return data.request
      } else {
        throw new Error(data.error || 'Failed to create request')
      }
    } catch (error) {
      console.error('Error creating health check request:', error)
      throw error
    }
  }, [socket, isConnected, email])

  // Check if nurse is on duty
  const isNurseOnDuty = useCallback((nurseId: number) => {
    const now = new Date()
    const currentDayOfWeek = now.getDay()
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    
    // Find availability for the current day of week
    const nurseAvailability = availability.find(avail => 
      avail.nurse_id === nurseId && avail.day_of_week === currentDayOfWeek
    )
    
    if (!nurseAvailability) {
      return null
    }
    
    const isInShift = currentTime >= nurseAvailability.shift_start && currentTime <= nurseAvailability.shift_end
    
    // Check if current time is during break
    const isOnBreak = nurseAvailability.break_start && nurseAvailability.break_end && 
                     currentTime >= nurseAvailability.break_start && currentTime <= nurseAvailability.break_end
    
    const result = {
      onDuty: isInShift && !isOnBreak,
      onBreak: isOnBreak,
      available: nurseAvailability.is_available
    }
    
    return result
  }, [availability])

  return {
    isConnected,
    requests,
    records,
    notifications,
    availability,
    fetchRecords,
    fetchAvailability,
    createRequest,
    isNurseOnDuty
  }
}
