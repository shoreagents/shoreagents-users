import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { Ticket } from '@/lib/ticket-utils'

type BreakSession = {
  id: number
  break_type: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  break_date: string
}

type MeetingItem = any

type TaskStatistics = {
  groups: Array<{
    id: number
    group_title: string
    group_color: string
    position: number
    task_count: string
    urgent_count: string
    high_count: string
    normal_count: string
    low_count: string
  }>
  priorities: Array<{
    priority: string
    count: string
  }>
  overdue: {
    overdue_count: string
    very_overdue_count: string
  }
  recentActivity: Array<{
    date: string
    count: number
  }>
  totalTasks: number
}

// Hook to fetch tickets (reuse existing)
export function useDashboardTickets() {
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
    queryKey: ['dashboard-tickets', currentUser?.email || 'loading'],
    queryFn: async (): Promise<{ success: boolean; tickets: Ticket[] }> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch(`/api/tickets/?email=${encodeURIComponent(currentUser.email)}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2, // Retry failed requests
  })
}

// Hook to fetch breaks history
export function useDashboardBreaks(days: number = 7) {
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
    queryKey: ['dashboard-breaks', currentUser?.id || 'loading', days],
    queryFn: async (): Promise<{ data: { completed_breaks: BreakSession[]; active_breaks: BreakSession[] } }> => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch(`/api/breaks/history/?agent_user_id=${encodeURIComponent(currentUser.id)}&days=${days}&include_active=true`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch breaks: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.id,
    staleTime: 1 * 60 * 1000, // 1 minute (breaks change more frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2, // Retry failed requests
  })
}

// Hook to fetch meetings
export function useDashboardMeetings(days: number = 7) {
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
    queryKey: ['dashboard-meetings', currentUser?.id || 'loading', days],
    queryFn: async (): Promise<{ meetings: MeetingItem[] }> => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch(`/api/meetings/?agent_user_id=${encodeURIComponent(currentUser.id)}&days=${days}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch meetings: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes (meetings are cached in Redis)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2, // Retry failed requests
  })
}

// Hook to fetch task statistics
export function useDashboardTaskStats() {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
    }
  }, [isClient])

  return useQuery({
    queryKey: ['dashboard-task-stats'],
    queryFn: async (): Promise<{ statistics: TaskStatistics }> => {
      const response = await fetch('/api/task-statistics/', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch task statistics: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1, // Only retry once for task stats
  })
}

// Combined hook for all dashboard data
export function useDashboardData(days: number = 7) {
  const ticketsQuery = useDashboardTickets()
  const breaksQuery = useDashboardBreaks(days)
  const meetingsQuery = useDashboardMeetings(days)
  const taskStatsQuery = useDashboardTaskStats()

  // Check if any query is still loading or if we're in the initial state
  const isLoading = ticketsQuery.isLoading || breaksQuery.isLoading || meetingsQuery.isLoading || taskStatsQuery.isLoading ||
                   ticketsQuery.isPending || breaksQuery.isPending || meetingsQuery.isPending || taskStatsQuery.isPending
  const hasError = ticketsQuery.isError || breaksQuery.isError || meetingsQuery.isError || taskStatsQuery.isError

  // Don't show data until at least one query has completed successfully
  const hasAnyData = ticketsQuery.isSuccess || breaksQuery.isSuccess || meetingsQuery.isSuccess || taskStatsQuery.isSuccess

  // Process tickets data
  const allTickets = ticketsQuery.data?.tickets || []
  const recentTickets = allTickets
    .sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime()
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime()
      return bTs - aTs
    })
    .slice(0, 5)

  // Process breaks data
  const breaks = breaksQuery.data ? [
    ...(breaksQuery.data.data?.completed_breaks || []),
    ...(breaksQuery.data.data?.active_breaks || [])
  ] : []

  // Process meetings data
  const meetings = meetingsQuery.data?.meetings || []

  // Process task stats data with fallback
  const taskStats = taskStatsQuery.data?.statistics || {
    groups: [
      { id: 1, group_title: 'To Do', group_color: 'bg-gray-200', position: 0, task_count: '0', urgent_count: '0', high_count: '0', normal_count: '0', low_count: '0' },
      { id: 2, group_title: 'In Progress', group_color: 'bg-blue-100', position: 1, task_count: '0', urgent_count: '0', high_count: '0', normal_count: '0', low_count: '0' },
      { id: 3, group_title: 'Review', group_color: 'bg-yellow-100', position: 2, task_count: '0', urgent_count: '0', high_count: '0', normal_count: '0', low_count: '0' },
      { id: 4, group_title: 'Done', group_color: 'bg-green-100', position: 3, task_count: '0', urgent_count: '0', high_count: '0', normal_count: '0', low_count: '0' }
    ],
    priorities: [],
    overdue: { overdue_count: '0', very_overdue_count: '0' },
    recentActivity: [],
    totalTasks: 0
  }

  return {
    // Data
    allTickets,
    recentTickets,
    breaks,
    meetings,
    taskStats,
    
    // Loading states
    isLoading: isLoading || !hasAnyData, // Show loading until we have at least some data
    hasError,
    
    // Individual query states
    ticketsQuery,
    breaksQuery,
    meetingsQuery,
    taskStatsQuery,
  }
}
