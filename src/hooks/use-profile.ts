"use client"

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'

// Define the UserProfile interface to match what we expect from the API
export interface UserProfile {
  number: string
  id_number: string
  last_name: string
  first_name: string
  middle_name: string
  gender: string
  phone: string
  email: string
  date_of_birth: string
  position: string
  company: string
  department: string
  start_date: string
  status: string
  nickname?: string
  profile_picture?: string
  city?: string
  address?: string
  user_type?: string
  // Job information from job_info table
  employee_id?: string
  job_title?: string
  shift_period?: string
  shift_schedule?: string
  shift_time?: string
  work_setup?: string
  employment_status?: string
  hire_type?: string
  staff_source?: string
  exit_date?: string
  // Company information from members table
  company_address?: string
  company_phone?: string
  company_logo?: string
  service?: string
  member_status?: string
  badge_color?: string
  country?: string
  website?: string
  // Additional fields
  department_id?: number | null
  exp_points?: number
}

export interface ProfileResponse {
  success: boolean
  profile: UserProfile
  cached?: boolean
  error?: string
}

export function useProfile() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const queryClient = useQueryClient()
  
  // Only get user on client side to avoid hydration issues
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  const profileQuery = useQuery({
    queryKey: ['profile', currentUser?.email || 'loading'],
    queryFn: async (): Promise<ProfileResponse> => {
      if (!currentUser?.email) {
        throw new Error('No user email available')
      }
      
      const apiUrl = `/api/profile/?email=${encodeURIComponent(currentUser.email)}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include authentication cookies for Electron
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 10 * 60 * 1000, // 10 minutes - profile data doesn't change often
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in cache longer
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus - profile data is stable
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Manual refresh function
  const refreshProfile = async () => {
    if (currentUser?.email) {
      // Invalidate and refetch
      await queryClient.invalidateQueries({
        queryKey: ['profile', currentUser.email]
      })
      await queryClient.refetchQueries({
        queryKey: ['profile', currentUser.email]
      })
    }
  }

  // Show loading state when client is not ready or user is not loaded yet
  return {
    ...profileQuery,
    isLoading: profileQuery.isLoading || !isClient || !currentUser?.email,
    profile: profileQuery.data?.profile || null,
    isCached: profileQuery.data?.cached || false,
    error: profileQuery.error?.message || profileQuery.data?.error || null,
    refreshProfile, // Add manual refresh function
  }
}

// Hook for getting profile by user ID (for admin/team views)
export function useProfileById(userId: number) {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({
    queryKey: ['profile', 'by-id', userId],
    queryFn: async (): Promise<ProfileResponse> => {
      const apiUrl = `/api/profile/?userId=${userId}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  })

  // Manual refresh function
  const refreshProfile = async () => {
    // Invalidate and refetch
    await queryClient.invalidateQueries({
      queryKey: ['profile', 'by-id', userId]
    })
    await queryClient.refetchQueries({
      queryKey: ['profile', 'by-id', userId]
    })
  }

  return {
    ...profileQuery,
    profile: profileQuery.data?.profile || null,
    isCached: profileQuery.data?.cached || false,
    error: profileQuery.error?.message || profileQuery.data?.error || null,
    refreshProfile, // Add manual refresh function
  }
}

// Hook for updating profile with automatic cache invalidation
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  const updateProfile = async (updates: Partial<UserProfile>, userId?: number, email?: string) => {
    try {
      const response = await fetch('/api/profile/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email,
          updates
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Invalidate all profile caches to ensure fresh data
        await queryClient.invalidateQueries({
          queryKey: ['profile']
        })
      }

      return result
    } catch (error) {
      console.error('Profile update error:', error)
      throw error
    }
  }

  return { updateProfile }
}

// Utility functions for cache invalidation
export function useProfileCacheInvalidation() {
  const queryClient = useQueryClient()

  const invalidateProfileByEmail = (email: string) => {
    queryClient.invalidateQueries({
      queryKey: ['profile', email]
    })
  }

  const invalidateProfileById = (userId: number) => {
    queryClient.invalidateQueries({
      queryKey: ['profile', 'by-id', userId]
    })
  }

  const invalidateAllProfiles = () => {
    queryClient.invalidateQueries({
      queryKey: ['profile']
    })
  }

  const refetchProfileByEmail = async (email: string) => {
    await queryClient.refetchQueries({
      queryKey: ['profile', email]
    })
  }

  const refetchProfileById = async (userId: number) => {
    await queryClient.refetchQueries({
      queryKey: ['profile', 'by-id', userId]
    })
  }

  return {
    invalidateProfileByEmail,
    invalidateProfileById,
    invalidateAllProfiles,
    refetchProfileByEmail,
    refetchProfileById
  }
}
