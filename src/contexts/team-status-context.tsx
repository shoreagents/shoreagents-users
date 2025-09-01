'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSocket } from './socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'

interface TeamStatusContextType {
  onlineTeamCount: number
  totalTeamCount: number
  isLoading: boolean
  lastUpdated: Date | null
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
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!socket || !isConnected) {
      return
    }

    // Request initial connected users list
    socket.emit('get-connected-users')

    // Listen for connected users list
    const handleConnectedUsersList = (users: any[]) => {
      const onlineUsers = users.filter(user => user.status === 'online')
      setOnlineTeamCount(onlineUsers.length)
      setTotalTeamCount(users.length)
      setLastUpdated(new Date())
      setIsLoading(false)
    }

    // Listen for user status updates
    const handleUserStatusUpdate = (user: any) => {
      // Update the counts based on the status change
      setLastUpdated(new Date())
      
      // We need to get the full list to recalculate counts accurately
      socket.emit('get-connected-users')
    }

    // Listen for user logout
    const handleUserLoggedOut = (email: string) => {
      setLastUpdated(new Date())
      
      // Get updated list to recalculate counts
      socket.emit('get-connected-users')
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

  const value: TeamStatusContextType = {
    onlineTeamCount,
    totalTeamCount,
    isLoading,
    lastUpdated
  }

  return (
    <TeamStatusContext.Provider value={value}>
      {children}
    </TeamStatusContext.Provider>
  )
}
