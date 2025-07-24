"use client"

import { useState, useEffect } from "react"
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
import { Bell, CheckCircle, AlertCircle, Info, Clock, ArrowRight, CheckSquare, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { 
  getNotifications, 
  getUnreadCount, 
  markNotificationAsRead, 
  checkAllNotifications,
  initializeNotificationChecking,
  addSampleNotifications,
  markAllNotificationsAsRead,
  formatTimeAgo
} from "@/lib/notification-service"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppSidebar } from "@/components/app-sidebar"

interface BreadcrumbItem {
  title: string
  href?: string
  isCurrent?: boolean
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[]
  showUser?: boolean
}

export function AppHeader({ breadcrumbs, showUser = true }: AppHeaderProps) {
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

  // Initialize notification checking
  useEffect(() => {
    initializeNotificationChecking()
    
    // Only add welcome notification if no notifications exist
    const existingNotifications = getNotifications()
    if (existingNotifications.length === 0) {
      addSampleNotifications() // Add welcome notification only
    }
    
    // Listen for system notification clicks
    if (window.electronAPI) {
      window.electronAPI.receive('mark-notification-read', (notificationId: string) => {
        // Mark the notification as read
        markNotificationAsRead(notificationId)
        
        // Update the local state immediately
        const updatedNotifications = getNotifications()
        setNotifications(updatedNotifications)
        setUnreadCount(getUnreadCount())
      })
      
      // Listen for general notification updates
      window.electronAPI.receive('notifications-updated', () => {
        const updatedNotifications = getNotifications()
        setNotifications(updatedNotifications)
        setUnreadCount(getUnreadCount())
      })
    }
  }, [])

  // Load notifications and update periodically
  useEffect(() => {
    const loadNotifications = () => {
      const realNotifications = getNotifications()
      // Show unread notifications first, then recent ones, limit to 8
      const unreadNotifications = realNotifications.filter(n => !n.read)
      const readNotifications = realNotifications.filter(n => n.read)
      
      // Combine unread first, then recent read ones
      const recentNotifications = [
        ...unreadNotifications,
        ...readNotifications
      ].slice(0, 8)
      
      setNotifications(recentNotifications)
      setUnreadCount(getUnreadCount())
    }

    loadNotifications()
    
    // Update every 10 seconds for real-time responsiveness
    const interval = setInterval(loadNotifications, 10000)
    
    // Listen for real-time notification updates
    const handleNotificationUpdate = () => {
      loadNotifications()
    }
    
    window.addEventListener('notifications-updated', handleNotificationUpdate)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('notifications-updated', handleNotificationUpdate)
    }
  }, [])

  // Check for new notifications periodically
  useEffect(() => {
    const checkNotifications = () => {
      checkAllNotifications()
    }

    // Check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

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
            avatar: "/avatars/agent.jpg",
          })
          
          // Try to fetch fresh profile data from API
          try {
            const response = await fetch('/api/profile')
            if (response.ok) {
              const profileData = await response.json()
              if (profileData.success && profileData.profile) {
                const profile = profileData.profile
                setUser({
                  name: `${profile.first_name} ${profile.last_name}`.trim() || currentUser.name || "Agent User",
                  email: profile.email || currentUser.email || "agent@shoreagents.com",
                  avatar: "/avatars/agent.jpg",
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
          avatar: "/avatars/agent.jpg",
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
      } else if (pathSegments[1] === 'docs') {
        generatedBreadcrumbs.push({
          title: 'Documentation',
          href: '/help/docs'
        })
      } else if (pathSegments.length === 1) {
        // Help home page - make it clickable
        generatedBreadcrumbs[0].href = '/help'
      }
    } else if (pathSegments[0] === 'productivity') {
      generatedBreadcrumbs.push({
        title: 'Productivity'
      })

      if (pathSegments[1] === 'tasks') {
        generatedBreadcrumbs.push({
          title: 'Task Tracker',
          href: '/productivity/tasks'
        })
      } else if (pathSegments.length === 1) {
        // Productivity home page - make it clickable
        generatedBreadcrumbs[0].href = '/productivity'
      }
    } else if (pathSegments[0] === 'breaks') {
      generatedBreadcrumbs.push({
        title: 'Breaks'
      })
      generatedBreadcrumbs.push({
        title: 'Break Management',
        href: '/breaks'
      })
    } else if (pathSegments[0] === 'health') {
      generatedBreadcrumbs.push({
        title: 'Health'
      })
      generatedBreadcrumbs.push({
        title: 'Health Staff',
        href: '/health'
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
    router.push('/notifications')
  }

  // Update notification count and badge
  useEffect(() => {
    const unreadCount = getUnreadCount()
    setUnreadCount(unreadCount)
    
    // Update system notification badge if Electron is available
    if (window.electronAPI?.systemNotifications) {
      window.electronAPI.systemNotifications.getCount().then((result: any) => {
        // The badge count is managed by the main process
        // This just ensures the app is aware of the current count
      }).catch((error: any) => {
        console.log('Could not get system notification count:', error)
      })
    }
    
    // Trigger system tray update when notification count changes
    if (window.electronAPI?.systemNotifications) {
      // Send notification count update to main process
      window.electronAPI.send('notification-count-changed', { count: unreadCount });
    }
  }, [notifications])

  // Listen for notification updates from other components
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
      
      const newUnreadCount = getUnreadCount();
      setNotifications(recentNotifications);
      setUnreadCount(newUnreadCount);
      
      // Update system tray badge
      if (window.electronAPI?.send) {
        window.electronAPI.send('notification-count-changed', { count: newUnreadCount });
      }
    };

    window.addEventListener('notifications-updated', handleNotificationUpdate);
    
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
    };
  }, []);

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
          <DropdownMenu onOpenChange={(open) => {
            // Mark all notifications as read when dropdown opens
            if (open && unreadCount > 0) {
              markAllNotificationsAsRead();
              // Update local state immediately
              const updatedNotifications = getNotifications();
              setNotifications(updatedNotifications);
              setUnreadCount(0);
              
              // Trigger notification update event to sync with system tray
              window.dispatchEvent(new CustomEvent('notifications-updated'));
              
              // Immediately update system tray badge
              if (window.electronAPI?.send) {
                window.electronAPI.send('notification-count-changed', { count: 0 });
              }
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs font-medium bg-red-500 text-white border-2 border-white shadow-sm"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end" forceMount>
              <div className="flex items-center justify-between p-4 pb-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs bg-red-500 text-white">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <DropdownMenuSeparator />
              <ScrollArea className="h-96">
                <div className="p-2">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    <>
                      {notifications.map((notification) => {
                        // Map icon string to component
                        const getIconComponent = (iconName: string) => {
                          switch (iconName) {
                            case 'CheckCircle': return CheckCircle
                            case 'AlertCircle': return AlertCircle
                            case 'Info': return Info
                            case 'Clock': return Clock
                            case 'CheckSquare': return CheckSquare
                            case 'FileText': return FileText
                            default: return Bell
                          }
                        }
                        
                        const IconComponent = getIconComponent(notification.icon)
                        
                        return (
                          <DropdownMenuItem
                            key={notification.id}
                            className={`p-4 cursor-pointer hover:bg-accent ${
                              !notification.read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                            }`}
                            onClick={() => {
                              // Mark as read
                              markNotificationAsRead(notification.id)
                              
                              // Update local state immediately
                              const updatedNotifications = getNotifications()
                              const unreadNotifications = updatedNotifications.filter(n => !n.read)
                              const readNotifications = updatedNotifications.filter(n => n.read)
                              
                              // Combine unread first, then recent read ones
                              const recentNotifications = [
                                ...unreadNotifications,
                                ...readNotifications
                              ].slice(0, 8)
                              
                              setNotifications(recentNotifications)
                              setUnreadCount(getUnreadCount())
                              
                              // Navigate if actionUrl is provided
                              if (notification.actionUrl) {
                                router.push(notification.actionUrl)
                              }
                            }}
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className={`mt-0.5 ${
                                notification.type === 'success' ? 'text-green-600' :
                                notification.type === 'warning' ? 'text-yellow-600' :
                                notification.type === 'error' ? 'text-red-600' :
                                'text-blue-600'
                              }`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className={`text-sm font-medium ${
                                      !notification.read ? 'text-foreground' : 'text-muted-foreground'
                                    }`}>
                                      {notification.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {notification.message}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs text-muted-foreground">
                                        {formatTimeAgo(notification.time)}
                                      </span>
                                      {!notification.read && (
                                        <Badge variant="destructive" className="text-xs bg-red-500 text-white">
                                          New
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DropdownMenuItem>
                        )
                      })}
                      {getNotifications().length > 8 && (
                        <div className="p-3 text-center text-xs text-muted-foreground border-t">
                          Showing 8 most recent notifications
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={handleViewAllNotifications}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>View All Notifications</span>
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
} 