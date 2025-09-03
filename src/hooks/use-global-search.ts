"use client"

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '@/lib/auth-utils'

export interface SearchResult {
  id: string
  title: string
  description?: string
  type: 'ticket' | 'task' | 'break' | 'meeting' | 'health' | 'user' | 'page'
  url: string
  metadata?: {
    status?: string
    priority?: string
    date?: string
    category?: string
  }
}

export interface GlobalSearchResponse {
  success: boolean
  results: SearchResult[]
  query: string
  cached?: boolean
}

// Hook to perform global search with React Query
export function useGlobalSearch(query: string) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  // Only get user on client side to avoid hydration issues
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])

  const searchQuery = useQuery({
    queryKey: ['global-search', currentUser?.id || 'loading', query],
    queryFn: async (): Promise<GlobalSearchResponse> => {
      if (!currentUser?.id || !query.trim()) {
        return { success: true, results: [], query }
      }
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to search: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.id && query.trim().length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 min
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 min
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Show loading state when client is not ready or user is not loaded yet
  return {
    ...searchQuery,
    isLoading: searchQuery.isLoading || !isClient || !currentUser?.id,
    results: searchQuery.data?.results || [],
    isCached: searchQuery.data?.cached || false,
  }
}

// Hook for debounced search
export function useDebouncedGlobalSearch(query: string, delay: number = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, delay)

    return () => clearTimeout(timer)
  }, [query, delay])

  return useGlobalSearch(debouncedQuery)
}
