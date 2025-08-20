"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle, Info, Clock, Trash2, Bell, CheckSquare, FileText, Filter, X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { NotificationsSkeleton } from "@/components/skeleton-loaders"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { 
  getNotifications, 
  markNotificationAsRead, 
  deleteNotification,
  getUnreadCount,
  formatTimeAgo,
  saveNotifications,
  markAllNotificationsAsRead,
  clearAllNotifications
} from "@/lib/notification-service"
import { getCurrentUser } from "@/lib/ticket-utils"
import { useRouter } from "next/navigation"

interface Notification {
  id: number
  type: 'success' | 'warning' | 'info'
  title: string
  message: string
  time: string
  read: boolean
  icon: any
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [highlightedNotificationId, setHighlightedNotificationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const notificationsPerPage = 10

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Load notifications (hydrate from DB once, then keep in-memory updates)
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const user = getCurrentUser()
        if (!user?.email) return
        const res = await fetch(`/api/notifications?email=${encodeURIComponent(user.email)}&limit=100`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && Array.isArray(data.notifications)) {
          const mapped = data.notifications.map((n: any) => {
            const payload = n.payload || {}
            const actionUrl = payload.action_url
              || (n.category === 'ticket' && (payload.ticket_id || payload.ticket_row_id) ? `/forms/${payload.ticket_id || ''}` : undefined)
              || (n.category === 'break' ? '/status/breaks' : undefined)
            const icon = n.category === 'ticket' ? 'FileText' : n.category === 'break' ? 'Clock' : 'Bell'
            return {
              id: `db_${n.id}`,
              type: n.type,
              title: n.title,
              message: n.message,
              time: new Date(n.created_at).getTime(),
              read: !!n.is_read,
              icon,
              actionUrl,
              actionData: payload,
              category: n.category,
              priority: 'medium' as const,
              eventType: 'system' as const,
            }
          })
          saveNotifications(mapped)
          setNotifications(mapped)
          setUnreadCount(mapped.filter((n: any) => !n.read).length)
        }
      } catch {}
    }

    const loadFromMemory = () => {
      const realNotifications = getNotifications()
      setNotifications(realNotifications)
      setUnreadCount(getUnreadCount())
    }

    // Try DB hydrate first, then ensure memory state shown
    loadFromDb().finally(() => { loadFromMemory(); setLoading(false) })
    
    // Listen for real-time notification updates
    const handleNotificationUpdate = () => {
      loadFromMemory()
    }
    
    // Listen for highlight notification events from system notifications
    if (window.electronAPI) {
      window.electronAPI.receive('highlight-notification', (notificationId: string) => {
        setHighlightedNotificationId(notificationId)
        
        // Scroll to the highlighted notification after a short delay
        setTimeout(() => {
          const notificationElement = document.getElementById(`notification-${notificationId}`)
          if (notificationElement) {
            notificationElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            })
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              setHighlightedNotificationId(null)
            }, 3000)
          }
        }, 100)
      })
    }
    
    window.addEventListener('notifications-updated', handleNotificationUpdate)
    
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate)
    }
  }, [])

  const handleDeleteNotification = async (id: string) => {
    // Update in-memory first
    deleteNotification(id)
    const realNotifications = getNotifications()
    setNotifications(realNotifications)
    setUnreadCount(getUnreadCount())
    // Persist delete to DB if possible
    try {
      const auth = JSON.parse(localStorage.getItem('shoreagents-auth') || '{}')
      const email = auth?.user?.email
      if (email) {
        await fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id, email })
        })
      }
    } catch {}
  }

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return
    // Update in-memory
    markAllNotificationsAsRead()
    const real = getNotifications()
    setNotifications(real)
    setUnreadCount(0)
    // Persist to DB
    try {
      const user = getCurrentUser()
      if (user?.email) {
        const ids = real.map((n: any) => n.id)
        await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ids, email: user.email })
        })
      }
    } catch {}
  }

  const handleClearAll = async () => {
    if (notifications.length === 0) return
    const ids = notifications.map((n: any) => n.id)
    // Update in-memory
    clearAllNotifications()
    setNotifications([])
    setUnreadCount(0)
    // Persist to DB
    try {
      const user = getCurrentUser()
      if (user?.email) {
        await fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ids, email: user.email })
        })
      }
    } catch {}
  }

  // Filter logic
  const filteredNotifications = notifications.filter(notification => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Category filter
    if (filterCategory !== "all" && notification.category !== filterCategory) {
      return false
    }

    // Type filter
    if (filterType !== "all" && notification.type !== filterType) {
      return false
    }

    // Status filter
    if (filterStatus === "unread" && notification.read) {
      return false
    }
    if (filterStatus === "read" && !notification.read) {
      return false
    }

    return true
  })

  // Pagination logic (applied to filtered results)
  const totalPages = Math.ceil(filteredNotifications.length / notificationsPerPage)
  const startIndex = (currentPage - 1) * notificationsPerPage
  const endIndex = startIndex + notificationsPerPage
  const currentNotifications = filteredNotifications.slice(startIndex, endIndex)

  // Get unique categories and types for filter options
  const availableCategories = [...new Set(notifications.map(n => n.category).filter(Boolean))]
  const availableTypes = [...new Set(notifications.map(n => n.type).filter(Boolean))]

  // Active filter count
  const activeFilterCount = [
    searchQuery,
    filterCategory !== "all" ? filterCategory : null,
    filterType !== "all" ? filterType : null,
    filterStatus !== "all" ? filterStatus : null
  ].filter(Boolean).length

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("")
    setFilterCategory("all")
    setFilterType("all")
    setFilterStatus("all")
    setCurrentPage(1)
  }

  // Reset to first page when notifications change
  useEffect(() => {
    setCurrentPage(1)
  }, [notifications.length])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50 dark:bg-green-950/20'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20'
      case 'info':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/20'
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20'
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              <p className="text-muted-foreground mt-1">
                Stay updated with your latest activities and system updates
                {filteredNotifications.length !== notifications.length && (
                  <span className="ml-2 text-sm">
                    • Showing {filteredNotifications.length} of {notifications.length}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                title="Mark all as read"
              >
                Mark all read
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
                title="Clear all notifications"
              >
                Clear all
              </Button>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => {
                      setSearchQuery("")
                      setCurrentPage(1)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Filter Notifications</h4>
                      {activeFilterCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="h-8 text-xs"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <Select value={filterStatus} onValueChange={(value) => {
                          setFilterStatus(value)
                          setCurrentPage(1)
                        }}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All notifications</SelectItem>
                            <SelectItem value="unread">Unread only</SelectItem>
                            <SelectItem value="read">Read only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Category</label>
                        <Select value={filterCategory} onValueChange={(value) => {
                          setFilterCategory(value)
                          setCurrentPage(1)
                        }}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {availableCategories.map(category => (
                              <SelectItem key={category} value={category}>
                                <div className="flex items-center gap-2">
                                  {category === 'break' && <Clock className="h-3 w-3" />}
                                  {category === 'task' && <CheckSquare className="h-3 w-3" />}
                                  {category === 'ticket' && <FileText className="h-3 w-3" />}
                                  <span className="capitalize">{category}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Type</label>
                        <Select value={filterType} onValueChange={(value) => {
                          setFilterType(value)
                          setCurrentPage(1)
                        }}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            {availableTypes.map(type => (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                  {type === 'success' && <CheckCircle className="h-3 w-3 text-green-600" />}
                                  {type === 'warning' && <AlertCircle className="h-3 w-3 text-yellow-600" />}
                                  {type === 'info' && <Info className="h-3 w-3 text-blue-600" />}
                                  <span className="capitalize">{type}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: "{searchQuery}"
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setSearchQuery("")
                        setCurrentPage(1)
                      }}
                    />
                  </Badge>
                )}
                {filterStatus !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Status: {filterStatus}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setFilterStatus("all")
                        setCurrentPage(1)
                      }}
                    />
                  </Badge>
                )}
                {filterCategory !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Category: {filterCategory}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setFilterCategory("all")
                        setCurrentPage(1)
                      }}
                    />
                  </Badge>
                )}
                {filterType !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Type: {filterType}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setFilterType("all")
                        setCurrentPage(1)
                      }}
                    />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {loading ? (
              <NotificationsSkeleton rows={6} />
            ) : currentNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                    <p className="text-sm">You're all caught up! Check back later for new updates.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
                          currentNotifications.map((notification) => {
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
                <Card 
                  key={notification.id} 
                  id={`notification-${notification.id}`}
                  className={`transition-all duration-200 cursor-pointer hover:bg-accent/30 ${
                    !notification.read 
                      ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/10' 
                      : ''
                  } ${
                    highlightedNotificationId === notification.id
                      ? 'ring-2 ring-blue-500 bg-blue-100/50 dark:bg-blue-950/20 animate-pulse'
                      : ''
                  }`}
                  onClick={() => {
                    // Mark as read when clicking the card
                    if (!notification.read) {
                      markNotificationAsRead(notification.id)
                      try {
                        const auth = JSON.parse(localStorage.getItem('shoreagents-auth') || '{}')
                        const email = auth?.user?.email
                        if (email) {
                          fetch('/api/notifications/mark-read', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ id: notification.id, email })
                          })
                        }
                      } catch {}
                    }
                    
                    // Dispatch notification-clicked event for task notifications
                    if (notification.category === 'task') {
                      const notificationClickEvent = new CustomEvent('notification-clicked', { 
                        detail: notification 
                      })
                      window.dispatchEvent(notificationClickEvent)
                    }
                    
                    // Navigate if actionUrl is provided
                    if (notification.actionUrl) {
                      router.push(notification.actionUrl)
                      return
                    }
                    // Try to infer a path from actionData
                    if (notification.actionData?.ticket_id) {
                      router.push(`/forms/${notification.actionData.ticket_id}`)
                      return
                    }
                  }}
                >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full ${getTypeColor(notification.type)}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className={`text-sm font-semibold ${
                                  !notification.read ? 'text-foreground' : 'text-muted-foreground'
                                }`}>
                                  {notification.title}
                                </h3>
                                {!notification.read && (
                                  <Badge variant="secondary" className="text-[10px] h-5">
                                    New
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{formatTimeAgo(notification.time)}</span>
                                <span>•</span>
                                <span className="capitalize">{notification.type}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteNotification(notification.id) }}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem key="page-prev">
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <PaginationItem key="page-first">
                        <PaginationLink 
                          onClick={() => setCurrentPage(1)}
                          isActive={currentPage === 1}
                          className={currentPage === 1 ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem key="ellipsis-start">
                        <PaginationEllipsis />
                      </PaginationItem>
                    </>
                  )}
                  
                  {/* Page numbers around current page */}
                  {(() => {
                    const renderedPages = new Set<number>()
                    
                    // Add first page if it's being shown separately
                    if (currentPage > 3) {
                      renderedPages.add(1)
                    }
                    
                    // Add last page if it's being shown separately
                    if (currentPage < totalPages - 2) {
                      renderedPages.add(totalPages)
                    }
                    
                    // Calculate the range of pages to show around current page
                    const startPage = Math.max(1, currentPage - 2)
                    const endPage = Math.min(totalPages, currentPage + 2)
                    
                    const pageNumbers = []
                    for (let i = startPage; i <= endPage; i++) {
                      if (!renderedPages.has(i)) {
                        pageNumbers.push(i)
                        renderedPages.add(i)
                      }
                    }
                    
                    return pageNumbers.map(pageNum => (
                      <PaginationItem key={`page-${pageNum}`}>
                        <PaginationLink 
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className={currentPage === pageNum ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    ))
                  })()}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      <PaginationItem key="ellipsis-end">
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem key="page-last">
                        <PaginationLink 
                          onClick={() => setCurrentPage(totalPages)}
                          isActive={currentPage === totalPages}
                          className={currentPage === totalPages ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  
                  <PaginationItem key="page-next">
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {filteredNotifications.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredNotifications.length)} of {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                {filteredNotifications.length !== notifications.length && ` (filtered from ${notifications.length} total)`}
                {unreadCount > 0 && ` • ${unreadCount} unread`}
              </p>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 