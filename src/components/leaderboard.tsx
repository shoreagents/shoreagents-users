"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Trophy, TrendingUp, User, Crown, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAnalyticsLeaderboard } from "@/hooks/use-analytics"
import { type LeaderboardEntry } from "@/lib/leaderboard-utils"

export function Leaderboard() {
  // Use React Query hook instead of manual API calls
  const { data: leaderboardData, isLoading, error } = useAnalyticsLeaderboard()
  
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false) // Add flag to prevent immediate refresh

  // Function to truncate name with ellipsis
  const truncateName = useCallback((name: string, maxLength: number = 12) => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength).trim() + "......"
  }, [])

  // Function to format month display
  const formatMonthDisplay = useCallback((monthYear: string) => {
    if (!monthYear) return "Top Points Leaderboard"
    
    const [year, month] = monthYear.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    const monthName = date.toLocaleDateString('en-US', { month: 'long' })
    return `${monthName} Top Points Leaderboard`
  }, [])

  // Function to get current user email
  const getCurrentUserEmail = useCallback(() => {
    try {
      const authData = localStorage.getItem("shoreagents-auth")
      if (authData) {
        const parsed = JSON.parse(authData)
        return parsed?.user?.email || null
      }
    } catch (error) {
      console.error('Error parsing auth data:', error)
    }
    return null
  }, [])

  // Extract data from React Query
  const leaderboard = leaderboardData?.leaderboard || []
  const currentMonth = leaderboardData?.monthYear || ''
  const currentUserRank = 0 // TODO: Add user rank to the API response

  // Note: Real-time updates are now handled by React Query cache invalidation
  // The leaderboard will automatically refresh when the cache is invalidated

  // Initialize when data is loaded
  useEffect(() => {
    if (leaderboardData && !isInitialized) {
      setCurrentUserEmail(getCurrentUserEmail())
      setIsInitialized(true)
    }
  }, [leaderboardData, isInitialized, getCurrentUserEmail])

  // Note: Real-time updates are handled by React Query cache invalidation

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            {formatMonthDisplay(currentMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded flex-1"></div>
                <div className="h-3 w-8 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (leaderboard.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            {formatMonthDisplay(currentMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-xs text-muted-foreground py-2">
            No activity data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4 w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs flex items-center gap-2">
          <Trophy className="h-4 w-4 flex-shrink-0" />
          {formatMonthDisplay(currentMonth)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        <TooltipProvider>
        <div className="space-y-2">
          {leaderboard.map((entry, index) => {
            const isCurrentUser = currentUserEmail && entry.userId === currentUserEmail
            
            return (
              <div 
                key={entry.userId} 
                className={`flex items-center gap-2 w-full rounded-md px-1.5 py-0.5 transition-all duration-500 ease-in-out ${
                  isCurrentUser 
                    ? 'bg-gradient-to-r from-slate-100 to-gray-200 border border-gray-300 shadow-lg backdrop-blur-sm' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-1 flex-shrink-0 w-6">
                  
                  {/* Rank indicators */}
                  {entry.rank === 1 && <Crown className="h-3 w-3 text-yellow-500" />}
                  {entry.rank === 2 && <Trophy className="h-3 w-3 text-gray-400" />}
                  {entry.rank === 3 && <Trophy className="h-3 w-3 text-orange-500" />}
                  {entry.rank > 3 && (
                    <span className="text-xs font-medium text-muted-foreground w-3 text-center">
                      {entry.rank}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 overflow-hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 w-full">
                        <span className={`text-xs font-medium block w-full text-left ${
                          isCurrentUser ? 'text-gray-800 font-semibold' : ''
                        }`}>
                          {truncateName(entry.name)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs">{entry.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <Badge 
                  variant={isCurrentUser ? "default" : "secondary"} 
                  className={`text-xs px-1.5 py-0.5 flex-shrink-0 ${
                    isCurrentUser ? 'bg-gray-200 text-gray-800 border-gray-300 shadow-sm' : ''
                  }`}
                >
                  {entry.productivityScore.toFixed(1)} pts
                </Badge>
              </div>
            )
          })}
        </div>
        </TooltipProvider>
        
        {currentUserRank !== null && (
          <div className="mt-3 pt-2 border-t">
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Your rank:</span>
              <Badge variant="outline" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                #{currentUserRank}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 