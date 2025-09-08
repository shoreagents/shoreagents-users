import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getCurrentUserInfo } from '@/lib/user-profiles'
import { useSocket } from '@/contexts/socket-context'

export interface Event {
  event_id: number
  title: string
  description: string
  event_date: string
  start_time: string
  end_time: string
  location: string
  status: 'upcoming' | 'today' | 'cancelled' | 'ended'
  event_type: 'event' | 'activity'
  created_by_name: string
  is_going: boolean
  is_back: boolean
  going_at: string | null
  back_at: string | null
}

export interface EventsResponse {
  success: boolean
  events: Event[]
  cached?: boolean
  error?: string
}

// Hook to fetch events
export function useEvents() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const queryClient = useQueryClient()
  const { socket, isConnected } = useSocket()
  
  // Only get user on client side to avoid hydration issues
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUserInfo()
      setCurrentUser(user)
    }
  }, [isClient])
  
  const query = useQuery({
    queryKey: ['events', currentUser?.email || 'loading'],
    queryFn: async (): Promise<EventsResponse> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch('/api/events', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 0, // Always consider data stale for real-time updates
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true, // Allow refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
  
  // Function to trigger real-time update with cache bypass
  const triggerRealtimeUpdate = async () => {
    if (!currentUser?.email) return
    
    try {
      // Fetch fresh data with cache bypass
      const response = await fetch(`/api/events?bypass_cache=true`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const freshData = await response.json()
        
        // Update the cache with fresh data (no loading state)
        queryClient.setQueryData(['events', currentUser.email], freshData)
      }
    } catch (error) {
      console.error('Error fetching fresh events data:', error)
    }
  }
  
  // Listen for real-time event updates
  useEffect(() => {
    if (!socket || !isConnected || !currentUser?.email) {
      return
    }

    const handleEventChange = async (data: any) => {
      try {
        // Use the existing triggerRealtimeUpdate function
        await triggerRealtimeUpdate()
      } catch (error) {
        console.error('Error in triggerRealtimeUpdate:', error)
        
        try {
          await queryClient.invalidateQueries({ 
            queryKey: ['events', currentUser?.email],
            exact: false
          })
        } catch (invalidateError) {
          console.error('Error in fallback invalidation:', invalidateError)
        }
      }
      
    }

    const handleEventAttendanceChange = async (data: any) => {
      try {
        // Fetch fresh data directly
        const response = await fetch('/api/events?bypass_cache=true', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const freshData = await response.json()
          // Update the cache directly with fresh data
          queryClient.setQueryData(['events', currentUser?.email], freshData)
        } else {
          console.error('Failed to fetch fresh events data for attendance:', response.status)
          // Fallback to invalidation
          await queryClient.invalidateQueries({ 
            queryKey: ['events', currentUser?.email],
            exact: false
          })
        }
      } catch (error) {
        console.error('Error fetching fresh data for attendance, falling back to invalidation:', error)
        // Fallback to invalidation
        await queryClient.invalidateQueries({ 
          queryKey: ['events', currentUser?.email],
          exact: false
        })
      }
    }

    const handleEventUpdated = async (data: any) => {
      try {
        // Fetch fresh data directly
        const response = await fetch('/api/events?bypass_cache=true', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const freshData = await response.json()
          // Update the cache directly with fresh data
          queryClient.setQueryData(['events', currentUser?.email], freshData)
        } else {
          console.error('Failed to fetch fresh events data for update:', response.status)
          // Fallback to invalidation
          await queryClient.invalidateQueries({ 
            queryKey: ['events', currentUser?.email],
            exact: false
          })
        }
      } catch (error) {
        console.error('Error fetching fresh data for update, falling back to invalidation:', error)
        // Fallback to invalidation
        await queryClient.invalidateQueries({ 
          queryKey: ['events', currentUser?.email],
          exact: false
        })
      }
    }

    // Listen for event-related socket events
    socket.on('event-change', handleEventChange)
    socket.on('event-attendance-change', handleEventAttendanceChange)
    socket.on('event-updated', handleEventUpdated)
    
    return () => {
      socket.off('event-change', handleEventChange)
      socket.off('event-attendance-change', handleEventAttendanceChange)
      socket.off('event-updated', handleEventUpdated)
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [socket, isConnected, currentUser?.email, queryClient])

  // Show loading state when client is not ready or user is not loaded yet
  return {
    ...query,
    isLoading: query.isLoading || !isClient || !currentUser?.email,
    events: query.data?.events || [],
    isCached: query.data?.cached || false,
    triggerRealtimeUpdate
  }
}

// Hook for marking as going to an event
export function useMarkAsGoing() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch('/api/events/going', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event_id: eventId }),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to mark as going')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ 
        queryKey: ['events'],
        exact: false
      })
    },
    onError: (error: Error) => {
      console.error('Error marking as going:', error.message)
    }
  })
}

// Hook for marking as back from an event
export function useMarkAsBack() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch('/api/events/back', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event_id: eventId }),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to mark as back')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ 
        queryKey: ['events'],
        exact: false
      })
    },
    onError: (error: Error) => {
      console.error('Error marking as back:', error.message)
    }
  })
}

// Hook for creating events (admin only)
export function useCreateEvent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventData: {
      title: string
      description: string
      event_date: string
      start_time: string
      end_time: string
      location: string
      status: 'upcoming' | 'today' | 'cancelled' | 'ended'
      event_type?: 'event' | 'activity'
    }) => {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create event')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ 
        queryKey: ['events'],
        exact: false
      })
    },
    onError: (error: Error) => {
      console.error('Error creating event:', error.message)
    }
  })
}

// Hook for updating events (admin only)
export function useUpdateEvent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ eventId, eventData }: {
      eventId: number
      eventData: {
        title: string
        description: string
        event_date: string
        start_time: string
        end_time: string
        location: string
        status: 'upcoming' | 'today' | 'cancelled' | 'ended'
        event_type?: 'event' | 'activity'
      }
    }) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update event')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ 
        queryKey: ['events'],
        exact: false
      })
    },
    onError: (error: Error) => {
      console.error('Error updating event:', error.message)
    }
  })
}

// Hook for deleting events (admin only)
export function useDeleteEvent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete event')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ 
        queryKey: ['events'],
        exact: false
      })
    },
    onError: (error: Error) => {
      console.error('Error deleting event:', error.message)
    }
  })
}
