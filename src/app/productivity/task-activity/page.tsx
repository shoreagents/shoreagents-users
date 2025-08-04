"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KanbanBoard } from "@/components/task-activity-components/kanban-board"
import { Button } from "@/components/ui/button"
import { Plus, Filter, Users, Calendar, Settings, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchTaskActivityData, createTask, createGroup, moveTask, reorderGroups, TaskGroup, Task } from "@/lib/task-activity-utils"
import { useTaskActivitySocket } from "@/hooks/use-task-activity-socket"

// Utility function to generate unique IDs
const generateUniqueId = (prefix: string = 'temp') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export default function TaskActivityPage() {
  const [groups, setGroups] = useState<TaskGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [isEditMode, setIsEditMode] = useState(false)

  // Get current user email for Socket.IO
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Socket.IO for real-time updates
  const { socket, isConnected, emitTaskMoved, emitTaskCreated, emitGroupCreated, emitGroupsReordered } = useTaskActivitySocket(userEmail)

  // Get user email on component mount
  useEffect(() => {
    const authData = localStorage.getItem("shoreagents-auth")
    if (authData) {
      try {
        const parsed = JSON.parse(authData)
        setUserEmail(parsed.user.email)
      } catch (error) {
        console.error('Error parsing auth data:', error)
      }
    }
  }, [])

  // Fetch task data on component mount
  useEffect(() => {
    loadTaskData()
  }, [])

  // Socket.IO event listeners for real-time updates
  useEffect(() => {
    if (!socket) return

    // Listen for task moved events
    socket.on('taskMoved', ({ taskId, newGroupId, task }) => {
      console.log('Received taskMoved event:', { taskId, newGroupId, task })
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        
        // Find and remove the task from its current group
        let movedTask: Task | null = null
        let sourceGroup: any = null
        for (const group of updatedGroups) {
          const taskIndex = group.tasks.findIndex(t => t.id.toString() === taskId)
          if (taskIndex !== -1) {
            movedTask = group.tasks[taskIndex]
            sourceGroup = group
            group.tasks.splice(taskIndex, 1)
            
            // Re-index remaining tasks in the source group
            group.tasks.forEach((task, index) => {
              task.position = index + 1
            })
            console.log(`Socket: Re-indexed ${group.tasks.length} tasks in source group`)
            break
          }
        }
        
        // Add the task to the new group with proper position
        if (movedTask) {
          const targetGroup = updatedGroups.find(group => group.id.toString() === newGroupId)
          if (targetGroup) {
            const updatedTask = {
              ...movedTask,
              group_id: parseInt(newGroupId),
              position: task.position || targetGroup.tasks.length + 1
            }
            
            // Insert at the correct position
            const insertIndex = Math.min(updatedTask.position - 1, targetGroup.tasks.length)
            targetGroup.tasks.splice(insertIndex, 0, updatedTask)
            
            // Update positions for all tasks in the group
            targetGroup.tasks.forEach((t, index) => {
              t.position = index + 1
            })
          }
        }
        
        return updatedGroups
      })
    })

    // Listen for task created events
    socket.on('taskCreated', ({ groupId, task }) => {
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        const targetGroup = updatedGroups.find(group => group.id.toString() === groupId)
        if (targetGroup) {
          targetGroup.tasks.push(task)
        }
        return updatedGroups
      })
    })

    // Listen for group created events
    socket.on('groupCreated', ({ group }) => {
      setGroups(prevGroups => [...prevGroups, group])
    })

    // Listen for groups reordered events
    socket.on('groupsReordered', ({ groupPositions }) => {
      console.log('Received groupsReordered event:', groupPositions)
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        // Reorder groups based on the new positions
        updatedGroups.sort((a, b) => {
          const aPos = groupPositions.find((gp: {id: number, position: number}) => gp.id === a.id)?.position ?? a.position
          const bPos = groupPositions.find((gp: {id: number, position: number}) => gp.id === b.id)?.position ?? b.position
          return aPos - bPos
        })
        return updatedGroups
      })
    })

    return () => {
      socket.off('taskMoved')
      socket.off('taskCreated')
      socket.off('groupCreated')
      socket.off('groupsReordered')
    }
  }, [socket])

  const loadTaskData = async () => {
    try {
      setIsLoading(true)
      const data = await fetchTaskActivityData()
      setGroups(data)
    } catch (error) {
      console.error('Error loading task data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskMove = async (taskId: string, newGroupId: string, targetPosition?: number) => {
    try {
      // Optimistic update - immediately update the UI
      let movedTask: Task | null = null
      
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        
        // Find the task and remove it from its current group
        let sourceGroup: any = null
        for (const group of updatedGroups) {
          const taskIndex = group.tasks.findIndex(task => task.id.toString() === taskId)
          if (taskIndex !== -1) {
            movedTask = group.tasks[taskIndex]
            sourceGroup = group
            group.tasks.splice(taskIndex, 1)
            
            // Re-index remaining tasks in the source group
            group.tasks.forEach((task, index) => {
              task.position = index + 1
            })
            console.log(`Re-indexed ${group.tasks.length} tasks in source group`)
            break
          }
        }
        
        // Add the task to the new group
        if (movedTask) {
          const targetGroup = updatedGroups.find(group => group.id.toString() === newGroupId)
          if (targetGroup) {
            // Update task properties for the new group
            const updatedTask = {
              ...movedTask,
              group_id: parseInt(newGroupId),
              position: targetPosition || targetGroup.tasks.length + 1
            }
            
            if (targetPosition) {
              // Insert at specific position
              const insertIndex = targetPosition - 1
              console.log(`Inserting task at index ${insertIndex} (position ${targetPosition})`)
              console.log(`Current tasks in group: ${targetGroup.tasks.length}`)
              targetGroup.tasks.splice(insertIndex, 0, updatedTask)
              
              // Update positions for all tasks in the group
              targetGroup.tasks.forEach((task, index) => {
                task.position = index + 1
              })
              console.log(`After insertion: ${targetGroup.tasks.length} tasks`)
            } else {
              // Add to end
              targetGroup.tasks.push(updatedTask)
              updatedTask.position = targetGroup.tasks.length
            }
          }
        }
        
        return updatedGroups
      })
      
      // Make the API call in the background
      console.log(`Calling API: moveTask(${taskId}, ${newGroupId}, ${targetPosition})`)
      const movedTaskResult = await moveTask(parseInt(taskId), parseInt(newGroupId), targetPosition)
      console.log('API response:', movedTaskResult)
      
      // Emit Socket.IO event for real-time updates with the updated task data
      console.log('Emitting taskMoved event:', { taskId, newGroupId, movedTaskResult })
      emitTaskMoved(taskId, newGroupId, movedTaskResult)
      
      // Debug: Log the move operation
      console.log(`Task ${taskId} moved to group ${newGroupId} at position ${targetPosition || 'end'}`)
      
      // Optionally refresh data to ensure consistency
      // await loadTaskData()
    } catch (error) {
      console.error('Error moving task:', error)
      // Revert optimistic update on error
      await loadTaskData()
    }
  }

  const handleTaskCreate = async (groupId: string) => {
    try {
      // Generate a unique temporary ID
      const tempId = generateUniqueId('task')
      
      // Optimistic update - immediately add a placeholder task
      const newTask: Task = {
        id: parseInt(tempId.replace(/\D/g, '')), // Convert to number for compatibility
        title: 'New Task',
        description: 'Task description',
        priority: 'normal',
        assignee: 'Unassigned',
        due_date: new Date().toISOString().split('T')[0],
        tags: [],
        position: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        const targetGroup = updatedGroups.find(group => group.id.toString() === groupId)
        if (targetGroup) {
          // Set the position to the next available position
          newTask.position = targetGroup.tasks.length + 1
          targetGroup.tasks.push(newTask)
        }
        return updatedGroups
      })
      
      // Make the API call in the background
      const createdTask = await createTask(parseInt(groupId))
      
      // Update with the real task data
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        const targetGroup = updatedGroups.find(group => group.id.toString() === groupId)
        if (targetGroup) {
          // Replace the temporary task with the real one
          const taskIndex = targetGroup.tasks.findIndex(task => task.id === newTask.id)
          if (taskIndex !== -1) {
            targetGroup.tasks[taskIndex] = createdTask
          }
        }
        return updatedGroups
      })
      
      // Emit Socket.IO event for real-time updates
      emitTaskCreated(groupId, createdTask)
    } catch (error) {
      console.error('Error creating task:', error)
      // Revert optimistic update on error
      await loadTaskData()
    }
  }

  const handleTaskUpdate = (taskId: string, updates: any) => {
    // This will be implemented when we add the update API endpoint
    console.log('Task update:', taskId, updates)
  }

  const handleColumnsReorder = async (newColumns: any[]) => {
    try {
      console.log('Columns reorder:', newColumns)
      
      // Convert to the format expected by the API
      const groupPositions = newColumns.map((column, index) => ({
        id: parseInt(column.id),
        position: index
      }))
      
      // Update local state immediately (optimistic update)
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        // Reorder groups based on newColumns order
        const newOrder = newColumns.map(col => col.id)
        updatedGroups.sort((a, b) => {
          const aIndex = newOrder.indexOf(a.id.toString())
          const bIndex = newOrder.indexOf(b.id.toString())
          return aIndex - bIndex
        })
        return updatedGroups
      })
      
      // Persist to database
      await reorderGroups(groupPositions)
      console.log('Groups reordered successfully')
      
      // Emit Socket.IO event for real-time updates
      emitGroupsReordered(groupPositions)
      
    } catch (error) {
      console.error('Error reordering groups:', error)
      // Revert optimistic update on error
      await loadTaskData()
    }
  }

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode)
  }

  const handleAddGroup = async () => {
    if (newGroupName.trim()) {
      try {
        // Generate a unique temporary ID
        const tempId = generateUniqueId('group')
        
        // Optimistic update - immediately add the group
        const newGroup: TaskGroup = {
          id: parseInt(tempId.replace(/\D/g, '')), // Convert to number for compatibility
          title: newGroupName,
          color: 'bg-purple-50 dark:bg-purple-950/20',
          position: groups.length,
          is_default: false,
          tasks: []
        }
        
        setGroups(prevGroups => [...prevGroups, newGroup])
        setNewGroupName("")
        setIsAddGroupOpen(false)
        
        // Make the API call in the background
        const createdGroup = await createGroup(newGroupName)
        
        // Update with the real group data
        setGroups(prevGroups => {
          const updatedGroups = [...prevGroups]
          const groupIndex = updatedGroups.findIndex(group => group.id === newGroup.id)
          if (groupIndex !== -1) {
            updatedGroups[groupIndex] = createdGroup
          }
          return updatedGroups
        })
        
        // Emit Socket.IO event for real-time updates
        emitGroupCreated(createdGroup)
      } catch (error) {
        console.error('Error creating group:', error)
        // Revert optimistic update on error
        await loadTaskData()
      }
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 h-screen overflow-hidden max-w-full">
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0 min-w-0">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Task Activity</h1>
              <p className="text-muted-foreground">
                Manage your tasks with drag and drop Kanban boards
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Real-time connection status */}
              <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-gray-50 border">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-600">
                  {isConnected ? 'Real-time Connected' : 'Connecting...'}
                </span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>All Tasks</DropdownMenuItem>
                  <DropdownMenuItem>My Tasks</DropdownMenuItem>
                  <DropdownMenuItem>High Priority</DropdownMenuItem>
                  <DropdownMenuItem>Due Today</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Assignee
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>All Assignees</DropdownMenuItem>
                  <DropdownMenuItem>John Doe</DropdownMenuItem>
                  <DropdownMenuItem>Jane Smith</DropdownMenuItem>
                  <DropdownMenuItem>Bob Johnson</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Due Date
              </Button>

              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                onClick={toggleEditMode}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {isEditMode ? "Exit Edit Mode" : "Edit Board"}
              </Button>

              <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Group</DialogTitle>
                    <DialogDescription>
                      Add a new group to organize your tasks.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="group-name" className="text-right">
                        Name
                      </Label>
                      <Input
                        id="group-name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="e.g., On Hold"
                        className="col-span-3"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddGroup()
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddGroupOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddGroup}>Add Group</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Kanban Board Card */}
          <Card className="flex-1 flex flex-col min-h-0 min-w-0">
            <CardHeader className="flex-shrink-0 pb-3">
              <CardTitle className="text-lg">Board View</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-x-auto overflow-y-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading tasks...</span>
                </div>
              ) : (
                <KanbanBoard 
                  tasks={(() => {
                    const allTasks = groups.flatMap(group => 
                      group.tasks.map(task => ({
                        id: task.id.toString(),
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        assignee: task.assignee,
                        dueDate: task.due_date,
                        tags: task.tags,
                        status: group.id.toString(),
                        relationships: []
                      }))
                    )
                    
                    // Remove duplicates and log if any are found
                    const uniqueTasks = allTasks.filter((task, index, self) => {
                      const isDuplicate = index !== self.findIndex(t => t.id === task.id)
                      if (isDuplicate) {
                        console.warn(`Duplicate task found with ID: ${task.id}, removing duplicate`)
                      }
                      return !isDuplicate
                    })
                    
                    return uniqueTasks
                  })()} 
                  columns={groups.map(group => ({
                    id: group.id.toString(),
                    title: group.title,
                    color: group.color
                  }))}
                  onTaskMove={(taskId, newStatus, targetPosition) => handleTaskMove(taskId, newStatus, targetPosition)}
                  onTaskCreate={handleTaskCreate}
                  onTaskUpdate={handleTaskUpdate}
                  onColumnsReorder={handleColumnsReorder}
                  isEditMode={isEditMode}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 