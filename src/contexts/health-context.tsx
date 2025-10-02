"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useHealthCheckSocketContext } from '@/hooks/use-health-check-socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useSocket } from './socket-context'
import { parseShiftTime } from '@/lib/shift-utils'
import { useProfileContext } from './profile-context'

interface HealthContextType {
  isGoingToClinic: boolean
  isInClinic: boolean
  currentHealthRequest: any | null
  setGoingToClinic: (going: boolean) => void
  setInClinic: (inClinic: boolean) => void
  setCurrentHealthRequest: (request: any | null) => void
  handleGoingToClinic: () => Promise<void>
  handleBackToStation: () => Promise<void>
  
  // Shift end detection
  isShiftEnded: boolean
  cancelHealthRequestOnShiftEnd: () => Promise<void>
  forceCancelHealthRequest: () => Promise<void>
}

const HealthContext = createContext<HealthContextType | undefined>(undefined)

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfileContext()
  const [isGoingToClinic, setIsGoingToClinic] = useState(false)
  const [isInClinic, setIsInClinic] = useState(false)
  const [currentHealthRequest, setCurrentHealthRequest] = useState<any | null>(null)
  const [isShiftEnded, setIsShiftEnded] = useState(false)
  const [isCancellingRequest, setIsCancellingRequest] = useState(false)
  const lastCancelAttemptRef = useRef<number>(0)
  
  const { userRequests, cancelRequest, updateDone } = useHealthCheckSocketContext(getCurrentUser()?.email || null)
  
  // Socket context for real-time updates
  const { socket, isConnected } = useSocket()

  // Listen for real-time updates from user requests
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser?.id) return
    
    // Find the most recent active request for this user
    // Priority: approved requests > completed requests that are not done > pending requests
    const approvedRequests = userRequests.filter(req => 
      req.user_id === currentUser.id && req.status === 'approved'
    )
    
    const completedRequests = userRequests.filter(req => 
      req.user_id === currentUser.id && req.status === 'completed' && !req.done
    )
    
    const pendingRequests = userRequests.filter(req => 
      req.user_id === currentUser.id && req.status === 'pending'
    )
    
    // Get the most recent request from all categories
    const allActiveRequests = [...approvedRequests, ...completedRequests, ...pendingRequests]
    const approvedRequest = allActiveRequests.length > 0 
      ? allActiveRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null


    if (approvedRequest) {
      setCurrentHealthRequest(approvedRequest)
      
      // If status is completed, check if agent has clicked Done
      if (approvedRequest.status === 'completed') {
        if (approvedRequest.done) {
          setIsGoingToClinic(false)
          setIsInClinic(false)
          return
        }
        
        // If done=false, maintain health states to show Done button and pause timer
        // Set states based on database values to pause timer until agent clicks Done
        const inClinic = approvedRequest.in_clinic || false
        const goingToClinic = approvedRequest.going_to_clinic || false
        
        // Priority logic: In Clinic takes precedence over Going to Clinic
        if (inClinic) {
          setIsGoingToClinic(false)
          setIsInClinic(true)
        } else {
          setIsGoingToClinic(goingToClinic)
          setIsInClinic(false)
        }
        return
      }
      
      // Priority logic: In Clinic takes precedence over Going to Clinic
      const inClinic = approvedRequest.in_clinic || false
      const goingToClinic = approvedRequest.going_to_clinic || false
      const done = approvedRequest.done || false
      
      // If done=true, reset all health states (agent clicked Done)
      if (done) {
        setIsGoingToClinic(false)
        setIsInClinic(false)
        return
      }
      
      // If in clinic, don't show going to clinic
      if (inClinic) {
        setIsGoingToClinic(false)
        setIsInClinic(true)
      } else {
        // Only show going to clinic if not in clinic
        setIsGoingToClinic(goingToClinic)
        setIsInClinic(false)
      }
    } else {
      // No approved request, reset states
      setCurrentHealthRequest(null)
      setIsGoingToClinic(false)
      setIsInClinic(false)
    }
  }, [userRequests])

  // Handle going to clinic - activity tracking is handled automatically by ActivityProvider
  const handleGoingToClinic = useCallback(async () => {
    try {
      setIsGoingToClinic(true)
    } catch (error) {
      console.error('Error setting going to clinic status:', error)
    }
  }, [])

  // Handle back to station - activity tracking is handled automatically by ActivityProvider
  const handleBackToStation = useCallback(async () => {
    try {
      // Reset states when user explicitly clicks Done button
      setIsGoingToClinic(false)
      setIsInClinic(false)
      // Don't immediately reset currentHealthRequest - let the real-time update handle it
      // setCurrentHealthRequest(null)
    } catch (error) {
      console.error('Error setting back to station status:', error)
    }
  }, [])

  // Set going to clinic status
  const setGoingToClinic = useCallback((going: boolean) => {
    setIsGoingToClinic(going)
  }, [])

  // Set in clinic status
  const setInClinic = useCallback((inClinic: boolean) => {
    setIsInClinic(inClinic)
  }, [])

  // Check if shift has ended
  const checkShiftEndStatus = useCallback(async () => {
    try {
      if (!profile?.shift_time) return false

      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      const shiftParsed = parseShiftTime(profile.shift_time, nowPH)
      
      const shiftHasEnded = !!(shiftParsed?.endTime && nowPH > shiftParsed.endTime)
      setIsShiftEnded(shiftHasEnded)
      return shiftHasEnded
    } catch (error) {
      console.error('Error checking shift end status:', error)
    }
    return false
  }, [profile?.shift_time])

  // Cancel health request when shift ends
  const cancelHealthRequestOnShiftEnd = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    // Only cancel if there's a current health request and not already cancelling
    if (!currentHealthRequest || isCancellingRequest) return

    // Additional safety check: verify this is still the current user's active request
    const currentUser = getCurrentUser()
    if (!currentUser?.id || currentHealthRequest.user_id !== currentUser.id) {
      return
    }

    // CRITICAL: Verify this request is still active in the current user requests
    const isStillActive = userRequests.some(req => 
      req.id === currentHealthRequest.id && 
      req.user_id === currentUser.id && 
      (req.status === 'approved' || (req.status === 'completed' && !req.done) || req.status === 'pending')
    )

    if (!isStillActive) {
      return
    }

    // Debounce: prevent calls within 5 seconds of each other
    const now = Date.now()
    if (now - lastCancelAttemptRef.current < 5000) {
      return
    }
    lastCancelAttemptRef.current = now

    // Set flag to prevent duplicate attempts
    setIsCancellingRequest(true)

    try {
      // Check if request needs to be cancelled based on status
      if (currentHealthRequest.status === 'pending') {
        // Cancel pending requests
        await cancelRequest(currentHealthRequest.id)
      } else if (currentHealthRequest.status === 'approved' && !currentHealthRequest.going_to_clinic) {
        // Cancel approved requests that didn't go to clinic
        await cancelRequest(currentHealthRequest.id)
      } else if (currentHealthRequest.status === 'completed' && !currentHealthRequest.done) {
        // Mark completed requests as done
        await updateDone(currentHealthRequest.id, true)
      }
    } catch (err) {
      console.error('Error cancelling health request on shift end:', err)
    } finally {
      // Reset flag after attempt
      setIsCancellingRequest(false)
    }
  }, [currentHealthRequest, isCancellingRequest, cancelRequest, updateDone, userRequests])

  // Check if shift has ended and cancel health request if needed
  const checkShiftEndAndCancelRequest = useCallback(async () => {
    if (!currentHealthRequest || isCancellingRequest || !profile?.shift_time) return

    // Additional check: ensure there's actually an active request to cancel
    const currentUser = getCurrentUser()
    if (!currentUser?.id) return

    const hasActiveRequest = userRequests.some(req => 
      req.user_id === currentUser.id && 
      (req.status === 'approved' || (req.status === 'completed' && !req.done) || req.status === 'pending')
    )

    if (!hasActiveRequest) {
      return
    }

    try {
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
      const shiftParsed = parseShiftTime(profile.shift_time, nowPH)
      
      if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
        await cancelHealthRequestOnShiftEnd()
      }
    } catch (error) {
      console.error('Error checking shift end for health request cancellation:', error)
    }
  }, [currentHealthRequest, isCancellingRequest, profile?.shift_time, cancelHealthRequestOnShiftEnd, userRequests])

  // Force cancel health request (for manual use)
  const forceCancelHealthRequest = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    if (!currentHealthRequest || isCancellingRequest) return

    setIsCancellingRequest(true)

    try {
      if (currentHealthRequest.status === 'pending') {
        await cancelRequest(currentHealthRequest.id)
      } else if (currentHealthRequest.status === 'approved' && !currentHealthRequest.going_to_clinic) {
        await cancelRequest(currentHealthRequest.id)
      } else if (currentHealthRequest.status === 'completed' && !currentHealthRequest.done) {
        await updateDone(currentHealthRequest.id, true)
      }
    } catch (err) {
      console.error('Error force cancelling health request:', err)
    } finally {
      setIsCancellingRequest(false)
    }
  }, [currentHealthRequest, isCancellingRequest, cancelRequest, updateDone])

  // Emit health status updates when status changes
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit current health status
    socket.emit('updateHealthStatus', isGoingToClinic, isInClinic, currentHealthRequest)
  }, [socket, isConnected, isGoingToClinic, isInClinic, currentHealthRequest])

  // Initialize shift end check on mount
  useEffect(() => {
    const user = getCurrentUser()
    if (user?.email) {
      checkShiftEndStatus()
    }
  }, [checkShiftEndStatus])

  // Check shift end status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkShiftEndStatus()
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [checkShiftEndStatus])

  // Check for shift end immediately when health request is loaded
  useEffect(() => {
    if (!currentHealthRequest || isCancellingRequest) return

    const checkShiftEndOnLoad = async () => {
      try {
        await checkShiftEndAndCancelRequest()
      } catch (error) {
        console.error('Error in immediate shift end check for health request:', error)
      }
    }

    // Run check after a short delay to ensure health request status is fully loaded
    const timeoutId = setTimeout(checkShiftEndOnLoad, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [currentHealthRequest, isCancellingRequest, checkShiftEndAndCancelRequest])

  // Periodic check for shift end to automatically cancel health request
  useEffect(() => {
    if (!currentHealthRequest || isCancellingRequest) return

    // Check immediately when component mounts and user has health request
    const checkImmediately = async () => {
      try {
        await checkShiftEndAndCancelRequest()
      } catch (error) {
        console.error('Error in immediate shift end check for health request:', error)
      }
    }

    // Run check immediately
    checkImmediately()

    // Then check every 30 seconds for more responsive detection
    const interval = setInterval(async () => {
      try {
        await checkShiftEndAndCancelRequest()
      } catch (error) {
        console.error('Error in periodic shift end check for health request:', error)
      }
    }, 30000) // Check every 30 seconds for faster response

    return () => clearInterval(interval)
  }, [currentHealthRequest, isCancellingRequest, checkShiftEndAndCancelRequest])

  // Also listen for shift end events from other parts of the app
  useEffect(() => {
    const handleShiftEnd = () => {
      if (currentHealthRequest && !isCancellingRequest) {
        cancelHealthRequestOnShiftEnd()
      }
    }

    // Listen for custom shift end events
    window.addEventListener('shift-ended', handleShiftEnd)
    
    return () => {
      window.removeEventListener('shift-ended', handleShiftEnd)
    }
  }, [currentHealthRequest, isCancellingRequest, cancelHealthRequestOnShiftEnd])

  // Expose functions globally for debugging/manual use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).forceCancelHealthRequest = forceCancelHealthRequest
    }
  }, [forceCancelHealthRequest])

  const value = {
    isGoingToClinic,
    isInClinic,
    currentHealthRequest,
    setGoingToClinic,
    setInClinic,
    setCurrentHealthRequest,
    handleGoingToClinic,
    handleBackToStation,
    isShiftEnded,
    cancelHealthRequestOnShiftEnd,
    forceCancelHealthRequest
  }

  return (
    <HealthContext.Provider value={value}>
      {children}
    </HealthContext.Provider>
  )
}

export function useHealth() {
  const context = useContext(HealthContext)
  if (context === undefined) {
    throw new Error('useHealth must be used within a HealthProvider')
  }
  return context
}
