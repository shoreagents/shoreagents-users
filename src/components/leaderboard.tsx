"use client"

import { useState, useEffect } from "react"
import { Trophy, TrendingUp, User, Crown, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getAllUsersLeaderboard, getCurrentUserRank, type LeaderboardEntry } from "@/lib/leaderboard-utils"

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentUserRank, setCurrentUserRank] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState<string>("")

  // Function to truncate name with ellipsis
  const truncateName = (name: string, maxLength: number = 12) => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength).trim() + "......"
  }

  // Function to format month display
  const formatMonthDisplay = (monthYear: string) => {
    if (!monthYear) return "Top Points Leaderboard"
    
    const [year, month] = monthYear.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    const monthName = date.toLocaleDateString('en-US', { month: 'long' })
    return `${monthName} Top Points Leaderboard`
  }

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLoading(true)
        const data = await getAllUsersLeaderboard()
        const rank = await getCurrentUserRank()
        setLeaderboard(data.slice(0, 10)) // Show top 10
        setCurrentUserRank(rank)
        
        // Get current month for display
        const now = new Date()
        const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setCurrentMonth(currentMonthYear)
      } catch (error) {
        console.error('Error loading leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLeaderboard()
    
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(loadLeaderboard, 30000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
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
          {leaderboard.map((entry, index) => (
              <div key={entry.userId} className="flex items-center gap-2 w-full">
                <div className="flex items-center gap-1 flex-shrink-0 w-6">
                {entry.isInBreak ? (
                  entry.isCurrentlyActive ? (
                    <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  ) : (
                    <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                  )
                ) : entry.isCurrentlyActive ? (
                  <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
                ) : (
                  <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
                )}
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
                        <span className="text-xs font-medium block w-full text-left">
                          {truncateName(entry.name)}
                  </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs">{entry.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                {entry.productivityScore.toFixed(1)} pts
              </Badge>
            </div>
          ))}
        </div>
        </TooltipProvider>
        
        {currentUserRank > 0 && (
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