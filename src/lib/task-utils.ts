import { Task, TaskData, TaskStatus, TaskPriority, TaskType } from '@/types/task'
import { getCurrentUserProfile } from './user-profiles'
import { addSmartNotification } from './notification-service'
import { getCurrentUser } from './ticket-utils'

// Get user-specific storage key
function getTasksStorageKey(): string {
  const user = getCurrentUser()
  const userEmail = user?.email || 'anonymous'
  return `shoreagents_tasks_${userEmail}`
}

// Initialize default task data
const defaultTaskData: TaskData = {
  tasks: [],
  customStatuses: ['Not started', 'In progress', 'Done'],
  customTaskTypes: ['Document', 'Bug', 'Feature Request', 'Polish']
}

// Get all task data from localStorage
export function getTaskData(): TaskData {
  if (typeof window === 'undefined') return defaultTaskData
  
  try {
    const storageKey = getTasksStorageKey()
    const stored = localStorage.getItem(storageKey)
    if (!stored) return defaultTaskData
    
    const parsed = JSON.parse(stored)
    return {
      ...defaultTaskData,
      ...parsed
    }
  } catch (error) {
    console.error('Error loading task data:', error)
    return defaultTaskData
  }
}

// Save task data to localStorage
export function saveTaskData(data: TaskData): void {
  if (typeof window === 'undefined') return
  
  try {
    const storageKey = getTasksStorageKey()
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving task data:', error)
  }
}

// Generate unique task ID with microsecond precision and crypto random
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36)
  const microseconds = performance.now().toString(36).replace('.', '')
  const random1 = Math.random().toString(36).substr(2, 9)
  const random2 = Math.random().toString(36).substr(2, 5)
  return `task_${timestamp}_${microseconds}_${random1}${random2}`
}

// Get current user info for created/edited by fields
function getCurrentUserInfo() {
  const profile = getCurrentUserProfile()
  return profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown User'
}

// Create a new task
export function createTask(taskData: Partial<Task>): Task {
  const data = getTaskData()
  const currentUser = getCurrentUserInfo()
  const now = new Date().toISOString()
  
  const newTask: Task = {
    id: generateTaskId(),
    taskName: taskData.taskName || 'New Task',
    assignee: taskData.assignee || currentUser,
    status: taskData.status || 'Not started',
    priority: taskData.priority || 'Medium',
    taskType: taskData.taskType || 'Document',
    description: taskData.description || '',
    attachedFiles: taskData.attachedFiles || [],
    dueDate: taskData.dueDate || '',
    createdBy: currentUser,
    createdTime: now,
    lastEditedBy: currentUser,
    lastEditedTime: now
  }
  
  // Double-check that this task ID doesn't already exist before adding
  if (!data.tasks.some(task => task.id === newTask.id)) {
    data.tasks.push(newTask)
    saveTaskData(data)
    
    // Add smart notification for new task creation
    addSmartNotification({
      type: 'info',
      title: 'New Task Created',
      message: `Task "${newTask.taskName}" has been created and assigned to ${newTask.assignee || 'you'}`,
      icon: 'CheckSquare',
      category: 'task',
      actionUrl: '/productivity/tasks',
      actionData: { taskId: newTask.id }
    }, 'creation')
    
    // Trigger notification update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'))
    }
  } else {
    console.warn('Attempted to create task with existing ID:', newTask.id)
  }
  
  return newTask
}

// Update an existing task
export function updateTask(taskId: string, updates: Partial<Task>): Task | null {
  const data = getTaskData()
  const taskIndex = data.tasks.findIndex(task => task.id === taskId)
  
  if (taskIndex === -1) return null
  
  const currentUser = getCurrentUserInfo()
  const originalTask = data.tasks[taskIndex]
  const updatedTask = {
    ...originalTask,
    ...updates,
    lastEditedBy: currentUser,
    lastEditedTime: new Date().toISOString()
  }
  
  data.tasks[taskIndex] = updatedTask
  saveTaskData(data)
  
  // Determine event type and create smart notification
  let eventType: 'status_change' | 'completion' | 'assignment' = 'status_change'
  let notificationType: 'success' | 'warning' | 'info' = 'info'
  let title = 'Task Updated'
  let message = `Task "${updatedTask.taskName}" has been updated`
  
  // Check for significant changes that warrant notifications
  if (updatedTask.status === 'Done' && originalTask.status !== 'Done') {
    eventType = 'completion'
    notificationType = 'success'
    title = 'Task Completed'
    message = `Task "${updatedTask.taskName}" has been marked as completed`
  } else if (updatedTask.status === 'In progress' && originalTask.status === 'Not started') {
    eventType = 'status_change'
    notificationType = 'warning'
    title = 'Task Started'
    message = `Task "${updatedTask.taskName}" is now in progress`
  } else if (updatedTask.assignee !== originalTask.assignee) {
    eventType = 'assignment'
    notificationType = 'info'
    title = 'Task Reassigned'
    message = `Task "${updatedTask.taskName}" has been reassigned to ${updatedTask.assignee}`
  } else {
    // Skip notification for minor updates (description, name changes, etc.)
    return updatedTask
  }
  
  // Add smart notification for significant task updates
  addSmartNotification({
    type: notificationType,
    title,
    message,
    icon: 'CheckSquare',
    category: 'task',
    actionUrl: '/productivity/tasks',
    actionData: { taskId: updatedTask.id }
  }, eventType)
  
  // Trigger notification update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notifications-updated'))
  }
  
  return updatedTask
}

// Delete a task
export function deleteTask(taskId: string): boolean {
  const data = getTaskData()
  const initialLength = data.tasks.length
  data.tasks = data.tasks.filter(task => task.id !== taskId)
  
  if (data.tasks.length < initialLength) {
    saveTaskData(data)
    return true
  }
  
  return false
}

// Get all tasks
export function getAllTasks(): Task[] {
  const data = getTaskData()
  // Deduplicate tasks based on ID to prevent key conflicts
  const uniqueTasks = data.tasks.filter((task, index, self) => 
    index === self.findIndex(t => t.id === task.id)
  )
  
  // If we found duplicates, save the cleaned data back to localStorage
  if (uniqueTasks.length !== data.tasks.length) {
    console.warn('Found duplicate tasks, cleaning up localStorage')
    data.tasks = uniqueTasks
    saveTaskData(data)
  }
  
  return uniqueTasks
}

// Get task by ID
export function getTaskById(taskId: string): Task | null {
  const data = getTaskData()
  return data.tasks.find(task => task.id === taskId) || null
}

// Add custom status
export function addCustomStatus(status: string): void {
  const data = getTaskData()
  if (!data.customStatuses.includes(status)) {
    data.customStatuses.push(status)
    saveTaskData(data)
  }
}

// Add custom task type
export function addCustomTaskType(taskType: string): void {
  const data = getTaskData()
  if (!data.customTaskTypes.includes(taskType)) {
    data.customTaskTypes.push(taskType)
    saveTaskData(data)
  }
}

// Get available statuses (including custom ones)
export function getAvailableStatuses(): string[] {
  return getTaskData().customStatuses
}

// Get available task types (including custom ones)
export function getAvailableTaskTypes(): string[] {
  return getTaskData().customTaskTypes
}

// Get count of tasks that are not started
export function getNotStartedTaskCount(): number {
  const tasks = getAllTasks()
  return tasks.filter(task => task.status === 'Not started').length
} 