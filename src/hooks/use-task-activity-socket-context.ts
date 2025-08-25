import { useState, useEffect, useCallback } from 'react'
import { useSocket } from '@/contexts/socket-context'

export interface TaskActivity {
  id: number
  user_id: number
  task_id: number
  activity_type: 'start' | 'pause' | 'resume' | 'complete' | 'cancel'
  start_time: string
  end_time?: string
  duration_seconds?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: number
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: number
  created_by: number
  due_date?: string
  created_at: string
  updated_at: string
}

export function useTaskActivitySocketContext(email: string | null) {
  const { socket, isConnected } = useSocket()
  const [taskActivities, setTaskActivities] = useState<TaskActivity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentActivity, setCurrentActivity] = useState<TaskActivity | null>(null)

  // Set up socket event listeners when socket is available
  useEffect(() => {
    if (!socket || !email) return

    // Listen for task activity updates
    const handleTaskActivityUpdate = (data: any) => {
      if (data.email === email) {
        console.log('Task activity update received:', data)
        
        if (data.type === 'activity_update') {
          setTaskActivities(prev => {
            const existing = prev.find(a => a.id === data.activity.id)
            if (existing) {
              return prev.map(a => a.id === data.activity.id ? data.activity : a)
            } else {
              return [...prev, data.activity]
            }
          })
        } else if (data.type === 'task_update') {
          setTasks(prev => {
            const existing = prev.find(t => t.id === data.task.id)
            if (existing) {
              return prev.map(t => t.id === data.task.id ? data.task : t)
            } else {
              return [...prev, data.task]
            }
          })
        } else if (data.type === 'current_activity_update') {
          setCurrentActivity(data.currentActivity)
        }
      }
    }

    // Listen for task activity events
    socket.on('task-activity-update', handleTaskActivityUpdate)

    // Clean up event listeners
    return () => {
      socket.off('task-activity-update', handleTaskActivityUpdate)
    }
  }, [socket, email])

  // Start a task activity
  const startTaskActivity = useCallback(async (taskId: number, notes?: string) => {
    try {
      const response = await fetch('/api/task-activity/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, notes })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const newActivity = data.activity
        setTaskActivities(prev => [...prev, newActivity])
        setCurrentActivity(newActivity)
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('task-activity-started', {
            email,
            activity: newActivity
          })
        }
        
        return newActivity
      } else {
        throw new Error(data.error || 'Failed to start task activity')
      }
    } catch (error) {
      console.error('Error starting task activity:', error)
      throw error
    }
  }, [socket, isConnected, email])

  // Pause a task activity
  const pauseTaskActivity = useCallback(async (activityId: number) => {
    try {
      const response = await fetch(`/api/task-activity/${activityId}/pause`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        const updatedActivity = data.activity
        setTaskActivities(prev => 
          prev.map(a => a.id === activityId ? updatedActivity : a)
        )
        
        if (currentActivity?.id === activityId) {
          setCurrentActivity(updatedActivity)
        }
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('task-activity-paused', {
            email,
            activity: updatedActivity
          })
        }
        
        return updatedActivity
      } else {
        throw new Error(data.error || 'Failed to pause task activity')
      }
    } catch (error) {
      console.error('Error pausing task activity:', error)
      throw error
    }
  }, [socket, isConnected, email, currentActivity])

  // Resume a task activity
  const resumeTaskActivity = useCallback(async (activityId: number) => {
    try {
      const response = await fetch(`/api/task-activity/${activityId}/resume`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        const updatedActivity = data.activity
        setTaskActivities(prev => 
          prev.map(a => a.id === activityId ? updatedActivity : a)
        )
        
        if (currentActivity?.id === activityId) {
          setCurrentActivity(updatedActivity)
        }
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('task-activity-resumed', {
            email,
            activity: updatedActivity
          })
        }
        
        return updatedActivity
      } else {
        throw new Error(data.error || 'Failed to resume task activity')
      }
    } catch (error) {
      console.error('Error resuming task activity:', error)
      throw error
    }
  }, [socket, isConnected, email, currentActivity])

  // Complete a task activity
  const completeTaskActivity = useCallback(async (activityId: number, notes?: string) => {
    try {
      const response = await fetch(`/api/task-activity/${activityId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const updatedActivity = data.activity
        setTaskActivities(prev => 
          prev.map(a => a.id === activityId ? updatedActivity : a)
        )
        
        if (currentActivity?.id === activityId) {
          setCurrentActivity(null)
        }
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('task-activity-completed', {
            email,
            activity: updatedActivity
          })
        }
        
        return updatedActivity
      } else {
        throw new Error(data.error || 'Failed to complete task activity')
      }
    } catch (error) {
      console.error('Error completing task activity:', error)
      throw error
    }
  }, [socket, isConnected, email, currentActivity])

  // Emit task moved event
  const emitTaskMoved = useCallback((taskId: number, newGroupId: number, movedTask: any) => {
    if (socket && isConnected) {
      socket.emit('task-moved', {
        email,
        task_id: taskId,
        new_group_id: newGroupId,
        moved_task: movedTask
      })
    }
  }, [socket, isConnected, email])

  // Emit task created event
  const emitTaskCreated = useCallback((groupId: number, createdTask: any) => {
    if (socket && isConnected) {
      socket.emit('task-created', {
        email,
        group_id: groupId,
        created_task: createdTask
      })
    }
  }, [socket, isConnected, email])

  // Emit group created event
  const emitGroupCreated = useCallback((createdGroup: any) => {
    if (socket && isConnected) {
      socket.emit('group-created', {
        email,
        created_group: createdGroup
      })
    }
  }, [socket, isConnected, email])

  // Emit groups reordered event
  const emitGroupsReordered = useCallback((groupPositions: any) => {
    if (socket && isConnected) {
      socket.emit('groups-reordered', {
        email,
        group_positions: groupPositions
      })
    }
  }, [socket, isConnected, email])

  // Fetch task activities
  const fetchTaskActivities = useCallback(async (userId: number, limit: number = 50, offset: number = 0) => {
    try {
      const response = await fetch(`/api/task-activity?user_id=${userId}&limit=${limit}&offset=${offset}`)
      const data = await response.json()
      
      if (data.success) {
        setTaskActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error fetching task activities:', error)
    }
  }, [])

  // Fetch tasks
  const fetchTasks = useCallback(async (userId: number) => {
    try {
      const response = await fetch(`/api/tasks?assigned_to=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }, [])

  return {
    isConnected,
    taskActivities,
    tasks,
    currentActivity,
    startTaskActivity,
    pauseTaskActivity,
    resumeTaskActivity,
    completeTaskActivity,
    emitTaskMoved,
    emitTaskCreated,
    emitGroupCreated,
    emitGroupsReordered,
    fetchTaskActivities,
    fetchTasks
  }
}
