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

export const getAllUsersLeaderboard = async (month?: string): Promise<LeaderboardEntry[]> => {
  if (typeof window === 'undefined') return []
  
  try {
    const authData = localStorage.getItem("shoreagents-auth")
    const authToken = authData ? JSON.stringify(JSON.parse(authData)) : null
    
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    
    const response = await fetch(`/api/leaderboard?${params}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error('Failed to fetch leaderboard:', response.statusText)
      return []
    }
    
    const data = await response.json()
    return data.leaderboard || []
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
}

export const getCurrentUserRank = async (month?: string): Promise<number> => {
  if (typeof window === 'undefined') return 0
  
  try {
    const authData = localStorage.getItem("shoreagents-auth")
    const authToken = authData ? JSON.stringify(JSON.parse(authData)) : null
    
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    
    const response = await fetch(`/api/leaderboard?${params}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error('Failed to fetch user rank:', response.statusText)
      return 0
    }
    
    const data = await response.json()
    return data.currentUserRank || 0
  } catch (error) {
    console.error('Error fetching user rank:', error)
    return 0
  }
} 