// Notification service (socket/db-backed). Removed localStorage usage.

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

// In-memory store for current session notifications
let inMemoryNotifications: Notification[] = []
// Parse DB timestamp and correct for break notification timezone bug only
export function parseDbTimestampToMs(createdAt: any, notificationType?: string): number {
  try {
    if (createdAt == null) return Date.now()
    if (typeof createdAt === 'number') return createdAt
    if (createdAt instanceof Date) return createdAt.getTime()
    
    const raw = String(createdAt).trim()
    let parsedMs = new Date(raw).getTime()
    
    if (isNaN(parsedMs)) return Date.now()
    
    // HOTFIX: Only break notifications have timestamps 8 hours in the future
    // Task/ticket notifications have correct timestamps already
    if (notificationType === 'break') {
      // Subtract 8 hours (28800000 ms) to correct break notifications to proper Manila morning times
      parsedMs = parsedMs - (8 * 60 * 60 * 1000)
    }
    
    return parsedMs
  } catch {
    return Date.now()
  }
}


// LocalStorage key removed; notifications are not persisted in browser storage

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
  return migrateNotificationTimes(inMemoryNotifications)
}

// Save notifications for current user
export function saveNotifications(notifications: Notification[]): void {
  inMemoryNotifications = notifications.slice(0)
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
  const updated = getNotifications().map(n => n.id === id ? { ...n, read: true } : n)
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
  const updated = getNotifications().map(n => ({ ...n, read: true }))
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
  const updated = getNotifications().filter(n => n.id !== id)
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
  return getNotifications().filter(n => !n.read).length
}

// Format time ago
export function formatTimeAgo(timestamp: number): string {
  // Compute relative to actual current time (UTC-based epoch)
  const now = Date.now()
  const diffMs = now - timestamp
  
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const weekMs = 7 * dayMs
  const yearMs = 365 * dayMs

  // Future
  if (diffMs < 0) {
    const future = Math.abs(diffMs)
    if (future < minuteMs) return 'in 1m'
    if (future < hourMs) return `in ${Math.floor(future / minuteMs)}m`
    if (future < dayMs) return `in ${Math.floor(future / hourMs)}h`
    if (future < weekMs) return `in ${Math.floor(future / dayMs)}d`
    if (future < yearMs) return `in ${Math.floor(future / weekMs)}w`
    return `in ${Math.floor(future / yearMs)}y`
  }
  
  // Past
  if (diffMs < 60000) return 'Just now'  // Less than 1 minute
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}m ago`
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}h ago`
  if (diffMs < weekMs) return `${Math.floor(diffMs / dayMs)}d ago`
  if (diffMs < yearMs) return `${Math.floor(diffMs / weekMs)}w ago`
  return `${Math.floor(diffMs / yearMs)}y ago`
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
  // No-op: notifications are socket-driven
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
  // Legacy localStorage polling disabled; notifications now database-driven via sockets
  return
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
}

// Remove "Unread Tasks" notifications
export function removeUnreadTasksNotifications(): void {
  const notifications = getNotifications()
  const updatedNotifications = notifications.filter(n => 
    !(n.category === 'system' && n.title.includes('Unread Tasks'))
  )
  saveNotifications(updatedNotifications)
} 