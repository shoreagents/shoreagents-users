'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSocket } from './socket-context'
import { useTeamAgents } from '@/hooks/use-team-agents'
import { getCurrentUser } from '@/lib/ticket-utils'

interface TeamStatusContextType {
  onlineTeamCount: number
  totalTeamCount: number
  isLoading: boolean
  lastUpdated: Date | null
  onlineTeamMembers: string[]
  teamMembers: string[]
}

const TeamStatusContext = createContext<TeamStatusContextType | undefined>(undefined)

export function useTeamStatus() {
  const context = useContext(TeamStatusContext)
  if (context === undefined) {
    throw new Error('useTeamStatus must be used within a TeamStatusProvider')
  }
  return context
}

interface TeamStatusProviderProps {
  children: ReactNode
}

export function TeamStatusProvider({ children }: TeamStatusProviderProps) {
  const [onlineTeamCount, setOnlineTeamCount] = useState(0)
  const [totalTeamCount, setTotalTeamCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [onlineTeamMembers, setOnlineTeamMembers] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [socketOnlineUsers, setSocketOnlineUsers] = useState<Set<string>>(new Set())
  
  const { socket, isConnected } = useSocket()
  const { data: teamData, isLoading: teamLoading, triggerRealtimeUpdate } = useTeamAgents()

  // Process team data and calculate counts
  useEffect(() => {
    if (teamData?.agents) {
      const teamEmails = teamData.agents.map(agent => agent.email)
      setTeamMembers(teamEmails)
      setTotalTeamCount(teamEmails.length)
      
      // Calculate online team members based on socket data
      const onlineTeamEmails = teamEmails.filter(email => socketOnlineUsers.has(email))
      setOnlineTeamMembers(onlineTeamEmails)
      setOnlineTeamCount(onlineTeamEmails.length)
      
      setLastUpdated(new Date())
      setIsLoading(false)
    }
  }, [teamData, socketOnlineUsers])

  // Update loading state based on team data
  useEffect(() => {
    if (teamLoading) {
      setIsLoading(true)
    }
  }, [teamLoading])

  // Socket event handlers for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) {
      return
    }

    // Request initial connected users list
    socket.emit('get-connected-users')

    // Listen for connected users list
    const handleConnectedUsersList = (users: any[]) => {
      const onlineUsers = users.filter(user => user.status === 'online')
      const onlineEmails = new Set(onlineUsers.map(user => user.email))
      setSocketOnlineUsers(onlineEmails)
      setLastUpdated(new Date())
    }

    // Listen for user status updates
    const handleUserStatusUpdate = (user: any) => {
      setLastUpdated(new Date())
      
      // Update socket online users set
      setSocketOnlineUsers(prev => {
        const newSet = new Set(prev)
        if (user.status === 'online') {
          newSet.add(user.email)
        } else {
          newSet.delete(user.email)
        }
        return newSet
      })
    }

    // Listen for user logout
    const handleUserLoggedOut = (email: string) => {
      setLastUpdated(new Date())
      
      // Remove user from online set
      setSocketOnlineUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(email)
        return newSet
      })
    }

    // Set up event listeners
    socket.on('connected-users-list', handleConnectedUsersList)
    socket.on('user-status-update', handleUserStatusUpdate)
    socket.on('user-logged-out', handleUserLoggedOut)

    // Cleanup
    return () => {
      socket.off('connected-users-list', handleConnectedUsersList)
      socket.off('user-status-update', handleUserStatusUpdate)
      socket.off('user-logged-out', handleUserLoggedOut)
    }
  }, [socket, isConnected])

  // Fallback mechanism when socket is disconnected
  useEffect(() => {
    if (!isConnected && teamData?.agents) {
      // When socket is disconnected, assume all team members are offline
      // This provides a conservative estimate rather than stale data
      setSocketOnlineUsers(new Set())
    }
  }, [isConnected, teamData])

  // Listen for socket reconnection events
  useEffect(() => {
    const handleSocketConnected = () => {
      if (socket && socket.connected) {
        // Small delay to ensure socket is fully ready
        setTimeout(() => {
          socket.emit('get-connected-users')
        }, 500)
      }
    }

    window.addEventListener('socket-connected', handleSocketConnected)
    
    return () => {
      window.removeEventListener('socket-connected', handleSocketConnected)
    }
  }, [socket])

  // Periodic refresh when socket is disconnected (fallback)
  useEffect(() => {
    if (!isConnected && teamData?.agents) {
      const interval = setInterval(() => {
        // Trigger team agents refresh to get updated team data
        triggerRealtimeUpdate()
      }, 30000) // Every 30 seconds

      return () => clearInterval(interval)
    }
  }, [isConnected, teamData, triggerRealtimeUpdate])

  const value: TeamStatusContextType = {
    onlineTeamCount,
    totalTeamCount,
    isLoading,
    lastUpdated,
    onlineTeamMembers,
    teamMembers
  }

  return (
    <TeamStatusContext.Provider value={value}>
      {children}
    </TeamStatusContext.Provider>
  )
}
