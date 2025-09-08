"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle, AlertCircle, Info, Clock, Trash2, Bell, CheckSquare, FileText, Filter, X, Search, RefreshCw, Check, Heart, Square, SquareCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { useNotificationsSocketContext } from "@/hooks/use-notifications-socket-context"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@radix-ui/react-separator"

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
  const searchParams = useSearchParams()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [highlightedNotificationId, setHighlightedNotificationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Trigger periodic re-render so formatTimeAgo updates (e.g., "Just now" -> "1 minute ago")
  const [nowTick, setNowTick] = useState<number>(() => Date.now())
  
  // Multi-select state
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const notificationsPerPage = 10

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Get real-time notifications from socket context
  const currentUser = getCurrentUser()
  const { 
    notifications: socketNotifications, 
    unreadCount: socketUnreadCount,
    isConnected: socketConnected,
    fetchNotifications: fetchSocketNotifications,
    markAllAsRead: markAllAsReadSocket,
    markAsRead: markAsReadSocket,
    clearAll: clearAllSocket
  } = useNotificationsSocketContext(currentUser?.email || null)

  // Auto-filter based on URL parameters
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam === 'unread') {
      setFilterStatus('unread')
      // Don't open the filter dropdown automatically
    }
  }, [searchParams])

  // Load notifications (hydrate from DB once, then keep in-memory updates)
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const user = getCurrentUser()
        if (!user?.email) return
        const res = await fetch(`/api/notifications/?email=${encodeURIComponent(user.email)}&limit=100`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && Array.isArray(data.notifications)) {
          const mapped = data.notifications.map((n: any) => {
            const payload = n.payload || {}
            const actionUrl = (() => {
              // First check if there's an explicit action_url in the payload
              if (payload.action_url) {
                return payload.action_url
              }
              // Otherwise generate based on category and payload data
              if (n.category === 'ticket' && (payload.ticket_id || payload.ticket_row_id)) {
                return `/forms/${payload.ticket_id || ''}`
              }
              if (n.category === 'break') {
                return '/status/breaks'
              }
              if (n.category === 'task') {
                // For task notifications, include the task_id if available
                if (payload.task_id) {
                  return `/productivity/task-activity?taskId=${payload.task_id}`
                }
                return '/productivity/task-activity'
              }
              if (n.category === 'health_check') {
                return '/health'
              }
              return undefined
            })()
            const icon = n.category === 'ticket' ? 'FileText' : n.category === 'break' ? 'Clock' : n.category === 'health_check' ? 'Heart' : 'Bell'
            return {
              id: `db_${n.id}`,
              type: n.type,
              title: n.title,
              message: n.message,
              time: (require('@/lib/notification-service') as any).parseDbTimestampToMs(n.created_at, n.category),
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
          // Don't call setUnreadCount here - let the component handle it naturally
        }
      } catch {}
    }

    const loadFromMemory = () => {
      const realNotifications = getNotifications()
      setNotifications(realNotifications)
      // Don't call setUnreadCount here - let the component handle it naturally
    }

    // Try DB hydrate first, then set loading to false
    loadFromDb().finally(() => { setLoading(false) })
    
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

  // Refresh the "time ago" labels every 30 seconds and when tab regains focus
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000)
    const onVisibility = () => setNowTick(Date.now())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [])


  const handleDeleteNotification = async (id: string) => {
    // Update in-memory first
    deleteNotification(id)
    const realNotifications = getNotifications()
    setNotifications(realNotifications)
    
    // Calculate current unread count
    const currentUnreadCount = realNotifications.filter(n => !n.read).length
    
    // Dispatch events to update app-header
    window.dispatchEvent(new CustomEvent('notifications-updated'))
    window.dispatchEvent(new CustomEvent('notifications-cleared', {
      detail: { unreadCount: currentUnreadCount }
    }))
    
    // Persist delete to DB if possible
    try {
      const user = getCurrentUser()
      if (user?.email) {
        // Extract numeric ID from db_ prefix
        let notificationId: number
        if (id.startsWith('db_')) {
          notificationId = parseInt(id.slice(3))
        } else {
          notificationId = parseInt(id)
        }
        
        if (!isNaN(notificationId)) {
          const response = await fetch('/api/notifications/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: notificationId, email: user.email })
          })
          
          const data = await response.json()
          if (!data.success) {
            console.error('Failed to delete notification from database:', data.error)
          }
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return
    
    try {
      const user = getCurrentUser()
      if (!user?.id) return
      
      // Get all unread notification IDs
      const unreadNotifications = notifications.filter(n => !n.read)
      if (unreadNotifications.length === 0) return
      
      // Extract numeric IDs from the db_ prefix format
      const notificationIds = unreadNotifications
        .map(n => {
          const idStr = n.id.toString()
          if (idStr.startsWith('db_')) {
            return parseInt(idStr.slice(3))
          }
          return parseInt(idStr)
        })
        .filter(id => !isNaN(id))
      
      if (notificationIds.length === 0) return
      
      // Use socket context to mark all as read (this will update both DB and socket state)
      if (socketConnected) {
        await markAllAsReadSocket(user.id, notificationIds)
        // Refresh notifications to get updated state
        await fetchSocketNotifications(user.id, 100, 0)
      } else {
        // Fallback to direct API call if socket is not connected
        const response = await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            ids: notificationIds, 
            email: user.email 
          })
        })
        
        if (response.ok) {
          // Update local state to mark all as read
          setNotifications(prev => prev.map(n => ({ ...n, read: true })))
          // Update unread count
          setUnreadCount(0)

          
          
          // Dispatch event to update app-header
          window.dispatchEvent(new CustomEvent('notifications-updated'))
        }
      }
      
      // Dispatch custom event to notify app header of the change
      window.dispatchEvent(new CustomEvent('notifications-cleared', {
        detail: { unreadCount: 0 }
        }))
      // Also update the old notification service to keep it in sync
      markAllNotificationsAsRead()
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const handleClearAll = async () => {
    if (notifications.length === 0) return
    
    // Extract numeric IDs from db_ prefix
    const numericIds = notifications.map((n: any) => {
      const id = n.id.toString()
      if (id.startsWith('db_')) {
        return parseInt(id.slice(3))
      }
      return parseInt(id)
    }).filter(id => !isNaN(id))
    
    // Use socket context to clear all notifications FIRST (this will update both DB and socket state)
    if (socketConnected && clearAllSocket) {
      await clearAllSocket(numericIds)
    } else {
      // Fallback to direct API call if socket is not connected
      try {
        const user = getCurrentUser()
        if (user?.email && numericIds.length > 0) {
          const response = await fetch('/api/notifications/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ids: numericIds, email: user.email })
          })
          
          const data = await response.json()
          if (!data.success) {
            console.error('Failed to clear all notifications from database:', data.error)
          }
        }
      } catch (error) {
        console.error('Error clearing all notifications:', error)
      }
    }
    
    // Update in-memory AFTER socket context is updated
    clearAllNotifications()
    setNotifications([])
    setUnreadCount(0)
    setSelectedNotifications(new Set())
    setIsSelectMode(false)
    
    // Dispatch custom event to notify app header of the change
    window.dispatchEvent(new CustomEvent('notifications-cleared', {
      detail: { unreadCount: 0 }
    }))
    
    // Also dispatch the general update event
    window.dispatchEvent(new CustomEvent('notifications-updated'))
  }

  // Multi-select functions
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode)
    if (isSelectMode) {
      setSelectedNotifications(new Set())
    }
  }

  const toggleSelectAll = () => {
    if (selectedNotifications.size === currentNotifications.length) {
      setSelectedNotifications(new Set())
    } else {
      setSelectedNotifications(new Set(currentNotifications.map(n => n.id)))
    }
  }

  const toggleSelectNotification = (notificationId: string) => {
    const newSelected = new Set(selectedNotifications)
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId)
    } else {
      newSelected.add(notificationId)
    }
    setSelectedNotifications(newSelected)
  }

  const handleBulkMarkAsRead = async () => {
    if (selectedNotifications.size === 0) return
    
    const selectedIds = Array.from(selectedNotifications)
    
    // Extract numeric IDs from db_ prefix
    const numericIds = selectedIds.map((id: string) => {
      if (id.startsWith('db_')) {
        return parseInt(id.slice(3))
      }
      return parseInt(id)
    }).filter(id => !isNaN(id))
    
    if (numericIds.length === 0) return
    
    try {
      const user = getCurrentUser()
      if (user?.email) {
        // Use socket context if available, otherwise fallback to direct API
        if (socketConnected && markAllAsReadSocket) {
          await markAllAsReadSocket(user.id, numericIds)
        } else {
          const response = await fetch('/api/notifications/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ids: numericIds, email: user.email })
          })
          
          const data = await response.json()
          if (!data.success) {
            console.error('Failed to mark selected notifications as read:', data.error)
          }
        }
      }
      
      // Update local state - only mark the selected notifications as read
      setNotifications(prev => 
        prev.map(n => 
          selectedNotifications.has(n.id) ? { ...n, read: true } : n
        )
      )
      
      // Also update the old notification service to keep it in sync
      selectedIds.forEach(id => markNotificationAsRead(id))
      
      setSelectedNotifications(new Set())
      setIsSelectMode(false)
      
      // Calculate current unread count from updated state
      const updatedNotifications = getNotifications()
      const currentUnreadCount = updatedNotifications.filter(n => !n.read).length
      
      // Dispatch events to update app-header
      window.dispatchEvent(new CustomEvent('notifications-updated'))
      window.dispatchEvent(new CustomEvent('notifications-cleared', {
        detail: { unreadCount: currentUnreadCount }
      }))
      
      // Refresh notifications from socket context to ensure UI is in sync
      if (currentUser?.id && socketConnected) {
        await fetchSocketNotifications(currentUser.id, 100, 0)
      }
      
    } catch (error) {
      console.error('Error marking selected notifications as read:', error)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedNotifications.size === 0) return
    
    const selectedIds = Array.from(selectedNotifications)
    
    // Extract numeric IDs from db_ prefix
    const numericIds = selectedIds.map((id: string) => {
      if (id.startsWith('db_')) {
        return parseInt(id.slice(3))
      }
      return parseInt(id)
    }).filter(id => !isNaN(id))
    
    if (numericIds.length === 0) return
    
    try {
      const user = getCurrentUser()
      if (user?.email) {
        // Use socket context if available, otherwise fallback to direct API
        if (socketConnected && clearAllSocket) {
          await clearAllSocket(numericIds)
        } else {
          const response = await fetch('/api/notifications/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ids: numericIds, email: user.email })
          })
          
          const data = await response.json()
          if (!data.success) {
            console.error('Failed to delete selected notifications from database:', data.error)
          }
        }
      }
      
      // Update local state
      selectedIds.forEach(id => deleteNotification(id))
      const realNotifications = getNotifications()
      setNotifications(realNotifications)
      setSelectedNotifications(new Set())
      setIsSelectMode(false)
      
      // Calculate current unread count
      const currentUnreadCount = realNotifications.filter(n => !n.read).length
      
      // Dispatch events to update app-header
      window.dispatchEvent(new CustomEvent('notifications-updated'))
      window.dispatchEvent(new CustomEvent('notifications-cleared', {
        detail: { unreadCount: currentUnreadCount }
      }))
      
      // Refresh notifications from socket context to ensure UI is in sync
      if (currentUser?.id && socketConnected) {
        await fetchSocketNotifications(currentUser.id, 100, 0)
      }
      
    } catch (error) {
      console.error('Error deleting selected notifications:', error)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC key to cancel select mode
      if (event.key === 'Escape' && isSelectMode) {
        setIsSelectMode(false)
        setSelectedNotifications(new Set())
        return
      }
      
      // Ctrl/Cmd + A to select all when in select mode
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && isSelectMode) {
        event.preventDefault()
        toggleSelectAll()
        return
      }
      
      // Delete key to delete selected notifications when in select mode
      if (event.key === 'Delete' && isSelectMode && selectedNotifications.size > 0) {
        event.preventDefault()
        handleBulkDelete()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSelectMode, selectedNotifications.size, toggleSelectAll, handleBulkDelete])

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

  // Calculate unread count from notifications
  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.read).length
    setUnreadCount(unreadCount)
  }, [notifications])

  // Use socket unread count as fallback if local calculation is 0 but socket has unread
  useEffect(() => {
    if (unreadCount === 0 && socketUnreadCount > 0) {
      setUnreadCount(socketUnreadCount)
    }
  }, [unreadCount, socketUnreadCount])

  // Initialize socket context and sync with real-time notifications
  useEffect(() => {
    if (currentUser?.id && socketConnected) {
      fetchSocketNotifications(currentUser.id, 100, 0)
    }
  }, [currentUser?.id, socketConnected, fetchSocketNotifications])

  // Sync socket notifications with local state
  useEffect(() => {
    if (socketNotifications && socketNotifications.length > 0) {
      // Map socket notifications to the format expected by the page
      const mappedNotifications = socketNotifications.map((n: any) => {
        const payload = n.payload || {}
        const actionUrl = payload.action_url
          || (n.category === 'ticket' && (payload.ticket_id || payload.ticket_row_id) ? `/forms/${payload.ticket_id || ''}` : undefined)
          || (n.category === 'break' ? '/status/breaks' : undefined)
          || (n.category === 'health_check' ? '/health' : undefined)
        const icon = n.category === 'ticket' ? 'FileText' : n.category === 'break' ? 'Clock' : n.category === 'health_check' ? 'Heart' : 'Bell'
        return {
          id: `db_${n.id}`,
          type: n.type,
          title: n.title,
          message: n.message,
          time: (require('@/lib/notification-service') as any).parseDbTimestampToMs(n.created_at, n.category),
          read: !!n.is_read,
          icon,
          actionUrl,
          actionData: payload,
          category: n.category,
          priority: 'medium' as const,
          eventType: 'system' as const,
        }
      })
      
      setNotifications(mappedNotifications)
    }
  }, [socketNotifications])

  // Listen for custom events from app-header to refresh notifications
  useEffect(() => {
    const handleMarkAllRead = async () => {
      // Refresh notifications from socket context when app header marks all as read
      if (currentUser?.id && socketConnected) {
        await fetchSocketNotifications(currentUser.id, 100, 0)
      }
      
      // Also refresh from database as a fallback
      try {
        const user = getCurrentUser()
        if (user?.email) {
          const res = await fetch(`/api/notifications/?email=${encodeURIComponent(user.email)}&limit=100`, { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            if (data?.success && Array.isArray(data.notifications)) {
              const mapped = data.notifications.map((n: any) => {
                const payload = n.payload || {}
                const actionUrl = (() => {
                  if (payload.action_url) {
                    return payload.action_url
                  }
                  if (n.category === 'ticket' && (payload.ticket_id || payload.ticket_row_id)) {
                    return `/forms/${payload.ticket_id || ''}`
                  }
                  if (n.category === 'break') {
                    return '/status/breaks'
                  }
                  if (n.category === 'task') {
                    if (payload.task_id) {
                      return `/productivity/task-activity?taskId=${payload.task_id}`
                    }
                    return '/productivity/task-activity'
                  }
                  if (n.category === 'health_check') {
                    return '/health'
                  }
                  return undefined
                })()
                const icon = n.category === 'ticket' ? 'FileText' : n.category === 'break' ? 'Clock' : n.category === 'health_check' ? 'Heart' : 'Bell'
                return {
                  id: `db_${n.id}`,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  time: (require('@/lib/notification-service') as any).parseDbTimestampToMs(n.created_at, n.category),
                  read: !!n.is_read,
                  icon,
                  actionUrl,
                  actionData: payload,
                  category: n.category,
                  priority: 'medium' as const,
                  eventType: 'system' as const,
                }
              })
              setNotifications(mapped)
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing notifications from database:', error)
      }
    }

    const handleMarkRead = async (event: Event) => {
      // Refresh notifications from socket context when app header marks one as read
      if (currentUser?.id && socketConnected) {
        await fetchSocketNotifications(currentUser.id, 100, 0)
      }
    }

    window.addEventListener('notifications-marked-all-read', handleMarkAllRead)
    window.addEventListener('notification-marked-read', handleMarkRead)
    
    return () => {
      window.removeEventListener('notifications-marked-all-read', handleMarkAllRead)
      window.removeEventListener('notification-marked-read', handleMarkRead)
    }
  }, [currentUser?.id, socketConnected, fetchSocketNotifications])

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
            <div className="flex items-center gap-3">
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
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
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
                  <Button variant="outline" size="sm" className="h-9">
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

          {/* Select Controls - Gmail style */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between py-2 px-1 border-b border-border/20">
              <div className="flex items-center gap-3">
                {!isSelectMode ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 hover:!bg-transparent dark:hover:text-white hover:text-black"
                      onClick={toggleSelectMode}
                      title="Select notifications"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Select
                    </Button>
                    <Separator className=" bg-gray-500 h-4 w-px"/>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-sm font-medium hover:!bg-transparent dark:hover:text-white hover:text-black"
                      onClick={async () => {
                        if (currentUser?.id) {
                          await fetchSocketNotifications(currentUser.id, 100, 0)
                        }
                      }}
                      title="Refresh notifications"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                    </Button>
                      <Separator className=" bg-gray-500 h-4 w-px"/>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 hover:!bg-transparent dark:hover:text-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        if (!isSelectMode) {
                          toggleSelectMode()
                        }
                      }}
                      disabled={notifications.length === 0}
                      title="Click to select notifications, then mark as read"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                    </Button>
                    <Separator className=" bg-gray-500 h-4 w-px"/>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 hover:!bg-transparent dark:hover:text-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        if (!isSelectMode) {
                          toggleSelectMode()
                        }
                      }}
                      disabled={notifications.length === 0}
                      title="Click to select notifications, then delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:!bg-transparent dark:hover:text-white hover:text-black"
                      onClick={toggleSelectAll}
                      title={selectedNotifications.size === currentNotifications.length ? "Deselect all" : "Select all"}
                    >
                      {selectedNotifications.size === currentNotifications.length ? (
                        <SquareCheck className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 hover:!bg-transparent dark:hover:text-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={isSelectMode ? handleBulkMarkAsRead : handleMarkAllRead}
                      disabled={(() => {
                        if (selectedNotifications.size === 0) return true
                        
                        // Check if all selected notifications are already read
                        const selectedNotificationObjects = currentNotifications.filter(n => selectedNotifications.has(n.id))
                        const allSelectedAreRead = selectedNotificationObjects.every(n => n.read)
                        
                        return allSelectedAreRead
                      })()}
                      title={(() => {
                        if (selectedNotifications.size === 0) return "Select notifications to mark as read"
                        
                        const selectedNotificationObjects = currentNotifications.filter(n => selectedNotifications.has(n.id))
                        const allSelectedAreRead = selectedNotificationObjects.every(n => n.read)
                        
                        if (allSelectedAreRead) return "All selected notifications are already read"
                        
                        return selectedNotifications.size < currentNotifications.length ? 
                          `Mark ${selectedNotifications.size} selected notification${selectedNotifications.size !== 1 ? 's' : ''} as read` : 
                          "Mark all notifications as read"
                      })()}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {(() => {
                        if (selectedNotifications.size === 0) {
                          return "Mark as Read"
                        }
                        
                        // Check if all selected notifications are already read
                        const selectedNotificationObjects = currentNotifications.filter(n => selectedNotifications.has(n.id))
                        const allSelectedAreRead = selectedNotificationObjects.every(n => n.read)
                        
                        if (allSelectedAreRead) {
                          return "Mark as Read"
                        }
                        
                        // Always show count of unread selected items
                        const unreadSelectedCount = selectedNotificationObjects.filter(n => !n.read).length
                        return `Mark as Read (${unreadSelectedCount})`
                      })()}
                    </Button>
                    <Separator className=" bg-gray-500 h-4 w-px"/>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 hover:!bg-transparent dark:hover:text-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleBulkDelete}
                      disabled={selectedNotifications.size === 0}
                      title={`Delete ${selectedNotifications.size} selected notification${selectedNotifications.size !== 1 ? 's' : ''}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {(() => {
                        if (selectedNotifications.size === 0) {
                          return "Delete"
                        }
                        
                        if (selectedNotifications.size < currentNotifications.length) {
                          // Partial selection - show count of selected items
                          return `Delete (${selectedNotifications.size})`
                        }
                        
                        // Select all - show total count
                        return `Delete (${currentNotifications.length})`
                      })()}
                    </Button>
                    <Separator className=" bg-gray-500 h-4 w-px"/>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:!bg-transparent dark:hover:text-white hover:text-black"
                      onClick={toggleSelectMode}
                      title="Cancel selection (Esc)"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              
              {isSelectMode && selectedNotifications.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedNotifications.size} of {currentNotifications.length} selected
                </div>
              )}
              
              {isSelectMode && (
                <div className="text-xs text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Esc</kbd> to cancel
                </div>
              )}
            </div>
          )}

          <div className="space-y-0">
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
                          currentNotifications.map((notification, index) => {
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
                  default: return Bell
                }
              }
              
              const IconComponent = getIconComponent(notification.icon)
              
              return (
                <div key={notification.id}>
                  {index > 0 && (
                    <div className="h-px bg-border/30 mx-4" />
                  )}
                  <Card 
                    id={`notification-${notification.id}`}
                    className={`transition-all duration-200 ${isSelectMode ? 'cursor-default' : 'cursor-pointer'} hover:bg-accent/30 py-2 border-0 shadow-none ${
                      !notification.read 
                        ? 'bg-blue-50/30 dark:bg-blue-950/5' 
                        : 'bg-card/50'
                    } ${
                      highlightedNotificationId === notification.id
                        ? 'ring-2 ring-blue-500 bg-blue-100/50 dark:bg-blue-950/20 animate-pulse'
                        : ''
                    } ${
                      selectedNotifications.has(notification.id)
                        ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/10'
                        : ''
                    }`}
                  onClick={() => {
                    if (isSelectMode) {
                      // In select mode, toggle selection
                      toggleSelectNotification(notification.id)
                      return
                    }
                    
                    // Mark as read when clicking the card
                    if (!notification.read) {
                      // Update local state first
                      setNotifications(prev => 
                        prev.map(n => 
                          n.id === notification.id ? { ...n, read: true } : n
                        )
                      )
                      
                      // Update the old notification service
                      markNotificationAsRead(notification.id)
                      
                      // Dispatch event to update app-header
                      window.dispatchEvent(new CustomEvent('notifications-updated'))
                      
                      // Persist to database
                      try {
                        const user = getCurrentUser()
                        if (user?.email) {
                          // Extract numeric ID from db_ prefix
                          let notificationId: number
                          const idStr = notification.id.toString()
                          if (idStr.startsWith('db_')) {
                            notificationId = parseInt(idStr.slice(3))
                          } else {
                            notificationId = parseInt(idStr)
                          }
                          
                                                      if (!isNaN(notificationId)) {
                              // Use socket context if available, otherwise fallback to direct API
                              if (socketConnected && user.id) {
                                // Use socket context to mark as read
                                markAsReadSocket(notificationId)
                              } else {
                                // Fallback to direct API call
                                fetch('/api/notifications/mark-read', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ id: notificationId, email: user.email })
                                })
                              }
                            }
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
                    let actionUrl = notification.actionUrl || notification.actionData?.action_url
                    
                    // For task notifications, ensure taskId is included in the URL
                    if (notification.category === 'task' && notification.actionData?.task_id && actionUrl) {
                      // Check if taskId is already in the URL
                      if (!actionUrl.includes('taskId=')) {
                        const separator = actionUrl.includes('?') ? '&' : '?'
                        actionUrl = `${actionUrl}${separator}taskId=${notification.actionData.task_id}`
                      }
                    }
                    
                    if (actionUrl) {
                      router.push(actionUrl)
                      return
                    }
                    // Try to infer a path from actionData
                    if (notification.actionData?.ticket_id) {
                      router.push(`/forms/${notification.actionData.ticket_id}`)
                      return
                    }
                  }}
                >
                  <CardContent className="p-2">
                    <div className="flex items-center gap-2">
                      {isSelectMode && (
                        <Checkbox
                          checked={selectedNotifications.has(notification.id)}
                          onCheckedChange={() => toggleSelectNotification(notification.id)}
                          className="flex-shrink-0"
                        />
                      )}
                      <div className={`p-1 rounded-full ${getTypeColor(notification.type)} flex-shrink-0`}>
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className={`text-sm font-medium truncate ${
                                !notification.read ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 flex-shrink-0">
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 mb-0.5">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span key={nowTick}>{formatTimeAgo(notification.time)}</span>
                              <span>•</span>
                              <span className="capitalize">{notification.type}</span>
                            </div>
                          </div>
                          {!isSelectMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteNotification(notification.id) }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </div>
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