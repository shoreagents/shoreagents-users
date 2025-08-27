"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KanbanBoard } from "@/components/task-activity-components/kanban-board"
import { Button } from "@/components/ui/button"
import { Plus, Settings, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

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
import { fetchTaskActivityData, createTask, createGroup, moveTask, reorderGroups, updateTask, deleteTask as deleteTaskApi, TaskGroup, Task } from "@/lib/task-activity-utils"
import { useTaskActivitySocketContext } from "@/hooks/use-task-activity-socket-context"

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
  const [canManageGroups, setCanManageGroups] = useState(false)

  // Zoom functionality
  const [zoomLevel, setZoomLevel] = useState(100)
  const [minZoom] = useState(50)
  const [maxZoom] = useState(200)
  const [zoomStep] = useState(10)

  // Zoom control functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + zoomStep, maxZoom))
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - zoomStep, minZoom))
  }

  const handleZoomReset = () => {
    setZoomLevel(100)
  }

  const handleWheelZoom = (event: WheelEvent) => {
    if (event.ctrlKey) {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -zoomStep : zoomStep
      setZoomLevel(prev => Math.max(minZoom, Math.min(prev + delta, maxZoom)))
    }
  }

  // Get current user email for Socket.IO
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [socketInstance, setSocketInstance] = useState<any>(null)
  
  // Socket.IO for real-time updates
  const { isConnected, startTaskActivity, pauseTaskActivity, resumeTaskActivity, completeTaskActivity, emitTaskMoved, emitTaskCreated, emitGroupCreated, emitGroupsReordered } = useTaskActivitySocketContext(userEmail)

  // Get user email on component mount
  useEffect(() => {
    const authData = localStorage.getItem("shoreagents-auth")
    if (authData) {
      try {
        const parsed = JSON.parse(authData)
        setUserEmail(parsed.user.email)
        setCurrentUser(parsed.user)
        const role: string | undefined = (parsed.user?.role || parsed.user?.type || '').toString()
        setCanManageGroups(/^(internal)$/i.test(role || ''))
      } catch (error) {
        console.error('Error parsing auth data:', error)
      }
    }
  }, [])

  // Automatically disable edit mode for non-internal users
  useEffect(() => {
    if (!canManageGroups && isEditMode) {
      setIsEditMode(false)
    }
  }, [canManageGroups, isEditMode])

  // Handle URL parameters to open specific task
  const currentUrlRef = useRef<string>('')
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const taskId = urlParams.get('taskId')
    const currentUrl = window.location.search
    
    // Only process if URL has changed and we have a taskId
    if (taskId && currentUrl !== currentUrlRef.current) {
      currentUrlRef.current = currentUrl
      
      if (groups.length > 0) {
        // Find the task in the groups
        const allTasks = groups.flatMap(group => 
          (group.tasks || []).map(task => ({
            id: task.id.toString(),
            creator_id: (task as any).creator_id,
            is_owner: (task as any).is_owner,
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignee: '',
            assignees: (task as any).assignees || [],
            dueDate: task.due_date,
            startDate: task.start_date,
            tags: task.tags,
            status: group.id.toString(),
            relationships: (task as any).task_relationships ?? (task as any).relationships ?? [],
            custom_fields: (task as any).task_custom_fields ?? (task as any).custom_fields ?? [],
            attachments: (task as any).attachments ?? []
          }))
        )
        
        const targetTask = allTasks.find(task => task.id === taskId)
        if (targetTask) {
          // Open the task detail dialog
          console.log('Opening task from notification:', targetTask.title)
          // We'll need to trigger the task click handler
          setTimeout(() => {
            const taskClickEvent = new CustomEvent('openTask', { detail: targetTask })
            window.dispatchEvent(taskClickEvent)
          }, 500) // Small delay to ensure components are ready
          
          // Clean up URL parameter
          const newUrl = window.location.pathname
          window.history.replaceState({}, '', newUrl)
        }
      }
    }
  }, [groups]) // Only depend on groups
  
  // Watch for URL changes to handle navigation from system notifications
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const taskId = urlParams.get('taskId')
      
      if (taskId && groups.length > 0) {
        // Process the taskId parameter
        const allTasks = groups.flatMap(group => 
          (group.tasks || []).map(task => ({
            id: task.id.toString(),
            creator_id: (task as any).creator_id,
            is_owner: (task as any).is_owner,
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignee: '',
            assignees: (task as any).assignees || [],
            dueDate: task.due_date,
            startDate: task.start_date,
            tags: task.tags,
            status: group.id.toString(),
            relationships: (task as any).task_relationships ?? (task as any).relationships ?? [],
            custom_fields: (task as any).task_custom_fields ?? (task as any).custom_fields ?? [],
            attachments: (task as any).attachments ?? []
          }))
        )
        
        const targetTask = allTasks.find(task => task.id === taskId)
        if (targetTask) {
          console.log('Opening task from URL change:', targetTask.title)
          setTimeout(() => {
            const taskClickEvent = new CustomEvent('openTask', { detail: targetTask })
            window.dispatchEvent(taskClickEvent)
          }, 500)
          
          // Clean up URL parameter
          const newUrl = window.location.pathname
          window.history.replaceState({}, '', newUrl)
        }
      }
    }
    
    // Check URL on mount
    handleUrlChange()
    
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleUrlChange)
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange)
    }
  }, [groups])

  // Listen for notification clicks to open tasks even when already on task-activity page
  useEffect(() => {
    const handleNotificationClick = (event: CustomEvent) => {
      const notification = event.detail
      if (!notification || !groups.length) return
      
      // Check if this is a task notification
      if (notification.category === 'task' && notification.actionData?.task_id) {
        const taskId = notification.actionData.task_id.toString()
        
        // Find the task in the groups
        const allTasks = groups.flatMap(group => 
          (group.tasks || []).map(task => ({
            id: task.id.toString(),
            creator_id: (task as any).creator_id,
            is_owner: (task as any).is_owner,
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignee: '',
            assignees: (task as any).assignees || [],
            dueDate: task.due_date,
            startDate: task.start_date,
            tags: task.tags,
            status: group.id.toString(),
            relationships: (task as any).task_relationships ?? (task as any).relationships ?? [],
            custom_fields: (task as any).task_custom_fields ?? (task as any).custom_fields ?? [],
            attachments: (task as any).attachments ?? []
          }))
        )
        
        const targetTask = allTasks.find(task => task.id === taskId)
        if (targetTask) {
          console.log('Opening task from notification click (already on page):', targetTask.title)
          setTimeout(() => {
            const taskClickEvent = new CustomEvent('openTask', { detail: targetTask })
            window.dispatchEvent(taskClickEvent)
          }, 100) // Shorter delay since we're already on the page
        }
      }
    }
    
    // Listen for notification click events
    window.addEventListener('notification-clicked', handleNotificationClick as EventListener)
    
    return () => {
      window.removeEventListener('notification-clicked', handleNotificationClick as EventListener)
    }
  }, [groups])

  // Fetch task data on component mount
  useEffect(() => {
    loadTaskData()
  }, [])

  // Handle wheel zoom events
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault()
        const delta = event.deltaY > 0 ? -zoomStep : zoomStep
        setZoomLevel(prev => Math.max(minZoom, Math.min(prev + delta, maxZoom)))
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        switch (event.key) {
          case '=':
          case '+':
            event.preventDefault()
            handleZoomIn()
            break
          case '-':
            event.preventDefault()
            handleZoomOut()
            break
          case '0':
            event.preventDefault()
            handleZoomReset()
            break
        }
      }
    }

    document.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('wheel', handleWheel)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [zoomStep, minZoom, maxZoom])

  // Fallback: pick up global socket when available
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const s = (window as any)._saSocket
        if (s && s.connected) {
          setSocketInstance(s)
          clearInterval(id)
        }
      } catch {}
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Socket.IO event listeners for real-time updates
  useEffect(() => {
    const s = socketInstance
    if (!s) return
    const parse = (payload: any) => {
      try { return typeof payload === 'string' ? JSON.parse(payload) : payload } catch { return null }
    }
    // Live task updates from Postgres NOTIFY -> socket
    const onTaskUpdated = (payload: any) => {
      const msg = parse(payload)
      if (!msg) return
      // Support both enriched { task } and generic trigger { table, action, new, old }
      let t = msg.task
      if (!t && msg.table === 'tasks') {
        if (msg.action === 'DELETE' && msg.old?.id) {
          const delId = Number(msg.old.id)
          setGroups(prev => prev.map(g => ({
            ...g,
            tasks: g.tasks.filter((task: any) => Number(task.id) !== delId)
          })) as any)
          return
        }
        t = msg.new
      }
      if (!t || !t.id) return
      const idNum = Number(t.id)
      setGroups(prev => {
        // If group_id changed due to manual update, move between groups
        const next = prev.map(g => ({ ...g, tasks: g.tasks.slice() })) as any
        let foundGroupIdx = -1
        let foundTaskIdx = -1
        for (let gi = 0; gi < next.length; gi++) {
          const arr = next[gi].tasks || (next[gi].tasks = [])
          const idx = arr.findIndex((task: any) => Number(task.id) === idNum)
          if (idx !== -1) { foundGroupIdx = gi; foundTaskIdx = idx; break }
        }
        if (foundGroupIdx !== -1) {
          const previous = next[foundGroupIdx].tasks[foundTaskIdx]
          const merged = { ...previous, ...t }
          // Move if needed
          if (t.group_id && Number(t.group_id) !== Number(prev[foundGroupIdx].id)) {
            ;(next[foundGroupIdx].tasks || (next[foundGroupIdx].tasks = [])).splice(foundTaskIdx, 1)
            const targetIdx = next.findIndex((g: any) => Number(g.id) === Number(t.group_id))
            if (targetIdx !== -1) {
              ;(next[targetIdx].tasks || (next[targetIdx].tasks = [])).push(merged)
            }
          } else {
            ;(next[foundGroupIdx].tasks || (next[foundGroupIdx].tasks = []))[foundTaskIdx] = merged
          }
        } else if ((msg.table === 'tasks' && msg.action === 'INSERT') || (msg.type === 'INSERT')) {
          // New task inserted directly in DB → add to the correct group
          const targetIdx = next.findIndex((g: any) => Number(g.id) === Number(t.group_id))
          if (targetIdx !== -1) {
            const newTask = {
              id: Number(t.id),
              title: t.title || 'New Task',
              description: t.description || '',
              priority: t.priority || 'normal',
              assignees: (t as any).assignees || [],
              task_relationships: (t as any).task_relationships || [],
              task_custom_fields: (t as any).task_custom_fields || [],
              attachments: (t as any).attachments || [],
              tags: Array.isArray(t.tags) ? t.tags : [],
              position: Number(t.position) || (next[targetIdx].tasks.length + 1),
              status: t.status || 'active',
              created_at: t.created_at || new Date().toISOString(),
              updated_at: t.updated_at || new Date().toISOString(),
              group_id: Number(t.group_id)
            }
            if (newTask.status === 'active') {
              // Insert by position if provided
              const insertIndex = Math.max(0, Math.min((newTask.position || 1) - 1, next[targetIdx].tasks.length))
              next[targetIdx].tasks.splice(insertIndex, 0, newTask)
              // Re-index positions
              next[targetIdx].tasks.forEach((task: any, idx: number) => { task.position = idx + 1 })
            }
          }
        }
        return next
      })
    }
    s.on('task_updated', onTaskUpdated)

    // Generic handlers for other tables
    const onTaskAssignees = (payload: any) => {
      const msg = parse(payload)
      if (!msg?.new && !msg?.old) return
      const row = msg.new || msg.old
      const taskId = Number(row.task_id)
      const userId = Number(row.user_id)
      
      // Check if the current user is being assigned/unassigned
      const currentUserId = currentUser?.id
      const isCurrentUserAffected = currentUserId && Number(userId) === Number(currentUserId)
      
      // For any assignee change, do a full data refresh to ensure task visibility is correct
      // This handles cases where:
      // 1. Current user gets assigned to a new task (task should appear)
      // 2. Current user gets removed from a task (task should disappear if they're not the creator)
      // 3. Other users get assigned/removed (task assignee list should update)
      setTimeout(() => refreshTaskDataSilently(), 300) // Small delay to ensure DB is updated
      
      // Also update the current state immediately for better UX
      setGroups(prev => prev.map(g => ({
        ...g,
        tasks: g.tasks.map((task: any) => {
          if (Number(task.id) !== taskId) return task
          const list: number[] = Array.isArray((task as any).assignees) ? (task as any).assignees.slice() : []
          if (msg.action === 'INSERT') {
            if (!list.includes(userId)) list.push(userId)
          } else if (msg.action === 'DELETE') {
            const idx = list.indexOf(userId); if (idx !== -1) list.splice(idx, 1)
          }
          return { ...task, assignees: list }
        })
      })) as any)
    }
    s.on('task_assignees', onTaskAssignees)

    const onTaskCustomFields = (payload: any) => {
      const msg = parse(payload)
      if (!msg?.table || msg.table !== 'task_custom_fields') return
      const row = msg.new || msg.old
      const taskId = Number(row.task_id)
      setGroups(prev => prev.map(g => ({
        ...g,
        tasks: g.tasks.map((task: any) => {
          if (Number(task.id) !== taskId) return task
          const list = ((task as any).custom_fields || (task as any).task_custom_fields || []).slice()
          if (msg.action === 'INSERT' && msg.new) {
            const cf = { id: String(row.id), title: row.title || '', description: row.description || '', position: row.position ?? 0 }
            if (!list.some((f: any) => String(f.id) === String(cf.id))) list.push(cf)
          } else if (msg.action === 'UPDATE' && msg.new) {
            const idx = list.findIndex((f: any) => String(f.id) === String(row.id))
            if (idx !== -1) list[idx] = { ...list[idx], title: row.title || '', description: row.description || '', position: row.position ?? list[idx].position }
          } else if (msg.action === 'DELETE' && msg.old) {
            const idx = list.findIndex((f: any) => String(f.id) === String(row.id))
            if (idx !== -1) list.splice(idx, 1)
          }
          // Keep both aliases
          return { ...task, custom_fields: list, task_custom_fields: list }
        })
      })) as any)
    }
    s.on('task_custom_fields', onTaskCustomFields)

    const onTaskAttachments = (payload: any) => {
      const msg = parse(payload)
      if (!msg?.table || msg.table !== 'task_attachments') return
      const row = msg.new || msg.old
      const taskId = Number(row.task_id)
      setGroups(prev => prev.map(g => ({
        ...g,
        tasks: g.tasks.map((task: any) => {
          if (Number(task.id) !== taskId) return task
          const list = (task.attachments || []).slice()
          if (msg.action === 'INSERT' && msg.new) {
            const att = { id: String(row.id), name: row.name || 'Attachment', url: row.url, size: row.size }
            if (!list.some((f: any) => String(f.id) === String(att.id))) list.push(att as any)
          } else if (msg.action === 'UPDATE' && msg.new) {
            const idx = list.findIndex((f: any) => String(f.id) === String(row.id))
            if (idx !== -1) list[idx] = { ...list[idx], name: row.name || list[idx].name, url: row.url || list[idx].url }
          } else if (msg.action === 'DELETE' && msg.old) {
            const idx = list.findIndex((f: any) => String(f.id) === String(row.id))
            if (idx !== -1) list.splice(idx, 1)
          }
          return { ...task, attachments: list }
        })
      })) as any)
    }
    s.on('task_attachments', onTaskAttachments)

    const onTaskRelations = (payload: any) => {
      const msg = parse(payload)
      if (!msg?.table || msg.table !== 'task_relations') return
      const row = msg.new || msg.old
      const a = Number(row.task_id)
      const b = Number(row.related_task_id)
      const rel = { taskId: String(b), type: String(row.type || 'related_to') }
      const inv = { taskId: String(a), type: String(row.type || 'related_to') }
      setGroups(prev => prev.map(g => ({
        ...g,
        tasks: g.tasks.map((task: any) => {
          const idNum = Number(task.id)
          if (msg.action === 'INSERT') {
            if (idNum === a) {
              const list = ((task as any).relationships || (task as any).task_relationships || []).slice()
              if (!list.some((r: any) => String(r.taskId) === String(rel.taskId))) list.push(rel)
              return { ...task, relationships: list, task_relationships: list }
            }
            if (idNum === b) {
              const list = ((task as any).relationships || (task as any).task_relationships || []).slice()
              if (!list.some((r: any) => String(r.taskId) === String(inv.taskId))) list.push(inv)
              return { ...task, relationships: list, task_relationships: list }
            }
          } else if (msg.action === 'DELETE') {
            if (idNum === a || idNum === b) {
              const targetId = idNum === a ? b : a
              const list = ((task as any).relationships || (task as any).task_relationships || []).filter((r: any) => String(r.taskId) !== String(targetId))
              return { ...task, relationships: list, task_relationships: list }
            }
          }
          return task
        })
      })) as any)
    }
    s.on('task_relations', onTaskRelations)

    const onTaskGroups = (payload: any) => {
      const msg = parse(payload)
      if (!msg?.table || msg.table !== 'task_groups') return
      if (msg.action === 'INSERT' && msg.new) {
        setGroups(prev => {
          const exists = prev.some(g => Number(g.id) === Number(msg.new.id))
          if (exists) return prev
          return ([...prev, { ...msg.new, tasks: [] }])
        })
      } else if (msg.action === 'UPDATE' && msg.new) {
        setGroups(prev => prev.map(g => (Number(g.id) === Number(msg.new.id) ? { ...g, ...msg.new } : g)))
      } else if (msg.action === 'DELETE' && msg.old) {
        setGroups(prev => prev.filter(g => Number(g.id) !== Number(msg.old.id)))
      }
    }
    s.on('task_groups', onTaskGroups)

    // Listen for task moved events
    s.on('taskMoved', ({ taskId, newGroupId, task }: { taskId: string; newGroupId: string; task: any }) => {
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
    s.on('taskCreated', ({ groupId, task }: { groupId: string; task: any }) => {
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
    s.on('groupCreated', ({ group }: { group: any }) => {
      setGroups(prevGroups => {
        const exists = prevGroups.some(g => Number(g.id) === Number(group.id))
        if (exists) return prevGroups
        return [...prevGroups, group]
      })
    })

    // Listen for groups reordered events
    s.on('groupsReordered', ({ groupPositions }: { groupPositions: Array<{ id: number; position: number }> }) => {
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
      s.off('taskMoved')
      s.off('taskCreated')
      s.off('groupCreated')
      s.off('groupsReordered')
      s.off('task_updated')
      s.off('task_assignees')
      s.off('task_custom_fields')
      s.off('task_attachments')
      s.off('task_relations')
      s.off('task_groups')
    }
  }, [])

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

  // Lightweight refresh that does not toggle the global loading spinner.
  // Use this for real-time updates such as assignee changes to avoid UI flicker.
  const refreshTaskDataSilently = async () => {
    try {
      const data = await fetchTaskActivityData()
      setGroups(data)
    } catch (error) {
      console.error('Error silently refreshing task data:', error)
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
          const taskArray = group.tasks || (group.tasks = [])
          const taskIndex = taskArray.findIndex(task => task.id.toString() === taskId)
          if (taskIndex !== -1) {
            movedTask = taskArray[taskIndex]
            sourceGroup = group
            taskArray.splice(taskIndex, 1)
            
            // Re-index remaining tasks in the source group
            taskArray.forEach((task, index) => {
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
              position: targetPosition || ((targetGroup.tasks || []).length + 1)
            }
            
            if (targetPosition) {
              // Insert at specific position
              const insertIndex = targetPosition - 1
              console.log(`Inserting task at index ${insertIndex} (position ${targetPosition})`)
              const tgArray = targetGroup.tasks || (targetGroup.tasks = [])
              console.log(`Current tasks in group: ${tgArray.length}`)
              tgArray.splice(insertIndex, 0, updatedTask)
              
              // Update positions for all tasks in the group
              tgArray.forEach((task, index) => {
                task.position = index + 1
              })
              console.log(`After insertion: ${tgArray.length} tasks`)
            } else {
              // Add to end
              const tgArray = targetGroup.tasks || (targetGroup.tasks = [])
              tgArray.push(updatedTask)
              updatedTask.position = tgArray.length
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
      emitTaskMoved(parseInt(taskId), parseInt(newGroupId), movedTaskResult)
      
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
          due_date: '',
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
      emitTaskCreated(parseInt(groupId), createdTask)
    } catch (error) {
      console.error('Error creating task:', error)
      // Revert optimistic update on error
      await loadTaskData()
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    try {
      console.log('Task update:', taskId, updates)
      
      // Check if this is a group move (group_id is being updated)
      const isGroupMove = updates.group_id !== undefined
      
      if (isGroupMove) {
        // Handle group move similar to handleTaskMove
        const newGroupId = updates.group_id.toString()
        
        // Optimistic update - immediately move the task
        setGroups(prevGroups => {
          const updatedGroups = [...prevGroups]
          
          // Find and remove the task from its current group
          let movedTask: any = null
          for (const group of updatedGroups) {
            const taskIndex = (group.tasks || []).findIndex(task => task.id.toString() === taskId)
            if (taskIndex !== -1) {
              const arr = group.tasks || (group.tasks = [])
              movedTask = { ...arr[taskIndex], ...updates }
              arr.splice(taskIndex, 1)
              
              // Re-index remaining tasks in the source group
              arr.forEach((task, index) => {
                task.position = index + 1
              })
              break
            }
          }
          
          // Add the task to the new group
          if (movedTask) {
            const targetGroup = updatedGroups.find(group => group.id.toString() === newGroupId)
            if (targetGroup) {
              movedTask.group_id = updates.group_id
              const arr = targetGroup.tasks || (targetGroup.tasks = [])
              arr.push(movedTask)
              movedTask.position = arr.length
            }
          }
          
          return updatedGroups
        })
      } else {
        // Regular update - just update the task in place
        setGroups(prevGroups => {
          const updatedGroups = [...prevGroups]
          
          // If relationships are provided, propagate optimistic changes to counterpart tasks
          if (Array.isArray(updates.relationships)) {
            // Find previous relationships for this task
            let previousRels: Array<{ taskId: string; type: string }> = []
            for (const g of updatedGroups) {
              const arr = g.tasks || (g.tasks = [])
              const t = arr.find(t => t.id.toString() === taskId)
              if (t) {
                previousRels = (t as any).relationships || (t as any).task_relationships || []
                break
              }
            }
            const prevIds = new Set(previousRels.map(r => String(r.taskId)))
            const newIds = new Set((updates.relationships as any[]).map((r: any) => String(r.taskId)))
            const removedIds: string[] = [...prevIds].filter(id => !newIds.has(id))
            const addedIds: string[] = [...newIds].filter(id => !prevIds.has(id))

            // Remove inverse link from counterpart tasks
            if (removedIds.length > 0) {
              for (const g of updatedGroups) {
                g.tasks = (g.tasks || []).map((t: any) => {
                  if (removedIds.includes(String(t.id))) {
                    const list = (t.relationships || t.task_relationships || []) as Array<{ taskId: string; type: string }>
                    const filtered = list.filter(rel => String(rel.taskId) !== String(taskId))
                    return { ...t, relationships: filtered, task_relationships: filtered }
                  }
                  return t
                }) as any
              }
            }

            // Add inverse link to counterpart tasks
            if (addedIds.length > 0) {
              for (const g of updatedGroups) {
                g.tasks = (g.tasks || []).map((t: any) => {
                  if (addedIds.includes(String(t.id))) {
                    const list = (t.relationships || t.task_relationships || []) as Array<{ taskId: string; type: string }>
                    const exists = list.some(rel => String(rel.taskId) === String(taskId))
                    const next = exists ? list : [...list, { taskId: String(taskId), type: 'related_to' }]
                    return { ...t, relationships: next, task_relationships: next }
                  }
                  return t
                }) as any
              }
            }
          }
          
          // Find and update the task
          for (const group of updatedGroups) {
            const taskIndex = (group.tasks || []).findIndex(task => task.id.toString() === taskId)
            if (taskIndex !== -1) {
              // Update the task with new data
              const base = (group.tasks || (group.tasks = []))[taskIndex]
              group.tasks[taskIndex] = {
                ...base,
                ...updates,
                ...(updates.custom_fields ? { custom_fields: updates.custom_fields, task_custom_fields: updates.custom_fields } : {}),
                // Merge server shape if present (e.g., assignees array)
                ...(updates.assignees ? { assignees: updates.assignees } : {}),
                updated_at: new Date().toISOString()
              }
              break
            }
          }
          
          return updatedGroups
        })
        // If local-only UI sync, don't call API
        if (updates && updates.__localOnly) {
          return
        }
      }
      
      // Make the API call in the background
      const updatedTask = await updateTask(parseInt(taskId), updates)
      console.log('Task updated successfully:', updatedTask)
      
      // Update with the real task data from the API response
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        
        for (const group of updatedGroups) {
          const taskIndex = (group.tasks || []).findIndex(task => task.id.toString() === taskId)
          if (taskIndex !== -1) {
            const prev = (group.tasks || (group.tasks = []))[taskIndex] as any
            const merged = { ...prev, ...updatedTask }
            // Preserve relationships if API didn't include them
            if (merged.task_relationships == null && prev.task_relationships != null) {
              merged.task_relationships = prev.task_relationships
            }
            // Keep relationships mirrored object too
            if (merged.relationships == null && merged.task_relationships != null) {
              (merged as any).relationships = merged.task_relationships
            }
            // Preserve custom_fields if API didn't include them
            if ((merged as any).task_custom_fields == null && (prev as any).task_custom_fields != null) {
              (merged as any).task_custom_fields = (prev as any).task_custom_fields
            }
            if ((merged as any).custom_fields == null && (prev as any).custom_fields != null) {
              (merged as any).custom_fields = (prev as any).custom_fields
            }
            group.tasks[taskIndex] = merged as any
            break
          }
        }
        
        return updatedGroups
      })
      
    } catch (error) {
      console.error('Error updating task:', error)
      // Revert optimistic update on error
      await loadTaskData()
    }
  }

  const handleTaskRename = async (taskId: string, newTitle: string) => {
    try {
      console.log('Task rename:', taskId, newTitle)
      
      // Optimistic update - immediately update the UI
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        
        // Find and update the task title
        for (const group of updatedGroups) {
          const taskIndex = (group.tasks || []).findIndex(task => task.id.toString() === taskId)
          if (taskIndex !== -1) {
            group.tasks[taskIndex] = {
              ...group.tasks[taskIndex],
              title: newTitle,
              updated_at: new Date().toISOString()
            }
            break
          }
        }
        
        return updatedGroups
      })
      
      // Make the API call in the background
      const updatedTask = await updateTask(parseInt(taskId), { title: newTitle })
      console.log('Task renamed successfully:', updatedTask)
      
      // Update with the real task data from the API response
      setGroups(prevGroups => {
        const updatedGroups = [...prevGroups]
        
        for (const group of updatedGroups) {
          const taskIndex = (group.tasks || []).findIndex(task => task.id.toString() === taskId)
          if (taskIndex !== -1) {
            const prev = group.tasks[taskIndex] as any
            const merged = { ...prev, ...updatedTask }
            if (merged.task_relationships == null && prev.task_relationships != null) {
              merged.task_relationships = prev.task_relationships
            }
            group.tasks[taskIndex] = merged as any
            break
          }
        }
        
        return updatedGroups
      })
      
    } catch (error) {
      console.error('Error renaming task:', error)
      // Revert optimistic update on error
      await loadTaskData()
    }
  }

  const handleTaskDeletePermanent = async (taskId: string) => {
    try {
      // Optimistic local removal
      setGroups(prev => prev.map(g => ({
        ...g,
        tasks: (g.tasks || []).filter(t => String(t.id) !== String(taskId))
      })))

      // Call API to delete
      await deleteTaskApi(parseInt(taskId), true)
    } catch (err) {
      console.error('Error deleting task:', err)
      // Reload to restore consistency if needed
      await loadTaskData()
    }
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
    // Only allow internal users to toggle edit mode
    if (!canManageGroups) {
      return
    }
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
        <div className="flex flex-col h-screen">
        <AppHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 h-screen overflow-hidden max-w-full relative">
            {/* Coming Soon Overlay (temporarily disabled)
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-card border rounded-lg p-8 max-w-md mx-4 text-center shadow-lg">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
                  <p className="text-muted-foreground mb-6">
                    The Task Activity feature is currently under development. 
                    We're working hard to bring you an amazing task management experience.
                  </p>
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Advanced Kanban boards</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Real-time collaboration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Task automation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Progress tracking</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                  className="w-full"
                >
                  Go Back
                </Button>
              </div>
            </div>
            */}
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0 min-w-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">Task Activity</h1>
                <p className="text-muted-foreground">
                  Manage your tasks with drag and drop Kanban boards
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= minZoom}
                    className="h-7 w-7 p-0 hover:bg-muted disabled:opacity-50"
                    title="Zoom Out (Ctrl + -)"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <div className="flex flex-col items-center px-2 min-w-[3rem]">
                    <span className="text-xs font-medium">
                      {zoomLevel}%
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= maxZoom}
                    className="h-7 w-7 p-0 hover:bg-muted disabled:opacity-50"
                    title="Zoom In (Ctrl + +)"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomReset}
                    className="h-7 w-7 p-0 hover:bg-muted"
                    title="Reset Zoom (Ctrl + 0)"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>

                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleEditMode}
                  disabled={!canManageGroups}
                  className={`flex items-center gap-2 ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : ''} ${!canManageGroups ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!canManageGroups ? 'Only Internal users can edit the board' : undefined}
                >
                  <Settings className={`h-4 w-4 ${isEditMode ? 'animate-spin' : ''}`} />
                  {isEditMode ? "Exit Edit Mode" : "Edit Board"}
                </Button>

                <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                  <div className={(!canManageGroups ? 'cursor-not-allowed' : '')}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={!canManageGroups} title={!canManageGroups ? 'Only internal users can add groups' : undefined}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Group
                      </Button>
                    </DialogTrigger>
                  </div>
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
                      <div className={(!canManageGroups ? 'cursor-not-allowed' : '')}>
                        <Button onClick={handleAddGroup} disabled={!canManageGroups} title={!canManageGroups ? 'Only internal users can add groups' : undefined}>Add Group</Button>
                      </div>
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
              <CardContent className="flex-1 p-0 overflow-y-auto overflow-x-hidden">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">Loading tasks...</span>
                    </div>
                  ) : (
                  <KanbanBoard 
                      zoom={zoomLevel}
                      tasks={(() => {
                        const allTasks = groups.flatMap(group => 
                          (group.tasks || []).map(task => ({
                            id: task.id.toString(),
                            creator_id: (task as any).creator_id,
                            is_owner: (task as any).is_owner,
                            title: task.title,
                            description: task.description,
                            priority: task.priority,
                            assignee: '',
                            assignees: (task as any).assignees || [],
                            dueDate: task.due_date,
                            startDate: task.start_date,
                            tags: task.tags,
                            status: group.id.toString(),
                            relationships: (task as any).task_relationships ?? (task as any).relationships ?? [],
                            custom_fields: (task as any).task_custom_fields ?? (task as any).custom_fields ?? [],
                            attachments: (task as any).attachments ?? []
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
                        // Add due-soon UI flag for tasks due within 24 hours, overdue indicator for expired tasks, and done indicator for completed tasks
                        const now = new Date()
                        const withFlags = uniqueTasks.map(t => {
                          const due = t.dueDate ? new Date(t.dueDate) : null
                          const hoursLeft = due ? (due.getTime() - now.getTime()) / 3600000 : null
                          
                          // Find the column/group for this task to check if it's "Done"
                          const taskColumn = groups.find(group => group.id.toString() === t.status)
                          const isDoneColumn = taskColumn && taskColumn.title.toLowerCase() === 'done'
                          
                          // Show overdue indicator if not in Done column and due date has passed
                          const isOverdue = hoursLeft !== null && hoursLeft < 0 && !isDoneColumn
                          
                          // Show due soon indicator if not in Done column and due within 24 hours (but not overdue)
                          const dueSoon = hoursLeft !== null && hoursLeft <= 24 && hoursLeft >= 0 && !isDoneColumn
                          
                          // Show done indicator if in Done column
                          const isDone = isDoneColumn
                          
                          return { ...t, dueSoon, isDone, isOverdue }
                        })
                        return withFlags
                      })()} 
                      columns={groups.map(group => ({
                        id: group.id.toString(),
                        title: group.title,
                        color: group.color
                      }))}
                      onTaskMove={(taskId, newStatus, targetPosition) => handleTaskMove(taskId, newStatus, targetPosition)}
                      onTaskCreate={handleTaskCreate}
                      onTaskUpdate={handleTaskUpdate}
                      onTaskRename={handleTaskRename}
                      onColumnsReorder={handleColumnsReorder}
                      isEditMode={isEditMode}
                      // Wire delete from board to hard delete API
                      onTaskDelete={(taskId: string) => handleTaskDeletePermanent(taskId)}
                  />
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 