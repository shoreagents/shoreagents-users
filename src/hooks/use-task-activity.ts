import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { TaskGroup, Task, fetchTaskActivityData, createTask, createGroup, moveTask, updateTask, deleteTask, reorderGroups } from '@/lib/task-activity-utils'

// Get current user helper
function getCurrentUser() {
  if (typeof window === 'undefined') return null
  
  try {
    const authData = localStorage.getItem("shoreagents-auth")
    if (!authData) return null
    
    const parsed = JSON.parse(authData)
    return parsed.user
  } catch {
    return null
  }
}

// Query keys for task activity
export const taskActivityKeys = {
  all: ['task-activity'] as const,
  groups: (email: string) => [...taskActivityKeys.all, 'groups', email] as const,
  group: (groupId: number) => [...taskActivityKeys.all, 'group', groupId] as const,
  task: (taskId: number) => [...taskActivityKeys.all, 'task', taskId] as const,
}

// Hook to fetch task activity data
export function useTaskActivity() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const queryClient = useQueryClient()
  
  // Only get user on client side to avoid hydration issues
  useEffect(() => {
    if (!isClient) {
      setIsClient(true)
      const user = getCurrentUser()
      setCurrentUser(user)
    }
  }, [isClient])
  
  const query = useQuery({
    queryKey: taskActivityKeys.groups(currentUser?.email || 'loading'),
    queryFn: async (): Promise<TaskGroup[]> => {
      if (!currentUser?.email) {
        throw new Error('User not authenticated')
      }
      
      return await fetchTaskActivityData()
    },
    enabled: isClient && !!currentUser?.email,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  
  // Function to trigger real-time update with cache bypass
  const triggerRealtimeUpdate = async () => {
    if (!currentUser?.email) return
    
    try {
      // Fetch fresh data
      const freshData = await fetchTaskActivityData()
      
      // Update the cache with fresh data (no loading state)
      queryClient.setQueryData(taskActivityKeys.groups(currentUser.email), freshData)
    } catch (error) {
      console.error('Error fetching fresh task activity data:', error)
    }
  }
  
  // Function to update cache optimistically
  const updateCacheOptimistically = (updater: (oldData: TaskGroup[] | undefined) => TaskGroup[]) => {
    if (!currentUser?.email) return
    
    queryClient.setQueryData(taskActivityKeys.groups(currentUser.email), updater)
  }
  
  // Show loading state when client is not ready or user is not loaded yet
  return {
    ...query,
    isLoading: query.isLoading || !isClient || !currentUser?.email,
    triggerRealtimeUpdate,
    updateCacheOptimistically,
    currentUser
  }
}

// Hook to create a new task
export function useCreateTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ groupId, title, description }: { groupId: number; title?: string; description?: string }) => {
      return await createTask(groupId, title, description)
    },
    onMutate: async ({ groupId, title, description }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskActivityKeys.all })
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''))
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        return oldData.map(group => {
          if (group.id === groupId) {
            const tempTask: Task = {
              id: Date.now(), // Temporary ID
              title: title || 'New Task',
              description: description || 'Task description',
              priority: 'normal',
              assignees: [],
              due_date: '',
              tags: [],
              position: group.tasks.length + 1,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            return {
              ...group,
              tasks: [...group.tasks, tempTask]
            }
          }
          return group
        })
      })
      
      return { previousData }
    },
    onSuccess: (newTask, variables) => {
      // Update cache with the actual server response (no invalidation to avoid flicker)
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        return oldData.map(group => {
          if (group.id === variables.groupId) {
            // Replace the temporary task with the real one
            const updatedTasks = group.tasks.map(task => 
              task.id === Date.now() ? newTask : task
            )
            return {
              ...group,
              tasks: updatedTasks
            }
          }
          return group
        })
      })
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), context.previousData)
      }
      console.error('Error creating task:', error)
    }
  })
}

// Hook to create a new group
export function useCreateGroup() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ title, color }: { title: string; color?: string }) => {
      return await createGroup(title, color)
    },
    onMutate: async ({ title, color }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskActivityKeys.all })
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''))
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        const tempGroup: TaskGroup = {
          id: Date.now(), // Temporary ID
          title,
          color: color || 'bg-purple-50 dark:bg-purple-950/20',
          position: oldData.length,
          is_default: false,
          tasks: []
        }
        return [...oldData, tempGroup]
      })
      
      return { previousData }
    },
    onSuccess: (newGroup, variables) => {
      // Update cache with the actual server response (no invalidation to avoid flicker)
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        // Replace the temporary group with the real one
        return oldData.map(group => 
          group.id === Date.now() ? newGroup : group
        )
      })
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), context.previousData)
      }
      console.error('Error creating group:', error)
    }
  })
}

// Hook to move a task
export function useMoveTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ taskId, newGroupId, targetPosition }: { taskId: number; newGroupId: number; targetPosition?: number }) => {
      return await moveTask(taskId, newGroupId, targetPosition)
    },
    onMutate: async ({ taskId, newGroupId, targetPosition }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskActivityKeys.all })
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''))
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        const updatedGroups = [...oldData]
        let movedTask: Task | null = null
        let sourceGroupIndex = -1
        
        // Find and remove the task from its current group
        for (let i = 0; i < updatedGroups.length; i++) {
          const group = updatedGroups[i]
          const taskIndex = group.tasks.findIndex(task => task.id === taskId)
          if (taskIndex !== -1) {
            movedTask = group.tasks[taskIndex]
            sourceGroupIndex = i
            group.tasks.splice(taskIndex, 1)
            
            // Re-index remaining tasks in the source group
            group.tasks.forEach((task, index) => {
              task.position = index + 1
            })
            break
          }
        }
        
        // Add the task to the new group
        if (movedTask) {
          const targetGroupIndex = updatedGroups.findIndex(group => group.id === newGroupId)
          if (targetGroupIndex !== -1) {
            const targetGroup = updatedGroups[targetGroupIndex]
            const updatedTask = {
              ...movedTask,
              group_id: newGroupId,
              position: targetPosition || targetGroup.tasks.length + 1
            }
            
            // Insert at the correct position
            const insertIndex = targetPosition ? Math.min(targetPosition - 1, targetGroup.tasks.length) : targetGroup.tasks.length
            targetGroup.tasks.splice(insertIndex, 0, updatedTask)
            
            // Update positions for all tasks in the group
            targetGroup.tasks.forEach((task, index) => {
              task.position = index + 1
            })
          }
        }
        
        return updatedGroups
      })
      
      // Return a context object with the snapshotted value
      return { previousData }
    },
    onSuccess: (movedTask, variables) => {
      // Update cache with the actual server response (no invalidation to avoid flicker)
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        return oldData.map(group => ({
          ...group,
          tasks: group.tasks.map(task => 
            task.id === variables.taskId ? { ...task, ...movedTask } : task
          )
        }))
      })
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), context.previousData)
      }
      console.error('Error moving task:', error)
    }
  })
}

// Hook to update a task
export function useUpdateTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<Task> & { assignees?: number[] } }) => {
      return await updateTask(taskId, updates)
    },
    onMutate: async ({ taskId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskActivityKeys.all })
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''))
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        return oldData.map(group => ({
          ...group,
          tasks: group.tasks.map(task => 
            task.id === taskId ? { ...task, ...updates, updated_at: new Date().toISOString() } : task
          )
        }))
      })
      
      return { previousData }
    },
    onSuccess: (updatedTask, variables) => {
      // Update cache with the actual server response (no invalidation to avoid flicker)
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        return oldData.map(group => ({
          ...group,
          tasks: group.tasks.map(task => 
            task.id === variables.taskId ? { ...task, ...updatedTask } : task
          )
        }))
      })
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), context.previousData)
      }
      console.error('Error updating task:', error)
    }
  })
}

// Hook to delete a task
export function useDeleteTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ taskId, hard = false }: { taskId: number; hard?: boolean }) => {
      return await deleteTask(taskId, hard)
    },
    onMutate: async ({ taskId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskActivityKeys.all })
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''))
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        return oldData.map(group => ({
          ...group,
          tasks: group.tasks.filter(task => task.id !== taskId)
        }))
      })
      
      return { previousData }
    },
    onSuccess: (_, variables) => {
      // No need to update cache again since we already removed it optimistically
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), context.previousData)
      }
      console.error('Error deleting task:', error)
    }
  })
}

// Hook to reorder groups
export function useReorderGroups() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (groupPositions: Array<{id: number, position: number}>) => {
      return await reorderGroups(groupPositions)
    },
    onMutate: async (groupPositions) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskActivityKeys.all })
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''))
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), (oldData: TaskGroup[] | undefined) => {
        if (!oldData) return oldData
        
        // Reorder groups based on new positions
        return oldData.sort((a, b) => {
          const aPos = groupPositions.find(gp => gp.id === a.id)?.position ?? a.position
          const bPos = groupPositions.find(gp => gp.id === b.id)?.position ?? b.position
          return aPos - bPos
        })
      })
      
      return { previousData }
    },
    onSuccess: (_, variables) => {
      // No need to update cache again since we already reordered it optimistically
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(taskActivityKeys.groups(getCurrentUser()?.email || ''), context.previousData)
      }
      console.error('Error reordering groups:', error)
    }
  })
}
