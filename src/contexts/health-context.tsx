"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useHealthCheckSocketContext } from '@/hooks/use-health-check-socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useSocket } from './socket-context'

interface HealthContextType {
  isGoingToClinic: boolean
  isInClinic: boolean
  currentHealthRequest: any | null
  setGoingToClinic: (going: boolean) => void
  setInClinic: (inClinic: boolean) => void
  setCurrentHealthRequest: (request: any | null) => void
  handleGoingToClinic: () => Promise<void>
  handleBackToStation: () => Promise<void>
}

const HealthContext = createContext<HealthContextType | undefined>(undefined)

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [isGoingToClinic, setIsGoingToClinic] = useState(false)
  const [isInClinic, setIsInClinic] = useState(false)
  const [currentHealthRequest, setCurrentHealthRequest] = useState<any | null>(null)
  const { userRequests } = useHealthCheckSocketContext(getCurrentUser()?.email || null)
  
  // Socket context for real-time updates
  const { socket, isConnected } = useSocket()

  // Listen for real-time updates from user requests
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser?.id) return
    
    // Find the current approved or completed request for this user
    const approvedRequest = userRequests.find(req => 
      req.user_id === currentUser.id && (req.status === 'approved' || req.status === 'completed')
    )

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

  // Emit health status updates when status changes
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit current health status
    socket.emit('updateHealthStatus', isGoingToClinic, isInClinic, currentHealthRequest)
  }, [socket, isConnected, isGoingToClinic, isInClinic, currentHealthRequest])


  const value = {
    isGoingToClinic,
    isInClinic,
    currentHealthRequest,
    setGoingToClinic,
    setInClinic,
    setCurrentHealthRequest,
    handleGoingToClinic,
    handleBackToStation
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
