"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useSocket } from './socket-context'

interface RestroomStatus {
  id: number | null
  agent_user_id: number
  is_in_restroom: boolean
  restroom_count: number
  daily_restroom_count: number
  last_daily_reset: string | null
  created_at: string | null
  updated_at: string | null
}

interface RestroomContextType {
  isInRestroom: boolean
  restroomCount: number
  dailyRestroomCount: number
  restroomStatus: RestroomStatus | null
  isLoading: boolean
  isUpdating: boolean
  error: string | null
  updateRestroomStatus: (isInRestroom: boolean) => Promise<void>
  fetchRestroomStatus: () => Promise<void>
  refreshStatus: () => Promise<void>
}

const RestroomContext = createContext<RestroomContextType | undefined>(undefined)

export function RestroomProvider({ children }: { children: React.ReactNode }) {
  const [restroomStatus, setRestroomStatus] = useState<RestroomStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Socket context for real-time updates
  const { socket, isConnected } = useSocket()

  // Derived state
  const isInRestroom = restroomStatus?.is_in_restroom || false
  const restroomCount = restroomStatus?.restroom_count || 0
  const dailyRestroomCount = restroomStatus?.daily_restroom_count || 0

  // Fetch restroom status from API
  const fetchRestroomStatus = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/restroom/')
      
      if (!response.ok) {
        throw new Error('Failed to fetch restroom status')
      }
      
      const data = await response.json()
      setRestroomStatus(data)
    } catch (err) {
      console.error('Error fetching restroom status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch restroom status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Emit restroom status immediately when updating (for faster real-time updates)
  const emitRestroomStatus = useCallback((isInRestroom: boolean) => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit immediately for faster updates
    socket.emit('updateRestroomStatus', isInRestroom)
  }, [socket, isConnected])

  // Update restroom status with optimistic updates
  const updateRestroomStatus = useCallback(async (isInRestroom: boolean) => {
    const user = getCurrentUser()
    if (!user?.email) return

    setError(null)
    setIsUpdating(true)

    // Optimistic update - only update the status, not the counts
    setRestroomStatus(prev => {
      if (!prev) return prev
      
      return {
        ...prev,
        is_in_restroom: isInRestroom,
        updated_at: new Date().toISOString()
      }
    })

    // Emit socket update immediately for faster real-time updates
    emitRestroomStatus(isInRestroom)

    try {
      const response = await fetch('/api/restroom/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_in_restroom: isInRestroom,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update restroom status')
      }
      
      const data = await response.json()
      // Update with actual server response
      setRestroomStatus(data)
    } catch (err) {
      console.error('Error updating restroom status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update restroom status')
      
      // Revert optimistic update on error
      setRestroomStatus(prev => {
        if (!prev) return prev
        
        return {
          ...prev,
          is_in_restroom: !isInRestroom,
        }
      })
    } finally {
      setIsUpdating(false)
    }
  }, [emitRestroomStatus])

  // Refresh status (alias for fetchRestroomStatus)
  const refreshStatus = useCallback(async () => {
    await fetchRestroomStatus()
  }, [fetchRestroomStatus])

  // Emit restroom status updates when status changes
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit current restroom status immediately
    socket.emit('updateRestroomStatus', isInRestroom)
  }, [socket, isConnected, isInRestroom])

  // Initialize on mount
  useEffect(() => {
    const user = getCurrentUser()
    if (user?.email) {
      fetchRestroomStatus()
    }
  }, [fetchRestroomStatus])

  const value = {
    isInRestroom,
    restroomCount,
    dailyRestroomCount,
    restroomStatus,
    isLoading,
    isUpdating,
    error,
    updateRestroomStatus,
    fetchRestroomStatus,
    refreshStatus,
  }

  return (
    <RestroomContext.Provider value={value}>
      {children}
    </RestroomContext.Provider>
  )
}

export function useRestroom() {
  const context = useContext(RestroomContext)
  if (context === undefined) {
    throw new Error('useRestroom must be used within a RestroomProvider')
  }
  return context
}
