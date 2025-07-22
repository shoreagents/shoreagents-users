"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle, Info, Clock, Trash2, Bell, CheckSquare, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
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
  formatTimeAgo
} from "@/lib/notification-service"
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const notificationsPerPage = 10

  // Load notifications
  useEffect(() => {
    const loadNotifications = () => {
      const realNotifications = getNotifications()
      setNotifications(realNotifications)
      setUnreadCount(getUnreadCount())
    }

    loadNotifications()
    
    // Update every 10 seconds for real-time responsiveness
    const interval = setInterval(loadNotifications, 10000)
    
    // Listen for real-time notification updates
    const handleNotificationUpdate = () => {
      loadNotifications()
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
      clearInterval(interval)
      window.removeEventListener('notifications-updated', handleNotificationUpdate)
    }
  }, [])

  const handleDeleteNotification = (id: string) => {
    deleteNotification(id)
    // Update local state immediately
    const realNotifications = getNotifications()
    setNotifications(realNotifications)
    setUnreadCount(getUnreadCount())
  }

  // Pagination logic
  const totalPages = Math.ceil(notifications.length / notificationsPerPage)
  const startIndex = (currentPage - 1) * notificationsPerPage
  const endIndex = startIndex + notificationsPerPage
  const currentNotifications = notifications.slice(startIndex, endIndex)

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
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {currentNotifications.length === 0 ? (
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
                  className={`transition-all duration-200 cursor-pointer hover:bg-accent/50 ${
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
                    }
                    
                    // Navigate if actionUrl is provided
                    if (notification.actionUrl) {
                      router.push(notification.actionUrl)
                    }
                  }}
                >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${getTypeColor(notification.type)}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-semibold ${
                                  !notification.read ? 'text-foreground' : 'text-muted-foreground'
                                }`}>
                                  {notification.title}
                                </h3>
                                {!notification.read && (
                                  <Badge variant="secondary" className="text-xs">
                                    New
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatTimeAgo(notification.time)}</span>
                                <span>•</span>
                                <span className="capitalize">{notification.type}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNotification(notification.id)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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

          {notifications.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, notifications.length)} of {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 && ` • ${unreadCount} unread`}
              </p>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 