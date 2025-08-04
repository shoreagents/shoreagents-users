// Task Activity Utilities

export interface TaskGroup {
  id: number
  title: string
  color: string
  position: number
  is_default: boolean
  tasks: Task[]
}

export interface Task {
  id: number
  title: string
  description: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  assignee: string
  due_date: string
  tags: string[]
  position: number
  status: string
  created_at: string
  updated_at: string
}

// Fetch all task groups and tasks for the current user
export async function fetchTaskActivityData(): Promise<TaskGroup[]> {
  try {
    // Get current user from localStorage
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) {
      throw new Error('User not authenticated')
    }
    
    const parsed = JSON.parse(authData)
    const user = parsed.user
    
    const response = await fetch(`/api/task-activity?email=${encodeURIComponent(user.email)}`)
    const data = await response.json()
    
    if (data.success) {
      return data.groups
    } else {
      throw new Error(data.error || 'Failed to fetch task activity data')
    }
  } catch (error) {
    console.error('Error fetching task activity data:', error)
    throw error
  }
}

// Create a new task
export async function createTask(groupId: number, title?: string, description?: string): Promise<Task> {
  try {
    // Get current user from localStorage
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) {
      throw new Error('User not authenticated')
    }
    
    const parsed = JSON.parse(authData)
    const user = parsed.user
    
    const response = await fetch(`/api/task-activity?email=${encodeURIComponent(user.email)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_task',
        data: {
          group_id: groupId,
          title: title || 'New Task',
          description: description || 'Task description'
        }
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      return data.task
    } else {
      throw new Error(data.error || 'Failed to create task')
    }
  } catch (error) {
    console.error('Error creating task:', error)
    throw error
  }
}

// Create a new group
export async function createGroup(title: string, color?: string): Promise<TaskGroup> {
  try {
    // Get current user from localStorage
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) {
      throw new Error('User not authenticated')
    }
    
    const parsed = JSON.parse(authData)
    const user = parsed.user
    
    const response = await fetch(`/api/task-activity?email=${encodeURIComponent(user.email)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_group',
        data: {
          title,
          color: color || 'bg-purple-50 dark:bg-purple-950/20'
        }
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      return data.group
    } else {
      throw new Error(data.error || 'Failed to create group')
    }
  } catch (error) {
    console.error('Error creating group:', error)
    throw error
  }
}

// Move a task to a different group
export async function moveTask(taskId: number, newGroupId: number, targetPosition?: number): Promise<Task> {
  try {
    // Get current user from localStorage
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) {
      throw new Error('User not authenticated')
    }
    
    const parsed = JSON.parse(authData)
    const user = parsed.user
    
    const requestBody = {
      action: 'move_task',
      data: {
        task_id: taskId,
        new_group_id: newGroupId,
        target_position: targetPosition
      }
    }
    
    console.log('Sending move task request:', requestBody)
    
    const response = await fetch(`/api/task-activity?email=${encodeURIComponent(user.email)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
    
    const data = await response.json()
    console.log('Move task response:', data)
    
    if (data.success) {
      return data.task
    } else {
      throw new Error(data.error || 'Failed to move task')
    }
  } catch (error) {
    console.error('Error moving task:', error)
    throw error
  }
}

// Update a task
export async function updateTask(taskId: number, updates: Partial<Task>): Promise<Task> {
  try {
    const response = await fetch(`/api/task-activity/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates)
    })
    
    const data = await response.json()
    
    if (data.success) {
      return data.task
    } else {
      throw new Error(data.error || 'Failed to update task')
    }
  } catch (error) {
    console.error('Error updating task:', error)
    throw error
  }
}

// Delete a task (soft delete)
export async function deleteTask(taskId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/task-activity/${taskId}`, {
      method: 'DELETE'
    })
    
    const data = await response.json()
    
    if (data.success) {
      return true
    } else {
      throw new Error(data.error || 'Failed to delete task')
    }
  } catch (error) {
    console.error('Error deleting task:', error)
    throw error
  }
}

// Get default groups for a new user
export function getDefaultGroups(): TaskGroup[] {
  return [
    {
      id: 0,
      title: 'To Do',
      color: 'bg-gray-100 dark:bg-gray-800',
      position: 0,
      is_default: true,
      tasks: []
    },
    {
      id: 0,
      title: 'In Progress',
      color: 'bg-blue-50 dark:bg-blue-950/20',
      position: 1,
      is_default: true,
      tasks: []
    },
    {
      id: 0,
      title: 'Review',
      color: 'bg-yellow-50 dark:bg-yellow-950/20',
      position: 2,
      is_default: true,
      tasks: []
    },
    {
      id: 0,
      title: 'Done',
      color: 'bg-green-50 dark:bg-green-950/20',
      position: 3,
      is_default: true,
      tasks: []
    }
  ]
}

// Reorder groups
export async function reorderGroups(groupPositions: Array<{id: number, position: number}>): Promise<void> {
  try {
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) {
      throw new Error('User not authenticated')
    }
    const parsed = JSON.parse(authData)
    const user = parsed.user
    
    const requestBody = {
      action: 'reorder_groups',
      data: {
        group_positions: groupPositions
      }
    }
    console.log('Sending reorder groups request:', requestBody)
    
    const response = await fetch(`/api/task-activity?email=${encodeURIComponent(user.email)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
    
    const data = await response.json()
    console.log('Reorder groups response:', data)
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to reorder groups')
    }
  } catch (error) {
    console.error('Error reordering groups:', error)
    throw error
  }
} 