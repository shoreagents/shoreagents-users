import { getUserActivityData, getActivitySummary } from "./activity-storage"
import { userProfiles } from "./user-profiles"

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  productivityScore: number
  totalActiveTime: number
  totalInactiveTime: number
  isCurrentlyActive: boolean
  isInBreak: boolean
}

export const getAllUsersLeaderboard = (): LeaderboardEntry[] => {
  if (typeof window === 'undefined') return []
  
  const leaderboard: LeaderboardEntry[] = []
  
  // Get all known users from userProfiles
  Object.entries(userProfiles).forEach(([email, profile]) => {
    const activityData = getUserActivityData(email)
    if (activityData) {
      const summary = getActivitySummary(email)
      if (summary) {
        const totalTime = summary.totalActiveTime + summary.totalInactiveTime
        const productivityScore = totalTime > 0 
          ? Math.round((summary.totalActiveTime / totalTime) * 100)
          : 0
        
        leaderboard.push({
          rank: 0, // Will be set after sorting
          userId: email,
          name: `${profile.first_name} ${profile.last_name}`,
          productivityScore,
          totalActiveTime: summary.totalActiveTime,
          totalInactiveTime: summary.totalInactiveTime,
          isCurrentlyActive: summary.isCurrentlyActive,
          isInBreak: summary.isInBreak
        })
      }
    }
  })
  
  // Sort by productivity score (highest first)
  leaderboard.sort((a, b) => b.productivityScore - a.productivityScore)
  
  // Assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1
  })
  
  return leaderboard
}

export const getCurrentUserRank = (): number => {
  if (typeof window === 'undefined') return 0
  
  const authData = localStorage.getItem("shoreagents-auth")
  if (!authData) return 0
  
  try {
    const parsed = JSON.parse(authData)
    const userEmail = parsed.user?.email
    if (!userEmail) return 0
    
    const leaderboard = getAllUsersLeaderboard()
    const userEntry = leaderboard.find(entry => entry.userId === userEmail)
    return userEntry?.rank || 0
  } catch {
    return 0
  }
} 