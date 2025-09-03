"use client"

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrentUser } from '@/lib/auth-utils'

export interface TeamAgent {
  id: number
  email: string
  name: string
  avatar?: string
  member_id: number
  team_name: string
}

export interface TeamInfo {
  member_id: number
  company: string
  badge_color?: string
}

export interface TeamAgentsResponse {
  success: boolean
  agents: TeamAgent[]
  team: TeamInfo
}

export interface UserAuthData {
  id: string
  email: string
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
  email_confirmed_at: string | null
  invited_at: string | null
  confirmation_sent_at: string | null
  is_authenticated: boolean
  auth_source?: string
}

// Hook to fetch team agents
export function useTeamAgents() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const queryClient = useQueryClient()
  const lastUpdateRef = useRef<number>(0)
  
  // Only get user on client side to avoid hydration issues
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  const query = useQuery({
    queryKey: ['team-agents', currentUser?.email || 'loading'],
    queryFn: async (): Promise<TeamAgentsResponse> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch('/api/agents/team', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch team agents: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes - team data changes less frequently
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in cache for 15 min
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Function to trigger real-time update with cache bypass
  const triggerRealtimeUpdate = async () => {
    if (!currentUser?.email) return
    
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current
    
    // Prevent updates more frequent than every 2 seconds
    if (timeSinceLastUpdate < 2000) {
      console.log('⏳ Team agents update throttled (too frequent)')
      return
    }
    
    // Check if we're already fetching to prevent spam
    if (query.isFetching) {
      console.log('⏳ Team agents update already in progress, skipping...')
      return
    }
    
    lastUpdateRef.current = now
    
    try {
      // Fetch fresh data with cache bypass
      const response = await fetch('/api/agents/team?bypass_cache=true', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const freshData = await response.json()
        
        // Update the cache with fresh data (no loading state)
        queryClient.setQueryData(['team-agents', currentUser.email], freshData)
        console.log('✅ Team agents cache updated successfully')
      }
    } catch (error) {
      console.error('Error fetching fresh team agents data:', error)
    }
  }

  // Show loading state when client is not ready or user is not loaded yet
  return {
    ...query,
    isLoading: query.isLoading || !isClient || !currentUser?.email,
    triggerRealtimeUpdate
  }
}

// Hook to fetch user authentication data for a specific email
export function useUserAuthData(email: string) {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  return useQuery({
    queryKey: ['user-auth-data', email],
    queryFn: async (): Promise<UserAuthData> => {
      const response = await fetch(`/api/users/auth-status/${encodeURIComponent(email)}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch auth data: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.data
    },
    enabled: isClient && !!email,
    staleTime: 10 * 60 * 1000, // 10 minutes - auth data changes less frequently
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for 30 min
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// Hook to fetch authentication data for multiple team members
export function useTeamAuthData(agents: TeamAgent[]) {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  return useQuery({
    queryKey: ['team-auth-data', agents.map(a => a.email).join(',')],
    queryFn: async (): Promise<Map<string, UserAuthData>> => {
      const authDataMap = new Map<string, UserAuthData>()
      
      // Fetch auth data for all agents in parallel
      const promises = agents.map(async (agent) => {
        try {
          const response = await fetch(`/api/users/auth-status/${encodeURIComponent(agent.email)}`, {
            credentials: 'include',
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data) {
              authDataMap.set(agent.email, data.data)
            }
          }
        } catch (error) {
          console.warn(`Error fetching auth data for ${agent.email}:`, error)
        }
      })
      
      await Promise.all(promises)
      return authDataMap
    },
    enabled: isClient && agents.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
