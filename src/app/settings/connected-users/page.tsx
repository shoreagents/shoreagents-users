'use client'

import { useState, useEffect } from 'react'
import { useSocket } from '@/contexts/socket-context'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, MoreVertical, Phone, Video, Users, Clock, Wifi, WifiOff } from 'lucide-react'
import TeamChat from '@/components/team-chat'
import { getCurrentUser } from '@/lib/auth-utils'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<TeamAgent | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number>(1) // TODO: Get from auth context
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

  // Get current user ID from authentication
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser?.id) {
      setCurrentUserId(currentUser.id)
      console.log('🔐 Current user ID:', currentUser.id)
    } else {
      console.warn('⚠️ No authenticated user found')
    }
  }, [])

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

  const formatRelativeTime = (timeString?: string) => {
    if (!timeString) return 'Never'
    try {
      const date = new Date(timeString)
      const now = new Date()
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      
      if (diffInMinutes < 1) return 'Just now'
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    } catch {
      return 'Unknown'
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

  // Filter agents based on search query
  const filteredAgents = agentsWithStatus.filter(agent => 
    agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const onlineAgents = filteredAgents.filter(agent => agent.status === 'online')
  const offlineAgents = filteredAgents.filter(agent => agent.status === 'offline')

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
        <div className="flex-1 h-screen bg-gray-50 dark:bg-gray-900">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h1>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {teamInfo?.company || 'Team'}
                </Badge>
            </div>
              <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  {onlineAgents.length} online
              </Badge>
              </div>
            </div>
          </div>

          <div className="flex h-full">
            {/* Left Sidebar - User List */}
            <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {/* Search Bar */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search team members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                  />
            </div>
          </div>

              {/* Online Users Section */}
              <div className="flex-1 overflow-y-auto">
                {onlineAgents.length > 0 && (
                  <div className="p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Online</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {onlineAgents.length}
                      </Badge>
                </div>
                    <div className="space-y-1">
                      {onlineAgents.map((agent) => (
                        <div
                          key={agent.email}
                          onClick={() => {
                            // Prevent users from selecting themselves
                            if (currentUserId === agent.id) {
                              console.log('⚠️ Cannot chat with yourself');
                              return;
                            }
                            setSelectedUser(agent);
                          }}
                          className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                            currentUserId === agent.id 
                              ? 'opacity-50 cursor-not-allowed' // Disabled state for self
                              : selectedUser?.email === agent.email
                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                          }`}
                        >
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={agent.avatar} />
                              <AvatarFallback className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:bg-blue-200">
                            {getInitials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {agent.name || agent.email.split('@')[0]}
                              </p>
                              {currentUserId === agent.id && (
                                <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  You (Cannot chat)
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-green-600 dark:text-green-400 truncate">
                              Active now
                          </p>
                        </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Offline Users Section */}
                {offlineAgents.length > 0 && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Offline</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {offlineAgents.length}
                        </Badge>
                      </div>
                    <div className="space-y-1">
                      {offlineAgents.map((agent) => (
                        <div
                          key={agent.email}
                          onClick={() => {
                            // Prevent users from selecting themselves
                            if (currentUserId === agent.id) {
                              console.log('⚠️ Cannot chat with yourself');
                              return;
                            }
                            setSelectedUser(agent);
                          }}
                          className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                            currentUserId === agent.id 
                              ? 'opacity-50 cursor-not-allowed' // Disabled state for self
                              : selectedUser?.email === agent.email
                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer opacity-75'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer opacity-75'
                          }`}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={agent.avatar} />
                            <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {getInitials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {agent.name || agent.email.split('@')[0]}
                              </p>
                              {currentUserId === agent.id && (
                                <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  You (Cannot chat)
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {agent.lastSeen ? `Last seen ${formatRelativeTime(agent.lastSeen)}` : 'Never online'}
                          </p>
                        </div>
                          </div>
                        ))}
                      </div>
            </div>
          )}
              </div>
            </div>

                        {/* Right Panel - User Details or Chat */}
            <div className="flex-1 bg-white dark:bg-gray-800">
              {selectedUser && currentUserId ? (
                <TeamChat
                  selectedUser={selectedUser}
                  onBack={() => {
                    setSelectedUser(null);
                  }}
                  currentUserId={currentUserId}
                />
              ) : (
                /* Welcome State */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                      <Users className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Select a team member
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md">
                      Click on any team member to start chatting with them
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}