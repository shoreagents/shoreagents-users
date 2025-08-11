"use client"

import { useState, useEffect, useRef } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { 
  parseShiftTime, 
  getTimeUntilReset, 
  formatTimeUntilReset, 
  getResetTypeDescription,
  type ShiftInfo 
} from '@/lib/shift-utils'

interface ShiftResetData {
  timeUntilReset: number
  timeUntilResetFormatted: string
  resetType: string
  shiftInfo: ShiftInfo | null
  isLoading: boolean
  error: string | null
}

export function useShiftResetTimer(): ShiftResetData {
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null)
  const [timeUntilReset, setTimeUntilReset] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch user shift information
  useEffect(() => {
    const fetchShiftInfo = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const currentUser = getCurrentUser()
        if (!currentUser?.email) {
          setError('No user email found')
          return
        }

        // Fetch user profile to get shift information
        const response = await fetch(`/api/profile?email=${encodeURIComponent(currentUser.email)}`)
        if (!response.ok) {
          throw new Error('Failed to fetch profile')
        }

        const profileData = await response.json()
        if (!profileData.success) {
          throw new Error(profileData.error || 'Failed to load profile')
        }

        const profile = profileData.profile
        if (profile.shift_time) {
          const parsedShiftInfo = parseShiftTime(profile.shift_time)
          setShiftInfo(parsedShiftInfo)
          console.log(`🕐 Loaded shift info: ${profile.shift_period} (${profile.shift_time})`)
        } else {
          setShiftInfo(null)
          console.log('⏰ No shift info found, using daily reset at midnight')
        }
      } catch (err) {
        console.error('Error fetching shift info:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setShiftInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchShiftInfo()
  }, [])

  // Update countdown timer every second
  useEffect(() => {
    const updateTimer = () => {
      const currentTime = new Date()
      const timeUntil = getTimeUntilReset(currentTime, shiftInfo)
      setTimeUntilReset(timeUntil)
    }

    // Initial update
    updateTimer()

    // Set up interval to update every second
    timerRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [shiftInfo])

  const timeUntilResetFormatted = formatTimeUntilReset(timeUntilReset)
  const resetType = getResetTypeDescription(shiftInfo)

  return {
    timeUntilReset,
    timeUntilResetFormatted,
    resetType,
    shiftInfo,
    isLoading,
    error
  }
}