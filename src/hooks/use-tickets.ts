import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'

export interface Ticket {
  id: string
  name: string
  concern: string
  details: string
  category: string
  status: string
  date: string
  createdAt: string
  position: number
  categoryId: number
  fileCount: number
  files: string[]
  email: string
  userId?: number
  userEmail?: string
  resolvedBy?: number
  resolvedByName?: string
  resolvedByEmail?: string
  resolvedAt?: string
  supportingFiles?: string[]
  roleId?: number
}

export interface TicketsResponse {
  success: boolean
  tickets: Ticket[]
  total: number
}

// Hook to fetch tickets
export function useTickets() {
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
  
  const query = useQuery({
    queryKey: ['tickets', currentUser?.email || 'loading'],
    queryFn: async (): Promise<TicketsResponse> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch(`/api/tickets?email=${encodeURIComponent(currentUser.email)}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  
  // Function to trigger real-time update with cache bypass
  const triggerRealtimeUpdate = async () => {
    if (!currentUser?.email) return
    
    try {
      // Fetch fresh data with cache bypass
      const response = await fetch(`/api/tickets?email=${encodeURIComponent(currentUser.email)}&bypass_cache=true`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const freshData = await response.json()
        
        // Update the cache with fresh data (no loading state)
        queryClient.setQueryData(['tickets', currentUser.email], freshData)
      }
    } catch (error) {
      console.error('Error fetching fresh ticket data:', error)
    }
  }
  
  // Show loading state when client is not ready or user is not loaded yet
  return {
    ...query,
    isLoading: query.isLoading || !isClient || !currentUser?.email,
    triggerRealtimeUpdate
  }
}

// Hook to create a new ticket
export function useCreateTicket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (ticketData: {
      concern: string
      category: string
      details?: string
      files?: any[]
    }) => {
      const response = await fetch('/api/tickets/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(ticketData),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create ticket: ${response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch tickets
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (error) => {
      console.error('Error creating ticket:', error)
    },
  })
}

// Hook to update a ticket
export function useUpdateTicket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ ticketId, updates }: { ticketId: string; updates: Partial<Ticket> }) => {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update ticket: ${response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch tickets
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (error) => {
      console.error('Error updating ticket:', error)
    },
  })
}

// Hook to update ticket files
export function useUpdateTicketFiles() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ ticketId, files }: { ticketId: string; files: any[] }) => {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          supporting_files: files,
          file_count: files.length
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update ticket files: ${response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch tickets
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (error) => {
      console.error('Error updating ticket files:', error)
    },
  })
}

// Hook to delete a ticket
export function useDeleteTicket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete ticket: ${response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch tickets
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (error) => {
      console.error('Error deleting ticket:', error)
    },
  })
}

// Hook to fetch a single ticket by ID
export function useTicket(ticketId: string) {
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
  
  const query = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async (): Promise<{ success: boolean; ticket: Ticket }> => {
      if (!ticketId) {
        throw new Error('Ticket ID is required')
      }
      
      const response = await fetch(`/api/tickets/${ticketId}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Ticket not found')
        }
        throw new Error(`Failed to fetch ticket: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!ticketId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  
  // Function to trigger real-time update with cache bypass
  const triggerRealtimeUpdate = async () => {
    if (!ticketId) return
    
    try {
      // Fetch fresh data with cache bypass
      const response = await fetch(`/api/tickets/${ticketId}?bypass_cache=true`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const freshData = await response.json()
        
        // Update the cache with fresh data (no loading state)
        queryClient.setQueryData(['ticket', ticketId], freshData)
      }
    } catch (error) {
      console.error('Error fetching fresh ticket data:', error)
    }
  }
  
  return {
    ...query,
    isLoading: query.isLoading || !isClient,
    triggerRealtimeUpdate
  }
}

// Hook to fetch ticket comments
export function useTicketComments(ticketId: string) {
  const [isClient, setIsClient] = useState(false)
  const queryClient = useQueryClient()
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
    }
  }, [isClient])
  
  const query = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async (): Promise<{ success: boolean; comments: any[] }> => {
      if (!ticketId) {
        throw new Error('Ticket ID is required')
      }
      
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!ticketId,
    staleTime: 1 * 60 * 1000, // 1 minute (comments change more frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  
  // Function to add a new comment optimistically
  const addComment = useMutation({
    mutationFn: async (commentData: { content: string }) => {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ comment: commentData.content }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch comments with cache bypass
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] })
      // Force refetch with fresh data
      queryClient.refetchQueries({ queryKey: ['ticket-comments', ticketId] })
    },
    onError: (error) => {
      console.error('Error adding comment:', error)
    },
  })
  
  // Function to trigger real-time comment update with cache bypass
  const triggerCommentsUpdate = async () => {
    if (!ticketId) return
    
    try {
      // Fetch fresh comments with cache bypass
      const response = await fetch(`/api/tickets/${ticketId}/comments?bypass_cache=true`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const freshData = await response.json()
        
        // Update the cache with fresh data (no loading state)
        queryClient.setQueryData(['ticket-comments', ticketId], freshData)
      }
    } catch (error) {
      console.error('Error fetching fresh comments:', error)
    }
  }
  
  return {
    ...query,
    isLoading: query.isLoading || !isClient,
    addComment,
    triggerCommentsUpdate
  }
}

// Hook to prefetch tickets (useful for navigation)
export function usePrefetchTickets() {
  const queryClient = useQueryClient()
  
  return () => {
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      queryClient.prefetchQuery({
        queryKey: ['tickets', currentUser.email],
        queryFn: async (): Promise<TicketsResponse> => {
          const response = await fetch(`/api/tickets?email=${encodeURIComponent(currentUser.email)}`, {
            credentials: 'include',
          })
          
          if (!response.ok) {
            throw new Error(`Failed to fetch tickets: ${response.statusText}`)
          }
          
          return response.json()
        },
        staleTime: 2 * 60 * 1000,
      })
    }
  }
}
