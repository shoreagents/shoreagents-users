'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSocket } from '@/contexts/socket-context'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Video, Users, Clock, Wifi, Coffee, Calendar, Heart, Check, X, Toilet, Menu, X as XIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'
import { AnimatedBeam } from '@/components/ui/animated-beam'
// Team chat functionality removed - focusing on online/offline tracking only
import { getCurrentUser } from '@/lib/auth-utils'
import { useTeamAgents, useTeamAuthData, TeamAgent } from '@/hooks/use-team-agents'
import { ConnectedUsersSkeleton } from '@/components/skeleton-loaders'

interface UserStatus {
  email: string
  status: 'online' | 'offline'
  loginTime?: string
  lastSeen?: string
  detailedStatus?: {
    isInMeeting: boolean
    isInBreak: boolean
    isInRestroom: boolean
    isInEvent: boolean
    isGoingToClinic: boolean
    isInClinic: boolean
    currentMeeting: any | null
    currentEvent: any | null
    currentHealthRequest: any | null
    activeBreakId: string | null
    lastUpdated: string
  }
}

interface TeamInfo {
  member_id: number
  company: string
  badge_color?: string
}

export default function ConnectedUsersPage() {
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map())
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<TeamAgent | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number>(1) // TODO: Get from auth context
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')
  const [isAutoSelecting, setIsAutoSelecting] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isAvatarOnlyMode, setIsAvatarOnlyMode] = useState(false)
  const { socket, isConnected } = useSocket()

  // Refs for animated beam
  const containerRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const meetingRef = useRef<HTMLDivElement>(null)
  const breakRef = useRef<HTMLDivElement>(null)
  const restroomRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<HTMLDivElement>(null)
  const healthRef = useRef<HTMLDivElement>(null)

  // Use React Query hooks
  const { 
    data: teamData, 
    isLoading: teamLoading, 
    error: teamError, 
    triggerRealtimeUpdate 
  } = useTeamAgents()
  
  const teamAgents = useMemo(() => teamData?.agents || [], [teamData?.agents])
  const teamInfo = teamData?.team || null
  
  // Get auth data for all team agents
  const { 
    data: userAuthDataMap = new Map(), 
    isLoading: authLoading 
  } = useTeamAuthData(teamAgents)

  // Fix hydration issue by only rendering time on client
  useEffect(() => {
    setMounted(true)
    setLastUpdated(new Date().toLocaleString())

    // Listen for socket reconnection events
    const handleSocketConnected = () => {
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

  // Get current user ID and email from authentication
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser?.id) {
      setCurrentUserId(currentUser.id)
    }
    if (currentUser?.email) {
      setCurrentUserEmail(currentUser.email)
    }
    if (!currentUser?.id && !currentUser?.email) {
      console.warn('⚠️ No authenticated user found')
    }
  }, [])

  // Note: Removed duplicate triggerRealtimeUpdate call - global TeamStatusProvider handles this

  // Auto-select current user when team agents are loaded
  useEffect(() => {
    if (teamAgents.length > 0 && !selectedUser && (currentUserEmail || currentUserId)) {
      setIsAutoSelecting(true)
      
      // Try to find current user by email first (more reliable), then by ID
      let currentUserAgent = teamAgents.find(agent => agent.email === currentUserEmail)
      if (!currentUserAgent && currentUserId) {
        currentUserAgent = teamAgents.find(agent => agent.id === currentUserId)
      }
      
      if (currentUserAgent) {
        setSelectedUser(currentUserAgent)
      } else {
        console.warn('⚠️ Could not find current user in team agents list')
      }
      
      setIsAutoSelecting(false)
    }
  }, [teamAgents, currentUserId, currentUserEmail, selectedUser])

  // Socket integration for real-time status updates
  useEffect(() => {
    if (!socket || !isConnected) {
      return
    }

    
    // Request initial connected users list
    socket.emit('get-connected-users')

    // Listen for connected users list
    const handleConnectedUsersList = (users: UserStatus[]) => {
      const statusMap = new Map<string, UserStatus>()
      users.forEach(user => {
        statusMap.set(user.email, user)
      })
      setUserStatuses(statusMap)
      setLastUpdated(new Date().toLocaleString())
    }

    // Listen for user status updates
    const handleUserStatusUpdate = (user: UserStatus) => {
      setUserStatuses(prev => {
        const updated = new Map(prev)
        updated.set(user.email, user)
        return updated
      })
      setLastUpdated(new Date().toLocaleString())
    }

    // Listen for user logout
    const handleUserLoggedOut = (email: string) => {
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

    // Listen for detailed status updates
    const handleDetailedStatusUpdate = (user: UserStatus) => {
      setUserStatuses(prev => {
        const updated = new Map(prev)
        updated.set(user.email, user)
        return updated
      })
      setLastUpdated(new Date().toLocaleString())
    }

    // Set up event listeners
    socket.on('connected-users-list', handleConnectedUsersList)
    socket.on('user-status-update', handleUserStatusUpdate)
    socket.on('user-logged-out', handleUserLoggedOut)
    socket.on('user-detailed-status-update', handleDetailedStatusUpdate)

    // Cleanup
    return () => {
      socket.off('connected-users-list', handleConnectedUsersList)
      socket.off('user-status-update', handleUserStatusUpdate)
      socket.off('user-logged-out', handleUserLoggedOut)
      socket.off('user-detailed-status-update', handleDetailedStatusUpdate)
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

  // Get status display information for a user
  const getStatusDisplay = (agent: any) => {
    const status = userStatuses.get(agent.email)
    const detailedStatus = status?.detailedStatus

    if (!detailedStatus) {
      return {
        status: status?.status || 'offline',
        statusText: status?.status === 'online' ? 'On duty' : 'Offline',
        statusColor: status?.status === 'online' ? 'green' : 'gray',
        statusIcon: status?.status === 'online' ? 'Wifi' : 'WifiOff',
        subStatus: null,
        subStatusColor: null
      }
    }

    // Priority order: In Clinic > Going to Clinic > In Meeting > In Event > On Break > In Restroom > On duty
    if (detailedStatus.isInClinic) {
      return {
        status: 'online',
        statusText: 'In Clinic',
        statusColor: 'red',
        statusIcon: 'Heart',
        subStatus: 'Health Visit',
        subStatusColor: 'red'
      }
    }
    
    if (detailedStatus.isGoingToClinic) {
      return {
        status: 'online',
        statusText: 'Going to Clinic',
        statusColor: 'red',
        statusIcon: 'Heart',
        subStatus: 'Health Visit',
        subStatusColor: 'red'
      }
    }
    
    if (detailedStatus.isInMeeting) {
      return {
        status: 'online',
        statusText: 'In Meeting',
        statusColor: 'blue',
        statusIcon: 'Video',
        subStatus: detailedStatus.currentMeeting?.title || 'Meeting',
        subStatusColor: 'blue'
      }
    }
    
    if (detailedStatus.isInEvent) {
      return {
        status: 'online',
        statusText: 'In Event',
        statusColor: 'purple',
        statusIcon: 'Calendar',
        subStatus: detailedStatus.currentEvent?.title || 'Event',
        subStatusColor: 'purple'
      }
    }
    
    if (detailedStatus.isInBreak) {
      return {
        status: 'online',
        statusText: 'On Break',
        statusColor: 'orange',
        statusIcon: 'Coffee',
        subStatus: 'Taking a break',
        subStatusColor: 'orange'
      }
    }
    
    if (detailedStatus.isInRestroom) {
      return {
        status: 'online',
        statusText: 'In Restroom',
        statusColor: 'orange',
        statusIcon: 'Coffee',
        subStatus: 'Restroom break',
        subStatusColor: 'orange'
      }
    }

    // Default to on duty
    return {
      status: 'online',
      statusText: 'On duty',
      statusColor: 'green',
      statusIcon: 'Wifi',
      subStatus: null,
      subStatusColor: null
    }
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

  // Calculate status counts
  const statusCounts = {
    inMeeting: 0,
    onBreak: 0,
    inRestroom: 0,
    inEvent: 0,
    goingToClinic: 0,
    inClinic: 0,
    available: 0
  }

  onlineAgents.forEach(agent => {
    const statusDisplay = getStatusDisplay(agent)
    if (statusDisplay.statusText === 'In Meeting') statusCounts.inMeeting++
    else if (statusDisplay.statusText === 'On Break') statusCounts.onBreak++
    else if (statusDisplay.statusText === 'In Restroom') statusCounts.inRestroom++
    else if (statusDisplay.statusText === 'In Event') statusCounts.inEvent++
    else if (statusDisplay.statusText === 'Going to Clinic') statusCounts.goingToClinic++
    else if (statusDisplay.statusText === 'In Clinic') statusCounts.inClinic++
    else if (statusDisplay.statusText === 'On duty') statusCounts.available++
  })

  // Combined loading state
  const loading = teamLoading || authLoading
  const error = teamError?.message || null

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <ConnectedUsersSkeleton />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                    <Users className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="text-lg font-medium text-red-600 dark:text-red-400">❌ Error loading team agents</p>
                  <p className="text-muted-foreground">{error}</p>
                  <Button 
                    onClick={triggerRealtimeUpdate}
                    className="mt-4"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex-1 h-screen bg-background">
          {/* Header */}
          <div className="bg-card border-b border-border px-2 sm:px-2 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Team Status</h1>
                </div>
              </div>
            </div>
          </div>

          {/* Status Overview Cards */}
          <div className="bg-card border-b border-border px-4 sm:px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4">
              {/* In Meeting */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Video className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-blue-600">{statusCounts.inMeeting}</div>
                <div className="text-xs text-blue-600 font-medium">In Meeting</div>
              </div>

              {/* On Break */}
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Coffee className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-orange-600">{statusCounts.onBreak}</div>
                <div className="text-xs text-orange-600 font-medium">On Break</div>
              </div>

              {/* In Restroom */}
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Toilet className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-orange-600">{statusCounts.inRestroom}</div>
                <div className="text-xs text-orange-600 font-medium">Restroom</div>
              </div>

              {/* In Event */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-purple-600">{statusCounts.inEvent}</div>
                <div className="text-xs text-purple-600 font-medium">In Event</div>
              </div>

              {/* Going to Clinic */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Heart className="w-4 h-4 sm:w-6 sm:h-6 text-red-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-red-600">{statusCounts.goingToClinic}</div>
                <div className="text-xs text-red-600 font-medium">Going to Clinic</div>
              </div>

              {/* In Clinic */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Heart className="w-4 h-4 sm:w-6 sm:h-6 text-red-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-red-600">{statusCounts.inClinic}</div>
                <div className="text-xs text-red-600 font-medium">In Clinic</div>
              </div>

              {/* On duty */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 sm:p-3 text-center">
                <Wifi className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 mx-auto mb-1" />
                <div className="text-lg sm:text-2xl font-bold text-green-600">{statusCounts.available}</div>
                <div className="text-xs text-green-600 font-medium">On duty</div>
              </div>
            </div>
          </div>

          <div className="flex h-full relative">
            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            )}


            {/* Left Sidebar - User List */}
            <div className={`${isAvatarOnlyMode ? 'w-20' : 'w-80'} bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out ${
              isMobileSidebarOpen 
                ? 'fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0' 
                : 'hidden md:flex'
            }`}>
              {/* Search and Refresh Bar */}
              {!isAvatarOnlyMode && (
                <div className="p-4 border-b border-border space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search team members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {filteredAgents.length} of {teamAgents.length} members
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAvatarOnlyMode(!isAvatarOnlyMode)}
                      className="h-8 px-2 text-xs"
                    >
                      <Menu className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Avatar-only mode header */}
              {isAvatarOnlyMode && (
                <div className="p-2 border-b border-border">
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAvatarOnlyMode(false)}
                      className="h-8 px-2 text-xs"
                    >
                      <Menu className="w-3 h-3" />
                    </Button>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {onlineAgents.length} online
                    </div>
                  </div>
                </div>
              )}

              {/* Online Users Section */}
              <div className="flex-1 overflow-y-auto">
                {onlineAgents.length > 0 && (
                  <div className={isAvatarOnlyMode ? "p-2" : "p-4"}>
                    {!isAvatarOnlyMode && (
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Online Now</span>
                        <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {onlineAgents.length}
                        </Badge>
                      </div>
                    )}
                    <div className={isAvatarOnlyMode ? "flex flex-col items-center space-y-3" : "space-y-2"}>
                      {onlineAgents.map((agent) => {
                        const statusDisplay = getStatusDisplay(agent)
                        return (
                          <div
                            key={agent.email}
                            onClick={() => {
                              setSelectedUser(agent);
                              if (window.innerWidth < 768) {
                                setIsMobileSidebarOpen(false);
                              }
                            }}
                            className={`${
                              isAvatarOnlyMode 
                                ? 'flex flex-col items-center p-1 rounded-lg transition-all duration-200 hover:bg-muted cursor-pointer' 
                                : 'flex items-center space-x-3 p-3 rounded-lg transition-all duration-200'
                            } ${
                              selectedUser?.email === agent.email
                                ? 'bg-primary/10 border border-primary/20 cursor-pointer shadow-sm'
                                : 'hover:bg-muted cursor-pointer hover:shadow-sm'
                            }`}
                          >
                            <div className="relative">
                              {isAvatarOnlyMode ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className={`w-12 h-12 ring-2 ${
                                      statusDisplay.statusColor === 'green' ? 'ring-green-200 dark:ring-green-800' :
                                      statusDisplay.statusColor === 'blue' ? 'ring-blue-200 dark:ring-blue-800' :
                                      statusDisplay.statusColor === 'orange' ? 'ring-orange-200 dark:ring-orange-800' :
                                      statusDisplay.statusColor === 'purple' ? 'ring-purple-200 dark:ring-purple-800' :
                                      statusDisplay.statusColor === 'red' ? 'ring-red-200 dark:ring-red-800' :
                                      'ring-gray-200 dark:ring-gray-800'
                                    }`}>
                                      <AvatarImage src={agent.avatar} />
                                      <AvatarFallback className={`${
                                        statusDisplay.statusColor === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        statusDisplay.statusColor === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                        statusDisplay.statusColor === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                        statusDisplay.statusColor === 'purple' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                        statusDisplay.statusColor === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                      }`}>
                                        {getInitials(agent.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{agent.name || agent.email.split('@')[0]}</p>
                                    <p className="text-xs text-muted-foreground">{statusDisplay.statusText}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Avatar className={`w-10 h-10 ring-2 ${
                                  statusDisplay.statusColor === 'green' ? 'ring-green-200 dark:ring-green-800' :
                                  statusDisplay.statusColor === 'blue' ? 'ring-blue-200 dark:ring-blue-800' :
                                  statusDisplay.statusColor === 'orange' ? 'ring-orange-200 dark:ring-orange-800' :
                                  statusDisplay.statusColor === 'purple' ? 'ring-purple-200 dark:ring-purple-800' :
                                  statusDisplay.statusColor === 'red' ? 'ring-red-200 dark:ring-red-800' :
                                  'ring-gray-200 dark:ring-gray-800'
                                }`}>
                                  <AvatarImage src={agent.avatar} />
                                  <AvatarFallback className={`${
                                    statusDisplay.statusColor === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                    statusDisplay.statusColor === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    statusDisplay.statusColor === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                    statusDisplay.statusColor === 'purple' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                    statusDisplay.statusColor === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white dark:border-gray-800 rounded-full ${
                                statusDisplay.status === 'online' ? 'animate-pulse' : ''
                              } ${
                                statusDisplay.statusColor === 'green' ? 'bg-green-500' :
                                statusDisplay.statusColor === 'blue' ? 'bg-blue-500' :
                                statusDisplay.statusColor === 'orange' ? 'bg-orange-500' :
                                statusDisplay.statusColor === 'purple' ? 'bg-purple-500' :
                                statusDisplay.statusColor === 'red' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`}></div>
                            </div>
                            {!isAvatarOnlyMode && (
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {agent.name || agent.email.split('@')[0]}
                                  </p>
                                  {currentUserId === agent.id && (
                                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`text-xs font-medium ${
                                    statusDisplay.statusColor === 'green' ? 'text-green-600 dark:text-green-400' :
                                    statusDisplay.statusColor === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                                    statusDisplay.statusColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                                    statusDisplay.statusColor === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                                    statusDisplay.statusColor === 'red' ? 'text-red-600 dark:text-red-400' :
                                    'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {statusDisplay.statusText}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Offline Users Section */}
                {offlineAgents.length > 0 && (
                  <div className={`${isAvatarOnlyMode ? "p-2" : "p-4"} border-t border-gray-200 dark:border-gray-700`}>
                    {!isAvatarOnlyMode && (
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Offline</span>
                        <Badge variant="secondary" className="ml-auto text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {offlineAgents.length}
                        </Badge>
                      </div>
                    )}
                    <div className={isAvatarOnlyMode ? "flex flex-col items-center space-y-3" : "space-y-2"}>
                      {offlineAgents.map((agent) => (
                        <div
                          key={agent.email}
                          onClick={() => {
                            setSelectedUser(agent);
                            if (window.innerWidth < 768) {
                              setIsMobileSidebarOpen(false);
                            }
                          }}
                          className={`${
                            isAvatarOnlyMode 
                              ? 'flex flex-col items-center p-1 rounded-lg transition-all duration-200 hover:bg-muted cursor-pointer' 
                              : 'flex items-center space-x-3 p-3 rounded-lg transition-all duration-200'
                          } ${
                            selectedUser?.email === agent.email
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer shadow-sm'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer hover:shadow-sm'
                          }`}
                        >
                          {isAvatarOnlyMode ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar className="w-12 h-12 ring-2 ring-gray-200 dark:ring-gray-700">
                                  <AvatarImage src={agent.avatar} />
                                  <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{agent.name || agent.email.split('@')[0]}</p>
                                <p className="text-xs text-muted-foreground">Offline</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Avatar className="w-10 h-10 ring-2 ring-gray-200 dark:ring-gray-700">
                              <AvatarImage src={agent.avatar} />
                              <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {getInitials(agent.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {!isAvatarOnlyMode && (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {agent.name || agent.email.split('@')[0]}
                                </p>
                                {currentUserId === agent.id && (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {agent.lastSeen ? `Last seen ${formatRelativeTime(agent.lastSeen)}` : 'Never online'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results State */}
                {filteredAgents.length === 0 && searchQuery && (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center space-y-3">
                      <Search className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">No team members found</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No results for "{searchQuery}"
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                        className="text-xs"
                      >
                        Clear search
                      </Button>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {filteredAgents.length === 0 && !searchQuery && (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center space-y-3">
                      <Users className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">No team members</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No team members found in your organization
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

                        {/* Right Panel - User Details */}
            <div className="flex-1 bg-card">
              {selectedUser ? (
                <div className="h-full flex flex-col">
                  {/* User Details Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <Avatar className="w-12 h-12 sm:w-16 sm:h-16">
                        <AvatarImage src={selectedUser.avatar} />
                        <AvatarFallback className="text-lg sm:text-xl">
                          {getInitials(selectedUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                          {selectedUser.name || selectedUser.email.split('@')[0]}
                        </h3>
                        <p className="text-sm sm:text-base text-muted-foreground truncate">{selectedUser.email}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                            {teamInfo?.company || 'Team Member'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Status Details - Bento Grid */}
                  <div className="flex-1 p-4 sm:p-6">
                    {(() => {
                      const statusDisplay = getStatusDisplay(selectedUser)
                      const detailedStatus = userStatuses.get(selectedUser.email)?.detailedStatus
                      
                      return (
                        <BentoGrid className="max-w-7xl mx-auto">
                          {/* Status Details - Wide card with animated beam */}
                          {detailedStatus && (
                            <BentoGridItem
                              title="Status Details"
                              description="Detailed activity status"
                              header={
                                <div ref={containerRef} className="relative flex items-center justify-center h-full w-full">
                                  {/* Center Avatar */}
                                  <div 
                                    ref={avatarRef}
                                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
                                  >
                                    <Avatar className="w-16 h-16 ring-4 ring-primary/20">
                                      <AvatarImage src={selectedUser.avatar} />
                                      <AvatarFallback className="text-lg">
                                        {getInitials(selectedUser.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>

                                  {/* Status Items positioned around the avatar */}
                                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <div 
                                      ref={meetingRef}
                                      className="flex flex-col items-center space-y-2"
                                    >
                                      <span className="text-xs text-center text-muted-foreground">Meeting</span>

                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        detailedStatus.isInMeeting ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'
                                      }`}>
                                        {detailedStatus.isInMeeting ? (
                                          <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        ) : (
                                          <X className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="absolute top-[55%] -right-1 transform -translate-y-1/2">
                                    <div 
                                      ref={breakRef}
                                      className="flex flex-col items-center space-y-2"
                                    >
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        detailedStatus.isInBreak ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-gray-100 dark:bg-gray-800'
                                      }`}>
                                        {detailedStatus.isInBreak ? (
                                          <Check className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                        ) : (
                                          <X className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                      <span className="text-xs text-center text-muted-foreground">Break</span>
                                    </div>
                                  </div>

                                  <div className="absolute -bottom-3 right-[24%] transform translate-x-1/2">
                                    <div 
                                      ref={restroomRef}
                                      className="flex flex-col items-center space-y-2"
                                    >
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        detailedStatus.isInRestroom ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-gray-100 dark:bg-gray-800'
                                      }`}>
                                        {detailedStatus.isInRestroom ? (
                                          <Check className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                        ) : (
                                          <X className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                      <span className="text-xs text-center text-muted-foreground">Restroom</span>
                                    </div>
                                  </div>

                                  <div className="absolute -bottom-3 left-[24%] transform -translate-x-1/2">
                                    <div 
                                      ref={eventRef}
                                      className="flex flex-col items-center space-y-2"
                                    >
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        detailedStatus.isInEvent ? 'bg-purple-100 dark:bg-purple-900/20' : 'bg-gray-100 dark:bg-gray-800'
                                      }`}>
                                        {detailedStatus.isInEvent ? (
                                          <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                        ) : (
                                          <X className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                      <span className="text-xs text-center text-muted-foreground">Event</span>
                                    </div>
                                  </div>

                                  <div className="absolute top-[53%] -left-1 transform -translate-y-1/2">
                                    <div 
                                      ref={healthRef}
                                      className="flex flex-col items-center space-y-2"
                                    >
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        detailedStatus.isGoingToClinic || detailedStatus.isInClinic ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-800'
                                      }`}>
                                        {detailedStatus.isGoingToClinic || detailedStatus.isInClinic ? (
                                          <Check className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        ) : (
                                          <X className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                      <span className="text-xs text-center text-muted-foreground">Health</span>
                                    </div>
                                  </div>

                                  {/* Static Lines - All connections */}
                                  {containerRef.current && avatarRef.current && meetingRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={meetingRef}
                                      curvature={20}
                                      duration={0}
                                      delay={0}
                                      pathColor="#6b7280"
                                      gradientStartColor="#6b7280"
                                      gradientStopColor="#6b7280"
                                      pathOpacity={0.3}
                                      pathWidth={1}
                                    />
                                  )}
                                  {containerRef.current && avatarRef.current && breakRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={breakRef}
                                      curvature={20}
                                      duration={0}
                                      delay={0}
                                      pathColor="#6b7280"
                                      gradientStartColor="#6b7280"
                                      gradientStopColor="#6b7280"
                                      pathOpacity={0.3}
                                      pathWidth={1}
                                    />
                                  )}
                                  {containerRef.current && avatarRef.current && restroomRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={restroomRef}
                                      curvature={20}
                                      duration={0}
                                      delay={0}
                                      pathColor="#6b7280"
                                      gradientStartColor="#6b7280"
                                      gradientStopColor="#6b7280"
                                      pathOpacity={0.3}
                                      pathWidth={1}
                                    />
                                  )}
                                  {containerRef.current && avatarRef.current && eventRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={eventRef}
                                      curvature={20}
                                      duration={0}
                                      delay={0}
                                      pathColor="#6b7280"
                                      gradientStartColor="#6b7280"
                                      gradientStopColor="#6b7280"
                                      pathOpacity={0.3}
                                      pathWidth={1}
                                    />
                                  )}
                                  {containerRef.current && avatarRef.current && healthRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={healthRef}
                                      curvature={20}
                                      duration={0}
                                      delay={0}
                                      pathColor="#6b7280"
                                      gradientStartColor="#6b7280"
                                      gradientStopColor="#6b7280"
                                      pathOpacity={0.3}
                                      pathWidth={1}
                                    />
                                  )}

                                  {/* Animated Beams - Only for active statuses */}
                                  {detailedStatus.isInMeeting && containerRef.current && avatarRef.current && meetingRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={meetingRef}
                                      curvature={20}
                                      duration={3}
                                      delay={0}
                                      pathColor="#3b82f6"
                                      gradientStartColor="#3b82f6"
                                      gradientStopColor="#1d4ed8"
                                    />
                                  )}
                                  {detailedStatus.isInBreak && containerRef.current && avatarRef.current && breakRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={breakRef}
                                      curvature={20}
                                      duration={3}
                                      delay={0.5}
                                      pathColor="#f97316"
                                      gradientStartColor="#f97316"
                                      gradientStopColor="#ea580c"
                                    />
                                  )}
                                  {detailedStatus.isInRestroom && containerRef.current && avatarRef.current && restroomRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={restroomRef}
                                      curvature={20}
                                      duration={3}
                                      delay={1}
                                      pathColor="#f97316"
                                      gradientStartColor="#f97316"
                                      gradientStopColor="#ea580c"
                                    />
                                  )}
                                  {detailedStatus.isInEvent && containerRef.current && avatarRef.current && eventRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={eventRef}
                                      curvature={20}
                                      duration={3}
                                      delay={1.5}
                                      pathColor="#a855f7"
                                      gradientStartColor="#a855f7"
                                      gradientStopColor="#9333ea"
                                    />
                                  )}
                                  {(detailedStatus.isGoingToClinic || detailedStatus.isInClinic) && containerRef.current && avatarRef.current && healthRef.current && (
                                    <AnimatedBeam
                                      containerRef={containerRef}
                                      fromRef={avatarRef}
                                      toRef={healthRef}
                                      curvature={20}
                                      duration={3}
                                      delay={2}
                                      pathColor="#ef4444"
                                      gradientStartColor="#ef4444"
                                      gradientStopColor="#dc2626"
                                    />
                                  )}
                                </div>
                              }
                              className="md:col-span-2 md:row-span-2"
                            />
                          )}

                          {/* Current Status - Large card */}
                          <BentoGridItem
                            title="Current Status"
                            description={statusDisplay.statusText}
                            header={
                              <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center space-y-3">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                    statusDisplay.statusColor === 'green' ? 'bg-green-100 dark:bg-green-900/20' :
                                    statusDisplay.statusColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/20' :
                                    statusDisplay.statusColor === 'orange' ? 'bg-orange-100 dark:bg-orange-900/20' :
                                    statusDisplay.statusColor === 'purple' ? 'bg-purple-100 dark:bg-purple-900/20' :
                                    statusDisplay.statusColor === 'red' ? 'bg-red-100 dark:bg-red-900/20' :
                                    'bg-gray-100 dark:bg-gray-800'
                                  }`}>
                                    <div className={`w-6 h-6 rounded-full ${
                                      statusDisplay.statusColor === 'green' ? 'bg-green-500' :
                                      statusDisplay.statusColor === 'blue' ? 'bg-blue-500' :
                                      statusDisplay.statusColor === 'orange' ? 'bg-orange-500' :
                                      statusDisplay.statusColor === 'purple' ? 'bg-purple-500' :
                                      statusDisplay.statusColor === 'red' ? 'bg-red-500' :
                                      'bg-gray-400'
                                    } ${statusDisplay.status === 'online' ? 'animate-pulse' : ''}`}></div>
                                  </div>
                                  <span className={`text-xl font-bold ${
                                    statusDisplay.statusColor === 'green' ? 'text-green-600 dark:text-green-400' :
                                    statusDisplay.statusColor === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                                    statusDisplay.statusColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                                    statusDisplay.statusColor === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                                    statusDisplay.statusColor === 'red' ? 'text-red-600 dark:text-red-400' :
                                    'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {statusDisplay.statusText}
                                  </span>
                                </div>
                              </div>
                            }
                            className="md:col-span-1 md:row-span-1"
                          />

                          {/* Last Activity - Medium card */}
                          <BentoGridItem
                            title="Last Activity"
                            description={userStatuses.get(selectedUser.email)?.lastSeen ? 
                              formatRelativeTime(userStatuses.get(selectedUser.email)?.lastSeen || '') : 
                              'Never online'
                            }
                            header={
                              <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center space-y-2">
                                  <Clock className={`w-10 h-10 ${
                                    userStatuses.get(selectedUser.email)?.lastSeen ? 
                                      'text-blue-600 dark:text-blue-400' : 
                                      'text-gray-400 dark:text-gray-500'
                                  }`} />
                                  <span className={`text-lg font-semibold ${
                                    userStatuses.get(selectedUser.email)?.lastSeen ? 
                                      'text-gray-900 dark:text-white' : 
                                      'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {userStatuses.get(selectedUser.email)?.lastSeen ? 
                                      formatRelativeTime(userStatuses.get(selectedUser.email)?.lastSeen || '') : 
                                      'Never online'
                                    }
                                  </span>
                                </div>
                              </div>
                            }
                            className="md:col-span-1"
                          />

                          {/* Last Sign In - Medium card */}
                          <BentoGridItem
                            title="Last Sign In"
                            description={userAuthDataMap.get(selectedUser.email)?.last_sign_in_at ? 
                              formatRelativeTime(userAuthDataMap.get(selectedUser.email)?.last_sign_in_at || '') :
                              userStatuses.get(selectedUser.email)?.loginTime ?
                                formatRelativeTime(userStatuses.get(selectedUser.email)?.loginTime || '') :
                                'Never signed in'
                            }
                            header={
                              <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center space-y-2">
                                  <Wifi className={`w-10 h-10 ${
                                    userAuthDataMap.get(selectedUser.email)?.last_sign_in_at || userStatuses.get(selectedUser.email)?.loginTime ? 
                                      'text-green-600 dark:text-green-400' : 
                                      'text-gray-400 dark:text-gray-500'
                                  }`} />
                                  <span className={`text-lg font-semibold ${
                                    userAuthDataMap.get(selectedUser.email)?.last_sign_in_at || userStatuses.get(selectedUser.email)?.loginTime ? 
                                      'text-gray-900 dark:text-white' : 
                                      'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {userAuthDataMap.get(selectedUser.email)?.last_sign_in_at ? 
                                      formatRelativeTime(userAuthDataMap.get(selectedUser.email)?.last_sign_in_at || '') :
                                      userStatuses.get(selectedUser.email)?.loginTime ?
                                        formatRelativeTime(userStatuses.get(selectedUser.email)?.loginTime || '') :
                                        'Never signed in'
                                    }
                                  </span>
                                </div>
                              </div>
                            }
                            className="md:col-span-3"
                          />
                        </BentoGrid>
                      )
                    })()}
                  </div>
                </div>
              ) : (
                /* Welcome State */
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                      <Users className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                      Select a team member
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-md">
                      Click on any team member to view their online status and activity details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  )
}


