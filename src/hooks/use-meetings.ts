"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { toast } from 'sonner'

// Types
export interface Meeting {
  id: number
  agent_user_id: number
  title: string
  description: string
  start_time: string
  end_time: string
  duration_minutes: number
  meeting_type: 'video' | 'audio' | 'in-person'
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  is_in_meeting: boolean // Add this to match the existing interface
}

export interface MeetingStatus {
  isInMeeting: boolean
  activeMeeting: Meeting | null
}

export interface CreateMeetingData {
  title: string
  description?: string
  type: Meeting['meeting_type']
  scheduledTime?: string
}

// Query Keys
export const meetingKeys = {
  all: ['meetings'] as const,
  lists: () => [...meetingKeys.all, 'list'] as const,
  list: (userId: string, days: number, limit?: number, offset?: number) => 
    [...meetingKeys.lists(), userId, days, limit, offset] as const,
  status: (userId: string, days: number) => [...meetingKeys.all, 'status', userId, days] as const,
  counts: (userId: string, days: number) => [...meetingKeys.all, 'counts', userId, days] as const,
  detail: (id: number) => [...meetingKeys.all, 'detail', id] as const,
}

// API Functions
const fetchMeetings = async (
  userId: string, 
  days: number = 7, 
  limit: number = 10, 
  offset: number = 0
): Promise<{ 
  meetings: Meeting[], 
  pagination: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean,
    totalPages: number,
    currentPage: number
  }
}> => {
  const params = new URLSearchParams({
    agent_user_id: userId,
    days: days.toString(),
    limit: limit.toString(),
    offset: offset.toString()
  })
  
  const response = await fetch(`/api/meetings?${params}`, {
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch meetings: ${response.statusText}`)
  }
  
  return response.json()
}

const fetchMeetingStatus = async (userId: string, days: number = 7): Promise<MeetingStatus> => {
  const response = await fetch(`/api/meetings/status?agent_user_id=${encodeURIComponent(userId)}&days=${days}`, {
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch meeting status: ${response.statusText}`)
  }
  
  const data = await response.json()
  return {
    isInMeeting: data.isInMeeting || false,
    activeMeeting: data.activeMeeting || null
  }
}

const fetchMeetingCounts = async (userId: string, days: number = 7): Promise<{
  total: number
  today: number
  scheduled: number
  inProgress: number
  completed: number
}> => {
  const response = await fetch(`/api/meetings/counts?agent_user_id=${encodeURIComponent(userId)}&days=${days}`, {
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch meeting counts: ${response.statusText}`)
  }
  
  return response.json()
}

const createMeeting = async (meetingData: CreateMeetingData): Promise<{ meeting: Meeting }> => {
  const currentUser = getCurrentUser()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch('/api/meetings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      agent_user_id: currentUser.id,
      ...meetingData,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to create meeting')
  }

  return response.json()
}

const startMeeting = async (meetingId: number): Promise<{ success: boolean }> => {
  const currentUser = getCurrentUser()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch('/api/meetings/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ 
      meetingId: meetingId,
      agent_user_id: currentUser.id 
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to start meeting')
  }

  return response.json()
}

const endMeeting = async (meetingId: number): Promise<{ success: boolean }> => {
  const currentUser = getCurrentUser()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch('/api/meetings/end', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ 
      meetingId: meetingId,
      agent_user_id: currentUser.id 
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to end meeting')
  }

  return response.json()
}

const cancelMeeting = async (meetingId: number): Promise<{ success: boolean }> => {
  const currentUser = getCurrentUser()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch('/api/meetings/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ 
      meetingId: meetingId,
      agent_user_id: currentUser.id 
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to cancel meeting')
  }

  return response.json()
}

// Hooks
export function useMeetings(
  days: number = 7, 
  limit: number = 10, 
  offset: number = 0
) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useQuery({
    queryKey: meetingKeys.list(currentUser?.id || 'loading', days, limit, offset),
    queryFn: () => fetchMeetings(currentUser.id, days, limit, offset),
    enabled: isClient && !!currentUser?.id,
    staleTime: 5 * 1000, // 5 seconds (reduced for faster updates)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Don't always refetch on mount to reduce spam
    refetchOnWindowFocus: false,
    retry: 1, // Reduced retries to prevent spam
    refetchInterval: false, // Disable automatic refetching
  })
}

export function useMeetingStatus(days: number = 7) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useQuery({
    queryKey: meetingKeys.status(currentUser?.id || 'loading', days),
    queryFn: () => fetchMeetingStatus(currentUser.id, days),
    enabled: isClient && !!currentUser?.id,
    staleTime: 5 * 1000, // 5 seconds (reduced for faster updates)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Don't always refetch on mount to reduce spam
    refetchOnWindowFocus: false,
    retry: 1, // Reduced retries to prevent spam
    refetchInterval: false, // Disable automatic refetching
  })
}

export function useMeetingCounts(days: number = 7) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useQuery({
    queryKey: meetingKeys.counts(currentUser?.id || 'loading', days),
    queryFn: () => fetchMeetingCounts(currentUser.id, days),
    enabled: isClient && !!currentUser?.id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: false,
  })
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useMutation({
    mutationFn: createMeeting,
    onSuccess: (data) => {
      // Invalidate all meeting-related queries to ensure UI updates
      queryClient.invalidateQueries({ 
        queryKey: meetingKeys.all 
      })
      
      toast.success('Meeting created successfully!')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create meeting')
    },
  })
}

export function useStartMeeting() {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useMutation({
    mutationFn: startMeeting,
    onMutate: async (meetingId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: meetingKeys.all })
      
      // Snapshot the previous values
      const previousMeetings = queryClient.getQueriesData({ queryKey: meetingKeys.lists() })
      const previousStatus = queryClient.getQueriesData({ queryKey: meetingKeys.status('', 7) })
      
      // Optimistically update meetings data
      queryClient.setQueriesData({ queryKey: meetingKeys.lists() }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          meetings: old.meetings.map((meeting: Meeting) =>
            meeting.id === meetingId
              ? { ...meeting, status: 'in-progress' as const }
              : meeting
          )
        }
      })
      
      // Optimistically update meeting status data
      queryClient.setQueriesData({ queryKey: meetingKeys.status('', 7) }, (old: any) => {
        if (!old) return old
        const meeting = old.meetings?.find((m: Meeting) => m.id === meetingId)
        return {
          ...old,
          isInMeeting: true,
          activeMeeting: meeting ? { ...meeting, status: 'in-progress' as const } : null
        }
      })
      
      return { previousMeetings, previousStatus }
    },
    onSuccess: () => {
      // Invalidate meeting-related queries with more targeted approach
      queryClient.invalidateQueries({ 
        queryKey: meetingKeys.all,
        exact: false,
        refetchType: 'active' // Only refetch active queries
      })
      
      toast.success('Meeting started!')
    },
    onError: (error: Error, meetingId, context) => {
      // Rollback optimistic updates
      if (context?.previousMeetings) {
        context.previousMeetings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      if (context?.previousStatus) {
        context.previousStatus.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      toast.error(error.message || 'Failed to start meeting')
    },
  })
}

export function useEndMeeting() {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useMutation({
    mutationFn: endMeeting,
    onMutate: async (meetingId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: meetingKeys.all })
      
      // Snapshot the previous values
      const previousMeetings = queryClient.getQueriesData({ queryKey: meetingKeys.lists() })
      const previousStatus = queryClient.getQueriesData({ queryKey: meetingKeys.status('', 7) })
      
      // Optimistically update meetings data
      queryClient.setQueriesData({ queryKey: meetingKeys.lists() }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          meetings: old.meetings.map((meeting: Meeting) =>
            meeting.id === meetingId
              ? { ...meeting, status: 'completed' as const }
              : meeting
          )
        }
      })
      
      // Optimistically update meeting status data
      queryClient.setQueriesData({ queryKey: meetingKeys.status('', 7) }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          isInMeeting: false,
          activeMeeting: null
        }
      })
      
      return { previousMeetings, previousStatus }
    },
    onSuccess: () => {
      // Add a small delay before invalidating to ensure database is fully updated
      setTimeout(() => {
        // Invalidate meeting-related queries with more targeted approach
        queryClient.invalidateQueries({ 
          queryKey: meetingKeys.all,
          exact: false,
          refetchType: 'active' // Only refetch active queries
        })
      }, 100) // Small delay to ensure database consistency
      
      toast.success('Meeting ended!')
    },
    onError: (error: Error, meetingId, context) => {
      // Rollback optimistic updates
      if (context?.previousMeetings) {
        context.previousMeetings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      if (context?.previousStatus) {
        context.previousStatus.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      toast.error(error.message || 'Failed to end meeting')
    },
  })
}

export function useCancelMeeting() {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  return useMutation({
    mutationFn: cancelMeeting,
    onMutate: async (meetingId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: meetingKeys.lists() })
      
      // Snapshot the previous value
      const previousMeetings = queryClient.getQueriesData({ queryKey: meetingKeys.lists() })
      
      // Optimistically update to the new value
      queryClient.setQueriesData({ queryKey: meetingKeys.lists() }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          meetings: old.meetings.map((meeting: Meeting) =>
            meeting.id === meetingId
              ? { ...meeting, status: 'cancelled' as const }
              : meeting
          )
        }
      })
      
      return { previousMeetings }
    },
    onSuccess: () => {
      // Invalidate all meeting-related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: meetingKeys.all })
      
      toast.success('Meeting cancelled!')
    },
    onError: (error: Error, meetingId, context) => {
      // Rollback optimistic update
      if (context?.previousMeetings) {
        context.previousMeetings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      toast.error(error.message || 'Failed to cancel meeting')
    },
  })
}

// Utility hook to refresh meetings data
export function useRefreshMeetings() {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])
  
  return () => {
    if (!currentUser?.id) return
    
    // Only invalidate queries - let React Query handle refetching when needed
    // This prevents multiple simultaneous API calls
    queryClient.invalidateQueries({ 
      queryKey: meetingKeys.all,
      exact: false,
      refetchType: 'active' // Only refetch active queries, not background ones
    })
  }
}
