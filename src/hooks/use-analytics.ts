import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'

type WeeklyDay = { 
  today_date: string
  active_seconds: number
  inactive_seconds: number 
}

type WeeklySummary = { 
  week_start_date: string
  week_end_date: string
  total_active_seconds: number
  total_inactive_seconds: number 
}

type MonthlySummary = { 
  month_start_date: string
  total_active_seconds: number
  total_inactive_seconds: number 
}

type LeaderboardRow = { 
  rank: number
  userId: string
  name: string
  profilePicture?: string
  productivityScore: number 
}

type ProductivityScore = { 
  month_year: string
  productivity_score: number 
}

// Hook to fetch weekly activity data
export function useAnalyticsWeekly() {
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
    queryKey: ['analytics-weekly', currentUser?.email || 'loading'],
    queryFn: async (): Promise<{ weeklySummaries: WeeklySummary[], currentWeek: WeeklyDay[] }> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch('/api/activity/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'get_all', 
          email: currentUser.email, 
          weeksToKeep: 2 
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch weekly data: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes (activity data changes frequently)
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}

// Hook to fetch monthly activity data
export function useAnalyticsMonthly() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  return useQuery({
    queryKey: ['analytics-monthly', currentUser?.email || 'loading'],
    queryFn: async (): Promise<{ monthlySummaries: MonthlySummary[] }> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch('/api/activity/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'get_all', 
          email: currentUser.email, 
          monthsToKeep: 12 
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch monthly data: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 10 * 60 * 1000, // 10 minutes (monthly data changes less frequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}

// Hook to fetch leaderboard data
export function useAnalyticsLeaderboard(period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  return useQuery({
    queryKey: ['analytics-leaderboard', period],
    queryFn: async (): Promise<{ leaderboard: LeaderboardRow[], monthYear: string, todayDate: string }> => {
      // First, get team agents to filter by team
      const teamAgentsResponse = await fetch('/api/agents/team/')
      if (!teamAgentsResponse.ok) {
        throw new Error(`Failed to fetch team agents: ${teamAgentsResponse.statusText}`)
      }
      
      const teamData = await teamAgentsResponse.json()
      const teamAgentEmails = teamData.agents?.map((agent: any) => agent.email) || []
      
      if (teamAgentEmails.length === 0) {
        return { leaderboard: [], monthYear: '', todayDate: '' }
      }
      
      // Get leaderboard data based on period
      let apiUrl = '/api/leaderboard/?limit=100'
      if (period === 'daily') {
        apiUrl = '/api/leaderboard/daily/?limit=100'
      } else if (period === 'weekly') {
        apiUrl = '/api/leaderboard/weekly/?limit=100'
      }
      
      const response = await fetch(apiUrl, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${period} leaderboard: ${response.statusText}`)
      }
      
      const data = await response.json()
      const allLeaderboard = data.leaderboard || []
      
      // Filter leaderboard to only include team members
      const teamLeaderboard = allLeaderboard
        .filter((entry: any) => teamAgentEmails.includes(entry.userId))
        .slice(0, 10) // Limit to top 10
      
      const finalLeaderboard = teamLeaderboard.map((entry: any) => ({
          rank: entry.rank,
          userId: entry.userId,
          name: entry.name,
          profilePicture: entry.profilePicture,
          productivityScore: entry.productivityScore
        }))
      
      return {
        leaderboard: finalLeaderboard,
        monthYear: data.monthYear || data.date || data.weekStart || '',
        todayDate: data.todayDate || data.date || ''
      }
    },
    enabled: isClient,
    staleTime: period === 'daily' ? 5 * 60 * 1000 : period === 'weekly' ? 10 * 60 * 1000 : 15 * 60 * 1000, // Different cache times
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}

// Hook to fetch productivity data
export function useAnalyticsProductivity() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  return useQuery({
    queryKey: ['analytics-productivity', currentUser?.email || 'loading'],
    queryFn: async (): Promise<{ productivityScores: ProductivityScore[], averageProductivityScore: string }> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch('/api/activity/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'get_all', 
          email: currentUser.email, 
          monthsBack: 12 
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch productivity data: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 10 * 60 * 1000, // 10 minutes (productivity data changes less frequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}

// Combined hook for all analytics data
export function useAnalyticsData(leaderboardPeriod: 'daily' | 'weekly' | 'monthly' = 'monthly') {
  const weeklyQuery = useAnalyticsWeekly()
  const monthlyQuery = useAnalyticsMonthly()
  const leaderboardQuery = useAnalyticsLeaderboard(leaderboardPeriod)
  const productivityQuery = useAnalyticsProductivity()

  // Check if any query is still loading or if we're in the initial state
  const isLoading = weeklyQuery.isLoading || monthlyQuery.isLoading || leaderboardQuery.isLoading || productivityQuery.isLoading ||
                   weeklyQuery.isPending || monthlyQuery.isPending || leaderboardQuery.isPending || productivityQuery.isPending
  const hasError = weeklyQuery.isError || monthlyQuery.isError || leaderboardQuery.isError || productivityQuery.isError

  // Don't show data until at least one query has completed successfully
  const hasAnyData = weeklyQuery.isSuccess || monthlyQuery.isSuccess || leaderboardQuery.isSuccess || productivityQuery.isSuccess

  // Process weekly data
  const weeklyDays = weeklyQuery.data?.currentWeek || []
  const weeklySummaries = weeklyQuery.data?.weeklySummaries || []

  // Process monthly data
  const monthlySummaries = monthlyQuery.data?.monthlySummaries || []

  // Process leaderboard data
  const leaderboard = leaderboardQuery.data?.leaderboard || []
  const leaderboardMonth = leaderboardQuery.data?.monthYear || ''
  const todayDate = leaderboardQuery.data?.todayDate || ''

  // Process productivity data
  const prodScores = productivityQuery.data?.productivityScores || []
  const prodAverage = parseFloat(productivityQuery.data?.averageProductivityScore || '0')

  return {
    // Data
    weeklyDays,
    weeklySummaries,
    monthlySummaries,
    leaderboard,
    leaderboardMonth,
    todayDate,
    prodScores,
    prodAverage,
    
    // Loading states
    isLoading: isLoading || !hasAnyData, // Show loading until we have at least some data
    hasError,
    
    // Individual query states
    weeklyQuery,
    monthlyQuery,
    leaderboardQuery,
    productivityQuery,
  }
}

// Hook for invalidating leaderboard cache when productivity points update
export function useLeaderboardCacheInvalidation() {
  const queryClient = useQueryClient()

  const invalidateLeaderboard = () => {
    queryClient.invalidateQueries({
      queryKey: ['analytics-leaderboard']
    })
  }

  const invalidateProductivity = () => {
    queryClient.invalidateQueries({
      queryKey: ['analytics-productivity']
    })
  }

  const invalidateAllAnalytics = () => {
    queryClient.invalidateQueries({
      queryKey: ['analytics']
    })
  }

  return {
    invalidateLeaderboard,
    invalidateProductivity,
    invalidateAllAnalytics
  }
}
