'use client'

import { useState, useEffect } from 'react'
import { useSocket } from '@/hooks/use-socket'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

interface TeamAgent {
  id: number
  email: string
  name: string
  avatar?: string
  member_id: number
  team_name: string
}

interface UserStatus {
  email: string
  status: 'online' | 'offline'
  loginTime?: string
  lastSeen?: string
}

interface TeamInfo {
  member_id: number
  company: string
  badge_color?: string
}

export default function ConnectedUsersPage() {
  const [teamAgents, setTeamAgents] = useState<TeamAgent[]>([])
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map())
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const { socket, isConnected } = useSocket()

  // Fix hydration issue by only rendering time on client
  useEffect(() => {
    setMounted(true)
    setLastUpdated(new Date().toLocaleString())

    // Listen for socket reconnection events
    const handleSocketConnected = () => {
      console.log('🔌 Socket reconnected - refreshing user status')
      setLastUpdated(new Date().toLocaleString())
      
      // Small delay to ensure socket is fully ready
      setTimeout(() => {
        if (socket && socket.connected) {
          socket.emit('get-connected-users')
        }
      }, 500)
    }

    window.addEventListener('socket-connected', handleSocketConnected)
    
    return () => {
      window.removeEventListener('socket-connected', handleSocketConnected)
    }
  }, [socket])

  // Fetch team agents from API
  const fetchTeamAgents = async () => {
    try {
      const response = await fetch('/api/agents/team')
      const data = await response.json()
      
      if (data.success) {
        setTeamAgents(data.agents || [])
        setTeamInfo(data.team || null)
        console.log('📋 Loaded team agents:', data.agents)
      } else {
        setError(data.error || 'Failed to load team agents')
      }
    } catch (err) {
      console.error('Error fetching team agents:', err)
      setError('Failed to fetch team agents')
    } finally {
      setLoading(false)
    }
  }

  // Load team agents on component mount
  useEffect(() => {
    fetchTeamAgents()
  }, [])

  // Socket integration for real-time status updates
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('Socket not connected, waiting for connection...')
      return
    }

    console.log('🔌 Socket connected, requesting user status updates')
    
    // Request initial connected users list
    socket.emit('get-connected-users')

    // Listen for connected users list
    const handleConnectedUsersList = (users: UserStatus[]) => {
      console.log('📋 Received socket users list:', users)
      const statusMap = new Map<string, UserStatus>()
      users.forEach(user => {
        statusMap.set(user.email, user)
      })
      setUserStatuses(statusMap)
      setLastUpdated(new Date().toLocaleString())
    }

    // Listen for user status updates
    const handleUserStatusUpdate = (user: UserStatus) => {
      console.log('👤 User status update:', user)
      setUserStatuses(prev => {
        const updated = new Map(prev)
        updated.set(user.email, user)
        return updated
      })
      setLastUpdated(new Date().toLocaleString())
    }

    // Listen for user logout
    const handleUserLoggedOut = (email: string) => {
      console.log('🚪 User logged out:', email)
      setUserStatuses(prev => {
        const updated = new Map(prev)
        const existing = updated.get(email)
        if (existing) {
          updated.set(email, {
            ...existing,
            status: 'offline',
            lastSeen: new Date().toISOString()
          })
        }
        return updated
      })
      setLastUpdated(new Date().toLocaleString())
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

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A'
    try {
      const date = new Date(timeString)
      return date.toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '??'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Combine team agents with their online status
  const agentsWithStatus = teamAgents.map(agent => {
    const status = userStatuses.get(agent.email)
    return {
      ...agent,
      status: status?.status || 'offline',
      loginTime: status?.loginTime,
      lastSeen: status?.lastSeen
    }
  })

  const onlineAgents = agentsWithStatus.filter(agent => agent.status === 'online')
  const offlineAgents = agentsWithStatus.filter(agent => agent.status === 'offline')

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-red-500 mb-2">❌ Error loading team agents</p>
                  <p className="text-muted-foreground">{error}</p>
                  <button 
                    onClick={fetchTeamAgents}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    Retry
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Team Status</h2>
              {teamInfo && (
                <p className="text-muted-foreground">
                  {teamInfo.company} Team (Member ID: {teamInfo.member_id})
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </Badge>
              <Badge variant="outline">
                Total: {agentsWithStatus.length}
              </Badge>
              <Badge variant="outline" className="bg-green-50">
                Online: {onlineAgents.length}
              </Badge>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading team agents...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Online Agents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Online Team Members
                    <Badge variant="secondary">{onlineAgents.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Team members currently logged in and active
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {onlineAgents.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No team members currently online
                    </p>
                  ) : (
                    onlineAgents.map((agent) => (
                      <div key={agent.email} className="flex items-center space-x-3 p-3 rounded-lg border">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {agent.name || agent.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {agent.email}
                          </p>
                          <p className="text-xs text-green-600">
                            Online since: {formatTime(agent.loginTime)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Online
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Offline Agents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    Offline Team Members
                    <Badge variant="secondary">{offlineAgents.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Team members who are currently offline
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {offlineAgents.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      All team members are online! 🎉
                    </p>
                  ) : (
                    offlineAgents.map((agent) => (
                      <div key={agent.email} className="flex items-center space-x-3 p-3 rounded-lg border opacity-75">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {agent.name || agent.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {agent.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            {agent.lastSeen ? `Last seen: ${formatTime(agent.lastSeen)}` : 'Never logged in'}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-gray-100 text-gray-600">
                          Offline
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Team Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Team Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-green-600">{onlineAgents.length}</p>
                  <p className="text-sm text-muted-foreground">Online Now</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-gray-500">{offlineAgents.length}</p>
                  <p className="text-sm text-muted-foreground">Offline</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-blue-600">{agentsWithStatus.length}</p>
                  <p className="text-sm text-muted-foreground">Total Team</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-purple-600">
                    {agentsWithStatus.length > 0 ? Math.round((onlineAgents.length / agentsWithStatus.length) * 100) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Online Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debug Info */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Socket Status:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
                <p><strong>Team:</strong> {teamInfo?.company || 'Loading...'}</p>
                <p><strong>Member ID:</strong> {teamInfo?.member_id || 'Loading...'}</p>
                <p><strong>Team Size:</strong> {agentsWithStatus.length}</p>
                <p><strong>Socket Users Tracked:</strong> {userStatuses.size}</p>
                {mounted && (
                  <p><strong>Last Updated:</strong> {lastUpdated || 'Never'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}