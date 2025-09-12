"use client"

import React, { useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { HeaderUser } from "@/components/header-user"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getCurrentUser } from "@/lib/ticket-utils"
import { Bell, CheckCircle, AlertCircle, Info, Clock, ArrowRight, CheckSquare, FileText, Sun, Moon, Users, Heart, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { 
  getNotifications, 
  getUnreadCount, 
  markNotificationAsRead, 
  initializeNotificationChecking,
  addSampleNotifications,
  formatTimeAgo,
  clearAllNotifications,
} from "@/lib/notification-service"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BellNotificationsSkeleton } from "@/components/skeleton-loaders"
import { useNotificationsSocketContext } from "@/hooks/use-notifications-socket-context"
import { useTeamStatus } from "@/contexts/team-status-context"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GlobalSearch } from "@/components/global-search"
import { SwipeableNotificationItem } from "@/components/swipeable-notification-item"

interface BreadcrumbItem {
  title: string
  href?: string
  isCurrent?: boolean
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[]
  showUser?: boolean
}

// Function to truncate long notification messages
function truncateNotificationMessage(message: string, maxLength: number =80): string {
  if (message.length <= maxLength) {
    return message
  }
  
  // Find the last space before the max length to avoid cutting words
  const truncated = message.substring(0, maxLength)
  const lastSpaceIndex = truncated.lastIndexOf(' ')
  
  if (lastSpaceIndex > maxLength * 0.7) {
    // If we found a space in a reasonable position, cut there
    return message.substring(0, lastSpaceIndex) + '...'
  } else {
    // Otherwise, just cut at max length and add ellipsis
    return truncated + '...'
  }
}

export const AppHeader = React.memo(function AppHeader({ breadcrumbs, showUser = true }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{
    name: string
    email: string
    avatar: string
  } | null>(null) // Start with null to show loading state
  const [userLoading, setUserLoading] = useState(true)

  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingBell, setLoadingBell] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  // Trigger periodic re-render so formatTimeAgo updates (e.g., "Just now" -> "1 minute ago")
  const [nowTick, setNowTick] = useState<number>(() => Date.now())

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter(notification => !notification.read)
    }
    return notifications
  }, [notifications, activeTab])

  // Start socket listener for DB notifications. The hook reacts to email changes.
  const { 
    notifications: socketNotifications, 
    unreadCount: socketUnreadCount, 
    isConnected: socketConnected,
    fetchNotifications,
    markAllAsRead,
    markAsRead,
    deleteNotification,
    clearAll: clearAllSocket
  } = useNotificationsSocketContext(user?.email || null)

  // Initialize socket context notifications when user is available
  useEffect(() => {
    if (user?.email && socketConnected) {
      fetchNotifications(0, 8, 0) // userId parameter is not used anymore
    }
  }, [user?.email, socketConnected, fetchNotifications])

  // Sync app-header notifications with socket context
  useEffect(() => {
    if (socketNotifications && socketNotifications.length > 0) {
      // Map socket notifications to the format expected by app-header
      const mappedNotifications = socketNotifications.map((n: any) => {
        const payload = n.payload || {}
        const actionUrl = payload.action_url
          || (n.category === 'ticket' && (payload.ticket_id || payload.ticket_row_id) ? `/forms/${payload.ticket_id || ''}` : undefined)
          || (n.category === 'break' ? '/status/breaks' : undefined)
          || (n.category === 'health_check' ? '/status/health' : undefined)
        const icon = n.category === 'ticket' ? 'FileText' : n.category === 'break' ? 'Clock' : n.category === 'health_check' ? 'Heart' : 'Bell'
        return {
          id: `db_${n.id}`,
          type: n.type,
          title: n.title,
          message: n.message,
          time: (require('@/lib/notification-service') as any).parseDbTimestampToMs(n.created_at, n.category),
          read: !!n.is_read,
          icon,
          actionData: payload,
          category: n.category,
          priority: 'medium' as const,
          eventType: 'system' as const,
        }
      })
      
      setNotifications(mappedNotifications)
    }
  }, [socketNotifications])

  // Removed periodic refresh - it was causing excessive API calls
  // Socket context should handle real-time updates automatically

  // Initialize notification checking
  useEffect(() => {
    initializeNotificationChecking()
    
    // Only add welcome notification if no notifications exist
    const existingNotifications = getNotifications()
    if (existingNotifications.length === 0) {
      addSampleNotifications() // Add welcome notification only
    }
    
    // Expose getUnreadCount globally for Electron to access
    if (typeof window !== 'undefined') {
      (window as any).getUnreadCount = getUnreadCount
    }
    
    // Listen for system notification clicks
    let cleanupElectronListeners: (() => void) | undefined
    if (window.electronAPI) {
      const markReadHandler = (notificationId: string) => {
        // Mark the notification as read
        markNotificationAsRead(notificationId)
        
        // Update the local state immediately
        const updatedNotifications = getNotifications()
        setNotifications(updatedNotifications)
        // Don't call setUnreadCount here - let useMemo handle it
      }
      
      const updateHandler = () => {
        const updatedNotifications = getNotifications()
        setNotifications(updatedNotifications)
        // Don't call setUnreadCount here - let useMemo handle it
      }
      
      window.electronAPI.receive('mark-notification-read', markReadHandler)
      window.electronAPI.receive('notifications-updated', updateHandler)
      
      // Store cleanup function
      cleanupElectronListeners = () => {
        if (window.electronAPI?.removeAllListeners) {
          window.electronAPI.removeAllListeners('mark-notification-read')
          window.electronAPI.removeAllListeners('notifications-updated')
        }
      }
    }
    
    return () => {
      if (cleanupElectronListeners) {
        cleanupElectronListeners()
      }
    }
  }, [])

  // Refresh the "time ago" labels every 30 seconds and when tab regains focus - OPTIMIZED: Reduced frequency
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000) // OPTIMIZED: Changed from 30s to 60s
    const onVisibility = () => setNowTick(Date.now())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [])

  // Removed unnecessary database refresh function - socket context handles updates automatically

  // Removed initial database load - socket context handles all notification loading
  // Set loading to false since we're not loading from DB anymore
  useEffect(() => {
    setLoadingBell(false)
  }, [])

  // Removed excessive database calls - socket context handles updates automatically

  // Separate useEffect for notification event handling only
  useEffect(() => {
    const handleNotificationUpdate = () => {
      const updatedNotifications = getNotifications();
      // Show unread notifications first, then recent ones, limit to 8
      const unreadNotifications = updatedNotifications.filter(n => !n.read)
      const readNotifications = updatedNotifications.filter(n => n.read)
      
      // Combine unread first, then recent read ones
      const recentNotifications = [
        ...unreadNotifications,
        ...readNotifications
      ].slice(0, 8)
      
      // Only update notifications, let the useMemo handle unread count
      setNotifications(recentNotifications);
      
      // Update system tray badge with current unread count
      const newUnreadCount = unreadNotifications.length;
      if (window.electronAPI?.send) {
        window.electronAPI.send('notification-count-changed', { count: newUnreadCount });
      }
    };

    window.addEventListener('notifications-updated', handleNotificationUpdate);
    
    // Listen for notifications cleared event
    const handleNotificationsCleared = () => {
      // Force refresh notifications from socket context
      if (user?.email && socketConnected) {
        fetchNotifications(0, 8, 0);
      }
      
      // Also force update the notification service count
      // This ensures the badge count updates immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notifications-updated', {
          detail: { unreadCount: 0 }
        }));
      }
    };
    
    window.addEventListener('notifications-cleared', handleNotificationsCleared);
    
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
      window.removeEventListener('notifications-cleared', handleNotificationsCleared);
    };
  }, [user?.email, socketConnected, fetchNotifications]);

  // Removed periodic notification checking - socket context handles real-time updates

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // First get user data from localStorage
    const currentUser = getCurrentUser()
    if (currentUser) {
          // Set initial user data from localStorage
      setUser({
        name: currentUser.name || "Agent User",
        email: currentUser.email || "agent@shoreagents.com",
        avatar: "/shoreagents-dp.png",
      })
          
          // Try to fetch fresh profile data from API
          try {
            // Get user email for API call (works in both browser and Electron)
            const userEmail = currentUser.email;
            const apiUrl = userEmail 
              ? `/api/profile/?email=${encodeURIComponent(userEmail)}`
              : '/api/profile/';
              
            const response = await fetch(apiUrl, {
              credentials: 'include' // Include authentication cookies for Electron
            })
            if (response.ok) {
              const profileData = await response.json()
              if (profileData.success && profileData.profile) {
                const profile = profileData.profile
                setUser({
                  name: `${profile.first_name} ${profile.last_name}`.trim() || currentUser.name || "Agent User",
                  email: profile.email || currentUser.email || "agent@shoreagents.com",
                  avatar: "/shoreagents-dp.png",
                })
              }
            }
          } catch (apiError) {
            // If API fails, keep the localStorage data
            console.warn('Failed to fetch profile from API, using localStorage data')
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
        // Fallback to default user
        setUser({
          name: "Agent User",
          email: "agent@shoreagents.com",
          avatar: "/shoreagents-dp.png",
        })
      } finally {
        setUserLoading(false)
      }
    }

    loadUserData()
  }, [])

  // Generate breadcrumbs based on pathname if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (breadcrumbs) return breadcrumbs

    const pathSegments = pathname.split('/').filter(Boolean)
    const generatedBreadcrumbs: BreadcrumbItem[] = []

    // Add Dashboard as root for dashboard pages
    if (pathSegments[0] === 'dashboard') {
      generatedBreadcrumbs.push({
        title: 'Dashboard'
      })

      // Add sub-pages
      if (pathSegments[1] === 'activity') {
        generatedBreadcrumbs.push({
          title: 'Activity',
          href: '/dashboard/activity'
        })
      } else if (pathSegments[1] === 'analytics') {
        generatedBreadcrumbs.push({
          title: 'Analytics',
          href: '/dashboard/analytics'
        })
      } else if (pathSegments.length === 1) {
        // Dashboard home page - make it clickable
        generatedBreadcrumbs[0].href = '/dashboard'
      }
    } else if (pathSegments[0] === 'forms') {
      generatedBreadcrumbs.push({
        title: 'Support Tickets'
      })

      if (pathSegments[1] === 'new') {
        generatedBreadcrumbs.push({
          title: 'New Ticket',
          href: '/forms/new'
        })
      } else if (pathSegments[1] === 'my-tickets') {
        generatedBreadcrumbs.push({
          title: 'My Tickets',
          href: '/forms/my-tickets'
        })
      } else if (pathSegments.length === 1) {
        // Forms home page - make it clickable
        generatedBreadcrumbs[0].href = '/forms'
      } else if (pathSegments.length === 2 && pathSegments[1]) {
        // Ticket details page: /forms/[id]
        generatedBreadcrumbs.push({
          title: 'My Tickets',
          href: '/forms/my-tickets'
        })
        generatedBreadcrumbs.push({
          title: pathSegments[1].toUpperCase(),
          isCurrent: true
        })
      }
    } else if (pathSegments[0] === 'help') {
      generatedBreadcrumbs.push({
        title: 'Help & Support'
      })

      if (pathSegments[1] === 'faq') {
        generatedBreadcrumbs.push({
          title: 'FAQ',
          href: '/help/faq'
        })
      } else if (pathSegments[1] === 'contact') {
        generatedBreadcrumbs.push({
          title: 'Contact Support',
          href: '/help/contact'
        })
      } else if (pathSegments.length === 1) {
        // Help home page - make it clickable
        generatedBreadcrumbs[0].href = '/help'
      }
    } else if (pathSegments[0] === 'productivity') {
      generatedBreadcrumbs.push({
        title: 'Productivity'
      })

      if (pathSegments[1] === 'tasks' || pathSegments[1] === 'task-activity') {
        generatedBreadcrumbs.push({
          title: 'Task',
          href: pathSegments[1] === 'task-activity' ? '/productivity/task-activity' : '/productivity/tasks'
        })
      } else if (pathSegments.length === 1) {
        // Productivity home page - make it clickable
        generatedBreadcrumbs[0].href = '/productivity'
      }
    } else if (pathSegments[0] === 'status') {
      generatedBreadcrumbs.push({
        title: 'Set Your Status',
      })
      if (pathSegments[1] === 'breaks') {
        generatedBreadcrumbs.push({
          title: 'Breaks',
          href: '/status/breaks'
        })
      } else if (pathSegments[1] === 'meetings') {
        generatedBreadcrumbs.push({
          title: 'Meetings',
          href: '/status/meetings'
        })
      } else if (pathSegments[1] === 'events') {
        generatedBreadcrumbs.push({
          title: 'Events & Activities',
          href: '/status/events'
        })
      } else if (pathSegments[1] === 'health') {
        generatedBreadcrumbs.push({
          title: 'Health',
          href: '/status/health'
        })
      } else if (pathSegments[1] === 'restroom') {
        generatedBreadcrumbs.push({
          title: 'Restroom',
          href: '/status/restroom'
        })
      } else if (pathSegments.length === 1) {
        generatedBreadcrumbs[0].href = '/status'
      }
    } else if (pathSegments[0] === 'breaks') {
      generatedBreadcrumbs.push({
        title: 'Breaks'
      })
      generatedBreadcrumbs.push({
        title: 'Break Management',
        href: '/breaks'
      })
    } else if (pathSegments[0] === 'settings') {
      generatedBreadcrumbs.push({
        title: 'Settings'
      })

      if (pathSegments[1] === 'profile') {
        generatedBreadcrumbs.push({
          title: 'Profile',
          href: '/settings/profile'
        })
      } else if (pathSegments.length === 1) {
        // Settings home page - make it clickable
        generatedBreadcrumbs[0].href = '/settings'
      }
    }

    return generatedBreadcrumbs
  }

  const currentBreadcrumbs = generateBreadcrumbs()

  const handleViewAllNotifications = () => {
    if (activeTab === 'unread') {
      router.push('/notifications?status=unread')
    } else {
      router.push('/notifications')
    }
  }

  // Update notification count and badge - FIXED to include database notifications
  // Use useMemo to calculate unread count instead of useEffect to prevent infinite loops
  // Prioritize actual database unread count, then socket updates for real-time changes
  const currentUnreadCount = useMemo(() => {
    // Use socket unread count as primary source since it now includes total unread count from API
    if (socketConnected && socketUnreadCount !== undefined) {
      return socketUnreadCount
    }
    
    // Fallback to local notifications count
    return notifications.filter(n => !n.read).length
  }, [notifications, socketConnected, socketUnreadCount])

  // Update unread count when it changes
  useEffect(() => {
    if (currentUnreadCount !== unreadCount) {
      setUnreadCount(currentUnreadCount)
      
      // Update system tray badge if available
      if (window.electronAPI?.send) {
        window.electronAPI.send('notification-count-changed', { count: currentUnreadCount });
      }
    }
  }, [currentUnreadCount, unreadCount])

  // Force refresh badge count when notifications are cleared
  useEffect(() => {
    const handleForceRefresh = () => {
      // Force a re-calculation of the badge count
      const serviceUnreadCount = getUnreadCount()
      if (serviceUnreadCount === 0) {
        setUnreadCount(0)
        if (window.electronAPI?.send) {
          window.electronAPI.send('notification-count-changed', { count: 0 });
        }
      }
    }

    window.addEventListener('notifications-cleared', handleForceRefresh)
    
    return () => {
      window.removeEventListener('notifications-cleared', handleForceRefresh)
    }
  }, [])

  // Listen for clear all notifications from system tray
  useEffect(() => {
    if (window.electronAPI?.onClearAllNotifications) {
      
      const handleSystemTrayClear = async () => {
        try {
          // Get current user to clear notifications from database
          const currentUser = getCurrentUser()
          
          if (currentUser?.email) {
            // First, fetch notifications from the API to get the actual database notifications
            const response = await fetch(`/api/notifications/?email=${encodeURIComponent(currentUser.email)}&limit=200`)
            
            if (response.ok) {
              const data = await response.json()
              const allNotifications = data.notifications || []
              const notificationIds = allNotifications.map((n: { id: number }) => n.id)
              
              if (notificationIds.length > 0) {
                // Clear notifications from database using delete API
                const deleteResponse = await fetch('/api/notifications/delete', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ 
                    ids: notificationIds, 
                    email: currentUser.email 
                  })
                })
                
                if (deleteResponse.ok) {
                  await deleteResponse.json()
                } else {
                  console.error('App header: Failed to clear notifications from database')
                }
              } 
            } else {
              console.error('App header: Failed to fetch notifications from API')
            }
          } 
          
          // Clear local notification service
          clearAllNotifications()
          
          // Trigger the same clear functionality as the UI
          window.dispatchEvent(new CustomEvent('notifications-cleared', {
            detail: { unreadCount: 0 }
          }))
          
          // Also trigger the general update event
          window.dispatchEvent(new CustomEvent('notifications-updated'))
          
          // Update Electron badge count
          if (window.electronAPI?.send) {
            window.electronAPI.send('notification-count-changed', { count: 0 });
          }
        } catch (error) {
          console.error('Error clearing notifications from system tray:', error)
        }
      }

      window.electronAPI.onClearAllNotifications(handleSystemTrayClear)
      
      return () => {
        // Cleanup is handled by the preload script
      }
    }
  }, [])

  // Get team status for the badge
  const { isLoading: teamStatusLoading, onlineTeamCount, totalTeamCount } = useTeamStatus()

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 border-b border-border/40 shadow-sm">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {currentBreadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center">
                <BreadcrumbItem>
                  {item.isCurrent ? (
                    <BreadcrumbPage>{item.title}</BreadcrumbPage>
                  ) : item.href ? (
                    <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
                  ) : (
                    <span>{item.title}</span>
                  )}
                </BreadcrumbItem>
                {index < currentBreadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      
      {showUser && (
        <div className="ml-auto flex items-center gap-2 px-4">
          {/* Team Status Badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  onClick={() => router.push('/settings/connected-users')}
                  data-team-status
                >
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Badge 
                    variant="secondary" 
                    className={`${
                      onlineTeamCount > 0 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {teamStatusLoading ? '...' : `${onlineTeamCount}/${totalTeamCount}`}
                  </Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent >
                <p>Team Status: {onlineTeamCount} online out of {totalTeamCount} members</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Global Search */}
          <div className="w-64">
            <GlobalSearch />
          </div>




          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const root = document.documentElement
              const isDark = root.classList.contains('dark')
              if (isDark) {
                root.classList.remove('dark')
                localStorage.setItem('theme', 'light')
              } else {
                root.classList.add('dark')
                localStorage.setItem('theme', 'dark')
              }
            }}
            aria-label="Toggle theme"
          >
            {/* Show sun in dark mode, moon in light mode */}
            <span className="dark:hidden"><Moon className="h-4 w-4" /></span>
            <span className="hidden dark:inline"><Sun className="h-4 w-4" /></span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8"
                data-notifications-trigger
              >
                <Bell className="h-4 w-4" />
                                  {socketUnreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs font-medium bg-red-500 text-white border-2 border-white shadow-sm"
                    >
                      {socketUnreadCount > 9 ? '9+' : socketUnreadCount}
                    </Badge>
                  )}

              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-96 max-w-[calc(100vw-2rem)]" align="end" forceMount>
              <div className="flex items-center justify-between p-4 pb-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {socketUnreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs bg-red-500 text-white">
                      {socketUnreadCount > 9 ? '9+' : socketUnreadCount} new
                    </Badge>
                  )}
                  {socketUnreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={async () => {
                        try {
                          const currentUser = getCurrentUser()
                          if (currentUser?.id) {
                            // Use the socket context function to mark all as read
                            // This will update both the database and the socket context state
                            await markAllAsRead(currentUser.id)
                            
                            // Dispatch a custom event to notify other components (like notification page) to refresh
                            window.dispatchEvent(new CustomEvent('notifications-marked-all-read'))
                            
                            // Socket context should handle updates automatically - no need for manual refresh
                          }
                        } catch (error) {
                          console.error('Error marking all notifications as read:', error)
                        }
                      }}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              
              {/* Notification Tabs */}
              <div className="px-2">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'unread')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="all">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="unread">
                      Unread
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <ScrollArea className="h-96">
                <div className="p-2 flex flex-col gap-1">
                  {loadingBell ? (
                    <BellNotificationsSkeleton rows={6} />
                  ) : filteredNotifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                    </div>
                  ) : (
                    <>
                      {filteredNotifications.map((notification) => {
                        // Map icon string to component
                        const getIconComponent = (iconName: string) => {
                          switch (iconName) {
                            case 'CheckCircle': return CheckCircle
                            case 'AlertCircle': return AlertCircle
                            case 'Info': return Info
                            case 'Clock': return Clock
                            case 'CheckSquare': return CheckSquare
                            case 'FileText': return FileText
                            case 'Heart': return Heart
                            case 'Calendar': return Calendar
                            default: return Bell
                          }
                        }
                        
                        return (
                          <SwipeableNotificationItem
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={async (notificationId: number) => {
                              try {
                                await markAsRead(notificationId)
                                
                                // Dispatch a custom event to notify other components
                                window.dispatchEvent(new CustomEvent('notification-marked-read', { 
                                  detail: { notificationId } 
                                }))
                                
                                // Dispatch notification-clicked event for task notifications
                                if (notification.category === 'task') {
                                  const notificationClickEvent = new CustomEvent('notification-clicked', { 
                                    detail: notification 
                                  })
                                  window.dispatchEvent(notificationClickEvent)
                                }
                              } catch (error) {
                                console.error('Error marking notification as read:', error)
                              }
                            }}
                            onDelete={async (notificationId: number) => {
                              try {
                                await deleteNotification(notificationId)
                                
                                // Refresh notifications to maintain 8-count display
                                if (user?.email && socketConnected) {
                                  fetchNotifications(0, 8, 0)
                                }
                                
                                // Dispatch a custom event to notify other components
                                window.dispatchEvent(new CustomEvent('notification-deleted', { 
                                  detail: { notificationId } 
                                }))
                              } catch (error) {
                                console.error('App header error deleting notification:', error)
                              }
                            }}
                            onNavigate={(actionUrl: string) => {
                              router.push(actionUrl)
                            }}
                            getIconComponent={getIconComponent}
                            truncateNotificationMessage={truncateNotificationMessage}
                            nowTick={nowTick}
                          />
                        )
                      })}
                      {filteredNotifications.length > 0 && (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          {activeTab === 'unread' 
                            ? `Showing ${filteredNotifications.length} unread notifications`
                            : `Showing ${Math.min(filteredNotifications.length, 8)} most recent notifications`
                          }
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              {filteredNotifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={handleViewAllNotifications}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{activeTab === 'unread' ? 'View All Unread' : 'View All Notifications'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {userLoading || !user ? (
            // User loading skeleton
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            </div>
          ) : (
          <HeaderUser user={user} />
          )}
        </div>
      )}
    </header>
  )
}) 
