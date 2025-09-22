import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

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

export function useHealthCheckSocket(email: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [requests, setRequests] = useState<HealthCheckRequest[]>([])
  const [records, setRecords] = useState<HealthCheckRecord[]>([])
  const [notifications, setNotifications] = useState<HealthCheckNotification[]>([])
  const [availability, setAvailability] = useState<NurseAvailability[]>([])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true) // Start as true to show loading initially

  // Connect to socket server
  useEffect(() => {
    if (!email) return

    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 
      (process.env.NODE_ENV === 'production' ? 'https://shoreagents-users-production.up.railway.app' : 'http://localhost:3004')
    const socket = io(socketServerUrl, {
      reconnection: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('authenticate', email)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Listen for health check events
    socket.on('health_check_event', (data: any) => {
      
      if (data.event === 'request_created') {
        // Handle new request created
        const newRequest: HealthCheckRequest = {
          id: data.request_id,
          user_id: data.user_id,
          nurse_id: data.nurse_id,
          status: data.status,
          priority: data.priority,
          complaint: data.complaint,
          request_time: data.request_time,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setRequests(prev => [newRequest, ...prev])
        
        // Show notification
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('health-check-notification', {
            detail: {
              type: 'info',
              title: 'New Health Check Request',
              message: `A new health check request has been submitted: ${data.complaint}`
            }
          }))
        }
      }
      
      if (data.event === 'request_status_changed') {
        // Handle request status change
        setRequests(prev => prev.map(req => 
          req.id === data.request_id 
            ? { ...req, status: data.new_status, updated_at: data.updated_at }
            : req
        ))
        
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

    return () => {
      try {
        socket.off('health_check_event')
        socket.disconnect()
      } catch {}
      socketRef.current = null
    }
  }, [email])

  // Fetch health check requests
  const fetchRequests = useCallback(async (userId: number, status?: string) => {
    try {
      const params = new URLSearchParams({ user_id: userId.toString() })
      if (status) params.append('status', status)
      
      const res = await fetch(`/api/health-check?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch requests')
      
      const data = await res.json()
      if (data.success) {
        setRequests(data.requests)
      }
    } catch (error) {
      console.error('Error fetching health check requests:', error)
    }
  }, [])

  // Fetch health check records
  const fetchRecords = useCallback(async (userId: number, limit = 50, offset = 0) => {
    try {
      const params = new URLSearchParams({
        user_id: userId.toString(),
        limit: limit.toString(),
        offset: offset.toString()
      })
      
      const res = await fetch(`/api/health-check/records?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch records')
      
      const data = await res.json()
      if (data.success) {
        setRecords(data.records)
      }
    } catch (error) {
      console.error('Error fetching health check records:', error)
    }
  }, [])

  // Fetch nurse availability
  const fetchAvailability = useCallback(async (nurseId?: number, dayOfWeek?: number) => {
    setIsLoadingAvailability(true)
    try {
      const params = new URLSearchParams()
      if (nurseId) params.append('nurse_id', nurseId.toString())
      if (dayOfWeek !== undefined) params.append('day_of_week', dayOfWeek.toString())
      
      const res = await fetch(`/api/health-check/availability?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch availability')
      
      const data = await res.json()
      if (data.success) {
        setAvailability(data.availability)
      }
    } catch (error) {
      console.error('Error fetching nurse availability:', error)
    } finally {
      setIsLoadingAvailability(false)
    }
  }, [])

  // Create health check request
  const createRequest = useCallback(async (requestData: {
    user_id: number
    complaint: string
    symptoms?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  }) => {
    try {
      const res = await fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      
      if (!res.ok) throw new Error('Failed to create request')
      
      const data = await res.json()
      if (data.success) {
        // Add to local state
        setRequests(prev => [data.request, ...prev])
        return data.request
      }
    } catch (error) {
      console.error('Error creating health check request:', error)
      throw error
    }
  }, [])

  // Check if nurse is currently on duty - FIXED: Proper timezone handling
  const isNurseOnDuty = useCallback((nurseId: number = 1) => {
    // Don't check duty status if still loading or no availability data
    if (isLoadingAvailability || availability.length === 0) {
      return null // Return null to indicate loading/unknown status
    }
    
    // Get current time in Philippines timezone (Asia/Manila)
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const dayOfWeek = nowPH.getDay()
    const currentTime = nowPH.toTimeString().slice(0, 5) // HH:MM format in PH timezone
    
    const nurseSchedule = availability.find(avail => 
      avail.nurse_id === nurseId && avail.day_of_week === dayOfWeek
    )
    
    if (!nurseSchedule || !nurseSchedule.is_available) return false
    
    const { shift_start, shift_end, break_start, break_end } = nurseSchedule
    
    // Convert database time strings to comparable format
    const formatTimeForComparison = (timeStr: string) => {
      // Ensure time is in HH:MM format for comparison
      return timeStr.length === 8 ? timeStr.slice(0, 5) : timeStr
    }
    
    const shiftStart = formatTimeForComparison(shift_start)
    const shiftEnd = formatTimeForComparison(shift_end)
    
    // Check if current time is within shift hours
    const isWithinShift = currentTime >= shiftStart && currentTime <= shiftEnd
    
    if (!isWithinShift) return false
    
    // Check if nurse is on break
    if (break_start && break_end) {
      const breakStart = formatTimeForComparison(break_start)
      const breakEnd = formatTimeForComparison(break_end)
      const isOnBreak = currentTime >= breakStart && currentTime <= breakEnd
      if (isOnBreak) return { onDuty: true, onBreak: true }
    }
    
    return { onDuty: true, onBreak: false }
  }, [availability, isLoadingAvailability])

  return {
    socket: socketRef.current,
    isConnected,
    requests,
    records,
    notifications,
    availability,
    isLoadingAvailability,
    fetchRequests,
    fetchRecords,
    fetchAvailability,
    createRequest,
    isNurseOnDuty
  }
}
