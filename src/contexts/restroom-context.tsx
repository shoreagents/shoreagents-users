"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useSocket } from './socket-context'
import { parseShiftTime } from '@/lib/shift-utils'

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
  resetRestroomOnShiftEnd: () => Promise<void>
  forceResetRestroom: () => Promise<void>
  isShiftEnded: boolean
}

const RestroomContext = createContext<RestroomContextType | undefined>(undefined)

export function RestroomProvider({ children }: { children: React.ReactNode }) {
  const [restroomStatus, setRestroomStatus] = useState<RestroomStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isShiftEnded, setIsShiftEnded] = useState(false)
  
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
      
      // Immediately check if shift has ended when we fetch restroom status
      if (data.is_in_restroom) {
        setTimeout(async () => {
          try {
            const user = getCurrentUser()
            if (user?.email) {
              // Fetch user profile from API to get shift information
              const response = await fetch(`/api/profile/?email=${encodeURIComponent(user.email)}`, {
                credentials: 'include'
              })
              
              if (response.ok) {
                const profileData = await response.json()
                
                if (profileData.success && profileData.profile) {
                  const userProfile = profileData.profile
                  
                  if (userProfile.shift_time) {
                    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
                    const shiftParsed = parseShiftTime(userProfile.shift_time, nowPH)
                    
                    if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
                      await updateRestroomStatus(false)
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error in immediate shift end check:', error)
          }
        }, 1000) // 1 second delay
      }
    } catch (err) {
      console.error('Error fetching restroom status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch restroom status')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Reset restroom status when shift ends
  const resetRestroomOnShiftEnd = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    // Only reset if currently in restroom
    if (!isInRestroom) return

    try {
      // Update restroom status to false
      await updateRestroomStatus(false)
      
      // Refresh the restroom status to get the updated value
      setTimeout(() => {
        fetchRestroomStatus()
      }, 1000)
    } catch (err) {
      console.error('Error resetting restroom status on shift end:', err)
    }
  }, [isInRestroom, updateRestroomStatus, fetchRestroomStatus])

  // Check if shift has ended and reset restroom status if needed
  const checkShiftEndAndReset = useCallback(async () => {
    if (!isInRestroom) return

    try {
      const user = getCurrentUser()
      if (!user?.email) return

      // Fetch user profile from API to get shift information
      const response = await fetch(`/api/profile/?email=${encodeURIComponent(user.email)}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const profileData = await response.json()
        
        if (profileData.success && profileData.profile) {
          const userProfile = profileData.profile
          
          if (userProfile.shift_time) {
            const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
            const shiftParsed = parseShiftTime(userProfile.shift_time, nowPH)
            
            if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
              await resetRestroomOnShiftEnd()
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking shift end for restroom reset:', error)
    }
  }, [isInRestroom, resetRestroomOnShiftEnd])

  // Force reset restroom status (for manual use)
  const forceResetRestroom = useCallback(async () => {
    const user = getCurrentUser()
    if (!user?.email) return

    try {
      await updateRestroomStatus(false)
    } catch (err) {
      console.error('Error force resetting restroom status:', err)
    }
  }, [updateRestroomStatus])

  // Check if shift has ended
  const checkShiftEndStatus = useCallback(async () => {
    try {
      const user = getCurrentUser()
      if (!user?.email) return false

      // Fetch user profile from API to get shift information
      const response = await fetch(`/api/profile/?email=${encodeURIComponent(user.email)}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const profileData = await response.json()
        
        if (profileData.success && profileData.profile) {
          const userProfile = profileData.profile
          
          if (userProfile.shift_time) {
            const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
            const shiftParsed = parseShiftTime(userProfile.shift_time, nowPH)
            
            const shiftHasEnded = !!(shiftParsed?.endTime && nowPH > shiftParsed.endTime)
            setIsShiftEnded(shiftHasEnded)
            return shiftHasEnded
          }
        }
      }
    } catch (error) {
      console.error('Error checking shift end status:', error)
    }
    return false
  }, [])

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
      checkShiftEndStatus()
    }
  }, [fetchRestroomStatus, checkShiftEndStatus])

  // Check shift end status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkShiftEndStatus()
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [checkShiftEndStatus])

  // Expose functions globally for debugging/manual use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).forceResetRestroom = forceResetRestroom
      
    }
  }, [forceResetRestroom])

  // Check for shift end immediately when restroom status is loaded
  useEffect(() => {
    if (!restroomStatus || !isInRestroom) return

    const checkShiftEndOnLoad = async () => {
      try {
        const user = getCurrentUser()
        if (!user?.email) return

        // Fetch user profile from API to get shift information
        const response = await fetch(`/api/profile/?email=${encodeURIComponent(user.email)}`, {
          credentials: 'include'
        })
        
        if (response.ok) {
          const profileData = await response.json()
          
          if (profileData.success && profileData.profile) {
            const userProfile = profileData.profile
            
            if (userProfile.shift_time) {
              const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
              const shiftParsed = parseShiftTime(userProfile.shift_time, nowPH)
              
              if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
                await updateRestroomStatus(false)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking shift end on restroom status load:', error)
      }
    }

    // Run check after a short delay to ensure restroom status is fully loaded
    const timeoutId = setTimeout(checkShiftEndOnLoad, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [restroomStatus, isInRestroom, updateRestroomStatus])

  // Periodic check for shift end to automatically reset restroom status
  useEffect(() => {
    if (!isInRestroom) return

    // Check immediately when component mounts and user is in restroom
    const checkImmediately = async () => {
      try {
        await checkShiftEndAndReset()
      } catch (error) {
        console.error('Error in immediate shift end check:', error)
      }
    }

    // Run check immediately
    checkImmediately()

    // Then check every 30 seconds for more responsive detection
    const interval = setInterval(async () => {
      try {
        await checkShiftEndAndReset()
      } catch (error) {
        console.error('Error in periodic shift end check:', error)
      }
    }, 30000) // Check every 30 seconds for faster response

    return () => clearInterval(interval)
  }, [isInRestroom, checkShiftEndAndReset])

  // Also listen for shift end events from other parts of the app
  useEffect(() => {
    const handleShiftEnd = () => {
      if (isInRestroom) {
        resetRestroomOnShiftEnd()
      }
    }

    // Listen for custom shift end events
    window.addEventListener('shift-ended', handleShiftEnd)
    
    return () => {
      window.removeEventListener('shift-ended', handleShiftEnd)
    }
  }, [isInRestroom, resetRestroomOnShiftEnd])

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
    resetRestroomOnShiftEnd,
    forceResetRestroom,
    isShiftEnded,
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
