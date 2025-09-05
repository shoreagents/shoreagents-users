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
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true) // Start as true to show loading initially
  const [userRequests, setUserRequests] = useState<HealthCheckRequest[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)

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
        } else if (data.type === 'request_status_changed') {
          // Handle health check request status changes
          const updatedRequest = data.request
          setRequests(prev => {
            const existing = prev.find(r => r.id === updatedRequest.id)
            if (existing) {
              return prev.map(r => r.id === updatedRequest.id ? updatedRequest : r)
            } else {
              return [...prev, updatedRequest]
            }
          })
          setUserRequests(prev => {
            const existing = prev.find(r => r.id === updatedRequest.id)
            if (existing) {
              return prev.map(r => r.id === updatedRequest.id ? updatedRequest : r)
            } else {
              return [...prev, updatedRequest]
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
    socket.on('health_check_event', (data: any) => {
      console.log('🔔 Health check event received:', data)
      
      if (data.event === 'request_status_changed') {
        console.log('📝 Processing request status change:', {
          request_id: data.request_id,
          user_id: data.user_id,
          new_status: data.new_status,
          updated_at: data.updated_at
        })
        
        // Handle request status change
        const updatedRequest = {
          id: data.request_id,
          user_id: data.user_id,
          nurse_id: data.nurse_id,
          status: data.new_status,
          priority: 'normal', // Default, will be updated from database
          complaint: '', // Will be updated from database
          request_time: new Date().toISOString(),
          approved_time: data.new_status === 'approved' ? new Date().toISOString() : null,
          completed_time: data.new_status === 'completed' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString()
        }
        
        setRequests(prev => {
          const updated = prev.map(req => 
            req.id === data.request_id 
              ? { ...req, status: data.new_status, updated_at: data.updated_at }
              : req
          )
          console.log('📋 Updated requests:', updated.map(r => ({ id: r.id, status: r.status, user_id: r.user_id })))
          return updated
        })
        setUserRequests(prev => {
          const updated = prev.map(req => 
            req.id === data.request_id 
              ? { ...req, status: data.new_status, updated_at: data.updated_at }
              : req
          )
          console.log('👤 Updated userRequests:', updated.map(r => ({ id: r.id, status: r.status, user_id: r.user_id })))
          console.log('🔍 After update - hasPending check:', {
            userId: data.user_id,
            hasPending: updated.some(request => 
              request.user_id === data.user_id && 
              (request.status === 'pending' || request.status === 'approved')
            )
          })
          return updated
        })
        
        // Show notification based on status
        let notificationTitle = 'Health Check Request Updated'
        let notificationMessage = `Your health check request status has changed to: ${data.new_status}`
        
        if (data.new_status === 'approved') {
          notificationTitle = 'Health Check Request Approved'
          notificationMessage = 'Your health check request has been approved! Please proceed to the clinic.'
        } else if (data.new_status === 'rejected') {
          notificationTitle = 'Health Check Request Rejected'
          notificationMessage = 'Your health check request has been rejected. Please contact the nurse for more information.'
        } else if (data.new_status === 'completed') {
          notificationTitle = 'Health Check Completed'
          notificationMessage = 'Your health check has been completed. Check your records for details.'
        }
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('health-check-notification', {
            detail: {
              type: data.new_status === 'approved' ? 'success' : data.new_status === 'rejected' ? 'error' : 'info',
              title: notificationTitle,
              message: notificationMessage
            }
          }))
        }
      }
    })

    // Clean up event listeners
    return () => {
      socket.off('health-check-update', handleHealthCheckUpdate)
      socket.off('health_check_event')
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
    setIsLoadingAvailability(true)
    try {
      const response = await fetch(`/api/health-check/availability?nurse_id=${nurseId}`)
      const data = await response.json()
      
      if (data.success) {
        setAvailability(data.availability || [])
      }
    } catch (error) {
      console.error('Error fetching nurse availability:', error)
    } finally {
      setIsLoadingAvailability(false)
    }
  }, [])

  // Fetch user's health check requests
  const fetchUserRequests = useCallback(async (userId: number) => {
    setIsLoadingRequests(true)
    try {
      const response = await fetch(`/api/health-check/requests?user_id=${userId}&limit=50&offset=0`)
      const data = await response.json()
      
      if (data.success) {
        console.log('📥 Fetched user requests:', data.requests?.map((r: HealthCheckRequest) => ({ id: r.id, status: r.status, user_id: r.user_id })))
        setUserRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Error fetching user requests:', error)
    } finally {
      setIsLoadingRequests(false)
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
        setUserRequests(prev => [...prev, data.request])
        
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

  // Check if nurse is on duty - FIXED: Proper timezone handling
  const isNurseOnDuty = useCallback((nurseId: number) => {
    // Don't check duty status if still loading or no availability data
    if (isLoadingAvailability || availability.length === 0) {
      return null // Return null to indicate loading/unknown status
    }
    
    // Get current time in Philippines timezone (Asia/Manila)
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const currentDayOfWeek = nowPH.getDay()
    const currentTime = nowPH.toTimeString().slice(0, 5) // HH:MM format in PH timezone
    
    // Find availability for the current day of week
    const nurseAvailability = availability.find(avail => 
      avail.nurse_id === nurseId && avail.day_of_week === currentDayOfWeek
    )
    
    if (!nurseAvailability) {
      return null
    }
    
    // Convert database time strings to comparable format
    const formatTimeForComparison = (timeStr: string) => {
      // Ensure time is in HH:MM format for comparison
      return timeStr.length === 8 ? timeStr.slice(0, 5) : timeStr
    }
    
    const shiftStart = formatTimeForComparison(nurseAvailability.shift_start)
    const shiftEnd = formatTimeForComparison(nurseAvailability.shift_end)
    
    const isInShift = currentTime >= shiftStart && currentTime <= shiftEnd
    
    // Check if current time is during break
    let isOnBreak = false
    if (nurseAvailability.break_start && nurseAvailability.break_end) {
      const breakStart = formatTimeForComparison(nurseAvailability.break_start)
      const breakEnd = formatTimeForComparison(nurseAvailability.break_end)
      isOnBreak = currentTime >= breakStart && currentTime <= breakEnd
    }
    
    const result = {
      onDuty: isInShift && !isOnBreak,
      onBreak: isOnBreak,
      available: nurseAvailability.is_available
    }
    
    return result
  }, [availability, isLoadingAvailability])

  // Check if user has a pending or approved request (both should block new requests)
  // Note: 'completed' requests should NOT block new requests
  const hasPendingRequest = useCallback((userId: number) => {
    const hasPending = userRequests.some(request => 
      request.user_id === userId && 
      (request.status === 'pending' || request.status === 'approved')
    )
    console.log('🔍 hasPendingRequest check:', { 
      userId, 
      userRequests: userRequests.map(r => ({ id: r.id, status: r.status, user_id: r.user_id })),
      hasPending,
      blockingStatuses: userRequests.filter(r => r.user_id === userId && (r.status === 'pending' || r.status === 'approved'))
    })
    return hasPending
  }, [userRequests])

  return {
    isConnected,
    requests,
    records,
    notifications,
    availability,
    isLoadingAvailability,
    userRequests,
    isLoadingRequests,
    fetchRecords,
    fetchAvailability,
    fetchUserRequests,
    createRequest,
    isNurseOnDuty,
    hasPendingRequest
  }
}
