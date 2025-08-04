import { getCurrentUser } from './ticket-utils'
// import { getAllTasks, getNotStartedTaskCount } from './task-utils'
import { getCurrentUserTickets } from './ticket-utils'

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  time: number // Changed from string to number (timestamp)
  read: boolean
  icon: string
  actionUrl?: string
  actionData?: any
  category: 'task' | 'ticket' | 'activity' | 'system'
  priority: 'low' | 'medium' | 'high' // New priority field
  eventType: 'creation' | 'status_change' | 'completion' | 'assignment' | 'system' // New event type
}

export interface NotificationData {
  notifications: Notification[]
  lastChecked: number
  unreadCount: number
  notificationSettings: {
    taskUpdates: boolean
    taskCompletions: boolean
    ticketUpdates: boolean
    ticketResolutions: boolean
    systemAlerts: boolean
  }
}

const NOTIFICATIONS_STORAGE_KEY = 'shoreagents-notifications'

// Smart notification rules for dashboard
const NOTIFICATION_RULES = {
  // Only notify for significant task events
  task: {
    creation: true,        // New task created
    completion: true,      // Task marked as Done
    assignment: true,      // Task assigned to someone
    status_change: true,   // Notify for status updates
    minor_update: false    // Don't notify for description/name changes
  },
  
  // Only notify for significant ticket events
  ticket: {
    creation: true,        // New ticket created
    resolution: true,      // Ticket resolved
    assignment: true,      // Ticket assigned
    status_change: false,  // Don't notify for every status update
    minor_update: false    // Don't notify for comment updates
  },
  
  // System notifications
  system: {
    daily_summary: true,   // Daily activity summary
    weekly_report: true,   // Weekly performance report
    milestone: true,       // Important milestones
    alert: true           // Critical alerts only
  }
}

// Migrate old string-based time notifications to timestamp format
function migrateNotificationTimes(notifications: Notification[]): Notification[] {
  return notifications.map(notification => {
    // If time is a string, convert it to a timestamp
    if (typeof notification.time === 'string') {
      // Try to parse the string as a date, or use current time as fallback
      const timestamp = new Date(notification.time).getTime()
      return {
        ...notification,
        time: isNaN(timestamp) ? Date.now() : timestamp
      }
    }
    return notification
  })
}

// Get notifications for current user
export function getNotifications(): Notification[] {
  if (typeof window === 'undefined') return []
  
  const user = getCurrentUser()
  if (!user) return []
  
  const key = `${NOTIFICATIONS_STORAGE_KEY}-${user.email}`
  
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return []
    
    const data: NotificationData = JSON.parse(stored)
    const notifications = data.notifications || []
    
    // Migrate old notifications to new timestamp format
    const migratedNotifications = migrateNotificationTimes(notifications)
    
    // Save migrated notifications back to localStorage
    if (migratedNotifications.length !== notifications.length || 
        migratedNotifications.some((n, i) => n.time !== notifications[i]?.time)) {
      saveNotifications(migratedNotifications)
    }
    
    return migratedNotifications
  } catch {
    return []
  }
}

// Save notifications for current user
export function saveNotifications(notifications: Notification[]): void {
  if (typeof window === 'undefined') return
  
  const user = getCurrentUser()
  if (!user) return
  
  const key = `${NOTIFICATIONS_STORAGE_KEY}-${user.email}`
  const data: NotificationData = {
    notifications,
    lastChecked: Date.now(),
    unreadCount: notifications.filter(n => !n.read).length,
    notificationSettings: {
      taskUpdates: true,
      taskCompletions: true,
      ticketUpdates: true,
      ticketResolutions: true,
      systemAlerts: true
    }
  }
  
  localStorage.setItem(key, JSON.stringify(data))
}

// Smart notification addition with deduplication
export function addSmartNotification(notification: Omit<Notification, 'id' | 'time' | 'read' | 'priority' | 'eventType'>, eventType: 'creation' | 'status_change' | 'completion' | 'assignment' | 'system'): void {
  const notifications = getNotifications()
  
  // Check if this is a significant event that should trigger notification
  const shouldNotify = shouldCreateNotification(notification.category, eventType)
  
  if (!shouldNotify) {
    return // Skip notification for minor updates
  }
  
  // Check for recent duplicate notifications 
  // Use very short window for status changes (5 seconds) vs other events (5 minutes)
  const duplicateWindow = eventType === 'status_change' ? (5 * 1000) : (5 * 60 * 1000);
  const duplicateThreshold = Date.now() - duplicateWindow;
  
  const recentDuplicate = notifications.find(n => {
    const categoryMatch = n.category === notification.category;
    const titleMatch = n.title === notification.title;
    const eventTypeMatch = n.eventType === eventType;
    const timeMatch = new Date(n.time).getTime() > duplicateThreshold;
    
    // For status changes, compare the exact message (includes the new status)
    // This allows multiple different status changes on the same task
    let contentMatch = false;
    if (eventType === 'status_change') {
      // Only consider it duplicate if the exact same status change happened
      contentMatch = n.message === notification.message;
    } else if (notification.actionData?.taskId && n.actionData?.taskId) {
      // For other events (creation, assignment), compare task IDs
      contentMatch = n.actionData.taskId === notification.actionData.taskId;
    } else {
      contentMatch = n.message === notification.message;
    }
    
    return categoryMatch && titleMatch && eventTypeMatch && contentMatch && timeMatch;
  })
  
  if (recentDuplicate) {
    return // Skip duplicate notifications
  }
  
  const newNotification: Notification = {
    ...notification,
    id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    time: Date.now(), // Store actual timestamp
    read: false,
    priority: getNotificationPriority(notification.category, eventType),
    eventType
  }
  
  notifications.unshift(newNotification) // Add to beginning
  
  // Keep only last 50 notifications for dashboard (reduced from 100)
  if (notifications.length > 50) {
    notifications.splice(50)
  }
  
  saveNotifications(notifications)
  console.log('Notifications saved. Total count:', notifications.length);

  // Show system-wide notification if Electron is available
  if (typeof window !== 'undefined' && window.electronAPI?.systemNotifications) {
    console.log('Showing Electron system notification');
    try {
      const systemNotificationId = `system_${newNotification.id}`;

      window.electronAPI.systemNotifications.show({
        title: newNotification.title,
        message: newNotification.message,
        actionUrl: newNotification.actionUrl,
        id: systemNotificationId // Use system notification ID
      })

      // Trigger notification update event to refresh UI
      console.log('Dispatching notifications-updated event');
      window.dispatchEvent(new CustomEvent('notifications-updated'))

      // Also trigger notification count change for system tray
      if (window.electronAPI?.send) {
        const newUnreadCount = notifications.filter(n => !n.read).length;
        console.log('Sending notification count to system tray:', newUnreadCount);
        window.electronAPI.send('notification-count-changed', { count: newUnreadCount });
      }
    } catch (error) {
      console.log('System notification not available:', error)

      // Fallback: Just trigger the UI update without system notification
      console.log('Fallback: Dispatching notifications-updated event');
      window.dispatchEvent(new CustomEvent('notifications-updated'))
    }
  } else {
    console.log('Electron not available, triggering fallback notification update');
    // Fallback for web browser: Just trigger the UI update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'))
    }
  }
}

// Determine if notification should be created based on rules
function shouldCreateNotification(category: string, eventType: string): boolean {
  if (category === 'task') {
    return NOTIFICATION_RULES.task[eventType as keyof typeof NOTIFICATION_RULES.task] || false
  }
  
  if (category === 'ticket') {
    return NOTIFICATION_RULES.ticket[eventType as keyof typeof NOTIFICATION_RULES.ticket] || false
  }
  
  if (category === 'system') {
    return NOTIFICATION_RULES.system[eventType as keyof typeof NOTIFICATION_RULES.system] || false
  }
  
  return false
}

// Get notification priority based on category and event type
function getNotificationPriority(category: string, eventType: string): 'low' | 'medium' | 'high' {
  if (eventType === 'completion' || eventType === 'resolution') {
    return 'high'
  }
  
  if (eventType === 'creation' || eventType === 'assignment') {
    return 'medium'
  }
  
  if (eventType === 'status_change') {
    return 'low'
  }
  
  return 'medium'
}

// Legacy function for backward compatibility
export function addNotification(notification: Omit<Notification, 'id' | 'time' | 'read' | 'priority' | 'eventType'>): void {
  const notificationWithDefaults = {
    ...notification,
    priority: 'medium' as const,
    eventType: 'system' as const
  }
  addSmartNotification(notificationWithDefaults, 'system')
}

// Mark notification as read
export function markNotificationAsRead(id: string): void {
  const notifications = getNotifications()
  const updated = notifications.map(n => 
    n.id === id ? { ...n, read: true } : n
  )
  saveNotifications(updated)
  
  // Trigger a custom event to notify other components
  if (typeof window !== 'undefined') {
    const newUnreadCount = updated.filter(n => !n.read).length;
    window.dispatchEvent(new CustomEvent('notifications-updated', {
      detail: { unreadCount: newUnreadCount }
    }))
    
    // Also trigger notification count change for system tray
    if (window.electronAPI?.send) {
      window.electronAPI.send('notification-count-changed', { count: newUnreadCount });
    }
  }
}

// Mark all notifications as read
export function markAllNotificationsAsRead(): void {
  const notifications = getNotifications()
  const updated = notifications.map(n => ({ ...n, read: true }))
  saveNotifications(updated)
  
  // Trigger a custom event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notifications-updated', {
      detail: { unreadCount: 0 }
    }))
    
    // Also trigger notification count change for system tray
    if (window.electronAPI?.send) {
      window.electronAPI.send('notification-count-changed', { count: 0 });
    }
  }
}

// Delete notification
export function deleteNotification(id: string): void {
  const notifications = getNotifications()
  const updated = notifications.filter(n => n.id !== id)
  saveNotifications(updated)
}

// Clear all notifications
export function clearAllNotifications(): void {
  saveNotifications([])
}

// Remove duplicate notifications
export function removeDuplicateNotifications(): void {
  const notifications = getNotifications()
  const uniqueNotifications: Notification[] = []
  const seen = new Set<string>()
  
  notifications.forEach(notification => {
    // Create a unique key for each notification
    const key = `${notification.title}-${notification.category}-${notification.actionData?.taskId || notification.actionData?.ticketId || 'system'}`
    
    if (!seen.has(key)) {
      seen.add(key)
      uniqueNotifications.push(notification)
    }
  })
  
  saveNotifications(uniqueNotifications)
}

// Get unread count
export function getUnreadCount(): number {
  const notifications = getNotifications()
  return notifications.filter(n => !n.read).length
}

// Format time ago
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleDateString()
}

// Check for new tasks and generate notifications
export function checkForNewTaskNotifications(): void {
  // Skip this function since we now have real-time notifications
  // This prevents duplicate notifications when tasks are created
  return
}

// Check for task status changes
export function checkForTaskStatusNotifications(): void {
  // Skip this function since we now have real-time notifications
  // This prevents duplicate notifications when tasks are updated
  return
}

// Check for ticket status changes
export function checkForTicketNotifications(): void {
  // Skip this function since we now have real-time notifications
  // This prevents duplicate notifications when tickets are created/updated
  return
}

// Check for activity-based notifications
export function checkForActivityNotifications(): void {
  // Activity notifications are now handled by database-driven activity tracking
  // This function is kept for compatibility but no longer uses localStorage
  return
}

// Check for system notifications
export function checkForSystemNotifications(): void {
  // Skip this function since we now have real-time notifications
  // This prevents duplicate system notifications
  return
}

// Main function to check all notifications
export function checkAllNotifications(): void {
  checkForNewTaskNotifications()
  checkForTaskStatusNotifications()
  checkForTicketNotifications()
  checkForActivityNotifications()
  checkForSystemNotifications()
}

// Check only for new notifications (preserves existing read status)
export function checkForNewNotificationsOnly(): void {
  const existingNotifications = getNotifications()
  
  // Only add notifications if we have very few (less than 5) or none
  if (existingNotifications.length < 5) {
    checkForNewTaskNotifications()
    checkForTaskStatusNotifications()
    checkForTicketNotifications()
    checkForActivityNotifications()
    checkForSystemNotifications()
    addSampleNotifications()
  }
}

// Force regenerate all notifications from localStorage data
export function regenerateAllNotifications(): void {
  const existingNotifications = getNotifications()
  
  // Clear existing notifications
  clearAllNotifications()
  
  // Regenerate from all localStorage data
  checkForNewTaskNotifications()
  checkForTaskStatusNotifications()
  checkForTicketNotifications()
  checkForActivityNotifications()
  checkForSystemNotifications()
  
  // Add welcome notification
  addSampleNotifications()
  
  // Restore read status from existing notifications
  const newNotifications = getNotifications()
  const updatedNotifications = newNotifications.map(newNotif => {
    // Find matching existing notification by title and category
    const existingNotif = existingNotifications.find(existing => 
      existing.title === newNotif.title && 
      existing.category === newNotif.category &&
      existing.actionData?.taskId === newNotif.actionData?.taskId
    )
    
    // If we found a matching notification, preserve its read status
    if (existingNotif) {
      return { ...newNotif, read: existingNotif.read }
    }
    
    return newNotif
  })
  
  saveNotifications(updatedNotifications)
  
  // Clean up any duplicates that might have been created
  removeDuplicateNotifications()
}

// Initialize notification checking
export function initializeNotificationChecking(): void {
  // Clean up any duplicate notifications first
  removeDuplicateNotifications()
  
  // Only check for new notifications, don't regenerate existing ones
  checkForNewNotificationsOnly()
  
  // Check every 5 minutes
  setInterval(checkForNewNotificationsOnly, 5 * 60 * 1000)
}

// Add sample notifications for testing
export function addSampleNotifications(): void {
  const notifications = getNotifications()
  
  // Only add sample notifications if very few exist (less than 3)
  if (notifications.length < 3) {
    // Add a welcome notification
    const welcomeNotification = notifications.find(n => 
      n.title.includes('Welcome') || n.title.includes('Getting Started')
    )
    
    if (!welcomeNotification) {
      addNotification({
        type: 'info',
        title: 'Welcome to ShoreAgents!',
        message: 'Your notification system is now active. You\'ll see updates about your tasks, tickets, and activity here.',
        icon: 'Bell',
        category: 'system',
        actionUrl: '/dashboard'
      })
    }
  }
}

// Clean up and refresh notifications
export function cleanupAndRefreshNotifications(): void {
  removeDuplicateNotifications()
  checkForNewNotificationsOnly()
}

// Remove "Unread Tasks" notifications
export function removeUnreadTasksNotifications(): void {
  const notifications = getNotifications()
  const updatedNotifications = notifications.filter(n => 
    !(n.category === 'system' && n.title.includes('Unread Tasks'))
  )
  saveNotifications(updatedNotifications)
} 