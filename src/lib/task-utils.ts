import { Task, TaskStatus, TaskPriority, TaskType } from '@/types/task'
import { getCurrentUserProfile } from './user-profiles'
import { addSmartNotification } from './notification-service'
import { getCurrentUser } from './ticket-utils'
import { getCurrentPhilippinesTime } from './timezone-utils'

// Get current user info for created/edited by fields
function getCurrentUserInfo() {
  const user = getCurrentUser()
  if (!user) return 'Unknown User'
  
  // Use the user's name from auth data, fallback to email if name not available
  return user.name || user.email || 'Unknown User'
}

// Generate unique task ID with microsecond precision and crypto random
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36)
  const microseconds = performance.now().toString(36).replace('.', '')
  const random1 = Math.random().toString(36).substr(2, 9)
  const random2 = Math.random().toString(36).substr(2, 5)
  return `task_${timestamp}_${microseconds}_${random1}${random2}`
}

// Get all tasks
export async function getAllTasks(): Promise<Task[]> {
  try {
    const response = await fetch('http://localhost:3000/api/tasks', {
      credentials: 'include', // Include authentication cookies
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Authentication required for tasks');
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.tasks || [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

// Get a specific task by ID
export async function getTaskById(taskId: string): Promise<Task | null> {
  try {
    const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching task:', error);
    return null;
  }
}

// Create a new task
export async function createTask(taskData: Partial<Task>): Promise<Task | null> {
  try {
    const currentUserName = getCurrentUserInfo();  // This returns a string
    
    // Generate a unique task ID
    const task_id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      task_id: task_id, // Required field that was missing
      task_name: taskData.taskName || "New Task",
      status_name: taskData.status || "Not Started", // Fixed: API expects status_name
      priority: taskData.priority || "medium",
      type_name: taskData.taskType || "Document", // Fixed: API expects type_name  
      description: taskData.description || "",
      due_date: taskData.dueDate || null,
      // Set user fields to current user name (currentUserName is already a string)
      created_by: currentUserName,
      last_edited_by: currentUserName,
      assignee: currentUserName, // Default assignee to current user
    };

    console.log('Creating task with payload:', payload);
    console.log('Current user name:', currentUserName);

    const response = await fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      console.error('Response status:', response.status);
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to create task');
    }

    const newTask = await response.json();
    
    // Trigger task update event for sidebar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tasks-updated'));
    }
    
    // The API only returns task_id and id, so we need to fetch the full task data
    // or return a properly formatted task object
    const formattedTask: Task = {
      id: newTask.task_id,
      task_id: newTask.task_id,
      taskName: taskData.taskName || "New Task",
      status: taskData.status || "Not Started",
      assignee: currentUserName,
      priority: taskData.priority || "medium",
      taskType: taskData.taskType || "Document",
      description: taskData.description || "",
      dueDate: taskData.dueDate || null,
      attachedFiles: [],
      createdBy: currentUserName,
      lastEditedBy: currentUserName,
      createdTime: new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      lastEditedTime: new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      user_id: undefined, // Will be set by backend
      files: [],
      // Add default status color and other properties
      status_color: '#6b7280', // Default gray color
      type_color: '#6b7280', // Default gray color
      is_completed: false
    };
    
    addSmartNotification({
      type: 'success',
      title: 'Task Created',
      message: `Task "${formattedTask.taskName}" created successfully`,
      actionUrl: `/productivity/tasks`,
      icon: 'CheckSquare',
      category: 'task',
      actionData: { taskId: formattedTask.task_id } // Use task_id instead of id
    }, 'creation');
    
    return formattedTask;
  } catch (error) {
    console.error('Error creating task:', error);
    return null;
  }
}

// Update an existing task
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
  try {
    console.log('Updating task:', taskId, 'with updates:', updates);
    
    // Map frontend field names to API field names
    const mappedUpdates: any = {};
    
    if (updates.taskName !== undefined) mappedUpdates.task_name = updates.taskName;
    if (updates.status !== undefined) mappedUpdates.status_name = updates.status;
    if (updates.taskType !== undefined) mappedUpdates.type_name = updates.taskType;
    if (updates.assignee !== undefined) mappedUpdates.assignee = updates.assignee;
    if (updates.priority !== undefined) mappedUpdates.priority = updates.priority;
    if (updates.description !== undefined) mappedUpdates.description = updates.description;
    if (updates.dueDate !== undefined) mappedUpdates.due_date = updates.dueDate;
    if (updates.attachedFiles !== undefined) {
      // Handle file updates if needed - for now just skip
      console.log('File updates not yet implemented');
    }
    
    // Always set last_edited_by to current user
    const currentUserName = getCurrentUserInfo();
    mappedUpdates.last_edited_by = currentUserName;
    
    console.log('Mapped updates for API:', mappedUpdates);
    
    const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(mappedUpdates),
    });

    console.log('Update response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Update API Error Response:', errorText);
      throw new Error('Failed to update task');
    }

    // Add notifications for significant updates
    if (updates.status !== undefined) {
      // Get the current task to know the previous status
      // For now, we'll use a simpler message that includes transition info
      addSmartNotification({
        type: 'info',
        title: 'Task Status Updated',
        message: `Task status changed to "${updates.status}" at ${new Date().toLocaleTimeString()}`,
        actionUrl: `/productivity/tasks`,
        icon: 'CheckCircle',
        category: 'task',
        actionData: { taskId: taskId, newStatus: updates.status, timestamp: Date.now() }
      }, 'status_change');
    }

    if (updates.assignee !== undefined && updates.assignee !== currentUserName) {
      // Assignment notification (only if assigned to someone else)
      addSmartNotification({
        type: 'info',
        title: 'Task Assigned',
        message: `Task assigned to "${updates.assignee}"`,
        actionUrl: `/productivity/tasks`,
        icon: 'AlertCircle', // Use existing icon instead of 'User'
        category: 'task',
        actionData: { taskId: taskId }
      }, 'assignment');
    }

    // Check if task is being marked as completed
    if (updates.status === 'Done' || updates.status === 'Completed') {
      addSmartNotification({
        type: 'success',
        title: 'Task Completed',
        message: `Task "${updates.taskName || 'Task'}" has been completed!`,
        actionUrl: `/productivity/tasks`,
        icon: 'CheckSquare',
        category: 'task',
        actionData: { taskId: taskId }
      }, 'completion');
    }

    // Trigger task update event for sidebar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tasks-updated'));
    }

    return true;
  } catch (error) {
    console.error('Error updating task:', error);
    return false;
  }
}

// Delete a task
export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete task');
    }

    // Trigger task update event for sidebar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tasks-updated'));
    }

    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
}

// Get count of tasks that are not started
export async function getNotStartedTaskCount(): Promise<number> {
  try {
    const tasks = await getAllTasks();
    return tasks.filter(task => task.status === 'Not Started').length;
  } catch (error) {
    console.error('Error getting not started task count:', error);
    return 0;
  }
} 