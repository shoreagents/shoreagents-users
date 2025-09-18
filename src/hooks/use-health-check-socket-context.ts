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
  going_to_clinic?: boolean
  in_clinic?: boolean
  done?: boolean
  going_to_clinic_at?: string
  in_clinic_at?: string
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
          
          // Validate that updatedRequest exists and has required properties
          if (!updatedRequest || !updatedRequest.id) {
            console.error('Invalid request status change data:', data)
            return
          }
          
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
        } else if (data.type === 'request_updated') {
          // Handle health check request field updates (going_to_clinic, in_clinic, done)
          const updatedRequest = data.request
          
          // Validate that updatedRequest exists and has required properties
          if (!updatedRequest || !updatedRequest.id) {
            console.error('Invalid request update data:', data)
            return
          }
          
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
      
      if (data.event === 'request_status_changed') {
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
          return updated
        })
        setUserRequests(prev => {
          const updated = prev.map(req => 
            req.id === data.request_id 
              ? { ...req, status: data.new_status, updated_at: data.updated_at }
              : req
          )
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
        } else if (data.event === 'request_updated') {
        // Handle health check request field updates (going_to_clinic, in_clinic, done)
        // The socket sends data directly, not nested in a 'request' object
        const requestId = data.request_id
        
        // Validate that requestId exists
        if (!requestId) {
          console.error('Invalid request update data - missing request_id:', data)
          return
        }
        
        // Optimized update function to avoid duplicate processing
        const updateRequest = (prev: HealthCheckRequest[]) => {
          return prev.map(r => {
            if (r.id === requestId) {
              const updated = { ...r }
              if (data.going_to_clinic !== undefined) updated.going_to_clinic = data.going_to_clinic
              if (data.in_clinic !== undefined) updated.in_clinic = data.in_clinic
              if (data.done !== undefined) updated.done = data.done
              if (data.going_to_clinic_at !== undefined) updated.going_to_clinic_at = data.going_to_clinic_at
              if (data.in_clinic_at !== undefined) updated.in_clinic_at = data.in_clinic_at
              if (data.updated_at) updated.updated_at = data.updated_at
              
              return updated
            }
            return r
          })
        }
        
        // Update both state arrays efficiently
        setRequests(updateRequest)
        setUserRequests(updateRequest)
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
      
      if (!response.ok) {
        console.error('API request failed:', response.status, response.statusText)
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        setUserRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Error fetching user requests:', error)
    } finally {
      setIsLoadingRequests(false)
    }
  }, [])

  // Initialize user requests when email is available
  useEffect(() => {
    if (!email) return

    const initializeUserRequests = async () => {
      try {
        // Get current user from localStorage (same as other parts of the app)
        const authData = localStorage.getItem("shoreagents-auth")
        if (authData) {
          const userData = JSON.parse(authData)
          
          // Use railway_id for database operations (numeric ID)
          let userId = userData.user?.id
          if (userData.hybrid && userData.user?.railway_id) {
            userId = userData.user.railway_id
          }
          
          if (userId && !isNaN(Number(userId))) {
            await fetchUserRequests(Number(userId))
          } else {
            console.error('Invalid user ID for health check requests:', userId)
          }
        }
      } catch (error) {
        console.error('Error initializing user requests:', error)
      }
    }

    initializeUserRequests()
  }, [email, fetchUserRequests])

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
    return hasPending
  }, [userRequests])

  // Update going to clinic status
  const updateGoingToClinic = useCallback(async (requestId: number, goingToClinic: boolean) => {
    try {
      const response = await fetch('/api/health-check/going-to-clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, going_to_clinic: goingToClinic })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, going_to_clinic: goingToClinic, updated_at: data.updated_at }
              : req
          )
        )
        setUserRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, going_to_clinic: goingToClinic, updated_at: data.updated_at }
              : req
          )
        )
        
        return data.request
      } else {
        throw new Error(data.error || 'Failed to update going to clinic status')
      }
    } catch (error) {
      console.error('Error updating going to clinic status:', error)
      throw error
    }
  }, [])

  // Update in clinic status with optimistic updates
  const updateInClinic = useCallback(async (requestId: number, inClinic: boolean) => {
    const now = new Date().toISOString()
    
    // Optimistic update - update local state immediately
    setRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, in_clinic: inClinic, updated_at: now }
          : req
      )
    )
    setUserRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, in_clinic: inClinic, updated_at: now }
          : req
      )
    )
    
    try {
      const response = await fetch('/api/health-check/in-clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, in_clinic: inClinic })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update with server timestamp if different
        if (data.updated_at !== now) {
          setRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { ...req, in_clinic: inClinic, updated_at: data.updated_at }
                : req
            )
          )
          setUserRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { ...req, in_clinic: inClinic, updated_at: data.updated_at }
                : req
            )
          )
        }
        
        return data.request
      } else {
        // Revert optimistic update on failure
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, in_clinic: !inClinic, updated_at: now }
              : req
          )
        )
        setUserRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, in_clinic: !inClinic, updated_at: now }
              : req
          )
        )
        throw new Error(data.error || 'Failed to update in clinic status')
      }
    } catch (error) {
      // Revert optimistic update on error
      setRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, in_clinic: !inClinic, updated_at: now }
            : req
        )
      )
      setUserRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, in_clinic: !inClinic, updated_at: now }
            : req
        )
      )
      console.error('Error updating in clinic status:', error)
      throw error
    }
  }, [])

  // Update done status with optimistic updates
  const updateDone = useCallback(async (requestId: number, done: boolean) => {
    const now = new Date().toISOString()
    
    // Optimistic update - update local state immediately
    setRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, done: done, updated_at: now }
          : req
      )
    )
    setUserRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, done: done, updated_at: now }
          : req
      )
    )
    
    try {
      const response = await fetch('/api/health-check/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, done: done })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update with server timestamp if different
        if (data.updated_at !== now) {
          setRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { ...req, done: done, updated_at: data.updated_at }
                : req
            )
          )
          setUserRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { ...req, done: done, updated_at: data.updated_at }
                : req
            )
          )
        }
        
        return data.request
      } else {
        // Revert optimistic update on failure
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, done: !done, updated_at: now }
              : req
          )
        )
        setUserRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, done: !done, updated_at: now }
              : req
          )
        )
        throw new Error(data.error || 'Failed to update done status')
      }
    } catch (error) {
      // Revert optimistic update on error
      setRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, done: !done, updated_at: now }
            : req
        )
      )
      setUserRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, done: !done, updated_at: now }
            : req
        )
      )
      console.error('Error updating done status:', error)
      throw error
    }
  }, [])

  // Cancel health check request
  const cancelRequest = useCallback(async (requestId: number) => {
    try {
      const response = await fetch('/api/health-check/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'cancelled', updated_at: data.request.updated_at }
              : req
          )
        )
        setUserRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'cancelled', updated_at: data.request.updated_at }
              : req
          )
        )
        
        return data.request
      } else {
        throw new Error(data.error || 'Failed to cancel request')
      }
    } catch (error) {
      console.error('Error canceling health check request:', error)
      throw error
    }
  }, [])

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
    hasPendingRequest,
    updateGoingToClinic,
    updateInClinic,
    updateDone,
    cancelRequest
  }
}
