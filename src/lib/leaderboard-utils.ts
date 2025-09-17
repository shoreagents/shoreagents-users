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
    // First, get team agents to filter by team
    const teamAgentsResponse = await fetch('/api/agents/team/')
    if (!teamAgentsResponse.ok) {
      console.error('Failed to fetch team agents:', teamAgentsResponse.statusText)
      return []
    }
    
    const teamData = await teamAgentsResponse.json()
    const teamAgentEmails = teamData.agents?.map((agent: any) => agent.email) || []
    
    if (teamAgentEmails.length === 0) {
      return []
    }
    
    // Get all leaderboard data
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    params.append('limit', '100') // Get more data to filter from
    
    const response = await fetch(`/api/leaderboard?${params}`)
    
    if (!response.ok) {
      console.error('Failed to fetch leaderboard:', response.statusText)
      return []
    }
    
    const data = await response.json()
    const allLeaderboard = data.leaderboard || []
    
    // Filter leaderboard to only include team members
    const teamLeaderboard = allLeaderboard.filter((entry: LeaderboardEntry) => 
      teamAgentEmails.includes(entry.userId)
    )
    
    return teamLeaderboard
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
}

export const getCurrentUserRank = async (month?: string): Promise<number> => {
  if (typeof window === 'undefined') return 0
  
  try {
    // Get current user email
    const authData = localStorage.getItem("shoreagents-auth")
    const userEmail = authData ? JSON.parse(authData)?.user?.email : null
    
    if (!userEmail) {
      return 0
    }
    
    // Get team leaderboard and find user's rank
    const teamLeaderboard = await getAllUsersLeaderboard(month)
    
    // Find user's rank in the team leaderboard
    const userEntry = teamLeaderboard.find(entry => entry.userId === userEmail)
    
    if (userEntry) {
      return userEntry.rank
    }
    
    // If user not found in team leaderboard, they might not have any activity
    return 0
  } catch (error) {
    console.error('Error fetching user rank:', error)
    return 0
  }
} 